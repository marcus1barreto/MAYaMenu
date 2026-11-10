"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, AlertTriangle, Loader2, QrCode } from "lucide-react";

export interface CrachaPayload {
  tipo?: string;
  restauranteId?: string;
  crachaToken: string;
  membroId?: string;
  nome?: string;
}

interface CrachaScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCrachaLido: (cracha: CrachaPayload) => void;
}

export function CrachaScannerModal({ isOpen, onClose, onCrachaLido }: CrachaScannerModalProps) {
  const [iniciando, setIniciando] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [crachaSucesso, setCrachaSucesso] = useState<CrachaPayload | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const leitorId = "cracha-qr-reader-container";

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch(() => {});
      }
      setCrachaSucesso(null);
      setErroCamera(null);
      return;
    }

    setIniciando(true);
    setErroCamera(null);
    setCrachaSucesso(null);

    const timer = setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode(leitorId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: "user" }, // câmera frontal por padrão para crachá de funcionário
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            try {
              let parsed: any = null;
              if (decodedText.startsWith("{")) {
                parsed = JSON.parse(decodedText);
              }
              if (parsed && parsed.crachaToken) {
                setCrachaSucesso(parsed);
                if (scannerRef.current) {
                  scannerRef.current.stop().catch(() => {});
                }
                onCrachaLido(parsed);
                onClose();
              } else if (decodedText.length >= 16) {
                // Token puro
                const payload: CrachaPayload = { crachaToken: decodedText };
                setCrachaSucesso(payload);
                if (scannerRef.current) {
                  scannerRef.current.stop().catch(() => {});
                }
                onCrachaLido(payload);
                onClose();
              } else {
                setErroCamera("QR Code lido não é um crachá de colaborador válido.");
              }
            } catch {
              setErroCamera("Formato de QR Code inválido.");
            }
          },
          () => {}
        );
        setIniciando(false);
      } catch (err: unknown) {
        // Tenta fallback com câmera ambiente traseira
        try {
          if (scannerRef.current) {
            await scannerRef.current.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
              (decodedText) => {
                try {
                  const parsed = decodedText.startsWith("{") ? JSON.parse(decodedText) : null;
                  const payload = parsed?.crachaToken ? parsed : { crachaToken: decodedText };
                  setCrachaSucesso(payload);
                  scannerRef.current?.stop().catch(() => {});
                  onCrachaLido(payload);
                  onClose();
                } catch {
                  setErroCamera("Formato inválido.");
                }
              },
              () => {}
            );
            setIniciando(false);
            return;
          }
        } catch {
          const msg = err instanceof Error ? err.message : "Não foi possível acessar a câmera.";
          setErroCamera(msg);
          setIniciando(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch(() => {});
      }
    };
  }, [isOpen, onCrachaLido, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-neutral-900 text-white rounded-3xl border border-neutral-800 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-neutral-800">
          <DialogTitle className="text-base font-black text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-rose-500" />
            <span>Aponte o Crachá na Câmera</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-xs text-neutral-400 text-center">
            Aproxime o QR Code do seu crachá para login instantâneo.
          </p>

          <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center">
            <div id={leitorId} className="w-full h-full" />

            {iniciando && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-xs gap-3">
                <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                <span className="text-xs font-semibold text-neutral-300">Iniciando câmera...</span>
              </div>
            )}

            {erroCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-neutral-950/90 text-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <p className="text-xs text-red-400">{erroCamera}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setErroCamera(null);
                    setIniciando(true);
                  }}
                  className="text-xs border-neutral-700 hover:bg-neutral-800 text-white"
                >
                  Tentar Novamente
                </Button>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full text-xs text-neutral-400 hover:text-white"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

