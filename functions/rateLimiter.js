/**
 * Módulo de Lógica e Utilitários de Rate Limiting
 * Compartilhado entre Cloud Functions e suíte de testes automatizados.
 * 
 * Regras:
 * 1. Prioridade à cadeia X-Forwarded-For recebida pela borda gerenciada Google Cloud (GFE):
 *    valores à esquerda podem ter sido enviados pelo cliente; o último nó é o salto
 *    confiável acrescentado pela borda e é a identidade de rede adotada pelo rate limiter.
 *    Não confiar em fastly-client-ip nem x-appengine-user-ip, pois não há garantia de
 *    que esses cabeçalhos sejam removidos/substituídos antes de chegar à Function.
 * 2. Janelas deslizantes de 15 minutos com reset automático e contenção atômica de 3 camadas:
 *    - IP (5 tentativas)
 *    - Colaborador (5 tentativas)
 *    - Tenant Global (20 tentativas distribuídas)
 */

const net = require('net');

const JANELA_MS = 15 * 60 * 1000;
const LIMITE_TENTATIVAS_IP = 5;
const LIMITE_TENTATIVAS_USER = 5;
const LIMITE_TENTATIVAS_GLOBAL = 20;

/**
 * Extrai o último nó confiável da cadeia X-Forwarded-For definida pela borda GFE.
 * O valor é validado como IPv4/IPv6; cabeçalhos alternativos enviados pelo cliente
 * não são considerados fontes de identidade.
 */
function extrairIpConviavel(rawRequest) {
  if (!rawRequest) return 'unknown_ip';

  const rawXff = rawRequest.headers?.['x-forwarded-for'];
  if (rawXff) {
    const ips = String(rawXff)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => net.isIP(s) !== 0);

    if (ips.length > 0) {
      // A borda GFE acrescenta o nó confiável à direita da cadeia encaminhada.
      return ips[ips.length - 1];
    }
  }

  // Sem cadeia encaminhada válida, usar o peer direto do socket.
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

