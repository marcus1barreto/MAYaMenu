import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FichaTecnicaItem, IngredienteFichaTecnica } from "@/types";

export function sanitizarUrlReferenciaExterna(url?: string): string {
  const limpa = String(url || "").trim();
  if (!limpa) return "";
  try {
    const parsed = new URL(limpa);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    return "";
  } catch {
    return "";
  }
}

export function normalizarFichaTecnica(
  id: string,
  data: Partial<FichaTecnicaItem>
): FichaTecnicaItem {
  const ingredientesRaw = Array.isArray(data.ingredientes) ? data.ingredientes : [];
  const ingredientes: IngredienteFichaTecnica[] = ingredientesRaw
    .map((ing, idx) => ({
      id: String(ing?.id || `ing-${idx + 1}`),
      nome: String(ing?.nome || "").trim(),
      quantidade: String(ing?.quantidade || "").trim(),
      ...(ing?.observacao ? { observacao: String(ing.observacao).trim() } : {}),
    }))
    .filter((ing) => ing.nome.length > 0);

  return {
    id,
    menuItemId: String(data.menuItemId || id),
    nomeItem: String(data.nomeItem || "Prato"),
    estacao: data.estacao ? String(data.estacao).trim() : "",
    rendimento: data.rendimento ? String(data.rendimento).trim() : "",
    tempoPreparoMin:
      typeof data.tempoPreparoMin === "number" && Number.isFinite(data.tempoPreparoMin)
        ? Math.max(1, Math.round(data.tempoPreparoMin))
        : undefined,
    ingredientes,
    modoPreparo: String(data.modoPreparo || "").trim(),
    alergenos: data.alergenos ? String(data.alergenos).trim() : "",
    observacoesEmpratamento: data.observacoesEmpratamento
      ? String(data.observacoesEmpratamento).trim()
      : "",
    fotoReferenciaUrl: sanitizarUrlReferenciaExterna(data.fotoReferenciaUrl),
    atualizadoEm: data.atualizadoEm ? String(data.atualizadoEm) : undefined,
  };
}

export function escutarFichasTecnicas(
  restauranteId: string,
  onAtualizacao: (fichasPorItem: Record<string, FichaTecnicaItem>) => void
): Unsubscribe {
  if (!restauranteId) {
    onAtualizacao({});
    return () => {};
  }

  const refCol = collection(db, "restaurantes", restauranteId, "fichas_tecnicas");
  return onSnapshot(
    refCol,
    (snap) => {
      const mapa: Record<string, FichaTecnicaItem> = {};
      snap.forEach((d) => {
        const ficha = normalizarFichaTecnica(d.id, d.data() as Partial<FichaTecnicaItem>);
        mapa[ficha.menuItemId] = ficha;
      });
      onAtualizacao(mapa);
    },
    (err) => {
      console.warn("Não foi possível escutar fichas técnicas:", err);
    }
  );
}

export async function salvarFichaTecnica(
  restauranteId: string,
  ficha: Omit<FichaTecnicaItem, "id" | "atualizadoEm">
): Promise<FichaTecnicaItem> {
  if (!restauranteId || !ficha.menuItemId) {
    throw new Error("Restaurante e item do cardápio são obrigatórios.");
  }

  const normalizada = normalizarFichaTecnica(ficha.menuItemId, {
    ...ficha,
    atualizadoEm: new Date().toISOString(),
  });

  const payload = {
    menuItemId: normalizada.menuItemId,
    nomeItem: normalizada.nomeItem,
    estacao: normalizada.estacao || "",
    rendimento: normalizada.rendimento || "",
    ...(normalizada.tempoPreparoMin !== undefined
      ? { tempoPreparoMin: normalizada.tempoPreparoMin }
      : {}),
    ingredientes: normalizada.ingredientes,
    modoPreparo: normalizada.modoPreparo,
    alergenos: normalizada.alergenos || "",
    observacoesEmpratamento: normalizada.observacoesEmpratamento || "",
    fotoReferenciaUrl: sanitizarUrlReferenciaExterna(normalizada.fotoReferenciaUrl),
    atualizadoEm: normalizada.atualizadoEm,
  };

  await setDoc(
    doc(db, "restaurantes", restauranteId, "fichas_tecnicas", normalizada.menuItemId),
    payload,
    { merge: true }
  );

  return normalizada;
}

export async function excluirFichaTecnica(
  restauranteId: string,
  menuItemId: string
): Promise<void> {
  if (!restauranteId || !menuItemId) return;
  await deleteDoc(doc(db, "restaurantes", restauranteId, "fichas_tecnicas", menuItemId));
}
