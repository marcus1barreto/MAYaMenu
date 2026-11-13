// lib/b2b-service.ts
// Serviços do Módulo B2B & Patrocínios em Lote (Sponsor Tiers) do MAYaMenu

import { db, functions, b2bAuth, b2bDb, b2bFunctions } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import type {
  PatrocinadorB2B,
  ItemCatalogoPatrocinador,
  LoteLicencasB2B,
  MetricasSelloutItem,
} from "@/types/b2b";
import { httpsCallable } from "firebase/functions";
import { browserSessionPersistence, setPersistence, signInWithCustomToken, signOut } from "firebase/auth";

function gerarTokenB2BSeguro(tamanho: number): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(tamanho);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Gerador criptográfico seguro indisponível; operação B2B cancelada.");
  }
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alfabeto[byte & 31]).join("");
}

export const PATROCINADOR_DEMO: PatrocinadorB2B = {
  id: "spn-bierhaus-demo",
  cnpj: "12.345.678/0001-90",
  razaoSocial: "BierHaus Cervejaria Artesanal S.A.",
  nomeFantasia: "Cervejaria BierHaus",
  slug: "bierhaus",
  chaveAcessoB2B: "SPN-DEMO-2026",
  logoUrl: "/images/demo/coquetel.webp",
  contatoResponsavel: {
    nome: "Diretoria de Trade Marketing",
    email: "parcerias@bierhaus.com.br",
    telefone: "(11) 98765-4321",
    cargo: "Gerente Nacional de Canais & PDV",
  },
  ativo: true,
  criadoEm: "2026-01-01T00:00:00.000Z",
};

export const CATALOGO_MASTER_DEMO: ItemCatalogoPatrocinador[] = [
  {
    id: "chopp-artesanal-ipa-500",
    nome: "Chopp Artesanal BierHaus IPA 500ml",
    categoriaSugerida: "Chopps & Cervejas",
    descricaoOficial: "Cerveja artesanal fresca com lúpulos nobres cítricos, amargor marcante e aroma de maracujá e pinho.",
    fotoOficialUrl: "/images/demo/coquetel.webp",
    precoSugerido: 22.0,
    obrigatorioNoCardapio: true,
    posicaoFixaTopo: true,
    seloPatrocinador: "Chopp Oficial Parceiro",
    criadoEm: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cerveja-lager-longneck",
    nome: "BierHaus German Lager Long Neck",
    categoriaSugerida: "Cervejas Especiais",
    descricaoOficial: "Puro malte refrescante, coloração dourada brilhante e colarinho denso e cremoso.",
    fotoOficialUrl: "/images/demo/coquetel.webp",
    precoSugerido: 16.0,
    obrigatorioNoCardapio: true,
    posicaoFixaTopo: false,
    seloPatrocinador: "Parceiro Master",
    criadoEm: "2026-01-01T00:00:00.000Z",
  },
];

export const LOTES_DEMO: LoteLicencasB2B[] = [
  {
    id: "lote-bierhaus-2026",
    patrocinadorId: "spn-bierhaus-demo",
    nome: "Lote Piloto - Bares Selecionados 2026",
    codigoCampanha: "BIERHAUS2026",
    totalLicencas: 50,
    licencasAtivadas: 1,
    validadeMeses: 6,
    dataExpiracao: "2026-12-31T23:59:59.000Z",
    ativo: true,
    restaurantesVinculados: [
      {
        restauranteId: "rest-demo-alpha",
        nomeRestaurante: "MAYaBurger & Co.",
        slugRestaurante: "demo",
        cidade: "São Paulo - SP",
        codigoVoucherUtilizado: "BIERHAUS2026",
        ativadoEm: "2026-01-10T12:00:00.000Z",
        status: "ativo",
      },
    ],
    criadoEm: "2026-01-01T00:00:00.000Z",
  },
];

