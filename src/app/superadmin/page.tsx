import { Suspense } from "react";
import type { Metadata } from "next";
import { SuperAdminView } from "@/components/admin/superadmin-view";

export const metadata: Metadata = {
  title: "Gerência Geral MAYaRAnas | SuperAdmin",
  description: "Central de Emissão de Licenças, Concessões e Estabelecimentos",
};

export default function SuperAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
          <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
            Carregando Painel SuperAdmin...
          </div>
        </div>
      }
    >
      <SuperAdminView />
    </Suspense>
  );
}
