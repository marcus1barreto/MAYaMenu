// src/app/api/pagamentos/mercadopago/criar-preferencia/route.ts
import { NextRequest, NextResponse } from "next/server";
import { criarPreferenciaMercadoPago } from "@/lib/mercadopago-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restauranteId, planoId, userEmail, userName } = body;

    if (!restauranteId || !planoId) {
      return NextResponse.json(
        { erro: "Parâmetros obrigatórios ausentes (restauranteId, planoId)." },
        { status: 400 }
      );
    }

    // Identifica a URL base dinamicamente (ex: https://mayamenu.com.br ou localhost)
    const origin = req.headers.get("origin") || req.nextUrl.origin || "https://mayamenu.com.br";

    const resPreferencia = await criarPreferenciaMercadoPago({
      restauranteId,
      planoId,
      userEmail,
      userName,
      baseUrl: origin,
    });

    if (!resPreferencia.sucesso) {
      return NextResponse.json(
        {
          erro: resPreferencia.mensagem || "Não foi possível gerar a preferência de pagamento.",
          modoDemo: resPreferencia.modoDemo,
        },
        { status: resPreferencia.modoDemo ? 200 : 500 }
      );
    }

    return NextResponse.json({
      sucesso: true,
      preferenceId: resPreferencia.preferenceId,
      initPoint: resPreferencia.initPoint,
      sandboxInitPoint: resPreferencia.sandboxInitPoint,
    });
  } catch (err: any) {
    console.error("Erro na rota criar-preferencia:", err);
    return NextResponse.json(
      { erro: err?.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

