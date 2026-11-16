import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { avaliarTokenSessaoSuperadmin } from "@/lib/superadmin-auth";

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
    const avaliacao = avaliarTokenSessaoSuperadmin(sessionCookie);

    if (!avaliacao.autorizado) {
      // Redireciona ao fluxo seguro de login/troca de conta em /admin em vez de travar em 404 sem saída
      const loginUrl = new URL("/admin", request.url);
      loginUrl.searchParams.set("redirect", path);
      if (avaliacao.motivo === "conta_sem_permissao") {
        loginUrl.searchParams.set("motivo", "conta_sem_permissao");
      }
      return NextResponse.redirect(loginUrl);
    }

    // Operador autorizado. Deixa passar.
    return NextResponse.next();
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
