"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { decodeTicket, type TicketPayload } from "@/lib/ticket";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, DollarSign, Store, ShoppingBag } from "lucide-react";

interface AdminQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComandaConfirmada: (payload: {
    mesaNumero: number | string;
    clienteId: string;
    nomeCliente: string;
    total: number;
    ticket: TicketPayload;
  }) => Promise<void> | void;
}

export function AdminQrScannerModal({
  isOpen,
  onClose,
  onComandaConfirmada,
}: AdminQrScannerModalProps) {
  const [iniciando, setIniciando] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [ticketLido, setTicketLido] = useState<TicketPayload | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const leitorId = "admin-balcao-qr-reader";

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
      setTicketLido(null);
      setErroCamera(null);
      setConfirmando(false);
      return;
    }

    setIniciando(true);
    setErroCamera(null);
    setTicketLido(null);
    setConfirmando(false);

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
            const ticket = decodeTicket(decodedText);
            if (ticket) {
              setTicketLido(ticket);
              if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
              }
            } else {
              setErroCamera("Código lido não é um Ticket/Comanda Digital válido do MAYaMenu.");
            }
          },
          () => {}
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

  const totalCalculado =
    ticketLido?.tot !== undefined
      ? ticketLido.tot
      : ticketLido?.i.reduce((acc, it) => acc + it.q * 30, 0) || 0;

  const handleConfirmarBaixa = async () => {
    if (!ticketLido) return;
    setConfirmando(true);
    try {
      await onComandaConfirmada({
        mesaNumero: ticketLido.t,
        clienteId: ticketLido.c.id,
        nomeCliente: ticketLido.c.n,
        total: totalCalculado,
        ticket: ticketLido,
      });
      onClose();
    } catch (e) {
      console.error("Falha ao confirmar baixa da comanda:", e);
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-neutral-900 text-white rounded-3xl border border-neutral-800 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2">
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-400" />
            <span>Leitor de Comanda • Balcão / Caixa</span>
          </DialogTitle>
        </DialogHeader>

        {ticketLido ? (
          /* MODAL DE AÇÃO RÁPIDA: CONFIRMAR PAGAMENTO E ENTREGA */
          <div className="space-y-4 py-3 animate-in fade-in duration-300">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Comanda Digital Identificada!</h4>
                <p className="text-xs text-neutral-300 mt-1">
                  Mesa <strong className="text-white">{ticketLido.t}</strong> • Cliente:{" "}
                  <strong className="text-white">{ticketLido.c.n}</strong>
                </p>
                <div className="mt-2 p-2 bg-neutral-950/80 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <span className="text-xs text-neutral-400 font-bold">Total a Pagar / Baixar:</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {totalCalculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>
            </div>

            {/* LISTA RESUMIDA DOS ITENS */}
            <div className="p-3 bg-neutral-800/80 rounded-xl space-y-2 max-h-40 overflow-y-auto text-xs border border-neutral-700/50">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-neutral-400" />
                <span>Itens da Comanda ({ticketLido.i.reduce((acc, it) => acc + it.q, 0)})</span>
              </span>
              {ticketLido.i.map((it, idx) => (
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
              onClick={handleConfirmarBaixa}
              disabled={confirmando}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-950 flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>
                {confirmando
                  ? "Confirmando baixa..."
                  : `Confirmar Pagamento e Entrega da Mesa ${ticketLido.t} - Total ${totalCalculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
              </span>
            </Button>
          </div>
        ) : (
          /* SCANNER ATIVO */
          <div className="space-y-4">
            <p className="text-xs text-neutral-400 leading-relaxed">
              Aponte a câmera para a tela do celular do cliente com o <strong>MAYa Sync-QR</strong> para dar baixa instantânea e receber a comanda no balcão.
            </p>

            <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-2 border-dashed border-neutral-700 flex items-center justify-center">
              <div id={leitorId} className="w-full h-full" />
              {iniciando && (
                <div className="absolute inset-0 bg-neutral-950/80 flex flex-col items-center justify-center text-xs text-neutral-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Iniciando câmera do caixa...</span>
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
