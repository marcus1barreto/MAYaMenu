"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Share2,
  Sliders,
  Store,
  QrCode,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Copy,
  Check,
} from "lucide-react";
import type { ModoOperacao } from "@/types";

interface CartaoConcessaoModalProps {
  restauranteNome: string;
  codigoLicenca: string;
  slug: string;
  whatsapp?: string;
  modoOperacaoPadrao?: ModoOperacao;
  onConcluir: (ajustes: { modoOperacao: ModoOperacao; slug: string }) => Promise<void> | void;
}

export function CartaoConcessaoModal({
  restauranteNome,
  codigoLicenca,
  slug: initialSlug,
  whatsapp,
  modoOperacaoPadrao = "hibrido",
  onConcluir,
}: CartaoConcessaoModalProps) {
  const [modoOperacao, setModoOperacao] = useState<ModoOperacao>(modoOperacaoPadrao);
  const [slug, setSlug] = useState(initialSlug);
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarAjustes, setMostrarAjustes] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://mayamenu.com.br";
  const urlCardapio = `${baseUrl}/r/${slug}`;
  const urlManual = `${baseUrl}/manual`;

  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(codigoLicenca);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleEnviarWhatsApp = () => {
    const telefoneLimpo = (whatsapp || "").replace(/\D/g, "");
    const ddi = telefoneLimpo.length >= 10 && !telefoneLimpo.startsWith("55") ? `55${telefoneLimpo}` : telefoneLimpo;

    const texto = `🎉 *Parabéns! Sua Concessão MAYaMenu Free está Ativa!*\n\n` +
      `🏢 *Estabelecimento:* ${restauranteNome}\n` +
      `🔑 *Chave de Acesso:* ${codigoLicenca}\n` +
      `🌐 *Cardápio Digital PWA:* ${urlCardapio}?mesa=1\n` +
      `📘 *Manual de Instruções & FAQ:* ${urlManual}\n\n` +
      `_Guarde esta mensagem. Você pode acessar seu painel a qualquer momento usando seu e-mail e senha cadastrados._`;

    const encoded = encodeURIComponent(texto);
    const waUrl = ddi ? `https://wa.me/${ddi}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  const handleFinalizar = async () => {
    setSalvando(true);
    try {
      await onConcluir({ modoOperacao, slug });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
      <div className="w-full max-w-xl my-6 bg-white border border-neutral-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-neutral-900">
        
        {/* TOPO COM IDENTIDADE IFOUND */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-rose-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Emissão de Concessão Digital
          </div>
          <h2 className="text-2xl font-black tracking-tight">Seu Passe de Acesso está Pronto!</h2>
          <p className="text-xs text-rose-100 max-w-md mx-auto mt-1">
            Receba sua credencial física digital. O MAYaMenu está configurado e pronto para o primeiro pedido do salão.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* CARTÃO FÍSICO DIGITAL (TACTILE VIP PASS CARD) */}
          <div className="relative rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white p-6 shadow-xl border border-neutral-800 overflow-hidden transform transition-all hover:scale-[1.01]">
            {/* Efeito Holográfico Sutil */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center font-black text-lg text-white shadow-md">
                  M
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-rose-400">
                    MAYaMenu Digital Pass
                  </span>
                  <h3 className="text-lg font-black text-white leading-tight truncate max-w-[240px]">
                    {restauranteNome}
                  </h3>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  Free Vitalício
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              {/* QR CODE EMBUTIDO */}
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white text-neutral-950 shadow-inner">
                <QRCodeSVG value={`${urlCardapio}?mesa=1`} size={88} level="M" />
                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-600 mt-1 flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-rose-600" />
                  Escanear Cardápio
                </span>
              </div>

              {/* DADOS DA CONCESSÃO */}
              <div className="sm:col-span-2 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Chave de Concessão Oficial
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-sm font-mono font-black text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/50">
                      {codigoLicenca}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopiarCodigo}
                      className="text-neutral-400 hover:text-white transition-colors"
                      title="Copiar Código"
                    >
                      {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Endereço Web PWA
                  </span>
                  <a
                    href={`${urlCardapio}?mesa=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-200 hover:text-white underline text-[11px] truncate block"
                  >
                    /r/{slug}
                  </a>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-neutral-400 pt-1">
                  <span>SLA Cloud: 99.9%</span>
                  <span>•</span>
                  <span>Criptografia Ponta a Ponta</span>
                </div>
              </div>
            </div>
          </div>

          {/* AJUSTES RÁPIDOS OPCIONAIS (EXPANSÍVEL) */}
          <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50/70">
            <button
              type="button"
              onClick={() => setMostrarAjustes(!mostrarAjustes)}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-neutral-700 hover:text-neutral-900"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-600" />
                Ajustes Rápidos Opcionais (Modo do Salão & Link)
              </span>
              <span className="text-[11px] text-rose-600 font-semibold underline">
                {mostrarAjustes ? "Ocultar" : "Personalizar"}
              </span>
            </button>

            {mostrarAjustes && (
              <div className="mt-4 pt-3 border-t border-neutral-200 space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block">
                    Modo Operacional Inicial
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setModoOperacao("hibrido")}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        modoOperacao === "hibrido"
                          ? "bg-rose-50 border-rose-500 text-rose-950 ring-1 ring-rose-500"
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="text-xs font-bold">🍽️ Híbrido</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">Garçom + Pedido no QR da Mesa</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModoOperacao("com_garcom")}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        modoOperacao === "com_garcom"
                          ? "bg-rose-50 border-rose-500 text-rose-950 ring-1 ring-rose-500"
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="text-xs font-bold">🤵 Garçom</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">Apenas Garçom lança pedidos</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModoOperacao("balcao")}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        modoOperacao === "balcao"
                          ? "bg-rose-50 border-rose-500 text-rose-950 ring-1 ring-rose-500"
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="text-xs font-bold">🛎️ Balcão</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">Retirada & Autoatendimento</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block">
                    Link Personalizado do Estabelecimento
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 font-mono">/r/</span>
                    <Input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="bg-white border-neutral-300 text-neutral-900 rounded-xl h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CANAL PARALELO DE NOTIFICAÇÃO / WHATSAPP / MANUAL */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
            <div className="flex items-center gap-2.5 text-xs text-neutral-700">
              <BookOpen className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Dúvidas de operação? Consulte o manual com FAQ e políticas.</span>
            </div>
            <a
              href="/manual"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 underline"
            >
              Abrir Manual de Instruções
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="space-y-2.5 pt-2">
            <Button
              type="button"
              onClick={handleFinalizar}
              disabled={salvando}
              className="w-full h-12 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-xl shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
            >
              <span>{salvando ? "Entrando no Sistema..." : "Entrar no Salão e Começar a Trabalhar"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleEnviarWhatsApp}
              className="w-full h-11 border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Salvar Cartão & Enviar Boas-Vindas no WhatsApp</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
