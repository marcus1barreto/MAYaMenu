// src/lib/licenca-limites.ts
// Fonte única para ler plano e limites (mesas / itens de menu) de um restaurante.
//
// Origem dos dados respeitando o Princípio de Grandfathering (Acordo Imutável):
//   1. restaurante.assinatura.limites → snapshot do contrato assinado (fonte soberana)
//   2. restaurante.licenca.limites   → limites da licença/voucher
//   3. restaurante.maxItensMenu / restaurante.maxPratos → denormalizado no restaurante
//   4. LIMITES_POR_PLANO[plano]       → padrão de fallback

import type { PlanoTipo, LimitesPlano, Restaurante } from "@/types";
import { LIMITES_POR_PLANO } from "@/lib/licenca-service";

type RestauranteComLicenca = Pick<Restaurante, "plano" | "maxMesas" | "maxPratos" | "maxItensMenu" | "licenca" | "assinatura">;

/** Plano efetivo do restaurante ('free' quando não houver nenhum registrado). */
export function getPlanoRestaurante(restaurante?: RestauranteComLicenca | null): PlanoTipo {
  return (
    restaurante?.assinatura?.planoId?.includes("enterprise") ? "enterprise" :
    restaurante?.assinatura?.planoId?.includes("pro") ? "pro" :
    restaurante?.licenca?.plano ?? restaurante?.plano ?? "free"
  );
}

/** Limites efetivos (mesas e itens de menu) do restaurante. */
export function getLimitesLicenca(restaurante?: RestauranteComLicenca | null): LimitesPlano {
  const padrao = LIMITES_POR_PLANO[getPlanoRestaurante(restaurante)];

  const maxMesas =
    restaurante?.assinatura?.limites?.maxMesas ??
    restaurante?.licenca?.limites?.maxMesas ??
    restaurante?.maxMesas ??
    padrao.maxMesas;

  const maxItens =
    restaurante?.assinatura?.limites?.maxItensMenu ??
    restaurante?.licenca?.limites?.maxItensMenu ??
    restaurante?.licenca?.limites?.maxPratos ??
    restaurante?.maxItensMenu ??
    restaurante?.maxPratos ??
    padrao.maxPratos;

  return {
    maxMesas,
    maxPratos: maxItens,
    maxItensMenu: maxItens,
    modulosPermitidos: restaurante?.assinatura?.limites?.modulosPermitidos,
  };
}
