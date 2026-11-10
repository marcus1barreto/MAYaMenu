"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Plus,
  Copy,
  Check,
  Calendar,
  Store,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  QrCode,
  Sparkles,
} from "lucide-react";
import { criarLoteLicencas } from "@/lib/b2b-service";
import type { LoteLicencasB2B } from "@/types/b2b";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface B2BLotesViewProps {
  patrocinadorId: string;
  lotes: LoteLicencasB2B[];
}

export function B2BLotesView({ patrocinadorId, lotes }: B2BLotesViewProps) {
  const [modalNovoLoteAberto, setModalNovoLoteAberto] = useState(false);
  const [nomeLote, setNomeLote] = useState("");
  const [codigoCampanha, setCodigoCampanha] = useState("");
  const [totalLicencas, setTotalLicencas] = useState(50);
  const [validadeMeses, setValidadeMeses] = useState(12);
  const [salvando, setSalvando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const totalGeral = lotes.reduce((acc, l) => acc + (l.totalLicencas || 0), 0);
  const ativadasGeral = lotes.reduce((acc, l) => acc + (l.licencasAtivadas || 0), 0);
  const disponiveisGeral = Math.max(0, totalGeral - ativadasGeral);

  const handleCriarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeLote.trim() || !codigoCampanha.trim()) return;

    setSalvando(true);
    try {
      await criarLoteLicencas(patrocinadorId, {
        nome: nomeLote.trim(),
        codigoCampanha: codigoCampanha.trim().toUpperCase(),
        totalLicencas: Number(totalLicencas) || 10,
        validadeMeses: Number(validadeMeses) || 12,
      });

      setNomeLote("");
      setCodigoCampanha("");
      setModalNovoLoteAberto(false);
    } catch (err: any) {
      alert(err?.message || "Falha ao emitir lote.");
    } finally {
      setSalvando(false);
    }
  };

  const copiarLinkVoucher = (codigo: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/admin?voucher=${codigo}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiadoId(codigo);
      setTimeout(() => setCopiadoId(null), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* MÉTRICAS RÁPIDAS DAS COTAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Total de Cotas Contratadas
            </span>
            <span className="text-3xl font-black text-white mt-1 block">
              {totalGeral}
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Restaurantes Ativos
            </span>
            <span className="text-3xl font-black text-emerald-400 mt-1 block">
              {ativadasGeral}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              Cotas Disponíveis para Ativação
            </span>
            <span className="text-3xl font-black text-amber-400 mt-1 block">
              {disponiveisGeral}
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CABEÇALHO DA SEÇÃO DE LOTES */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            <span>Lotes de Licenças & Campanhas</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
              {lotes.length} campanhas
            </span>
          </h3>
          <p className="text-xs text-zinc-400">
            Compartilhe o código de voucher ou link de convite com os bares e restaurantes da sua rede.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setModalNovoLoteAberto(true)}
          className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Contratar / Emitir Novo Lote</span>
        </Button>
      </div>

      {/* LISTA DE LOTES / CAMPANHAS */}
      {lotes.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/50 rounded-3xl border border-white/5 flex flex-col items-center">
          <Layers className="w-12 h-12 text-zinc-700 mb-3" />
          <h4 className="text-base font-bold text-zinc-300">Nenhum lote de licenças cadastrado</h4>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Emita seu primeiro lote corporativo para gerar vouchers de ativação para seus estabelecimentos parceiros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lotes.map((lote) => {
            const perc = Math.min(100, Math.round(((lote.licencasAtivadas || 0) / lote.totalLicencas) * 100));
            const expirado = new Date(lote.dataExpiracao) < new Date();

            return (
              <div
                key={lote.id}
                className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-xl flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 block font-bold">
                        VOUCHER: {lote.codigoCampanha}
                      </span>
                      <h4 className="text-base font-black text-white">{lote.nome}</h4>
                    </div>

                    <Badge
                      className={`text-[10px] font-bold ${
                        expirado
                          ? "bg-red-500/20 text-red-300 border-red-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {expirado ? "Expirado" : "Campanha Ativa"}
                    </Badge>
                  </div>

                  {/* Barra de Progresso do Lote */}
                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Ativações Realizadas:</span>
                      <span className="font-bold text-white">
                        {lote.licencasAtivadas || 0} de {lote.totalLicencas} cotas ({perc}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${perc}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-3">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Validade: {new Date(lote.dataExpiracao).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>

                {/* BOTÕES DE COMPARTILHAMENTO DE VOUCHER */}
                <div className="p-3 bg-zinc-950/80 border border-white/5 rounded-2xl flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Link de Convite Direto</span>
                    <span className="text-xs font-mono text-zinc-300 truncate block">
                      ?voucher={lote.codigoCampanha}
                    </span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => copiarLinkVoucher(lote.codigoCampanha)}
                    className="h-8 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center gap-1.5 shrink-0"
                  >
                    {copiadoId === lote.codigoCampanha ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA CRIAÇÃO DE NOVO LOTE */}
      <Dialog open={modalNovoLoteAberto} onOpenChange={setModalNovoLoteAberto}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span>Emitir Novo Lote de Licenças B2B</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCriarLote} className="space-y-4 mt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Nome da Campanha
              </label>
              <Input
                type="text"
                value={nomeLote}
                onChange={(e) => setNomeLote(e.target.value)}
                placeholder="Ex: Campanha Primavera Gastronômica"
                required
                className="bg-zinc-950 border-zinc-800 text-white rounded-xl h-11"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Código do Voucher de Ativação
              </label>
              <Input
                type="text"
                value={codigoCampanha}
                onChange={(e) => setCodigoCampanha(e.target.value)}
                placeholder="Ex: BIERHAUS2026"
                required
                className="bg-zinc-950 border-zinc-800 text-white rounded-xl h-11 uppercase font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Total de Licenças (Cotas)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={totalLicencas}
                  onChange={(e) => setTotalLicencas(Number(e.target.value))}
                  required
                  className="bg-zinc-950 border-zinc-800 text-white rounded-xl h-11"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Validade (Meses)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={validadeMeses}
                  onChange={(e) => setValidadeMeses(Number(e.target.value))}
                  required
                  className="bg-zinc-950 border-zinc-800 text-white rounded-xl h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={salvando}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-600/30 mt-2"
            >
              {salvando ? "Emitindo Lote..." : "Confirmar Emissão do Lote"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

