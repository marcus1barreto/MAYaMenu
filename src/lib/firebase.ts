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
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

const isBrowser = typeof window !== "undefined";

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Firestore:
 * - No navegador: cache persistente em IndexedDB com suporte a várias abas.
 * - No servidor (ISR/SSR): cache em memória padrão.
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
