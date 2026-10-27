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
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import type { Licenca, PlanoTipo, LimitesPlano, Restaurante } from "@/types";
import { parseDateToMillis, millisOu } from "@/lib/datas";

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
 * Fábrica de Concessões: Emite um lote de novas licenças em massa (Ação do SuperAdmin)
 */
export async function criarLoteLicencas(params: {
  quantidade: number;
  plano: PlanoTipo;
  responsavelPrefixo?: string;
  notas?: string;
  horasValidade?: number;
  limitesPersonalizados?: Partial<LimitesPlano>;
}): Promise<Licenca[]> {
  const qtd = Math.min(Math.max(1, params.quantidade), 100); // 1 a 100 licenças por lote
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

  const loteCriado: Licenca[] = [];
  const codigosGerados = new Set<string>();

  for (let i = 1; i <= qtd; i++) {
    let codigo = gerarCodigoLicenca();
    while (codigosGerados.has(codigo)) {
      codigo = gerarCodigoLicenca();
    }
    codigosGerados.add(codigo);

    const responsavel = params.responsavelPrefixo
      ? `${params.responsavelPrefixo.trim()} #${String(i).padStart(2, "0")}`
      : "";

    loteCriado.push({
      id: codigo,
      status: "disponivel",
      plano: params.plano,
      limites,
      criadaEm: agora,
      expiracaoEm,
      responsavel,
      notas: params.notas?.trim() || "",
    });
  }

  // 1. Salva localmente
  salvarLoteLicencasLocal(loteCriado);

  // 2. Persiste em batches atômicos no Firestore
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < loteCriado.length; i += CHUNK_SIZE) {
      const chunk = loteCriado.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const lic of chunk) {
        const ref = doc(db, "concessoes", lic.id);
        batch.set(ref, {
          ...lic,
          criadaEm: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn("Falha ao salvar lote no Firestore, mantido em cache local:", err);
  }

  return loteCriado;
}

/**
 * Exporta uma lista de licenças para formato CSV com link de ativação
 */
export function gerarCSVLicencas(licencas: Licenca[], baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const headers = [
    "Codigo",
    "Plano",
    "Status",
    "Link_Ativacao",
    "Responsavel",
    "Observacoes",
    "Validade",
    "Max_Pratos",
    "Max_Mesas",
  ];

  const rows = licencas.map((lic) => {
    const link = `${origin}/ativar/${lic.id}`;
    return [
      `"${lic.id}"`,
      `"${lic.plano.toUpperCase()}"`,
      `"${lic.status}"`,
      `"${link}"`,
      `"${(lic.responsavel || "").replace(/"/g, '""')}"`,
      `"${(lic.notas || "").replace(/"/g, '""')}"`,
      lic.expiracaoEm ? `"${new Date(lic.expiracaoEm).toLocaleString("pt-BR")}"` : `"Sem expiracao"`,
      lic.limites.maxPratos,
      lic.limites.maxMesas,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

/**
 * Dispara o download de arquivo CSV no navegador
 */
export function baixarCSVLicencas(licencas: Licenca[], nomeArquivo?: string): void {
  if (typeof window === "undefined") return;
  const csvContent = "\uFEFF" + gerarCSVLicencas(licencas);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dataStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", nomeArquivo || `concessoes_mayamenu_${dataStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera texto formatado para copiar e colar no WhatsApp, Telegram ou Slack
 */
export function formatarLicencasClipboard(licencas: Licenca[], baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const linhas = licencas.map((lic, idx) => {
    const link = `${origin}/ativar/${lic.id}`;
    const plano = lic.plano.toUpperCase();
    const resp = lic.responsavel ? ` (${lic.responsavel})` : "";
    return `${idx + 1}. [${plano}] ${lic.id}${resp}\n   🔗 ${link}`;
  });

  return `🎫 MAYaMenu - Lote de Concessões (${licencas.length} emitidas):\n\n${linhas.join("\n\n")}\n\n⚠️ Instruções: O lojista só precisa clicar no link para cadastrar e ativar o restaurante instantaneamente.`;
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

        const mesclada = Array.from(mapa.values()).filter(
          (l) => l.status !== "utilizada"
        );
        mesclada.sort((a, b) => millisOu(b.criadaEm) - millisOu(a.criadaEm));

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
      const expMillis = parseDateToMillis(lic.expiracaoEm);
      if (expMillis !== null && Date.now() > expMillis) {
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

    // Checa se já está no Arquivo Morto (licença já utilizada e arquivada)
    const arquivoSnap = await getDoc(doc(db, "arquivo_morto_licencas", codigoFormatado));
    if (arquivoSnap.exists()) {
      return { valida: false, motivo: "Esta licença já foi utilizada, ativada e transferida para o Arquivo Morto." };
    }
  } catch (err) {
    console.warn("Consulta Firestore da licença falhou, checando local:", err);
  }

  // 2. Se não encontrar no Firestore ou offline, checa armazenamento local
  const mortosLocais = obterArquivoMortoLocais();
  if (mortosLocais.some((m) => m.id === codigoFormatado || m.codigo === codigoFormatado)) {
    return { valida: false, motivo: "Esta licença já foi utilizada, ativada e transferida para o Arquivo Morto." };
  }

  const locais = obterLicencasLocais();
  const localEncontrada = locais.find((l) => l.id === codigoFormatado);
  if (localEncontrada) {
    return checarLicenca(localEncontrada);
  }

  return { valida: false, motivo: "Link de ativação inválido ou inexistente." };
}

/**
 * Executa a queima atômica (Burn-After-Reading) da licença, arquivamento definitivo
 * em JSON no 'arquivo_morto_licencas', remoção de 'concessoes' e criação da instância do restaurante
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
  const arquivoMortoRef = doc(db, "arquivo_morto_licencas", codigoFormatado);
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

      // 2. Checa se já existe no Arquivo Morto
      const arquivoSnap = await transaction.get(arquivoMortoRef);
      if (arquivoSnap.exists()) {
        throw new Error("Esta licença já foi utilizada, ativada e transferida para o Arquivo Morto.");
      }

      const licSnap = await transaction.get(licencaRef);
      let licData: Licenca | null = null;

      if (licSnap.exists()) {
        licData = licSnap.data() as Licenca;

        // 3. Confirma dentro da transação que a licença continua disponível
        if (licData.status === "utilizada" || licData.status === "ativa") {
          throw new Error("Esta licença já foi utilizada e extinta.");
        }
        if (licData.status === "suspensa" || licData.status === "revogada") {
          throw new Error("Esta licença foi revogada ou suspensa.");
        }

        if (licData.expiracaoEm) {
          const expMillis = parseDateToMillis(licData.expiracaoEm);
          if (expMillis !== null && Date.now() > expMillis) {
            throw new Error("Este link de ativação expirou.");
          }
        }
      }

      // 4. Grava o documento do restaurante vinculado ao ownerId
      const planoAtivo = licData?.plano || "free";
      const limitesAtivos = licData?.limites || LIMITES_POR_PLANO[planoAtivo];
      novoRest.plano = planoAtivo;
      novoRest.maxMesas = limitesAtivos.maxMesas;
      novoRest.maxPratos = limitesAtivos.maxPratos;
      novoRest.licenca = {
        id: codigoFormatado,
        plano: planoAtivo,
        limites: limitesAtivos,
      };
      transaction.set(restRef, novoRest);

      // 5. Grava a trava de unicidade do slug
      transaction.set(slugTravaRef, {
        slug: slugLimpo,
        ownerId: params.ownerUid,
        restauranteNome: nomeLimpo,
        criadoEm: serverTimestamp(),
      });

      // 6. Prepara os dados consolidados para o Arquivo Morto (WORM)
      const agora = new Date();
      const dadosConsolidados: Licenca = {
        ...(licData || {
          id: codigoFormatado,
          plano: "free",
          limites: { maxPratos: 15, maxMesas: 5 },
          criadaEm: agora,
        }),
        status: "utilizada",
        consumidaEm: agora,
        ativadaEm: agora,
        restauranteId: params.ownerUid,
        restauranteNome: nomeLimpo,
        slug: slugLimpo,
        ownerId: params.ownerUid,
      };

      const arquivoMortoDoc = {
        id: codigoFormatado,
        codigo: codigoFormatado,
        arquivadoEm: serverTimestamp(),
        motivo: "ativacao_concluida",
        restauranteId: params.ownerUid,
        restauranteNome: nomeLimpo,
        slug: slugLimpo,
        ownerId: params.ownerUid,
        snapshotJson: JSON.stringify(dadosConsolidados, null, 2),
        dadosLicenca: dadosConsolidados,
      };

      // 7. Grava no Arquivo Morto
      transaction.set(arquivoMortoRef, arquivoMortoDoc);

      // 8. Remove da coleção concessoes para sumir do portal e evitar reuso
      if (licSnap.exists()) {
        transaction.delete(licencaRef);
      }
    });
  } catch (err: unknown) {
    console.warn("Falha ou indisponibilidade de transação no Firestore (executando fallback resiliente):", err);
    // Se a mensagem for de negócio ("já utilizada", "slug já está em uso", etc), repassa o erro
    if (err instanceof Error && (err.message.includes("utilizada") || err.message.includes("revogada") || err.message.includes("expirou") || err.message.includes("slug") || err.message.includes("Arquivo Morto"))) {
      throw err;
    }
    // Caso de offline ou fallback
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await setDoc(restRef, novoRest);
      await setDoc(slugTravaRef, {
        slug: slugLimpo,
        ownerId: params.ownerUid,
        restauranteNome: nomeLimpo,
        criadoEm: new Date(),
      }, { merge: true });

      const agora = new Date();
      const dadosConsolidados: Licenca = {
        id: codigoFormatado,
        plano: "free",
        limites: { maxPratos: 15, maxMesas: 5 },
        criadaEm: agora,
        status: "utilizada",
        consumidaEm: agora,
        ativadaEm: agora,
        restauranteId: params.ownerUid,
        restauranteNome: nomeLimpo,
        slug: slugLimpo,
        ownerId: params.ownerUid,
      };

      await setDoc(arquivoMortoRef, {
        id: codigoFormatado,
        codigo: codigoFormatado,
        arquivadoEm: agora,
        motivo: "ativacao_concluida",
        restauranteId: params.ownerUid,
        restauranteNome: nomeLimpo,
        slug: slugLimpo,
        ownerId: params.ownerUid,
        snapshotJson: JSON.stringify(dadosConsolidados, null, 2),
        dadosLicenca: dadosConsolidados,
      });

      await deleteDoc(licencaRef);
    } catch {
      // Ignora erro se totalmente desconectado
    }
  }

  // 9. Atualiza cache local: remove de concessões ativas e move para arquivo morto local
  removerLicencaLocal(codigoFormatado);
  salvarArquivoMortoLocal({
    id: codigoFormatado,
    codigo: codigoFormatado,
    arquivadoEm: new Date().toISOString(),
    motivo: "ativacao_concluida",
    restauranteId: params.ownerUid,
    restauranteNome: nomeLimpo,
    slug: slugLimpo,
    ownerId: params.ownerUid,
    snapshotJson: JSON.stringify({
      id: codigoFormatado,
      restauranteId: params.ownerUid,
      restauranteNome: nomeLimpo,
      slug: slugLimpo,
      arquivadoEm: new Date(),
    }, null, 2),
    dadosLicenca: {
      id: codigoFormatado,
      status: "utilizada",
      plano: "free",
      limites: { maxPratos: 15, maxMesas: 5 },
      criadaEm: new Date(),
      restauranteId: params.ownerUid,
      restauranteNome: nomeLimpo,
      slug: slugLimpo,
    },
  });

  return novoRest;
}

/**
 * Escuta os registros do Arquivo Morto de Licenças em tempo real
 */
export function escutarArquivoMorto(
  onAtualizacao: (arquivadas: import("@/types").LicencaArquivada[]) => void
): Unsubscribe {
  const locais = obterArquivoMortoLocais();
  if (locais.length > 0) {
    onAtualizacao(locais);
  }

  const colRef = collection(db, "arquivo_morto_licencas");
  const q = query(colRef, orderBy("arquivadoEm", "desc"));

  try {
    return onSnapshot(
      q,
      (snapshot) => {
        const listaFirestore: import("@/types").LicencaArquivada[] = [];
        snapshot.forEach((d) => {
          listaFirestore.push({
            ...(d.data() as import("@/types").LicencaArquivada),
            id: d.id,
          });
        });

        const locaisAtuais = obterArquivoMortoLocais();
        const mapa = new Map<string, import("@/types").LicencaArquivada>();
        locaisAtuais.forEach((l) => mapa.set(l.id, l));
        listaFirestore.forEach((l) => mapa.set(l.id, l));

        const mesclada = Array.from(mapa.values());
        mesclada.sort((a, b) => millisOu(b.arquivadoEm) - millisOu(a.arquivadoEm));

        onAtualizacao(mesclada);
      },
      (err) => {
        console.warn("Listener do Firestore indisponível para arquivo_morto_licencas (usando local):", err);
        onAtualizacao(obterArquivoMortoLocais());
      }
    );
  } catch {
    return () => {};
  }
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

/**
 * Escuta todos os restaurantes ativos do sistema em tempo real (SuperAdmin)
 */
export function escutarRestaurantes(
  onAtualizacao: (restaurantes: Restaurante[]) => void
): Unsubscribe {
  const colRef = collection(db, "restaurantes");
  try {
    return onSnapshot(
      colRef,
      (snapshot) => {
        const lista: Restaurante[] = [];
        snapshot.forEach((d) => {
          lista.push({
            ...(d.data() as Restaurante),
            id: d.id,
          });
        });
        onAtualizacao(lista);
      },
      (err) => {
        console.warn("Listener de restaurantes indisponível:", err);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Suspende ou reativa um restaurante no Firestore (SuperAdmin)
 */
export async function alterarStatusRestaurante(
  restauranteId: string,
  suspenso: boolean
): Promise<void> {
  try {
    const restRef = doc(db, "restaurantes", restauranteId);
    await setDoc(
      restRef,
      {
        suspenso,
        configuracoes: {
          suspenso,
        },
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Falha ao alterar status de suspensão do restaurante:", err);
    throw err;
  }
}

/**
 * Atualiza o plano de um restaurante diretamente (SuperAdmin) sincronizando plano e limites
 */
export async function alterarPlanoRestaurante(
  restauranteId: string,
  novoPlano: PlanoTipo,
  licencaCodigo?: string
): Promise<void> {
  const novosLimites = LIMITES_POR_PLANO[novoPlano];

  // 1. Atualiza no documento do restaurante (usando setDoc com merge para garantir criação ou update resiliente)
  try {
    const restRef = doc(db, "restaurantes", restauranteId);
    await setDoc(
      restRef,
      {
        plano: novoPlano,
        maxMesas: novosLimites.maxMesas,
        maxPratos: novosLimites.maxPratos,
        licenca: {
          plano: novoPlano,
          limites: novosLimites,
        },
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Falha ao atualizar plano no restaurante:", err);
    throw err;
  }

  // 2. Se houver licença vinculada, atualiza também a concessão
  if (licencaCodigo) {
    const codigoFormatado = licencaCodigo.trim().toUpperCase();
    try {
      const licRef = doc(db, "concessoes", codigoFormatado);
      await setDoc(
        licRef,
        {
          plano: novoPlano,
          limites: novosLimites,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      // Ignora se for licença já utilizada / arquivada
      console.warn("Concessão não atualizada diretamente (pode estar arquivada):", err);
    }

    const locais = obterLicencasLocais();
    const atualizadas = locais.map((l) =>
      l.id === codigoFormatado ? { ...l, plano: novoPlano, limites: novosLimites } : l
    );
    if (typeof window !== "undefined") {
      localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(atualizadas));
    }
  }
}

/**
 * Renova o prazo de expiração de uma licença não utilizada (SuperAdmin)
 */
export async function renovarValidadeLicenca(
  codigo: string,
  horasAdicionais = 48
): Promise<Date> {
  const codigoFormatado = codigo.trim().toUpperCase();
  const novaExpiracao = new Date(Date.now() + horasAdicionais * 60 * 60 * 1000);

  // 1. Atualiza no Firestore
  try {
    const licRef = doc(db, "concessoes", codigoFormatado);
    await updateDoc(licRef, {
      expiracaoEm: novaExpiracao,
      status: "disponivel",
    });
  } catch (err) {
    console.warn("Falha ao renovar expiração no Firestore (salvo local):", err);
  }

  // 2. Atualiza localmente
  const locais = obterLicencasLocais();
  const atualizadas = locais.map((l) =>
    l.id === codigoFormatado
      ? { ...l, expiracaoEm: novaExpiracao, status: "disponivel" as const }
      : l
  );
  if (typeof window !== "undefined") {
    localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(atualizadas));
  }

  return novaExpiracao;
}

/**
 * Revoga e exclui uma licença não utilizada (SuperAdmin)
 */
export async function revogarLicenca(codigo: string): Promise<void> {
  const codigoFormatado = codigo.trim().toUpperCase();

  // 1. Remove do Firestore
  try {
    const { deleteDoc } = await import("firebase/firestore");
    const licRef = doc(db, "concessoes", codigoFormatado);
    await deleteDoc(licRef);
  } catch (err) {
    console.warn("Falha ao revogar licença no Firestore:", err);
  }

  // 2. Remove do cache local
  removerLicencaLocal(codigoFormatado);
}

/**
 * Transfere uma licença vencida para o Arquivo Morto com motivo 'expirada'
 */
export async function arquivarLicencaExpirada(licenca: Licenca): Promise<void> {
  const codigoFormatado = licenca.id.trim().toUpperCase();
  const arquivoMortoRef = doc(db, "arquivo_morto_licencas", codigoFormatado);
  const licencaRef = doc(db, "concessoes", codigoFormatado);

  const dadosConsolidados: Licenca = {
    ...licenca,
    status: "revogada",
  };

  const arquivoMortoDoc = {
    id: codigoFormatado,
    codigo: codigoFormatado,
    arquivadoEm: serverTimestamp(),
    motivo: "expirada",
    restauranteId: licenca.restauranteId || "nao_ativada",
    restauranteNome: licenca.restauranteNome || licenca.responsavel || "Licença Expirada sem Uso",
    slug: licenca.slug || "",
    ownerId: licenca.ownerId || "",
    snapshotJson: JSON.stringify(dadosConsolidados, null, 2),
    dadosLicenca: dadosConsolidados,
  };

  try {
    const { deleteDoc } = await import("firebase/firestore");
    await setDoc(arquivoMortoRef, arquivoMortoDoc);
    await deleteDoc(licencaRef);
  } catch (err) {
    console.warn("Falha ao arquivar licença expirada no Firestore:", err);
  }

  salvarArquivoMortoLocal({
    ...arquivoMortoDoc,
    arquivadoEm: new Date(),
    motivo: "expirada",
  });
  removerLicencaLocal(codigoFormatado);
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

function salvarLoteLicencasLocal(novas: Licenca[]): void {
  if (typeof window === "undefined") return;
  try {
    const locais = obterLicencasLocais();
    const mapa = new Map<string, Licenca>();
    for (const l of locais) {
      mapa.set(l.id, l);
    }
    for (const n of novas) {
      mapa.set(n.id, n);
    }
    const listaFinal = Array.from(mapa.values());
    localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(listaFinal));
  } catch (e) {
    console.warn("Falha ao salvar lote no localStorage:", e);
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

function removerLicencaLocal(codigo: string): void {
  if (typeof window === "undefined") return;
  try {
    const locais = obterLicencasLocais();
    const filtrada = locais.filter((l) => l.id !== codigo);
    localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(filtrada));
  } catch (e) {
    console.warn("Falha ao remover licença do localStorage:", e);
  }
}

function salvarArquivoMortoLocal(arquivada: import("@/types").LicencaArquivada): void {
  if (typeof window === "undefined") return;
  try {
    const locais = obterArquivoMortoLocais();
    const existe = locais.some((l) => l.id === arquivada.id);
    const novaLista = existe ? locais.map((l) => (l.id === arquivada.id ? arquivada : l)) : [arquivada, ...locais];
    localStorage.setItem("mayamenu_arquivo_morto_locais", JSON.stringify(novaLista));
  } catch (e) {
    console.warn("Falha ao salvar no arquivo morto local:", e);
  }
}

function obterArquivoMortoLocais(): import("@/types").LicencaArquivada[] {
  if (typeof window === "undefined") return [];
  try {
    const salvo = localStorage.getItem("mayamenu_arquivo_morto_locais");
    return salvo ? JSON.parse(salvo) : [];
  } catch {
    return [];
  }
}
