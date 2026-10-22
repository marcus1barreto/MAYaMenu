"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { QrScannerModal } from "./qr-scanner-modal";
import type { TicketPayload } from "@/lib/ticket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  QrCode,
  DollarSign,
  Receipt,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  ChevronRight,
  ExternalLink,
  Bell,
  ChefHat,
  Utensils,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MesaDetalheModal } from "@/components/salao/mesa-detalhe-modal";
import { useSafeAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collectionGroup, query, where, onSnapshot } from "firebase/firestore";
import type { ComandaCliente, PedidoRodada, PedidoComRef, StatusPedido } from "@/types";
import { getLimitesLicenca } from "@/lib/licenca-limites";
import { parseDateToMillis, millisOu } from "@/lib/datas";
import {
  escutarComandasSalão,
  marcarComandaPagaFirestore,
  liberarMesaFirestore,
  injetarTicketContingencia,
  atenderGarcomFirestore,
  lancarItemManualFirestore,
  atualizarStatusPedido,
} from "@/lib/restaurante-service";

// Item de comanda exibido no salão. `refPath` e `statusPedido` vêm do pedido (rodada) de origem
// e permitem marcar o item como entregue diretamente no Firestore.
export interface ItemComandaGarcom {
  nome: string;
  quantidade: number;
  precoFinal: number;
  modificadores?: { grupo: string; opcao: string; precoAdicional?: number }[];
  refPath?: string;
  statusPedido?: StatusPedido;
}

export interface ComandaGarcom {
  id: string; // clienteId
  nomeCliente: string;
  subtotal: number;
  status: "pedindo" | "aguardando_pratos" | "conta_pedida" | "pago";
  itens: ItemComandaGarcom[];
  chamadoGarcom?: {
    ativo: boolean;
    solicitadoEm?: any;
    motivo?: string;
  };
}

export interface MesaOperacional {
  numero: number;
  status: "livre" | "ocupada" | "conta_pedida" | "paga_ocupada";
  chamandoGarcom?: boolean;
  alertaUpsell?: boolean;
  pagoEm?: any;
  comandas: ComandaGarcom[];
}

export const TEMPO_TOLERANCIA_MINUTOS = 15;

export const MESAS_INICIAIS: MesaOperacional[] = [
  {
    numero: 12,
    status: "conta_pedida",
    comandas: [
      {
        id: "cli-cliente-a",
        nomeCliente: "Cliente A",
        subtotal: 67.0,
        status: "conta_pedida",
        itens: [
          {
            nome: "MAYaBurger Especial",
            quantidade: 1,
            precoFinal: 38.0,
            modificadores: [{ grupo: "Ponto da Carne", opcao: "Ao Ponto" }],
          },
          {
            nome: "Coquetel Sunburst Maya",
            quantidade: 1,
            precoFinal: 29.0,
          },
        ],
      },
      {
        id: "cli-cliente-b",
        nomeCliente: "Cliente B",
        subtotal: 54.0,
        status: "conta_pedida",
        itens: [
          {
            nome: "Pizza Napolitana Rústica",
            quantidade: 1,
            precoFinal: 54.0,
          },
        ],
      },
    ],
  },
  {
    numero: 4,
    status: "ocupada",
    comandas: [
      {
        id: "cli-cliente-c",
        nomeCliente: "Cliente C",
        subtotal: 62.0,
        status: "aguardando_pratos",
        itens: [
          {
            nome: "Pizza Napolitana Rústica",
            quantidade: 1,
            precoFinal: 62.0,
            modificadores: [{ grupo: "Borda Recheada", opcao: "Catupiry Original" }],
          },
        ],
      },
    ],
  },
  {
    numero: 7,
    status: "ocupada",
    comandas: [
      {
        id: "cli-cliente-d",
        nomeCliente: "Cliente D",
        subtotal: 22.0,
        status: "pedindo",
        itens: [
          {
            nome: "Gelato Pistache & Frutas Vermelhas",
            quantidade: 1,
            precoFinal: 22.0,
          },
        ],
      },
    ],
  },
  { numero: 1, status: "livre", comandas: [] },
  { numero: 2, status: "livre", comandas: [] },
  { numero: 3, status: "livre", comandas: [] },
  { numero: 5, status: "livre", comandas: [] },
  { numero: 6, status: "livre", comandas: [] },
  { numero: 8, status: "livre", comandas: [] },
];

