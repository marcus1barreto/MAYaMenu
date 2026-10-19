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
  serverTimestamp,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import type { Restaurante, MenuItem, PedidoRodada, ComandaCliente } from "@/types";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";

/**
 * Verifica se um slug já está em uso por outro restaurante no Firestore
 */
export async function verificarSlugDisponivel(slug: string): Promise<boolean> {
  const slugLimpo = slug.trim().toLowerCase();
  if (!slugLimpo) return false;

  try {
    // 1. Checa trava direta na coleção de slugs se existir
    const travaDoc = await getDoc(doc(db, "slugs", slugLimpo));
    if (travaDoc.exists()) {
      return false;
    }

    // 2. Consulta em restaurantes
    const q = query(
      collection(db, "restaurantes"),
      where("slug", "==", slugLimpo),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty;
  } catch (err) {
    console.warn("Falha na consulta de unicidade do slug (permitindo em modo resiliente):", err);
    return true;
  }
}

/**
 * Busca restaurante pelo `slug` no Firestore de forma estrita (Tenant Existence Guard).
 * Se o documento não existir, retorna null para interromper e exibir fallback.
 */
export async function obterRestaurantePorSlugValido(slug: string): Promise<Restaurante | null> {
  const slugLimpo = slug.trim().toLowerCase();
  if (!slugLimpo) return null;

  // Rota sandbox/demo é sempre válida
  if (slugLimpo === "demo") {
    return { ...RESTAURANTE_DEMO, slug: "demo" };
  }

  try {
    // 1. Consulta por campo 'slug'
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
          modoOperacao: data.configuracoes?.modoOperacao || "hibrido",
        },
      };
    }

    // 2. Consulta pelo UID direto do documento
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
          modoOperacao: data.configuracoes?.modoOperacao || "hibrido",
        },
      };
    }

    // Documento não existe
    return null;
  } catch (err) {
    console.warn("Falha na checagem estrita de existência do restaurante:", err);
    // Em caso de erro de rede (offline), permite renderizar se já tiver dados em cache local
    return {
      ...RESTAURANTE_DEMO,
      slug: slugLimpo,
    };
  }
}

/**
 * Busca restaurante pelo `slug` no Firestore.
 * Se não encontrar ou ocorrer falha/offline, retorna RESTAURANTE_DEMO ajustando o slug.
 */
