"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { obterHistoricoVisitas, type VisitaCliente } from "@/lib/historico-cliente";
import {
  Receipt,
  Calendar,
  Store,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HistoricoComandasPage() {
  const [comandas, setComandas] = useState<VisitaCliente[]>([]);
  const [comandaSelecionada, setComandaSelecionada] = useState<VisitaCliente | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    try {
      const historico = obterHistoricoVisitas();
      setComandas(historico);
    } finally {
      setCarregando(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col p-4 sm:p-8 antialiased selection:bg-rose-500 selection:text-white">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col space-y-6">
        {/* CABEÇALHO */}
        <header className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/40">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Meus Recibos & Comandas
              </h1>
              <p className="text-xs text-neutral-400">
                Histórico de visitas salvo de forma privada no seu dispositivo
              </p>
            </div>
          </div>

          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white text-xs h-9 rounded-xl flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Início</span>
            </Button>
          </Link>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        {carregando ? (
          <div className="flex-1 flex items-center justify-center p-12 text-xs text-neutral-500 animate-pulse uppercase tracking-wider font-semibold">
            Carregando histórico...
          </div>
        ) : comandaSelecionada ? (
          /* DETALHE DA COMANDA SELECIONADA */
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <button
                type="button"
                onClick={() => setComandaSelecionada(null)}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar à lista de recibos</span>
              </button>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold uppercase">
                {comandaSelecionada.status === "concluido" ? "Conta Concluída" : "Comprovante"}
              </Badge>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">
                {comandaSelecionada.restaurante?.nome || "Restaurante"}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                <span>Mesa {comandaSelecionada.mesa}</span>
                <span>•</span>
                <span>
                  {new Date(comandaSelecionada.dataHora).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {comandaSelecionada.comprovanteHash && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-neutral-300">
                      {comandaSelecionada.comprovanteHash}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ITENS PEDIDOS */}
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Itens da Visita
              </div>
              <div className="space-y-2 bg-neutral-950/70 p-4 rounded-2xl border border-neutral-850">
                {comandaSelecionada.itens.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-start text-xs border-b border-neutral-850/80 pb-2 last:border-none last:pb-0"
                  >
                    <div>
                      <span className="font-bold text-white">
                        {it.quantidade}x {it.nome}
                      </span>
                      {it.modificadores && it.modificadores.length > 0 && (
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {it.modificadores.map((m) => `${m.grupo}: ${m.opcao}`).join(", ")}
                        </div>
                      )}
                      {it.observacoes && (
                        <div className="text-[10px] text-amber-400 italic mt-0.5">
                          Obs: {it.observacoes}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-neutral-300 font-medium">
                      {(it.precoFinal * it.quantidade).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* TOTAL GERAL */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-850 flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                Total Pago
              </span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {(comandaSelecionada.totalPago || comandaSelecionada.subtotal).toLocaleString(
                  "pt-BR",
                  { style: "currency", currency: "BRL" }
                )}
              </span>
            </div>
          </div>
        ) : comandas.length === 0 ? (
          /* NENHUMA COMANDA AINDA */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-900/40 border border-neutral-850 rounded-3xl space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-neutral-850 text-neutral-500 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-bold text-white">Nenhum recibo arquivado</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Quando você fizer pedidos em qualquer restaurante credenciado pelo MAYaMenu, seus
                comprovantes e itens ficam guardados aqui no seu navegador para conferência futura.
              </p>
            </div>
            <Link href="/demo">
              <Button
                variant="outline"
                className="mt-2 bg-neutral-900 border-neutral-800 text-neutral-200 text-xs rounded-xl"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                <span>Testar Cardápio na Sandbox Demo</span>
              </Button>
            </Link>
          </div>
        ) : (
          /* LISTA DE RECIBOS ANTERIORES */
          <div className="space-y-3">
            {comandas.map((v) => (
              <div
                key={v.id}
                onClick={() => setComandaSelecionada(v)}
                className="p-4 bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700/80 rounded-2xl transition-all cursor-pointer flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                      {v.restaurante?.nome || "Restaurante"}
                    </h3>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                      <span>Mesa {v.mesa}</span>
                      <span>•</span>
                      <span>
                        {new Date(v.dataHora).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-black text-white font-mono">
                      {(v.totalPago || v.subtotal).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </div>
                    <div className="text-[10px] text-emerald-400 font-semibold">
                      {v.status === "concluido" ? "Concluído" : "Comprovante"}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RODAPÉ INFORMATIVO */}
        <footer className="text-center pt-4 text-[11px] text-neutral-400">
          Privacidade Absoluta • Seus dados nunca são compartilhados ou armazenados em cookies de terceiros.
        </footer>
      </div>
    </main>
  );
}
