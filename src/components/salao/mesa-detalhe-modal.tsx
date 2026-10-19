"use client";

import React, { useState, useEffect } from "react";
import type { MesaOperacional, ComandaGarcom } from "@/components/garcom/garcom-view";
import type { MenuItem } from "@/types";
import { CARDAPIO_DEMO } from "@/lib/mock-data";
import { escutarPedidosMesa } from "@/lib/restaurante-service";
import { useTotalComanda } from "@/hooks/useTotalComanda";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users,
  DollarSign,
  Plus,
  QrCode,
  ExternalLink,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Coffee,
  X,
  CreditCard,
  Percent,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

interface MesaDetalheModalProps {
  mesa: MesaOperacional | null;
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  restauranteId?: string;
  modoSomenteLeitura?: boolean; // Se true, esconde ações operacionais (usado no Admin)
  onMarcarPago: (mesaNumero: number, clienteId: string) => void;
  onLiberarMesa: (mesaNumero: number) => void;
  onAtenderGarcom?: (mesaNumero: number, clienteId: string) => void;
  onLancarItem: (
    mesaNumero: number,
    clienteNome: string,
    item: MenuItem,
    quantidade: number,
    observacao?: string
  ) => void;
  onSalvarObservacao?: (mesaNumero: number, observacao: string) => void;
  observacaoInicial?: string;
}

