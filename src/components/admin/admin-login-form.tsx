"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, AlertCircle } from "lucide-react";

export function AdminLoginForm({ onLogado }: { onLogado?: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSubmetendo(true);

    try {
      await login(email, senha);
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
        <h2 className="text-2xl font-black tracking-tight">Painel de Acesso</h2>
        <p className="text-xs text-neutral-400">
          Acesso exclusivo para Gestão, KDS da Cozinha e Garçom
        </p>
      </div>

      {erro && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
          {submetendo ? "Processando..." : "Entrar no Sistema"}
        </Button>
      </form>
    </div>
  );
}
