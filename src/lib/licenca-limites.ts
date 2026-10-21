// src/lib/licenca-limites.ts
// Fonte única para ler plano e limites (mesas/pratos) de um restaurante.
//
// Origem dos dados (gravados na ativação, ver licenca-service.ts):
//   1. restaurante.licenca.limites  → limites da licença (fonte primária)
//   2. restaurante.maxMesas/maxPratos → cópia denormalizada no documento do restaurante
//   3. LIMITES_POR_PLANO[plano]      → padrão do plano quando nada foi gravado

import type { PlanoTipo, LimitesPlano, Restaurante } from "@/types";
import { LIMITES_POR_PLANO } from "@/lib/licenca-service";

type RestauranteComLicenca = Pick<Restaurante, "plano" | "maxMesas" | "maxPratos" | "licenca">;

/** Plano efetivo do restaurante ('free' quando não houver nenhum registrado). */
export function getPlanoRestaurante(restaurante?: RestauranteComLicenca | null): PlanoTipo {
  return restaurante?.licenca?.plano ?? restaurante?.plano ?? "free";
}

/** Limites efetivos (mesas e pratos) do restaurante. */
export function getLimitesLicenca(restaurante?: RestauranteComLicenca | null): LimitesPlano {
  const padrao = LIMITES_POR_PLANO[getPlanoRestaurante(restaurante)];

  return {
    maxMesas: restaurante?.licenca?.limites?.maxMesas ?? restaurante?.maxMesas ?? padrao.maxMesas,
    maxPratos: restaurante?.licenca?.limites?.maxPratos ?? restaurante?.maxPratos ?? padrao.maxPratos,
  };
}