export function MesaDetalheModal({
  mesa,
  isOpen,
  onClose,
  slug,
  restauranteId,
  modoSomenteLeitura = false,
  onMarcarPago,
  onLiberarMesa,
  onAtenderGarcom,
  onLancarItem,
  onSalvarObservacao,
  observacaoInicial = "",
}: MesaDetalheModalProps) {
  const [abaInterna, setAbaInterna] = useState<"comandas" | "lancar" | "qrcode">("comandas");
  const [observacao, setObservacao] = useState(observacaoInicial);
  const [taxaServicoAtiva, setTaxaServicoAtiva] = useState(true);

  // Estados para lançamento manual
  const [clienteDestino, setClienteDestino] = useState("");
  const [itemSelecionado, setItemSelecionado] = useState<MenuItem | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [obsItem, setObsItem] = useState("");

  // Escuta os pedidos/pratos reais da mesa no Firestore quando o modal está aberto
  const [pedidosMesa, setPedidosMesa] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !mesa || (!restauranteId && !slug)) return;

    const unsub = escutarPedidosMesa(
      restauranteId || slug!,
      mesa.numero,
      (lista) => {
        setPedidosMesa(lista);
      },
      slug
    );

    return () => unsub();
  }, [isOpen, mesa?.numero, restauranteId, slug]);

  if (!mesa) return null;

  // Mescla itens dos pedidos reais nas comandas correspondentes
  const comandasComItens = mesa.comandas.map((c) => {
    if (c.itens && c.itens.length > 0) return c; // Já possui itens lançados

    const pedidosDesteCliente = pedidosMesa.filter(
      (p) => p.clienteId === c.id || p.nomeCliente?.toLowerCase() === c.nomeCliente?.toLowerCase()
    );

    const todosItens: typeof c.itens = [];
    let subtotalCalculado = 0;

    pedidosDesteCliente.forEach((p) => {
      // Ignora pedidos cancelados ou estornados
      if (p.status === "cancelado" || p.status === "estornado") return;

      if (Array.isArray(p.itens)) {
        p.itens.forEach((it: any) => {
          const valorLinha = (it.precoFinal || 0) * (it.quantidade || 1);
          subtotalCalculado += valorLinha;
          todosItens.push({
            nome: it.nome,
            quantidade: it.quantidade || 1,
            precoFinal: it.precoFinal || 0,
            modificadores: it.modificadores || [],
          });
        });
      }
    });

    return {
      ...c,
      subtotal: subtotalCalculado > 0 ? subtotalCalculado : c.subtotal,
      itens: todosItens,
    };
  });

  const totalMesa = comandasComItens.reduce((acc, c) => acc + c.subtotal, 0);
  const taxaServico = taxaServicoAtiva ? totalMesa * 0.1 : 0;
  const totalComTaxa = totalMesa + taxaServico;
  const totalPessoas = comandasComItens.length;
  const rateioIgualitario = totalPessoas > 0 ? totalComTaxa / totalPessoas : 0;

  const todasPagas =
    comandasComItens.length > 0 && comandasComItens.every((c) => c.status === "pago");

  const urlMesa = `/r/${slug}?mesa=${mesa.numero}`;
  const urlCompleta = typeof window !== "undefined" ? `${window.location.origin}${urlMesa}` : urlMesa;

  const handleConfirmarLancamento = () => {
    if (!itemSelecionado) return;
    const nomeFinal = clienteDestino.trim() || "Mesa (Geral)";
    onLancarItem(mesa.numero, nomeFinal, itemSelecionado, quantidade, obsItem.trim());
    setItemSelecionado(null);
    setQuantidade(1);
    setObsItem("");
    setAbaInterna("comandas");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] bg-neutral-900 border-neutral-800 text-white p-0 flex flex-col rounded-3xl overflow-hidden shadow-2xl">
        {/* HEADER DA MESA */}
        <DialogHeader className="p-5 sm:p-6 bg-neutral-950 border-b border-neutral-800 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shrink-0 ${
                  mesa.status === "conta_pedida"
                    ? "bg-rose-600 text-white animate-pulse"
                    : mesa.status === "paga_ocupada"
                    ? "bg-emerald-600 text-white"
                    : mesa.status === "ocupada"
                    ? "bg-amber-500 text-neutral-950"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {mesa.numero}
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                  <span>Mesa {mesa.numero}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                      mesa.status === "conta_pedida"
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                        : mesa.status === "paga_ocupada"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : mesa.status === "ocupada"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-neutral-800 text-neutral-400 border-neutral-700"
                    }`}
                  >
                    {mesa.status === "conta_pedida"
                      ? "Pediu a Conta"
                      : mesa.status === "paga_ocupada"
                      ? "Paga / Aguardando Saída"
                      : mesa.status === "ocupada"
                      ? "Ocupada / Consumindo"
                      : "Livre"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-neutral-400 mt-0.5 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-neutral-500" />
                    {totalPessoas} {totalPessoas === 1 ? "pagante" : "pagantes"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    {mesa.status === "paga_ocupada" ? "Conta liquidada" : "Atendimento ativo"}
                  </span>
                </DialogDescription>
              </div>
            </div>

            {/* TOTAL GERAL DA MESA */}
            <div className="text-right ml-auto">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                Total da Mesa
              </span>
              <span className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">
                {totalComTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>

          {/* ABAS INTERNAS */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={() => setAbaInterna("comandas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                abaInterna === "comandas"
                  ? "bg-rose-600 text-white shadow-md"
                  : "bg-neutral-800/80 text-neutral-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Comandas & Pedidos ({mesa.comandas.length})</span>
            </button>

            {!modoSomenteLeitura && (
              <button
                type="button"
                onClick={() => setAbaInterna("lancar")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  abaInterna === "lancar"
                    ? "bg-rose-600 text-white shadow-md"
                    : "bg-neutral-800/80 text-neutral-400 hover:text-white"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Lançar Item Manual</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setAbaInterna("qrcode")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                abaInterna === "qrcode"
                  ? "bg-rose-600 text-white shadow-md"
                  : "bg-neutral-800/80 text-neutral-400 hover:text-white"
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Code da Mesa</span>
            </button>
          </div>
        </DialogHeader>

        {/* CORPO DO MODAL */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-6">
          {/* 1. ABA DE COMANDAS E RATEIO */}
          {abaInterna === "comandas" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* LISTA DE COMANDAS DOS CLIENTES NA MESA */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-300">
                    Comandas na Mesa
                  </h3>
                  <span className="text-xs text-neutral-500 font-medium">
                    Rateio individual por pessoa
                  </span>
                </div>

                {comandasComItens.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-950/60 rounded-2xl border border-dashed border-neutral-800">
                    <Coffee className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-neutral-300">Nenhum pedido nesta mesa ainda</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      A mesa está livre. O cliente pode escanear o QR Code ou você pode lançar itens manualmente.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <Button
                        type="button"
                        onClick={() => setAbaInterna("lancar")}
                        className="h-9 px-4 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Lançar Pedido
                      </Button>
                      <Link href={urlMesa} target="_blank">
                        <Button
                          variant="outline"
                          className="h-9 px-4 text-xs font-bold border-neutral-700 bg-transparent hover:bg-neutral-800 text-rose-400 rounded-xl"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Abrir Cardápio
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  comandasComItens.map((comanda) => {
                    const jaPago = comanda.status === "pago";

                    return (
                      <div
                        key={comanda.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          jaPago
                            ? "bg-neutral-950 border-neutral-800/80 opacity-60"
                            : "bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-rose-600/20 text-rose-400 font-black text-xs flex items-center justify-center">
                              {comanda.nomeCliente.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <span>{comanda.nomeCliente}</span>
                                {jaPago && (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] py-0 border-none">
                                    Pago
                                  </Badge>
                                )}
                              </h4>
                              <span className="text-[10px] text-neutral-400">
                                {comanda.itens.length} {comanda.itens.length === 1 ? "item" : "itens"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-black text-white block">
                              {comanda.subtotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full inline-block ${
                                jaPago
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : comanda.status === "conta_pedida"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}
                            >
                              {jaPago
                                ? "Pago"
                                : comanda.status === "conta_pedida"
                                ? "Pediu Conta"
                                : "Consumindo"}
                            </span>
                          </div>
                        </div>

                        {/* Itens do Cliente */}
                        <div className="space-y-1.5 text-xs text-neutral-300 border-t border-neutral-800/80 pt-2 mb-3">
                          {comanda.itens.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-start">
                              <div>
                                <span className="font-semibold text-white">
                                  {it.quantidade}x {it.nome}
                                </span>
                                {it.modificadores && it.modificadores.length > 0 && (
                                  <div className="text-[10px] text-rose-400">
                                    {it.modificadores.map((m) => `${m.grupo}: ${m.opcao}`).join(", ")}
                                  </div>
                                )}
                              </div>
                              <span className="font-medium text-neutral-400">
                                {(it.precoFinal * it.quantidade).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Alerta de Chamado do Garçom */}
                        {comanda.chamadoGarcom?.ativo && (
                          <div className="mb-3 p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-200">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Bell className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                              <span>Solicitou garçom na mesa</span>
                            </div>
                            {!modoSomenteLeitura && onAtenderGarcom && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => onAtenderGarcom(mesa.numero, comanda.id)}
                                className="h-7 px-2.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg shadow-xs"
                              >
                                Marcar Atendido
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Botão de Cobrança Individual */}
                        {!jaPago && !modoSomenteLeitura && (
                          <Button
                            type="button"
                            onClick={() => onMarcarPago(mesa.numero, comanda.id)}
                            className="w-full h-9 bg-neutral-800 hover:bg-rose-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>
                              Cobrar {comanda.nomeCliente} (
                              {comanda.subtotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                              )
                            </span>
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* CARD DE RATEIO & FECHAMENTO DA CONTA */}
              <div className="md:col-span-5 space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Fechamento & Rateio</span>
                  </h3>

                  <div className="space-y-2.5 text-xs border-b border-neutral-800 pb-3">
                    <div className="flex items-center justify-between gap-2 text-neutral-300">
                      <span className="shrink-0">Subtotal Consumido:</span>
                      <span className="font-bold text-right text-white">
                        {totalMesa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-neutral-300">
                      <span className="shrink-0">Taxa de Serviço (10%):</span>
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="font-bold text-white">
                          {taxaServico.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTaxaServicoAtiva(!taxaServicoAtiva)}
                          className={`text-[10px] px-2 py-0.5 rounded font-black transition-colors ${
                            taxaServicoAtiva
                              ? "bg-rose-600/30 text-rose-300 border border-rose-500/40"
                              : "bg-neutral-800 text-neutral-500 border border-neutral-700"
                          }`}
                        >
                          {taxaServicoAtiva ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm font-black text-white pt-2 border-t border-neutral-800/60">
                      <span className="shrink-0">Total da Mesa:</span>
                      <span className="text-rose-400 text-base sm:text-lg text-right">
                        {totalComTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </div>

                  {/* DIVISÃO IGUALITÁRIA */}
                  {totalPessoas > 1 && (
                    <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 text-xs space-y-1">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                        Rateio Igualitário ({totalPessoas} pessoas)
                      </span>
                      <div className="text-base font-black text-white">
                        {rateioIgualitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        <span className="text-xs text-neutral-400 font-normal ml-1">/ pessoa</span>
                      </div>
                    </div>
                  )}

                  {/* CAMPO DE OBSERVAÇÕES DA MESA */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-neutral-500" />
                      <span>Observações da Mesa</span>
                    </label>
                    <textarea
                      rows={2}
                      value={observacao}
                      onChange={(e) => {
                        setObservacao(e.target.value);
                        onSalvarObservacao?.(mesa.numero, e.target.value);
                      }}
                      placeholder="Ex: Aniversariante, cliente alérgico a camarão..."
                      className="w-full text-xs p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>

                  {/* AÇÕES DE MESA */}
                  {!modoSomenteLeitura && (
                    <div className="pt-2 space-y-2">
                      <Button
                        type="button"
                        disabled={!todasPagas || comandasComItens.length === 0}
                        onClick={() => {
                          onClose();
                          onLiberarMesa(mesa.numero);
                        }}
                        className={`w-full h-11 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                          todasPagas && comandasComItens.length > 0
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Liberar / Finalizar Mesa {mesa.numero}</span>
                      </Button>
                      {!todasPagas && comandasComItens.length > 0 && (
                        <p className="text-[11px] text-amber-400/90 text-center flex items-center justify-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Finalize o pagamento de todas as comandas para liberar a mesa</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. ABA: LANÇAR ITEM MANUALMENTE */}
          {abaInterna === "lancar" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="border-b border-neutral-800 pb-3">
                <h3 className="text-base font-bold text-white">Lançar Item pelo Garçom</h3>
                <p className="text-xs text-neutral-400">
                  Adicione pedidos diretamente para clientes que pedirem verbalmente na mesa.
                </p>
              </div>

              {/* Escolha do Cliente */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">
                  Nome do Cliente na Mesa
                </label>
                <div className="flex flex-wrap gap-2">
                  {mesa.comandas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClienteDestino(c.nomeCliente)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        clienteDestino === c.nomeCliente
                          ? "bg-rose-600 border-rose-500 text-white"
                          : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white"
                      }`}
                    >
                      {c.nomeCliente}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setClienteDestino("")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      !clienteDestino
                        ? "bg-rose-600 border-rose-500 text-white"
                        : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white"
                    }`}
                  >
                    + Novo Cliente
                  </button>
                </div>

                {!clienteDestino && (
                  <Input
                    placeholder="Digite o nome do novo cliente (ex: João)"
                    onChange={(e) => setClienteDestino(e.target.value)}
                    className="h-10 bg-neutral-950 border-neutral-800 rounded-xl text-xs"
                  />
                )}
              </div>

              {/* Seleção do Item do Cardápio */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">
                  Selecione o Item do Cardápio
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {CARDAPIO_DEMO.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setItemSelecionado(item)}
                      className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all ${
                        itemSelecionado?.id === item.id
                          ? "bg-rose-600/20 border-rose-500 text-white"
                          : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{item.nome}</div>
                        <div className="text-[10px] text-neutral-400">
                          {item.precoBase.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </div>
                      </div>
                      {itemSelecionado?.id === item.id && (
                        <CheckCircle2 className="w-4 h-4 text-rose-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {itemSelecionado && (
                <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{itemSelecionado.nome}</span>
                    {/* Controle de Quantidade */}
                    <div className="flex items-center gap-2 bg-neutral-900 rounded-xl p-1 border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                        className="w-7 h-7 flex items-center justify-center font-bold text-xs hover:bg-neutral-800 rounded"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{quantidade}</span>
                      <button
                        type="button"
                        onClick={() => setQuantidade((q) => q + 1)}
                        className="w-7 h-7 flex items-center justify-center font-bold text-xs hover:bg-neutral-800 rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <Input
                    placeholder="Observação (ex: Sem cebola, gelo à parte)"
                    value={obsItem}
                    onChange={(e) => setObsItem(e.target.value)}
                    className="h-10 bg-neutral-900 border-neutral-800 rounded-xl text-xs"
                  />

                  <Button
                    type="button"
                    onClick={handleConfirmarLancamento}
                    className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      Adicionar na Mesa (
                      {(itemSelecionado.precoBase * quantidade).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                      )
                    </span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 3. ABA: QR CODE E LINK DA MESA FÍSICA */}
          {abaInterna === "qrcode" && (
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="p-6 bg-white rounded-3xl inline-block shadow-xl">
                <QRCodeSVG
                  value={urlCompleta}
                  size={200}
                  level="H"
                  includeMargin={true}
                  className="rounded-lg"
                />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">QR Code Físico da Mesa {mesa.numero}</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Imprima e cole este código na mesa física. O cliente escaneia com o celular e abre o cardápio automaticamente já vinculado à Mesa {mesa.numero}.
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <Link href={urlMesa} target="_blank">
                  <Button
                    variant="outline"
                    className="h-10 px-4 text-xs font-bold border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-rose-400 rounded-xl flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Testar como Cliente</span>
                  </Button>
                </Link>

                <Button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.print();
                    }
                  }}
                  className="h-10 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl flex items-center gap-2"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Imprimir QR Code</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