export const METRICAS_DEMO: MetricasSelloutItem[] = [
  {
    itemId: "chopp-artesanal-ipa-500",
    itemNome: "Chopp Artesanal BierHaus IPA 500ml",
    patrocinadorId: "spn-bierhaus-demo",
    totalUnidadesVendidas: 142,
    faturamentoTotalEstimado: 3124.0,
    restaurantesContabilizados: 3,
    ultimaVendaEm: new Date().toISOString(),
  },
  {
    itemId: "cerveja-lager-longneck",
    itemNome: "BierHaus German Lager Long Neck",
    patrocinadorId: "spn-bierhaus-demo",
    totalUnidadesVendidas: 89,
    faturamentoTotalEstimado: 1424.0,
    restaurantesContabilizados: 2,
    ultimaVendaEm: new Date().toISOString(),
  },
];

/**
 * Busca um patrocinador através da sua chave B2B única (Token do Contrato)
 */
export async function buscarPatrocinadorPorChave(
  chaveAcesso: string
): Promise<PatrocinadorB2B | null> {
  const chaveLimpa = chaveAcesso.trim().toUpperCase();
  if (!chaveLimpa) return null;
  try {
    const autenticarFn = httpsCallable(functions, "autenticarPatrocinadorBackend");
    const resposta = await autenticarFn({ chave: chaveLimpa });
    const dados = resposta.data as { customToken?: string; patrocinador?: PatrocinadorB2B };
    if (!dados.customToken || !dados.patrocinador?.id) return null;
    await signOut(b2bAuth).catch(() => undefined);
    await setPersistence(b2bAuth, browserSessionPersistence);
    await signInWithCustomToken(b2bAuth, dados.customToken);
    return dados.patrocinador;
  } catch (err) {
    console.warn("Falha ao autenticar patrocinador no backend:", err);
    return null;
  }
}

export async function validarSessaoPatrocinador(): Promise<PatrocinadorB2B | null> {
  await b2bAuth.authStateReady();
  if (!b2bAuth.currentUser) return null;
  try {
    const validarFn = httpsCallable(b2bFunctions, "validarSessaoPatrocinadorBackend");
    const resposta = await validarFn({});
    const dados = resposta.data as { patrocinador?: PatrocinadorB2B };
    return dados.patrocinador?.id ? dados.patrocinador : null;
  } catch (err) {
    console.warn("Sessão B2B inválida ou revogada:", err);
    await signOut(b2bAuth).catch(() => undefined);
    return null;
  }
}

export async function sairPortalB2B(): Promise<void> {
  if (b2bAuth.currentUser) await signOut(b2bAuth);
}

/**
 * Escuta em tempo real os dados de um patrocinador
 */
export function escutarPatrocinador(
  patrocinadorId: string,
  onUpdate: (patrocinador: PatrocinadorB2B | null) => void
): Unsubscribe {
  const docRef = doc(db, "patrocinadores", patrocinadorId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate({ id: snap.id, ...(snap.data() as any) } as PatrocinadorB2B);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn("Erro no listener do patrocinador:", err);
      onUpdate(null);
    }
  );
}

/**
 * Cria ou atualiza o cadastro de um patrocinador
 */
export async function salvarPatrocinador(
  dados: Partial<PatrocinadorB2B> & { nomeFantasia: string; cnpj: string }
): Promise<string> {
  const slug = (dados.slug || dados.nomeFantasia)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const id = dados.id || `spn-${slug}`;
  const chaveAcesso =
    dados.chaveAcessoB2B ||
    `SPN-${gerarTokenB2BSeguro(26)}`;

  const docRef = doc(db, "patrocinadores", id);
  const payload: Partial<PatrocinadorB2B> = {
    ...dados,
    id,
    slug,
    chaveAcessoB2B: chaveAcesso,
    ativo: dados.ativo ?? true,
    authVersion: increment(1),
    atualizadoEm: serverTimestamp(),
  };

  if (!dados.id) {
    payload.criadoEm = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });
  return id;
}

/**
 * Escuta o Catálogo Master de Itens do Patrocinador
 */
