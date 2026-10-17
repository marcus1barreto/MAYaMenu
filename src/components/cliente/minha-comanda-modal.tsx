"use client";

import React, { useEffect, useState } from "react";
import type { PedidoRodada } from "@/types";
import { escutarPedidosCliente } from "@/lib/restaurante-service";
import { ensureClienteAnonimo } from "@/lib/firebase";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Clock,
  CheckCircle2,
  ChefHat,
  Sparkles,
  Utensils,
  AlertCircle,
  X,
} from "lucide-react";

interface MinhaComandaModalProps {
  isOpen: boolean;
  onClose: () => void;
  restauranteId: string;
  mesaNumero: number | string;
  slug: string;
  corPrimaria?: string;
  subtotalAcumulado?: number;
  statusComanda?: string | null;
  onPedirConta?: () => void;
  pedindoConta?: boolean;
  contaPedidaSucesso?: boolean;
}

export function MinhaComandaModal({
  isOpen,
  onClose,
  restauranteId,
  mesaNumero,
  slug,
  corPrimaria = "#E11D48",
  subtotalAcumulado = 0,
  statusComanda,
  onPedirConta,
  pedindoConta = false,
  contaPedidaSucesso = false,
}: MinhaComandaModalProps) {
  const [pedidos, setPedidos] = useState<PedidoRodada[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!isOpen || !restauranteId) return;

    let unsub: (() => void) | null = null;
    setCarregando(true);

    ensureClienteAnonimo().then((user) => {
      unsub = escutarPedidosCliente(restauranteId, mesaNumero, user.uid, (lista) => {
        setPedidos(lista);
        setCarregando(false);
      });
    }).catch((err) => {
      console.warn("Erro ao obter identificação para consultar comanda:", err);
      setCarregando(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [isOpen, restauranteId, mesaNumero]);

  // Total recalculado a partir dos pedidos confirmados no banco
  const totalConfirmado = pedidos.reduce((acc, p) => acc + (p.subtotal || 0), 0);
  const totalFinal = totalConfirmado > 0 ? totalConfirmado : subtotalAcumulado;

  const getStatusBadge = (status: "a_fazer" | "pronto" | "entregue") => {
    switch (status) {
      case "a_fazer":
        return (
          <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 animate-spin" />
            Na Cozinha
          </Badge>
        );
      case "pronto":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <ChefHat className="w-3 h-3 animate-bounce" />
            Pronto p/ Servir
          </Badge>
        );
      case "entregue":
        return (
          <Badge className="bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Entregue na Mesa
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-neutral-950 border-neutral-800 text-white p-0 flex flex-col h-full shadow-2xl"
      >
        {/* CABEÇALHO */}
        <SheetHeader className="p-5 bg-neutral-900 border-b border-neutral-800 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-500">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-black text-white flex items-center gap-2">
                  Minha Comanda
                  <Badge className="bg-white/10 text-neutral-300 text-[10px] font-mono">
                    Mesa {mesaNumero}
                  </Badge>
                </SheetTitle>
                <p className="text-xs text-neutral-400">
                  Acompanhe seus pratos e o total acumulado
                </p>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* LISTAGEM DE PEDIDOS / RODADAS */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {carregando ? (
            <div className="p-12 text-center text-xs text-neutral-400 space-y-2">
              <Clock className="w-8 h-8 text-rose-500 animate-spin mx-auto opacity-70" />
              <p>Consultando seus pratos no sistema...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="p-10 text-center bg-neutral-900/60 border border-neutral-800 rounded-3xl space-y-3">
              <Utensils className="w-10 h-10 text-neutral-600 mx-auto" />
              <h4 className="text-sm font-bold text-neutral-300">Nenhum pedido enviado ainda</h4>
              <p className="text-xs text-neutral-500">
                Escolha seus itens favoritos no cardápio e envie o pedido para ver o acompanhamento da cozinha aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map((pedido, idx) => (
                <div
                  key={pedido.id || idx}
                  className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-rose-500" />
                      Rodada #{idx + 1}
                    </span>
                    {getStatusBadge(pedido.status)}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {pedido.itens.map((it, itemIdx) => (
                      <div key={itemIdx} className="flex items-start justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-white">
                            {it.quantidade}x {it.nome}
                          </span>
                          {it.observacoes && (
                            <p className="text-[10px] text-neutral-400 italic">
                              Obs: {it.observacoes}
                            </p>
                          )}
                          {it.modificadores && it.modificadores.length > 0 && (
                            <p className="text-[10px] text-rose-400">
                              + {it.modificadores.map((m) => m.opcao).join(", ")}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-neutral-300 font-semibold shrink-0">
                          {((it.precoFinal || 0) * it.quantidade).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-neutral-800/80 flex justify-between items-center text-[11px]">
                    <span className="text-neutral-500 font-semibold">Subtotal da rodada</span>
                    <span className="font-mono font-bold text-neutral-200">
                      {pedido.subtotal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RODAPÉ COM SUBTOTAL E PEDIR A CONTA */}
        <div className="p-5 bg-neutral-900 border-t border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
              Total Acumulado
            </span>
            <span className="text-xl font-black text-rose-400 font-mono">
              {totalFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>

          {onPedirConta && (
            <Button
              type="button"
              onClick={onPedirConta}
              disabled={pedindoConta || contaPedidaSucesso || totalFinal === 0}
              className={`w-full h-12 rounded-xl text-xs uppercase tracking-wider font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                contaPedidaSucesso
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
              }`}
            >
              {contaPedidaSucesso ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  Conta Solicitada ao Garçom!
                </>
              ) : pedindoConta ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Chamando o Garçom...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  Pedir a Conta da Mesa
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
