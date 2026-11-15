"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  ChefHat,
  CreditCard,
  FileText,
  Lock,
  Plus,
  QrCode,
  Unlock,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
  const [mesaSelecionadaNum, setMesaSelecionadaNum] = useState<number | null>(null);
  const [abaModal, setAbaModal] = useState<"comandas" | "qrcode">("comandas");

  const mesaSelecionada =
    mesas.find((m) => m.numero === mesaSelecionadaNum) ?? null;

  const subtotal = mesaSelecionada
    ? mesaSelecionada.itens.reduce(
        (acc, item) => acc + item.preco * item.quantidade,
        0
      )
    : 0;
  const temItensNaoServidos = mesaSelecionada
    ? mesaSelecionada.itens.some((item) => item.status !== "servido")
    : false;
  const podeCobrar = Boolean(
    mesaSelecionada &&
      mesaSelecionada.status === "ocupada" &&
      !mesaSelecionada.paga &&
      mesaSelecionada.itens.length > 0 &&
      !temItensNaoServidos
  );

  return (
    <div className="space-y-4">
      {/* CABEÇALHO ESTILO /ADMIN MONITOR AO VIVO */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Clique em qualquer mesa para abrir a comanda, lançar pedido, cobrar ou liberar.
        </p>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-neutral-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Livre
          </span>
          <span className="flex items-center gap-1.5 text-amber-600">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Ocupada
          </span>
          <span className="flex items-center gap-1.5 text-rose-600">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Chamando / Pago
          </span>
        </div>
      </div>

      {/* GRADE DE 5 MESAS ESTILO REAL /ADMIN */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {mesas.map((mesa) => {
          const totalMesa = mesa.itens.reduce(
            (acc, item) => acc + item.preco * item.quantidade,
            0
          );

          return (
            <button
              key={mesa.numero}
              type="button"
              onClick={() => {
                setMesaSelecionadaNum(mesa.numero);
                setAbaModal("comandas");
              }}
              className={`text-left rounded-2xl border bg-white p-4 transition-all hover:shadow-md cursor-pointer ${
                mesa.chamadoAtivo
                  ? "border-rose-400 ring-2 ring-rose-200/70"
                  : mesa.status === "ocupada"
                  ? "border-amber-300"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-800 font-bold text-sm flex items-center justify-center">
                  {mesa.numero}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    mesa.status === "livre"
                      ? "bg-neutral-50 text-neutral-600 border-neutral-200"
                      : mesa.paga
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {mesa.status === "livre"
                    ? "LIVRE"
                    : mesa.paga
                    ? "PAGO"
                    : "OCUPADA"}
                </Badge>
              </div>

              <p className="font-bold text-sm text-neutral-900">
                Mesa {mesa.numero}
              </p>

              {mesa.chamadoAtivo ? (
                <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-0.5">
                  <Bell className="w-3 h-3" />
                  Chamando
                </p>
              ) : mesa.status === "livre" ? (
                <p className="text-[11px] font-medium text-emerald-600 mt-0.5">
                  • Disponível
                </p>
              ) : (
                <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
                  • R$ {totalMesa.toFixed(2)}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* MODAL DA MESA ESTILO REAL /ADMIN */}
      <Dialog
        open={Boolean(mesaSelecionada)}
        onOpenChange={(open) => !open && setMesaSelecionadaNum(null)}
      >
        <DialogContent className="max-w-3xl bg-white border-neutral-200 text-neutral-900 rounded-3xl p-6 shadow-2xl">
          {mesaSelecionada && (
            <div className="space-y-5">
              {/* CABEÇALHO DO MODAL */}
              <DialogHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-800 font-black text-base flex items-center justify-center">
                    {mesaSelecionada.numero}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-lg font-black text-neutral-900">
                        Mesa {mesaSelecionada.numero}
                      </DialogTitle>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold uppercase"
                      >
                        {mesaSelecionada.status === "livre"
                          ? "LIVRE"
                          : mesaSelecionada.paga
                          ? "PAGO"
                          : "OCUPADA"}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Atendimento direto no Admin (Plano Free)
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    TOTAL DA MESA
                  </p>
                  <p className="text-xl font-black text-rose-600">
                    R$ {subtotal.toFixed(2)}
                  </p>
                </div>
              </DialogHeader>

              {/* ABAS DO MODAL */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAbaModal("comandas")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    abaModal === "comandas"
                      ? "bg-rose-600 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  Comandas &amp; Pedidos ({mesaSelecionada.itens.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAbaModal("qrcode")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    abaModal === "qrcode"
                      ? "bg-rose-600 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR Code da Mesa
                </button>
              </div>

              {abaModal === "comandas" ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* COLUNA ESQUERDA: COMANDAS NA MESA */}
                  <div className="md:col-span-7 border border-neutral-200 rounded-2xl p-4 space-y-3 bg-neutral-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        COMANDAS NA MESA
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onAlternarChamado(mesaSelecionada.numero)
                          }
                          className="h-7 text-[11px] font-semibold rounded-lg"
                        >
                          <Bell className="w-3 h-3 mr-1" />
                          {mesaSelecionada.chamadoAtivo
                            ? "Atendido"
                            : "Chamar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            onAdicionarPedidoTeste(mesaSelecionada.numero)
                          }
                          className="h-7 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Lançar Pedido
                        </Button>
                      </div>
                    </div>

                    {mesaSelecionada.itens.length === 0 ? (
                      <div className="py-8 text-center text-xs text-neutral-500">
                        Nenhum pedido nesta mesa ainda. Clique em{" "}
                        <strong>Lançar Pedido</strong> para testar.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {mesaSelecionada.itens.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                          >
                            <span className="font-semibold text-neutral-800 truncate">
                              {item.quantidade}x {item.nome}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                              <span className="font-mono text-neutral-600">
                                R$ {(item.preco * item.quantidade).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* COLUNA DIREITA: FECHAMENTO & RATEIO */}
                  <div className="md:col-span-5 border border-neutral-200 rounded-2xl p-4 space-y-3 bg-white">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
                      FECHAMENTO &amp; RATEIO
                    </span>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-neutral-600">
                        <span>Subtotal Consumido:</span>
                        <span className="font-semibold text-neutral-900">
                          R$ {subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-black text-sm pt-2 border-t border-neutral-100">
                        <span>Total da Mesa:</span>
                        <span className="text-rose-600">
                          R$ {subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {mesaSelecionada.status === "ocupada" &&
                      !mesaSelecionada.paga && (
                        <Button
                          type="button"
                          disabled={!podeCobrar}
                          onClick={() => onCobrarMesa(mesaSelecionada.numero)}
                          className="w-full h-9 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                        >
                          {temItensNaoServidos ? (
                            <>
                              <Lock className="w-3.5 h-3.5 mr-1.5" />
                              Aguardando Cozinha Servir
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                              Cobrar R$ {subtotal.toFixed(2)}
                            </>
                          )}
                        </Button>
                      )}

                    {mesaSelecionada.paga && (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onGerarComprovante(mesaSelecionada)}
                          className="w-full h-9 text-xs font-bold rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          Comprovante Sem Papel (80mm)
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            onLiberarMesa(mesaSelecionada.numero);
                            setMesaSelecionadaNum(null);
                          }}
                          className="w-full h-9 text-xs font-bold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white"
                        >
                          <Unlock className="w-3.5 h-3.5 mr-1.5" />
                          Encerrar e Liberar Mesa
                        </Button>
                      </div>
                    )}

                    {mesaSelecionada.status === "ocupada" &&
                      !mesaSelecionada.paga &&
                      temItensNaoServidos && (
                        <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <ChefHat className="w-3 h-3 text-amber-600 shrink-0" />
                          Vá em <strong>Cozinha</strong> para marchar e servir.
                        </p>
                      )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <div className="p-4 bg-white rounded-2xl border border-neutral-200 inline-block">
                    <QRCodeSVG
                      value={`https://mayamenu.com.br/demo?mesa=${mesaSelecionada.numero}`}
                      size={160}
                      level="M"
                    />
                  </div>
                  <p className="text-xs text-neutral-500">
                    QR Code exclusivo da <strong>Mesa {mesaSelecionada.numero}</strong>.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
