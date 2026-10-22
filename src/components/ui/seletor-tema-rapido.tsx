"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTemaUsuario } from "@/context/tema-context";
import { TEMAS_DISPONIVEIS, FAMILIAS_TEMAS, type TemaId } from "@/lib/tema";
import { Sparkles, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeletorTemaRapidoProps {
  rotulo?: string;
  classeBotao?: string;
}

export function SeletorTemaRapido({ rotulo, classeBotao }: SeletorTemaRapidoProps) {
  const { tema, definirTema } = useTemaUsuario();
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const temaAtual = TEMAS_DISPONIVEIS.find((t) => t.id === tema) || TEMAS_DISPONIVEIS[0];

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) {
      document.addEventListener("mousedown", handleClickFora);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
    };
  }, [aberto]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAberto((prev) => !prev)}
        className={
          classeBotao ||
          "h-9 px-2.5 rounded-xl border-border bg-card/85 hover:bg-muted text-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        }
        title="Alternar tema de conforto visual deste terminal"
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-border shrink-0 shadow-xs"
          style={{ backgroundColor: temaAtual.corAmostra }}
        />
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className="truncate max-w-[120px]">{rotulo || temaAtual.nome}</span>
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 shrink-0" />
      </Button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground px-2.5 py-1.5 border-b border-border mb-1">
            Conforto Visual da Tela
          </div>

          {FAMILIAS_TEMAS.map((familia) => (
            <div key={familia.id} className="mb-2 last:mb-0">
              <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                <span>{familia.icone}</span>
                <span>{familia.nome}</span>
              </div>
              <div className="space-y-0.5">
                {familia.temas.map((t) => {
                  const isAtivo = tema === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        definirTema(t.id);
                        setAberto(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors text-left ${
                        isAtivo
                          ? "bg-primary/15 text-primary font-bold"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-border shadow-xs shrink-0"
                          style={{ backgroundColor: t.corAmostra }}
                        />
                        <span className="truncate">{t.nome}</span>
                      </div>
                      {isAtivo && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
