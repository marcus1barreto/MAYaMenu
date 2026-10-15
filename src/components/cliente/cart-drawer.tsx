"use client";

import React, { useState } from "react";
import { useCart } from "@/context/cart-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { buildTicketPayload, encodeTicket } from "@/lib/ticket";
import { ensureClienteAnonimo, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment, collection } from "firebase/firestore";
import {
  Trash2,
  Plus,
  Minus,
  QrCode,
  CheckCircle2,
  Clock,
  Sparkles,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { salvarVisitaLocal, gerarComprovanteHash } from "@/lib/historico-cliente";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  restauranteId: string;
  slug?: string;
  restauranteNome?: string;
  corPrimaria?: string;
}

export function CartDrawer({
  isOpen,
  onClose,
  restauranteId,
  slug = "demo",
  restauranteNome = "MAYaMenu",
  corPrimaria = "#E11D48",
}: CartDrawerProps) {
  const {
    itens,
    nomeCliente,
    setNomeCliente,
    mesa,
    subtotal,
    atualizarQuantidade,
    removerItem,
    limparCarrinho,
  } = useCart();

  const [enviando, setEnviando] = useState(false);
  const [pedidoConcluido, setPedidoConcluido] = useState(false);
  const [ticketPayloadRaw, setTicketPayloadRaw] = useState<string | null>(null);
  const [usouOffline, setUsouOffline] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const temNome = nomeCliente.trim().length >= 2;
  const podeFinalizar = itens.length > 0 && temNome && !enviando;

  const handleFinalizarPedido = async () => {
    if (!podeFinalizar) return;

    setEnviando(true);
    setErro(null);

    const pedidoId = `ped-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      // 1. Garante Auth Anônimo no Firebase para obter o UID correspondente
      let uid = "offline-temp-uid";
      try {
        const user = await ensureClienteAnonimo();
        uid = user.uid;
      } catch (authErr) {
        console.warn("Falha de autenticação (possível offline):", authErr);
      }

      // 2. Prepara o payload do Ticket Digital (contingência garantida)
      const ticket = buildTicketPayload({
        pedidoId,
        mesa,
        clienteId: uid,
        nomeCliente,
        itens: itens.map((it) => ({
          menuItemId: it.menuItemId,
          quantidade: it.quantidade,
          modificadores: it.modificadores.map((m) => ({ grupo: m.grupo, opcao: m.opcao })),
          observacoes: it.observacoes,
        })),
      });

      const qrString = encodeTicket(ticket);
      setTicketPayloadRaw(qrString);

      // 3. Tenta persistir no Firestore sob a nova arquitetura de Rodadas:
      // Comanda Pai: restaurantes/{restauranteId}/mesas/{mesa}/comandas_abertas/{clienteId}
      // Rodada/Pedido: restaurantes/{restauranteId}/mesas/{mesa}/comandas_abertas/{clienteId}/pedidos/{pedidoId}
      try {
        const comandaRef = doc(
          db,
          "restaurantes",
          restauranteId,
          "mesas",
          String(mesa),
          "comandas_abertas",
          uid
        );

        const pedidoRef = doc(
          db,
          "restaurantes",
          restauranteId,
          "mesas",
          String(mesa),
          "comandas_abertas",
          uid,
          "pedidos",
          pedidoId
        );

        const itensMapeados = itens.map((it) => ({
          menuItemId: it.menuItemId,
          nome: it.nome,
          quantidade: it.quantidade,
          precoFinal: it.precoFinal,
          modificadores: it.modificadores.map((m) => ({ grupo: m.grupo, opcao: m.opcao })),
          observacoes: it.observacoes || "",
        }));

        // Dados da Rodada individual para o KDS da cozinha
        const dadosPedidoRodada = {
          id: pedidoId,
          restauranteId,
          clienteId: uid,
          nomeCliente: nomeCliente.trim(),
          mesa,
          numeroMesa: Number(mesa) || mesa,
          itens: itensMapeados,
          subtotal,
          status: "a_fazer" as const,
          criadoEm: serverTimestamp(),
        };

        // Verifica se a comanda pai já existe para não sobrescrever criadoEm nem conflitar com increment
        const comandaSnap = await getDoc(comandaRef);

        let saveComandaPromise: Promise<unknown>;
        if (!comandaSnap.exists()) {
          // 1ª Rodada: cria a comanda pai
          saveComandaPromise = setDoc(comandaRef, {
            id: uid,
            restauranteId,
            nomeCliente: nomeCliente.trim(),
            mesa,
            numeroMesa: Number(mesa) || mesa,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            subtotal,
            status: "aguardando_pratos" as const,
          });
        } else {
          // 2ª Rodada em diante: atualiza comanda acumulando subtotal e preservando criadoEm
          saveComandaPromise = updateDoc(comandaRef, {
            nomeCliente: nomeCliente.trim(),
            mesa,
            numeroMesa: Number(mesa) || mesa,
            atualizadoEm: serverTimestamp(),
            subtotal: increment(subtotal),
            status: "aguardando_pratos" as const,
          });
        }

        const savePedidoPromise = setDoc(pedidoRef, dadosPedidoRodada);

        const savePromise = Promise.all([saveComandaPromise, savePedidoPromise]);
        const timeoutSave = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout Firestore")), 4000)
        );

        await Promise.race([savePromise, timeoutSave]);
        setUsouOffline(false);
      } catch (firestoreErr) {
        console.warn("Firestore offline ou rejeitado (salvo no Ticket QR):", firestoreErr);
        setUsouOffline(true);
      }

      // 4. Salva o comprovante na Memória Local do Aparelho do Cliente
      try {
        salvarVisitaLocal({
          id: `vis-${Date.now()}-${mesa}`,
          restaurante: {
            nome: restauranteNome,
            slug,
          },
          mesa,
          clienteNome: nomeCliente.trim(),
          clienteId: uid,
          dataHora: new Date().toISOString(),
          itens: itens.map((it) => ({
            nome: it.nome,
            quantidade: it.quantidade,
            precoFinal: it.precoFinal,
            modificadores: it.modificadores.map((m) => ({ grupo: m.grupo, opcao: m.opcao })),
            observacoes: it.observacoes,
          })),
          subtotal,
          totalPago: subtotal,
          status: "ativo",
          comprovanteHash: gerarComprovanteHash(slug, mesa),
        });
      } catch (histErr) {
        console.warn("Falha ao salvar visita no histórico local:", histErr);
      }

      // Dispara celebração visual
      try {
        if (typeof window !== "undefined") {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
          });
        }
      } catch {
        // Ignora
      }

      setPedidoConcluido(true);
      limparCarrinho();
    } catch (e: unknown) {
      console.error("Erro inesperado no envio:", e);
      // Mesmo com erro inesperado, se tiver itens gera o ticket
      setUsouOffline(true);
      setPedidoConcluido(true);
      limparCarrinho();
    } finally {
      setEnviando(false);
    }
  };

  const handleReset = () => {
    setPedidoConcluido(false);
    setTicketPayloadRaw(null);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] h-[92dvh] p-0 flex flex-col rounded-t-3xl border-none shadow-2xl bg-white"
      >
        {pedidoConcluido && ticketPayloadRaw ? (
          /* TELA DE SUCESSO / TICKET DIGITAL QR CODE */
          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-neutral-900 tracking-tight">
                Pedido Registrado!
              </h2>
              <p className="text-sm text-neutral-500">
                Mesa <span className="font-bold text-neutral-800">{mesa}</span> • Cliente:{" "}
                <span className="font-bold text-neutral-800">{nomeCliente}</span>
              </p>
            </div>

            {/* Alerta explicativo do ticket offline */}
            <div
              className={`p-4 rounded-2xl text-left border flex items-start gap-3 max-w-sm w-full ${
                usouOffline
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              {usouOffline ? (
                <WifiOff className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              ) : (
                <QrCode className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">
                {usouOffline ? (
                  <>
                    <strong className="block font-bold mb-0.5">Modo Resiliente (Offline)</strong>
                    Seu pedido foi salvo no QR Code abaixo! Apresente este código ao garçom para
                    injetá-lo diretamente na cozinha.
                  </>
                ) : (
                  <>
                    <strong className="block font-bold mb-0.5">Ticket Digital Garantido</strong>
                    Seu pedido já foi enviado ao sistema. O QR Code abaixo é seu comprovante digital.
                  </>
                )}
              </div>
            </div>

            {/* Container do QR Code */}
            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-neutral-300 shadow-md flex flex-col items-center">
              <QRCodeSVG
                value={ticketPayloadRaw}
                size={220}
                level="M"
                includeMargin={true}
                className="rounded-lg"
              />
              <span className="mt-2 text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                Ticket Digital • MAYaMenu
              </span>
            </div>

            <Button
              type="button"
              onClick={handleReset}
              className="w-full max-w-xs h-12 rounded-xl text-base font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg"
            >
              Concluir e Voltar ao Cardápio
            </Button>
          </div>
        ) : (
          /* TELA DE REVISÃO DO CARRINHO */
          <>
            <SheetHeader className="p-5 pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-xl font-black text-neutral-900">
                  Sua Comanda (Mesa {mesa})
                </SheetTitle>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  {itens.length} {itens.length === 1 ? "item" : "itens"}
                </span>
              </div>
            </SheetHeader>

            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {/* Identificação do Cliente */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center justify-between">
                  <span>Seu Nome na Mesa *</span>
                  <span className="text-[10px] text-neutral-500 font-normal">
                    (Sem cadastro, apenas para o garçom saber quem pediu)
                  </span>
                </label>
                <Input
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Ex: Marcus, Mayara, Pedro..."
                  maxLength={40}
                  className="bg-white h-11 text-base font-medium rounded-xl border-neutral-300 focus:ring-neutral-900"
                />
              </div>

              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{erro}</span>
                </div>
              )}

              {/* Lista de Itens */}
              {itens.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 space-y-2">
                  <p className="text-sm font-medium">Sua comanda está vazia.</p>
                  <p className="text-xs">Escolha pratos e bebidas no cardápio para adicionar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itens.map((it) => (
                    <div
                      key={it.idUnico}
                      className="p-3.5 bg-white rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-neutral-900 truncate">{it.nome}</h4>
                        {it.modificadores.length > 0 && (
                          <p className="text-xs text-neutral-500 truncate">
                            {it.modificadores.map((m) => m.opcao).join(", ")}
                          </p>
                        )}
                        {it.observacoes && (
                          <p className="text-[11px] text-amber-700 italic truncate">
                            Obs: {it.observacoes}
                          </p>
                        )}
                        <span className="text-xs font-bold text-neutral-800">
                          {(it.precoFinal * it.quantidade).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>

                      {/* Controles de Quantidade */}
                      <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => atualizarQuantidade(it.idUnico, -1)}
                          className="w-8 h-8 flex items-center justify-center text-neutral-600 rounded-lg hover:bg-white transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-neutral-900">
                          {it.quantidade}
                        </span>
                        <button
                          type="button"
                          onClick={() => atualizarQuantidade(it.idUnico, 1)}
                          className="w-8 h-8 flex items-center justify-center text-neutral-600 rounded-lg hover:bg-white transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removerItem(it.idUnico)}
                        className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé de Fechamento */}
            {itens.length > 0 && (
              <div className="p-4 bg-neutral-50 border-t border-neutral-200 space-y-3">
                <div className="flex items-baseline justify-between px-1">
                  <span className="text-xs font-bold uppercase text-neutral-500">Subtotal</span>
                  <span className="text-2xl font-black text-neutral-900 tracking-tight">
                    {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>

                <Button
                  type="button"
                  disabled={!podeFinalizar}
                  onClick={handleFinalizarPedido}
                  style={{ backgroundColor: podeFinalizar ? corPrimaria : undefined }}
                  className="w-full h-14 text-base font-bold text-white rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {enviando ? (
                    <span>Registrando Pedido...</span>
                  ) : !temNome ? (
                    <span>Digite seu nome acima para pedir</span>
                  ) : (
                    <>
                      <span>Enviar Pedido • Gerar Ticket</span>
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
