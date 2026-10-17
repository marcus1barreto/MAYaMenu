// src/lib/storage-service.ts
// Gerenciamento e upload de imagens no Firebase Storage para o MAYaMenu

import { storage } from "@/lib/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

/**
 * Faz upload da foto do prato para o Firebase Storage na pasta do restaurante:
 * /restaurantes/{restauranteId}/cardapio/{fileName}
 *
 * Utiliza timestamp + sufixo único para evitar conflito de cache no navegador
 * quando o lojista atualizar a foto do mesmo prato.
 */
export async function uploadFotoPrato(
  restauranteId: string,
  arquivo: File
): Promise<string> {
  if (!restauranteId) {
    throw new Error("restauranteId é obrigatório para fazer upload de foto.");
  }

  // Extrai extensão de forma segura
  const extensaoOriginal = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const extensao = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extensaoOriginal)
    ? extensaoOriginal
    : "jpg";

  const nomeArquivo = `item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extensao}`;
  const caminhoStorage = `restaurantes/${restauranteId}/cardapio/${nomeArquivo}`;
  const storageRef = ref(storage, caminhoStorage);

  const metadata = {
    contentType: arquivo.type || `image/${extensao === "jpg" ? "jpeg" : extensao}`,
    customMetadata: {
      restauranteId,
      uploadEm: new Date().toISOString(),
    },
  };

  const snapshot = await uploadBytes(storageRef, arquivo, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return downloadUrl;
}

/**
 * Exclui a foto de um prato do Firebase Storage dada sua URL de download.
 * Não quebra caso a URL seja externa ou local (ex: /images/demo/...).
 */
export async function excluirFotoPrato(fotoUrl?: string): Promise<void> {
  if (!fotoUrl || !fotoUrl.startsWith("http")) return;

  // Só tenta excluir se for uma URL hospedada no Firebase Storage
  if (
    !fotoUrl.includes("firebasestorage.googleapis.com") &&
    !fotoUrl.includes("storage.googleapis.com")
  ) {
    return;
  }

  try {
    const fotoRef = ref(storage, fotoUrl);
    await deleteObject(fotoRef);
  } catch (err: unknown) {
    // Se o arquivo não existir ou já tiver sido apagado, apenas ignora
    const code = (err as { code?: string })?.code;
    if (code !== "storage/object-not-found") {
      console.warn("Aviso ao tentar excluir foto do Storage:", err);
    }
  }
}
