"use client";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { EstabelecimentoSuspensoView } from "@/components/admin/estabelecimento-suspenso-view";
import { TemaUsuarioProvider } from "@/context/tema-context";

function AdminPageContent() {
  const { user, restaurante, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
          Carregando Painel Administrativo...
        </div>
      </div>
    );
  }

  // Se o usuário não estiver logado ou estiver anônimo (cliente), exibe formulário de acesso
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
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
      <AdminPageContent />
    </AuthProvider>
  );
}
