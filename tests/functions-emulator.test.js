/**
 * Testes das Cloud Functions financeiras de salão contra o Firestore Emulator REAL
 * (transações otimistas, concorrência e idempotência reais, sem fake em memória).
 * Executado via `firebase emulators:exec` (ver script "test" do package.json).
 */
const assert = require("assert");

process.env.MESA_SESSION_SECRET = "segredo-super-forte-de-teste-mayamenu-32bytes-ok";

const admin = require("../functions/node_modules/firebase-admin");
const { _internal } = require("../functions/index.js");
const {
  executarFecharComanda, executarLiberarMesa, executarDefinirTaxaServicoMesa,
  executarDesativarMesa, executarChamarGarcom, executarGarantirCredencialMesa,
  executarEmissaoSessaoMesa, executarValidarCodigoAtivacao,
  executarAtivarInstancia, executarAtivarPatrocinio, executarProcessarSelloutOutbox,
  executarSincronizarPerfilPublicoRestaurante, executarLancamentoPedidoGarcom,
  executarValidarCodigoAtivacaoComRateLimit, executarValidarSessaoPatrocinador,
} = _internal;
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

  await runTest("Emulador: IDs de mesa são numéricos, limitados e canônicos", async () => {
    const normalizar = _internal.normalizarMesaIdentificador;
    assert.deepStrictEqual(normalizar("08"), { mesaId: "8", numero: 8, original: "08" });
    assert.deepStrictEqual(normalizar(12), { mesaId: "12", numero: 12, original: "12" });
    assert.throws(() => normalizar("0"), /Número de mesa inválido/i);
    assert.throws(() => normalizar("1/2"), /Número de mesa inválido/i);
    assert.throws(() => normalizar("100000"), /Número de mesa inválido/i);
  });

  await runTest("Emulador: autenticação de equipe nunca aceita papel enviado pelo cliente", async () => {
    const validar = _internal.validarMembroEquipeParaLogin;
    assert.strictEqual(validar({ uid: "garcom_1", role: "garcom", ativo: true }, "garcom_1"), true);
    assert.strictEqual(validar({ uid: "cozinha_1", role: "cozinha" }, "cozinha_1"), true);
    assert.strictEqual(validar({ uid: "intruso", role: "owner" }, "intruso"), false);
    assert.strictEqual(validar({ uid: "garcom_1", role: "garcom", ativo: false }, "garcom_1"), false);
    assert.strictEqual(validar({ uid: "uid_diferente", role: "garcom" }, "doc_membro"), false);
    assert.strictEqual(validar({ uid: "garcom_1", role: "admin" }, "garcom_1"), false);
  });

  await runTest("Emulador: pedido de garçom preserva origem patrocinada e rejeita produto inativo", async () => {
    const rest = db.doc("restaurantes/rest_e");
    await rest.set({ nome: "Rest Emulador", slug: "rest-e", ownerId: "owner_e" }, { merge: true });
    await rest.collection("equipe").doc("garcom_e").set({ role: "garcom", ativo: true });
    await rest.collection("mesas").doc("12").set({ ativa: true, statusEstrutural: "livre" });
    await rest.collection("cardapio").doc("spn-item").set({
      nome: "Produto Patrocinado", precoBase: 8, ativo: true,
      origemPatrocinadorId: "spn_sellout_test",
    });
    await rest.collection("cardapio").doc("item-inativo").set({
      nome: "Produto Inativo", precoBase: 5, ativo: false,
    });
    const resultado = await executarLancamentoPedidoGarcom(db, "garcom_e", {}, {
      restauranteId: "rest_e", pedidoId: "pedido_spn_12", mesa: 12,
      clienteId: "cli_spn_12", nomeCliente: "Cliente",
      itens: [{ menuItemId: "spn-item", quantidade: 2 }],
    });
    assert.strictEqual(resultado.sucesso, true);
    const pedido = await rest.collection("mesas").doc("12")
      .collection("comandas_abertas").doc("cli_spn_12")
      .collection("pedidos").doc("pedido_spn_12").get();
    assert.strictEqual(pedido.data().itens[0].origemPatrocinadorId, "spn_sellout_test");
    await assert.rejects(() => executarLancamentoPedidoGarcom(db, "garcom_e", {}, {
      restauranteId: "rest_e", pedidoId: "pedido_inativo_12", mesa: 12,
      clienteId: "cli_spn_12", nomeCliente: "Cliente",
      itens: [{ menuItemId: "item-inativo", quantidade: 1 }],
    }), /indisponível/i);
    await rest.collection("mesas").doc("14").set({ ativa: true, statusEstrutural: "inativa" });
    await assert.rejects(() => executarLancamentoPedidoGarcom(db, "garcom_e", {}, {
      restauranteId: "rest_e", pedidoId: "pedido_mesa_inativa", mesa: 14,
      clienteId: "cli_mesa_inativa", nomeCliente: "Cliente",
      itens: [{ menuItemId: "spn-item", quantidade: 1 }],
    }), /inativa ou bloqueada/i);
    await assert.rejects(() => executarLancamentoPedidoGarcom(db, "garcom_e", {}, {
      restauranteId: "rest_e", pedidoId: "pedido_mesa_inexistente", mesa: 15,
      clienteId: "cli_mesa_inexistente", nomeCliente: "Cliente",
      itens: [{ menuItemId: "spn-item", quantidade: 1 }],
    }), /Mesa não cadastrada/i);
  });

  await runTest("Emulador: fechamento gera outbox sell-out idempotente e métricas confiáveis", async () => {
    const { rest, comanda } = await seed(db, 13, "cli_sellout");
    await comanda.collection("pedidos").doc("p1").update({
      itens: [{
        menuItemId: "spn-bierhaus-item", nome: "Produto BierHaus",
        quantidade: 2, precoFinal: 10, origemPatrocinadorId: "spn_bierhaus",
      }],
    });
    await executarFecharComanda(db, "garcom_e", {}, {
      ...base, mesa: 13, clienteId: "cli_sellout",
    });
    const outboxes = await rest.collection("_sellout_outbox")
      .where("comandaId", "==", "cli_sellout").get();
    assert.strictEqual(outboxes.size, 1);
    const outbox = outboxes.docs[0];
    const eventId = outbox.id;
    assert.strictEqual(outbox.exists, true);
    assert.strictEqual(outbox.data().itens[0].quantidade, 2);
    await executarProcessarSelloutOutbox(db, "rest_e", eventId);
    const metric = await db.doc("patrocinadores/spn_bierhaus/metricas_sellout/bierhaus-item").get();
    assert.strictEqual(metric.data().totalUnidadesVendidas, 2);
    assert.strictEqual(metric.data().faturamentoTotalEstimado, 20);
    await executarProcessarSelloutOutbox(db, "rest_e", eventId);
    const metricRetry = await db.doc("patrocinadores/spn_bierhaus/metricas_sellout/bierhaus-item").get();
    assert.strictEqual(metricRetry.data().totalUnidadesVendidas, 2);
    assert.strictEqual((await outbox.ref.get()).data().processado, true);
  });

  await runTest("Emulador: perfil público do restaurante expõe apenas campos permitidos e é removido ao excluir raiz", async () => {
    await executarSincronizarPerfilPublicoRestaurante(db, "rest_publico_teste", {
      ownerId: "uid-privado",
      nome: "Restaurante Público",
      slug: "restaurante-publico",
      plano: "enterprise",
      licenca: { id: "MAYA-SEGREDO", plano: "enterprise" },
      assinatura: { contrato: "privado" },
      equipe: { pinHash: "nao-publicar" },
      qrCredencialHash: "nao-publicar",
      configuracoes: {
        corPrimaria: "#123456",
        tema: "dark",
        modoOperacao: "hibrido",
        suspenso: false,
        pixConfig: {
          ativo: true, chave: "pix@restaurante.com", tipoChave: "email",
          beneficiario: "Restaurante", cidade: "Fortaleza",
          tokenPrivado: "nao-publicar",
        },
      },
    });
    const publicoRef = db.doc("restaurantes_publicos/rest_publico_teste");
    const publico = (await publicoRef.get()).data();
    assert.strictEqual(publico.nome, "Restaurante Público");
    assert.strictEqual(publico.ownerId, undefined);
    assert.strictEqual(publico.plano, undefined);
    assert.strictEqual(publico.licenca, undefined);
    assert.strictEqual(publico.assinatura, undefined);
    assert.strictEqual(publico.qrCredencialHash, undefined);
    assert.strictEqual(publico.configuracoes.pixConfig.chave, "pix@restaurante.com");
    assert.strictEqual(publico.configuracoes.pixConfig.tokenPrivado, undefined);
    await executarSincronizarPerfilPublicoRestaurante(db, "rest_publico_teste", null);
    assert.strictEqual((await publicoRef.get()).exists, false);
  });

  await runTest("Emulador: validação de licença não exige leitura pública e retorna apenas dados mínimos", async () => {
    await db.doc("concessoes/MAYA-TESTE-01").set({
      status: "disponivel", plano: "pro",
      limites: { maxMesas: 30, maxPratos: 60, maxItensMenu: 60, segredoInterno: "não publicar" },
      responsavel: "Restaurante teste",
      notas: "Nota administrativa confidencial",
      contratoPrivado: "não publicar",
    });
    const validacao = await executarValidarCodigoAtivacao(db, { codigo: "maya-teste-01" });
    assert.strictEqual(validacao.valida, true);
    assert.strictEqual(validacao.licenca.id, "MAYA-TESTE-01");
    assert.strictEqual(validacao.licenca.plano, "pro");
    assert.strictEqual(validacao.licenca.ownerUid, undefined);
    assert.strictEqual(validacao.licenca.notas, undefined);
    assert.strictEqual(validacao.licenca.contratoPrivado, undefined);
    assert.strictEqual(validacao.licenca.limites.segredoInterno, undefined);
  });

  await runTest("Emulador: sessão B2B valida status/versão e nunca retorna a chave de acesso", async () => {
    await db.doc("patrocinadores/pat_sessao").set({
      ativo: true, authVersion: 4, chaveAcessoB2B: "SPN-SEGREDO-QUE-NAO-PODE-RETORNAR",
      nomeFantasia: "Patrocinador Sessão",
    });
    const claims = _internal.criarClaimsSessaoPatrocinador("pat_sessao", { authVersion: 4 });
    assert.deepStrictEqual(claims, {
      role: "sponsor", patrocinadorId: "pat_sessao", authVersion: 4,
    });
    assert.throws(
      () => _internal.criarClaimsSessaoPatrocinador("pat_sessao", { authVersion: -1 }),
      /Versão de autenticação B2B inválida/i
    );
    const authContext = {
      uid: "pat_sessao",
      token: claims,
    };
    const validacao = await executarValidarSessaoPatrocinador(db, authContext);
    assert.strictEqual(validacao.patrocinador.id, "pat_sessao");
    assert.strictEqual(validacao.patrocinador.chaveAcessoB2B, "");
    await assert.rejects(
      () => executarValidarSessaoPatrocinador(db, {
        ...authContext, token: { ...authContext.token, authVersion: 3 },
      }),
      /revogada/i
    );
    await db.doc("patrocinadores/pat_sessao").update({ ativo: false, authVersion: 5 });
    await assert.rejects(() => executarValidarSessaoPatrocinador(db, authContext), /revogada/i);
  });

  await runTest("Emulador: validação pública de voucher bloqueia enumeração após falhas por IP/código", async () => {
    const rawRequest = {
      ip: "198.51.100.44",
      headers: { "x-forwarded-for": "198.51.100.44" },
    };
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await assert.rejects(
        () => executarValidarCodigoAtivacaoComRateLimit(db, { codigo: "MAYA-NAO-EXISTE-01" }, rawRequest),
        /inválido|não encontrada/i
      );
    }
    await assert.rejects(
      () => executarValidarCodigoAtivacaoComRateLimit(db, { codigo: "MAYA-NAO-EXISTE-01" }, rawRequest),
      /tentativas|aguarde|bloquead/i
    );
  });

  await runTest("Emulador: ativação de licença rejeita sessão anônima sem consumir concessão", async () => {
    await db.doc("concessoes/MAYA-ANON-01").set({
      status: "disponivel", plano: "free",
      limites: { maxMesas: 10, maxPratos: 20 },
    });
    await assert.rejects(
      () => executarAtivarInstancia(db, "uid_anon_01", {
        firebase: { sign_in_provider: "anonymous" },
      }, {
        codigo: "MAYA-ANON-01", slug: "anon-rest-01", restauranteNome: "Restaurante Anônimo",
      }),
      /conta permanente/i
    );
    assert.strictEqual((await db.doc("concessoes/MAYA-ANON-01").get()).exists, true);
    assert.strictEqual((await db.doc("restaurantes/uid_anon_01").get()).exists, false);
  });

  await runTest("Emulador: ativação de licença comum consome concessão e cria restaurante/slug/arquivo morto atomicamente", async () => {
    await db.doc("concessoes/MAYA-ATOMIC-01").set({
      status: "disponivel", plano: "free",
      limites: { maxMesas: 10, maxPratos: 20, maxItensMenu: 20 },
      expiracaoEm: new Date(Date.now() + 86400000).toISOString(),
    });
    const restaurante = await executarAtivarInstancia(db, "owner_atomic_01", { firebase: { sign_in_provider: "password" } }, {
      codigo: "MAYA-ATOMIC-01", slug: "atomic-rest-01", restauranteNome: "Atomic Restaurante",
      modoOperacao: "hibrido",
    });
    assert.strictEqual(restaurante.ownerId, "owner_atomic_01");
    assert.strictEqual(restaurante.plano, "free");
    assert.strictEqual((await db.doc("concessoes/MAYA-ATOMIC-01").get()).exists, false);
    assert.strictEqual((await db.doc("arquivo_morto_licencas/MAYA-ATOMIC-01").get()).exists, true);
    assert.strictEqual((await db.doc("slugs/atomic-rest-01").get()).data().ownerId, "owner_atomic_01");
    const perfilPublico = await db.doc("restaurantes_publicos/owner_atomic_01").get();
    assert.strictEqual(perfilPublico.exists, true);
    assert.strictEqual(perfilPublico.data().nome, "Atomic Restaurante");
    assert.strictEqual(perfilPublico.data().ownerId, undefined);
    assert.strictEqual(perfilPublico.data().licenca, undefined);
    await assert.rejects(() => executarAtivarInstancia(db, "owner_atomic_02", { firebase: { sign_in_provider: "password" } }, {
      codigo: "MAYA-ATOMIC-01", slug: "atomic-rest-02", restauranteNome: "Outro Restaurante",
    }));
  });

  await runTest("Emulador: ativação rejeita slug já usado por restaurante legado", async () => {
    await db.doc("restaurantes/legacy_rest").set({
      ownerId: "owner_legacy", slug: "slug-em-uso", nome: "Legado",
    });
    await db.doc("restaurantes_publicos/legacy_rest").set({
      restauranteId: "legacy_rest", slug: "slug-em-uso", nome: "Legado", configuracoes: {},
    });
    await db.doc("concessoes/lic_slug").set({
      id: "lic_slug", codigo: "lic_slug", status: "disponivel", plano: "free",
      limites: { maxMesas: 10, maxPratos: 20 },
      expiracaoEm: new Date(Date.now() + 86400000).toISOString(),
    });
    await assert.rejects(
      () => executarAtivarInstancia(db, "owner_novo", { firebase: { sign_in_provider: "password" } }, {
        codigo: "lic_slug", slug: "slug-em-uso", restauranteNome: "Novo",
      }),
      /endereço público já está em uso/i
    );
    assert.strictEqual((await db.doc("restaurantes/owner_novo").get()).exists, false);
    assert.strictEqual((await db.doc("concessoes/lic_slug").get()).exists, true);
  });

  await runTest("Emulador: voucher B2B ativa PRO, injeta catálogo e consome uma única cota", async () => {
    const patRef = db.doc("patrocinadores/spn_test_b2b");
    await patRef.set({ nomeFantasia: "Marca Teste", ativo: true, slug: "marca-teste" });
    await patRef.collection("catalogo_master").doc("item-obrigatorio").set({
      id: "item-obrigatorio", nome: "Produto Patrocinado", categoriaSugerida: "Bebidas",
      descricaoOficial: "Produto oficial", fotoOficialUrl: "/produto.webp",
      precoSugerido: 12.5, obrigatorioNoCardapio: true, seloPatrocinador: "Parceiro Oficial",
    });
    await patRef.collection("catalogo_master").doc("item-inativo").set({
      id: "item-inativo", nome: "Produto desativado", categoriaSugerida: "Bebidas",
      precoSugerido: 99, ativo: false,
    });
    await patRef.collection("lotes_licencas").doc("lote-test-b2b").set({
      id: "lote-test-b2b", patrocinadorId: "spn_test_b2b", nome: "Lote Teste",
      codigoCampanha: "CAMPANHA-TESTE-01", totalLicencas: 1, licencasAtivadas: 0,
      validadeMeses: 6, dataExpiracao: new Date(Date.now() + 86400000).toISOString(),
      ativo: true, restaurantesVinculados: [],
    });
    const validacao = await executarValidarCodigoAtivacao(db, { codigo: "CAMPANHA-TESTE-01" });
    assert.strictEqual(validacao.tipo, "patrocinio");
    const restaurante = await executarAtivarInstancia(db, "owner_b2b_01", { firebase: { sign_in_provider: "password" } }, {
      codigo: "CAMPANHA-TESTE-01", slug: "b2b-rest-01", restauranteNome: "Restaurante B2B",
    });
    assert.strictEqual(restaurante.plano, "pro");
    assert.strictEqual(restaurante.patrocinio.patrocinadorId, "spn_test_b2b");
    const perfilPublico = await db.doc("restaurantes_publicos/owner_b2b_01").get();
    assert.strictEqual(perfilPublico.exists, true);
    assert.strictEqual(perfilPublico.data().nome, "Restaurante B2B");
    assert.strictEqual(perfilPublico.data().plano, undefined);
    const item = await db.doc("restaurantes/owner_b2b_01/cardapio/spn-item-obrigatorio").get();
    assert.strictEqual(item.exists, true);
    assert.strictEqual(item.data().bloqueadoParaExclusao, true);
    assert.strictEqual((await db.doc("restaurantes/owner_b2b_01/cardapio/spn-item-inativo").get()).exists, false);
    assert.strictEqual((await patRef.collection("lotes_licencas").doc("lote-test-b2b").get()).data().licencasAtivadas, 1);
    await assert.rejects(() => executarAtivarInstancia(db, "owner_b2b_02", { firebase: { sign_in_provider: "password" } }, {
      codigo: "CAMPANHA-TESTE-01", slug: "b2b-rest-02", restauranteNome: "Segundo B2B",
    }));
  });

  await runTest("Emulador: patrocínios adicionais respeitam titularidade, quota e bloqueio de categoria", async () => {
    const restRef = db.doc("restaurantes/owner_multi_b2b");
    await restRef.set({ ownerId: "owner_multi_b2b", nome: "Restaurante Multi", slug: "multi-b2b", plano: "free" });
    const patA = db.doc("patrocinadores/spn_multi_a");
    const patB = db.doc("patrocinadores/spn_multi_b");
    await patA.set({ nomeFantasia: "Marca A", ativo: true });
    await patB.set({ nomeFantasia: "Marca B", ativo: true });
    await patA.collection("catalogo_master").doc("a1").set({
      id: "a1", nome: "Item A", categoriaSugerida: "Bebidas", precoSugerido: 5,
      obrigatorioNoCardapio: true,
    });
    await patA.collection("catalogo_master").doc("a2").set({
      id: "a2", nome: "Item A2", categoriaSugerida: "Alimentos", precoSugerido: 7,
      obrigatorioNoCardapio: true,
    });
    // A segunda marca conflita com a categoria secundária da primeira, não com a principal.
    await patB.collection("catalogo_master").doc("b1").set({
      id: "b1", nome: "Item B", categoriaSugerida: "alimentos", precoSugerido: 6,
      obrigatorioNoCardapio: true,
    });
    for (const [pat, lote, codigo] of [
      [patA, "lote-a", "VOUCHER-MULTI-A"],
      [patB, "lote-b", "VOUCHER-MULTI-B"],
    ]) {
      await pat.collection("lotes_licencas").doc(lote).set({
        id: lote, patrocinadorId: pat.id, nome: lote, codigoCampanha: codigo,
        totalLicencas: 2, licencasAtivadas: 0, validadeMeses: 6,
        dataExpiracao: new Date(Date.now() + 86400000).toISOString(),
        ativo: true, restaurantesVinculados: [],
      });
    }
    await assert.rejects(() => executarAtivarPatrocinio(db, "intruso_multi", {}, {
      restauranteId: restRef.id, codigoVoucher: "VOUCHER-MULTI-A",
    }));
    const primeiro = await executarAtivarPatrocinio(db, "owner_multi_b2b", {}, {
      restauranteId: restRef.id, codigoVoucher: "VOUCHER-MULTI-A",
    });
    assert.strictEqual(primeiro.sucesso, true);
    await assert.rejects(() => executarAtivarPatrocinio(db, "owner_multi_b2b", {}, {
      restauranteId: restRef.id, codigoVoucher: "VOUCHER-MULTI-B",
    }), /categoria/i);
  });

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

  await runTest("Emulador: espelho público ignora eventos antigos e filtra dados Pix", async () => {
    const restauranteId = "rest_public_version";
    const perfilAntigo = {
      slug: "public-version", nome: "Nome antigo",
      configuracoes: { pixConfig: { ativo: true, tipoChave: "api_token", chave: "segredo-interno" } },
    };
    const perfilNovo = {
      slug: "public-version", nome: "Nome novo",
      configuracoes: { pixConfig: { ativo: true, tipoChave: "cpf", chave: "12345678900" } },
    };
    const montar = _internal.montarPerfilPublicoRestaurante;
    const publicoInvalido = montar(restauranteId, perfilAntigo);
    assert.strictEqual(publicoInvalido.configuracoes.pixConfig, undefined);
    const publicoValido = montar(restauranteId, perfilNovo);
    assert.strictEqual(publicoValido.configuracoes.pixConfig.tipoChave, "cpf");
    assert.strictEqual(publicoValido.configuracoes.pixConfig.chave, "12345678900");

    await _internal.executarSincronizarPerfilPublicoRestaurante(db, restauranteId, perfilAntigo, "2026-11-01T00:00:00.000Z");
    await _internal.executarSincronizarPerfilPublicoRestaurante(db, restauranteId, perfilNovo, "2026-11-02T00:00:00.000Z");
    await _internal.executarSincronizarPerfilPublicoRestaurante(db, restauranteId, perfilAntigo, "2026-11-01T00:00:00.000Z");
    await _internal.executarSincronizarPerfilPublicoRestaurante(db, restauranteId, null, "2026-11-01T12:00:00.000Z");
    const perfilFinal = await db.doc(`restaurantes_publicos/${restauranteId}`).get();
    assert.strictEqual(perfilFinal.data().nome, "Nome novo");
  });

  await runTest("Emulador: mesa estruturalmente inativa não emite QR nem inicia sessão", async () => {
    const { rest } = await seed(db, 10, "cli_mesa_inativa");
    const qr = "qr-credencial-mesa-inativa-123456";
    await rest.collection("mesas").doc("10").set({
      numero: 10, ativa: true, statusEstrutural: "inativa",
      qrCredencialHash: crypto.createHash("sha256").update(qr).digest("hex"),
      qrVersao: 3,
    });
    await assert.rejects(
      () => executarGarantirCredencialMesa(db, "owner_e", {}, { ...base, mesa: 10 }),
      /Ative e libere a mesa/i
    );
    await assert.rejects(
      () => executarEmissaoSessaoMesa(db, "cliente_mesa_inativa", {
        ...base, mesa: 10, qrCredencial: qr,
      }),
      /inativa/i
    );
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
    // Trocar o UID anônimo não contorna o limite: o cooldown é aplicado à mesa.
    await assert.rejects(
      () => executarChamarGarcom(db, "cliente_qr_segundo", { ...base, mesa: 8, qrCredencial: qr }),
      /mesa já solicitou atendimento/i
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

  await runTest("Emulador: liberação não contabiliza subtotal legado quando todos os pedidos foram cancelados", async () => {
    const { rest, comanda } = await seed(db, 16, "cli_todos_cancelados");
    const pedidos = await comanda.collection("pedidos").get();
    for (const pedido of pedidos.docs) {
      await pedido.ref.update({ status: "cancelado" });
    }
    const fechado = await executarFecharComanda(db, "garcom_e", {}, {
      ...base, mesa: 16, clienteId: "cli_todos_cancelados",
    });
    assert.strictEqual(fechado.sucesso, true);
    const liberado = await executarLiberarMesa(db, "garcom_e", {}, {
      ...base, mesa: 16, comandasIds: ["cli_todos_cancelados"],
    });
    const historico = await rest.collection("historico_sessoes_mesas").doc(liberado.historicoId).get();
    assert.strictEqual(historico.data().subtotalTotal, 0);
  });

  await runTest("Emulador: desativação rejeita comanda arquivada sem pagamento e paga sem arquivamento", async () => {
    const rest = db.doc("restaurantes/rest_desativacao_inconsistente");
    await rest.set({ ownerId: "owner_desativacao" });
    await rest.collection("mesas").doc("17").set({ ativa: true, statusEstrutural: "livre" });
    await rest.collection("mesas").doc("18").set({ ativa: true, statusEstrutural: "livre" });
    await rest.collection("mesas").doc("17").collection("comandas_abertas").doc("cli_17").set({
      restauranteId: "rest_desativacao_inconsistente", status: "aguardando_pratos",
      arquivada: true, subtotal: 20,
    });
    await rest.collection("mesas").doc("18").collection("comandas_abertas").doc("cli_18").set({
      restauranteId: "rest_desativacao_inconsistente", status: "pago",
      arquivada: false, pagoEm: new Date(), subtotal: 20,
    });
    await assert.rejects(
      () => executarDesativarMesa(db, "owner_desativacao", {}, {
        restauranteId: "rest_desativacao_inconsistente", mesa: 17,
      }),
      /comandas abertas ou não pagas/i
    );
    await assert.rejects(
      () => executarDesativarMesa(db, "owner_desativacao", {}, {
        restauranteId: "rest_desativacao_inconsistente", mesa: 18,
      }),
      /comandas abertas ou não pagas/i
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

