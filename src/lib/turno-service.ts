import { db } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot, collection, query, where, serverTimestamp } from "firebase/firestore";

export type StatusTurno = "fora_de_turno" | "em_servico" | "pausa";

export interface DadosTurnoColaborador {
  uid: string;
  nome: string;
  role: "garcom" | "cozinha";
  statusTurno: StatusTurno;
  fotoUrl?: string;
  turnoIniciadoEm?: any;
  turnoPausadoEm?: any;
  turnoEncerradoEm?: any;
}

/**
 * Inicia o turno de serviço ativo de um colaborador
 */
export async function iniciarTurno(restauranteId: string, membroId: string): Promise<void> {
  if (!restauranteId || !membroId) return;
  const membroRef = doc(db, "restaurantes", restauranteId, "equipe", membroId);
  await updateDoc(membroRef, {
    statusTurno: "em_servico",
    turnoIniciadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

/**
 * Pausa temporariamente o turno de serviço (refeição, descanso)
 */
export async function pausarTurno(restauranteId: string, membroId: string): Promise<void> {
  if (!restauranteId || !membroId) return;
  const membroRef = doc(db, "restaurantes", restauranteId, "equipe", membroId);
  await updateDoc(membroRef, {
    statusTurno: "pausa",
    turnoPausadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

/**
 * Encerra o turno de serviço do colaborador
 */
export async function encerrarTurno(restauranteId: string, membroId: string): Promise<void> {
  if (!restauranteId || !membroId) return;
  const membroRef = doc(db, "restaurantes", restauranteId, "equipe", membroId);
  await updateDoc(membroRef, {
    statusTurno: "fora_de_turno",
    turnoEncerradoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

/**
 * Escuta em tempo real o status de turno do colaborador logado
 */
export function escutarStatusTurno(
  restauranteId: string,
  membroId: string,
  onUpdate: (status: StatusTurno, dados?: DadosTurnoColaborador) => void
): () => void {
  if (!restauranteId || !membroId) return () => {};
  const membroRef = doc(db, "restaurantes", restauranteId, "equipe", membroId);

  return onSnapshot(
    membroRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as DadosTurnoColaborador;
        onUpdate(data.statusTurno || "fora_de_turno", data);
      } else {
        onUpdate("fora_de_turno");
      }
    },
    (err) => {
      console.warn("Aviso ao escutar status de turno:", err);
      onUpdate("fora_de_turno");
    }
  );
}

/**
 * Escuta todos os garçons atualmente em serviço ativo no restaurante
 */
export function escutarGarconsEmServico(
  restauranteId: string,
  onUpdate: (garcons: Array<{ uid: string; nome: string; fotoUrl?: string }>) => void
): () => void {
  if (!restauranteId) return () => {};
  const equipeCol = collection(db, "restaurantes", restauranteId, "equipe");
  const q = query(equipeCol, where("role", "==", "garcom"), where("statusTurno", "==", "em_servico"));

  return onSnapshot(
    q,
    (snap) => {
      const lista: Array<{ uid: string; nome: string; fotoUrl?: string }> = [];
      snap.forEach((d) => {
        const item = d.data();
        lista.push({
          uid: d.id,
          nome: item.nome || "Garçom",
          fotoUrl: item.fotoUrl,
        });
      });
      onUpdate(lista);
    },
    (err) => {
      console.warn("Aviso ao escutar garçons em serviço:", err);
      onUpdate([]);
    }
  );
}
