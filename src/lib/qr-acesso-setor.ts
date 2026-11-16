"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import type { SetorQrAcesso } from "@/types";

export interface CredencialQrSetorExtraida {
  token: string;
  restauranteId: string | null;
}

export interface ResultadoLoginQrSetor {
  sucesso: boolean;
  restauranteId: string;
  slug: string;
  setor: SetorQrAcesso;
  role: "owner" | "garcom" | "cozinha";
}

// Deduplica chamadas simultâneas (ex: StrictMode em dev) para o mesmo QR lido da URL.
const promessasLoginQrEmCurso = new Map<string, Promise<ResultadoLoginQrSetor>>();

function getCacheKeyQrSetor(restauranteId: string, setor: SetorQrAcesso): string {
  return `mayamenu_qr_setor_cache_${restauranteId}_${setor}`;
}

export function salvarTokenQrSetorCache(
  restauranteId: string,
  setor: SetorQrAcesso,
  token: string,
  versao: number
) {
  if (typeof window === "undefined" || !restauranteId || !token) return;
  try {
    sessionStorage.setItem(
      getCacheKeyQrSetor(restauranteId, setor),
      JSON.stringify({ token, versao })
    );
  } catch {
    // Ignora falha de storage
  }
}

export function lerTokenQrSetorCache(
  restauranteId: string,
  setor: SetorQrAcesso,
  versaoEsperada?: number
): string | null {
  if (typeof window === "undefined" || !restauranteId) return null;
  try {
    const raw = sessionStorage.getItem(getCacheKeyQrSetor(restauranteId, setor));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; versao?: number };
    if (!parsed?.token) return null;
    if (typeof versaoEsperada === "number" && parsed.versao !== versaoEsperada) {
      sessionStorage.removeItem(getCacheKeyQrSetor(restauranteId, setor));
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function limparTokenQrSetorCache(restauranteId: string, setor: SetorQrAcesso) {
  if (typeof window === "undefined" || !restauranteId) return;
  try {
    sessionStorage.removeItem(getCacheKeyQrSetor(restauranteId, setor));
  } catch {
    // Ignora
  }
}

export function montarUrlQrAcessoSetor(
  origin: string,
  setor: SetorQrAcesso,
  restauranteId: string,
  token: string
): string {
  const base = origin.replace(/\/+$/, "");
  const rota = setor === "cozinha" ? "/cozinha" : setor === "garcom" ? "/garcom" : "/admin";
  // Credencial vai exclusivamente no fragmento `#acesso=` para nunca trafegar em logs HTTP/Referer.
  return `${base}${rota}?r=${encodeURIComponent(restauranteId)}#acesso=${encodeURIComponent(token)}`;
}

export function extrairEConsumirCredencialQrSetorDaUrl(
  fallbackRestauranteId?: string | null
): CredencialQrSetorExtraida | null {
  if (typeof window === "undefined") return null;

  try {
    const urlAtual = new URL(window.location.href);
    const rawHash = urlAtual.hash.startsWith("#") ? urlAtual.hash.slice(1) : urlAtual.hash;
    const hashParams = new URLSearchParams(rawHash);
    const token = (hashParams.get("acesso") || "").trim();

    if (!token || token.length < 16) {
      return null;
    }

    const rFromHash = (hashParams.get("r") || "").trim();
    const rFromQuery = (
      urlAtual.searchParams.get("r") ||
      urlAtual.searchParams.get("restaurante") ||
      urlAtual.searchParams.get("rest") ||
      ""
    ).trim();

    const restauranteId =
      rFromHash || rFromQuery || (fallbackRestauranteId ? fallbackRestauranteId.trim() : "") || null;

    // Remove o token secreto do fragmento da barra de endereços imediatamente após leitura.
    hashParams.delete("acesso");
    const restanteHash = hashParams.toString();
    urlAtual.hash = restanteHash ? `#${restanteHash}` : "";
    window.history.replaceState(null, "", urlAtual.pathname + urlAtual.search + urlAtual.hash);

    return { token, restauranteId };
  } catch {
    return null;
  }
}

export async function autenticarComQrSetor(
  setor: SetorQrAcesso,
  restauranteId: string,
  token: string
): Promise<ResultadoLoginQrSetor> {
  const chaveDedupe = `${setor}:${restauranteId}:${token}`;
  const emCurso = promessasLoginQrEmCurso.get(chaveDedupe);
  if (emCurso) return emCurso;

  const execucao = (async (): Promise<ResultadoLoginQrSetor> => {
    const loginFn = httpsCallable(functions, "loginComQrSetor");
    const res = await loginFn({ restauranteId, setor, token });
    const data = (res.data || {}) as {
      sucesso?: boolean;
      token?: string;
      restauranteId?: string;
      slug?: string;
      setor?: SetorQrAcesso;
      role?: "owner" | "garcom" | "cozinha";
    };

    if (!data.token || !data.restauranteId || data.setor !== setor) {
      throw new Error("Resposta inválida ao autenticar QR Code do setor.");
    }

    const cred = await signInWithCustomToken(auth, data.token);
    await cred.user.getIdToken(true);

    if (setor === "cozinha" || setor === "garcom") {
      try {
        sessionStorage.setItem(`mayamenu_pin_unlocked_${setor}_${data.restauranteId}`, "true");
        sessionStorage.setItem(
          `mayamenu_colaborador_${setor}_${data.restauranteId}`,
          JSON.stringify({
            uid: cred.user.uid,
            nome: setor === "cozinha" ? "Equipe Cozinha (QR)" : "Equipe Salão (QR)",
            role: setor,
            fotoUrl: null,
          })
        );
      } catch {
        // Ignora falha de storage
      }
    }

    return {
      sucesso: true,
      restauranteId: data.restauranteId,
      slug: data.slug || data.restauranteId,
      setor,
      role: data.role || (setor === "admin" ? "owner" : setor),
    };
  })();

  promessasLoginQrEmCurso.set(chaveDedupe, execucao);
  try {
    return await execucao;
  } finally {
    setTimeout(() => {
      promessasLoginQrEmCurso.delete(chaveDedupe);
    }, 5000);
  }
}

export function useAutoLoginQrSetor(
  setor: SetorQrAcesso,
  habilitado: boolean = true,
  fallbackRestauranteId?: string | null
) {
  const [autenticandoQr, setAutenticandoQr] = useState(false);
  const [restauranteQrAutenticado, setRestauranteQrAutenticado] = useState<string | null>(null);
  const [erroQr, setErroQr] = useState<string | null>(null);
  const credencialPendenteRef = useRef<{ restauranteId: string; token: string } | null>(null);

  useEffect(() => {
    if (!habilitado) return;

    let pendente = credencialPendenteRef.current;
    if (!pendente) {
      const extraido = extrairEConsumirCredencialQrSetorDaUrl(fallbackRestauranteId);
      if (!extraido) return;
      if (!extraido.restauranteId) {
        setErroQr("Link de QR Code incompleto: identificador do restaurante ausente.");
        return;
      }
      pendente = { restauranteId: extraido.restauranteId, token: extraido.token };
      credencialPendenteRef.current = pendente;
    }

    let ativo = true;
    setAutenticandoQr(true);
    setErroQr(null);

    autenticarComQrSetor(setor, pendente.restauranteId, pendente.token)
      .then((res) => {
        if (!ativo) return;
        credencialPendenteRef.current = null;
        setRestauranteQrAutenticado(res.restauranteId);
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        credencialPendenteRef.current = null;
        setRestauranteQrAutenticado(null);
        const raw = err instanceof Error ? err.message : "";
        if (raw.includes("bloqueado temporariamente")) {
          setErroQr(raw);
        } else {
          setErroQr("Este QR Code de acesso está expirado, foi regenerado ou desativado pelo estabelecimento.");
        }
      })
      .finally(() => {
        if (ativo) setAutenticandoQr(false);
      });

    return () => {
      ativo = false;
    };
  }, [habilitado, setor, fallbackRestauranteId]);

  return {
    autenticandoQr,
    restauranteQrAutenticado,
    erroQr,
    limparErroQr: () => {
      credencialPendenteRef.current = null;
      setRestauranteQrAutenticado(null);
      setErroQr(null);
    },
    concluirHandoffQr: () => {
      setRestauranteQrAutenticado(null);
    },
  };
}
