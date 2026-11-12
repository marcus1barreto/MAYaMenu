const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

admin.initializeApp();

// Utilitários de Hash seguro para PIN com salt e scrypt (evita persistência em texto claro)
function hashPin(pin, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(pin).trim(), salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

function verifyPin(pin, storedHash, storedSalt) {
  if (!storedHash || !storedSalt || !pin) return false;
  try {
    const derivedKey = crypto.scryptSync(String(pin).trim(), storedSalt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(storedHash, 'hex');
    if (keyBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch (err) {
    return false;
  }
}

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

  const pinDefinido = pin ? String(pin).trim() : (senha && /^\d{4,6}$/.test(String(senha).trim()) ? String(senha).trim() : null);
  if (!pinDefinido || !/^\d{4,6}$/.test(pinDefinido)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'É obrigatório definir um PIN individual explícito de 4 a 6 dígitos para o colaborador.'
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
  // Blindagem contra vazamento horizontal: claims role=='owner' só valem para o restauranteId vinculado
  const isOwner = restData?.ownerId === callerUid || 
    (context.auth.token?.role === 'owner' && context.auth.token?.restauranteId === realRestauranteId);

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
  // Hasheia o PIN individual explícito com salt scrypt (nunca armazena em texto puro)
  const { hash: pinHash, salt: pinSalt } = hashPin(pinDefinido);
  docMembro.pinHash = pinHash;
  docMembro.pinSalt = pinSalt;

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

  // Remove claims e revoga tokens imediatamente para deslogar sessões ativas
  try {
    await admin.auth().setCustomUserClaims(uid, { role: null, restauranteId: null });
    await admin.auth().revokeRefreshTokens(uid);
  } catch (err) {
    console.warn(`Aviso ao revogar tokens e claims do UID ${uid}:`, err);
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
 * Protegida com rate limiting atômico simultâneo (IP e Colaborador)
 * e validação estrita exclusiva de hash scrypt + salt (rejeita texto puro).
 */
exports.loginComPin = functions.https.onCall(async (data, context) => {
  const { restauranteId, pin, role, colaboradorId } = data || {};
  if (!restauranteId || !pin || !colaboradorId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Campos restauranteId, colaboradorId e pin são obrigatórios para autenticação individual.'
    );
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
  const pinLimpo = String(pin).trim();
  const agora = Date.now();

  // 1. Extração segura do IP do cliente inspecionando a cadeia de proxies reversos do Cloud Functions / Cloud Run
  // No Google Cloud Functions, a cadeia confiável coloca o IP real mais confiável
  const rawXff = context.rawRequest?.headers?.['x-forwarded-for'];
  let clientIp = 'unknown_ip';
  if (rawXff) {
    // Separa os nós da cadeia de proxies e valida o formato
    const ips = String(rawXff).split(',').map((s) => s.trim()).filter(Boolean);
    // Em Cloud Functions/Cloud Run, o penúltimo ou último nó antes do proxy interno do GCP é o IP de borda
    clientIp = ips[0] || 'unknown_ip';
  } else if (context.rawRequest?.socket?.remoteAddress) {
    clientIp = context.rawRequest.socket.remoteAddress;
  } else if (context.rawRequest?.ip) {
    clientIp = context.rawRequest.ip;
  }

  const ipKey = String(clientIp).replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // Rate limits rastreados em 3 chaves:
  // 1. IP isolado
  // 2. Colaborador isolado
  // 3. Chave global do restaurante (previne ataques de força bruta distribuídos de múltiplas origens contra a equipe)
  const ipRateLimitRef = restDoc.ref.collection('_pin_rate_limits').doc(`ip_${ipKey}`);
  const userRateLimitRef = restDoc.ref.collection('_pin_rate_limits').doc(`user_${colaboradorId}`);
  const globalRestRateLimitRef = restDoc.ref.collection('_pin_rate_limits').doc('tenant_global');

  // 2. Verificação prévia atômica de bloqueio ativo em qualquer uma das três dimensões
  const [ipSnap, userSnap, globalSnap] = await Promise.all([
    ipRateLimitRef.get(),
    userRateLimitRef.get(),
    globalRestRateLimitRef.get(),
  ]);

  const ipData = ipSnap.exists ? ipSnap.data() : null;
  const userData = userSnap.exists ? userSnap.data() : null;
  const globalData = globalSnap.exists ? globalSnap.data() : null;

  if (ipData?.bloqueadoAte && agora < ipData.bloqueadoAte) {
    const minutosRestantes = Math.ceil((ipData.bloqueadoAte - agora) / 60000);
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Muitas tentativas a partir deste endereço de rede. Bloqueado temporariamente por ${minutosRestantes} minuto(s).`
    );
  }

  if (userData?.bloqueadoAte && agora < userData.bloqueadoAte) {
    const minutosRestantes = Math.ceil((userData.bloqueadoAte - agora) / 60000);
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Muitas tentativas para este colaborador. Bloqueado temporariamente por ${minutosRestantes} minuto(s).`
    );
  }

  if (globalData?.bloqueadoAte && agora < globalData.bloqueadoAte) {
    const minutosRestantes = Math.ceil((globalData.bloqueadoAte - agora) / 60000);
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Muitas tentativas globais no estabelecimento. Bloqueio de contenção por ${minutosRestantes} minuto(s).`
    );
  }

  let targetUid = null;
  let targetRole = role || 'garcom';
  let targetNome = 'Colaborador';
  let targetFoto = null;

  // 3. Validação estrita por hash scrypt + salt diretamente do colaborador selecionado
  const memDoc = await restDoc.ref.collection('equipe').doc(colaboradorId).get();
  if (memDoc.exists) {
    const mData = memDoc.data() || {};
    if (mData.pinHash && mData.pinSalt) {
      if (verifyPin(pinLimpo, mData.pinHash, mData.pinSalt)) {
        targetUid = mData.uid || memDoc.id;
        targetRole = mData.role || targetRole;
        targetNome = mData.nome || targetNome;
        targetFoto = mData.fotoUrl || null;
      }
    }
  }

  // 4. Se falhou na validação do PIN: atualização atômica de tentativas em todas as 3 dimensões
  if (!targetUid) {
    await firestoreDb.runTransaction(async (t) => {
      // Leituras transacionais
      const curIpDoc = await t.get(ipRateLimitRef);
      const curUserDoc = await t.get(userRateLimitRef);
      const curGlobalDoc = await t.get(globalRestRateLimitRef);

      // Incremento IP (limite de 5 tentativas)
      const curIpTentativas = (curIpDoc.exists ? curIpDoc.data()?.tentativas || 0 : 0) + 1;
      const ipPayload = { tentativas: curIpTentativas, ultimoErro: agora };
      if (curIpTentativas >= 5) {
        ipPayload.bloqueadoAte = agora + 15 * 60 * 1000;
      }
      t.set(ipRateLimitRef, ipPayload, { merge: true });

      // Incremento Colaborador (limite de 5 tentativas)
      const curUserTentativas = (curUserDoc.exists ? curUserDoc.data()?.tentativas || 0 : 0) + 1;
      const userPayload = { tentativas: curUserTentativas, ultimoErro: agora };
      if (curUserTentativas >= 5) {
        userPayload.bloqueadoAte = agora + 15 * 60 * 1000;
      }
      t.set(userRateLimitRef, userPayload, { merge: true });

      // Incremento Global do Tenant (limite de 20 falhas distribuídas no estabelecimento)
      const curGlobalTentativas = (curGlobalDoc.exists ? curGlobalDoc.data()?.tentativas || 0 : 0) + 1;
      const globalPayload = { tentativas: curGlobalTentativas, ultimoErro: agora };
      if (curGlobalTentativas >= 20) {
        globalPayload.bloqueadoAte = agora + 15 * 60 * 1000;
      }
      t.set(globalRestRateLimitRef, globalPayload, { merge: true });
    });

    throw new functions.https.HttpsError('permission-denied', 'PIN incorreto para este colaborador.');
  }

  // 5. Se o login foi bem-sucedido: limpa atômica do rate limiting individual e de IP
  const deleteBatch = firestoreDb.batch();
  deleteBatch.delete(ipRateLimitRef);
  deleteBatch.delete(userRateLimitRef);
  await deleteBatch.commit().catch(() => null);

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

  const realRestauranteId = restDoc.id;
  const restData = restDoc.data() || {};
  const isSuperadmin = context.auth.token?.superadmin === true;
  // Blindagem contra vazamento horizontal: claim role=='owner' só autoriza para o seu próprio restauranteId
  const isOwner = restData.ownerId === context.auth.uid ||
    (context.auth.token?.role === 'owner' && context.auth.token?.restauranteId === realRestauranteId);

  if (!isOwner && !isSuperadmin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas o dono deste restaurante ou superadmin pode alterar o PIN.');
  }

  // Gera hash e salt criptográfico seguro (elimina texto puro)
  const { hash: pinHash, salt: pinSalt } = hashPin(pinLimpo);

  await restDoc.ref.collection('equipe').doc(membroUid).set(
    {
      pinHash,
      pinSalt,
      pin: admin.firestore.FieldValue.delete(), // remove campo legado em texto puro se existir
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Retorna status sem refletir o PIN em texto claro na resposta
  return { sucesso: true };
});


/**
 * Webhook HTTPS legado para Pix (DESCONTINUADO por segurança).
 * Responde 410 Gone. O fluxo de pagamento ativo e seguro é processado via Mercado Pago Webhook oficial.
 */
exports.pixWebhook = functions.https.onRequest(async (req, res) => {
  res.status(410).json({
    erro: 'Endpoint legado descontinuado por motivos de conformidade e segurança.',
    mensagem: 'Utilize o fluxo oficial de pagamento autenticado integrado ao PSP.',
  });
});



