// src/app/api/pagamentos/mercadopago/confirmar-retorno/route.ts
import { NextRequest, NextResponse } from "next/server";
import { consultarPagamentoMercadoPago, ativarPlanoProPorPagamento } from "@/lib/mercadopago-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restauranteId, planoId, paymentId } = body;

    if (!restauranteId || !planoId) {
      return NextResponse.json({ erro: "Parâmetros inválidos." }, { status: 400 });
    }

    // Se houver um paymentId do retorno, consulta no Mercado Pago
    let valorPago: number | undefined;
    let metodo: string | undefined;

    if (paymentId) {
      const dados = await consultarPagamentoMercadoPago(paymentId);
      if (dados && dados.status !== "approved") {
        return NextResponse.json({ erro: "Pagamento ainda não aprovado pelo Mercado Pago." }, { status: 400 });
      }
      if (dados) {
        valorPago = dados.transaction_amount;
        metodo = dados.payment_type_id;
      }
    }

    const res = await ativarPlanoProPorPagamento({
      restauranteId,
      planoId: planoId as "pro_mensal" | "pro_semestral",
      paymentId,
      metodoPagamento: metodo,
      valorPago,
    });

    if (!res.sucesso) {
      return NextResponse.json({ erro: res.mensagem || "Erro ao ativar." }, { status: 500 });
    }

    return NextResponse.json({ sucesso: true, novaDataExpiracao: res.novaDataExpiracao });
  } catch (err: any) {
    return NextResponse.json({ erro: err?.message || "Erro no servidor." }, { status: 500 });
  }
}

