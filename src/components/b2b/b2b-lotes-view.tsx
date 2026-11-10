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
      {/* MÉTRICAS RÁPIDAS DAS COTAS (DESIGN OFICIAL MAYAMENU) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
              Total de Cotas Contratadas
            </span>
            <span className="text-3xl font-black text-neutral-950 mt-1 block">
              {totalGeral}
            </span>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
              Restaurantes Ativos
            </span>
            <span className="text-3xl font-black text-emerald-600 mt-1 block">
              {ativadasGeral}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
              Cotas Disponíveis para Ativação
            </span>
            <span className="text-3xl font-black text-amber-600 mt-1 block">
              {disponiveisGeral}
            </span>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-600">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CABEÇALHO DA SEÇÃO DE LOTES */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <h3 className="text-lg font-black text-neutral-950 tracking-tight flex items-center gap-2">
            <span>Lotes de Licenças & Campanhas</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
              {lotes.length} campanhas
            </span>
          </h3>
          <p className="text-xs text-neutral-500">
            Compartilhe o código de voucher ou link de convite com os bares e restaurantes da sua rede.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setModalNovoLoteAberto(true)}
          className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Contratar / Emitir Novo Lote</span>
        </Button>
      </div>

      {/* LISTA DE LOTES / CAMPANHAS */}
      {lotes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-neutral-800">Nenhum lote de licenças cadastrado</h4>
          <p className="text-xs text-neutral-500 max-w-sm mt-1">
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
                className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-xs flex flex-col justify-between gap-5 hover:border-neutral-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md inline-block font-bold">
                        VOUCHER: {lote.codigoCampanha}
                      </span>
                      <h4 className="text-base font-black text-neutral-950 mt-1.5">{lote.nome}</h4>
                    </div>

                    <Badge
                      className={`text-[10px] font-bold ${
                        expirado
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {expirado ? "Expirado" : "Campanha Ativa"}
                    </Badge>
                  </div>

                  {/* Barra de Progresso do Lote */}
                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500">Ativações Realizadas:</span>
                      <span className="font-bold text-neutral-900">
                        {lote.licencasAtivadas || 0} de {lote.totalLicencas} cotas ({perc}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-amber-500 transition-all duration-500"
                        style={{ width: `${perc}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-3">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Validade: {new Date(lote.dataExpiracao).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>

                {/* BOTÕES DE COMPARTILHAMENTO DE VOUCHER */}
                <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-2xl flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Link de Convite Direto</span>
                    <span className="text-xs font-mono text-neutral-700 truncate block font-semibold">
                      ?voucher={lote.codigoCampanha}
                    </span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => copiarLinkVoucher(lote.codigoCampanha)}
                    className="h-8 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-2xs transition-all active:scale-95"
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
        <DialogContent className="bg-white border-neutral-200 text-neutral-900 rounded-3xl max-w-md p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-neutral-950 flex items-center gap-2">
              <Layers className="w-5 h-5 text-rose-600" />
              <span>Emitir Novo Lote de Licenças B2B</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCriarLote} className="space-y-4 mt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Nome da Campanha
              </label>
              <Input
                type="text"
                value={nomeLote}
                onChange={(e) => setNomeLote(e.target.value)}
                placeholder="Ex: Campanha Primavera Gastronômica"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Código do Voucher de Ativação
              </label>
              <Input
                type="text"
                value={codigoCampanha}
                onChange={(e) => setCodigoCampanha(e.target.value)}
                placeholder="Ex: BIERHAUS2026"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11 uppercase font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Total de Licenças (Cotas)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={totalLicencas}
                  onChange={(e) => setTotalLicencas(Number(e.target.value))}
                  required
                  className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Validade (Meses)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={validadeMeses}
                  onChange={(e) => setValidadeMeses(Number(e.target.value))}
                  required
                  className="bg-neutral-50 border-neutral-200 text-neutral-900 focus:bg-white focus:border-rose-500 rounded-xl h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={salvando}
              className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-xs mt-2"
            >
              {salvando ? "Emitindo Lote..." : "Confirmar Emissão do Lote"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

