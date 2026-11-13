/**
 * Testes das Cloud Functions financeiras de salão contra o Firestore Emulator REAL
 * (transações otimistas, concorrência e idempotência reais, sem fake em memória).
 * Executado via `firebase emulators:exec` (ver script "test" do package.json).
 */
const assert = require("assert");

process.env.MESA_SESSION_SECRET = "segredo-super-forte-de-teste-mayamenu-32bytes-ok";

const admin = require("../functions/node_modules/firebase-admin");
const { _internal } = require("../functions/index.js");
const { executarFecharComanda, executarLiberarMesa, executarDefinirTaxaServicoMesa, executarDesativarMesa, executarChamarGarcom } = _internal;
const crypto = require("crypto");

let passed = 0;
let failed = 0;
async function runTest(name, fn) {
  try {
    await fn();
    console.log(`[PASSOU] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FALHOU] ${name}`);
    console.error(err);
    failed++;
  }
}

async function seed(db, mesa, clienteId) {
  const rest = db.doc("restaurantes/rest_e");
  await rest.set({ nome: "Rest Emulador", slug: "rest-e", ownerId: "owner_e" });
  await rest.collection("equipe").doc("garcom_e").set({ role: "garcom", ativo: true });
  await rest.collection("equipe").doc("garcom_off").set({ role: "garcom", ativo: false });
  const comanda = rest.collection("mesas").doc(String(mesa)).collection("comandas_abertas").doc(clienteId);
  await comanda.set({ id: clienteId, restauranteId: "rest_e", status: "aguardando_pratos", subtotal: 30, criadoEm: new Date() });
  for (const [pid, sub] of [["p1", 10], ["p2", 20]]) {
    await comanda.collection("pedidos").doc(pid).set({ id: pid, restauranteId: "rest_e", clienteId, subtotal: sub, status: "pronto" });
    await rest.collection("kds_tickets").doc(pid).set({ id: pid, status: "pronto" });
  }
  return { rest, comanda };
}

