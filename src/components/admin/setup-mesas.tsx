"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  salvarConfigMesa,
  alternarStatusLoteMesas,
  escutarConfigsMesas,
  type ConfigMesa,
} from "@/lib/mesas-service";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, deleteField } from "firebase/firestore";
import {
  Settings2,
  CalendarClock,
  UserCheck,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Users,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface SetupMesasProps {
  restauranteId: string;
  maxMesas: number;
}

interface MembroGarcom {
  uid: string;
  nome: string;
  fotoUrl?: string;
}

export function SetupMesas({ restauranteId, maxMesas }: SetupMesasProps) {
  const [configs, setConfigs] = useState<Record<number, ConfigMesa>>({});
  const [garcons, setGarcons] = useState<MembroGarcom[]>([]);
  const [salvandoNum, setSalvandoNum] = useState<number | null>(null);

  // Modal de Reserva
  const [mesaParaReservar, setMesaParaReservar] = useState<number | null>(null);
  const [nomeClienteReserva, setNomeClienteReserva] = useState("");
  const [horarioReserva, setHorarioReserva] = useState("");
  const [qtdPessoasReserva, setQtdPessoasReserva] = useState("2");

  // Escuta as configurações das mesas
  useEffect(() => {
    if (!restauranteId) return;
    const unsub = escutarConfigsMesas(restauranteId, (dados) => {
      setConfigs(dados);
    });
    return () => unsub();
  }, [restauranteId]);

  // Escuta garçons disponíveis para atribuição de praça
  useEffect(() => {
    if (!restauranteId) return;
    const equipeCol = collection(db, "restaurantes", restauranteId, "equipe");
    const q = query(equipeCol, where("role", "==", "garcom"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista: MembroGarcom[] = [];
        snap.forEach((d) => {
          const item = d.data();
          lista.push({
            uid: d.id,
            nome: item.nome || "Garçom",
            fotoUrl: item.fotoUrl,
          });
        });
        setGarcons(lista);
      },
      (err) => console.warn("Aviso ao buscar garçons para setup:", err)
    );

    return () => unsub();
  }, [restauranteId]);

  // Alternar ativação de uma mesa individual
  const handleToggleAtiva = async (
    num: number,
    estadoAtual: boolean,
    statusEstrutural?: ConfigMesa["statusEstrutural"]
  ) => {
    setSalvandoNum(num);
    try {
      await salvarConfigMesa(restauranteId, num, {
        ativa: !estadoAtual,
        ...(!estadoAtual && statusEstrutural === "inativa" ? { statusEstrutural: "livre" } : {}),
      });
    } catch (err) {
      console.error("Falha ao salvar status da mesa:", err);
    } finally {
      setSalvandoNum(null);
    }
  };

  // Alterar modo de atendimento (livre ou garçom fixo)
  const handleAtribuirGarcom = async (num: number, garcomId: string) => {
    setSalvandoNum(num);
    try {
      if (garcomId === "livre") {
        await salvarConfigMesa(restauranteId, num, {
          modoAtendimento: "livre",
          garcomFixoId: undefined,
          garcomFixoNome: undefined,
        });
      } else {
        const garcomSelecionado = garcons.find((g) => g.uid === garcomId);
        await salvarConfigMesa(restauranteId, num, {
          modoAtendimento: "garcom_fixo",
          garcomFixoId: garcomId,
          garcomFixoNome: garcomSelecionado?.nome || "Garçom",
        });
      }
    } catch (err) {
      console.error("Falha ao atribuir garçom à mesa:", err);
    } finally {
      setSalvandoNum(null);
    }
  };

  // Salvar Reserva
  const handleConfirmarReserva = async () => {
    if (!mesaParaReservar || !nomeClienteReserva.trim()) return;
    setSalvandoNum(mesaParaReservar);
    try {
      await salvarConfigMesa(restauranteId, mesaParaReservar, {
        statusEstrutural: "reservada",
        reserva: {
          nomeCliente: nomeClienteReserva.trim(),
          horario: horarioReserva.trim() || "Hoje",
          quantidadePessoas: Number(qtdPessoasReserva) || 2,
        },
      });
      setMesaParaReservar(null);
      setNomeClienteReserva("");
      setHorarioReserva("");
    } catch (err) {
      console.error("Falha ao reservar mesa:", err);
    } finally {
      setSalvandoNum(null);
    }
  };

  // Liberar Reserva / Desbloquear Mesa
  const handleLiberarStatusEstrutural = async (num: number) => {
    setSalvandoNum(num);
    try {
      await salvarConfigMesa(restauranteId, num, {
        statusEstrutural: "livre",
        reserva: deleteField() as any,
      });
    } catch (err) {
      console.error("Falha ao liberar mesa:", err);
    } finally {
      setSalvandoNum(null);
    }
  };

  // Bloquear mesa para manutenção
  const handleToggleBloqueio = async (num: number, estaBloqueada: boolean) => {
    setSalvandoNum(num);
    try {
      await salvarConfigMesa(restauranteId, num, {
        statusEstrutural: estaBloqueada ? "livre" : "bloqueada",
      });
    } catch (err) {
      console.error("Falha ao bloquear/desbloquear mesa:", err);
    } finally {
      setSalvandoNum(null);
    }
  };

  // Estatísticas do Salão
  const listaNumeros = Array.from({ length: maxMesas }, (_, i) => i + 1);
  const totalAtivas = listaNumeros.filter((n) => configs[n]?.ativa !== false).length;
  const totalInativas = maxMesas - totalAtivas;
  const totalReservadas = listaNumeros.filter((n) => configs[n]?.statusEstrutural === "reservada").length;
  const totalComGarcomFixo = listaNumeros.filter((n) => configs[n]?.modoAtendimento === "garcom_fixo").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* PAINEL DE CONTROLE RÁPIDO & MÉTRICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-col justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Capacidade Licenciada</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-foreground">{maxMesas}</span>
            <span className="text-xs text-muted-foreground">mesas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-500 uppercase">Mesas Ativas</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-emerald-500">{totalAtivas}</span>
            <span className="text-xs text-muted-foreground">abertas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-col justify-between">
          <span className="text-[11px] font-bold text-purple-500 uppercase">Reservadas</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-purple-500">{totalReservadas}</span>
            <span className="text-xs text-muted-foreground">hoje</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-col justify-between">
          <span className="text-[11px] font-bold text-blue-500 uppercase">Praças com Titular</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-blue-500">{totalComGarcomFixo}</span>
            <span className="text-xs text-muted-foreground">mesas</span>
          </div>
        </div>
      </div>

      {/* AÇÕES EM MASSA */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <h3 className="text-sm font-black text-foreground">Gerenciamento Operacional em Massa</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ajuste a disponibilidade do salão para chuva, eventos fechados ou trocas de turno.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => alternarStatusLoteMesas(restauranteId, listaNumeros, true)}
            className="text-xs font-bold border-border hover:bg-muted"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
            Ativar Todas ({maxMesas})
          </Button>
          {maxMesas > 6 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const metade = Math.ceil(maxMesas / 2);
                const faixa = listaNumeros.filter((n) => n > metade);
                alternarStatusLoteMesas(restauranteId, faixa, false);
              }}
              className="text-xs font-bold border-border hover:bg-muted text-amber-500"
            >
              <XCircle className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
              Pausar Piso Superior / Varanda
            </Button>
          )}
        </div>
      </div>

      {/* GRADE DE CONFIGURAÇÃO DE MESAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {listaNumeros.map((num) => {
          const cfg = configs[num] || {
            numero: num,
            ativa: true,
            statusEstrutural: "livre",
            modoAtendimento: "livre",
          };
          const isAtiva = cfg.ativa !== false;
          const isReservada = cfg.statusEstrutural === "reservada";
          const isBloqueada = cfg.statusEstrutural === "bloqueada";

          return (
            <div
              key={num}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
                !isAtiva
                  ? "bg-muted/40 border-dashed border-border opacity-60"
                  : isReservada
                  ? "bg-purple-500/5 border-purple-500/50 shadow-sm"
                  : isBloqueada
                  ? "bg-red-500/5 border-red-500/40 shadow-sm"
                  : "bg-card border-border hover:border-border/80 shadow-xs"
              }`}
            >
              {/* Topo do Card da Mesa */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs ${
                      !isAtiva
                        ? "bg-neutral-800 text-neutral-400"
                        : isReservada
                        ? "bg-purple-600 text-white"
                        : isBloqueada
                        ? "bg-red-600 text-white"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {num}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-foreground">Mesa {num}</h4>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {!isAtiva ? "Desativada" : isReservada ? "Reservada" : isBloqueada ? "Manutenção" : "Disponível"}
                    </span>
                  </div>
                </div>

                {/* Switch Ativa / Inativa */}
                <button
                  type="button"
                  onClick={() => handleToggleAtiva(num, isAtiva, cfg.statusEstrutural)}
                  title={isAtiva ? "Desativar mesa no salão" : "Ativar mesa no salão"}
                  className="text-muted-foreground hover:text-foreground transition-all"
                >
                  {isAtiva ? (
                    <ToggleRight className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-neutral-500" />
                  )}
                </button>
              </div>

              {/* Informações de Reserva Ativa */}
              {isReservada && cfg.reserva && (
                <div className="mt-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold truncate">{cfg.reserva.nomeCliente}</span>
                    <button
                      type="button"
                      onClick={() => handleLiberarStatusEstrutural(num)}
                      className="text-[10px] font-bold text-red-400 hover:underline"
                    >
                      Liberar
                    </button>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Horário: <strong className="text-foreground">{cfg.reserva.horario}</strong></span>
                    <span>{cfg.reserva.quantidadePessoas || 2} pessoas</span>
                  </div>
                </div>
              )}

              {/* Seletor de Atendimento: Garçom da Mesa ou Livre */}
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-blue-500" />
                  <span>Garçom da Mesa (Praça)</span>
                </label>
                <select
                  value={cfg.modoAtendimento === "garcom_fixo" ? cfg.garcomFixoId || "livre" : "livre"}
                  onChange={(e) => handleAtribuirGarcom(num, e.target.value)}
                  disabled={!isAtiva}
                  className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="livre">🌐 Garçom Livre (Qualquer um)</option>
                  {garcons.map((g) => (
                    <option key={g.uid} value={g.uid}>
                      👤 {g.nome} (Titular)
                    </option>
                  ))}
                </select>
              </div>

              {/* Ações Estruturais da Mesa */}
              <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2">
                {!isReservada ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!isAtiva}
                    onClick={() => setMesaParaReservar(num)}
                    className="h-7 px-2 text-[11px] font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg flex items-center gap-1"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>Reservar</span>
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/40">
                    Mesa Reservada
                  </Badge>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!isAtiva}
                  onClick={() => handleToggleBloqueio(num, isBloqueada)}
                  className={`h-7 px-2 text-[11px] font-bold rounded-lg flex items-center gap-1 ${
                    isBloqueada
                      ? "text-red-400 hover:bg-red-500/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={isBloqueada ? "Desbloquear mesa" : "Bloquear mesa temporariamente"}
                >
                  {isBloqueada ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>{isBloqueada ? "Bloqueada" : "Bloquear"}</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE RESERVA DE MESA */}
      <Dialog open={mesaParaReservar !== null} onOpenChange={(open) => !open && setMesaParaReservar(null)}>
        <DialogContent className="max-w-sm p-6 bg-card border border-border rounded-3xl shadow-2xl">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-purple-500" />
              <span>Reservar Mesa {mesaParaReservar}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Nome do Cliente *</label>
              <Input
                placeholder="Ex: Família Silva ou Marcus"
                value={nomeClienteReserva}
                onChange={(e) => setNomeClienteReserva(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Horário</label>
                <Input
                  placeholder="Ex: 20:30"
                  value={horarioReserva}
                  onChange={(e) => setHorarioReserva(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Qtd. Pessoas</label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={qtdPessoasReserva}
                  onChange={(e) => setQtdPessoasReserva(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMesaParaReservar(null)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmarReserva}
                disabled={!nomeClienteReserva.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
              >
                Confirmar Reserva
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

