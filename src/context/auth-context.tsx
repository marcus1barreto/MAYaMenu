"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { Restaurante } from "@/types";

interface AuthContextType {
  user: User | null;
  restaurante: Restaurante | null;
  carregando: boolean;
  login: (email: string, pass: string) => Promise<void>;
  cadastrar: (email: string, pass: string, nomeRestaurante: string, slug: string) => Promise<void>;
  logout: () => Promise<void>;
  atualizarRestaurante: (dados: Partial<Restaurante>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Monitora estado do Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Se for usuário autenticado não-anônimo (dono da conta)
      if (currentUser && !currentUser.isAnonymous) {
        try {
          // Busca o restaurante onde o ID ou ownerId corresponda ao uid
          const restRef = doc(db, "restaurantes", currentUser.uid);
          const snap = await getDoc(restRef);

          if (snap.exists()) {
            setRestaurante({ id: snap.id, ...snap.data() } as Restaurante);
          } else {
            // Cria registro padrão se não existir (onboarding self-service)
            const novoRestaurante: Restaurante = {
              id: currentUser.uid,
              ownerId: currentUser.uid,
              slug: `rest-${currentUser.uid.slice(0, 6)}`,
              nome: "Meu Restaurante",
              configuracoes: {
                corPrimaria: "#E11D48",
                tema: "light",
                capaUrl: "/images/capa-padrao.webp",
              },
            };
            await setDoc(restRef, novoRestaurante);
            setRestaurante(novoRestaurante);
          }
        } catch (e) {
          console.warn("Erro ao buscar restaurante no Firestore:", e);
          // Fallback em caso de offline/dev
          setRestaurante({
            id: currentUser.uid,
            ownerId: currentUser.uid,
            slug: "demo",
            nome: "MAYaBurger & Co. (Modo Local)",
            configuracoes: {
              corPrimaria: "#E11D48",
              tema: "light",
              capaUrl: "/images/capa-padrao.webp",
            },
          });
        }
      } else {
        setRestaurante(null);
      }
      setCarregando(false);
    });

    return () => unsub();
  }, []);

  const login = async (email: string, pass: string) => {
    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } finally {
      setCarregando(false);
    }
  };

  const cadastrar = async (
    email: string,
    pass: string,
    nomeRestaurante: string,
    slug: string
  ) => {
    setCarregando(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = cred.user.uid;

      const novoRest: Restaurante = {
        id: uid,
        ownerId: uid,
        slug: slug.trim().toLowerCase(),
        nome: nomeRestaurante.trim(),
        configuracoes: {
          corPrimaria: "#E11D48",
          tema: "light",
          capaUrl: "/images/capa-padrao.webp",
        },
      };

      const restRef = doc(db, "restaurantes", uid);
      await setDoc(restRef, novoRest);
      setRestaurante(novoRest);
    } finally {
      setCarregando(false);
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setRestaurante(null);
  };

  const atualizarRestaurante = async (dados: Partial<Restaurante>) => {
    if (!restaurante || !user) return;
    const restRef = doc(db, "restaurantes", restaurante.id);
    await setDoc(restRef, dados, { merge: true });
    setRestaurante((prev) => (prev ? { ...prev, ...dados } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurante,
        carregando,
        login,
        cadastrar,
        logout,
        atualizarRestaurante,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
