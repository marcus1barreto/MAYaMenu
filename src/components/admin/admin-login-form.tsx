"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock,
  Mail,
  Store,
  Phone,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Tag,
  Gift,
} from "lucide-react";
import { CartaoConcessaoModal } from "./cartao-concessao-modal";
import { validarVoucherPatrocinio, ativarPatrocinioNoRestaurante } from "@/lib/b2b-service";
import { auth } from "@/lib/firebase";
import type { ModoOperacao } from "@/types";
import Link from "next/link";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function AdminLoginForm({ onLogado }: { onLogado?: () => void }) {
  const { login, cadastrar, atualizarRestaurante, restaurante } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<"login" | "cadastro">("login");

  // Campos de Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");

  // Campos de Cadastro Free ou Patrocinado
  const [nomeRestaurante, setNomeRestaurante] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cadastroEmail, setCadastroEmail] = useState("");
  const [cadastroSenha, setCadastroSenha] = useState("");
  const [voucherPatrocinio, setVoucherPatrocinio] = useState("");
  const [patrocinioValidado, setPatrocinioValidado] = useState<{
    patrocinadorNome: string;
    campanhaNome: string;
  } | null>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);

  // Lê voucher da URL se fornecido (ex: /admin?voucher=BIERHAUS2026)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const voucherParam = params.get("voucher") || params.get("sponsor") || "";
      if (voucherParam) {
        setVoucherPatrocinio(voucherParam.toUpperCase());
        setAbaAtiva("cadastro");
        validarVoucherPatrocinio(voucherParam).then((res) => {
          if (res.valido && res.patrocinador && res.lote) {
            setPatrocinioValidado({
              patrocinadorNome: res.patrocinador.nomeFantasia,
              campanhaNome: res.lote.nome,
            });
          }
        });
      }
    }
  }, []);

  const handleValidarVoucherAoSair = async () => {
    const cod = voucherPatrocinio.trim().toUpperCase();
    if (!cod) {
      setPatrocinioValidado(null);
      return;
    }

    try {
      const res = await validarVoucherPatrocinio(cod);
      if (res.valido && res.patrocinador && res.lote) {
        setPatrocinioValidado({
          patrocinadorNome: res.patrocinador.nomeFantasia,
          campanhaNome: res.lote.nome,
        });
        setErro(null);
      } else {
        setPatrocinioValidado(null);
        if (res.mensagem) setErro(res.mensagem);
      }
    } catch {
      // Ignora erro momentâneo
    }
  };

  // Estado para transição do Cartão de Concessão Digital
  const [concessaoEmitida, setConcessaoEmitida] = useState<{
    restauranteNome: string;
    codigoLicenca: string;
    slug: string;
    whatsapp: string;
  } | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSubmetendo(true);

    try {
      await login(loginEmail, loginSenha);
      if (onLogado) onLogado();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro na autenticação";
      setErro(msg);
    } finally {
      setSubmetendo(false);
    }
  };

  const handleCadastroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSubmetendo(true);

    try {
      if (!aceitouTermos) {
        throw new Error("Você precisa ler e concordar com os Termos de Uso e a Política de Privacidade para cadastrar seu estabelecimento.");
      }
      if (!nomeRestaurante.trim()) {
        throw new Error("Informe o nome do seu estabelecimento.");
      }
      if (cadastroSenha.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
      }

      // 1. Gera slug amigável
      let slugBase = slugify(nomeRestaurante.trim());
      if (!slugBase) {
        slugBase = `rest-${Date.now().toString().slice(-4)}`;
      }

      const { verificarSlugDisponivel } = await import("@/lib/restaurante-service");
      let slugFinal = slugBase;
      let disponivel = await verificarSlugDisponivel(slugFinal);
      if (!disponivel) {
        slugFinal = `${slugBase}-${Math.floor(100 + Math.random() * 900)}`;
      }

      // Valida voucher se informado
      const codVoucher = voucherPatrocinio.trim().toUpperCase();
      let validacaoVoucher: any = null;
      if (codVoucher) {
        validacaoVoucher = await validarVoucherPatrocinio(codVoucher);
        if (!validacaoVoucher.valido) {
          throw new Error(validacaoVoucher.mensagem || "Voucher de patrocínio inválido ou expirado.");
        }
      }

      // 2. Cadastra usuário e instância no backend (Voucher B2B ou Free automático)
      const codigoAtivacao = codVoucher || "FREE_AUTO";
      await cadastrar(
        cadastroEmail.trim(),
        cadastroSenha,
        nomeRestaurante.trim(),
        slugFinal,
        codigoAtivacao,
        "hibrido",
        {
          termsAcceptedAt: new Date().toISOString(),
          termsVersion: "1.0.0",
        }
      );

      // 3. Aciona a transição do Cartão de Concessão Digital
      setConcessaoEmitida({
        restauranteNome: nomeRestaurante.trim(),
        codigoLicenca: codVoucher || "FREE",
        slug: slugFinal,
        whatsapp: whatsapp.trim(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao emitir concessão";
      setErro(msg);
    } finally {
      setSubmetendo(false);
    }
  };

  const handleConcluirConcessao = async (ajustes: { modoOperacao: ModoOperacao; slug: string }) => {
    try {
      if (restaurante) {
        await atualizarRestaurante({
          slug: ajustes.slug,
          configuracoes: {
            ...restaurante.configuracoes,
            modoOperacao: ajustes.modoOperacao,
          },
        });
      }
    } catch (err) {
      console.warn("Falha ao salvar ajustes adicionais da concessão:", err);
    }
    setConcessaoEmitida(null);
    if (onLogado) onLogado();
  };

  return (
    <>
      {concessaoEmitida && (
        <CartaoConcessaoModal
          restauranteNome={concessaoEmitida.restauranteNome}
          codigoLicenca={concessaoEmitida.codigoLicenca}
          slug={concessaoEmitida.slug}
          whatsapp={concessaoEmitida.whatsapp}
          onConcluir={handleConcluirConcessao}
        />
      )}

      <div className="relative w-full max-w-md mx-auto p-6 sm:p-8 bg-white border border-neutral-200/80 rounded-3xl shadow-xl text-neutral-900 overflow-hidden">
        {/* Glows de ambientação suave */}
        <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-rose-600/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        {/* CABEÇALHO */}
        <div className="relative text-center space-y-2 mb-6">
          <div className="inline-flex p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 mb-1 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-neutral-950">Acesso ao MAYaMenu</h2>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">
            Painel Operacional para Gestão de Cardápio, Comandas de Mesa e KDS da Cozinha
          </p>
        </div>

        {/* SELETOR DE ABAS (ENTRAR x CADASTRAR GRÁTIS) */}
        <div className="relative grid grid-cols-2 p-1 bg-neutral-100 border border-neutral-200/80 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setAbaAtiva("login");
              setErro(null);
            }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              abaAtiva === "login"
                ? "bg-white text-neutral-950 shadow-xs border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setAbaAtiva("cadastro");
              setErro(null);
            }}
            className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              abaAtiva === "cadastro"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-rose-600 hover:text-rose-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Cadastrar Grátis
          </button>
        </div>

        {erro && (
          <div className="relative mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* ABA: ENTRAR (LOGIN) */}
        {abaAtiva === "login" && (
          <form onSubmit={handleLoginSubmit} className="relative space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                E-mail de Acesso
              </label>
              <Input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@seurestaurante.com"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl h-11 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                Senha
              </label>
              <Input
                type="password"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl h-11 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <Button
              type="submit"
              disabled={submetendo}
              className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-xs mt-2 transition-all active:scale-95"
            >
              {submetendo ? "Autenticando..." : "Entrar no Sistema"}
            </Button>
          </form>
        )}

        {/* ABA: CADASTRAR GRÁTIS (OPÇÃO C) */}
        {abaAtiva === "cadastro" && (
          <form onSubmit={handleCadastroSubmit} className="relative space-y-3.5">
            {patrocinioValidado ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800 shadow-2xs">
                <Sparkles className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <div>
                  <strong className="text-neutral-950 block">Patrocínio Master Confirmado!</strong>
                  <span>Concessão Plus subsidiada por <strong>{patrocinioValidado.patrocinadorNome}</strong> ({patrocinioValidado.campanhaNome}).</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center gap-2.5 text-xs text-neutral-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Concessão Free Vitalícia: sem mensalidade, sem cartão de crédito.</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1">
                <Store className="w-3 h-3 text-neutral-400" />
                Nome do Estabelecimento
              </label>
              <Input
                type="text"
                value={nomeRestaurante}
                onChange={(e) => setNomeRestaurante(e.target.value)}
                placeholder="Ex: Cantina da Nona, Burger House"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl h-10 text-xs focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1">
                <Phone className="w-3 h-3 text-neutral-400" />
                WhatsApp do Responsável (com DDD)
              </label>
              <Input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: (11) 98765-4321"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl h-10 text-xs focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1">
                <Mail className="w-3 h-3 text-neutral-400" />
                E-mail para Login
              </label>
              <Input
                type="email"
                value={cadastroEmail}
                onChange={(e) => setCadastroEmail(e.target.value)}
                placeholder="contato@seurestaurante.com"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl h-10 text-xs focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1">
                <Lock className="w-3 h-3 text-neutral-400" />
                Senha de Acesso (mínimo 6 dígitos)
              </label>
              <Input
                type="password"
                value={cadastroSenha}
                onChange={(e) => setCadastroSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl h-10 text-xs focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Voucher de Patrocínio Opcional */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-neutral-400" />
                  Voucher de Patrocínio / Parceria
                </span>
                <span className="text-[10px] text-neutral-400 font-normal">Opcional</span>
              </label>
              <Input
                type="text"
                value={voucherPatrocinio}
                onChange={(e) => setVoucherPatrocinio(e.target.value.toUpperCase())}
                onBlur={handleValidarVoucherAoSair}
                placeholder="Ex: BIERHAUS2026"
                className="bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 rounded-xl h-10 text-xs font-mono uppercase focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Checkbox de Aceite LGPD Obrigatório */}
            <div className="pt-2 pb-1">
              <label className="flex items-start gap-2.5 text-xs text-neutral-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aceitouTermos}
                  onChange={(e) => setAceitouTermos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer shrink-0"
                  required
                />
                <span className="leading-snug text-[11px] text-neutral-600">
                  Li e concordo com os{" "}
                  <Link
                    href="/termos-de-uso"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-rose-600 hover:text-rose-700 underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link
                    href="/politica-de-privacidade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-rose-600 hover:text-rose-700 underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Política de Privacidade (LGPD)
                  </Link>{" "}
                  da MAYaMenu.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={submetendo || !aceitouTermos}
              className={`w-full h-11 text-white font-black rounded-xl shadow-xs mt-2 transition-all flex items-center justify-center gap-2 ${
                !aceitouTermos
                  ? "bg-neutral-300 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-700 active:scale-95 cursor-pointer"
              }`}
            >
              <span>
                {submetendo
                  ? "Emitindo Concessão..."
                  : patrocinioValidado
                  ? "Ativar Meu Acesso Patrocinado Plus"
                  : "Emitir Meu Cartão de Acesso Free"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}

        {/* RODAPÉ COM LINK PARA MANUAL E POLÍTICAS LEGAIS */}
        <div className="relative mt-6 pt-5 border-t border-neutral-100 flex flex-col gap-2 text-xs text-neutral-500">
          <div className="flex items-center justify-between">
            <span>Precisa de ajuda?</span>
            <a
              href="/manual"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-rose-600 hover:text-rose-700 underline flex items-center gap-1"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Manual & Instruções
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2 text-[11px] text-neutral-400 border-t border-neutral-100">
            <Link href="/termos-de-uso" target="_blank" className="hover:text-rose-600 underline">
              Termos de Uso
            </Link>
            <span>•</span>
            <Link href="/politica-de-privacidade" target="_blank" className="hover:text-rose-600 underline">
              Privacidade (LGPD)
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
