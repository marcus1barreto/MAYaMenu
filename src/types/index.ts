// types/index.ts
// Estrutura central de dados - MAYaMenu Alpha

import type { Timestamp } from "firebase/firestore";

export type ModoOperacao = 'com_garcom' | 'hibrido' | 'balcao';

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
    modoOperacao?: ModoOperacao; // 'com_garcom' | 'hibrido' (padrão) | 'balcao'
  };
}

export interface MenuItem {
  id: string;
  nome: string;
  categoria?: string; // Ex: "Hambúrgueres", "Pizzas", "Bebidas", "Sobremesas"
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

export interface ItemPedido {
  menuItemId: string;
  nome: string;
  quantidade: number;
  precoFinal: number; // Preço base + modificadores escolhidos
  modificadores?: { grupo: string; opcao: string }[]; // Ex: { grupo: "Ponto da Carne", opcao: "Bem passado" }
  observacoes?: string; // Ex: "Sem cebola"
}

// Subcoleção: /restaurantes/{restId}/mesas/{mesaId}/comandas_abertas/{clienteId}/pedidos/{pedidoId}
// Cada envio do carrinho gera uma rodada individual enviada para a cozinha
export interface PedidoRodada {
  id: string; // Ex: ped-m12-cli1-001
  restauranteId?: string;
  clienteId: string;
  nomeCliente: string;
  mesa: number | string;
  numeroMesa?: number | string;
  itens: ItemPedido[];
  subtotal: number;
  status: 'a_fazer' | 'pronto' | 'entregue';
  criadoEm: Timestamp;
}

// O "Nó Pai" da sessão do cliente na mesa:
// /restaurantes/{restId}/mesas/{mesaId}/comandas_abertas/{clienteId}
export interface ComandaCliente { 
  id: string; // uid do login anônimo (Firebase Auth)
  restauranteId?: string;
  nomeCliente: string; // Ex: "Marcus"
  mesa?: number | string;
  numeroMesa?: number | string;
  criadoEm: Timestamp;
  atualizadoEm?: Timestamp;
  subtotal: number; // Soma acumulada de todos os pedidos/rodadas deste cliente
  status: 'pedindo' | 'aguardando_pratos' | 'conta_pedida' | 'pago';
}

// ─────────────────────────────────────────────────────────────────────────────
// Gerência do Sistema (SuperAdmin) & Concessão de Licenças (MAYaRAnas)
// ─────────────────────────────────────────────────────────────────────────────

export type PlanoTipo = 'free' | 'pro' | 'enterprise';

export interface LimitesPlano {
  maxPratos: number; // ex: 15 no free, 999 no pro/enterprise
  maxMesas: number;  // ex: 5 no free, 999 no pro/enterprise
}

export interface Licenca {
  id: string; // Token único gerado (Ex: "MAYA-7K2X-91A4")
  status: 'disponivel' | 'ativa' | 'suspensa' | 'revogada' | 'utilizada';
  plano: PlanoTipo;
  limites: LimitesPlano;
  criadaEm: any;
  expiracaoEm?: any; // Validade do convite/token efêmero
  ativadaEm?: any;
  consumidaEm?: any;
  ownerId?: string; // UID do Firebase Auth do lojista que ativou
  restauranteId?: string; // UID do restaurante vinculado
  restauranteNome?: string;
  slug?: string;
  responsavel?: string; // Nome/Contato do lojista
  notas?: string;
}