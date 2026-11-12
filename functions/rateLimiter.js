/**
 * Módulo de Lógica e Utilitários de Rate Limiting
 * Compartilhado entre Cloud Functions e suíte de testes automatizados.
 * 
 * Regras:
 * 1. Extração segura de IP contra spoofing de X-Forwarded-For:
 *    No Google Cloud Functions / Cloud Run (Google Frontend Proxy GFE),
 *    o GFE appenda o IP de conexão direta do cliente ao FINAL do cabeçalho X-Forwarded-For.
 *    Qualquer IP pré-existente enviado pelo atacante fica nos primeiros elementos (spoofable).
 *    Portanto, o IP confiável e validado pela infraestrutura Google é ips[ips.length - 1],
 *    ou o cabeçalho 'fastly-client-ip' / socket.remoteAddress.
 * 2. Janelas deslizantes de 15 minutos com reset automático e contenção atômica de 3 camadas:
 *    - IP (5 tentativas)
 *    - Colaborador (5 tentativas)
 *    - Tenant Global (20 tentativas distribuídas)
 */

const crypto = require('crypto');

const JANELA_MS = 15 * 60 * 1000;
const LIMITE_TENTATIVAS_IP = 5;
const LIMITE_TENTATIVAS_USER = 5;
const LIMITE_TENTATIVAS_GLOBAL = 20;

/**
 * Extrai o IP real do cliente com validação rigorosa da cadeia de proxies reversos do Google Cloud / Cloud Run / GFE
 * 
 * Topologia de Infraestrutura Google Cloud Functions Gen 2 / Cloud Run:
 * 1. O Google Front End (GFE) atua como proxy reverso de borda e terminação TLS.
 * 2. Em relação a 'X-Forwarded-For': Qualquer valor enviado pelo cliente é mantido à esquerda,
 *    e o GFE ANEXA o IP público de conexão do cliente ao final da cadeia (RFC 7239 / GCP GFE spec):
 *    [ip_injetado_1, ip_injetado_2, ..., ip_real_cliente]
 * 3. Cabeçalhos de salto como 'fastly-client-ip' ou 'x-appengine-user-ip' só são confiáveis se garantidamente
 *    injetados pela infraestrutura. Para eliminar riscos de falsificação direta em Cloud Run Functions
 *    (onde fastly não está presente diretamente ou pode ser repassado), NÃO priorizamos 'fastly-client-ip'
 *    como autoritativo isolado. Em vez disso, analisamos a cadeia X-Forwarded-For adicionada pelo GFE.
 * 4. Ao ler o último IP anexado pelo Google Front End na cadeia X-Forwarded-For, o sistema obtém
 *    comprovadamente o endereço IP do hop anterior (cliente ou proxy de borda legítimo),
 *    rejeitando tentativas de evasão por injeção de múltiplos IPs falsos no cabeçalho.
 */
function extrairIpConviavel(rawRequest) {
  if (!rawRequest) return 'unknown_ip';

  // 1. Análise da cadeia X-Forwarded-For no Google Cloud Run / Functions:
  // O GFE appenda o IP de conexão do cliente ao final da lista.
  // Seleciona o salto confiável de borda (último nó adicionado pela malha Google)
  const rawXff = rawRequest.headers?.['x-forwarded-for'];
  if (rawXff) {
    const ips = String(rawXff)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^[a-fA-F0-9:.]+$/.test(s));

    if (ips.length > 0) {
      return ips[ips.length - 1];
    }
  }

  // 2. Cabeçalho de usuário AppEngine/GCP caso injetado pela infraestrutura gerenciada
  const gcpUserIp = rawRequest.headers?.['x-appengine-user-ip'];
  if (gcpUserIp && /^[a-fA-F0-9:.]+$/.test(String(gcpUserIp).trim())) {
    return String(gcpUserIp).trim();
  }

  // 3. Fallback para conexão de socket direto (emulação local / testes)
  if (rawRequest.socket?.remoteAddress) {
    return rawRequest.socket.remoteAddress;
  }
  if (rawRequest.ip) {
    return rawRequest.ip;
  }

  return 'unknown_ip';
}

