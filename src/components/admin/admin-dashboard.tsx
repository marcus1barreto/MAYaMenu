"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { CARDAPIO_DEMO } from "@/lib/mock-data";
import type { MenuItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { MesaDetalheModal } from "./mesa-detalhe-modal";
import { MESAS_INICIAIS, type MesaOperacional, type ComandaGarcom } from "@/components/garcom/garcom-view";

export function AdminDashboard() {
  const { restaurante, logout, atualizarRestaurante } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<"cardapio" | "config" | "mesas">("cardapio");
  const [itensCardapio, setItensCardapio] = useState<MenuItem[]>(CARDAPIO_DEMO);
  const [corPrimaria, setCorPrimaria] = useState(
    restaurante?.configuracoes?.corPrimaria || "#E11D48"
  );
  const [salvandoCor, setSalvandoCor] = useState(false);

  // Controle de Mesas do Salão
  const [mesas, setMesas] = useState<MesaOperacional[]>(MESAS_INICIAIS);
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaOperacional | null>(null);
  const [modalMesaAberto, setModalMesaAberto] = useState(false);

  const handleAbrirMesa = (num: number) => {
    const mesaEncontrada = mesas.find((m) => m.numero === num) || {
      numero: num,
      status: "livre" as const,
      comandas: [],
    };
    setMesaSelecionada(mesaEncontrada);
    setModalMesaAberto(true);
  };

  const handleMarcarComoPago = (mesaNumero: number, clienteId: string) => {
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
  };

  const handleLiberarMesa = (mesaNumero: number) => {
    setMesas((prev) =>
      prev.map((m) =>
        m.numero === mesaNumero ? { ...m, status: "livre", comandas: [] } : m
      )
    );
    setMesaSelecionada((prev) =>
      prev && prev.numero === mesaNumero ? { ...prev, status: "livre", comandas: [] } : prev
    );
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

  // Toggle de item ativo/pausado instantâneo
  const handleToggleAtivo = (id: string) => {
    setItensCardapio((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ativo: !item.ativo } : item))
    );
  };

  const handleSalvarCor = async () => {
    setSalvandoCor(true);
    try {
      await atualizarRestaurante({
        configuracoes: {
          tema: "light",
          corPrimaria,
          capaUrl: restaurante?.configuracoes?.capaUrl || "/images/capa-padrao.webp",
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
                  Pause pratos esgotados com um clique para não receber pedidos na cozinha
                </p>
              </div>
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
                      <h4 className="text-sm font-bold text-white truncate">{item.nome}</h4>
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
                    <span className="text-xs font-medium text-neutral-400 hidden sm:inline">
                      {item.ativo ? "Disponível" : "Pausado (Esgotado)"}
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

                const totalMesa = mesa.comandas.reduce((acc, c) => acc + c.subtotal, 0);
                const qtdClientes = mesa.comandas.length;

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleAbrirMesa(num)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[140px] group relative overflow-hidden ${
                      mesa.status === "conta_pedida"
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
                          mesa.status === "conta_pedida"
                            ? "bg-rose-600 text-white shadow-md shadow-rose-600/40 animate-pulse"
                            : mesa.status === "ocupada"
                            ? "bg-amber-500 text-neutral-950 font-black shadow-md"
                            : "bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700"
                        }`}
                      >
                        {num}
                      </div>

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

              <Button
                type="button"
                onClick={handleSalvarCor}
                disabled={salvandoCor}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl mt-2"
              >
                {salvandoCor ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL OPERACIONAL DE DETALHES DA MESA */}
      <MesaDetalheModal
        mesa={mesaSelecionada}
        isOpen={modalMesaAberto}
        onClose={() => setModalMesaAberto(false)}
        slug={slug}
        onMarcarPago={handleMarcarComoPago}
        onLiberarMesa={handleLiberarMesa}
        onLancarItem={handleLancarItemManual}
      />
    </div>
  );
}
