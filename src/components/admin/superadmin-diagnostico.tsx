"use client";

import React, { useState } from "react";
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
import { Activity, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";

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
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-600" />
          <h3 className="font-bold text-sm text-foreground">
            Diagnóstico &amp; Saneamento por Estabelecimento
          </h3>
        </div>
        {mesas && (
          <Badge variant="outline" className="text-[11px]">
            Ledger: {totalLedger} movimentação(ões)
          </Badge>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={restauranteId}
          onChange={(e) => setRestauranteId(e.target.value)}
          placeholder="Cole o restauranteId (ex: 6psLTpboW6ZqhPkErGsn3beDPB62)"
          className="h-9 text-xs font-mono"
        />
        <Button
          type="button"
          size="sm"
          onClick={diagnosticar}
          disabled={carregando || !restauranteId.trim()}
          className="h-9 px-4 text-xs font-bold shrink-0"
        >
          {carregando ? "Diagnosticando..." : "Diagnosticar"}
        </Button>
      </div>

      {erro && (
        <p className="text-xs text-red-600 font-medium">{erro}</p>
      )}

      {mesas && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {mesas.length} mesa(s) analisada(s) •{" "}
              <strong className={inconsistentes > 0 ? "text-amber-600" : "text-emerald-600"}>
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
                className="h-8 text-xs font-bold border-amber-300 text-amber-700 hover:bg-amber-50"
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
                className={`p-2.5 rounded-xl border text-xs ${
                  m.inconsistente
                    ? "border-amber-300 bg-amber-50/60"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Mesa {m.numero}</span>
                  {m.inconsistente ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
