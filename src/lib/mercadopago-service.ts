// Wrappers cliente para as Cloud Functions de pagamento.
// Nenhum Access Token do Mercado Pago ou escrita financeira é executada no navegador.

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface PlanoPreco {
  id: "pro_mensal" | "pro_semestral";
  titulo: string;
  descricao: string;
  preco: number;
  mesesValidade: number;
  popular?: boolean;
}

export const PLANOS_PRO_MAYAMENU: Record<string, PlanoPreco> = {
  pro_mensal: {
    id: "pro_mensal",
    titulo: "MAYaMenu PRO - Mensal",
    descricao: "Assinatura mensal com todos os recursos PRO liberados (Preço Promocional de Lançamento).",
    preco: 49.90,
    mesesValidade: 1,
    popular: true,
  },
  pro_semestral: {
    id: "pro_semestral",
    titulo: "MAYaMenu PRO - Semestral (6 Meses)",
    descricao: "6 meses de licença PRO com desconto especial (economize mais de R$ 50).",
    preco: 249.00,
    mesesValidade: 6,
  },
};

export interface PreferenciaMercadoPagoResult {
  sucesso: boolean;
  attemptId?: string;
  preferenceId?: string;
  initPoint?: string;
  sandboxInitPoint?: string | null;
}

export interface ConfirmacaoPagamentoProResult {
  sucesso: boolean;
  status: string;
  idempotente?: boolean;
  novaDataExpiracao?: string;
}

export async function criarPreferenciaMercadoPago(params: {
  restauranteId: string;
  planoId: "pro_mensal" | "pro_semestral";
}): Promise<PreferenciaMercadoPagoResult> {
  const callable = httpsCallable<
    { restauranteId: string; planoId: "pro_mensal" | "pro_semestral" },
    PreferenciaMercadoPagoResult
  >(functions, "criarPreferenciaProBackend");
  const result = await callable(params);
  return result.data;
}

export async function confirmarPagamentoProBackend(params: {
  attemptId: string;
  paymentId?: string;
}): Promise<ConfirmacaoPagamentoProResult> {
  const callable = httpsCallable<
    { attemptId: string; paymentId?: string },
    ConfirmacaoPagamentoProResult
  >(functions, "confirmarPagamentoProBackend");
  const result = await callable(params);
  return result.data;
}
