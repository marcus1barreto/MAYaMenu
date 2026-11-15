import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Vendas temporariamente desativadas nesta versão 100% gratuita." },
    { status: 410 }
  );
}
