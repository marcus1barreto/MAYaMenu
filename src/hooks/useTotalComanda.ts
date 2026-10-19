"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useTotalComanda(
  restauranteId?: string,
  mesa?: string | number,
  clienteId?: string
) {
  const [totalCalculado, setTotalCalculado] = useState(0);
  const [pedidosMesa, setPedidosMesa] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!restauranteId || !mesa || !clienteId) {
      setCarregando(false);
      return;
    }

    const pedidosRef = collection(
      db,
      "restaurantes",
      restauranteId,
      "mesas",
      String(mesa),
      "comandas_abertas",
      clienteId,
      "pedidos"
    );

    const unsub = onSnapshot(
      pedidosRef,
      (snapshot) => {
        let soma = 0;
        const lista: any[] = [];

        snapshot.forEach((d) => {
          const data = d.data();
          lista.push({ id: d.id, ...data });

          if (data.status !== "cancelado" && data.status !== "estornado") {
            soma += data.subtotal || 0;
          }
        });

        setTotalCalculado(soma);
        setPedidosMesa(lista);
        setCarregando(false);
      },
      (err) => {
        console.error("Erro ao escutar subcoleção de pedidos:", err);
        setCarregando(false);
      }
    );

    return () => unsub();
  }, [restauranteId, mesa, clienteId]);

  return { totalCalculado, pedidosMesa, carregando };
}