export function escutarCatalogoMaster(
  patrocinadorId: string,
  onUpdate: (itens: ItemCatalogoPatrocinador[]) => void
): Unsubscribe {
  const colRef = collection(b2bDb, "patrocinadores", patrocinadorId, "catalogo_master");
  return onSnapshot(
    colRef,
    (snap) => {
      const itens: ItemCatalogoPatrocinador[] = [];
      snap.forEach((docSnap) => {
        itens.push({ id: docSnap.id, ...(docSnap.data() as any) } as ItemCatalogoPatrocinador);
      });
      onUpdate(itens);
    },
    (err) => {
      console.warn("Aviso ao escutar catálogo master:", err);
      onUpdate([]);
    }
  );
}

/**
 * Salva ou atualiza um item no Catálogo Master do Patrocinador
 */
export async function salvarItemCatalogoMaster(
  patrocinadorId: string,
  item: Partial<ItemCatalogoPatrocinador> & { nome: string }
): Promise<string> {
  const idSlug = (item.id || item.nome)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const itemId = item.id || `item-b2b-${idSlug}`;
  const docRef = doc(b2bDb, "patrocinadores", patrocinadorId, "catalogo_master", itemId);

  const payload = {
    ...item,
    id: itemId,
    obrigatorioNoCardapio: item.obrigatorioNoCardapio ?? true,
    seloPatrocinador: item.seloPatrocinador || "Parceiro Oficial",
    atualizadoEm: serverTimestamp(),
  };

  if (!item.id) {
    (payload as any).criadoEm = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });
  return itemId;
}

/**
 * Remove um item do Catálogo Master
 */
export async function removerItemCatalogoMaster(
  patrocinadorId: string,
  itemId: string
): Promise<void> {
  const docRef = doc(b2bDb, "patrocinadores", patrocinadorId, "catalogo_master", itemId);
  await deleteDoc(docRef);
}

/**
 * Escuta os Lotes de Licenças do Patrocinador
 */
export function escutarLotesLicencas(
  patrocinadorId: string,
  onUpdate: (lotes: LoteLicencasB2B[]) => void
): Unsubscribe {
  const colRef = collection(b2bDb, "patrocinadores", patrocinadorId, "lotes_licencas");
  return onSnapshot(
    colRef,
    (snap) => {
      const lotes: LoteLicencasB2B[] = [];
      snap.forEach((docSnap) => {
        lotes.push({ id: docSnap.id, ...(docSnap.data() as any) } as LoteLicencasB2B);
      });
      onUpdate(lotes);
    },
    (err) => {
      console.warn("Aviso ao escutar lotes de licenças:", err);
      onUpdate([]);
    }
  );
}

/**
 * Cria um novo Lote de Licenças B2B
 */
export async function criarLoteLicencas(
  patrocinadorId: string,
  dados: {
    nome: string;
    codigoCampanha: string;
    totalLicencas: number;
    validadeMeses: number;
  }
): Promise<string> {
  const loteId = `lote-${dados.codigoCampanha.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32)}-${gerarTokenB2BSeguro(8).toLowerCase()}`;
  const docRef = doc(db, "patrocinadores", patrocinadorId, "lotes_licencas", loteId);

  const hoje = new Date();
  const dataExpiracao = new Date(hoje.setMonth(hoje.getMonth() + dados.validadeMeses)).toISOString();

  const payload: LoteLicencasB2B = {
    id: loteId,
    patrocinadorId,
    nome: dados.nome,
    codigoCampanha: dados.codigoCampanha.toUpperCase(),
    totalLicencas: dados.totalLicencas,
    licencasAtivadas: 0,
    validadeMeses: dados.validadeMeses,
    dataExpiracao,
    ativo: true,
    restaurantesVinculados: [],
    criadoEm: serverTimestamp(),
  };

  await setDoc(docRef, payload);
  return loteId;
}

/**
 * Valida um voucher de patrocínio
 */
