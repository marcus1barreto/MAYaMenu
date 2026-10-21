"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { X, Check, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MenuItem } from "@/types";
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

  // Estado para armazenar as seleções do cliente:
  // Estrutura: { [nomeDoGrupo]: [nomeDaOpcao1, nomeDaOpcao2] }
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});

  // Reseta os estados toda vez que o modal abre com um novo item
  useEffect(() => {
    if (isOpen && item) {
      setQuantidade(1);
      setObservacoes("");

      // Auto-selecionar opções obrigatórias se o grupo tiver apenas 1 opção e max for 1
      const selecoesIniciais: Record<string, string[]> = {};
      if (item.grupoModificadores) {
        item.grupoModificadores.forEach((grupo) => {
          if (grupo.obrigatorio && grupo.maximo === 1 && grupo.opcoes.length === 1) {
            selecoesIniciais[grupo.nome] = [grupo.opcoes[0].nome];
          } else {
            selecoesIniciais[grupo.nome] = [];
          }
        });
      }
      setSelecoes(selecoesIniciais);
    }
  }, [isOpen, item]);

  // Cálculo Dinâmico do Preço Final
  const precoCalculado = useMemo(() => {
    if (!item) return 0;
    let totalAdicionais = 0;

    if (item.grupoModificadores) {
      item.grupoModificadores.forEach((grupo) => {
        const opcoesSelecionadas = selecoes[grupo.nome] || [];
        opcoesSelecionadas.forEach((nomeOpcao) => {
          const opt = grupo.opcoes.find((o) => o.nome === nomeOpcao);
          if (opt) {
            totalAdicionais += opt.precoAdicional;
          }
        });
      });
    }

    return (item.precoBase + totalAdicionais) * quantidade;
  }, [item, selecoes, quantidade]);

  // Validação: O cliente pode adicionar ao carrinho?
  const podeAdicionar = useMemo(() => {
    if (!item || !item.grupoModificadores) return true;

    // Verifica se todos os grupos atingiram o "mínimo" exigido
    for (const grupo of item.grupoModificadores) {
      const qtdSelecionada = (selecoes[grupo.nome] || []).length;
      if (qtdSelecionada < grupo.minimo) {
        return false;
      }
    }
    return true;
  }, [item, selecoes]);

  // Função para lidar com cliques nas opções (Radio ou Checkbox)
  const handleToggleOpcao = (grupoNome: string, opcaoNome: string, maximo: number) => {
    setSelecoes((prev) => {
      const atuais = prev[grupoNome] || [];

      // Se já estava selecionado, remove
      if (atuais.includes(opcaoNome)) {
        return { ...prev, [grupoNome]: atuais.filter((o) => o !== opcaoNome) };
      }

      // Se não estava selecionado, precisamos adicionar.
      // Se o limite é 1, ele se comporta como "Radio Button" (substitui a anterior)
      if (maximo === 1) {
        return { ...prev, [grupoNome]: [opcaoNome] };
      }

      // Se o limite for maior que 1, adiciona se ainda não estourou o limite
      if (atuais.length < maximo) {
        return { ...prev, [grupoNome]: [...atuais, opcaoNome] };
      }

      // Se já estourou o limite máximo, ignora o clique
      return prev;
    });
  };

  const handleAdicionarAoCarrinho = () => {
    if (!item || !podeAdicionar) return;

    // Formatar os modificadores escolhidos para o Carrinho
    const modificadoresFormatados: { grupo: string; opcao: string; precoAdicional: number }[] = [];
    Object.entries(selecoes).forEach(([grupoNome, opcoes]) => {
      const grupo = item.grupoModificadores?.find((g) => g.nome === grupoNome);
      opcoes.forEach((opcaoNome) => {
        const opt = grupo?.opcoes?.find((o) => o.nome === opcaoNome);
        modificadoresFormatados.push({
          grupo: grupoNome,
          opcao: opcaoNome,
          precoAdicional: opt?.precoAdicional ?? 0,
        });
      });
    });

    // Calcula o valor unitário final (Base + Adicionais)
    const valorUnitarioFinal = precoCalculado / quantidade;

    adicionarItem({
      menuItemId: item.id,
      nome: item.nome,
      precoFinal: valorUnitarioFinal,
      quantidade: quantidade,
      observacoes: observacoes.trim(),
      modificadores: modificadoresFormatados,
      fotoUrl: item.fotoUrl,
      tempoPreparoEstimado: item.tempoPreparoEstimado,
    });

    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Ocultando o botão X nativo porque fizemos um customizado */}
      <DialogContent className="max-w-md w-full bg-white border-none p-0 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl h-[95dvh] sm:h-auto sm:max-h-[90vh] flex flex-col [&>button]:hidden">
        {/* BOTÃO DE FECHAR CUSTOMIZADO FLUTUANTE */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ÁREA COM SCROLL (Foto + Detalhes + Modificadores) */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Foto Destaque */}
          {item.fotoUrl && (
            <div className="relative w-full h-64 sm:h-72 bg-neutral-100 shrink-0">
              <Image
                src={item.fotoUrl}
                alt={item.nome}
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}

          {/* Cabeçalho do Prato */}
          <div className="p-5 sm:p-6 bg-white relative -mt-6 rounded-t-3xl z-10">
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-tight">
              {item.nome}
            </h2>
            <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
              {item.descricao}
            </p>
            <div className="mt-4 font-black text-xl text-neutral-900">
              {item.precoBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>

          {/* SEÇÃO DE MODIFICADORES (Ponto, Adicionais, etc) */}
          {item.grupoModificadores && item.grupoModificadores.length > 0 && (
            <div className="bg-neutral-50 pb-6">
              {item.grupoModificadores.map((grupo, gIdx) => {
                const minVal = grupo.minimo;
                const maxVal = grupo.maximo;
                const qtdSelecionada = (selecoes[grupo.nome] || []).length;
                const faltaMinimo = qtdSelecionada < minVal;
                const atingiuMaximo = qtdSelecionada >= maxVal;

                return (
                  <div key={grupo.id || gIdx} className="border-t border-neutral-200 bg-white">
                    {/* Cabeçalho do Grupo */}
                    <div className="p-5 bg-neutral-100/50 flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-neutral-900">{grupo.nome}</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {minVal === 1 && maxVal === 1
                            ? "Escolha 1 opção"
                            : minVal > 0
                            ? `Escolha de ${minVal} até ${maxVal} opções`
                            : `Escolha até ${maxVal} opções`}
                        </p>
                      </div>

                      {/* Badge de Obrigatório / Feito */}
                      {grupo.obrigatorio && (
                        <div
                          className={`px-2 py-1 text-[10px] font-black uppercase rounded-md ${
                            faltaMinimo ? "bg-neutral-800 text-white" : "bg-emerald-500 text-white"
                          }`}
                        >
                          {faltaMinimo ? "Obrigatório" : "OK"}
                        </div>
                      )}
                    </div>

                    {/* Lista de Opções */}
                    <div className="divide-y divide-neutral-100">
                      {grupo.opcoes.map((opt, oIdx) => {
                        const selecionado = (selecoes[grupo.nome] || []).includes(opt.nome);
                        // Desabilitar opções não selecionadas se já atingiu o máximo (mas permitir desmarcar as ativas)
                        const disabled = !selecionado && atingiuMaximo && maxVal > 1;

                        return (
                          <label
                            key={opt.id || oIdx}
                            className={`flex items-center justify-between p-5 transition-colors cursor-pointer ${
                              disabled ? "opacity-40" : "hover:bg-neutral-50"
                            }`}
                          >
                            <div className="flex-1">
                              <span className="font-semibold text-sm text-neutral-900 block">
                                {opt.nome}
                              </span>
                              {opt.precoAdicional > 0 && (
                                <span className="text-xs font-bold text-neutral-500 mt-0.5 block">
                                  + {opt.precoAdicional.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </span>
                              )}
                            </div>

                            {/* Interface Visual: Radio (max=1) ou Checkbox (max>1) */}
                            <div className="shrink-0 ml-4">
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={selecionado}
                                disabled={disabled}
                                onChange={() => handleToggleOpcao(grupo.nome, opt.nome, maxVal)}
                              />
                              <div
                                className={`flex items-center justify-center border-2 transition-all ${
                                  maxVal === 1 ? "rounded-full w-5 h-5" : "rounded-md w-5 h-5"
                                } ${
                                  selecionado
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-neutral-300 bg-white"
                                }`}
                              >
                                {selecionado && <Check className="w-3.5 h-3.5 text-white" />}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Observações da Cozinha */}
          <div className="p-5 border-t border-neutral-200 bg-white">
            <label className="font-bold text-sm text-neutral-900 block mb-2">
              Alguma observação?
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Tirar cebola, maionese à parte..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full bg-neutral-100 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            />
          </div>
        </div>

        {/* RODAPÉ FIXO (Controles de Quantidade e Adicionar ao Carrinho) */}
        <div className="p-4 sm:p-5 bg-white border-t border-neutral-200 shrink-0 flex items-center gap-3">
          {/* Controle de Quantidade */}
          <div className="flex items-center justify-between bg-neutral-100 rounded-xl p-1 h-14 w-32 border border-neutral-200">
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="font-black text-lg text-neutral-900 w-8 text-center">{quantidade}</span>
            <button
              type="button"
              onClick={() => setQuantidade((q) => q + 1)}
              className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Botão de Adicionar */}
          <Button
            type="button"
            disabled={!podeAdicionar}
            onClick={handleAdicionarAoCarrinho}
            style={{ backgroundColor: podeAdicionar ? corPrimaria : undefined }}
            className={`flex-1 h-14 rounded-xl flex items-center justify-between px-4 transition-all shadow-lg active:scale-[0.98] ${
              !podeAdicionar ? "bg-neutral-200 text-neutral-400" : "text-white"
            }`}
          >
            <span className="font-bold text-sm">
              {podeAdicionar ? "Adicionar" : "Escolha o que falta"}
            </span>
            <span className="font-black text-lg">
              {precoCalculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
