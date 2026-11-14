/**
 * Registro central de módulos (Feature Flags) do MAYaMenu.
 *
 * Em modo pré-lançamento (`PRELAUNCH_MODE = true`), apenas o núcleo essencial
 * fica exposto (Free até 5 mesas, QR Code, Cozinha, Atendimento e Pix),
 * mantendo os demais módulos preservados para ativação gradual.
 *
 * Para reativar todos os módulos, defina NEXT_PUBLIC_PRELAUNCH_MODE=false.
 */
export const PRELAUNCH_MODE =
  process.env.NEXT_PUBLIC_PRELAUNCH_MODE !== "false";

export type ModuloId =
  | "core.auth"
  | "core.cardapio"
  | "core.mesas_qr"
  | "core.cozinha"
  | "core.atendimento"
  | "core.pagamento_pix"
  | "mod.garcom_salao"
  | "mod.taxa_servico"
  | "mod.vendas_assinaturas"
  | "mod.b2b_patrocinios"
  | "mod.analytics_historico";

export const MODULOS_ATIVOS: Record<ModuloId, boolean> = {
  "core.auth": true,
  "core.cardapio": true,
  "core.mesas_qr": true,
  "core.cozinha": true,
  "core.atendimento": true,
  "core.pagamento_pix": true,
  "mod.garcom_salao": !PRELAUNCH_MODE,
  "mod.taxa_servico": !PRELAUNCH_MODE,
  "mod.vendas_assinaturas": !PRELAUNCH_MODE,
  "mod.b2b_patrocinios": !PRELAUNCH_MODE,
  "mod.analytics_historico": !PRELAUNCH_MODE,
};

export function moduloAtivo(modulo: ModuloId): boolean {
  return MODULOS_ATIVOS[modulo] === true;
}

export const LIMITE_MESAS_FREE_PRELAUNCH = 5;

