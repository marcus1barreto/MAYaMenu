"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  Lock,
  Sparkles,
  DollarSign,
  Tag,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import { salvarItemCatalogoMaster, removerItemCatalogoMaster } from "@/lib/b2b-service";
import type { ItemCatalogoPatrocinador } from "@/types/b2b";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface B2BCatalogoViewProps {
  patrocinadorId: string;
  itens: ItemCatalogoPatrocinador[];
}

export function B2BCatalogoView({ patrocinadorId, itens }: B2BCatalogoViewProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Chopps & Cervejas");
  const [descricao, setDescricao] = useState("");
  const [precoSugerido, setPrecoSugerido] = useState(20.0);
  const [fotoUrl, setFotoUrl] = useState("/images/demo/coquetel.webp");
  const [selo, setSelo] = useState("Parceiro Oficial");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [posicaoTopo, setPosicaoTopo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const handleSalvarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSalvando(true);
    try {
      await salvarItemCatalogoMaster(patrocinadorId, {
        nome: nome.trim(),
        categoriaSugerida: categoria.trim(),
        descricaoOficial: descricao.trim(),
        precoSugerido: Number(precoSugerido) || 0,
        fotoOficialUrl: fotoUrl.trim(),
        seloPatrocinador: selo.trim() || "Parceiro Oficial",
        obrigatorioNoCardapio: obrigatorio,
        posicaoFixaTopo: posicaoTopo,
      });

      setNome("");
      setDescricao("");
      setModalAberto(false);
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar item no catálogo.");
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (id: string, nomeItem: string) => {
    if (!confirm(`Deseja remover "${nomeItem}" do catálogo master?`)) return;
    try {
      await removerItemCatalogoMaster(patrocinadorId, id);
    } catch (err: any) {
      alert(err?.message || "Falha ao remover item.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-neutral-950 tracking-tight flex items-center gap-2">
            <span>Catálogo Master de Produtos da Marca</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
              {itens.length} produtos oficiais
            </span>
          </h3>
          <p className="text-xs text-neutral-500">
            Estes produtos são injetados automaticamente nos cardápios digitais dos restaurantes parceiros ao utilizarem seus vouchers.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setModalAberto(true)}
          className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Produto Oficial</span>
        </Button>
      </div>

      {itens.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-neutral-800">Nenhum produto oficial no catálogo</h4>
          <p className="text-xs text-neutral-500 max-w-sm mt-1">
            Cadastre os itens que sua marca fornece para que eles constem com destaque nos estabelecimentos parceiros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {itens.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs flex flex-col justify-between gap-4 hover:border-neutral-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      {item.seloPatrocinador || "Parceiro Oficial"}
                    </span>
                    {item.obrigatorioNoCardapio && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-neutral-500" />
                        Obrigatório
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemover(item.id, item.nome)}
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Remover produto do catálogo master"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-200/80 shadow-2xs">
                    <img
                      src={item.fotoOficialUrl || "/images/demo/coquetel.webp"}
                      alt={item.nome}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/demo/coquetel.webp";
                      }}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      {item.categoriaSugerida}
                    </span>
                    <h4 className="text-sm font-black text-neutral-950 leading-tight">
                      {item.nome}
                    </h4>
                    <span className="text-xs font-bold text-rose-600 mt-1 block">
                      Sugerido: {item.precoSugerido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-neutral-500 mt-3 line-clamp-2 leading-relaxed">
                  {item.descricaoOficial}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                <span className="font-semibold text-neutral-600">{item.posicaoFixaTopo ? "★ Fixado no Topo" : "Posição Dinâmica"}</span>
                <span className="font-mono text-[10px] text-neutral-400 truncate max-w-[120px]">{item.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CADASTRO DE ITEM NO CATÁLOGO */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="bg-white border-neutral-200 text-neutral-900 rounded-3xl max-w-md p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-neutral-950 flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-rose-600" />
              <span>Cadastrar Produto Oficial da Marca</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvarItem} className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Nome Oficial do Produto
              </label>
              <Input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Chopp Pilsen 500ml"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Categoria Sugerida
                </label>
                <Input
                  type="text"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex: Chopps & Cervejas"
                  required
                  className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Preço Sugerido (R$)
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={precoSugerido}
                  onChange={(e) => setPrecoSugerido(Number(e.target.value))}
                  required
                  className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Descrição Institucional / Notas Sensoriais
              </label>
              <Input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Puro malte filtrado, notas leves de cereais nobres..."
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                URL da Foto Oficial do Produto
              </label>
              <Input
                type="text"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                placeholder="/images/demo/coquetel.webp"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Selo Exibido no Cardápio
              </label>
              <Input
                type="text"
                value={selo}
                onChange={(e) => setSelo(e.target.value)}
                placeholder="Ex: Cervejaria Oficial, Parceiro Master"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
              />
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-2xl space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={obrigatorio}
                  onChange={(e) => setObrigatorio(e.target.checked)}
                  className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-neutral-700 font-semibold">
                  Obrigatório (o restaurante parceiro não pode deletar do cardápio)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={posicaoTopo}
                  onChange={(e) => setPosicaoTopo(e.target.checked)}
                  className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-neutral-700 font-semibold">
                  Fixar no Topo da Categoria no Cardápio Digital
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={salvando}
              className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-xs mt-2"
            >
              {salvando ? "Salvando Produto..." : "Adicionar ao Catálogo Master"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

