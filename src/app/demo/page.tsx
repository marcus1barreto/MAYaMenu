"use client";

import { useState } from "react";
import Link from "next/link";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";
import { MenuView } from "@/components/cliente/menu-view";
import { CartProvider } from "@/context/cart-context";
import { KdsView, PEDIDOS_INICIAIS_KDS } from "@/components/admin/kds-view";
import { GarcomView, MESAS_INICIAIS } from "@/components/garcom/garcom-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Smartphone,
  ChefHat,
  Users,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

export default function DemoSandboxPage() {
  const [visao, setVisao] = useState<"cliente" | "cozinha" | "garcom">("cliente");
  const [mesaDemo, setMesaDemo] = useState<number>(12);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* BARRA SUPERIOR DE AVISO DA SANDBOX */}
      <header className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
            Sandbox Isolada
          </Badge>
          <span className="text-xs text-neutral-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 inline" />
            Ambiente de demonstração autônomo com dados simulados
          </span>
        </div>

        {/* CONTROLES DE VISÃO DA DEMONSTRAÇÃO */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-neutral-900 border border-neutral-800 rounded-xl text-xs">
            <button
              onClick={() => setVisao("cliente")}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                visao === "cliente"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mesa {mesaDemo}
            </button>
            <button
              onClick={() => setVisao("cozinha")}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                visao === "cozinha"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              KDS Cozinha
            </button>
            <button
              onClick={() => setVisao("garcom")}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                visao === "garcom"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Garçom
            </button>
          </div>

          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white text-xs h-8 rounded-xl"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      {/* CONTEÚDO DINÂMICO CONFORME A VISÃO SELECIONADA */}
      <div className="flex-1">
        {visao === "cliente" && (
          <CartProvider slug="demo" mesaInicial={mesaDemo}>
            <MenuView
              restaurante={RESTAURANTE_DEMO}
              cardapio={CARDAPIO_DEMO}
              numeroMesa={mesaDemo}
            />
          </CartProvider>
        )}

        {visao === "cozinha" && (
          <div className="p-4 md:p-6">
            <KdsView
              restauranteId="rest-demo-alpha"
              nomeRestaurante={RESTAURANTE_DEMO.nome}
              isSandbox={true}
            />
          </div>
        )}

        {visao === "garcom" && (
          <div className="p-4 md:p-6">
            <GarcomView
              restauranteId="rest-demo-alpha"
              slug="demo"
              nomeRestaurante={RESTAURANTE_DEMO.nome}
              isSandbox={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
