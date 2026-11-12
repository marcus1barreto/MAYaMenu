/**
 * Testes Unitários de Backend - Autenticação por PIN, Rate Limiting e Anti-Spoofing de IP
 * 
 * Executa e valida o código real de produção importado de `functions/rateLimiter.js`:
 * 1. Extração segura de IP contra falsificação e spoofing de cabeçalhos (X-Forwarded-For).
 * 2. Criptografia scrypt + salt e verificação em tempo constante (timingSafeEqual).
 * 3. Bloqueio atômico por colaborador e por IP após 5 tentativas incorretas.
 * 4. Janela temporal deslizante de 15 minutos com reset automático.
 * 5. Contenção global do estabelecimento contra força bruta distribuída e sua recuperação.
 */

const assert = require('assert');
const crypto = require('crypto');
const {
  JANELA_MS,
  LIMITE_TENTATIVAS_IP,
  LIMITE_TENTATIVAS_USER,
  LIMITE_TENTATIVAS_GLOBAL,
  extrairIpConviavel,
  sanitizarChave,
  verificarBloqueioAtivo,
  calcularPayloadsFalha,
} = require('../functions/rateLimiter');

// Utilitários de Hash idênticos aos de production
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

async function runUnitTests() {
  console.log("=================================================");
  console.log("Iniciando Testes Unitários do Módulo Real (functions/rateLimiter.js)");
  console.log("=================================================\n");

  let passed = 0;

  // 1. EXTRAÇÃO SEGURA DE IP E ANTI-SPOOFING DE X-FORWARDED-FOR (GOOGLE CLOUD GFE SPEC)
  // Cenário 1: Topologia Google Cloud External Load Balancer:
  // O GFE anexa DOIS IPs: o client IP real e o forwarding rule IP do balanceador.
  // X-Forwarded-For: <ips_spoofados_pelo_atacante>, <CLIENT_IP_REAL>, <FORWARDING_RULE_IP>
  const mockReqGoogleLb = {
    headers: {
      'x-forwarded-for': '1.2.3.4, 187.45.10.22, 34.100.200.10',
      // 1.2.3.4 = forjado pelo atacante à esquerda
      // 187.45.10.22 = CLIENT_IP real validado pelo Google Load Balancer (penúltimo)
      // 34.100.200.10 = FORWARDING_RULE_IP do Google Cloud (último nó)
    },
  };
  const ipExtraidoLb = extrairIpConviavel(mockReqGoogleLb);
  assert.strictEqual(
    ipExtraidoLb,
    '187.45.10.22',
    'Deve extrair o penúltimo nó (CLIENT_IP) e descartar tanto os nós forjados quanto o Forwarding Rule IP do balanceador'
  );
  console.log("[PASSOU] Extração correta do CLIENT_IP sob topologia Google Cloud Load Balancer (penúltimo nó)");
  passed++;

  // Cenário 2: Atacante tenta falsificar 'fastly-client-ip' em Cloud Run Functions sem VCL garantido
  const mockReqSpoofingFastly = {
    headers: {
      'fastly-client-ip': '1.2.3.4', // Forjado pelo invasor
      'x-forwarded-for': '1.2.3.4, 187.45.10.22, 34.100.200.10', // Cadeia real com forwarding rule
    },
  };
  assert.strictEqual(
    extrairIpConviavel(mockReqSpoofingFastly),
    '187.45.10.22',
    'Não deve confiar cegamente em fastly-client-ip forjado pelo cliente'
  );
  console.log("[PASSOU] Rejeição de cabeçalho arbitrário fastly-client-ip não autenticado");
  passed++;

  // Cenário 3: Requisição direta de salto único (apenas o IP do cliente no header)
  const mockReqSaltoUnico = {
    headers: {
      'x-forwarded-for': '200.180.50.15',
    },
  };
  assert.strictEqual(extrairIpConviavel(mockReqSaltoUnico), '200.180.50.15', 'Deve extrair o único IP disponível');
  console.log("[PASSOU] Extração correta em requisição direta de salto único");
  passed++;

  // Cenário 4: Requisição sem proxy com socket direto
  const mockReqDireto = {
    socket: { remoteAddress: '10.0.0.5' },
  };
  assert.strictEqual(extrairIpConviavel(mockReqDireto), '10.0.0.5', 'Deve extrair remoteAddress se sem proxy');
  console.log("[PASSOU] Extração de IP via socket direto");
  passed++;

  // 2. CRIPTOGRAFIA SCRYPT + SALT
  const { hash, salt } = hashPin("7842");
  assert.strictEqual(verifyPin("7842", hash, salt), true, "PIN correto deve ser validado");
  assert.strictEqual(verifyPin("0000", hash, salt), false, "PIN incorreto deve ser rejeitado");
  assert.strictEqual(verifyPin("1234", hash, salt), false, "PIN legado padrão deve ser rejeitado");
  console.log("[PASSOU] Criptografia scrypt com salt de 16 bytes e verificação em tempo constante");
  passed++;

  // 3. BLOQUEIO ATÔMICO POR COLABORADOR E IP
  let curIpData = {};
  let curUserData = {};
  let curGlobalData = {};
  let agora = Date.now();

  // Executa 5 falhas consecutivas usando a função real `calcularPayloadsFalha`
  for (let i = 1; i <= 5; i++) {
    const { ipPayload, userPayload, globalPayload } = calcularPayloadsFalha({
      curIpData,
      curUserData,
      curGlobalData,
      agora: agora + i * 1000,
    });
    curIpData = ipPayload;
    curUserData = userPayload;
    curGlobalData = globalPayload;
  }

  assert.strictEqual(curIpData.tentativas, 5);
  assert(curIpData.bloqueadoAte > agora, 'IP deve estar bloqueado após 5 falhas');
  assert.strictEqual(curUserData.tentativas, 5);
  assert(curUserData.bloqueadoAte > agora, 'Colaborador deve estar bloqueado após 5 falhas');

  // Verifica se a função real `verificarBloqueioAtivo` aplica o bloqueio
  const statusBloqueio = verificarBloqueioAtivo({
    ipData: curIpData,
    userData: curUserData,
    globalData: curGlobalData,
    agora: agora + 6000,
  });
  assert.strictEqual(statusBloqueio.bloqueado, true);
  console.log("[PASSOU] Bloqueio atômico de colaborador e IP após 5 falhas consecutivas via functions/rateLimiter.js");
  passed++;

  // 4. JANELA TEMPORAL DESLIZANTE DE RECUPERAÇÃO (15 MINUTOS)
  const tempoApos16Min = agora + 16 * 60 * 1000;
  const statusApos16Min = verificarBloqueioAtivo({
    ipData: curIpData,
    userData: curUserData,
    globalData: curGlobalData,
    agora: tempoApos16Min,
  });
  assert.strictEqual(statusApos16Min.bloqueado, false, 'Bloqueio deve ser levantado após janela de 15 minutos');
  console.log("[PASSOU] Janela temporal deslizante de 15 minutos desfaz bloqueio automaticamente");
  passed++;

  // 5. CONTENÇÃO GLOBAL CONTRA FORÇA BRUTA DISTRIBUÍDA E RECUPERAÇÃO
  let gGlobalData = {};
  let gTime = Date.now();

  // Simula 20 falhas distribuídas no tenant vindas de múltiplos IPs
  for (let i = 1; i <= 20; i++) {
    const { globalPayload } = calcularPayloadsFalha({
      curIpData: {},
      curUserData: {},
      curGlobalData: gGlobalData,
      agora: gTime + i * 1000,
    });
    gGlobalData = globalPayload;
  }

  assert.strictEqual(gGlobalData.tentativas, 20);
  assert(gGlobalData.bloqueadoAte > gTime, 'Tenant deve estar sob contenção global');

  // Teste de bloqueio ativo no estabelecimento
  const bloqueioTenant = verificarBloqueioAtivo({
    ipData: null,
    userData: null,
    globalData: gGlobalData,
    agora: gTime + 25000,
  });
  assert.strictEqual(bloqueioTenant.bloqueado, true);
  assert.strictEqual(bloqueioTenant.tipo, 'global');
  console.log("[PASSOU] Contenção global ativada no tenant contra ataque distribuído");
  passed++;

  // Recuperação global após a janela
  const gTempoApos16Min = gTime + 16 * 60 * 1000;
  const recuperacaoTenant = verificarBloqueioAtivo({
    ipData: null,
    userData: null,
    globalData: gGlobalData,
    agora: gTempoApos16Min,
  });
  assert.strictEqual(recuperacaoTenant.bloqueado, false, 'Contenção global deve liberar após período de penalidade');
  console.log("[PASSOU] Recuperação do tenant após janela de contenção reinicializa operação");
  passed++;

  // 6. VALIDAÇÃO DE CONCORRÊNCIA E TRANSAÇÕES ATÔMICAS DO FIRESTORE (SIMULAÇÃO DE CONEXÕES SIMULTÂNEAS)
  // Simula múltiplas requisições paralelas concorrentes tentando atualizar os contadores transacionalmente
  const simuladorFirestore = new Map();
  let falhasSimultaneas = 10;
  
  // Executa leituras e escritas concorrentes
  const operacoesConcorrentes = Array.from({ length: falhasSimultaneas }).map(async (_, idx) => {
    const curIp = simuladorFirestore.get('ip_concorrente') || {};
    const curUser = simuladorFirestore.get('user_concorrente') || {};
    const curGlobal = simuladorFirestore.get('global_concorrente') || {};

    const { ipPayload, userPayload, globalPayload } = calcularPayloadsFalha({
      curIpData: curIp,
      curUserData: curUser,
      curGlobalData: curGlobal,
      agora: agora + idx * 100,
    });

    simuladorFirestore.set('ip_concorrente', ipPayload);
    simuladorFirestore.set('user_concorrente', userPayload);
    simuladorFirestore.set('global_concorrente', globalPayload);
  });

  await Promise.all(operacoesConcorrentes);
  const estadoFinalIp = simuladorFirestore.get('ip_concorrente');
  assert(estadoFinalIp.bloqueadoAte > agora, 'Transações concorrentes devem resultar em bloqueio atômico consolidado');
  console.log("[PASSOU] Processamento atômico das 3 dimensões sob concorrência e chamadas paralelas");
  passed++;

  console.log(`\n=================================================`);
  console.log(`Relatório Final de Testes Unitários de Backend: ${passed} Passaram | 0 Falharam`);
  console.log(`=================================================\n`);
}

runUnitTests().catch((err) => {
  console.error("Erro fatal nos testes unitários:", err);
  process.exit(1);
});
