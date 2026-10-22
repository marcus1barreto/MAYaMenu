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

// Padrão oficial: Tema Único Claro iFood Style
export const TEMA_PADRAO_SISTEMA: TemaId = "white-label";

interface TemaUsuarioProviderProps {
  children: React.ReactNode;
  scope: AppScope;
  fallbackTemaRestaurante?: string | null;
}

export function TemaUsuarioProvider({
  children,
  scope,
}: TemaUsuarioProviderProps) {
  // Limpa resquícios de temas antigos gravados no navegador
  useEffect(() => {
    try {
      localStorage.removeItem(`mayamenu_tema_${scope}`);
      localStorage.removeItem("mayamenu_modo_visual");
      localStorage.removeItem("mayamenu_estilo_carteira");
    } catch {
      // Ignora erro de localStorage
    }
  }, [scope]);

  const definirTema = (_novoTema: TemaId) => {
    // Operação no-op em modo tema único
  };

  return (
    <TemaUsuarioContext.Provider
      value={{
        tema: TEMA_PADRAO_SISTEMA,
        classeTema: "",
        definirTema,
        scope,
      }}
    >
      <div className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </div>
    </TemaUsuarioContext.Provider>
  );
}

export function useTemaUsuario() {
  const ctx = useContext(TemaUsuarioContext);
  if (!ctx) {
    return {
      tema: TEMA_PADRAO_SISTEMA,
      classeTema: "",
      definirTema: () => {},
      scope: "cliente" as AppScope,
    };
  }
  return ctx;
}
