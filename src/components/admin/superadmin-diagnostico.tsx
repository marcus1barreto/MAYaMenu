"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Home,
  LogOut,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import {
  SuperAdminAcessoBloqueado,
  useSuperAdminOperadorAuth,
} from "./superadmin-auth-gate";

interface MesaDiagnostico {
  numero: string;
  statusEstrutural: string;
  comandasAbertas: number;
  inconsistente: boolean;
}

export function SuperadminDiagnostico() {
  const [restauranteId, setRestauranteId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mesas, setMesas] = useState<MesaDiagnostico[] | null>(null);
  const [totalLedger, setTotalLedger] = useState<number>(0);

  const diagnosticar = async () => {
    const idLimpo = restauranteId.trim();
    if (!idLimpo) return;
    setCarregando(true);
    setErro(null);
    setMesas(null);

    try {
      const mesasSnap = await getDocs(
        collection(db, "restaurantes", idLimpo, "mesas")
      );
      const resultado: MesaDiagnostico[] = [];

      for (const mesaDoc of mesasSnap.docs) {
        const m = mesaDoc.data();
        const comandasSnap = await getDocs(
          query(
            collection(
              db,
              "restaurantes",
              idLimpo,
              "mesas",
              mesaDoc.id,
              "comandas_abertas"
            ),
            where("arquivada", "==", false)
          )
        );
        const status = String(m.statusEstrutural || "livre");
        const inconsistente = status === "ocupada" && comandasSnap.empty;
        resultado.push({
          numero: mesaDoc.id,
          statusEstrutural: status,
          comandasAbertas: comandasSnap.size,
          inconsistente,
        });
      }

      resultado.sort((a, b) => Number(a.numero) - Number(b.numero));
      const movSnap = await getDocs(
        collection(db, "restaurantes", idLimpo, "movimentacoes_caixa")
      );
      setTotalLedger(movSnap.size);
      setMesas(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao diagnosticar banco.");
    } finally {
      setCarregando(false);
    }
  };

  const corrigirInconsistencias = async () => {
    const idLimpo = restauranteId.trim();
    if (!idLimpo || !mesas) return;
    const travadas = mesas.filter((m) => m.inconsistente);
    if (travadas.length === 0) return;

    setCorrigindo(true);
    try {
      for (const m of travadas) {
        await updateDoc(doc(db, "restaurantes", idLimpo, "mesas", m.numero), {
          statusEstrutural: "livre",
          atualizadoEm: serverTimestamp(),
        });
      }
      await diagnosticar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao corrigir mesas.");
    } finally {
      setCorrigindo(false);
    }
  };

  const inconsistentes = mesas ? mesas.filter((m) => m.inconsistente).length : 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-rose-600 shrink-0" />
          <h3 className="font-bold text-sm sm:text-base text-foreground">
            Diagnóstico &amp; Saneamento por Estabelecimento
          </h3>
        </div>
        {mesas && (
          <Badge variant="outline" className="text-xs">
            Ledger: {totalLedger} movimentação(ões)
          </Badge>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void diagnosticar();
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <Input
          value={restauranteId}
          onChange={(e) => setRestauranteId(e.target.value)}
          placeholder="Cole o restauranteId (ex: 6psLTpboW6ZqhPkErGsn3beDPB62)"
          className="h-10 sm:h-9 text-base sm:text-sm font-mono"
        />
        <Button
          type="submit"
          size="sm"
          disabled={carregando || !restauranteId.trim()}
          className="h-10 sm:h-9 px-4 text-xs font-bold shrink-0"
        >
          {carregando ? "Diagnosticando..." : "Diagnosticar"}
        </Button>
      </form>

      {erro && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">{erro}</p>
      )}

      {mesas && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {mesas.length} mesa(s) analisada(s) •{" "}
              <strong className={inconsistentes > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                {inconsistentes} inconsistência(s)
              </strong>
            </span>

            {inconsistentes > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={corrigirInconsistencias}
                disabled={corrigindo}
                className="h-8 text-xs font-bold border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                <Wrench className="w-3.5 h-3.5 mr-1.5" />
                {corrigindo ? "Corrigindo..." : `Destravar ${inconsistentes} Mesa(s)`}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {mesas.map((m) => (
              <div
                key={m.numero}
                className={`p-2.5 rounded-xl border text-xs ${m.inconsistente
                    ? "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30"
                    : "border-border bg-muted/30"
                  }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Mesa {m.numero}</span>
                  {m.inconsistente ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  status: <strong>{m.statusEstrutural}</strong>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  comandas: <strong>{m.comandasAbertas}</strong>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Visão da rota dedicada /superadmin/diagnostico protegida por autenticação de Operador SuperAdmin.
 */
export function SuperadminDiagnosticoView() {
  const authOperador = useSuperAdminOperadorAuth();
  const {
    usuarioAuth,
    ehSuperAdmin,
    isSuperAdminAutorizado,
    handleLogoutOperador,
  } = authOperador;

  if (!isSuperAdminAutorizado) {
    return (
      <SuperAdminAcessoBloqueado
        authState={authOperador}
        subtitulo="Identifique-se com sua conta de operador para acessar Diagnóstico & Saneamento."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-3.5 py-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/superadmin"
            className="p-2.5 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 shadow-xs"
            title="Voltar ao Painel SuperAdmin"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="p-1.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">
                MAYaRAnas • Diagnóstico Técnico
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Auditoria de mesas travadas, comandas abertas e ledger por restauranteId.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ehSuperAdmin && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-800 text-xs font-semibold max-w-full min-w-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[180px]">
                {usuarioAuth?.email || "Operador SuperAdmin"}
              </span>
            </div>
          )}

          <Link href="/superadmin/ajuda">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 sm:h-8 text-xs rounded-xl border-border bg-card text-foreground hover:bg-muted flex items-center gap-1.5 shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Manual</span>
            </Button>
          </Link>

          <Link href="/">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 sm:h-8 px-3 text-xs rounded-xl border-border bg-card text-foreground hover:bg-muted flex items-center gap-1.5 shadow-xs font-semibold"
            >
              <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>Início</span>
            </Button>
          </Link>

          {usuarioAuth && !usuarioAuth.isAnonymous && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleLogoutOperador}
              className="h-9 sm:h-8 px-3 text-xs rounded-xl border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold flex items-center gap-1.5 shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sair</span>
            </Button>
          )}
        </div>
      </header>

      <SuperadminDiagnostico />
    </div>
  );
}
