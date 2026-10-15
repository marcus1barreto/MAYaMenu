// src/lib/restaurante-service.ts
// Serviço para resolução de restaurante e cardápio dinâmicos via Firestore
// com fallback resiliente para mock offline

import { db } from "@/lib/firebase";
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  limit,
  type Unsubscribe,
} from "firebase/firestore";
import type { Restaurante, MenuItem, PedidoRodada, ComandaCliente } from "@/types";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";

/**
 * Busca restaurante pelo `slug` no Firestore.
 * Se não encontrar ou ocorrer falha/offline, retorna RESTAURANTE_DEMO ajustando o slug.
 */
export async function obterRestaurantePorSlug(slug: string): Promise<Restaurante> {
  const slugLimpo = slug.trim().toLowerCase();

  try {
    const q = query(
      collection(db, "restaurantes"),
      where("slug", "==", slugLimpo),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ownerId: data.ownerId || docSnap.id,
        slug: data.slug || slugLimpo,
        nome: data.nome || "Restaurante",
        configuracoes: {
          corPrimaria: data.configuracoes?.corPrimaria || "#E11D48",
          tema: data.configuracoes?.tema || "light",
          logoUrl: data.configuracoes?.logoUrl,
          capaUrl: data.configuracoes?.capaUrl || "/images/capa-padrao.webp",
        },
      };
    }

    // Se o slug for o id direto do documento do restaurante (ex: UID)
    const directDoc = await getDoc(doc(db, "restaurantes", slugLimpo));
    if (directDoc.exists()) {
      const data = directDoc.data();
      return {
        id: directDoc.id,
        ownerId: data.ownerId || directDoc.id,
        slug: data.slug || slugLimpo,
        nome: data.nome || "Restaurante",
        configuracoes: {
          corPrimaria: data.configuracoes?.corPrimaria || "#E11D48",
          tema: data.configuracoes?.tema || "light",
          logoUrl: data.configuracoes?.logoUrl,
          capaUrl: data.configuracoes?.capaUrl || "/images/capa-padrao.webp",
        },
      };
    }
  } catch (err) {
    console.warn("Falha ao buscar restaurante por slug no Firestore (usando fallback demo):", err);
  }

  // Fallback demo garantido
  return {
    ...RESTAURANTE_DEMO,
    slug: slugLimpo,
  };
}

/**
 * Busca cardápio do restaurante no Firestore.
 * Se vazio ou falhar, retorna o cardápio demo padrão.
 */
export async function obterCardapioDoRestaurante(restauranteId: string): Promise<MenuItem[]> {
  try {
    const snap = await getDocs(collection(db, "restaurantes", restauranteId, "cardapio"));
    if (!snap.empty) {
      const itens: MenuItem[] = [];
      snap.forEach((d) => {
        itens.push({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) });
      });
      return itens;
    }
  } catch (err) {
    console.warn("Falha ao buscar cardápio no Firestore (usando fallback demo):", err);
  }

  return CARDAPIO_DEMO;
}

/**
 * Escuta o cardápio em tempo real com onSnapshot (usado pelo Admin e Cliente).
 */
export function escutarCardapio(
  restauranteId: string,
  onAtualizacao: (itens: MenuItem[]) => void
): Unsubscribe {
  const colRef = collection(db, "restaurantes", restauranteId, "cardapio");

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const itens: MenuItem[] = [];
        snapshot.forEach((d) => {
          itens.push({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) });
        });
        onAtualizacao(itens);
      } else {
        onAtualizacao(CARDAPIO_DEMO);
      }
    },
    (err) => {
      console.warn("Listener do cardápio indisponível (offline/fallback):", err);
      onAtualizacao(CARDAPIO_DEMO);
    }
  );
}

/**
 * Atualiza o status ativo/esgotado de um item de cardápio no Firestore.
 */
export async function alternarDisponibilidadePrato(
  restauranteId: string,
  itemId: string,
  ativo: boolean
): Promise<void> {
  const itemRef = doc(db, "restaurantes", restauranteId, "cardapio", itemId);
  try {
    await updateDoc(itemRef, { ativo });
  } catch (err) {
    console.warn("Erro ao atualizar status do prato, tentando setDoc:", err);
    await setDoc(itemRef, { ativo }, { merge: true });
  }
}

/**
 * Salva ou cria um novo prato no cardápio do restaurante no Firestore.
 */
export async function salvarItemCardapio(
  restauranteId: string,
  item: MenuItem
): Promise<void> {
  const itemRef = doc(db, "restaurantes", restauranteId, "cardapio", item.id);
  const { id, ...resto } = item;
  await setDoc(itemRef, resto, { merge: true });
}

/**
 * Exclui um item do cardápio do restaurante no Firestore.
 */
export async function excluirItemCardapio(
  restauranteId: string,
  itemId: string
): Promise<void> {
  const { deleteDoc } = await import("firebase/firestore");
  const itemRef = doc(db, "restaurantes", restauranteId, "cardapio", itemId);
  await deleteDoc(itemRef);
}

/**
 * Inicializa os itens demo no Firestore do restaurante caso ainda esteja vazio.
 */
