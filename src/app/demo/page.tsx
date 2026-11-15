"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";
import { MenuView } from "@/components/cliente/menu-view";
import { CartProvider } from "@/context/cart-context";
import { AuthProvider } from "@/context/auth-context";
import { DemoAdminMesas, type DemoMesa } from "@/components/demo/demo-admin-mesas";
import { DemoKds } from "@/components/demo/demo-kds";
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

const criarMesasIniciais = (cenario: "demo" | "limpo"): DemoMesa[] => {
  if (cenario === "limpo") {
    return Array.from({ length: 5 }, (_, i) => ({
      numero: i + 1,
      status: "livre",
      chamadoAtivo: false,
      paga: false,
      itens: [],
    }));
  }
  return [
    {
      numero: 1,
      status: "ocupada",
      chamadoAtivo: false,
      paga: false,
      itens: [
        { id: "m1-1", nome: "Picanha na Chapa", quantidade: 1, preco: 89.9, status: "servido" },
        { id: "m1-2", nome: "Suco Natural de Laranja", quantidade: 2, preco: 12.0, status: "servido" },
      ],
    },
    {
      numero: 2,
      status: "ocupada",
      chamadoAtivo: false,
      paga: false,
      itens: [
        { id: "m2-1", nome: "Hambúrguer Artesanal", quantidade: 2, preco: 38.0, status: "pendente" },
        { id: "m2-2", nome: "Batata Rústica", quantidade: 1, preco: 24.0, status: "preparando" },
      ],
    },
    {
      numero: 3,
      status: "ocupada",
      chamadoAtivo: true,
      paga: false,
      itens: [
        { id: "m3-1", nome: "Espetinho Misto", quantidade: 3, preco: 18.0, status: "servido" },
      ],
    },
    { numero: 4, status: "livre", chamadoAtivo: false, paga: false, itens: [] },
    { numero: 5, status: "livre", chamadoAtivo: false, paga: false, itens: [] },
  ];
};

