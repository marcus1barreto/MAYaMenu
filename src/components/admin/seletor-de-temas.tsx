"use client";

import React, { useState } from "react";
import { CheckCircle2, Info, Sparkles } from "lucide-react";
import type { TemaId } from "@/lib/tema";

export interface TemaEstabelecimentoDef {
  id: TemaId;
  tipoEstabelecimento: string;
  nomeEstilo: string;
  inspiracao: string;
  psicologia: string;
  classeCSS: string;
  corPrimaria: string;
  previewBg: string;
  previewText: string;
  previewBtn: string;
}

// Catálogo com abordagem consultiva de UX focado no modelo de negócio do lojista
export const TEMAS_POR_ESTABELECIMENTO: TemaEstabelecimentoDef[] = [
  {
    id: "white-label",
    tipoEstabelecimento: "Padarias, Docerias e Dia a Dia",
    nomeEstilo: "Clássico B2C (White-Label)",
    inspiracao: "Inspirado no padrão ouro do mercado (iFood, Uber Eats).",
    psicologia:
      "O fundo branco absoluto transmite higiene, transparência e clareza. O botão vermelho carmesim é usado para atrair os olhos e estimular a fome e a ação imediata. Ideal para cardápios com muitas fotos claras.",
    classeCSS: "",
    corPrimaria: "#E11D48",
    previewBg: "bg-white",
    previewText: "text-zinc-900",
    previewBtn: "bg-rose-600",
  },
  {
    id: "fast-carbono",
    tipoEstabelecimento: "Hamburguerias, Trucks e Fast Food",
    nomeEstilo: "Brasa & Fogo",
    inspiracao: "Inspirado em totens de autoatendimento (McDonald's, Burger King).",
    psicologia:
      "As cores quentes (laranja mostarda) sobre um fundo carbono ativam o metabolismo e induzem a decisões rápidas por impulso. Feito para alta rotação de mesas e foco em 'comfort food'.",
    classeCSS: "theme-fast-carbono",
    corPrimaria: "#F97316",
    previewBg: "bg-stone-900",
    previewText: "text-stone-100",
    previewBtn: "bg-orange-500",
  },
  {
    id: "boemia-marinho",
    tipoEstabelecimento: "Pizzarias, Pubs e Barzinhos",
    nomeEstilo: "Boemia Noturna",
    inspiracao: "Inspirado em apps de vida noturna (Zé Delivery) e coquetelaria.",
    psicologia:
      "O cliente já está relaxado e em ambiente de luz baixa. O fundo azul marinho profundo reduz o contraste agressivo do preto puro, enquanto o ciano neon nos botões guia o olhar para a conversão sem cegar o cliente.",
    classeCSS: "theme-boemia-marinho",
    corPrimaria: "#06B6D4",
    previewBg: "bg-slate-950",
    previewText: "text-slate-100",
    previewBtn: "bg-cyan-500",
  },
  {
    id: "premium-asfalto",
    tipoEstabelecimento: "Churrascarias e Alta Gastronomia",
    nomeEstilo: "Premium & Tradição",
    inspiracao: "Inspirado em apps de reserva premium (OpenTable) e steak houses.",
    psicologia:
      "O fundo preto asfalto combinado com botões em dourado/âmbar transmite luxo, exclusividade e alto valor agregado. Prepara o cliente psicologicamente para um ticket médio mais elevado.",
    classeCSS: "theme-premium-asfalto",
    corPrimaria: "#D97706",
    previewBg: "bg-zinc-950",
    previewText: "text-zinc-100",
    previewBtn: "bg-amber-500",
  },
  {
    id: "brisa-areia",
    tipoEstabelecimento: "Sucos, Saladerias e Barracas de Praia",
    nomeEstilo: "Brisa & Natureza",
    inspiracao: "Inspirado em marcas orgânicas (Sweetgreen, Oakberry).",
    psicologia:
      "O fundo areia (bege bem claro) elimina o tom clínico do branco puro, remetendo a texturas naturais e papel reciclado. O verde esmeralda comunica frescor, saúde e bem-estar imediatamente.",
    classeCSS: "theme-brisa-areia",
    corPrimaria: "#059669",
    previewBg: "bg-[#FAFAF9]",
    previewText: "text-stone-900",
    previewBtn: "bg-emerald-600",
  },
  {
    id: "acessibilidade-sepia",
    tipoEstabelecimento: "Para Leitores e Clientes Sensíveis",
    nomeEstilo: "Descanso Visual (Sépia)",
    inspiracao: "Inspirado em leitores de E-book (Kindle) e padrões de acessibilidade médica.",
    psicologia:
      "Usa a paleta 'Solarized' com fundo amarelado suave e textos em marrom. Corta a emissão de luz azul e elimina o efeito de halo (Halation), garantindo que o cliente passe mais tempo no cardápio sem enjoo ou fadiga ocular.",
    classeCSS: "theme-acessibilidade-sepia",
    corPrimaria: "#C26D2B",
    previewBg: "bg-[#FDF6E3]",
    previewText: "text-stone-800",
    previewBtn: "bg-stone-800",
  },
];

