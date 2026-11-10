"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Briefcase,
  Store,
  Layers,
} from "lucide-react";
import { buscarPatrocinadorPorChave, salvarPatrocinador, salvarItemCatalogoMaster, criarLoteLicencas } from "@/lib/b2b-service";
import type { PatrocinadorB2B } from "@/types/b2b";

interface B2BLoginProps {
  onAutenticado: (patrocinador: PatrocinadorB2B) => void;
}

export function B2BLogin({ onAutenticado }: B2BLoginProps) {
  const [chave, setChave] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const chaveLimpa = chave.trim().toUpperCase();

    if (!chaveLimpa) {
      setErro("Informe sua Chave de Acesso B2B corporativa.");
      return;
    }

    setProcessando(true);
    try {
      let patrocinador = await buscarPatrocinadorPorChave(chaveLimpa);

      // Suporte a chave de demonstração instantânea
      if (!patrocinador && (chaveLimpa === "SPN-DEMO-2026" || chaveLimpa === "DEMO")) {
        const idDemo = "spn-bierhaus-demo";
        await salvarPatrocinador({
          id: idDemo,
          cnpj: "12.345.678/0001-90",
          razaoSocial: "BierHaus Cervejaria Artesanal S.A.",
          nomeFantasia: "Cervejaria BierHaus",
          slug: "bierhaus",
          chaveAcessoB2B: "SPN-DEMO-2026",
          logoUrl: "/images/demo/coquetel.webp",
          contatoResponsavel: {
            nome: "Diretoria de Trade Marketing",
            email: "parcerias@bierhaus.com.br",
            telefone: "(11) 98765-4321",
            cargo: "Gerente Nacional de Canais & PDV",
          },
          ativo: true,
        });

        // Cria produtos master demo
        await salvarItemCatalogoMaster(idDemo, {
          id: "chopp-artesanal-ipa-500",
          nome: "Chopp Artesanal BierHaus IPA 500ml",
          categoriaSugerida: "Chopps & Cervejas",
          descricaoOficial: "Cerveja artesanal fresca com lúpulos nobres cítricos, amargor marcante e aroma marcante de maracujá e pinho.",
          fotoOficialUrl: "/images/demo/coquetel.webp",
          precoSugerido: 22.0,
          obrigatorioNoCardapio: true,
          posicaoFixaTopo: true,
          seloPatrocinador: "Chopp Oficial Parceiro",
        });

        await salvarItemCatalogoMaster(idDemo, {
          id: "cerveja-lager-longneck",
          nome: "BierHaus German Lager Long Neck",
          categoriaSugerida: "Cervejas Especiais",
          descricaoOficial: "Puro malte refrescante, coloração dourada brilhante e colarinho denso e cremoso.",
          fotoOficialUrl: "/images/demo/coquetel.webp",
          precoSugerido: 16.0,
          obrigatorioNoCardapio: true,
          posicaoFixaTopo: false,
          seloPatrocinador: "Parceiro Master",
        });

        // Cria lote inicial
        await criarLoteLicencas(idDemo, {
          nome: "Lote Piloto - Bares Selecionados 2026",
          codigoCampanha: "BIERHAUS2026",
          totalLicencas: 50,
          validadeMeses: 12,
        });

        patrocinador = await buscarPatrocinadorPorChave("SPN-DEMO-2026");
      }

      if (!patrocinador) {
        setErro("Chave B2B não encontrada. Verifique o código com o suporte da plataforma ou utilize a demonstração.");
        return;
      }

      sessionStorage.setItem("mayamenu_b2b_token", patrocinador.chaveAcessoB2B);
      sessionStorage.setItem("mayamenu_b2b_patrocinador", JSON.stringify(patrocinador));
      onAutenticado(patrocinador);
    } catch (err: any) {
      console.error("Erro no login B2B:", err);
      setErro(err?.message || "Falha na conexão com o portal corporativo.");
    } finally {
      setProcessando(false);
    }
  };

  const handleEntrarDemo = () => {
    setChave("SPN-DEMO-2026");
  };

  return (
    <div className="relative w-full max-w-lg mx-auto p-6 sm:p-10 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl text-zinc-100 overflow-hidden">
      {/* Glows de ambientação corporativa */}
      <div className="absolute -top-24 -right-24 w-52 h-52 rounded-full bg-rose-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-52 h-52 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

      {/* CABEÇALHO */}
      <div className="relative text-center space-y-2 mb-8">
        <div className="inline-flex p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl text-blue-400 mb-2 shadow-lg shadow-blue-500/10">
          <Building2 className="w-7 h-7" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            MAYaMenu Enterprise
          </span>
          <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            B2B Trade Marketing
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Portal de Patrocinadores
        </h2>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
          Gerenciamento de lotes de licenças, catálogo oficial de produtos da marca e métricas de distribuição em restaurantes parceiros.
        </p>
      </div>

      {erro && (
        <div className="relative mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{erro}</span>
        </div>
      )}

      {/* FORMULÁRIO DE LOGIN POR CHAVE DE CONTRATO */}
      <form onSubmit={handleSubmit} className="relative space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
            Chave de Acesso B2B (Token de Contrato)
          </label>
          <Input
            type="text"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="Ex: SPN-AMBEV-2026-X9"
            required
            className="bg-zinc-950/70 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-xl h-12 uppercase tracking-wider font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
          />
        </div>

        <Button
          type="submit"
          disabled={processando}
          className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <span>{processando ? "Validando Chave..." : "Entrar no Painel B2B"}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      {/* BOTÃO DE DEMO RÁPIDO PARA TESTADORES */}
      <div className="relative mt-5 pt-5 border-t border-white/10 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleEntrarDemo}
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors group"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Usar Chave de Demonstração: <strong className="text-blue-400 font-mono">SPN-DEMO-2026</strong></span>
        </button>
      </div>
    </div>
  );
}

