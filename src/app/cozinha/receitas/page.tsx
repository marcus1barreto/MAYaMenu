"use client";

import { Suspense, useState } from "react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { EstabelecimentoSuspensoView } from "@/components/admin/estabelecimento-suspenso-view";
import { QrAcessoSetorGate } from "@/components/auth/qr-acesso-setor-gate";
import { ReceitasChefView } from "@/components/cozinha/receitas-chef-view";
import { PinLockGuard } from "@/components/salao/pin-lock-guard";
import { Button } from "@/components/ui/button";
import { TemaUsuarioProvider } from "@/context/tema-context";

function ReceitasChefPageContent() {
  const { user, restaurante, role, carregando } = useAuth();
  const [usarLoginAdmin, setUsarLoginAdmin] = useState(false);

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-black text-lg animate-pulse shadow-md">
            C
          </div>
          <div className="text-xs font-bold tracking-wider uppercase text-neutral-400">
            Carregando Espaço do Chef...
          </div>
        </div>
      </div>
    );
  }

  if (usarLoginAdmin && (!user || user.isAnonymous)) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
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

  if (restaurante && (restaurante.suspenso || restaurante.configuracoes?.suspenso)) {
    return <EstabelecimentoSuspensoView restaurante={restaurante} />;
  }

  const isGestor = Boolean(role === "owner" || role === "superadmin");

  const livroElement = (
    <ReceitasChefView
      restauranteId={restaurante?.id || ""}
      nomeRestaurante={restaurante?.nome || "MAYaMenu"}
      isGestor={isGestor}
    />
  );

  const permitirProprietarioDireto = Boolean(
    user &&
      !user.isAnonymous &&
      (role === "owner" || role === "superadmin") &&
      restaurante
  );

  return (
    <TemaUsuarioProvider scope="cozinha" fallbackTemaRestaurante={restaurante?.configuracoes?.tema}>
      {permitirProprietarioDireto ? (
        livroElement
      ) : (
        <PinLockGuard
          role="cozinha"
          restauranteId={restaurante?.id}
          slug={restaurante?.slug}
        >
          {livroElement}
        </PinLockGuard>
      )}
    </TemaUsuarioProvider>
  );
}

export default function CozinhaReceitasPage() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <QrAcessoSetorGate setor="cozinha">
          <ReceitasChefPageContent />
        </QrAcessoSetorGate>
      </Suspense>
    </AuthProvider>
  );
}
