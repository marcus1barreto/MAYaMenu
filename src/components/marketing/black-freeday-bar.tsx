"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";

export function BlackFreedayBar() {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const oculto = sessionStorage.getItem("mayamenu_black_freeday_dismissed");
      if (oculto === "true") {
        setVisivel(false);
      }
    }
  }, []);

  const handleFechar = () => {
    setVisivel(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mayamenu_black_freeday_dismissed", "true");
    }
  };

  if (!visivel) return null;

  return (
    <div className="relative bg-neutral-950 text-white border-b border-neutral-800 text-xs py-2 px-3 sm:px-6 transition-all duration-300 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* CONTEÚDO CENTRALIZADO */}
        <div className="flex-1 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider text-amber-300">
            🖤 BLACK FREEDAY
          </span>

          <span className="text-neutral-200 font-medium text-xs sm:text-[13px]">
            Comece <strong>100% Grátis</strong> no Free ou turbine seu salão com o PRO por <strong>R$ 41,50/mês</strong>!
          </span>

          <Link
            href="/precos"
            className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-400/50 hover:decoration-amber-300 transition-all ml-1 group"
          >
            <span>Aproveitar Oferta</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* BOTÃO FECHAR */}
        <button
          type="button"
          onClick={handleFechar}
          className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors shrink-0"
          aria-label="Fechar aviso"
          title="Fechar aviso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

