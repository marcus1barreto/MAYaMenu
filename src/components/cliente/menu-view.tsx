"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { MenuItem, Restaurante, ComandaCliente } from "@/types";
import { useCart } from "@/context/cart-context";
import { ItemModal } from "./item-modal";
import { CartDrawer } from "./cart-drawer";
import { HistoricoVisitasModal } from "./historico-visitas-modal";
import { MinhaComandaModal } from "./minha-comanda-modal";
import {
  ShoppingBag,
  Sparkles,
  MapPin,
  Search,
  Receipt,
  DollarSign,
  CheckCircle2,
  Bell,
  Clock,
  PartyPopper,
  HeartHandshake,
  Utensils,
  QrCode,
  Menu as MenuIcon,
  X,
  Sun,
  Moon,
  Coffee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ensureClienteAnonimo, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { escutarCardapio, escutarRestaurante, chamarGarcomFirestore, escutarPedidosCliente } from "@/lib/restaurante-service";
import { resolverClasseTemaRestaurante } from "@/lib/tema";
import { marcarVisitaAtualComoPaga, limparSessaoClienteLocal } from "@/lib/historico-cliente";
import { MesaScannerModal } from "./mesa-scanner-modal";

interface MenuViewProps {
  restaurante: Restaurante;
  cardapio: MenuItem[];
  numeroMesa?: number | string;
}

export function MenuView({ restaurante: restauranteInicial, cardapio: cardapioInicial, numeroMesa: numeroMesaProp = 1 }: MenuViewProps) {
  const { totalItens, subtotal, nomeCliente, limparCarrinho, mesa, setMesa } = useCart();
  const numeroMesa = mesa || numeroMesaProp;
  const [restaurante, setRestaurante] = useState<Restaurante>(restauranteInicial);
  const [cardapio, setCardapio] = useState<MenuItem[]>(cardapioInicial);
  const [itemSelecionado, setItemSelecionado] = useState<MenuItem | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [minhaComandaAberta, setMinhaComandaAberta] = useState(false);
  const [mesaScannerAberto, setMesaScannerAberto] = useState(false);
  const [menuLateralAberto, setMenuLateralAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [contaPagaModal, setContaPagaModal] = useState(false);
  const [sessaoFinalizada, setSessaoFinalizada] = useState(false);
  const [subtotalComandaBanco, setSubtotalComandaBanco] = useState(0);
  const [busca, setBusca] = useState("");
  const [pedindoConta, setPedindoConta] = useState(false);
  const [contaPedidaSucesso, setContaPedidaSucesso] = useState(false);
  const [comandaStatus, setComandaStatus] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todas");
  const [modoVisualCliente, setModoVisualCliente] = useState<"padrao" | "dia" | "noite" | "descanso">("descanso");

  // Carrega preferência pessoal de visualização do cliente (Padrão: Descanso de Tela / Conforto Visual)
  useEffect(() => {
    const salvo = localStorage.getItem("mayamenu_modo_visual") as any;
    if (salvo && ["padrao", "dia", "noite", "descanso"].includes(salvo)) {
      setModoVisualCliente(salvo);
    } else {
      // Padrão do sistema para o cliente: descanso de tela
      setModoVisualCliente("descanso");
      localStorage.setItem("mayamenu_modo_visual", "descanso");
    }
  }, []);

  const alternarModoVisual = (novoModo: "padrao" | "dia" | "noite" | "descanso") => {
    setModoVisualCliente(novoModo);
    localStorage.setItem("mayamenu_modo_visual", novoModo);
  };

  const classeModoVisual =
    modoVisualCliente === "dia"
      ? "" // Herda :root branco puro (iFood Style)
      : modoVisualCliente === "noite"
      ? "theme-boemia-marinho"
      : modoVisualCliente === "descanso"
      ? "theme-acessibilidade-sepia"
      : resolverClasseTemaRestaurante(restaurante); // 'padrao' aplica a classe do restaurante em tempo real

  // Categorias únicas disponíveis no cardápio na ordem em que aparecem no cardápio ordenado
  const categorias = [
    "Todas",
    ...Array.from(new Set(cardapio.map((i) => i.categoria || "Geral"))),
  ];

  // Escuta o restaurante em tempo real (mudança de tema, logo, cores)
  useEffect(() => {
    if (!restauranteInicial?.id) return;
    const unsub = escutarRestaurante(restauranteInicial.id, (novoRest) => {
      setRestaurante(novoRest);
    });
    return () => unsub();
  }, [restauranteInicial?.id]);

  // Escuta o cardápio em tempo real (mudança de preço, pausa de esgotados)
  useEffect(() => {
    if (!restaurante.id) return;
    const unsub = escutarCardapio(restaurante.id, (novosItens) => {
      setCardapio(novosItens);
    });
    return () => unsub();
  }, [restaurante.id]);

  // Escuta o status da comanda do cliente nesta mesa em tempo real
  useEffect(() => {
    let unsubComanda: (() => void) | null = null;
    let unsubPedidos: (() => void) | null = null;

    ensureClienteAnonimo().then((user) => {
      const comandaRef = doc(
        db,
        "restaurantes",
        restaurante.id,
        "mesas",
        String(numeroMesa),
        "comandas_abertas",
        user.uid
      );

      // 1. Escuta status da comanda pai
      unsubComanda = onSnapshot(
        comandaRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as ComandaCliente;
            setComandaStatus(data.status);

            if (data.status === "conta_pedida") {
              setContaPedidaSucesso(true);
            } else if (data.status === "pago") {
              // Mata os listeners imediatamente para evitar loop
              if (unsubComanda) {
                unsubComanda();
                unsubComanda = null;
              }
              if (unsubPedidos) {
                unsubPedidos();
                unsubPedidos = null;
              }

              // Feedback visual imediato
              marcarVisitaAtualComoPaga(restaurante.slug, numeroMesa);
              setContaPedidaSucesso(false);
              setContaPagaModal(true);
              setMinhaComandaAberta(false);
              setCarrinhoAberto(false);

              // Limpeza Local
              limparSessaoClienteLocal(restaurante.slug);
              if (typeof limparCarrinho === "function") {
                limparCarrinho();
              }
            }
          }
        },
        (err) => {
          console.error("Erro no listener da comanda do cliente:", err);
        }
      );

      // 2. Escuta pedidos reais para subtotal exato e dinâmico na barra flutuante
      unsubPedidos = escutarPedidosCliente(
        restaurante.id,
        numeroMesa,
        user.uid,
        (lista) => {
          const totalAtivo = lista.reduce((acc, p) => {
            if (p.status !== "cancelado" && p.status !== "estornado") {
              return acc + (p.subtotal || 0);
            }
            return acc;
          }, 0);
          setSubtotalComandaBanco(totalAtivo);
        }
      );
    });

    return () => {
      if (unsubComanda) unsubComanda();
      if (unsubPedidos) unsubPedidos();
    };
  }, [restaurante.id, restaurante.slug, numeroMesa]);

  const [chamandoGarcom, setChamandoGarcom] = useState(false);
  const [garcomChamadoSucesso, setGarcomChamadoSucesso] = useState(false);
  const [segundosCooldown, setSegundosCooldown] = useState(0);

  // Monitora o cooldown anti-flooding de 120s
  useEffect(() => {
    if (segundosCooldown <= 0) return;
    const timer = setInterval(() => {
      setSegundosCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGarcomChamadoSucesso(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [segundosCooldown]);

  const corPrimaria = restaurante.configuracoes?.corPrimaria || "#E11D48";
  const capaUrl = restaurante.configuracoes?.capaUrl || "/images/capa-padrao.webp";
  const modoOperacao = restaurante.configuracoes?.modoOperacao || "hibrido";
  const ehAutoatendimento = modoOperacao === "balcao";

  const handleChamarGarcom = async () => {
    if (ehAutoatendimento || chamandoGarcom || segundosCooldown > 0) return;

    setChamandoGarcom(true);
    try {
      const user = await ensureClienteAnonimo();
      await chamarGarcomFirestore({
        restauranteId: restaurante.id,
        slug: restaurante.slug,
        mesaNumero: numeroMesa,
        clienteId: user.uid,
        nomeCliente: nomeCliente || "Cliente",
        motivo: "Atendimento no Salão",
      });

      setGarcomChamadoSucesso(true);
      setSegundosCooldown(120); // 2 minutos de cooldown anti-flooding
    } catch (err) {
      console.warn("Falha ao registrar chamado do garçom online, ativando cooldown local:", err);
      setGarcomChamadoSucesso(true);
      setSegundosCooldown(120);
    } finally {
      setChamandoGarcom(false);
    }
  };

  const handlePedirConta = async () => {
    if (pedindoConta || contaPedidaSucesso) return;
    const msgConfirmacao = ehAutoatendimento
      ? "Deseja solicitar o fechamento da sua comanda para pagamento no balcão/caixa?"
      : "Deseja pedir a conta da sua mesa ao garçom?";
    const confirmou = window.confirm(msgConfirmacao);
    if (!confirmou) return;

    setPedindoConta(true);
    try {
      const user = await ensureClienteAnonimo();
      const comandaRef = doc(
        db,
        "restaurantes",
        restaurante.id,
        "mesas",
        String(numeroMesa),
        "comandas_abertas",
        user.uid
      );

      await updateDoc(comandaRef, {
        status: "conta_pedida",
        atualizadoEm: serverTimestamp(),
      });
      setContaPedidaSucesso(true);
    } catch (e) {
      console.warn("Conta pedida localmente ou offline:", e);
      // Mesmo com fallback de rede, registra feedback de sucesso visual ao cliente
      setContaPedidaSucesso(true);
    } finally {
      setPedindoConta(false);
    }
  };

  const itensFiltrados = cardapio
    .filter((item) => {
      if (!item.ativo) return false;
      if (categoriaAtiva !== "Todas" && (item.categoria || "Geral") !== categoriaAtiva) return false;
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      return (
        item.nome.toLowerCase().includes(b) ||
        item.descricao.toLowerCase().includes(b)
      );
    })
    .sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));

  if (sessaoFinalizada) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between p-6 antialiased selection:bg-rose-500 selection:text-white relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* TOPO: STATUS E AGRADECIMENTO */}
        <div className="max-w-md mx-auto w-full pt-10 sm:pt-16 text-center space-y-6 relative z-10">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-2xl shadow-emerald-950/50">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-3">
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Mesa {numeroMesa} • Encerrada
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Conta Paga!
            </h1>
            <p className="text-sm text-neutral-300 leading-relaxed font-medium">
              Obrigado por visitar o <strong className="text-white">{restaurante.nome}</strong>. Foi um enorme prazer recebê-lo!
            </p>
          </div>

          <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl text-xs text-neutral-400 space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-rose-400 font-bold">
              <QrCode className="w-4 h-4" />
              <span>Deseja pedir mais alguma coisa?</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Para reabrir a sua comanda, escaneie o QR Code da mesa novamente com a câmera do seu celular.
            </p>
          </div>

          {/* BOTÃO COMPROVANTE DIGITAL */}
          <Button
            type="button"
            onClick={() => setHistoricoAberto(true)}
            className="h-11 px-5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 mx-auto transition-all shadow-sm"
          >
            <Receipt className="w-4 h-4 text-rose-400" />
            <span>Ver Comprovantes Anteriores</span>
          </Button>

          {/* BANNER DE ADS B2B (Patrocinador / Fornecedor) */}
          <div className="p-5 bg-gradient-to-r from-neutral-900 via-neutral-800/80 to-neutral-900 border border-neutral-800/80 rounded-3xl text-center space-y-2.5 shadow-xl relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">
              Parceiro Oficial • Espaço B2B
            </span>
            <div className="py-3 px-4 bg-neutral-950/70 border border-neutral-800/60 rounded-2xl">
              <span className="text-xs font-bold text-neutral-200 block">
                Espaço para Patrocinador / Fornecedor
              </span>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Conecte a sua marca a milhares de clientes no momento da refeição.
              </p>
            </div>
          </div>
        </div>

        {/* RODAPÉ: BOTÃO DE SOLICITAR GARÇOM OU AVISO DE AUTOATENDIMENTO */}
        <div className="max-w-md mx-auto w-full pt-8 pb-4 relative z-10 text-center space-y-3">
          {!ehAutoatendimento ? (
            <Button
              type="button"
              onClick={handleChamarGarcom}
              disabled={chamandoGarcom || segundosCooldown > 0}
              className={`w-full h-12 rounded-2xl text-xs uppercase tracking-wider font-black shadow-xl flex items-center justify-center gap-2 transition-all ${
                garcomChamadoSucesso
                  ? "bg-amber-500 text-neutral-950"
                  : "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
              }`}
            >
              <Bell className={`w-4 h-4 ${garcomChamadoSucesso ? "fill-neutral-950 animate-bounce" : "text-amber-400"}`} />
              <span>
                {garcomChamadoSucesso
                  ? "Garçom a Caminho da Mesa!"
                  : segundosCooldown > 0
                  ? `Aguarde (${segundosCooldown}s)`
                  : "🔔 Solicitar Garçom"}
              </span>
            </Button>
          ) : (
            <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-xs text-neutral-300 font-semibold flex items-center justify-center gap-2 shadow-sm">
              <Utensils className="w-4 h-4 text-rose-500" />
              <span>Modo Autoatendimento: Retire seus pedidos no balcão</span>
            </div>
          )}

          <p className="text-[10px] text-neutral-400">
            MAYaMenu • Tecnologia para Experiências Gastronômicas
          </p>
        </div>

        {/* MODAL DE HISTÓRICO DE VISITAS / COMPROVANTES SE O CLIENTE QUISER CONSULTAR */}
        <HistoricoVisitasModal
          isOpen={historicoAberto}
          onClose={() => setHistoricoAberto(false)}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${classeModoVisual} bg-background pb-28 text-foreground antialiased selection:bg-primary selection:text-primary-foreground transition-colors duration-200`}>
      {/* 1. HEADER MOBILE COMPACTO & ELEGANTE */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border text-foreground transition-all shadow-xs">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* ESQUERDA: MENU HAMBÚRGUER + LOGO / NOME DO ESTABELECIMENTO */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMenuLateralAberto(true)}
              className="w-9 h-9 rounded-xl bg-card hover:bg-muted border border-border text-foreground flex items-center justify-center transition-all active:scale-90 shrink-0 shadow-xs"
              title="Menu e Opções da Mesa"
              aria-label="Abrir menu"
            >
              <MenuIcon className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              {restaurante.configuracoes?.logoUrl ? (
                <div className="relative w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-border">
                  <Image
                    src={restaurante.configuracoes.logoUrl}
                    alt={restaurante.nome}
                    fill
                    priority={true}
                    fetchPriority="high"
                    sizes="28px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  style={{ backgroundColor: corPrimaria }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 shadow-xs"
                >
                  {restaurante.nome.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-tight truncate leading-none text-foreground">
                  {restaurante.nome}
                </h1>
                <span className="text-[10px] text-muted-foreground font-medium">Mesa {numeroMesa}</span>
              </div>
            </div>
          </div>

          {/* DIREITA: ÍCONE DE BUSCA + ÍCONE DA COMANDA COM BADGE */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Ícone de Busca Alternável */}
            <button
              type="button"
              onClick={() => setBuscaAberta(!buscaAberta)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all active:scale-90 ${
                buscaAberta || busca.trim().length > 0
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-card hover:bg-muted border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Buscar no cardápio"
              aria-label="Buscar pratos"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Ícone da Comanda / Carrinho com Badge Numérico de Itens */}
            <button
              type="button"
              onClick={() => {
                if (totalItens > 0) {
                  setCarrinhoAberto(true);
                } else {
                  setMinhaComandaAberta(true);
                }
              }}
              style={{ backgroundColor: (totalItens > 0 || subtotalComandaBanco > 0) ? corPrimaria : undefined }}
              className={`relative h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm ${
                (totalItens > 0 || subtotalComandaBanco > 0)
                  ? "text-white shadow-sm"
                  : "bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Abrir Comanda e Pedidos"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Comanda</span>

              {/* Badge Dinâmico de Quantidade de Itens */}
              {totalItens > 0 ? (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-white text-neutral-950 text-[10px] font-black font-mono">
                  {totalItens}
                </span>
              ) : subtotalComandaBanco > 0 ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              ) : null}
            </button>
          </div>
        </div>

        {/* CAMPO DE BUSCA EXPANSÍVEL */}
        {buscaAberta && (
          <div className="max-w-3xl mx-auto px-4 pb-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-card rounded-xl p-2 flex items-center gap-2 border border-border shadow-inner">
              <Search className="w-4 h-4 text-muted-foreground ml-1.5" />
              <input
                type="text"
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pratos, porções, drinks..."
                className="w-full text-xs font-medium bg-transparent border-none text-foreground focus:outline-none placeholder:text-muted-foreground"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. PÍLULAS DE CATEGORIAS COM SCROLL HORIZONTAL (GRUDADAS ABAIXO DO HEADER) */}
        <div className="border-t border-border bg-background/95 px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar select-none">
            {categorias.map((cat) => {
              const ativa = categoriaAtiva === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaAtiva(cat)}
                  style={{
                    backgroundColor: ativa ? corPrimaria : undefined,
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-xs active:scale-95 ${
                    ativa
                      ? "text-white shadow-sm"
                      : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* BANNER INFORMATIVO SE O GARÇOM FOI SOLICITADO */}
      {!ehAutoatendimento && segundosCooldown > 0 && (
        <div className="max-w-3xl mx-auto px-4 mt-3">
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-800 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Garçom a caminho da <strong>Mesa {numeroMesa}</strong>. Já vem atender você!</span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-white text-emerald-700 border-emerald-300">
              {segundosCooldown}s
            </Badge>
          </div>
        </div>
      )}

      {/* BANNER INFORMATIVO SE A CONTA FOI PEDIDA */}
      {contaPedidaSucesso && (
        <div className="max-w-3xl mx-auto px-4 mt-3">
          <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-900 text-xs flex items-center gap-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>
              {ehAutoatendimento
                ? `Fechamento solicitado para a Mesa ${numeroMesa}. Dirija-se ao caixa/balcão para concluir o pagamento!`
                : `Conta solicitada para a Mesa ${numeroMesa}. Aguarde o atendimento!`
              }
            </span>
          </div>
        </div>
      )}

      {/* DRAWER / OFFCANVAS COM AÇÕES SECUNDÁRIAS (MENU HAMBÚRGUER) */}
      <Sheet open={menuLateralAberto} onOpenChange={setMenuLateralAberto}>
        <SheetContent side="left" className={`bg-background text-foreground border-border w-[290px] p-5 flex flex-col justify-between ${classeModoVisual}`}>
          <div className="space-y-6">
            <SheetHeader className="text-left pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: corPrimaria }}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-md"
                >
                  {restaurante.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <SheetTitle className="text-base font-black text-foreground">{restaurante.nome}</SheetTitle>
                  <p className="text-xs text-muted-foreground">Atendimento Digital</p>
                </div>
              </div>
            </SheetHeader>

            {/* STATUS E TROCA DE MESA */}
            <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Sua Mesa</span>
                <span className="text-xs font-black text-emerald-500">Mesa {numeroMesa}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMenuLateralAberto(false);
                  setMesaScannerAberto(true);
                }}
                className="w-full h-9 rounded-xl border-border bg-muted/60 hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-2"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                <span>Trocar de Mesa (Escanear)</span>
              </Button>
            </div>

            {/* AÇÕES OPERACIONAIS */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider px-1">
                Serviços de Salão
              </span>

              {/* Botão Chamar Garçom - Apenas se não for autoatendimento */}
              {!ehAutoatendimento && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuLateralAberto(false);
                    handleChamarGarcom();
                  }}
                  disabled={chamandoGarcom || segundosCooldown > 0}
                  className="w-full p-3 rounded-xl bg-card hover:bg-muted border border-border text-left flex items-center justify-between text-xs font-bold text-foreground transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                      <Bell className="w-4 h-4" />
                    </div>
                    <span>{chamandoGarcom ? "Chamando..." : "Chamar Garçom na Mesa"}</span>
                  </div>
                  {segundosCooldown > 0 && (
                    <span className="text-[10px] text-amber-500 font-mono">{segundosCooldown}s</span>
                  )}
                </button>
              )}

              {/* Botão Pedir a Conta */}
              <button
                type="button"
                onClick={() => {
                  setMenuLateralAberto(false);
                  handlePedirConta();
                }}
                disabled={pedindoConta || contaPedidaSucesso}
                className="w-full p-3 rounded-xl bg-card hover:bg-muted border border-border text-left flex items-center justify-between text-xs font-bold text-foreground transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span>
                    {contaPedidaSucesso
                      ? "Conta Solicitada"
                      : ehAutoatendimento
                      ? "Pagar no Balcão / Caixa"
                      : "Pedir a Conta"}
                  </span>
                </div>
              </button>

              {/* Histórico / Comprovantes */}
              <button
                type="button"
                onClick={() => {
                  setMenuLateralAberto(false);
                  setHistoricoAberto(true);
                }}
                className="w-full p-3 rounded-xl bg-card hover:bg-muted border border-border text-left flex items-center gap-2.5 text-xs font-bold text-foreground transition-all"
              >
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Receipt className="w-4 h-4" />
                </div>
                <span>Comprovantes Anteriores</span>
              </button>

              {/* CONFORTO VISUAL & ILUMINAÇÃO (TENDÊNCIA UX: DIA / NOITE / DESCANSO) */}
              <div className="pt-2 space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider px-1">
                  Conforto Visual da Tela
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => alternarModoVisual("padrao")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      modoVisualCliente === "padrao"
                        ? "bg-primary/15 border-primary text-primary font-bold shadow-xs"
                        : "bg-card hover:bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">Original</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => alternarModoVisual("dia")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      modoVisualCliente === "dia"
                        ? "bg-primary/15 border-primary text-primary font-bold shadow-xs"
                        : "bg-card hover:bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span className="text-xs">Modo Dia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => alternarModoVisual("noite")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      modoVisualCliente === "noite"
                        ? "bg-primary/15 border-primary text-primary font-bold shadow-xs"
                        : "bg-card hover:bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span className="text-xs">Modo Noite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => alternarModoVisual("descanso")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      modoVisualCliente === "descanso"
                        ? "bg-amber-600/20 border-amber-500 text-amber-600 dark:text-amber-400 font-bold shadow-xs"
                        : "bg-card hover:bg-muted border-border text-muted-foreground"
                    }`}
                    title="Luz âmbar suave inspirada em papel artesanal para leitura noturna sem cansaço"
                  >
                    <Coffee className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs">Descanso</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border text-center">
            <span className="text-[10px] text-muted-foreground font-mono">MAYaMenu • Autoatendimento Inteligente</span>
          </div>
        </SheetContent>
      </Sheet>

      {/* LISTA DE ITENS DO CARDÁPIO */}
      <main className="max-w-3xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-500">
            {categoriaAtiva === "Todas" ? "Destaques da Casa" : categoriaAtiva} ({itensFiltrados.length})
          </h2>
        </div>

        {itensFiltrados.length === 0 ? (
          <div className="py-16 text-center text-neutral-400">
            <p className="text-base font-semibold">Nenhum item encontrado.</p>
            <p className="text-xs">Tente buscar por outro termo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {itensFiltrados.map((item, index) => {
              const isAboveTheFold = index < 2;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setItemSelecionado(item)}
                  className="group relative bg-card text-card-foreground rounded-3xl p-4 border border-border shadow-xs hover:shadow-md transition-all active:scale-[0.98] text-left flex gap-4 overflow-hidden"
                >
                  {/* Informações Textuais */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3 className="text-[17px] sm:text-lg font-bold font-heading text-foreground group-hover:text-primary transition-colors line-clamp-1 tracking-tight">
                        {item.nome}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                        {item.descricao}
                      </p>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-[18px] sm:text-[20px] font-black text-foreground tracking-tight">
                        {item.precoBase.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                      {item.grupoModificadores && item.grupoModificadores.length > 0 && (
                        <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                          Personalizável
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Foto Otimizada */}
                  {item.fotoUrl && (
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 bg-muted border border-border shadow-inner">
                      <Image
                        src={item.fotoUrl}
                        alt={item.nome}
                        fill
                        loading={isAboveTheFold ? "eager" : "lazy"}
                        priority={isAboveTheFold}
                        sizes="(max-width: 640px) 96px, 112px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* BARRA FLUTUANTE INFERIOR (Acesso permanente à Comanda ou Carrinho) */}
      {(totalItens > 0 || subtotalComandaBanco > 0) && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          {totalItens > 0 ? (
            <Button
              type="button"
              onClick={() => setCarrinhoAberto(true)}
              style={{ backgroundColor: corPrimaria }}
              className="w-full h-16 rounded-2xl shadow-2xl text-white font-black text-base flex items-center justify-between px-5 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="relative p-2 bg-white/20 rounded-xl">
                  <ShoppingBag className="w-5 h-5 text-white" />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-neutral-900 rounded-full text-xs font-black flex items-center justify-center shadow-sm">
                    {totalItens}
                  </span>
                </div>
                <div className="text-left">
                  <span className="block text-xs uppercase tracking-wider font-semibold opacity-90">
                    Enviar Rodada / Carrinho
                  </span>
                  <span className="text-sm font-bold">Mesa {numeroMesa}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase font-semibold opacity-90 block">Total Itens</span>
                <span className="text-lg font-black tracking-tight">
                  {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setMinhaComandaAberta(true)}
              className="w-full h-14 rounded-2xl shadow-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-black text-sm flex items-center justify-between px-5 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600/20 text-rose-400 rounded-xl">
                  <Utensils className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-xs uppercase tracking-wider font-bold text-neutral-300">
                    Minha Comanda Ativa
                  </span>
                  <span className="text-xs text-neutral-400">Mesa {numeroMesa} • Acompanhar pratos</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-neutral-400 block">Total</span>
                <span className="text-base font-black text-rose-400 font-mono tracking-tight">
                  {subtotalComandaBanco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </Button>
          )}
        </div>
      )}

      {/* MODAL DE PERSONALIZAÇÃO DE ITEM */}
      <ItemModal
        item={itemSelecionado}
        isOpen={!!itemSelecionado}
        onClose={() => setItemSelecionado(null)}
        corPrimaria={corPrimaria}
      />

      {/* DRAWER / CHECKOUT DA COMANDA */}
      <CartDrawer
        isOpen={carrinhoAberto}
        onClose={() => setCarrinhoAberto(false)}
        restauranteId={restaurante.id}
        slug={restaurante.slug}
        restauranteNome={restaurante.nome}
        corPrimaria={corPrimaria}
        taxaServicoPercentual={restaurante.configuracoes?.taxaServico ?? 10}
      />

      {/* MODAL DE HISTÓRICO / COMPROVANTES DO CLIENTE */}
      <HistoricoVisitasModal
        isOpen={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
      />

      {/* MODAL DE CONSULTA DA COMANDA ATIVA PELO CLIENTE (RODADAS & KDS) */}
      <MinhaComandaModal
        isOpen={minhaComandaAberta}
        onClose={() => setMinhaComandaAberta(false)}
        restauranteId={restaurante.id}
        mesaNumero={numeroMesa}
        slug={restaurante.slug}
        corPrimaria={corPrimaria}
        subtotalAcumulado={subtotalComandaBanco}
        statusComanda={comandaStatus}
        ehAutoatendimento={ehAutoatendimento}
        onPedirConta={handlePedirConta}
        pedindoConta={pedindoConta}
        contaPedidaSucesso={contaPedidaSucesso}
      />

      {/* MODAL DE LEITURA INTERNA DO QR CODE DA MESA */}
      <MesaScannerModal
        isOpen={mesaScannerAberto}
        onClose={() => setMesaScannerAberto(false)}
        mesaAtual={numeroMesa}
        onMesaDetectada={(novaMesa) => {
          setMesa(novaMesa);
          try {
            // Atualiza table_id e persistência do carrinho no localStorage
            localStorage.setItem("table_id", String(novaMesa));
            const cartKey = `mayamenu_cart_${restaurante.slug}`;
            const cartExistente = localStorage.getItem(cartKey);
            if (cartExistente) {
              const parsed = JSON.parse(cartExistente);
              parsed.mesa = novaMesa;
              localStorage.setItem(cartKey, JSON.stringify(parsed));
            }
          } catch {
            // Ignora erro de storage
          }
        }}
      />

      {/* MODAL DE FEEDBACK DE CONTA PAGA COM SUCESSO (Sincronia Garçom -> Cliente) */}
      {contaPagaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white">Conta Paga com Sucesso!</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Seu pagamento foi confirmado pelo restaurante. A comanda da <strong>Mesa {numeroMesa}</strong> foi encerrada.
              </p>
              <p className="text-xs text-rose-400 font-semibold pt-1">
                Muito obrigado pela visita! Volte sempre! ✨
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  setContaPagaModal(false);
                  setHistoricoAberto(true);
                }}
                className="w-full h-11 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4 text-rose-400" />
                Ver Comprovante Digital
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setContaPagaModal(false);
                  setSessaoFinalizada(true);
                }}
                className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs uppercase tracking-wider"
              >
                Concluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
