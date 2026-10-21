"use client";

import React, { useState, useEffect } from "react";
import {
  criarNovaLicenca,
  escutarLicencas,
  escutarArquivoMorto,
  alterarStatusLicenca,
  alterarPlanoRestaurante,
  LIMITES_POR_PLANO,
} from "@/lib/licenca-service";
import type { Licenca, LicencaArquivada, PlanoTipo } from "@/types";
import { parseDateToMillis } from "@/lib/datas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  KeyRound,
  Store,
  Layers,
  Sparkles,
  Copy,
  Check,
  Ban,
  RotateCcw,
  UtensilsCrossed,
  LayoutGrid,
  Search,
  Lock,
  Archive,
  FileCode2,
  Download,
  Eye,
  X,
} from "lucide-react";

export function SuperAdminView() {
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [arquivoMorto, setArquivoMorto] = useState<LicencaArquivada[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<"ativas" | "arquivo_morto">("ativas");
  const [filtro, setFiltro] = useState<string>("");
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoTipo>("free");
  const [responsavel, setResponsavel] = useState("");
  const [notas, setNotas] = useState("");
  const [validadeHoras, setValidadeHoras] = useState<string>("48");
  const [criando, setCriando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [copiadoLinkId, setCopiadoLinkId] = useState<string | null>(null);
  const [copiadoJsonId, setCopiadoJsonId] = useState<string | null>(null);
  const [jsonModalItem, setJsonModalItem] = useState<LicencaArquivada | null>(null);

  // Limites customizados opcionais
  const [maxPratosCustom, setMaxPratosCustom] = useState<string>("");
  const [maxMesasCustom, setMaxMesasCustom] = useState<string>("");

  useEffect(() => {
    const unsubLicencas = escutarLicencas((dados) => {
      setLicencas(dados);
    });
    const unsubArquivo = escutarArquivoMorto((dados) => {
      setArquivoMorto(dados);
    });
    return () => {
      unsubLicencas();
      unsubArquivo();
    };
  }, []);

  const handleCriarLicenca = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriando(true);
    try {
      const horas = validadeHoras ? Number(validadeHoras) : undefined;
      const nova = await criarNovaLicenca({
        plano: planoSelecionado,
        responsavel,
        notas,
        horasValidade: horas && horas > 0 ? horas : undefined,
        limitesPersonalizados: {
          maxPratos: maxPratosCustom ? Number(maxPratosCustom) : undefined,
          maxMesas: maxMesasCustom ? Number(maxMesasCustom) : undefined,
        },
      });

      // Atualização de estado otimista e reativa instantânea (estilo Next.js)
      setLicencas((prev) => [nova, ...prev.filter((l) => l.id !== nova.id)]);

      setResponsavel("");
      setNotas("");
      setMaxPratosCustom("");
      setMaxMesasCustom("");
    } catch (err) {
      console.error("Falha ao criar licença:", err);
    } finally {
      setCriando(false);
    }
  };

  const handleAlterarStatus = async (codigo: string, novoStatus: "ativa" | "suspensa" | "revogada") => {
    // Atualização otimista imediata na UI
    setLicencas((prev) =>
      prev.map((lic) => (lic.id === codigo ? { ...lic, status: novoStatus } : lic))
    );
    try {
      await alterarStatusLicenca(codigo, novoStatus);
    } catch (err) {
      console.warn("Falha ao alterar status remoto da licença:", err);
    }
  };

  const handleAlterarPlano = async (
    restauranteId: string,
    novoPlano: PlanoTipo,
    licencaCodigo?: string
  ) => {
    const novosLimites = LIMITES_POR_PLANO[novoPlano];
    // Atualização otimista na lista de concessões
    setLicencas((prev) =>
      prev.map((lic) =>
        lic.restauranteId === restauranteId || (licencaCodigo && lic.id === licencaCodigo)
          ? { ...lic, plano: novoPlano, limites: novosLimites }
          : lic
      )
    );
    try {
      await alterarPlanoRestaurante(restauranteId, novoPlano, licencaCodigo);
    } catch (err) {
      console.error("Erro ao alterar plano do restaurante:", err);
    }
  };

  const handleCopiar = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiadoId(codigo);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const handleCopiarLink = (codigo: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/ativar/${codigo}`;
    navigator.clipboard.writeText(url);
    setCopiadoLinkId(codigo);
    setTimeout(() => setCopiadoLinkId(null), 2500);
  };

  const licencasFiltradas = licencas.filter((lic) => {
    const termo = filtro.toLowerCase();
    return (
      lic.id.toLowerCase().includes(termo) ||
      (lic.restauranteNome && lic.restauranteNome.toLowerCase().includes(termo)) ||
      (lic.responsavel && lic.responsavel.toLowerCase().includes(termo)) ||
      lic.plano.toLowerCase().includes(termo)
    );
  });

  const totalAtivas = licencas.filter((l) => l.status === "ativa").length;
  const totalDisponiveis = licencas.filter((l) => l.status === "disponivel").length;
  const totalSuspensas = licencas.filter((l) => l.status === "suspensa").length;

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 md:p-8 space-y-8">
      {/* HEADER DA GERÊNCIA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600/20 border border-rose-500/30 rounded-2xl text-rose-500">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                MAYaRAnas <span className="text-neutral-500 font-normal">| Gerência Geral</span>
              </h1>
              <p className="text-xs text-neutral-400">
                Central de Concessões, Emissão de Licenças e Controle de Estabelecimentos
              </p>
            </div>
          </div>
        </div>

        {/* METRICAS RÁPIDAS */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-2xl text-center">
            <span className="block text-xs uppercase tracking-wider text-neutral-500 font-bold">
              Ativos
            </span>
            <span className="text-xl font-black text-emerald-400">{totalAtivas}</span>
          </div>
          <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-2xl text-center">
            <span className="block text-xs uppercase tracking-wider text-neutral-500 font-bold">
              Disponíveis
            </span>
            <span className="text-xl font-black text-amber-400">{totalDisponiveis}</span>
          </div>
          <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-2xl text-center">
            <span className="block text-xs uppercase tracking-wider text-neutral-500 font-bold">
              Suspensos
            </span>
            <span className="text-xl font-black text-rose-500">{totalSuspensas}</span>
          </div>
          <div
            onClick={() => setAbaAtiva("arquivo_morto")}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-2xl text-center cursor-pointer hover:border-neutral-700 transition-colors"
          >
            <span className="block text-xs uppercase tracking-wider text-neutral-500 font-bold flex items-center justify-center gap-1">
              <Archive className="w-3 h-3 text-purple-400" />
              Arquivo Morto
            </span>
            <span className="text-xl font-black text-purple-400">{arquivoMorto.length}</span>
          </div>
        </div>
      </div>

      {/* SELETOR DE ABAS */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setAbaAtiva("ativas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "ativas"
              ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
              : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Concessões Ativas ({licencasFiltradas.length})
        </button>
        <button
          onClick={() => setAbaAtiva("arquivo_morto")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "arquivo_morto"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
          }`}
        >
          <Archive className="w-4 h-4" />
          Arquivo Morto / JSONs ({arquivoMorto.length})
        </button>
      </div>

      {abaAtiva === "ativas" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORMULÁRIO: GERAR NOVA CONCESSÃO */}
          <div className="lg:col-span-1">
            <Card className="bg-neutral-900 border-neutral-800 text-white rounded-3xl overflow-hidden shadow-xl">
              <CardHeader className="bg-neutral-800/40 border-b border-neutral-800 pb-4">
                <CardTitle className="text-base font-black flex items-center gap-2 text-rose-400">
                  <KeyRound className="w-5 h-5" />
                  Emitir Nova Licença / Token
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <form onSubmit={handleCriarLicenca} className="space-y-4">
                  {/* PLANO */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Plano & Camada de Concessão
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["free", "pro", "enterprise"] as PlanoTipo[]).map((p) => {
                        const ativo = planoSelecionado === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPlanoSelecionado(p)}
                            className={`p-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all ${
                              ativo
                                ? "bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30"
                                : "bg-neutral-800/60 border-neutral-700/60 text-neutral-400 hover:text-white"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-neutral-400 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800 mt-2">
                      Padrão {planoSelecionado.toUpperCase()}:{" "}
                      <span className="text-white font-bold">
                        {LIMITES_POR_PLANO[planoSelecionado].maxPratos} pratos
                      </span>{" "}
                      •{" "}
                      <span className="text-white font-bold">
                        {LIMITES_POR_PLANO[planoSelecionado].maxMesas} mesas
                      </span>
                    </div>
                  </div>

                  {/* DESTINATÁRIO / RESPONSÁVEL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Destinatário / Contato
                    </label>
                    <Input
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      placeholder="Ex: Marcus Barreto (WhatsApp / Restaurante X)"
                      className="bg-neutral-800 border-neutral-700 text-white rounded-xl h-10 text-xs"
                    />
                  </div>

                  {/* VALIDADE / EXPIRAÇÃO DO CONVITE EFÊMERO */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                      <span>Validade do Link de Ativação</span>
                      <span className="text-[10px] text-rose-400 font-mono">Burn-After-Reading</span>
                    </label>
                    <select
                      value={validadeHoras}
                      onChange={(e) => setValidadeHoras(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl h-10 px-3 text-xs outline-none focus:border-rose-500"
                    >
                      <option value="24">Válido por 24 horas</option>
                      <option value="48">Válido por 48 horas (Padrão)</option>
                      <option value="168">Válido por 7 dias</option>
                      <option value="720">Válido por 30 dias</option>
                      <option value="0">Sem expiração (Até ser consumido)</option>
                    </select>
                  </div>

                  {/* NOTAS OU CONDIÇÃO */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Observações Internas (Opcional)
                    </label>
                    <Input
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Ex: Demonstração 30 dias / Parceria"
                      className="bg-neutral-800 border-neutral-700 text-white rounded-xl h-10 text-xs"
                    />
                  </div>

                  {/* LIMITES PERSONALIZADOS */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-neutral-500">
                        Limite de Pratos
                      </label>
                      <Input
                        type="number"
                        value={maxPratosCustom}
                        onChange={(e) => setMaxPratosCustom(e.target.value)}
                        placeholder={String(LIMITES_POR_PLANO[planoSelecionado].maxPratos)}
                        className="bg-neutral-800 border-neutral-700 text-white rounded-xl h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-neutral-500">
                        Limite de Mesas
                      </label>
                      <Input
                        type="number"
                        value={maxMesasCustom}
                        onChange={(e) => setMaxMesasCustom(e.target.value)}
                        placeholder={String(LIMITES_POR_PLANO[planoSelecionado].maxMesas)}
                        className="bg-neutral-800 border-neutral-700 text-white rounded-xl h-9 text-xs"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={criando}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl h-11 text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all"
                  >
                    {criando ? "Gerando Token..." : "Gerar Código de Licença"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* LISTAGEM DE LICENÇAS E CONCESSÕES */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Store className="w-5 h-5 text-neutral-400" />
                Concessões Registradas ({licencasFiltradas.length})
              </h2>

              <div className="relative w-64">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar código, nome..."
                  className="bg-neutral-900 border-neutral-800 text-white pl-9 rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            {licencasFiltradas.length === 0 ? (
              <div className="p-12 text-center bg-neutral-900/50 border border-neutral-800/80 rounded-3xl space-y-3">
                <KeyRound className="w-10 h-10 text-neutral-600 mx-auto" />
                <p className="text-neutral-400 text-xs">
                  Nenhuma licença ativa encontrada. Todas as licenças ativadas foram transferidas automaticamente para o Arquivo Morto.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {licencasFiltradas.map((lic) => {
                  const ativa = lic.status === "ativa";
                  const disponivel = lic.status === "disponivel";
                  const suspensa = lic.status === "suspensa";

                  return (
                    <div
                      key={lic.id}
                      className="p-5 bg-neutral-900/90 border border-neutral-800 rounded-3xl space-y-3 shadow-md hover:border-neutral-700 transition-colors"
                    >
                      {/* TOPO: TOKEN E STATUS */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-white bg-neutral-800 px-2.5 py-1 rounded-xl tracking-wider">
                            {lic.id}
                          </span>
                          <button
                            onClick={() => handleCopiar(lic.id)}
                            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors"
                            title="Copiar código"
                          >
                            {copiadoId === lic.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <Badge
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            disponivel
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : ativa
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {lic.status}
                        </Badge>
                      </div>

                      {/* DADOS DO ESTABELECIMENTO */}
                      <div className="space-y-1 text-xs">
                        {lic.restauranteNome ? (
                          <div>
                            <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                              Restaurante Vinculado
                            </span>
                            <span className="text-white font-bold text-sm">
                              {lic.restauranteNome}
                            </span>
                            {lic.slug && (
                              <span className="text-rose-400 block text-[11px] font-mono">
                                /r/{lic.slug}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                              Destinatário Previsto
                            </span>
                            <span className="text-neutral-300">
                              {lic.responsavel || "Aguardando ativação por novo estabelecimento"}
                            </span>
                          </div>
                        )}

                        {lic.notas && (
                          <p className="text-[11px] text-neutral-400 italic">“{lic.notas}”</p>
                        )}
                      </div>

                      {/* LIMITES E DETALHES DO PLANO */}
                      <div className="flex items-center gap-3 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
                        <div className="flex items-center gap-1 font-semibold uppercase text-neutral-300">
                          <Layers className="w-3.5 h-3.5 text-rose-500" />
                          {lic.plano}
                        </div>
                        <div className="flex items-center gap-1">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-neutral-500" />
                          {lic.limites.maxPratos} pratos
                        </div>
                        <div className="flex items-center gap-1">
                          <LayoutGrid className="w-3.5 h-3.5 text-neutral-500" />
                          {lic.limites.maxMesas} mesas
                        </div>
                      </div>

                      {/* AÇÕES DE GESTÃO E COMPARTILHAMENTO EFÊMERO */}
                      {disponivel && (
                        <div className="pt-2 space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopiarLink(lic.id)}
                            className="w-full bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border-rose-500/30 rounded-xl text-[11px] font-black uppercase tracking-wider h-9 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            {copiadoLinkId === lic.id ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400" />
                                Link de Ativação Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copiar Link de Ativação
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {ativa && (
                        <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                          {/* 1. SEGMENTED CONTROL (Mudança Silenciosa e Rápida) */}
                          <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 shadow-inner">
                            {/* Botão FREE */}
                            <button
                              type="button"
                              onClick={() => handleAlterarPlano(lic.restauranteId || lic.id, "free", lic.id)}
                              className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
                                lic.plano === "free"
                                  ? "bg-neutral-800 text-neutral-200 shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-300"
                              }`}
                            >
                              FREE
                            </button>

                            {/* Botão PRO */}
                            <button
                              type="button"
                              onClick={() => handleAlterarPlano(lic.restauranteId || lic.id, "pro", lic.id)}
                              className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
                                lic.plano === "pro"
                                  ? "bg-violet-600 text-white shadow-sm shadow-violet-900/50"
                                  : "text-neutral-500 hover:text-violet-400"
                              }`}
                            >
                              PRO
                            </button>

                            {/* Botão ENTERPRISE */}
                            <button
                              type="button"
                              onClick={() => handleAlterarPlano(lic.restauranteId || lic.id, "enterprise", lic.id)}
                              className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
                                lic.plano === "enterprise"
                                  ? "bg-amber-500 text-amber-950 shadow-sm shadow-amber-900/50"
                                  : "text-neutral-500 hover:text-amber-500"
                              }`}
                            >
                              ENTERPRISE
                            </button>
                          </div>

                          {/* 2. BOTÃO DESTRUTIVO COM FRICÇÃO (Shadcn Alert Dialog) */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                className="px-3 py-1.5 text-[10px] sm:text-xs font-bold text-rose-500 hover:bg-rose-500/15 hover:text-rose-400 rounded-lg transition-colors border border-transparent hover:border-rose-500/30 flex items-center gap-1.5"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Suspender
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-neutral-950 border border-neutral-800 text-white rounded-2xl max-w-sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-rose-500">Suspender Estabelecimento?</AlertDialogTitle>
                                <AlertDialogDescription className="text-neutral-400">
                                  Esta ação cortará imediatamente o acesso do restaurante <strong>{lic.restauranteNome || lic.id}</strong> ao painel administrativo e desativará todos os QR Codes das mesas em operação.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-4">
                                <AlertDialogCancel className="bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800 hover:text-white rounded-xl">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleAlterarStatus(lic.id, "suspensa")}
                                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold"
                                >
                                  Sim, Suspender
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}

                      {suspensa && (
                        <div className="pt-2 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAlterarStatus(lic.id, "ativa")}
                            className="w-full bg-neutral-800 hover:bg-emerald-950/40 text-emerald-400 border-neutral-700 hover:border-emerald-500/50 rounded-xl text-[10px] font-bold uppercase tracking-wider h-8"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Reativar Concessão
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ABA ARQUIVO MORTO / REGISTROS EM JSON */
        <div className="space-y-6">
          <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600/20 border border-purple-500/30 rounded-2xl text-purple-400">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  Arquivo Morto de Licenças & Tokens
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">
                    Imutável (WORM)
                  </Badge>
                </h2>
                <p className="text-xs text-neutral-400">
                  Todas as licenças consumidas são desvinculadas das concessões ativas e arquivadas
                  aqui em formato JSON permanente para auditoria e histórico fiscal.
                </p>
              </div>
            </div>
          </div>

          {arquivoMorto.length === 0 ? (
            <div className="p-16 text-center bg-neutral-900/40 border border-neutral-800 rounded-3xl space-y-3">
              <Archive className="w-12 h-12 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-300">Nenhum registro arquivado ainda</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Assim que um lojista ativar um estabelecimento através do seu token efêmero, a licença
                será arquivada automaticamente aqui como JSON.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {arquivoMorto.map((item) => {
                const arquivadoMillis = parseDateToMillis(item.arquivadoEm);
                const dataFormatada = arquivadoMillis !== null
                  ? new Date(arquivadoMillis).toLocaleString("pt-BR")
                  : "Data registrada";

                return (
                  <div
                    key={item.id}
                    className="p-5 bg-neutral-900/90 border border-neutral-800/80 rounded-3xl space-y-3 shadow-md hover:border-purple-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2.5 py-1 rounded-xl">
                        {item.codigo || item.id}
                      </span>
                      <Badge className="bg-neutral-800 text-neutral-400 text-[10px] border-neutral-700">
                        {item.motivo || "ativada"}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                          Estabelecimento
                        </span>
                        <span className="text-white font-bold text-sm">
                          {item.restauranteNome || "Estabelecimento"}
                        </span>
                        {item.slug && (
                          <span className="text-purple-400 block text-[11px] font-mono">
                            /r/{item.slug}
                          </span>
                        )}
                      </div>
                      <div className="pt-1 text-[11px] text-neutral-400">
                        Arquivado em: <span className="text-neutral-300">{dataFormatada}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setJsonModalItem(item)}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 text-[11px] h-8 rounded-xl font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        Ver JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const jsonStr = item.snapshotJson || JSON.stringify(item, null, 2);
                          navigator.clipboard.writeText(jsonStr);
                          setCopiadoJsonId(item.id);
                          setTimeout(() => setCopiadoJsonId(null), 2500);
                        }}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 text-[11px] h-8 px-3 rounded-xl"
                        title="Copiar JSON"
                      >
                        {copiadoJsonId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const jsonStr = item.snapshotJson || JSON.stringify(item, null, 2);
                          const blob = new Blob([jsonStr], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `licenca-${item.codigo || item.id}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 text-[11px] h-8 px-3 rounded-xl"
                        title="Baixar Arquivo JSON"
                      >
                        <Download className="w-3.5 h-3.5 text-neutral-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL INSPECIONADOR DE JSON DO ARQUIVO MORTO */}
      {jsonModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm text-white">
                  JSON de Auditoria — {jsonModalItem.codigo || jsonModalItem.id}
                </h3>
              </div>
              <button
                onClick={() => setJsonModalItem(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-auto bg-neutral-950 font-mono text-xs text-neutral-300">
              <pre className="whitespace-pre-wrap">
                {jsonModalItem.snapshotJson || JSON.stringify(jsonModalItem, null, 2)}
              </pre>
            </div>

            <div className="p-4 border-t border-neutral-800 flex justify-end gap-2 bg-neutral-900">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const jsonStr = jsonModalItem.snapshotJson || JSON.stringify(jsonModalItem, null, 2);
                  navigator.clipboard.writeText(jsonStr);
                  setCopiadoJsonId(jsonModalItem.id);
                  setTimeout(() => setCopiadoJsonId(null), 2500);
                }}
                className="bg-neutral-800 border-neutral-700 text-white text-xs rounded-xl"
              >
                {copiadoJsonId === jsonModalItem.id ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 mr-1" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1 text-neutral-400" />
                    Copiar JSON
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const jsonStr = jsonModalItem.snapshotJson || JSON.stringify(jsonModalItem, null, 2);
                  const blob = new Blob([jsonStr], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `licenca-${jsonModalItem.codigo || jsonModalItem.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-xl font-bold"
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar JSON (.json)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

