const functions = require('firebase-functions');
const {
  onDocumentCreated,
  onDocumentWritten,
} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const {
  extrairIpConviavel,
  sanitizarChave,
  verificarBloqueioAtivo,
  calcularPayloadsFalha,
} = require('./rateLimiter');

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

// Usa exclusivamente o banco nomeado configurado pelo app. Nunca faz fallback silencioso
// para (default), pois isso dividiria os dados entre bancos diferentes.
function getDb() {
  return getFirestore('mayamenu-bd');
}

/**
 * Quando um documento em `restaurantes/{restId}` é criado, define o claim `owner`
 * no UID do usuário que criou o restaurante (campo `ownerId`).
 */
exports.setRestaurantOwnerClaims = onDocumentCreated({
  document: 'restaurantes/{restId}',
  database: 'mayamenu-bd',
  region: 'us-central1',
  retry: true,
}, async (event) => {
    const snap = event.data;
    if (!snap) return null;
    const data = snap.data();
    const ownerUid = data?.ownerId;
    const restId = event.params.restId;
    if (!ownerUid) {
      console.warn('Documento de restaurante criado sem ownerId.');
      return null;
    }
    try {
      const user = await admin.auth().getUser(ownerUid);
      const claims = { ...(user.customClaims || {}), role: 'owner', restauranteId: restId };
      await admin.auth().setCustomUserClaims(ownerUid, claims);
      console.info(`Custom claim 'owner' atribuído ao UID ${ownerUid} para restaurante ${restId}`);
    } catch (error) {
      console.error('Erro ao definir custom claims:', error);
      throw error;
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

  // 1. Extração segura de IP contra falsificação e spoofing de cabeçalhos
  const clientIp = extrairIpConviavel(context.rawRequest);
  const ipKey = sanitizarChave(clientIp);
  
  // Rate limits rastreados em 3 chaves no Firestore:
  const ipRateLimitRef = restDoc.ref.collection('_pin_rate_limits').doc(`ip_${ipKey}`);
  const userRateLimitRef = restDoc.ref.collection('_pin_rate_limits').doc(`user_${sanitizarChave(colaboradorId)}`);
  const globalRestRateLimitRef = restDoc.ref.collection('_pin_rate_limits').doc('tenant_global');

  // 2. Busca os dados do colaborador para validação do hash scrypt + salt
  const memDoc = await restDoc.ref.collection('equipe').doc(colaboradorId).get();
  const mData = memDoc.exists ? (memDoc.data() || {}) : {};
  const pinCorreto = Boolean(mData.pinHash && mData.pinSalt && verifyPin(pinLimpo, mData.pinHash, mData.pinSalt));

  // 3. EXECUÇÃO ATÔMICA COORDENADA: Verificação de Admissão e Atualização de Bloqueio dentro da Transação
  // Impede que rajadas simultâneas contornem o limite antes que o bloqueio seja percebido
  await firestoreDb.runTransaction(async (t) => {
    // Leituras transacionais obrigatórias (garantem isolamento SERIALIZABLE do Firestore)
    const curIpDoc = await t.get(ipRateLimitRef);
    const curUserDoc = await t.get(userRateLimitRef);
    const curGlobalDoc = await t.get(globalRestRateLimitRef);

    const curIpData = curIpDoc.exists ? curIpDoc.data() : null;
    const curUserData = curUserDoc.exists ? curUserDoc.data() : null;
    const curGlobalData = curGlobalDoc.exists ? curGlobalDoc.data() : null;

    // A) Decisão de Admissão estritamente DENTRO da transação
    const bloqueioTransacional = verificarBloqueioAtivo({
      ipData: curIpData,
      userData: curUserData,
      globalData: curGlobalData,
      agora,
    });

    if (bloqueioTransacional.bloqueado) {
      throw new functions.https.HttpsError('resource-exhausted', bloqueioTransacional.mensagem);
    }

    // B) Se o PIN estiver incorreto: incrementa e grava contadores/bloqueios na mesma transação atômica
    if (!pinCorreto) {
      const { ipPayload, userPayload, globalPayload } = calcularPayloadsFalha({
        curIpData: curIpData || {},
        curUserData: curUserData || {},
        curGlobalData: curGlobalData || {},
        agora,
      });

      t.set(ipRateLimitRef, ipPayload, { merge: true });
      t.set(userRateLimitRef, userPayload, { merge: true });
      t.set(globalRestRateLimitRef, globalPayload, { merge: true });
    } else {
      // C) Se o PIN estiver correto: limpa atômica do rate limiting individual
      t.delete(ipRateLimitRef);
      t.delete(userRateLimitRef);
    }
  });

  // Se falhou na validação de PIN (após contadores atômicos serem devidamente persistidos)
  if (!pinCorreto) {
    throw new functions.https.HttpsError('permission-denied', 'PIN incorreto para este colaborador.');
  }

  // 4. Se o login foi bem-sucedido: extrai dados e emite token
  const targetUid = mData.uid || memDoc.id;
  const targetRole = mData.role || (role || 'garcom');
  const targetNome = mData.nome || 'Colaborador';
  const targetFoto = mData.fotoUrl || null;

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


const PEDIDO_ID_REGEX = /^[a-zA-Z0-9_-]{8,80}$/;
const STATUS_COMANDA_PERMITIDOS = new Set(['pedindo', 'aguardando_pratos']);
const MAX_SUBTOTAL_CENTAVOS = 5000000; // R$ 50.000,00 limite operacional por pedido
const MESA_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function getMesaTokenSecret() {
  const secret = process.env.MESA_SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 32) {
    throw new functions.https.HttpsError(
      'internal',
      'Segredo de sessão de mesa não configurado corretamente.'
    );
  }
  return secret;
}

function compararSegredoConstante(valorA, valorB) {
  if (typeof valorA !== 'string' || typeof valorB !== 'string' || !valorA || !valorB) {
    return false;
  }
  const bufA = Buffer.from(valorA, 'utf8');
  const bufB = Buffer.from(valorB, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function assinarMesaToken(restauranteId, mesaStr, authUid, expMillis, qrVersao = 1) {
  const versao = Number.isInteger(Number(qrVersao)) && Number(qrVersao) >= 1 ? Number(qrVersao) : 1;
  const payload = `${restauranteId}:${mesaStr}:${authUid}:${expMillis}:${versao}`;
  const sig = crypto
    .createHmac('sha256', getMesaTokenSecret())
    .update(payload)
    .digest('hex');
  return `${expMillis}.${versao}.${sig}`;
}

function verificarMesaToken(mesaToken, restauranteId, mesaStr, authUid, qrVersaoEsperada) {
  if (typeof mesaToken !== 'string' || !mesaToken.includes('.')) {
    return false;
  }
  const partes = mesaToken.split('.');
  if (partes.length !== 3) {
    return false;
  }
  const [expRaw, versaoRaw, sigRaw] = partes;
  const expMillis = Number(expRaw);
  const versao = Number(versaoRaw);
  if (!Number.isInteger(expMillis) || expMillis < Date.now()) {
    return false;
  }
  if (!Number.isInteger(versao) || versao < 1) {
    return false;
  }
  if (qrVersaoEsperada !== undefined && versao !== Number(qrVersaoEsperada)) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/i.test(sigRaw)) {
    return false;
  }
  const esperado = assinarMesaToken(restauranteId, mesaStr, authUid, expMillis, versao).split('.')[2];
  try {
    return crypto.timingSafeEqual(Buffer.from(sigRaw, 'hex'), Buffer.from(esperado, 'hex'));
  } catch {
    return false;
  }
}

function toCentavosSeguro(valor, campo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    throw new functions.https.HttpsError('failed-precondition', `${campo} inválido no cardápio do servidor.`);
  }
  const centavos = Math.round(valor * 100);
  if (!Number.isSafeInteger(centavos) || centavos < 0 || centavos > MAX_SUBTOTAL_CENTAVOS) {
    throw new functions.https.HttpsError('failed-precondition', `${campo} fora dos limites operacionais.`);
  }
  return centavos;
}

function gerarHashPayloadPedido(dados) {
  return crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
}

/**
 * Valida modificadores enviados contra a definição oficial de grupoModificadores no servidor.
 * Também valida a consistência da configuração do catálogo (unicidade, mínimo/máximo válidos).
 * Retorna os modificadores normalizados com soma em centavos inteiros.
 */
function validarModificadoresServidor(modificadoresCliente, grupoModificadoresServidor) {
  const grupos = Array.isArray(grupoModificadoresServidor) ? grupoModificadoresServidor : [];
  const listaCliente = Array.isArray(modificadoresCliente) ? modificadoresCliente : [];

  // 1. Valida consistência do catálogo de grupos e opções no servidor
  const nomesGruposVistos = new Set();
  const idsGruposVistos = new Set();
  const regrasPorGrupo = new Map();

  for (const g of grupos) {
    const nomeGrupo = String(g?.nome || '').trim();
    const idGrupo = g?.id ? String(g.id).trim() : '';
    const chaveGrupo = nomeGrupo || idGrupo;

    if (!chaveGrupo) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Configuração de grupo de modificadores sem identificador no cardápio.'
      );
    }
    if (nomeGrupo && nomesGruposVistos.has(nomeGrupo)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Grupo de modificadores duplicado no cardápio: "${nomeGrupo}".`
      );
    }
    if (idGrupo && idsGruposVistos.has(idGrupo)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Identificador de grupo duplicado no cardápio: "${idGrupo}".`
      );
    }
    if (nomeGrupo) nomesGruposVistos.add(nomeGrupo);
    if (idGrupo) idsGruposVistos.add(idGrupo);

    let minReq = 0;
    if (g?.minimo !== undefined && g?.minimo !== null) {
      if (typeof g.minimo !== 'number' || !Number.isInteger(g.minimo) || g.minimo < 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Configuração de mínimo inválida no grupo "${chaveGrupo}".`
        );
      }
      minReq = g.minimo;
    }
    if (g?.obrigatorio) {
      minReq = Math.max(1, minReq);
    }

    let maxReq = null;
    if (g?.maximo !== undefined && g?.maximo !== null) {
      if (typeof g.maximo !== 'number' || !Number.isInteger(g.maximo) || g.maximo < 1) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Configuração de máximo inválida no grupo "${chaveGrupo}".`
        );
      }
      maxReq = g.maximo;
    }

    if (maxReq !== null && minReq > maxReq) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Configuração inconsistente (mínimo maior que máximo) no grupo "${chaveGrupo}".`
      );
    }

    const opcoes = Array.isArray(g?.opcoes) ? g.opcoes : [];
    const nomesOpcoesVistos = new Set();
    const idsOpcoesVistos = new Set();
    for (const op of opcoes) {
      const nomeOp = String(op?.nome || '').trim();
      const idOp = op?.id ? String(op.id).trim() : '';
      if (!nomeOp && !idOp) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Opção sem identificador no grupo "${chaveGrupo}".`
        );
      }
      if (nomeOp && nomesOpcoesVistos.has(nomeOp)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Opção duplicada "${nomeOp}" no grupo "${chaveGrupo}".`
        );
      }
      if (idOp && idsOpcoesVistos.has(idOp)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Identificador de opção duplicado "${idOp}" no grupo "${chaveGrupo}".`
        );
      }
      if (nomeOp) nomesOpcoesVistos.add(nomeOp);
      if (idOp) idsOpcoesVistos.add(idOp);
    }

    regrasPorGrupo.set(chaveGrupo, {
      grupo: g,
      minReq,
      maxReq,
      permiteRepeticao: Boolean(g?.permiteRepeticao || g?.permitirDuplicadas),
    });
  }

  // 2. Valida modificadores selecionados pelo cliente
  const contagemPorGrupo = new Map();
  const opcoesSelecionadasPorGrupo = new Map();
  const modificadoresValidados = [];
  let somaAdicionaisCentavos = 0;

  for (const mod of listaCliente) {
    const grupoNome = String(mod?.grupo || '').trim();
    const opcaoNome = String(mod?.opcao || '').trim();
    if (!grupoNome || !opcaoNome) {
      throw new functions.https.HttpsError('invalid-argument', 'Modificador inválido no pedido.');
    }

    const grupoServer = grupos.find(
      (g) => String(g?.nome || '').trim() === grupoNome || (g?.id && String(g.id).trim() === grupoNome)
    );
    if (!grupoServer) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Grupo de modificadores inválido: ${grupoNome}.`
      );
    }

    const opcoes = Array.isArray(grupoServer.opcoes) ? grupoServer.opcoes : [];
    const opcaoServer = opcoes.find(
      (o) => String(o?.nome || '').trim() === opcaoNome || (o?.id && String(o.id).trim() === opcaoNome)
    );
    if (!opcaoServer) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Opção de modificador inválida (${opcaoNome}) no grupo ${grupoNome}.`
      );
    }

    const chaveGrupo = String(grupoServer.nome || grupoServer.id).trim();
    const chaveOpcao = String(opcaoServer.nome || opcaoServer.id).trim();
    const regraGrupo = regrasPorGrupo.get(chaveGrupo);

    if (!opcoesSelecionadasPorGrupo.has(chaveGrupo)) {
      opcoesSelecionadasPorGrupo.set(chaveGrupo, new Set());
    }
    const jaSelecionadas = opcoesSelecionadasPorGrupo.get(chaveGrupo);
    if (jaSelecionadas.has(chaveOpcao) && !regraGrupo?.permiteRepeticao) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Opção "${chaveOpcao}" não pode ser selecionada mais de uma vez no grupo "${chaveGrupo}".`
      );
    }
    jaSelecionadas.add(chaveOpcao);

    const precoAdicionalRaw = opcaoServer.precoAdicional === undefined ? 0 : opcaoServer.precoAdicional;
    const precoAdicionalCentavos = toCentavosSeguro(precoAdicionalRaw, 'Preço de adicional');

    contagemPorGrupo.set(chaveGrupo, (contagemPorGrupo.get(chaveGrupo) || 0) + 1);
    somaAdicionaisCentavos += precoAdicionalCentavos;
    modificadoresValidados.push({
      grupo: String(grupoServer.nome || grupoNome),
      opcao: String(opcaoServer.nome || opcaoNome),
      precoAdicional: precoAdicionalCentavos / 100,
    });
  }

  for (const [chaveGrupo, regra] of regrasPorGrupo.entries()) {
    const qtd = contagemPorGrupo.get(chaveGrupo) || 0;
    if (qtd < regra.minReq) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Seleção obrigatória incompleta no grupo "${chaveGrupo}".`
      );
    }
    if (regra.maxReq !== null && qtd > regra.maxReq) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Quantidade máxima excedida no grupo "${chaveGrupo}".`
      );
    }
  }

  return { modificadoresValidados, somaAdicionaisCentavos };
}

function hashQrCredencial(qrCredencial) {
  return crypto.createHash('sha256').update(String(qrCredencial || '')).digest('hex');
}

async function verificarPermissaoOperacionalRestaurante(
  firestoreDb,
  restDoc,
  authUid,
  authToken,
  rolesPermitidos = ['owner', 'admin', 'garcom', 'cozinha']
) {
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  const restData = restDoc.data() || {};
  if (authToken?.superadmin === true || restData.ownerId === authUid) {
    return true;
  }

  // Sempre valida vínculo e estado ativo no documento da equipe no backend (revogação imediata)
  const membroSnap = await restDoc.ref.collection('equipe').doc(authUid).get();
  if (membroSnap.exists) {
    const mData = membroSnap.data() || {};
    const roleEquipe = String(mData.role || '');
    if (mData.ativo !== false && rolesPermitidos.includes(roleEquipe)) {
      return true;
    }
    throw new functions.https.HttpsError(
      'permission-denied',
      'Colaborador inativo ou sem permissão para esta operação.'
    );
  }

  throw new functions.https.HttpsError(
    'permission-denied',
    'Usuário sem vínculo operacional autorizado neste estabelecimento.'
  );
}

/**
 * Gera ou rotaciona a credencial secreta de QR Code de uma mesa física.
 * Armazena apenas o hash SHA-256 no Firestore (qrCredencialHash) e entrega a credencial
 * em texto claro exclusivamente no ato da geração ou reemissão explícita (rotacionar: true).
 */
async function executarGarantirCredencialMesa(firestoreDb, authUid, authToken, payload) {
  const { restauranteId, mesa, rotacionar } = payload || {};
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  if (!restauranteId || mesa === undefined || mesa === null || String(mesa).trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId e mesa são obrigatórios.');
  }

  let restDoc = await firestoreDb.collection('restaurantes').doc(String(restauranteId)).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', String(restauranteId)).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  await verificarPermissaoOperacionalRestaurante(
    firestoreDb,
    restDoc,
    authUid,
    authToken,
    ['owner', 'admin', 'garcom']
  );

  const restData = restDoc.data() || {};
  const mesaStr = String(mesa).trim();
  const numMesaParsed = Number(mesaStr);
  if (!Number.isInteger(numMesaParsed) || numMesaParsed < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'Número de mesa inválido.');
  }
  const maxMesasRest = Number(restData.maxMesas || restData.licenca?.maxMesas || 0);
  if (maxMesasRest > 0 && numMesaParsed > maxMesasRest) {
    throw new functions.https.HttpsError('invalid-argument', 'Mesa fora da capacidade licenciada.');
  }

  const mesaRef = restDoc.ref.collection('mesas').doc(mesaStr);
  let respostaCredencial = null;

  await firestoreDb.runTransaction(async (t) => {
    const mesaSnap = await t.get(mesaRef);
    const mData = mesaSnap.exists ? mesaSnap.data() || {} : {};

    if (!rotacionar && typeof mData.qrCredencialHash === 'string' && mData.qrCredencialHash.length === 64) {
      respostaCredencial = {
        sucesso: true,
        jaConfigurada: true,
        restauranteId: restDoc.id,
        mesa: numMesaParsed,
      };
      return;
    }

    const novaCredencial = crypto.randomBytes(24).toString('hex');
    const credencialHash = hashQrCredencial(novaCredencial);
    const versaoAtual = Number(mData.qrVersao) || 1;
    const novaVersao = mesaSnap.exists && (mData.qrCredencialHash || mData.qrVersao) ? versaoAtual + 1 : 1;
    const agoraServer = admin.firestore.FieldValue.serverTimestamp();
    const payloadUpdate = mesaSnap.exists
      ? {
          qrCredencialHash: credencialHash,
          qrVersao: novaVersao,
          qrCredencial: admin.firestore.FieldValue.delete(),
          atualizadoEm: agoraServer,
        }
      : {
          numero: numMesaParsed,
          ativa: true,
          statusEstrutural: 'livre',
          modoAtendimento: 'livre',
          qrCredencialHash: credencialHash,
          qrVersao: novaVersao,
          criadoEm: agoraServer,
          atualizadoEm: agoraServer,
        };
    t.set(mesaRef, payloadUpdate, { merge: true });

    respostaCredencial = {
      sucesso: true,
      jaConfigurada: false,
      restauranteId: restDoc.id,
      mesa: numMesaParsed,
      qrCredencial: novaCredencial,
    };
  });

  return respostaCredencial;
}

/**
 * Emite token HMAC de sessão vinculado a (restauranteId, mesa, authUid),
 * exigindo existência real da mesa e validação da credencial física do QR Code.
 */
async function executarEmissaoSessaoMesa(firestoreDb, authUid, payload) {
  const { restauranteId, mesa, qrCredencial } = payload || {};
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária para iniciar sessão na mesa.');
  }
  if (!restauranteId || mesa === undefined || mesa === null || String(mesa).trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId e mesa são obrigatórios.');
  }
  if (typeof qrCredencial !== 'string' || qrCredencial.trim().length < 16) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Credencial do QR Code da mesa ausente ou inválida. Escaneie o QR Code físico da mesa.'
    );
  }

  let restDoc = await firestoreDb.collection('restaurantes').doc(String(restauranteId)).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', String(restauranteId)).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  const restData = restDoc.data() || {};
  if (restData.suspenso === true || restData.configuracoes?.suspenso === true) {
    throw new functions.https.HttpsError('failed-precondition', 'Este estabelecimento está suspenso no momento.');
  }

  const mesaStr = String(mesa).trim();
  const numMesaParsed = Number(mesaStr);
  if (!Number.isInteger(numMesaParsed) || numMesaParsed < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'Número de mesa inválido.');
  }
  const maxMesasRest = Number(restData.maxMesas || restData.licenca?.maxMesas || 0);
  if (maxMesasRest > 0 && numMesaParsed > maxMesasRest) {
    throw new functions.https.HttpsError('invalid-argument', 'Mesa fora da capacidade licenciada.');
  }

  const mesaSnap = await restDoc.ref.collection('mesas').doc(mesaStr).get();
  if (!mesaSnap.exists) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Mesa não cadastrada ou não habilitada para atendimento.'
    );
  }

  const mData = mesaSnap.data() || {};
  if (mData.ativa === false || mData.statusEstrutural === 'bloqueada') {
    throw new functions.https.HttpsError('failed-precondition', 'Esta mesa não está disponível para atendimento.');
  }

  const hashRecebido = hashQrCredencial(qrCredencial.trim());
  if (typeof mData.qrCredencialHash !== 'string' || !compararSegredoConstante(hashRecebido, mData.qrCredencialHash)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Credencial do QR Code inválida para esta mesa. Escaneie o QR Code físico novamente.'
    );
  }

  const expMillis = Date.now() + MESA_SESSION_TTL_MS;
  const qrVersaoAtual = Number(mData.qrVersao) || 1;
  const mesaToken = assinarMesaToken(restDoc.id, mesaStr, authUid, expMillis, qrVersaoAtual);
  return {
    sucesso: true,
    restauranteId: restDoc.id,
    mesa: numMesaParsed,
    mesaToken,
    expiraEm: expMillis,
  };
}

/**
 * Cria pedido do cliente e ticket KDS de forma atômica, validada financeiramente no servidor e idempotente.
 * Garante que clientes comuns não escrevam diretamente em /kds_tickets (bloqueado nas Firestore Rules).
 */
async function executarCriacaoPedidoCliente(firestoreDb, authUid, payload) {
  const {
    restauranteId,
    slug,
    pedidoId,
    mesa,
    mesaToken,
    nomeCliente,
    itens,
  } = payload || {};

  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária para enviar pedidos.');
  }

  if (!restauranteId || !pedidoId || mesa === undefined || mesa === null || String(mesa).trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId, pedidoId e mesa são obrigatórios.');
  }

  const pedidoIdLimpo = String(pedidoId).trim();
  if (!PEDIDO_ID_REGEX.test(pedidoIdLimpo)) {
    throw new functions.https.HttpsError('invalid-argument', 'Formato de pedidoId inválido.');
  }

  const nomeLimpo = String(nomeCliente || '').trim();
  if (!nomeLimpo || nomeLimpo.length > 80) {
    throw new functions.https.HttpsError('invalid-argument', 'Informe um nome válido para identificar a comanda.');
  }

  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 50) {
    throw new functions.https.HttpsError('invalid-argument', 'O pedido deve conter entre 1 e 50 itens.');
  }

  for (const it of itens) {
    const mId = String(it?.menuItemId || '').trim();
    const qtd = it?.quantidade;
    if (!mId || mId.includes('/')) {
      throw new functions.https.HttpsError('invalid-argument', 'Item do cardápio inválido.');
    }
    if (typeof qtd !== 'number' || !Number.isInteger(qtd) || qtd < 1 || qtd > 99) {
      throw new functions.https.HttpsError('invalid-argument', 'Quantidade de item inválida (permitido: inteiro de 1 a 99).');
    }
  }

  let restDoc = await firestoreDb.collection('restaurantes').doc(String(restauranteId)).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', String(restauranteId)).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  const restData = restDoc.data() || {};
  if (restData.suspenso === true || restData.configuracoes?.suspenso === true) {
    throw new functions.https.HttpsError('failed-precondition', 'Este estabelecimento está suspenso no momento.');
  }

  const realRestauranteId = restDoc.id;
  const realSlug = String(restData.slug || realRestauranteId);
  if (slug && String(slug).trim() !== realSlug && String(slug).trim() !== realRestauranteId) {
    throw new functions.https.HttpsError('invalid-argument', 'Identificador slug incompatível com o restaurante.');
  }

  const mesaStr = String(mesa).trim();
  const numMesaParsed = Number(mesaStr);
  if (!Number.isInteger(numMesaParsed) || numMesaParsed < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'Número de mesa inválido.');
  }
  const maxMesasRest = Number(restData.maxMesas || restData.licenca?.maxMesas || 0);
  if (maxMesasRest > 0 && numMesaParsed > maxMesasRest) {
    throw new functions.https.HttpsError('invalid-argument', 'Mesa fora da capacidade licenciada do estabelecimento.');
  }
  const mesaNumero = numMesaParsed;

  // Valida prova criptográfica de sessão vinculada ao restaurante, mesa e authUid
  if (!verificarMesaToken(mesaToken, realRestauranteId, mesaStr, authUid)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Sessão da mesa inválida ou expirada. Escaneie o QR Code da mesa novamente.'
    );
  }

  const mesaRef = restDoc.ref.collection('mesas').doc(mesaStr);
  const comandaRef = mesaRef.collection('comandas_abertas').doc(authUid);
  const pedidoRef = comandaRef.collection('pedidos').doc(pedidoIdLimpo);
  const kdsRef = restDoc.ref.collection('kds_tickets').doc(pedidoIdLimpo);
  const idempRef = restDoc.ref.collection('_pedido_idempotency').doc(pedidoIdLimpo);

  // Hash da intenção original do cliente (independente de alterações futuras no cardápio)
  const itensNormalizadosRequest = itens.map((it) => ({
    menuItemId: String(it.menuItemId).trim(),
    quantidade: it.quantidade,
    modificadores: Array.isArray(it.modificadores)
      ? it.modificadores.map((m) => ({
          grupo: String(m?.grupo || '').trim(),
          opcao: String(m?.opcao || '').trim(),
        }))
      : [],
    observacoes: String(it.observacoes || '').slice(0, 250),
  }));

  const requestHash = gerarHashPayloadPedido({
    restauranteId: realRestauranteId,
    mesa: mesaStr,
    clienteId: authUid,
    nomeCliente: nomeLimpo,
    itens: itensNormalizadosRequest,
  });

  const uniqueMenuIds = Array.from(new Set(itensNormalizadosRequest.map((it) => it.menuItemId)));
  const menuRefs = uniqueMenuIds.map((mId) => restDoc.ref.collection('cardapio').doc(mId));

  let resultadoTx = null;

  await firestoreDb.runTransaction(async (t) => {
    // Todas as leituras acontecem antes de qualquer escrita (isolamento serializable)
    const [mesaSnap, comandaSnap, pedidoSnap, kdsSnap, idempSnap, ...menuSnaps] = await Promise.all([
      t.get(mesaRef),
      t.get(comandaRef),
      t.get(pedidoRef),
      t.get(kdsRef),
      t.get(idempRef),
      ...menuRefs.map((ref) => t.get(ref)),
    ]);

    // 1. Verifica idempotência pela intenção original ANTES de validar cardápio atual
    //    (permite retorno idempotente após timeout mesmo se preço/disponibilidade mudar depois)
    if (idempSnap.exists) {
      const idempData = idempSnap.data() || {};
      const mesmoContexto =
        idempData.restauranteId === realRestauranteId &&
        String(idempData.mesa) === mesaStr &&
        idempData.clienteId === authUid;

      if (!mesmoContexto || idempData.requestHash !== requestHash) {
        throw new functions.https.HttpsError(
          'already-exists',
          'Este identificador de pedido já foi utilizado com outro conteúdo ou mesa.'
        );
      }

      if (!pedidoSnap.exists || !kdsSnap.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Inconsistência detectada entre pedido e ticket KDS para este pedidoId.'
        );
      }

      resultadoTx = {
        sucesso: true,
        idempotente: true,
        pedidoId: pedidoIdLimpo,
        kdsTicketId: pedidoIdLimpo,
        pedidoRefPath: pedidoRef.path,
        subtotal: idempData.subtotal,
      };
      return;
    }

    // 2. Valida estado estrutural da mesa e vinculação à versão atual da credencial QR
    if (!mesaSnap.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Mesa não cadastrada ou não habilitada para atendimento.'
      );
    }
    const mData = mesaSnap.data() || {};
    if (!verificarMesaToken(mesaToken, realRestauranteId, mesaStr, authUid, Number(mData.qrVersao) || 1)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Sessão da mesa revogada ou expirada. Escaneie o QR Code atualizado da mesa.'
      );
    }
    if (mData.ativa === false) {
      throw new functions.https.HttpsError('failed-precondition', 'Esta mesa está inativa no momento.');
    }
    if (mData.statusEstrutural === 'bloqueada') {
      throw new functions.https.HttpsError('failed-precondition', 'Esta mesa está bloqueada para atendimento.');
    }
    if (mData.statusEstrutural === 'reservada' && !comandaSnap.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Esta mesa está reservada. Solicite liberação ao garçom.'
      );
    }

    // 3. Valida existência e disponibilidade dos itens e calcula preços em centavos inteiros no servidor
    const menuMap = new Map();
    menuSnaps.forEach((snap) => {
      if (snap.exists) {
        menuMap.set(snap.id, snap.data() || {});
      }
    });

    const itensValidados = [];
    let subtotalCentavos = 0;

    for (const it of itensNormalizadosRequest) {
      const mId = it.menuItemId;
      const menuData = menuMap.get(mId);
      if (!menuData) {
        throw new functions.https.HttpsError(
          'not-found',
          `Produto "${mId}" não encontrado no cardápio deste restaurante.`
        );
      }
      if (menuData.ativo === false) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `O produto "${menuData.nome || mId}" está indisponível no momento.`
        );
      }

      const precoBaseCentavos = toCentavosSeguro(menuData.precoBase, 'Preço base');

      const { modificadoresValidados, somaAdicionaisCentavos } = validarModificadoresServidor(
        it.modificadores,
        menuData.grupoModificadores
      );

      const quantidade = it.quantidade;
      const unitarioCentavos = precoBaseCentavos + somaAdicionaisCentavos;
      const itemTotalCentavos = unitarioCentavos * quantidade;
      if (!Number.isSafeInteger(itemTotalCentavos) || itemTotalCentavos > MAX_SUBTOTAL_CENTAVOS) {
        throw new functions.https.HttpsError('failed-precondition', 'Valor do item excede o limite operacional.');
      }

      subtotalCentavos += itemTotalCentavos;
      if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos > MAX_SUBTOTAL_CENTAVOS) {
        throw new functions.https.HttpsError('failed-precondition', 'Subtotal do pedido excede o limite operacional.');
      }

      itensValidados.push({
        menuItemId: mId,
        nome: String(menuData.nome || 'Item'),
        quantidade,
        precoFinal: unitarioCentavos / 100,
        origemPatrocinadorId: typeof menuData.origemPatrocinadorId === 'string' ? menuData.origemPatrocinadorId : null,
        tempoPreparoEstimado: menuData.tempoPreparoEstimado ?? null,
        modificadores: modificadoresValidados,
        observacoes: it.observacoes,
      });
    }

    const subtotalServidor = subtotalCentavos / 100;

    // 4. Calcula hash canônico dos dados validados e gravados pelo servidor
    const payloadHash = gerarHashPayloadPedido({
      restauranteId: realRestauranteId,
      mesa: mesaStr,
      clienteId: authUid,
      nomeCliente: nomeLimpo,
      itens: itensValidados.map((i) => ({
        menuItemId: i.menuItemId,
        quantidade: i.quantidade,
        precoFinal: i.precoFinal,
        modificadores: i.modificadores,
        observacoes: i.observacoes,
      })),
    });

    // Se kds_ticket já existe sem registro de idempotência compatível (ex: colisão em outra mesa/cliente)
    if (kdsSnap.exists) {
      const kdsData = kdsSnap.data() || {};
      const mesmoDono = kdsData.clienteId === authUid && String(kdsData.mesa) === mesaStr;
      if (mesmoDono && pedidoSnap.exists && (kdsData.requestHash === requestHash || kdsData.payloadHash === payloadHash)) {
        resultadoTx = {
          sucesso: true,
          idempotente: true,
          pedidoId: pedidoIdLimpo,
          kdsTicketId: pedidoIdLimpo,
          pedidoRefPath: pedidoRef.path,
          subtotal: subtotalServidor,
        };
        return;
      }
      throw new functions.https.HttpsError(
        'already-exists',
        'Conflito de identificador: este pedidoId já está vinculado a outro ticket.'
      );
    }

    if (pedidoSnap.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        'Pedido já existente sem ticket KDS correspondente.'
      );
    }

    // 5. Valida estado da comanda (somente estados abertos recebem novos pedidos)
    if (comandaSnap.exists) {
      const cData = comandaSnap.data() || {};
      if (!STATUS_COMANDA_PERMITIDOS.has(cData.status)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Esta comanda já solicitou fechamento ou foi encerrada no caixa.'
        );
      }
      if (cData.restauranteId && cData.restauranteId !== realRestauranteId) {
        throw new functions.https.HttpsError('permission-denied', 'Comanda pertence a outro restaurante.');
      }
    }

    // 6. Gravação atômica (comanda + pedido + kds_ticket + registro de idempotência)
    const agoraServer = admin.firestore.FieldValue.serverTimestamp();
    const dadosComanda = {
      id: authUid,
      restauranteId: realRestauranteId,
      slug: realSlug,
      nomeCliente: nomeLimpo,
      mesa: mesaNumero,
      numeroMesa: mesaNumero,
      atualizadoEm: agoraServer,
      status: comandaSnap.exists ? comandaSnap.data().status : 'aguardando_pratos',
    };
    if (!comandaSnap.exists) {
      dadosComanda.criadoEm = agoraServer;
    }
    t.set(comandaRef, dadosComanda, { merge: true });

    t.set(pedidoRef, {
      id: pedidoIdLimpo,
      restauranteId: realRestauranteId,
      slug: realSlug,
      clienteId: authUid,
      nomeCliente: nomeLimpo,
      mesa: mesaNumero,
      numeroMesa: mesaNumero,
      itens: itensValidados,
      subtotal: subtotalServidor,
      requestHash,
      payloadHash,
      status: 'a_fazer',
      criadoEm: agoraServer,
    });

    t.set(kdsRef, {
      id: pedidoIdLimpo,
      restauranteId: realRestauranteId,
      mesa: mesaNumero,
      numeroMesa: mesaNumero,
      clienteId: authUid,
      nomeCliente: nomeLimpo,
      status: 'a_fazer',
      pedidoRefPath: pedidoRef.path,
      requestHash,
      payloadHash,
      itens: itensValidados.map((i) => ({
        menuItemId: i.menuItemId,
        nome: i.nome,
        quantidade: i.quantidade,
        tempoPreparoEstimado: i.tempoPreparoEstimado,
        modificadores: i.modificadores,
        observacoes: i.observacoes,
      })),
      criadoEm: agoraServer,
    });

    t.set(idempRef, {
      pedidoId: pedidoIdLimpo,
      restauranteId: realRestauranteId,
      mesa: mesaStr,
      clienteId: authUid,
      requestHash,
      payloadHash,
      subtotal: subtotalServidor,
      pedidoRefPath: pedidoRef.path,
      criadoEm: agoraServer,
    });

    resultadoTx = {
      sucesso: true,
      idempotente: false,
      pedidoId: pedidoIdLimpo,
      kdsTicketId: pedidoIdLimpo,
      pedidoRefPath: pedidoRef.path,
      subtotal: subtotalServidor,
    };
  });

  return resultadoTx;
}

/**
 * Lança pedido operacional de garçom/dono de forma transacional, idempotente e validada por permissão real.
 * Impede duplicação de subtotal em reenvios offline e bloqueia uso por usuários não autorizados.
 */
async function executarLancamentoPedidoGarcom(firestoreDb, authUid, authToken, payload) {
  const {
    restauranteId,
    slug,
    pedidoId,
    mesa,
    clienteId,
    nomeCliente,
    itens,
  } = payload || {};

  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  if (!restauranteId || !pedidoId || mesa === undefined || mesa === null || String(mesa).trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId, pedidoId e mesa são obrigatórios.');
  }

  const pedidoIdLimpo = String(pedidoId).trim();
  if (!PEDIDO_ID_REGEX.test(pedidoIdLimpo)) {
    throw new functions.https.HttpsError('invalid-argument', 'Formato de pedidoId inválido.');
  }

  const clienteIdLimpo = String(clienteId || '').trim();
  if (!clienteIdLimpo || clienteIdLimpo.includes('/')) {
    throw new functions.https.HttpsError('invalid-argument', 'Identificador da comanda inválido.');
  }

  const nomeLimpo = String(nomeCliente || '').trim() || 'Mesa (Geral)';
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 50) {
    throw new functions.https.HttpsError('invalid-argument', 'O pedido deve conter entre 1 e 50 itens.');
  }

  for (const it of itens) {
    const mId = String(it?.menuItemId || '').trim();
    const qtd = it?.quantidade;
    if (!mId || mId.includes('/')) {
      throw new functions.https.HttpsError('invalid-argument', 'Item do cardápio inválido.');
    }
    if (typeof qtd !== 'number' || !Number.isInteger(qtd) || qtd < 1 || qtd > 99) {
      throw new functions.https.HttpsError('invalid-argument', 'Quantidade de item inválida.');
    }
  }

  let restDoc = await firestoreDb.collection('restaurantes').doc(String(restauranteId)).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', String(restauranteId)).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }

  // Valida no backend que o usuário é realmente colaborador/dono autorizado a lançar pedidos (não confia no IndexedDB)
  await verificarPermissaoOperacionalRestaurante(
    firestoreDb,
    restDoc,
    authUid,
    authToken,
    ['owner', 'admin', 'garcom']
  );

  const restData = restDoc.data() || {};
  const realRestauranteId = restDoc.id;
  const realSlug = String(restData.slug || realRestauranteId);
  if (slug && String(slug).trim() !== realSlug && String(slug).trim() !== realRestauranteId) {
    throw new functions.https.HttpsError('invalid-argument', 'Identificador slug incompatível com o restaurante.');
  }

  const mesaStr = String(mesa).trim();
  const numMesaParsed = Number(mesaStr);
  if (!Number.isInteger(numMesaParsed) || numMesaParsed < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'Número de mesa inválido.');
  }
  const maxMesasRest = Number(restData.maxMesas || restData.licenca?.maxMesas || 0);
  if (maxMesasRest > 0 && numMesaParsed > maxMesasRest) {
    throw new functions.https.HttpsError('invalid-argument', 'Mesa fora da capacidade licenciada.');
  }
  const mesaNumero = numMesaParsed;

  const mesaRef = restDoc.ref.collection('mesas').doc(mesaStr);
  const comandaRef = mesaRef.collection('comandas_abertas').doc(clienteIdLimpo);
  const pedidoRef = comandaRef.collection('pedidos').doc(pedidoIdLimpo);
  const kdsRef = restDoc.ref.collection('kds_tickets').doc(pedidoIdLimpo);
  const idempRef = restDoc.ref.collection('_pedido_idempotency').doc(pedidoIdLimpo);

  const itensNormalizadosRequest = itens.map((it) => ({
    menuItemId: String(it.menuItemId).trim(),
    quantidade: it.quantidade,
    modificadores: Array.isArray(it.modificadores)
      ? it.modificadores.map((m) => ({
          grupo: String(m?.grupo || '').trim(),
          opcao: String(m?.opcao || '').trim(),
        }))
      : [],
    observacoes: String(it.observacoes || '').slice(0, 250),
  }));

  const requestHash = gerarHashPayloadPedido({
    origem: 'garcom',
    restauranteId: realRestauranteId,
    mesa: mesaStr,
    clienteId: clienteIdLimpo,
    nomeCliente: nomeLimpo,
    itens: itensNormalizadosRequest,
  });

  const uniqueMenuIds = Array.from(new Set(itensNormalizadosRequest.map((it) => it.menuItemId)));
  const menuRefs = uniqueMenuIds.map((mId) => restDoc.ref.collection('cardapio').doc(mId));

  let resultadoTx = null;

  await firestoreDb.runTransaction(async (t) => {
    const [mesaSnap, comandaSnap, pedidoSnap, kdsSnap, idempSnap, ...menuSnaps] = await Promise.all([
      t.get(mesaRef),
      t.get(comandaRef),
      t.get(pedidoRef),
      t.get(kdsRef),
      t.get(idempRef),
      ...menuRefs.map((ref) => t.get(ref)),
    ]);

    if (idempSnap.exists) {
      const idempData = idempSnap.data() || {};
      const mesmoContexto =
        idempData.restauranteId === realRestauranteId &&
        String(idempData.mesa) === mesaStr &&
        idempData.clienteId === clienteIdLimpo;

      if (!mesmoContexto || idempData.requestHash !== requestHash) {
        throw new functions.https.HttpsError(
          'already-exists',
          'Este identificador de pedido já foi utilizado com outro conteúdo ou mesa.'
        );
      }

      resultadoTx = {
        sucesso: true,
        idempotente: true,
        pedidoId: pedidoIdLimpo,
        kdsTicketId: pedidoIdLimpo,
        subtotal: idempData.subtotal,
      };
      return;
    }

    if (kdsSnap.exists || pedidoSnap.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        'Conflito de identificador: este pedidoId já está vinculado a outro registro.'
      );
    }

    if (!mesaSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Mesa não cadastrada neste restaurante.');
    }
    const mesaData = mesaSnap.data() || {};
    if (mesaData.ativa === false || mesaData.statusEstrutural === 'inativa' || mesaData.statusEstrutural === 'bloqueada') {
      throw new functions.https.HttpsError('failed-precondition', 'Mesa inexistente, inativa ou bloqueada para atendimento.');
    }

    if (comandaSnap.exists) {
      const cData = comandaSnap.data() || {};
      if (!STATUS_COMANDA_PERMITIDOS.has(cData.status)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Esta comanda já solicitou fechamento ou foi encerrada no caixa.'
        );
      }
      if (cData.restauranteId && cData.restauranteId !== realRestauranteId) {
        throw new functions.https.HttpsError('permission-denied', 'Comanda pertence a outro restaurante.');
      }
    }

    const menuMap = new Map();
    menuSnaps.forEach((snap) => {
      if (snap.exists) menuMap.set(snap.id, snap.data() || {});
    });

    const itensValidados = [];
    let subtotalCentavos = 0;

    for (const it of itensNormalizadosRequest) {
      const mId = it.menuItemId;
      const menuData = menuMap.get(mId);
      if (!menuData) {
        throw new functions.https.HttpsError(
          'not-found',
          `Produto "${mId}" não encontrado no cardápio deste restaurante.`
        );
      }
      if (menuData.ativo === false) {
        throw new functions.https.HttpsError('failed-precondition', `O produto "${menuData.nome || mId}" está indisponível no momento.`);
      }
      const precoBaseCentavos = toCentavosSeguro(menuData.precoBase, 'Preço base');
      const { modificadoresValidados, somaAdicionaisCentavos } = validarModificadoresServidor(
        it.modificadores,
        menuData.grupoModificadores
      );
      const unitarioCentavos = precoBaseCentavos + somaAdicionaisCentavos;
      const itemTotalCentavos = unitarioCentavos * it.quantidade;
      subtotalCentavos += itemTotalCentavos;
      if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos > MAX_SUBTOTAL_CENTAVOS) {
        throw new functions.https.HttpsError('failed-precondition', 'Subtotal do pedido excede o limite operacional.');
      }

      itensValidados.push({
        menuItemId: mId,
        nome: String(menuData.nome || 'Item'),
        quantidade: it.quantidade,
        precoFinal: unitarioCentavos / 100,
        origemPatrocinadorId: typeof menuData.origemPatrocinadorId === 'string' ? menuData.origemPatrocinadorId : null,
        tempoPreparoEstimado: menuData.tempoPreparoEstimado ?? null,
        modificadores: modificadoresValidados,
        observacoes: it.observacoes,
      });
    }

    const subtotalServidor = subtotalCentavos / 100;
    const payloadHash = gerarHashPayloadPedido({
      origem: 'garcom',
      restauranteId: realRestauranteId,
      mesa: mesaStr,
      clienteId: clienteIdLimpo,
      nomeCliente: nomeLimpo,
      itens: itensValidados,
    });

    const agoraServer = admin.firestore.FieldValue.serverTimestamp();
    if (!comandaSnap.exists) {
      t.set(comandaRef, {
        id: clienteIdLimpo,
        restauranteId: realRestauranteId,
        slug: realSlug,
        nomeCliente: nomeLimpo,
        mesa: mesaNumero,
        numeroMesa: mesaNumero,
        criadoEm: agoraServer,
        atualizadoEm: agoraServer,
        subtotal: subtotalServidor,
        status: 'aguardando_pratos',
      });
    } else {
      const cData = comandaSnap.data() || {};
      const subtotalAtualCentavos = Math.round((Number(cData.subtotal) || 0) * 100);
      t.update(comandaRef, {
        restauranteId: realRestauranteId,
        slug: realSlug,
        nomeCliente: nomeLimpo,
        mesa: mesaNumero,
        numeroMesa: mesaNumero,
        atualizadoEm: agoraServer,
        subtotal: (subtotalAtualCentavos + subtotalCentavos) / 100,
        status: 'aguardando_pratos',
      });
    }

    t.set(pedidoRef, {
      id: pedidoIdLimpo,
      restauranteId: realRestauranteId,
      slug: realSlug,
      clienteId: clienteIdLimpo,
      nomeCliente: nomeLimpo,
      mesa: mesaNumero,
      numeroMesa: mesaNumero,
      itens: itensValidados,
      subtotal: subtotalServidor,
      origem: 'garcom',
      lancadoPorUid: authUid,
      requestHash,
      payloadHash,
      status: 'a_fazer',
      criadoEm: agoraServer,
    });

    t.set(kdsRef, {
      id: pedidoIdLimpo,
      restauranteId: realRestauranteId,
      mesa: mesaNumero,
      numeroMesa: mesaNumero,
      clienteId: clienteIdLimpo,
      nomeCliente: nomeLimpo,
      status: 'a_fazer',
      pedidoRefPath: pedidoRef.path,
      requestHash,
      payloadHash,
      itens: itensValidados.map((i) => ({
        menuItemId: i.menuItemId,
        nome: i.nome,
        quantidade: i.quantidade,
        tempoPreparoEstimado: i.tempoPreparoEstimado,
        modificadores: i.modificadores,
        observacoes: i.observacoes,
      })),
      criadoEm: agoraServer,
    });

    t.set(idempRef, {
      pedidoId: pedidoIdLimpo,
      origem: 'garcom',
      lancadoPorUid: authUid,
      restauranteId: realRestauranteId,
      mesa: mesaStr,
      clienteId: clienteIdLimpo,
      requestHash,
      payloadHash,
      subtotal: subtotalServidor,
      pedidoRefPath: pedidoRef.path,
      criadoEm: agoraServer,
    });

    resultadoTx = {
      sucesso: true,
      idempotente: false,
      pedidoId: pedidoIdLimpo,
      kdsTicketId: pedidoIdLimpo,
      subtotal: subtotalServidor,
    };
  });

  return resultadoTx;
}

async function resolverRestDoc(firestoreDb, restauranteId) {
  let restDoc = await firestoreDb.collection('restaurantes').doc(String(restauranteId)).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', String(restauranteId)).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  }
  return restDoc;
}

const MAX_COMANDAS_POR_OPERACAO = 50;
const MAX_ESCRITAS_POR_TRANSACAO = 450;

function normalizarIdsComanda(comandasIds) {
  const ids = Array.from(
    new Set(comandasIds.map((id) => String(id || '').trim()).filter(Boolean))
  );
  if (ids.length === 0 || ids.length > MAX_COMANDAS_POR_OPERACAO) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Informe entre 1 e ${MAX_COMANDAS_POR_OPERACAO} comandas.`
    );
  }
  return ids;
}

