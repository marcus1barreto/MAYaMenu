"use client";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

function AdminPageContent() {
  const { user, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <div className="text-sm font-semibold tracking-wider uppercase animate-pulse">
          Carregando Painel Administrativo...
        </div>
      </div>
    );
  }

  // Se o usuário não estiver logado ou estiver anônimo (cliente), exibe formulário de acesso
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <AdminLoginForm />
      </div>
    );
  }

  return <AdminDashboard />;
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminPageContent />
    </AuthProvider>
  );
}
