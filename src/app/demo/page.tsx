"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";
import { MenuView } from "@/components/cliente/menu-view";
import { CartProvider } from "@/context/cart-context";
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
  ArrowLeft,
  Store,
  QrCode,
  Check,
  Copy,
  ArrowRight,
  Info,
  ExternalLink,
} from "lucide-react";

const SLUG_PUBLICO = "modelo-free";

export default function DemoShowroomPage() {
  const [mesaDemo] = useState<number>(1);
  const [modalQrAberto, setModalQrAberto] = useState<boolean>(false);
  const [copiadoLink, setCopiadoLink] = useState<boolean>(false);
  const [urlOrigem, setUrlOrigem] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrlOrigem(window.location.origin);
    }
  }, []);

  const urlMesaCelular = `${urlOrigem}/r/${SLUG_PUBLICO}?mesa=${mesaDemo}`;

  const copiarLinkCelular = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(urlMesaCelular);
      setCopiadoLink(true);
      setTimeout(() => setCopiadoLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-foreground flex flex-col">
      {/* CABEÇALHO DO SHOWROOM */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-foreground">
                  Showroom MAYAMENU
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold bg-rose-50 text-rose-700 border-rose-200 px-2 py-0"
                >
                  <Sparkles className="w-2.5 h-2.5 mr-1 text-rose-500" />
                  Plano Free (5 Mesas)
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Explore o cardápio real ou acesse as telas públicas do estabelecimento modelo.
              </p>
            </div>
          </div>

          {/* ATALHOS PARA AS TELAS REAIS */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/r/${SLUG_PUBLICO}?mesa=${mesaDemo}`} target="_blank">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-bold rounded-xl border-border bg-white hover:bg-muted flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-rose-600" />
                <span>Mesa {mesaDemo} (Real)</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </Button>
            </Link>

            <Link href="/cozinha" target="_blank">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-bold rounded-xl border-border bg-white hover:bg-muted flex items-center gap-1.5"
              >
                <ChefHat className="w-3.5 h-3.5 text-rose-600" />
                <span>KDS Cozinha</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </Button>
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalQrAberto(true)}
              className="h-8 px-2.5 text-xs font-bold rounded-xl border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 shadow-xs flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Degustar no Celular</span>
              <span className="sm:hidden">No Celular</span>
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

      {/* ROTEIRO GUIADO EM 4 PASSOS + DIFERENCIAIS DO PLANO FREE */}
      <div className="bg-white border-b border-neutral-200 px-4 py-2 text-[11px] text-neutral-600">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold text-neutral-800 uppercase tracking-wider text-[10px]">
              Roteiro:
            </span>
            <span>
              <strong>1.</strong> Pedir / Chamar Atendimento
            </span>
            <span className="text-neutral-300">→</span>
            <span>
              <strong>2.</strong> Cozinha Marchar &amp; Servir
            </span>
            <span className="text-neutral-300">→</span>
            <span>
              <strong>3.</strong> Cobrar &amp; Comprovante Sem Papel (80mm)
            </span>
            <span className="text-neutral-300">→</span>
            <span>
              <strong>4.</strong> Liberar Mesa no Admin
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 shrink-0">
            5 mesas grátis + R$ 8/extra
          </span>
        </div>
      </div>

      {/* BANNER INFORMATIVO */}
      <div className="bg-rose-50/40 border-b border-rose-100 px-4 py-2 text-xs text-neutral-700">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Info className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            <strong>Visão do Cliente na Mesa {mesaDemo}:</strong> Navegue pelo cardápio, use o botão flutuante de Atendimento e veja como o cliente faz pedidos direto do celular.
          </span>
        </div>
      </div>

      {/* CARDÁPIO REAL */}
      <div className="flex-1 bg-background">
        <CartProvider slug={SLUG_PUBLICO} mesaInicial={mesaDemo}>
          <MenuView
            restaurante={RESTAURANTE_DEMO}
            cardapio={CARDAPIO_DEMO}
            numeroMesa={mesaDemo}
          />
        </CartProvider>
      </div>

      {/* MODAL: EXPERIMENTE NO CELULAR */}
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
              Aponte a câmera do seu celular para o QR Code abaixo para abrir o cardápio da <strong>Mesa {mesaDemo}</strong>.
            </DialogDescription>
          </DialogHeader>

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

            <Button
              type="button"
              variant="outline"
              onClick={copiarLinkCelular}
              className="w-full rounded-xl text-xs font-bold h-9 border-border"
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
