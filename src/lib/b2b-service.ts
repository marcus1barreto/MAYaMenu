// lib/b2b-service.ts
// Serviços do Módulo B2B & Patrocínios em Lote (Sponsor Tiers) do MAYaMenu

import { db } from "@/lib/firebase";
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
  type Unsubscribe,
} from "firebase/firestore";
import type {
  PatrocinadorB2B,
  ItemCatalogoPatrocinador,
  LoteLicencasB2B,
  MetricasSelloutItem,
} from "@/types/b2b";
import type { MenuItem } from "@/types";

/**
 * Busca um patrocinador através da sua chave B2B única (Token do Contrato)
 */
export async function buscarPatrocinadorPorChave(
  chaveAcesso: string
): Promise<PatrocinadorB2B | null> {
  const chaveLimpa = chaveAcesso.trim().toUpperCase();
  if (!chaveLimpa) return null;

  try {
    const colRef = collection(db, "patrocinadores");
    const q = query(colRef, where("chaveAcessoB2B", "==", chaveLimpa), where("ativo", "==", true));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Fallback para buscar diretamente pelo ID do doc
      const docSnap = await getDoc(doc(db, "patrocinadores", chaveLimpa.toLowerCase()));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...(docSnap.data() as any) } as PatrocinadorB2B;
      }
      return null;
    }

    const firstDoc = snap.docs[0];
    return { id: firstDoc.id, ...(firstDoc.data() as any) } as PatrocinadorB2B;
  } catch (err) {
    console.warn("Falha ao buscar patrocinador por chave:", err);
    return null;
  }
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
    `SPN-${slug.toUpperCase().slice(0, 8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const docRef = doc(db, "patrocinadores", id);
  const payload: Partial<PatrocinadorB2B> = {
    ...dados,
    id,
    slug,
    chaveAcessoB2B: chaveAcesso,
    ativo: dados.ativo ?? true,
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
  const colRef = collection(db, "patrocinadores", patrocinadorId, "catalogo_master");
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
      console.warn("Erro ao escutar catálogo master:", err);
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
  const docRef = doc(db, "patrocinadores", patrocinadorId, "catalogo_master", itemId);

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
  const docRef = doc(db, "patrocinadores", patrocinadorId, "catalogo_master", itemId);
  await deleteDoc(docRef);
}

/**
 * Escuta os Lotes de Licenças do Patrocinador
 */
export function escutarLotesLicencas(
  patrocinadorId: string,
  onUpdate: (lotes: LoteLicencasB2B[]) => void
): Unsubscribe {
  const colRef = collection(db, "patrocinadores", patrocinadorId, "lotes_licencas");
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
      console.warn("Erro ao escutar lotes de licenças:", err);
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
  const loteId = `lote-${dados.codigoCampanha.toLowerCase()}-${Date.now().toString().slice(-4)}`;
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
  if (!codigo) {
    return { valido: false, mensagem: "Informe o código do voucher de patrocínio." };
  }

  try {
    // 1. Busca em todos os lotes de licenças ativos
    const { collectionGroup } = await import("firebase/firestore");
    const q = query(
      collectionGroup(db, "lotes_licencas"),
      where("codigoCampanha", "==", codigo),
      where("ativo", "==", true)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valido: false, mensagem: "Voucher de patrocínio não encontrado ou expirado." };
    }

    const loteDoc = snap.docs[0];
    const loteData = { id: loteDoc.id, ...(loteDoc.data() as any) } as LoteLicencasB2B;

    if (loteData.licencasAtivadas >= loteData.totalLicencas) {
      return { valido: false, mensagem: "Este lote de licenças patrocinadas já esgotou suas cotas." };
    }

    if (new Date(loteData.dataExpiracao) < new Date()) {
      return { valido: false, mensagem: "A validade desta campanha de patrocínio expirou." };
    }

    // Busca os dados do patrocinador dono do lote
    const patDoc = await getDoc(doc(db, "patrocinadores", loteData.patrocinadorId));
    const patrocinador = patDoc.exists()
      ? ({ id: patDoc.id, ...(patDoc.data() as any) } as PatrocinadorB2B)
      : undefined;

    return {
      valido: true,
      lote: loteData,
      patrocinador,
    };
  } catch (err: any) {
    console.error("Erro ao validar voucher:", err);
    return { valido: false, mensagem: "Falha na validação do voucher." };
  }
}

/**
 * Ativa uma licença patrocinada no restaurante e injeta automaticamente
 * os itens do Catálogo Master da marca no cardápio do restaurante.
 */
export async function ativarPatrocinioNoRestaurante(params: {
  restauranteId: string;
  nomeRestaurante: string;
  slugRestaurante: string;
  codigoVoucher: string;
}): Promise<{ sucesso: boolean; mensagem?: string }> {
  const validacao = await validarVoucherPatrocinio(params.codigoVoucher);
  if (!validacao.valido || !validacao.lote || !validacao.patrocinador) {
    return { sucesso: false, mensagem: validacao.mensagem || "Voucher inválido." };
  }

  const { lote, patrocinador } = validacao;

  try {
    // 1. Busca os itens do Catálogo Master do Patrocinador
    const colMaster = collection(db, "patrocinadores", patrocinador.id, "catalogo_master");
    const snapMaster = await getDocs(colMaster);
    const itensInjetadosIds: string[] = [];

    // 2. Injeta os itens no cardápio do restaurante
    const colCardapioRest = collection(db, "restaurantes", params.restauranteId, "cardapio");

    for (const itemDoc of snapMaster.docs) {
      const itemMaster = itemDoc.data() as ItemCatalogoPatrocinador;
      const idNoRestaurante = `spn-${itemDoc.id}`;

      const menuItem: Partial<MenuItem> & {
        origemPatrocinadorId: string;
        bloqueadoParaExclusao: boolean;
        seloPatrocinador: string;
      } = {
        id: idNoRestaurante,
        nome: itemMaster.nome,
        categoria: itemMaster.categoriaSugerida || "Especiais da Casa",
        descricao: itemMaster.descricaoOficial || "",
        precoBase: itemMaster.precoSugerido || 0,
        fotoUrl: itemMaster.fotoOficialUrl || "",
        ativo: true,
        origemPatrocinadorId: patrocinador.id,
        bloqueadoParaExclusao: itemMaster.obrigatorioNoCardapio,
        seloPatrocinador: itemMaster.seloPatrocinador || "Parceiro Oficial",
      };

      await setDoc(doc(colCardapioRest, idNoRestaurante), menuItem, { merge: true });
      itensInjetadosIds.push(idNoRestaurante);
    }

    // 3. Atualiza o documento do restaurante com o patrocínio e concede o Plano Plus
    const restRef = doc(db, "restaurantes", params.restauranteId);
    await updateDoc(restRef, {
      plano: "pro", // Eleva o restaurante para Pro/Plus com ferramentas liberadas
      patrocinio: {
        ativo: true,
        patrocinadorId: patrocinador.id,
        patrocinadorNome: patrocinador.nomeFantasia,
        loteId: lote.id,
        dataExpiracao: lote.dataExpiracao,
        itensInjetados: itensInjetadosIds,
      },
    });

    // 4. Registra a ativação no Lote do Patrocinador
    const loteRef = doc(db, "patrocinadores", patrocinador.id, "lotes_licencas", lote.id);
    const novoVinculo = {
      restauranteId: params.restauranteId,
      nomeRestaurante: params.nomeRestaurante,
      slugRestaurante: params.slugRestaurante,
      codigoVoucherUtilizado: params.codigoVoucher.toUpperCase(),
      ativadoEm: new Date().toISOString(),
      status: "ativo" as const,
    };

    await updateDoc(loteRef, {
      licencasAtivadas: (lote.licencasAtivadas || 0) + 1,
      restaurantesVinculados: [...(lote.restaurantesVinculados || []), novoVinculo],
    });

    return { sucesso: true };
  } catch (err: any) {
    console.error("Falha ao ativar patrocínio:", err);
    return { sucesso: false, mensagem: err?.message || "Erro durante a ativação do patrocínio." };
  }
}

