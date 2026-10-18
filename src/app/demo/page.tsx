"use client";

import { useState } from "react";
import Link from "next/link";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";
import { MenuView } from "@/components/cliente/menu-view";
import { CartProvider } from "@/context/cart-context";
import { AuthProvider } from "@/context/auth-context";
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
  RotateCcw,
  ExternalLink,
} from "lucide-react";

export default function DemoSandboxPage() {
  const [visao, setVisao] = useState<"cliente" | "cozinha" | "garcom">("cliente");
  const [mesaDemo, setMesaDemo] = useState<number>(12);
  const [sandboxKey, setSandboxKey] = useState<number>(0);
  const [modoCenario, setModoCenario] = useState<"limpo" | "demo">("limpo");
  const [resetando, setResetando] = useState<boolean>(false);

  const resetarParaLimpo = () => {
    setResetando(true);
    try {
      localStorage.removeItem("mayamenu_cart_demo");
      localStorage.removeItem("mayamenu_historico_visitas");
    } catch {
      // Ignora erro de storage
    }
    setModoCenario("limpo");
    setTimeout(() => {
      setSandboxKey((prev) => prev + 1);
      setResetando(false);
    }, 200);
  };

  const carregarCenarioDemo = () => {
    setResetando(true);
    setModoCenario("demo");
    setTimeout(() => {
      setSandboxKey((prev) => prev + 1);
      setResetando(false);
    }, 200);
  };

  return (
    <AuthProvider>
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

            <Button
              variant="outline"
              size="sm"
              onClick={resetarParaLimpo}
              disabled={resetando}
              className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white text-xs h-8 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
              title="Deixa o KDS e as Mesas 100% vazios para você simular pedidos do zero"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${resetando ? "animate-spin" : ""}`} />
              <span>Zerar Sandbox</span>
            </Button>

            {modoCenario === "limpo" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={carregarCenarioDemo}
                disabled={resetando}
                className="bg-rose-950/40 border-rose-800/50 text-rose-300 hover:text-white hover:bg-rose-900/50 text-xs h-8 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
                title="Preenche o KDS e o radar de mesas com pedidos simulados para demonstração imediata"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>Carregar Cenário Demo</span>
              </Button>
            ) : (
              <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] hidden sm:inline-flex py-1 px-2 font-semibold">
                Cenário Demo Ativo
              </Badge>
            )}

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
        <div key={sandboxKey} className="flex-1">
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
                dadosIniciais={modoCenario === "demo" ? PEDIDOS_INICIAIS_KDS : []}
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
                dadosIniciais={
                  modoCenario === "demo"
                    ? MESAS_INICIAIS
                    : Array.from({ length: 8 }, (_, i) => ({
                        numero: i + 1,
                        status: "livre" as const,
                        comandas: [],
                      }))
                }
              />
            </div>
          )}
        </div>
      </div>
    </AuthProvider>
  );
}
