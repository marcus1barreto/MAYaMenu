/**
 * Motor de Fila Offline e Sincronização em Zona de Sombra (MAYaMenu)
 * Utiliza IndexedDB local com persistência resiliente e drenagem atômica idempotente.
 * 
 * Garante que garçons e operadores possam lançar pratos em zonas de sombra
 * (sem conexão Wi-Fi ou 4G) com Optimistic UI imediato e reconciliação
 * automática assim que o dispositivo recuperar a rede.
 */

import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch, serverTimestamp, increment } from "firebase/firestore";
import type { MenuItem } from "@/types";

export interface ItemPedidoOffline {
  menuItemId: string;
  nome: string;
  quantidade: number;
  precoFinal: number;
  modificadores: { grupo: string; opcao: string; precoAdicional?: number }[];
  observacoes?: string;
  tempoPreparoEstimado?: number;
}

export interface PedidoFilaOffline {
  id: string; // pedidoId único (chave de idempotência)
  restauranteId: string;
  slug?: string;
  mesaNumero: number | string;
  clienteNome: string;
  clienteId: string;
  itens: ItemPedidoOffline[];
  subtotal: number;
  observacao?: string;
  criadoEmMillis: number;
  tentativas: number;
  status: "pendente" | "sincronizando" | "falha";
  ultimoErro?: string;
}

const DB_NAME = "mayamenu_offline_v1";
const DB_VERSION = 1;
const STORE_NAME = "fila_pedidos";

let dbPromise: Promise<IDBDatabase | null> | null = null;
let isDraining = false;
const listeners = new Set<(pendentes: PedidoFilaOffline[]) => void>();

/**
 * Abre e inicializa a conexão com o banco IndexedDB de contingência local.
 */
function obterDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const idb = (event.target as IDBOpenDBRequest).result;
          if (!idb.objectStoreNames.contains(STORE_NAME)) {
            const store = idb.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("restauranteId", "restauranteId", { unique: false });
            store.createIndex("mesaNumero", "mesaNumero", { unique: false });
            store.createIndex("status", "status", { unique: false });
            store.createIndex("criadoEmMillis", "criadoEmMillis", { unique: false });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (err) => {
          console.warn("Aviso ao abrir IndexedDB de contingência offline:", err);
          resolve(null);
        };
      } catch (e) {
        console.warn("Falha crítica ao instanciar IndexedDB:", e);
        resolve(null);
      }
    });
  }

  return dbPromise;
}

/**
 * Enfileira um pedido na Object Store do IndexedDB.
 */
export async function enfileirarPedidoOffline(pedido: PedidoFilaOffline): Promise<boolean> {
  const idb = await obterDB();
  if (!idb) return false;

  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(pedido);

      req.onsuccess = () => {
        notificarMudancas(pedido.restauranteId);
        resolve(true);
      };

      req.onerror = (err) => {
        console.error("Falha ao gravar pedido na fila IndexedDB:", err);
        resolve(false);
      };
    } catch (err) {
      console.error("Exceção ao acessar Object Store offline:", err);
      resolve(false);
    }
  });
}

/**
 * Recupera todos os pedidos pendentes armazenados localmente.
 */
export async function obterFilaOffline(restauranteId?: string): Promise<PedidoFilaOffline[]> {
  const idb = await obterDB();
  if (!idb) return [];

  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const todos: PedidoFilaOffline[] = req.result || [];
        if (restauranteId) {
          resolve(todos.filter((p) => p.restauranteId === restauranteId));
        } else {
          resolve(todos);
        }
      };

      req.onerror = () => {
        resolve([]);
      };
    } catch {
      resolve([]);
    }
  });
}

/**
 * Remove um pedido sincronizado da fila offline.
 */
