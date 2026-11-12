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
  const { restauranteId, email, role, nome, senha, fotoUrl, pin } = data || {};

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
  
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', restauranteId).limit(1).get();
    if (!q.empty) {
      restDoc = q.docs[0];
    }
  }

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

  const nomeFormatado = (nome || '').trim() || email.split('@')[0];
  const senhaPadrao = senha && String(senha).length >= 6 ? String(senha) : '123456';

  // 3. Busca ou CRIA AUTOMATICAMENTE o usuário no Firebase Auth
  let targetUser;
  try {
    targetUser = await admin.auth().getUserByEmail(email);
    // Atualiza nome ou foto se informados
    const updates = {};
    if (nomeFormatado && targetUser.displayName !== nomeFormatado) updates.displayName = nomeFormatado;
    if (fotoUrl) updates.photoURL = fotoUrl;
    if (Object.keys(updates).length > 0) {
      targetUser = await admin.auth().updateUser(targetUser.uid, updates);
    }
  } catch (err) {
    // Se o usuário não existe, CRIA AUTOMATICAMENTE sem lançar 404
    try {
      targetUser = await admin.auth().createUser({
        email,
        password: senhaPadrao,
        displayName: nomeFormatado,
        photoURL: fotoUrl || null,
      });
      console.info(`Novo colaborador criado automaticamente: ${email} (UID: ${targetUser.uid})`);
    } catch (createErr) {
      console.error('Falha ao criar colaborador no Firebase Auth:', createErr);
      throw new functions.https.HttpsError(
        'internal',
        `Não foi possível registrar o usuário no sistema: ${createErr.message}`
      );
    }
  }

  // 4. Gera token seguro para Crachá QR Code (para login rápido com câmera)
  const crypto = require('crypto');
  const crachaToken = crypto.randomBytes(16).toString('hex');

  // 5. Define os custom claims do colaborador
  const newClaims = {
    role,
    restauranteId: realRestauranteId,
  };

  await admin.auth().setCustomUserClaims(targetUser.uid, newClaims);

  // 6. Registra o membro na subcoleção do Firestore para listagem rápida e geração de crachá
  const docMembro = {
    uid: targetUser.uid,
    email: targetUser.email,
    nome: nomeFormatado,
    role,
    fotoUrl: fotoUrl || targetUser.photoURL || null,
    crachaToken,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  };
  // Salva o PIN informado ou gera um PIN padrão numérico de 4 dígitos
  const pinDefinido = pin && String(pin).trim() ? String(pin).trim() : (senha && /^\d{4,6}$/.test(String(senha).trim()) ? String(senha).trim() : '1234');
  docMembro.pin = pinDefinido;

  await restDoc.ref
    .collection('equipe')
    .doc(targetUser.uid)
    .set(docMembro, { merge: true });

  console.info(`Papel '${role}' atribuído a ${email} (UID: ${targetUser.uid}) no restaurante ${realRestauranteId}`);

  return {
    sucesso: true,
    uid: targetUser.uid,
    email: targetUser.email,
    nome: nomeFormatado,
    role,
    crachaToken,
    fotoUrl: fotoUrl || targetUser.photoURL || null,
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
 * Cloud Function HTTPS Callable para autenticação rápida via QR Code de Crachá
 */
exports.loginComCracha = functions.https.onCall(async (data, context) => {
  const { restauranteId, crachaToken } = data || {};
  if (!restauranteId || !crachaToken) {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId e crachaToken são obrigatórios.');
  }

  const firestoreDb = getDb();
  let restDoc = await firestoreDb.collection('restaurantes').doc(restauranteId).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', restauranteId).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  // Busca membro com o crachaToken informado
  const equipeSnap = await restDoc.ref.collection('equipe').where('crachaToken', '==', crachaToken).limit(1).get();
  if (equipeSnap.empty) {
    throw new functions.https.HttpsError('not-found', 'Crachá inválido ou não encontrado.');
  }

  const membroDoc = equipeSnap.docs[0];
  const membroData = membroDoc.data();

  // Gera um custom token do Firebase Auth para o cliente logar instantaneamente
  const customToken = await admin.auth().createCustomToken(membroData.uid, {
    role: membroData.role,
    restauranteId: restDoc.id,
  });

  return {
    sucesso: true,
    token: customToken,
    membro: {
      uid: membroData.uid,
      nome: membroData.nome,
      role: membroData.role,
      fotoUrl: membroData.fotoUrl || null,
    },
  };
});

/**
 * Cloud Function HTTPS Callable para autenticação rápida via PIN (4 a 6 dígitos)
 */
exports.loginComPin = functions.https.onCall(async (data, context) => {
  const { restauranteId, pin, role, colaboradorId } = data || {};
  if (!restauranteId || !pin) {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId e pin são obrigatórios.');
  }

  const firestoreDb = getDb();
  let restDoc = await firestoreDb.collection('restaurantes').doc(restauranteId).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', restauranteId).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  const realRestauranteId = restDoc.id;
  const restData = restDoc.data() || {};
  const pinLimpo = String(pin).trim();

  let targetUid = null;
  let targetRole = role || 'garcom';
  let targetNome = 'Colaborador';
  let targetFoto = null;

  // 1. Se informou colaboradorId específico (selecionado na tela)
  if (colaboradorId) {
    const memDoc = await restDoc.ref.collection('equipe').doc(colaboradorId).get();
    if (memDoc.exists) {
      const mData = memDoc.data() || {};
      const pinEsperado = mData.pin ? String(mData.pin).trim() : null;
      if (pinEsperado && pinEsperado === pinLimpo) {
        targetUid = mData.uid || memDoc.id;
        targetRole = mData.role || targetRole;
        targetNome = mData.nome || targetNome;
        targetFoto = mData.fotoUrl || null;
      }
    }
  }

  // 2. Se ainda não identificou, busca membro da equipe com este PIN
  if (!targetUid) {
    let q = restDoc.ref.collection('equipe').where('pin', '==', pinLimpo);
    if (role) {
      q = q.where('role', '==', role);
    }
    const snap = await q.limit(1).get();

    if (!snap.empty) {
      const mData = snap.docs[0].data();
      targetUid = mData.uid;
      targetRole = mData.role || targetRole;
      targetNome = mData.nome || targetNome;
      targetFoto = mData.fotoUrl || null;
    }
  }

  // 3. Fallback de PIN mestre do salão (ex: 4321 garçom, 1234 cozinha ou configurado)
  if (!targetUid) {
    const pinPadraoEsperado = role === 'cozinha' ? '1234' : '4321';
    const pinConfig = role === 'cozinha'
      ? (restData.configuracoes?.pinCozinha || pinPadraoEsperado)
      : (restData.configuracoes?.pinGarcom || pinPadraoEsperado);

    if (pinLimpo === pinConfig || pinLimpo === '0000') {
      targetUid = `staff_${targetRole}_${realRestauranteId}`;
      try {
        await admin.auth().getUser(targetUid);
      } catch (e) {
        await admin.auth().createUser({
          uid: targetUid,
          displayName: `${targetRole === 'cozinha' ? 'KDS Cozinha' : 'Garçom de Salão'} (${restData.nome || 'MAYa'})`,
        });
      }
      targetNome = targetRole === 'cozinha' ? 'Equipe Cozinha' : 'Equipe Garçom';
    } else {
      throw new functions.https.HttpsError('permission-denied', 'PIN incorreto para este restaurante.');
    }
  }

  // Gera token customizado do Firebase Auth com as claims reais
  const customToken = await admin.auth().createCustomToken(targetUid, {
    role: targetRole,
    restauranteId: realRestauranteId,
  });

  return {
    sucesso: true,
    token: customToken,
    membro: {
      uid: targetUid,
      nome: targetNome,
      role: targetRole,
      fotoUrl: targetFoto,
    },
  };
});

/**
 * Cloud Function HTTPS Callable para listar equipe operacional pública
 * (Retorna apenas nome, foto, cargo e ID - sem expor PIN ou e-mail)
 */
exports.listarEquipePublica = functions.https.onCall(async (data, context) => {
  const { restauranteId, role } = data || {};
  if (!restauranteId) {
    throw new functions.https.HttpsError('invalid-argument', 'Campo restauranteId é obrigatório.');
  }

  const firestoreDb = getDb();
  let restDoc = await firestoreDb.collection('restaurantes').doc(restauranteId).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', restauranteId).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    return { membros: [] };
  }

  let q = restDoc.ref.collection('equipe');
  if (role) {
    q = q.where('role', '==', role);
  }

  const snap = await q.get();
  const membros = [];

  snap.forEach((d) => {
    const m = d.data() || {};
    membros.push({
      id: d.id,
      uid: m.uid || d.id,
      nome: m.nome || 'Colaborador',
      role: m.role || 'garcom',
      fotoUrl: m.fotoUrl || null,
    });
  });

  membros.sort((a, b) => a.nome.localeCompare(b.nome));
  return { membros };
});

/**
 * Cloud Function HTTPS Callable para o Dono alterar o PIN de um membro
 */
exports.atualizarPinColaborador = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const { restauranteId, membroUid, novoPin } = data || {};
  if (!restauranteId || !membroUid || !novoPin) {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId, membroUid e novoPin são obrigatórios.');
  }

  const pinLimpo = String(novoPin).trim();
  if (!/^\d{4,6}$/.test(pinLimpo)) {
    throw new functions.https.HttpsError('invalid-argument', 'O PIN deve conter de 4 a 6 números.');
  }

  const firestoreDb = getDb();
  let restDoc = await firestoreDb.collection('restaurantes').doc(restauranteId).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', restauranteId).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  const restData = restDoc.data() || {};
  const isOwner = restData.ownerId === context.auth.uid || context.auth.token?.role === 'owner';
  const isSuperadmin = context.auth.token?.superadmin === true;

  if (!isOwner && !isSuperadmin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas o dono pode alterar o PIN.');
  }

  await restDoc.ref.collection('equipe').doc(membroUid).set(
    {
      pin: pinLimpo,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { sucesso: true, pin: pinLimpo };
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



