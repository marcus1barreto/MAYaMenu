"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChefHat,
  CheckCircle2,
  QrCode,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OnboardingTourCardProps {
  restauranteId: string;
  nomeRestaurante: string;
  totalItensMenu: number;
  forcarAberto?: boolean;
  onFecharTour?: () => void;
}

const PASSOS_TOUR = [
  {
    titulo: "1. Crie o 1º prato na rota do Chef",
    descricao:
      "O cardápio nasce na cozinha: cadastre prato, componentes e preparo em /cozinha/receitas. A cozinha também pausa itens esgotados em 1 clique.",
    rota: "/cozinha/receitas",
    cta: "Ir para Espaço do Chef",
    icone: "chef" as const,
  },
  {
    titulo: "2. Ajuste preços & publicação no Gerencial",
    descricao:
      "Defina preço de venda, categorias, ordem dos pratos e acompanhe resultados financeiros em /admin/gerencial.",
    rota: "/admin/gerencial",
    cta: "Abrir Gerencial",
    icone: "gerencial" as const,
  },
  {
    titulo: "3. Configure mesas, QR Codes & Equipe no Setup",
    descricao:
      "Gere os QR Codes das mesas e o QR do Chef com PIN nominal para sua cozinha em /admin/setup.",
    rota: "/admin/setup",
    cta: "Abrir Setup",
    icone: "setup" as const,
  },
  {
    titulo: "4. Opere mesas e pedidos ao vivo",
    descricao:
      "Durante o expediente, acompanhe o Salão ao Vivo em /admin/operacao e marche pedidos direto no KDS da Cozinha (/cozinha).",
    rota: "/cozinha",
    cta: "Abrir KDS Cozinha",
    icone: "kds" as const,
  },
];

export function OnboardingTourCard({
  restauranteId,
  nomeRestaurante,
  totalItensMenu,
  forcarAberto = false,
  onFecharTour,
}: OnboardingTourCardProps) {
  const [dispensado, setDispensado] = useState(true);
  const [tourExpandido, setTourExpandido] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);

  const storageKey = `mayamenu_tour_v1_${restauranteId}`;

  // Estado 100% local no navegador (custo zero de servidor e banco)
  useEffect(() => {
    if (!restauranteId) return;
    try {
      const salvo = localStorage.getItem(storageKey);
      setDispensado(salvo === "dismissed");
    } catch {
      setDispensado(false);
    }
  }, [restauranteId, storageKey]);

  const semItensAinda = totalItensMenu === 0;
  const mostrar = forcarAberto || semItensAinda || !dispensado;
  if (!mostrar) return null;

  const handleDispensar = () => {
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {
      // Ignora indisponibilidade de storage
    }
    setDispensado(true);
    setTourExpandido(false);
    onFecharTour?.();
  };

  const hrefChef = restauranteId
    ? `/cozinha/receitas?r=${encodeURIComponent(restauranteId)}`
    : "/cozinha/receitas";

  const passo = PASSOS_TOUR[passoAtual];
  const hrefPasso =
    passo.rota.startsWith("/cozinha") && restauranteId
      ? `${passo.rota}?r=${encodeURIComponent(restauranteId)}`
      : passo.rota;

  return (
    <div className="mb-5 rounded-3xl border-2 border-amber-500/35 bg-gradient-to-br from-amber-500/[0.08] via-card to-rose-500/[0.05] p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center shrink-0 shadow-sm">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                <Sparkles className="w-3 h-3 mr-1" />
                {semItensAinda ? "Primeiros Passos" : "Guia Rápido do Painel"}
              </Badge>
              <span className="text-[11px] font-bold text-muted-foreground">
                {nomeRestaurante}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-black text-foreground mt-1">
              {semItensAinda
                ? "Seu restaurante está pronto! Crie o 1º prato no Espaço do Chef"
                : "Conheça a organização em 3 ambientes + Espaço do Chef"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              {semItensAinda
                ? "Comece pela cozinha montando seu primeiro item do cardápio e ficha técnica na nova rota /cozinha/receitas — leva menos de 1 minuto."
                : "Tour local leve (zero consumo de servidor) para navegar entre Operação, Gerencial, Setup e Cozinha."}
            </p>
          </div>
        </div>

        {!semItensAinda && (
          <button
            type="button"
            onClick={handleDispensar}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Ocultar guia rápido"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* CTAs principais quando cardápio está vazio */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href={hrefChef}>
          <Button
            type="button"
            className="h-10 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-sm"
          >
            <BookOpen className="w-4 h-4" />
            <span>
              {semItensAinda
                ? "Criar 1º Item no Espaço do Chef"
                : "Abrir Espaço do Chef (/cozinha/receitas)"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>

        <Button
          type="button"
          variant="outline"
          onClick={() => setTourExpandido((v) => !v)}
          className="h-10 px-3.5 text-xs font-bold rounded-xl"
        >
          {tourExpandido ? "Ocultar Tour (4 passos)" : "Ver Tour Rápido (4 passos)"}
        </Button>

        {semItensAinda && (
          <Link href="/admin/gerencial">
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-xl"
            >
              Ou criar pelo Gerencial
            </Button>
          </Link>
        )}
      </div>

      {/* Tour interativo puramente client-side */}
      {(tourExpandido || forcarAberto) && (
        <div className="pt-3 border-t border-border/80 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PASSOS_TOUR.map((p, idx) => (
              <button
                key={p.titulo}
                type="button"
                onClick={() => setPassoAtual(idx)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  passoAtual === idx
                    ? "bg-card border-primary shadow-2xs"
                    : "bg-muted/40 border-border hover:bg-card/80"
                }`}
              >
                <span className="text-[10px] font-black uppercase text-primary block">
                  Passo {idx + 1}
                </span>
                <span className="text-xs font-bold text-foreground line-clamp-1">
                  {p.titulo.replace(/^\d+\.\s*/, "")}
                </span>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {passo.icone === "chef" ? (
                  <BookOpen className="w-4 h-4" />
                ) : passo.icone === "gerencial" ? (
                  <BarChart3 className="w-4 h-4" />
                ) : passo.icone === "setup" ? (
                  <SlidersHorizontal className="w-4 h-4" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-foreground">
                  {passo.titulo}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {passo.descricao}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href={hrefPasso}>
                <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs font-bold">
                  {passo.cta}
                </Button>
              </Link>
              {passoAtual < PASSOS_TOUR.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPassoAtual((prev) => prev + 1)}
                  className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDispensar}
                  className="h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Concluir Tour</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
