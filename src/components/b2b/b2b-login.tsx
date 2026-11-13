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
      const patrocinador = await buscarPatrocinadorPorChave(chaveLimpa);

      if (!patrocinador) {
        setErro("Chave inválida, desatualizada ou sem autorização. Solicite uma credencial atualizada à administração MAYaMenu.");
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

  return (
    <div className="relative w-full max-w-lg mx-auto p-6 sm:p-10 bg-white border border-neutral-200/80 rounded-3xl shadow-xl text-neutral-900 overflow-hidden">
      {/* Glows de ambientação corporativa suave */}
      <div className="absolute -top-24 -right-24 w-52 h-52 rounded-full bg-rose-600/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-52 h-52 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

      {/* CABEÇALHO */}
      <div className="relative text-center space-y-2 mb-8">
        <div className="inline-flex p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 mb-2 shadow-xs">
          <Building2 className="w-7 h-7" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            MAYaMenu Enterprise
          </span>
          <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            B2B Trade Marketing
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-950">
          Portal de Patrocinadores
        </h2>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
          Gerenciamento de lotes de licenças, catálogo oficial de produtos da marca e métricas de distribuição em restaurantes parceiros.
        </p>
      </div>

      {erro && (
        <div className="relative mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{erro}</span>
        </div>
      )}

      {/* FORMULÁRIO DE LOGIN POR CHAVE DE CONTRATO */}
      <form onSubmit={handleSubmit} className="relative space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
            Chave de Acesso B2B (Token de Contrato)
          </label>
          <Input
            type="text"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="SPN-XXXXXXXXXXXXXXXXXXXXXXXXXX"
            required
            className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl h-12 uppercase tracking-wider font-mono text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={processando}
          className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-xs shadow-rose-600/20 transition-all flex items-center justify-center gap-2 text-sm active:scale-95"
        >
          <span>{processando ? "Validando Chave..." : "Entrar no Painel B2B"}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

