"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
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
  cadastrar: (
    email: string,
    pass: string,
    nomeRestaurante: string,
    slug: string,
    codigoLicenca: string,
    modoOperacao?: "com_garcom" | "hibrido" | "balcao"
  ) => Promise<void>;
  logout: () => Promise<void>;
  atualizarRestaurante: (dados: Partial<Restaurante>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Monitora estado do Auth e escuta o documento do restaurante em tempo real
  useEffect(() => {
    let unsubRestaurante: (() => void) | null = null;

    // Sincroniza o JWT fresco do Firebase Auth com o cookie '__session' para o Middleware
    const unsubIdToken = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Pega o JWT fresco (onde moram os Custom Claims)
        const token = await currentUser.getIdToken();
        // Salva no cookie '__session' (nome recomendado pelo Firebase para Firebase Hosting/Vercel)
        document.cookie = `__session=${token}; path=/; secure; samesite=strict; max-age=3600`;
      } else {
        // Limpa o cookie se deslogar
        document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    });

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (unsubRestaurante) {
        unsubRestaurante();
        unsubRestaurante = null;
      }

      if (currentUser && !currentUser.isAnonymous) {
        try {
          const { onSnapshot, collection, query, where, getDocs } = await import("firebase/firestore");
          const restRef = doc(db, "restaurantes", currentUser.uid);

          unsubRestaurante = onSnapshot(
            restRef,
            async (snap) => {
              if (snap.exists()) {
                setRestaurante({ id: snap.id, ...snap.data() } as Restaurante);
                setCarregando(false);
              } else {
                // Se não encontrar diretamente pelo doc(uid), busca por ownerId
                try {
                  const q = query(collection(db, "restaurantes"), where("ownerId", "==", currentUser.uid));
                  const querySnap = await getDocs(q);
                  if (!querySnap.empty) {
                    const firstDoc = querySnap.docs[0];
                    setRestaurante({ id: firstDoc.id, ...firstDoc.data() } as Restaurante);
                  } else {
                    const restLocalSalvo = localStorage.getItem(`mayamenu_rest_${currentUser.uid}`);
                    if (restLocalSalvo) {
                      setRestaurante(JSON.parse(restLocalSalvo));
                    } else {
                      setRestaurante(null);
                    }
                  }
                } catch {
                  const restLocalSalvo = localStorage.getItem(`mayamenu_rest_${currentUser.uid}`);
                  setRestaurante(restLocalSalvo ? JSON.parse(restLocalSalvo) : null);
                }
                setCarregando(false);
              }
            },
            async (err) => {
              console.warn("Falha no listener do restaurante (usando busca por ownerId ou cache):", err);
              try {
                const { collection, query, where, getDocs } = await import("firebase/firestore");
                const q = query(collection(db, "restaurantes"), where("ownerId", "==", currentUser.uid));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                  const firstDoc = querySnap.docs[0];
                  setRestaurante({ id: firstDoc.id, ...firstDoc.data() } as Restaurante);
                } else {
                  const restLocalSalvo = localStorage.getItem(`mayamenu_rest_${currentUser.uid}`);
                  setRestaurante(restLocalSalvo ? JSON.parse(restLocalSalvo) : null);
                }
              } catch {
                const restLocalSalvo = localStorage.getItem(`mayamenu_rest_${currentUser.uid}`);
                setRestaurante(restLocalSalvo ? JSON.parse(restLocalSalvo) : null);
              }
              setCarregando(false);
            }
          );
        } catch {
          const restLocalSalvo = localStorage.getItem(`mayamenu_rest_${currentUser.uid}`);
          setRestaurante(restLocalSalvo ? JSON.parse(restLocalSalvo) : null);
          setCarregando(false);
        }
      } else {
        // Verifica se há sessão simulada puramente demo
        const sessaoSimulada = localStorage.getItem("mayamenu_mock_auth");
        if (sessaoSimulada) {
          setUser({
            uid: "owner-demo-uid",
            email: "admin@mayamenu.com",
            isAnonymous: false,
          } as unknown as User);
          setRestaurante(RESTAURANTE_DEMO);
        } else {
          setRestaurante(null);
        }
        setCarregando(false);
      }
    });

    return () => {
      unsubIdToken();
      unsubAuth();
      if (unsubRestaurante) unsubRestaurante();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setCarregando(true);
    try {
      // Credencial explícita apenas para teste demonstrativo
      if (
        (email.trim().toLowerCase() === "admin@mayamenu.com" && pass === "123456") ||
        (email.trim().toLowerCase() === "demo@mayamenu.com" && pass === "123456")
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

      // Limpa qualquer flag mock remanescente antes de autenticar conta real
      localStorage.removeItem("mayamenu_mock_auth");
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const uid = cred.user.uid;

      // Busca instância do restaurante do usuário
      try {
        const restRef = doc(db, "restaurantes", uid);
        const snap = await getDoc(restRef);
        if (snap.exists()) {
          setRestaurante({ id: snap.id, ...snap.data() } as Restaurante);
        } else {
          const { collection, query, where, getDocs } = await import("firebase/firestore");
          const q = query(collection(db, "restaurantes"), where("ownerId", "==", uid));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const firstDoc = querySnap.docs[0];
            setRestaurante({ id: firstDoc.id, ...firstDoc.data() } as Restaurante);
          }
        }
      } catch (err) {
        console.warn("Consulta do restaurante falhou, checando cache local:", err);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao efetuar login";
      throw new Error(msg);
    } finally {
      setCarregando(false);
    }
  };

  const cadastrar = async (
    email: string,
    pass: string,
    nomeRestaurante: string,
    slug: string,
    codigoLicenca: string,
    modoOperacao?: "com_garcom" | "hibrido" | "balcao"
  ) => {
    setCarregando(true);
    try {
      // 1. Validação estrita inicial da Licença / Concessão
      const { validarLicencaParaAtivacao, ativarLicencaEInstanciaAtomica } = await import(
        "@/lib/licenca-service"
      );
      const validacao = await validarLicencaParaAtivacao(codigoLicenca);
      if (!validacao.valida) {
        throw new Error(validacao.motivo || "Código de concessão inválido ou já utilizado.");
      }

      // Validação de unicidade do slug antes de criar qualquer conta
      const { verificarSlugDisponivel } = await import("@/lib/restaurante-service");
      const slugLimpo = slug.trim().toLowerCase();
      const slugDisponivel = await verificarSlugDisponivel(slugLimpo);
      if (!slugDisponivel) {
        throw new Error(`O endereço '/r/${slugLimpo}' já está em uso por outro restaurante. Por favor, escolha outro slug.`);
      }

      // Limpa mock anterior para nunca misturar com o Demo
      localStorage.removeItem("mayamenu_mock_auth");

      // 2. Cria usuário no Firebase Auth com recuperação de falha parcial
      let uid: string;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
        uid = cred.user.uid;
      } catch (authErr: unknown) {
        const isEmailInUse =
          authErr instanceof Error &&
          (authErr.message.includes("auth/email-already-in-use") ||
            (authErr as { code?: string }).code === "auth/email-already-in-use");

        if (isEmailInUse) {
          // Recuperação automática de falha parcial: tenta logar para concluir ativação pendente
          try {
            const loginRes = await signInWithEmailAndPassword(auth, email.trim(), pass);
            uid = loginRes.user.uid;

            // Verifica se o restaurante já foi criado anteriormente
            const restExistenteSnap = await getDoc(doc(db, "restaurantes", uid));
            if (restExistenteSnap.exists()) {
              throw new Error("Este e-mail já possui um estabelecimento ativo. Acesse o painel de login.");
            }
          } catch (loginErr: unknown) {
            if (loginErr instanceof Error && loginErr.message.includes("estabelecimento ativo")) {
              throw loginErr;
            }
            throw new Error("Este e-mail já foi cadastrado no sistema, mas a senha informada não confere. Use a senha correta para concluir a ativação.");
          }
        } else {
          console.warn("Falha no Firebase Auth:", authErr);
          throw authErr;
        }
      }

      const nomeLimpo = nomeRestaurante.trim();

      // 3. Queima atômica da licença e criação do restaurante
      const novoRest = await ativarLicencaEInstanciaAtomica({
        codigo: codigoLicenca,
        ownerUid: uid,
        restauranteNome: nomeLimpo,
        slug: slugLimpo,
        modoOperacao: modoOperacao || "hibrido",
      });

      // Salva referência do restaurante criado para resiliência local
      localStorage.setItem(`mayamenu_rest_${uid}`, JSON.stringify(novoRest));

      // Garante estado limpo e vazio para novo onboarding (Guided Empty State)
      setRestaurante(novoRest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro no cadastro";
      throw new Error(msg);
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

export function useSafeAuth() {
  return useContext(AuthContext);
}