export async function popularCardapioInicialSeVazio(restauranteId: string): Promise<void> {
  try {
    const colRef = collection(db, "restaurantes", restauranteId, "cardapio");
    const snap = await getDocs(colRef);
    if (snap.empty) {
      for (const item of CARDAPIO_DEMO) {
        const { id, ...resto } = item;
        await setDoc(doc(colRef, id), resto);
      }
    }
  } catch (err) {
    console.warn("Falha ao semear cardápio inicial:", err);
  }
}

/**
 * Escuta os pedidos/rodadas de cozinha em tempo real usando collectionGroup("pedidos").
 * O KDS filtra os pratos pelo restaurante logado.
 */
export function escutarPedidosKds(
  restauranteId: string,
  onAtualizacao: (pedidos: (PedidoRodada & { refPath: string })[]) => void
): Unsubscribe {
  // Query na collection group 'pedidos' filtrada pelo restauranteId
  const q = query(
    collectionGroup(db, "pedidos"),
    where("restauranteId", "==", restauranteId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const lista: (PedidoRodada & { refPath: string })[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as PedidoRodada;
        lista.push({
          ...data,
          id: d.id,
          refPath: d.ref.path,
        });
      });

      // Ordena por data de criação decrescente no cliente
      lista.sort((a, b) => {
        const timeA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
        const timeB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
        return timeB - timeA;
      });

      onAtualizacao(lista);
    },
    (err) => {
      console.warn("Listener do KDS indisponível (offline ou index pendente):", err);
    }
  );
}

/**
 * Atualiza o status de preparo do pedido no Firestore ('a_fazer' -> 'pronto' -> 'entregue').
 */
export async function atualizarStatusPedido(
  refPath: string,
  novoStatus: "a_fazer" | "pronto" | "entregue"
): Promise<void> {
  const pedidoRef = doc(db, refPath);
  await updateDoc(pedidoRef, { status: novoStatus });
}

/**
 * Escuta as comandas abertas de todas as mesas de um restaurante via collectionGroup.
 */
export function escutarComandasSalão(
  restauranteId: string,
  onAtualizacao: (comandas: (ComandaCliente & { refPath: string })[]) => void
): Unsubscribe {
  const q = query(
    collectionGroup(db, "comandas_abertas"),
    where("restauranteId", "==", restauranteId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const lista: (ComandaCliente & { refPath: string })[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as ComandaCliente;
        lista.push({
          ...data,
          id: d.id,
          refPath: d.ref.path,
        });
      });
      onAtualizacao(lista);
    },
    (err) => {
      console.warn("Listener de comandas do salão indisponível:", err);
    }
  );
}

/**
 * Marca uma comanda específica como 'pago' no Firestore (ação exclusiva do lojista/garçom).
 */
export async function marcarComandaPagaFirestore(
  restauranteId: string,
  mesaNumero: number | string,
  clienteId: string
): Promise<void> {
  const comandaRef = doc(
    db,
    "restaurantes",
    restauranteId,
    "mesas",
    String(mesaNumero),
    "comandas_abertas",
    clienteId
  );
  await updateDoc(comandaRef, { status: "pago" });
}

/**
 * Libera a mesa fechando ou limpando as comandas do Firestore.
 */
export async function liberarMesaFirestore(
  restauranteId: string,
  mesaNumero: number | string,
  comandasIds: string[]
): Promise<void> {
  for (const cId of comandasIds) {
    const comandaRef = doc(
      db,
      "restaurantes",
      restauranteId,
      "mesas",
      String(mesaNumero),
      "comandas_abertas",
      cId
    );
    await updateDoc(comandaRef, { status: "pago" });
  }
}

/**
 * Injeta o Ticket lido por QR Code na contingência diretamente no Firestore.
 */
export async function injetarTicketContingencia(
  restauranteId: string,
  ticket: {
    id: string;
    mesa: number | string;
    clienteId: string;
    nomeCliente: string;
    itens: {
      menuItemId: string;
      nome?: string;
      quantidade: number;
      precoFinal: number;
      modificadores?: { grupo: string; opcao: string }[];
      observacoes?: string;
    }[];
    subtotal: number;
  }
): Promise<void> {
  const comandaRef = doc(
    db,
    "restaurantes",
    restauranteId,
    "mesas",
    String(ticket.mesa),
    "comandas_abertas",
    ticket.clienteId
  );

  const pedidoRef = doc(
    db,
    "restaurantes",
    restauranteId,
    "mesas",
    String(ticket.mesa),
    "comandas_abertas",
    ticket.clienteId,
    "pedidos",
    ticket.id
  );

  const dadosPedido = {
    id: ticket.id,
    restauranteId,
    clienteId: ticket.clienteId,
    nomeCliente: ticket.nomeCliente,
    mesa: ticket.mesa,
    itens: ticket.itens,
    subtotal: ticket.subtotal,
    status: "a_fazer" as const,
    criadoEm: new Date(),
  };

  const dadosComanda = {
    id: ticket.clienteId,
    restauranteId,
    nomeCliente: ticket.nomeCliente,
    mesa: ticket.mesa,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    subtotal: ticket.subtotal,
    status: "aguardando_pratos" as const,
  };

  await setDoc(comandaRef, dadosComanda, { merge: true });
  await setDoc(pedidoRef, dadosPedido);
}