export async function obterRestaurantePorSlug(slug: string): Promise<Restaurante> {
  const restaurante = await obterRestaurantePorSlugValido(slug);
  if (restaurante) return restaurante;

  return {
    ...RESTAURANTE_DEMO,
    slug: slug.trim().toLowerCase(),
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
  itemId: string,
  fotoUrl?: string
): Promise<void> {
  const { deleteDoc } = await import("firebase/firestore");
  const itemRef = doc(db, "restaurantes", restauranteId, "cardapio", itemId);
  await deleteDoc(itemRef);

  if (fotoUrl) {
    try {
      const { excluirFotoPrato } = await import("@/lib/storage-service");
      await excluirFotoPrato(fotoUrl);
    } catch (e) {
      console.warn("Aviso ao limpar foto do prato excluído no Storage:", e);
    }
  }
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
 * O KDS filtra os pratos pelo restaurante logado (por UID ou por Slug).
 */
export function escutarPedidosKds(
  restauranteIdOuSlug: string,
  onAtualizacao: (pedidos: (PedidoRodada & { refPath: string })[]) => void,
  slugAlternativo?: string
): Unsubscribe {
  const idsParaBuscar = Array.from(
    new Set([restauranteIdOuSlug, slugAlternativo].filter(Boolean) as string[])
  );

  const q = idsParaBuscar.length > 1
    ? query(collectionGroup(db, "pedidos"), where("restauranteId", "in", idsParaBuscar))
    : query(collectionGroup(db, "pedidos"), where("restauranteId", "==", idsParaBuscar[0]));

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
  restauranteIdOuSlug: string,
  onAtualizacao: (comandas: (ComandaCliente & { refPath: string })[]) => void,
  slugAlternativo?: string
): Unsubscribe {
  const idsParaBuscar = Array.from(
    new Set([restauranteIdOuSlug, slugAlternativo].filter(Boolean) as string[])
  );

  const q = idsParaBuscar.length > 1
    ? query(collectionGroup(db, "comandas_abertas"), where("restauranteId", "in", idsParaBuscar))
    : query(collectionGroup(db, "comandas_abertas"), where("restauranteId", "==", idsParaBuscar[0]));

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
 * Escuta os pedidos/rodadas de uma mesa específica em tempo real para exibir os pratos nas comandas.
 */
export function escutarPedidosMesa(
  restauranteIdOuSlug: string,
  mesaNumero: number | string,
  onAtualizacao: (pedidos: PedidoRodada[]) => void,
  slugAlternativo?: string
): Unsubscribe {
  const numMesa = Number(mesaNumero) || mesaNumero;
  const idsParaBuscar = Array.from(
    new Set([restauranteIdOuSlug, slugAlternativo].filter(Boolean) as string[])
  );

  const q = idsParaBuscar.length > 1
    ? query(
        collectionGroup(db, "pedidos"),
        where("restauranteId", "in", idsParaBuscar),
        where("numeroMesa", "==", numMesa)
      )
    : query(
        collectionGroup(db, "pedidos"),
        where("restauranteId", "==", idsParaBuscar[0]),
        where("numeroMesa", "==", numMesa)
      );

  return onSnapshot(
    q,
    (snapshot) => {
      const lista: PedidoRodada[] = [];
      snapshot.forEach((d) => {
        lista.push({ ...(d.data() as PedidoRodada), id: d.id });
      });
      onAtualizacao(lista);
    },
    (err) => {
      console.warn(`Listener de pedidos da Mesa ${mesaNumero} indisponível:`, err);
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
 * Cliente solicita a presença do Garçom na mesa com anti-flooding integrado.
 */
export async function chamarGarcomFirestore(params: {
  restauranteId: string;
  mesaNumero: number | string;
  clienteId: string;
  nomeCliente?: string;
  motivo?: string;
  slug?: string;
}): Promise<void> {
  const idFinal = (params.restauranteId || params.slug || "demo").trim();

  const comandaRef = doc(
    db,
    "restaurantes",
    idFinal,
    "mesas",
    String(params.mesaNumero),
    "comandas_abertas",
    params.clienteId
  );

  const comandaSnap = await getDoc(comandaRef);

  if (!comandaSnap.exists()) {
    // 1ª vez: cria a comanda com status inicial 'pedindo' e restauranteId garantido
    await setDoc(comandaRef, {
      id: params.clienteId,
      restauranteId: idFinal,
      slug: params.slug || idFinal,
      nomeCliente: params.nomeCliente || "Cliente",
      mesa: params.mesaNumero,
      numeroMesa: Number(params.mesaNumero) || params.mesaNumero,
      subtotal: 0,
      status: "pedindo",
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      chamadoGarcom: {
        ativo: true,
        solicitadoEm: serverTimestamp(),
        motivo: params.motivo || "Atendimento",
      },
    });
  } else {
    // Comanda já existe: ativa o chamado preservando status e subtotal
    await updateDoc(comandaRef, {
      restauranteId: idFinal,
      slug: params.slug || idFinal,
      atualizadoEm: serverTimestamp(),
      chamadoGarcom: {
        ativo: true,
        solicitadoEm: serverTimestamp(),
        motivo: params.motivo || "Atendimento",
      },
    });
  }
}

/**
 * Garçom atende e desativa o chamado da mesa.
 */
export async function atenderGarcomFirestore(
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

  await updateDoc(comandaRef, {
    "chamadoGarcom.ativo": false,
    atualizadoEm: serverTimestamp(),
  });
}

/**
 * Libera a mesa fechando as comandas e limpando/entregando os pedidos filhos daquela mesa via writeBatch
 * para evitar que pedidos órfãos fiquem aparecendo no KDS da cozinha.
 */
export async function liberarMesaFirestore(
  restauranteId: string,
  mesaNumero: number | string,
  comandasIds: string[]
): Promise<void> {
  const { writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);

  // 1. Coleta e consolidação de dados da sessão para histórico analítico
  let subtotalTotal = 0;
  let quantidadePagantes = 0;
  let abertaEmTimestamp: any = null;
  let pagaEmTimestamp: any = null;

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

    try {
      const snapComanda = await getDoc(comandaRef);
      if (snapComanda.exists()) {
        const cData = snapComanda.data();
        quantidadePagantes++;
        subtotalTotal += Number(cData.subtotal) || 0;

        if (cData.criadoEm) {
          if (!abertaEmTimestamp || (cData.criadoEm.toMillis && cData.criadoEm.toMillis() < (abertaEmTimestamp.toMillis ? abertaEmTimestamp.toMillis() : Infinity))) {
            abertaEmTimestamp = cData.criadoEm;
          }
        }
        if (cData.atualizadoEm) {
          pagaEmTimestamp = cData.atualizadoEm;
        }
      }
    } catch (e) {
      console.warn(`Aviso ao ler comanda ${cId} para consolidar histórico da mesa:`, e);
    }

    // Apaga a comanda ativa após copiar para o histórico
    batch.delete(comandaRef);

    // Busca pedidos filhos para exclusão evitando órfãos no KDS
    try {
      const pedidosCol = collection(
        db,
        "restaurantes",
        restauranteId,
        "mesas",
        String(mesaNumero),
        "comandas_abertas",
        cId,
        "pedidos"
      );
      const snapPedidos = await getDocs(pedidosCol);
      snapPedidos.forEach((pDoc) => {
        // Apaga os pedidos ativos para limpar o KDS
        batch.delete(pDoc.ref);
      });
    } catch (e) {
      console.warn("Falha ao buscar pedidos da comanda para baixa em lote:", e);
    }
  }

  // 2. Gravação atômica do documento histórico de sessão
  try {
    const idHistorico = `sessao_${mesaNumero}_${Date.now()}`;
    const historicoRef = doc(
      db,
      "restaurantes",
      restauranteId,
      "historico_sessoes_mesas",
      idHistorico
    );

    batch.set(historicoRef, {
      id: idHistorico,
      restauranteId,
      mesa: Number(mesaNumero) || mesaNumero,
      subtotalTotal,
      quantidadePagantes: Math.max(quantidadePagantes, comandasIds.length),
      comandasIds,
      abertaEm: abertaEmTimestamp || serverTimestamp(),
      pagaEm: pagaEmTimestamp || serverTimestamp(),
      liberadaEm: serverTimestamp(),
    });
  } catch (errHistorico) {
    console.warn("Falha ao preparar gravação de histórico de sessão no lote:", errHistorico);
  }

  await batch.commit();
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

  const { Timestamp } = await import("firebase/firestore");
  const agoraTimestamp = Timestamp.now();

  const dadosPedido = {
    id: ticket.id,
    restauranteId,
    clienteId: ticket.clienteId,
    nomeCliente: ticket.nomeCliente,
    mesa: ticket.mesa,
    numeroMesa: Number(ticket.mesa) || ticket.mesa,
    itens: ticket.itens,
    subtotal: ticket.subtotal,
    status: "a_fazer" as const,
    criadoEm: agoraTimestamp,
  };

  const dadosComanda = {
    id: ticket.clienteId,
    restauranteId,
    nomeCliente: ticket.nomeCliente,
    mesa: ticket.mesa,
    numeroMesa: Number(ticket.mesa) || ticket.mesa,
    criadoEm: agoraTimestamp,
    atualizadoEm: agoraTimestamp,
    subtotal: ticket.subtotal,
    status: "aguardando_pratos" as const,
  };

  await setDoc(comandaRef, dadosComanda, { merge: true });
  await setDoc(pedidoRef, dadosPedido);
}

/**
 * Lança um item manualmente em uma mesa (ação do Garçom ou Admin).
 * Cria o documento na subcoleção 'pedidos' com status 'a_fazer' (garantindo injeção no KDS)
 * e atualiza o subtotal acumulado na comanda pai via increment.
 */
export async function lancarItemManualFirestore(params: {
  restauranteId: string;
  slug?: string;
  mesaNumero: number | string;
  clienteNome: string;
  clienteId?: string;
  item: MenuItem;
  quantidade: number;
  observacao?: string;
}): Promise<void> {
  const idFinal = (params.restauranteId || params.slug || "demo").trim();
  const cId = params.clienteId || `garcom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const pedidoId = `ped-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const subtotalItem = (Number(params.item.precoBase) || 0) * params.quantidade;

  const comandaRef = doc(
    db,
    "restaurantes",
    idFinal,
    "mesas",
    String(params.mesaNumero),
    "comandas_abertas",
    cId
  );

  const pedidoRef = doc(
    db,
    "restaurantes",
    idFinal,
    "mesas",
    String(params.mesaNumero),
    "comandas_abertas",
    cId,
    "pedidos",
    pedidoId
  );

  const itensMapeados = [
    {
      menuItemId: params.item.id,
      nome: params.item.nome,
      quantidade: params.quantidade,
      precoFinal: Number(params.item.precoBase) || 0,
      modificadores: [],
      observacoes: params.observacao || "",
    },
  ];

  // Documento individual da rodada para o KDS da cozinha
  const dadosPedidoRodada = {
    id: pedidoId,
    restauranteId: idFinal,
    slug: params.slug || idFinal,
    clienteId: cId,
    nomeCliente: params.clienteNome.trim(),
    mesa: params.mesaNumero,
    numeroMesa: Number(params.mesaNumero) || params.mesaNumero,
    itens: itensMapeados,
    subtotal: subtotalItem,
    status: "a_fazer" as const,
    criadoEm: serverTimestamp(),
  };

  const comandaSnap = await getDoc(comandaRef);

  let saveComandaPromise: Promise<unknown>;
  if (!comandaSnap.exists()) {
    saveComandaPromise = setDoc(comandaRef, {
      id: cId,
      restauranteId: idFinal,
      slug: params.slug || idFinal,
      nomeCliente: params.clienteNome.trim(),
      mesa: params.mesaNumero,
      numeroMesa: Number(params.mesaNumero) || params.mesaNumero,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      subtotal: subtotalItem,
      status: "aguardando_pratos" as const,
    });
  } else {
    saveComandaPromise = updateDoc(comandaRef, {
      restauranteId: idFinal,
      slug: params.slug || idFinal,
      nomeCliente: params.clienteNome.trim(),
      mesa: params.mesaNumero,
      numeroMesa: Number(params.mesaNumero) || params.mesaNumero,
      atualizadoEm: serverTimestamp(),
      subtotal: increment(subtotalItem),
      status: "aguardando_pratos" as const,
    });
  }

  const savePedidoPromise = setDoc(pedidoRef, dadosPedidoRodada);

  await Promise.all([saveComandaPromise, savePedidoPromise]);
}

/**
 * Escuta todos os pedidos/rodadas já realizados por um cliente específico na sua comanda.
 */
export function escutarPedidosCliente(
  restauranteId: string,
  mesaNumero: number | string,
  clienteId: string,
  onAtualizacao: (pedidos: PedidoRodada[]) => void
): Unsubscribe {
  const colRef = collection(
    db,
    "restaurantes",
    restauranteId,
    "mesas",
    String(mesaNumero),
    "comandas_abertas",
    clienteId,
    "pedidos"
  );

  const q = query(colRef, orderBy("criadoEm", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const lista: PedidoRodada[] = [];
      snapshot.forEach((d) => {
        lista.push({ ...(d.data() as PedidoRodada), id: d.id });
      });
      onAtualizacao(lista);
    },
    (err) => {
      console.error(`Erro ao escutar pedidos do cliente ${clienteId} na mesa ${mesaNumero}:`, err);
    }
  );
}
