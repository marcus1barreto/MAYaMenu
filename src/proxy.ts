import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const EMAILS_SUPERADMIN_AUTORIZADOS = [
  "admin@mayamenu.com",
  "teste@teste.com",
  "marcus1fialho@gmail.com",
];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Intercepta tanto /hq quanto /superadmin (e sub-rotas)
  if (path.startsWith("/hq") || path.startsWith("/superadmin")) {
    const sessionCookie = request.cookies.get("__session")?.value;

    if (!sessionCookie) {
      // Sem token de sessão? Joga silenciosamente para a página 404 nativa do Next
      return NextResponse.rewrite(new URL("/404", request.url));
    }

    try {
      // 2. Decodifica o payload do JWT (A segunda parte do base64)
      const payloadBase64 = sessionCookie.split(".")[1];
      if (!payloadBase64) {
        return NextResponse.rewrite(new URL("/404", request.url));
      }
      const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf8");
      const decodedToken = JSON.parse(decodedJson);

      const email = typeof decodedToken.email === "string" ? decodedToken.email.toLowerCase() : "";
      const ehEmailAutorizado = EMAILS_SUPERADMIN_AUTORIZADOS.includes(email);
      const temClaimSuperadmin = decodedToken.superadmin === true;

      // 3. A Checagem da Chave Mestra (claim ou email na whitelist oficial)
      if (!temClaimSuperadmin && !ehEmailAutorizado) {
        // Usuário autenticado comum (ex: gerente de restaurante ou cliente)
        return NextResponse.rewrite(new URL("/404", request.url));
      }

      // 4. Operador autorizado. Deixa passar.
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
  // Aplica o proxy/middleware na raiz do painel HQ, SuperAdmin e sub-rotas
  matcher: ["/hq/:path*", "/superadmin/:path*"],
};
