"use client";

import { useState, useEffect } from "react";
import type { ComandaCliente, PedidoRodada } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, ChefHat, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { collectionGroup, query, where, onSnapshot } from "firebase/firestore";
import { escutarPedidosKds, atualizarStatusPedido } from "@/lib/restaurante-service";

export interface PedidoKDS {
  id: string; // id do pedido
  refPath?: string; // caminho no Firestore
  mesa: number | string;
  clienteId: string;
  nomeCliente: string;
  horario: string;
  subtotal: number;
  status: "a_fazer" | "pronto" | "entregue";
  itens: {
    menuItemId: string;
    nome: string;
    quantidade: number;
    precoFinal: number;
    modificadores?: { grupo: string; opcao: string }[];
    observacoes?: string;
  }[];
}

// Pedidos demonstrativos para operação e teste do KDS
export const PEDIDOS_INICIAIS_KDS: PedidoKDS[] = [
  {
    id: "comanda-mesa-12-cliente-a",
    mesa: 12,
    clienteId: "user-cliente-a",
    nomeCliente: "Cliente A",
    horario: "19:42",
    subtotal: 82.0,
    status: "a_fazer",
    itens: [
      {
        menuItemId: "item-burguer-artesanal",
        nome: "MAYaBurger Especial",
        quantidade: 2,
        precoFinal: 44.0,
        modificadores: [
          { grupo: "Ponto da Carne", opcao: "Ao Ponto" },
          { grupo: "Adicionais do Chef", opcao: "Bacon Crocante Duplo" },
        ],
        observacoes: "Sem cebola em 1 dos hambúrgueres",
      },
      {
        menuItemId: "item-coquetel-tropical",
        nome: "Coquetel Sunburst Maya",
        quantidade: 1,
        precoFinal: 29.0,
        modificadores: [{ grupo: "Versão", opcao: "Com Álcool (Gin Artesanal)" }],
      },
    ],
  },
  {
    id: "comanda-mesa-04-cliente-b",
    mesa: 4,
    clienteId: "user-cliente-b",
    nomeCliente: "Cliente B",
    horario: "19:48",
    subtotal: 62.0,
    status: "a_fazer",
    itens: [
      {
        menuItemId: "item-pizza-napolitana",
        nome: "Pizza Napolitana Rústica",
        quantidade: 1,
        precoFinal: 62.0,
        modificadores: [{ grupo: "Borda Recheada", opcao: "Catupiry Original" }],
        observacoes: "Massa bem dourada por favor",
      },
    ],
  },
  {
    id: "comanda-mesa-07-cliente-c",
    mesa: 7,
    clienteId: "user-cliente-c",
    nomeCliente: "Cliente C",
    horario: "19:35",
    subtotal: 22.0,
    status: "pronto",
    itens: [
      {
        menuItemId: "item-sorvete-artesanal",
        nome: "Gelato Pistache & Frutas Vermelhas",
        quantidade: 1,
        precoFinal: 22.0,
        modificadores: [{ grupo: "Cobertura Adicional", opcao: "Farofa Crocante de Castanhas" }],
      },
    ],
  },
];

