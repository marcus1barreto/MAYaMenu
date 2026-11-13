import { NextResponse } from "next/server";

// Endpoint legado desativado: pagamentos agora são criados/confirmados exclusivamente
// pelas Cloud Functions autenticadas e pelo webhook Mercado Pago com assinatura HMAC.
export async function POST() {
  return NextResponse.json(
    {
      sucesso: false,
      erro: "Endpoint legado desativado. Utilize a integração segura do backend.",
    },
    { status: 410 }
  );
}
