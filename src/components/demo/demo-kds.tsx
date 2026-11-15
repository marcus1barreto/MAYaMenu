"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChefHat, Flame, Utensils } from "lucide-react";
import type { DemoMesa } from "./demo-admin-mesas";

interface DemoKdsProps {
  mesas: DemoMesa[];
  onAvancarItem: (numeroMesa: number, itemId: string) => void;
}

export function DemoKds({ mesas, onAvancarItem }: DemoKdsProps) {
  const mesasComPedidos = mesas.filter((m) =>
    m.itens.some((item) => item.status !== "servido")
  );

  if (mesasComPedidos.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-3xl p-10 text-center space-y-2">
        <ChefHat className="w-10 h-10 text-muted-foreground mx-auto opacity-60" />
        <h3 className="font-bold text-base text-foreground">
          Cozinha em dia!
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Nenhum prato pendente no momento. Vá em <strong>Admin de Mesas</strong> e clique em <strong>Simular Pedido</strong> em qualquer mesa (1 a 5) para ver o pedido cair aqui na hora.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {mesasComPedidos.map((mesa) => (
        <div
          key={mesa.numero}
          className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-600 text-white font-black text-sm flex items-center justify-center">
                {mesa.numero}
              </span>
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Mesa {mesa.numero}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {mesa.itens.filter((i) => i.status !== "servido").length}{" "}
                  item(ns) ativo(s)
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold">
              KDS Cozinha
            </Badge>
          </div>

          <div className="space-y-2">
            {mesa.itens.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {item.quantidade}x {item.nome}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.status === "pendente"
                      ? "Aguardando preparo"
                      : item.status === "preparando"
                      ? "Em preparo na chapa/cozinha"
                      : "Já servido na mesa"}
                  </p>
                </div>

                {item.status === "pendente" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAvancarItem(mesa.numero, item.id)}
                    className="h-7 text-[11px] font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                  >
                    <Flame className="w-3 h-3 mr-1" />
                    Marchar
                  </Button>
                )}

                {item.status === "preparando" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAvancarItem(mesa.numero, item.id)}
                    className="h-7 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <Utensils className="w-3 h-3 mr-1" />
                    Servir
                  </Button>
                )}

                {item.status === "servido" && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] shrink-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Servido
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
