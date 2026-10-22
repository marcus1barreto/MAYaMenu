"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { decodeTicket, type TicketPayload } from "@/lib/ticket";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-white text-neutral-900 rounded-3xl border-2 border-neutral-200/90 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-neutral-100">
          <DialogTitle className="text-lg font-black text-neutral-950 flex items-center gap-2">
            <Camera className="w-5 h-5 text-rose-600" />
            <span>Leitor de Ticket Offline</span>
          </DialogTitle>
        </DialogHeader>

        {ticketSucesso ? (
          /* RESULTADO DA LEITURA */
          <div className="space-y-4 py-2 animate-in fade-in duration-300">
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200/90 flex items-start gap-3 text-neutral-950 shadow-xs">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <h4 className="text-sm font-black text-neutral-950">
                  {ticketSucesso.tot !== undefined ? "MAYa Sync-QR (Comanda-Espelho)" : "Ticket Válido Reconhecido!"}
                </h4>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Mesa <strong className="text-neutral-950 font-bold">{ticketSucesso.t}</strong> • Cliente:{" "}
                  <strong className="text-neutral-950 font-bold">{ticketSucesso.c.n}</strong>
                </p>
                {ticketSucesso.tot !== undefined ? (
                  <p className="text-sm font-black text-emerald-700 mt-1 font-mono">
                    Total a Cobrar: {ticketSucesso.tot.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                ) : (
                  <p className="text-[11px] text-neutral-500 font-semibold mt-0.5">
                    Itens no pedido: {ticketSucesso.i.reduce((acc, it) => acc + it.q, 0)}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl space-y-2 max-h-44 overflow-y-auto text-xs border-2 border-neutral-200/80">
              <span className="text-[10px] uppercase font-black text-neutral-600 block tracking-wider">
                Resumo dos Itens
              </span>
              {ticketSucesso.i.map((it, idx) => (
                <div key={idx} className="flex justify-between border-b border-neutral-200 pb-1.5 last:border-none">
                  <div>
                    <span className="font-bold text-neutral-950">{it.q}x</span> Item ({it.id})
                    {it.m && it.m.length > 0 && (
                      <p className="text-rose-600 text-[11px] font-semibold">
                        {it.m.map(([g, o]) => `${g}: ${o}`).join(", ")}
                      </p>
                    )}
                    {it.o && <p className="text-amber-700 text-[10px] italic">Obs: {it.o}</p>}
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={handleConfirmarInjecao}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-600/20"
            >
              {ticketSucesso.tot !== undefined
                ? `Receber & Sincronizar Mesa ${ticketSucesso.t}`
                : "Injetar Pedido no Sistema"}
            </Button>
          </div>
        ) : (
          /* SCANNER ATIVO */
          <div className="space-y-4 py-1">
            <p className="text-xs text-neutral-600 leading-relaxed">
              Aponte a câmera para a tela do celular do cliente para resgatar o pedido feito em modo offline.
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
