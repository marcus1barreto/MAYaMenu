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
    // Em desenvolvimento local (HTTP/localhost), o navegador não envia cookies com flag 'secure',
    // delegando o controle de acesso ao portão de ferro estrito do componente React.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }

    const sessionCookie = request.cookies.get("__session")?.value;

    if (!sessionCookie) {
      // Sem token de sessão? Redireciona suavemente para o login no admin com destino salvo
      const loginUrl = new URL("/admin", request.url);
      loginUrl.searchParams.set("redirect", path);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // 2. Decodifica o payload do JWT (A segunda parte do base64)
      const payloadBase64 = sessionCookie.split(".")[1];
      if (!payloadBase64) {
        const loginUrl = new URL("/admin", request.url);
        loginUrl.searchParams.set("redirect", path);
        return NextResponse.redirect(loginUrl);
      }
      const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf8");
      const decodedToken = JSON.parse(decodedJson);

      const email = typeof decodedToken.email === "string" ? decodedToken.email.toLowerCase() : "";
      const ehEmailAutorizado = EMAILS_SUPERADMIN_AUTORIZADOS.includes(email);
      const temClaimSuperadmin = decodedToken.superadmin === true;

      // 3. A Checagem da Chave Mestra (claim ou email na whitelist oficial)
      if (!temClaimSuperadmin && !ehEmailAutorizado) {
        // Usuário autenticado comum (ex: gerente de restaurante que tenta bisbilhotar o SuperAdmin)
        // Bloqueia com 404 silencioso estrito
        return NextResponse.rewrite(new URL("/404", request.url));
      }

      // 4. Operador autorizado. Deixa passar.
      return NextResponse.next();
    } catch {
      // Qualquer erro de formatação de token redireciona para login seguro
      const loginUrl = new URL("/admin", request.url);
      loginUrl.searchParams.set("redirect", path);
      return NextResponse.redirect(loginUrl);
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