async function main() {
  const db = admin.firestore();
  const base = { restauranteId: "rest_e" };

  await runTest("Emulador: fechamento concorrente (8 chamadas) altera uma única vez", async () => {
    const { comanda } = await seed(db, 1, "cli_a");
    const args = [db, "garcom_e", {}, { ...base, mesa: 1, clienteId: "cli_a" }];
    const res = await Promise.all(Array.from({ length: 8 }, () => executarFecharComanda(...args)));
    assert.strictEqual(res.filter((r) => r.idempotente === false).length, 1);
    assert.strictEqual(res.filter((r) => r.idempotente === true).length, 7);
    const c = (await comanda.get()).data();
    assert.strictEqual(c.status, "pago");
    assert.strictEqual((await comanda.collection("pedidos").doc("p1").get()).data().status, "pago");
  });

  await runTest("Emulador: liberação concorrente (8 chamadas) gera um histórico e uma métrica", async () => {
    const { rest, comanda } = await seed(db, 2, "cli_b");
    await executarFecharComanda(db, "garcom_e", {}, { ...base, mesa: 2, clienteId: "cli_b" });
    const args = [db, "garcom_e", {}, { ...base, mesa: 2, comandasIds: ["cli_b"] }];
    const res = await Promise.all(Array.from({ length: 8 }, () => executarLiberarMesa(...args)));
    assert.strictEqual(res.filter((r) => r.idempotente === false).length, 1);
    const hist = await rest.collection("historico_sessoes_mesas").where("mesa", "==", 2).get();
    assert.strictEqual(hist.size, 1);
    assert.strictEqual(hist.docs[0].data().subtotalTotal, 30);
    const metricas = await rest.collection("metricas_consolidadas").get();
    assert.strictEqual(metricas.size, 1);
    assert.strictEqual(metricas.docs[0].data().totalSessoes, 1);
    assert.strictEqual(metricas.docs[0].data().totalFaturado, 30);
    assert.strictEqual((await comanda.collection("pedidos").get()).size, 0);
    assert.strictEqual((await rest.collection("kds_tickets").doc("p1").get()).exists, false);
    assert.ok((await comanda.get()).data().historicoSessaoId);
  });

  await runTest("Emulador: RBAC, taxa em comanda paga e comanda inexistente são rejeitados", async () => {
    await seed(db, 3, "cli_c");
    await assert.rejects(() => executarFecharComanda(db, "garcom_off", {}, { ...base, mesa: 3, clienteId: "cli_c" }));
    await assert.rejects(() => executarLiberarMesa(db, "intruso", {}, { ...base, mesa: 3, comandasIds: ["cli_c"] }));
    await executarFecharComanda(db, "garcom_e", {}, { ...base, mesa: 3, clienteId: "cli_c" });
    await assert.rejects(
      () => executarDefinirTaxaServicoMesa(db, "garcom_e", {}, { ...base, mesa: 3, comandasIds: ["cli_c"], ativa: true }),
      /encerrada/i
    );
    await assert.rejects(
      () => executarFecharComanda(db, "garcom_e", {}, { ...base, mesa: 3, clienteId: "nao_existe" }),
      /não encontrada/i
    );
  });

  await runTest("Emulador: chamadas mistas concorrentes (autorizados, intrusos, inativo, outro restaurante, outra mesa)", async () => {
    const { rest, comanda } = await seed(db, 4, "cli_d");
    await db.doc("restaurantes/rest_outro").set({ nome: "Outro", slug: "outro", ownerId: "owner_outro" });
    await db.doc("restaurantes/rest_outro/equipe/garcom_outro").set({ role: "garcom", ativo: true });

    const fechar = (uid, restauranteId, mesa) =>
      executarFecharComanda(db, uid, {}, { restauranteId, mesa, clienteId: "cli_d" });
    const chamadas = [
      ...Array.from({ length: 4 }, () => fechar("garcom_e", "rest_e", 4)),
      ...Array.from({ length: 2 }, () => fechar("intruso", "rest_e", 4)),
      fechar("garcom_off", "rest_e", 4),
      fechar("garcom_outro", "rest_e", 4), // garçom de outro restaurante
      fechar("garcom_e", "rest_e", 5), // mesa errada: comanda não existe lá
      fechar("garcom_e", "rest_outro", 4), // restaurante errado para o garçom
    ];
    const r = await Promise.allSettled(chamadas);
    const ok = r.slice(0, 4);
    assert.ok(ok.every((x) => x.status === "fulfilled"));
    assert.strictEqual(ok.filter((x) => x.value.idempotente === false).length, 1);
    assert.ok(r.slice(4).every((x) => x.status === "rejected"), "chamadas não autorizadas/inválidas devem ser rejeitadas");
    assert.strictEqual((await comanda.get()).data().status, "pago");

    // Após a operação concluída, chamadas não autorizadas continuam rejeitadas (sem resposta idempotente)
    await assert.rejects(() => fechar("intruso", "rest_e", 4), /vínculo operacional/i);
    await assert.rejects(() => fechar("garcom_off", "rest_e", 4), /inativo/i);
    await assert.rejects(() => fechar("garcom_outro", "rest_e", 4), /vínculo operacional/i);
    const lib = (uid) => executarLiberarMesa(db, uid, {}, { restauranteId: "rest_e", mesa: 4, comandasIds: ["cli_d"] });
    const liberacoes = await Promise.allSettled([lib("garcom_e"), lib("intruso"), lib("garcom_e"), lib("garcom_off")]);
    assert.strictEqual(liberacoes[0].status, "fulfilled");
    assert.strictEqual(liberacoes[2].status, "fulfilled");
    assert.strictEqual(liberacoes[1].status, "rejected");
    assert.strictEqual(liberacoes[3].status, "rejected");
    await assert.rejects(() => lib("intruso"), /vínculo operacional/i);
    assert.strictEqual((await rest.collection("historico_sessoes_mesas").where("mesa", "==", 4).get()).size, 1);
  });

  await runTest("Emulador: liberarMesaBackend rejeita comanda não paga", async () => {
    await seed(db, 7, "cli_nao_pago");
    await assert.rejects(
      () => executarLiberarMesa(db, "garcom_e", {}, { ...base, mesa: 7, comandasIds: ["cli_nao_pago"] }),
      /precisa estar paga/i
    );
    const snap = await db.doc("restaurantes/rest_e/mesas/7/comandas_abertas/cli_nao_pago").get();
    assert.strictEqual(snap.data().status, "aguardando_pratos");
    assert.strictEqual(snap.data().pagoEm, undefined);
  });

  await runTest("Emulador: chamado de garçom exige QR válido e aplica cooldown no servidor", async () => {
    const { rest } = await seed(db, 8, "cliente_qr");
    const qr = "qr-credencial-fisica-de-teste-123456";
    await rest.collection("mesas").doc("8").set({
      ativa: true,
      statusEstrutural: "livre",
      qrCredencialHash: crypto.createHash("sha256").update(qr).digest("hex"),
      qrVersao: 1,
    }, { merge: true });
    await assert.rejects(
      () => executarChamarGarcom(db, "cliente_qr", { ...base, mesa: 8, qrCredencial: "qr-invalido-123456789" }),
      /QR Code inválido/i
    );
    const resultado = await executarChamarGarcom(db, "cliente_qr", {
      ...base, mesa: 8, qrCredencial: qr, nomeCliente: "Cliente teste", motivo: "Atendimento",
    });
    assert.strictEqual(resultado.sucesso, true);
    const comanda = await rest.collection("mesas").doc("8").collection("comandas_abertas").doc("cliente_qr").get();
    assert.strictEqual(comanda.data().chamadoGarcom.ativo, true);
    await assert.rejects(
      () => executarChamarGarcom(db, "cliente_qr", { ...base, mesa: 8, qrCredencial: qr }),
      /Aguarde/i
    );
  });

  await runTest("Emulador: desativação detecta KDS legado em numeroMesa string", async () => {
    const { rest } = await seed(db, 9, "cli_kds_legado");
    await rest.collection("mesas").doc("9").set({
      numero: 9, ativa: true, statusEstrutural: "livre", qrVersao: 1,
    });
    await executarFecharComanda(db, "garcom_e", {}, { ...base, mesa: 9, clienteId: "cli_kds_legado" });
    await rest.collection("kds_tickets").doc("ticket_legado_9").set({
      mesa: "outra-representacao",
      numeroMesa: "9",
      status: "pronto",
    });
    await assert.rejects(
      () => executarDesativarMesa(db, "owner_e", {}, { ...base, mesa: 9 }),
      /tickets ativos na cozinha/i
    );
  });

  await runTest("Emulador: desativarMesaBackend bloqueia com comanda/ticket ativo e desativa mesa livre", async () => {
    const { rest } = await seed(db, 6, "cli_m6");
    await rest.collection("mesas").doc("6").set({
      numero: 6,
      ativa: true,
      statusEstrutural: "livre",
      qrCredencialHash: "hash-inicial",
      qrVersao: 2,
    });

    // Garçom comum não pode desativar mesa (apenas owner/admin)
    await assert.rejects(() => executarDesativarMesa(db, "garcom_e", {}, { ...base, mesa: 6 }), /permissão/i);

    // Com comanda aberta, dono não pode desativar mesa
    await assert.rejects(() => executarDesativarMesa(db, "owner_e", {}, { ...base, mesa: 6 }), /comandas abertas/i);

    // Fechamento explícito registra o pagamento antes da liberação.
    await executarFecharComanda(db, "garcom_e", {}, { ...base, mesa: 6, clienteId: "cli_m6" });
    await executarLiberarMesa(db, "garcom_e", {}, { ...base, mesa: 6, comandasIds: ["cli_m6"] });

    // Agora o dono consegue desativar logicamente
    const d1 = await executarDesativarMesa(db, "owner_e", {}, { ...base, mesa: 6 });
    assert.strictEqual(d1.idempotente, false);
    const mSnap = await rest.collection("mesas").doc("6").get();
    assert.strictEqual(mSnap.data().ativa, false);
    assert.strictEqual(mSnap.data().statusEstrutural, "inativa");
    assert.strictEqual(mSnap.data().qrCredencialHash, undefined);
    assert.strictEqual(mSnap.data().qrVersao, 3);

    // Chamada repetida é idempotente
    const d2 = await executarDesativarMesa(db, "owner_e", {}, { ...base, mesa: 6 });
    assert.strictEqual(d2.idempotente, true);
  });

  console.log("\n=================================================");
  console.log(`Relatório Final (Functions no Emulator): ${passed} Passaram | ${failed} Falharam`);
  console.log("=================================================");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});