/**
 * Atualiza a taxa de serviço das comandas abertas de uma mesa (equipe ativa).
 * Transacional: rejeita comanda inexistente, de outro restaurante ou já encerrada.
 */
async function executarDefinirTaxaServicoMesa(firestoreDb, authUid, authToken, payload) {
  const { restauranteId, mesa, comandasIds, ativa } = payload || {};
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  if (!restauranteId || mesa === undefined || mesa === null || !Array.isArray(comandasIds)) {
    throw new functions.https.HttpsError('invalid-argument', 'Parâmetros inválidos para taxa de serviço.');
  }
  if (typeof ativa !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'O campo ativa deve ser booleano.');
  }

  const restDoc = await resolverRestDoc(firestoreDb, restauranteId);
  await verificarPermissaoOperacionalRestaurante(
    firestoreDb,
    restDoc,
    authUid,
    authToken,
    ['owner', 'admin', 'garcom']
  );

  const mesaStr = String(mesa).trim();
  const ids = normalizarIdsComanda(comandasIds);
  const refs = ids.map((cId) =>
    restDoc.ref.collection('mesas').doc(mesaStr).collection('comandas_abertas').doc(cId)
  );
  const agoraServer = admin.firestore.FieldValue.serverTimestamp();

  await firestoreDb.runTransaction(async (t) => {
    const snaps = await t.getAll(...refs);
    snaps.forEach((snap) => {
      if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Comanda não encontrada.');
      }
      const c = snap.data() || {};
      if (c.restauranteId && c.restauranteId !== restDoc.id) {
        throw new functions.https.HttpsError('permission-denied', 'Comanda não pertence a este restaurante.');
      }
      if (c.status === 'pago' || c.arquivada === true) {
        throw new functions.https.HttpsError('failed-precondition', 'Comanda já encerrada.');
      }
    });
    refs.forEach((ref) => {
      t.update(ref, { taxaServicoAtiva: ativa, atualizadoEm: agoraServer });
    });
  });

  return { sucesso: true, taxaServicoAtiva: ativa };
}