interface SeletorDeTemasProps {
  temaAtualSalvo?: string;
  onSalvarTema: (id: TemaId, corPrimaria: string) => void;
}

export function SeletorDeTemas({ temaAtualSalvo, onSalvarTema }: SeletorDeTemasProps) {
  // Normaliza aliases anteriores
  const idNormalizado: TemaId =
    temaAtualSalvo === "padrao" || !temaAtualSalvo
      ? "white-label"
      : temaAtualSalvo === "fast-furious" || temaAtualSalvo === "brasa-fogo"
      ? "fast-carbono"
      : temaAtualSalvo === "boemia-noturna" || temaAtualSalvo === "neon-pub"
      ? "boemia-marinho"
      : temaAtualSalvo === "premium-tradicao" || temaAtualSalvo === "dark-elegante" || temaAtualSalvo === "dark"
      ? "premium-asfalto"
      : temaAtualSalvo === "brisa-natureza" || temaAtualSalvo === "fresh-nature"
      ? "brisa-areia"
      : temaAtualSalvo === "descanso-vista" || temaAtualSalvo === "descanso-visual"
      ? "acessibilidade-sepia"
      : (temaAtualSalvo as TemaId);

  const [temaAtivo, setTemaAtivo] = useState<TemaId>(idNormalizado);

  const handleSelecionar = (tema: TemaEstabelecimentoDef) => {
    setTemaAtivo(tema.id);
    onSalvarTema(tema.id, tema.corPrimaria);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          Identidade Visual e Conversão
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          As cores do seu cardápio influenciam diretamente a fome e a decisão de compra do cliente. Escolha o perfil do seu estabelecimento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMAS_POR_ESTABELECIMENTO.map((tema) => {
          const isAtivo =
            temaAtivo === tema.id ||
            (tema.id === "white-label" && (temaAtivo === "padrao" as any || temaAtivo === "light" as any)) ||
            (tema.id === "fast-carbono" && (temaAtivo === "fast-furious" as any || temaAtivo === "brasa-fogo" as any)) ||
            (tema.id === "boemia-marinho" && (temaAtivo === "boemia-noturna" as any || temaAtivo === "neon-pub" as any)) ||
            (tema.id === "premium-asfalto" && (temaAtivo === "premium-tradicao" as any || temaAtivo === "dark-elegante" as any || temaAtivo === "dark" as any)) ||
            (tema.id === "brisa-areia" && (temaAtivo === "brisa-natureza" as any || temaAtivo === "fresh-nature" as any)) ||
            (tema.id === "acessibilidade-sepia" && (temaAtivo === "descanso-vista" as any || temaAtivo === "descanso-visual" as any));

          return (
            <button
              key={tema.id}
              type="button"
              onClick={() => handleSelecionar(tema)}
              className={`relative flex flex-col items-start p-5 text-left border rounded-2xl transition-all duration-300 cursor-pointer ${
                isAtivo
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              {/* Cabeçalho do Card: Tipo de Estabelecimento */}
              <div className="w-full mb-4 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-base text-foreground leading-tight">
                    {tema.tipoEstabelecimento}
                  </h4>
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-background border border-border text-[10px] font-medium text-muted-foreground tracking-wide uppercase">
                    Estilo: {tema.nomeEstilo}
                  </span>
                </div>

                {isAtivo && (
                  <div className="shrink-0 text-primary bg-background rounded-full">
                    <CheckCircle2 className="w-6 h-6 fill-primary/20" />
                  </div>
                )}
              </div>

              {/* Amostra Visual (Preview) */}
              <div
                className={`w-full h-24 rounded-xl mb-5 flex flex-col justify-between p-3 border shadow-inner ${tema.previewBg}`}
              >
                <div className="space-y-2 w-full">
                  <div
                    className={`h-3 w-3/4 rounded-full opacity-90 ${
                      tema.previewText === "text-zinc-900" ||
                      tema.previewText === "text-stone-900" ||
                      tema.previewText === "text-stone-800"
                        ? "bg-zinc-800"
                        : "bg-white/90"
                    }`}
                  />
                  <div
                    className={`h-2.5 w-1/2 rounded-full opacity-60 ${
                      tema.previewText === "text-zinc-900" ||
                      tema.previewText === "text-stone-900" ||
                      tema.previewText === "text-stone-800"
                        ? "bg-zinc-800"
                        : "bg-white/60"
                    }`}
                  />
                </div>
                <div className="flex justify-end w-full">
                  <div className={`h-8 w-24 rounded-lg shadow-sm ${tema.previewBtn}`} />
                </div>
              </div>

              {/* Seção de Consultoria (Explicação e Psicologia) */}
              <div className="w-full bg-background/50 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Por que usar este tema?</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                  <strong className="text-foreground font-medium">Inspiração:</strong> {tema.inspiracao}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tema.psicologia}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
