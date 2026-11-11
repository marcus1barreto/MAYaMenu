// types/b2b.ts
// Tipos para o Módulo B2B & Patrocínios em Lote (Sponsor Tiers) do MAYaMenu

export interface PatrocinadorB2B {
  id: string; // Ex: "spn-ambev-regional"
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  slug: string; // Ex: "ambev-sp"
  chaveAcessoB2B: string; // Token único de acesso do patrocinador (ex: "SPONSOR-AMBEV-2026-X9")
  logoUrl: string;
  bannerUrl?: string;
  corMarca?: string;
  contatoResponsavel: {
    nome: string;
    email: string;
    telefone: string;
    cargo: string;
  };
  ativo: boolean;
  criadoEm: any;
  atualizadoEm?: any;
}

export interface ItemCatalogoPatrocinador {
  id: string; // Ex: "chopp-pilsen-500ml"
  nome: string; // "Chopp Pilsen Especial 500ml"
  categoriaSugerida: string; // "Chopps & Cervejas"
  descricaoOficial: string;
  fotoOficialUrl: string;
  precoSugerido: number;
  skuOuEan?: string;
  obrigatorioNoCardapio: boolean; // Se true, o restaurante não pode remover do cardápio
  posicaoFixaTopo?: boolean; // Destacar no topo da categoria
  seloPatrocinador: string; // Ex: "Cervejaria Oficial" ou "Parceiro Master"
  criadoEm: any;
  atualizadoEm?: any;
}

export interface RestauranteVinculadoLote {
  restauranteId: string;
  nomeRestaurante: string;
  slugRestaurante?: string;
  cidade?: string;
  codigoVoucherUtilizado: string;
  ativadoEm: string;
  status: "ativo" | "expirado" | "revogado";
}

export interface LoteLicencasB2B {
  id: string; // Ex: "lote-verao-2026-100"
  patrocinadorId: string;
  nome: string; // Ex: "Campanha Verão Gastronômico 2026"
  codigoCampanha: string; // Ex: "VERAO2026"
  totalLicencas: number; // Ex: 100
  licencasAtivadas: number; // Ex: 42
  validadeMeses: number; // Ex: 12 meses
  dataExpiracao: string; // Data ISO
  ativo: boolean;
  restaurantesVinculados: RestauranteVinculadoLote[];
  criadoEm: any;
}

export interface SlotPatrocinioRestaurante {
  patrocinadorId: string;
  patrocinadorNome: string;
  categoriaSugerida: string;
  loteId: string;
  codigoVoucher: string;
  itensInjetados: string[];
  mesesAdicionados: number;
  vinculadoEm: string;
}

export interface PatrocinioRestauranteInfo {
  ativo: boolean;
  patrocinadorId: string;
  patrocinadorNome: string;
  loteId: string;
  dataExpiracao: string;
  itensInjetados: string[]; // IDs dos itens do catálogo master vinculados
  slots?: SlotPatrocinioRestaurante[];
}

export interface MetricasSelloutItem {
  itemId: string;
  itemNome: string;
  patrocinadorId: string;
  totalUnidadesVendidas: number;
  faturamentoTotalEstimado: number;
  restaurantesContabilizados: number;
  ultimaVendaEm?: string;
}

