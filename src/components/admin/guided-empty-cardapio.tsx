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
      <div className="bg-white border-2 border-emerald-500/40 rounded-3xl p-8 sm:p-12 text-center shadow-xl shadow-emerald-900/5 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 border-2 border-emerald-200 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-md shadow-emerald-500/10">
          <PartyPopper className="w-10 h-10 animate-bounce" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
          🎉 Parabéns! Seu 1º Prato Está no Ar!
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto mt-2 leading-relaxed">
          Seu cardápio digital acaba de ganhar vida. Redirecionando para o painel de gestão completo...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-neutral-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-neutral-900/5 relative overflow-hidden text-neutral-900">
      {/* Glow de ambientação sutil */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER DO WIZARD */}
      <div className="text-center max-w-lg mx-auto mb-6 sm:mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-rose-600" />
          <span>Cardápio Inicial • Boas-Vindas</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">
          Crie o 1º Prato do Seu Restaurante
        </h2>
        <p className="text-xs sm:text-sm text-neutral-500">
          Vamos colocar seu cardápio no ar em menos de 1 minuto em 3 passos simples.
        </p>

        {/* PROGRESS BAR 3 PASSOS */}
        <div className="flex items-center justify-center gap-2 pt-3">
          <div className={`h-2 rounded-full transition-all duration-300 ${passo >= 1 ? "w-10 bg-rose-600 shadow-xs" : "w-6 bg-neutral-200"}`} />
          <div className={`h-2 rounded-full transition-all duration-300 ${passo >= 2 ? "w-10 bg-rose-600 shadow-xs" : "w-6 bg-neutral-200"}`} />
          <div className={`h-2 rounded-full transition-all duration-300 ${passo >= 3 ? "w-10 bg-rose-600 shadow-xs" : "w-6 bg-neutral-200"}`} />
        </div>
      </div>

      {/* PASSO 1: CATEGORIA */}
      {passo === 1 && (
        <div className="space-y-6 max-w-lg mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Passo 1 de 3</span>
            <h3 className="text-lg font-black text-neutral-950">Escolha a primeira categoria</h3>
            <p className="text-xs text-neutral-500">
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
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs ${
                    selecionada
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 scale-105 border-2 border-rose-600"
                      : "bg-white hover:bg-neutral-50 text-neutral-800 border-2 border-neutral-200/90 hover:border-neutral-300 active:scale-95"
                  }`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span>{cat.nome}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <label className="text-xs font-bold text-neutral-700 block mb-1.5 uppercase tracking-wider">
              Ou digite o nome de outra categoria:
            </label>
            <div className="flex gap-2">
              <Input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Pratos Executivos, Cafés Especiais..."
                className="bg-neutral-50/60 border-2 border-neutral-200/90 text-neutral-950 placeholder:text-neutral-400 rounded-xl text-xs h-11 focus:bg-white focus:border-rose-500"
              />
              <Button
                type="button"
                onClick={() => setPasso(2)}
                disabled={!categoria.trim()}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs px-5 h-11 shrink-0 shadow-md shadow-rose-600/20"
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
            <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Passo 2 de 3</span>
            <h3 className="text-lg font-black text-neutral-950">Qual delícia será ofertada?</h3>
            <p className="text-xs text-neutral-500">
              Na categoria: <strong className="text-rose-600 font-bold">{categoria}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Nome do Prato *
              </label>
              <Input
                value={nomePrato}
                onChange={(e) => setNomePrato(e.target.value)}
                placeholder="Ex: Smash Burger Duplo Bacon"
                className="bg-neutral-50/60 border-2 border-neutral-200/90 text-neutral-950 placeholder:text-neutral-400 rounded-xl text-sm h-11 focus:bg-white focus:border-rose-500 font-semibold"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Descrição Curta (Destaque os ingredientes)
              </label>
              <textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: 2 blends de 100g smash, queijo prato derretido, farofa de bacon e maionese defumada no pão brioche."
                className="w-full rounded-xl bg-neutral-50/60 border-2 border-neutral-200/90 p-3 text-xs text-neutral-950 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Preço de Venda (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-500">
                  R$
                </span>
                <Input
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="34,90"
                  className="bg-neutral-50/60 border-2 border-neutral-200/90 text-neutral-950 placeholder:text-neutral-400 rounded-xl text-sm pl-10 h-11 font-mono font-bold focus:bg-white focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasso(1)}
              className="border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs gap-1.5 font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Button>
            <Button
              type="button"
              onClick={() => setPasso(3)}
              disabled={!nomePrato.trim()}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs px-6 h-11 flex items-center gap-2 shadow-md shadow-rose-600/20"
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
            <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Passo 3 de 3</span>
            <h3 className="text-lg font-black text-neutral-950">Dê água na boca do seu cliente</h3>
            <p className="text-xs text-neutral-500">
              Envie uma foto real ou escolha uma opção profissional da nossa <strong>Galeria MAYa</strong>:
            </p>
          </div>

          {/* PREVIEW DA FOTO ATUAL */}
          <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-neutral-100 border-2 border-neutral-200 shadow-md">
            <Image
              src={fotoUrl || "/images/demo/hamburger.webp"}
              alt="Prévia do prato"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-end justify-between p-3.5">
              <div>
                <span className="text-xs font-black text-white block">{nomePrato}</span>
                <span className="text-xs text-emerald-400 font-mono font-black">R$ {preco}</span>
              </div>
              <span className="text-[10px] bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-neutral-900 font-bold border border-neutral-200 shadow-sm">
                {uploadPreview ? "Foto Carregada" : "Galeria MAYa"}
              </span>
            </div>
          </div>

          {/* ESCOLHA: GALERIA MAYA PROFISSIONAL */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center justify-between">
              <span>Opções da Galeria MAYa</span>
              <span className="text-[10px] text-rose-600 font-bold">Toque para selecionar</span>
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
                        ? "border-rose-600 scale-105 shadow-md shadow-rose-600/30 ring-2 ring-rose-500/20"
                        : "border-neutral-200 hover:border-neutral-400 opacity-80 hover:opacity-100 shadow-xs"
                    }`}
                  >
                    <Image src={foto.thumbnail} alt={foto.titulo} fill className="object-cover" />
                    {selecionada && (
                      <div className="absolute inset-0 bg-rose-600/40 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white stroke-[3] drop-shadow-md" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OU FAZER UPLOAD DE FOTO PRÓPRIA */}
          <div className="pt-1">
            <label className="flex items-center justify-center w-full py-3 px-4 border-2 border-dashed border-neutral-300 hover:border-rose-500 rounded-xl cursor-pointer bg-neutral-50/70 hover:bg-rose-50/40 transition-all text-center gap-2 shadow-xs">
              <Upload className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-bold text-neutral-700">
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
          <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasso(2)}
              disabled={salvando}
              className="border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs gap-1.5 font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Button>

            <Button
              type="button"
              onClick={handleConcluirPrimeiroPrato}
              disabled={salvando}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs px-6 h-11 flex items-center gap-2 shadow-md shadow-rose-600/20"
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
