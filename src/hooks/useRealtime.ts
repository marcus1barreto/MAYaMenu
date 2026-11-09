import { useEffect } from "react";
import {
  onSnapshot,
  doc,
  collection,
  getFirestore,
} from "firebase/firestore";

/**
 * Escuta em tempo real um caminho do Firestore.
 *
 *   - Se o caminho termina em documento (ex.: "restaurantes/abc"), escuta o doc.
 *   - Se termina em coleção (ex.: "restaurantes/abc/mesas"), escuta a coleção.
 *
 * @param path  Caminho completo separado por "/" (ex.: "restaurantes/xyz/mesas/12/comandas_abertas")
 * @param onData  Callback disparado a cada mudança, recebendo o objeto `{ id, ...data }`.
 */
export function useRealtime<T>(path: string, onData: (data: T) => void) {
  useEffect(() => {
    if (!path) return;
    const db = getFirestore();
    let unsub: (() => void) | undefined;

    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return;

    if (parts.length % 2 === 1) {
      // Coleção (ex: "restaurantes" ou "restaurantes/123/mesas")
      const [first, ...rest] = parts;
      const colRef = collection(db, first, ...rest);
      unsub = onSnapshot(colRef, (snap) => {
        snap.docs.forEach((docSnap) =>
          onData({ id: docSnap.id, ...(docSnap.data() as any) } as T)
        );
      });
    } else {
      // Documento (ex: "restaurantes/123" ou "restaurantes/123/mesas/4")
      const [first, ...rest] = parts;
      const docRef = doc(db, first, ...rest);
      unsub = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          onData({ id: snap.id, ...(snap.data() as any) } as T);
        }
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, [path, onData]);
}

