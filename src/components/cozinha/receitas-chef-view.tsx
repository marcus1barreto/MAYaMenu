"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChefHat,
  Clock,
  Edit3,
  Flame,
  Loader2,
  Plus,
  Scale,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  alternarDisponibilidadePrato,
  escutarCardapio,
  salvarItemCardapio,
} from "@/lib/restaurante-service";
import { escutarFichasTecnicas } from "@/lib/fichas-tecnicas-service";
import { GuidedEmptyCardapio } from "@/components/admin/guided-empty-cardapio";
import {
  FichaTecnicaConsultaModal,
  FichaTecnicaEditorModal,
} from "./ficha-tecnica-modal";
import type { FichaTecnicaItem, MenuItem } from "@/types";

interface ReceitasChefViewProps {
  restauranteId: string;
  nomeRestaurante: string;
  isGestor?: boolean;
}

export function ReceitasChefView({
  restauranteId,
  nomeRestaurante,
  isGestor = false,
}: ReceitasChefViewProps) {
  const [itens, setItens] = useState<MenuItem[]>([]);
  const [fichasPorItem, setFichasPorItem] = useState<Record<string, FichaTecnicaItem>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("TODAS");
  const [somenteComFicha, setSomenteComFicha] = useState(false);

  const [itemConsulta, setItemConsulta] = useState<MenuItem | null>(null);
  const [itemEdicaoFicha, setItemEdicaoFicha] = useState<MenuItem | null>(null);
  const [modalNovoPratoAberto, setModalNovoPratoAberto] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  // Campos de criação rápida de prato técnico pelo Chef
  const [novoNome, setNovoNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("Pratos Principais");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoTempoMin, setNovoTempoMin] = useState("15");
  const [novoPreco, setNovoPreco] = useState("");
  const [publicarImediato, setPublicarImediato] = useState(true);
  const [salvandoNovoPrato, setSalvandoNovoPrato] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  useEffect(() => {
    if (!restauranteId) {
      setCarregando(false);
      return;
    }

    const unsubCardapio = escutarCardapio(restauranteId, (lista) => {
      setItens(lista);
      setCarregando(false);
    });
    const unsubFichas = escutarFichasTecnicas(restauranteId, (mapa) => {
      setFichasPorItem(mapa);
    });

    return () => {
      unsubCardapio();
      unsubFichas();
    };
  }, [restauranteId]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    itens.forEach((i) => set.add(i.categoria || "Geral"));
    return ["TODAS", ...Array.from(set)];
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => {
      const cat = item.categoria || "Geral";
      if (categoriaSelecionada !== "TODAS" && cat !== categoriaSelecionada) return false;
      const ficha = fichasPorItem[item.id];
      if (somenteComFicha && !ficha) return false;
      if (!termo) return true;

      const bateNome = item.nome.toLowerCase().includes(termo);
      const bateDesc = (item.descricao || "").toLowerCase().includes(termo);
      const bateEstacao = (ficha?.estacao || "").toLowerCase().includes(termo);
      const bateIngrediente = Boolean(
        ficha?.ingredientes?.some((ing) => ing.nome.toLowerCase().includes(termo))
      );
      return bateNome || bateDesc || bateEstacao || bateIngrediente;
    });
  }, [itens, fichasPorItem, busca, categoriaSelecionada, somenteComFicha]);

  const totalFichas = useMemo(
    () => itens.filter((i) => Boolean(fichasPorItem[i.id])).length,
    [itens, fichasPorItem]
  );

  const hrefVoltarKds = restauranteId
    ? `/cozinha?r=${encodeURIComponent(restauranteId)}`
    : "/cozinha";

  const handleToggleDisponivel = async (item: MenuItem) => {
    if (!restauranteId) return;
    setAlternandoId(item.id);
    setErroAcao(null);
    try {
      await alternarDisponibilidadePrato(restauranteId, item.id, !item.ativo);
    } catch {
      setErroAcao("Não foi possível alterar a disponibilidade deste item agora.");
    } finally {
      setAlternandoId(null);
    }
  };

  const handleCriarPratoDoChef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restauranteId || !novoNome.trim()) return;

    setSalvandoNovoPrato(true);
    setErroAcao(null);
    try {
      const precoNumerico = isGestor
        ? Math.max(0, Number(novoPreco.replace(",", ".")) || 0)
        : 0;
      const itemAtivo = isGestor ? publicarImediato && precoNumerico > 0 : false;
      const novoItem: MenuItem = {
        id: `item-chef-${Date.now().toString(36)}`,
        nome: novoNome.trim(),
        categoria: novaCategoria.trim() || "Geral",
        descricao:
          novaDescricao.trim() || "Preparo exclusivo da cozinha MAYaMenu.",
        precoBase: precoNumerico,
        tempoPreparoEstimado: Math.max(1, Number(novoTempoMin) || 15),
        ativo: itemAtivo,
        ordem: itens.length,
      };

      await salvarItemCardapio(restauranteId, novoItem);
      setModalNovoPratoAberto(false);
      setNovoNome("");
      setNovaDescricao("");
      setNovoPreco("");
      // Abre em seguida o editor da ficha técnica para o chef já preencher insumos e preparo
      setItemEdicaoFicha(novoItem);
    } catch {
      setErroAcao("Não foi possível criar o prato. Verifique suas permissões.");
    } finally {
      setSalvandoNovoPrato(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-4 sm:px-6 py-4 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight">
                Espaço do Chef &amp; Receitas
              </h1>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                {totalFichas}/{itens.length} fichas
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {nomeRestaurante} • Criação técnica de pratos, receitas e pausa rápida de esgotados
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setModalNovoPratoAberto(true)}
            className="h-9 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{isGestor ? "Novo Prato + Ficha" : "Sugerir Prato Técnico"}</span>
          </Button>

          <Link href={hrefVoltarKds}>
            <Button
              type="button"
              variant="outline"
              className="h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>KDS Cozinha</span>
            </Button>
          </Link>

          {isGestor && (
            <Link href="/admin/gerencial">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                <span>Gerencial &amp; Preços</span>
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-5 max-w-6xl w-full mx-auto space-y-5">
        {erroAcao && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{erroAcao}</span>
          </div>
        )}

        {carregando ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-bold text-muted-foreground">
              Carregando espaço do Chef...
            </span>
          </div>
        ) : itens.length === 0 ? (
          isGestor ? (
            <div className="space-y-4">
              <GuidedEmptyCardapio
                restauranteId={restauranteId}
                onItemCriado={() => {
                  // Sincronização automática via onSnapshot
                }}
              />
            </div>
          ) : (
            <div className="py-16 text-center bg-card border-2 border-dashed border-border rounded-3xl space-y-3 p-6">
              <ChefHat className="w-11 h-11 text-amber-500 mx-auto" />
              <h2 className="text-lg font-black text-foreground">
                Cardápio aguardando o 1º prato
              </h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Você já pode criar o rascunho técnico do primeiro prato (componentes e preparo). Ele ficará pausado até o proprietário definir o preço no Gerencial.
              </p>
              <Button
                type="button"
                onClick={() => setModalNovoPratoAberto(true)}
                className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black"
              >
                Criar 1º Rascunho Técnico + Ficha
              </Button>
            </div>
          )
        ) : (
          <>
            {/* Filtros de Bancada */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-2xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar prato, ingrediente ou estação (ex: Chapa, bacon)..."
                  className="h-10 pl-9 text-xs sm:text-sm rounded-xl"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSomenteComFicha((v) => !v)}
                  className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all ${
                    somenteComFicha
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                      : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Apenas com Ficha Técnica
                </button>
              </div>
            </div>

            {/* Categorias */}
            {categorias.length > 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaSelecionada(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                      categoriaSelecionada === cat
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat === "TODAS" ? "Todas as Categorias" : cat}
                  </button>
                ))}
              </div>
            )}

            {itensFiltrados.length === 0 ? (
              <div className="py-16 text-center bg-card border-2 border-dashed border-border rounded-3xl space-y-2">
                <ChefHat className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-black text-foreground">
                  Nenhum item encontrado com esses filtros
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {itensFiltrados.map((item) => {
                  const ficha = fichasPorItem[item.id];
                  const thumb = ficha?.fotoReferenciaUrl || item.fotoUrl;
                  const tempo = ficha?.tempoPreparoMin ?? item.tempoPreparoEstimado;
                  const rascunhoSemPreco = !item.ativo && item.precoBase <= 0;

                  return (
                    <div
                      key={item.id}
                      className={`bg-card border rounded-2xl p-4 shadow-2xs transition-all flex flex-col justify-between gap-3 ${
                        item.ativo
                          ? "border-border hover:border-amber-500/50"
                          : "border-border/70 opacity-80 bg-muted/20"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setItemConsulta(item)}
                        className="text-left space-y-3 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-xl bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt={item.nome}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <ChefHat className="w-6 h-6 text-muted-foreground/40" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                              {item.categoria || "Geral"}
                            </span>
                            <h2 className="text-sm font-black text-foreground leading-snug line-clamp-2">
                              {item.nome}
                            </h2>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {ficha ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                                  <Scale className="w-2.5 h-2.5 mr-1" />
                                  {ficha.ingredientes.length} componentes
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">
                                  Sem ficha técnica
                                </Badge>
                              )}
                              {ficha?.estacao && (
                                <Badge variant="outline" className="text-[10px] font-bold">
                                  <Flame className="w-2.5 h-2.5 mr-1 text-rose-500" />
                                  {ficha.estacao}
                                </Badge>
                              )}
                              {tempo && (
                                <Badge variant="outline" className="text-[10px] font-bold">
                                  <Clock className="w-2.5 h-2.5 mr-1 text-amber-500" />
                                  {tempo}m
                                </Badge>
                              )}
                              {rascunhoSemPreco && (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                  Aguardando preço
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {ficha?.alergenos && (
                          <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Alérgenos: {ficha.alergenos}</span>
                          </div>
                        )}

                        {ficha && ficha.ingredientes.length > 0 && (
                          <div className="text-[11px] text-muted-foreground line-clamp-2 border-t border-border/70 pt-2">
                            {ficha.ingredientes
                              .slice(0, 4)
                              .map((i) => `${i.nome}${i.quantidade ? ` (${i.quantidade})` : ""}`)
                              .join(" • ")}
                            {ficha.ingredientes.length > 4 ? " ..." : ""}
                          </div>
                        )}
                      </button>

                      {/* Ações da Cozinha: Consulta, Editar Ficha & Pausar Esgotado */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/70">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setItemConsulta(item)}
                            className="h-8 px-2.5 text-[11px] font-bold rounded-lg"
                          >
                            Ver Receita
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setItemEdicaoFicha(item)}
                            className="h-8 px-2.5 text-[11px] font-bold rounded-lg flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3 text-amber-600" />
                            <span>Editar Ficha</span>
                          </Button>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <span
                            className={`text-[10px] font-black uppercase ${
                              item.ativo
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {item.ativo ? "No ar" : "Esgotado"}
                          </span>
                          <Switch
                            checked={item.ativo}
                            disabled={alternandoId === item.id || rascunhoSemPreco}
                            onCheckedChange={() => handleToggleDisponivel(item)}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <FichaTecnicaConsultaModal
        open={Boolean(itemConsulta)}
        onOpenChange={(open) => !open && setItemConsulta(null)}
        itemNome={itemConsulta?.nome || ""}
        menuItem={itemConsulta}
        ficha={itemConsulta ? fichasPorItem[itemConsulta.id] : null}
      />

      <FichaTecnicaEditorModal
        open={Boolean(itemEdicaoFicha)}
        onOpenChange={(open) => !open && setItemEdicaoFicha(null)}
        restauranteId={restauranteId}
        menuItem={itemEdicaoFicha}
        fichaAtual={itemEdicaoFicha ? fichasPorItem[itemEdicaoFicha.id] : null}
      />

      {/* Modal para criar prato técnico pela Cozinha / Chef */}
      <Dialog open={modalNovoPratoAberto} onOpenChange={setModalNovoPratoAberto}>
        <DialogContent className="max-w-md w-[95vw] bg-card border-border text-foreground rounded-3xl p-5 sm:p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-rose-500" />
              <span>
                {isGestor ? "Novo Prato no Espaço do Chef" : "Sugerir Prato Técnico (Rascunho)"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isGestor
                ? "Crie o prato e em seguida preencha os componentes e modo de preparo na ficha técnica."
                : "O prato entra pausado (sem venda) para você já montar a ficha técnica e o gestor definir o preço depois."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarPratoDoChef} className="space-y-3.5 pt-1">
            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Nome do Prato *
              </label>
              <Input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="ex: Risoto de Cogumelos Trufado"
                className="h-10 text-xs rounded-xl font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                  Categoria
                </label>
                <Input
                  type="text"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  placeholder="ex: Pratos Principais"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                  Preparo (min)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={novoTempoMin}
                  onChange={(e) => setNovoTempoMin(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Descrição de Cardápio
              </label>
              <Input
                type="text"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Resumo curto dos principais sabores"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            {isGestor && (
              <div className="grid grid-cols-2 gap-3 items-end p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                    Preço de Venda (R$)
                  </label>
                  <Input
                    type="text"
                    value={novoPreco}
                    onChange={(e) => setNovoPreco(e.target.value)}
                    placeholder="ex: 49,90"
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <label className="flex items-center justify-between gap-2 h-9 px-2 cursor-pointer">
                  <span className="text-[11px] font-bold text-foreground">Publicar já</span>
                  <Switch
                    checked={publicarImediato}
                    onCheckedChange={setPublicarImediato}
                  />
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoPratoAberto(false)}
                className="h-9 px-4 text-xs font-bold rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoNovoPrato || !novoNome.trim()}
                className="h-9 px-5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl"
              >
                {salvandoNovoPrato ? "Salvando..." : "Criar & Abrir Ficha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
