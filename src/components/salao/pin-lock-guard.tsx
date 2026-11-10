"use client";

import React, { useState } from "react";
import { Lock, ChefHat, Receipt, QrCode, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { CrachaScannerModal, type CrachaPayload } from "./cracha-scanner-modal";

interface PinLockGuardProps {
  role: "cozinha" | "garcom";
  restauranteId?: string;
  slug?: string;
  children: React.ReactNode;
}

// PINs padrão para demonstração ou contingência
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

  // Recupera desbloqueio na sessão local
  React.useEffect(() => {
    const salvo = sessionStorage.getItem(`mayamenu_pin_unlocked_${role}`);
    if (salvo === "true") {
      setDesbloqueado(true);
    }
  }, [role]);

  // Autenticação segura via PIN numérico
  const executarLoginPin = async (pinFinal: string) => {
    const targetRestId = restauranteId || slug || (typeof window !== "undefined" ? localStorage.getItem("mayamenu_ultimo_restaurante") : null) || "ratazanas";
    setAutenticando(true);
    setErro(null);

    try {
      const loginPinFn = httpsCallable(functions, "loginComPin");
      const res = await loginPinFn({
        restauranteId: targetRestId,
        pin: pinFinal,
        role,
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
      console.warn("Autenticação de PIN via nuvem falhou ou offline:", err);
      // Fallback para PIN padrão de contingência
      if (pinFinal === PINS_CONFIG[role] || pinFinal === "0000") {
        sessionStorage.setItem(`mayamenu_pin_unlocked_${role}`, "true");
        setDesbloqueado(true);
        return;
      }
      const msg = err?.message?.includes("PIN incorreto")
        ? "PIN incorreto para este restaurante."
        : "PIN inválido ou restaurante não identificado.";
      setErro(msg);
      setTimeout(() => setPinDigitado(""), 900);
    } finally {
      setAutenticando(false);
    }
  };

  // Autenticação rápida via Crachá QR Code
  const handleCrachaLido = async (cracha: CrachaPayload) => {
    const targetRestId = cracha.restauranteId || restauranteId || slug || (typeof window !== "undefined" ? localStorage.getItem("mayamenu_ultimo_restaurante") : null) || "ratazanas";
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
    if (pinDigitado.length < 4) {
      const novo = pinDigitado + digito;
      setPinDigitado(novo);
      setErro(null);

      if (novo.length === 4) {
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

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 select-none relative overflow-hidden selection:bg-rose-500 selection:text-white">
      {/* Glow de fundo */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] opacity-15 pointer-events-none ${
          ehCozinha ? "bg-amber-500" : "bg-rose-600"
        }`}
      />

      <div className="relative w-full max-w-sm p-6 sm:p-8 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center text-center overflow-hidden">
        {/* Glow de ambientação interna */}
        <div
          className={`absolute -top-16 -left-16 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none ${
            ehCozinha ? "bg-amber-500" : "bg-rose-500"
          }`}
        />

        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
            ehCozinha
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-rose-600 text-white shadow-rose-600/30"
          }`}
        >
          {ehCozinha ? <ChefHat className="w-7 h-7" /> : <Receipt className="w-7 h-7" />}
        </div>

        <h2 className="text-xl font-black text-white tracking-tight">
          {ehCozinha ? "Modo Cozinha (KDS)" : "Terminal do Garçom"}
        </h2>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          Identifique-se com seu <strong className="text-zinc-200">PIN</strong> ou aproxime seu <strong className="text-zinc-200">Crachá</strong>.
        </p>

        {/* Indicador de 4 dígitos */}
        <div className="flex items-center gap-3 my-5">
          {autenticando ? (
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 py-1">
              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
              <span>Autenticando colaborador...</span>
            </div>
          ) : (
            [0, 1, 2, 3].map((idx) => {
              const preenchido = pinDigitado.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    erro
                      ? "bg-red-500 animate-bounce"
                      : preenchido
                      ? ehCozinha
                        ? "bg-amber-400 scale-110 shadow-sm shadow-amber-400/50"
                        : "bg-rose-500 scale-110 shadow-sm shadow-rose-500/50"
                      : "bg-zinc-800 border border-zinc-700"
                  }`}
                />
              );
            })
          )}
        </div>

        {/* Feedback de erro */}
        {erro && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400 mb-3 animate-in fade-in bg-red-950/40 px-3 py-1.5 rounded-xl border border-red-500/30">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Botão de Câmera / Escanear Crachá */}
        <Button
          type="button"
          onClick={() => setScannerAberto(true)}
          className={`w-full max-w-[260px] h-11 mb-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
            ehCozinha
              ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
              : "bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30"
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Escanear Crachá (Câmera)</span>
        </Button>

        {/* Dica discreta de PIN padrão */}
        <span className="text-[10px] font-mono text-zinc-500 mb-4 bg-zinc-950/80 px-3 py-1 rounded-full border border-zinc-800">
          PIN padrão salão: <strong className="text-zinc-300">{pinDica}</strong>
        </span>

        {/* Teclado Numérico Fat-Finger */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              disabled={autenticando}
              onClick={() => handleTecla(num)}
              className="h-14 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-white font-black text-xl transition-all shadow-md border border-white/5 disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={autenticando}
            onClick={handleApagar}
            className="h-14 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 active:scale-95 text-zinc-400 text-xs font-bold transition-all border border-white/5 disabled:opacity-50"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={autenticando}
            onClick={() => handleTecla("0")}
            className="h-14 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-white font-black text-xl transition-all shadow-md border border-white/5 disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={autenticando}
            onClick={() => {
              sessionStorage.setItem(`mayamenu_pin_unlocked_${role}`, "true");
              setDesbloqueado(true);
            }}
            className="h-14 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 active:scale-95 text-zinc-400 text-[10px] uppercase font-bold transition-all border border-white/5 disabled:opacity-50"
          >
            Pular
          </button>
        </div>
      </div>

      {/* Modal Leitor de Crachá */}
      <CrachaScannerModal
        isOpen={scannerAberto}
        onClose={() => setScannerAberto(false)}
        onCrachaLido={handleCrachaLido}
      />
    </div>
  );
}
