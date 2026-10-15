// Ticket Digital (QR Code) - contingência offline
// Ver docs/especificacao-tecnica-alpha.md §4.1
//
// Payload enxuto (chaves curtas para caber num QR legível em telas pequenas):
// {
//   "v": 1,                                  // versão do formato
//   "id": "ID_DO_PEDIDO",
//   "t": 12,                                 // mesa
//   "c": { "id": "uidAnonimo", "n": "Marcus" }, // cliente (obrigatório)
//   "i": [
//     { "id": "a1", "q": 2,
//       "m": [["Ponto da Carne", "Bem passado"]], // [grupo, opcao][]
//       "o": "Sem cebola" }
//   ]
// }

import type { ItemPedido } from "@/types";

export const TICKET_VERSION = 1;

/** Limite seguro para QR Code nível M legível em celulares (bytes). */
export const TICKET_MAX_BYTES = 1800;

export type TicketModificador = [grupo: string, opcao: string];

export interface TicketItem {
  id: string; // menuItemId
  q: number; // quantidade
  m?: TicketModificador[];
  o?: string; // observações
}

export interface TicketPayload {
  v: typeof TICKET_VERSION;
  id: string; // ID do pedido
  t: number | string; // mesa
  c: { id: string; n: string }; // cliente: clienteId + nomeCliente
  i: TicketItem[];
}

type ItemComanda = ItemPedido;

/** Monta o payload a partir dos itens da comanda (omite campos vazios). */
export function buildTicketPayload(params: {
  pedidoId: string;
  mesa: number | string;
  clienteId: string;
  nomeCliente: string;
  itens: Pick<ItemComanda, "menuItemId" | "quantidade" | "modificadores" | "observacoes">[];
}): TicketPayload {
  return {
    v: TICKET_VERSION,
    id: params.pedidoId,
    t: params.mesa,
    c: { id: params.clienteId, n: params.nomeCliente.trim() },
    i: params.itens.map((item) => {
      const out: TicketItem = { id: item.menuItemId, q: item.quantidade };
      if (item.modificadores?.length) {
        out.m = item.modificadores.map((mod) => [mod.grupo, mod.opcao]);
      }
      const obs = item.observacoes?.trim();
      if (obs) out.o = obs;
      return out;
    }),
  };
}

/** Serializa para a string que vai dentro do QR Code. */
export function encodeTicket(payload: TicketPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > TICKET_MAX_BYTES) {
    throw new Error(
      `Ticket muito grande para um QR Code legível (${bytes} bytes > ${TICKET_MAX_BYTES}). Divida o pedido.`,
    );
  }
  return json;
}

const isStr = (x: unknown): x is string => typeof x === "string";

/** Lê e valida a string escaneada pelo garçom. Retorna null se inválida. */
export function decodeTicket(raw: string): TicketPayload | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const p = data as Record<string, unknown>;

  if (p.v !== TICKET_VERSION || !isStr(p.id) || !(isStr(p.t) || typeof p.t === "number")) return null;

  const c = p.c as Record<string, unknown> | undefined;
  if (!c || !isStr(c.id) || !isStr(c.n) || c.n.trim() === "") return null;

  if (!Array.isArray(p.i) || p.i.length === 0) return null;
  const itensValidos = p.i.every((it: unknown) => {
    if (!it || typeof it !== "object") return false;
    const item = it as Record<string, unknown>;
    if (!isStr(item.id) || !Number.isInteger(item.q) || (item.q as number) < 1) return false;
    if (item.o !== undefined && !isStr(item.o)) return false;
    if (item.m !== undefined) {
      if (!Array.isArray(item.m)) return false;
      if (!item.m.every((mod) => Array.isArray(mod) && mod.length === 2 && isStr(mod[0]) && isStr(mod[1]))) {
        return false;
      }
    }
    return true;
  });
  if (!itensValidos) return null;

  return data as TicketPayload;
}

/** Converte os modificadores do ticket de volta ao formato da comanda. */
export function ticketModsToComanda(m?: TicketModificador[]): ItemComanda["modificadores"] {
  return m?.map(([grupo, opcao]) => ({ grupo, opcao }));
}
