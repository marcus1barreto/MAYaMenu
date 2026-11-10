"use client";

import React from "react";
import { Store, Calendar, ExternalLink, ShieldCheck, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LoteLicencasB2B } from "@/types/b2b";

interface B2BRestaurantesViewProps {
  lotes: LoteLicencasB2B[];
}

export function B2BRestaurantesView({ lotes }: B2BRestaurantesViewProps) {
  // Concatena todos os restaurantes vinculados de todos os lotes
  const todosVinculados = lotes.flatMap((lote) =>
    (lote.restaurantesVinculados || []).map((r) => ({
      ...r,
      nomeLote: lote.nome,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <span>Rede de Restaurantes Patrocinados</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
            {todosVinculados.length} estabelecimentos
          </span>
        </h3>
        <p className="text-xs text-zinc-400">
          Estes estabelecimentos ativaram a concessão da sua marca e contam com seus produtos oficiais no cardápio digital.
        </p>
      </div>

      {todosVinculados.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/50 rounded-3xl border border-white/5 flex flex-col items-center">
          <Store className="w-12 h-12 text-zinc-700 mb-3" />
          <h4 className="text-base font-bold text-zinc-300">Nenhum restaurante ativado ainda</h4>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Compartilhe os links ou códigos de voucher da aba "Lotes de Licenças" para que os estabelecimentos parceiros ativem suas contas.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 border-b border-white/5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6">Restaurante</th>
                  <th className="py-4 px-6">Campanha / Lote</th>
                  <th className="py-4 px-6">Voucher</th>
                  <th className="py-4 px-6">Ativado Em</th>
                  <th className="py-4 px-6">Status da Licença</th>
                  <th className="py-4 px-6 text-right">Cardápio Digital</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {todosVinculados.map((rest, idx) => (
                  <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-white flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs">
                        {rest.nomeRestaurante.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="block leading-tight">{rest.nomeRestaurante}</span>
                        {rest.cidade && <span className="text-[10px] text-zinc-500 font-normal">{rest.cidade}</span>}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-zinc-400">{rest.nomeLote}</td>

                    <td className="py-4 px-6 font-mono text-blue-400 font-bold">
                      {rest.codigoVoucherUtilizado}
                    </td>

                    <td className="py-4 px-6 text-zinc-400">
                      {new Date(rest.ativadoEm).toLocaleDateString("pt-BR")}
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Ativo (Plano Plus)
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      {rest.slugRestaurante ? (
                        <a
                          href={`/r/${rest.slugRestaurante}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold underline"
                        >
                          <span>Ver Cardápio</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

