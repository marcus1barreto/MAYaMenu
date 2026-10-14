"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { decodeTicket, type TicketPayload } from "@/lib/ticket";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketLido: (ticket: TicketPayload) => void;
}

export function QrScannerModal({ isOpen, onClose, onTicketLido }: QrScannerModalProps) {
  const [iniciando, setIniciando] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [ticketSucesso, setTicketSucesso] = useState<TicketPayload | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const leitorId = "html5-qr-reader-container";

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch(() => {
            // Ignora erro ao parar
          });
      }
      setTicketSucesso(null);
      setErroCamera(null);
      return;
    }

    setIniciando(true);
    setErroCamera(null);
    setTicketSucesso(null);

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
            // Sucesso na leitura do QR
            const ticket = decodeTicket(decodedText);
            if (ticket) {
              setTicketSucesso(ticket);
              if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
              }
            } else {
              setErroCamera("Código lido não é um Ticket Digital válido do MAYaMenu.");
            }
          },
          () => {
            // Frame sem QR (ignora)
          }
        );
        setIniciando(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Não foi possível acessar a câmera.";
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

  const handleConfirmarInjecao = () => {
    if (ticketSucesso) {
      onTicketLido(ticketSucesso);
      onClose();
    }
  };

  const handleTentarNovamente = () => {
    setTicketSucesso(null);
    setErroCamera(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-neutral-900 text-white rounded-3xl border border-neutral-800 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2">
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-rose-500" />
            <span>Leitor de Ticket Offline</span>
          </DialogTitle>
        </DialogHeader>

        {ticketSucesso ? (
          /* RESULTADO DA LEITURA */
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Ticket Válido Reconhecido!</h4>
                <p className="text-xs text-neutral-300 mt-1">
                  Mesa <strong className="text-white">{ticketSucesso.t}</strong> • Cliente:{" "}
                  <strong className="text-white">{ticketSucesso.c.n}</strong>
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Itens no pedido: {ticketSucesso.i.reduce((acc, it) => acc + it.q, 0)}
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-800/80 rounded-xl space-y-2 max-h-44 overflow-y-auto text-xs">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                Resumo dos Itens
              </span>
              {ticketSucesso.i.map((it, idx) => (
                <div key={idx} className="flex justify-between border-b border-neutral-700/50 pb-1.5 last:border-none">
                  <div>
                    <span className="font-bold text-white">{it.q}x</span> Item ({it.id})
                    {it.m && it.m.length > 0 && (
                      <p className="text-rose-400 text-[11px] font-semibold">
                        {it.m.map(([g, o]) => `${g}: ${o}`).join(", ")}
                      </p>
                    )}
                    {it.o && <p className="text-amber-400 text-[10px] italic">Obs: {it.o}</p>}
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={handleConfirmarInjecao}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30"
            >
              Injetar Pedido no Sistema
            </Button>
          </div>
        ) : (
          /* SCANNER ATIVO */
          <div className="space-y-4">
            <p className="text-xs text-neutral-400 leading-relaxed">
              Aponte a câmera para a tela do celular do cliente para resgatar o pedido feito em modo offline.
            </p>

            <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-2 border-dashed border-neutral-700 flex items-center justify-center">
              <div id={leitorId} className="w-full h-full" />
              {iniciando && (
                <div className="absolute inset-0 bg-neutral-950/80 flex flex-col items-center justify-center text-xs text-neutral-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
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