/**
 * Fecha uma comanda individual: comanda, pedidos e tickets KDS são lidos e gravados
 * na mesma transação. Idempotente: repetir a chamada em comanda já paga retorna sucesso sem reescrever.
 */
async function executarFecharComanda(firestoreDb, authUid, authToken, payload) {
  const { restauranteId, mesa, clienteId } = payload || {};
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  if (!restauranteId || mesa === undefined || mesa === null || !clienteId) {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId, mesa e clienteId são obrigatórios.');
  }

  const restDoc = await resolverRestDoc(firestoreDb, restauranteId);
  await verificarPermissaoOperacionalRestaurante(
    firestoreDb,
    restDoc,
    authUid,
    authToken,
    ['owner', 'admin', 'garcom']
  );

  const mesaStr = String(mesa).trim();
  const cId = String(clienteId).trim();
  const comandaRef = restDoc.ref.collection('mesas').doc(mesaStr).collection('comandas_abertas').doc(cId);
  const selloutEventId = crypto.createHash('sha256').update(`${restDoc.id}|${mesaStr}|${cId}`).digest('hex');
  const selloutOutboxRef = restDoc.ref.collection('_sellout_outbox').doc(selloutEventId);
  const agoraServer = admin.firestore.FieldValue.serverTimestamp();
  const agoraIso = new Date().toISOString();
  let resultado = null;

  await firestoreDb.runTransaction(async (t) => {
    const comandaSnap = await t.get(comandaRef);
    if (!comandaSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Comanda não encontrada.');
    }
    const c = comandaSnap.data() || {};
    if (c.restauranteId && c.restauranteId !== restDoc.id) {
      throw new functions.https.HttpsError('permission-denied', 'Comanda não pertence a este restaurante.');
    }
    if (c.status === 'pago') {
      resultado = { sucesso: true, idempotente: true };
      return;
    }

    const pedidosSnap = await t.get(comandaRef.collection('pedidos'));
    const pedidosAtivos = pedidosSnap.docs.filter((d) => {
      const s = (d.data() || {}).status;
      return s !== 'cancelado' && s !== 'estornado';
    });
    if (pedidosAtivos.length * 2 + 2 > MAX_ESCRITAS_POR_TRANSACAO) {
      throw new functions.https.HttpsError('failed-precondition', 'Comanda excede o limite operacional de pedidos.');
    }
    const kdsRefs = pedidosAtivos.map((d) => restDoc.ref.collection('kds_tickets').doc(d.id));
    const kdsSnaps = kdsRefs.length > 0 ? await t.getAll(...kdsRefs) : [];
    const selloutOutboxSnap = await t.get(selloutOutboxRef);

    // Compatibilidade com pedidos antigos: recupera origem patrocinada pelo menu server-side
    // somente para itens cujo ID tem prefixo reservado spn- e ainda não carregam origem.
    const legacySponsorIds = Array.from(new Set(pedidosAtivos.flatMap((pedDoc) =>
      (Array.isArray(pedDoc.data()?.itens) ? pedDoc.data().itens : [])
        .filter((it) => !it.origemPatrocinadorId && typeof it.menuItemId === 'string' && it.menuItemId.startsWith('spn-'))
        .map((it) => it.menuItemId)
    )));
    const legacyMenuRefs = legacySponsorIds.map((id) => restDoc.ref.collection('cardapio').doc(id));
    const legacyMenuSnaps = legacyMenuRefs.length ? await t.getAll(...legacyMenuRefs) : [];
    const legacySponsorMap = new Map();
    legacyMenuSnaps.forEach((snap) => {
      if (snap.exists && typeof snap.data()?.origemPatrocinadorId === 'string') {
        legacySponsorMap.set(snap.id, snap.data().origemPatrocinadorId);
      }
    });

    const selloutAgg = new Map();
    pedidosAtivos.forEach((pedDoc) => {
      const pedido = pedDoc.data() || {};
      (Array.isArray(pedido.itens) ? pedido.itens : []).forEach((item) => {
        const patrocinadorId = item.origemPatrocinadorId || legacySponsorMap.get(item.menuItemId);
        const itemId = String(item.menuItemId || '').replace(/^spn-/, '');
        const quantidade = Number(item.quantidade);
        const unitarioCentavos = Math.round(Number(item.precoFinal) * 100);
        if (!patrocinadorId || !itemId || itemId.includes('/') ||
            !Number.isInteger(quantidade) || quantidade < 1 ||
            !Number.isSafeInteger(unitarioCentavos) || unitarioCentavos < 0) return;
        const key = patrocinadorId + '|' + itemId;
        const atual = selloutAgg.get(key) || {
          patrocinadorId, itemId, itemNome: String(item.nome || itemId),
          quantidade: 0, valorTotalCentavos: 0,
        };
        atual.quantidade += quantidade;
        atual.valorTotalCentavos += unitarioCentavos * quantidade;
        selloutAgg.set(key, atual);
      });
    });
    const itensSellout = Array.from(selloutAgg.values());
    if (itensSellout.length > 200) {
      throw new functions.https.HttpsError('failed-precondition', 'Comanda excede o limite seguro de itens patrocinados para fechamento.');
    }

    pedidosAtivos.forEach((pedDoc) => {
      t.update(pedDoc.ref, { status: 'pago', fechadoEm: agoraIso, atualizadoEm: agoraServer });
    });
    kdsSnaps.forEach((kdsSnap) => {
      if (kdsSnap.exists) {
        t.update(kdsSnap.ref, { status: 'entregue', fechadoEm: agoraIso, atualizadoEm: agoraServer });
      }
    });

    t.update(comandaRef, {
      status: 'pago',
      pagoEm: agoraServer,
      encerradaEm: agoraServer,
      encerradaPorUid: authUid,
      arquivada: true,
      atualizadoEm: agoraServer,
    });
    if (itensSellout.length > 0 && !selloutOutboxSnap.exists) {
      t.create(selloutOutboxRef, {
        eventId: selloutEventId,
        restauranteId: restDoc.id,
        mesa: mesaStr,
        comandaId: cId,
        itens: itensSellout,
        criadoEm: agoraServer,
        processado: false,
      });
    }
    resultado = { sucesso: true, idempotente: false };
  });

  return resultado;
}

