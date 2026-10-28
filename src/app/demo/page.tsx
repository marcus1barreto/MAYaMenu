"use client";

import { useState, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import {
  Sparkles,
  Smartphone,
  ChefHat,
  Users,
  ArrowLeft,
  RotateCcw,
  Store,
  QrCode,
  Check,
  Copy,
  ArrowRight,
  Info,
} from "lucide-react";

export default function DemoSandboxPage() {
  const [visao, setVisao] = useState<"cliente" | "cozinha" | "garcom">("cliente");
  const [mesaDemo, setMesaDemo] = useState<number>(12);
  const [sandboxKey, setSandboxKey] = useState<number>(0);
  const [modoCenario, setModoCenario] = useState<"limpo" | "demo">("demo");
  const [resetando, setResetando] = useState<boolean>(false);
  const [modalQrAberto, setModalQrAberto] = useState<boolean>(false);
  const [copiadoLink, setCopiadoLink] = useState<boolean>(false);
  const [urlOrigem, setUrlOrigem] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrlOrigem(window.location.origin);
    }
  }, []);

  const urlMesaCelular = `${urlOrigem}/demo?mesa=${mesaDemo}`;

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

  const copiarLinkCelular = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(urlMesaCelular);
      setCopiadoLink(true);
      setTimeout(() => setCopiadoLink(false), 2500);
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-rose-600 selection:text-white">
        {/* BARRA SUPERIOR DO RESTAURANTE MODELO (SHOWROOM GOURMET iFOOD STYLE) */}
        <header className="bg-white/95 border-b border-border px-3 sm:px-6 py-2.5 sm:py-3 sticky top-0 z-50 backdrop-blur-md shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* IDENTIFICAÇÃO DO RESTAURANTE MODELO */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-red-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm sm:text-base text-neutral-950 tracking-tight">
                      {RESTAURANTE_DEMO.nome}
                    </span>
                    <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wider py-0 px-2 h-5">
                      Restaurante Modelo
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground hidden sm:block">
                    Showroom aberto para visitação. Simule pedidos à vontade sem gerar cobranças reais.
                  </p>
                </div>
              </Link>
            </div>

            {/* SELETOR DE VISÕES (CLIENTE / COZINHA / GARÇOM) */}
            <div className="flex items-center justify-center">
              <div className="flex bg-muted/80 p-1 rounded-2xl border border-border shadow-xs text-xs font-bold w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setVisao("cliente")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    visao === "cliente"
                      ? "bg-white text-rose-700 shadow-xs border border-border/80 font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-rose-600" />
                  <span>Mesa {mesaDemo} (Cliente)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisao("cozinha")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    visao === "cozinha"
                      ? "bg-white text-rose-700 shadow-xs border border-border/80 font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5 text-rose-600" />
                  <span>KDS Cozinha</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisao("garcom")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    visao === "garcom"
                      ? "bg-white text-rose-700 shadow-xs border border-border/80 font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-rose-600" />
                  <span>Radar Garçom</span>
                </button>
              </div>
            </div>

            {/* FERRAMENTAS DO SHOWROOM E CONVERSÃO */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalQrAberto(true)}
                className="h-8 px-2.5 text-xs font-bold rounded-xl border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 shadow-xs flex items-center gap-1.5"
                title="Aponte o celular e teste a mesa 12 na palma da mão"
              >
                <QrCode className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Degustar no Celular</span>
                <span className="sm:hidden">No Celular</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={modoCenario === "limpo" ? carregarCenarioDemo : resetarParaLimpo}
                disabled={resetando}
                className="h-8 px-2.5 text-xs font-semibold rounded-xl border-border bg-white text-neutral-700 hover:bg-muted shadow-xs flex items-center gap-1.5"
                title={
                  modoCenario === "limpo"
                    ? "Preencher com comandas e pedidos fictícios"
                    : "Zerar comandas para simular do zero"
                }
              >
                <RotateCcw className={`w-3.5 h-3.5 text-neutral-500 ${resetando ? "animate-spin" : ""}`} />
                <span>{modoCenario === "limpo" ? "Carregar Cenário" : "Zerar Teste"}</span>
              </Button>

              <Link href="/admin">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1"
                >
                  <span>Criar Grátis</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>

              <Link href="/">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground rounded-xl"
                  title="Voltar para a página inicial"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* BANNER INFORMATIVO CONTEXTUAL CONFORME A VISÃO */}
        <div className="bg-rose-50/40 border-b border-rose-100 px-4 py-2 text-xs text-neutral-700">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {visao === "cliente" && (
                  <>
                    <strong>Visão do Cliente na Mesa {mesaDemo}:</strong> Navegue pelo cardápio, adicione opções personalizadas e experimente fazer um pedido de teste sem medo.
                  </>
                )}
                {visao === "cozinha" && (
                  <>
                    <strong>Visão KDS Cozinha (Mundo 3):</strong> Veja como os pratos pedidos na mesa caem instantaneamente na tela da cozinha com tempos e cronômetros de preparo.
                  </>
                )}
                {visao === "garcom" && (
                  <>
                    <strong>Visão Radar do Garçom:</strong> Acompanhe as mesas ativas, comandas abertas e solicitações de atendimento sem papel nem confusão.
                  </>
                )}
              </span>
            </div>
            <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider shrink-0 hidden md:inline">
              Ambiente Autônomo Seguro
            </span>
          </div>
        </div>

        {/* CONTEÚDO DINÂMICO CONFORME A VISÃO SELECIONADA */}
        <div key={sandboxKey} className="flex-1 bg-background">
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
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
              <KdsView
                restauranteId="rest-demo-alpha"
                nomeRestaurante={RESTAURANTE_DEMO.nome}
                isSandbox={true}
                dadosIniciais={modoCenario === "demo" ? PEDIDOS_INICIAIS_KDS : []}
              />
            </div>
          )}

          {visao === "garcom" && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
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

        {/* MODAL: EXPERIMENTE NO CELULAR (QR CODE DA MESA MODELO) */}
        <Dialog open={modalQrAberto} onOpenChange={setModalQrAberto}>
          <DialogContent className="max-w-sm bg-card border-border text-foreground rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <DialogHeader className="space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs mb-1">
                <QrCode className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg font-black text-foreground">
                Deguste na Palma da Mão
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Aponte a câmera do seu celular para o QR Code abaixo. Você abrirá instantaneamente o cardápio PWA da <strong>Mesa {mesaDemo}</strong>.
              </DialogDescription>
            </DialogHeader>

            {/* QR CODE RENDERIZADO */}
            <div className="p-4 bg-white rounded-2xl border border-neutral-200 inline-block mx-auto shadow-xs">
              <QRCodeSVG
                value={urlMesaCelular}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-muted/50 border border-border text-left text-[11px] font-mono text-muted-foreground truncate">
                {urlMesaCelular}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={copiarLinkCelular}
                  className="flex-1 rounded-xl text-xs font-bold h-9 border-border"
                >
                  {copiadoLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                      Link Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      Copiar Link
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => setModalQrAberto(false)}
                  className="rounded-xl text-xs font-bold h-9 bg-rose-600 hover:bg-rose-700 text-white px-4"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthProvider>
  );
}
