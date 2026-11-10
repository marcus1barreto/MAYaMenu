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
} from "lucide-react";
import { escutarCatalogoMaster, escutarLotesLicencas } from "@/lib/b2b-service";
import type { PatrocinadorB2B, ItemCatalogoPatrocinador, LoteLicencasB2B } from "@/types/b2b";
import { B2BLotesView } from "./b2b-lotes-view";
import { B2BCatalogoView } from "./b2b-catalogo-view";
import { B2BRestaurantesView } from "./b2b-restaurantes-view";

interface B2BPortalProps {
  patrocinador: PatrocinadorB2B;
  onLogout: () => void;
}

export function B2BPortal({ patrocinador, onLogout }: B2BPortalProps) {
  const [abaAtiva, setAbaAtiva] = useState<"lotes" | "catalogo" | "restaurantes">("lotes");
  const [itensMaster, setItensMaster] = useState<ItemCatalogoPatrocinador[]>([]);
  const [lotes, setLotes] = useState<LoteLicencasB2B[]>([]);
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
      setCarregando(false);
    });

    return () => {
      unsubCatalogo();
      unsubLotes();
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* BARRA SUPERIOR DO PORTAL B2B */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Identificação do Patrocinador */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-600/10 overflow-hidden">
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
                <Building2 className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                  {patrocinador.nomeFantasia}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Patrocinador Master
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                CNPJ: {patrocinador.cnpj} • Trade Marketing & Concessões B2B
              </p>
            </div>
          </div>

          {/* Chave de Acesso & Logout */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={copiarChave}
              className="px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-white/10 hover:border-blue-500/40 text-xs font-mono text-zinc-300 flex items-center gap-2 transition-all"
              title="Copiar Chave de Acesso B2B"
            >
              <span className="text-[10px] uppercase font-bold text-zinc-500">Chave:</span>
              <span className="font-bold text-blue-400">{patrocinador.chaveAcessoB2B}</span>
              {chaveCopiada ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="h-9 px-3 rounded-xl text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 transition-colors"
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
        <div className="flex items-center gap-2 p-1.5 bg-zinc-900/90 border border-white/10 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setAbaAtiva("lotes")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              abaAtiva === "lotes"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Lotes & Vouchers ({lotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("catalogo")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              abaAtiva === "catalogo"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Catálogo Master ({itensMaster.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("restaurantes")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              abaAtiva === "restaurantes"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Rede de Restaurantes</span>
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
      </main>
    </div>
  );
}
