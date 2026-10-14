"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, Store, Globe, AlertCircle, Sparkles } from "lucide-react";

export function AdminLoginForm({ onLogado }: { onLogado?: () => void }) {
  const { login, cadastrar } = useAuth();
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nomeRestaurante, setNomeRestaurante] = useState("");
  const [slug, setSlug] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSubmetendo(true);

    try {
      if (modo === "login") {
        await login(email, senha);
      } else {
        if (!nomeRestaurante.trim() || !slug.trim()) {
          throw new Error("Preencha o nome do restaurante e o slug da URL.");
        }
        await cadastrar(email, senha, nomeRestaurante, slug);
      }
      if (onLogado) onLogado();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro na autenticação";
      setErro(msg);
    } finally {
      setSubmetendo(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl text-white">
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex p-3 bg-rose-600/10 border border-rose-500/20 rounded-2xl text-rose-500 mb-2">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          {modo === "login" ? "Painel de Acesso Único" : "Criar Meu Restaurante"}
        </h2>
        <p className="text-xs text-neutral-400">
          {modo === "login"
            ? "Acesso para Gestão, KDS da Cozinha e Garçom (Alpha)"
            : "Cadastre-se para gerar seu cardápio e painel"}
        </p>
      </div>

      {erro && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* DICA DE CREDENCIAIS DE TESTE */}
      {modo === "login" && (
        <div className="mb-6 p-3.5 bg-neutral-800/80 border border-neutral-700/80 rounded-2xl flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">
              Credenciais de Teste Alpha
            </span>
            <span className="text-neutral-300 font-mono text-[11px]">admin@mayamenu.com • 123456</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail("admin@mayamenu.com");
              setSenha("123456");
            }}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold transition-colors"
          >
            Preencher
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {modo === "cadastro" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                Nome do Estabelecimento
              </label>
              <Input
                value={nomeRestaurante}
                onChange={(e) => setNomeRestaurante(e.target.value)}
                placeholder="Ex: Burger do Marcus"
                required
                className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Slug da URL Pública (/r/[slug])
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="Ex: burger-do-marcus"
                required
                className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            E-mail do Administrador
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@seurestaurante.com"
            required
            className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Senha de Acesso
          </label>
          <Input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            required
            className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11"
          />
        </div>

        <Button
          type="submit"
          disabled={submetendo}
          className="w-full h-12 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg mt-4"
        >
          {submetendo
            ? "Processando..."
            : modo === "login"
            ? "Entrar no Sistema"
            : "Finalizar Cadastro e Abrir Painel"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setModo((m) => (m === "login" ? "cadastro" : "login"));
            setErro(null);
          }}
          className="text-xs text-neutral-400 hover:text-white underline font-medium transition-colors"
        >
          {modo === "login"
            ? "Não tem uma conta? Crie seu restaurante aqui"
            : "Já possui conta? Fazer login"}
        </button>
      </div>
    </div>
  );
}
