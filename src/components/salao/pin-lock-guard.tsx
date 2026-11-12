"use client";

import React, { useState, useEffect } from "react";
import {
  Lock,
  ChefHat,
  Receipt,
  QrCode,
  Loader2,
  AlertCircle,
  Sparkles,
  User,
  ArrowLeft,
  Check,
  Delete,
  KeyRound,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth, db, functions } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { CrachaScannerModal, type CrachaPayload } from "./cracha-scanner-modal";

export interface ColaboradorItem {
  id: string;
  uid: string;
  nome: string;
  role: "cozinha" | "garcom";
  fotoUrl?: string | null;
}

interface PinLockGuardProps {
  role: "cozinha" | "garcom";
  restauranteId?: string;
  slug?: string;
  children: React.ReactNode;
}

// PINs padrão de contingência
const PINS_CONFIG = {
  cozinha: "1234",
  garcom: "4321",
};

export function PinLockGuard({ role, restauranteId, slug, children }: PinLockGuardProps) {
  const [pinDigitado, setPinDigitado] = useState("");
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [autenticando, setAutenticando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [scannerAberto, setScannerAberto] = useState(false);

  // Seleção de colaborador
  const [colaboradores, setColaboradores] = useState<ColaboradorItem[]>([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(true);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<ColaboradorItem | null>(null);
  const [modoEntradaDireta, setModoEntradaDireta] = useState(false);

  // Recupera desbloqueio na sessão local
  useEffect(() => {
    const salvo = sessionStorage.getItem(`mayamenu_pin_unlocked_${role}`);
    if (salvo === "true") {
      setDesbloqueado(true);
    }
  }, [role]);

  // Carrega lista pública de colaboradores do salão / cozinha
  useEffect(() => {
    let montado = true;
    const targetRestId =
      restauranteId ||
      slug ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("r") ||
          new URLSearchParams(window.location.search).get("restaurante") ||
          localStorage.getItem("mayamenu_ultimo_restaurante")
        : null) ||
      "ratazanas";

    async function buscarEquipe() {
      try {
        // 1. Tenta obter via Cloud Function listarEquipePublica
        try {
          const listarFn = httpsCallable(functions, "listarEquipePublica");
          const res: any = await listarFn({ restauranteId: targetRestId, role });
          if (res?.data?.membros && Array.isArray(res.data.membros) && res.data.membros.length > 0) {
            if (montado) {
              setColaboradores(res.data.membros);
              setCarregandoColaboradores(false);
              return;
            }
          }
        } catch {
          // Fallback para Firestore
        }

        // 2. Fallback: Consulta Firestore se as regras permitirem
        const equipeRef = collection(db, "restaurantes", targetRestId, "equipe");
        const q = query(equipeRef, where("role", "==", role));
        const snap = await getDocs(q);

        const list: ColaboradorItem[] = [];
        snap.forEach((d) => {
          const m = d.data();
          list.push({
            id: d.id,
            uid: m.uid || d.id,
            nome: m.nome || "Colaborador",
            role: m.role || role,
            fotoUrl: m.fotoUrl || null,
          });
        });

        if (montado) {
          list.sort((a, b) => a.nome.localeCompare(b.nome));
          setColaboradores(list);
        }
      } catch (err) {
        console.warn("Aviso ao carregar equipe pública para seleção:", err);
      } finally {
        if (montado) {
          setCarregandoColaboradores(false);
        }
      }
    }

    buscarEquipe();
    return () => {
      montado = false;
    };
  }, [restauranteId, slug, role]);

  // Autenticação segura via PIN numérico (suporta de 4 a 6 dígitos)
  const executarLoginPin = async (pinFinal: string) => {
    if (!pinFinal || pinFinal.length < 4) {
      setErro("Digite pelo menos 4 números.");
      return;
    }

    const targetRestId =
      restauranteId ||
      slug ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("r") ||
          new URLSearchParams(window.location.search).get("restaurante") ||
          localStorage.getItem("mayamenu_ultimo_restaurante")
        : null) ||
      "ratazanas";

    setAutenticando(true);
    setErro(null);

    try {
      const loginPinFn = httpsCallable(functions, "loginComPin");
      const res = await loginPinFn({
        restauranteId: targetRestId,
        pin: pinFinal,
        role,
        colaboradorId: colaboradorSelecionado?.id || colaboradorSelecionado?.uid,
      });

      const data = res.data as { sucesso: boolean; token: string; membro: any };
      if (data?.token) {
        await signInWithCustomToken(auth, data.token);
        sessionStorage.setItem(`mayamenu_pin_unlocked_${role}`, "true");
        if (data.membro) {
          sessionStorage.setItem(`mayamenu_colaborador_${role}`, JSON.stringify(data.membro));
        }
        setDesbloqueado(true);
        return;
      }
    } catch (err: any) {
      console.warn("Autenticação de PIN via nuvem falhou:", err);
      const msg = err?.message?.includes("bloqueado temporariamente")
        ? err.message
        : err?.message?.includes("PIN incorreto")
        ? `PIN incorreto para ${colaboradorSelecionado ? colaboradorSelecionado.nome : "este restaurante"}.`
        : "PIN inválido. Verifique os números e tente novamente.";
      setErro(msg);
      setTimeout(() => setPinDigitado(""), 900);
    } finally {
      setAutenticando(false);
    }
  };

  // Autenticação rápida via Crachá QR Code
  const handleCrachaLido = async (cracha: CrachaPayload) => {
    const targetRestId =
      cracha.restauranteId ||
      restauranteId ||
      slug ||
      (typeof window !== "undefined" ? localStorage.getItem("mayamenu_ultimo_restaurante") : null) ||
      "ratazanas";

    setAutenticando(true);
    setErro(null);

    try {
      const loginCrachaFn = httpsCallable(functions, "loginComCracha");
      const res = await loginCrachaFn({
        restauranteId: targetRestId,
        crachaToken: cracha.crachaToken,
      });

      const data = res.data as { sucesso: boolean; token: string; membro: any };
      if (data?.token) {
        await signInWithCustomToken(auth, data.token);
        sessionStorage.setItem(`mayamenu_pin_unlocked_${role}`, "true");
        if (data.membro) {
          sessionStorage.setItem(`mayamenu_colaborador_${role}`, JSON.stringify(data.membro));
        }
        setDesbloqueado(true);
      }
    } catch (err: any) {
      console.error("Falha ao autenticar com crachá:", err);
      setErro("Crachá não reconhecido ou expirado.");
    } finally {
      setAutenticando(false);
    }
  };

  const handleTecla = (digito: string) => {
    if (autenticando) return;
    // Permite digitar até 6 dígitos
    if (pinDigitado.length < 6) {
      const novo = pinDigitado + digito;
      setPinDigitado(novo);
      setErro(null);

      // Se completou 6 dígitos, submete automaticamente
      if (novo.length === 6) {
        executarLoginPin(novo);
      }
    }
  };

  const handleApagar = () => {
    if (autenticando) return;
    setPinDigitado((prev) => prev.slice(0, -1));
    setErro(null);
  };

  if (desbloqueado) {
    return <>{children}</>;
  }

  const ehCozinha = role === "cozinha";
  const pinDica = PINS_CONFIG[role];

  // Mostra a grade de seleção de garçons se existirem colaboradores cadastrados e nenhum tiver sido selecionado
  const exibirSelecaoColaboradores =
    colaboradores.length > 0 && !colaboradorSelecionado && !modoEntradaDireta;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 select-none relative overflow-hidden selection:bg-rose-600 selection:text-white">
      {/* Glow de fundo suave */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] opacity-10 pointer-events-none ${
          ehCozinha ? "bg-amber-500" : "bg-rose-600"
        }`}
      />

      <div className="relative w-full max-w-sm sm:max-w-md p-6 sm:p-8 bg-white border border-neutral-200/80 rounded-3xl shadow-xl flex flex-col items-center text-center overflow-hidden">
        {/* Glow de ambientação interna */}
        <div
          className={`absolute -top-16 -left-16 w-36 h-36 rounded-full blur-3xl opacity-10 pointer-events-none ${
            ehCozinha ? "bg-amber-500" : "bg-rose-500"
          }`}
        />

        {/* ─────────────────────────────────────────────────────────────
            TELA 1: SELEÇÃO DE COLABORADOR (QUEM ESTÁ ENTRANDO?)
           ───────────────────────────────────────────────────────────── */}
        {exibirSelecaoColaboradores ? (
          <div className="w-full flex flex-col items-center animate-in fade-in">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md ${
                ehCozinha
                  ? "bg-amber-500 text-white shadow-amber-500/20"
                  : "bg-rose-600 text-white shadow-rose-600/20"
              }`}
            >
              {ehCozinha ? <ChefHat className="w-7 h-7" /> : <UtensilsCrossed className="w-7 h-7" />}
            </div>

            <h2 className="text-xl font-black text-neutral-950 tracking-tight">
              {ehCozinha ? "KDS da Cozinha" : "Terminal do Garçom"}
            </h2>
            <p className="text-xs text-neutral-500 mt-1 mb-5">
              Selecione seu perfil para digitar seu <strong>PIN</strong>:
            </p>

            {/* Grid de Colaboradores para toque */}
            <div className="grid grid-cols-2 gap-3 w-full mb-5 max-h-60 overflow-y-auto p-1">
              {colaboradores.map((colab) => (
                <button
                  key={colab.id}
                  type="button"
                  onClick={() => {
                    setColaboradorSelecionado(colab);
                    setPinDigitado("");
                    setErro(null);
                  }}
                  className="p-3 rounded-2xl border-2 border-neutral-200 hover:border-rose-500 hover:bg-rose-50/50 active:scale-95 transition-all flex flex-col items-center text-center gap-2 group shadow-2xs"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    {colab.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={colab.fotoUrl} alt={colab.nome} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-neutral-400 group-hover:text-rose-600" />
                    )}
                  </div>
                  <span className="text-xs font-black text-neutral-900 group-hover:text-rose-600 line-clamp-1">
                    {colab.nome}
                  </span>
                </button>
              ))}
            </div>

            {/* Opções Alternativas: Digitar PIN Geral ou Usar Crachá */}
            <div className="flex flex-col gap-2 w-full pt-2 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModoEntradaDireta(true);
                  setColaboradorSelecionado(null);
                  setPinDigitado("");
                }}
                className="w-full h-10 text-xs font-bold rounded-xl border-neutral-200 text-neutral-700 hover:text-neutral-950"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1 text-neutral-500" />
                <span>Digitar PIN Direto / Salão Geral</span>
              </Button>

              <Button
                type="button"
                onClick={() => setScannerAberto(true)}
                className={`w-full h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs ${
                  ehCozinha
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Escanear Crachá com Câmera</span>
              </Button>
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────
              TELA 2: TECLADO NUMÉRICO DE PIN (DE 4 A 6 DÍGITOS)
             ───────────────────────────────────────────────────────────── */
          <div className="w-full flex flex-col items-center animate-in fade-in">
            {/* Botão de Voltar para Seleção */}
            {colaboradores.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setColaboradorSelecionado(null);
                  setModoEntradaDireta(false);
                  setPinDigitado("");
                  setErro(null);
                }}
                className="self-start -mt-2 mb-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Trocar perfil</span>
              </button>
            )}

            {/* Cabeçalho com o colaborador selecionado ou ícone do papel */}
            {colaboradorSelecionado ? (
              <div className="flex flex-col items-center mb-3">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 border-2 border-rose-500 shadow-md flex items-center justify-center mb-2">
                  {colaboradorSelecionado.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={colaboradorSelecionado.fotoUrl}
                      alt={colaboradorSelecionado.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-neutral-400" />
                  )}
                </div>
                <h3 className="text-base font-black text-neutral-950">
                  Olá, {colaboradorSelecionado.nome}!
                </h3>
                <p className="text-xs text-neutral-500">
                  Digite seu <strong>PIN de 4 a 6 números</strong>:
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center mb-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-md ${
                    ehCozinha
                      ? "bg-amber-500 text-white shadow-amber-500/20"
                      : "bg-rose-600 text-white shadow-rose-600/20"
                  }`}
                >
                  {ehCozinha ? <ChefHat className="w-7 h-7" /> : <Receipt className="w-7 h-7" />}
                </div>
                <h2 className="text-xl font-black text-neutral-950 tracking-tight">
                  {ehCozinha ? "KDS Cozinha" : "Terminal do Garçom"}
                </h2>
                <p className="text-xs text-neutral-500">
                  Digite o <strong>PIN numérico (4 a 6 dígitos)</strong>:
                </p>
              </div>
            )}

            {/* Indicador visual de até 6 dígitos */}
            <div className="flex items-center justify-center gap-2.5 my-4 min-h-[32px]">
              {autenticando ? (
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 py-1">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  <span>Validando credencial...</span>
                </div>
              ) : (
                [0, 1, 2, 3, 4, 5].map((idx) => {
                  const preenchido = pinDigitado.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-200 ${
                        erro
                          ? "bg-red-500 animate-bounce"
                          : preenchido
                          ? ehCozinha
                            ? "bg-amber-500 scale-110 shadow-sm shadow-amber-500/40"
                            : "bg-rose-600 scale-110 shadow-sm shadow-rose-600/40"
                          : "bg-neutral-200 border border-neutral-300"
                      }`}
                    />
                  );
                })
              )}
            </div>

            {/* Feedback de erro */}
            {erro && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700 mb-3 animate-in fade-in bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-600" />
                <span>{erro}</span>
              </div>
            )}

            {/* Dica discreta de contingência */}
            <span className="text-[10px] font-mono text-neutral-500 mb-4 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200">
              PIN padrão do salão: <strong className="text-neutral-800">{pinDica}</strong>
            </span>

            {/* Teclado Numérico Fat-Finger Harmonizado com Botão de Confirmar */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[270px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={autenticando}
                  onClick={() => handleTecla(num)}
                  className="h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-900 font-black text-xl transition-all shadow-2xs border border-neutral-200/80 disabled:opacity-50"
                >
                  {num}
                </button>
              ))}

              {/* Botão Apagar / Limpar */}
              <button
                type="button"
                disabled={autenticando}
                onClick={handleApagar}
                className="h-14 rounded-2xl bg-neutral-50 hover:bg-neutral-100 active:scale-95 text-neutral-600 font-bold text-xs flex items-center justify-center gap-1 transition-all border border-neutral-200/60 disabled:opacity-50"
                title="Apagar último número"
              >
                <Delete className="w-4 h-4" />
                <span>Apagar</span>
              </button>

              {/* Tecla Zero */}
              <button
                type="button"
                disabled={autenticando}
                onClick={() => handleTecla("0")}
                className="h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-900 font-black text-xl transition-all shadow-2xs border border-neutral-200/80 disabled:opacity-50"
              >
                0
              </button>

              {/* Botão Entrar / Confirmar (Habilitado a partir de 4 números) */}
              <button
                type="button"
                disabled={autenticando || pinDigitado.length < 4}
                onClick={() => executarLoginPin(pinDigitado)}
                className={`h-14 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 ${
                  pinDigitado.length >= 4
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 scale-102"
                    : "bg-neutral-100 text-neutral-400 border border-neutral-200/60 opacity-60 cursor-not-allowed"
                }`}
                title="Confirmar PIN"
              >
                <Check className="w-4 h-4" />
                <span>Entrar</span>
              </button>
            </div>

            {/* Atalho do Crachá no rodapé */}
            <div className="mt-4 pt-3 border-t border-neutral-100 w-full max-w-[270px] flex items-center justify-center">
              <button
                type="button"
                onClick={() => setScannerAberto(true)}
                className="text-xs text-neutral-500 hover:text-neutral-900 font-bold flex items-center gap-1.5 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-rose-600" />
                <span>Ou use a câmera para ler o crachá</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Leitor de Crachá QR Code */}
      <CrachaScannerModal
        isOpen={scannerAberto}
        onClose={() => setScannerAberto(false)}
        onCrachaLido={handleCrachaLido}
      />
    </div>
  );
}
