// src/lib/licenca-service.ts
// Gerenciamento e validação de Licenças / Concessões do MAYaMenu (SuperAdmin)

import { db, functions } from "@/lib/firebase";
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
  runTransaction,
  type Unsubscribe,
} from "firebase/firestore";
import type { Licenca, LicencaArquivada, PlanoTipo, LimitesPlano, Restaurante } from "@/types";
import { millisOu } from "@/lib/datas";
import { httpsCallable } from "firebase/functions";

export const LIMITES_POR_PLANO: Record<PlanoTipo, LimitesPlano> = {
  free: {
    maxPratos: 20,
    maxItensMenu: 20,
    maxMesas: 10,
  },
  pro: {
    maxPratos: 60,
    maxItensMenu: 60,
    maxMesas: 30,
  },
  enterprise: {
    maxPratos: 999,
    maxItensMenu: 999,
    maxMesas: 999,
  },
};

/**
 * Gera um token alfanumérico amigável e memorável no formato MAYA-XXXX-XXXX
 */
export function gerarCodigoLicenca(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos; índice uniforme com 5 bits
  const bytes = new Uint8Array(8);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Gerador criptográfico seguro indisponível; licença não foi gerada.");
  }
  globalThis.crypto.getRandomValues(bytes);
  const codigo = Array.from(bytes, (b) => chars[b & 31]).join("");
  return `MAYA-${codigo.slice(0, 4)}-${codigo.slice(4)}`;
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

  // Código é criado, nunca sobrescrito: colisão exige gerar outro código.
  await runTransaction(db, async (tx) => {
    const atual = await tx.get(licencaRef);
    if (atual.exists()) throw new Error("Colisão de código de licença; gere uma nova concessão.");
    tx.set(licencaRef, {
      ...novaLicenca,
      criadaEm: serverTimestamp(),
    });
  });
  salvarLicencaLocal(novaLicenca);
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

  // Todo o lote é criado numa única transação: sem sobrescrita e sem lote parcial.
  await runTransaction(db, async (tx) => {
    const refs = loteCriado.map((lic) => doc(db, "concessoes", lic.id));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const colisao = snapshots.findIndex((snap) => snap.exists());
    if (colisao >= 0) {
      throw new Error(`Colisão no código ${loteCriado[colisao].id}; nenhum item do lote foi criado.`);
    }
    refs.forEach((ref, index) => {
      tx.set(ref, { ...loteCriado[index], criadaEm: serverTimestamp() });
    });
  });
  salvarLoteLicencasLocal(loteCriado);
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
  if (!codigoFormatado) return { valida: false, motivo: "Informe o código de ativação." };
  try {
    const validarFn = httpsCallable(functions, "validarCodigoAtivacaoBackend");
    const resposta = await validarFn({ codigo: codigoFormatado });
    const dados = resposta.data as { valida?: boolean; licenca?: Licenca };
    if (!dados?.valida || !dados.licenca) {
      return { valida: false, motivo: "Link de ativação inválido ou inexistente." };
    }
    return { valida: true, licenca: dados.licenca };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Não foi possível validar o código no servidor.";
    return { valida: false, motivo: message.replace(/^functions\/[a-z-]+:\s*/i, "") };
  }
}

/**
 * Executa a queima atômica (Burn-After-Reading) da licença, arquivamento definitivo
 * em JSON no 'arquivo_morto_licencas', remoção de 'concessoes' e criação da instância do restaurante
 * por Cloud Function autenticada, garantindo anti-race condition e uso único estrito.
 */
