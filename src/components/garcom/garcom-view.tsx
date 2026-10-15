"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MesaDetalheModal } from "@/components/salao/mesa-detalhe-modal";
import {
  escutarComandasSalão,
  marcarComandaPagaFirestore,
  liberarMesaFirestore,
  injetarTicketContingencia,
} from "@/lib/restaurante-service";

export interface ComandaGarcom {
  id: string; // clienteId
  nomeCliente: string;
  subtotal: number;
  status: "pedindo" | "aguardando_pratos" | "conta_pedida" | "pago";
  itens: {
    nome: string;
    quantidade: number;
    precoFinal: number;
    modificadores?: { grupo: string; opcao: string }[];
  }[];
}

export interface MesaOperacional {
  numero: number;
  status: "livre" | "ocupada" | "conta_pedida";
  comandas: ComandaGarcom[];
}

export const MESAS_INICIAIS: MesaOperacional[] = [
  {
    numero: 12,
    status: "conta_pedida",
    comandas: [
      {
        id: "cli-marcus",
        nomeCliente: "Marcus",
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
        id: "cli-patricia",
        nomeCliente: "Patrícia",
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
        id: "cli-mayara",
        nomeCliente: "Mayara",
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
        id: "cli-pedro",
        nomeCliente: "Pedro",
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
}: {
  restauranteId?: string;
  slug?: string;
  nomeRestaurante?: string;
  isSandbox?: boolean;
}) {
  const [mesas, setMesas] = useState<MesaOperacional[]>(() => {
    if (isSandbox) return MESAS_INICIAIS;
    const mapaLimpo: MesaOperacional[] = [];
    for (let i = 1; i <= 12; i++) {
      mapaLimpo.push({ numero: i, status: "livre", comandas: [] });
    }
    return mapaLimpo;
  });
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaOperacional | null>(null);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [feedbackInjecao, setFeedbackInjecao] = useState<string | null>(null);

  // Escuta todas as comandas abertas do salão em tempo real
  useEffect(() => {
    if (!restauranteId) return;

    const unsub = escutarComandasSalão(restauranteId, (comandasFirestore) => {
      // Agrupa comandas por número de mesa (1 a 12)
      setMesas(() => {
        const mapa = new Map<number, MesaOperacional>();
        for (let i = 1; i <= 12; i++) {
          mapa.set(i, { numero: i, status: "livre", comandas: [] });
        }

        // Popula com comandas do Firestore
        for (const c of comandasFirestore) {
          const numMesa = Number(c.mesa) || 1;
          const mesaAtual = mapa.get(numMesa) || { numero: numMesa, status: "livre", comandas: [] };

          if (c.status !== "pago") {
            mesaAtual.comandas.push({
              id: c.id,
              nomeCliente: c.nomeCliente,
              subtotal: c.subtotal || 0,
              status: c.status,
              itens: [],
            });

            if (c.status === "conta_pedida") {
              mesaAtual.status = "conta_pedida";
            } else if (mesaAtual.status !== "conta_pedida") {
              mesaAtual.status = "ocupada";
            }
          }
          mapa.set(numMesa, mesaAtual);
        }

        return Array.from(mapa.values());
      });
    });

    return () => unsub();
  }, [restauranteId]);

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
            status: todasPagas ? "livre" : m.status,
            comandas: todasPagas ? [] : novasComandas,
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
      return todasPagas ? null : { ...prev, comandas: novas };
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

    setMesas((prev) =>
      prev.map((m) => (m.numero === mesaNumero ? { ...m, status: "livre", comandas: [] } : m))
    );
    setMesaSelecionada(null);

    if (restauranteId && comandasIds.length > 0) {
      try {
        await liberarMesaFirestore(restauranteId, mesaNumero, comandasIds);
      } catch (err) {
        console.warn("Falha ao liberar mesa no Firestore:", err);
      }
    }
  };

  // Injetar pedido resgatado pelo leitor de QR de contingência diretamente no Firestore
  const handleTicketLido = async (ticket: TicketPayload) => {
    const mesaNum = Number(ticket.t) || 1;
    const subtotalCalculado = ticket.i.reduce((acc, it) => acc + it.q * 30, 0); // estimativa base

    const novaComanda: ComandaGarcom = {
      id: ticket.c.id,
      nomeCliente: ticket.c.n,
      subtotal: subtotalCalculado,
      status: "aguardando_pratos",
      itens: ticket.i.map((it) => ({
        nome: `Item (${it.id})`,
        quantidade: it.q,
        precoFinal: 30,
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6 flex flex-col">
      {/* CABEÇALHO DA VISÃO DO GARÇOM */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 rounded-2xl shadow-lg">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Mapa de Mesas do Salão</h1>
            <p className="text-xs text-neutral-400">
              {nomeRestaurante} • Visão do Garçom & Fechamento de Contas
            </p>
          </div>
        </div>

        {/* BOTÃO DE CONTINGÊNCIA: LER QR CODE */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => setScannerAberto(true)}
            className="h-11 px-4 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-rose-400 hover:text-rose-300 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg"
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
            const ehConta = m.status === "conta_pedida";
            const ehOcupada = m.status === "ocupada";
            const totalMesa = m.comandas.reduce((acc, c) => acc + c.subtotal, 0);

            return (
              <button
                key={m.numero}
                type="button"
                onClick={() => m.comandas.length > 0 && setMesaSelecionada(m)}
                disabled={m.status === "livre"}
                className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between h-40 ${
                  ehConta
                    ? "bg-rose-950/20 border-rose-500 shadow-lg shadow-rose-950/40 active:scale-95"
                    : ehOcupada
                    ? "bg-neutral-900 border-amber-500/60 hover:border-amber-500 active:scale-95"
                    : "bg-neutral-900/40 border-neutral-800/60 opacity-40 cursor-default"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${
                      ehConta
                        ? "bg-rose-600 text-white"
                        : ehOcupada
                        ? "bg-amber-500 text-neutral-950"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {m.numero}
                  </div>

                  {ehConta && (
                    <Badge className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                      Pediu Conta
                    </Badge>
                  )}
                </div>

                <div>
                  {m.comandas.length > 0 ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {m.comandas.length} {m.comandas.length === 1 ? "pessoa" : "pessoas"}
                        </span>
                      </div>
                      <span className="text-base font-black text-white block mt-1 tracking-tight">
                        {totalMesa.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-neutral-600 font-bold block">Mesa Livre</span>
                  )}
                </div>
              </button>
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
        onMarcarPago={handleMarcarComoPago}
        onLiberarMesa={handleLiberarMesa}
        onLancarItem={(num, nome, item, qtd) => {
          const valor = item.precoBase * qtd;
          setMesas((prev) =>
            prev.map((m) => {
              if (m.numero === num) {
                const comandaExistente = m.comandas.find(
                  (c) => c.nomeCliente.toLowerCase() === nome.toLowerCase()
                );
                let novasComandas: ComandaGarcom[];
                if (comandaExistente) {
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
                  novasComandas = [
                    ...m.comandas,
                    {
                      id: `cli-${Date.now().toString(36)}`,
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
