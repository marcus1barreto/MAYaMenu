"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Palette, Type, ShieldAlert, Sparkles, Smartphone, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeletorDeTemas } from "@/components/admin/seletor-de-temas";

export default function IdentidadeInternaPage() {
  const [temaLaboratorio, setTemaLaboratorio] = useState("white-label");
  const [corPrimariaLab, setCorPrimariaLab] = useState("#EA1D2C");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8 antialiased">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* CABEÇALHO DA ROTA RESTRITA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                Área Restrita • Acesso Manual
              </Badge>
              <Badge variant="outline" className="text-xs text-neutral-400 border-neutral-700">
                Sem Links Públicos
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Laboratório de Identidade & Tipografia M3
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Painel central de documentação e ajustes de tipografia móvel e tokens visuais. O sistema operacional roda no padrão único emergencial iFood.
            </p>
          </div>

          <Link href="/admin">
            <Button
              variant="outline"
              size="sm"
              className="border-neutral-800 text-neutral-300 hover:bg-neutral-900 rounded-xl text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Admin
            </Button>
          </Link>
        </div>

        {/* 1. SEÇÃO DE TIPOGRAFIA M3 (MATERIAL DESIGN 3 TYPE SCALE) */}
        <div className="space-y-4 p-6 rounded-3xl bg-neutral-900/70 border border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Hierarquia Tipográfica Mobile (M3 Type Scale)
              </h2>
              <p className="text-xs text-neutral-400">
                Camadas de importância para leitura perfeita em telemóveis sob qualquer iluminação.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
            {/* DISPLAY / HEADLINE */}
            <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400">
                  Headline Large / Medium
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">24px - 30px • Peso 800/900</span>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">
                Título de Destaque
              </p>
              <p className="text-xs text-neutral-400">
                Usado em nomes de estabelecimentos, confirmação de pedido e títulos de boas-vindas.
              </p>
            </div>

            {/* TITLE */}
            <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
                  Title Medium / Large
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">16px - 18px • Peso 700</span>
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                Nome do Prato ou Categoria
              </p>
              <p className="text-xs text-neutral-400">
                Foco imediato do cliente ao rolar o cardápio no celular.
              </p>
            </div>

            {/* BODY */}
            <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Body Medium
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">14px • Leading Relaxed</span>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Ingredientes selecionados, molho especial da casa e pão brioche artesanal selado na manteiga.
              </p>
              <p className="text-xs text-neutral-400">
                Descrições nunca menores que 13px/14px para evitar esforço visual do cliente.
              </p>
            </div>

            {/* LABEL & ACTION */}
            <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Label Large / Action
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">13px - 15px • Peso 700/800</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-base font-black text-rose-500 font-mono">
                  R$ 38,90
                </span>
                <span className="text-xs font-bold bg-neutral-800 text-neutral-200 px-3 py-1 rounded-full">
                  Adicionar ao Pedido
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Preços e botões de chamada rápida para decisão instantânea e toque mínimo de 44px.
              </p>
            </div>
          </div>
        </div>

        {/* 2. SEÇÃO DE DESIGN SYSTEM EMERGENCIAL (IFOOD LIGHT STANDARD) */}
        <div className="space-y-4 p-6 rounded-3xl bg-neutral-900/70 border border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Padrão Visual Ativo (iFood Light Oficial)
              </h2>
              <p className="text-xs text-neutral-400">
                Tokens de cor adotados em todas as telas dos clientes e terminais.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white text-neutral-900 border border-neutral-200 text-center space-y-1">
              <span className="text-xs font-black block">Fundo Principal</span>
              <span className="text-[11px] font-mono text-neutral-500 block">#FFFFFF</span>
              <span className="text-[10px] text-neutral-400">Base limpa e clara</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#EA1D2C] text-white border border-red-600 text-center space-y-1">
              <span className="text-xs font-black block">Ação Primária</span>
              <span className="text-[11px] font-mono text-white/90 block">#EA1D2C</span>
              <span className="text-[10px] text-white/80">Vermelho iFood</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-900 text-white border border-neutral-700 text-center space-y-1">
              <span className="text-xs font-black block">Texto de Leitura</span>
              <span className="text-[11px] font-mono text-neutral-400 block">#1F2937</span>
              <span className="text-[10px] text-neutral-400">Alto Contraste</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-100 text-neutral-800 border border-neutral-200 text-center space-y-1">
              <span className="text-xs font-black block">Superfície / Bordas</span>
              <span className="text-[11px] font-mono text-neutral-500 block">#E5E7EB</span>
              <span className="text-[10px] text-neutral-400">Divisores neutros</span>
            </div>
          </div>
        </div>

        {/* 3. LABORATÓRIO ISOLADO DE TEMAS (QUARNTENA TÉCNICA) */}
        <div className="space-y-4 p-6 rounded-3xl bg-neutral-900/50 border border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Laboratório Consultivo de Temas (Quarentena)
              </h2>
              <p className="text-xs text-neutral-400">
                Preservado exclusivamente para testes futuros de engenharia. Não reflete nas telas dos clientes.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800">
            <SeletorDeTemas
              temaAtualSalvo={temaLaboratorio}
              onSalvarTema={(novoId, novaCor) => {
                setTemaLaboratorio(novoId);
                setCorPrimariaLab(novaCor);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
