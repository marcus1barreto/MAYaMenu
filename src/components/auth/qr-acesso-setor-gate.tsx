"use client";

import React, { useEffect } from "react";
import { AlertCircle, ChefHat, Loader2, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useAutoLoginQrSetor } from "@/lib/qr-acesso-setor";
import type { SetorQrAcesso } from "@/types";

interface QrAcessoSetorGateProps {
  setor: SetorQrAcesso;
  habilitado?: boolean;
  children: React.ReactNode;
}

const LABELS_SETOR: Record<SetorQrAcesso, { titulo: string; subtitulo: string }> = {
  cozinha: {
    titulo: "Abrindo KDS da Cozinha...",
    subtitulo: "Validando QR do setor para identificação nominal com PIN.",
  },
  garcom: {
    titulo: "Abrindo Terminal do Salão...",
    subtitulo: "Validando QR do setor para identificação nominal com PIN.",
  },
  admin: {
    titulo: "Conectando Painel Administrativo...",
    subtitulo: "Validando QR de acesso rápido autorizado.",
  },
};

export function QrAcessoSetorGate({
  setor,
  habilitado = true,
  children,
}: QrAcessoSetorGateProps) {
  const { user, restaurante } = useAuth();
  const {
    autenticandoQr,
    restauranteQrAutenticado,
    erroQr,
    limparErroQr,
    concluirHandoffQr,
  } = useAutoLoginQrSetor(setor, habilitado, restaurante?.id);

  // Conclui o handoff assim que o AuthProvider carregar o restaurante autenticado.
  useEffect(() => {
    if (!restauranteQrAutenticado) return;
    if (user && !user.isAnonymous && restaurante?.id === restauranteQrAutenticado) {
      concluirHandoffQr();
      return;
    }
    const timer = setTimeout(() => {
      concluirHandoffQr();
    }, 6000);
    return () => clearTimeout(timer);
  }, [restauranteQrAutenticado, user, restaurante?.id, concluirHandoffQr]);

  const aguardandoHandoff = Boolean(
    restauranteQrAutenticado &&
      (!user || user.isAnonymous || restaurante?.id !== restauranteQrAutenticado)
  );

  if (autenticandoQr || aguardandoHandoff) {
    const label = LABELS_SETOR[setor];
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-8 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            {setor === "cozinha" ? (
              <ChefHat className="w-7 h-7" />
            ) : setor === "garcom" ? (
              <UtensilsCrossed className="w-7 h-7" />
            ) : (
              <ShieldCheck className="w-7 h-7" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-black text-foreground">{label.titulo}</h1>
            <p className="text-xs text-muted-foreground">{label.subtitulo}</p>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" />
        </div>
      </div>
    );
  }

  if (erroQr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-black text-foreground">QR de Acesso Não Autorizado</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">{erroQr}</p>
          </div>
          <Button
            type="button"
            onClick={limparErroQr}
            className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
          >
            Ir para Login Manual / PIN
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
