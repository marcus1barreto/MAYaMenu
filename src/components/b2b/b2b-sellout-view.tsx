"use client";

import React from "react";
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Store,
  Calendar,
  Sparkles,
  ShoppingBag,
  Clock,
} from "lucide-react";
import type { MetricasSelloutItem, ItemCatalogoPatrocinador } from "@/types/b2b";

interface B2BSelloutViewProps {
  metricas: MetricasSelloutItem[];
  itensMaster: ItemCatalogoPatrocinador[];
}

export function B2BSelloutView({ metricas, itensMaster }: B2BSelloutViewProps) {
  const totalUnidades = metricas.reduce((acc, m) => acc + (m.totalUnidadesVendidas || 0), 0);
  const totalFaturamento = metricas.reduce((acc, m) => acc + (m.faturamentoTotalEstimado || 0), 0);
  const totalRestsAtivos = Math.max(
    ...metricas.map((m) => m.restaurantesContabilizados || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div>
        <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <span>Telemetria de Sell-Out no Ponto de Venda (PDV)</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
            Tempo Real
          </span>
        </h3>
        <p className="text-xs text-zinc-400">
          Acompanhe o volume exato de unidades consumidas da sua marca nos bares e restaurantes parceiros.
        </p>
      </div>

      {/* CARDS DE KPI DE SELL-OUT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Volume Total Consumido
            </span>
            <span className="text-3xl font-black text-white mt-1 block">
              {totalUnidades.toLocaleString("pt-BR")} <span className="text-sm font-normal text-zinc-400">unidades</span>
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Faturamento no Salão
            </span>
            <span className="text-3xl font-black text-emerald-400 mt-1 block">
              {totalFaturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
              PDVs com Saída Ativa
            </span>
            <span className="text-3xl font-black text-blue-400 mt-1 block">
              {totalRestsAtivos} <span className="text-sm font-normal text-zinc-400">restaurantes</span>
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
            <Store className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* DESEMPENHO POR PRODUTO DA MARCA */}
      {metricas.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/50 rounded-3xl border border-white/5 flex flex-col items-center">
          <TrendingUp className="w-12 h-12 text-zinc-700 mb-3" />
          <h4 className="text-base font-bold text-zinc-300">Aguardando primeiras comandas pagas</h4>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            À medida que os clientes dos restaurantes parceiros fizerem pedidos dos seus produtos e fecharem suas comandas, as métricas de sell-out serão atualizadas aqui em tempo real.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
            Desempenho por Produto Oficial
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metricas.map((m) => {
              const itemInfo = itensMaster.find((it) => it.id === m.itemId || `spn-${it.id}` === m.itemId);
              const percTotal = totalUnidades > 0 ? Math.round((m.totalUnidadesVendidas / totalUnidades) * 100) : 0;

              return (
                <div
                  key={m.itemId}
                  className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-800 overflow-hidden border border-white/10 shrink-0">
                          <img
                            src={itemInfo?.fotoOficialUrl || "/images/demo/coquetel.webp"}
                            alt={m.itemNome}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/images/demo/coquetel.webp";
                            }}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-blue-400 block">
                            {itemInfo?.categoriaSugerida || "Produto Oficial"}
                          </span>
                          <h4 className="text-sm font-black text-white">{m.itemNome}</h4>
                        </div>
                      </div>

                      <span className="text-xs font-mono font-bold text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-800 border border-white/10">
                        {percTotal}% do mix
                      </span>
                    </div>

                    {/* BARRA DE PARTICIPAÇÃO */}
                    <div className="space-y-1 mt-3">
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${percTotal}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold">Total Vendido</span>
                      <span className="font-black text-white text-base">
                        {m.totalUnidadesVendidas} un.
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold">Faturamento PDV</span>
                      <span className="font-black text-emerald-400 text-base">
                        {m.faturamentoTotalEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </div>

                  {m.ultimaVendaEm && (
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span>Última saída: {new Date(m.ultimaVendaEm).toLocaleDateString("pt-BR")} às {new Date(m.ultimaVendaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
