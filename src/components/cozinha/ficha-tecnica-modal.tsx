"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChefHat,
  Clock,
  Flame,
  Link2,
  Loader2,
  Plus,
  Scale,
  Trash2,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  excluirFichaTecnica,
  salvaFichaPreviewUrlCheck,
} from "./ficha-helpers";
import {
  sanitizarUrlReferenciaExterna,
  salvarFichaTecnica,
} from "@/lib/fichas-tecnicas-service";
import type {
  FichaTecnicaItem,
  IngredienteFichaTecnica,
  MenuItem,
} from "@/types";

interface FichaTecnicaConsultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNome: string;
  menuItem?: MenuItem | null;
  ficha?: FichaTecnicaItem | null;
}

export function FichaTecnicaConsultaModal({
  open,
  onOpenChange,
  itemNome,
  menuItem,
  ficha,
}: FichaTecnicaConsultaModalProps) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [erroImagem, setErroImagem] = useState(false);

  const itemId = ficha?.menuItemId || menuItem?.id || itemNome;

  useEffect(() => {
    setMarcados({});
    setErroImagem(false);
  }, [itemId, open]);

  const imagemReferencia =
    (!erroImagem && (ficha?.fotoReferenciaUrl || menuItem?.fotoUrl)) || null;
  const etapas = (ficha?.modoPreparo || "")
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tempoExibido =
    ficha?.tempoPreparoMin ?? menuItem?.tempoPreparoEstimado ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground rounded-3xl p-5 sm:p-6 shadow-2xl">
        <DialogHeader className="text-left space-y-1.5 pb-2 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
              <ChefHat className="w-3 h-3 mr-1" />
              Ficha Técnica do Chef
            </Badge>
            {ficha?.estacao && (
              <Badge variant="outline" className="text-[10px] font-bold">
                <Flame className="w-3 h-3 mr-1 text-rose-500" />
                {ficha.estacao}
              </Badge>
            )}
            {tempoExibido && (
              <Badge variant="outline" className="text-[10px] font-bold">
                <Clock className="w-3 h-3 mr-1 text-amber-500" />
                {tempoExibido} min
              </Badge>
            )}
            {ficha?.rendimento && (
              <Badge variant="outline" className="text-[10px] font-bold">
                <Scale className="w-3 h-3 mr-1 text-emerald-500" />
                {ficha.rendimento}
              </Badge>
            )}
          </div>

          <DialogTitle className="text-xl font-black tracking-tight text-foreground pt-1">
            {ficha?.nomeItem || menuItem?.nome || itemNome}
          </DialogTitle>
          {menuItem?.categoria && (
            <DialogDescription className="text-xs text-muted-foreground">
              Categoria: {menuItem.categoria}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Foto de referência (reaproveitada do cardápio sem custo extra, ou URL externa) */}
          {imagemReferencia && (
            <div className="rounded-2xl overflow-hidden border border-border bg-muted/40 max-h-56 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagemReferencia}
                alt={ficha?.nomeItem || menuItem?.nome || itemNome}
                onError={() => setErroImagem(true)}
                className="w-full max-h-56 object-cover"
              />
            </div>
          )}

          {/* Alerta de Alérgenos */}
          {ficha?.alergenos && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="uppercase tracking-wider block text-[10px]">
                  Alerta de Alérgenos / Restrições
                </strong>
                <span className="font-bold">{ficha.alergenos}</span>
              </div>
            </div>
          )}

          {/* Componentes e Ingredientes com checklist tátil de bancada */}
          {ficha && ficha.ingredientes.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-500" />
                  <span>Componentes &amp; Porcionamento ({ficha.ingredientes.length})</span>
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  Toque para marcar na bancada
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ficha.ingredientes.map((ing) => {
                  const marcado = Boolean(marcados[ing.id]);
                  return (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() =>
                        setMarcados((prev) => ({ ...prev, [ing.id]: !prev[ing.id] }))
                      }
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        marcado
                          ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted/30 border-border hover:border-foreground/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <span
                          className={`text-sm font-bold block ${
                            marcado ? "line-through opacity-75" : "text-foreground"
                          }`}
                        >
                          {ing.nome}
                        </span>
                        {ing.observacao && (
                          <span className="text-[11px] text-muted-foreground block">
                            {ing.observacao}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {ing.quantidade && (
                          <span className="px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-black text-foreground">
                            {ing.quantidade}
                          </span>
                        )}
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                            marcado
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-border bg-card"
                          }`}
                        >
                          {marcado && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-muted/40 border border-dashed border-border text-xs text-muted-foreground">
              {ficha
                ? "Nenhum componente específico listado nesta ficha."
                : "Este prato ainda não possui ficha técnica cadastrada no Gerencial."}
              {menuItem?.descricao && (
                <p className="mt-2 text-foreground font-medium">
                  <strong>Descrição do cardápio:</strong> {menuItem.descricao}
                </p>
              )}
            </div>
          )}

          {/* Modo de Preparo */}
          {etapas.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-rose-500" />
                <span>Modo de Preparo</span>
              </h3>
              <ol className="space-y-2">
                {etapas.map((passo, index) => (
                  <li
                    key={index}
                    className="p-3 rounded-xl bg-muted/25 border border-border flex items-start gap-3 text-sm leading-relaxed"
                  >
                    <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-foreground font-medium">{passo}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Empratamento / Acabamento */}
          {ficha?.observacoesEmpratamento && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5" />
                Montagem &amp; Empratamento
              </span>
              <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                {ficha.observacoesEmpratamento}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FichaTecnicaEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restauranteId: string;
  menuItem: MenuItem | null;
  fichaAtual?: FichaTecnicaItem | null;
}

const ESTACOES_SUGERIDAS = ["Chapa", "Fritadeira", "Forno / Fogão", "Montagem / Frios", "Bar / Bebidas"];

export function FichaTecnicaEditorModal({
  open,
  onOpenChange,
  restauranteId,
  menuItem,
  fichaAtual,
}: FichaTecnicaEditorModalProps) {
  const [estacao, setEstacao] = useState("");
  const [rendimento, setRendimento] = useState("");
  const [tempoPreparoMin, setTempoPreparoMin] = useState<string>("");
  const [ingredientes, setIngredientes] = useState<IngredienteFichaTecnica[]>([]);
  const [modoPreparo, setModoPreparo] = useState("");
  const [alergenos, setAlergenos] = useState("");
  const [observacoesEmpratamento, setObservacoesEmpratamento] = useState("");
  const [fotoReferenciaUrl, setFotoReferenciaUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !menuItem) return;
    setEstacao(fichaAtual?.estacao || "");
    setRendimento(fichaAtual?.rendimento || "");
    setTempoPreparoMin(
      fichaAtual?.tempoPreparoMin !== undefined
        ? String(fichaAtual.tempoPreparoMin)
        : menuItem.tempoPreparoEstimado !== undefined
          ? String(menuItem.tempoPreparoEstimado)
          : ""
    );
    setIngredientes(
      fichaAtual?.ingredientes && fichaAtual.ingredientes.length > 0
        ? fichaAtual.ingredientes.map((i) => ({ ...i }))
        : [{ id: `ing-${Date.now()}`, nome: "", quantidade: "", observacao: "" }]
    );
    setModoPreparo(fichaAtual?.modoPreparo || "");
    setAlergenos(fichaAtual?.alergenos || "");
    setObservacoesEmpratamento(fichaAtual?.observacoesEmpratamento || "");
    setFotoReferenciaUrl(fichaAtual?.fotoReferenciaUrl || "");
    setErro(null);
  }, [open, menuItem, fichaAtual]);

  const handleAddIngrediente = () => {
    setIngredientes((prev) => [
      ...prev,
      { id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nome: "", quantidade: "", observacao: "" },
    ]);
  };

  const handleUpdateIngrediente = (
    id: string,
    campo: "nome" | "quantidade" | "observacao",
    valor: string
  ) => {
    setIngredientes((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [campo]: valor } : ing))
    );
  };

  const handleRemoverIngrediente = (id: string) => {
    setIngredientes((prev) => prev.filter((ing) => ing.id !== id));
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuItem || !restauranteId) return;

    const urlLimpa = fotoReferenciaUrl.trim();
    if (urlLimpa && !sanitizarUrlReferenciaExterna(urlLimpa)) {
      setErro("Informe uma URL externa válida iniciando com https:// ou deixe em branco.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await salvarFichaTecnica(restauranteId, {
        menuItemId: menuItem.id,
        nomeItem: menuItem.nome,
        estacao: estacao.trim(),
        rendimento: rendimento.trim(),
        tempoPreparoMin: Number(tempoPreparoMin) > 0 ? Number(tempoPreparoMin) : undefined,
        ingredientes: ingredientes.filter((i) => i.nome.trim().length > 0),
        modoPreparo: modoPreparo.trim(),
        alergenos: alergenos.trim(),
        observacoesEmpratamento: observacoesEmpratamento.trim(),
        fotoReferenciaUrl: urlLimpa,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar ficha técnica.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!menuItem || !restauranteId || !fichaAtual) return;
    if (!window.confirm(`Remover a ficha técnica de "${menuItem.nome}"?`)) return;
    setSalvando(true);
    try {
      await excluirFichaTecnica(restauranteId, menuItem.id);
      onOpenChange(false);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Falha ao remover ficha técnica.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground rounded-3xl p-5 sm:p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <span>Ficha Técnica &amp; Receita — {menuItem?.nome}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Dados internos acessíveis apenas no Gerencial e na Cozinha (Módulo Chef). Nunca aparecem no cardápio do cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 pt-2">
          {erro && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 text-xs font-semibold">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Estação / Praça
              </label>
              <Input
                type="text"
                list="estacoes-chef-lista"
                value={estacao}
                onChange={(e) => setEstacao(e.target.value)}
                placeholder="ex: Chapa, Fritadeira"
                className="h-9 text-xs rounded-xl"
              />
              <datalist id="estacoes-chef-lista">
                {ESTACOES_SUGERIDAS.map((st) => (
                  <option key={st} value={st} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Rendimento
              </label>
              <Input
                type="text"
                value={rendimento}
                onChange={(e) => setRendimento(e.target.value)}
                placeholder="ex: 1 porção (350g)"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Tempo Estimado (min)
              </label>
              <Input
                type="number"
                min={1}
                max={240}
                value={tempoPreparoMin}
                onChange={(e) => setTempoPreparoMin(e.target.value)}
                placeholder="ex: 15"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Ingredientes / Componentes */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-foreground">
                Ingredientes &amp; Componentes
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddIngrediente}
                className="h-7 px-2.5 text-[11px] font-bold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Componente</span>
              </Button>
            </div>

            <div className="space-y-2">
              {ingredientes.map((ing) => (
                <div key={ing.id} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    type="text"
                    value={ing.nome}
                    onChange={(e) => handleUpdateIngrediente(ing.id, "nome", e.target.value)}
                    placeholder="Componente (ex: Blend bovino)"
                    className="col-span-5 h-9 text-xs rounded-xl"
                  />
                  <Input
                    type="text"
                    value={ing.quantidade}
                    onChange={(e) => handleUpdateIngrediente(ing.id, "quantidade", e.target.value)}
                    placeholder="Qtd (ex: 180g)"
                    className="col-span-3 h-9 text-xs rounded-xl font-bold"
                  />
                  <Input
                    type="text"
                    value={ing.observacao || ""}
                    onChange={(e) => handleUpdateIngrediente(ing.id, "observacao", e.target.value)}
                    placeholder="Obs (opcional)"
                    className="col-span-3 h-9 text-xs rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoverIngrediente(ing.id)}
                    className="col-span-1 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                    title="Remover componente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Modo de preparo */}
          <div>
            <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
              Modo de Preparo (1 passo por linha)
            </label>
            <textarea
              rows={4}
              value={modoPreparo}
              onChange={(e) => setModoPreparo(e.target.value)}
              placeholder={"Selar o blend na chapa por 3 minutos de cada lado.\nAdicionar cheddar e abafar por 30 segundos.\nMontar no pão selado com o molho da casa."}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Alérgenos / Alertas
              </label>
              <Input
                type="text"
                value={alergenos}
                onChange={(e) => setAlergenos(e.target.value)}
                placeholder="ex: Glúten, Lactose, Castanhas"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
                Empratamento / Acabamento
              </label>
              <Input
                type="text"
                value={observacoesEmpratamento}
                onChange={(e) => setObservacoesEmpratamento(e.target.value)}
                placeholder="ex: Prato aquecido, finalizar com cebolinha"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Foto sem custo extra no Firebase Storage */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
            <label className="text-[11px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Link de Foto de Montagem (Opcional — Custo Zero)</span>
            </label>
            <Input
              type="url"
              value={fotoReferenciaUrl}
              onChange={(e) => setFotoReferenciaUrl(e.target.value)}
              placeholder="Por padrão usa a foto do cardápio. Cole https://... apenas se quiser outra."
              className="h-9 text-xs rounded-xl"
            />
            {salvaFichaPreviewUrlCheck(fotoReferenciaUrl, menuItem?.fotoUrl) && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {fotoReferenciaUrl.trim()
                  ? "Usando link externo informado acima."
                  : "Reaproveitando automaticamente a foto já cadastrada no cardápio (sem custo extra)."}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
            <div>
              {fichaAtual && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={salvando}
                  onClick={handleExcluir}
                  className="text-rose-600 hover:bg-rose-500/10 text-xs font-bold h-9 px-3 rounded-xl"
                >
                  Remover Ficha
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 text-xs font-bold rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="h-9 px-5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5"
              >
                {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Salvar Ficha Técnica</span>
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
