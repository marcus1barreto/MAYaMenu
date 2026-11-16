// Fonte única para e-mails autorizados do SuperAdmin / HQ
export const EMAILS_SUPERADMIN_AUTORIZADOS: readonly string[] = [
  "admin@mayamenu.com",
  "marcus1fialho@gmail.com",
];

export function isEmailSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return EMAILS_SUPERADMIN_AUTORIZADOS.includes(email.trim().toLowerCase());
}

export function isSafeInternalRedirect(target?: string | null): target is string {
  if (!target) return false;
  return target.startsWith("/") && !target.startsWith("//");
}

export function isPrivilegedSuperadminPath(target?: string | null): boolean {
  if (!isSafeInternalRedirect(target)) return false;
  return target.startsWith("/superadmin") || target.startsWith("/hq");
}

function decodificarBase64UrlUtf8(segmento: string): string {
  const normalizado = segmento.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalizado.length % 4)) % 4;
  const padded = normalizado + "=".repeat(padding);

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface ResultadoSessaoSuperadminProxy {
  autorizado: boolean;
  motivo:
    | "autorizado"
    | "sem_cookie"
    | "token_invalido"
    | "token_expirado"
    | "anonimo"
    | "conta_sem_permissao";
  email?: string;
}

export function avaliarTokenSessaoSuperadmin(
  sessionCookie?: string | null,
  nowMs: number = Date.now()
): ResultadoSessaoSuperadminProxy {
  if (!sessionCookie || typeof sessionCookie !== "string") {
    return { autorizado: false, motivo: "sem_cookie" };
  }

  const partes = sessionCookie.split(".");
  if (partes.length < 2 || !partes[1]) {
    return { autorizado: false, motivo: "token_invalido" };
  }

  try {
    const decodedJson = decodificarBase64UrlUtf8(partes[1]);
    const decodedToken = JSON.parse(decodedJson) as {
      email?: unknown;
      superadmin?: unknown;
      exp?: unknown;
      firebase?: { sign_in_provider?: unknown };
    };

    if (typeof decodedToken.exp === "number" && decodedToken.exp * 1000 <= nowMs) {
      return { autorizado: false, motivo: "token_expirado" };
    }

    const temClaimSuperadmin = decodedToken.superadmin === true;
    const email = typeof decodedToken.email === "string" ? decodedToken.email.trim().toLowerCase() : "";
    const ehAnonimo =
      decodedToken.firebase?.sign_in_provider === "anonymous" ||
      (!email && !temClaimSuperadmin);

    if (ehAnonimo) {
      return { autorizado: false, motivo: "anonimo" };
    }

    if (temClaimSuperadmin || isEmailSuperAdmin(email)) {
      return { autorizado: true, motivo: "autorizado", email };
    }

    return { autorizado: false, motivo: "conta_sem_permissao", email };
  } catch {
    return { autorizado: false, motivo: "token_invalido" };
  }
}

export function sincronizarCookieSessao(token: string | null): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (token) {
    const isHttps = window.location.protocol === "https:";
    document.cookie = `__session=${token}; path=/; ${isHttps ? "secure;" : ""} samesite=lax; max-age=3600`;
    return;
  }
  document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}
