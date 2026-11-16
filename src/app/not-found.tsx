import Link from "next/link";
import { ArrowLeft, Home, LayoutDashboard, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-7 sm:p-8 shadow-xl text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-black text-xl">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-neutral-950">
            Página não encontrada
          </h1>
          <p className="text-sm text-neutral-600 leading-relaxed">
            O endereço acessado não está disponível ou exige uma sessão autorizada diferente da atual.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <Link
            href="/"
            className="w-full h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Voltar para o Início</span>
          </Link>

          <Link
            href="/admin"
            className="w-full h-11 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4 text-neutral-600" />
            <span>Painel do Restaurante</span>
          </Link>

          <Link
            href="/precos"
            className="w-full h-10 rounded-xl text-xs font-bold text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span>Ver Planos e Falar com Especialista</span>
            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
}
