// src/lib/planos-catalogo.ts
// Catálogo Central de Planos Versionados e Gerenciador de Contratos Imutáveis (Grandfathering)

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import type { PlanoCatalogo, AssinaturaContrato } from "@/types";

/**
 * Catálogo Oficial Padrão do MAYaMenu (Versão 1.0)
 * Cada plano possui uma ID invariante e limites acordados.
 */
export const CATALOGO_PLANOS_INICIAL: PlanoCatalogo[] = [
  {
    id: "plan_free_v1",
    apelido: "MAYaMenu FREE (Degustação)",
    descricao: "Ideal para começar a digitalizar seu salão sem custos e experimentar o cardápio PWA na prática.",
    versao: "1.0.0",
    status: "ativo",
    limites: {
      maxMesas: 10,
      maxItensMenu: 20,
      modulosPermitidos: ["cardapio", "mesas_basico", "qr_dinamico"],
    },
    comercial: {
      preco: 0,
      moeda: "BRL",
      periodicidade: "mensal",
      diasToleranciaInadimplencia: 0,
      gatewayPadrao: "gratis",
    },
    metadata: {
      criadoEm: "2026-11-11T00:00:00.000Z",
      vigenciaInicio: "2026-11-11",
    },
  },
  {
    id: "plan_pro_mensal_v1",
    apelido: "MAYaMenu PRO Mensal",
    descricao: "Plano flexível sem fidelidade. Libera KDS Cozinha, Garçom ilimitado e relatórios analíticos de giro.",
    versao: "1.0.0",
    status: "ativo",
    limites: {
      maxMesas: 30,
      maxItensMenu: 60,
      modulosPermitidos: ["cardapio", "mesas", "kds", "garcom", "analytics", "historico"],
    },
    comercial: {
      preco: 49.9,
      moeda: "BRL",
      periodicidade: "mensal",
      diasToleranciaInadimplencia: 3,
      gatewayPadrao: "mercadopago",
      destaque: true,
      seloPromocional: "Mais Flexível",
    },
    metadata: {
      criadoEm: "2026-11-11T00:00:00.000Z",
      vigenciaInicio: "2026-11-11",
    },
  },
  {
    id: "plan_pro_semestral_v1",
    apelido: "MAYaMenu PRO Semestral",
    descricao: "Melhor custo-benefício (R$ 41,50/mês). Até 12x no cartão ou Pix com ativação imediata.",
    versao: "1.0.0",
    status: "ativo",
    limites: {
      maxMesas: 30,
      maxItensMenu: 60,
      modulosPermitidos: ["cardapio", "mesas", "kds", "garcom", "analytics", "historico"],
    },
    comercial: {
      preco: 249.0,
      moeda: "BRL",
      periodicidade: "semestral",
      diasToleranciaInadimplencia: 5,
      gatewayPadrao: "mercadopago",
      destaque: true,
      seloPromocional: "Economize 17% (Mais Vendido)",
    },
    metadata: {
      criadoEm: "2026-11-11T00:00:00.000Z",
      vigenciaInicio: "2026-11-11",
    },
  },
  {
    id: "plan_b2b_patrocinado_v1",
    apelido: "MAYaMenu Patrocinado B2B",
    descricao: "Custeado integralmente por marcas parceiras locais através de vouchers de concessão de 6 meses.",
    versao: "1.0.0",
    status: "ativo",
    limites: {
      maxMesas: 30,
      maxItensMenu: 60,
      modulosPermitidos: ["cardapio", "mesas", "kds", "garcom", "analytics", "patrocinio_topo"],
    },
    comercial: {
      preco: 0,
      moeda: "BRL",
      periodicidade: "patrocinado",
      diasToleranciaInadimplencia: 7,
      gatewayPadrao: "b2b_voucher",
      seloPromocional: "100% Custeado por Parceiros",
    },
    metadata: {
      criadoEm: "2026-11-11T00:00:00.000Z",
      vigenciaInicio: "2026-11-11",
    },
  },
  {
    id: "plan_enterprise_v1",
    apelido: "MAYaMenu Enterprise / Redes",
    descricao: "Para redes de restaurantes, franquias e eventos de alta densidade com mesas e itens sob medida.",
    versao: "1.0.0",
    status: "ativo",
    limites: {
      maxMesas: 999,
      maxItensMenu: 999,
      modulosPermitidos: ["cardapio", "mesas", "kds", "garcom", "analytics", "multi_loja", "api_integracao"],
    },
    comercial: {
      preco: 0, // Sob consulta
      moeda: "BRL",
      periodicidade: "anual",
      diasToleranciaInadimplencia: 15,
      gatewayPadrao: "paypal",
      seloPromocional: "Sob Medida",
    },
    metadata: {
      criadoEm: "2026-11-11T00:00:00.000Z",
      vigenciaInicio: "2026-11-11",
    },
  },
];

