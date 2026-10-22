"use client";

import React, { useEffect, useState } from "react";
import type { PedidoRodada, StatusPedido } from "@/types";
import { escutarPedidosCliente } from "@/lib/restaurante-service";
import { ensureClienteAnonimo, db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
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
  Users,
  User,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { buildTicketPayload, encodeTicket } from "@/lib/ticket";

interface MinhaComandaModalProps {
  isOpen: boolean;
  onClose: () => void;
  restauranteId: string;
  mesaNumero: number | string;
  slug: string;
  corPrimaria?: string;
  subtotalAcumulado?: number;
  statusComanda?: string | null;
  ehAutoatendimento?: boolean;
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
  ehAutoatendimento = false,
  onPedirConta,
  pedindoConta = false,
  contaPedidaSucesso = false,
}: MinhaComandaModalProps) {
  const [pedidos, setPedidos] = useState<PedidoRodada[]>([]);
  const [subtotalMesa, setSubtotalMesa] = useState<number>(0);
  const [carregando, setCarregando] = useState(true);
  const [pedindoMesaToda, setPedindoMesaToda] = useState(false);
  const [mesaTodaPedidaSucesso, setMesaTodaPedidaSucesso] = useState(false);
  const [clienteUid, setClienteUid] = useState<string>("");
  const [mostrarSyncQr, setMostrarSyncQr] = useState<boolean>(false);
  const [estiloCarteira, setEstiloCarteira] = useState<"couro-marrom" | "preto-fosco">("couro-marrom");

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("mayamenu_estilo_carteira") as any;
      if (salvo === "preto-fosco" || salvo === "couro-marrom") {
        setEstiloCarteira(salvo);
      }
    } catch {
      // Ignora erro de localStorage
    }
  }, []);

  const alternarEstiloCarteira = (novoEstilo: "couro-marrom" | "preto-fosco") => {
    setEstiloCarteira(novoEstilo);
    try {
      localStorage.setItem("mayamenu_estilo_carteira", novoEstilo);
    } catch {
      // Ignora erro de localStorage
    }
  };

  useEffect(() => {
    if (!isOpen || !restauranteId) return;

    let unsub: (() => void) | null = null;
    setCarregando(true);

    ensureClienteAnonimo().then((user) => {
      setClienteUid(user.uid);
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

  // Escuta todas as comandas da mesa para rateio/total geral da mesa
  useEffect(() => {
    if (!isOpen || !restauranteId) return;

    try {
      const colRef = collection(
        db,
        "restaurantes",
        restauranteId,
        "mesas",
        String(mesaNumero),
        "comandas_abertas"
      );

      const unsubMesa = onSnapshot(
        colRef,
        (snap) => {
          let total = 0;
          snap.forEach((d) => {
            const data = d.data();
            total += Number(data.subtotal) || 0;
          });
          setSubtotalMesa(total);
        },
        (err) => {
          console.warn("Aviso ao escutar total da mesa para rateio:", err);
        }
      );

      return () => unsubMesa();
    } catch (e) {
      console.warn("Falha ao inicializar listener de total da mesa:", e);
    }
  }, [isOpen, restauranteId, mesaNumero]);

  // Total recalculado a partir dos pedidos confirmados no banco
  const totalConfirmado = pedidos.reduce((acc, p) => acc + (p.subtotal || 0), 0);
  const totalCliente = totalConfirmado > 0 ? totalConfirmado : subtotalAcumulado;
  const totalGeralMesa = Math.max(subtotalMesa, totalCliente);

  // Solicitar pagamento da mesa completa
  const handlePagarMesaCompleta = async () => {
    if (pedindoMesaToda || mesaTodaPedidaSucesso) return;
    const confirmou = window.confirm(
      `Deseja solicitar o fechamento da MESA COMPLETA (${mesaNumero}) no valor de ${totalGeralMesa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}?`
    );
    if (!confirmou) return;

    setPedindoMesaToda(true);
    try {
      const user = await ensureClienteAnonimo();
      const comandaRef = doc(
        db,
        "restaurantes",
        restauranteId,
        "mesas",
        String(mesaNumero),
        "comandas_abertas",
        user.uid
      );

      await updateDoc(comandaRef, {
        status: "conta_pedida",
        chamadoGarcom: {
          ativo: true,
          motivo: `Fechamento Geral da Mesa ${mesaNumero} (Conta Completa)`,
          solicitadoEm: serverTimestamp(),
        },
        atualizadoEm: serverTimestamp(),
      });
      setMesaTodaPedidaSucesso(true);
    } catch (e) {
      console.warn("Aviso ao pedir conta completa:", e);
      setMesaTodaPedidaSucesso(true);
    } finally {
      setPedindoMesaToda(false);
    }
  };

  const getStatusBadge = (status: StatusPedido) => {
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
            {ehAutoatendimento ? "Pronto p/ Retirar" : "Pronto p/ Servir"}
          </Badge>
        );
      case "entregue":
        return (
          <Badge className="bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {ehAutoatendimento ? "Retirado" : "Entregue na Mesa"}
          </Badge>
        );
      case "cancelado":
      case "estornado":
        return (
          <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {status === "cancelado" ? "Cancelado" : "Estornado"}
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
        className={`w-full sm:max-w-md p-0 flex flex-col h-full shadow-2xl transition-all duration-300 border-l ${
          estiloCarteira === "couro-marrom"
            ? "carteira-couro-marrom costura-carteira border-amber-900/60"
            : "carteira-preto-fosco costura-carteira-preto border-neutral-700/60"
        }`}
      >
        {/* CABEÇALHO DA CARTEIRA DE CONTA */}
        <SheetHeader
          className={`p-5 pr-12 border-b flex flex-col gap-2 transition-colors ${
            estiloCarteira === "couro-marrom"
              ? "bg-[#2b180d]/90 border-amber-800/40"
              : "bg-neutral-900/90 border-neutral-800"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl border shadow-inner ${
                  estiloCarteira === "couro-marrom"
                    ? "bg-amber-900/40 border-amber-700/50 text-amber-300"
                    : "bg-neutral-800 border-neutral-700 text-neutral-300"
                }`}
              >
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle
                  className={`text-base font-black flex items-center gap-2 tracking-tight ${
                    estiloCarteira === "couro-marrom" ? "text-amber-100" : "text-white"
                  }`}
                >
                  Porta-Conta da Mesa
                  <Badge
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      estiloCarteira === "couro-marrom"
                        ? "bg-amber-950/60 text-amber-300 border-amber-700/50"
                        : "bg-neutral-800 text-neutral-300 border-neutral-700"
                    }`}
                  >
                    Mesa {mesaNumero}
                  </Badge>
                </SheetTitle>
                <p
                  className={`text-xs ${
                    estiloCarteira === "couro-marrom" ? "text-amber-200/60" : "text-neutral-400"
                  }`}
                >
                  Extrato e encerramento de despesas
                </p>
              </div>
            </div>

            {/* SELETOR DE ACABAMENTO DO COURO (PRETO FOSCO VS COURO MARROM) */}
            <div
              className={`flex items-center p-0.5 rounded-xl border text-[10px] font-bold ${
                estiloCarteira === "couro-marrom"
                  ? "bg-black/30 border-amber-800/50"
                  : "bg-black/40 border-neutral-700"
              }`}
              title="Escolha o acabamento da carteira de conta"
            >
              <button
                type="button"
                onClick={() => alternarEstiloCarteira("couro-marrom")}
                className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  estiloCarteira === "couro-marrom"
                    ? "bg-amber-800/80 text-amber-100 shadow-sm font-black"
                    : "text-amber-300/60 hover:text-amber-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#78350f] inline-block border border-amber-400" />
                <span>Couro</span>
              </button>
              <button
                type="button"
                onClick={() => alternarEstiloCarteira("preto-fosco")}
                className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  estiloCarteira === "preto-fosco"
                    ? "bg-neutral-800 text-white shadow-sm font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-neutral-900 inline-block border border-neutral-500" />
                <span>Preto</span>
              </button>
            </div>
          </div>
        </SheetHeader>

        {/* LISTAGEM DE PEDIDOS / RODADAS */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {carregando ? (
            <div className="p-12 text-center text-xs text-neutral-400 space-y-2">
              <Clock className="w-8 h-8 text-amber-500 animate-spin mx-auto opacity-70" />
              <p>Consultando seus pratos no sistema...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div
              className={`p-10 text-center rounded-3xl space-y-3 border-2 border-dashed ${
                estiloCarteira === "couro-marrom"
                  ? "bg-amber-950/20 border-amber-800/40 text-amber-200/70"
                  : "bg-neutral-900/60 border-neutral-800 text-neutral-400"
              }`}
            >
              <Utensils
                className={`w-10 h-10 mx-auto ${
                  estiloCarteira === "couro-marrom" ? "text-amber-700" : "text-neutral-600"
                }`}
              />
              <h4
                className={`text-sm font-bold ${
                  estiloCarteira === "couro-marrom" ? "text-amber-100" : "text-neutral-200"
                }`}
              >
                Nenhum pedido lançado nesta comanda
              </h4>
              <p className="text-xs opacity-75">
                Peça pratos ou bebidas no cardápio para acompanhar os valores da sua mesa aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map((pedido, idx) => (
                <div
                  key={pedido.id || idx}
                  className={`p-4 rounded-2xl space-y-2.5 transition-all shadow-md border ${
                    estiloCarteira === "couro-marrom"
                      ? "bg-[#29170c]/90 border-amber-900/50 shadow-black/40 text-amber-50"
                      : "bg-[#161618]/90 border-neutral-800 shadow-black/50 text-neutral-100"
                  }`}
                >
                  <div
                    className={`flex items-center justify-between border-b pb-2 ${
                      estiloCarteira === "couro-marrom" ? "border-amber-900/40" : "border-neutral-800/80"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        estiloCarteira === "couro-marrom" ? "text-amber-300" : "text-neutral-300"
                      }`}
                    >
                      <Sparkles
                        className={`w-3 h-3 ${
                          estiloCarteira === "couro-marrom" ? "text-amber-400" : "text-neutral-400"
                        }`}
                      />
                      Rodada #{idx + 1}
                    </span>
                    {getStatusBadge(pedido.status)}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {pedido.itens.map((it, itemIdx) => (
                      <div key={itemIdx} className="flex items-start justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <span
                            className={`font-bold ${
                              estiloCarteira === "couro-marrom" ? "text-amber-100" : "text-white"
                            }`}
                          >
                            {it.quantidade}x {it.nome}
                          </span>
                          {it.observacoes && (
                            <p
                              className={`text-[10px] italic ${
                                estiloCarteira === "couro-marrom"
                                  ? "text-amber-200/60"
                                  : "text-neutral-400"
                              }`}
                            >
                              Obs: {it.observacoes}
                            </p>
                          )}
                          {it.modificadores && it.modificadores.length > 0 && (
                            <p
                              className={`text-[10px] ${
                                estiloCarteira === "couro-marrom"
                                  ? "text-amber-400 font-medium"
                                  : "text-rose-400 font-medium"
                              }`}
                            >
                              + {it.modificadores.map((m) => m.opcao).join(", ")}
                            </p>
                          )}
                        </div>
                        <span
                          className={`font-mono font-semibold shrink-0 ${
                            estiloCarteira === "couro-marrom" ? "text-amber-200" : "text-neutral-300"
                          }`}
                        >
                          {((it.precoFinal || 0) * it.quantidade).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`pt-2 border-t flex justify-between items-center text-[11px] ${
                      estiloCarteira === "couro-marrom"
                        ? "border-amber-900/40"
                        : "border-neutral-800/80"
                    }`}
                  >
                    <span
                      className={
                        estiloCarteira === "couro-marrom"
                          ? "text-amber-300/70 font-semibold"
                          : "text-neutral-500 font-semibold"
                      }
                    >
                      Subtotal da rodada
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        estiloCarteira === "couro-marrom" ? "text-amber-200" : "text-neutral-200"
                      }`}
                    >
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

        {/* RODAPÉ: O TALÃO DA CONTA INSERIDO NO BOLSO DA CARTEIRA */}
        <div
          className={`p-5 border-t space-y-3.5 transition-colors relative z-10 ${
            estiloCarteira === "couro-marrom"
              ? "bg-[#1d1008] border-amber-900/60"
              : "bg-[#0f0f10] border-neutral-800"
          }`}
        >
          {/* TALÃO / EXTRATO DE DESPESA (SIMULANDO O PAPEL TÉRMICO / NOTA DA CONTA) */}
          <div
            className={`space-y-2 p-3.5 rounded-2xl border shadow-inner transition-all ${
              estiloCarteira === "couro-marrom"
                ? "bg-[#25140b] border-amber-800/60 shadow-black/50"
                : "bg-neutral-900 border-neutral-700/60 shadow-black/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 ${
                  estiloCarteira === "couro-marrom" ? "text-amber-200/80" : "text-neutral-300"
                }`}
              >
                <User
                  className={`w-3.5 h-3.5 ${
                    estiloCarteira === "couro-marrom" ? "text-amber-400" : "text-rose-400"
                  }`}
                />
                A Minha Comanda:
              </span>
              <span
                className={`text-base font-black font-mono ${
                  estiloCarteira === "couro-marrom" ? "text-amber-300" : "text-rose-400"
                }`}
              >
                {totalCliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <div
              className={`flex items-center justify-between pt-2 border-t ${
                estiloCarteira === "couro-marrom" ? "border-amber-900/50" : "border-neutral-800"
              }`}
            >
              <span
                className={`text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 ${
                  estiloCarteira === "couro-marrom" ? "text-amber-200/80" : "text-neutral-300"
                }`}
              >
                <Users
                  className={`w-3.5 h-3.5 ${
                    estiloCarteira === "couro-marrom" ? "text-amber-400" : "text-amber-400"
                  }`}
                />
                Total da Mesa:
              </span>
              <span className="text-base font-black text-amber-400 font-mono">
                {totalGeralMesa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>

          {/* PROTOCOLO MAYA SYNC-QR (Comanda-Espelho Dinâmica Descentralizada) */}
          <div
            className={`pt-2 border-t ${
              estiloCarteira === "couro-marrom" ? "border-amber-900/40" : "border-neutral-800"
            }`}
          >
            <button
              type="button"
              onClick={() => setMostrarSyncQr((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-between transition-all ${
                estiloCarteira === "couro-marrom"
                  ? "bg-amber-950/40 hover:bg-amber-950/70 border-amber-800/50 text-amber-300"
                  : "bg-neutral-900 hover:bg-neutral-800 border-neutral-700/80 text-amber-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>MAYa Sync-QR (Comanda-Espelho Offline)</span>
              </div>
              <span
                className={`text-[10px] ${
                  estiloCarteira === "couro-marrom" ? "text-amber-300/60" : "text-neutral-400"
                }`}
              >
                {mostrarSyncQr ? "Ocultar" : "Mostrar QR"}
              </span>
            </button>

            {mostrarSyncQr && (
              <div className="mt-3 p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center text-center space-y-2">
                <p className="text-[11px] font-bold text-neutral-800">
                  Apresente este código ao garçom para fechamento sem internet
                </p>
                <div className="p-2 border-2 border-dashed border-neutral-300 rounded-xl">
                  <QRCodeSVG
                    value={encodeTicket(
                      buildTicketPayload({
                        pedidoId: `cmd_${mesaNumero}_${(clienteUid || "anon").slice(-4)}`,
                        mesa: mesaNumero,
                        clienteId: clienteUid || "anon",
                        nomeCliente: "Cliente",
                        total: totalCliente,
                        itens: pedidos.flatMap((p) =>
                          p.itens.map((it) => ({
                            menuItemId: it.menuItemId || "item",
                            quantidade: it.quantidade,
                            modificadores: it.modificadores?.map((m) => ({
                              grupo: m.grupo,
                              opcao: m.opcao,
                            })),
                            observacoes: it.observacoes,
                          }))
                        ),
                      })
                    )}
                    size={180}
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <div className="text-[10px] text-neutral-500 font-mono">
                  Payload Compacto: Total{" "}
                  {totalCliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>
            )}
          </div>

          {/* BOTÕES DE AÇÃO: BOTÕES COM ESTILO DE FIVELA / PORTA-CARTÃO */}
          <div className="flex flex-col sm:flex-row w-full gap-2 pt-1 pb-safe">
            {/* 1. PAGAR A MINHA PARTE */}
            <Button
              type="button"
              onClick={onPedirConta}
              disabled={pedindoConta || contaPedidaSucesso || totalCliente === 0}
              className={`w-full sm:flex-1 h-12 sm:h-11 rounded-xl text-xs sm:text-[11px] uppercase tracking-wider font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
                contaPedidaSucesso
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : estiloCarteira === "couro-marrom"
                  ? "bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 shadow-amber-900/50 active:scale-95 border border-amber-500/40"
                  : "bg-neutral-800 hover:bg-neutral-700 text-white shadow-black/40 active:scale-95 border border-neutral-600"
              }`}
            >
              {contaPedidaSucesso ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Parte Solicitada</span>
                </>
              ) : pedindoConta ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Pedindo...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  <span>Pagar Minha Parte</span>
                </>
              )}
            </Button>

            {/* 2. PAGAR MESA COMPLETA */}
            <Button
              type="button"
              onClick={handlePagarMesaCompleta}
              disabled={pedindoMesaToda || mesaTodaPedidaSucesso || totalGeralMesa === 0}
              className={`w-full sm:flex-1 h-12 sm:h-11 rounded-xl text-xs sm:text-[11px] uppercase tracking-wider font-bold transition-all border shadow-md flex items-center justify-center gap-1.5 ${
                mesaTodaPedidaSucesso
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : estiloCarteira === "couro-marrom"
                  ? "bg-black/40 hover:bg-black/60 text-amber-300 border-amber-700/60 hover:border-amber-500 active:scale-95"
                  : "bg-black/60 hover:bg-black/80 text-amber-300 border-neutral-700 hover:border-neutral-500 active:scale-95"
              }`}
            >
              {mesaTodaPedidaSucesso ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Mesa Solicitada</span>
                </>
              ) : pedindoMesaToda ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Pedindo...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Pagar Toda a Mesa</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
