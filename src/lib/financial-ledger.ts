import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TipoMovimentacaoFinanceira =
  | "pagamento_total"
  | "pagamento_parcial"
  | "estorno"
  | "kill_perda";

export interface RegistrarMovimentacaoInput {
  restauranteId: string;
  idempotencyKey: string;
  sessaoMesaId: string;
  mesa: number;
  tipo: TipoMovimentacaoFinanceira;
  valorCentavos: number;
  metodoPagamento?: string;
  operadorUid: string;
  motivo?: string;
}

export interface MovimentacaoResult {
  ok: true;
  idempotente: boolean;
  movimentacaoId: string;
}

/**
 * Converte reais (float) para centavos inteiros com arredondamento seguro,
 * evitando erros de ponto flutuante em cálculos financeiros.
 */
export function paraCentavos(valorReais: number): number {
  if (!Number.isFinite(valorReais) || valorReais < 0) return 0;
  return Math.round(valorReais * 100);
}

/**
 * Gera uma chave de idempotência única para operações financeiras.
 */
export function gerarIdempotencyKey(prefixo = "mov"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefixo}_${crypto.randomUUID()}`;
  }
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Registra uma movimentação financeira imutável (append-only) no livro-razão do restaurante.
 * Usa `idempotencyKey` como ID do documento dentro de `runTransaction` para impedir
 * cobranças ou baixas duplicadas em caso de clique duplo ou oscilação de rede.
 */
export async function registrarMovimentacaoFinanceira(
  input: RegistrarMovimentacaoInput
): Promise<MovimentacaoResult> {
  const valorInt = Math.round(input.valorCentavos);
  if (!input.restauranteId || !input.idempotencyKey || !input.sessaoMesaId) {
    throw new Error("Dados obrigatórios ausentes para registro financeiro.");
  }
  if (!Number.isInteger(valorInt) || valorInt < 0) {
    throw new Error("Valor financeiro inválido (deve ser inteiro em centavos >= 0).");
  }

  const movRef = doc(
    db,
    "restaurantes",
    input.restauranteId,
    "movimentacoes_caixa",
    input.idempotencyKey
  );

  const entraNoFaturamento =
    input.tipo === "pagamento_total" || input.tipo === "pagamento_parcial";

  let jaExistia = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(movRef);
    if (snap.exists()) {
      jaExistia = true;
      return;
    }

    tx.set(movRef, {
      idempotencyKey: input.idempotencyKey,
      sessaoMesaId: input.sessaoMesaId,
      mesa: input.mesa,
      tipo: input.tipo,
      valorCentavos: valorInt,
      entraNoFaturamento,
      metodoPagamento: input.metodoPagamento || null,
      operadorUid: input.operadorUid,
      motivo: input.motivo || null,
      criadoEm: serverTimestamp(),
    });
  });

  return {
    ok: true,
    idempotente: jaExistia,
    movimentacaoId: input.idempotencyKey,
  };
}

/**
 * Calcula o resumo financeiro de uma sessão de mesa em centavos inteiros.
 */
export function calcularResumoSessao(
  totalConsumidoCentavos: number,
  movimentacoes: Array<{ tipo: TipoMovimentacaoFinanceira; valorCentavos: number }>
) {
  let totalPagoCentavos = 0;
  let totalEstornadoCentavos = 0;
  let totalKillPerdaCentavos = 0;

  for (const mov of movimentacoes) {
    const val = Math.max(0, Math.round(mov.valorCentavos || 0));
    if (mov.tipo === "pagamento_total" || mov.tipo === "pagamento_parcial") {
      totalPagoCentavos += val;
    } else if (mov.tipo === "estorno") {
      totalEstornadoCentavos += val;
    } else if (mov.tipo === "kill_perda") {
      totalKillPerdaCentavos += val;
    }
  }

  const pagoLiquidoCentavos = Math.max(0, totalPagoCentavos - totalEstornadoCentavos);
  const saldoRestanteCentavos = Math.max(0, totalConsumidoCentavos - pagoLiquidoCentavos);

  return {
    totalConsumidoCentavos,
    totalPagoCentavos: pagoLiquidoCentavos,
    totalKillPerdaCentavos,
    saldoRestanteCentavos,
    quitada: totalConsumidoCentavos > 0 && saldoRestanteCentavos === 0,
  };
}
