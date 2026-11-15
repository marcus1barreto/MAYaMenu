import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RESTAURANTE_DEMO, CARDAPIO_DEMO } from "@/lib/mock-data";

export const DEMO_RESTAURANT_ID = "modelo-free";

/**
 * Cria ou reseta o estabelecimento público modelo-free no Firestore
 * (5 mesas, plano Free, cardápio inicial e comandas/pedidos/chamados zerados).
 */
export async function resetarEstabelecimentoModelo(): Promise<void> {
  const restRef = doc(db, "restaurantes", DEMO_RESTAURANT_ID);

  await setDoc(
    restRef,
    {
      ...RESTAURANTE_DEMO,
      id: DEMO_RESTAURANT_ID,
      slug: DEMO_RESTAURANT_ID,
      plano: "free",
      quantidade_mesas: 5,
      ativo: true,
      is_demo_publico: true,
      atualizado_em: new Date().toISOString(),
    },
    { merge: true }
  );

  // Limpa comandas, pedidos e chamados ativos
  const subcolecoes = ["comandas", "pedidos", "chamados"] as const;
  for (const sub of subcolecoes) {
    const snap = await getDocs(collection(db, "restaurantes", DEMO_RESTAURANT_ID, sub));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Garante o cardápio inicial se estiver vazio
  const cardapioSnap = await getDocs(
    collection(db, "restaurantes", DEMO_RESTAURANT_ID, "cardapio")
  );
  if (cardapioSnap.empty) {
    const batch = writeBatch(db);
    CARDAPIO_DEMO.forEach((item) => {
      const itemRef = doc(
        db,
        "restaurantes",
        DEMO_RESTAURANT_ID,
        "cardapio",
        item.id
      );
      batch.set(itemRef, item);
    });
    await batch.commit();
  }
}

export async function limparComandasModelo(): Promise<void> {
  const snap = await getDocs(
    collection(db, "restaurantes", DEMO_RESTAURANT_ID, "comandas")
  );
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
}
