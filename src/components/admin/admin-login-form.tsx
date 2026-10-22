"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { CartaoConcessaoModal } from "./cartao-concessao-modal";
import type { ModoOperacao } from "@/types";

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

  // Campos de Cadastro Free (Opção C)
  const [nomeRestaurante, setNomeRestaurante] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cadastroEmail, setCadastroEmail] = useState("");
  const [cadastroSenha, setCadastroSenha] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);

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

      // 2. Emissão automática de concessão Free Oficial
      const { criarNovaLicenca } = await import("@/lib/licenca-service");
      const licenca = await criarNovaLicenca({
        plano: "free",
        responsavel: cadastroEmail.trim(),
        notas: `Cadastro Direto Web. WhatsApp: ${whatsapp.trim() || "Não informado"}`,
      });

      // 3. Cadastra usuário e instância de salão
      await cadastrar(
        cadastroEmail.trim(),
        cadastroSenha,
        nomeRestaurante.trim(),
        slugFinal,
        licenca.id,
        "hibrido"
      );

      // 4. Aciona a transição do Cartão de Concessão Digital (Opção C)
      setConcessaoEmitida({
        restauranteNome: nomeRestaurante.trim(),
        codigoLicenca: licenca.id,
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

      <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white border border-neutral-200/90 rounded-3xl shadow-xl shadow-neutral-900/5 text-neutral-900">
        {/* CABEÇALHO */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 mb-1 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-neutral-950">Acesso ao MAYaMenu</h2>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">
            Painel Operacional para Gestão de Cardápio, Comandas de Mesa e KDS da Cozinha
          </p>
        </div>

        {/* SELETOR DE ABAS (ENTRAR x CADASTRAR GRÁTIS) */}
        <div className="grid grid-cols-2 p-1 bg-neutral-100 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setAbaAtiva("login");
              setErro(null);
            }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              abaAtiva === "login"
                ? "bg-white text-neutral-900 shadow-sm"
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
                ? "bg-rose-600 text-white shadow-sm"
                : "text-rose-600 hover:text-rose-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Cadastrar Grátis
          </button>
        </div>

        {erro && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* ABA: ENTRAR (LOGIN) */}
        {abaAtiva === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                E-mail de Acesso
              </label>
              <Input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@seurestaurante.com"
                required
                className="bg-neutral-50/50 border-neutral-300 text-neutral-900 rounded-xl h-11 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                Senha
              </label>
              <Input
                type="password"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-neutral-50/50 border-neutral-300 text-neutral-900 rounded-xl h-11 focus:bg-white"
              />
            </div>

            <Button
              type="submit"
              disabled={submetendo}
              className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl shadow-md shadow-rose-600/20 mt-2 transition-all"
            >
              {submetendo ? "Autenticando..." : "Entrar no Sistema"}
            </Button>
          </form>
        )}

        {/* ABA: CADASTRAR GRÁTIS (OPÇÃO C) */}
        {abaAtiva === "cadastro" && (
          <form onSubmit={handleCadastroSubmit} className="space-y-3.5">
            <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl flex items-center gap-2.5 text-xs text-rose-950">
              <ShieldCheck className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Concessão Free Vitalícia: sem mensalidade, sem cartão de crédito.</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                <Store className="w-3 h-3 text-neutral-400" />
                Nome do Estabelecimento
              </label>
              <Input
                type="text"
                value={nomeRestaurante}
                onChange={(e) => setNomeRestaurante(e.target.value)}
                placeholder="Ex: Cantina da Nona, Burger House"
                required
                className="bg-neutral-50/50 border-neutral-300 text-neutral-900 rounded-xl h-10 text-xs focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-neutral-400" />
                WhatsApp do Responsável (com DDD)
              </label>
              <Input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: (11) 98765-4321"
                required
                className="bg-neutral-50/50 border-neutral-300 text-neutral-900 rounded-xl h-10 text-xs focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                <Mail className="w-3 h-3 text-neutral-400" />
                E-mail para Login
              </label>
              <Input
                type="email"
                value={cadastroEmail}
                onChange={(e) => setCadastroEmail(e.target.value)}
                placeholder="contato@seurestaurante.com"
                required
                className="bg-neutral-50/50 border-neutral-300 text-neutral-900 rounded-xl h-10 text-xs focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                <Lock className="w-3 h-3 text-neutral-400" />
                Senha de Acesso (mínimo 6 dígitos)
              </label>
              <Input
                type="password"
                value={cadastroSenha}
                onChange={(e) => setCadastroSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-neutral-50/50 border-neutral-300 text-neutral-900 rounded-xl h-10 text-xs focus:bg-white"
              />
            </div>

            <Button
              type="submit"
              disabled={submetendo}
              className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl shadow-md shadow-rose-600/20 mt-2 transition-all flex items-center justify-center gap-2"
            >
              <span>{submetendo ? "Emitindo Concessão..." : "Emitir Meu Cartão de Acesso Free"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}

        {/* RODAPÉ COM LINK PARA MANUAL E AJUDA */}
        <div className="mt-6 pt-5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
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
      </div>
    </>
  );
}
