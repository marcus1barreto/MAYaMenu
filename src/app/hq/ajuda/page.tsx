import { Suspense } from "react";
import type { Metadata } from "next";
import { SuperAdminHelpView } from "@/components/admin/superadmin-help-view";
import { TemaUsuarioProvider } from "@/context/tema-context";

export const metadata: Metadata = {
  title: "Manual Executivo & Operações | SuperAdmin HQ",
  description: "Guia Oficial de Governança, Licenças, Quotas e Auditoria MAYaMenu",
};

export default function HQHelpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
            Carregando Manual Executivo...
          </div>
        </div>
      }
    >
      <TemaUsuarioProvider scope="superadmin">
        <SuperAdminHelpView />
      </TemaUsuarioProvider>
    </Suspense>
  );
}
