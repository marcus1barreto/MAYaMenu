"use client";

import React, { useEffect, useState } from "react";
import {
  obterHistoricoVisitas,
  type VisitaCliente,
} from "@/lib/historico-cliente";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Receipt, Calendar, MapPin, ChevronRight, Sparkles } from "lucide-react";

interface HistoricoVisitasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoricoVisitasModal({ isOpen, onClose }: HistoricoVisitasModalProps) {
  const [visitas, setVisitas] = useState<VisitaCliente[]>([]);
  const [visitaDetalhada, setVisitaDetalhada] = useState<VisitaCliente | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVisitas(obterHistoricoVisitas());
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-white p-0 rounded-3xl overflow-hidden shadow-2xl">
        <DialogHeader className="p-5 bg-neutral-950 border-b border-neutral-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600/20 text-rose-500 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white">
                Memória de Visitas
              </DialogTitle>
              <p className="text-xs text-neutral-400">
                Seus comprovantes digitais salvos neste aparelho
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
          {visitas.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 space-y-2">
              <Receipt className="w-10 h-10 mx-auto text-neutral-600" />
              <p className="text-sm font-bold text-neutral-300">Nenhum comprovante salvo ainda</p>
              <p className="text-xs text-neutral-500">
                Assim que você fizer um pedido na mesa, o recibo detalhado ficará guardado aqui no seu celular.
              </p>
            </div>
          ) : visitaDetalhada ? (
            /* DETALHES DE UM COMPROVANTE */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setVisitaDetalhada(null)}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                ← Voltar para a lista
              </button>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-black text-white">
                      {visitaDetalhada.restaurante.nome}
                    </h3>
                    <div className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                      <span>Mesa {visitaDetalhada.mesa}</span>
                      <span>•</span>
                      <span>{new Date(visitaDetalhada.dataHora).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] border-none font-bold">
                    Comprovante
                  </Badge>
                </div>

                <div className="border-t border-neutral-800 pt-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Itens Pedidos por {visitaDetalhada.clienteNome}
                  </div>
                  {visitaDetalhada.itens.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">
                          {it.quantidade}x {it.nome}
                        </span>
                        {it.modificadores && it.modificadores.length > 0 && (
                          <div className="text-[10px] text-neutral-400">
                            {it.modificadores.map((m) => `${m.grupo}: ${m.opcao}`).join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-neutral-300">
                        {(it.precoFinal * it.quantidade).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-neutral-800 pt-3 flex justify-between items-baseline">
                  <span className="text-xs uppercase font-bold text-neutral-400">Total</span>
                  <span className="text-xl font-black text-rose-400">
                    {visitaDetalhada.totalPago.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>

                <div className="text-center pt-2">
                  <span className="text-[10px] font-mono text-neutral-500">
                    Autenticação: {visitaDetalhada.comprovanteHash}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* LISTAGEM DE VISITAS */
            visitas.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisitaDetalhada(v)}
                className="w-full p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-all text-left flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                    {v.restaurante.nome}
                  </h4>
                  <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-1">
                    <span>Mesa {v.mesa}</span>
                    <span>•</span>
                    <span>{new Date(v.dataHora).toLocaleDateString("pt-BR")}</span>
                    <span>•</span>
                    <span>{v.itens.length} {v.itens.length === 1 ? "item" : "itens"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-black text-white block">
                      {v.totalPago.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    <span className="text-[9px] text-neutral-500 font-mono">
                      {v.comprovanteHash.slice(-8)}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
