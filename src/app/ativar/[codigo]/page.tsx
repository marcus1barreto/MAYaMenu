"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { validarLicencaParaAtivacao } from "@/lib/licenca-service";
import type { Licenca } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Store,
  Globe,
  Mail,
  Lock,
  AlertCircle,
  ShieldCheck,
  Ban,
  ArrowRight,
  Flame,
  Utensils,
  ChefHat,
} from "lucide-react";
import Link from "next/link";

interface AtivarPageProps {
  params: Promise<{ codigo: string }>;
}

function AtivarContent({ codigoParam }: { codigoParam: string }) {
  const router = useRouter();
  const { cadastrar } = useAuth();

  const [verificando, setVerificando] = useState(true);
  const [licenca, setLicenca] = useState<Licenca | null>(null);
  const [erroBloqueio, setErroBloqueio] = useState<string | null>(null);

  // Campos do formulário
  const [nomeRestaurante, setNomeRestaurante] = useState("");
  const [slug, setSlug] = useState("");
  const [modoOperacao, setModoOperacao] = useState<"com_garcom" | "hibrido" | "balcao">("hibrido");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function validar() {
      setVerificando(true);
      try {
        const res = await validarLicencaParaAtivacao(codigoParam);
        if (!ativo) return;

        if (res.valida && res.licenca) {
          setLicenca(res.licenca);
          // Pré-sugere nome se houver destinatário registrado na licença
          if (res.licenca.responsavel && !nomeRestaurante) {
            const partes = res.licenca.responsavel.split("(")[0].trim();
            if (partes) {
              setNomeRestaurante(partes);
              setSlug(
                partes
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]/g, "-")
                  .replace(/-+/g, "-")
                  .replace(/^-|-$/g, "")
              );
            }
          }
        } else {
          setErroBloqueio(
            res.motivo ||
              "Este link de ativação já foi utilizado e extinto. Caso precise de uma nova instância, solicite um novo convite à MAYaRAnas Sistemas."
          );
        }
      } catch (err) {
        if (!ativo) return;
        setErroBloqueio(
          "Não foi possível validar este link de ativação no momento. Verifique sua conexão."
        );
      } finally {
        if (ativo) setVerificando(false);
      }
    }

    validar();

    return () => {
      ativo = false;
    };
  }, [codigoParam]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const limpo = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
    setSlug(limpo);
  };

  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNomeRestaurante(val);
    if (!slug || slug === "meu-restaurante") {
      setSlug(
        val
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenca) return;

    setErroForm(null);
    setSubmetendo(true);

    try {
      if (!nomeRestaurante.trim()) throw new Error("Informe o nome do estabelecimento.");
      if (!slug.trim()) throw new Error("Defina o slug da URL pública.");
      if (senha.length < 6) throw new Error("A senha deve conter no mínimo 6 caracteres.");

      // Executa cadastro e queima atômica da licença
      await cadastrar(email, senha, nomeRestaurante, slug, licenca.id, modoOperacao);

      // Redireciona imediatamente para o painel admin ativo
      router.push("/admin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao concluir ativação.";
      setErroForm(msg);
      setSubmetendo(false);
    }
  };

  // 1. ESTADO DE CARREGAMENTO / VERIFICAÇÃO CRIPTOGRÁFICA
  if (verificando) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 bg-rose-600/10 border border-rose-500/20 rounded-2xl text-rose-500 animate-pulse">
            <Flame className="w-8 h-8" />
          </div>
          <span className="text-xs uppercase font-bold tracking-widest text-neutral-400 animate-pulse">
            Validando Link de Ativação Efêmero...
          </span>
        </div>
      </div>
    );
  }

  // 2. CENÁRIO B: LINK EXTINTO, REVOGADO OU EXPIRADO (Bloqueio sem inputs no DOM)
  if (erroBloqueio || !licenca) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 text-white">
        <div className="w-full max-w-md p-8 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Ban className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight text-white">
              Link de Ativação Inativo
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {erroBloqueio ||
                "Este link de ativação já foi utilizado e extinto. Caso precise de uma nova instância, solicite um novo convite à MAYaRAnas Sistemas."}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link href="/admin">
              <Button className="w-full h-11 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider">
                Ir para Login de Lojistas
              </Button>
            </Link>
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full text-xs text-neutral-500 hover:text-white"
              >
                Voltar ao Início
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. CENÁRIO A: LICENÇA VÁLIDA E DISPONÍVEL (Formulário Limpo de Onboarding)
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-lg p-8 md:p-10 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl space-y-6">
        {/* CABEÇALHO */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-rose-600/10 border border-rose-500/20 rounded-2xl text-rose-500 mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Boas-vindas ao MAYaMenu
          </h1>
          <p className="text-xs text-neutral-400">
            Configure seu novo estabelecimento para ativar sua instância oficial.
          </p>

          {/* BADGE DE CONFIRMAÇÃO DA LICENÇA (Código embutido e imutável) */}
          <div className="pt-2 flex items-center justify-center gap-2">
            <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              Licença Verificada: {licenca.id} ({licenca.plano.toUpperCase()})
            </Badge>
          </div>
        </div>

        {erroForm && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{erroForm}</span>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-rose-500" />
              Nome do Estabelecimento
            </label>
            <Input
              value={nomeRestaurante}
              onChange={handleNomeChange}
              placeholder="Ex: Burger do Marcus"
              required
              className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-rose-500" />
              Slug da URL Pública do Cardápio
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-mono select-none">
                /r/
              </span>
              <Input
                value={slug}
                onChange={handleSlugChange}
                placeholder="burger-do-marcus"
                required
                className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11 pl-9 font-mono text-xs"
              />
            </div>
            <p className="text-[10px] text-neutral-400">
              Endereço único que seus clientes acessarão na mesa através do QR Code.
            </p>
          </div>

          {/* MODO DE OPERAÇÃO DO ESTABELECIMENTO */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-rose-500" />
              Modelo Operacional do Salão
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setModoOperacao("hibrido")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  modoOperacao === "hibrido"
                    ? "bg-rose-950/40 border-rose-500 text-white"
                    : "bg-neutral-800/50 border-neutral-700/60 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                <span className="text-xs font-bold block text-white">Híbrido (Padrão)</span>
                <span className="text-[10px] text-neutral-400 block mt-0.5 leading-snug">
                  Pedido vai direto à cozinha; garçom dá suporte, serve e cobra.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModoOperacao("com_garcom")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  modoOperacao === "com_garcom"
                    ? "bg-rose-950/40 border-rose-500 text-white"
                    : "bg-neutral-800/50 border-neutral-700/60 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                <span className="text-xs font-bold block text-white">Com Garçom</span>
                <span className="text-[10px] text-neutral-400 block mt-0.5 leading-snug">
                  Garçom valida cada pedido antes de liberar para a cozinha.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModoOperacao("balcao")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  modoOperacao === "balcao"
                    ? "bg-rose-950/40 border-rose-500 text-white"
                    : "bg-neutral-800/50 border-neutral-700/60 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                <span className="text-xs font-bold block text-white">Sem Garçom</span>
                <span className="text-[10px] text-neutral-400 block mt-0.5 leading-snug">
                  Autoatendimento: cliente pede e retira no balcão / paga no caixa.
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                E-mail do Administrador
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marcus@email.com"
                required
                className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11 text-xs"
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
                minLength={6}
                className="bg-neutral-800/80 border-neutral-700 text-white rounded-xl h-11 text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submetendo}
            className="w-full h-12 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
          >
            {submetendo ? (
              "Ativando Instância..."
            ) : (
              <>
                Ativar Estabelecimento & Entrar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          <p className="text-[11px] text-neutral-500 text-center flex items-center justify-center gap-1.5 pt-1">
            <Flame className="w-3.5 h-3.5 text-rose-500/70" />
            Padrão Burn-After-Reading: este link será extinto logo após o envio.
          </p>
        </form>
      </div>
    </div>
  );
}

function AtivarWrapper({ params }: AtivarPageProps) {
  const resolvedParams = use(params);

  return <AtivarContent codigoParam={resolvedParams.codigo} />;
}

export default function AtivarPage({ params }: AtivarPageProps) {
  return (
    <AuthProvider>
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-white">
            <div className="flex flex-col items-center gap-3">
              <div className="p-3.5 bg-rose-600/10 border border-rose-500/20 rounded-2xl text-rose-500 animate-pulse">
                <Flame className="w-8 h-8" />
              </div>
              <span className="text-xs uppercase font-bold tracking-widest text-neutral-400 animate-pulse">
                Iniciando Verificação Segura...
              </span>
            </div>
          </div>
        }
      >
        <AtivarWrapper params={params} />
      </React.Suspense>
    </AuthProvider>
  );
}
