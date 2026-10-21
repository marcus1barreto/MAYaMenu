"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { CARDAPIO_DEMO } from "@/lib/mock-data";
import type { MenuItem, ComandaCliente } from "@/types";
import { getLimitesLicenca, getPlanoRestaurante } from "@/lib/licenca-limites";
import { parseDateToMillis } from "@/lib/datas";
import { db } from "@/lib/firebase";
import { collectionGroup, query, where, onSnapshot } from "firebase/firestore";
import {
  escutarCardapio,
  escutarComandasSalão,
  marcarComandaPagaFirestore,
  alternarDisponibilidadePrato,
  salvarItemCardapio,
  excluirItemCardapio,
  popularCardapioInicialSeVazio,
  atenderGarcomFirestore,
  lancarItemManualFirestore,
  trocarOrdemItens,
  fixarItemNoTopo,
} from "@/lib/restaurante-service";
import { GuidedEmptyCardapio } from "./guided-empty-cardapio";
import { AdminQrScannerModal } from "./admin-qr-scanner-modal";
import { ModificadorBuilder } from "./modificador-builder";
import { MAYA_MEDIA_LIBRARY } from "@/lib/maya-media-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  UtensilsCrossed,
  ChefHat,
  Smartphone,
  ExternalLink,
  LogOut,
  Plus,
  QrCode,
  DollarSign,
  Palette,
  Check,
  Users,
  Clock,
  Bell,
  Upload,
  Camera,
  Trash2,
  Loader2,
  ImageIcon,
  Lock,
  TrendingUp,
  Sparkles,
  BarChart3,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Pin,
  Settings,
  ListOrdered,
  Layers,
  Zap,
  Percent,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { uploadFotoPrato, excluirFotoPrato } from "@/lib/storage-service";
import { MesaDetalheModal } from "@/components/salao/mesa-detalhe-modal";
import { MESAS_INICIAIS, type MesaOperacional, type ComandaGarcom, TEMPO_TOLERANCIA_MINUTOS } from "@/components/garcom/garcom-view";
import { useTotalComanda } from "@/hooks/useTotalComanda";

function ValorDinamicoMesa({
  restauranteId,
  mesaSelecionada,
  comandaId,
  taxaServicoPercentual,
}: {
  restauranteId?: string;
  mesaSelecionada: string | number;
  comandaId?: string;
  taxaServicoPercentual: number;
}) {
  const { totalCalculado, carregando } = useTotalComanda(
    restauranteId,
    mesaSelecionada,
    comandaId
  );
  const totalComTaxa =
    totalCalculado + totalCalculado * (taxaServicoPercentual / 100);

  if (carregando) {
    return (
      <span className="text-xs text-rose-400/50 block leading-none">
        Calculando...
      </span>
    );
  }

  return (
    <span className="text-sm font-black text-rose-400 block leading-none">
      {totalComTaxa.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}
    </span>
  );
}

