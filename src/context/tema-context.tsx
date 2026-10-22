"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { type TemaId, obterClasseTema } from "@/lib/tema";

type AppScope = "cliente" | "admin" | "cozinha" | "garcom" | "superadmin";

interface TemaUsuarioContextData {
  tema: TemaId;
  classeTema: string;
  definirTema: (novoTema: TemaId) => void;
  scope: AppScope;
}

const TemaUsuarioContext = createContext<TemaUsuarioContextData | undefined>(undefined);

// Padrão solicitado: Inicia sempre no modo Descanso de Vista (Sépia/Solarized)
export const TEMA_PADRAO_SISTEMA: TemaId = "acessibilidade-sepia";

interface TemaUsuarioProviderProps {
  children: React.ReactNode;
  scope: AppScope;
  fallbackTemaRestaurante?: string | null;
}

export function TemaUsuarioProvider({
  children,
  scope,
  fallbackTemaRestaurante,
}: TemaUsuarioProviderProps) {
  const chaveStorage = `mayamenu_tema_${scope}`;

  const [tema, setTema] = useState<TemaId>(() => {
    if (typeof window !== "undefined") {
      try {
        const salvo = localStorage.getItem(chaveStorage) as TemaId | null;
        if (salvo) return salvo;
      } catch {
        // Ignora erro de SSR/Storage
      }
    }
    // Se o lojista definiu um tema e estamos no escopo do cliente e ele quer padrão do restaurante:
    if (fallbackTemaRestaurante && scope === "cliente") {
      return (fallbackTemaRestaurante as TemaId);
    }
    return TEMA_PADRAO_SISTEMA;
  });

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveStorage) as TemaId | null;
      if (salvo) {
        setTema(salvo);
      } else {
        // Se ainda não salvou, inicializa com descanso de vista
        setTema(TEMA_PADRAO_SISTEMA);
        localStorage.setItem(chaveStorage, TEMA_PADRAO_SISTEMA);
      }
    } catch {
      // Ignora erro de localStorage
    }
  }, [chaveStorage]);

  const definirTema = (novoTema: TemaId) => {
    setTema(novoTema);
    try {
      localStorage.setItem(chaveStorage, novoTema);
    } catch {
      // Ignora erro de localStorage
    }
  };

  const classeTema = obterClasseTema(tema);

  return (
    <TemaUsuarioContext.Provider value={{ tema, classeTema, definirTema, scope }}>
      <div className={`min-h-screen ${classeTema} bg-background text-foreground transition-colors duration-200`}>
        {children}
      </div>
    </TemaUsuarioContext.Provider>
  );
}

export function useTemaUsuario() {
  const ctx = useContext(TemaUsuarioContext);
  if (!ctx) {
    // Fallback seguro caso usado fora do provider
    return {
      tema: TEMA_PADRAO_SISTEMA,
      classeTema: obterClasseTema(TEMA_PADRAO_SISTEMA),
      definirTema: () => {},
      scope: "cliente" as AppScope,
    };
  }
  return ctx;
}
