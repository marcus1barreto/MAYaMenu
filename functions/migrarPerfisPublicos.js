/**
 * Migração pontual dos perfis públicos minimizados dos restaurantes já existentes.
 * Executar após deploy de sincronizarPerfilPublicoRestaurante:
 *   node functions/migrarPerfisPublicos.js
 * Usa Application Default Credentials (gcloud auth application-default login)
 * ou GOOGLE_APPLICATION_CREDENTIALS apontando para uma chave de serviço protegida.
 */
const admin = require("firebase-admin");
const {
  getFirestore,
  FieldPath,
  FieldValue,
} = require("firebase-admin/firestore");

const PROJECT_ID = process.env.MAYAMENU_PROJECT_ID || "mayaranas-8ad9f";
if (PROJECT_ID !== "mayaranas-8ad9f") {
  throw new Error(`Projeto inesperado para migração: ${PROJECT_ID}`);
}
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
// O frontend e as Cloud Functions usam exclusivamente o banco nomeado mayamenu-bd.
const db = getFirestore("mayamenu-bd");

async function main() {
  let cursor = null;
  let total = 0;
  let gravados = 0;
  let preservados = 0;
  do {
    let q = db.collection("restaurantes").orderBy(FieldPath.documentId()).limit(400);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const cfg = data.configuracoes || {};
      const configuracoes = {};
      for (const key of ["corPrimaria", "tema", "logoUrl", "capaUrl", "modoOperacao", "modoFilaKds", "taxaServico"]) {
        if (cfg[key] !== undefined) configuracoes[key] = cfg[key];
      }
      const tipoChavePix = String(cfg.pixConfig?.tipoChave || "").toLowerCase();
      const chavePix = String(cfg.pixConfig?.chave || "").trim();
      if (cfg.pixConfig?.ativo === true
          && ["cpf", "cnpj", "telefone", "email", "aleatoria"].includes(tipoChavePix)
          && chavePix.length > 0 && chavePix.length <= 256) {
        configuracoes.pixConfig = {
          chave: chavePix,
          tipoChave: tipoChavePix,
          beneficiario: String(cfg.pixConfig.beneficiario || "").slice(0, 25),
          cidade: String(cfg.pixConfig.cidade || "").slice(0, 15),
          ativo: true,
        };
      }

      const sourceUpdatedAt = docSnap.updateTime.toDate().toISOString();
      const perfilRef = db.collection("restaurantes_publicos").doc(docSnap.id);
      // Transação por perfil impede que a migração sobrescreva uma versão mais nova
      // que já tenha sido publicada pelo trigger enquanto a paginação está em curso.
      const gravou = await db.runTransaction(async (tx) => {
        const atualSnap = await tx.get(perfilRef);
        const versaoAtual = atualSnap.exists
          ? String(atualSnap.data()?.sourceUpdatedAt || "")
          : "";
        if (versaoAtual && versaoAtual > sourceUpdatedAt) return false;
        tx.set(perfilRef, {
          restauranteId: docSnap.id,
          slug: String(data.slug || docSnap.id),
          nome: String(data.nome || "Restaurante"),
          suspenso: data.suspenso === true || cfg.suspenso === true,
          configuracoes,
          atualizadoEm: FieldValue.serverTimestamp(),
          sourceUpdatedAt,
        }, { merge: false });
        return true;
      });
      total++;
      if (gravou) gravados++;
      else preservados++;
    }
    cursor = snap.docs[snap.docs.length - 1];
    process.stdout.write(`Perfis processados: ${total} (gravados: ${gravados}; versão mais nova preservada: ${preservados})\\n`);
  } while (cursor);
  process.stdout.write(`Migração concluída: ${total} perfis verificados; ${gravados} gravados e ${preservados} preservados.\\n`);
}

main().catch((err) => {
  console.error("Falha na migração de perfis públicos:", err);
  process.exitCode = 1;
});
