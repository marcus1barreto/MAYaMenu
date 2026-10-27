"use client";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { KdsView } from "@/components/admin/kds-view";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

import { PinLockGuard } from "@/components/salao/pin-lock-guard";
import { EstabelecimentoSuspensoView } from "@/components/admin/estabelecimento-suspenso-view";
import { TemaUsuarioProvider } from "@/context/tema-context";

function CozinhaPageContent() {
  const { user, restaurante, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
          Carregando KDS da Cozinha...
        </div>
      </div>
    );
  }

  // Na versão Alpha: Garçom, Cozinha e Painel usam o login do dono
  // Se não estiver logado, exibe tela de login para liberar a tela da cozinha
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="mb-6 text-center text-neutral-400 max-w-sm text-xs">
          Identifique-se com a conta do restaurante para iniciar a visualização do KDS da Cozinha.
        </div>
        <AdminLoginForm />
      </div>
    );
  }

  // Guard de Suspensão de Estabelecimento em Tempo Real
  if (restaurante && (restaurante.suspenso || restaurante.configuracoes?.suspenso)) {
    return <EstabelecimentoSuspensoView restaurante={restaurante} />;
  }

  return (
    <TemaUsuarioProvider scope="cozinha" fallbackTemaRestaurante={restaurante?.configuracoes?.tema}>
      <PinLockGuard role="cozinha">
        <KdsView
          restauranteId={restaurante?.id}
          slug={restaurante?.slug}
          nomeRestaurante={restaurante?.nome || "MAYaMenu"}
          modoFilaKds={restaurante?.configuracoes?.modoFilaKds || "sequencial"}
        />
      </PinLockGuard>
    </TemaUsuarioProvider>
  );
}

export default function CozinhaPage() {
  return (
    <AuthProvider>
      <CozinhaPageContent />
    </AuthProvider>
  );
}
