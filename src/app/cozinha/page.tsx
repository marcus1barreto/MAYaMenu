"use client";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { KdsView } from "@/components/admin/kds-view";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

import { PinLockGuard } from "@/components/salao/pin-lock-guard";
import { resolverClasseTemaRestaurante } from "@/lib/tema";

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

  const classeTema = resolverClasseTemaRestaurante(restaurante);

  return (
    <div className={`min-h-screen ${classeTema} bg-background text-foreground transition-colors duration-200`}>
      <PinLockGuard role="cozinha">
        <KdsView
          restauranteId={restaurante?.id}
          slug={restaurante?.slug}
          nomeRestaurante={restaurante?.nome || "MAYaMenu"}
          modoFilaKds={restaurante?.configuracoes?.modoFilaKds || "sequencial"}
        />
      </PinLockGuard>
    </div>
  );
}

export default function CozinhaPage() {
  return (
    <AuthProvider>
      <CozinhaPageContent />
    </AuthProvider>
  );
}