export function KdsView({
  restauranteId,
  slug,
  nomeRestaurante = "MAYaMenu",
  isSandbox = false,
  dadosIniciais,
  modoFilaKds = "sequencial",
}: {
  restauranteId?: string;
  slug?: string;
  nomeRestaurante?: string;
  isSandbox?: boolean;
  dadosIniciais?: PedidoKDS[];
  modoFilaKds?: "sequencial" | "agrupamento";
}) {
  const [pedidos, setPedidos] = useState<PedidoKDS[]>(() => {
    if (dadosIniciais !== undefined) return dadosIniciais;
    return isSandbox ? PEDIDOS_INICIAIS_KDS : [];
  });
  const [filtro, setFiltro] = useState<"todos" | "a_fazer" | "pronto">("todos");

  // Conecta ao Firestore em tempo real tratando a deleção e remoção de pedidos ao fechar a mesa
  useEffect(() => {
    if (isSandbox) return;
    const idBusca = restauranteId || slug;
    if (!idBusca) return;

    const idsParaBuscar = Array.from(
      new Set([restauranteId, slug].filter(Boolean) as string[])
    );

    const q = idsParaBuscar.length > 1
      ? query(collectionGroup(db, "pedidos"), where("restauranteId", "in", idsParaBuscar))
      : query(collectionGroup(db, "pedidos"), where("restauranteId", "==", idsParaBuscar[0]));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setPedidos((prevPedidos) => {
          let lista = [...prevPedidos];

          snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            if (change.type === "removed") {
              // Quando a mesa é fechada ou os pedidos são excluídos, retira os pratos do ecrã instantaneamente
              lista = lista.filter((p) => p.id !== docId);
            } else if (change.type === "added" || change.type === "modified") {
              const data = change.doc.data() as PedidoRodada;

              // Se marcado como entregue, não polui a esteira do KDS
              if (data.status === "entregue") {
                lista = lista.filter((p) => p.id !== docId);
                return;
              }

              let horarioFormatado = "Agora";
              if (data.criadoEm?.toDate) {
                horarioFormatado = data.criadoEm.toDate().toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }

              const pedidoConvertido: PedidoKDS = {
                id: docId,
                refPath: change.doc.ref.path,
                mesa: data.mesa,
                clienteId: data.clienteId,
                nomeCliente: data.nomeCliente,
                horario: horarioFormatado,
                subtotal: data.subtotal,
                status: data.status,
                itens: data.itens || [],
              };

              const index = lista.findIndex((p) => p.id === docId);
              if (index >= 0) {
                lista[index] = pedidoConvertido;
              } else {
                lista.push(pedidoConvertido);
              }
            }
          });

          return lista;
        });
      },
      (err) => {
        console.warn("Listener do KDS indisponível (offline ou index pendente):", err);
      }
    );

    return () => unsub();
  }, [restauranteId, slug, isSandbox]);

  // Ação essencial da cozinha: "MARCHAR" (Muda de A Fazer -> Pronto)
  const handleMarchar = async (id: string) => {
    const pedidoAlvo = pedidos.find((p) => p.id === id);
    if (!pedidoAlvo) return;

    const novoStatus = pedidoAlvo.status === "a_fazer" ? "pronto" : "a_fazer";

    // Atualização otimista imediata na UI
    setPedidos((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            status: novoStatus,
          };
        }
        return p;
      })
    );

    // Se tiver caminho persistente no Firestore, atualiza em tempo real
    if (pedidoAlvo.refPath) {
      try {
        await atualizarStatusPedido(pedidoAlvo.refPath, novoStatus);
      } catch (err) {
        console.warn("Falha ao atualizar status do pedido no Firestore:", err);
      }
    }
  };

  const pedidosAFazer = pedidos.filter((p) => p.status === "a_fazer");
  const pedidosProntos = pedidos.filter((p) => p.status === "pronto");

  // Ordenação de acordo com o modo da fila selecionado:
  // - "sequencial": FIFO por horário (ou ordem de chegada)
  // - "agrupamento": Agrupa por mesa para agilidade da praça nos horários de pico
  const ordenarLista = (lista: PedidoKDS[]) => {
    if (modoFilaKds === "agrupamento") {
      return [...lista].sort((a, b) => {
        // Agrupa mesas iguais primeiro
        if (a.mesa !== b.mesa) {
          return String(a.mesa).localeCompare(String(b.mesa), undefined, { numeric: true });
        }
        return a.horario.localeCompare(b.horario);
      });
    }
    // Sequencial padrão: FIFO por horário
    return [...lista].sort((a, b) => a.horario.localeCompare(b.horario));
  };

  const listaFiltrada =
    filtro === "todos"
      ? pedidos
      : filtro === "a_fazer"
      ? pedidosAFazer
      : pedidosProntos;

  const listaExibicao = ordenarLista(listaFiltrada);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6 flex flex-col">
      {/* BARRA SUPERIOR DO KDS */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 rounded-2xl shadow-lg">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <span>KDS da Cozinha</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                AO VIVO
              </span>
              {modoFilaKds === "agrupamento" ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider">
                  Agrupamento Ágil Pro
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-bold uppercase tracking-wider">
                  Fila Sequencial (FIFO)
                </span>
              )}
            </h1>
            <p className="text-xs text-neutral-400">{nomeRestaurante} • Visão Operacional</p>
          </div>
        </div>

        {/* CONTADORES RÁPIDOS E FILTROS */}
        <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setFiltro("todos")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filtro === "todos"
                ? "bg-white text-neutral-950 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Todos ({pedidos.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("a_fazer")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filtro === "a_fazer"
                ? "bg-amber-500 text-neutral-950 shadow-sm"
                : "text-amber-400 hover:text-amber-300"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            A Fazer ({pedidosAFazer.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("pronto")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filtro === "pronto"
                ? "bg-emerald-500 text-neutral-950 shadow-sm"
                : "text-emerald-400 hover:text-emerald-300"
            }`}
          >
            Prontos ({pedidosProntos.length})
          </button>
        </div>
      </header>

      {/* QUADRO DE COMANDAS / PEDIDOS */}
      <main className="flex-1 mt-6">
        {listaExibicao.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-neutral-500">
            <CheckCircle className="w-12 h-12 text-neutral-700 mb-2" />
            <p className="text-base font-bold">Nenhum pedido nesta seção.</p>
            <p className="text-xs">Aguardando novas entradas do cardápio digital.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 items-start">
            {listaExibicao.map((ped) => {
              const ehAFazer = ped.status === "a_fazer";

              return (
                <div
                  key={ped.id}
                  className={`flex flex-col rounded-3xl border-2 overflow-hidden shadow-2xl transition-all ${
                    ehAFazer
                      ? "bg-neutral-900 border-amber-500/80 shadow-amber-950/20"
                      : "bg-neutral-900/60 border-emerald-600/40 opacity-75"
                  }`}
                >
                  {/* CABEÇALHO DO CARD (Mesa e Nome do Cliente) */}
                  <div
                    className={`p-4 flex items-center justify-between border-b ${
                      ehAFazer
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${
                          ehAFazer ? "bg-amber-500 text-neutral-950" : "bg-emerald-500 text-neutral-950"
                        }`}
                      >
                        {ped.mesa}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 block">
                          Mesa {ped.mesa}
                        </span>
                        <h3 className="text-base font-black text-white leading-tight">
                          {ped.nomeCliente}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{ped.horario}</span>
                    </div>
                  </div>

                  {/* ITENS DO PEDIDO COM DESTAQUE EM VERMELHO PARA MODIFICADORES */}
                  <div className="p-4 flex-1 space-y-3.5 divide-y divide-neutral-800/80">
                    {ped.itens.map((it, idx) => (
                      <div key={idx} className={idx > 0 ? "pt-3.5" : ""}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-baseline gap-2">
                            <span className="w-6 h-6 rounded-lg bg-neutral-800 text-white font-black text-xs flex items-center justify-center flex-shrink-0">
                              {it.quantidade}x
                            </span>
                            <span className="text-sm font-bold text-white leading-snug">
                              {it.nome}
                            </span>
                          </div>
                        </div>

                        {/* Modificadores em VERMELHO conforme especificação */}
                        {it.modificadores && it.modificadores.length > 0 && (
                          <div className="mt-2 pl-8 space-y-1">
                            {it.modificadores.map((mod, mIdx) => (
                              <div
                                key={mIdx}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider mr-1.5 mb-1"
                              >
                                <span>{mod.grupo}:</span>
                                <span className="underline decoration-rose-400">{mod.opcao}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Observações da cozinha */}
                        {it.observacoes && (
                          <div className="mt-1.5 pl-8">
                            <span className="text-xs font-semibold text-amber-300 italic bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 block">
                              Obs: {it.observacoes}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* BOTÃO ÚNICO DE AÇÃO: "MARCHAR" */}
                  <div className="p-4 bg-neutral-950/80 border-t border-neutral-800">
                    <Button
                      type="button"
                      onClick={() => handleMarchar(ped.id)}
                      className={`w-full h-14 rounded-2xl font-black text-base shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 ${
                        ehAFazer
                          ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40"
                          : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                      }`}
                    >
                      {ehAFazer ? (
                        <>
                          <ChefHat className="w-5 h-5" />
                          <span>MARCHAR PEDIDO</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                          <span>Pronto (Desfazer)</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
