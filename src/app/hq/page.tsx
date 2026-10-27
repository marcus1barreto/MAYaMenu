import { Suspense } from "react";
import type { Metadata } from "next";
import { SuperAdminView } from "@/components/admin/superadmin-view";
import { TemaUsuarioProvider } from "@/context/tema-context";

export const metadata: Metadata = {
  title: "Gerência Geral MAYaRAnas | SuperAdmin HQ",
  description: "Central Executiva de Licenças, Concessões e Estabelecimentos",
};

export default function HQPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
            Carregando Painel HQ...
          </div>
        </div>
      }
    >
      <TemaUsuarioProvider scope="superadmin">
        <SuperAdminView />
      </TemaUsuarioProvider>
    </Suspense>
  );
}
