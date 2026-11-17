export const CHAVE_B2B_SEGURA_REGEX = /^SPN-[A-HJ-NP-Z2-9]{26}$/;
const ALFABETO_B2B = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Valida se uma chave de contrato B2B segue o padrão seguro atual (SPN- + 26 caracteres).
 */
export function isChaveB2BValidaFormato(chave?: string | null): boolean {
  if (typeof chave !== "string") return false;
  return CHAVE_B2B_SEGURA_REGEX.test(chave.trim().toUpperCase());
}

/**
 * Gera string aleatória criptográfica compatível com o alfabeto sem ambiguidade do backend.
 */
export function gerarTokenB2BSeguro(tamanho: number): string {
  const bytes = new Uint8Array(tamanho);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Gerador criptográfico seguro indisponível; operação B2B cancelada.");
  }
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALFABETO_B2B[byte & 31]).join("");
}

/**
 * Emite nova chave de acesso B2B no formato SPN- + 26 caracteres (~130 bits de entropia).
 */
export function gerarChaveAcessoB2BSegura(): string {
  return `SPN-${gerarTokenB2BSeguro(26)}`;
}
