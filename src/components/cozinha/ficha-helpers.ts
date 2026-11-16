export { excluirFichaTecnica } from "@/lib/fichas-tecnicas-service";

export function salvaFichaPreviewUrlCheck(
  fotoReferenciaUrl?: string,
  fotoCardapioUrl?: string
): boolean {
  return Boolean((fotoReferenciaUrl || "").trim() || (fotoCardapioUrl || "").trim());
}
