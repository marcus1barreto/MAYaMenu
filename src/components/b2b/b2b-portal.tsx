"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Layers,
  UtensilsCrossed,
  Store,
  LogOut,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  Check,
  Copy,
  TrendingUp,
} from "lucide-react";
import { escutarCatalogoMaster, escutarLotesLicencas, escutarMetricasSellout } from "@/lib/b2b-service";
import type { PatrocinadorB2B, ItemCatalogoPatrocinador, LoteLicencasB2B, MetricasSelloutItem } from "@/types/b2b";
import { B2BLotesView } from "./b2b-lotes-view";
import { B2BCatalogoView } from "./b2b-catalogo-view";
import { B2BRestaurantesView } from "./b2b-restaurantes-view";
import { B2BSelloutView } from "./b2b-sellout-view";

interface B2BPortalProps {
  patrocinador: PatrocinadorB2B;
  onLogout: () => void;
}

export function B2BPortal({ patrocinador, onLogout }: B2BPortalProps) {
  const [abaAtiva, setAbaAtiva] = useState<"lotes" | "catalogo" | "restaurantes" | "sellout">("lotes");
  const [itensMaster, setItensMaster] = useState<ItemCatalogoPatrocinador[]>([]);
  const [lotes, setLotes] = useState<LoteLicencasB2B[]>([]);
  const [metricasSellout, setMetricasSellout] = useState<MetricasSelloutItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [chaveCopiada, setChaveCopiada] = useState(false);

  // Escuta dados em tempo real no Firestore
  useEffect(() => {
    if (!patrocinador?.id) return;

    setCarregando(true);
    const unsubCatalogo = escutarCatalogoMaster(patrocinador.id, (novosItens) => {
      setItensMaster(novosItens);
    });

    const unsubLotes = escutarLotesLicencas(patrocinador.id, (novosLotes) => {
      setLotes(novosLotes);
    });

    const unsubSellout = escutarMetricasSellout(patrocinador.id, (novasMetricas) => {
      setMetricasSellout(novasMetricas);
      setCarregando(false);
    });

    return () => {
      unsubCatalogo();
      unsubLotes();
      unsubSellout();
    };
  }, [patrocinador?.id]);

  const copiarChave = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(patrocinador.chaveAcessoB2B);
      setChaveCopiada(true);
      setTimeout(() => setChaveCopiada(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      {/* BARRA SUPERIOR DO PORTAL B2B (HARMONIZADA COM MAYAMENU) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Identificação do Patrocinador */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-700 shrink-0 shadow-xs overflow-hidden">
              {patrocinador.logoUrl ? (
                <img
                  src={patrocinador.logoUrl}
                  alt={patrocinador.nomeFantasia}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/images/demo/coquetel.webp";
                  }}
                />
              ) : (
                <Building2 className="w-6 h-6 text-neutral-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-neutral-950 leading-tight">
                  {patrocinador.nomeFantasia}
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Patrocinador Master
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                CNPJ: {patrocinador.cnpj} • Trade Marketing & Concessões B2B
              </p>
            </div>
          </div>

          {/* Chave de Acesso & Logout */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={copiarChave}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 border border-neutral-200 hover:border-neutral-300 text-xs font-mono text-neutral-700 flex items-center gap-2 transition-all shadow-2xs"
              title="Copiar Chave de Acesso B2B"
            >
              <span className="text-[10px] uppercase font-bold text-neutral-500">Chave:</span>
              <span className="font-bold text-neutral-900">{patrocinador.chaveAcessoB2B}</span>
              {chaveCopiada ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
              )}
            </button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="h-9 px-3 rounded-xl text-xs text-neutral-600 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL COM ABAS NAVEGÁVEIS */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-8 flex-1 space-y-6">
        {/* NAVEGAÇÃO ENTRE ABAS DO PORTAL */}
        <div className="flex items-center gap-1.5 p-1.5 bg-neutral-200/60 border border-neutral-200/80 rounded-2xl w-fit flex-wrap">
          <button
            type="button"
            onClick={() => setAbaAtiva("lotes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              abaAtiva === "lotes"
                ? "bg-white text-neutral-950 shadow-xs border border-neutral-200/80 font-black"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            <Layers className="w-4 h-4 text-rose-600" />
            <span>Lotes & Vouchers ({lotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("catalogo")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              abaAtiva === "catalogo"
                ? "bg-white text-neutral-950 shadow-xs border border-neutral-200/80 font-black"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-rose-600" />
            <span>Catálogo Master ({itensMaster.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("restaurantes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              abaAtiva === "restaurantes"
                ? "bg-white text-neutral-950 shadow-xs border border-neutral-200/80 font-black"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            <Store className="w-4 h-4 text-emerald-600" />
            <span>Rede de Restaurantes</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("sellout")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              abaAtiva === "sellout"
                ? "bg-white text-neutral-950 shadow-xs border border-neutral-200/80 font-black"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>Sell-Out no PDV</span>
          </button>
        </div>

        {/* RENDERIZAÇÃO DA ABA ATIVA */}
        {abaAtiva === "lotes" && (
          <B2BLotesView
            patrocinadorId={patrocinador.id}
            lotes={lotes}
          />
        )}

        {abaAtiva === "catalogo" && (
          <B2BCatalogoView
            patrocinadorId={patrocinador.id}
            itens={itensMaster}
          />
        )}

        {abaAtiva === "restaurantes" && (
          <B2BRestaurantesView
            lotes={lotes}
          />
        )}

        {abaAtiva === "sellout" && (
          <B2BSelloutView
            metricas={metricasSellout}
            itensMaster={itensMaster}
          />
        )}
      </main>
    </div>
  );
}