export function GarcomView({
  restauranteId,
  slug = "demo",
  nomeRestaurante = "MAYaMenu",
  isSandbox = false,
  dadosIniciais,
}: {
  restauranteId?: string;
  slug?: string;
  nomeRestaurante?: string;
  isSandbox?: boolean;
  dadosIniciais?: MesaOperacional[];
}) {
  const auth = useSafeAuth();
  const restaurante = auth?.restaurante;
  const { maxMesas } = getLimitesLicenca(restaurante);

  // Trava de Autoatendimento (Modo Balcão): apenas sinaliza; o retorno visual ocorre após todos os hooks
  const modoOperacao = restaurante?.configuracoes?.modoOperacao || "hibrido";
  const ehModoAutoatendimento = modoOperacao === "balcao";
  const bloqueadoPorAutoatendimento = ehModoAutoatendimento && !isSandbox;

  const [mesas, setMesas] = useState<MesaOperacional[]>(() => {
    if (dadosIniciais !== undefined) return dadosIniciais;
    if (isSandbox) return MESAS_INICIAIS;
    const mapaLimpo: MesaOperacional[] = [];
    for (let i = 1; i <= maxMesas; i++) {
      mapaLimpo.push({ numero: i, status: "livre", comandas: [] });
    }
    return mapaLimpo;
  });
  const [comandas, setComandas] = useState<(ComandaCliente & { refPath?: string })[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaOperacional | null>(null);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [feedbackInjecao, setFeedbackInjecao] = useState<string | null>(null);

  const [pedidosProntos, setPedidosProntos] = useState<PedidoComRef[]>([]);
  const [atualizandoPedidoId, setAtualizandoPedidoId] = useState<string | null>(null);

  // 1. Escuta todas as comandas abertas do salão em tempo real com expurgo explícito de 'removed'
  useEffect(() => {
    if (bloqueadoPorAutoatendimento) return;
    const idBusca = restauranteId || restaurante?.id || slug || restaurante?.slug;
    if (!idBusca) return;

    const idsParaBuscar = Array.from(
      new Set([restauranteId, restaurante?.id, slug, restaurante?.slug].filter(Boolean) as string[])
    );

    const q = idsParaBuscar.length > 1
      ? query(collectionGroup(db, "comandas_abertas"), where("restauranteId", "in", idsParaBuscar))
      : query(collectionGroup(db, "comandas_abertas"), where("restauranteId", "==", idsParaBuscar[0]));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setComandas((prevComandas) => {
          let lista = [...prevComandas];

          snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            if (change.type === "removed") {
              // Remoção explícita da comanda ao ser liberada / arquivada
              lista = lista.filter((c) => c.id !== docId);
            } else if (change.type === "added" || change.type === "modified") {
              const data = change.doc.data() as ComandaCliente;
              const comandaItem: ComandaCliente & { refPath: string } = {
                ...data,
                id: docId,
                refPath: change.doc.ref.path,
              };
              const index = lista.findIndex((c) => c.id === docId);
              if (index >= 0) {
                lista[index] = comandaItem;
              } else {
                lista.push(comandaItem);
              }
            }
          });

          // Reconstrói as mesas com base nas comandas ativas e no limite de mesas do plano
          const mapa = new Map<number, MesaOperacional>();
          for (let i = 1; i <= maxMesas; i++) {
            mapa.set(i, { numero: i, status: "livre", comandas: [] });
          }

          // Popula com comandas do Firestore
          for (const c of lista) {
            const numMesa = Number(c.mesa) || 1;
            const mesaAtual = mapa.get(numMesa) || { numero: numMesa, status: "livre", comandas: [] };

            const garcomChamadoAtivo = Boolean(c.chamadoGarcom?.ativo);

            mesaAtual.comandas.push({
              id: c.id,
              nomeCliente: c.nomeCliente,
              subtotal: c.subtotal || 0,
              status: c.status,
              itens: [],
              chamadoGarcom: c.chamadoGarcom,
            });

            if (garcomChamadoAtivo) {
              mesaAtual.chamandoGarcom = true;
            }

            // Define o status global da mesa com a regra de "paga_ocupada" e alerta de tolerância
            if (c.status === "conta_pedida") {
              mesaAtual.status = "conta_pedida";
            } else if (c.status === "pago") {
              // Se já temos comanda paga, checa se TODAS as comandas da mesa foram pagas
              const todasPagas = mesaAtual.comandas.every((cmd) => cmd.status === "pago");
              if (todasPagas && mesaAtual.status !== "conta_pedida") {
                mesaAtual.status = "paga_ocupada";

                // Registra o momento em que a conta foi paga a partir de atualizadoEm
                const millisPago = parseDateToMillis(c.atualizadoEm);

                if (millisPago) {
                  if (!mesaAtual.pagoEm || millisPago > mesaAtual.pagoEm) {
                    mesaAtual.pagoEm = millisPago;
                  }
                }

                // Alerta Proativo de Upsell: verifica se já ultrapassou o tempo de tolerância
                if (mesaAtual.pagoEm) {
                  const minutosPassados = (Date.now() - mesaAtual.pagoEm) / (1000 * 60);
                  if (minutosPassados >= TEMPO_TOLERANCIA_MINUTOS) {
                    mesaAtual.alertaUpsell = true;
                  }
                }
              }
            } else if (mesaAtual.status !== "conta_pedida" && mesaAtual.status !== "paga_ocupada") {
              mesaAtual.status = "ocupada";
            }

            mapa.set(numMesa, mesaAtual);
          }

          const novasMesas = Array.from(mapa.values());
          setMesas(novasMesas);

          // Sincroniza a mesa selecionada se estiver aberta no modal
          setMesaSelecionada((prevSelecionada) => {
            if (!prevSelecionada) return null;
            const mesaAtualizada = mapa.get(prevSelecionada.numero);
            return mesaAtualizada || { numero: prevSelecionada.numero, status: "livre", comandas: [] };
          });

          return lista;
        });
      },
      (err) => {
        console.warn("Listener de comandas do salão no Garçom indisponível:", err);
      }
    );

    return () => unsub();
  }, [restauranteId, restaurante?.id, slug, restaurante?.slug, maxMesas, bloqueadoPorAutoatendimento]);

  // 2. Escuta pedidos prontos na cozinha (Bandeja / Avisos de Entrega) em tempo real
  useEffect(() => {
    if (bloqueadoPorAutoatendimento) return;
    const idBusca = restauranteId || restaurante?.id || slug || restaurante?.slug;
    if (!idBusca) return;

    const idsParaBuscar = Array.from(
      new Set([restauranteId, restaurante?.id, slug, restaurante?.slug].filter(Boolean) as string[])
    );

    const q = idsParaBuscar.length > 1
      ? query(collectionGroup(db, "pedidos"), where("restauranteId", "in", idsParaBuscar))
      : query(collectionGroup(db, "pedidos"), where("restauranteId", "==", idsParaBuscar[0]));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const prontos: PedidoComRef[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as PedidoRodada;
          if (data.status === "pronto") {
            prontos.push({
              ...data,
              id: docSnap.id,
              refPath: docSnap.ref.path,
            });
          }
        });

        // Ordena por data de criação (mais antigos primeiro para agilizar a entrega)
        prontos.sort((a, b) => millisOu(a.criadoEm) - millisOu(b.criadoEm));

        setPedidosProntos(prontos);
      },
      (err) => {
        console.warn("Aviso ao escutar pedidos prontos na cozinha:", err);
      }
    );

    return () => unsub();
  }, [restauranteId, restaurante?.id, slug, restaurante?.slug, bloqueadoPorAutoatendimento]);

  // Carimbar pedido como entregue
  const handleMarcarEntregue = async (refPath: string, pedidoId: string) => {
    setAtualizandoPedidoId(pedidoId);
    try {
      await atualizarStatusPedido(refPath, "entregue");
    } catch (err) {
      console.error("Falha ao marcar pedido como entregue:", err);
    } finally {
      setAtualizandoPedidoId(null);
    }
  };

  // Atender chamado do garçom
  const handleAtenderGarcom = async (mesaNumero: number, clienteId: string) => {
    // Atualização otimista local
    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero === mesaNumero) {
          const novasComandas = m.comandas.map((c) =>
            c.id === clienteId && c.chamadoGarcom
              ? { ...c, chamadoGarcom: { ...c.chamadoGarcom, ativo: false } }
              : c
          );
          const aindaTemChamado = novasComandas.some((c) => c.chamadoGarcom?.ativo);
          return {
            ...m,
            chamandoGarcom: aindaTemChamado,
            comandas: novasComandas,
          };
        }
        return m;
      })
    );

    setMesaSelecionada((prev) => {
      if (!prev || prev.numero !== mesaNumero) return prev;
      const novasComandas = prev.comandas.map((c) =>
        c.id === clienteId && c.chamadoGarcom
          ? { ...c, chamadoGarcom: { ...c.chamadoGarcom, ativo: false } }
          : c
      );
      const aindaTemChamado = novasComandas.some((c) => c.chamadoGarcom?.ativo);
      return {
        ...prev,
        chamandoGarcom: aindaTemChamado,
        comandas: novasComandas,
      };
    });

    if (restauranteId) {
      try {
        await atenderGarcomFirestore(restauranteId, mesaNumero, clienteId);
      } catch (err) {
        console.warn("Falha ao desarmar chamado do garçom no Firestore:", err);
      }
    }
  };

  // Fechar/Marcar Comanda Individual como Paga (exclusivo do lojista/garçom)
  const handleMarcarComoPago = async (mesaNumero: number, clienteId: string) => {
    // Atualização otimista
    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero === mesaNumero) {
          const novasComandas = m.comandas.map((c) =>
            c.id === clienteId ? { ...c, status: "pago" as const } : c
          );
          const todasPagas = novasComandas.every((c) => c.status === "pago");
          return {
            ...m,
            status: todasPagas ? ("paga_ocupada" as const) : m.status,
            comandas: novasComandas,
          };
        }
        return m;
      })
    );

    setMesaSelecionada((prev) => {
      if (!prev || prev.numero !== mesaNumero) return prev;
      const novas = prev.comandas.map((c) =>
        c.id === clienteId ? { ...c, status: "pago" as const } : c
      );
      const todasPagas = novas.every((c) => c.status === "pago");
      return {
        ...prev,
        status: todasPagas ? ("paga_ocupada" as const) : prev.status,
        comandas: novas,
      };
    });

    // Persistência no Firestore
    if (restauranteId) {
      try {
        await marcarComandaPagaFirestore(restauranteId, mesaNumero, clienteId);
      } catch (err) {
        console.warn("Falha ao marcar comanda como paga no Firestore:", err);
      }
    }
  };

  // Liberar mesa no Firestore
  const handleLiberarMesa = async (mesaNumero: number) => {
    const mesaAlvo = mesas.find((m) => m.numero === mesaNumero);
    const comandasIds = mesaAlvo ? mesaAlvo.comandas.map((c) => c.id) : [];
    const idRestauranteFinal = restauranteId || restaurante?.id;

    setMesas((prev) =>
      prev.map((m) => (m.numero === mesaNumero ? { ...m, status: "livre", comandas: [] } : m))
    );
    setMesaSelecionada(null);

    if (idRestauranteFinal && comandasIds.length > 0) {
      try {
        await liberarMesaFirestore(idRestauranteFinal, mesaNumero, comandasIds);
      } catch (err: any) {
        console.warn("Falha ao liberar mesa no Firestore:", err);
        alert("Erro ao libertar: " + (err?.message || "Falha na comunicação com o servidor"));
      }
    }
  };

  // Injetar pedido resgatado pelo leitor de QR de contingência diretamente no Firestore (MAYa Sync-QR)
  const handleTicketLido = async (ticket: TicketPayload) => {
    const mesaNum = Number(ticket.t) || 1;
    // Se o ticket já possuir o total consolidado (MAYa Sync-QR), utiliza o valor exato
    const subtotalCalculado =
      ticket.tot !== undefined ? ticket.tot : ticket.i.reduce((acc, it) => acc + it.q * 30, 0);

    const novaComanda: ComandaGarcom = {
      id: ticket.c.id,
      nomeCliente: ticket.c.n,
      subtotal: subtotalCalculado,
      status: ticket.tot !== undefined ? "conta_pedida" : "aguardando_pratos",
      itens: ticket.i.map((it) => ({
        nome: `Item (${it.id})`,
        quantidade: it.q,
        precoFinal: ticket.tot !== undefined ? ticket.tot / (ticket.i.length || 1) : 30,
        modificadores: it.m?.map(([g, o]) => ({ grupo: g, opcao: o })),
      })),
    };

    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero === mesaNum) {
          return {
            ...m,
            status: "ocupada",
            comandas: [...m.comandas, novaComanda],
          };
        }
        return m;
      })
    );

    // Persiste no Firestore para que a Cozinha veja instantaneamente no KDS!
    if (restauranteId) {
      try {
        await injetarTicketContingencia(restauranteId, {
          id: ticket.id,
          mesa: mesaNum,
          clienteId: ticket.c.id,
          nomeCliente: ticket.c.n,
          subtotal: subtotalCalculado,
          itens: ticket.i.map((it) => ({
            menuItemId: it.id,
            nome: `Item (${it.id})`,
            quantidade: it.q,
            precoFinal: 30,
            modificadores: it.m?.map(([g, o]) => ({ grupo: g, opcao: o })),
            observacoes: it.o,
          })),
        });
      } catch (err) {
        console.warn("Falha ao injetar pedido de contingência no Firestore:", err);
      }
    }

    setFeedbackInjecao(`Pedido de ${ticket.c.n} injetado na Mesa ${mesaNum}!`);
    setTimeout(() => setFeedbackInjecao(null), 4000);
  };

  const mesasComContaPedida = mesas.filter((m) => m.status === "conta_pedida").length;

  if (bloqueadoPorAutoatendimento) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-rose-600/20 rounded-full mb-4">
          <Utensils className="w-10 h-10 text-rose-500" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight mb-2">
          Restaurante em Modo Autoatendimento
        </h1>
        <p className="text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
          O atendimento por garçons está desativado para este estabelecimento. Os pedidos são gerenciados diretamente pelo KDS da Cozinha e retirados no balcão.
        </p>
        <Link href="/admin">
          <Button className="h-12 px-6 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-950/40">
            Voltar ao Painel Admin
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 flex flex-col">
      {/* CABEÇALHO DA VISÃO DO GARÇOM */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 rounded-2xl shadow-lg">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Mapa de Mesas do Salão</h1>
            <p className="text-xs text-muted-foreground">
              {nomeRestaurante} • Visão do Garçom & Fechamento de Contas
            </p>
          </div>
        </div>

        {/* BOTÃO DE CONTINGÊNCIA */}
        <div className="flex flex-wrap items-center gap-3">

          <Button
            type="button"
            onClick={() => setScannerAberto(true)}
            className="h-10 px-4 bg-card border border-border hover:bg-muted text-rose-500 font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all"
          >
            <QrCode className="w-4 h-4 text-rose-500" />
            <span>Ler QR Code (Contingência)</span>
          </Button>
        </div>
      </header>

      {/* ALERTA DE SUCESSO DE INJEÇÃO */}
      {feedbackInjecao && (
        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{feedbackInjecao}</span>
        </div>
      )}

      {/* BANDEJA DE AVISOS DE ENTREGA (PRATOS PRONTOS NA COZINHA) */}
      {pedidosProntos.length > 0 && (
        <section className="mt-4 p-4 bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-orange-950/60 border-2 border-amber-500/60 rounded-2xl shadow-xl shadow-amber-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <h2 className="text-sm font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                <ChefHat className="w-4 h-4 text-amber-400" />
                Bandeja de Entrega ({pedidosProntos.length}{" "}
                {pedidosProntos.length === 1 ? "pronto" : "prontos"})
              </h2>
            </div>
            <Badge className="bg-amber-500 text-neutral-950 text-[10px] font-black uppercase px-2 py-0.5">
              Pronto para Servir
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pedidosProntos.map((p) => {
              const estaAtualizando = atualizandoPedidoId === p.id;
              const totalItens = p.itens.reduce((acc, it) => acc + (it.quantidade || 1), 0);

              return (
                <div
                  key={p.id}
                  className="p-3 bg-neutral-900/90 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black text-xs">
                        Mesa {p.mesa || p.numeroMesa || "?"}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {p.nomeCliente || "Cliente"}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-300 truncate mt-1">
                      {p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", ")}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={estaAtualizando}
                    onClick={() => handleMarcarEntregue(p.refPath, p.id)}
                    className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shrink-0 flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{estaAtualizando ? "Entregando..." : "Marcar como Entregue"}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* RESUMO DO SALÃO */}
      <div className="mt-6 flex items-center gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-neutral-400">
          <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
          Livre
        </span>
        <span className="flex items-center gap-1.5 text-neutral-400">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Ocupada
        </span>
        <span className="flex items-center gap-1.5 text-rose-400 font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          Conta Pedida ({mesasComContaPedida})
        </span>
      </div>

      {/* GRID DO MAPA DE MESAS */}
      <main className="flex-1 mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {mesas.map((m) => {
            const ehChamado = Boolean(m.chamandoGarcom);
            const ehConta = m.status === "conta_pedida";
            const ehPagaOcupada = m.status === "paga_ocupada";
            const ehOcupada = m.status === "ocupada";
            const totalMesa = m.comandas.reduce((acc, c) => acc + c.subtotal, 0);

            return (
              <div
                key={m.numero}
                onClick={() => m.comandas.length > 0 && setMesaSelecionada(m)}
                className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between h-40 select-none ${
                  m.comandas.length > 0 ? "cursor-pointer active:scale-95" : "cursor-default opacity-40"
                } ${
                  ehChamado
                    ? "bg-amber-950/30 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-950/50 animate-pulse"
                    : ehConta
                    ? "bg-rose-950/20 border-rose-500 shadow-lg shadow-rose-950/40"
                    : ehPagaOcupada
                    ? "bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-950/50 hover:border-emerald-400"
                    : ehOcupada
                    ? "bg-card border-amber-500/60 hover:border-amber-500 shadow-xs"
                    : "bg-card/40 border-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${
                      ehChamado
                        ? "bg-amber-400 text-neutral-950 animate-bounce"
                        : ehConta
                        ? "bg-rose-600 text-white"
                        : ehPagaOcupada
                        ? "bg-emerald-600 text-white"
                        : ehOcupada
                        ? "bg-amber-500 text-neutral-950"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.numero}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {ehChamado && (
                      <Badge className="bg-amber-400 text-neutral-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 flex items-center gap-1 shadow-md">
                        <Bell className="w-3 h-3 fill-neutral-950" />
                        Garçom!
                      </Badge>
                    )}

                    {ehConta && !ehChamado && (
                      <Badge className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                        Pediu Conta
                      </Badge>
                    )}

                    {ehPagaOcupada && !ehChamado && (
                      <Badge className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 shadow-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Paga / Ocupada
                      </Badge>
                    )}

                    {m.alertaUpsell && (
                      <Badge className="bg-purple-900/90 text-purple-200 border border-purple-500/50 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 shadow-md flex items-center gap-1 animate-pulse">
                        ⏳ +15m parada (Sugerir Upsell?)
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  {m.comandas.length > 0 ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {m.comandas.length} {m.comandas.length === 1 ? "pessoa" : "pessoas"}
                        </span>
                      </div>
                      <span className="text-base font-black text-foreground block mt-1 tracking-tight">
                        {totalMesa.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground font-bold block">Mesa Livre</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL OPERACIONAL DE CONTROLE DA MESA */}
      <MesaDetalheModal
        mesa={mesaSelecionada}
        isOpen={!!mesaSelecionada}
        onClose={() => setMesaSelecionada(null)}
        slug={slug}
        restauranteId={restauranteId}
        taxaServicoPercentual={restaurante?.configuracoes?.taxaServico}
        onMarcarPago={handleMarcarComoPago}
        onLiberarMesa={handleLiberarMesa}
        onAtenderGarcom={handleAtenderGarcom}
        onLancarItem={(num, nome, item, qtd, obs) => {
          const valor = item.precoBase * qtd;
          let clienteIdDestino: string | undefined = undefined;

          setMesas((prev) =>
            prev.map((m) => {
              if (m.numero === num) {
                const comandaExistente = m.comandas.find(
                  (c) => c.nomeCliente.toLowerCase() === nome.toLowerCase()
                );
                let novasComandas: ComandaGarcom[];
                if (comandaExistente) {
                  clienteIdDestino = comandaExistente.id;
                  novasComandas = m.comandas.map((c) =>
                    c.id === comandaExistente.id
                      ? {
                          ...c,
                          subtotal: c.subtotal + valor,
                          itens: [
                            ...c.itens,
                            { nome: item.nome, quantidade: qtd, precoFinal: item.precoBase },
                          ],
                        }
                      : c
                  );
                } else {
                  const novoCId = `cli-${Date.now().toString(36)}`;
                  clienteIdDestino = novoCId;
                  novasComandas = [
                    ...m.comandas,
                    {
                      id: novoCId,
                      nomeCliente: nome,
                      subtotal: valor,
                      status: "aguardando_pratos",
                      itens: [{ nome: item.nome, quantidade: qtd, precoFinal: item.precoBase }],
                    },
                  ];
                }
                return { ...m, status: "ocupada", comandas: novasComandas };
              }
              return m;
            })
          );

          setMesaSelecionada((prev) => {
            if (!prev || prev.numero !== num) return prev;
            const comandaExistente = prev.comandas.find(
              (c) => c.nomeCliente.toLowerCase() === nome.toLowerCase()
            );
            if (comandaExistente) {
              return {
                ...prev,
                status: "ocupada",
                comandas: prev.comandas.map((c) =>
                  c.id === comandaExistente.id
                    ? {
                        ...c,
                        subtotal: c.subtotal + valor,
                        itens: [
                          ...c.itens,
                          { nome: item.nome, quantidade: qtd, precoFinal: item.precoBase },
                        ],
                      }
                    : c
                ),
              };
            }
            return {
              ...prev,
              status: "ocupada",
              comandas: [
                ...prev.comandas,
                {
                  id: `cli-${Date.now().toString(36)}`,
                  nomeCliente: nome,
                  subtotal: valor,
                  status: "aguardando_pratos",
                  itens: [{ nome: item.nome, quantidade: qtd, precoFinal: item.precoBase }],
                },
              ],
            };
          });

          // Injeção real no Firestore para o KDS da cozinha receber
          if (restauranteId) {
            lancarItemManualFirestore({
              restauranteId,
              slug,
              mesaNumero: num,
              clienteNome: nome,
              clienteId: clienteIdDestino,
              item,
              quantidade: qtd,
              observacao: obs,
            }).catch((err) => {
              console.warn("Falha ao injetar item lançado pelo garçom no Firestore:", err);
            });
          }
        }}
      />

      {/* MODAL SCANNER DE QR CODE DE CONTINGÊNCIA */}
      <QrScannerModal
        isOpen={scannerAberto}
        onClose={() => setScannerAberto(false)}
        onTicketLido={handleTicketLido}
      />
    </div>
  );
}
