// types/index.ts
// Estrutura central de dados - MAYaMenu Alpha

import type { Timestamp } from "firebase/firestore";

export type ModoOperacao = 'com_garcom' | 'hibrido' | 'balcao';
export type ModoFilaKds = 'sequencial' | 'agrupamento';

export interface Restaurante {
  id: string;
  ownerId: string; // ID do Firebase Auth do lojista
  slug: string; // Ex: "burger-do-marcus"
  nome: string;
  plano?: PlanoTipo; // 'free' | 'pro' | 'enterprise'
  maxMesas?: number;
  maxPratos?: number;
  licenca?: Partial<Licenca>;
  configuracoes: {
    corPrimaria: string; // Injetada no Tailwind
    tema: 'light' | 'dark';
    logoUrl?: string;
    capaUrl?: string; // Se vazio, o app usa a capa padrão rústica
    modoOperacao?: ModoOperacao; // 'com_garcom' | 'hibrido' (padrão) | 'balcao'
    modoFilaKds?: ModoFilaKds; // 'sequencial' (padrão FIFO) | 'agrupamento' (Ágil / Otimizado)
    taxaServico?: number; // Percentual da taxa de serviço (padrão: 10)
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
  ordem?: number; // Posição de ordenação tátil dentro da categoria ou cardápio
  tempoPreparoEstimado?: number; // Em minutos para otimização de KDS/cozinha
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
  tempoPreparoEstimado?: number; // Em minutos
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
  chamadoGarcom?: {
    ativo: boolean;
    solicitadoEm: any;
    motivo?: string;
  };
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

export interface LicencaArquivada {
  id: string; // Token original (Ex: "MAYA-7K2X-91A4")
  codigo: string;
  arquivadoEm: any;
  motivo: "ativacao_concluida" | "expirada" | "revogada_manual";
  restauranteId: string;
  restauranteNome: string;
  slug: string;
  ownerId: string;
  snapshotJson: string; // JSON serializado completo da licença e transação
  dadosLicenca: Licenca;
}

// ─────────────────────────────────────────────────────────────────────────────
// Histórico de Sessões de Mesas (Analytics & Inteligência Salão)
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoricoSessaoMesa {
  id: string;
  restauranteId: string;
  mesa: number | string;
  subtotalTotal: number;
  quantidadePagantes: number;
  comandasIds: string[];
  abertaEm: any;
  pagaEm: any;
  liberadaEm: any;
  duracaoTotalMinutos?: number;
}