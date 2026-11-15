"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  CreditCard,
  FileText,
  Lock,
  Plus,
  Unlock,
  Utensils,
} from "lucide-react";

export type DemoItemStatus = "pendente" | "preparando" | "servido";

export interface DemoPedidoItem {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
  status: DemoItemStatus;
}

export interface DemoMesa {
  numero: number;
  status: "livre" | "ocupada";
  chamadoAtivo: boolean;
  paga: boolean;
  itens: DemoPedidoItem[];
}

interface DemoAdminMesasProps {
  mesas: DemoMesa[];
  onAdicionarPedidoTeste: (numeroMesa: number) => void;
  onAlternarChamado: (numeroMesa: number) => void;
  onCobrarMesa: (numeroMesa: number) => void;
  onGerarComprovante: (mesa: DemoMesa) => void;
  onLiberarMesa: (numeroMesa: number) => void;
}

export function DemoAdminMesas({
  mesas,
  onAdicionarPedidoTeste,
  onAlternarChamado,
  onCobrarMesa,
  onGerarComprovante,
  onLiberarMesa,
}: DemoAdminMesasProps) {
  const ocupadas = mesas.filter((m) => m.status === "ocupada").length;
  const chamados = mesas.filter((m) => m.chamadoAtivo).length;

  return (
    <div className="space-y-5">
      {/* RESUMO DO PLANO FREE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Plano Atual
          </p>
          <p className="text-base font-black text-foreground mt-0.5">
            Free (5 Mesas)
          </p>
          <p className="text-[11px] text-emerald-600 font-medium">
            + R$ 8/mês por mesa extra
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Mesas Ocupadas
          </p>
          <p className="text-base font-black text-foreground mt-0.5">
            {ocupadas} / {mesas.length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Operação direta no Admin
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Chamados Ativos
          </p>
          <p className="text-base font-black text-amber-600 mt-0.5">
            {chamados}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Botão flutuante da mesa
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Comprovante
          </p>
          <p className="text-base font-black text-foreground mt-0.5">
            Sem Papel (80mm)
          </p>
          <p className="text-[11px] text-muted-foreground">
            PDF térmico instantâneo
          </p>
        </div>
      </div>

      {/* GRADE DAS 5 MESAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mesas.map((mesa) => {
          const total = mesa.itens.reduce(
            (acc, item) => acc + item.preco * item.quantidade,
            0
          );
          const temItensNaoServidos = mesa.itens.some(
            (item) => item.status !== "servido"
          );
          const podeCobrar =
            mesa.status === "ocupada" &&
            !mesa.paga &&
            mesa.itens.length > 0 &&
            !temItensNaoServidos;

          return (
            <div
              key={mesa.numero}
              className={`rounded-2xl border p-4 bg-card flex flex-col justify-between gap-3 transition-all ${
                mesa.chamadoAtivo
                  ? "border-amber-400 ring-2 ring-amber-200/60"
                  : mesa.status === "ocupada"
                  ? "border-rose-200"
                  : "border-border"
              }`}
            >
              <div className="space-y-3">
                {/* CABEÇALHO DA MESA */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-neutral-900 text-white font-black text-sm flex items-center justify-center">
                      {mesa.numero}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        Mesa {mesa.numero}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {mesa.status === "livre"
                          ? "Livre para novo cliente"
                          : mesa.paga
                          ? "Paga — aguardando liberação"
                          : "Atendimento em andamento"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {mesa.chamadoAtivo && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                        <Bell className="w-3 h-3 mr-1" />
                        Chamando
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        mesa.status === "livre"
                          ? "text-emerald-700 border-emerald-200 bg-emerald-50 text-[10px]"
                          : mesa.paga
                          ? "text-blue-700 border-blue-200 bg-blue-50 text-[10px]"
                          : "text-rose-700 border-rose-200 bg-rose-50 text-[10px]"
                      }
                    >
                      {mesa.status === "livre"
                        ? "Livre"
                        : mesa.paga
                        ? "Pago"
                        : "Ocupada"}
                    </Badge>
                  </div>
                </div>

                {/* ITENS DA MESA */}
                {mesa.itens.length > 0 ? (
                  <div className="bg-muted/40 rounded-xl p-2.5 space-y-1.5 border border-border/60">
                    {mesa.itens.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs gap-2"
                      >
                        <span className="truncate font-medium text-foreground">
                          {item.quantidade}x {item.nome}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                              item.status === "servido"
                                ? "bg-emerald-100 text-emerald-700"
                                : item.status === "preparando"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-neutral-200 text-neutral-700"
                            }`}
                          >
                            {item.status === "servido"
                              ? "Servido"
                              : item.status === "preparando"
                              ? "Preparando"
                              : "Na Cozinha"}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            R$ {(item.preco * item.quantidade).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-1.5 mt-1.5 border-t border-border flex items-center justify-between text-xs font-bold">
                      <span>Total da Mesa</span>
                      <span>R$ {total.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/20 rounded-xl p-3 text-center text-xs text-muted-foreground border border-dashed border-border">
                    Nenhum pedido ativo nesta mesa.
                  </div>
                )}
              </div>

              {/* AÇÕES DA MESA */}
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAdicionarPedidoTeste(mesa.numero)}
                    className="flex-1 h-8 text-xs font-semibold rounded-xl"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Simular Pedido
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mesa.chamadoAtivo ? "default" : "outline"}
                    onClick={() => onAlternarChamado(mesa.numero)}
                    className={`h-8 text-xs font-semibold rounded-xl ${
                      mesa.chamadoAtivo
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : ""
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5 mr-1" />
                    {mesa.chamadoAtivo ? "Atendido" : "Chamar"}
                  </Button>
                </div>

                {mesa.status === "ocupada" && !mesa.paga && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!podeCobrar}
                    onClick={() => onCobrarMesa(mesa.numero)}
                    className="w-full h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                  >
                    {temItensNaoServidos ? (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1.5" />
                        Aguardando Cozinha Servir
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                        Cobrar R$ {total.toFixed(2)}
                      </>
                    )}
                  </Button>
                )}

                {mesa.paga && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onGerarComprovante(mesa)}
                      className="flex-1 h-8 text-xs font-bold rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Comprovante 80mm
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onLiberarMesa(mesa.numero)}
                      className="flex-1 h-8 text-xs font-bold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white"
                    >
                      <Unlock className="w-3.5 h-3.5 mr-1.5" />
                      Liberar Mesa
                    </Button>
                  </div>
                )}

                {mesa.status === "ocupada" && !mesa.paga && temItensNaoServidos && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ChefHat className="w-3 h-3 text-amber-600 shrink-0" />
                    Vá na aba <strong>Cozinha</strong> para marchar e marcar como servido.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
