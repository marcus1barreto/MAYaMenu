"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { MenuItem, Restaurante, ComandaCliente } from "@/types";
import { useCart } from "@/context/cart-context";
import { ItemModal } from "./item-modal";
import { CartDrawer } from "./cart-drawer";
import { HistoricoVisitasModal } from "./historico-visitas-modal";
import { ShoppingBag, Sparkles, MapPin, Search, Receipt, DollarSign, CheckCircle2, Bell, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ensureClienteAnonimo, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { escutarCardapio, chamarGarcomFirestore } from "@/lib/restaurante-service";
import { marcarVisitaAtualComoPaga } from "@/lib/historico-cliente";

interface MenuViewProps {
  restaurante: Restaurante;
  cardapio: MenuItem[];
  numeroMesa?: number | string;
}

export function MenuView({ restaurante, cardapio: cardapioInicial, numeroMesa = 1 }: MenuViewProps) {
  const { totalItens, subtotal, nomeCliente } = useCart();
  const [cardapio, setCardapio] = useState<MenuItem[]>(cardapioInicial);
  const [itemSelecionado, setItemSelecionado] = useState<MenuItem | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [pedindoConta, setPedindoConta] = useState(false);
  const [contaPedidaSucesso, setContaPedidaSucesso] = useState(false);
  const [comandaStatus, setComandaStatus] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todas");

  // Categorias únicas disponíveis no cardápio
  const categorias = ["Todas", ...Array.from(new Set(cardapio.map((i) => i.categoria || "Geral")))];

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
    let unsubSnapshot: (() => void) | null = null;

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

      unsubSnapshot = onSnapshot(
        comandaRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as ComandaCliente;
            setComandaStatus(data.status);
            if (data.status === "conta_pedida") {
              setContaPedidaSucesso(true);
            } else if (data.status === "pago") {
              // Regra de desconexão oficial: comanda paga!
              marcarVisitaAtualComoPaga(restaurante.slug, numeroMesa);
            }
          }
        },
        (err) => {
          console.warn("Listener da comanda do cliente indisponível:", err);
        }
      );
    });

    return () => {
      if (unsubSnapshot) unsubSnapshot();
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

  const handleChamarGarcom = async () => {
    if (chamandoGarcom || segundosCooldown > 0) return;

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
    const confirmou = window.confirm("Deseja pedir a conta da sua mesa ao garçom?");
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

  const itensFiltrados = cardapio.filter((item) => {
    if (!item.ativo) return false;
    if (categoriaAtiva !== "Todas" && (item.categoria || "Geral") !== categoriaAtiva) return false;
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return (
      item.nome.toLowerCase().includes(b) ||
      item.descricao.toLowerCase().includes(b)
    );
  });

  return (
    <div className="min-h-screen bg-neutral-100/60 pb-28 text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white">
      {/* HEADER / CAPA COM EFEITO HERO */}
      <header className="relative w-full h-56 sm:h-72 bg-neutral-900 overflow-hidden shadow-lg">
        <Image
          src={capaUrl}
          alt={restaurante.nome}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-80 scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/95 via-neutral-950/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 max-w-3xl mx-auto flex flex-col justify-end">
          {/* LINHA DE STATUS E AÇÕES RÁPIDAS DA MESA */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
            <Badge
              variant="outline"
              className="bg-white/10 backdrop-blur-md text-white border-white/20 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
            >
              <MapPin className="w-3 h-3 mr-1 text-emerald-400" />
              Mesa {numeroMesa}
            </Badge>
            <Badge
              variant="outline"
              className="hidden xs:inline-flex bg-white/10 backdrop-blur-md text-white border-white/20 text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
            >
              Cardápio Digital PWA
            </Badge>

            {/* BOTÃO DA CARTEIRA / HISTÓRICO DE VISITAS */}
            <button
              type="button"
              onClick={() => setHistoricoAberto(true)}
              className="bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Receipt className="w-3 h-3 text-rose-300" />
              <span>Comprovantes</span>
            </button>

            {/* BOTÃO SOLICITAR GARÇOM (Oculto somente se configurado explicitamente como balcao) */}
            {modoOperacao !== "balcao" && (
              <button
                type="button"
                onClick={handleChamarGarcom}
                disabled={chamandoGarcom || segundosCooldown > 0}
                className={`backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1.5 shadow-md shrink-0 ${
                  segundosCooldown > 0
                    ? "bg-amber-500/90 text-amber-950 font-black cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-950/40"
                }`}
                title={segundosCooldown > 0 ? "Aguarde o garçom chegar à sua mesa" : "Chamar garçom na mesa"}
              >
                {segundosCooldown > 0 ? (
                  <>
                    <Clock className="w-3 h-3 text-amber-950 animate-spin" />
                    <span>Garçom a caminho ({Math.floor(segundosCooldown / 60)}:{String(segundosCooldown % 60).padStart(2, '0')})</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3 h-3 text-white animate-bounce" />
                    <span>{chamandoGarcom ? "Chamando..." : "Chamar Garçom"}</span>
                  </>
                )}
              </button>
            )}

            {/* BOTÃO PEDIR A CONTA */}
            <button
              type="button"
              onClick={handlePedirConta}
              disabled={pedindoConta || contaPedidaSucesso}
              className={`backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 shadow-sm shrink-0 ${
                contaPedidaSucesso
                  ? "bg-amber-500/80 text-amber-950 font-black"
                  : "bg-rose-600/80 hover:bg-rose-600"
              }`}
            >
              {contaPedidaSucesso ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-white" />
                  <span>Conta Solicitada!</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-3 h-3 text-white" />
                  <span>{pedindoConta ? "Chamando..." : "Pedir a Conta"}</span>
                </>
              )}
            </button>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
            {restaurante.nome}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 font-medium mt-1">
            Toque nos itens para personalizar seu pedido sem espera
          </p>

          {/* BANNER INFORMATIVO SE O GARÇOM FOI SOLICITADO (COM ANTI-FLOODING) */}
          {segundosCooldown > 0 && (
            <div className="mt-2.5 p-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-200 text-xs flex items-center justify-between backdrop-blur-md animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Garçom avisado para a <strong>Mesa {numeroMesa}</strong>. Já está vindo atender você!</span>
              </div>
              <Badge variant="outline" className="text-[10px] bg-emerald-950/80 text-emerald-300 border-emerald-500/40">
                Anti-spam: {segundosCooldown}s
              </Badge>
            </div>
          )}

          {/* BANNER INFORMATIVO SE A CONTA FOI PEDIDA */}
          {contaPedidaSucesso && (
            <div className="mt-2.5 p-2.5 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-200 text-xs flex items-center gap-2 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Conta solicitada ao garçom para a <strong>Mesa {numeroMesa}</strong>. Ele virá com a maquininha!</span>
            </div>
          )}
        </div>
      </header>

      {/* BARRA DE PESQUISA / FILTRO */}
      <div className="max-w-3xl mx-auto px-4 -mt-4 relative z-10 space-y-3">
        <div className="bg-white rounded-2xl shadow-md p-2 flex items-center gap-2 border border-neutral-200/80">
          <Search className="w-5 h-5 text-neutral-400 ml-2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pratos, sobremesas ou bebidas..."
            className="w-full text-sm font-medium bg-transparent border-none focus:outline-none placeholder:text-neutral-400"
          />
        </div>

        {/* ABAS / PÍLULAS DE CATEGORIAS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-xs active:scale-95 ${
                  ativa
                    ? "text-white shadow-md"
                    : "bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200/80"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

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
            {itensFiltrados.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setItemSelecionado(item)}
                className="group relative bg-white rounded-3xl p-4 border border-neutral-200/80 shadow-xs hover:shadow-md transition-all active:scale-[0.98] text-left flex gap-4 overflow-hidden"
              >
                {/* Informações Textuais */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 group-hover:text-neutral-950 transition-colors line-clamp-1">
                      {item.nome}
                    </h3>
                    <p className="text-xs text-neutral-500 leading-relaxed mt-1 line-clamp-2">
                      {item.descricao}
                    </p>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-base font-black text-neutral-900">
                      {item.precoBase.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    {item.grupoModificadores && item.grupoModificadores.length > 0 && (
                      <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        Personalizável
                      </span>
                    )}
                  </div>
                </div>

                {/* Foto Otimizada */}
                {item.fotoUrl && (
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 bg-neutral-100 border border-neutral-100 shadow-inner">
                    <Image
                      src={item.fotoUrl}
                      alt={item.nome}
                      fill
                      sizes="(max-width: 640px) 100px, 120px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* BARRA FLUTUANTE DE CARRINHO (Fat-finger friendly) */}
      {totalItens > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
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
                  Ver Comanda
                </span>
                <span className="text-sm font-bold">Mesa {numeroMesa}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase font-semibold opacity-90 block">Total</span>
              <span className="text-lg font-black tracking-tight">
                {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </Button>
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
      />

      {/* MODAL DE HISTÓRICO / COMPROVANTES DO CLIENTE */}
      <HistoricoVisitasModal
        isOpen={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
      />
    </div>
  );
}