export default function DemoSandboxPage() {
  const [visao, setVisao] = useState<"cliente" | "cozinha" | "admin">("cliente");
  const [mesaDemo, setMesaDemo] = useState<number>(1);
  const [sandboxKey, setSandboxKey] = useState<number>(0);
  const [modoCenario, setModoCenario] = useState<"limpo" | "demo">("demo");
  const [mesas, setMesas] = useState<DemoMesa[]>(() => criarMesasIniciais("demo"));
  const [comprovanteMesa, setComprovanteMesa] = useState<DemoMesa | null>(null);
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
    setMesas(criarMesasIniciais("limpo"));
    setTimeout(() => {
      setSandboxKey((prev) => prev + 1);
      setResetando(false);
    }, 200);
  };

  const carregarCenarioDemo = () => {
    setResetando(true);
    setModoCenario("demo");
    setMesas(criarMesasIniciais("demo"));
    setTimeout(() => {
      setSandboxKey((prev) => prev + 1);
      setResetando(false);
    }, 200);
  };

  const handleAdicionarPedidoTeste = (numeroMesa: number) => {
    const pratosDemo = [
      { nome: "Hambúrguer Artesanal", preco: 38.0 },
      { nome: "Espetinho Misto", preco: 18.0 },
      { nome: "Porção de Fritas", preco: 26.0 },
      { nome: "Refrigerante Lata", preco: 8.0 },
    ];
    const escolhido = pratosDemo[Math.floor(Math.random() * pratosDemo.length)];
    setMesas((prev) =>
      prev.map((m) =>
        m.numero === numeroMesa
          ? {
              ...m,
              status: "ocupada",
              paga: false,
              itens: [
                ...m.itens,
                {
                  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  nome: escolhido.nome,
                  quantidade: 1,
                  preco: escolhido.preco,
                  status: "pendente",
                },
              ],
            }
          : m
      )
    );
  };

  const handleAlternarChamado = (numeroMesa: number) => {
    setMesas((prev) =>
      prev.map((m) =>
        m.numero === numeroMesa ? { ...m, chamadoAtivo: !m.chamadoAtivo } : m
      )
    );
  };

  const handleAvancarItem = (numeroMesa: number, itemId: string) => {
    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero !== numeroMesa) return m;
        return {
          ...m,
          itens: m.itens.map((item) => {
            if (item.id !== itemId) return item;
            if (item.status === "pendente") return { ...item, status: "preparando" };
            if (item.status === "preparando") return { ...item, status: "servido" };
            return item;
          }),
        };
      })
    );
  };

  const handleCobrarMesa = (numeroMesa: number) => {
    let mesaCobrada: DemoMesa | null = null;
    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero !== numeroMesa) return m;
        mesaCobrada = { ...m, paga: true, chamadoAtivo: false };
        return mesaCobrada;
      })
    );
    if (mesaCobrada) setComprovanteMesa(mesaCobrada);
  };

  const handleLiberarMesa = (numeroMesa: number) => {
    setMesas((prev) =>
      prev.map((m) =>
        m.numero === numeroMesa
          ? { ...m, status: "livre", chamadoAtivo: false, paga: false, itens: [] }
          : m
      )
    );
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
                  onClick={() => setVisao("admin")}
                  className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    visao === "admin"
                      ? "bg-white text-rose-700 shadow-xs border border-border/80 font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-rose-600" />
                  <span>Admin de Mesas</span>
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
                    <strong>Visão do Cliente na Mesa {mesaDemo}:</strong> Navegue pelo cardápio, use o botão flutuante de Atendimento e faça um pedido de teste sem medo.
                  </>
                )}
                {visao === "cozinha" && (
                  <>
                    <strong>Visão KDS Cozinha:</strong> Veja os pedidos da mesa caírem na hora com cronômetro de preparo para marchar e marcar como servido.
                  </>
                )}
                {visao === "admin" && (
                  <>
                    <strong>Visão Admin de Mesas (Plano Free):</strong> Gerencie as 5 mesas grátis, cobre somente após a cozinha servir, gere o Comprovante Sem Papel (80mm) e libere a mesa.
                  </>
                )}
              </span>
            </div>
            <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider shrink-0 hidden md:inline">
              Ambiente Autônomo Seguro
            </span>
          </div>
        </div>

        {/* ROTEIRO GUIADO EM 4 PASSOS + DIFERENCIAIS DO PLANO FREE */}
        <div className="bg-white border-b border-neutral-200 px-4 py-2 text-[11px] text-neutral-600">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold text-neutral-800 uppercase tracking-wider text-[10px]">Roteiro:</span>
              <span><strong>1.</strong> Pedir / Chamar Atendimento</span>
              <span className="text-neutral-300">→</span>
              <span><strong>2.</strong> Cozinha Marchar &amp; Servir</span>
              <span className="text-neutral-300">→</span>
              <span><strong>3.</strong> Cobrar &amp; Comprovante Sem Papel (80mm)</span>
              <span className="text-neutral-300">→</span>
              <span><strong>4.</strong> Liberar Mesa no Admin</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 shrink-0">
              5 mesas grátis + R$ 8/extra
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
              <DemoKds mesas={mesas} onAvancarItem={handleAvancarItem} />
            </div>
          )}

          {visao === "admin" && (
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
              <DemoAdminMesas
                mesas={mesas}
                onAdicionarPedidoTeste={handleAdicionarPedidoTeste}
                onAlternarChamado={handleAlternarChamado}
                onCobrarMesa={handleCobrarMesa}
                onGerarComprovante={(mesa) => setComprovanteMesa(mesa)}
                onLiberarMesa={handleLiberarMesa}
              />
            </div>
          )}
        </div>

        {/* MODAL: COMPROVANTE SEM PAPEL (80MM) */}
        <Dialog
          open={Boolean(comprovanteMesa)}
          onOpenChange={(open) => !open && setComprovanteMesa(null)}
        >
          <DialogContent className="max-w-xs bg-amber-50 border-amber-200 text-neutral-900 rounded-2xl p-5 font-mono text-xs shadow-2xl">
            <DialogHeader className="text-center border-b border-dashed border-neutral-400 pb-3">
              <DialogTitle className="text-sm font-black uppercase tracking-wider">
                {RESTAURANTE_DEMO.nome}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-neutral-600">
                Comprovante Sem Papel • 80mm • Mesa {comprovanteMesa?.numero}
              </DialogDescription>
            </DialogHeader>
            {comprovanteMesa && (
              <div className="space-y-2 py-2">
                {comprovanteMesa.itens.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {item.quantidade}x {item.nome}
                    </span>
                    <span className="shrink-0">
                      R$ {(item.preco * item.quantidade).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-dashed border-neutral-400 pt-2 flex justify-between font-black text-sm">
                  <span>TOTAL PAGO</span>
                  <span>
                    R${" "}
                    {comprovanteMesa.itens
                      .reduce((acc, i) => acc + i.preco * i.quantidade, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-center text-neutral-500 pt-1">
                  Pago sem papel • Mesa aguarda liberação no Admin
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
