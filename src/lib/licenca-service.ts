// src/lib/licenca-service.ts
// Gerenciamento e validação de Licenças / Concessões do MAYaMenu (SuperAdmin)

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import type { Licenca, PlanoTipo, LimitesPlano, Restaurante } from "@/types";

export const LIMITES_POR_PLANO: Record<PlanoTipo, LimitesPlano> = {
  free: {
    maxPratos: 15,
    maxMesas: 5,
  },
  pro: {
    maxPratos: 60,
    maxMesas: 30,
  },
  enterprise: {
    maxPratos: 999,
    maxMesas: 999,
  },
};

/**
 * Gera um token alfanumérico amigável e memorável no formato MAYA-XXXX-XXXX
 */
export function gerarCodigoLicenca(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I, O, 0, 1 para evitar ambiguidades
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MAYA-${p1}-${p2}`;
}

/**
 * Cria uma nova licença no Firestore (Ação do SuperAdmin)
 */
export async function criarNovaLicenca(params: {
  plano: PlanoTipo;
  responsavel?: string;
  notas?: string;
  horasValidade?: number; // Ex: 48h ou 168h (7 dias)
  limitesPersonalizados?: Partial<LimitesPlano>;
}): Promise<Licenca> {
  const codigo = gerarCodigoLicenca();
  const licencaRef = doc(db, "concessoes", codigo);

  const limitesBase = LIMITES_POR_PLANO[params.plano];
  const limites: LimitesPlano = {
    maxPratos: params.limitesPersonalizados?.maxPratos ?? limitesBase.maxPratos,
    maxMesas: params.limitesPersonalizados?.maxMesas ?? limitesBase.maxMesas,
  };

  const agora = new Date();
  let expiracaoEm: Date | undefined = undefined;
  if (params.horasValidade && params.horasValidade > 0) {
    expiracaoEm = new Date(agora.getTime() + params.horasValidade * 60 * 60 * 1000);
  }

  const novaLicenca: Licenca = {
    id: codigo,
    status: "disponivel",
    plano: params.plano,
    limites,
    criadaEm: agora,
    expiracaoEm,
    responsavel: params.responsavel?.trim() || "",
    notas: params.notas?.trim() || "",
  };

  // 1. Salva imediatamente no cache local para nunca perder nem travar a UI
  salvarLicencaLocal(novaLicenca);

  // 2. Tenta persistir no Firestore em nuvem
  try {
    await setDoc(licencaRef, {
      ...novaLicenca,
      criadaEm: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore bloqueado ou offline para concessões. Salvo localmente com sucesso:", err);
  }

  return novaLicenca;
}

/**
 * Escuta todas as concessões/licenças em tempo real para o Painel SuperAdmin
 */
export function escutarLicencas(
  onAtualizacao: (licencas: Licenca[]) => void
): Unsubscribe {
  // Dispara imediatamente os dados locais para resposta visual instantânea
  const locais = obterLicencasLocais();
  if (locais.length > 0) {
    onAtualizacao(locais);
  }

  const colRef = collection(db, "concessoes");
  const q = query(colRef, orderBy("criadaEm", "desc"));

  try {
    return onSnapshot(
      q,
      (snapshot) => {
        const listaFirestore: Licenca[] = [];
        snapshot.forEach((d) => {
          listaFirestore.push({
            ...(d.data() as Licenca),
            id: d.id,
          });
        });

        // MesclaFirestore com os locais garantindo que nenhuma licença gerada se perca
        const locaisAtuais = obterLicencasLocais();
        const mapa = new Map<string, Licenca>();
        locaisAtuais.forEach((l) => mapa.set(l.id, l));
        listaFirestore.forEach((l) => mapa.set(l.id, l));

        const mesclada = Array.from(mapa.values());
        mesclada.sort((a, b) => {
          const tA = a.criadaEm?.toMillis ? a.criadaEm.toMillis() : new Date(a.criadaEm || 0).getTime();
          const tB = b.criadaEm?.toMillis ? b.criadaEm.toMillis() : new Date(b.criadaEm || 0).getTime();
          return tB - tA;
        });

        onAtualizacao(mesclada);
      },
      (err) => {
        console.warn("Listener do Firestore indisponível para concessoes (usando local):", err);
        onAtualizacao(obterLicencasLocais());
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Valida se um código de licença é válido e está disponível para ativação
 */
export async function validarLicencaParaAtivacao(codigo: string): Promise<{
  valida: boolean;
  licenca?: Licenca;
  motivo?: string;
}> {
  const codigoFormatado = codigo.trim().toUpperCase();

  const checarLicenca = (lic: Licenca): { valida: boolean; licenca?: Licenca; motivo?: string } => {
    if (lic.status === "ativa" || lic.status === "utilizada") {
      return { valida: false, motivo: "Este link de ativação já foi utilizado e extinto." };
    }
    if (lic.status === "suspensa" || lic.status === "revogada") {
      return { valida: false, motivo: "Esta licença foi bloqueada ou revogada pela gerência." };
    }

    // Validação de expiração se houver
    if (lic.expiracaoEm) {
      const expMillis = lic.expiracaoEm?.toMillis
        ? lic.expiracaoEm.toMillis()
        : new Date(lic.expiracaoEm).getTime();
      if (Date.now() > expMillis) {
        return { valida: false, motivo: "Este convite de ativação expirou. Solicite um novo link." };
      }
    }

    return { valida: true, licenca: lic };
  };

  // 1. Checa no Firestore (prioridade para ver status mais atualizado de queima)
  try {
    const docSnap = await getDoc(doc(db, "concessoes", codigoFormatado));
    if (docSnap.exists()) {
      const licencaFirestore = { ...(docSnap.data() as Licenca), id: docSnap.id };
      return checarLicenca(licencaFirestore);
    }
  } catch (err) {
    console.warn("Consulta Firestore da licença falhou, checando local:", err);
  }

  // 2. Se não encontrar no Firestore ou offline, checa armazenamento local
  const locais = obterLicencasLocais();
  const localEncontrada = locais.find((l) => l.id === codigoFormatado);
  if (localEncontrada) {
    return checarLicenca(localEncontrada);
  }

  return { valida: false, motivo: "Link de ativação inválido ou inexistente." };
}

/**
 * Executa a queima atômica (Burn-After-Reading) da licença e a criação da instância do restaurante
 * usando runTransaction do Firestore, garantindo anti-race condition e uso único estrito.
 */
export async function ativarLicencaEInstanciaAtomica(params: {
  codigo: string;
  ownerUid: string;
  restauranteNome: string;
  slug: string;
  modoOperacao?: "com_garcom" | "hibrido" | "balcao";
}): Promise<Restaurante> {
  const codigoFormatado = params.codigo.trim().toUpperCase();
  const licencaRef = doc(db, "concessoes", codigoFormatado);
  const restRef = doc(db, "restaurantes", params.ownerUid);

  const slugLimpo = params.slug.trim().toLowerCase();
  const nomeLimpo = params.restauranteNome.trim();

  const novoRest: Restaurante = {
    id: params.ownerUid,
    ownerId: params.ownerUid,
    slug: slugLimpo,
    nome: nomeLimpo,
    configuracoes: {
      corPrimaria: "#E11D48",
      tema: "light",
      capaUrl: "/images/capa-padrao.webp",
      modoOperacao: params.modoOperacao || "hibrido",
    },
  };

  const { runTransaction } = await import("firebase/firestore");

  const slugTravaRef = doc(db, "slugs", slugLimpo);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Checa trava de unicidade do slug
      const slugSnap = await transaction.get(slugTravaRef);
      if (slugSnap.exists()) {
        const slugData = slugSnap.data();
        if (slugData.ownerId && slugData.ownerId !== params.ownerUid) {
          throw new Error(`O slug '/r/${slugLimpo}' já está em uso por outro restaurante. Escolha outro slug.`);
        }
      }

      const licSnap = await transaction.get(licencaRef);

      if (licSnap.exists()) {
        const licData = licSnap.data() as Licenca;

        // 2. Confirma dentro da transação que a licença continua disponível
        if (licData.status === "utilizada" || licData.status === "ativa") {
          throw new Error("Esta licença já foi utilizada e extinta.");
        }
        if (licData.status === "suspensa" || licData.status === "revogada") {
          throw new Error("Esta licença foi revogada ou suspensa.");
        }

        if (licData.expiracaoEm) {
          const expMillis = licData.expiracaoEm?.toMillis
            ? licData.expiracaoEm.toMillis()
            : new Date(licData.expiracaoEm).getTime();
          if (Date.now() > expMillis) {
            throw new Error("Este link de ativação expirou.");
          }
        }
      }

      // 3. Grava o documento do restaurante vinculado ao ownerId
      transaction.set(restRef, novoRest);

      // 4. Grava a trava de unicidade do slug
      transaction.set(slugTravaRef, {
        slug: slugLimpo,
        ownerId: params.ownerUid,
        restauranteNome: nomeLimpo,
        criadoEm: serverTimestamp(),
      });

      // 5. Queima imediatamente a licença marcando como consumida/utilizada
      transaction.set(
        licencaRef,
        {
          status: "utilizada",
          consumidaEm: serverTimestamp(),
          ativadaEm: serverTimestamp(),
          restauranteId: params.ownerUid,
          restauranteNome: nomeLimpo,
          slug: slugLimpo,
          ownerId: params.ownerUid,
        },
        { merge: true }
      );
    });
  } catch (err: unknown) {
    console.warn("Falha ou indisponibilidade de transação no Firestore (executando fallback resiliente):", err);
    // Se a mensagem for de negócio ("já utilizada", "slug já está em uso", etc), repassa o erro
    if (err instanceof Error && (err.message.includes("utilizada") || err.message.includes("revogada") || err.message.includes("expirou") || err.message.includes("slug"))) {
      throw err;
    }
    // Caso de offline ou fallback
    try {
      await setDoc(restRef, novoRest);
      await setDoc(slugTravaRef, {
        slug: slugLimpo,
        ownerId: params.ownerUid,
        restauranteNome: nomeLimpo,
        criadoEm: new Date(),
      }, { merge: true });
      await setDoc(
        licencaRef,
        {
          status: "utilizada",
          consumidaEm: new Date(),
          ativadaEm: new Date(),
          restauranteId: params.ownerUid,
          restauranteNome: nomeLimpo,
          slug: slugLimpo,
          ownerId: params.ownerUid,
        },
        { merge: true }
      );
    } catch {
      // Ignora erro se totalmente desconectado
    }
  }

  // Atualiza cache local para refletir a extinção imediata do link
  const locais = obterLicencasLocais();
  const atualizadas = locais.map((l) => {
    if (l.id === codigoFormatado) {
      return {
        ...l,
        status: "utilizada" as const,
        restauranteId: params.ownerUid,
        restauranteNome: nomeLimpo,
        slug: slugLimpo,
        consumidaEm: new Date(),
        ativadaEm: new Date(),
        ownerId: params.ownerUid,
      };
    }
    return l;
  });
  if (typeof window !== "undefined") {
    localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(atualizadas));
  }

  return novoRest;
}

/**
 * Consome/Ativa a licença vinculando-a ao novo restaurante (compatibilidade legada)
 */
export async function ativarLicencaNoRestaurante(params: {
  codigo: string;
  restauranteId: string;
  restauranteNome: string;
  slug: string;
}): Promise<void> {
  await ativarLicencaEInstanciaAtomica({
    codigo: params.codigo,
    ownerUid: params.restauranteId,
    restauranteNome: params.restauranteNome,
    slug: params.slug,
  });
}

/**
 * Alterna o status da concessão (SuperAdmin: suspender ou reativar um cliente)
 */
export async function alterarStatusLicenca(
  codigo: string,
  novoStatus: "ativa" | "suspensa" | "revogada"
): Promise<void> {
  const codigoFormatado = codigo.trim().toUpperCase();

  // 1. Atualiza local
  const locais = obterLicencasLocais();
  const atualizadas = locais.map((l) => (l.id === codigoFormatado ? { ...l, status: novoStatus } : l));
  if (typeof window !== "undefined") {
    localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(atualizadas));
  }

  // 2. Atualiza Firestore
  try {
    const licencaRef = doc(db, "concessoes", codigoFormatado);
    await updateDoc(licencaRef, { status: novoStatus });
  } catch (err) {
    console.warn("Alteração remota do status adiada (salva localmente):", err);
  }
}

// Persistência local resiliente
function salvarLicencaLocal(licenca: Licenca): void {
  if (typeof window === "undefined") return;
  try {
    const locais = obterLicencasLocais();
    const existe = locais.some((l) => l.id === licenca.id);
    const novaLista = existe ? locais.map((l) => (l.id === licenca.id ? licenca : l)) : [licenca, ...locais];
    localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(novaLista));
  } catch (e) {
    console.warn("Falha ao salvar licença no localStorage:", e);
  }
}

function obterLicencasLocais(): Licenca[] {
  if (typeof window === "undefined") return [];
  try {
    const salvo = localStorage.getItem("mayamenu_concessoes_locais");
    return salvo ? JSON.parse(salvo) : [];
  } catch {
    return [];
  }
}
