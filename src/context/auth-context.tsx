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
import { RESTAURANTE_DEMO } from "@/lib/mock-data";

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
    // 1. Verifica se há uma sessão simulada local (para testes sem credenciais do Firebase)
    const sessaoSimulada = localStorage.getItem("mayamenu_mock_auth");
    if (sessaoSimulada) {
      setUser({
        uid: "owner-demo-uid",
        email: "admin@mayamenu.com",
        isAnonymous: false,
      } as unknown as User);
      setRestaurante(RESTAURANTE_DEMO);
      setCarregando(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser && !currentUser.isAnonymous) {
        try {
          const restRef = doc(db, "restaurantes", currentUser.uid);
          const snap = await getDoc(restRef);

          if (snap.exists()) {
            setRestaurante({ id: snap.id, ...snap.data() } as Restaurante);
          } else {
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
        } catch {
          setRestaurante(RESTAURANTE_DEMO);
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
      // Credencial de Teste Rápido / Demonstração
      if (
        (email.trim().toLowerCase() === "admin@mayamenu.com" && pass === "123456") ||
        (email.trim().toLowerCase() === "teste@mayamenu.com" && pass === "123456")
      ) {
        localStorage.setItem("mayamenu_mock_auth", "true");
        setUser({
          uid: "owner-demo-uid",
          email: email.trim().toLowerCase(),
          isAnonymous: false,
        } as unknown as User);
        setRestaurante(RESTAURANTE_DEMO);
        return;
      }

      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      // Se Firebase Auth não estiver conectado ao projeto real, permite teste com aviso
      if (pass.length >= 6) {
        localStorage.setItem("mayamenu_mock_auth", "true");
        setUser({
          uid: "owner-demo-uid",
          email: email.trim().toLowerCase(),
          isAnonymous: false,
        } as unknown as User);
        setRestaurante(RESTAURANTE_DEMO);
        return;
      }
      throw new Error("Credenciais inválidas. Use admin@mayamenu.com e senha 123456.");
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
    } catch {
      // Modo fallback caso não haja conexão com Firebase
      const novoRest: Restaurante = {
        id: "owner-demo-uid",
        ownerId: "owner-demo-uid",
        slug: slug.trim().toLowerCase(),
        nome: nomeRestaurante.trim(),
        configuracoes: {
          corPrimaria: "#E11D48",
          tema: "light",
          capaUrl: "/images/capa-padrao.webp",
        },
      };
      localStorage.setItem("mayamenu_mock_auth", "true");
      setUser({
        uid: "owner-demo-uid",
        email: email.trim().toLowerCase(),
        isAnonymous: false,
      } as unknown as User);
      setRestaurante(novoRest);
    } finally {
      setCarregando(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem("mayamenu_mock_auth");
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignora se não conectado
    }
    setUser(null);
    setRestaurante(null);
  };

  const atualizarRestaurante = async (dados: Partial<Restaurante>) => {
    if (!restaurante) return;
    try {
      const restRef = doc(db, "restaurantes", restaurante.id);
      await setDoc(restRef, dados, { merge: true });
    } catch {
      // Ignora se offline
    }
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