/**
 * Obtém todos os planos ativos do catálogo.
 * Sincroniza com a coleção Firestore 'catalogo_planos' e faz fallback no catálogo local.
 */
export async function listarPlanosCatalogo(): Promise<PlanoCatalogo[]> {
  try {
    const colRef = collection(db, "catalogo_planos");
    const snap = await getDocs(colRef);

    if (snap.empty) {
      // Semeia o catálogo inicial no Firestore em segundo plano
      semearCatalogoPlanosInicial().catch(console.error);
      return CATALOGO_PLANOS_INICIAL.filter((p) => p.status === "ativo");
    }

    const lista: PlanoCatalogo[] = [];
    snap.forEach((docSnap) => {
      lista.push(docSnap.data() as PlanoCatalogo);
    });

    return lista.filter((p) => p.status === "ativo");
  } catch (err) {
    console.warn("Falha ao buscar catálogo de planos do Firestore, usando catálogo local:", err);
    return CATALOGO_PLANOS_INICIAL.filter((p) => p.status === "ativo");
  }
}

/**
 * Busca um plano por sua ID única
 */
export async function buscarPlanoCatalogo(planoId: string): Promise<PlanoCatalogo | null> {
  const local = CATALOGO_PLANOS_INICIAL.find((p) => p.id === planoId);
  if (local) return local;

  try {
    const docRef = doc(db, "catalogo_planos", planoId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as PlanoCatalogo;
    }
  } catch (e) {
    console.error("Erro ao buscar plano no Firestore:", e);
  }
  return null;
}

/**
 * Semeia os planos oficiais no Firestore caso a coleção esteja vazia
 */
export async function semearCatalogoPlanosInicial(): Promise<void> {
  try {
    for (const plano of CATALOGO_PLANOS_INICIAL) {
      const docRef = doc(db, "catalogo_planos", plano.id);
      await setDoc(docRef, plano, { merge: true });
    }
  } catch (err) {
    console.warn("Não foi possível semear o catálogo de planos no Firestore:", err);
  }
}

/**
 * Gera o Snapshot Contratual Imutável (Princípio de Grandfathering)
 * para ser carimbado no documento do restaurante.
 */
export function gerarSnapshotContrato(
  plano: PlanoCatalogo,
  dataExpiracao?: string
): AssinaturaContrato {
  return {
    planoId: plano.id,
    apelido: plano.apelido,
    versao: plano.versao,
    contratadoEm: new Date().toISOString(),
    dataExpiracao: dataExpiracao,
    valorContratado: plano.comercial.preco,
    periodicidade: plano.comercial.periodicidade,
    limites: {
      maxMesas: plano.limites.maxMesas,
      maxItensMenu: plano.limites.maxItensMenu,
      modulosPermitidos: plano.limites.modulosPermitidos,
    },
    garantiaAcordo: "inalteravel",
    status: "ativa",
  };
}

