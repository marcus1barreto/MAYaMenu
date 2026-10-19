"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, Utensils, Camera, ArrowRight, ArrowLeft, Check, Upload, Store, PartyPopper, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAYA_MEDIA_LIBRARY } from "@/lib/maya-media-library";
import { uploadFotoPrato } from "@/lib/storage-service";
import { salvarItemCardapio } from "@/lib/restaurante-service";
import type { MenuItem } from "@/types";

interface GuidedEmptyCardapioProps {
  restauranteId: string;
  onItemCriado: () => void;
}

const CATEGORIAS_SUGERIDAS = [
  { nome: "Lanches", emoji: "🍔", exemplo: "Burger Artesanal da Casa" },
  { nome: "Pizzas", emoji: "🍕", exemplo: "Pizza Especial de Fermentação Natural" },
  { nome: "Bebidas", emoji: "🍺", exemplo: "Chopp Artesanal ou Drink Especial" },
  { nome: "Porções", emoji: "🍟", exemplo: "Batatas Rústicas com Ervas e Queijo" },
  { nome: "Sobremesas", emoji: "🍦", exemplo: "Gelato Italiano Cremoso" },
];

export function GuidedEmptyCardapio({
  restauranteId,
  onItemCriado,
}: GuidedEmptyCardapioProps) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [categoria, setCategoria] = useState<string>("Lanches");
  const [nomePrato, setNomePrato] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [preco, setPreco] = useState<string>("35,00");
  const [fotoUrl, setFotoUrl] = useState<string>("/images/demo/hamburger.webp");
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const handleSelectCategoria = (catNome: string) => {
    setCategoria(catNome);
    // Atualiza sugestão de foto padrão da galeria conforme categoria
    const fotoSugerida = MAYA_MEDIA_LIBRARY.find((f) => f.categoria === catNome);
    if (fotoSugerida && !uploadPreview) {
      setFotoUrl(fotoSugerida.url);
    }
    const catObj = CATEGORIAS_SUGERIDAS.find((c) => c.nome === catNome);
    if (catObj && !nomePrato) {
      setNomePrato(catObj.exemplo);
    }
    setPasso(2);
  };

  const handleFotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoUpload(file);
    const url = URL.createObjectURL(file);
    setUploadPreview(url);
    setFotoUrl(url);
  };

  const handleConcluirPrimeiroPrato = async () => {
    if (!nomePrato.trim()) return;

    setSalvando(true);
    try {
      let finalFotoUrl = fotoUrl;

      // Se enviou arquivo local para upload
      if (arquivoUpload) {
        try {
          finalFotoUrl = await uploadFotoPrato(restauranteId, arquivoUpload);
        } catch (err) {
          console.warn("Upload de foto no storage falhou, mantendo fallback de imagem:", err);
          finalFotoUrl = "/images/demo/hamburger.webp";
        }
      }

      // Preço formatado
      const precoLimpo = parseFloat(preco.replace(",", ".")) || 35;

      const primeiroItem: MenuItem = {
        id: `item-1-${Date.now().toString(36)}`,
        nome: nomePrato.trim(),
        categoria: categoria || "Lanches",
        descricao: descricao.trim() || "Receita exclusiva preparada com ingredientes frescos da mais alta qualidade.",
        precoBase: precoLimpo,
        fotoUrl: finalFotoUrl,
        ativo: true,
        ordem: 0, // Primeiro prato no topo
      };

      await salvarItemCardapio(restauranteId, primeiroItem);
      setSucesso(true);

      setTimeout(() => {
        onItemCriado();
      }, 1500);
    } catch (err) {
      console.error("Erro ao criar 1º item:", err);
      alert("Houve um problema ao salvar seu prato. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  if (sucesso) {
    return (
      <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-emerald-950">
          <PartyPopper className="w-10 h-10 animate-bounce" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          🎉 Parabéns! Seu 1º Prato Está no Ar!
        </h2>
        <p className="text-sm text-neutral-300 max-w-md mx-auto mt-2 leading-relaxed">
          Seu cardápio digital acaba de ganhar vida. Redirecionando para o painel de gestão completo...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Glow de ambientação */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER DO WIZARD */}
      <div className="text-center max-w-lg mx-auto mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Cardápio Inicial • Boas-Vindas</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Crie o 1º Prato do Seu Restaurante
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400">
          Vamos colocar seu cardápio no ar em menos de 1 minuto em 3 passos simples.
        </p>

        {/* PROGRESS BAR 3 PASSOS */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${passo >= 1 ? "w-10 bg-rose-500" : "w-6 bg-neutral-800"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${passo >= 2 ? "w-10 bg-rose-500" : "w-6 bg-neutral-800"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${passo >= 3 ? "w-10 bg-rose-500" : "w-6 bg-neutral-800"}`} />
        </div>
      </div>

      {/* PASSO 1: CATEGORIA */}
      {passo === 1 && (
        <div className="space-y-6 max-w-lg mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Passo 1 de 3</span>
            <h3 className="text-lg font-black text-white">Escolha a primeira categoria</h3>
            <p className="text-xs text-neutral-400">
              Selecione uma das opções mais vendidas abaixo ou digite um nome personalizado:
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {CATEGORIAS_SUGERIDAS.map((cat) => {
              const selecionada = categoria === cat.nome;
              return (
                <button
                  key={cat.nome}
                  type="button"
                  onClick={() => handleSelectCategoria(cat.nome)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                    selecionada
                      ? "bg-rose-600 text-white shadow-rose-600/20 scale-105 border border-rose-500"
                      : "bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700/80 hover:border-neutral-600 active:scale-95"
                  }`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span>{cat.nome}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <label className="text-xs font-bold text-neutral-300 block mb-1.5">
              Ou digite o nome de outra categoria:
            </label>
            <div className="flex gap-2">
              <Input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Pratos Executivos, Cafés Especiais..."
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl text-xs h-11"
              />
              <Button
                type="button"
                onClick={() => setPasso(2)}
                disabled={!categoria.trim()}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs px-5 h-11 shrink-0"
              >
                Avançar
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PASSO 2: FORMULÁRIO DO PRATO */}
      {passo === 2 && (
        <div className="space-y-5 max-w-lg mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Passo 2 de 3</span>
            <h3 className="text-lg font-black text-white">Qual delícia será ofertada?</h3>
            <p className="text-xs text-neutral-400">
              Na categoria: <strong className="text-rose-400">{categoria}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Nome do Prato *
              </label>
              <Input
                value={nomePrato}
                onChange={(e) => setNomePrato(e.target.value)}
                placeholder="Ex: Smash Burger Duplo Bacon"
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl text-sm h-11"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Descrição Curta (Destaque os ingredientes)
              </label>
              <textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: 2 blends de 100g smash, queijo prato derretido, farofa de bacon e maionese defumada no pão brioche."
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Preço de Venda (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                  R$
                </span>
                <Input
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="34,90"
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl text-sm pl-10 h-11 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPasso(1)}
              className="text-neutral-400 hover:text-white rounded-xl text-xs gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Button>
            <Button
              type="button"
              onClick={() => setPasso(3)}
              disabled={!nomePrato.trim()}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs px-6 h-11 flex items-center gap-2 shadow-lg"
            >
              <span>Próximo: Foto & Imagem</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 3: FOTO (GALERIA MAYA OU UPLOAD) */}
      {passo === 3 && (
        <div className="space-y-6 max-w-lg mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Passo 3 de 3</span>
            <h3 className="text-lg font-black text-white">Dê água na boca do seu cliente</h3>
            <p className="text-xs text-neutral-400">
              Envie uma foto real ou escolha uma opção profissional da nossa <strong>Galeria MAYa</strong>:
            </p>
          </div>

          {/* PREVIEW DA FOTO ATUAL */}
          <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-xl">
            <Image
              src={fotoUrl || "/images/demo/hamburger.webp"}
              alt="Prévia do prato"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-3">
              <div>
                <span className="text-xs font-bold text-white block">{nomePrato}</span>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">R$ {preco}</span>
              </div>
              <span className="text-[10px] bg-neutral-900/80 backdrop-blur-md px-2.5 py-1 rounded-full text-neutral-300 border border-neutral-700">
                {uploadPreview ? "Foto Carregada" : "Galeria MAYa"}
              </span>
            </div>
          </div>

          {/* ESCOLHA: GALERIA MAYA PROFISSIONAL */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
              <span>Opções da Galeria MAYa</span>
              <span className="text-[10px] text-amber-400">Toque para selecionar</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {MAYA_MEDIA_LIBRARY.map((foto) => {
                const selecionada = fotoUrl === foto.url && !uploadPreview;
                return (
                  <button
                    key={foto.id}
                    type="button"
                    onClick={() => {
                      setUploadPreview(null);
                      setArquivoUpload(null);
                      setFotoUrl(foto.url);
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                      selecionada
                        ? "border-rose-500 scale-105 shadow-md shadow-rose-600/30"
                        : "border-neutral-800 hover:border-neutral-600 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image src={foto.thumbnail} alt={foto.titulo} fill className="object-cover" />
                    {selecionada && (
                      <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OU FAZER UPLOAD DE FOTO PRÓPRIA */}
          <div className="pt-2">
            <label className="flex items-center justify-center w-full py-3 px-4 border border-dashed border-neutral-700 hover:border-rose-500 rounded-xl cursor-pointer bg-neutral-800/40 hover:bg-neutral-800/70 transition-all text-center gap-2">
              <Upload className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-neutral-300">
                {uploadPreview ? "Trocar foto do dispositivo" : "Ou envie uma foto do seu dispositivo / câmera"}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFotoFile}
                className="hidden"
              />
            </label>
          </div>

          {/* AÇÕES FINAIS */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPasso(2)}
              disabled={salvando}
              className="text-neutral-400 hover:text-white rounded-xl text-xs gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Button>

            <Button
              type="button"
              onClick={handleConcluirPrimeiroPrato}
              disabled={salvando}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs px-6 h-11 flex items-center gap-2 shadow-xl shadow-rose-600/25"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publicando prato...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Concluir e Publicar Cardápio</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
