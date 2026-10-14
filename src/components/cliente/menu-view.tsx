"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { MenuItem, Restaurante } from "@/types";
import { useCart } from "@/context/cart-context";
import { ItemModal } from "./item-modal";
import { CartDrawer } from "./cart-drawer";
import { HistoricoVisitasModal } from "./historico-visitas-modal";
import { ShoppingBag, Sparkles, MapPin, Search, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MenuViewProps {
  restaurante: Restaurante;
  cardapio: MenuItem[];
  numeroMesa?: number | string;
}

export function MenuView({ restaurante, cardapio, numeroMesa = 1 }: MenuViewProps) {
  const { totalItens, subtotal } = useCart();
  const [itemSelecionado, setItemSelecionado] = useState<MenuItem | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const corPrimaria = restaurante.configuracoes?.corPrimaria || "#E11D48";
  const capaUrl = restaurante.configuracoes?.capaUrl || "/images/capa-padrao.webp";

  const itensFiltrados = cardapio.filter((item) => {
    if (!item.ativo) return false;
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return (
      item.nome.toLowerCase().includes(b) ||
      item.descricao.toLowerCase().includes(b)
    );
  });

  return (
    <div className="min-h-screen bg-neutral-100/60 pb-28 text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white">
      {/* HEADER / CAPA COM EFEITO HERO */}
      <header className="relative w-full h-56 sm:h-72 bg-neutral-900 overflow-hidden shadow-lg">
        <Image
          src={capaUrl}
          alt={restaurante.nome}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-80 scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/95 via-neutral-950/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 max-w-3xl mx-auto flex flex-col justify-end">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className="bg-white/10 backdrop-blur-md text-white border-white/20 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
            >
              <MapPin className="w-3 h-3 mr-1 text-emerald-400" />
              Mesa {numeroMesa}
            </Badge>
            <Badge
              variant="outline"
              className="bg-white/10 backdrop-blur-md text-white border-white/20 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            >
              Cardápio Digital PWA
            </Badge>

            {/* BOTÃO DA CARTEIRA / HISTÓRICO DE VISITAS */}
            <button
              type="button"
              onClick={() => setHistoricoAberto(true)}
              className="ml-auto bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Receipt className="w-3 h-3 text-rose-300" />
              <span>Meus Comprovantes</span>
            </button>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
            {restaurante.nome}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 font-medium mt-1">
            Toque nos itens para personalizar seu pedido sem espera
          </p>
        </div>
      </header>

      {/* BARRA DE PESQUISA / FILTRO */}
      <div className="max-w-3xl mx-auto px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-md p-2 flex items-center gap-2 border border-neutral-200/80">
          <Search className="w-5 h-5 text-neutral-400 ml-2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pratos, sobremesas ou bebidas..."
            className="w-full text-sm font-medium bg-transparent border-none focus:outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* LISTA DE ITENS DO CARDÁPIO */}
      <main className="max-w-3xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-500">
            Destaques da Casa ({itensFiltrados.length})
          </h2>
        </div>

        {itensFiltrados.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">
            <p className="text-base font-semibold">Nenhum item encontrado.</p>
            <p className="text-xs">Tente buscar por outro termo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {itensFiltrados.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setItemSelecionado(item)}
                className="group relative bg-white rounded-3xl p-4 border border-neutral-200/80 shadow-xs hover:shadow-md transition-all active:scale-[0.98] text-left flex gap-4 overflow-hidden"
              >
                {/* Informações Textuais */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 group-hover:text-neutral-950 transition-colors line-clamp-1">
                      {item.nome}
                    </h3>
                    <p className="text-xs text-neutral-500 leading-relaxed mt-1 line-clamp-2">
                      {item.descricao}
                    </p>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-base font-black text-neutral-900">
                      {item.precoBase.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    {item.grupoModificadores && item.grupoModificadores.length > 0 && (
                      <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        Personalizável
                      </span>
                    )}
                  </div>
                </div>

                {/* Foto Otimizada */}
                {item.fotoUrl && (
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 bg-neutral-100 border border-neutral-100 shadow-inner">
                    <Image
                      src={item.fotoUrl}
                      alt={item.nome}
                      fill
                      sizes="(max-width: 640px) 100px, 120px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* BARRA FLUTUANTE DE CARRINHO (Fat-finger friendly) */}
      {totalItens > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <Button
            type="button"
            onClick={() => setCarrinhoAberto(true)}
            style={{ backgroundColor: corPrimaria }}
            className="w-full h-16 rounded-2xl shadow-2xl text-white font-black text-base flex items-center justify-between px-5 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-white/20 rounded-xl">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-neutral-900 rounded-full text-xs font-black flex items-center justify-center shadow-sm">
                  {totalItens}
                </span>
              </div>
              <div className="text-left">
                <span className="block text-xs uppercase tracking-wider font-semibold opacity-90">
                  Ver Comanda
                </span>
                <span className="text-sm font-bold">Mesa {numeroMesa}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase font-semibold opacity-90 block">Total</span>
              <span className="text-lg font-black tracking-tight">
                {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </Button>
        </div>
      )}

      {/* MODAL DE PERSONALIZAÇÃO DE ITEM */}
      <ItemModal
        item={itemSelecionado}
        isOpen={!!itemSelecionado}
        onClose={() => setItemSelecionado(null)}
        corPrimaria={corPrimaria}
      />

      {/* DRAWER / CHECKOUT DA COMANDA */}
      <CartDrawer
        isOpen={carrinhoAberto}
        onClose={() => setCarrinhoAberto(false)}
        restauranteId={restaurante.id}
        corPrimaria={corPrimaria}
      />

      {/* MODAL DE HISTÓRICO / COMPROVANTES DO CLIENTE */}
      <HistoricoVisitasModal
        isOpen={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
      />
    </div>
  );
}
