"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, CheckCircle2, AlertTriangle, RefreshCw, MapPin } from "lucide-react";

interface MesaScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMesaDetectada: (numeroMesa: number | string) => void;
  mesaAtual?: number | string;
}

export function MesaScannerModal({
  isOpen,
  onClose,
  onMesaDetectada,
  mesaAtual,
}: MesaScannerModalProps) {
  const [iniciando, setIniciando] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [mesaLida, setMesaLida] = useState<string | number | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const leitorId = "mesa-scanner-container";

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
      setMesaLida(null);
      setErroCamera(null);
      return;
    }

    setIniciando(true);
    setErroCamera(null);
    setMesaLida(null);

    const timer = setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode(leitorId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Extrai o parâmetro ?mesa=X ou /mesa/X ou número puro
            let mesaEncontrada: string | number | null = null;

            try {
              if (decodedText.startsWith("http://") || decodedText.startsWith("https://")) {
                const url = new URL(decodedText);
                const paramMesa = url.searchParams.get("mesa");
                if (paramMesa) {
                  mesaEncontrada = paramMesa;
                }
              }
            } catch {
              // Não era uma URL completa
            }

            if (!mesaEncontrada) {
              const matchMesa = decodedText.match(/(?:mesa[=\/:]\s*|m)(\d+)/i);
              if (matchMesa && matchMesa[1]) {
                mesaEncontrada = matchMesa[1];
              } else if (/^\d+$/.test(decodedText.trim())) {
                mesaEncontrada = decodedText.trim();
              }
            }

            if (mesaEncontrada) {
              setMesaLida(mesaEncontrada);
              if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
              }
            } else {
              setErroCamera("QR Code lido não possui uma identificação de mesa válida.");
            }
          },
          () => {}
        );
        setIniciando(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Não foi possível acessar a câmera do dispositivo.";
        setErroCamera(msg);
        setIniciando(false);
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
  }, [isOpen]);

  const handleConfirmar = () => {
    if (mesaLida) {
      onMesaDetectada(mesaLida);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-neutral-900 text-white rounded-3xl border border-neutral-800 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2">
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <span>Escanear Mesa</span>
          </DialogTitle>
        </DialogHeader>

        {mesaLida ? (
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Mesa Identificada com Sucesso!</h4>
                <p className="text-xs text-neutral-300 mt-1">
                  Deseja mudar para a <strong className="text-emerald-400 text-sm">Mesa {mesaLida}</strong>?
                </p>
                {mesaAtual && (
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Mesa atual: {mesaAtual}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleConfirmar}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              <span>Confirmar e Mudar para Mesa {mesaLida}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-neutral-400 leading-relaxed">
              Aponte a câmera para o QR Code da sua mesa para abrir ou transferir sua comanda sem sair do cardápio.
            </p>

            <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-2 border-dashed border-neutral-700 flex items-center justify-center">
              <div id={leitorId} className="w-full h-full" />
              {iniciando && (
                <div className="absolute inset-0 bg-neutral-950/80 flex flex-col items-center justify-center text-xs text-neutral-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Iniciando câmera...</span>
                </div>
              )}
            </div>

            {erroCamera && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{erroCamera}</span>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full h-11 border-neutral-700 text-neutral-300 hover:bg-neutral-800 rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
