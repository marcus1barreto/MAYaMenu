"use client";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { GarcomView } from "@/components/garcom/garcom-view";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

import { PinLockGuard } from "@/components/salao/pin-lock-guard";

function GarcomPageContent() {
  const { user, restaurante, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
          Carregando Terminal do Garçom...
        </div>
      </div>
    );
  }

  // Alpha: garçom utiliza a mesma conta do dono
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="mb-6 text-center text-neutral-400 max-w-sm text-xs">
          Identifique-se com a conta do restaurante para acessar o mapa de mesas do garçom.
        </div>
        <AdminLoginForm />
      </div>
    );
  }

  return (
    <PinLockGuard role="garcom">
      <GarcomView
        restauranteId={restaurante?.id}
        slug={restaurante?.slug}
        nomeRestaurante={restaurante?.nome || "MAYaMenu"}
      />
    </PinLockGuard>
  );
}

export default function GarcomPage() {
  return (
    <AuthProvider>
      <GarcomPageContent />
    </AuthProvider>
  );
}
