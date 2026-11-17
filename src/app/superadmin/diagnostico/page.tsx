import { Suspense } from "react";
import type { Metadata } from "next";
import { SuperadminDiagnosticoView } from "@/components/admin/superadmin-diagnostico";
import { TemaUsuarioProvider } from "@/context/tema-context";

export const metadata: Metadata = {
  title: "Diagnóstico & Saneamento | SuperAdmin HQ",
  description: "Auditoria de Mesas, Comandas e Ledger por Estabelecimento MAYaMenu",
};

export default function SuperAdminDiagnosticoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
            Carregando Diagnóstico SuperAdmin...
          </div>
        </div>
      }
    >
      <TemaUsuarioProvider scope="superadmin">
        <SuperadminDiagnosticoView />
      </TemaUsuarioProvider>
    </Suspense>
  );
}
