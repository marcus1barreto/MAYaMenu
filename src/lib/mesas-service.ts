import { db, functions } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, collection, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

export interface ConfigMesa {
  numero: number;
  ativa: boolean;
  statusEstrutural: "livre" | "reservada" | "bloqueada" | "inativa";
  reserva?: {
    nomeCliente: string;
    horario: string;
    quantidadePessoas?: number;
  };
  modoAtendimento: "livre" | "garcom_fixo";
  garcomFixoId?: string;
  garcomFixoNome?: string;
  qrConfigurado?: boolean;
  qrVersao?: number;
  atualizadoEm?: any;
}

/**
 * Salva ou atualiza as configurações estruturais de uma mesa no Firestore
 */
export async function salvarConfigMesa(
  restauranteId: string,
  numeroMesa: number,
  dados: Partial<ConfigMesa>
): Promise<void> {
  if (!restauranteId || !numeroMesa) return;
  const mesaRef = doc(db, "restaurantes", restauranteId, "mesas", String(numeroMesa));
  await setDoc(
    mesaRef,
    {
      numero: numeroMesa,
      ...dados,
      atualizadoEm: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Reativa uma mesa permanentemente desativada por callable privilegiada e rotaciona o QR.
 * A credencial em texto claro é retornada uma única vez e nunca persiste no Firestore.
 */
export async function reativarMesaFirestore(
  restauranteId: string,
  numeroMesa: number
): Promise<{
  sucesso: boolean;
  idempotente?: boolean;
  slug?: string;
  mesa: number;
  qrVersao?: number;
  qrCredencial?: string;
}> {
  const reativarFn = httpsCallable(functions, "reativarMesaBackend");
  const resultado = await reativarFn({ restauranteId, mesa: numeroMesa });
  return resultado.data as {
    sucesso: boolean;
    idempotente?: boolean;
    slug?: string;
    mesa: number;
    qrVersao?: number;
    qrCredencial?: string;
  };
}

/**
 * Emite ou rotaciona a credencial QR de uma mesa. O segredo só é devolvido no momento da emissão.
 */
export async function emitirCredencialMesaFirestore(
  restauranteId: string,
  numeroMesa: number,
  rotacionar = false
): Promise<{
  sucesso: boolean;
  jaConfigurada?: boolean;
  slug?: string;
  mesa: number;
  qrVersao?: number;
  qrCredencial?: string;
}> {
  const emitirFn = httpsCallable(functions, "garantirCredencialMesa");
  const resultado = await emitirFn({ restauranteId, mesa: numeroMesa, rotacionar });
  return resultado.data as {
    sucesso: boolean;
    jaConfigurada?: boolean;
    slug?: string;
    mesa: number;
    qrVersao?: number;
    qrCredencial?: string;
  };
}

/**
 * Ativa ou desativa todas as mesas ou uma faixa de mesas em lote
 */
export async function alternarStatusLoteMesas(
  restauranteId: string,
  numerosMesas: number[],
  ativa: boolean
): Promise<void> {
  if (!restauranteId || numerosMesas.length === 0) return;
  const snapshots = await Promise.all(numerosMesas.map(async (num) => {
    const mesaRef = doc(db, "restaurantes", restauranteId, "mesas", String(num));
    return { num, snap: await getDoc(mesaRef) };
  }));
  const permanentementeInativas = snapshots.filter(
    ({ snap }) => snap.exists() && snap.data().statusEstrutural === "inativa"
  );
  if (ativa && permanentementeInativas.length > 0) {
    throw new Error("Uma ou mais mesas foram desativadas permanentemente. Reative-as individualmente pelo fluxo seguro de reemissão do QR Code.");
  }
  const atualizaveis = snapshots.filter(({ snap }) =>
    !(snap.exists() && snap.data().statusEstrutural === "inativa")
  );
  await Promise.all(atualizaveis.map(({ num }) =>
    salvarConfigMesa(restauranteId, num, { ativa })
  ));
}

/**
 * Escuta em tempo real as configurações estruturais de todas as mesas do restaurante
 */
export function escutarConfigsMesas(
  restauranteId: string,
  onUpdate: (configs: Record<number, ConfigMesa>) => void
): () => void {
  if (!restauranteId) return () => {};
  const mesasCol = collection(db, "restaurantes", restauranteId, "mesas");

  return onSnapshot(
    mesasCol,
    (snap) => {
      const mapa: Record<number, ConfigMesa> = {};
      snap.forEach((d) => {
        const num = Number(d.id);
        if (!isNaN(num)) {
          const data = d.data();
          mapa[num] = {
            numero: num,
            ativa: data.ativa !== undefined ? Boolean(data.ativa) : true,
            statusEstrutural: data.statusEstrutural || "livre",
            reserva: data.reserva,
            modoAtendimento: data.modoAtendimento || "livre",
            garcomFixoId: data.garcomFixoId,
            garcomFixoNome: data.garcomFixoNome,
            qrConfigurado: typeof data.qrCredencialHash === "string" && data.qrCredencialHash.length === 64,
            qrVersao: Number(data.qrVersao) || 0,
            atualizadoEm: data.atualizadoEm,
          };
        }
      });
      onUpdate(mapa);
    },
    (err) => {
      console.warn("Aviso ao escutar configurações de mesas:", err);
      onUpdate({});
    }
  );
}

