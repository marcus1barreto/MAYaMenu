import type { Metadata } from "next";
import { SuperAdminView } from "@/components/admin/superadmin-view";

export const metadata: Metadata = {
  title: "Gerência Geral MAYaRAnas | SuperAdmin",
  description: "Central de Emissão de Licenças, Concessões e Estabelecimentos",
};

export default function SuperAdminPage() {
  return <SuperAdminView />;
}
