"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { MenuItem } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Check } from "lucide-react";
import { useCart } from "@/context/cart-context";

interface ItemModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  corPrimaria?: string;
}

export function ItemModal({ item, isOpen, onClose, corPrimaria = "#E11D48" }: ItemModalProps) {
  const { adicionarItem } = useCart();
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState("");
  // Armazena as seleções de modificadores: { [grupoNome]: [opcaoNome, ...] }
  const [selecoesMod, setSelecoesMod] = useState<Record<string, string[]>>({});

  if (!item) return null;

  const grupos = item.grupoModificadores || [];

  const handleToggleOpcao = (grupoNome: string, opcaoNome: string, maxEscolhas: number) => {
    setSelecoesMod((prev) => {
      const atuais = prev[grupoNome] || [];
      const existe = atuais.includes(opcaoNome);

      if (maxEscolhas === 1) {
        return { ...prev, [grupoNome]: [opcaoNome] };
      }

      if (existe) {
        return { ...prev, [grupoNome]: atuais.filter((o) => o !== opcaoNome) };
      } else {
        if (atuais.length < maxEscolhas) {
          return { ...prev, [grupoNome]: [...atuais, opcaoNome] };
        }
        return prev;
      }
    });
  };

  // Cálculo de adicionais
  let totalAdicionais = 0;
  const modificadoresEscolhidos: { grupo: string; opcao: string; precoAdicional: number }[] = [];

  grupos.forEach((grupo) => {
    const escolhidos = selecoesMod[grupo.nome] || [];
    escolhidos.forEach((opNome) => {
      const found = grupo.opcoes.find((o) => o.nome === opNome);
      if (found) {
        totalAdicionais += found.precoAdicional;
        modificadoresEscolhidos.push({
          grupo: grupo.nome,
          opcao: found.nome,
          precoAdicional: found.precoAdicional,
        });
      }
    });
  });

  const precoUnitario = Math.max(0, item.precoBase + totalAdicionais);
  const precoTotal = precoUnitario * quantidade;

  // Validação de grupos obrigatórios
  const gruposObrigatoriosPendentes = grupos.filter((g) => {
    if (!g.obrigatorio) return false;
    const escolhidos = selecoesMod[g.nome] || [];
    return escolhidos.length === 0;
  });

  const podeAdicionar = gruposObrigatoriosPendentes.length === 0;

  const handleConfirmar = () => {
    if (!podeAdicionar) return;

    adicionarItem({
      menuItemId: item.id,
      nome: item.nome,
      precoFinal: precoUnitario,
      quantidade,
      modificadores: modificadoresEscolhidos,
      observacoes: observacoes.trim() || undefined,
      fotoUrl: item.fotoUrl,
      tempoPreparoEstimado: item.tempoPreparoEstimado,
    });

    // Reset e fecha
    setQuantidade(1);
    setObservacoes("");
    setSelecoesMod({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden max-h-[92dvh] flex flex-col rounded-2xl border-none shadow-2xl">
        {/* Foto do Prato */}
        {item.fotoUrl && (
          <div className="relative w-full h-56 bg-neutral-100 flex-shrink-0">
            <Image
              src={item.fotoUrl}
              alt={item.nome}
              fill
              priority
              sizes="(max-width: 640px) 100vw, 450px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
                Item Selecionado
              </span>
              <h2 className="text-xl font-bold leading-tight drop-shadow-sm">{item.nome}</h2>
            </div>
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {!item.fotoUrl && (
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-neutral-900">{item.nome}</DialogTitle>
            </DialogHeader>
          )}

          <p className="text-sm text-neutral-600 leading-relaxed">{item.descricao}</p>

          <div className="flex items-baseline justify-between py-2 border-y border-neutral-100">
            <span className="text-xs font-semibold uppercase text-neutral-400">Preço Base</span>
            <span className="text-xl font-bold text-neutral-900">
              {item.precoBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>

          {/* Grupos de Modificadores */}
          {grupos.map((grupo) => {
            const selecionados = selecoesMod[grupo.nome] || [];
            const maximoPermitido = grupo.maximo ?? grupo.maxEscolhas ?? 1;
            return (
              <div key={grupo.nome} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">{grupo.nome}</h3>
                    <p className="text-xs text-neutral-500">
                      {maximoPermitido === 1
                        ? "Escolha 1 opção"
                        : `Até ${maximoPermitido} opções`}
                    </p>
                  </div>
                  {grupo.obrigatorio && (
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                        selecionados.length > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selecionados.length > 0 ? "OK" : "Obrigatório"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {grupo.opcoes.map((opcao) => {
                    const ativo = selecionados.includes(opcao.nome);
                    return (
                      <button
                        key={opcao.nome}
                        type="button"
                        onClick={() => handleToggleOpcao(grupo.nome, opcao.nome, maximoPermitido)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                          ativo
                            ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                            : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              ativo
                                ? "bg-white text-neutral-900 border-white"
                                : "border-neutral-300 bg-white"
                            }`}
                          >
                            {ativo && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-sm font-medium">{opcao.nome}</span>
                        </div>
                        {opcao.precoAdicional !== 0 && (
                          <span
                            className={`text-xs font-semibold ${
                              ativo ? "text-neutral-200" : "text-neutral-600"
                            }`}
                          >
                            {opcao.precoAdicional > 0
                              ? `+ ${opcao.precoAdicional.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}`
                              : `- ${Math.abs(opcao.precoAdicional).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Observações */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Observações para a cozinha
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: sem cebola, molho à parte..."
              rows={2}
              maxLength={120}
              className="w-full text-sm p-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            />
          </div>
        </div>

        {/* Rodapé Fixo "Fat-finger friendly" */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center gap-3">
          {/* Seletor de quantidade */}
          <div className="flex items-center bg-white border border-neutral-300 rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              disabled={quantidade <= 1}
              className="w-10 h-10 flex items-center justify-center text-neutral-600 disabled:opacity-30 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold text-sm text-neutral-900">{quantidade}</span>
            <button
              type="button"
              onClick={() => setQuantidade((q) => q + 1)}
              className="w-10 h-10 flex items-center justify-center text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Botão de adicionar */}
          <Button
            type="button"
            disabled={!podeAdicionar}
            onClick={handleConfirmar}
            style={{ backgroundColor: podeAdicionar ? corPrimaria : undefined }}
            className="flex-1 h-12 text-base font-bold shadow-md rounded-xl active:scale-[0.98] transition-transform text-white"
          >
            Adicionar •{" "}
            {precoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
