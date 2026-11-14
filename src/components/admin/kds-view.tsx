"use client";

import { useState, useEffect } from "react";
import type { ComandaCliente, PedidoRodada } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, ChefHat, Sparkles, AlertTriangle, ArrowRight, Printer, Check, Volume2, VolumeX } from "lucide-react";
import { db } from "@/lib/firebase";
import { collectionGroup, query, where, onSnapshot } from "firebase/firestore";
import { escutarPedidosKds, atualizarStatusPedido } from "@/lib/restaurante-service";
import { imprimirComandaKds } from "@/lib/kds-printer";
import { obterImpressoraSalva, esquecerImpressoraUSB } from "@/lib/web-serial";
import { audioAlertService } from "@/lib/audio-alerts";

export interface PedidoKDS {
  id: string; // id do pedido
  refPath?: string; // caminho no Firestore
  mesa: number | string;
  clienteId: string;
  nomeCliente: string;
  garcomNome?: string;
  horario: string;
  subtotal: number;
  status: "a_fazer" | "pronto" | "entregue";
  itens: {
    menuItemId: string;
    nome: string;
    quantidade: number;
    precoFinal: number;
    tempoPreparoEstimado?: number;
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
    subtotal: 38.0,
    status: "a_fazer",
    itens: [
      {
        menuItemId: "item-burguer-artesanal",
        nome: "MAYaBurger Especial",
        quantidade: 1,
        precoFinal: 38.0,
        modificadores: [{ grupo: "Ponto da Carne", opcao: "Bem Passado" }],
        observacoes: "Pão bem tostado por favor",
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
  const [impressoraConectada, setImpressoraConectada] = useState<boolean>(false);
  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const [audioAtivo, setAudioAtivo] = useState(true);

  // Verifica se há impressora pareada e estado do áudio
  useEffect(() => {
    setImpressoraConectada(Boolean(obterImpressoraSalva()));
    setAudioAtivo(audioAlertService.isHabilitado());
  }, []);

  const handleImprimirPedido = async (ped: PedidoKDS, forcarSelecao: boolean = false) => {
    setImprimindoId(ped.id);
    try {
      const res = await imprimirComandaKds(ped, nomeRestaurante, forcarSelecao);
      if (res.sucesso) {
        setImpressoraConectada(true);
      } else if (res.erro) {
        alert(`Erro na impressão: ${res.erro}`);
      }
    } finally {
      setImprimindoId(null);
    }
  };

  // Conecta ao Firestore em tempo real escutando a subcoleção isolada kds_tickets
  useEffect(() => {
    if (isSandbox) return;
    const idBusca = restauranteId || slug;
    if (!idBusca) return;

    const unsub = escutarPedidosKds(idBusca, (listaAtualizada) => {
      // Se a lista aumentou e há novos pedidos 'a_fazer', toca o alerta sonoro de novo pedido
      setPedidos((prev) => {
        const novosAFazer = listaAtualizada.filter((p) => p.status === "a_fazer");
        const anterioresAFazer = prev.filter((p) => p.status === "a_fazer");
        if (novosAFazer.length > anterioresAFazer.length) {
          audioAlertService.tocarNovoPedidoKds();
        }
        return listaAtualizada;
      });
    });

    return () => unsub();
  }, [restauranteId, slug, isSandbox]);

  const [chamadosAtendimento, setChamadosAtendimento] = useState<
    { id: string; mesa: number | string; nomeCliente?: string }[]
  >([]);

  useEffect(() => {
    if (!restauranteId || isSandbox) return;
    const q = query(
      collectionGroup(db, "comandas_abertas"),
      where("restauranteId", "==", restauranteId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const ativos = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Partial<ComandaCliente>) }))
          .filter((c) => c.chamadoGarcom?.ativo === true)
          .map((c) => ({
            id: c.id,
            mesa: c.mesa ?? "?",
            nomeCliente: c.nomeCliente?.trim() || undefined,
          }));
        setChamadosAtendimento(ativos);
      },
      () => {
        // Silencia erro de listener caso sessão ainda esteja autenticando
      }
    );
    return () => unsub();
  }, [restauranteId, isSandbox]);

  // Ação essencial da cozinha: "MARCHAR" (Muda de A Fazer -> Pronto)
  const handleMarchar = async (id: string) => {
    const pedidoAlvo = pedidos.find((p) => p.id === id);
    if (!pedidoAlvo) return;

    // A transição é unidirecional: "pronto" não pode voltar para "a_fazer".
    if (pedidoAlvo.status !== "a_fazer") return;
    const novoStatus = "pronto";

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
        await atualizarStatusPedido(pedidoAlvo.refPath, novoStatus, {
          pedidoRefPath: (pedidoAlvo as any).pedidoRefPath,
        });
      } catch (err) {
        console.warn("Falha ao atualizar status do pedido no Firestore:", err);
        setPedidos((prev) =>
          prev.map((p) => p.id === id ? { ...p, status: pedidoAlvo.status } : p)
        );
      }
    }
  };

  const pedidosAFazer = pedidos.filter((p) => p.status === "a_fazer");
  const pedidosProntos = pedidos.filter((p) => p.status === "pronto");

  // Ordenação inteligente do KDS
  const ordenarLista = (lista: PedidoKDS[]) => {
    if (modoFilaKds === "agrupamento") {
      // Passo 1: Descobrir o horário do pedido raiz (mais antigo) de cada mesa
      const tempoPrimeiroPedidoPorMesa: Record<string, string> = {};

      lista.forEach((ped) => {
        const mesaStr = String(ped.mesa);
        if (!tempoPrimeiroPedidoPorMesa[mesaStr] || ped.horario < tempoPrimeiroPedidoPorMesa[mesaStr]) {
          tempoPrimeiroPedidoPorMesa[mesaStr] = ped.horario;
        }
      });

      return [...lista].sort((a, b) => {
        const mesaA = String(a.mesa);
        const mesaB = String(b.mesa);

        // Passo 2: Se forem mesas diferentes, a mesa que chegou primeiro na loja ganha
        if (mesaA !== mesaB) {
          const tempoA = tempoPrimeiroPedidoPorMesa[mesaA];
          const tempoB = tempoPrimeiroPedidoPorMesa[mesaB];
          if (tempoA !== tempoB) {
            return tempoA.localeCompare(tempoB);
          }
          // Desempate por número numérico da mesa se os horários forem idênticos
          return mesaA.localeCompare(mesaB, undefined, { numeric: true });
        }

        // Passo 3: Mesma mesa? Prioriza o ticket que tem o prato mais demorado para sincronizar a entrega
        const tempoMaxA = Math.max(...a.itens.map((i) => i.tempoPreparoEstimado || 0));
        const tempoMaxB = Math.max(...b.itens.map((i) => i.tempoPreparoEstimado || 0));

        if (tempoMaxA !== tempoMaxB) {
          return tempoMaxB - tempoMaxA; // Ordem decrescente
        }

        // Desempate final pelo horário do ticket
        return a.horario.localeCompare(b.horario);
      });
    }

    // Sequencial padrão: Estrito FIFO por horário de chegada do ticket
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
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-4 sm:p-6 flex flex-col relative selection:bg-rose-500 selection:text-white">
      {/* BARRA SUPERIOR DO KDS - CLEAN LIGHT LUXURY */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs mb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-600 rounded-2xl shadow-md shadow-rose-600/20 flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-neutral-900">
              <span>KDS da Cozinha</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                AO VIVO
              </span>
              {modoFilaKds === "agrupamento" ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold uppercase tracking-wider border border-emerald-200">
                  Agrupamento Ágil Pro
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-bold uppercase tracking-wider border border-neutral-200">
                  Fila Sequencial (FIFO)
                </span>
              )}
            </h1>
            <p className="text-xs text-neutral-500">{nomeRestaurante} • Visão Operacional da Cozinha</p>
          </div>
        </div>

        {/* CONTADORES RÁPIDOS E FILTROS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* BOTÃO MUDO / ÁUDIO DA COZINHA */}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const novo = !audioAtivo;
              audioAlertService.setHabilitado(novo);
              setAudioAtivo(novo);
            }}
            className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              audioAtivo
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-neutral-100 border-neutral-200 hover:bg-neutral-200 text-neutral-600"
            }`}
            title={audioAtivo ? "Alertas sonoros ativados" : "Alertas sonoros silenciados"}
          >
            {audioAtivo ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-400" />}
            <span className="hidden sm:inline">{audioAtivo ? "Som Ativo" : "Silenciado"}</span>
          </Button>

          {/* BOTÃO PAREAMENTO DE IMPRESSORA TÉRMICA USB */}
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (impressoraConectada) {
                if (confirm("Deseja desconectar a impressora pareada?")) {
                  esquecerImpressoraUSB();
                  setImpressoraConectada(false);
                }
              } else {
                try {
                  const { obterPortaImpressora } = await import("@/lib/web-serial");
                  await obterPortaImpressora(true);
                  setImpressoraConectada(true);
                } catch (e: any) {
                  alert(e?.message || "Erro ao conectar impressora.");
                }
              }
            }}
            className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              impressoraConectada
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-neutral-100 border-neutral-200 hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Conectar ou gerenciar impressora térmica de bobina USB"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {impressoraConectada ? "Impressora Conectada" : "Parear Impressora USB"}
            </span>
          </Button>

          <div className="flex items-center gap-1.5 bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200/80">
            <button
              type="button"
              onClick={() => setFiltro("todos")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filtro === "todos"
                  ? "bg-white text-neutral-900 shadow-xs font-black border border-neutral-200/80"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Todos ({pedidos.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro("a_fazer")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filtro === "a_fazer"
                  ? "bg-amber-500 text-white shadow-xs font-black"
                  : "text-amber-700 hover:text-amber-900"
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
                  ? "bg-emerald-600 text-white shadow-xs font-black"
                  : "text-emerald-700 hover:text-emerald-900"
              }`}
            >
              Prontos ({pedidosProntos.length})
            </button>
          </div>
        </div>
      </header>

      {chamadosAtendimento.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Atendimento solicitado:</span>
            {chamadosAtendimento.map((ch) => (
              <span
                key={ch.id}
                className="inline-flex items-center rounded-full bg-amber-200/80 px-3 py-0.5 text-xs font-extrabold text-amber-950"
              >
                {ch.nomeCliente
                  ? `${ch.nomeCliente}, da Mesa ${ch.mesa}, solicita atendimento`
                  : `Mesa ${ch.mesa} solicita atendimento`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* QUADRO DE COMANDAS / PEDIDOS */}
      <main className="flex-1">
        {listaExibicao.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-neutral-400 bg-white rounded-3xl border border-neutral-200/80 shadow-xs">
            <CheckCircle className="w-12 h-12 text-neutral-300 mb-2" />
            <p className="text-base font-bold text-neutral-700">Nenhum pedido nesta seção.</p>
            <p className="text-xs text-neutral-400">Aguardando novas entradas do cardápio digital.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 items-start">
            {listaExibicao.map((ped) => {
              const ehAFazer = ped.status === "a_fazer";

              return (
                <div
                  key={ped.id}
                  className={`flex flex-col rounded-3xl border overflow-hidden transition-all ${
                    ehAFazer
                      ? "bg-white border-amber-300/80 shadow-lg shadow-amber-950/5 ring-1 ring-amber-400/20"
                      : "bg-white border-emerald-200/80 shadow-xs opacity-90"
                  }`}
                >
                  {/* CABEÇALHO DO CARD (Mesa e Nome do Cliente) */}
                  <div
                    className={`p-4 flex items-center justify-between border-b ${
                      ehAFazer
                        ? "bg-amber-50/70 border-amber-200/60 text-amber-950"
                        : "bg-emerald-50/70 border-emerald-200/60 text-emerald-950"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${
                          ehAFazer ? "bg-amber-500 text-white shadow-xs" : "bg-emerald-600 text-white shadow-xs"
                        }`}
                      >
                        {ped.mesa}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 block">
                          Mesa {ped.mesa} {ped.garcomNome ? `• 👤 ${ped.garcomNome}` : ""}
                        </span>
                        <h3 className="text-base font-black text-neutral-900 leading-tight">
                          {ped.nomeCliente}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{ped.horario}</span>
                    </div>
                  </div>

                  {/* ITENS DO PEDIDO COM DESTAQUE EM VERMELHO PARA MODIFICADORES */}
                  <div className="p-4 flex-1 space-y-3.5 divide-y divide-neutral-100">
                    {ped.itens.map((it, idx) => (
                      <div key={idx} className={idx > 0 ? "pt-3.5" : ""}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="w-6 h-6 mt-0.5 rounded-lg bg-neutral-100 border border-neutral-200/80 text-neutral-800 font-black text-xs flex items-center justify-center shrink-0">
                              {it.quantidade}x
                            </span>
                            <span className="text-sm font-bold text-neutral-900 leading-snug">
                              {it.nome}
                            </span>
                          </div>

                          {/* Badge Dinâmico de Tempo de Preparo */}
                          {it.tempoPreparoEstimado && (
                            <div
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                it.tempoPreparoEstimado >= 30
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{it.tempoPreparoEstimado}m</span>
                            </div>
                          )}
                        </div>

                        {/* Modificadores em VERMELHO conforme especificação */}
                        {it.modificadores && it.modificadores.length > 0 && (
                          <div className="mt-2 pl-8 space-y-1">
                            {it.modificadores.map((mod, mIdx) => (
                              <div
                                key={mIdx}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider mr-1.5 mb-1"
                              >
                                <span>{mod.grupo}:</span>
                                <span className="underline decoration-rose-500">{mod.opcao}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Observações da cozinha */}
                        {it.observacoes && (
                          <div className="mt-1.5 pl-8">
                            <span className="text-xs font-semibold text-amber-800 italic bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 block">
                              Obs: {it.observacoes}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* AÇÕES: IMPRIMIR CUPOM TÉRMICO E MARCHAR */}
                  <div className="p-4 bg-neutral-50/80 border-t border-neutral-100 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleImprimirPedido(ped)}
                      disabled={imprimindoId === ped.id}
                      className="h-14 px-4 rounded-2xl border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 shadow-xs flex items-center justify-center gap-1.5 shrink-0"
                      title="Imprimir comanda de produção térmica (ESC/POS)"
                    >
                      <Printer className="w-5 h-5 text-neutral-600" />
                      <span className="hidden sm:inline text-xs font-bold">Imprimir</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleMarchar(ped.id)}
                      disabled={!ehAFazer}
                      className={`flex-1 h-14 rounded-2xl font-black text-base shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                        ehAFazer
                          ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25"
                          : "bg-neutral-200 hover:bg-neutral-300 text-neutral-800 border border-neutral-300"
                      }`}
                    >
                      {ehAFazer ? (
                        <>
                          <ChefHat className="w-5 h-5" />
                          <span>MARCHAR PEDIDO</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <span>Pronto</span>
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
