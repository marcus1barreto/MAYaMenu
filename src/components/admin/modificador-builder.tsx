"use client";

import React, { useState } from "react";
import { Plus, Trash2, Settings2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { GrupoModificador } from "@/types";
import { normalizarGrupoModificador } from "@/lib/modificadores";

type OpcaoModificador = GrupoModificador["opcoes"][number];

interface ModificadorBuilderProps {
  grupos: GrupoModificador[];
  onChange: (grupos: GrupoModificador[]) => void;
}

export function ModificadorBuilder({ grupos, onChange }: ModificadorBuilderProps) {
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);

  // Estado para um novo grupo (ou grupo sendo editado)
  const [grupoAtual, setGrupoAtual] = useState<GrupoModificador>({
    id: `grp-${Date.now()}`,
    nome: "",
    obrigatorio: false,
    minimo: 0,
    maximo: 1,
    opcoes: [],
  });

  const handleAdicionarGrupo = () => {
    setEditandoIndex(grupos.length);
    setGrupoAtual({
      id: `grp-${Date.now()}`,
      nome: "",
      obrigatorio: false,
      minimo: 0,
      maximo: 1,
      opcoes: [{ id: `opt-${Date.now()}`, nome: "", precoAdicional: 0 }],
    });
  };

  const handleSalvarGrupo = () => {
    if (!grupoAtual.nome.trim() || grupoAtual.opcoes.length === 0) {
      alert("O grupo precisa ter um nome e pelo menos uma opção.");
      return;
    }

    const grupoValidado: GrupoModificador = normalizarGrupoModificador(grupoAtual);

    const novaLista = [...grupos];
    if (editandoIndex !== null && editandoIndex < novaLista.length) {
      novaLista[editandoIndex] = grupoValidado;
    } else {
      novaLista.push(grupoValidado);
    }

    onChange(novaLista);
    setEditandoIndex(null);
  };

  const removerGrupo = (index: number) => {
    const novaLista = [...grupos];
    novaLista.splice(index, 1);
    onChange(novaLista);
  };

  const adicionarOpcao = () => {
    setGrupoAtual((prev) => ({
      ...prev,
      opcoes: [...prev.opcoes, { id: `opt-${Date.now()}`, nome: "", precoAdicional: 0 }],
    }));
  };

  const atualizarOpcao = (optIndex: number, campo: keyof OpcaoModificador, valor: any) => {
    setGrupoAtual((prev) => {
      const novasOpcoes = [...prev.opcoes];
      novasOpcoes[optIndex] = { ...novasOpcoes[optIndex], [campo]: valor };
      return { ...prev, opcoes: novasOpcoes };
    });
  };

  const removerOpcao = (optIndex: number) => {
    setGrupoAtual((prev) => {
      const novasOpcoes = [...prev.opcoes];
      novasOpcoes.splice(optIndex, 1);
      return { ...prev, opcoes: novasOpcoes };
    });
  };

  // MODO VISUALIZAÇÃO: Lista os grupos já criados
  if (editandoIndex === null) {
    return (
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            Complementos e Variações
          </span>
          <span className="text-[10px] text-muted-foreground font-normal">
            (Ponto, Adicionais, Retiradas)
          </span>
        </label>

        {grupos.length > 0 && (
          <div className="space-y-2">
            {grupos.map((grp, idx) => (
              <div
                key={grp.id || idx}
                className="p-3 bg-card border border-border rounded-xl flex items-center justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{grp.nome}</h4>
                    {grp.obrigatorio && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {grp.opcoes.length} opções • Mín: {grp.minimo} / Máx: {grp.maximo}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGrupoAtual(grp);
                      setEditandoIndex(idx);
                    }}
                    className="text-xs text-primary hover:underline font-bold"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removerGrupo(idx)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleAdicionarGrupo}
          className="w-full h-10 border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary hover:bg-muted/40 rounded-xl text-xs font-bold"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Adicionar Grupo de Opções
        </Button>
      </div>
    );
  }

  // MODO EDIÇÃO: Construtor do Grupo
  return (
    <div className="p-4 bg-card border border-border rounded-2xl space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-primary" />
          {editandoIndex < grupos.length ? "Editar Grupo" : "Novo Grupo de Opções"}
        </h4>
        <button
          type="button"
          onClick={() => setEditandoIndex(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome do Grupo</label>
          <Input
            placeholder="Ex: Qual o ponto da carne?"
            value={grupoAtual.nome}
            onChange={(e) => setGrupoAtual({ ...grupoAtual, nome: e.target.value })}
            className="h-9 bg-background border-input text-foreground text-xs"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Mín. Escolhas</label>
            <Input
              type="number"
              min="0"
              value={grupoAtual.minimo}
              onChange={(e) =>
                setGrupoAtual({ ...grupoAtual, minimo: Math.max(0, parseInt(e.target.value) || 0) })
              }
              className="h-9 bg-background border-input text-foreground text-xs"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Máx. Escolhas</label>
            <Input
              type="number"
              min="1"
              value={grupoAtual.maximo}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                setGrupoAtual({ ...grupoAtual, maximo: val });
              }}
              className="h-9 bg-background border-input text-foreground text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-2.5 bg-muted/30 border border-border rounded-xl">
          <div>
            <span className="text-xs font-bold text-foreground block">Obrigatório?</span>
            <span className="text-[9px] text-muted-foreground">O cliente não avança sem escolher.</span>
          </div>
          <Switch
            checked={grupoAtual.obrigatorio}
            onCheckedChange={(val) => {
              setGrupoAtual((prev) => ({
                ...prev,
                obrigatorio: val,
                minimo: val && prev.minimo === 0 ? 1 : prev.minimo,
              }));
            }}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Opções do Grupo</label>

        {grupoAtual.opcoes.map((opt, oIdx) => (
          <div key={opt.id || oIdx} className="flex items-center gap-2">
            <Input
              placeholder="Ex: Ao Ponto"
              value={opt.nome}
              onChange={(e) => atualizarOpcao(oIdx, "nome", e.target.value)}
              className="flex-1 h-9 bg-background border-input text-foreground text-xs"
            />
            <div className="relative w-24">
              <span className="absolute left-2 top-2.5 text-xs text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={opt.precoAdicional}
                onChange={(e) => atualizarOpcao(oIdx, "precoAdicional", parseFloat(e.target.value) || 0)}
                className="w-full h-9 pl-7 pr-2 bg-background border-input text-foreground text-xs font-mono"
              />
            </div>
            <button
              type="button"
              onClick={() => removerOpcao(oIdx)}
              className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <Button
          type="button"
          variant="ghost"
          onClick={adicionarOpcao}
          className="h-8 text-[10px] font-bold text-primary hover:bg-primary/10 w-full"
        >
          <Plus className="w-3 h-3 mr-1" />
          Nova Opção
        </Button>
      </div>

      <Button
        type="button"
        onClick={handleSalvarGrupo}
        className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs mt-4"
      >
        <CheckCircle2 className="w-4 h-4" />
        Pronto, Salvar Grupo
      </Button>
    </div>
  );
}
