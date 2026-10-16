"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { CARDAPIO_DEMO } from "@/lib/mock-data";
import type { MenuItem } from "@/types";
import {
  escutarCardapio,
  escutarComandasSalão,
  marcarComandaPagaFirestore,
  alternarDisponibilidadePrato,
  salvarItemCardapio,
  excluirItemCardapio,
  popularCardapioInicialSeVazio,
  atenderGarcomFirestore,
} from "@/lib/restaurante-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  UtensilsCrossed,
  ChefHat,
  Smartphone,
  ExternalLink,
  LogOut,
  Plus,
  QrCode,
  DollarSign,
  Palette,
  Check,
  Users,
  Clock,
  Bell,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { MesaDetalheModal } from "@/components/salao/mesa-detalhe-modal";
import { MESAS_INICIAIS, type MesaOperacional, type ComandaGarcom } from "@/components/garcom/garcom-view";

export function AdminDashboard() {
  const { restaurante, logout, atualizarRestaurante } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<"cardapio" | "config" | "mesas">("cardapio");
  const [itensCardapio, setItensCardapio] = useState<MenuItem[]>(CARDAPIO_DEMO);
  const [corPrimaria, setCorPrimaria] = useState(
    restaurante?.configuracoes?.corPrimaria || "#E11D48"
  );
  const [modoOperacao, setModoOperacao] = useState<"com_garcom" | "hibrido" | "balcao">(
    restaurante?.configuracoes?.modoOperacao || "hibrido"
  );
  const [salvandoCor, setSalvandoCor] = useState(false);

  // Sincroniza cardápio em tempo real com o Firestore
  useEffect(() => {
    if (!restaurante?.id) return;

    // Popula o cardápio inicial caso seja o primeiro acesso deste restaurante
    popularCardapioInicialSeVazio(restaurante.id);

    const unsub = escutarCardapio(restaurante.id, (novosItens) => {
      setItensCardapio(novosItens);
    });

    return () => unsub();
  }, [restaurante?.id]);

  // Controle de Mesas do Salão (1 a 12 livres por padrão, sincronizadas com Firestore)
  const [mesas, setMesas] = useState<MesaOperacional[]>(() => {
    const mapaLimpo: MesaOperacional[] = [];
    for (let i = 1; i <= 12; i++) {
      mapaLimpo.push({ numero: i, status: "livre", comandas: [] });
    }
    return mapaLimpo;
  });
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaOperacional | null>(null);
  const [modalMesaAberto, setModalMesaAberto] = useState(false);

  // Escuta comandas reais do restaurante no Firestore para o Salão do Admin
  useEffect(() => {
    if (!restaurante?.id) return;

    const unsub = escutarComandasSalão(restaurante.id, (comandasFirestore) => {
      setMesas(() => {
        const mapa = new Map<number, MesaOperacional>();
        for (let i = 1; i <= 12; i++) {
          mapa.set(i, { numero: i, status: "livre", comandas: [] });
        }

        for (const c of comandasFirestore) {
          const numMesa = Number(c.mesa) || 1;
          const mesaAtual = mapa.get(numMesa) || { numero: numMesa, status: "livre", comandas: [] };

          if (c.status !== "pago") {
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
  }, [restaurante?.id]);

  const handleAbrirMesa = (num: number) => {
    const mesaEncontrada = mesas.find((m) => m.numero === num) || {
      numero: num,
      status: "livre" as const,
      comandas: [],
    };
    setMesaSelecionada(mesaEncontrada);
    setModalMesaAberto(true);
  };

  const handleMarcarComoPago = async (mesaNumero: number, clienteId: string) => {
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
      return todasPagas ? { ...prev, status: "livre", comandas: [] } : { ...prev, comandas: novas };
    });

    if (restaurante?.id) {
      try {
        await marcarComandaPagaFirestore(restaurante.id, mesaNumero, clienteId);
      } catch (err) {
        console.warn("Falha ao marcar comanda como paga no Firestore:", err);
      }
    }
  };

  const handleLiberarMesa = async (mesaNumero: number) => {
    const mesaAlvo = mesas.find((m) => m.numero === mesaNumero);
    const comandasIds = mesaAlvo ? mesaAlvo.comandas.map((c) => c.id) : [];

    setMesas((prev) =>
      prev.map((m) =>
        m.numero === mesaNumero ? { ...m, status: "livre", comandas: [] } : m
      )
    );
    setMesaSelecionada((prev) =>
      prev && prev.numero === mesaNumero ? { ...prev, status: "livre", comandas: [] } : prev
    );

    if (restaurante?.id && comandasIds.length > 0) {
      try {
        const { liberarMesaFirestore } = await import("@/lib/restaurante-service");
        await liberarMesaFirestore(restaurante.id, mesaNumero, comandasIds);
      } catch (err) {
        console.warn("Falha ao liberar mesa no Firestore pelo Admin:", err);
      }
    }
  };

  const handleAtenderGarcom = async (mesaNumero: number, clienteId: string) => {
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

    if (restaurante?.id) {
      try {
        await atenderGarcomFirestore(restaurante.id, mesaNumero, clienteId);
      } catch (err) {
        console.warn("Falha ao desarmar chamado no Firestore pelo Admin:", err);
      }
    }
  };

  const handleLancarItemManual = (
    mesaNumero: number,
    clienteNome: string,
    item: MenuItem,
    quantidade: number,
    observacao?: string
  ) => {
    const precoFinal = item.precoBase * quantidade;

    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero === mesaNumero) {
          const comandaExistente = m.comandas.find(
            (c) => c.nomeCliente.toLowerCase() === clienteNome.toLowerCase()
          );

          let novasComandas: ComandaGarcom[];
          if (comandaExistente) {
            novasComandas = m.comandas.map((c) =>
              c.id === comandaExistente.id
                ? {
                    ...c,
                    subtotal: c.subtotal + precoFinal,
                    itens: [
                      ...c.itens,
                      {
                        nome: item.nome,
                        quantidade,
                        precoFinal: item.precoBase,
                      },
                    ],
                  }
                : c
            );
          } else {
            const novaComanda: ComandaGarcom = {
              id: `cli-${Date.now().toString(36)}`,
              nomeCliente: clienteNome,
              subtotal: precoFinal,
              status: "aguardando_pratos",
              itens: [
                {
                  nome: item.nome,
                  quantidade,
                  precoFinal: item.precoBase,
                },
              ],
            };
            novasComandas = [...m.comandas, novaComanda];
          }

          return {
            ...m,
            status: "ocupada",
            comandas: novasComandas,
          };
        }
        return m;
      })
    );

    setMesaSelecionada((prev) => {
      if (!prev || prev.numero !== mesaNumero) return prev;
      const comandaExistente = prev.comandas.find(
        (c) => c.nomeCliente.toLowerCase() === clienteNome.toLowerCase()
      );
      if (comandaExistente) {
        return {
          ...prev,
          status: "ocupada",
          comandas: prev.comandas.map((c) =>
            c.id === comandaExistente.id
              ? {
                  ...c,
                  subtotal: c.subtotal + precoFinal,
                  itens: [
                    ...c.itens,
                    {
                      nome: item.nome,
                      quantidade,
                      precoFinal: item.precoBase,
                    },
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
            nomeCliente: clienteNome,
            subtotal: precoFinal,
            status: "aguardando_pratos",
            itens: [
              {
                nome: item.nome,
                quantidade,
                precoFinal: item.precoBase,
              },
            ],
          },
        ],
      };
    });
  };

  // Toggle de item ativo/pausado instantâneo conectado ao Firestore
  const handleToggleAtivo = async (id: string) => {
    const itemAtual = itensCardapio.find((it) => it.id === id);
    if (!itemAtual) return;
    const novoStatus = !itemAtual.ativo;

    // Atualização otimista imediata na UI
    setItensCardapio((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ativo: novoStatus } : item))
    );

    if (restaurante?.id) {
      try {
        await alternarDisponibilidadePrato(restaurante.id, id, novoStatus);
      } catch (err) {
        console.warn("Falha ao sincronizar disponibilidade do prato:", err);
      }
    }
  };

  // Modal de Adicionar / Editar Prato
  const [modalPratoAberto, setModalPratoAberto] = useState(false);
  const [itemEmEdicao, setItemEmEdicao] = useState<Partial<MenuItem> | null>(null);
  const [salvandoPrato, setSalvandoPrato] = useState(false);

  const handleAbrirNovoPrato = () => {
    setItemEmEdicao({
      id: `item-${Date.now().toString(36)}`,
      nome: "",
      categoria: "Hambúrgueres",
      descricao: "",
      precoBase: 30,
      ativo: true,
      fotoUrl: "/images/demo/hamburger.webp",
    });
    setModalPratoAberto(true);
  };

  const handleEditarPrato = (item: MenuItem) => {
    setItemEmEdicao({ ...item });
    setModalPratoAberto(true);
  };

  const handleSalvarPrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEmEdicao || !itemEmEdicao.nome?.trim() || !restaurante?.id) return;

    setSalvandoPrato(true);
    try {
      const itemPronto: MenuItem = {
        id: itemEmEdicao.id || `item-${Date.now().toString(36)}`,
        nome: itemEmEdicao.nome.trim(),
        categoria: itemEmEdicao.categoria?.trim() || "Geral",
        descricao: itemEmEdicao.descricao?.trim() || "",
        precoBase: Number(itemEmEdicao.precoBase) || 0,
        ativo: itemEmEdicao.ativo !== undefined ? itemEmEdicao.ativo : true,
        fotoUrl: itemEmEdicao.fotoUrl?.trim() || "/images/demo/hamburger.webp",
        grupoModificadores: itemEmEdicao.grupoModificadores || [],
      };

      await salvarItemCardapio(restaurante.id, itemPronto);
      setModalPratoAberto(false);
      setItemEmEdicao(null);
    } catch (err) {
      console.warn("Falha ao salvar prato:", err);
    } finally {
      setSalvandoPrato(false);
    }
  };

  const handleExcluirPrato = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este prato do cardápio?")) return;
    if (restaurante?.id) {
      try {
        await excluirItemCardapio(restaurante.id, id);
      } catch (err) {
        console.warn("Falha ao excluir prato:", err);
      }
    }
  };

  const handleSalvarCor = async () => {
    setSalvandoCor(true);
    try {
      await atualizarRestaurante({
        configuracoes: {
          tema: "light",
          corPrimaria,
          capaUrl: restaurante?.configuracoes?.capaUrl || "/images/capa-padrao.webp",
          modoOperacao,
        },
      });
    } finally {
      setSalvandoCor(false);
    }
  };

  const slug = restaurante?.slug || "demo";
  const urlPublica = `/r/${slug}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* BARRA SUPERIOR DO PAINEL */}
      <header className="p-4 sm:p-6 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center font-black shadow-md">
            M
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight leading-tight">
              {restaurante?.nome || "Painel MAYaMenu"}
            </h1>
            <p className="text-xs text-neutral-400">Administração & Operação Alpha</p>
          </div>
        </div>

        {/* ATALHOS RÁPIDOS */}
        <div className="flex items-center gap-3">
          <Link href="/cozinha" target="_blank">
            <Button
              variant="outline"
              className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-amber-400 hover:text-amber-300 font-bold text-xs h-10 rounded-xl flex items-center gap-2"
            >
              <ChefHat className="w-4 h-4" />
              <span>Abrir KDS Cozinha</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </Link>

          <Link href={`${urlPublica}?mesa=1`} target="_blank">
            <Button
              variant="outline"
              className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white font-bold text-xs h-10 rounded-xl flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4 text-rose-500" />
              <span>Ver Cardápio PWA</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </Link>

          <Button
            type="button"
            variant="ghost"
            onClick={logout}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl text-xs h-10"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="border-b border-neutral-800 px-4 sm:px-6 bg-neutral-900/50">
        <div className="flex items-center gap-2 max-w-5xl mx-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva("cardapio")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === "cardapio"
                ? "border-rose-500 text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Cardápio & Itens ({itensCardapio.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("mesas")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === "mesas"
                ? "border-rose-500 text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Mesas & QR Codes</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("config")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === "config"
                ? "border-rose-500 text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Tematização & Capa</span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
        {/* ABA: CARDÁPIO */}
        {abaAtiva === "cardapio" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Gestão Rápida de Pratos</h2>
                <p className="text-xs text-neutral-400">
                  Gerencie pratos, preços, fotos e pause pratos esgotados com um clique.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleAbrirNovoPrato}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-3.5 rounded-xl flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Prato</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {itensCardapio.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    item.ativo
                      ? "bg-neutral-900 border-neutral-800"
                      : "bg-neutral-900/40 border-neutral-800/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.fotoUrl && (
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0">
                        <Image src={item.fotoUrl} alt={item.nome} fill className="object-cover" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate">{item.nome}</h4>
                        {item.categoria && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                            {item.categoria}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate max-w-md">
                        {item.descricao}
                      </p>
                      <span className="text-xs font-black text-rose-400 mt-1 block">
                        {item.precoBase.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleEditarPrato(item)}
                      className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluirPrato(item.id)}
                      className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Excluir
                    </button>
                    <span className="text-xs font-medium text-neutral-400 hidden sm:inline ml-1">
                      {item.ativo ? "Disponível" : "Pausado"}
                    </span>
                    <Switch
                      checked={item.ativo}
                      onCheckedChange={() => handleToggleAtivo(item.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA: CONTROLE OPERACIONAL DAS MESAS */}
        {abaAtiva === "mesas" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Controle de Mesas do Salão</h2>
                <p className="text-xs text-neutral-400">
                  Clique numa mesa para ver os pedidos, comandas por cliente, rateio de conta ou imprimir o QR Code.
                </p>
              </div>

              {/* Legenda de Status */}
              <div className="flex items-center gap-3 text-xs font-semibold">
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
                  Pediu Conta
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                const mesa = mesas.find((m) => m.numero === num) || {
                  numero: num,
                  status: "livre" as const,
                  comandas: [],
                };

                const ehChamado = Boolean(mesa.chamandoGarcom);
                const totalMesa = mesa.comandas.reduce((acc, c) => acc + c.subtotal, 0);
                const qtdClientes = mesa.comandas.length;

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleAbrirMesa(num)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[140px] group relative overflow-hidden ${
                      ehChamado
                        ? "bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-950/60 animate-pulse"
                        : mesa.status === "conta_pedida"
                        ? "bg-rose-950/40 border-rose-500/60 hover:border-rose-400 shadow-lg shadow-rose-950/50"
                        : mesa.status === "ocupada"
                        ? "bg-neutral-900 border-amber-500/40 hover:border-amber-400 shadow-md"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {/* Indicador de Status Superior */}
                    <div className="flex items-start justify-between w-full">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-transform group-hover:scale-105 ${
                          ehChamado
                            ? "bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/50 animate-bounce"
                            : mesa.status === "conta_pedida"
                            ? "bg-rose-600 text-white shadow-md shadow-rose-600/40 animate-pulse"
                            : mesa.status === "ocupada"
                            ? "bg-amber-500 text-neutral-950 font-black shadow-md"
                            : "bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700"
                        }`}
                      >
                        {num}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {ehChamado && (
                          <Badge className="bg-amber-400 text-neutral-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 flex items-center gap-1 shadow-md">
                            <Bell className="w-2.5 h-2.5 fill-neutral-950" />
                            Garçom!
                          </Badge>
                        )}

                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            mesa.status === "conta_pedida"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : mesa.status === "ocupada"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-neutral-800 text-neutral-500 border-neutral-700"
                          }`}
                        >
                          {mesa.status === "conta_pedida"
                            ? "Conta"
                            : mesa.status === "ocupada"
                            ? "Ocupada"
                            : "Livre"}
                        </Badge>
                      </div>
                    </div>

                    {/* Resumo da Mesa */}
                    <div className="mt-3">
                      <span className="text-xs font-bold text-white block">Mesa {num}</span>
                      {mesa.status !== "livre" ? (
                        <div className="mt-1">
                          <span className="text-sm font-black text-rose-400 block leading-none">
                            {totalMesa.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-1 font-medium">
                            <Users className="w-3 h-3 text-neutral-500" />
                            {qtdClientes} {qtdClientes === 1 ? "pessoa" : "pessoas"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-500 block mt-1">Disponível</span>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-neutral-800/80 text-[10px] font-bold text-neutral-400 group-hover:text-rose-400 flex items-center justify-between">
                      <span>Gerenciar Mesa</span>
                      <span>→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA: CONFIGURAÇÕES E TEMA */}
        {abaAtiva === "config" && (
          <div className="max-w-md space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Personalização Visual</h2>
              <p className="text-xs text-neutral-400">
                Configure a cor primária que reflete a identidade da sua marca no cardápio
              </p>
            </div>

            <div className="space-y-3 p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
                Cor Primária de Destaque
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-12 h-12 rounded-xl bg-transparent border-0 cursor-pointer"
                />
                <Input
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 text-white font-mono uppercase"
                />
              </div>

              {/* Pré-visualização da cor */}
              <div
                style={{ backgroundColor: corPrimaria }}
                className="w-full h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md"
              >
                Exemplo de Botão no Cardápio
              </div>
            </div>

            {/* MODELO OPERACIONAL DO SALÃO */}
            <div className="space-y-3 p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
                Modelo Operacional do Salão
              </label>
              <p className="text-xs text-neutral-400">
                Defina como os pedidos fluem entre a mesa, o garçom e a cozinha
              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModoOperacao("hibrido")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modoOperacao === "hibrido"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-neutral-800/50 border-neutral-700/60 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  <span className="text-xs font-bold block text-white">Híbrido / Suporte (Padrão)</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5 leading-snug">
                    O pedido vai direto para a cozinha. O garçom atende, entrega e recebe.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModoOperacao("com_garcom")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modoOperacao === "com_garcom"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-neutral-800/50 border-neutral-700/60 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  <span className="text-xs font-bold block text-white">Garçom Obrigatório</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5 leading-snug">
                    O pedido fica pendente e o garçom valida antes de liberar para a cozinha.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModoOperacao("balcao")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modoOperacao === "balcao"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-neutral-800/50 border-neutral-700/60 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  <span className="text-xs font-bold block text-white">Sem Garçom (Autoatendimento)</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5 leading-snug">
                    Cliente pede na mesa e retira no balcão quando pronto.
                  </span>
                </button>
              </div>

              <Button
                type="button"
                onClick={handleSalvarCor}
                disabled={salvandoCor}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl mt-3"
              >
                {salvandoCor ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL OPERACIONAL DE DETALHES DA MESA (Apenas monitoramento e QR Code no Admin) */}
      <MesaDetalheModal
        mesa={mesaSelecionada}
        isOpen={modalMesaAberto}
        onClose={() => setModalMesaAberto(false)}
        slug={slug}
        restauranteId={restaurante?.id}
        modoSomenteLeitura={true}
        onMarcarPago={handleMarcarComoPago}
        onLiberarMesa={handleLiberarMesa}
        onAtenderGarcom={handleAtenderGarcom}
        onLancarItem={handleLancarItemManual}
      />

      {/* MODAL DE ADICIONAR / EDITAR PRATO DO CARDÁPIO */}
      <Dialog open={modalPratoAberto} onOpenChange={(open) => !open && setModalPratoAberto(false)}>
        <DialogContent className="max-w-lg bg-neutral-900 border-neutral-800 text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-rose-500" />
              <span>{itemEmEdicao?.nome ? "Editar Prato" : "Novo Prato no Cardápio"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Preencha os detalhes do prato. As alterações são sincronizadas em tempo real com todos os clientes.
            </DialogDescription>
          </DialogHeader>

          {itemEmEdicao && (
            <form onSubmit={handleSalvarPrato} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Nome do Prato *
                </label>
                <Input
                  required
                  placeholder="Ex: Smash Burger Duplo"
                  value={itemEmEdicao.nome || ""}
                  onChange={(e) => setItemEmEdicao({ ...itemEmEdicao, nome: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Categoria *
                  </label>
                  <select
                    value={itemEmEdicao.categoria || "Hambúrgueres"}
                    onChange={(e) => setItemEmEdicao({ ...itemEmEdicao, categoria: e.target.value })}
                    className="w-full h-9 rounded-xl bg-neutral-800 border border-neutral-700 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Hambúrgueres">Hambúrgueres</option>
                    <option value="Pizzas">Pizzas</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Sobremesas">Sobremesas</option>
                    <option value="Entradas">Entradas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Preço Base (R$) *
                  </label>
                  <Input
                    required
                    type="number"
                    step="0.50"
                    min="0"
                    placeholder="29.90"
                    value={itemEmEdicao.precoBase ?? ""}
                    onChange={(e) =>
                      setItemEmEdicao({ ...itemEmEdicao, precoBase: parseFloat(e.target.value) || 0 })
                    }
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Descrição dos Ingredientes
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Dois burgers de 100g, cheddar duplo, cebola caramelizada e maionese da casa."
                  value={itemEmEdicao.descricao || ""}
                  onChange={(e) => setItemEmEdicao({ ...itemEmEdicao, descricao: e.target.value })}
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  URL da Foto
                </label>
                <Input
                  placeholder="/images/demo/hamburger.webp ou URL externa"
                  value={itemEmEdicao.fotoUrl || ""}
                  onChange={(e) => setItemEmEdicao({ ...itemEmEdicao, fotoUrl: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                <span className="text-xs font-bold text-neutral-300">Disponível para Pedidos</span>
                <Switch
                  checked={itemEmEdicao.ativo !== false}
                  onCheckedChange={(val) => setItemEmEdicao({ ...itemEmEdicao, ativo: val })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalPratoAberto(false)}
                  className="text-neutral-400 hover:text-white rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoPrato}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg"
                >
                  {salvandoPrato ? "Salvando..." : "Salvar Prato"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
