"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { MenuItem } from "@/types";

import { obterUltimoNomeCliente } from "@/lib/historico-cliente";

export interface ItemCarrinho {
  idUnico: string; // identificador único do item configurado
  menuItemId: string;
  nome: string;
  precoFinal: number;
  quantidade: number;
  modificadores: { grupo: string; opcao: string; precoAdicional: number }[];
  observacoes?: string;
  fotoUrl?: string;
}

interface CartContextType {
  itens: ItemCarrinho[];
  nomeCliente: string;
  mesa: number | string;
  subtotal: number;
  totalItens: number;
  adicionarItem: (item: Omit<ItemCarrinho, "idUnico">) => void;
  removerItem: (idUnico: string) => void;
  atualizarQuantidade: (idUnico: string, delta: number) => void;
  limparCarrinho: () => void;
  setNomeCliente: (nome: string) => void;
  setMesa: (mesa: number | string) => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({
  children,
  slug,
  mesaInicial,
}: {
  children: React.ReactNode;
  slug: string;
  mesaInicial?: number | string;
}) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [nomeCliente, setNomeClienteState] = useState<string>("");
  const [mesa, setMesaState] = useState<number | string>(mesaInicial || 1);

  // Carrega do localStorage para persistência offline
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(`mayamenu_cart_${slug}`);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed.itens)) setItens(parsed.itens);
        if (parsed.nomeCliente) {
          setNomeClienteState(parsed.nomeCliente);
        } else {
          const ultimoNome = obterUltimoNomeCliente();
          if (ultimoNome) setNomeClienteState(ultimoNome);
        }
        // Se a URL do QR Code forneceu uma mesa explícita, respeita a mesa escaneada
        if (mesaInicial) {
          setMesaState(mesaInicial);
        } else if (parsed.mesa) {
          setMesaState(parsed.mesa);
        }
      } else {
        if (mesaInicial) setMesaState(mesaInicial);
        const ultimoNome = obterUltimoNomeCliente();
        if (ultimoNome) setNomeClienteState(ultimoNome);
      }
    } catch {
      // Ignora erro de storage
    }
  }, [slug, mesaInicial]);

  // Salva no localStorage quando mudar
  useEffect(() => {
    try {
      localStorage.setItem(
        `mayamenu_cart_${slug}`,
        JSON.stringify({ itens, nomeCliente, mesa })
      );
    } catch {
      // Ignora
    }
  }, [itens, nomeCliente, mesa, slug]);

  const setNomeCliente = (nome: string) => {
    setNomeClienteState(nome);
  };

  const setMesa = (m: number | string) => {
    setMesaState(m);
  };

  const adicionarItem = (novo: Omit<ItemCarrinho, "idUnico">) => {
    const idUnico = `${novo.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItens((prev) => [...prev, { ...novo, idUnico }]);
  };

  const removerItem = (idUnico: string) => {
    setItens((prev) => prev.filter((i) => i.idUnico !== idUnico));
  };

  const atualizarQuantidade = (idUnico: string, delta: number) => {
    setItens((prev) =>
      prev
        .map((i) => {
          if (i.idUnico === idUnico) {
            const novaQtd = i.quantidade + delta;
            return novaQtd > 0 ? { ...i, quantidade: novaQtd } : null;
          }
          return i;
        })
        .filter(Boolean) as ItemCarrinho[]
    );
  };

  const limparCarrinho = () => {
    setItens([]);
  };

  const subtotal = itens.reduce(
    (acc, item) => acc + item.precoFinal * item.quantidade,
    0
  );

  const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);

  return (
    <CartContext.Provider
      value={{
        itens,
        nomeCliente,
        mesa,
        subtotal,
        totalItens,
        adicionarItem,
        removerItem,
        atualizarQuantidade,
        limparCarrinho,
        setNomeCliente,
        setMesa,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}
