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
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function AdminDashboard() {
  const { restaurante, logout, atualizarRestaurante } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<"cardapio" | "config" | "mesas">("cardapio");
  const [itensCardapio, setItensCardapio] = useState<MenuItem[]>(CARDAPIO_DEMO);
  const [corPrimaria, setCorPrimaria] = useState(
    restaurante?.configuracoes?.corPrimaria || "#E11D48"
  );
  const [salvandoCor, setSalvandoCor] = useState(false);

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

        {/* ABA: MESAS E QR CODES */}
        {abaAtiva === "mesas" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">QR Codes das Mesas</h2>
              <p className="text-xs text-neutral-400">
                Imprima ou envie o link da mesa física para os clientes abrirem o PWA direto
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                <Link
                  key={num}
                  href={`/r/${slug}?mesa=${num}`}
                  target="_blank"
                  className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/50 hover:bg-neutral-800/80 transition-all text-center group"
                >
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 group-hover:bg-rose-600 group-hover:text-white transition-colors mx-auto flex items-center justify-center font-black text-sm">
                    {num}
                  </div>
                  <span className="text-xs font-bold text-neutral-300 block mt-2">Mesa {num}</span>
                  <span className="text-[10px] text-neutral-500 block">Abrir Mesa →</span>
                </Link>
              ))}
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
    </div>
  );
}