export async function validarVoucherPatrocinio(
  codigoVoucher: string
): Promise<{
  valido: boolean;
  mensagem?: string;
  patrocinador?: PatrocinadorB2B;
  lote?: LoteLicencasB2B;
}> {
  const codigo = codigoVoucher.trim().toUpperCase();
  if (!codigo) return { valido: false, mensagem: "Informe o código do voucher de patrocínio." };
  try {
    const validarFn = httpsCallable(functions, "validarCodigoAtivacaoBackend");
    const resposta = await validarFn({ codigo });
    const dados = resposta.data as {
      tipo?: string;
      voucher?: { patrocinador?: PatrocinadorB2B; lote?: LoteLicencasB2B };
    };
    if (dados?.tipo !== "patrocinio" || !dados.voucher?.patrocinador || !dados.voucher?.lote) {
      return { valido: false, mensagem: "Voucher de patrocínio não encontrado ou indisponível." };
    }
    return {
      valido: true,
      patrocinador: dados.voucher.patrocinador,
      lote: dados.voucher.lote,
    };
  } catch (err: unknown) {
    const mensagem = err instanceof Error ? err.message : "Falha na validação do voucher.";
    return { valido: false, mensagem: mensagem.replace(/^functions\/[a-z-]+:\s*/i, "") };
  }
}

/**
 * Ativa uma licença patrocinada no restaurante e injeta automaticamente
 * os itens do Catálogo Master da marca no cardápio do restaurante.
 *
 * REGRAS DE NEGÓCIO B2B MULTI-PATROCÍNIO:
 * 1. Cada patrocínio adiciona por padrão +6 MESES de validade cumulativa.
 * 2. Trava de Categoria (Category Lock): bloqueia marcas concorrentes no mesmo segmento.
 * 3. Patrocinadores não concorrentes somam tempo e ganham visibilidade conjunta no cardápio.
 * 4. O estabelecimento é promovido aos benefícios da linha PRO (KDS, mesas, comandas).
 */
export async function ativarPatrocinioNoRestaurante(params: {
  restauranteId: string;
  nomeRestaurante: string;
  slugRestaurante: string;
  codigoVoucher: string;
}): Promise<{ sucesso: boolean; mensagem?: string; novaDataExpiracao?: string; mesesAdicionados?: number }> {
  try {
    const ativarFn = httpsCallable(functions, "ativarPatrocinioBackend");
    const resposta = await ativarFn({
      restauranteId: params.restauranteId,
      codigoVoucher: params.codigoVoucher.trim().toUpperCase(),
    });
    const dados = resposta.data as { sucesso?: boolean; novaDataExpiracao?: string; mesesAdicionados?: number };
    return {
      sucesso: dados.sucesso === true,
      novaDataExpiracao: dados.novaDataExpiracao,
      mesesAdicionados: dados.mesesAdicionados,
    };
  } catch (err: unknown) {
    const mensagem = err instanceof Error ? err.message : "Erro durante a ativação do patrocínio.";
    return { sucesso: false, mensagem: mensagem.replace(/^functions\/[a-z-]+:\s*/i, "") };
  }
}

/**
 * Vinculação direta e manual de um restaurante a um Lote de Patrocínio (Uso do SuperAdmin)
 */
export async function vincularRestauranteManualSuperadmin(params: {
  patrocinadorId: string;
  loteId: string;
  restauranteId: string;
  nomeRestaurante: string;
  slugRestaurante: string;
}): Promise<{ sucesso: boolean; mensagem?: string }> {
  try {
    const loteRef = doc(db, "patrocinadores", params.patrocinadorId, "lotes_licencas", params.loteId);
    const loteSnap = await getDoc(loteRef);
    if (!loteSnap.exists()) {
      return { sucesso: false, mensagem: "Lote de licenças do patrocinador não encontrado." };
    }
    const loteData = { id: loteSnap.id, ...(loteSnap.data() as any) } as LoteLicencasB2B;

    return await ativarPatrocinioNoRestaurante({
      restauranteId: params.restauranteId,
      nomeRestaurante: params.nomeRestaurante,
      slugRestaurante: params.slugRestaurante,
      codigoVoucher: loteData.codigoCampanha,
    });
  } catch (err: any) {
    return { sucesso: false, mensagem: err?.message || "Falha ao vincular restaurante." };
  }
}

/**
 * Registra a venda de um item patrocinado para telemetria agregada de Sell-Out
 */


/**
 * Escuta as métricas agregadas de Sell-Out em tempo real para o patrocinador
 */
