"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChefHat,
  Clock,
  Flame,
  Loader2,
  Scale,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { escutarCardapio } from "@/lib/restaurante-service";
import { escutarFichasTecnicas } from "@/lib/fichas-tecnicas-service";
import { FichaTecnicaConsultaModal } from "./ficha-tecnica-modal";
import type { FichaTecnicaItem, MenuItem } from "@/types";

interface ReceitasChefViewProps {
  restauranteId: string;
  nomeRestaurante: string;
}

export function ReceitasChefView({
  restauranteId,
  nomeRestaurante,
}: ReceitasChefViewProps) {
  const [itens, setItens] = useState<MenuItem[]>([]);
  const [fichasPorItem, setFichasPorItem] = useState<Record<string, FichaTecnicaItem>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("TODAS");
  const [somenteComFicha, setSomenteComFicha] = useState(false);

  const [itemAberto, setItemAberto] = useState<MenuItem | null>(null);

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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-4 sm:px-6 py-4 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-neutral-950 flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight">
                Livro Técnico do Chef
              </h1>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                {totalFichas}/{itens.length} fichas
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {nomeRestaurante} • Consulta rápida de componentes e preparo na bancada
            </p>
          </div>
        </div>

        <Link href={hrefVoltarKds}>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao KDS</span>
          </Button>
        </Link>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-5 max-w-6xl w-full mx-auto space-y-5">
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

        {carregando ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-bold text-muted-foreground">
              Carregando receitas e componentes...
            </span>
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="py-16 text-center bg-card border-2 border-dashed border-border rounded-3xl space-y-2">
            <ChefHat className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-black text-foreground">
              Nenhum item encontrado com esses filtros
            </p>
            <p className="text-xs text-muted-foreground">
              Cadastre as fichas técnicas nos itens do cardápio em Gerencial &rarr; Cardápio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {itensFiltrados.map((item) => {
              const ficha = fichasPorItem[item.id];
              const thumb = ficha?.fotoReferenciaUrl || item.fotoUrl;
              const tempo = ficha?.tempoPreparoMin ?? item.tempoPreparoEstimado;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setItemAberto(item)}
                  className="text-left bg-card border border-border hover:border-amber-500/60 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
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
              );
            })}
          </div>
        )}
      </main>

      <FichaTecnicaConsultaModal
        open={Boolean(itemAberto)}
        onOpenChange={(open) => !open && setItemAberto(null)}
        itemNome={itemAberto?.nome || ""}
        menuItem={itemAberto}
        ficha={itemAberto ? fichasPorItem[itemAberto.id] : null}
      />
    </div>
  );
}
