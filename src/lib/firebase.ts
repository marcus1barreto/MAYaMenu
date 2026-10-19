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
  memoryLocalCache,
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
 * Isolamento de Persistência (Firebase):
 * - Contexto Operacional (Garçom, Admin, Cozinha, Superadmin): Ativa persistentLocalCache (IndexedDB multi-tab)
 *   para garantir operação contínua e offline do salão.
 * - Contexto do Cliente (/r/[slug] ou outros públicos): Utiliza memoryLocalCache para garantir uma
 *   "Sessão Efêmera", eliminando vazamento de dados de sessão entre clientes e poupando armazenamento do celular.
 */
function createFirestore(): Firestore {
  if (!isBrowser) return getFirestore(app, FIRESTORE_DATABASE_ID);

  try {
    const pathname = window.location.pathname;
    const isOperacional =
      pathname.startsWith("/garcom") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/cozinha") ||
      pathname.startsWith("/superadmin");

    if (isOperacional) {
      return initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        },
        FIRESTORE_DATABASE_ID
      );
    } else {
      return initializeFirestore(
        app,
        {
          localCache: memoryLocalCache(),
        },
        FIRESTORE_DATABASE_ID
      );
    }
  } catch {
    return getFirestore(app, FIRESTORE_DATABASE_ID);
  }
}

export const db: Firestore = createFirestore();
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

/**
 * Garante uma sessão para o cliente do PWA sem nenhuma tela de cadastro.
 * O uid anônimo é o `clienteId` da comanda (ver firestore.rules).
 * Se já houver alguém logado (inclusive o dono), reaproveita a sessão.
 */
export async function ensureClienteAnonimo(): Promise<{ uid: string }> {
  try {
    const authPromise = async () => {
      await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser;
      const { user } = await signInAnonymously(auth);
      return user;
    };

    // Timeout de 3 segundos para não travar a UI caso o Auth falhe
    const timeoutPromise = new Promise<{ uid: string }>((resolve) =>
      setTimeout(() => {
        let localUid = typeof window !== "undefined" ? localStorage.getItem("mayamenu_anon_uid") : null;
        if (!localUid) {
          localUid = `anon-${Math.random().toString(36).substring(2, 10)}`;
          if (typeof window !== "undefined") localStorage.setItem("mayamenu_anon_uid", localUid);
        }
        resolve({ uid: localUid });
      }, 3000)
    );

    return await Promise.race([authPromise(), timeoutPromise]);
  } catch {
    let localUid = typeof window !== "undefined" ? localStorage.getItem("mayamenu_anon_uid") : null;
    if (!localUid) {
      localUid = `anon-${Math.random().toString(36).substring(2, 10)}`;
      if (typeof window !== "undefined") localStorage.setItem("mayamenu_anon_uid", localUid);
    }
    return { uid: localUid };
  }
}