export function escutarMetricasSellout(
  patrocinadorId: string,
  onUpdate: (metricas: MetricasSelloutItem[]) => void
): Unsubscribe {
  const colRef = collection(b2bDb, "patrocinadores", patrocinadorId, "metricas_sellout");
  return onSnapshot(
    colRef,
    (snap) => {
      const metricas: MetricasSelloutItem[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        metricas.push({
          itemId: docSnap.id,
          itemNome: d.itemNome || docSnap.id,
          patrocinadorId,
          totalUnidadesVendidas: d.totalUnidadesVendidas || 0,
          faturamentoTotalEstimado: d.faturamentoTotalEstimado || 0,
          restaurantesContabilizados: Array.isArray(d.restaurantesContabilizados)
            ? d.restaurantesContabilizados.length
            : (d.restaurantesContabilizados || 0),
          ultimaVendaEm: d.ultimaVendaEm,
        });
      });
      onUpdate(metricas);
    },
    (err) => {
      console.warn("Aviso ao escutar métricas de sellout:", err);
      onUpdate([]);
    }
  );
}

/**
 * Escuta TODOS os patrocinadores cadastrados (Visão do Superadmin HQ)
 */
export function escutarTodosPatrocinadores(
  onUpdate: (patrocinadores: PatrocinadorB2B[]) => void
): Unsubscribe {
  const colRef = collection(db, "patrocinadores");
  return onSnapshot(
    colRef,
    (snap) => {
      const lista: PatrocinadorB2B[] = [];
      snap.forEach((docSnap) => {
        lista.push({ id: docSnap.id, ...(docSnap.data() as any) } as PatrocinadorB2B);
      });
      onUpdate(lista);
    },
    (err) => {
      console.warn("Aviso ao escutar todos os patrocinadores:", err);
      onUpdate([]);
    }
  );
}

/**
 * Cria ou atualiza um Patrocinador B2B via Superadmin com Lote Inicial de Licenças
 */
export async function cadastrarPatrocinadorSuperadmin(dados: {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  contatoCargo?: string;
  totalCotasContratadas: number;
  validadeMeses: number;
}): Promise<{ id: string; chaveAcessoB2B: string; codigoVoucherInicial: string }> {
  const slug = dados.nomeFantasia
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const id = `spn-${slug}-${gerarTokenB2BSeguro(8).toLowerCase()}`;
  const chaveAcessoB2B = `SPN-${gerarTokenB2BSeguro(26)}`;
  const codigoVoucherInicial = `MAYA-B2B-${gerarTokenB2BSeguro(20)}`;

  // 1. Cria o registro do Patrocinador
  const docRef = doc(db, "patrocinadores", id);
  const patrocinadorPayload: PatrocinadorB2B = {
    id,
    cnpj: dados.cnpj,
    razaoSocial: dados.razaoSocial,
    nomeFantasia: dados.nomeFantasia,
    slug,
    chaveAcessoB2B,
    logoUrl: "/images/demo/coquetel.webp",
    contatoResponsavel: {
      nome: dados.contatoNome,
      email: dados.contatoEmail,
      telefone: dados.contatoTelefone,
      cargo: dados.contatoCargo || "Gestor de Trade Marketing",
    },
    ativo: true,
    authVersion: 0,
    criadoEm: serverTimestamp(),
  };

  await setDoc(docRef, patrocinadorPayload);

  // 2. Cria o lote inicial de cotas contratadas
  await criarLoteLicencas(id, {
    nome: `Lote Contratual - ${dados.nomeFantasia} ${new Date().getFullYear()}`,
    codigoCampanha: codigoVoucherInicial,
    totalLicencas: dados.totalCotasContratadas,
    validadeMeses: dados.validadeMeses || 6,
  });

  return { id, chaveAcessoB2B, codigoVoucherInicial };
}

/**
 * Altera o status de um patrocinador (Ativo / Suspenso) via Superadmin
 */
export async function alternarStatusPatrocinador(
  patrocinadorId: string,
  ativo: boolean
): Promise<void> {
  const docRef = doc(db, "patrocinadores", patrocinadorId);
  await updateDoc(docRef, {
    ativo,
    authVersion: increment(1),
    atualizadoEm: serverTimestamp(),
  });
}


