"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { KdsView } from "@/components/admin/kds-view";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { PinLockGuard } from "@/components/salao/pin-lock-guard";
import { EstabelecimentoSuspensoView } from "@/components/admin/estabelecimento-suspenso-view";
import { TemaUsuarioProvider } from "@/context/tema-context";
import { Button } from "@/components/ui/button";

function CozinhaPageContent() {
  const { user, restaurante, role, carregando } = useAuth();
  const [usarLoginAdmin, setUsarLoginAdmin] = useState(false);

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-black text-lg animate-pulse shadow-md shadow-amber-500/20">
            K
          </div>
          <div className="text-xs font-bold tracking-wider uppercase text-neutral-400">
            Carregando KDS da Cozinha...
          </div>
        </div>
      </div>
    );
  }

  // Se o usuário optar explicitamente pelo login de e-mail/senha
  if (usarLoginAdmin && (!user || user.isAnonymous)) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
        <div className="mb-6 text-center text-neutral-500 max-w-sm text-xs">
          Identifique-se com sua conta de acesso do restaurante.
        </div>
        <AdminLoginForm />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setUsarLoginAdmin(false)}
          className="mt-4 text-xs text-neutral-500 hover:text-neutral-900"
        >
          Voltar para Acesso por PIN / Crachá
        </Button>
      </div>
    );
  }

  // Guard de Suspensão de Estabelecimento em Tempo Real
  if (restaurante && (restaurante.suspenso || restaurante.configuracoes?.suspenso)) {
    return <EstabelecimentoSuspensoView restaurante={restaurante} />;
  }

  return (
    <TemaUsuarioProvider scope="cozinha" fallbackTemaRestaurante={restaurante?.configuracoes?.tema}>
      <PinLockGuard
        role="cozinha"
        restauranteId={restaurante?.id}
        slug={restaurante?.slug}
      >
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
