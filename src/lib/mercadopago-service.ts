// src/lib/mercadopago-service.ts
// Integração oficial com a API do Mercado Pago para Assinaturas e Planos do MAYaMenu

import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";

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

/**
 * Cria uma preferência de pagamento no Mercado Pago via Checkout Pro
 */
export async function criarPreferenciaMercadoPago(params: {
  restauranteId: string;
  planoId: "pro_mensal" | "pro_semestral";
  userEmail: string;
  userName?: string;
  baseUrl: string;
}): Promise<{
  sucesso: boolean;
  initPoint?: string;
  sandboxInitPoint?: string;
  preferenceId?: string;
  mensagem?: string;
  modoDemo?: boolean;
}> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  const plano = PLANOS_PRO_MAYAMENU[params.planoId];

  if (!plano) {
    return { sucesso: false, mensagem: "Plano selecionado inválido." };
  }

  // Se o token ainda não tiver sido preenchido no .env.local
  if (!token) {
    console.warn("MERCADO_PAGO_ACCESS_TOKEN não configurado no .env.local.");
    return {
      sucesso: false,
      modoDemo: true,
      mensagem: "Token do Mercado Pago não configurado. Adicione MERCADO_PAGO_ACCESS_TOKEN no arquivo .env.local para processar pagamentos reais.",
    };
  }

  const payload = {
    items: [
      {
        id: plano.id,
        title: plano.titulo,
        description: plano.descricao,
        quantity: 1,
        currency_id: "BRL",
        unit_price: plano.preco,
      },
    ],
    payer: {
      email: params.userEmail || "lojista@mayamenu.com.br",
      name: params.userName || "Lojista MAYaMenu",
    },
    external_reference: `${params.restauranteId}:${plano.id}`,
    back_urls: {
      success: `${params.baseUrl}/admin?status_pagamento=sucesso&plano=${plano.id}&rest=${params.restauranteId}`,
      failure: `${params.baseUrl}/admin?status_pagamento=falha&plano=${plano.id}`,
      pending: `${params.baseUrl}/admin?status_pagamento=pendente&plano=${plano.id}`,
    },
    auto_return: "approved",
    statement_descriptor: "MAYAMENU PRO",
    payment_methods: {
      installments: 12,
    },
    notification_url: `${params.baseUrl}/api/pagamentos/mercadopago/webhook`,
  };

  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const erroBody = await res.text();
      console.error("Erro na API do Mercado Pago ao criar preferência:", erroBody);
      return { sucesso: false, mensagem: `Falha no Mercado Pago: ${res.statusText}` };
    }

    const data = await res.json();
    return {
      sucesso: true,
      preferenceId: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    };
  } catch (err: any) {
    console.error("Exceção ao chamar Mercado Pago:", err);
    return { sucesso: false, mensagem: err?.message || "Erro de conexão com o Mercado Pago." };
  }
}

/**
 * Consulta o status detalhado de um pagamento no Mercado Pago
 */
export async function consultarPagamentoMercadoPago(paymentId: string | number): Promise<any | null> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn("Consulta de pagamento falhou:", res.statusText);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("Erro ao consultar pagamento no Mercado Pago:", err);
    return null;
  }
}

/**
 * Ativa ou estende a assinatura do Plano PRO no Firestore após confirmação de pagamento
 */
export async function ativarPlanoProPorPagamento(params: {
  restauranteId: string;
  planoId: "pro_mensal" | "pro_semestral";
  paymentId?: string | number;
  metodoPagamento?: string;
  valorPago?: number;
}): Promise<{ sucesso: boolean; mensagem?: string; novaDataExpiracao?: string }> {
  const plano = PLANOS_PRO_MAYAMENU[params.planoId] || PLANOS_PRO_MAYAMENU.pro_mensal;

  try {
    const restRef = doc(db, "restaurantes", params.restauranteId);
    const snap = await getDoc(restRef);

    if (!snap.exists()) {
      return { sucesso: false, mensagem: "Restaurante não encontrado no banco de dados." };
    }

    const dadosRest = snap.data() as any;
    const agora = new Date();
    let dataBase = agora;

    // Se o restaurante já tinha assinatura ou patrocínio ativo no futuro, soma o tempo
    if (dadosRest.assinatura?.dataExpiracao) {
      const expAtual = new Date(dadosRest.assinatura.dataExpiracao);
      if (!isNaN(expAtual.getTime()) && expAtual > agora) {
        dataBase = expAtual;
      }
    } else if (dadosRest.patrocinio?.dataExpiracao) {
      const expPat = new Date(dadosRest.patrocinio.dataExpiracao);
      if (!isNaN(expPat.getTime()) && expPat > agora) {
        dataBase = expPat;
      }
    }

    const novaDataExpiracao = new Date(dataBase);
    novaDataExpiracao.setMonth(novaDataExpiracao.getMonth() + plano.mesesValidade);

    const payloadAssinatura = {
      ativa: true,
      provedor: "mercadopago" as const,
      planoId: plano.id,
      planoTitulo: plano.titulo,
      apelido: plano.titulo,
      versao: "1.0.0",
      valorPago: params.valorPago || plano.preco,
      valorContratado: params.valorPago || plano.preco,
      paymentId: params.paymentId ? String(params.paymentId) : "confirmacao_manual",
      metodoPagamento: params.metodoPagamento || "checkout_pro",
      mesesAdicionados: plano.mesesValidade,
      atualizadoEm: new Date().toISOString(),
      contratadoEm: new Date().toISOString(),
      dataExpiracao: novaDataExpiracao.toISOString(),
      limites: {
        maxMesas: 30,
        maxItensMenu: 60,
        modulosPermitidos: ["cardapio", "mesas", "kds", "garcom", "analytics", "historico"],
      },
      garantiaAcordo: "inalteravel" as const,
      status: "ativa" as const,
    };

    await updateDoc(restRef, {
      plano: "pro",
      maxMesas: 30,
      maxPratos: 60,
      maxItensMenu: 60,
      assinatura: payloadAssinatura,
      "configuracoes.suspenso": false,
    });

    return {
      sucesso: true,
      novaDataExpiracao: novaDataExpiracao.toISOString(),
    };
  } catch (err: any) {
    console.error("Erro ao ativar Plano PRO por pagamento:", err);
    return { sucesso: false, mensagem: err?.message || "Falha ao atualizar plano do restaurante." };
  }
}

