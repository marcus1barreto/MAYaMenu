import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export const metadata = {
  title: "Planos & Preços | MAYaMenu",
  description: "Conheça os planos Free e PRO do MAYaMenu, com foco em mesas e cardápio sem limite de itens.",
};

export default function PrecosPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-600 hover:text-neutral-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Início</span>
          </Link>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
          >
            Acessar Painel
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Planos & Preços Transparentes</span>
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-950">
            Cresça no ritmo do seu salão
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 max-w-2xl mx-auto">
            Sem limite de itens no cardápio. Comece grátis com 5 mesas ou amplie sua operação com mesas extras a R$ 8,00/mês por mesa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-700">Plano Free</div>
              <div className="text-4xl font-black text-neutral-950">Grátis</div>
              <p className="text-sm text-neutral-600">
                Ideal para começar a digitalizar seu atendimento sem custos fixos.
              </p>
              <ul className="space-y-2.5 text-sm text-neutral-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Até 5 mesas (+ extras por R$ 8,00/mês/mesa)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cardápio sem limite de itens</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>QR Code dinâmico, KDS Cozinha e Pix direto</span>
                </li>
              </ul>
            </div>
            <Link
              href="/admin"
              className="w-full py-3 px-5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-900 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>Começar Grátis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="rounded-3xl border-2 border-rose-500 bg-white p-8 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-black uppercase tracking-wider text-rose-600">Plano PRO</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-neutral-950">R$ 49,90</span>
                <span className="text-sm text-neutral-500">/mês (ou R$ 249/semestre)</span>
              </div>
              <p className="text-sm text-neutral-600">
                Para salões em crescimento com equipe, garçons e relatórios completos.
              </p>
              <ul className="space-y-2.5 text-sm text-neutral-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Até 20 mesas (+ extras por R$ 8,00/mês/mesa)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cardápio sem limite de itens</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Módulo Garçom, Taxa de Serviço e Analytics completo</span>
                </li>
              </ul>
            </div>
            <Link
              href="/admin"
              className="w-full py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>Contratar no Painel Admin</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