function sanitizarChave(valor) {
  return String(valor || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Avalia se há bloqueio ativo em alguma das 3 dimensões
 */
function verificarBloqueioAtivo({ ipData, userData, globalData, agora }) {
  if (ipData?.bloqueadoAte && agora < ipData.bloqueadoAte) {
    const minutosRestantes = Math.ceil((ipData.bloqueadoAte - agora) / 60000);
    return {
      bloqueado: true,
      tipo: 'ip',
      minutosRestantes,
      mensagem: `Muitas tentativas a partir deste endereço de rede. Bloqueado temporariamente por ${minutosRestantes} minuto(s).`,
    };
  }

  if (userData?.bloqueadoAte && agora < userData.bloqueadoAte) {
    const minutosRestantes = Math.ceil((userData.bloqueadoAte - agora) / 60000);
    return {
      bloqueado: true,
      tipo: 'colaborador',
      minutosRestantes,
      mensagem: `Muitas tentativas para este colaborador. Bloqueado temporariamente por ${minutosRestantes} minuto(s).`,
    };
  }

  if (globalData?.bloqueadoAte && agora < globalData.bloqueadoAte) {
    const minutosRestantes = Math.ceil((globalData.bloqueadoAte - agora) / 60000);
    return {
      bloqueado: true,
      tipo: 'global',
      minutosRestantes,
      mensagem: `Muitas tentativas globais no estabelecimento. Bloqueio de contenção por ${minutosRestantes} minuto(s).`,
    };
  }

  return { bloqueado: false };
}

/**
 * Calcula os novos payloads atômicos após falha de PIN
 */
function calcularPayloadsFalha({ curIpData = {}, curUserData = {}, curGlobalData = {}, agora }) {
  // IP
  const ipJanelaExpirada = !curIpData.janelaIniciadaEm || (agora - curIpData.janelaIniciadaEm > JANELA_MS);
  const curIpTentativas = (ipJanelaExpirada ? 0 : (curIpData.tentativas || 0)) + 1;
  const ipPayload = {
    tentativas: curIpTentativas,
    ultimoErro: agora,
    janelaIniciadaEm: ipJanelaExpirada ? agora : curIpData.janelaIniciadaEm,
  };
  if (curIpTentativas >= LIMITE_TENTATIVAS_IP) {
    ipPayload.bloqueadoAte = agora + JANELA_MS;
  }

  // Colaborador
  const userJanelaExpirada = !curUserData.janelaIniciadaEm || (agora - curUserData.janelaIniciadaEm > JANELA_MS);
  const curUserTentativas = (userJanelaExpirada ? 0 : (curUserData.tentativas || 0)) + 1;
  const userPayload = {
    tentativas: curUserTentativas,
    ultimoErro: agora,
    janelaIniciadaEm: userJanelaExpirada ? agora : curUserData.janelaIniciadaEm,
  };
  if (curUserTentativas >= LIMITE_TENTATIVAS_USER) {
    userPayload.bloqueadoAte = agora + JANELA_MS;
  }

  // Global do Estabelecimento com Janela Deslizante de Recuperação Explícita
  const globalJanelaExpirada = !curGlobalData.janelaIniciadaEm || (agora - curGlobalData.janelaIniciadaEm > JANELA_MS);
  const curGlobalTentativas = (globalJanelaExpirada ? 0 : (curGlobalData.tentativas || 0)) + 1;
  const globalPayload = {
    tentativas: curGlobalTentativas,
    ultimoErro: agora,
    janelaIniciadaEm: globalJanelaExpirada ? agora : curGlobalData.janelaIniciadaEm,
  };
  if (curGlobalTentativas >= LIMITE_TENTATIVAS_GLOBAL) {
    globalPayload.bloqueadoAte = agora + JANELA_MS;
    globalPayload.tentativas = LIMITE_TENTATIVAS_GLOBAL;
  }

  return { ipPayload, userPayload, globalPayload };
}

module.exports = {
  JANELA_MS,
  LIMITE_TENTATIVAS_IP,
  LIMITE_TENTATIVAS_USER,
  LIMITE_TENTATIVAS_GLOBAL,
  extrairIpConviavel,
  sanitizarChave,
  verificarBloqueioAtivo,
  calcularPayloadsFalha,
};

