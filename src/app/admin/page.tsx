"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { EstabelecimentoSuspensoView } from "@/components/admin/estabelecimento-suspenso-view";
import { TemaUsuarioProvider } from "@/context/tema-context";

function AdminPageContent() {
  const { user, restaurante, carregando } = useAuth();
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
          <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white font-black text-lg animate-pulse shadow-md">
            M
          </div>
          <div className="text-xs font-bold tracking-wider uppercase text-neutral-500">
            Carregando Painel Administrativo...
          </div>
        </div>
      </div>
    );
  }

  // Se o usuário não estiver logado ou estiver anônimo (cliente), exibe formulário de acesso
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-neutral-50/70 flex items-center justify-center p-4">
        <AdminLoginForm />
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
