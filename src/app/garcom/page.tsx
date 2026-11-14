"use client";

import { useState } from "react";
import Link from "next/link";
import { moduloAtivo } from "@/lib/modules";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { GarcomView } from "@/components/garcom/garcom-view";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { PinLockGuard } from "@/components/salao/pin-lock-guard";
import { EstabelecimentoSuspensoView } from "@/components/admin/estabelecimento-suspenso-view";
import { TemaUsuarioProvider } from "@/context/tema-context";
import { Button } from "@/components/ui/button";
import { KeyRound, Shield } from "lucide-react";

function GarcomPageContent() {
  const { user, restaurante, role, carregando } = useAuth();
  const [usarLoginAdmin, setUsarLoginAdmin] = useState(false);

  if (!moduloAtivo("mod.garcom_salao")) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm text-center space-y-4">
          <h1 className="text-lg font-black text-neutral-900">
            Módulo Garçom disponível em breve
          </h1>
          <p className="text-sm text-neutral-600">
            Na versão atual de pré-lançamento, o atendimento é operado diretamente pela Cozinha e pelo Painel Administrativo.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              Ir para o Admin
            </Link>
            <Link
              href="/cozinha"
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-bold"
            >
              Ir para a Cozinha
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white font-black text-lg animate-pulse shadow-md shadow-rose-600/20">
            M
          </div>
          <div className="text-xs font-bold tracking-wider uppercase text-neutral-400">
            Carregando Terminal do Garçom...
          </div>
        </div>
      </div>
    );
  }

  // Se o usuário optar explicitamente pelo login tradicional de e-mail/senha
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
    <TemaUsuarioProvider scope="garcom" fallbackTemaRestaurante={restaurante?.configuracoes?.tema}>
      <PinLockGuard
        role="garcom"
        restauranteId={restaurante?.id}
        slug={restaurante?.slug}
      >
        <GarcomView
          restauranteId={restaurante?.id}
          slug={restaurante?.slug}
          nomeRestaurante={restaurante?.nome || "MAYaMenu"}
        />
      </PinLockGuard>
    </TemaUsuarioProvider>
  );
}

export default function GarcomPage() {
  return (
    <AuthProvider>
      <GarcomPageContent />
    </AuthProvider>
  );
}
