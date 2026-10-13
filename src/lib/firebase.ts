// Firebase Client SDK - MAYaMenu Alpha
// Auth (dono: Email/Senha ou Google | cliente: Anônimo), Firestore offline e Storage.

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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== "undefined";

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Firestore:
 * - No navegador: cache persistente em IndexedDB (substitui o antigo
 *   `enableIndexedDbPersistence`, depreciado) com suporte a várias abas.
 * - No servidor (ISR/SSR): cache em memória padrão.
 * `initializeFirestore` só pode ser chamado uma vez por app; em HMR caímos no getFirestore.
 */
function createFirestore(): Firestore {
  if (!isBrowser) return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
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
export async function ensureClienteAnonimo(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  const { user } = await signInAnonymously(auth);
  return user;
}
