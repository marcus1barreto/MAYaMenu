// types/index.ts
// Estrutura central de dados - MAYaMenu Alpha

import type { Timestamp } from "firebase/firestore";

export interface Restaurante {
  id: string;
  ownerId: string; // ID do Firebase Auth do lojista
  slug: string; // Ex: "burger-do-marcus"
  nome: string;
  configuracoes: {
    corPrimaria: string; // Injetada no Tailwind
    tema: 'light' | 'dark';
    logoUrl?: string;
    capaUrl?: string; // Se vazio, o app usa a capa padrão rústica
  };
}

export interface MenuItem {
  id: string;
  nome: string;
  descricao: string;
  precoBase: number;
  fotoUrl?: string;
  ativo: boolean; // Para pausar itens esgotados rapidamente
  grupoModificadores?: GrupoModificador[];
}

export interface GrupoModificador {
  nome: string; // Ex: "Ponto da Carne", "Tamanho"
  obrigatorio: boolean;
  maxEscolhas: number;
  opcoes: { nome: string; precoAdicional: number }[];
}

// O "Nó Filho" que resolve o problema de concorrência e rateio na mesa
export interface ComandaCliente { 
  id: string; // Gerado no navegador do cliente (PWA) = uid do login anônimo (Firebase Auth)
  nomeCliente: string; // Ex: "Marcus"
  criadoEm: Timestamp;
  itens: {
    menuItemId: string;
    nome: string;
    quantidade: number;
    precoFinal: number; // Preço base + modificadores escolhidos
    modificadores?: { grupo: string; opcao: string }[]; // Ex: { grupo: "Ponto da Carne", opcao: "Bem passado" } - destacado em VERMELHO no KDS
    observacoes?: string; // Ex: "Sem cebola"
  }[];
  subtotal: number; // Soma de todos os itens deste cliente
  status: 'pedindo' | 'aguardando_pratos' | 'conta_pedida' | 'pago';
}