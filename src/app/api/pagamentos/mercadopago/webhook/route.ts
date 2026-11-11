// src/app/api/pagamentos/mercadopago/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { consultarPagamentoMercadoPago, ativarPlanoProPorPagamento } from "@/lib/mercadopago-service";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let paymentId: string | number | null = url.searchParams.get("data.id") || url.searchParams.get("id");

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      // Body vazio ou formulário
    }

    if (body?.data?.id) {
      paymentId = body.data.id;
    }

    if (!paymentId) {
      // Apenas confirma recebimento se for ping de teste
      return NextResponse.json({ status: "ignored_no_payment_id" }, { status: 200 });
    }

    // Consulta os detalhes seguros diretamente na API oficial do Mercado Pago
    const dadosPagamento = await consultarPagamentoMercadoPago(paymentId);
    if (!dadosPagamento) {
      return NextResponse.json({ status: "payment_not_found" }, { status: 200 });
    }

    // Verifica se o pagamento foi devidamente aprovado
    if (dadosPagamento.status === "approved") {
      const extRef = dadosPagamento.external_reference; // formato "restauranteId:planoId"
      if (extRef && extRef.includes(":")) {
        const [restauranteId, planoId] = extRef.split(":");
        await ativarPlanoProPorPagamento({
          restauranteId,
          planoId: planoId as "pro_mensal" | "pro_semestral",
          paymentId,
          metodoPagamento: dadosPagamento.payment_type_id || "mercadopago",
          valorPago: dadosPagamento.transaction_amount,
        });
        console.log(`[MercadoPago Webhook] Restaurante ${restauranteId} ativado com sucesso para o plano ${planoId}.`);
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (err: any) {
    console.error("[MercadoPago Webhook Error]:", err);
    return NextResponse.json({ status: "error", mensagem: err?.message }, { status: 200 });
  }
}

