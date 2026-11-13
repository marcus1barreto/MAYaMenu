/**
 * Migração pontual dos perfis públicos minimizados dos restaurantes já existentes.
 * Executar após deploy de sincronizarPerfilPublicoRestaurante:
 *   node functions/migrarPerfisPublicos.js
 * Usa Application Default Credentials (gcloud auth application-default login)
 * ou GOOGLE_APPLICATION_CREDENTIALS apontando para uma chave de serviço protegida.
 */
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

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
  do {
    let q = db.collection("restaurantes").orderBy(FieldPath.documentId()).limit(400);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const cfg = data.configuracoes || {};
      const configuracoes = {};
      for (const key of ["corPrimaria", "tema", "logoUrl", "capaUrl", "modoOperacao", "modoFilaKds", "taxaServico"]) {
        if (cfg[key] !== undefined) configuracoes[key] = cfg[key];
      }
      if (cfg.pixConfig?.ativo === true && cfg.pixConfig.chave && cfg.pixConfig.tipoChave) {
        configuracoes.pixConfig = {
          chave: String(cfg.pixConfig.chave),
          tipoChave: String(cfg.pixConfig.tipoChave),
          beneficiario: String(cfg.pixConfig.beneficiario || "").slice(0, 25),
          cidade: String(cfg.pixConfig.cidade || "").slice(0, 15),
          ativo: true,
        };
      }
      batch.set(db.collection("restaurantes_publicos").doc(docSnap.id), {
        restauranteId: docSnap.id,
        slug: String(data.slug || docSnap.id),
        nome: String(data.nome || "Restaurante"),
        suspenso: data.suspenso === true || cfg.suspenso === true,
        configuracoes,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    total += snap.size;
    cursor = snap.docs[snap.docs.length - 1];
    process.stdout.write(`Perfis sincronizados: ${total}\\n`);
  } while (cursor);
  process.stdout.write(`Migração concluída: ${total} restaurantes.\\n`);
}

main().catch((err) => {
  console.error("Falha na migração de perfis públicos:", err);
  process.exitCode = 1;
});
