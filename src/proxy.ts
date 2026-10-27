import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // 1. Intercepta apenas o que tentar acessar o painel HQ
  if (request.nextUrl.pathname.startsWith("/hq")) {
    const sessionCookie = request.cookies.get("__session")?.value;

    if (!sessionCookie) {
      // Sem token? Joga silenciosamente para a página 404 nativa do Next
      return NextResponse.rewrite(new URL("/404", request.url));
    }

    try {
      // 2. Decodifica o payload do JWT (A segunda parte do base64)
      // Executado no servidor sem sobrecarga de bibliotecas pesadas de admin
      const payloadBase64 = sessionCookie.split(".")[1];
      if (!payloadBase64) {
        return NextResponse.rewrite(new URL("/404", request.url));
      }
      const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf8");
      const decodedToken = JSON.parse(decodedJson);

      // 3. A Checagem da Chave Mestra
      if (decodedToken.superadmin !== true) {
        // Tem token, mas é um cliente ou dono de restaurante comum
        return NextResponse.rewrite(new URL("/404", request.url));
      }

      // 4. É o Marcus (SuperAdmin com Custom Claim ativa). Deixa passar.
      return NextResponse.next();
    } catch {
      // Qualquer erro de formatação finge que a rota não existe
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }

  return NextResponse.next();
}

// Exportações retrocompatíveis para convenções Proxy e Middleware
export { proxy as middleware };
export default proxy;

export const config = {
  // Aplica o proxy/middleware na raiz do painel HQ e sub-rotas
  matcher: ["/hq/:path*"],
};
