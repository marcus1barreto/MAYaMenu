/**
 * Motor de Fila Offline e Sincronização em Zona de Sombra (MAYaMenu)
 * Utiliza IndexedDB local com persistência resiliente e drenagem atômica idempotente.
 * 
 * Garante que garçons e operadores possam lançar pratos em zonas de sombra
 * (sem conexão Wi-Fi ou 4G) com Optimistic UI imediato e reconciliação
 * automática assim que o dispositivo recuperar a rede.
 */

import { functions, auth, ensureClienteAnonimo } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
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
  proximaTentativaEm?: number;
  origem?: "cliente" | "garcom";
  mesaToken?: string;
  qrCredencial?: string;
}

const MAX_TENTATIVAS_OFFLINE = 10;
const MAX_IDADE_OFFLINE_MS = 12 * 60 * 60 * 1000; // 12h (alinhado ao TTL máximo da sessão da mesa)

function mesaTokenExpirado(token?: string): boolean {
  if (!token || typeof token !== "string") return true;
  const partes = token.split(".");
  if (partes.length < 2) return true;
  const expMillis = Number(partes[0]);
  if (!Number.isFinite(expMillis)) return true;
  return expMillis <= Date.now() + 30_000;
}

function calcularBackoffComJitter(tentativa: number): number {
  const base = Math.min(60000, 1000 * Math.pow(2, Math.max(0, tentativa - 1)));
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

function ehErroPermanentePedido(err: any): boolean {
  const code = String(err?.code || "");
  return (
    code.includes("invalid-argument") ||
    code.includes("not-found") ||
    code.includes("permission-denied") ||
    code.includes("failed-precondition") ||
    code.includes("already-exists")
  );
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

      tx.oncomplete = () => {
        notificarMudancas(pedido.restauranteId);
        resolve(true);
      };

      tx.onabort = () => {
        console.error("Transação abortada ao gravar pedido na fila IndexedDB:", tx.error);
        resolve(false);
      };

      tx.onerror = () => {
        console.error("Falha na transação ao gravar pedido na fila IndexedDB:", tx.error);
        resolve(false);
      };

      req.onerror = (err) => {
        console.error("Falha ao gravar pedido na fila IndexedDB:", err);
      };
    } catch (err) {
      console.error("Exceção ao acessar Object Store offline:", err);
      resolve(false);
    }
  });
}

async function atualizarPedidoOffline(pedido: PedidoFilaOffline): Promise<boolean> {
  const idb = await obterDB();
  if (!idb) return false;

  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(pedido);
      tx.oncomplete = () => resolve(true);
      tx.onabort = () => resolve(false);
      tx.onerror = () => resolve(false);
    } catch {
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

      tx.oncomplete = () => {
        notificarMudancas(restauranteId);
        resolve(true);
      };

      tx.onabort = () => resolve(false);
      tx.onerror = () => resolve(false);
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
      // Descarta registros expirados (> 12h) para evitar retenção prolongada de credenciais locais
      if (pedido.criadoEmMillis && Date.now() - pedido.criadoEmMillis > MAX_IDADE_OFFLINE_MS) {
        await removerPedidoOffline(pedido.id, pedido.restauranteId);
        continue;
      }

      const tentativasAtuais = pedido.tentativas || 0;
      if (tentativasAtuais >= MAX_TENTATIVAS_OFFLINE) {
        continue;
      }
      if (pedido.proximaTentativaEm && Date.now() < pedido.proximaTentativaEm) {
        continue;
      }

      try {
        const idFinal = pedido.restauranteId;
        const cId = pedido.clienteId;
        const pedidoId = pedido.id;
        const subtotalItem = pedido.subtotal;

        // Origem explícita obrigatória: não infere fluxo de cliente a partir de isAnonymous
        if (pedido.origem === "cliente") {
          if (!auth.currentUser) {
            await ensureClienteAnonimo();
          }
          let tokenParaEnvio = pedido.mesaToken;
          if ((!tokenParaEnvio || mesaTokenExpirado(tokenParaEnvio)) && pedido.qrCredencial) {
            const emitirFn = httpsCallable(functions, "emitirSessaoMesa");
            const sessResp = (await emitirFn({
              restauranteId: idFinal,
              mesa: pedido.mesaNumero,
              qrCredencial: pedido.qrCredencial,
            })) as { data?: { mesaToken?: string } };
            tokenParaEnvio = sessResp?.data?.mesaToken;
          }
          const criarPedidoFn = httpsCallable(functions, "criarPedidoCliente");
          await criarPedidoFn({
            restauranteId: idFinal,
            slug: pedido.slug || idFinal,
            pedidoId,
            mesa: pedido.mesaNumero,
            mesaToken: tokenParaEnvio,
            nomeCliente: pedido.clienteNome.trim(),
            itens: pedido.itens,
            subtotal: subtotalItem,
          });
          await removerPedidoOffline(pedido.id, idFinal);
          sincronizados++;
          continue;
        }

        if (pedido.origem !== "garcom") {
          // Registro legado sem origem explícita: não reclassificar silenciosamente
          falhas++;
          await atualizarPedidoOffline({
            ...pedido,
            qrCredencial: undefined,
            mesaToken: undefined,
            tentativas: MAX_TENTATIVAS_OFFLINE,
            status: "falha",
            ultimoErro: "Registro sem origem explícita (cliente/garcom). Reenvio automático bloqueado por segurança.",
          });
          continue;
        }

        // Fluxo de garçom: execução transacional e idempotente no backend (valida permissão real do colaborador)
        const lancarGarcomFn = httpsCallable(functions, "lancarPedidoGarcom");
        await lancarGarcomFn({
          restauranteId: idFinal,
          slug: pedido.slug || idFinal,
          pedidoId,
          mesa: pedido.mesaNumero,
          clienteId: cId,
          nomeCliente: pedido.clienteNome.trim(),
          itens: pedido.itens,
        });

        // Sucesso confirmado pelo backend: remove o item da fila local
        await removerPedidoOffline(pedido.id, idFinal);
        sincronizados++;
      } catch (err: any) {
        console.warn(`Falha temporária ao sincronizar pedido ${pedido.id}:`, err);
        falhas++;
        const permanente = ehErroPermanentePedido(err);
        const novasTentativas = permanente
          ? MAX_TENTATIVAS_OFFLINE
          : (pedido.tentativas || 0) + 1;
        const atingiuLimite = novasTentativas >= MAX_TENTATIVAS_OFFLINE;
        const encerrado = permanente || atingiuLimite;

        // Nunca remove da fila em caso de erro temporário: marca falha permanente (sem credenciais) ou agenda backoff exponencial
        await atualizarPedidoOffline({
          ...pedido,
          ...(encerrado ? { qrCredencial: undefined, mesaToken: undefined } : {}),
          tentativas: novasTentativas,
          status: encerrado ? "falha" : "pendente",
          proximaTentativaEm: encerrado
            ? undefined
            : Date.now() + calcularBackoffComJitter(novasTentativas),
          ultimoErro: String(err?.message || err),
        });
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
