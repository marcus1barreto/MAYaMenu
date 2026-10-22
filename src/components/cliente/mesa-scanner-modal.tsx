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
            let numeroMesa: string | null = null;

            try {
              const url = new URL(decodedText);
              numeroMesa = url.searchParams.get("mesa");
            } catch {
              const match = decodedText.match(/mesa[=:_\s-]*([0-9a-zA-Z]+)/i);
              if (match) {
                numeroMesa = match[1];
              } else if (/^[0-9]{1,3}$/.test(decodedText.trim())) {
                numeroMesa = decodedText.trim();
              }
            }

            if (numeroMesa) {
              setMesaLida(numeroMesa);
              if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
              }
            } else {
              setErroCamera("QR Code escaneado não contém um número de mesa válido.");
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
      <DialogContent className="max-w-md p-6 bg-white text-neutral-900 rounded-3xl border-2 border-neutral-200/90 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-neutral-100">
          <DialogTitle className="text-lg font-black text-neutral-950 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-rose-600" />
            <span>Escanear Mesa</span>
          </DialogTitle>
        </DialogHeader>

        {mesaLida ? (
          <div className="space-y-4 py-2 animate-in fade-in duration-300">
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200/90 flex items-start gap-3 text-neutral-950 shadow-xs">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <h4 className="text-sm font-black text-neutral-950">Mesa Identificada com Sucesso!</h4>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Deseja mudar para a <strong className="text-emerald-700 text-sm font-black">Mesa {mesaLida}</strong>?
                </p>
                {mesaAtual && (
                  <p className="text-[11px] text-neutral-500 font-semibold mt-0.5">
                    Mesa atual: {mesaAtual}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleConfirmar}
              className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              <span>Confirmar e Mudar para Mesa {mesaLida}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Aponte a câmera para o QR Code da sua mesa para abrir ou transferir sua comanda sem sair do cardápio.
            </p>

            <div className="relative w-full aspect-square bg-neutral-950 rounded-2xl overflow-hidden border-2 border-dashed border-neutral-300 flex items-center justify-center shadow-inner">
              <div id={leitorId} className="w-full h-full" />
              {iniciando && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-xs text-neutral-700 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
                  <span className="font-bold">Iniciando câmera...</span>
                </div>
              )}
            </div>

            {erroCamera && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span className="flex-1">{erroCamera}</span>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full h-11 border-2 border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
