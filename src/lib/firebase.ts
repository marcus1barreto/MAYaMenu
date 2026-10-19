// Firebase Client SDK - MAYaMenu Alpha
// Auth (dono: Email/Senha ou Google | cliente: Anônimo), Firestore offline e Storage.
// Resiliente a build estático mesmo sem as credenciais reais no .env.local

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth, type User } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForStaticBuildEvaluationOnly123",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mayamenu-demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mayamenu-demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mayamenu-demo.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "666839403683",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:666839403683:web:380c0dfff44eb955ce4316",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-9QGRPGGPDW",
};

const isBrowser = typeof window !== "undefined";

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const FIRESTORE_DATABASE_ID = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "mayamenu-bd";

/**
 * Firestore:
 * - No navegador: Cache persistente SEMPRE em IndexedDB (garante a fila do MAYa Sync-QR).
 * - No servidor (ISR/SSR): Cache padrão em memória para evitar leaks.
 */
function createFirestore(): Firestore {
  if (!isBrowser) return getFirestore(app, FIRESTORE_DATABASE_ID);

  try {
    return initializeFirestore(
      app,
      {
        // ATENÇÃO: Isso ativa o IndexedDB universalmente para todas as rotas (Admin, KDS e Cliente).
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      },
      FIRESTORE_DATABASE_ID
    );
  } catch (err) {
    console.warn("Falha ao inicializar o cache persistente. Fazendo fallback para o Firestore padrão.", err);
    return getFirestore(app, FIRESTORE_DATABASE_ID);
  }
}

export const db: Firestore = createFirestore();
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

const OFFLINE_SESSION_KEY = "mayamenu_cliente_session_id";

/**
 * Garante um ID único para o cliente, mesmo em apagão total de rede.
 * Fluxo:
 * 1. Tem usuário em cache do Firebase Auth? Usa ele.
 * 2. Tenta logar anonimamente no servidor.
 * 3. Falhou (offline)? Puxa UUID do localStorage.
 * 4. Não tem no localStorage? Cria um UUID novo (crypto.randomUUID) e salva.
 *
 * Retorna uma String com compatibilidade de objeto ({ uid: string } e toString()):
 * permite tanto `const uid = await ensureClienteAnonimo()` quanto `user.uid`.
 */
export async function ensureClienteAnonimo(): Promise<string & { uid: string }> {
  let finalUid: string;

  // 1. Se já existe um usuário persistido pelo Firebase Auth, usa ele
  if (auth.currentUser) {
    finalUid = auth.currentUser.uid;
  } else {
    try {
      // 2. Tenta criar/recuperar a sessão no servidor do Firebase
      const userCred = await signInAnonymously(auth);

      // Se deu certo, salva no localStorage também para garantir sincronia futura
      if (typeof window !== "undefined") {
        localStorage.setItem(OFFLINE_SESSION_KEY, userCred.user.uid);
      }

      finalUid = userCred.user.uid;
    } catch (error) {
      console.warn("Falha no Firebase Auth (Offline). Acionando contingência de UUID local:", error);

      if (typeof window === "undefined") {
        finalUid = `ssr-fallback-${Date.now()}`;
      } else {
        // 3. Tenta recuperar a sessão offline anterior
        let localSessionId = localStorage.getItem(OFFLINE_SESSION_KEY);

        // 4. Se não existir, gera um UUID v4 (usando crypto nativo do navegador) e salva
        if (!localSessionId) {
          localSessionId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `offline-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;

          localStorage.setItem(OFFLINE_SESSION_KEY, localSessionId);
        }

        finalUid = localSessionId;
      }
    }
  }

  // Cria objeto compatível tanto como string quanto com propriedade .uid
  const result = new String(finalUid) as string & { uid: string };
  result.uid = finalUid;
  return result;
}
