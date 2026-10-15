import Link from "next/link";
import Image from "next/image";
import { ArrowRight, QrCode, Sparkles, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between selection:bg-rose-500 selection:text-white">
      {/* HEADER HERO */}
      <div className="relative overflow-hidden pt-16 pb-20 px-6 sm:px-12 flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
        {/* Glow de fundo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-semibold text-rose-300 mb-6 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Versão Alpha • MAYaRAnas Sistemas</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight max-w-2xl">
          MAYaMenu
        </h1>
        <p className="text-lg sm:text-xl text-neutral-400 mt-4 max-w-xl font-normal leading-relaxed">
          Cardápio Digital PWA de alta performance e pedidos na mesa sem atrito. O menos é mais.
        </p>

        {/* BOTÃO PRINCIPAL DE ACESSO AO CARDÁPIO DEMO */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <Link href="/demo" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-14 px-8 text-base font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-2xl shadow-xl shadow-rose-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Experimentar Sandbox Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* PILARES DA FILOSOFIA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 text-left w-full">
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <Smartphone className="w-6 h-6 text-rose-400 mb-3" />
            <h3 className="font-bold text-sm text-neutral-200">Zero Instalação</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              O cliente escaneia o QR Code físico na mesa e o PWA abre no navegador instantaneamente.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <QrCode className="w-6 h-6 text-rose-400 mb-3" />
            <h3 className="font-bold text-sm text-neutral-200">Offline-First</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Gera comprovante e Ticket Digital por QR Code mesmo se a internet do salão cair.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <ShieldCheck className="w-6 h-6 text-rose-400 mb-3" />
            <h3 className="font-bold text-sm text-neutral-200">Anti-Concorrência</h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Comandas individuais isoladas por cliente na mesa para fechamento e rateio sem atrito.
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="py-6 px-6 border-t border-neutral-900 text-center text-xs text-neutral-600">
        © MAYaRAnas Sistemas • MAYaMenu Alpha
      </footer>
    </main>
  );
}