export function AdminDashboard() {
  const { restaurante, logout, atualizarRestaurante } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<"cardapio" | "mesas" | "analytics">("cardapio");
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [modalProAberto, setModalProAberto] = useState(false);
  const [itensCardapio, setItensCardapio] = useState<MenuItem[]>([]);
  const [carregandoCardapio, setCarregandoCardapio] = useState(true);
  const [corPrimaria, setCorPrimaria] = useState(
    restaurante?.configuracoes?.corPrimaria || "#E11D48"
  );
  const [modoOperacao, setModoOperacao] = useState<"com_garcom" | "hibrido" | "balcao">(
    restaurante?.configuracoes?.modoOperacao || "hibrido"
  );
  const [modoFilaKds, setModoFilaKds] = useState<"sequencial" | "agrupamento">(
    restaurante?.configuracoes?.modoFilaKds || "sequencial"
  );
  const [taxaServicoConfig, setTaxaServicoConfig] = useState<number>(
    restaurante?.configuracoes?.taxaServico !== undefined ? restaurante.configuracoes.taxaServico : 10
  );
  const [salvandoCor, setSalvandoCor] = useState(false);
  const [scannerBalcaoAberto, setScannerBalcaoAberto] = useState(false);
  const [feedbackBalcao, setFeedbackBalcao] = useState<string | null>(null);

  // Sincroniza cardápio em tempo real com o Firestore
  useEffect(() => {
    if (!restaurante?.id) return;

    setCarregandoCardapio(true);
    const unsub = escutarCardapio(restaurante.id, (novosItens) => {
      setItensCardapio(novosItens);
      setCarregandoCardapio(false);
    });

    return () => unsub();
  }, [restaurante?.id]);

  // Controle de Mesas do Salão (sincronizadas com Firestore conforme o limite do plano)
  const { maxMesas } = getLimitesLicenca(restaurante);
  const [mesas, setMesas] = useState<MesaOperacional[]>(() => {
    const mapaLimpo: MesaOperacional[] = [];
    for (let i = 1; i <= maxMesas; i++) {
      mapaLimpo.push({ numero: i, status: "livre", comandas: [] });
    }
    return mapaLimpo;
  });
  const [comandas, setComandas] = useState<(ComandaCliente & { refPath?: string })[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaOperacional | null>(null);
  const [modalMesaAberto, setModalMesaAberto] = useState(false);

  // Escuta comandas reais do restaurante no Firestore para o Salão do Admin com tratamento de remoção em tempo real
  useEffect(() => {
    const idBusca = restaurante?.id || restaurante?.slug;
    if (!idBusca) return;

    const idsParaBuscar = Array.from(
      new Set([restaurante?.id, restaurante?.slug].filter(Boolean) as string[])
    );

    const q = idsParaBuscar.length > 1
      ? query(collectionGroup(db, "comandas_abertas"), where("restauranteId", "in", idsParaBuscar))
      : query(collectionGroup(db, "comandas_abertas"), where("restauranteId", "==", idsParaBuscar[0]));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        // Trata os eventos docChanges para atualizar o estado local de comandas
        setComandas((prevComandas) => {
          let lista = [...prevComandas];

          snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            if (change.type === "removed") {
              // Remoção explícita da comanda ao ser liberada / arquivada
              lista = lista.filter((c) => c.id !== docId);
            } else if (change.type === "added" || change.type === "modified") {
              const data = change.doc.data() as ComandaCliente;
              const comandaItem: ComandaCliente & { refPath: string } = {
                ...data,
                id: docId,
                refPath: change.doc.ref.path,
              };
              const index = lista.findIndex((c) => c.id === docId);
              if (index >= 0) {
                lista[index] = comandaItem;
              } else {
                lista.push(comandaItem);
              }
            }
          });

          // Reconstrói as mesas com base nas comandas ativas e no limite do plano
          const mapa = new Map<number, MesaOperacional>();
          for (let i = 1; i <= maxMesas; i++) {
            mapa.set(i, { numero: i, status: "livre", comandas: [] });
          }

          for (const c of lista) {
            const numMesa = Number(c.mesa) || 1;
            const mesaAtual = mapa.get(numMesa) || { numero: numMesa, status: "livre", comandas: [] };
            const garcomChamadoAtivo = Boolean(c.chamadoGarcom?.ativo);

            mesaAtual.comandas.push({
              id: c.id,
              nomeCliente: c.nomeCliente,
              subtotal: c.subtotal || 0,
              status: c.status,
              itens: [],
              chamadoGarcom: c.chamadoGarcom,
            });

            if (garcomChamadoAtivo) {
              mesaAtual.chamandoGarcom = true;
            }

            if (c.status === "conta_pedida") {
              mesaAtual.status = "conta_pedida";
            } else if (c.status === "pago") {
              const todasPagas = mesaAtual.comandas.every((cmd) => cmd.status === "pago");
              if (todasPagas && mesaAtual.status !== "conta_pedida") {
                mesaAtual.status = "paga_ocupada";

                // Registra o momento em que a conta foi paga a partir de atualizadoEm
                const millisPago = parseDateToMillis(c.atualizadoEm);

                if (millisPago) {
                  if (!mesaAtual.pagoEm || millisPago > mesaAtual.pagoEm) {
                    mesaAtual.pagoEm = millisPago;
                  }
                }

                // Alerta Proativo de Upsell: verifica se já ultrapassou o tempo de tolerância
                if (mesaAtual.pagoEm) {
                  const minutosPassados = (Date.now() - mesaAtual.pagoEm) / (1000 * 60);
                  if (minutosPassados >= TEMPO_TOLERANCIA_MINUTOS) {
                    mesaAtual.alertaUpsell = true;
                  }
                }
              }
            } else if (mesaAtual.status !== "conta_pedida" && mesaAtual.status !== "paga_ocupada") {
              mesaAtual.status = "ocupada";
            }

            mapa.set(numMesa, mesaAtual);
          }

          const novasMesas = Array.from(mapa.values());
          setMesas(novasMesas);

          // Sincroniza a mesa selecionada se estiver aberta no modal
          setMesaSelecionada((prevSelecionada) => {
            if (!prevSelecionada) return null;
            const mesaAtualizada = mapa.get(prevSelecionada.numero);
            return mesaAtualizada || { numero: prevSelecionada.numero, status: "livre", comandas: [] };
          });

          return lista;
        });
      },
      (err) => {
        console.warn("Listener de comandas do salão no Admin indisponível:", err);
      }
    );

    return () => unsub();
  }, [restaurante?.id, restaurante?.slug, maxMesas]);

  const handleAbrirMesa = (num: number) => {
    const mesaEncontrada = mesas.find((m) => m.numero === num) || {
      numero: num,
      status: "livre" as const,
      comandas: [],
    };
    setMesaSelecionada(mesaEncontrada);
    setModalMesaAberto(true);
  };

  const handleMarcarComoPago = async (mesaNumero: number, clienteId: string) => {
    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero === mesaNumero) {
          const novasComandas = m.comandas.map((c) =>
            c.id === clienteId ? { ...c, status: "pago" as const } : c
          );
          const todasPagas = novasComandas.every((c) => c.status === "pago");
          return {
            ...m,
            status: todasPagas ? ("paga_ocupada" as const) : m.status,
            comandas: novasComandas,
          };
        }
        return m;
      })
    );

    setMesaSelecionada((prev) => {
      if (!prev || prev.numero !== mesaNumero) return prev;
      const novas = prev.comandas.map((c) =>
        c.id === clienteId ? { ...c, status: "pago" as const } : c
      );
      const todasPagas = novas.every((c) => c.status === "pago");
      return {
        ...prev,
        status: todasPagas ? ("paga_ocupada" as const) : prev.status,
        comandas: novas,
      };
    });

    if (restaurante?.id) {
      try {
        await marcarComandaPagaFirestore(restaurante.id, mesaNumero, clienteId);
      } catch (err) {
        console.warn("Falha ao marcar comanda como paga no Firestore:", err);
      }
    }
  };

  const handleLiberarMesa = async (mesaNumero: number) => {
    const mesaAlvo = mesas.find((m) => m.numero === mesaNumero);
    const comandasIds = mesaAlvo ? mesaAlvo.comandas.map((c) => c.id) : [];

    setMesas((prev) =>
      prev.map((m) =>
        m.numero === mesaNumero ? { ...m, status: "livre", comandas: [] } : m
      )
    );
    setMesaSelecionada(null);
    setModalMesaAberto(false);

    if (restaurante?.id && comandasIds.length > 0) {
      try {
        const { liberarMesaFirestore } = await import("@/lib/restaurante-service");
        await liberarMesaFirestore(restaurante.id, mesaNumero, comandasIds);
      } catch (err) {
        console.warn("Falha ao liberar mesa no Firestore pelo Admin:", err);
      }
    }
  };

  // Dá baixa imediata na comanda do cliente escaneada no Balcão/Caixa
  const handleConfirmarComandaBalcao = async (payload: {
    mesaNumero: number | string;
    clienteId: string;
    nomeCliente: string;
    total: number;
    ticket: any;
  }) => {
    const numMesa = Number(payload.mesaNumero) || 1;
    if (!restaurante?.id) return;

    // 1. Marca a comanda como paga
    await handleMarcarComoPago(numMesa, payload.clienteId);

    // 2. Libera a mesa / fecha comanda se estiver no modo balcão
    if (modoOperacao === "balcao") {
      await handleLiberarMesa(numMesa);
    }

    setFeedbackBalcao(
      `Pagamento confirmado e comanda da Mesa ${payload.mesaNumero} (${payload.nomeCliente}) baixada com sucesso!`
    );
    setTimeout(() => setFeedbackBalcao(null), 5000);
  };

  const handleAtenderGarcom = async (mesaNumero: number, clienteId: string) => {
    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero === mesaNumero) {
          const novasComandas = m.comandas.map((c) =>
            c.id === clienteId && c.chamadoGarcom
              ? { ...c, chamadoGarcom: { ...c.chamadoGarcom, ativo: false } }
              : c
          );
          const aindaTemChamado = novasComandas.some((c) => c.chamadoGarcom?.ativo);
          return {
            ...m,
            chamandoGarcom: aindaTemChamado,
            comandas: novasComandas,
          };
        }
        return m;
      })
    );

    setMesaSelecionada((prev) => {
      if (!prev || prev.numero !== mesaNumero) return prev;
      const novasComandas = prev.comandas.map((c) =>
        c.id === clienteId && c.chamadoGarcom
          ? { ...c, chamadoGarcom: { ...c.chamadoGarcom, ativo: false } }
          : c
      );
      const aindaTemChamado = novasComandas.some((c) => c.chamadoGarcom?.ativo);
      return {
        ...prev,
        chamandoGarcom: aindaTemChamado,
        comandas: novasComandas,
      };
    });

    if (restaurante?.id) {
      try {
        await atenderGarcomFirestore(restaurante.id, mesaNumero, clienteId);
      } catch (err) {
        console.warn("Falha ao desarmar chamado no Firestore pelo Admin:", err);
      }
    }
  };

  const handleLancarItemManual = (
    mesaNumero: number,
    clienteNome: string,
    item: MenuItem,
    quantidade: number,
    observacao?: string
  ) => {
    const precoFinal = item.precoBase * quantidade;

    let clienteIdDestino: string | undefined = undefined;

    setMesas((prev) =>
      prev.map((m) => {
        if (m.numero === mesaNumero) {
          const comandaExistente = m.comandas.find(
            (c) => c.nomeCliente.toLowerCase() === clienteNome.toLowerCase()
          );

          let novasComandas: ComandaGarcom[];
          if (comandaExistente) {
            clienteIdDestino = comandaExistente.id;
            novasComandas = m.comandas.map((c) =>
              c.id === comandaExistente.id
                ? {
                    ...c,
                    subtotal: c.subtotal + precoFinal,
                    itens: [
                      ...c.itens,
                      {
                        nome: item.nome,
                        quantidade,
                        precoFinal: item.precoBase,
                      },
                    ],
                  }
                : c
            );
          } else {
            const novoCId = `cli-${Date.now().toString(36)}`;
            clienteIdDestino = novoCId;
            const novaComanda: ComandaGarcom = {
              id: novoCId,
              nomeCliente: clienteNome,
              subtotal: precoFinal,
              status: "aguardando_pratos",
              itens: [
                {
                  nome: item.nome,
                  quantidade,
                  precoFinal: item.precoBase,
                },
              ],
            };
            novasComandas = [...m.comandas, novaComanda];
          }

          return {
            ...m,
            status: "ocupada",
            comandas: novasComandas,
          };
        }
        return m;
      })
    );

    setMesaSelecionada((prev) => {
      if (!prev || prev.numero !== mesaNumero) return prev;
      const comandaExistente = prev.comandas.find(
        (c) => c.nomeCliente.toLowerCase() === clienteNome.toLowerCase()
      );
      if (comandaExistente) {
        return {
          ...prev,
          status: "ocupada",
          comandas: prev.comandas.map((c) =>
            c.id === comandaExistente.id
              ? {
                  ...c,
                  subtotal: c.subtotal + precoFinal,
                  itens: [
                    ...c.itens,
                    {
                      nome: item.nome,
                      quantidade,
                      precoFinal: item.precoBase,
                    },
                  ],
                }
              : c
          ),
        };
      }
      return {
        ...prev,
        status: "ocupada",
        comandas: [
          ...prev.comandas,
          {
            id: `cli-${Date.now().toString(36)}`,
            nomeCliente: clienteNome,
            subtotal: precoFinal,
            status: "aguardando_pratos",
            itens: [
              {
                nome: item.nome,
                quantidade,
                precoFinal: item.precoBase,
              },
            ],
          },
        ],
      };
    });

    // Injeção real no Firestore para o KDS da Cozinha
    if (restaurante?.id) {
      lancarItemManualFirestore({
        restauranteId: restaurante.id,
        slug: restaurante.slug,
        mesaNumero,
        clienteNome,
        clienteId: clienteIdDestino,
        item,
        quantidade,
        observacao,
      }).catch((err) => {
        console.warn("Falha ao injetar item lançado manualmente no Firestore pelo Admin:", err);
      });
    }
  };

  // Toggle de item ativo/pausado instantâneo conectado ao Firestore
  const handleToggleAtivo = async (id: string) => {
    const itemAtual = itensCardapio.find((it) => it.id === id);
    if (!itemAtual) return;
    const novoStatus = !itemAtual.ativo;

    // Atualização otimista imediata na UI
    setItensCardapio((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ativo: novoStatus } : item))
    );

    if (restaurante?.id) {
      try {
        await alternarDisponibilidadePrato(restaurante.id, id, novoStatus);
      } catch (err) {
        console.warn("Falha ao sincronizar disponibilidade do prato:", err);
      }
    }
  };

  // Modal de Adicionar / Editar Prato
  const [modalPratoAberto, setModalPratoAberto] = useState(false);
  const [itemEmEdicao, setItemEmEdicao] = useState<Partial<MenuItem> | null>(null);
  const [salvandoPrato, setSalvandoPrato] = useState(false);
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const handleAbrirNovoPrato = () => {
    setArquivoFoto(null);
    setPreviewFoto(null);
    setItemEmEdicao({
      id: `item-${Date.now().toString(36)}`,
      nome: "",
      categoria: "Hambúrgueres",
      descricao: "",
      precoBase: 30,
      tempoPreparoEstimado: 15,
      ativo: true,
      fotoUrl: "",
      grupoModificadores: [],
    });
    setModalPratoAberto(true);
  };

  const handleEditarPrato = (item: MenuItem) => {
    setArquivoFoto(null);
    setPreviewFoto(item.fotoUrl || null);
    setItemEmEdicao({ ...item });
    setModalPratoAberto(true);
  };

  const handleFotoSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem selecionada ultrapassa o limite de 5MB. Escolha uma imagem menor.");
      return;
    }

    setArquivoFoto(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewFoto(objectUrl);
  };

  const handleRemoverFoto = () => {
    setArquivoFoto(null);
    setPreviewFoto(null);
    if (itemEmEdicao) {
      setItemEmEdicao({ ...itemEmEdicao, fotoUrl: "" });
    }
  };

  const handleSalvarPrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEmEdicao || !itemEmEdicao.nome?.trim() || !restaurante?.id) return;

    // Bloqueio de limite de pratos conforme o plano
    const { maxPratos } = getLimitesLicenca(restaurante);
    if (!itemEmEdicao.id && itensCardapio.length >= maxPratos) {
      alert(`O seu plano permite no máximo ${maxPratos} pratos. Faça upgrade!`);
      return;
    }

    setSalvandoPrato(true);
    let fotoUrlFinal = itemEmEdicao.fotoUrl?.trim() || "";

    // 1. Se o lojista selecionou uma nova foto, faz upload no Storage primeiro
    if (arquivoFoto) {
      setEnviandoFoto(true);
      try {
        const urlUpload = await uploadFotoPrato(restaurante.id, arquivoFoto);
        
        // Se já existia uma foto antiga no Storage antes da troca, remove para não deixar lixo
        if (
          itemEmEdicao.fotoUrl &&
          itemEmEdicao.fotoUrl !== urlUpload &&
          (itemEmEdicao.fotoUrl.includes("firebasestorage.googleapis.com") ||
           itemEmEdicao.fotoUrl.includes("storage.googleapis.com"))
        ) {
          excluirFotoPrato(itemEmEdicao.fotoUrl).catch((err) =>
            console.warn("Aviso ao limpar foto anterior no Storage:", err)
          );
        }

        fotoUrlFinal = urlUpload;
      } catch (uploadErr) {
        console.error("Falha ao enviar foto para o Storage:", uploadErr);
        // Resiliência: avisa o usuário mas permite continuar o salvamento dos dados do prato
        alert("Não foi possível enviar a foto no momento. O prato será salvo com as informações de texto.");
      } finally {
        setEnviandoFoto(false);
      }
    }

    // 2. Salva o prato no Firestore
    try {
      // Se for novo item, coloca na última posição da categoria
      const itensMesmaCat = itensCardapio.filter(
        (i) => (i.categoria || "Geral") === (itemEmEdicao.categoria?.trim() || "Geral")
      );
      const ordemCalculada =
        itemEmEdicao.ordem !== undefined
          ? itemEmEdicao.ordem
          : itensMesmaCat.length;

      const itemPronto: MenuItem = {
        id: itemEmEdicao.id || `item-${Date.now().toString(36)}`,
        nome: itemEmEdicao.nome.trim(),
        categoria: itemEmEdicao.categoria?.trim() || "Geral",
        descricao: itemEmEdicao.descricao?.trim() || "",
        precoBase: Number(itemEmEdicao.precoBase) || 0,
        tempoPreparoEstimado:
          itemEmEdicao.tempoPreparoEstimado !== undefined
            ? Math.max(1, Number(itemEmEdicao.tempoPreparoEstimado))
            : 15,
        ativo: itemEmEdicao.ativo !== undefined ? itemEmEdicao.ativo : true,
        ordem: ordemCalculada,
        fotoUrl: fotoUrlFinal,
        grupoModificadores: itemEmEdicao.grupoModificadores || [],
      };

      await salvarItemCardapio(restaurante.id, itemPronto);
      setModalPratoAberto(false);
      setItemEmEdicao(null);
      setArquivoFoto(null);
      setPreviewFoto(null);
    } catch (err) {
      console.warn("Falha ao salvar prato:", err);
    } finally {
      setSalvandoPrato(false);
    }
  };

  // Sistema de Ordenação Tátil (sem drag-and-drop): Move item para cima ou para baixo
  const handleMoverItem = async (item: MenuItem, direcao: "cima" | "baixo") => {
    if (!restaurante?.id) return;
    const cat = item.categoria || "Geral";
    const itensDaCat = itensCardapio
      .filter((i) => (i.categoria || "Geral") === cat)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

    const indexAtual = itensDaCat.findIndex((i) => i.id === item.id);
    if (indexAtual === -1) return;

    const indexAlvo = direcao === "cima" ? indexAtual - 1 : indexAtual + 1;
    if (indexAlvo < 0 || indexAlvo >= itensDaCat.length) return;

    const itemAlvo = itensDaCat[indexAlvo];
    const ordemAtual = item.ordem ?? indexAtual;
    const ordemAlvo = itemAlvo.ordem ?? indexAlvo;

    try {
      await trocarOrdemItens(
        restaurante.id,
        { id: item.id, ordem: ordemAtual },
        { id: itemAlvo.id, ordem: ordemAlvo }
      );
    } catch (err) {
      console.error("Falha ao reordenar pratos:", err);
    }
  };

  // Sistema de Ordenação Tátil: Fixa o prato imediatamente no topo (ordem: 0)
  const handleFixarTopo = async (item: MenuItem) => {
    if (!restaurante?.id) return;
    const cat = item.categoria || "Geral";
    const itensDaCat = itensCardapio
      .filter((i) => (i.categoria || "Geral") === cat)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

    try {
      await fixarItemNoTopo(restaurante.id, item.id, itensDaCat);
    } catch (err) {
      console.error("Falha ao fixar prato no topo:", err);
    }
  };

  const handleExcluirPrato = async (id: string, fotoUrl?: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este prato do cardápio?")) return;
    if (restaurante?.id) {
      try {
        await excluirItemCardapio(restaurante.id, id, fotoUrl);
      } catch (err) {
        console.warn("Falha ao excluir prato:", err);
      }
    }
  };

  const handleSalvarCor = async () => {
    setSalvandoCor(true);
    try {
      await atualizarRestaurante({
        configuracoes: {
          tema: "light",
          corPrimaria,
          capaUrl: restaurante?.configuracoes?.capaUrl || "/images/capa-padrao.webp",
          modoOperacao,
          modoFilaKds,
          taxaServico: Number(taxaServicoConfig) || 0,
        },
      });
    } finally {
      setSalvandoCor(false);
    }
  };

  const slug = restaurante?.slug || "demo";
  const urlPublica = `/r/${slug}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* BARRA SUPERIOR DO PAINEL */}
      <header className="p-4 sm:p-6 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center font-black shadow-md">
            M
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight leading-tight">
              {restaurante?.nome || "Painel MAYaMenu"}
            </h1>
            <p className="text-xs text-neutral-400">Administração & Operação Alpha</p>
          </div>
        </div>

        {/* ATALHOS RÁPIDOS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* BOTÃO LEITOR DE BALCÃO / CAIXA */}
          <Button
            type="button"
            onClick={() => setScannerBalcaoAberto(true)}
            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs h-10 px-3.5 rounded-xl flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all active:scale-95"
            title="Escanear comanda do cliente no balcão para baixa imediata"
          >
            <QrCode className="w-4 h-4 text-neutral-950" />
            <span>Escanear Comanda (Balcão)</span>
          </Button>

          <Link href="/cozinha" target="_blank">
            <Button
              variant="outline"
              className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-amber-400 hover:text-amber-300 font-bold text-xs h-10 rounded-xl flex items-center gap-2"
            >
              <ChefHat className="w-4 h-4" />
              <span>Abrir KDS Cozinha</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </Link>

          <Link href={`${urlPublica}?mesa=1`} target="_blank">
            <Button
              variant="outline"
              className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white font-bold text-xs h-10 rounded-xl flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4 text-rose-500" />
              <span>Ver Cardápio PWA</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            onClick={() => setModalConfigAberto(true)}
            className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:text-white text-neutral-300 font-bold text-xs h-10 px-3 rounded-xl flex items-center gap-2 transition-all"
            title="Configurações Globais & Tematização"
          >
            <Settings className="w-4 h-4 text-rose-500" />
            <span className="hidden sm:inline">Configurações</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={logout}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl text-xs h-10"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* BANNER DE FEEDBACK VISUAL DO BALCÃO */}
      {feedbackBalcao && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-2.5 text-center text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackBalcao}</span>
        </div>
      )}

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="border-b border-neutral-800 px-4 sm:px-6 bg-neutral-900/50">
        <div className="flex items-center gap-2 max-w-5xl mx-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva("cardapio")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === "cardapio"
                ? "border-rose-500 text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Cardápio & Itens ({itensCardapio.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("mesas")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === "mesas"
                ? "border-rose-500 text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Mesas & QR Codes</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("analytics")}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 relative ${
              abaAtiva === "analytics"
                ? "border-rose-500 text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span className="flex items-center gap-1.5">
              MAYa Inteligência
              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-black uppercase px-1.5 py-0">
                PRO 🚀
              </Badge>
            </span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
        {/* ABA: CARDÁPIO */}
        {abaAtiva === "cardapio" && (
          <div className="space-y-6">
            {carregandoCardapio ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                <p className="text-xs font-bold text-neutral-400">Carregando cardápio...</p>
              </div>
            ) : itensCardapio.length === 0 ? (
              /* GUIDED EMPTY STATE: ONBOARDING DO 1º PRATO */
              <GuidedEmptyCardapio
                restauranteId={restaurante?.id || "demo"}
                onItemCriado={() => {
                  // O listener em tempo real já sincroniza o novo prato
                }}
              />
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Gestão & Ordenação de Pratos</h2>
                    <p className="text-xs text-neutral-400">
                      Organize a ordem dos seus pratos de forma tátil, ajuste preços ou pause esgotados.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleAbrirNovoPrato}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-10 px-4 rounded-xl flex items-center gap-2 shadow-lg"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Adicionar Novo Item</span>
                  </Button>
                </div>

                {/* AGRUPAMENTO POR CATEGORIAS COM ORDENAÇÃO TÁTIL */}
                {Array.from(new Set(itensCardapio.map((i) => i.categoria || "Geral"))).map((catNome) => {
                  const itensDaCat = itensCardapio
                    .filter((i) => (i.categoria || "Geral") === catNome)
                    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

                  return (
                    <div key={catNome} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                          {catNome} ({itensDaCat.length})
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {itensDaCat.map((item, idx) => {
                          const ehPrimeiro = idx === 0;
                          const ehUltimo = idx === itensDaCat.length - 1;

                          return (
                            <div
                              key={item.id}
                              className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                item.ativo
                                  ? "bg-neutral-900 border-neutral-800 hover:border-neutral-750"
                                  : "bg-neutral-900/40 border-neutral-800/50 opacity-60"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {item.fotoUrl && (
                                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 border border-neutral-800">
                                    <Image src={item.fotoUrl} alt={item.nome} fill className="object-cover" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white truncate">{item.nome}</h4>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                                      #{idx + 1}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-400 truncate max-w-md mt-0.5">
                                    {item.descricao}
                                  </p>
                                  <span className="text-xs font-black text-rose-400 mt-1 block">
                                    {item.precoBase.toLocaleString("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    })}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/60">
                                {/* CONTROLES TÁTEIS DE ORDENAÇÃO */}
                                <div className="flex items-center gap-1 bg-neutral-950/80 border border-neutral-800 p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => handleMoverItem(item, "cima")}
                                    disabled={ehPrimeiro}
                                    title="Mover para cima"
                                    className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoverItem(item, "baixo")}
                                    disabled={ehUltimo}
                                    title="Mover para baixo"
                                    className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleFixarTopo(item)}
                                    disabled={ehPrimeiro}
                                    title="Destacar no Topo desta categoria"
                                    className="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1"
                                  >
                                    <Pin className="w-3 h-3" />
                                    <span>Topo</span>
                                  </button>
                                </div>

                                {/* AÇÕES DE EDIÇÃO & DISPONIBILIDADE */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditarPrato(item)}
                                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleExcluirPrato(item.id, item.fotoUrl)}
                                    className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg text-xs transition-colors"
                                    title="Excluir item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <Switch
                                    checked={item.ativo}
                                    onCheckedChange={() => handleToggleAtivo(item.id)}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA: CONTROLE OPERACIONAL DAS MESAS */}
        {abaAtiva === "mesas" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Controle de Mesas do Salão</h2>
                <p className="text-xs text-neutral-400">
                  Clique numa mesa para ver os pedidos, comandas por cliente, rateio de conta ou imprimir o QR Code.
                </p>
              </div>

              {/* Legenda de Status */}
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-neutral-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                  Livre
                </span>
                <span className="flex items-center gap-1.5 text-neutral-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Ocupada
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  Pediu Conta
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {mesas.map((mesa) => {
                const num = mesa.numero;
                const ehChamado = Boolean(mesa.chamandoGarcom);
                const totalMesa = mesa.comandas.reduce((acc, c) => acc + c.subtotal, 0);
                const qtdClientes = mesa.comandas.length;

                return (
                  <div
                    key={num}
                    onClick={() => handleAbrirMesa(num)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[140px] group relative overflow-hidden cursor-pointer select-none active:scale-[0.98] ${
                      ehChamado
                        ? "bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-950/60 animate-pulse"
                        : mesa.status === "conta_pedida"
                        ? "bg-rose-950/40 border-rose-500/60 hover:border-rose-400 shadow-lg shadow-rose-950/50"
                        : mesa.status === "paga_ocupada"
                        ? "bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-950/50 hover:border-emerald-400"
                        : mesa.status === "ocupada"
                        ? "bg-neutral-900 border-amber-500/40 hover:border-amber-400 shadow-md"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {/* Indicador de Status Superior */}
                    <div className="flex items-start justify-between w-full">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-transform group-hover:scale-105 ${
                          ehChamado
                            ? "bg-amber-400 text-neutral-950 font-black shadow-md shadow-amber-400/50 animate-bounce"
                            : mesa.status === "conta_pedida"
                            ? "bg-rose-600 text-white shadow-md shadow-rose-600/40 animate-pulse"
                            : mesa.status === "paga_ocupada"
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/40"
                            : mesa.status === "ocupada"
                            ? "bg-amber-500 text-neutral-950 font-black shadow-md"
                            : "bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700"
                        }`}
                      >
                        {num}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {ehChamado && (
                          <Badge className="bg-amber-400 text-neutral-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 flex items-center gap-1 shadow-md">
                            <Bell className="w-2.5 h-2.5 fill-neutral-950" />
                            Garçom!
                          </Badge>
                        )}

                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                            mesa.status === "conta_pedida"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : mesa.status === "paga_ocupada"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-black"
                              : mesa.status === "ocupada"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-neutral-800 text-neutral-500 border-neutral-700"
                          }`}
                        >
                          {mesa.status === "conta_pedida"
                            ? "Conta"
                            : mesa.status === "paga_ocupada"
                            ? "Paga"
                            : mesa.status === "ocupada"
                            ? "Ocupada"
                            : "Livre"}
                        </Badge>

                        {mesa.alertaUpsell && (
                          <Badge className="bg-purple-900/90 text-purple-200 border border-purple-500/50 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 shadow-md flex items-center gap-1 animate-pulse">
                            ⏳ +15m parada (Sugerir Upsell?)
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Resumo da Mesa */}
                    <div className="mt-3">
                      <span className="text-xs font-bold text-white block">Mesa {num}</span>
                      {mesa.status !== "livre" ? (
                        <div className="mt-1">
                          {mesa.comandas.length > 0 ? (
                            <ValorDinamicoMesa 
                              restauranteId={restaurante?.id}
                              mesaSelecionada={num}
                              comandaId={mesa.comandas[0].id}
                              taxaServicoPercentual={restaurante?.configuracoes?.taxaServico ?? 10}
                            />
                          ) : (
                            <span className="text-sm font-black text-rose-400 block leading-none">R$ 0,00</span>
                          )}
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-1 font-medium">
                            <Users className="w-3 h-3 text-neutral-500" />
                            {qtdClientes} {qtdClientes === 1 ? "pessoa" : "pessoas"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-500 block mt-1">Disponível</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}



        {/* ABA: MAYA INTELIGÊNCIA / ANALYTICS (PREMIUM UPSELL) */}
        {abaAtiva === "analytics" && (
          <div className="relative min-h-[640px] rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950/60 p-4 sm:p-8">
            {/* CONTEÚDO DOS RELATÓRIOS (Desfocado apenas se for plano Free) */}
            {(() => {
              const planoAtual = getPlanoRestaurante(restaurante);
              const isFree = planoAtual === "free";

              return (
                <>
                  <div
                    className={`space-y-6 ${
                      isFree
                        ? "filter blur-md select-none pointer-events-none opacity-40"
                        : "opacity-100"
                    }`}
                  >
                    {/* Header do Relatório */}
                    <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
                      <div>
                        <h3 className="text-lg font-black text-white">Relatório de Desempenho e Eficiência do Salão</h3>
                        <p className="text-xs text-neutral-400">Últimos 30 dias • Comparativo por turno e rotatividade</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-8 w-24 bg-neutral-800 rounded-lg" />
                        <div className="h-8 w-28 bg-neutral-800 rounded-lg" />
                      </div>
                    </div>

                    {/* Grid dos 3 Cards Principais */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* 1. Eficiência do Salão */}
                      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-neutral-400 uppercase">Eficiência do Salão</span>
                          <span className="text-xs text-emerald-400 font-bold">+18.4%</span>
                        </div>
                        <div className="text-3xl font-black text-white">84.2%</div>
                        <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 w-[84%]" />
                        </div>
                        <p className="text-[11px] text-neutral-400">Giro médio: 4.2 clientes por mesa / noite</p>
                      </div>

                      {/* 2. Mapa de Calor das Mesas */}
                      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-neutral-400 uppercase">Mapa de Calor das Mesas</span>
                          <span className="text-xs text-amber-400 font-bold">Mesa 4 & 7 no topo</span>
                        </div>
                        <div className="text-3xl font-black text-amber-400">R$ 14.850</div>
                        <div className="grid grid-cols-6 gap-1 pt-1">
                          {[90, 45, 60, 100, 30, 85, 95, 70, 40, 80, 55, 65].map((v, i) => (
                            <div
                              key={i}
                              className={`h-6 rounded flex items-center justify-center text-[9px] font-bold ${
                                v > 80 ? "bg-rose-500 text-white" : v > 50 ? "bg-amber-500/80 text-black" : "bg-neutral-800 text-neutral-400"
                              }`}
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-neutral-400">Taxa de ociosidade média: 14.8 minutos</p>
                      </div>

                      {/* 3. Tempo Médio da Cozinha */}
                      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-neutral-400 uppercase">Tempo Médio da Cozinha</span>
                          <span className="text-xs text-emerald-400 font-bold">-4 min hoje</span>
                        </div>
                        <div className="text-3xl font-black text-white">12m 45s</div>
                        <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[65%]" />
                        </div>
                        <p className="text-[11px] text-neutral-400">Do envio ao primeiro prato servido</p>
                      </div>
                    </div>

                    {/* Gráfico Simulado */}
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-300">Faturamento por Hora x Tempo de Permanência</span>
                        <span className="text-xs text-neutral-500">Pico: 20h30 às 22h00</span>
                      </div>
                      <div className="h-44 flex items-end gap-2 pt-6">
                        {[20, 35, 45, 75, 100, 90, 85, 60, 40, 25].map((h, i) => (
                          <div key={i} className="flex-1 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Só mostra o cadeado e o overlay se for plano 'free' (ou undefined) */}
                  {isFree && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-neutral-950/70 backdrop-blur-md z-20">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/40 flex items-center justify-center mb-5 shadow-2xl shadow-amber-500/20 animate-pulse">
                  <Lock className="w-8 h-8 text-amber-400" />
                </div>

                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest px-3 py-1 mb-3">
                  Módulo Exclusivo MAYaMenu PRO
                </Badge>

                <h2 className="text-2xl sm:text-3xl font-black text-white max-w-xl tracking-tight leading-tight">
                  Descubra onde o seu restaurante <span className="text-rose-500">perde dinheiro</span>.
                </h2>

                <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mt-3 leading-relaxed">
                  Monitore a <strong>taxa de ociosidade das mesas</strong>, tempo médio de preparo do KDS, pratos mais lucrativos e ticket médio em tempo real com o poder da Inteligência MAYa.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
                  <Button
                    type="button"
                    onClick={() => setModalProAberto(true)}
                    className="h-12 px-6 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-rose-950/60 flex items-center gap-2 transform active:scale-95 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Desbloquear MAYaMenu PRO</span>
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalProAberto(true)}
                    className="h-12 px-5 border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-2xl"
                  >
                    Falar com Consultor
                  </Button>
                </div>

                <div className="flex items-center gap-4 mt-6 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Sem taxa de adesão
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Ativação instantânea
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Suporte 24/7
                  </span>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  )}
      </main>

      {/* MODAL DE CONTATO / UPSELL PRO */}
      <Dialog open={modalProAberto} onOpenChange={(open) => setModalProAberto(open)}>
        <DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="text-center sm:text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 mx-auto flex items-center justify-center mb-3 shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-xl font-black text-white">
              Evolua para o MAYaMenu PRO
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400 mt-1">
              O módulo completo de Inteligência Analítica & Insights em tempo real estará disponível na próxima rodada de ativações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 border-y border-neutral-800/80 my-2">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-rose-500/10 text-rose-400 mt-0.5">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Histórico Completo de Sessões</span>
                <span className="text-[11px] text-neutral-400">Todas as mesas e rodadas já estão sendo salvas no histórico seguro do Firestore.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-amber-500/10 text-amber-400 mt-0.5">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Taxa de Ociosidade & Giro de Mesas</span>
                <span className="text-[11px] text-neutral-400">Descubra quais mesas geram mais receita por minuto de ocupação.</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              onClick={() => {
                alert("Obrigado pelo interesse! Seu restaurante foi adicionado na lista prioritária de acesso antecipado ao MAYaMenu PRO.");
                setModalProAberto(false);
              }}
              className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
            >
              <span>Solicitar Acesso Antecipado</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalProAberto(false)}
              className="w-full h-9 text-neutral-400 hover:text-white rounded-xl text-xs"
            >
              Voltar ao Salão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL OPERACIONAL DE DETALHES DA MESA (Apenas monitoramento e QR Code no Admin) */}
      <MesaDetalheModal
        mesa={mesaSelecionada}
        isOpen={modalMesaAberto}
        onClose={() => setModalMesaAberto(false)}
        slug={slug}
        restauranteId={restaurante?.id}
        taxaServicoPercentual={restaurante?.configuracoes?.taxaServico}
        modoSomenteLeitura={true}
        onMarcarPago={handleMarcarComoPago}
        onLiberarMesa={handleLiberarMesa}
        onAtenderGarcom={handleAtenderGarcom}
        onLancarItem={handleLancarItemManual}
      />

      {/* MODAL DE ADICIONAR / EDITAR PRATO DO CARDÁPIO */}
      <Dialog open={modalPratoAberto} onOpenChange={(open) => !open && setModalPratoAberto(false)}>
        <DialogContent className="max-w-xl bg-neutral-900 border-neutral-800 text-white rounded-3xl p-0 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-neutral-800">
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-rose-500" />
              <span>{itemEmEdicao?.nome ? "Editar Prato" : "Novo Prato no Cardápio"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Preencha os detalhes do prato. As alterações são sincronizadas em tempo real com todos os clientes.
            </DialogDescription>
          </DialogHeader>

          {itemEmEdicao && (
            <form onSubmit={handleSalvarPrato} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Nome do Prato *
                  </label>
                  <Input
                    required
                    placeholder="Ex: Smash Burger Duplo"
                    value={itemEmEdicao.nome || ""}
                    onChange={(e) => setItemEmEdicao({ ...itemEmEdicao, nome: e.target.value })}
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Categoria (Digitação livre + Sugestões) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Categoria *
                    </label>
                    <Input
                      list="lista-categorias"
                      placeholder="Ex: Combos Promocionais"
                      value={itemEmEdicao.categoria || ""}
                      onChange={(e) => setItemEmEdicao({ ...itemEmEdicao, categoria: e.target.value })}
                      className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl text-sm h-9 w-full"
                    />
                    <datalist id="lista-categorias">
                      <option value="Hambúrgueres" />
                      <option value="Pizzas" />
                      <option value="Bebidas" />
                      <option value="Sobremesas" />
                      <option value="Entradas" />
                    </datalist>
                  </div>

                  {/* 2. Preço Base (Aceita qualquer valor com centavos) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Preço Base (R$) *
                    </label>
                    <Input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="29.90"
                      value={itemEmEdicao.precoBase ?? ""}
                      onChange={(e) =>
                        setItemEmEdicao({ ...itemEmEdicao, precoBase: parseFloat(e.target.value) || 0 })
                      }
                      className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl font-mono text-sm h-9"
                    />
                  </div>

                  {/* 3. Tempo de Preparo Estimado (Mantido do Agrupamento Ágil) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Preparo (min)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="180"
                      placeholder="15"
                      value={itemEmEdicao.tempoPreparoEstimado ?? ""}
                      onChange={(e) =>
                        setItemEmEdicao({
                          ...itemEmEdicao,
                          tempoPreparoEstimado: parseInt(e.target.value, 10) || undefined,
                        })
                      }
                      className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl font-mono text-sm h-9"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400 flex items-start gap-1.5 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Tempo médio para a cozinha liberar este prato. Essencial para o KDS priorizar pedidos no Modo Agrupamento Ágil.
                  </span>
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Descrição dos Ingredientes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Dois burgers de 100g, cheddar duplo, cebola caramelizada e maionese da casa."
                    value={itemEmEdicao.descricao || ""}
                    onChange={(e) => setItemEmEdicao({ ...itemEmEdicao, descricao: e.target.value })}
                    className="w-full rounded-xl bg-neutral-800 border border-neutral-700 p-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                </div>

                {/* CONSTRUTOR DE MODIFICADORES (COMPLEMENTOS E VARIAÇÕES) */}
                <div className="pt-2 border-t border-neutral-800 mt-4 mb-4">
                  <ModificadorBuilder
                    grupos={itemEmEdicao.grupoModificadores || []}
                    onChange={(novosGrupos) =>
                      setItemEmEdicao({ ...itemEmEdicao, grupoModificadores: novosGrupos })
                    }
                  />
                </div>

                {/* FOTO DO PRATO (STORAGE UPLOAD COM PREVIEW) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-rose-500" />
                      Foto do Prato
                    </span>
                    <span className="text-[10px] text-neutral-400 font-normal">Máx 5MB (JPG, PNG, WebP)</span>
                  </label>

                  {/* PREVIEW DA IMAGEM SE HOUVER */}
                  {previewFoto ? (
                    <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-700/80 group">
                      <Image
                        src={previewFoto}
                        alt="Prévia do prato"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-3 opacity-90 group-hover:opacity-100 transition-opacity">
                        <span className="text-[11px] text-neutral-300 truncate max-w-[200px]">
                          {arquivoFoto ? arquivoFoto.name : "Imagem atual do prato"}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={handleRemoverFoto}
                          className="h-8 px-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs flex items-center gap-1 shadow-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* DROPZONE / SELETOR DE ARQUIVO */
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-neutral-700 hover:border-rose-500 rounded-2xl cursor-pointer bg-neutral-800/40 hover:bg-neutral-800/80 transition-all p-3 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 mb-1.5">
                          <Upload className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-neutral-200">
                          Clique para enviar ou tirar foto
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          Upload direto para o Firebase Storage
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFotoSelecionada}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* GALERIA MAYA MEDIA LIBRARY (OPÇÕES PROFISSIONAIS PRONTAS) */}
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-neutral-400 block mb-1.5">
                      Ou selecione uma foto profissional da Galeria MAYa:
                    </span>
                    <div className="grid grid-cols-5 gap-2">
                      {MAYA_MEDIA_LIBRARY.map((foto) => {
                        const selecionada = previewFoto === foto.url;
                        return (
                          <button
                            key={foto.id}
                            type="button"
                            onClick={() => {
                              setArquivoFoto(null);
                              setPreviewFoto(foto.url);
                              if (itemEmEdicao) {
                                setItemEmEdicao({ ...itemEmEdicao, fotoUrl: foto.url });
                              }
                            }}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                              selecionada
                                ? "border-rose-500 scale-105 shadow-md shadow-rose-600/30"
                                : "border-neutral-800 hover:border-neutral-600 opacity-70 hover:opacity-100"
                            }`}
                          >
                            <Image src={foto.thumbnail} alt={foto.titulo} fill className="object-cover" />
                            {selecionada && (
                              <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                  <span className="text-xs font-bold text-neutral-300">Disponível para Pedidos</span>
                  <Switch
                    checked={itemEmEdicao.ativo !== false}
                    onCheckedChange={(val) => setItemEmEdicao({ ...itemEmEdicao, ativo: val })}
                  />
                </div>
              </div>

              {/* Rodapé fixo com os botões (shrink-0) */}
              <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 shrink-0 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalPratoAberto(false)}
                  disabled={salvandoPrato || enviandoFoto}
                  className="text-neutral-400 hover:text-white rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoPrato || enviandoFoto}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg flex items-center gap-1.5"
                >
                  {enviandoFoto ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando imagem...
                    </>
                  ) : salvandoPrato ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Prato"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* LEITOR DE QR CODE DO BALCÃO / CAIXA */}
      <AdminQrScannerModal
        isOpen={scannerBalcaoAberto}
        onClose={() => setScannerBalcaoAberto(false)}
        onComandaConfirmada={handleConfirmarComandaBalcao}
      />

      {/* MODAL DE CONFIGURAÇÕES GLOBAIS E TEMATIZAÇÃO */}
      <Dialog open={modalConfigAberto} onOpenChange={setModalConfigAberto}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg w-[95vw] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white">Configurações & Tematização</DialogTitle>
                <DialogDescription className="text-xs text-neutral-400">
                  Gerencie a identidade visual e o fluxo operacional do seu restaurante.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* COR PRIMÁRIA */}
            <div className="space-y-3 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-rose-500" />
                  Cor Primária de Destaque
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">{corPrimaria}</span>
              </div>
              <p className="text-xs text-neutral-400">
                Aplica a cor da sua marca nos botões, badges e detalhes do cardápio mobile.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-12 h-10 rounded-xl bg-transparent border-0 cursor-pointer shrink-0"
                />
                <Input
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="bg-neutral-900 border-neutral-700 text-white font-mono uppercase text-xs h-10"
                />
              </div>

              {/* Pré-visualização da cor */}
              <div
                style={{ backgroundColor: corPrimaria }}
                className="w-full h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md transition-colors"
              >
                Pré-visualização do Botão
              </div>
            </div>

            {/* MODELO OPERACIONAL DO SALÃO */}
            <div className="space-y-3 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
                Modelo Operacional do Salão
              </label>
              <p className="text-xs text-neutral-400">
                Defina como os pedidos fluem entre a mesa, o garçom e a cozinha:
              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModoOperacao("hibrido")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modoOperacao === "hibrido"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Híbrido / Suporte (Padrão)</span>
                    {modoOperacao === "hibrido" && <Check className="w-4 h-4 text-rose-500" />}
                  </div>
                  <span className="text-[10px] text-neutral-400 block mt-1 leading-snug">
                    O pedido vai direto para a cozinha. O garçom atende chamados e fecha contas.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModoOperacao("com_garcom")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modoOperacao === "com_garcom"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Garçom Obrigatório</span>
                    {modoOperacao === "com_garcom" && <Check className="w-4 h-4 text-rose-500" />}
                  </div>
                  <span className="text-[10px] text-neutral-400 block mt-1 leading-snug">
                    O pedido fica pendente e o garçom valida antes de enviar para a cozinha.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModoOperacao("balcao")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modoOperacao === "balcao"
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Sem Garçom (Autoatendimento)</span>
                    {modoOperacao === "balcao" && <Check className="w-4 h-4 text-rose-500" />}
                  </div>
                  <span className="text-[10px] text-neutral-400 block mt-1 leading-snug">
                    O cliente pede na mesa e retira diretamente no balcão/caixa.
                  </span>
                </button>
              </div>
            </div>

            {/* MODO DE OPERAÇÃO DO KDS (COZINHA) */}
            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Modo de Operação do KDS (Cozinha)
                </h3>
                <p className="text-xs text-neutral-400">
                  Altere a forma como os pedidos são organizados no monitor da cozinha em tempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Card 1: Modo Sequencial */}
                <label
                  className={`relative cursor-pointer rounded-xl border p-4 flex flex-col gap-2 transition-all duration-200 ${
                    modoFilaKds === "sequencial"
                      ? "bg-rose-600/10 border-rose-500"
                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="modo_fila"
                    value="sequencial"
                    checked={modoFilaKds === "sequencial"}
                    onChange={() => setModoFilaKds("sequencial")}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        modoFilaKds === "sequencial"
                          ? "bg-rose-500 text-white"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        modoFilaKds === "sequencial" ? "text-rose-400" : "text-neutral-300"
                      }`}
                    >
                      Sequencial (Padrão)
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Pedidos entram na fila por ordem de chegada (First-In, First-Out). Ideal para dias de movimento tranquilo ou cozinhas lineares.
                  </p>
                </label>

                {/* Card 2: Modo Agrupamento */}
                <label
                  className={`relative cursor-pointer rounded-xl border p-4 flex flex-col gap-2 transition-all duration-200 ${
                    modoFilaKds === "agrupamento"
                      ? "bg-emerald-600/10 border-emerald-500"
                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="modo_fila"
                    value="agrupamento"
                    checked={modoFilaKds === "agrupamento"}
                    onChange={() => setModoFilaKds("agrupamento")}
                    className="sr-only"
                  />
                  <div className="absolute top-3 right-3 bg-neutral-800 px-2 py-0.5 rounded text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                    Pro
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        modoFilaKds === "agrupamento"
                          ? "bg-emerald-500 text-white"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        modoFilaKds === "agrupamento" ? "text-emerald-400" : "text-neutral-300"
                      }`}
                    >
                      Agrupamento Ágil
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Consolida tickets da mesma mesa e prioriza pratos com base no tempo de preparo. Essencial para não travar o salão nos horários de pico.
                  </p>
                </label>
              </div>
            </div>

            {/* CONFIGURAÇÃO DA TAXA DE SERVIÇO */}
            <div className="space-y-3 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-rose-500" />
                  Taxa de Serviço do Salão
                </label>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {taxaServicoConfig}%
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Percentual sugerido na conta no momento do fechamento da mesa (0% para desativar, 10% padrão, até 20%).
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  value={taxaServicoConfig}
                  onChange={(e) => setTaxaServicoConfig(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="bg-neutral-900 border-neutral-700 text-white font-mono text-xs h-10 w-28"
                />
                <div className="flex items-center gap-1.5">
                  {[0, 10, 12, 13, 15].map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => setTaxaServicoConfig(sugestao)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        taxaServicoConfig === sugestao
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {sugestao}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalConfigAberto(false)}
                className="text-neutral-400 hover:text-white rounded-xl text-xs"
              >
                Fechar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await handleSalvarCor();
                  setModalConfigAberto(false);
                }}
                disabled={salvandoCor}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs h-10 px-5 shadow-lg flex items-center gap-1.5"
              >
                {salvandoCor ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
