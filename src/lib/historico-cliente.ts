// Gerenciamento do Histórico de Visitas e Comprovantes no aparelho do Cliente
// 100% Client-Side (LocalStorage) - Zero custo de banco, privacidade preservada.

export interface ItemComprovante {
  nome: string;
  quantidade: number;
  precoFinal: number;
  modificadores?: { grupo: string; opcao: string }[];
  observacoes?: string;
}

export interface VisitaCliente {
  id: string; // Ex: vis-1728954000-demo-12
  restaurante: {
    nome: string;
    slug: string;
    logoUrl?: string;
  };
  mesa: number | string;
  clienteNome: string;
  clienteId: string;
  dataHora: string; // ISO string
  itens: ItemComprovante[];
  subtotal: number;
  taxaServico?: number;
  totalPago: number;
  status: "ativo" | "pago" | "concluido";
  comprovanteHash: string; // Código de autenticação legível (ex: MM-DEMO-M12-8AD9)
}

const STORAGE_KEY_VISITAS = "mayamenu_historico_visitas";
const STORAGE_KEY_ULTIMO_NOME = "mayamenu_ultimo_nome_cliente";

/**
 * Salva ou atualiza a visita atual no aparelho do cliente
 */
export function salvarVisitaLocal(visita: VisitaCliente): void {
  if (typeof window === "undefined") return;

  try {
    const historico = obterHistoricoVisitas();
    const indexExistente = historico.findIndex((v) => v.id === visita.id);

    if (indexExistente >= 0) {
      historico[indexExistente] = visita;
    } else {
      // Adiciona no topo da lista (mais recente primeiro)
      historico.unshift(visita);
    }

    // Guarda até as últimas 20 visitas para poupar espaço
    const historicoLimitado = historico.slice(0, 20);
    localStorage.setItem(STORAGE_KEY_VISITAS, JSON.stringify(historicoLimitado));

    // Lembra o nome do cliente para preenchimento automático na próxima vez
    if (visita.clienteNome) {
      localStorage.setItem(STORAGE_KEY_ULTIMO_NOME, visita.clienteNome);
    }
  } catch (e) {
    console.warn("Falha ao salvar comprovante no localStorage:", e);
  }
}

/**
 * Retorna todas as visitas e comprovantes arquivados no celular do cliente
 */
export function obterHistoricoVisitas(): VisitaCliente[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_VISITAS);
    if (!raw) return [];
    return JSON.parse(raw) as VisitaCliente[];
  } catch {
    return [];
  }
}

/**
 * Obtém o último nome utilizado pelo cliente para agilizar novos pedidos
 */
export function obterUltimoNomeCliente(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY_ULTIMO_NOME) || "";
  } catch {
    return "";
  }
}

/**
 * Marca a visita como paga / concluída (quando o garçom fecha a comanda)
 */
export function finalizarVisitaLocal(visitaId: string): void {
  if (typeof window === "undefined") return;

  try {
    const historico = obterHistoricoVisitas();
    const atualizado = historico.map((v) =>
      v.id === visitaId ? { ...v, status: "concluido" as const } : v
    );
    localStorage.setItem(STORAGE_KEY_VISITAS, JSON.stringify(atualizado));
  } catch (e) {
    console.warn("Falha ao finalizar visita no localStorage:", e);
  }
}

/**
 * Atualiza o status da visita mais recente desta mesa para "concluido" / "pago"
 */
export function marcarVisitaAtualComoPaga(slug: string, mesa: number | string): void {
  if (typeof window === "undefined") return;

  try {
    const historico = obterHistoricoVisitas();
    const index = historico.findIndex(
      (v) => v.restaurante.slug === slug && String(v.mesa) === String(mesa) && v.status === "ativo"
    );
    if (index >= 0) {
      historico[index].status = "concluido";
      localStorage.setItem(STORAGE_KEY_VISITAS, JSON.stringify(historico));
    }
  } catch (e) {
    console.warn("Falha ao marcar visita atual como paga:", e);
  }
}

/**
 * Timeout de 4 horas para expiração de inatividade da sessão da mesa (Decisão Oficial)
 */
export const SESSAO_MESA_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 horas

export function isSessaoExpirada(dataHoraIso: string): boolean {
  try {
    const tempoDecorrido = Date.now() - new Date(dataHoraIso).getTime();
    return tempoDecorrido > SESSAO_MESA_TIMEOUT_MS;
  } catch {
    return false;
  }
}

/**
 * Gera um código legível de comprovante digital
 */
export function gerarComprovanteHash(slug: string, mesa: number | string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let hash = "";
  for (let i = 0; i < 4; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MM-${slug.toUpperCase()}-M${mesa}-${hash}`;
}

/**
 * Limpa a sessão local da mesa e carrinho quando a conta é marcada como paga
 */
export function limparSessaoClienteLocal(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`mayamenu_cart_${slug}`);
    localStorage.removeItem("mayamenu_anon_uid");
  } catch (e) {
    console.warn("Falha ao limpar sessão do cliente no localStorage:", e);
  }
}
