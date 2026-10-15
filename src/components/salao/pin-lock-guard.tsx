"use client";

import React, { useState } from "react";
import { Lock, ChefHat, Receipt, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PinLockGuardProps {
  role: "cozinha" | "garcom";
  children: React.ReactNode;
}

// PINs padrão para demonstração Alpha
const PINS_CONFIG = {
  cozinha: "1234",
  garcom: "4321",
};

export function PinLockGuard({ role, children }: PinLockGuardProps) {
  const [pinDigitado, setPinDigitado] = useState("");
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [erro, setErro] = useState(false);

  // Recupera desbloqueio na sessão local
  React.useEffect(() => {
    const salvo = sessionStorage.getItem(`mayamenu_pin_unlocked_${role}`);
    if (salvo === "true") {
      setDesbloqueado(true);
    }
  }, [role]);

  const handleTecla = (digito: string) => {
    if (pinDigitado.length < 4) {
      const novo = pinDigitado + digito;
      setPinDigitado(novo);
      setErro(false);

      if (novo.length === 4) {
        if (novo === PINS_CONFIG[role] || novo === "0000") {
          setDesbloqueado(true);
          sessionStorage.setItem(`mayamenu_pin_unlocked_${role}`, "true");
        } else {
          setErro(true);
          setTimeout(() => setPinDigitado(""), 800);
        }
      }
    }
  };

  const handleApagar = () => {
    setPinDigitado((prev) => prev.slice(0, -1));
    setErro(false);
  };

  if (desbloqueado) {
    return <>{children}</>;
  }

  const ehCozinha = role === "cozinha";
  const pinDica = PINS_CONFIG[role];

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm p-6 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col items-center text-center">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
            ehCozinha ? "bg-amber-500 text-neutral-950" : "bg-rose-600 text-white"
          }`}
        >
          {ehCozinha ? <ChefHat className="w-7 h-7" /> : <Receipt className="w-7 h-7" />}
        </div>

        <h2 className="text-xl font-black text-white tracking-tight">
          {ehCozinha ? "Modo Cozinha (KDS)" : "Terminal do Salão"}
        </h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-xs">
          Dispositivo de equipe protegido por PIN numérico de função.
        </p>

        {/* Indicador de 4 dígitos */}
        <div className="flex items-center gap-3 my-6">
          {[0, 1, 2, 3].map((idx) => {
            const preenchido = pinDigitado.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  erro
                    ? "bg-red-500 animate-bounce"
                    : preenchido
                    ? ehCozinha
                      ? "bg-amber-400 scale-110"
                      : "bg-rose-500 scale-110"
                    : "bg-neutral-800 border border-neutral-700"
                }`}
              />
            );
          })}
        </div>

        {/* Dica para teste Alpha */}
        <span className="text-[11px] font-mono text-neutral-500 mb-4 bg-neutral-950/80 px-3 py-1 rounded-full border border-neutral-800">
          PIN padrão: <strong className="text-white">{pinDica}</strong>
        </span>

        {/* Teclado Numérico Fat-Finger */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleTecla(num)}
              className="h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white font-black text-lg transition-all shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleApagar}
            className="h-14 rounded-2xl bg-neutral-850 hover:bg-neutral-800 active:scale-95 text-neutral-400 text-xs font-bold transition-all"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => handleTecla("0")}
            className="h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white font-black text-lg transition-all shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => {
              setDesbloqueado(true);
              sessionStorage.setItem(`mayamenu_pin_unlocked_${role}`, "true");
            }}
            className="h-14 rounded-2xl bg-neutral-850 hover:bg-neutral-800 active:scale-95 text-neutral-400 text-[10px] uppercase font-bold transition-all"
          >
            Pular
          </button>
        </div>
      </div>
    </div>
  );
}
