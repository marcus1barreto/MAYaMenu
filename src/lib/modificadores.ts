// src/lib/modificadores.ts
// Normaliza grupos de modificadores vindos do Firestore (ou do mock) para o formato estrito
// `GrupoModificador` (minimo/maximo sempre definidos). Dados legados podem ter apenas
// `maxEscolhas` e/ou não ter `minimo`.

import type { GrupoModificador, MenuItem, OpcaoModificador } from "@/types";

/** Formato aceito na leitura: campos legados e ausências são tolerados. */
type GrupoModificadorBruto = Partial<Omit<GrupoModificador, "opcoes">> & {
  maxEscolhas?: number; // campo legado, substituído por `maximo`
  opcoes?: Partial<OpcaoModificador>[];
};

export function normalizarGrupoModificador(bruto: GrupoModificadorBruto): GrupoModificador {
  const obrigatorio = !!bruto.obrigatorio;
  const minimo = Math.max(0, bruto.minimo ?? (obrigatorio ? 1 : 0));
  const maximo = Math.max(1, minimo, bruto.maximo ?? bruto.maxEscolhas ?? 1);

  const grupo: GrupoModificador = {
    nome: bruto.nome ?? "",
    obrigatorio,
    minimo,
    maximo,
    opcoes: (bruto.opcoes ?? []).map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      nome: o.nome ?? "",
      precoAdicional: Number(o.precoAdicional) || 0,
    })),
  };
  if (bruto.id) grupo.id = bruto.id;
  return grupo;
}

/** Normaliza os grupos de modificadores de um prato (mantém o item intacto se não houver grupos). */
export function normalizarItemCardapio(item: MenuItem): MenuItem {
  if (!item.grupoModificadores) return item;
  return {
    ...item,
    grupoModificadores: item.grupoModificadores.map(normalizarGrupoModificador),
  };
}
