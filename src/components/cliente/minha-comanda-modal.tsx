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
  Copy,
  Check,
  Zap,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { buildTicketPayload, encodeTicket } from "@/lib/ticket";
import { calcularTotais, somarPedidosAtivos, TAXA_SERVICO_PADRAO } from "@/lib/calculo-conta";
import { gerarPayloadPix } from "@/lib/pix";
import type { PixConfig } from "@/types";

interface MinhaComandaModalProps {
  isOpen: boolean;
  onClose: () => void;
  restauranteId: string;
  mesaNumero: number | string;
  slug: string;
  clienteUid?: string;
  corPrimaria?: string;
  subtotalAcumulado?: number;
  statusComanda?: string | null;
  ehAutoatendimento?: boolean;
  onPedirConta?: (metodo?: "pix" | "cartao_garcom", payloadPix?: string) => void;
  pedindoConta?: boolean;
  contaPedidaSucesso?: boolean;
  taxaServicoPercentual?: number;
  pixConfig?: PixConfig;
  restauranteNome?: string;
}

export function MinhaComandaModal({
  isOpen,
  onClose,
  restauranteId,
  mesaNumero,
  clienteUid: clienteUidProp,
  subtotalAcumulado = 0,
  ehAutoatendimento = false,
  onPedirConta,
  pedindoConta = false,
  contaPedidaSucesso = false,
  taxaServicoPercentual,
  pixConfig,
  restauranteNome,
}: MinhaComandaModalProps) {
  const [pedidos, setPedidos] = useState<PedidoRodada[]>([]);
  const [totalOutrasComandas, setTotalOutrasComandas] = useState<number>(0);
  const [taxaServicoAtiva, setTaxaServicoAtiva] = useState<boolean>(true);
  const [carregando, setCarregando] = useState(true);
  const [pedindoMesaToda, setPedindoMesaToda] = useState(false);
  const [mesaTodaPedidaSucesso, setMesaTodaPedidaSucesso] = useState(false);
  const [clienteUid, setClienteUid] = useState<string>(clienteUidProp || "");
  const [mostrarSyncQr, setMostrarSyncQr] = useState<boolean>(false);
  const [abaPagamento, setAbaPagamento] = useState<"extrato" | "pix">("extrato");
  const [copiadoPix, setCopiadoPix] = useState(false);

  useEffect(() => {
    if (!isOpen || !restauranteId) return;

    let unsub: (() => void) | null = null;
    setCarregando(true);

    const obterUid = async () => {
      if (clienteUidProp) return clienteUidProp;
      const user = await ensureClienteAnonimo();
      return (user as any)?.uid || String(user);
    };

    obterUid()
      .then((uid) => {
        setClienteUid(uid);
        unsub = escutarPedidosCliente(restauranteId, mesaNumero, uid, (lista) => {
          setPedidos(lista);
          setCarregando(false);
        });
      })
      .catch((err) => {
        console.warn("Erro ao obter identificação para consultar comanda:", err);
        setCarregando(false);
      });

    return () => {
      if (unsub) unsub();
    };
  }, [isOpen, restauranteId, mesaNumero, clienteUidProp]);

  // Escuta as comandas da mesa: soma o que as outras pessoas consumiram e a flag da taxa de serviço
  useEffect(() => {
    if (!isOpen || !restauranteId || !clienteUid) return;

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
          let ativa = true;
          snap.forEach((d) => {
            const data = d.data();
            if (d.id === clienteUid) {
              if (data.taxaServicoAtiva === false) ativa = false;
              return;
            }
            total += Number(data.subtotal) || 0;
          });
          setTotalOutrasComandas(total);
          setTaxaServicoAtiva(ativa);
        },
        (err) => {
          console.warn("Aviso ao escutar total da mesa para rateio:", err);
        }
      );

      return () => unsubMesa();
    } catch (e) {
      console.warn("Falha ao inicializar listener de total da mesa:", e);
    }
  }, [isOpen, restauranteId, mesaNumero, clienteUid]);

  // Cálculos consolidados via helper central
  const totalConfirmado = somarPedidosAtivos(pedidos);
  const totalCliente = pedidos.length > 0 ? totalConfirmado : subtotalAcumulado;
  const totalGeralMesa = Math.max(totalCliente, 0) + totalOutrasComandas;
  const percentualTaxa = typeof taxaServicoPercentual === "number" ? taxaServicoPercentual : TAXA_SERVICO_PADRAO;
  const taxaCliente = calcularTotais(totalCliente, percentualTaxa, taxaServicoAtiva).taxa;
  const totalClienteComTaxa = totalCliente + taxaCliente;
  const totalGeralMesaComTaxa = calcularTotais(totalGeralMesa, percentualTaxa, taxaServicoAtiva).total;

  const temPix = Boolean(pixConfig?.ativo && pixConfig?.chave);

  const payloadPix = React.useMemo(() => {
    if (!temPix || !pixConfig || totalClienteComTaxa <= 0) return "";
    try {
      return gerarPayloadPix({
        chave: pixConfig.chave,
        tipoChave: pixConfig.tipoChave,
        beneficiario: pixConfig.beneficiario || restauranteNome || "MAYaMenu",
        cidade: pixConfig.cidade || "SAO PAULO",
        valor: totalClienteComTaxa,
        identificador: `M${mesaNumero}C${(clienteUid || "anon").slice(-4)}`,
        descricao: `Mesa ${mesaNumero}`,
      });
    } catch (err) {
      console.warn("Falha ao gerar payload Pix:", err);
      return "";
    }
  }, [temPix, pixConfig, totalClienteComTaxa, mesaNumero, clienteUid, restauranteNome]);

  const handleCopiarPix = async () => {
    if (!payloadPix) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payloadPix);
        setCopiadoPix(true);
        setTimeout(() => setCopiadoPix(false), 3000);
      }
    } catch (err) {
      console.warn("Falha ao copiar Pix para o clipboard:", err);
    }
  };

  // Solicitar pagamento da mesa completa
  const handlePagarMesaCompleta = async () => {
    if (pedindoMesaToda || mesaTodaPedidaSucesso) return;
    const confirmou = window.confirm(
      `Deseja solicitar o fechamento da MESA COMPLETA (${mesaNumero}) no valor de ${totalGeralMesaComTaxa.toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL" }
      )}?`
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
          <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 animate-spin" />
            Na Cozinha
          </Badge>
        );
      case "pronto":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <ChefHat className="w-3 h-3 animate-bounce" />
            {ehAutoatendimento ? "Pronto p/ Retirar" : "Pronto p/ Servir"}
          </Badge>
        );
      case "entregue":
        return (
          <Badge className="bg-neutral-100 text-neutral-600 border border-neutral-200 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            {ehAutoatendimento ? "Retirado" : "Entregue na Mesa"}
          </Badge>
        );
      case "cancelado":
      case "estornado":
        return (
          <Badge className="bg-red-500/15 text-red-600 border border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
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
        className="w-full sm:max-w-md p-0 flex flex-col h-full bg-background text-foreground border-l border-border shadow-2xl"
      >
        {/* CABEÇALHO DO EXTRATO DA CONTA (M3 TITLE & HEADLINE) */}
        <SheetHeader className="p-5 border-b border-border bg-card">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3 min-w-0">
              {abaPagamento === "pix" ? (
                <button
                  type="button"
                  onClick={() => setAbaPagamento("extrato")}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-all shrink-0"
                  title="Voltar ao Extrato"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <SheetTitle className="text-lg font-black text-foreground flex items-center gap-2 truncate">
                  {abaPagamento === "pix" ? "Pagamento via Pix" : "Comanda da Mesa"}
                  <Badge variant="outline" className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                    abaPagamento === "pix" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : ""
                  }`}>
                    Mesa {mesaNumero}
                  </Badge>
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {abaPagamento === "pix"
                    ? "Instantâneo & direto na conta do lojista"
                    : "Extrato detalhado de despesas"}
                </p>
              </div>
            </div>
          </div>
        </SheetHeader>

        {abaPagamento === "pix" ? (
          /* TELA DE CHECKOUT PIX DINÂMICO */
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/20 flex flex-col items-center text-center">
            {/* CARD DE VALOR */}
            <div className="w-full p-4 rounded-2xl bg-card border border-border shadow-xs text-center space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total da sua parte a pagar
              </span>
              <div className="text-2xl sm:text-3xl font-black text-foreground font-mono">
                {totalClienteComTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              {taxaCliente > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  (Inclui {percentualTaxa}% de taxa sugerida)
                </p>
              )}
            </div>

            {/* CONTAINER DO QR CODE PIX */}
            <div className="p-4 bg-white rounded-3xl border-2 border-border shadow-md flex flex-col items-center space-y-3 max-w-[260px] w-full">
              <p className="text-[11px] font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                Escaneie no app do banco
              </p>
              <div className="p-2 bg-white rounded-2xl border border-neutral-200">
                {payloadPix ? (
                  <QRCodeSVG
                    value={payloadPix}
                    size={190}
                    level="M"
                    includeMargin={true}
                  />
                ) : (
                  <div className="w-[190px] h-[190px] flex items-center justify-center text-neutral-400 text-xs">
                    Gerando QR Pix...
                  </div>
                )}
              </div>
              <div className="space-y-0.5 text-center">
                <span className="text-[10px] font-bold text-neutral-700 block truncate max-w-[220px]">
                  {pixConfig?.beneficiario || restauranteNome || "MAYaMenu"}
                </span>
                <span className="text-[9px] font-mono text-neutral-400 block truncate max-w-[220px]">
                  Chave: {pixConfig?.chave}
                </span>
              </div>
            </div>

            {/* BOTÃO COPIAR CÓDIGO PIX COPIA E COLA */}
            <Button
              type="button"
              onClick={handleCopiarPix}
              className={`w-full max-w-sm h-12 rounded-xl text-xs uppercase tracking-wider font-black transition-all shadow-sm flex items-center justify-center gap-2 ${
                copiadoPix
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95"
              }`}
            >
              {copiadoPix ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Código Pix Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Código Pix (Copia e Cola)</span>
                </>
              )}
            </Button>

            {/* BOTÃO AVISAR QUE JÁ REALIZOU O PIX */}
            <div className="w-full max-w-sm pt-1 space-y-2 pb-safe">
              <Button
                type="button"
                onClick={() => onPedirConta?.("pix", payloadPix)}
                disabled={pedindoConta || contaPedidaSucesso}
                className={`w-full h-12 rounded-xl text-xs uppercase tracking-wider font-black transition-all shadow-sm flex items-center justify-center gap-2 ${
                  contaPedidaSucesso
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95"
                }`}
              >
                {contaPedidaSucesso ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Pagamento Pix Informado!</span>
                  </>
                ) : pedindoConta ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Avisando Salão...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Já fiz o Pix (Avisar Salão)</span>
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setAbaPagamento("extrato")}
                className="text-xs text-muted-foreground hover:text-foreground font-medium py-1 transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Prefiro pagar ao garçom no cartão/dinheiro
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* LISTAGEM DE PEDIDOS / RODADAS (M3 BODY & TITLES) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-muted/20">
          {carregando ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Clock className="w-8 h-8 text-primary animate-spin mx-auto opacity-80" />
              <p className="text-sm font-medium">Consultando seus pratos no sistema...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="p-10 text-center rounded-2xl space-y-3 border-2 border-dashed border-border bg-card text-muted-foreground">
              <Utensils className="w-10 h-10 mx-auto text-muted-foreground/60" />
              <h4 className="text-sm font-bold text-foreground">
                Nenhum pedido lançado nesta comanda
              </h4>
              <p className="text-xs leading-relaxed max-w-xs mx-auto">
                Peça pratos ou bebidas no cardápio para acompanhar os valores da sua mesa aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map((pedido, idx) => (
                <div
                  key={pedido.id || idx}
                  className="p-4 rounded-2xl space-y-3 bg-card border border-border shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Rodada #{idx + 1}
                    </span>
                    {getStatusBadge(pedido.status)}
                  </div>

                  {/* ITENS DA RODADA (M3 TYPE: Body 14px com peso legível) */}
                  <div className="space-y-2 pt-0.5">
                    {pedido.itens.map((it, itemIdx) => (
                      <div key={itemIdx} className="flex items-start justify-between text-sm">
                        <div className="min-w-0 pr-3">
                          <span className="font-bold text-foreground block">
                            {it.quantidade}x {it.nome}
                          </span>
                          {it.observacoes && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">
                              Obs: {it.observacoes}
                            </p>
                          )}
                          {it.modificadores && it.modificadores.length > 0 && (
                            <p className="text-xs text-primary font-medium mt-0.5">
                              + {it.modificadores.map((m) => m.opcao).join(", ")}
                            </p>
                          )}
                        </div>
                        <span className="font-mono font-bold text-sm text-foreground shrink-0">
                          {((it.precoFinal || 0) * it.quantidade).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2.5 border-t border-border flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-semibold">Subtotal da rodada</span>
                    <span className="font-mono font-bold text-foreground text-sm">
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

        {/* RODAPÉ DO EXTRATO (M3 DISPLAY & ACTION BUTTONS) */}
        <div className="p-4 sm:p-5 border-t border-border bg-card space-y-3.5 shadow-lg">
          {/* PAINEL CONSOLIDADO DE TOTAIS */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-muted/40 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Minha Comanda:
              </span>
              <span className="text-base font-black font-mono text-foreground">
                {totalCliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            {taxaCliente > 0 && (
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Taxa de serviço ({percentualTaxa}%)</span>
                <span className="font-mono font-bold text-foreground">
                  {taxaCliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            )}

            {taxaCliente > 0 && (
              <div className="flex items-center justify-between text-xs font-black text-primary border-t border-border pt-1.5">
                <span className="uppercase tracking-wider">Minha parte c/ taxa</span>
                <span className="font-mono text-sm">
                  {totalClienteComTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-neutral-600" />
                Total da Mesa:
              </span>
              <span className="text-base sm:text-lg font-black text-foreground font-mono">
                {totalGeralMesaComTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>

          {/* PROTOCOLO MAYA SYNC-QR (Comanda-Espelho Dinâmica Descentralizada) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setMostrarSyncQr((prev) => !prev)}
              className="w-full py-2 px-3 rounded-xl border border-border bg-muted/30 hover:bg-muted text-xs font-bold text-foreground flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                <span>Comanda-Espelho QR (Contingência)</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {mostrarSyncQr ? "Ocultar" : "Mostrar QR"}
              </span>
            </button>

            {mostrarSyncQr && (
              <div className="mt-2.5 p-4 bg-white rounded-2xl border border-border shadow-md flex flex-col items-center text-center space-y-2">
                <p className="text-xs font-bold text-neutral-800">
                  Apresente este código ao garçom para fechamento offline
                </p>
                <div className="p-2 border-2 border-dashed border-neutral-300 rounded-xl bg-white">
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
                <div className="text-xs text-neutral-500 font-mono">
                  Total {totalCliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>
            )}
          </div>

          {/* BOTÕES DE AÇÃO: M3 CALL TO ACTION (ALTURA MÍNIMA 44px P/ TOQUE MÓVEL) */}
          <div className="flex flex-col w-full gap-2 pt-1 pb-safe">
            {temPix && totalCliente > 0 ? (
              <>
                {/* BOTÃO 1: PAGAR VIA PIX INSTANTÂNEO */}
                <Button
                  type="button"
                  onClick={() => setAbaPagamento("pix")}
                  className="w-full h-12 rounded-xl text-xs uppercase tracking-wider font-black transition-all shadow-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Pagar com Pix Instantâneo ({totalClienteComTaxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span>
                </Button>

                <div className="flex flex-col sm:flex-row w-full gap-2">
                  {/* BOTÃO 2: PAGAR AO GARÇOM */}
                  <Button
                    type="button"
                    onClick={() => onPedirConta?.("cartao_garcom")}
                    disabled={pedindoConta || contaPedidaSucesso}
                    variant="outline"
                    className={`w-full sm:flex-1 h-11 rounded-xl text-xs uppercase tracking-wider font-bold transition-all border border-border shadow-xs flex items-center justify-center gap-1.5 ${
                      contaPedidaSucesso
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-card hover:bg-muted text-foreground active:scale-95"
                    }`}
                  >
                    {contaPedidaSucesso ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Garçom Solicitado</span>
                      </>
                    ) : pedindoConta ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin text-primary" />
                        <span>Chamando...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <span>Pagar c/ Garçom</span>
                      </>
                    )}
                  </Button>

                  {/* BOTÃO 3: PAGAR TODA A MESA */}
                  <Button
                    type="button"
                    onClick={handlePagarMesaCompleta}
                    disabled={pedindoMesaToda || mesaTodaPedidaSucesso || totalGeralMesa === 0}
                    variant="outline"
                    className={`w-full sm:flex-1 h-11 rounded-xl text-xs uppercase tracking-wider font-bold transition-all border border-border shadow-xs flex items-center justify-center gap-1.5 ${
                      mesaTodaPedidaSucesso
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-card hover:bg-muted text-foreground active:scale-95"
                    }`}
                  >
                    {mesaTodaPedidaSucesso ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Mesa Solicitada</span>
                      </>
                    ) : pedindoMesaToda ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin text-primary" />
                        <span>Pedindo...</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 text-foreground" />
                        <span>Pagar Toda a Mesa</span>
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* MANTÉM OS BOTÕES CLÁSSICOS QUANDO NÃO HÁ PIX ATIVO */
              <div className="flex flex-col sm:flex-row w-full gap-2">
                <Button
                  type="button"
                  onClick={() => onPedirConta?.("cartao_garcom")}
                  disabled={pedindoConta || contaPedidaSucesso || totalCliente === 0}
                  className={`w-full sm:flex-1 h-12 rounded-xl text-xs uppercase tracking-wider font-black transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                    contaPedidaSucesso
                      ? "bg-emerald-600 text-white"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95"
                  }`}
                >
                  {contaPedidaSucesso ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
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

                <Button
                  type="button"
                  onClick={handlePagarMesaCompleta}
                  disabled={pedindoMesaToda || mesaTodaPedidaSucesso || totalGeralMesa === 0}
                  variant="outline"
                  className={`w-full sm:flex-1 h-12 rounded-xl text-xs uppercase tracking-wider font-bold transition-all border border-border shadow-xs flex items-center justify-center gap-1.5 ${
                    mesaTodaPedidaSucesso
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-card hover:bg-muted text-foreground active:scale-95"
                  }`}
                >
                  {mesaTodaPedidaSucesso ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Mesa Solicitada</span>
                    </>
                  ) : pedindoMesaToda ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin text-primary" />
                      <span>Pedindo...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-foreground" />
                      <span>Pagar Toda a Mesa</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </>
    )}
      </SheetContent>
    </Sheet>
  );
}
