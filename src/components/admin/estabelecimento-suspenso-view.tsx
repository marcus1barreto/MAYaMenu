"use client";

import React from "react";
import { AlertTriangle, LogOut, PhoneCall } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import type { Restaurante } from "@/types";

export function EstabelecimentoSuspensoView({ restaurante }: { restaurante: Restaurante }) {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 antialiased">
      <div className="max-w-md w-full bg-neutral-900 border border-rose-900/40 rounded-3xl p-8 space-y-6 text-center shadow-2xl relative overflow-hidden">
        {/* Glow effect sutil */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-400 bg-rose-950/60 px-3 py-1 rounded-full border border-rose-800/40">
            Acesso Temporariamente Suspenso
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {restaurante.nome}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            As operações e o cardápio digital deste estabelecimento foram suspensos pela gerência geral. 
            Nenhum pedido ou acesso às mesas poderá ser realizado enquanto a suspensão estiver ativa.
          </p>
        </div>

        <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-2xl space-y-1.5 text-left text-xs">
          <div className="text-neutral-500 text-[10px] font-bold uppercase">Como reativar?</div>
          <div className="text-neutral-300 flex items-center gap-2">
            <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
            <span>Entre em contato com o administrador da sua concessão MAYaRAnas.</span>
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={() => logout()}
            variant="outline"
            className="w-full bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700 rounded-xl h-10 text-xs font-bold flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-neutral-400" />
            Desconectar da Conta
          </Button>
        </div>
      </div>
    </div>
  );
}