export async function ativarLicencaEInstanciaAtomica(params: {
  codigo: string;
  ownerUid: string;
  restauranteNome: string;
  slug: string;
  modoOperacao?: "com_garcom" | "hibrido" | "balcao";
  termsAcceptedAt?: string;
  termsVersion?: string;
}): Promise<Restaurante> {
  const codigoFormatado = params.codigo.trim().toUpperCase();
  if (!codigoFormatado) throw new Error("Código de ativação obrigatório.");
  const ativarFn = httpsCallable(functions, "ativarInstanciaBackend");
  const resposta = await ativarFn({
    codigo: codigoFormatado,
    slug: params.slug.trim().toLowerCase(),
    restauranteNome: params.restauranteNome.trim(),
    modoOperacao: params.modoOperacao || "hibrido",
    termsAcceptedAt: params.termsAcceptedAt,
    termsVersion: params.termsVersion,
  });
  const dados = resposta.data as Record<string, unknown>;
  const { _tipoAtivacao: _tipoAtivacao, ...restaurante } = dados;
  removerLicencaLocal(codigoFormatado);
  return restaurante as unknown as Restaurante;
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

  await updateDoc(doc(db, "concessoes", codigoFormatado), { status: novoStatus });
  const locais = obterLicencasLocais();
  const atualizadas = locais.map((l) => (l.id === codigoFormatado ? { ...l, status: novoStatus } : l));
  if (typeof window !== "undefined") {
    localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(atualizadas));
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
    await updateDoc(restRef, {
      suspenso,
      "configuracoes.suspenso": suspenso,
      atualizadoEm: serverTimestamp(),
    });
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

  const restRef = doc(db, "restaurantes", restauranteId);
  const patchRest = {
    plano: novoPlano,
    maxMesas: novosLimites.maxMesas,
    maxPratos: novosLimites.maxPratos,
    licenca: { plano: novoPlano, limites: novosLimites },
    atualizadoEm: serverTimestamp(),
  };

  if (licencaCodigo) {
    const codigoFormatado = licencaCodigo.trim().toUpperCase();
    const licRef = doc(db, "concessoes", codigoFormatado);
    await runTransaction(db, async (tx) => {
      const [restSnap, licSnap] = await Promise.all([tx.get(restRef), tx.get(licRef)]);
      if (!restSnap.exists()) throw new Error("Restaurante não encontrado; plano não alterado.");
      tx.update(restRef, patchRest);
      // Concessões já consumidas/arquivadas não são reescritas. Se ainda existir, sincroniza.
      if (licSnap.exists()) {
        if (licSnap.data().status !== "disponivel") {
          throw new Error("A concessão vinculada não está disponível para alteração.");
        }
        tx.update(licRef, {
          plano: novoPlano,
          limites: novosLimites,
          atualizadoEm: serverTimestamp(),
        });
      }
    });
    const locais = obterLicencasLocais();
    const atualizadas = locais.map((l) =>
      l.id === codigoFormatado ? { ...l, plano: novoPlano, limites: novosLimites } : l
    );
    if (typeof window !== "undefined") localStorage.setItem("mayamenu_concessoes_locais", JSON.stringify(atualizadas));
  } else {
    await updateDoc(restRef, patchRest);
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

  // O servidor confirma a renovação antes de atualizar qualquer cache local.
  await updateDoc(doc(db, "concessoes", codigoFormatado), {
    expiracaoEm: novaExpiracao,
    status: "disponivel",
  });

  // Atualiza localmente
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
  const licencaRef = doc(db, "concessoes", codigoFormatado);
  const arquivoRef = doc(db, "arquivo_morto_licencas", codigoFormatado);

  await runTransaction(db, async (tx) => {
    const [licSnap, arquivoSnap] = await Promise.all([tx.get(licencaRef), tx.get(arquivoRef)]);
    if (!licSnap.exists()) {
      if (arquivoSnap.exists()) return; // Revogação já arquivada: idempotente.
      throw new Error("Concessão não encontrada para revogação.");
    }
    if (arquivoSnap.exists()) throw new Error("Já existe um registro imutável para esta concessão.");
    const licenca = licSnap.data() as Licenca;
    if (licenca.status === "utilizada") {
      throw new Error("Concessão já consumida; não pode ser revogada como disponível.");
    }
    const dadosLicenca: Licenca = { ...licenca, status: "revogada" };
    const arquivo: LicencaArquivada = {
      id: codigoFormatado,
      codigo: codigoFormatado,
      arquivadoEm: serverTimestamp(),
      motivo: "revogada_manual",
      restauranteId: licenca.restauranteId || "nao_ativada",
      restauranteNome: licenca.restauranteNome || licenca.responsavel || "Licença revogada sem uso",
      slug: licenca.slug || "",
      ownerId: licenca.ownerId || "",
      snapshotJson: JSON.stringify(dadosLicenca),
      dadosLicenca,
    };
    tx.set(arquivoRef, arquivo);
    tx.delete(licencaRef);
  });

  // Remove do cache local somente após confirmação da transação no servidor.
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

  await runTransaction(db, async (tx) => {
    const [licSnap, arquivoSnap] = await Promise.all([
      tx.get(licencaRef),
      tx.get(arquivoMortoRef),
    ]);
    if (!licSnap.exists()) {
      if (arquivoSnap.exists()) return; // repetição idempotente já arquivada
      throw new Error("Concessão não encontrada; arquivo morto não foi criado.");
    }
    if (arquivoSnap.exists()) {
      throw new Error("Já existe arquivo morto para esta concessão; operação interrompida.");
    }
    const atual = licSnap.data() as Licenca;
    if (!["disponivel", "utilizada"].includes(atual.status)) {
      throw new Error("Somente concessões elegíveis podem ser arquivadas.");
    }
    if (atual.plano !== dadosConsolidados.plano) {
      throw new Error("Plano divergente entre concessão e arquivo morto.");
    }
    tx.set(arquivoMortoRef, {
      ...arquivoMortoDoc,
      dadosLicenca: { ...atual, status: "revogada" },
      snapshotJson: JSON.stringify({ ...atual, status: "revogada" }, null, 2),
    });
    tx.delete(licencaRef);
  });

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
