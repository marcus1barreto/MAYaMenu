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
 * Redimensiona e comprime imagens no navegador antes do upload para reduzir
 * armazenamento e consumo de banda no Firebase Storage.
 */
async function otimizarImagemParaUpload(
  arquivo: File,
  maxDimensao = 800,
  qualidade = 0.78
): Promise<{ blob: Blob; contentType: string; extensao: string }> {
  const extensaoOriginal = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";
  if (
    typeof window === "undefined" ||
    !arquivo.type.startsWith("image/") ||
    arquivo.type === "image/gif" ||
    arquivo.size <= 120 * 1024
  ) {
    return {
      blob: arquivo,
      contentType: arquivo.type || `image/${extensaoOriginal === "jpg" ? "jpeg" : extensaoOriginal}`,
      extensao: ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extensaoOriginal)
        ? extensaoOriginal
        : "jpg",
    };
  }

  try {
    const objectUrl = URL.createObjectURL(arquivo);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const escala = Math.min(1, maxDimensao / Math.max(img.width || 1, img.height || 1));
    const largura = Math.max(1, Math.round(img.width * escala));
    const altura = Math.max(1, Math.round(img.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        blob: arquivo,
        contentType: arquivo.type || "image/jpeg",
        extensao: extensaoOriginal,
      };
    }

    ctx.drawImage(img, 0, 0, largura, altura);
    const webpBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", qualidade)
    );
    if (webpBlob && webpBlob.size > 0 && webpBlob.size < arquivo.size) {
      return { blob: webpBlob, contentType: "image/webp", extensao: "webp" };
    }

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", qualidade)
    );
    if (jpegBlob && jpegBlob.size > 0 && jpegBlob.size < arquivo.size) {
      return { blob: jpegBlob, contentType: "image/jpeg", extensao: "jpg" };
    }
  } catch {
    // Fallback seguro para o arquivo original se o navegador não suportar canvas
  }

  return {
    blob: arquivo,
    contentType: arquivo.type || "image/jpeg",
    extensao: extensaoOriginal,
  };
}

/**
 * Faz upload da foto de perfil de um colaborador da equipe:
 * /restaurantes/{restauranteId}/equipe/{fileName}
 */
export async function uploadFotoEquipe(
  restauranteId: string,
  arquivo: File
): Promise<string> {
  if (!restauranteId) {
    throw new Error("restauranteId é obrigatório para fazer upload de foto de equipe.");
  }

  const otimizada = await otimizarImagemParaUpload(arquivo, 480, 0.78);
  const nomeArquivo = `membro-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${otimizada.extensao}`;
  const caminhoStorage = `restaurantes/${restauranteId}/equipe/${nomeArquivo}`;
  const storageRef = ref(storage, caminhoStorage);

  const metadata = {
    contentType: otimizada.contentType,
    customMetadata: {
      restauranteId,
      uploadEm: new Date().toISOString(),
    },
  };

  const snapshot = await uploadBytes(storageRef, otimizada.blob, metadata);
  return await getDownloadURL(snapshot.ref);
}

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

  const otimizada = await otimizarImagemParaUpload(arquivo, 800, 0.78);
  const nomeArquivo = `item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${otimizada.extensao}`;
  const caminhoStorage = `restaurantes/${restauranteId}/cardapio/${nomeArquivo}`;
  const storageRef = ref(storage, caminhoStorage);

  const metadata = {
    contentType: otimizada.contentType,
    customMetadata: {
      restauranteId,
      uploadEm: new Date().toISOString(),
    },
  };

  const snapshot = await uploadBytes(storageRef, otimizada.blob, metadata);
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
