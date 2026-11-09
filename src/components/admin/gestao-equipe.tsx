"use client";

import React, { useState, useEffect } from "react";
import { db, functions } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  Trash2,
  ChefHat,
  UtensilsCrossed,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export interface MembroEquipe {
  id: string;
  uid: string;
  email: string;
  nome?: string;
  role: "garcom" | "cozinha";
  atualizadoEm?: any;
}

interface GestaoEquipeProps {
  restauranteId: string;
}

export function GestaoEquipe({ restauranteId }: GestaoEquipeProps) {
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [emailNovo, setEmailNovo] = useState("");
  const [roleNovo, setRoleNovo] = useState<"garcom" | "cozinha">("garcom");
  const [processando, setProcessando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Escuta a lista de colaboradores em tempo real no Firestore
  useEffect(() => {
    if (!restauranteId) return;

    const colRef = collection(db, "restaurantes", restauranteId, "equipe");
    const q = query(colRef);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const membros: MembroEquipe[] = [];
        snap.forEach((docSnap) => {
          membros.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<MembroEquipe, "id">),
          });
        });
        setEquipe(membros);
        setCarregando(false);
      },
      (err) => {
        console.warn("Aviso ao carregar equipe:", err);
        setCarregando(false);
      }
    );

    return () => unsub();
  }, [restauranteId]);

  const handleAdicionarMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemSucesso(null);
    setMensagemErro(null);

    const emailLimpo = emailNovo.trim().toLowerCase();
    if (!emailLimpo) {
      setMensagemErro("Informe o e-mail do colaborador.");
      return;
    }

    setProcessando(true);
    try {
      const setStaffRoleFn = httpsCallable(functions, "setStaffRole");
      const resp: any = await setStaffRoleFn({
        restauranteId,
        email: emailLimpo,
        role: roleNovo,
      });

      if (resp.data?.sucesso) {
        setMensagemSucesso(
          `Perfil de ${roleNovo === "garcom" ? "Garçom" : "Cozinha"} atribuído a ${emailLimpo} com sucesso!`
        );
        setEmailNovo("");
      } else {
        setMensagemErro("Não foi possível atribuir o papel.");
      }
    } catch (err: any) {
      console.error("Erro ao adicionar membro:", err);
      const msg = err?.message || "Erro ao conectar com o serviço de equipe.";
      setMensagemErro(msg);
    } finally {
      setProcessando(false);
    }
  };

  const handleRemoverMembro = async (uid: string, email: string) => {
    if (!confirm(`Deseja remover o acesso de ${email}?`)) return;

    setMensagemSucesso(null);
    setMensagemErro(null);

    try {
      const removeStaffFn = httpsCallable(functions, "removeStaffMember");
      await removeStaffFn({
        restauranteId,
        uid,
      });
      setMensagemSucesso(`Acesso de ${email} revogado.`);
    } catch (err: any) {
      console.error("Erro ao remover membro:", err);
      setMensagemErro(err?.message || "Falha ao revogar acesso do colaborador.");
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA SEÇÃO */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-black tracking-tight">Equipe & Acessos Operacionais</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre garçons e cozinheiros. Eles terão acesso restrito às telas operacionais (/garcom e /cozinha) com regras de segurança ativas.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Controle por Custom Claims</span>
          </div>
        </div>

        {/* FEEDBACKS */}
        {mensagemSucesso && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
        )}

        {mensagemErro && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{mensagemErro}</span>
          </div>
        )}

        {/* FORMULÁRIO DE ADIÇÃO */}
        <form onSubmit={handleAdicionarMembro} className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
              E-mail do Colaborador (cadastrado no sistema)
            </label>
            <Input
              type="email"
              value={emailNovo}
              onChange={(e) => setEmailNovo(e.target.value)}
              placeholder="ex: garcom@restaurante.com"
              className="h-10 text-xs rounded-xl"
              disabled={processando}
              required
            />
          </div>

          <div className="sm:col-span-3">
            <label className="text-[11px] font-black uppercase text-muted-foreground mb-1 block">
              Papel / Função
            </label>
            <select
              value={roleNovo}
              onChange={(e) => setRoleNovo(e.target.value as "garcom" | "cozinha")}
              className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-ring"
              disabled={processando}
            >
              <option value="garcom">Garçom (Salão)</option>
              <option value="cozinha">Cozinha (KDS)</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex items-end">
            <Button
              type="submit"
              disabled={processando}
              className="w-full h-10 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
            >
              {processando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Vinculando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Adicionar Membro</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* LISTA DE MEMBROS */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <h3 className="text-xs font-black uppercase text-muted-foreground tracking-wider mb-4">
          Colaboradores Ativos ({equipe.length})
        </h3>

        {carregando ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
            <p className="text-xs font-bold text-muted-foreground">Carregando colaboradores...</p>
          </div>
        ) : equipe.length === 0 ? (
          <div className="py-10 text-center border-2 border-dashed border-border rounded-xl">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs font-bold text-muted-foreground">Nenhum membro cadastrado ainda.</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              Adicione garçons ou cozinheiros usando o formulário acima para liberar o acesso operacional seguro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equipe.map((membro) => {
              const isGarcom = membro.role === "garcom";
              return (
                <div
                  key={membro.id}
                  className="p-3.5 rounded-xl border border-border bg-muted/30 flex items-center justify-between gap-3 hover:border-border/80 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isGarcom
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {isGarcom ? (
                        <UtensilsCrossed className="w-4 h-4" />
                      ) : (
                        <ChefHat className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{membro.nome || membro.email}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{membro.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      className={`text-[10px] font-black uppercase px-2 py-0.5 ${
                        isGarcom
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {isGarcom ? "Garçom" : "Cozinha"}
                    </Badge>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoverMembro(membro.uid, membro.email)}
                      className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                      title="Revogar acesso"
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
    </div>
  );
}

