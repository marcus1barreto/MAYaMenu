"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { AlertTriangle, Home, Lock, LogOut, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  EMAILS_SUPERADMIN_AUTORIZADOS,
  sincronizarCookieSessao,
} from "@/lib/superadmin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UseSuperAdminOperadorAuthOptions {
  onLoginSuccess?: () => void;
  onLogoutSuccess?: () => void;
}

export interface SuperAdminOperadorAuthState {
  usuarioAuth: User | null;
  ehSuperAdmin: boolean;
  isSuperAdminAutorizado: boolean;
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  loginSenha: string;
  setLoginSenha: (senha: string) => void;
  autenticando: boolean;
  erroAuth: string | null;
  setErroAuth: (erro: string | null) => void;
  handleLoginOperador: (e: React.FormEvent) => Promise<void>;
  handleLogoutOperador: () => Promise<void>;
}

/**
 * Gerencia autenticação Firebase Auth, claims e sincronização do cookie __session
 * para as rotas protegidas do SuperAdmin (/superadmin, /hq e sub-rotas).
 */
export function useSuperAdminOperadorAuth(
  options: UseSuperAdminOperadorAuthOptions = {}
): SuperAdminOperadorAuthState {
  const { onLoginSuccess, onLogoutSuccess } = options;

  const [usuarioAuth, setUsuarioAuth] = useState<User | null>(null);
  const [claimSuperAdmin, setClaimSuperAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);
  const [erroAuth, setErroAuth] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setUsuarioAuth(user);
      if (user && !user.isAnonymous) {
        try {
          const tokenRes = await user.getIdTokenResult();
          setClaimSuperAdmin(tokenRes.claims?.superadmin === true);
          sincronizarCookieSessao(tokenRes.token);
        } catch (e) {
          setClaimSuperAdmin(false);
          console.warn("Aviso ao sincronizar token no superadmin:", e);
        }
      } else {
        setClaimSuperAdmin(false);
        sincronizarCookieSessao(null);
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const emailAtual = usuarioAuth?.email?.toLowerCase() || "";
  const ehSuperAdmin = Boolean(
    usuarioAuth &&
      !usuarioAuth.isAnonymous &&
      (EMAILS_SUPERADMIN_AUTORIZADOS.includes(emailAtual) || claimSuperAdmin)
  );

  const devE2eBypass =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    window.location.search.includes("e2e=true");

  const isSuperAdminAutorizado = Boolean(ehSuperAdmin || devE2eBypass);

  const handleLoginOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutenticando(true);
    setErroAuth(null);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginSenha);
      setLoginSenha("");
      onLoginSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha na autenticação.";
      setErroAuth(msg);
    } finally {
      setAutenticando(false);
    }
  };

  const handleLogoutOperador = async () => {
    try {
      sincronizarCookieSessao(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("mayamenu_mock_auth");
      }
      setClaimSuperAdmin(false);
      await signOut(auth);
      setUsuarioAuth(null);
      onLogoutSuccess?.();
    } catch (err) {
      console.error("Erro ao desconectar:", err);
    }
  };

  return {
    usuarioAuth,
    ehSuperAdmin,
    isSuperAdminAutorizado,
    loginEmail,
    setLoginEmail,
    loginSenha,
    setLoginSenha,
    autenticando,
    erroAuth,
    setErroAuth,
    handleLoginOperador,
    handleLogoutOperador,
  };
}

interface SuperAdminAcessoBloqueadoProps {
  authState: SuperAdminOperadorAuthState;
  subtitulo?: string;
}

/**
 * Tela de login de operador ou aviso de conta sem privilégio de SuperAdmin.
 */
export function SuperAdminAcessoBloqueado({
  authState,
  subtitulo = "Identifique-se com sua conta de operador para acessar a Gerência Geral.",
}: SuperAdminAcessoBloqueadoProps) {
  const {
    usuarioAuth,
    loginEmail,
    setLoginEmail,
    loginSenha,
    setLoginSenha,
    autenticando,
    erroAuth,
    handleLoginOperador,
    handleLogoutOperador,
  } = authState;

  if (!usuarioAuth || usuarioAuth.isAnonymous) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-3.5 sm:p-4 selection:bg-rose-600 selection:text-white">
        <div className="max-w-md w-full p-5 sm:p-8 bg-white border border-neutral-200/80 rounded-3xl shadow-xl text-neutral-900 space-y-5 sm:space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
              MAYaRAnas • SuperAdmin
            </h2>
            <p className="text-sm sm:text-xs text-neutral-500 leading-relaxed">
              {subtitulo}
            </p>
          </div>

          {erroAuth && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">{erroAuth}</span>
            </div>
          )}

          <form onSubmit={handleLoginOperador} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                E-mail do Operador
              </label>
              <Input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@mayamenu.com ou marcus1fialho@gmail.com"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 rounded-xl h-11 text-base sm:text-sm focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                Senha
              </label>
              <Input
                type="password"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 rounded-xl h-11 text-base sm:text-sm focus:bg-white"
              />
            </div>

            <Button
              type="submit"
              disabled={autenticando}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold h-11 rounded-xl text-sm sm:text-xs uppercase tracking-wider shadow-md shadow-rose-600/20"
            >
              {autenticando ? "Autenticando..." : "Entrar como Operador"}
            </Button>
          </form>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-2 border-t border-neutral-100">
            <Link href="/admin">
              <Button
                type="button"
                variant="ghost"
                className="text-xs sm:text-sm text-neutral-600 hover:text-neutral-950 h-9"
              >
                Login de Restaurantes
              </Button>
            </Link>
            <Link href="/">
              <Button
                type="button"
                variant="ghost"
                className="text-xs sm:text-sm text-neutral-600 hover:text-neutral-950 h-9 flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Voltar ao Início</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-3.5 sm:p-4 selection:bg-rose-600 selection:text-white">
      <div className="max-w-md w-full p-5 sm:p-8 bg-white border border-rose-200/80 rounded-3xl shadow-xl shadow-rose-900/5 text-center space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-sm">
          <Lock className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-950 tracking-tight">
            Acesso Restrito
          </h2>
          <p className="text-sm text-neutral-600 mt-2 leading-relaxed break-words">
            Sua conta atual (
            <strong className="text-neutral-900 font-semibold break-all">
              {usuarioAuth?.email || "Desconhecida"}
            </strong>
            ) não possui privilégios de Operador SuperAdmin.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs sm:text-sm text-neutral-600 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-neutral-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Controle de Acesso MAYaRAnas</span>
          </div>
          <p className="leading-relaxed">
            Para acessar o painel de Gerência Geral, entre com um dos e-mails autorizados (ex: admin@mayamenu.com ou marcus1fialho@gmail.com).
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            type="button"
            onClick={handleLogoutOperador}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-11 rounded-2xl text-sm shadow-md transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2 shrink-0" />
            Sair e Entrar com Conta de Operador
          </Button>

          <Link href="/admin">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs sm:text-sm text-neutral-500 hover:text-neutral-900 h-10 rounded-xl"
            >
              Voltar para o Painel do Restaurante
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
