/**
 * Módulo de Lógica e Utilitários de Rate Limiting
 * Compartilhado entre Cloud Functions e suíte de testes automatizados.
 * 
 * Regras:
 * 1. Extração de IP alinhada à topologia coberta pelos testes:
 *    No Google Cloud External Application Load Balancer, a infraestrutura acrescenta
 *    CLIENT_IP e, depois, FORWARDING_RULE_IP ao fim do X-Forwarded-For.
 *    Valores anteriores podem ter sido enviados pelo cliente e não são confiáveis;
 *    nessa topologia, CLIENT_IP é o penúltimo elemento.
 *    Não confiar em fastly-client-ip nem x-appengine-user-ip sem garantia explícita
 *    de que o proxy de produção os remove/substitui antes de chegar à Function.
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
 * Topologia de Infraestrutura Google Cloud Functions & External Application Load Balancers:
 * Conforme a documentação oficial da Google Cloud (docs.cloud.google.com/load-balancing/docs/https):
 * 1. Ao receber tráfego através de Google Cloud External Application Load Balancers (GFE),
 *    a infraestrutura anexa DOIS endereços IP ao cabeçalho 'X-Forwarded-For':
 *      X-Forwarded-For: <CLIENT_IP>, <FORWARDING_RULE_IP>
 *    onde:
 *      - Penúltimo nó (ips[ips.length - 2]): É o IP real do CLIENTE que se conectou ao balanceador.
 *      - Último nó (ips[ips.length - 1]): É o IP da Regra de Encaminhamento (Forwarding Rule) do balanceador Google.
 * 2. Se a requisição chega via Cloud Run Functions direto (sem balanceador extra à frente) com apenas 1 IP
 *    ou invocação direta local, ips[0] é o próprio cliente.
 * 3. Se um atacante tentar forjar cabeçalhos injetando IPs à esquerda:
 *      X-Forwarded-For: <ip_falso_1>, <ip_falso_2>, <CLIENT_IP_REAL>, <FORWARDING_RULE_IP>
 *    Ao descartar os nós forjados e o nó de infraestrutura do balanceador (último nó),
 *    o IP legítimo do cliente é estritamente o penúltimo elemento: ips[ips.length - 2].
 * 4. Para máxima robustez defensiva em qualquer topologia Google Cloud:
 *    - Se a cadeia tiver 2 ou mais IPs: o IP do cliente é ips[ips.length - 2] (descartando o forwarding rule IP).
 *    - Se a cadeia tiver exatamente 1 IP: o IP do cliente é ips[0].
 */
function extrairIpConviavel(rawRequest) {
  if (!rawRequest) return 'unknown_ip';

  // 1. Análise da cadeia X-Forwarded-For segundo a especificação GFE / Google Cloud Load Balancing:
  const rawXff = rawRequest.headers?.['x-forwarded-for'];
  if (rawXff) {
    const ips = String(rawXff)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^[a-fA-F0-9:.]+$/.test(s));

    if (ips.length > 0) {
      if (ips.length >= 2) {
        // Topologia Google Cloud Load Balancer: [..., CLIENT_IP, FORWARDING_RULE_IP]
        // O penúltimo IP é o endereço real do cliente validado pelo balanceador
        return ips[ips.length - 2];
      }
      // Topologia de salto único ou Cloud Run direto: [CLIENT_IP]
      return ips[0];
    }
  }

  // Não usar x-appengine-user-ip: Cloud Functions gen2 não documenta esse campo
  // como uma fonte autenticada para esta topologia. Fallback conservador ao peer direto.
  // 2. Fallback para conexão de socket direto (emulação local / Express)
  if (rawRequest.ip) {
    return rawRequest.ip;
  }
  if (rawRequest.socket?.remoteAddress) {
    return rawRequest.socket.remoteAddress;
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

