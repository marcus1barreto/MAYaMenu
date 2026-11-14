"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { EstabelecimentoSuspensoView } from "@/components/admin/estabelecimento-suspenso-view";
import { TemaUsuarioProvider } from "@/context/tema-context";

function AdminPageContent() {
  const { user, restaurante, carregando, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");

  // Se o usuário logou e havia um redirecionamento pendente (ex: /superadmin), encaminha automaticamente
  useEffect(() => {
    if (user && !user.isAnonymous && redirectTarget && redirectTarget.startsWith("/")) {
      router.push(redirectTarget);
    }
  }, [user, redirectTarget, router]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white font-black text-lg animate-pulse shadow-md shadow-rose-600/20">
            M
          </div>
          <div className="text-xs font-bold tracking-wider uppercase text-neutral-400">
            Carregando Painel Administrativo...
          </div>
        </div>
      </div>
    );
  }

  // Se o usuário não estiver logado ou estiver anônimo (cliente), exibe formulário de acesso
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 relative overflow-hidden selection:bg-rose-600 selection:text-white">
        {/* Glows de ambientação suave */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-rose-600/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />
        <AdminLoginForm />
      </div>
    );
  }

  // Se o usuário estiver logado com PIN de colaborador (/garcom ou /cozinha), orienta troca limpa de sessão
  if (user.uid.startsWith("pin_")) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xl">
            !
          </div>
          <h1 className="text-lg font-black text-neutral-900">
            Sessão de equipe ativa neste navegador
          </h1>
          <p className="text-sm text-neutral-600">
            Você está conectado com um PIN de colaborador (Garçom/Cozinha). Para acessar o Painel Administrativo sem conflito de permissões, entre com o e-mail e senha do Proprietário.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors"
          >
            Sair do perfil de equipe e entrar como Proprietário
          </button>
        </div>
      </div>
    );
  }

  // Guard de Suspensão de Estabelecimento em Tempo Real
  if (restaurante && (restaurante.suspenso || restaurante.configuracoes?.suspenso)) {
    return <EstabelecimentoSuspensoView restaurante={restaurante} />;
  }

  return (
    <TemaUsuarioProvider scope="admin" fallbackTemaRestaurante={restaurante?.configuracoes?.tema}>
      <AdminDashboard />
    </TemaUsuarioProvider>
  );
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-900">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white font-black text-lg animate-pulse shadow-md">
              M
            </div>
            <div className="text-xs font-bold tracking-wider uppercase text-neutral-500">
              Carregando Painel...
            </div>
          </div>
        </div>
      }>
        <AdminPageContent />
      </Suspense>
    </AuthProvider>
  );
}
