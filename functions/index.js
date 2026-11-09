const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

admin.initializeApp();

// Garante conexão ao banco com ID "mayamenu-bd" ou fallback ao default
function getDb() {
  try {
    return getFirestore('mayamenu-bd');
  } catch (err) {
    return admin.firestore();
  }
}

/**
 * Quando um documento em `restaurantes/{restId}` é criado, define o claim `owner`
 * no UID do usuário que criou o restaurante (campo `ownerId`).
 */
exports.setRestaurantOwnerClaims = functions.firestore
  .document('restaurantes/{restId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const ownerUid = data?.ownerId;
    const restId = context.params.restId;
    if (!ownerUid) {
      console.warn('Documento de restaurante criado sem ownerId.');
      return null;
    }
    try {
      const claims = { role: 'owner', restauranteId: restId };
      await admin.auth().setCustomUserClaims(ownerUid, claims);
      console.info(`Custom claim 'owner' atribuído ao UID ${ownerUid} para restaurante ${restId}`);
    } catch (error) {
      console.error('Erro ao definir custom claims:', error);
    }
    return null;
  });

/**
 * Cloud Function HTTPS Callable para o Dono do restaurante atribuir
 * papéis (garcom ou cozinha) a membros da equipe.
 */
exports.setStaffRole = functions.https.onCall(async (data, context) => {
  // 1. Verifica se quem chamou está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'É necessário estar autenticado para gerenciar equipe.'
    );
  }

  const callerUid = context.auth.uid;
  const { restauranteId, email, role } = data || {};

  if (!restauranteId || !email || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Campos obrigatórios: restauranteId, email, role.'
    );
  }

  if (role !== 'garcom' && role !== 'cozinha') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'O papel (role) deve ser "garcom" ou "cozinha".'
    );
  }

  // 2. Valida se o chamador é dono do restaurante
  const firestoreDb = getDb();
  let restDoc = await firestoreDb.collection('restaurantes').doc(restauranteId).get();
  
  // Se não encontrou pelo ID direto, tenta por slug
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', restauranteId).limit(1).get();
    if (!q.empty) {
      restDoc = q.docs[0];
    }
  }

  // Se ainda assim não encontrou e for o banco default, tenta no banco padrão admin.firestore()
  if (!restDoc.exists) {
    const defaultDb = admin.firestore();
    const tryDefault = await defaultDb.collection('restaurantes').doc(restauranteId).get();
    if (tryDefault.exists) {
      restDoc = tryDefault;
    }
  }

  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  const realRestauranteId = restDoc.id;
  const restData = restDoc.data();
  const isSuperadmin = context.auth.token?.superadmin === true;
  const isOwner = restData?.ownerId === callerUid || context.auth.token?.role === 'owner';

  if (!isOwner && !isSuperadmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Apenas o dono do restaurante ou superadmin pode gerenciar membros da equipe.'
    );
  }

  // 3. Busca o usuário pelo e-mail
  let targetUser;
  try {
    targetUser = await admin.auth().getUserByEmail(email);
  } catch (err) {
    throw new functions.https.HttpsError(
      'not-found',
      `Usuário com e-mail "${email}" não encontrado no sistema. Ele precisa criar uma conta primeiro.`
    );
  }

  // 4. Define os custom claims do colaborador
  const newClaims = {
    role,
    restauranteId: realRestauranteId,
  };

  await admin.auth().setCustomUserClaims(targetUser.uid, newClaims);

  // 5. Registra o membro na subcoleção do Firestore para listagem rápida no painel
  await restDoc.ref
    .collection('equipe')
    .doc(targetUser.uid)
    .set({
      uid: targetUser.uid,
      email: targetUser.email,
      nome: targetUser.displayName || email.split('@')[0],
      role,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

  console.info(`Papel '${role}' atribuído a ${email} (UID: ${targetUser.uid}) no restaurante ${realRestauranteId}`);

  return {
    sucesso: true,
    uid: targetUser.uid,
    email: targetUser.email,
    role,
  };
});

/**
 * Cloud Function HTTPS Callable para remover um membro da equipe
 */
exports.removeStaffMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Requer autenticação.');
  }

  const callerUid = context.auth.uid;
  const { restauranteId, uid } = data || {};

  if (!restauranteId || !uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId e uid são obrigatórios.');
  }

  const firestoreDb = getDb();
  let restDoc = await firestoreDb.collection('restaurantes').doc(restauranteId).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', restauranteId).limit(1).get();
    if (!q.empty) {
      restDoc = q.docs[0];
    }
  }
  if (!restDoc.exists) {
    const tryDefault = await admin.firestore().collection('restaurantes').doc(restauranteId).get();
    if (tryDefault.exists) restDoc = tryDefault;
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  const isSuperadmin = context.auth.token?.superadmin === true;
  const isOwner = restDoc.data()?.ownerId === callerUid;

  if (!isOwner && !isSuperadmin) {
    throw new functions.https.HttpsError('permission-denied', 'Permissão negada.');
  }

  // Remove claims
  try {
    await admin.auth().setCustomUserClaims(uid, { role: null, restauranteId: null });
  } catch (err) {
    console.warn(`Aviso ao remover claims do UID ${uid}:`, err);
  }

  // Remove do Firestore
  await restDoc.ref
    .collection('equipe')
    .doc(uid)
    .delete();

  return { sucesso: true };
});

/**
 * Webhook HTTPS para confirmação de pagamento Pix ou baixa automática.
 * Pode ser invocado por gateways ou PSPs (ex: Mercado Pago, Cora, Gerencianet/Efí, etc.).
 * Recebe o identificador (txId ou payload da comanda) e dá baixa automática no Firestore.
 */
exports.pixWebhook = functions.https.onRequest(async (req, res) => {
  // Apenas aceita requisições POST
  if (req.method !== 'POST') {
    res.status(405).send('Método não permitido');
    return;
  }

  try {
    const { restauranteId, mesaNumero, clienteId, txId, secret } = req.body || {};

    if (!restauranteId || !mesaNumero || !clienteId) {
      res.status(400).json({
        erro: 'Campos obrigatórios: restauranteId, mesaNumero, clienteId',
      });
      return;
    }

    const mesaStr = String(mesaNumero);
    const db = admin.firestore();

    const comandaRef = db
      .collection('restaurantes')
      .doc(restauranteId)
      .collection('mesas')
      .doc(mesaStr)
      .collection('comandas_abertas')
      .doc(clienteId);

    const comandaSnap = await comandaRef.get();
    if (!comandaSnap.exists) {
      res.status(404).json({ erro: 'Comanda não encontrada' });
      return;
    }

    // Marca a comanda como paga
    await comandaRef.update({
      status: 'pago',
      pagoEm: admin.firestore.FieldValue.serverTimestamp(),
      metodoPagamento: 'pix',
      txId: txId || null,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.info(`Baixa Pix confirmada via webhook: Restaurante ${restauranteId}, Mesa ${mesaStr}, Cliente ${clienteId}`);

    res.status(200).json({
      sucesso: true,
      mensagem: 'Comanda baixada com sucesso via Pix.',
      restauranteId,
      mesa: mesaStr,
      clienteId,
    });
  } catch (error) {
    console.error('Erro ao processar webhook Pix:', error);
    res.status(500).json({ erro: 'Erro interno ao processar baixa Pix' });
  }
});



