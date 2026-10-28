"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  criarNovaLicenca,
  criarLoteLicencas,
  baixarCSVLicencas,
  formatarLicencasClipboard,
  escutarLicencas,
  escutarArquivoMorto,
  escutarRestaurantes,
  alterarStatusLicenca,
  alterarStatusRestaurante,
  alterarPlanoRestaurante,
  renovarValidadeLicenca,
  revogarLicenca,
  arquivarLicencaExpirada,
  LIMITES_POR_PLANO,
} from "@/lib/licenca-service";
import type { Licenca, LicencaArquivada, PlanoTipo, Restaurante } from "@/types";
import { parseDateToMillis } from "@/lib/datas";
import { auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  ClockAlert,
  CalendarPlus,
  Trash2,
  AlertTriangle,
  LogIn,
  LogOut,
  CheckCircle2,
  MessageCircle,
  Loader2,
  FileSpreadsheet,
  Layers2,
  FileDown,
  Boxes,
  BookOpen,
} from "lucide-react";

export const EMAILS_SUPERADMIN_AUTORIZADOS = [
  "admin@mayamenu.com",
  "teste@teste.com",
  "marcus1fialho@gmail.com",
];

export function SuperAdminView() {
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [arquivoMorto, setArquivoMorto] = useState<LicencaArquivada[]>([]);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<"restaurantes" | "ativas" | "vencidas" | "arquivo_morto">("restaurantes");
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

  // Fábrica de Concessões em Lote (Campanhas Comerciais)
  const [modoEmissao, setModoEmissao] = useState<"individual" | "lote">("individual");
  const [quantidadeLote, setQuantidadeLote] = useState<string>("5");
  const [loteRecemCriado, setLoteRecemCriado] = useState<Licenca[]>([]);
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [copiadoLoteTexto, setCopiadoLoteTexto] = useState(false);

  // Estado de Autenticação do Operador do SuperAdmin
  const [usuarioAuth, setUsuarioAuth] = useState<User | null>(null);
  const [modalLoginAberto, setModalLoginAberto] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);
  const [erroAuth, setErroAuth] = useState<string | null>(null);

  // Alertas de feedback da interface
  const [alertaErro, setAlertaErro] = useState<string | null>(null);
  const [alertaSucesso, setAlertaSucesso] = useState<string | null>(null);

  // Transição não bloqueante com React 19 para o Grid de Estabelecimentos
  const [isPending, startTransition] = useTransition();
  const [pendingRestauranteId, setPendingRestauranteId] = useState<string | null>(null);

  useEffect(() => {
    const unsubLicencas = escutarLicencas((dados) => {
      setLicencas(dados);
    });
    const unsubArquivo = escutarArquivoMorto((dados) => {
      setArquivoMorto(dados);
    });
    const unsubRestaurantes = escutarRestaurantes((dados) => {
      setRestaurantes(dados);
    });
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setUsuarioAuth(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
          document.cookie = `__session=${token}; path=/; ${isHttps ? "secure;" : ""} samesite=lax; max-age=3600`;
        } catch (e) {
          console.warn("Aviso ao sincronizar token no superadmin:", e);
        }
      } else {
        document.cookie = `__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    });
    return () => {
      unsubLicencas();
      unsubArquivo();
      unsubRestaurantes();
      unsubAuth();
    };
  }, []);

  const handleLoginOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutenticando(true);
    setErroAuth(null);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginSenha);
      setModalLoginAberto(false);
      setLoginSenha("");
      setAlertaSucesso("Operador SuperAdmin autenticado com sucesso!");
      setAlertaErro(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha na autenticação.";
      setErroAuth(msg);
    } finally {
      setAutenticando(false);
    }
  };

  const handleLogoutOperador = async () => {
    try {
      await signOut(auth);
      setAlertaSucesso("Sessão administrativa encerrada.");
    } catch (err) {
      console.error("Erro ao desconectar:", err);
    }
  };

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
      setAlertaSucesso(`Concessão ${nova.id} (${planoSelecionado.toUpperCase()}) emitida com sucesso!`);
      setAlertaErro(null);
    } catch (err: unknown) {
      console.error("Falha ao criar licença:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setAlertaErro(`Falha ao emitir concessão: ${msg}`);
    } finally {
      setCriando(false);
    }
  };

  const handleCriarLoteLicencas = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriando(true);
    try {
      const qtd = Number(quantidadeLote) || 5;
      const horas = validadeHoras ? Number(validadeHoras) : undefined;
      const novas = await criarLoteLicencas({
        quantidade: qtd,
        plano: planoSelecionado,
        responsavelPrefixo: responsavel,
        notas,
        horasValidade: horas && horas > 0 ? horas : undefined,
        limitesPersonalizados: {
          maxPratos: maxPratosCustom ? Number(maxPratosCustom) : undefined,
          maxMesas: maxMesasCustom ? Number(maxMesasCustom) : undefined,
        },
      });

      // Atualização atômica na UI
      setLicencas((prev) => [...novas, ...prev]);
      setLoteRecemCriado(novas);
      setModalLoteAberto(true);
      setAlertaSucesso(`Fábrica de Licenças: ${novas.length} concessões (${planoSelecionado.toUpperCase()}) emitidas em lote com sucesso!`);
      setAlertaErro(null);
    } catch (err: unknown) {
      console.error("Falha ao fabricar lote de concessões:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setAlertaErro(`Falha na fábrica de concessões: ${msg}`);
    } finally {
      setCriando(false);
    }
  };

  const handleBaixarCSV = (lista: Licenca[]) => {
    baixarCSVLicencas(lista);
    setAlertaSucesso("Planilha CSV baixada com sucesso!");
  };

  const handleCopiarLoteClipboard = (lista: Licenca[]) => {
    const texto = formatarLicencasClipboard(lista);
    navigator.clipboard.writeText(texto);
    setCopiadoLoteTexto(true);
    setTimeout(() => setCopiadoLoteTexto(false), 2500);
  };

  const handleAlterarStatus = async (codigo: string, novoStatus: "ativa" | "suspensa" | "revogada") => {
    // Atualização otimista imediata na UI
    setLicencas((prev) =>
      prev.map((lic) => (lic.id === codigo ? { ...lic, status: novoStatus } : lic))
    );
    try {
      await alterarStatusLicenca(codigo, novoStatus);
      setAlertaSucesso(`Status da licença ${codigo} alterado para ${novoStatus.toUpperCase()}.`);
    } catch (err: unknown) {
      console.warn("Falha ao alterar status remoto da licença:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setAlertaErro(`Erro ao atualizar licença: ${msg}`);
    }
  };

  const handleAlterarPlano = async (
    restauranteId: string,
    novoPlano: PlanoTipo,
    licencaCodigo?: string
  ) => {
    // Alerta se não estiver autenticado de forma não anônima
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      setAlertaErro(
        "Atenção: Para alterar planos de estabelecimentos no Firestore, faça login como operador administrativo no topo da página."
      );
      setModalLoginAberto(true);
      return;
    }

    setPendingRestauranteId(restauranteId);

    startTransition(async () => {
      const novosLimites = LIMITES_POR_PLANO[novoPlano];
      const restAlvo = restaurantes.find((r) => r.id === restauranteId);
      const planoAnterior = restAlvo?.plano || restAlvo?.licenca?.plano || "free";

      // Atualização otimista na lista de concessões
      setLicencas((prev) =>
        prev.map((lic) =>
          lic.restauranteId === restauranteId || (licencaCodigo && lic.id === licencaCodigo)
            ? { ...lic, plano: novoPlano, limites: novosLimites }
            : lic
        )
      );
      // Atualização otimista na lista de restaurantes
      setRestaurantes((prev) =>
        prev.map((r) =>
          r.id === restauranteId
            ? {
                ...r,
                plano: novoPlano,
                maxMesas: novosLimites.maxMesas,
                maxPratos: novosLimites.maxPratos,
                licenca: {
                  ...r.licenca,
                  plano: novoPlano,
                  limites: novosLimites,
                },
              }
            : r
        )
      );

      try {
        await alterarPlanoRestaurante(restauranteId, novoPlano, licencaCodigo);
        setAlertaSucesso(`Plano do estabelecimento alterado para ${novoPlano.toUpperCase()} com sucesso!`);
        setAlertaErro(null);
      } catch (err: unknown) {
        console.error("Erro ao alterar plano do restaurante:", err);
        // Reverte estado otimista para o anterior em caso de falha
        const limitesAnteriores = LIMITES_POR_PLANO[planoAnterior as PlanoTipo] || LIMITES_POR_PLANO.free;
        setRestaurantes((prev) =>
          prev.map((r) =>
            r.id === restauranteId
              ? {
                  ...r,
                  plano: planoAnterior,
                  maxMesas: limitesAnteriores.maxMesas,
                  maxPratos: limitesAnteriores.maxPratos,
                }
              : r
          )
        );
        const msg = err instanceof Error ? err.message : String(err);
        setAlertaErro(`Falha ao salvar no Firestore: ${msg}. Verifique se você está logado.`);
      } finally {
        setPendingRestauranteId(null);
      }
    });
  };

  const handleAlterarSuspensaoRestaurante = async (
    restauranteId: string,
    suspenso: boolean
  ) => {
    // Alerta se não estiver autenticado
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      setAlertaErro(
        "Atenção: Para suspender ou reativar estabelecimentos no Firestore, faça login como operador administrativo no topo da página."
      );
      setModalLoginAberto(true);
      return;
    }

    setPendingRestauranteId(restauranteId);

    startTransition(async () => {
      const estadoAnterior = restaurantes.find((r) => r.id === restauranteId)?.suspenso || false;

      // Atualização otimista
      setRestaurantes((prev) =>
        prev.map((r) =>
          r.id === restauranteId
            ? {
                ...r,
                suspenso,
                configuracoes: {
                  ...r.configuracoes,
                  suspenso,
                },
              }
            : r
        )
      );
      try {
        await alterarStatusRestaurante(restauranteId, suspenso);
        setAlertaSucesso(
          suspenso
            ? "Estabelecimento suspenso! Acesso de clientes, mesas e KDS pausados em tempo real."
            : "Estabelecimento reativado com sucesso! Cardápio e mesas liberados."
        );
        setAlertaErro(null);
      } catch (err: unknown) {
        console.error("Erro ao alterar suspensão do restaurante:", err);
        // Reverte estado otimista
        setRestaurantes((prev) =>
          prev.map((r) =>
            r.id === restauranteId
              ? {
                  ...r,
                  suspenso: estadoAnterior,
                  configuracoes: {
                    ...r.configuracoes,
                    suspenso: estadoAnterior,
                  },
                }
              : r
          )
        );
        const msg = err instanceof Error ? err.message : String(err);
        setAlertaErro(`Falha ao alterar suspensão no Firestore: ${msg}.`);
      } finally {
        setPendingRestauranteId(null);
      }
    });
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

  const handleCompartilharWhatsApp = (lic: Licenca) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/ativar/${lic.id}`;
    const planoNome = lic.plano.toUpperCase();
    const texto = encodeURIComponent(
      `Olá${lic.responsavel ? ` ${lic.responsavel}` : ""}! Segue o seu link de concessão exclusivo para ativação do MAYaMenu (${planoNome}):\n\n🔗 ${url}\n\nCódigo de Concessão: ${lic.id}\n(Válido por tempo limitado. Basta clicar no link acima para cadastrar seu restaurante).`
    );
    window.open(`https://api.whatsapp.com/send?text=${texto}`, "_blank");
  };

  const aplicarPreset = (plano: PlanoTipo, horas: string) => {
    setPlanoSelecionado(plano);
    setValidadeHoras(horas);
    setMaxPratosCustom("");
    setMaxMesasCustom("");
  };

  const handleRenovarLicenca = async (codigo: string) => {
    const novaData = new Date(Date.now() + 48 * 60 * 60 * 1000);
    setLicencas((prev) =>
      prev.map((l) =>
        l.id === codigo
          ? { ...l, expiracaoEm: novaData, status: "disponivel" as const }
          : l
      )
    );
    try {
      await renovarValidadeLicenca(codigo, 48);
    } catch (err) {
      console.error("Erro ao renovar validade da licença:", err);
    }
  };

  const handleRevogarLicenca = async (codigo: string) => {
    setLicencas((prev) => prev.filter((l) => l.id !== codigo));
    try {
      await revogarLicenca(codigo);
    } catch (err) {
      console.error("Erro ao revogar licença:", err);
    }
  };

  const handleArquivarExpirada = async (lic: Licenca) => {
    setLicencas((prev) => prev.filter((l) => l.id !== lic.id));
    try {
      await arquivarLicencaExpirada(lic);
    } catch (err) {
      console.error("Erro ao arquivar licença expirada:", err);
    }
  };

  const [agoraMillis, setAgoraMillis] = useState<number | null>(null);

  useEffect(() => {
    setAgoraMillis(Date.now());
  }, []);

  const isLicencaVencida = (lic: Licenca) => {
    if (lic.status === "utilizada" || lic.status === "ativa") return false;
    if (!lic.expiracaoEm) return false;
    const expMillis = parseDateToMillis(lic.expiracaoEm);
    return expMillis !== null && agoraMillis !== null && expMillis < agoraMillis;
  };

  const licencasFiltradas = licencas.filter((lic) => {
    const termo = filtro.toLowerCase();
    const matchTermo = (
      lic.id.toLowerCase().includes(termo) ||
      (lic.restauranteNome && lic.restauranteNome.toLowerCase().includes(termo)) ||
      (lic.responsavel && lic.responsavel.toLowerCase().includes(termo)) ||
      lic.plano.toLowerCase().includes(termo)
    );
    // Na aba 'ativas' (emissão), mostramos apenas as NÃO vencidas
    return matchTermo && !isLicencaVencida(lic);
  });

  const licencasVencidas = licencas.filter((lic) => {
    const termo = filtro.toLowerCase();
    const matchTermo = (
      lic.id.toLowerCase().includes(termo) ||
      (lic.responsavel && lic.responsavel.toLowerCase().includes(termo)) ||
      lic.plano.toLowerCase().includes(termo)
    );
    return matchTermo && isLicencaVencida(lic);
  });

  const restaurantesFiltrados = restaurantes.filter((rest) => {
    const termo = filtro.toLowerCase();
    return (
      rest.nome.toLowerCase().includes(termo) ||
      rest.slug.toLowerCase().includes(termo) ||
      rest.id.toLowerCase().includes(termo) ||
      (rest.plano && rest.plano.toLowerCase().includes(termo))
    );
  });

  const totalRestaurantesAtivos = restaurantes.filter((r) => !r.suspenso && !r.configuracoes?.suspenso).length;
  const totalRestaurantesSuspensos = restaurantes.filter((r) => r.suspenso || r.configuracoes?.suspenso).length;
  const totalTokensDisponiveis = licencas.filter((l) => l.status === "disponivel" && !isLicencaVencida(l)).length;
  const totalTokensVencidos = licencas.filter((l) => isLicencaVencida(l)).length;

  const emailAtual = usuarioAuth?.email?.toLowerCase() || "";
  const ehSuperAdmin = Boolean(
    usuarioAuth &&
      !usuarioAuth.isAnonymous &&
      usuarioAuth.email &&
      (EMAILS_SUPERADMIN_AUTORIZADOS.includes(emailAtual) ||
        (usuarioAuth as any).customClaims?.superadmin === true)
  );

  const isSuperAdminAutorizado = Boolean(
    ehSuperAdmin ||
      (process.env.NODE_ENV !== "production" &&
        typeof window !== "undefined" &&
        (window.location.search.includes("e2e=true") || !usuarioAuth))
  );

  if (!isSuperAdminAutorizado) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-rose-600 selection:text-white">
        <div className="max-w-md w-full p-8 bg-white border border-rose-200/80 rounded-3xl shadow-xl shadow-rose-900/5 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-neutral-950 tracking-tight">
              Acesso Negado
            </h2>
            <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
              Sua conta (
              <strong className="text-neutral-900 font-semibold">
                {usuarioAuth?.email || "Desconhecida"}
              </strong>
              ) não possui privilégios de SuperAdmin para acessar a gestão global do MAYaMenu.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs text-neutral-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-neutral-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Controle de Acesso MAYaRAnas</span>
            </div>
            <p>
              Para acessar o painel administrativo geral, encerre esta sessão e faça login com uma conta de operador registrada.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="button"
              onClick={handleLogoutOperador}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-11 rounded-2xl shadow-md transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair e Trocar de Conta
            </Button>

            <Link href="/admin">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-neutral-500 hover:text-neutral-900 h-9 rounded-xl"
              >
                Voltar para o Painel do Restaurante
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8">
      {/* HEADER DA GERÊNCIA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                MAYaRAnas <span className="opacity-60 font-normal">| Gerência Geral</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Central de Concessões, Emissão de Licenças e Controle de Estabelecimentos
              </p>

              {/* IDENTIFICAÇÃO DO OPERADOR / LOGIN RÁPIDO */}
              <div className="flex items-center gap-2 mt-2">
                {ehSuperAdmin ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Operador: {usuarioAuth?.email}</span>
                    <button
                      type="button"
                      onClick={handleLogoutOperador}
                      className="ml-2 hover:text-emerald-950 underline text-[10px]"
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                      Sessão Não Autenticada
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setModalLoginAberto(true)}
                      className="h-7 text-[11px] rounded-lg border-amber-300 text-amber-800 hover:bg-amber-100 flex items-center gap-1"
                    >
                      <LogIn className="w-3 h-3" />
                      Identificar Operador
                    </Button>
                  </div>
                )}

                <Link href="/superadmin/ajuda" target="_blank">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] rounded-lg border-border bg-card text-foreground hover:bg-muted hover:text-rose-600 flex items-center gap-1.5 shadow-xs transition-colors"
                    title="Abrir Manual Executivo & Operações"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-rose-600" />
                    <span>Manual SuperAdmin</span>
                    <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                      NOVO
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* METRICAS RÁPIDAS */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            onClick={() => setAbaAtiva("restaurantes")}
            className="px-4 py-2 bg-card border border-border rounded-2xl text-center cursor-pointer hover:border-primary/50 transition-colors shadow-xs"
          >
            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center justify-center gap-1">
              <Store className="w-3 h-3 text-emerald-600" />
              Operação
            </span>
            <span className="text-xl font-black text-emerald-600">{totalRestaurantesAtivos}</span>
          </div>
          <div
            onClick={() => setAbaAtiva("ativas")}
            className="px-4 py-2 bg-card border border-border rounded-2xl text-center cursor-pointer hover:border-primary/50 transition-colors shadow-xs"
          >
            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center justify-center gap-1">
              <KeyRound className="w-3 h-3 text-amber-600" />
              Disponíveis
            </span>
            <span className="text-xl font-black text-amber-600">{totalTokensDisponiveis}</span>
          </div>
          <div
            onClick={() => setAbaAtiva("vencidas")}
            className="px-4 py-2 bg-card border border-border rounded-2xl text-center cursor-pointer hover:border-primary/50 transition-colors shadow-xs"
          >
            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center justify-center gap-1">
              <ClockAlert className="w-3 h-3 text-orange-600" />
              Vencidas
            </span>
            <span className="text-xl font-black text-orange-600">{totalTokensVencidos}</span>
          </div>
          <div className="px-4 py-2 bg-card border border-border rounded-2xl text-center shadow-xs">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Suspensos
            </span>
            <span className="text-xl font-black text-rose-600">{totalRestaurantesSuspensos}</span>
          </div>
          <div
            onClick={() => setAbaAtiva("arquivo_morto")}
            className="px-4 py-2 bg-card border border-border rounded-2xl text-center cursor-pointer hover:border-primary/50 transition-colors shadow-xs"
          >
            <span className="block text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center justify-center gap-1">
              <Archive className="w-3 h-3 text-purple-600" />
              Arquivo Morto
            </span>
            <span className="text-xl font-black text-purple-600">{arquivoMorto.length}</span>
          </div>
        </div>
      </div>

      {/* ALERTA DE SESSÃO NÃO AUTENTICADA */}
      {(!usuarioAuth || usuarioAuth.isAnonymous) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <div>
              <strong className="block font-bold">Modo Somente Leitura (Sem Permissão de Gravação no Firestore)</strong>
              <span>
                Para alterar planos de restaurantes (Free/Pro/Enterprise) ou suspender estabelecimentos, identifique-se com a conta administrativa no topo da página.
              </span>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setModalLoginAberto(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-9 px-4 rounded-xl text-xs whitespace-nowrap shadow-xs"
          >
            Fazer Login de Operador
          </Button>
        </div>
      )}

      {/* FEEDBACK DE OPERAÇÕES (SUCESSO / ERRO) */}
      {alertaSucesso && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-3 text-xs animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{alertaSucesso}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertaSucesso(null)}
            className="text-emerald-700 hover:text-emerald-950 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {alertaErro && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{alertaErro}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertaErro(null)}
            className="text-rose-700 hover:text-rose-950 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SELETOR DE ABAS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setAbaAtiva("restaurantes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "restaurantes"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "bg-card text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          <Store className="w-4 h-4" />
          Estabelecimentos em Operação ({restaurantesFiltrados.length})
        </button>
        <button
          onClick={() => setAbaAtiva("ativas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "ativas"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-card text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Emissão & Convites Disponíveis ({licencasFiltradas.length})
        </button>
        <button
          onClick={() => setAbaAtiva("vencidas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "vencidas"
              ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
              : "bg-card text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          <ClockAlert className="w-4 h-4" />
          Licenças Vencidas ({licencasVencidas.length})
        </button>
        <button
          onClick={() => setAbaAtiva("arquivo_morto")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "arquivo_morto"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "bg-card text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          <Archive className="w-4 h-4" />
          Arquivo Morto / JSONs ({arquivoMorto.length})
        </button>
      </div>

      {abaAtiva === "restaurantes" ? (
        /* ABA ESTABELECIMENTOS EM OPERAÇÃO (MUNDO 2: GESTÃO CONTÍNUA DE PLANOS) */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                Estabelecimentos em Operação ({restaurantesFiltrados.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Gerencie versões de planos (Free, Pro, Enterprise) e status de operação dos restaurantes ativos em tempo real.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar restaurante, slug ou plano..."
                className="bg-card border-border text-foreground pl-9 rounded-xl h-9 text-xs shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          {restaurantesFiltrados.length === 0 ? (
            <div className="p-16 text-center bg-card border border-border rounded-3xl space-y-3 shadow-xs">
              <Store className="w-12 h-12 text-muted-foreground/60 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">Nenhum estabelecimento encontrado</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Assim que um cliente ativar seu link de concessão, o restaurante aparecerá automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {restaurantesFiltrados.map((rest) => {
                const planoAtual = rest.plano || rest.licenca?.plano || "free";
                const isSuspenso = !!(rest.suspenso || rest.configuracoes?.suspenso);
                const limites = rest.licenca?.limites || LIMITES_POR_PLANO[planoAtual as PlanoTipo] || LIMITES_POR_PLANO.free;
                const isItemPending = isPending && pendingRestauranteId === rest.id;

                return (
                  <div
                    key={rest.id}
                    className={`p-5 bg-card border rounded-3xl space-y-4 shadow-xs transition-all ${
                      isItemPending ? "ring-2 ring-primary/50 opacity-90 scale-[0.99]" : ""
                    } ${
                      isSuspenso
                        ? "border-rose-200 bg-rose-50/40"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {/* TOPO: NOME E STATUS */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-black text-foreground flex items-center gap-2">
                          {rest.nome}
                        </h3>
                        {rest.slug && (
                          <a
                            href={`/r/${rest.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-mono text-emerald-700 hover:underline inline-block mt-0.5"
                          >
                            /r/{rest.slug}
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isItemPending && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                        )}
                        <Badge
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            isSuspenso
                              ? "bg-rose-50 text-rose-800 border border-rose-200"
                              : planoAtual === "enterprise"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : planoAtual === "pro"
                              ? "bg-violet-50 text-violet-800 border border-violet-200"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {isSuspenso ? "Suspenso" : planoAtual}
                        </Badge>
                      </div>
                    </div>

                    {/* DADOS DE CAPACIDADE / LIMITES */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-2xl border border-border">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                          Capacidade Mesas
                        </span>
                        <span className="text-foreground font-bold">
                          {limites.maxMesas >= 999 ? "Ilimitadas" : `${limites.maxMesas} mesas`}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                          Limite Cardápio
                        </span>
                        <span className="text-foreground font-bold">
                          {limites.maxPratos >= 999 ? "Ilimitados" : `${limites.maxPratos} itens`}
                        </span>
                      </div>
                    </div>

                    {/* RODAPÉ DO CARD: SEGMENTED CONTROL + SUSPENDER */}
                    <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
                      {/* 1. SEGMENTED CONTROL DE MIGRAÇÃO DE PLANO */}
                      <div className="flex bg-muted rounded-lg p-1 border border-border shadow-inner">
                        <button
                          type="button"
                          disabled={isItemPending}
                          onClick={() => handleAlterarPlano(rest.id, "free", rest.licenca?.id)}
                          className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all disabled:opacity-50 ${
                            planoAtual === "free"
                              ? "bg-card text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          FREE
                        </button>

                        <button
                          type="button"
                          disabled={isItemPending}
                          onClick={() => handleAlterarPlano(rest.id, "pro", rest.licenca?.id)}
                          className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all disabled:opacity-50 ${
                            planoAtual === "pro"
                              ? "bg-violet-600 text-white shadow-xs"
                              : "text-muted-foreground hover:text-violet-600"
                          }`}
                        >
                          PRO
                        </button>

                        <button
                          type="button"
                          disabled={isItemPending}
                          onClick={() => handleAlterarPlano(rest.id, "enterprise", rest.licenca?.id)}
                          className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all disabled:opacity-50 ${
                            planoAtual === "enterprise"
                              ? "bg-amber-500 text-white shadow-xs"
                              : "text-muted-foreground hover:text-amber-600"
                          }`}
                        >
                          ENTERPRISE
                        </button>
                      </div>

                      {/* 2. AÇÃO DESTRUTIVA OU REATIVAÇÃO */}
                      {isSuspenso ? (
                        <button
                          type="button"
                          disabled={isItemPending}
                          onClick={() => handleAlterarSuspensaoRestaurante(rest.id, false)}
                          className="px-3 py-1.5 text-[10px] sm:text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reativar
                        </button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              className="px-2.5 py-1 text-[10px] sm:text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors border border-transparent hover:border-rose-200 flex items-center gap-1"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Suspender
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border border-border text-foreground rounded-3xl max-w-sm shadow-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-rose-600 font-black">Suspender Estabelecimento?</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
                                Esta ação cortará imediatamente o acesso de <strong>{rest.nome}</strong> ao painel administrativo e desativará os QR Codes das mesas em operação.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-4">
                              <AlertDialogCancel className="bg-muted hover:bg-muted/80 text-foreground border-border rounded-xl text-xs font-bold">
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleAlterarSuspensaoRestaurante(rest.id, true)}
                                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
                              >
                                Sim, Suspender
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : abaAtiva === "ativas" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORMULÁRIO: GERAR NOVA CONCESSÃO OU FÁBRICA EM LOTE */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border text-card-foreground rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="bg-muted/40 border-b border-border pb-4 space-y-3">
                <CardTitle className="text-base font-black flex items-center justify-between text-primary">
                  <div className="flex items-center gap-2">
                    {modoEmissao === "lote" ? (
                      <Boxes className="w-5 h-5 text-rose-500" />
                    ) : (
                      <KeyRound className="w-5 h-5 text-primary" />
                    )}
                    <span>{modoEmissao === "lote" ? "Fábrica de Licenças" : "Emitir Nova Licença"}</span>
                  </div>
                  {modoEmissao === "lote" && (
                    <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                      Batch Mode
                    </Badge>
                  )}
                </CardTitle>

                {/* SEGMENTED CONTROL: INDIVIDUAL vs FÁBRICA */}
                <div className="flex bg-muted rounded-xl p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setModoEmissao("individual")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      modoEmissao === "individual"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoEmissao("lote")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      modoEmissao === "lote"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Fábrica em Lote</span>
                    <span
                      className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider transition-colors ${
                        modoEmissao === "lote"
                          ? "bg-white text-rose-600"
                          : "bg-rose-100 text-rose-700 border border-rose-200"
                      }`}
                    >
                      NOVO
                    </span>
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <form
                  onSubmit={modoEmissao === "lote" ? handleCriarLoteLicencas : handleCriarLicenca}
                  className="space-y-4"
                >
                  {/* SELEÇÃO DE QUANTIDADE NO MODO LOTE */}
                  {modoEmissao === "lote" && (
                    <div className="space-y-1.5 bg-rose-50/60 p-3 rounded-2xl border border-rose-200">
                      <label className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center justify-between">
                        <span>Quantidade no Lote</span>
                        <span className="text-[10px] text-muted-foreground font-mono">1 a 100</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {["5", "10", "25", "50"].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setQuantidadeLote(q)}
                            className={`py-1.5 rounded-xl text-xs font-black border transition-all ${
                              quantidadeLote === q
                                ? "bg-rose-600 border-rose-500 text-white shadow-xs"
                                : "bg-card border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {q} un
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PLANO */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                                ? "bg-primary border-primary text-primary-foreground shadow-xs"
                                : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border mt-2">
                      Padrão {planoSelecionado.toUpperCase()}:{" "}
                      <span className="text-foreground font-bold">
                        {LIMITES_POR_PLANO[planoSelecionado].maxPratos} pratos
                      </span>{" "}
                      •{" "}
                      <span className="text-foreground font-bold">
                        {LIMITES_POR_PLANO[planoSelecionado].maxMesas} mesas
                      </span>
                    </div>

                    {/* PRESETS RÁPIDOS */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Atalhos:</span>
                      <button
                        type="button"
                        onClick={() => aplicarPreset("free", "48")}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                      >
                        Free 48h
                      </button>
                      <button
                        type="button"
                        onClick={() => aplicarPreset("pro", "168")}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
                      >
                        Pro 7d
                      </button>
                      <button
                        type="button"
                        onClick={() => aplicarPreset("enterprise", "720")}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                      >
                        Enterprise 30d
                      </button>
                    </div>
                  </div>

                  {/* DESTINATÁRIO / RESPONSÁVEL / CAMPANHA */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {modoEmissao === "lote"
                        ? "Campanha / Representante / Tag"
                        : "Destinatário / Contato"}
                    </label>
                    <Input
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      placeholder={
                        modoEmissao === "lote"
                          ? "Ex: Campanha Abrasel / Evento Gastronômico"
                          : "Ex: Marcus Barreto (WhatsApp / Restaurante X)"
                      }
                      className="bg-card border-border text-foreground rounded-xl h-10 text-xs"
                    />
                  </div>

                  {/* VALIDADE / EXPIRAÇÃO DO CONVITE EFÊMERO */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Validade do Link de Ativação</span>
                      <span className="text-[10px] text-rose-600 font-mono font-bold">Burn-After-Reading</span>
                    </label>
                    <select
                      value={validadeHoras}
                      onChange={(e) => setValidadeHoras(e.target.value)}
                      className="w-full bg-card border border-border text-foreground rounded-xl h-10 px-3 text-xs outline-none focus:border-rose-500 shadow-xs transition-colors"
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
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Observações Internas (Opcional)
                    </label>
                    <Input
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Ex: Demonstração 30 dias / Parceria"
                      className="bg-card border-border text-foreground rounded-xl h-10 text-xs shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>

                  {/* LIMITES PERSONALIZADOS */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Limite de Pratos
                      </label>
                      <Input
                        type="number"
                        value={maxPratosCustom}
                        onChange={(e) => setMaxPratosCustom(e.target.value)}
                        placeholder={String(LIMITES_POR_PLANO[planoSelecionado].maxPratos)}
                        className="bg-card border-border text-foreground rounded-xl h-9 text-xs shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Limite de Mesas
                      </label>
                      <Input
                        type="number"
                        value={maxMesasCustom}
                        onChange={(e) => setMaxMesasCustom(e.target.value)}
                        placeholder={String(LIMITES_POR_PLANO[planoSelecionado].maxMesas)}
                        className="bg-card border-border text-foreground rounded-xl h-9 text-xs shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={criando}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl h-11 text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    {criando ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {modoEmissao === "lote" ? "Fabricando Lote..." : "Gerando Token..."}
                      </>
                    ) : modoEmissao === "lote" ? (
                      <>
                        <Boxes className="w-4 h-4" />
                        Fabricar Lote de {quantidadeLote} Concessões
                      </>
                    ) : (
                      "Gerar Código de Licença"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* LISTAGEM DE LICENÇAS E CONCESSÕES */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Store className="w-5 h-5 text-muted-foreground" />
                Concessões Registradas ({licencasFiltradas.length})
              </h2>

              <div className="flex items-center gap-2">
                {/* BOTÃO EXPORTAR CSV */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleBaixarCSV(licencasFiltradas)}
                  className="h-9 px-3 rounded-xl border-border bg-card hover:bg-muted text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Exportar</span> CSV
                  <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                    NOVO
                  </span>
                </Button>

                <div className="relative w-48 sm:w-60">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Buscar código, nome..."
                    className="bg-card border-border text-foreground pl-9 rounded-xl h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {licencasFiltradas.length === 0 ? (
              <div className="p-12 text-center bg-card/60 border border-border rounded-3xl space-y-3">
                <KeyRound className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-xs">
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
                      className="p-5 bg-card border border-border rounded-3xl space-y-3 shadow-xs hover:border-primary/40 transition-colors"
                    >
                      {/* TOPO: TOKEN E STATUS */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-foreground bg-muted px-2.5 py-1 rounded-xl tracking-wider">
                            {lic.id}
                          </span>
                          <button
                            onClick={() => handleCopiar(lic.id)}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                            title="Copiar código"
                          >
                            {copiadoId === lic.id ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <Badge
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            disponivel
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : ativa
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {lic.status}
                        </Badge>
                      </div>

                      {/* DADOS DO ESTABELECIMENTO */}
                      <div className="space-y-1 text-xs">
                        {lic.restauranteNome ? (
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                              Restaurante Vinculado
                            </span>
                            <span className="text-foreground font-bold text-sm">
                              {lic.restauranteNome}
                            </span>
                            {lic.slug && (
                              <span className="text-primary block text-[11px] font-mono">
                                /r/{lic.slug}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                              Destinatário Previsto
                            </span>
                            <span className="text-muted-foreground">
                              {lic.responsavel || "Aguardando ativação por novo estabelecimento"}
                            </span>
                          </div>
                        )}

                        {lic.notas && (
                          <p className="text-[11px] text-muted-foreground italic">“{lic.notas}”</p>
                        )}
                      </div>

                      {/* LIMITES E DETALHES DO PLANO */}
                      <div className="flex items-center gap-3 pt-2 border-t border-border text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1 font-semibold uppercase text-foreground">
                          <Layers className="w-3.5 h-3.5 text-rose-600" />
                          {lic.plano}
                        </div>
                        <div className="flex items-center gap-1">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground" />
                          {lic.limites.maxPratos} pratos
                        </div>
                        <div className="flex items-center gap-1">
                          <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                          {lic.limites.maxMesas} mesas
                        </div>
                      </div>

                      {/* AÇÕES DE GESTÃO E COMPARTILHAMENTO EFÊMERO */}
                      {disponivel && (
                        <div className="pt-2 grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopiarLink(lic.id)}
                            className="w-full bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border-rose-200 rounded-xl text-[11px] font-black uppercase tracking-wider h-9 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            {copiadoLinkId === lic.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copiar Link
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompartilharWhatsApp(lic)}
                            className="w-full bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-200 rounded-xl text-[11px] font-black uppercase tracking-wider h-9 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </Button>
                        </div>
                      )}

                      {ativa && (
                        <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                          {/* 1. SEGMENTED CONTROL (Mudança Silenciosa e Rápida) */}
                          <div className="flex bg-muted rounded-lg p-1 border border-border shadow-inner">
                            {/* Botão FREE */}
                            <button
                              type="button"
                              onClick={() => handleAlterarPlano(lic.restauranteId || lic.id, "free", lic.id)}
                              className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${
                                lic.plano === "free"
                                  ? "bg-card text-foreground shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
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
                                  ? "bg-violet-600 text-white shadow-xs"
                                  : "text-muted-foreground hover:text-violet-600"
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
                                  ? "bg-amber-500 text-white shadow-xs"
                                  : "text-muted-foreground hover:text-amber-600"
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
                                className="px-3 py-1.5 text-[10px] sm:text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 flex items-center gap-1.5"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Suspender
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border border-border text-foreground rounded-3xl max-w-sm shadow-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-rose-600 font-black">Suspender Estabelecimento?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
                                  Esta ação cortará imediatamente o acesso do restaurante <strong>{lic.restauranteNome || lic.id}</strong> ao painel administrativo e desativará todos os QR Codes das mesas em operação.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-4">
                                <AlertDialogCancel className="bg-muted hover:bg-muted/80 text-foreground border-border rounded-xl text-xs font-bold">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleAlterarStatus(lic.id, "suspensa")}
                                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
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
                            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[10px] font-bold uppercase tracking-wider h-8 shadow-xs"
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
      ) : abaAtiva === "vencidas" ? (
        /* ABA LICENÇAS VENCIDAS (EMITIDAS MAS NÃO UTILIZADAS) */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <ClockAlert className="w-5 h-5 text-orange-600" />
                Licenças Vencidas ({licencasVencidas.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Tokens emitidos que ultrapassaram o prazo de validade sem ativação por nenhum lojista.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar token ou contato..."
                className="bg-card border-border text-foreground pl-9 rounded-xl h-9 text-xs shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          {licencasVencidas.length === 0 ? (
            <div className="p-16 text-center bg-card border border-border rounded-3xl space-y-3 shadow-xs">
              <ClockAlert className="w-12 h-12 text-muted-foreground/60 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">Nenhuma licença vencida</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Todos os convites emitidos estão dentro do prazo ou já foram ativados com sucesso pelos clientes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {licencasVencidas.map((lic) => {
                const expMillis = parseDateToMillis(lic.expiracaoEm);
                const expirouEmStr = expMillis ? new Date(expMillis).toLocaleString("pt-BR") : "Prazo encerrado";

                return (
                  <div
                    key={lic.id}
                    className="p-5 bg-card border border-orange-200 rounded-3xl space-y-3.5 shadow-xs relative overflow-hidden hover:border-orange-400 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-black text-orange-800 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-xl tracking-wider">
                        {lic.id}
                      </span>
                      <Badge className="bg-orange-50 text-orange-800 border border-orange-200 text-[10px] uppercase font-bold">
                        Vencida
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                          Destinatário Previsto
                        </span>
                        <span className="text-foreground font-bold text-sm">
                          {lic.responsavel || "Não informado"}
                        </span>
                      </div>
                      {lic.notas && (
                        <p className="text-[11px] text-muted-foreground italic">“{lic.notas}”</p>
                      )}
                      <div className="pt-1 text-[11px] text-orange-700 flex items-center gap-1 font-mono">
                        <ClockAlert className="w-3.5 h-3.5" />
                        Expirou em: {expirouEmStr}
                      </div>
                    </div>

                    {/* DETALHES DO PLANO */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1 font-bold uppercase text-foreground">
                        <Layers className="w-3.5 h-3.5 text-rose-600" />
                        {lic.plano}
                      </div>
                      <div className="flex items-center gap-1">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground" />
                        {lic.limites.maxPratos} pratos
                      </div>
                      <div className="flex items-center gap-1">
                        <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                        {lic.limites.maxMesas} mesas
                      </div>
                    </div>

                    {/* AÇÕES: RENOVAR, ARQUIVAR OU REVOGAR */}
                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleRenovarLicenca(lic.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] h-8 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs"
                        title="Renova o prazo por mais 48 horas"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Renovar +48h
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArquivarExpirada(lic)}
                        className="bg-muted hover:bg-purple-50 text-purple-700 hover:text-purple-800 border-border hover:border-purple-200 text-[11px] h-8 px-2.5 rounded-xl font-bold flex items-center gap-1 transition-colors"
                        title="Mover para Arquivo Morto com status expirada"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Arquivar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevogarLicenca(lic.id)}
                        className="bg-muted hover:bg-rose-50 text-rose-600 hover:text-rose-700 border-border hover:border-rose-200 text-[11px] h-8 px-2.5 rounded-xl font-bold transition-colors"
                        title="Descartar e excluir token permanentemente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ABA ARQUIVO MORTO / REGISTROS EM JSON */
        <div className="space-y-6">
          <div className="p-6 bg-card border border-border rounded-3xl space-y-2 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-2xl text-purple-700">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  Arquivo Morto de Licenças & Tokens
                  <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-bold">
                    Imutável (WORM)
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Todas as licenças consumidas são desvinculadas das concessões ativas e arquivadas
                  aqui em formato JSON permanente para auditoria e histórico fiscal.
                </p>
              </div>
            </div>
          </div>

          {arquivoMorto.length === 0 ? (
            <div className="p-16 text-center bg-card border border-border rounded-3xl space-y-3 shadow-xs">
              <Archive className="w-12 h-12 text-muted-foreground/60 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">Nenhum registro arquivado ainda</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
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
                    className="p-5 bg-card border border-border rounded-3xl space-y-3 shadow-xs hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl">
                        {item.codigo || item.id}
                      </span>
                      <Badge className="bg-muted text-muted-foreground text-[10px] border border-border">
                        {item.motivo || "ativada"}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                          Estabelecimento
                        </span>
                        <span className="text-foreground font-bold text-sm">
                          {item.restauranteNome || "Estabelecimento"}
                        </span>
                        {item.slug && (
                          <span className="text-purple-700 block text-[11px] font-mono">
                            /r/{item.slug}
                          </span>
                        )}
                      </div>
                      <div className="pt-1 text-[11px] text-muted-foreground">
                        Arquivado em: <span className="text-foreground font-medium">{dataFormatada}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setJsonModalItem(item)}
                        className="flex-1 bg-muted hover:bg-muted/80 text-foreground border-border text-[11px] h-8 rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-700" />
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
                        className="bg-muted hover:bg-muted/80 text-foreground border-border text-[11px] h-8 px-3 rounded-xl shadow-xs"
                        title="Copiar JSON"
                      >
                        {copiadoJsonId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
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
                        className="bg-muted hover:bg-muted/80 text-foreground border-border text-[11px] h-8 px-3 rounded-xl shadow-xs"
                        title="Baixar Arquivo JSON"
                      >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border text-foreground rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-foreground">
                  JSON de Auditoria — {jsonModalItem.codigo || jsonModalItem.id}
                </h3>
              </div>
              <button
                onClick={() => setJsonModalItem(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-auto bg-muted/40 font-mono text-xs text-foreground">
              <pre className="whitespace-pre-wrap">
                {jsonModalItem.snapshotJson || JSON.stringify(jsonModalItem, null, 2)}
              </pre>
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2 bg-card">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const jsonStr = jsonModalItem.snapshotJson || JSON.stringify(jsonModalItem, null, 2);
                  navigator.clipboard.writeText(jsonStr);
                  setCopiadoJsonId(jsonModalItem.id);
                  setTimeout(() => setCopiadoJsonId(null), 2500);
                }}
                className="border-border text-xs rounded-xl"
              >
                {copiadoJsonId === jsonModalItem.id ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 mr-1" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1 text-muted-foreground" />
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

      {/* MODAL FÁBRICA DE LICENÇAS - RESULTADO DO LOTE */}
      <Dialog open={modalLoteAberto} onOpenChange={setModalLoteAberto}>
        <DialogContent className="max-w-4xl bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="space-y-1 mb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-500" />
                <span>Fábrica de Licenças — Lote Gerado ({loteRecemCriado.length} Concessões)</span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Concessões criadas com sucesso de forma atômica no Firestore e sincronizadas em cache local.
            </DialogDescription>
          </DialogHeader>

          {/* BARRA DE AÇÕES DO LOTE */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-2xl border border-border my-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-xs font-bold uppercase">
                Plano {planoSelecionado}
              </Badge>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-bold">
                {loteRecemCriado.length} Códigos Ativos
              </Badge>
              {validadeHoras && Number(validadeHoras) > 0 ? (
                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs font-semibold">
                  Validade: {validadeHoras}h
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs font-semibold">
                  Sem Expiração
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleBaixarCSV(loteRecemCriado)}
                className="h-9 px-3 text-xs font-bold rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-xs"
              >
                <FileDown className="w-4 h-4 mr-1.5" />
                Baixar Planilha (.csv)
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopiarLoteClipboard(loteRecemCriado)}
                className="h-9 px-3 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {copiadoLoteTexto ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-white" />
                    Copiado para Área de Transferência!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copiar Lista WhatsApp/Slack
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* LISTA ROLÁVEL DE CONCESSÕES GERADAS */}
          <div className="flex-1 overflow-auto rounded-2xl border border-border bg-muted/10 p-2 space-y-2 max-h-[50vh]">
            {loteRecemCriado.map((lic, index) => {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const urlAtivacao = `${origin}/ativar/${lic.id}`;
              return (
                <div
                  key={lic.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-amber-400 transition-colors gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-muted-foreground w-6">
                      #{String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm tracking-wide text-foreground">
                          {lic.id}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4 border-amber-300 bg-amber-50 text-amber-800">
                          {lic.plano}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-sm">
                        {lic.responsavel ? (
                          <span className="font-medium text-foreground/80">{lic.responsavel} — </span>
                        ) : null}
                        <span className="font-mono text-[10px]">{urlAtivacao}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopiar(lic.id)}
                      className="h-8 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                      title="Copiar Código"
                    >
                      {copiadoId === lic.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 mr-1" />
                      )}
                      Código
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopiarLink(lic.id)}
                      className="h-8 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                      title="Copiar Link de Ativação"
                    >
                      {copiadoLinkId === lic.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 mr-1" />
                      )}
                      Link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCompartilharWhatsApp(lic)}
                      className="h-8 px-2.5 text-xs rounded-lg text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 shadow-xs"
                      title="Enviar via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
            <span className="text-xs text-muted-foreground">
              Total: <strong className="text-foreground">{loteRecemCriado.length}</strong> concessões prontas para entrega
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalLoteAberto(false)}
              className="rounded-xl text-xs px-5 h-9 font-bold"
            >
              Concluir e Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE LOGIN RÁPIDO DO OPERADOR */}
      <Dialog open={modalLoginAberto} onOpenChange={setModalLoginAberto}>
        <DialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 mb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-500" />
              <span>Identificação de Operador SuperAdmin</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Insira as credenciais administrativas para habilitar permissão de gravação no Firestore (migração de planos e suspensões).
            </DialogDescription>
          </DialogHeader>

          {erroAuth && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{erroAuth}</span>
            </div>
          )}

          <form onSubmit={handleLoginOperador} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                E-mail do Administrador
              </label>
              <Input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@mayamenu.com ou teste@teste.com"
                required
                className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Senha de Acesso
              </label>
              <Input
                type="password"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-background border-border text-foreground rounded-xl h-10 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalLoginAberto(false)}
                className="text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={autenticando}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs h-10 px-5"
              >
                {autenticando ? "Autenticando..." : "Entrar como Operador"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

