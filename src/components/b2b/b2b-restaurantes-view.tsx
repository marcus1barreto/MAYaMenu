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
        <h3 className="text-lg font-black text-neutral-950 tracking-tight flex items-center gap-2">
          <span>Rede de Restaurantes Patrocinados</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
            {todosVinculados.length} estabelecimentos
          </span>
        </h3>
        <p className="text-xs text-neutral-500">
          Estes estabelecimentos ativaram a concessão da sua marca e contam com seus produtos oficiais no cardápio digital.
        </p>
      </div>

      {todosVinculados.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
            <Store className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-neutral-800">Nenhum restaurante ativado ainda</h4>
          <p className="text-xs text-neutral-500 max-w-sm mt-1">
            Compartilhe os links ou códigos de voucher da aba "Lotes de Licenças" para que os estabelecimentos parceiros ativem suas contas.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6">Restaurante</th>
                  <th className="py-4 px-6">Campanha / Lote</th>
                  <th className="py-4 px-6">Voucher</th>
                  <th className="py-4 px-6">Ativado Em</th>
                  <th className="py-4 px-6">Status da Licença</th>
                  <th className="py-4 px-6 text-right">Cardápio Digital</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {todosVinculados.map((rest, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-4 px-6 font-bold text-neutral-950 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center font-black text-xs">
                        {rest.nomeRestaurante.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="block leading-tight">{rest.nomeRestaurante}</span>
                        {rest.cidade && <span className="text-[10px] text-neutral-400 font-normal">{rest.cidade}</span>}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-neutral-600 font-medium">{rest.nomeLote}</td>

                    <td className="py-4 px-6 font-mono text-rose-700 font-bold">
                      <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                        {rest.codigoVoucherUtilizado}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-neutral-500">
                      {new Date(rest.ativadoEm).toLocaleDateString("pt-BR")}
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Ativo (Plano Pro)
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      {rest.slugRestaurante ? (
                        <a
                          href={`/r/${rest.slugRestaurante}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold hover:underline"
                        >
                          <span>Ver Cardápio</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-neutral-300">-</span>
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