export async function removerPedidoOffline(id: string, restauranteId?: string): Promise<boolean> {
  const idb = await obterDB();
  if (!idb) return false;

  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => {
        notificarMudancas(restauranteId);
        resolve(true);
      };

      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Notifica os componentes React subscritos que a fila foi modificada.
 */
async function notificarMudancas(restauranteId?: string) {
  if (listeners.size === 0) return;
  const lista = await obterFilaOffline(restauranteId);
  listeners.forEach((listener) => {
    try {
      listener(lista);
    } catch (e) {
      console.warn("Erro no listener da fila offline:", e);
    }
  });
}

/**
 * Registra um callback para ouvir atualizações em tempo real da fila offline.
 */
export function escutarFilaOffline(
  callback: (pendentes: PedidoFilaOffline[]) => void,
  restauranteId?: string
): () => void {
  const handler = (dados: PedidoFilaOffline[]) => {
    if (restauranteId) {
      callback(dados.filter((p) => p.restauranteId === restauranteId || p.slug === restauranteId));
    } else {
      callback(dados);
    }
  };

  listeners.add(handler);
  // Dispara valor inicial
  obterFilaOffline(restauranteId).then(callback);

  return () => {
    listeners.delete(handler);
  };
}

/**
 * Drena e sincroniza todos os pedidos pendentes com o Firestore em lote.
 * Utiliza o pedidoId original para garantir gravação atômica e 100% idempotente.
 */
export async function drenarFilaOffline(restauranteId?: string): Promise<{ sincronizados: number; falhas: number }> {
  if (isDraining) return { sincronizados: 0, falhas: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { sincronizados: 0, falhas: 0 };
  }

  isDraining = true;
  let sincronizados = 0;
  let falhas = 0;

  try {
    const pendentes = await obterFilaOffline(restauranteId);
    if (pendentes.length === 0) {
      isDraining = false;
      return { sincronizados: 0, falhas: 0 };
    }

    for (const pedido of pendentes) {
      try {
        const idFinal = pedido.restauranteId;
        const cId = pedido.clienteId;
        const pedidoId = pedido.id;
        const subtotalItem = pedido.subtotal;

        const comandaRef = doc(
          db,
          "restaurantes",
          idFinal,
          "mesas",
          String(pedido.mesaNumero),
          "comandas_abertas",
          cId
        );

        const pedidoRef = doc(
          db,
          "restaurantes",
          idFinal,
          "mesas",
          String(pedido.mesaNumero),
          "comandas_abertas",
          cId,
          "pedidos",
          pedidoId
        );

        const kdsRef = doc(db, "restaurantes", idFinal, "kds_tickets", pedidoId);

        const dadosPedidoRodada = {
          id: pedidoId,
          restauranteId: idFinal,
          slug: pedido.slug || idFinal,
          clienteId: cId,
          nomeCliente: pedido.clienteNome.trim(),
          mesa: pedido.mesaNumero,
          numeroMesa: Number(pedido.mesaNumero) || pedido.mesaNumero,
          itens: pedido.itens,
          subtotal: subtotalItem,
          status: "a_fazer" as const,
          criadoEm: serverTimestamp(),
          sincronizadoOfflineEm: serverTimestamp(),
        };

        const payloadKds = {
          id: pedidoId,
          mesa: pedido.mesaNumero,
          numeroMesa: Number(pedido.mesaNumero) || pedido.mesaNumero,
          clienteId: cId,
          nomeCliente: pedido.clienteNome.trim(),
          status: "a_fazer" as const,
          pedidoRefPath: pedidoRef.path,
          itens: pedido.itens,
          criadoEm: serverTimestamp(),
        };

        const comandaSnap = await getDoc(comandaRef);
        const batch = writeBatch(db);

        if (!comandaSnap.exists()) {
          batch.set(comandaRef, {
            id: cId,
            restauranteId: idFinal,
            slug: pedido.slug || idFinal,
            nomeCliente: pedido.clienteNome.trim(),
            mesa: pedido.mesaNumero,
            numeroMesa: Number(pedido.mesaNumero) || pedido.mesaNumero,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            subtotal: subtotalItem,
            status: "aguardando_pratos" as const,
          });
        } else {
          batch.update(comandaRef, {
            restauranteId: idFinal,
            slug: pedido.slug || idFinal,
            nomeCliente: pedido.clienteNome.trim(),
            mesa: pedido.mesaNumero,
            numeroMesa: Number(pedido.mesaNumero) || pedido.mesaNumero,
            atualizadoEm: serverTimestamp(),
            subtotal: increment(subtotalItem),
            status: "aguardando_pratos" as const,
          });
        }

        // Gravações idempotentes com set (sobrescrevem sem duplicar caso já tenham batido no Firestore)
        batch.set(pedidoRef, dadosPedidoRodada);
        batch.set(kdsRef, payloadKds);

        await batch.commit();

        // Sucesso: remove o item da fila local
        await removerPedidoOffline(pedido.id, idFinal);
        sincronizados++;
      } catch (err: any) {
        console.warn(`Falha temporária ao sincronizar pedido ${pedido.id}:`, err);
        falhas++;
        // Atualiza tentativas para não travar a fila
        const idb = await obterDB();
        if (idb) {
          try {
            const tx = idb.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put({
              ...pedido,
              tentativas: (pedido.tentativas || 0) + 1,
              status: "falha",
              ultimoErro: String(err?.message || err),
            });
          } catch {
            // Ignora
          }
        }
      }
    }

    await notificarMudancas(restauranteId);
  } finally {
    isDraining = false;
  }

  return { sincronizados, falhas };
}

let monitoramentoIniciado = false;

/**
 * Inicializa os observadores globais de rede (online/offline e visibilidade)
 * para disparar a drenagem automática sempre que a conexão retornar.
 */
export function iniciarMonitoramentoOffline(restauranteId?: string): () => void {
  if (typeof window === "undefined" || monitoramentoIniciado) {
    return () => {};
  }

  monitoramentoIniciado = true;

  const handleOnline = () => {
    drenarFilaOffline(restauranteId);
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      drenarFilaOffline(restauranteId);
    }
  };

  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibility);

  // Intervalo de contingência a cada 20 segundos
  const intervalId = setInterval(() => {
    if (navigator.onLine) {
      drenarFilaOffline(restauranteId);
    }
  }, 20000);

  // Executa uma drenagem imediata caso já haja algo pendente ao inicializar
  if (navigator.onLine) {
    drenarFilaOffline(restauranteId);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibility);
    clearInterval(intervalId);
    monitoramentoIniciado = false;
  };
}
