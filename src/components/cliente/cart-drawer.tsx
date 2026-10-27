"use client";

import React, { useState, useRef, useEffect } from "react";
import { useCart } from "@/context/cart-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { buildTicketPayload, encodeTicket } from "@/lib/ticket";
import { ensureClienteAnonimo, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment, collection, writeBatch } from "firebase/firestore";
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

function gerarIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ped-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  restauranteId: string;
  slug?: string;
  restauranteNome?: string;
  corPrimaria?: string;
  taxaServicoPercentual?: number;
}

export function CartDrawer({
  isOpen,
  onClose,
  restauranteId,
  slug = "demo",
  restauranteNome = "MAYaMenu",
  corPrimaria = "#E11D48",
  taxaServicoPercentual,
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

  // Usamos useRef para guardar o ID do pedido. Ele sobrevive a re-renderizações 
  // e garante que retentativas/cliques repetidos usem exatamente o mesmo ID.
  const idempotencyKey = useRef<string>("");

  useEffect(() => {
    if (!idempotencyKey.current) {
      idempotencyKey.current = gerarIdempotencyKey();
    }
  }, []);

  const temNome = nomeCliente.trim().length >= 2;
  const podeFinalizar = itens.length > 0 && temNome && !enviando;

  const handleFinalizarPedido = async () => {
    // 1. Trava dupla contra cliques simultâneos
    if (!podeFinalizar || enviando) return;

    setEnviando(true);
    setErro(null);

    // Usa o ID fixo gerado para esta intenção de compra (Garante Idempotência)
    if (!idempotencyKey.current) {
      idempotencyKey.current = gerarIdempotencyKey();
    }
    const pedidoId = idempotencyKey.current;

    try {
      // 1. Obtém a Sessão Offline (O UUID gerado no localStorage se o Auth falhar)
      let uid = "fallback-uid";
      try {
        const user = await ensureClienteAnonimo();
        uid = (user as any)?.uid || String(user);
      } catch (authErr) {
        console.warn("Auth falhou, usando uid do fallback", authErr);
        uid = `offline-${Date.now()}`;
      }

      // 2. Prepara o Payload do QR Code (Contingência Visual com MAYa Sync-QR)
      const ticket = buildTicketPayload({
        pedidoId,
        mesa,
        clienteId: uid,
        nomeCliente,
        total: subtotal,
        itens: itens.map((it) => ({
          menuItemId: it.menuItemId,
          quantidade: it.quantidade,
          modificadores: it.modificadores.map((m) => ({ grupo: m.grupo, opcao: m.opcao })),
          observacoes: it.observacoes,
        })),
      });

      const qrString = encodeTicket(ticket);
      setTicketPayloadRaw(qrString);

      // 3. Monta as Referências e Payloads
      const idRestauranteFinal = (restauranteId || slug || "demo").trim();



      // Mapeamento limpo dos itens para a cozinha
      const itensMapeados = itens.map((it) => ({
        menuItemId: it.menuItemId,
        nome: it.nome,
        quantidade: it.quantidade,
        precoFinal: it.precoFinal,
        tempoPreparoEstimado: it.tempoPreparoEstimado, // Mantido para o KDS Agrupamento Ágil
        modificadores: it.modificadores.map((m) => ({ grupo: m.grupo, opcao: m.opcao })),
        observacoes: it.observacoes || "",
      }));

      // Payload da Rodada
      const dadosPedidoRodada = {
        id: pedidoId,
        restauranteId: idRestauranteFinal,
        slug: slug || idRestauranteFinal,
        clienteId: uid,
        nomeCliente: nomeCliente.trim(),
        mesa,
        numeroMesa: Number(mesa) || mesa,
        itens: itensMapeados,
        subtotal, // O subtotal DESSA rodada específica
        status: "a_fazer" as const,
        criadoEm: serverTimestamp(),
      };

      // Payload da Comanda Pai
      // ATENÇÃO: Removemos o increment(subtotal)
      // O status é meramente descritivo. O valor real da conta será a soma aritmética
      // dos documentos da subcoleção "pedidos".
      const dadosComanda = {
        id: uid,
        restauranteId: idRestauranteFinal,
        slug: slug || idRestauranteFinal,
        nomeCliente: nomeCliente.trim(),
        mesa,
        numeroMesa: Number(mesa) || mesa,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        status: "aguardando_pratos" as const,
      };

      // 1. Instancia o Lote de Escrita Atômica
      const batch = writeBatch(db);

      // 2. Define as 3 referências apontando para o mesmo momento
      const comandaRef = doc(
        db,
        "restaurantes",
        idRestauranteFinal,
        "mesas",
        String(mesa),
        "comandas_abertas",
        uid
      );
      const pedidoRef = doc(comandaRef, "pedidos", pedidoId);
      const kdsRef = doc(db, "restaurantes", idRestauranteFinal, "kds_tickets", pedidoId); // Isolado da mesa

      // 3. Monta o Payload específico e leve para o KDS (sem subtotal financeiro)
      const payloadKds = {
        id: pedidoId, // Mesmo ID do pedido para rastreabilidade
        mesa,
        numeroMesa: Number(mesa) || mesa,
        clienteId: uid,
        nomeCliente: nomeCliente.trim(),
        status: "a_fazer" as const, // A query do KDS vai filtrar estritamente por isso
        pedidoRefPath: pedidoRef.path,
        itens: itensMapeados.map((i) => ({
          menuItemId: i.menuItemId,
          nome: i.nome,
          quantidade: i.quantidade,
          tempoPreparoEstimado: i.tempoPreparoEstimado,
          modificadores: i.modificadores || [],
          observacoes: i.observacoes || "",
        })),
        criadoEm: serverTimestamp(),
      };

      // 4. Empilha as operações (Merge na comanda pai, criação no pedido, criação no KDS)
      batch.set(comandaRef, dadosComanda, { merge: true });
      batch.set(pedidoRef, dadosPedidoRodada);
      batch.set(kdsRef, payloadKds);

      try {
        // 5. Executa tudo de uma vez. Ou grava tudo, ou falha tudo.
        await batch.commit();

        // Chegou aqui? Está salvo (ou na nuvem, ou no cache local)
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        setUsouOffline(isOffline);
      } catch (firestoreErr) {
        // Este catch SÓ é disparado se o próprio IndexedDB falhar ou estiver cheio
        console.error("Falha na gravação atômica:", firestoreErr);
        setUsouOffline(true);
      }

      // 5. Salva Visita Local (Histórico do Cliente)
      try {
        salvarVisitaLocal({
          id: `vis-${Date.now()}-${mesa}`,
          restaurante: { nome: restauranteNome, slug },
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
        console.warn("Erro ao salvar visita no histórico local:", histErr);
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

      // SUCESSO: Renova a chave de idempotência para uma futura NOVA rodada de pedidos
      idempotencyKey.current = gerarIdempotencyKey();
      setPedidoConcluido(true);
      limparCarrinho();
    } catch (error) {
      console.error("Falha ao gravar pedido:", error);
      // EM CASO DE ERRO (ex: timeout), NÃO renovamos a idempotencyKey.
      // Se o cliente clicar em enviar de novo, o Firestore usará o mesmo `pedidoId`.
      // Como estamos usando set no batch, a operação será sobrescrita e não duplicada (Idempotente).
      setErro("Ocorreu um erro ao processar seu pedido. Tente novamente ou mostre o QR Code ao garçom.");
      setUsouOffline(true);
      setPedidoConcluido(true);
    } finally {
      setEnviando(false);
    }
  };

  const handleReset = () => {
    idempotencyKey.current = gerarIdempotencyKey();
    setPedidoConcluido(false);
    setTicketPayloadRaw(null);
    setErro(null);
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
                <div className="space-y-1.5 px-1 mb-3">
                  <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
                    <span>Subtotal</span>
                    <span>{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                  {taxaServicoPercentual && taxaServicoPercentual > 0 && (
                    <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
                      <span>Taxa de Serviço ({taxaServicoPercentual}%)</span>
                      <span>
                        {(subtotal * (taxaServicoPercentual / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-end pt-2 border-t border-neutral-200 mt-2">
                    <span className="text-xs font-bold uppercase text-neutral-900">Total</span>
                    <span className="text-2xl font-black text-neutral-900 tracking-tight">
                      {(subtotal + (subtotal * ((taxaServicoPercentual || 0) / 100))).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
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
