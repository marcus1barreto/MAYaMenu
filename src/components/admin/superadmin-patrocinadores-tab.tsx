"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Phone,
  Mail,
  User,
  Layers,
  Sparkles,
  Store,
  Calendar,
  X,
  TrendingUp,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import type { PatrocinadorB2B } from "@/types/b2b";
import {
  cadastrarPatrocinadorSuperadmin,
  alternarStatusPatrocinador,
} from "@/lib/b2b-service";

interface SuperadminPatrocinadoresTabProps {
  patrocinadores: PatrocinadorB2B[];
  ehSuperAdmin: boolean;
  onNotificarSucesso: (msg: string) => void;
  onNotificarErro: (msg: string) => void;
}

export function SuperadminPatrocinadoresTab({
  patrocinadores,
  ehSuperAdmin,
  onNotificarSucesso,
  onNotificarErro,
}: SuperadminPatrocinadoresTabProps) {
  const [filtro, setFiltro] = useState("");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Campos do formulário
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [contatoCargo, setContatoCargo] = useState("");
  const [totalCotas, setTotalCotas] = useState("50");
  const [validadeMeses, setValidadeMeses] = useState("12");

  // Modal de sucesso pós-criação
  const [patrocinadorRecemCriado, setPatrocinadorRecemCriado] = useState<{
    nome: string;
    chaveAcessoB2B: string;
    codigoVoucherInicial: string;
  } | null>(null);

  const patrocinadoresFiltrados = patrocinadores.filter((p) => {
    const q = filtro.toLowerCase();
    return (
      p.nomeFantasia.toLowerCase().includes(q) ||
      p.razaoSocial?.toLowerCase().includes(q) ||
      p.cnpj?.toLowerCase().includes(q) ||
      p.chaveAcessoB2B?.toLowerCase().includes(q) ||
      p.contatoResponsavel?.nome?.toLowerCase().includes(q)
    );
  });

  const handleCopiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const handleCriarPatrocinador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ehSuperAdmin) {
      onNotificarErro("Você precisa estar autenticado como Operador para cadastrar patrocinadores.");
      return;
    }

    if (!nomeFantasia.trim() || !cnpj.trim() || !contatoEmail.trim()) {
      onNotificarErro("Preencha Nome Fantasia, CNPJ e E-mail do responsável.");
      return;
    }

    setSalvando(true);
    try {
      const res = await cadastrarPatrocinadorSuperadmin({
        nomeFantasia: nomeFantasia.trim(),
        razaoSocial: razaoSocial.trim() || nomeFantasia.trim(),
        cnpj: cnpj.trim(),
        contatoNome: contatoNome.trim() || "Representante de Trade",
        contatoEmail: contatoEmail.trim(),
        contatoTelefone: contatoTelefone.trim() || "(00) 00000-0000",
        contatoCargo: contatoCargo.trim() || "Gestor de Contas B2B",
        totalCotasContratadas: parseInt(totalCotas, 10) || 50,
        validadeMeses: parseInt(validadeMeses, 10) || 12,
      });

      setPatrocinadorRecemCriado({
        nome: nomeFantasia,
        chaveAcessoB2B: res.chaveAcessoB2B,
        codigoVoucherInicial: res.codigoVoucherInicial,
      });

      // Limpa formulário
      setNomeFantasia("");
      setRazaoSocial("");
      setCnpj("");
      setContatoNome("");
      setContatoEmail("");
      setContatoTelefone("");
      setContatoCargo("");
      setTotalCotas("50");
      setValidadeMeses("12");
      setModalNovoAberto(false);

      onNotificarSucesso(`Patrocinador ${nomeFantasia} cadastrado com sucesso!`);
    } catch (err: any) {
      onNotificarErro(err?.message || "Falha ao cadastrar patrocinador.");
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarStatus = async (patrocinador: PatrocinadorB2B) => {
    if (!ehSuperAdmin) {
      onNotificarErro("Apenas Operadores autenticados podem alterar o status do patrocinador.");
      return;
    }

    try {
      const novoStatus = !patrocinador.ativo;
      await alternarStatusPatrocinador(patrocinador.id, novoStatus);
      onNotificarSucesso(
        `Patrocinador ${patrocinador.nomeFantasia} ${novoStatus ? "reativado" : "suspenso"}!`
      );
    } catch (err: any) {
      onNotificarErro(err?.message || "Falha ao alterar status.");
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA ABA B2B */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2 text-foreground">
            <Building2 className="w-5 h-5 text-rose-600" />
            Patrocinadores Corporativos & Trade Marketing B2B ({patrocinadores.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Gerencie marcas da indústria, chaves de contrato B2B, cotas em lote de restaurantes e isolamento de sell-out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por marca, CNPJ ou chave..."
              className="bg-card border-border text-foreground pl-9 rounded-xl h-9 text-xs shadow-xs focus-visible:ring-1 focus-visible:ring-rose-500"
            />
          </div>

          <Button
            type="button"
            onClick={() => setModalNovoAberto(true)}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-md shadow-rose-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Patrocinador</span>
          </Button>
        </div>
      </div>

      {/* CARDS DE RESUMO DE PRIVACIDADE E SEGURANÇA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Isolamento de Tenants
          </span>
          <p className="text-xs text-foreground font-semibold">
            Privacidade Estrita Entre Marcas
          </p>
          <p className="text-[11px] text-muted-foreground">
            Cada patrocinador só visualiza seus próprios lotes e o sell-out dos seus próprios itens cadastrados.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            Uso Único & Burn-After-Reading
          </span>
          <p className="text-xs text-foreground font-semibold">
            Trava Atômica de Cotas
          </p>
          <p className="text-[11px] text-muted-foreground">
            Vouchers e licenças atrelam-se irreversivelmente ao restaurante ativado, impedindo clonagem ou reutilização.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
            Proteção do Dono do Bar
          </span>
          <p className="text-xs text-foreground font-semibold">
            Sigilo de Receita Global
          </p>
          <p className="text-[11px] text-muted-foreground">
            A indústria nunca tem acesso ao faturamento global do restaurante, apenas às unidades vendidas da sua marca.
          </p>
        </div>
      </div>

      {/* LISTA / GRID DE PATROCINADORES */}
      {patrocinadoresFiltrados.length === 0 ? (
        <div className="p-16 text-center bg-card border border-border rounded-3xl space-y-3 shadow-xs">
          <Building2 className="w-12 h-12 text-muted-foreground/60 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">Nenhum patrocinador encontrado</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {filtro ? "Tente buscar por outro termo ou limpe a busca." : "Cadastre sua primeira marca parceira para emitir lotes corporativos."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {patrocinadoresFiltrados.map((pat) => {
            const ehDemo = pat.id === "spn-bierhaus-demo";
            const linkPortal = `/parceiros?chave=${encodeURIComponent(pat.chaveAcessoB2B || pat.id)}`;

            return (
              <div
                key={pat.id}
                className={`p-5 rounded-3xl bg-card border transition-all shadow-xs flex flex-col justify-between gap-4 ${
                  pat.ativo ? "border-border hover:border-rose-300" : "border-rose-200 bg-rose-50/20 opacity-80"
                }`}
              >
                {/* TOPO DO CARD */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-black text-lg shrink-0">
                      {pat.nomeFantasia.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-foreground">
                          {pat.nomeFantasia}
                        </h3>
                        {ehDemo && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            Modelo Demonstração
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pat.razaoSocial} • <span className="font-mono">{pat.cnpj}</span>
                      </p>
                    </div>
                  </div>

                  <Badge
                    className={
                      pat.ativo
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold uppercase"
                        : "bg-rose-50 text-rose-800 border-rose-200 text-[10px] font-bold uppercase"
                    }
                  >
                    {pat.ativo ? "Contrato Ativo" : "Suspenso"}
                  </Badge>
                </div>

                {/* CORPO DO CARD COM DETALHES DE TOKEN E CONTATO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/80 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      Chave B2B (Token de Contrato)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground bg-background px-2 py-1 rounded-lg border border-border text-[11px]">
                        {pat.chaveAcessoB2B || "SPN-DEMO-2026"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopiar(pat.chaveAcessoB2B || "SPN-DEMO-2026", pat.id)}
                        className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                        title="Copiar Chave do Patrocinador"
                      >
                        {copiadoId === pat.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      Responsável de Trade Marketing
                    </span>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      <p className="font-semibold text-foreground flex items-center gap-1">
                        <User className="w-3 h-3 text-rose-600" />
                        {pat.contatoResponsavel?.nome || "Não informado"}
                      </p>
                      <p className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {pat.contatoResponsavel?.email || "contato@marca.com.br"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RODAPÉ DO CARD COM AÇÕES */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                  <Link href={linkPortal} target="_blank">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 rounded-xl text-xs font-bold bg-background hover:bg-muted text-foreground flex items-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
                      <span>Abrir Portal B2B</span>
                    </Button>
                  </Link>

                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`h-8 px-3 rounded-xl text-xs font-bold ${
                            pat.ativo
                              ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          }`}
                        >
                          {pat.ativo ? "Suspender Contrato" : "Reativar Contrato"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
                        <AlertDialogHeader className="space-y-2">
                          <AlertDialogTitle className="text-base font-black flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            {pat.ativo ? "Suspender Acesso do Patrocinador?" : "Reativar Patrocinador?"}
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            {pat.ativo
                              ? `Ao suspender o contrato de ${pat.nomeFantasia}, a chave B2B ${pat.chaveAcessoB2B} será bloqueada e o acesso ao portal de patrocinadores será revogado temporariamente.`
                              : `A chave B2B de ${pat.nomeFantasia} voltará a ser válida e a equipe poderá acessar o portal normalmente.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-2">
                          <AlertDialogCancel className="rounded-xl text-xs">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleAlternarStatus(pat)}
                            className={`rounded-xl text-xs font-bold text-white ${
                              pat.ativo ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
                            }`}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CADASTRAR NOVO PATROCINADOR B2B */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-foreground">
              <Building2 className="w-5 h-5 text-rose-600" />
              <span>Cadastrar Novo Patrocinador B2B</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Insira os dados da indústria/marca contratante. O sistema gerará a chave B2B e o primeiro lote de licenças automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarPatrocinador} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Nome Fantasia (Marca) *
                </label>
                <Input
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Ex: Cervejaria BierHaus"
                  required
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  CNPJ *
                </label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  required
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Razão Social
              </label>
              <Input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex: BierHaus Indústria e Comércio de Bebidas S.A."
                className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Nome do Responsável de Trade
                </label>
                <Input
                  value={contatoNome}
                  onChange={(e) => setContatoNome(e.target.value)}
                  placeholder="Ex: Roberto Silveira"
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cargo
                </label>
                <Input
                  value={contatoCargo}
                  onChange={(e) => setContatoCargo(e.target.value)}
                  placeholder="Ex: Gerente Nacional de Canais"
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  E-mail do Responsável *
                </label>
                <Input
                  type="email"
                  value={contatoEmail}
                  onChange={(e) => setContatoEmail(e.target.value)}
                  placeholder="roberto@bierhaus.com.br"
                  required
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Telefone Comercial
                </label>
                <Input
                  value={contatoTelefone}
                  onChange={(e) => setContatoTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cotas de Licenças Contratadas
                </label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={totalCotas}
                  onChange={(e) => setTotalCotas(e.target.value)}
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Validade do Contrato (meses)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="36"
                  value={validadeMeses}
                  onChange={(e) => setValidadeMeses(e.target.value)}
                  className="bg-background border-border text-foreground rounded-xl h-10 text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalNovoAberto(false)}
                className="text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-md shadow-rose-600/20"
              >
                {salvando ? "Emitindo Contrato..." : "Cadastrar & Gerar Chave B2B"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: SUCESSO PÓS-CRIAÇÃO DO PATROCINADOR */}
      {patrocinadorRecemCriado && (
        <Dialog
          open={!!patrocinadorRecemCriado}
          onOpenChange={() => setPatrocinadorRecemCriado(null)}
        >
          <DialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl space-y-4">
            <DialogHeader className="space-y-2 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg font-black text-foreground">
                Patrocinador Emitido com Sucesso!
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Envie as credenciais abaixo para a equipe comercial ou responsável da marca{" "}
                <strong className="text-foreground">{patrocinadorRecemCriado.nome}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 bg-muted/40 p-4 rounded-2xl border border-border text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Chave de Acesso B2B (Token de Contrato)
                </span>
                <div className="flex items-center justify-between mt-1 bg-background p-2 rounded-xl border border-border">
                  <span className="font-mono font-bold text-foreground text-sm">
                    {patrocinadorRecemCriado.chaveAcessoB2B}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopiar(patrocinadorRecemCriado.chaveAcessoB2B, "chave-sucesso")
                    }
                    className="h-7 px-2 text-xs"
                  >
                    {copiadoId === "chave-sucesso" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Voucher da Campanha Inicial
                </span>
                <div className="flex items-center justify-between mt-1 bg-background p-2 rounded-xl border border-border">
                  <span className="font-mono font-bold text-foreground text-sm">
                    {patrocinadorRecemCriado.codigoVoucherInicial}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopiar(patrocinadorRecemCriado.codigoVoucherInicial, "voucher-sucesso")
                    }
                    className="h-7 px-2 text-xs"
                  >
                    {copiadoId === "voucher-sucesso" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Link de Acesso Direto ao Portal
                </span>
                <p className="font-mono text-[10px] text-muted-foreground truncate mt-1">
                  mayamenu.com.br/parceiros?chave={patrocinadorRecemCriado.chaveAcessoB2B}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setPatrocinadorRecemCriado(null)}
              className="w-full h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider"
            >
              Concluir e Voltar ao Painel
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
