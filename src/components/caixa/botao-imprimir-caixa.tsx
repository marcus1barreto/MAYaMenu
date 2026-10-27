"use client";

import React, { useState, useEffect } from "react";
import { EscPosBuilder } from "@/lib/esc-pos";
import {
  despacharParaImpressoraSerial,
  obterImpressoraSalva,
  esquecerImpressoraUSB,
} from "@/lib/web-serial";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Check, RefreshCw } from "lucide-react";
import type { ComandaGarcom, ItemComandaGarcom, MesaOperacional } from "@/components/garcom/garcom-view";

export interface BotaoImprimirCaixaProps {
  comanda?: ComandaGarcom;
  mesa?: MesaOperacional;
  itens?: ItemComandaGarcom[];
  mesaNumero?: number | string;
  nomeCliente?: string;
  subtotal?: number;
  taxaServico?: number;
  total?: number;
  nomeRestaurante?: string;
  pixPayload?: string;
  baudRate?: number;
  larguraColunas?: number; // 32 para 58mm, 42 ou 48 para 80mm
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function BotaoImprimirCaixa({
  comanda,
  mesa,
  itens: itensProp,
  mesaNumero: mesaNumeroProp,
  nomeCliente: nomeClienteProp,
  subtotal: subtotalProp,
  taxaServico: taxaServicoProp,
  total: totalProp,
  nomeRestaurante = "MAYaMenu",
  pixPayload,
  baudRate = 9600,
  larguraColunas = 32,
  variant = "outline",
  size = "sm",
  className,
  label,
}: BotaoImprimirCaixaProps) {
  const [imprimindo, setImprimindo] = useState(false);
  const [impressoComSucesso, setImpressoComSucesso] = useState(false);
  const [portaMemorizada, setPortaMemorizada] = useState(false);

  // Verifica se já existe autorização prévia sem precisar de clique no modal
  useEffect(() => {
    if (typeof window !== "undefined" && "serial" in navigator) {
      const serial = (navigator as any).serial;
      serial
        .getPorts?.()
        .then((ports: any[]) => {
          if (ports && ports.length > 0) {
            setPortaMemorizada(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Consolidação de dados a partir da comanda ou da mesa completa
  const numMesa = mesaNumeroProp ?? (mesa?.numero ? `Mesa ${mesa.numero}` : comanda ? "Mesa" : "Balcão");
  const cliente = nomeClienteProp ?? (comanda?.nomeCliente || (mesa ? "Mesa Geral" : "Cliente"));

  const itensParaImprimir: ItemComandaGarcom[] =
    itensProp ||
    comanda?.itens ||
    (mesa ? mesa.comandas.flatMap((c) => c.itens) : []);

  const subtotalCalculado =
    subtotalProp ??
    comanda?.subtotal ??
    (mesa ? mesa.comandas.reduce((acc, c) => acc + c.subtotal, 0) : 0);

  const taxaCalculada = taxaServicoProp ?? 0;
  const totalCalculado = totalProp ?? (subtotalCalculado + taxaCalculada);

  async function handleImprimir(forcarSelecao: boolean = false) {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      alert(
        "A Web Serial API não está disponível neste navegador.\n\n" +
        "Para imprimir diretamente em impressoras térmicas USB sem drivers spooler, " +
        "utilize o Google Chrome, Microsoft Edge ou Opera em ambiente seguro (HTTPS ou localhost)."
      );
      return;
    }

    try {
      setImprimindo(true);

      // 1. Montagem do Cupom Térmico Não-Fiscal (Normalização ASCII automática contra mojibake)
      const builder = new EscPosBuilder();
      builder.init();
      builder.align("center").bold(true).size("double-height").textLine(nomeRestaurante).size("normal").bold(false);
      builder.textLine("CUPOM DE CONFERENCIA");
      builder.textLine("(NAO FISCAL)");
      builder.feed(1);

      // Data e Hora de Emissão
      const agora = new Date();
      const dataFormatada = agora.toLocaleDateString("pt-BR");
      const horaFormatada = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      builder.align("center").textLine(`${dataFormatada} - ${horaFormatada}`);
      builder.divider("-", larguraColunas);

      // Identificação da Mesa e Cliente
      builder.align("left");
      builder.textLine(`${numMesa} | ${cliente}`);
      builder.divider("-", larguraColunas);

      // Relação de Itens Consumidos
      if (itensParaImprimir.length === 0) {
        builder.textLine("Nenhum item discriminado");
      } else {
        itensParaImprimir.forEach((it) => {
          const valorLinha = (it.precoFinal * (it.quantidade || 1)).toFixed(2);
          const descItem = `${it.quantidade}x ${it.nome}`;
          builder.line(descItem, `R$ ${valorLinha}`, larguraColunas);

          // Modificadores / Opcionais do item
          if (it.modificadores && it.modificadores.length > 0) {
            it.modificadores.forEach((m) => {
              builder.textLine(`  + ${m.opcao}`);
            });
          }
        });
      }

      builder.divider("-", larguraColunas);

      // Totais e Taxa de Serviço
      if (taxaCalculada > 0) {
        builder.line("Subtotal:", `R$ ${subtotalCalculado.toFixed(2)}`, larguraColunas);
        builder.line("Taxa de Servico:", `R$ ${taxaCalculada.toFixed(2)}`, larguraColunas);
      }

      builder.bold(true).size("double-height");
      builder.line("TOTAL:", `R$ ${totalCalculado.toFixed(2)}`, larguraColunas);
      builder.size("normal").bold(false);

      // Bloco Informativo de Pix com QR Code Nativo ESC/POS
      const payloadFinalPix = pixPayload || (comanda as any)?.pixPayload;
      if (payloadFinalPix) {
        builder.feed(1);
        builder.align("center").bold(true).textLine("PAGAMENTO VIA PIX").bold(false);
        builder.textLine("Escaneie o QR Code pelo app do seu banco");
        builder.feed(1);

        // Injeta o QR Code gerado pelo motor (Pix EMVCo Homologado)
        builder.qrCode(payloadFinalPix, 6).feed(2);
      } else if (comanda && comanda.metodoPagamento === "pix") {
        builder.feed(1);
        builder.align("center").bold(true).textLine("PAGAMENTO VIA PIX").bold(false);
        builder.textLine("Chave / QR Code no Balcao ou App");
        builder.feed(1);
      }

      // Rodapé institucional
      builder.feed(1);
      builder.align("center").textLine("MAYaMenu • Sistema Inteligente");
      builder.feed(3);

      // Corte de papel (parcial padronizado)
      builder.cut();

      // 2. Despacho direto usando auto-reconexão ou modal se for a primeira vez
      const resultado = await despacharParaImpressoraSerial(builder.build(), {
        baudRate,
        forcarSelecao,
      });

      if (resultado.sucesso) {
        setPortaMemorizada(true);
        setImpressoComSucesso(true);
        setTimeout(() => setImpressoComSucesso(false), 3000);
      }
    } catch (error: any) {
      if (error?.name === "NotFoundError" || error?.message?.includes("No port selected")) {
        console.log("Seleção de impressora USB cancelada pelo operador.");
      } else {
        console.error("Falha ao comunicar com a impressora térmica via Web Serial:", error);
        alert(`Erro na impressão térmica USB: ${error?.message || error}`);
      }
    } finally {
      setImprimindo(false);
    }
  }

  const textoBotao =
    label ??
    (impressoComSucesso
      ? "Cupom Enviado!"
      : imprimindo
      ? "Enviando para USB..."
      : portaMemorizada
      ? "Imprimir Conta (USB Direto)"
      : "Imprimir Conta (USB)");

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant={impressoComSucesso ? "default" : variant}
        size={size}
        onClick={() => handleImprimir(false)}
        disabled={imprimindo}
        title={portaMemorizada ? "Impressora USB memorizada (Disparo em 1 clique sem modal)" : "Selecionar impressora USB"}
        className={`font-bold transition-all shadow-xs relative ${className || ""}`}
      >
        {imprimindo ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        ) : impressoComSucesso ? (
          <Check className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
        ) : (
          <div className="relative mr-1.5">
            <Printer className="w-3.5 h-3.5 text-primary" />
            {portaMemorizada && (
              <span
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-background animate-pulse"
                title="Porta USB Pareada"
              />
            )}
          </div>
        )}
        <span>{textoBotao}</span>
      </Button>

      {/* Botão de Troca / Re-pareamento de Hardware (só exibido se já estiver memorizado) */}
      {portaMemorizada && !imprimindo && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleImprimir(true)}
          title="Trocar ou reconectar outra impressora USB"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