/**
 * Processa o outbox de sell-out criado atomicamente no fechamento da comanda.
 * Cada par evento/produto possui marcador idempotente, evitando dupla contagem em retries.
 */
async function executarProcessarSelloutOutbox(firestoreDb, restauranteId, eventId) {
  const outboxRef = firestoreDb.collection('restaurantes').doc(restauranteId)
    .collection('_sellout_outbox').doc(eventId);
  const outboxSnap = await outboxRef.get();
  if (!outboxSnap.exists) return { sucesso: false, inexistente: true };
  const outbox = outboxSnap.data() || {};
  if (outbox.processado === true) return { sucesso: true, idempotente: true };
  if (!Array.isArray(outbox.itens) || outbox.itens.length > 200) {
    throw new Error('Outbox de sell-out inválido ou acima do limite operacional.');
  }

  for (const item of outbox.itens) {
    const patrocinadorId = String(item.patrocinadorId || '');
    const itemId = String(item.itemId || '');
    const quantidade = Number(item.quantidade);
    const valorTotalCentavos = Number(item.valorTotalCentavos);
    if (!patrocinadorId || patrocinadorId.includes('/') || !itemId || itemId.includes('/') ||
        !Number.isInteger(quantidade) || quantidade < 1 ||
        !Number.isSafeInteger(valorTotalCentavos) || valorTotalCentavos < 0) {
      throw new Error('Linha de sell-out inválida; evento preservado para auditoria.');
    }
    const patrocinadorRef = firestoreDb.collection('patrocinadores').doc(patrocinadorId);
    const metricRef = patrocinadorRef.collection('metricas_sellout').doc(itemId);
    const markerId = crypto.createHash('sha256').update(eventId + '|' + itemId).digest('hex');
    const markerRef = patrocinadorRef.collection('metricas_sellout_eventos').doc(markerId);

    await firestoreDb.runTransaction(async (tx) => {
      const [markerSnap, metricSnap] = await Promise.all([tx.get(markerRef), tx.get(metricRef)]);
      if (markerSnap.exists) return;
      const atual = metricSnap.exists ? (metricSnap.data() || {}) : {};
      const restaurantes = Array.isArray(atual.restaurantesContabilizados)
        ? atual.restaurantesContabilizados.slice()
        : [];
      if (!restaurantes.includes(restauranteId)) restaurantes.push(restauranteId);
      const payloadMetric = {
        itemId,
        itemNome: String(item.itemNome || itemId),
        patrocinadorId,
        totalUnidadesVendidas: Number(atual.totalUnidadesVendidas || 0) + quantidade,
        faturamentoTotalEstimado: Number(atual.faturamentoTotalEstimado || 0) + valorTotalCentavos / 100,
        restaurantesContabilizados: restaurantes,
        ultimaVendaEm: new Date().toISOString(),
      };
      if (metricSnap.exists) tx.set(metricRef, payloadMetric, { merge: true });
      else tx.create(metricRef, payloadMetric);
      tx.create(markerRef, {
        eventId,
        restauranteId,
        itemId,
        quantidade,
        valorTotalCentavos,
        processadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  await outboxRef.update({
    processado: true,
    processadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { sucesso: true, itensProcessados: outbox.itens.length };
}

/**
 * Libera a mesa: tudo em uma única transação (leituras antes das escritas).
 * O subtotal do histórico é recalculado a partir dos pedidos reais. Idempotente: comandas já
 * registradas (campo historicoSessaoId) não geram novo histórico nem nova métrica.
 */
async function executarLiberarMesa(firestoreDb, authUid, authToken, payload) {
  const { restauranteId, mesa, comandasIds } = payload || {};
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  if (!restauranteId || mesa === undefined || mesa === null || !Array.isArray(comandasIds)) {
    throw new functions.https.HttpsError('invalid-argument', 'Parâmetros inválidos para liberação da mesa.');
  }

  const restDoc = await resolverRestDoc(firestoreDb, restauranteId);
  await verificarPermissaoOperacionalRestaurante(
    firestoreDb,
    restDoc,
    authUid,
    authToken,
    ['owner', 'admin', 'garcom']
  );

  const mesaStr = String(mesa).trim();
  const ids = normalizarIdsComanda(comandasIds);
  const comandaRefs = ids.map((cId) =>
    restDoc.ref.collection('mesas').doc(mesaStr).collection('comandas_abertas').doc(cId)
  );
  const agoraServer = admin.firestore.FieldValue.serverTimestamp();
  let resultado = null;

  await firestoreDb.runTransaction(async (t) => {
    const comandaSnaps = await t.getAll(...comandaRefs);

    const pendentes = [];
    let jaRegistradas = 0;
    comandaSnaps.forEach((snap) => {
      if (!snap.exists) return;
      const c = snap.data() || {};
      if (c.restauranteId && c.restauranteId !== restDoc.id) {
        throw new functions.https.HttpsError('permission-denied', 'Comanda não pertence a este restaurante.');
      }
      if (c.historicoSessaoId) {
        jaRegistradas++;
        return;
      }
      // A liberação é apenas pós-pagamento: nunca converte uma comanda aberta em paga.
      if (c.status !== 'pago' || c.arquivada !== true || !c.pagoEm) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'A comanda precisa estar paga e encerrada pelo fluxo de fechamento antes da liberação.'
        );
      }
      pendentes.push({ ref: snap.ref, data: c });
    });

    if (pendentes.length === 0) {
      if (jaRegistradas > 0) {
        resultado = { sucesso: true, idempotente: true };
        return;
      }
      throw new functions.https.HttpsError('not-found', 'Nenhuma comanda encontrada para liberar.');
    }

    let subtotalTotalCentavos = 0;
    let abertaEm = null;
    let pagaEm = null;
    let totalEscritas = 3; // histórico + métrica (+ margem)
    const operacoes = [];

    for (const item of pendentes) {
      const pedidosSnap = await t.get(item.ref.collection('pedidos'));
      let subtotalComandaCentavos = 0;
      const kdsRefs = [];
      pedidosSnap.forEach((pDoc) => {
        const pData = pDoc.data() || {};
        if (pData.status !== 'cancelado' && pData.status !== 'estornado') {
          subtotalComandaCentavos += Math.round((Number(pData.subtotal) || 0) * 100);
        }
        kdsRefs.push(restDoc.ref.collection('kds_tickets').doc(pDoc.id));
      });
      totalEscritas += 1 + pedidosSnap.size * 2;
      if (totalEscritas > MAX_ESCRITAS_POR_TRANSACAO) {
        throw new functions.https.HttpsError('failed-precondition', 'Volume de pedidos excede o limite operacional da liberação.');
      }

      subtotalTotalCentavos +=
        subtotalComandaCentavos > 0
          ? subtotalComandaCentavos
          : Math.round((Number(item.data.subtotal) || 0) * 100);
      if (item.data.criadoEm && !abertaEm) abertaEm = item.data.criadoEm;
      if (item.data.pagoEm || item.data.atualizadoEm) pagaEm = item.data.pagoEm || item.data.atualizadoEm;

      operacoes.push({ item, pedidosDocs: pedidosSnap.docs, kdsRefs });
    }

    const subtotalTotal = Number((subtotalTotalCentavos / 100).toFixed(2));
    const historicoId = `sessao_${mesaStr}_${Date.now()}`;
    const historicoRef = restDoc.ref.collection('historico_sessoes_mesas').doc(historicoId);
    const agora = new Date();
    const chaveMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const resumoRef = restDoc.ref.collection('metricas_consolidadas').doc(chaveMes);
    const quantidade = pendentes.length;

    for (const op of operacoes) {
      op.pedidosDocs.forEach((pDoc) => t.delete(pDoc.ref));
      op.kdsRefs.forEach((kRef) => t.delete(kRef));
      t.update(op.item.ref, {
        status: 'pago',
        pagoEm: op.item.data.pagoEm || agoraServer,
        encerradaEm: agoraServer,
        encerradaPorUid: authUid,
        arquivada: true,
        historicoSessaoId: historicoId,
        atualizadoEm: agoraServer,
      });
    }

    t.set(historicoRef, {
      id: historicoId,
      restauranteId: restDoc.id,
      mesa: Number(mesaStr) || mesaStr,
      subtotalTotal,
      quantidadePagantes: quantidade,
      comandasIds: pendentes.map((p) => p.ref.id),
      abertaEm: abertaEm || agoraServer,
      pagaEm: pagaEm || agoraServer,
      liberadaEm: agoraServer,
      liberadaPorUid: authUid,
    });

    t.set(
      resumoRef,
      {
        anoMes: chaveMes,
        restauranteId: restDoc.id,
        totalFaturado: admin.firestore.FieldValue.increment(subtotalTotal),
        totalSessoes: admin.firestore.FieldValue.increment(1),
        totalClientes: admin.firestore.FieldValue.increment(quantidade),
        atualizadoEm: agoraServer,
      },
      { merge: true }
    );

    resultado = { sucesso: true, idempotente: false, subtotalTotal, historicoId };
  });

  return resultado;
}


function normalizarCodigoAtivacao(valor) {
  return String(valor || '').trim().toUpperCase();
}

function validarCotaLoteVoucher(lote) {
  const total = Number(lote?.totalLicencas);
  const usadas = Number(lote?.licencasAtivadas || 0);
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(usadas) || usadas < 0 || usadas > total) {
    throw new functions.https.HttpsError('failed-precondition', 'Lote B2B possui cotas inválidas; operação bloqueada.');
  }
  if (usadas >= total) {
    throw new functions.https.HttpsError('resource-exhausted', 'Este lote de licenças patrocinadas já esgotou suas cotas.');
  }
  return { total, usadas };
}

function millisDataAtivacao(valor) {
  if (!valor) return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  const ms = Date.parse(String(valor));
  return Number.isFinite(ms) ? ms : null;
}

function validarDisponibilidadeAtivacao(dados, codigo) {
  if (!dados) throw new functions.https.HttpsError('not-found', 'Código de ativação inválido ou inexistente.');
  if (['ativa', 'utilizada', 'suspensa', 'revogada'].includes(dados.status)) {
    throw new functions.https.HttpsError('failed-precondition', 'Esta licença já foi utilizada, suspensa ou revogada.');
  }
  const dataExpiracao = dados.expiracaoEm || dados.dataExpiracao;
  const expira = millisDataAtivacao(dataExpiracao);
  if (dataExpiracao && expira === null) {
    throw new functions.https.HttpsError('failed-precondition', 'A validade da licença está em formato inválido.');
  }
  if (expira !== null && Date.now() > expira) {
    throw new functions.https.HttpsError('failed-precondition', 'Este link de ativação expirou.');
  }
  return true;
}

async function localizarLoteVoucher(firestoreDb, codigo, transaction) {
  const queryLotes = firestoreDb.collectionGroup('lotes_licencas').where('codigoCampanha', '==', codigo);
  const snap = transaction ? await transaction.get(queryLotes) : await queryLotes.get();
  const candidatos = snap.docs.filter((d) => d.data()?.ativo !== false);
  if (candidatos.length === 0) return null;
  if (candidatos.length !== 1) {
    throw new functions.https.HttpsError('failed-precondition', 'Código de campanha ambíguo. Contate a administração.');
  }
  const loteDoc = candidatos[0];
  const lote = loteDoc.data() || {};
  const patrocinadorId = String(lote.patrocinadorId || loteDoc.ref.parent.parent?.id || '');
  if (!patrocinadorId) throw new functions.https.HttpsError('failed-precondition', 'Lote sem patrocinador vinculado.');
  return { loteDoc, lote, patrocinadorId };
}

async function executarAutenticarPatrocinador(firestoreDb, payload, rawRequest) {
  const chave = String(payload?.chave || '').trim().toUpperCase();
  if (!chave || chave.length > 120) {
    throw new functions.https.HttpsError('invalid-argument', 'Chave B2B inválida.');
  }

  const encontrados = await firestoreDb.collection('patrocinadores')
    .where('chaveAcessoB2B', '==', chave)
    .limit(2)
    .get();
  const patrocinadorRef = encontrados.size === 1 ? encontrados.docs[0].ref : null;

  const agora = Date.now();
  const ipKey = sanitizarChave(extrairIpConviavel(rawRequest));
  const chaveHash = crypto.createHash('sha256').update(chave).digest('hex');
  const rateCollection = firestoreDb.collection('_b2b_auth_rate_limits');
  const ipRateRef = rateCollection.doc('ip_' + ipKey);
  const keyRateRef = rateCollection.doc('key_' + chaveHash);
  const globalRateRef = rateCollection.doc('global');
  let patrocinadorData = null;

  await firestoreDb.runTransaction(async (tx) => {
    const [ipSnap, keySnap, globalSnap, sponsorSnap] = await Promise.all([
      tx.get(ipRateRef),
      tx.get(keyRateRef),
      tx.get(globalRateRef),
      patrocinadorRef ? tx.get(patrocinadorRef) : Promise.resolve(null),
    ]);
    const bloqueio = verificarBloqueioAtivo({
      ipData: ipSnap.exists ? ipSnap.data() : null,
      userData: keySnap.exists ? keySnap.data() : null,
      globalData: globalSnap.exists ? globalSnap.data() : null,
      agora,
    });
    if (bloqueio.bloqueado) {
      throw new functions.https.HttpsError('resource-exhausted', bloqueio.mensagem);
    }

    const atual = sponsorSnap?.exists ? (sponsorSnap.data() || {}) : null;
    const chaveValida = Boolean(atual && atual.ativo !== false && atual.chaveAcessoB2B === chave);
    if (!chaveValida) {
      const payloads = calcularPayloadsFalha({
        curIpData: ipSnap.exists ? ipSnap.data() : {},
        curUserData: keySnap.exists ? keySnap.data() : {},
        curGlobalData: globalSnap.exists ? globalSnap.data() : {},
        agora,
      });
      tx.set(ipRateRef, payloads.ipPayload, { merge: true });
      tx.set(keyRateRef, payloads.userPayload, { merge: true });
      tx.set(globalRateRef, payloads.globalPayload, { merge: true });
      return;
    }

    tx.delete(ipRateRef);
    tx.delete(keyRateRef);
    patrocinadorData = atual;
  });

  if (!patrocinadorRef || !patrocinadorData) {
    throw new functions.https.HttpsError('unauthenticated', 'Chave B2B inválida ou não autorizada.');
  }

  const customToken = await admin.auth().createCustomToken(patrocinadorRef.id, {
    role: 'sponsor',
    patrocinadorId: patrocinadorRef.id,
  });
  return {
    customToken,
    patrocinador: {
      id: patrocinadorRef.id,
      cnpj: String(patrocinadorData.cnpj || ''),
      razaoSocial: String(patrocinadorData.razaoSocial || ''),
      nomeFantasia: String(patrocinadorData.nomeFantasia || ''),
      slug: String(patrocinadorData.slug || ''),
      chaveAcessoB2B: chave,
      logoUrl: String(patrocinadorData.logoUrl || ''),
      bannerUrl: String(patrocinadorData.bannerUrl || ''),
      corMarca: String(patrocinadorData.corMarca || ''),
      contatoResponsavel: patrocinadorData.contatoResponsavel || {},
      ativo: true,
    },
  };
}

async function executarValidarCodigoAtivacao(firestoreDb, payload) {
  const codigo = normalizarCodigoAtivacao(payload?.codigo);
  if (!/^[A-Z0-9_-]{4,100}$/.test(codigo)) {
    throw new functions.https.HttpsError('invalid-argument', 'Código de ativação inválido.');
  }

  const concessaoSnap = await firestoreDb.collection('concessoes').doc(codigo).get();
  if (concessaoSnap.exists) {
    const dados = concessaoSnap.data() || {};
    validarDisponibilidadeAtivacao(dados, codigo);
    return {
      valida: true,
      tipo: 'licenca',
      licenca: {
        id: codigo,
        status: dados.status || 'disponivel',
        plano: dados.plano || 'free',
        limites: dados.limites || null,
        responsavel: dados.responsavel || '',
        notas: dados.notas || '',
        expiracaoEm: millisDataAtivacao(dados.expiracaoEm || dados.dataExpiracao) !== null
          ? new Date(millisDataAtivacao(dados.expiracaoEm || dados.dataExpiracao)).toISOString()
          : null,
      },
    };
  }

  const encontrado = await localizarLoteVoucher(firestoreDb, codigo);
  if (!encontrado) {
    throw new functions.https.HttpsError('not-found', 'Link de ativação inválido ou inexistente.');
  }
  const { loteDoc, lote, patrocinadorId } = encontrado;
  const patrocinadorSnap = await firestoreDb.collection('patrocinadores').doc(patrocinadorId).get();
  if (!patrocinadorSnap.exists || patrocinadorSnap.data()?.ativo === false) {
    throw new functions.https.HttpsError('failed-precondition', 'Patrocinador inativo ou inexistente.');
  }
  const expiracao = millisDataAtivacao(lote.dataExpiracao);
  if (lote.dataExpiracao && expiracao === null) {
    throw new functions.https.HttpsError('failed-precondition', 'A validade da campanha está em formato inválido.');
  }
  if (expiracao !== null && Date.now() > expiracao) {
    throw new functions.https.HttpsError('failed-precondition', 'A validade desta campanha de patrocínio expirou.');
  }
  validarCotaLoteVoucher(lote);
  const pat = patrocinadorSnap.data() || {};
  return {
    valida: true,
    tipo: 'patrocinio',
    voucher: {
      lote: {
        id: loteDoc.id, patrocinadorId,
        nome: String(lote.nome || ''), codigoCampanha: codigo,
        totalLicencas: Number(lote.totalLicencas || 0),
        licencasAtivadas: Number(lote.licencasAtivadas || 0),
        validadeMeses: Number(lote.validadeMeses || 6),
        dataExpiracao: millisDataAtivacao(lote.dataExpiracao) !== null
          ? new Date(millisDataAtivacao(lote.dataExpiracao)).toISOString()
          : null,
        ativo: lote.ativo !== false,
      },
      patrocinador: {
        id: patrocinadorId, nomeFantasia: String(pat.nomeFantasia || ''),
        slug: String(pat.slug || ''), logoUrl: String(pat.logoUrl || ''),
        ativo: pat.ativo !== false,
      },
    },
    licenca: {
      id: codigo,
      status: 'disponivel',
      plano: 'pro',
      limites: { maxPratos: 60, maxItensMenu: 60, maxMesas: 30 },
      responsavel: 'Patrocinado por ' + String(pat.nomeFantasia || 'Parceiro MAYaMenu'),
      notas: 'Campanha B2B: ' + String(lote.nome || loteDoc.id),
      patrocinadorId,
      loteId: loteDoc.id,
    },
  };
}

function adicionarMesesSemOverflow(dataBase, meses) {
  const original = new Date(dataBase);
  const dia = original.getDate();
  original.setDate(1);
  original.setMonth(original.getMonth() + meses);
  const ultimoDia = new Date(original.getFullYear(), original.getMonth() + 1, 0).getDate();
  original.setDate(Math.min(dia, ultimoDia));
  return original;
}

function obterItensMasterPatrocinio(patrocinadorId, catalogoSnap) {
  const itens = catalogoSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  if (itens.length || patrocinadorId !== 'spn-bierhaus-demo') return itens;
  return [
    {
      id: 'chopp-artesanal-ipa-500',
      nome: 'Chopp Artesanal BierHaus IPA 500ml',
      categoriaSugerida: 'Chopps & Cervejas',
      descricaoOficial: 'Cerveja artesanal fresca com lúpulos nobres cítricos.',
      fotoOficialUrl: '/images/demo/coquetel.webp',
      precoSugerido: 22,
      obrigatorioNoCardapio: true,
      seloPatrocinador: 'Chopp Oficial Parceiro',
    },
    {
      id: 'cerveja-lager-longneck',
      nome: 'BierHaus German Lager Long Neck',
      categoriaSugerida: 'Cervejas Especiais',
      descricaoOficial: 'Puro malte refrescante, coloração dourada.',
      fotoOficialUrl: '/images/demo/coquetel.webp',
      precoSugerido: 16,
      obrigatorioNoCardapio: true,
      seloPatrocinador: 'Parceiro Master',
    },
  ];
}

function montarItemPatrocinado(itemMaster, patrocinadorId) {
  const idMaster = String(itemMaster.id || '').trim();
  if (!idMaster || idMaster.includes('/') || idMaster.length > 100) {
    throw new functions.https.HttpsError('failed-precondition', 'Catálogo contém identificador de produto inválido.');
  }
  const preco = Number(itemMaster.precoSugerido || 0);
  if (!Number.isFinite(preco) || preco < 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Catálogo contém preço inválido.');
  }
  return {
    id: 'spn-' + idMaster,
    nome: String(itemMaster.nome || 'Produto patrocinado').slice(0, 120),
    categoria: String(itemMaster.categoriaSugerida || 'Especiais da Casa').slice(0, 80),
    descricao: String(itemMaster.descricaoOficial || '').slice(0, 1000),
    precoBase: preco,
    fotoUrl: String(itemMaster.fotoOficialUrl || '').slice(0, 2048),
    ativo: true,
    ordem: -100,
    posicaoFixaTopo: true,
    origemPatrocinadorId: patrocinadorId,
    bloqueadoParaExclusao: itemMaster.obrigatorioNoCardapio !== false,
    seloPatrocinador: String(itemMaster.seloPatrocinador || 'Parceiro Oficial').slice(0, 80),
  };
}

async function executarAtivarInstancia(firestoreDb, authUid, payload) {
  if (!authUid) throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  const codigo = normalizarCodigoAtivacao(payload?.codigo);
  const slug = String(payload?.slug || '').trim().toLowerCase();
  const nome = String(payload?.restauranteNome || '').trim().slice(0, 120);
  const modo = ['com_garcom', 'hibrido', 'balcao'].includes(payload?.modoOperacao) ? payload.modoOperacao : 'hibrido';
  if (!/^[A-Z0-9_-]{4,100}$/.test(codigo) || !nome || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    throw new functions.https.HttpsError('invalid-argument', 'Nome, código ou endereço público inválido.');
  }

  const restRef = firestoreDb.collection('restaurantes').doc(authUid);
  const slugRef = firestoreDb.collection('slugs').doc(slug);
  const concessaoRef = firestoreDb.collection('concessoes').doc(codigo);
  const arquivoRef = firestoreDb.collection('arquivo_morto_licencas').doc(codigo);
  let resultado = null;

  await firestoreDb.runTransaction(async (tx) => {
    const [restSnap, slugSnap, concessaoSnap] = await Promise.all([
      tx.get(restRef), tx.get(slugRef), tx.get(concessaoRef),
    ]);
    if (restSnap.exists) {
      const atual = restSnap.data() || {};
      if (atual.ownerId === authUid && atual.licenca?.id === codigo) {
        resultado = { ...atual, id: restSnap.id, _tipoAtivacao: atual.patrocinio?.ativo ? 'patrocinio' : 'licenca', idempotente: true };
        return;
      }
      throw new functions.https.HttpsError('already-exists', 'Este usuário já possui um estabelecimento cadastrado.');
    }
    if (slugSnap.exists && slugSnap.data()?.ownerId !== authUid) {
      throw new functions.https.HttpsError('already-exists', 'Este endereço público já está em uso. Escolha outro slug.');
    }

    if (concessaoSnap.exists) {
      const licData = concessaoSnap.data() || {};
      validarDisponibilidadeAtivacao(licData, codigo);
      const arquivoSnap = await tx.get(arquivoRef);
      if (arquivoSnap.exists) {
        throw new functions.https.HttpsError('already-exists', 'Esta licença já foi utilizada e transferida para o Arquivo Morto.');
      }
      const plano = String(licData.plano || 'free');
      const limites = licData.limites || (plano === 'pro'
        ? { maxPratos: 60, maxItensMenu: 60, maxMesas: 30 }
        : plano === 'enterprise'
          ? { maxPratos: 999, maxItensMenu: 999, maxMesas: 999 }
          : { maxPratos: 20, maxItensMenu: 20, maxMesas: 10 });
      const agora = new Date();
      const restaurante = {
        id: authUid, ownerId: authUid, slug, nome, plano,
        maxMesas: limites.maxMesas, maxPratos: limites.maxPratos,
        licenca: { id: codigo, plano, limites },
        termsAcceptedAt: String(payload?.termsAcceptedAt || agora.toISOString()),
        termsVersion: String(payload?.termsVersion || '1.0.0'),
        configuracoes: {
          corPrimaria: '#E11D48', tema: 'light',
          capaUrl: '/images/capa-padrao.webp', modoOperacao: modo,
        },
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      };
      const dadosConsolidados = {
        ...licData, status: 'utilizada', consumidaEm: agora, ativadaEm: agora,
        restauranteId: authUid, restauranteNome: nome, slug, ownerId: authUid,
      };
      tx.create(restRef, restaurante);
      tx.set(slugRef, {
        slug, ownerId: authUid, restauranteNome: nome,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.create(arquivoRef, {
        id: codigo, codigo, arquivadoEm: admin.firestore.FieldValue.serverTimestamp(),
        motivo: 'ativacao_concluida', restauranteId: authUid,
        restauranteNome: nome, slug, ownerId: authUid,
        snapshotJson: JSON.stringify(dadosConsolidados),
        dadosLicenca: dadosConsolidados,
      });
      tx.delete(concessaoRef);
      resultado = { ...restaurante, _tipoAtivacao: 'licenca' };
      return;
    }

    const voucher = await localizarLoteVoucher(firestoreDb, codigo, tx);
    if (!voucher) {
      throw new functions.https.HttpsError('not-found', 'Código de ativação inválido ou concessão não encontrada.');
    }
    const { loteDoc, lote, patrocinadorId } = voucher;
    const patRef = firestoreDb.collection('patrocinadores').doc(patrocinadorId);
    const catalogoQuery = patRef.collection('catalogo_master');
    const [patSnap, catalogoSnap] = await Promise.all([tx.get(patRef), tx.get(catalogoQuery)]);
    if (!patSnap.exists || patSnap.data()?.ativo === false) {
      throw new functions.https.HttpsError('failed-precondition', 'Patrocinador inativo ou inexistente.');
    }
    const expiracao = millisDataAtivacao(lote.dataExpiracao);
    if (lote.dataExpiracao && expiracao === null) {
      throw new functions.https.HttpsError('failed-precondition', 'A validade da campanha está em formato inválido.');
    }
    if (expiracao !== null && Date.now() > expiracao) {
      throw new functions.https.HttpsError('failed-precondition', 'A validade desta campanha de patrocínio expirou.');
    }
    const cotas = validarCotaLoteVoucher(lote);
    const pat = patSnap.data() || {};
    const itensMaster = obterItensMasterPatrocinio(patrocinadorId, catalogoSnap);
    if (itensMaster.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'Patrocinador sem produtos cadastrados no Catálogo Master.');
    }
    if (itensMaster.length > 450) {
      throw new functions.https.HttpsError('failed-precondition', 'O catálogo excede o limite seguro de itens por ativação.');
    }
    const itens = itensMaster.map((item) => montarItemPatrocinado(item, patrocinadorId));
    const dataBase = new Date();
    const meses = Math.max(1, Math.min(36, Number(lote.validadeMeses) || 6));
    const expiracaoPatrocinio = adicionarMesesSemOverflow(dataBase, meses).toISOString();
    const categorias = Array.from(new Set(itensMaster.map((i) => String(i.categoriaSugerida || '').trim()).filter(Boolean)));
    const categoriaPrincipal = categorias[0] || 'Especiais da Marca';
    const vinculo = {
      restauranteId: authUid, nomeRestaurante: nome, slugRestaurante: slug,
      codigoVoucherUtilizado: codigo, ativadoEm: new Date().toISOString(), status: 'ativo',
    };
    const vinculados = Array.isArray(lote.restaurantesVinculados) ? lote.restaurantesVinculados.slice() : [];
    if (vinculados.some((v) => v.restauranteId === authUid)) {
      throw new functions.https.HttpsError('already-exists', 'Este estabelecimento já consumiu uma cota deste lote.');
    }
    const restaurante = {
      id: authUid, ownerId: authUid, slug, nome, plano: 'pro',
      maxMesas: 30, maxPratos: 60, maxItensMenu: 60,
      licenca: { id: codigo, plano: 'pro', limites: { maxPratos: 60, maxItensMenu: 60, maxMesas: 30 } },
      termsAcceptedAt: String(payload?.termsAcceptedAt || new Date().toISOString()),
      termsVersion: String(payload?.termsVersion || '1.0.0'),
      configuracoes: {
        corPrimaria: '#E11D48', tema: 'light',
        capaUrl: '/images/capa-padrao.webp', modoOperacao: modo,
      },
      assinatura: {
        planoId: 'plan_b2b_patrocinado_v1',
        apelido: 'Patrocinado por ' + String(pat.nomeFantasia || 'Parceiro MAYaMenu'),
        versao: '1.0.0', contratadoEm: new Date().toISOString(),
        dataExpiracao: expiracaoPatrocinio, valorContratado: 0,
        periodicidade: 'patrocinado',
        limites: {
          maxMesas: 30, maxItensMenu: 60,
          modulosPermitidos: ['cardapio', 'mesas', 'kds', 'garcom', 'analytics', 'patrocinio_topo'],
        },
        garantiaAcordo: 'inalteravel', status: 'ativa',
      },
      patrocinio: {
        ativo: true, patrocinadorId, patrocinadorNome: String(pat.nomeFantasia || ''),
        loteId: loteDoc.id, dataExpiracao: expiracaoPatrocinio,
        itensInjetados: itens.map((i) => i.id),
        slots: [{
          patrocinadorId, patrocinadorNome: String(pat.nomeFantasia || ''),
          categoriaSugerida: categoriaPrincipal, loteId: loteDoc.id,
          codigoVoucher: codigo, itensInjetados: itens.map((i) => i.id),
          mesesAdicionados: meses, vinculadoEm: new Date().toISOString(),
        }],
      },
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };
    tx.create(restRef, restaurante);
    tx.set(slugRef, {
      slug, ownerId: authUid, restauranteNome: nome,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    for (const item of itens) {
      tx.create(restRef.collection('cardapio').doc(item.id), item);
    }
    tx.update(loteDoc.ref, {
      licencasAtivadas: cotas.usadas + 1,
      restaurantesVinculados: [...vinculados, vinculo],
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    resultado = { ...restaurante, _tipoAtivacao: 'patrocinio' };
  });

  return {
    ...resultado,
    criadoEm: resultado.criadoEm?.toDate ? resultado.criadoEm.toDate().toISOString() : new Date().toISOString(),
    atualizadoEm: resultado.atualizadoEm?.toDate ? resultado.atualizadoEm.toDate().toISOString() : new Date().toISOString(),
  };
}

async function executarAtivarPatrocinio(firestoreDb, authUid, token, payload) {
  if (!authUid) throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  const restauranteId = String(payload?.restauranteId || '').trim();
  const codigo = normalizarCodigoAtivacao(payload?.codigoVoucher);
  if (!restauranteId || !/^[A-Z0-9_-]{4,100}$/.test(codigo)) throw new functions.https.HttpsError('invalid-argument', 'Restaurante e voucher são obrigatórios.');
  const superadmin = token?.superadmin === true;
  const restRef = firestoreDb.collection('restaurantes').doc(restauranteId);
  let resultado = null;

  await firestoreDb.runTransaction(async (tx) => {
    const restSnap = await tx.get(restRef);
    if (!restSnap.exists) throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
    const rest = restSnap.data() || {};
    if (rest.suspenso === true || rest.configuracoes?.suspenso === true) {
      throw new functions.https.HttpsError('failed-precondition', 'Não é possível vincular patrocínio a um estabelecimento suspenso.');
    }
    if (!superadmin && rest.ownerId !== authUid) {
      throw new functions.https.HttpsError('permission-denied', 'Somente o titular ou SuperAdmin pode vincular patrocínio.');
    }
    const voucher = await localizarLoteVoucher(firestoreDb, codigo, tx);
    if (!voucher) throw new functions.https.HttpsError('not-found', 'Voucher de patrocínio não encontrado.');
    const { loteDoc, lote, patrocinadorId } = voucher;
    const patRef = firestoreDb.collection('patrocinadores').doc(patrocinadorId);
    const catalogoQuery = patRef.collection('catalogo_master');
    const [patSnap, catalogoSnap] = await Promise.all([tx.get(patRef), tx.get(catalogoQuery)]);
    if (!patSnap.exists || patSnap.data()?.ativo === false) throw new functions.https.HttpsError('failed-precondition', 'Patrocinador inativo.');
    const expiracaoLote = millisDataAtivacao(lote.dataExpiracao);
    if (lote.dataExpiracao && expiracaoLote === null) throw new functions.https.HttpsError('failed-precondition', 'Validade da campanha inválida.');
    if (expiracaoLote !== null && Date.now() > expiracaoLote) throw new functions.https.HttpsError('failed-precondition', 'Campanha expirada.');
    const cotas = validarCotaLoteVoucher(lote);
    const pat = patSnap.data() || {};
    const patrocinioExistente = rest.patrocinio || {};
    const slots = Array.isArray(patrocinioExistente.slots) ? patrocinioExistente.slots : (
      patrocinioExistente.ativo ? [{
        patrocinadorId: patrocinioExistente.patrocinadorId,
        patrocinadorNome: patrocinioExistente.patrocinadorNome,
        categoriaSugerida: 'Chopps & Cervejas',
        itensInjetados: patrocinioExistente.itensInjetados || [],
      }] : []
    );
    const itensMaster = obterItensMasterPatrocinio(patrocinadorId, catalogoSnap);
    if (itensMaster.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'Patrocinador sem produtos cadastrados no Catálogo Master.');
    }
    const categoriasNovas = new Set(itensMaster.map((i) => String(i.categoriaSugerida || '').trim().toLowerCase()).filter(Boolean));
    if (slots.some((slot) => slot.patrocinadorId === patrocinadorId)) {
      throw new functions.https.HttpsError('already-exists', 'Esta marca já está vinculada ao estabelecimento.');
    }
    for (const slot of slots) {
      const categoria = String(slot.categoriaSugerida || '').trim().toLowerCase();
      if (categoria && categoriasNovas.has(categoria)) {
        throw new functions.https.HttpsError('failed-precondition', 'Conflito de categoria com outro patrocinador já vinculado.');
      }
    }
    const meses = Math.max(1, Math.min(36, Number(lote.validadeMeses) || 6));
    const agora = new Date();
    let dataBase = agora;
    const expiracaoAtual = millisDataAtivacao(patrocinioExistente.dataExpiracao);
    if (expiracaoAtual !== null && expiracaoAtual > agora.getTime()) dataBase = new Date(expiracaoAtual);
    const novaExpiracao = adicionarMesesSemOverflow(dataBase, meses).toISOString();
    const itens = itensMaster.map((i) => montarItemPatrocinado(i, patrocinadorId));
    if (itens.length > 450) throw new functions.https.HttpsError('failed-precondition', 'Catálogo excede o limite seguro por ativação.');
    const refs = itens.map((i) => restRef.collection('cardapio').doc(i.id));
    const existentes = await Promise.all(refs.map((ref) => tx.get(ref)));
    existentes.forEach((snap, index) => {
      if (snap.exists && snap.data()?.origemPatrocinadorId !== patrocinadorId) {
        throw new functions.https.HttpsError('already-exists', 'Produto patrocinado conflita com item já existente no cardápio.');
      }
    });
    const vinculados = Array.isArray(lote.restaurantesVinculados) ? lote.restaurantesVinculados.slice() : [];
    const vinculoExistente = vinculados.find((v) => v.restauranteId === restauranteId);
    if (vinculoExistente) throw new functions.https.HttpsError('already-exists', 'Este restaurante já consumiu uma cota deste lote.');
    
    const categorias = Array.from(categoriasNovas);
    const novoSlot = {
      patrocinadorId, patrocinadorNome: String(pat.nomeFantasia || ''),
      categoriaSugerida: categorias[0] || 'Especiais da Marca',
      loteId: loteDoc.id, codigoVoucher: codigo,
      itensInjetados: itens.map((i) => i.id), mesesAdicionados: meses,
      vinculadoEm: agora.toISOString(),
    };
    const novosSlots = [...slots, novoSlot];
    const todosItens = Array.from(new Set([...(patrocinioExistente.itensInjetados || []), ...itens.map((i) => i.id)]));
    const novoVinculo = {
      restauranteId, nomeRestaurante: String(rest.nome || ''),
      slugRestaurante: String(rest.slug || ''),
      codigoVoucherUtilizado: codigo, ativadoEm: agora.toISOString(), status: 'ativo',
    };
    tx.update(loteDoc.ref, {
      licencasAtivadas: cotas.usadas + 1,
      restaurantesVinculados: [...vinculados, novoVinculo],
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    itens.forEach((item, index) => {
      if (existentes[index].exists) tx.set(refs[index], item, { merge: true });
      else tx.create(refs[index], item);
    });
    tx.update(restRef, {
      plano: 'pro', maxMesas: 30, maxPratos: 60, maxItensMenu: 60,
      assinatura: {
        planoId: 'plan_b2b_patrocinado_v1',
        apelido: 'Patrocinado por ' + String(pat.nomeFantasia || ''),
        versao: '1.0.0', contratadoEm: agora.toISOString(),
        dataExpiracao: novaExpiracao, valorContratado: 0,
        periodicidade: 'patrocinado',
        limites: { maxMesas: 30, maxItensMenu: 60, modulosPermitidos: ['cardapio', 'mesas', 'kds', 'garcom', 'analytics', 'patrocinio_topo'] },
        garantiaAcordo: 'inalteravel', status: 'ativa',
      },
      patrocinio: {
        ativo: true, patrocinadorId, patrocinadorNome: String(pat.nomeFantasia || ''),
        loteId: loteDoc.id, dataExpiracao: novaExpiracao,
        itensInjetados: todosItens, slots: novosSlots,
      },
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    resultado = { sucesso: true, novaDataExpiracao: novaExpiracao, mesesAdicionados: meses };
  });
  return resultado;
}

exports.garantirCredencialMesa = functions.https.onCall(async (data, context) => {
  return executarGarantirCredencialMesa(getDb(), context.auth?.uid, context.auth?.token, data);
});

exports.emitirSessaoMesa = functions
  .runWith({ secrets: ['MESA_SESSION_SECRET'] })
  .https.onCall(async (data, context) => {
    return executarEmissaoSessaoMesa(getDb(), context.auth?.uid, data);
  });

exports.criarPedidoCliente = functions
  .runWith({ secrets: ['MESA_SESSION_SECRET'] })
  .https.onCall(async (data, context) => {
    return executarCriacaoPedidoCliente(getDb(), context.auth?.uid, data);
  });

exports.lancarPedidoGarcom = functions.https.onCall(async (data, context) => {
  return executarLancamentoPedidoGarcom(getDb(), context.auth?.uid, context.auth?.token, data);
});

exports.definirTaxaServicoMesaBackend = functions.https.onCall(async (data, context) => {
  return executarDefinirTaxaServicoMesa(getDb(), context.auth?.uid, context.auth?.token, data);
});

exports.fecharComandaBackend = functions.https.onCall(async (data, context) => {
  return executarFecharComanda(getDb(), context.auth?.uid, context.auth?.token, data);
});

/**
 * Registra chamado do garçom com validação do QR físico no backend.
 * Cria/atualiza a comanda atomicamente e aplica cooldown de 120 segundos no servidor.
 */
async function executarChamarGarcom(firestoreDb, authUid, payload) {
  const { restauranteId, mesa, nomeCliente, motivo, qrCredencial } = payload || {};
  if (!authUid) throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  if (!restauranteId || mesa === undefined || mesa === null || typeof qrCredencial !== 'string' || qrCredencial.length < 16) {
    throw new functions.https.HttpsError('invalid-argument', 'Dados do chamado ou credencial QR inválidos.');
  }
  let restDoc = await firestoreDb.collection('restaurantes').doc(String(restauranteId)).get();
  if (!restDoc.exists) {
    const q = await firestoreDb.collection('restaurantes').where('slug', '==', String(restauranteId)).limit(1).get();
    if (!q.empty) restDoc = q.docs[0];
  }
  if (!restDoc.exists) throw new functions.https.HttpsError('not-found', 'Restaurante não encontrado.');
  const restData = restDoc.data() || {};
  if (restData.suspenso === true || restData.configuracoes?.suspenso === true) {
    throw new functions.https.HttpsError('failed-precondition', 'Estabelecimento suspenso.');
  }
  const mesaStr = String(mesa).trim();
  if (!/^\d+$/.test(mesaStr) || Number(mesaStr) < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'Número de mesa inválido.');
  }
  const mesaRef = restDoc.ref.collection('mesas').doc(mesaStr);
  const comandaRef = mesaRef.collection('comandas_abertas').doc(authUid);
  const nome = String(nomeCliente || 'Cliente').trim().slice(0, 80) || 'Cliente';
  const motivoSeguro = String(motivo || 'Atendimento').trim().slice(0, 80) || 'Atendimento';
  await firestoreDb.runTransaction(async (t) => {
    const [mesaSnap, comandaSnap] = await Promise.all([t.get(mesaRef), t.get(comandaRef)]);
    if (!mesaSnap.exists) throw new functions.https.HttpsError('not-found', 'Mesa não cadastrada.');
    const m = mesaSnap.data() || {};
    if (m.ativa === false || m.statusEstrutural === 'inativa' || m.statusEstrutural === 'bloqueada') {
      throw new functions.https.HttpsError('failed-precondition', 'Mesa indisponível.');
    }
    const recebido = hashQrCredencial(qrCredencial.trim());
    if (typeof m.qrCredencialHash !== 'string' || !compararSegredoConstante(recebido, m.qrCredencialHash)) {
      throw new functions.https.HttpsError('permission-denied', 'QR Code inválido ou revogado.');
    }
    if (comandaSnap.exists) {
      const c = comandaSnap.data() || {};
      if (c.status === 'pago' || c.arquivada === true) {
        throw new functions.https.HttpsError('failed-precondition', 'A comanda já foi encerrada.');
      }
      const ultimo = c.chamadoGarcom?.solicitadoEm;
      const ultimoMs = ultimo?.toMillis ? ultimo.toMillis() : (ultimo instanceof Date ? ultimo.getTime() : 0);
      if (ultimoMs && Date.now() - ultimoMs < 120000) {
        throw new functions.https.HttpsError('resource-exhausted', 'Aguarde antes de solicitar o garçom novamente.');
      }
      t.update(comandaRef, {
        chamadoGarcom: { ativo: true, solicitadoEm: admin.firestore.FieldValue.serverTimestamp(), motivo: motivoSeguro },
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      t.create(comandaRef, {
        id: authUid, restauranteId: restDoc.id, slug: String(restData.slug || restDoc.id),
        nomeCliente: nome, mesa: Number(mesaStr), numeroMesa: Number(mesaStr),
        subtotal: 0, status: 'pedindo',
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        chamadoGarcom: { ativo: true, solicitadoEm: admin.firestore.FieldValue.serverTimestamp(), motivo: motivoSeguro },
      });
    }
  });
  return { sucesso: true };
}

/**
 * Desativa logicamente uma mesa física (sem exclusão física, preservando histórico e auditoria).
 * Valida permissão (owner/admin), inexistência de comandas abertas ou tickets KDS ativos,
 * e invalida/rotaciona a credencial QR da mesa dentro de uma única transação.
 */
async function executarDesativarMesa(firestoreDb, authUid, authToken, payload) {
  const { restauranteId, mesa } = payload || {};
  if (!authUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
  if (!restauranteId || mesa === undefined || mesa === null || String(mesa).trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Campos restauranteId e mesa são obrigatórios.');
  }

  const restDoc = await resolverRestDoc(firestoreDb, restauranteId);
  await verificarPermissaoOperacionalRestaurante(
    firestoreDb,
    restDoc,
    authUid,
    authToken,
    ['owner', 'admin']
  );

  const mesaStr = String(mesa).trim();
  const numMesa = Number(mesaStr);
  const mesaRef = restDoc.ref.collection('mesas').doc(mesaStr);
  const agoraServer = admin.firestore.FieldValue.serverTimestamp();
  let resultado = null;

  await firestoreDb.runTransaction(async (t) => {
    const mesaSnap = await t.get(mesaRef);
    if (!mesaSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Mesa não encontrada.');
    }
    const mData = mesaSnap.data() || {};

    const comandasSnap = await t.get(mesaRef.collection('comandas_abertas'));
    const temComandaAtiva = comandasSnap.docs.some((d) => {
      const c = d.data() || {};
      return c.status !== 'pago' && c.arquivada !== true;
    });
    if (temComandaAtiva) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Não é possível desativar a mesa enquanto houver comandas abertas ou não pagas.'
      );
    }

    // Consulta as duas representações legadas e ambos os campos usados pelos produtores KDS.
    // A união por ID evita depender de um único tipo numérico/string.
    const valoresMesa = Number.isFinite(numMesa) ? [numMesa, mesaStr] : [mesaStr];
    const consultasKds = [];
    for (const campo of ['mesa', 'numeroMesa']) {
      for (const valor of valoresMesa) {
        consultasKds.push(t.get(restDoc.ref.collection('kds_tickets').where(campo, '==', valor)));
      }
    }
    const resultadosKds = await Promise.all(consultasKds);
    const ticketsUnicos = new Map();
    resultadosKds.forEach((snap) => snap.docs.forEach((d) => ticketsUnicos.set(d.id, d)));
    const temTicketAtivo = Array.from(ticketsUnicos.values()).some((d) => {
      const statusTicket = (d.data() || {}).status;
      return ['a_fazer', 'em_preparo', 'pronto'].includes(statusTicket);
    });
    if (temTicketAtivo) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Não é possível desativar a mesa enquanto houver tickets ativos na cozinha.'
      );
    }

    if (mData.ativa === false && mData.statusEstrutural === 'inativa') {
      resultado = { sucesso: true, idempotente: true };
      return;
    }

    const versaoAtual = Number(mData.qrVersao) || 1;
    t.update(mesaRef, {
      ativa: false,
      statusEstrutural: 'inativa',
      qrCredencialHash: admin.firestore.FieldValue.delete(),
      qrCredencial: admin.firestore.FieldValue.delete(),
      qrVersao: versaoAtual + 1,
      desativadaEm: agoraServer,
      desativadaPorUid: authUid,
      atualizadoEm: agoraServer,
    });
    resultado = { sucesso: true, idempotente: false };
  });

  return resultado;
}

exports.autenticarPatrocinadorBackend = functions.https.onCall(async (data, context) => {
  return executarAutenticarPatrocinador(getDb(), data, context.rawRequest);
});

exports.processarSelloutOutbox = onDocumentCreated({
  document: 'restaurantes/{restauranteId}/_sellout_outbox/{eventId}',
  database: 'mayamenu-bd',
  region: 'us-central1',
  retry: true,
}, async (event) => {
  if (!event.data) return null;
  return executarProcessarSelloutOutbox(getDb(), event.params.restauranteId, event.params.eventId);
});

exports.validarCodigoAtivacaoBackend = functions.https.onCall(async (data) => {
  return executarValidarCodigoAtivacao(getDb(), data);
});

exports.ativarInstanciaBackend = functions.https.onCall(async (data, context) => {
  return executarAtivarInstancia(getDb(), context.auth?.uid, data);
});

exports.ativarPatrocinioBackend = functions.https.onCall(async (data, context) => {
  return executarAtivarPatrocinio(getDb(), context.auth?.uid, context.auth?.token, data);
});

exports.chamarGarcomBackend = functions.https.onCall(async (data, context) => {
  return executarChamarGarcom(getDb(), context.auth?.uid, data);
});

exports.liberarMesaBackend = functions.https.onCall(async (data, context) => {
  return executarLiberarMesa(getDb(), context.auth?.uid, context.auth?.token, data);
});

exports.desativarMesaBackend = functions.https.onCall(async (data, context) => {
  return executarDesativarMesa(getDb(), context.auth?.uid, context.auth?.token, data);
});


// Mantém um espelho público minimizado do restaurante. O documento raiz permanece privado.
// Somente campos explicitamente permitidos são copiados; nunca replica ownerId, plano,
// licença, limites, dados de equipe, PINs, QR ou configurações financeiras privadas.
exports.sincronizarPerfilPublicoRestaurante = onDocumentWritten({
  document: 'restaurantes/{restauranteId}',
  database: 'mayamenu-bd',
  region: 'us-central1',
  retry: true,
}, async (event) => {
    const after = event.data?.after;
    const restauranteId = event.params.restauranteId;
    const publicRef = getDb().collection('restaurantes_publicos').doc(restauranteId);
    if (!after?.exists) {
      await publicRef.delete();
      return null;
    }
    const data = after.data() || {};
    const cfg = data.configuracoes || {};
    const configuracoes = {};
    for (const key of ['corPrimaria', 'tema', 'logoUrl', 'capaUrl', 'modoOperacao', 'modoFilaKds', 'taxaServico']) {
      if (cfg[key] !== undefined) configuracoes[key] = cfg[key];
    }
    // Chave Pix e dados EMV são públicos por natureza do pagamento; publicar apenas
    // quando explicitamente ativo e somente os campos necessários à cobrança.
    if (cfg.pixConfig?.ativo === true && cfg.pixConfig.chave && cfg.pixConfig.tipoChave) {
      configuracoes.pixConfig = {
        chave: String(cfg.pixConfig.chave),
        tipoChave: String(cfg.pixConfig.tipoChave),
        beneficiario: String(cfg.pixConfig.beneficiario || '').slice(0, 25),
        cidade: String(cfg.pixConfig.cidade || '').slice(0, 15),
        ativo: true,
      };
    }
    await publicRef.set({
      restauranteId,
      slug: String(data.slug || restauranteId),
      nome: String(data.nome || 'Restaurante'),
      suspenso: data.suspenso === true || cfg.suspenso === true,
      configuracoes,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
    return null;
  });

exports._internal = {
  getMesaTokenSecret,
  verificarMesaToken,
  validarModificadoresServidor,
  executarGarantirCredencialMesa,
  executarCriacaoPedidoCliente,
  executarEmissaoSessaoMesa,
  executarLancamentoPedidoGarcom,
  executarDefinirTaxaServicoMesa,
  executarFecharComanda,
  executarLiberarMesa,
  executarDesativarMesa,
  executarChamarGarcom,
  executarValidarCodigoAtivacao,
  executarAutenticarPatrocinador,
  executarAtivarInstancia,
  executarAtivarPatrocinio,
  executarProcessarSelloutOutbox,
};

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



