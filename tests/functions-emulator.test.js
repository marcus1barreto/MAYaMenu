/**
 * Testes das Cloud Functions financeiras de salão contra o Firestore Emulator REAL
 * (transações otimistas, concorrência e idempotência reais, sem fake em memória).
 * Executado via `firebase emulators:exec` (ver script "test" do package.json).
 */
const assert = require("assert");

process.env.MESA_SESSION_SECRET = "segredo-super-forte-de-teste-mayamenu-32bytes-ok";

const admin = require("../functions/node_modules/firebase-admin");
const { getFirestore } = require("../functions/node_modules/firebase-admin/firestore");
const { _internal } = require("../functions/index.js");
const {
  executarFecharComanda, executarLiberarMesa, executarDefinirTaxaServicoMesa,
  executarDesativarMesa, executarReativarMesa, executarChamarGarcom, executarGarantirCredencialMesa,
  executarEmissaoSessaoMesa, executarValidarCodigoAtivacao,
  executarAtivarInstancia, executarAtivarPatrocinio, executarProcessarSelloutOutbox,
  executarSincronizarPerfilPublicoRestaurante, executarLancamentoPedidoGarcom,
  executarValidarCodigoAtivacaoComRateLimit, executarValidarSessaoPatrocinador,
  validarAssinaturaMercadoPago, validarPagamentoPro, executarProcessarPagamentoProAprovado,
  executarProcessarEstornoPagamentoPro, limitarCriacaoPreferenciaPro,
  executarCriarPreferenciaProBackend, executarMercadoPagoWebhook,
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
  // O backend de produção usa o banco nomeado mayamenu-bd; os testes também.
  const db = getFirestore("mayamenu-bd");
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

  await runTest("Emulador: limita criação de preferências PRO por titular", async () => {
    await limitarCriacaoPreferenciaPro(db, "owner_rate_checkout");
    await limitarCriacaoPreferenciaPro(db, "owner_rate_checkout");
    await limitarCriacaoPreferenciaPro(db, "owner_rate_checkout");
    await assert.rejects(
      () => limitarCriacaoPreferenciaPro(db, "owner_rate_checkout"),
      /muitas tentativas de checkout/i
    );
  });

  await runTest("Mercado Pago: preferência usa preço e URL definidos exclusivamente no servidor", async () => {
    const oldFetch = global.fetch;
    const oldToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const oldAppUrl = process.env.MAYAMENU_APP_URL;
    const oldLiveMode = process.env.MERCADO_PAGO_LIVE_MODE;
    let preferencePayload = null;
    try {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-token-de-integracao";
      process.env.MAYAMENU_APP_URL = "https://app.mayamenu.test";
      process.env.MERCADO_PAGO_LIVE_MODE = "false";
      global.fetch = async (url, options) => {
        assert.strictEqual(url, "https://api.mercadopago.com/checkout/preferences");
        assert.strictEqual(options.headers.Authorization, "Bearer TEST-token-de-integracao");
        preferencePayload = JSON.parse(options.body);
        return new Response(JSON.stringify({
          id: "pref-teste-01",
          init_point: "https://checkout.live.test",
          sandbox_init_point: "https://checkout.sandbox.test",
          collector_id: 12345,
        }), { status: 201, headers: { "content-type": "application/json" } });
      };

      await db.doc("restaurantes/rest_mp_checkout").set({
        ownerId: "owner_mp_checkout",
        nome: "Restaurante Checkout",
        plano: "free",
      });
      const result = await executarCriarPreferenciaProBackend(db, {
        uid: "owner_mp_checkout",
        token: {
          email: "owner@example.test",
          firebase: { sign_in_provider: "password" },
        },
      }, {
        restauranteId: "rest_mp_checkout",
        planoId: "pro_mensal",
        preco: 0.01,
        baseUrl: "https://attacker.example",
      });

      assert.strictEqual(result.sucesso, true);
      assert.strictEqual(result.initPoint, "https://checkout.sandbox.test");
      assert.strictEqual(preferencePayload.items[0].unit_price, 49.90);
      assert.strictEqual(preferencePayload.external_reference, result.attemptId);
      assert.strictEqual(preferencePayload.back_urls.success.startsWith("https://app.mayamenu.test/"), true);
      assert.strictEqual(preferencePayload.back_urls.success.includes("attacker.example"), false);
      assert.strictEqual(preferencePayload.notification_url.includes("cloudfunctions.net/mercadoPagoWebhook"), true);
      assert.strictEqual(preferencePayload.expires, true);
      assert.ok(Date.parse(preferencePayload.expiration_date_to) - Date.parse(preferencePayload.expiration_date_from) >= 71 * 60 * 60 * 1000);
      const attempt = await db.doc(`pagamentos_pro/${result.attemptId}`).get();
      assert.strictEqual(attempt.data().status, "pending");
      assert.strictEqual(attempt.data().valorCentavos, 4990);
      assert.strictEqual(attempt.data().collectorId, "12345");
    } finally {
      global.fetch = oldFetch;
      if (oldToken === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
      else process.env.MERCADO_PAGO_ACCESS_TOKEN = oldToken;
      if (oldAppUrl === undefined) delete process.env.MAYAMENU_APP_URL;
      else process.env.MAYAMENU_APP_URL = oldAppUrl;
      if (oldLiveMode === undefined) delete process.env.MERCADO_PAGO_LIVE_MODE;
      else process.env.MERCADO_PAGO_LIVE_MODE = oldLiveMode;
    }
  });

  await runTest("Mercado Pago: valida assinatura HMAC do webhook e rejeita adulteração", async () => {
    const secret = "segredo-webhook-teste";
    const dataId = "123456789";
    const requestId = "request-teste-001";
    const ts = "1710000000";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    const xSignature = `ts=${ts},v1=${v1}`;
    assert.strictEqual(validarAssinaturaMercadoPago({
      xSignature, xRequestId: requestId, dataId, secret,
    }), true);
    assert.strictEqual(validarAssinaturaMercadoPago({
      xSignature, xRequestId: requestId, dataId: "987654321", secret,
    }), false);
    assert.strictEqual(validarAssinaturaMercadoPago({
      xSignature, xRequestId: requestId, dataId, secret: "segredo-incorreto",
    }), false);
  });

  await runTest("Mercado Pago: exige referência, moeda, valor, ambiente e validade exatos", async () => {
    const attempt = {
      attemptId: "123e4567-e89b-12d3-a456-426614174000",
      valorCentavos: 4990,
      currency: "BRL",
      liveMode: false,
      collectorId: "12345",
      expiraEm: new Date(Date.now() + 60 * 60 * 1000),
    };
    const payment = {
      id: "987654321",
      status: "approved",
      external_reference: attempt.attemptId,
      currency_id: "BRL",
      transaction_amount: 49.90,
      live_mode: false,
      collector_id: "12345",
      date_approved: new Date().toISOString(),
    };
    assert.strictEqual(validarPagamentoPro(attempt, payment), null);
    assert.match(validarPagamentoPro(attempt, { ...payment, transaction_amount: 1 }), /valor pago/i);
    assert.match(validarPagamentoPro(attempt, { ...payment, currency_id: "USD" }), /moeda/i);
    assert.match(validarPagamentoPro(attempt, { ...payment, live_mode: true }), /ambiente/i);
    assert.match(validarPagamentoPro(attempt, { ...payment, external_reference: "outra-tentativa" }), /referência externa/i);
    assert.match(validarPagamentoPro(attempt, {
      ...payment, date_approved: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }), /expiração/i);
  });

  await runTest("Emulador: webhook assinado consulta o PSP e processa pagamento uma única vez", async () => {
    const oldFetch = global.fetch;
    const oldToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const oldSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const attemptId = "123e4567-e89b-12d3-a456-426614174004";
    const paymentId = "987654325";
    const requestId = "request-webhook-004";
    const ts = "1710000001";
    const secret = "segredo-webhook-integracao";
    const dataId = paymentId;
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    const headers = {
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": requestId,
    };
    const payment = {
      id: paymentId,
      status: "approved",
      external_reference: attemptId,
      currency_id: "BRL",
      transaction_amount: 49.90,
      live_mode: false,
      collector_id: "12345",
      date_approved: new Date().toISOString(),
      payment_type_id: "pix",
    };
    const createResponse = () => ({
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    });
    const request = {
      method: "POST",
      query: { "data.id": dataId, type: "payment" },
      body: { type: "payment", data: { id: dataId } },
      headers,
      get(name) { return headers[String(name).toLowerCase()]; },
    };

    try {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-token-webhook";
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;
      global.fetch = async () => new Response(JSON.stringify(payment), {
        status: 200, headers: { "content-type": "application/json" },
      });

      await db.doc("restaurantes/rest_mp_webhook").set({
        ownerId: "owner_mp_webhook", plano: "free",
      });
      await db.doc(`pagamentos_pro/${attemptId}`).set({
        attemptId,
        ownerUid: "owner_mp_webhook",
        restauranteId: "rest_mp_webhook",
        planoId: "pro_mensal",
        valorCentavos: 4990,
        currency: "BRL",
        liveMode: false,
        collectorId: "12345",
        status: "pending",
        expiraEm: new Date(Date.now() + 60 * 60 * 1000),
      });

      const primeiraResposta = createResponse();
      await executarMercadoPagoWebhook(db, request, primeiraResposta);
      assert.strictEqual(primeiraResposta.statusCode, 200);
      assert.strictEqual(primeiraResposta.body.status, "processed");

      const segundaResposta = createResponse();
      await executarMercadoPagoWebhook(db, request, segundaResposta);
      assert.strictEqual(segundaResposta.statusCode, 200);
      assert.strictEqual(segundaResposta.body.status, "already_processed");

      const assinatura = await db.doc("restaurantes/rest_mp_webhook").get();
      assert.strictEqual(assinatura.data().plano, "pro");
      assert.strictEqual(assinatura.data().assinatura.paymentId, paymentId);

      const requestAdulterado = {
        ...request,
        headers: { ...headers, "x-signature": "ts=1710000001,v1=" + "0".repeat(64) },
        get(name) {
          return this.headers[String(name).toLowerCase()];
        },
      };
      const respostaInvalida = createResponse();
      await executarMercadoPagoWebhook(db, requestAdulterado, respostaInvalida);
      assert.strictEqual(respostaInvalida.statusCode, 401);
    } finally {
      global.fetch = oldFetch;
      if (oldToken === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
      else process.env.MERCADO_PAGO_ACCESS_TOKEN = oldToken;
      if (oldSecret === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
      else process.env.MERCADO_PAGO_WEBHOOK_SECRET = oldSecret;
    }
  });

  await runTest("Emulador: pagamento PRO é transacional e idempotente por paymentId", async () => {
    const attemptId = "123e4567-e89b-12d3-a456-426614174001";
    const paymentId = "987654322";
    const restRef = db.doc("restaurantes/rest_mp_idempotente");
    await restRef.set({ ownerId: "owner_mp_idempotente", plano: "free" });
    await db.doc(`pagamentos_pro/${attemptId}`).set({
      attemptId,
      ownerUid: "owner_mp_idempotente",
      restauranteId: "rest_mp_idempotente",
      planoId: "pro_mensal",
      valorCentavos: 4990,
      currency: "BRL",
      liveMode: false,
      collectorId: "12345",
      status: "pending",
      expiraEm: new Date(Date.now() + 60 * 60 * 1000),
    });
    const payment = {
      id: paymentId,
      status: "approved",
      external_reference: attemptId,
      currency_id: "BRL",
      transaction_amount: 49.90,
      live_mode: false,
      collector_id: "12345",
      date_approved: new Date().toISOString(),
      payment_type_id: "pix",
    };

    const first = await executarProcessarPagamentoProAprovado(db, attemptId, payment);
    assert.strictEqual(first.sucesso, true);
    assert.strictEqual(first.idempotente, false);
    const second = await executarProcessarPagamentoProAprovado(db, attemptId, payment);
    assert.strictEqual(second.sucesso, true);
    assert.strictEqual(second.idempotente, true);

    const rest = await restRef.get();
    const attempt = await db.doc(`pagamentos_pro/${attemptId}`).get();
    const ledger = await db.doc(`pagamentos_pro_processados/${paymentId}`).get();
    assert.strictEqual(rest.data().plano, "pro");
    assert.strictEqual(rest.data().assinatura.paymentId, paymentId);
    assert.strictEqual(attempt.data().status, "approved");
    assert.strictEqual(ledger.exists, true);
  });

  await runTest("Emulador: estorno/chargeback restaura plano anterior e é idempotente", async () => {
    const attemptId = "123e4567-e89b-12d3-a456-426614174003";
    const paymentId = "987654324";
    const restRef = db.doc("restaurantes/rest_mp_estorno");
    await restRef.set({
      ownerId: "owner_mp_estorno", plano: "free",
      maxMesas: 10, maxPratos: 20, maxItensMenu: 20,
    });
    await db.doc(`pagamentos_pro/${attemptId}`).set({
      attemptId,
      ownerUid: "owner_mp_estorno",
      restauranteId: "rest_mp_estorno",
      planoId: "pro_mensal",
      valorCentavos: 4990,
      currency: "BRL",
      liveMode: false,
      collectorId: "12345",
      status: "pending",
      expiraEm: new Date(Date.now() + 60 * 60 * 1000),
    });
    const paymentAprovado = {
      id: paymentId, status: "approved", external_reference: attemptId,
      currency_id: "BRL", transaction_amount: 49.90, live_mode: false,
      collector_id: "12345", date_approved: new Date().toISOString(),
      payment_type_id: "pix",
    };
    await executarProcessarPagamentoProAprovado(db, attemptId, paymentAprovado);
    const paymentEstornado = {
      ...paymentAprovado, status: "refunded", transaction_amount_refunded: 49.90,
    };
    const primeiro = await executarProcessarEstornoPagamentoPro(db, attemptId, paymentEstornado);
    assert.strictEqual(primeiro.processado, true);
    assert.strictEqual(primeiro.idempotente, false);
    const segundo = await executarProcessarEstornoPagamentoPro(db, attemptId, paymentEstornado);
    assert.strictEqual(segundo.idempotente, true);

    const rest = await restRef.get();
    const attempt = await db.doc(`pagamentos_pro/${attemptId}`).get();
    const ledger = await db.doc(`pagamentos_pro_processados/${paymentId}`).get();
    assert.strictEqual(rest.data().plano, "free");
    assert.strictEqual(rest.data().assinatura, undefined);
    assert.strictEqual(rest.data().maxMesas, 10);
    assert.strictEqual(attempt.data().status, "refunded");
    assert.strictEqual(ledger.data().status, "refunded");
  });

  await runTest("Emulador: estorno parcial exige revisão e preserva assinatura até estorno integral", async () => {
    const attemptId = "123e4567-e89b-12d3-a456-426614174004";
    const paymentId = "987654325";
    const restRef = db.doc("restaurantes/rest_mp_estorno_parcial");
    await restRef.set({
      ownerId: "owner_mp_estorno_parcial", plano: "free",
      maxMesas: 10, maxPratos: 20, maxItensMenu: 20,
    });
    await db.doc(`pagamentos_pro/${attemptId}`).set({
      attemptId,
      ownerUid: "owner_mp_estorno_parcial",
      restauranteId: "rest_mp_estorno_parcial",
      planoId: "pro_mensal",
      valorCentavos: 4990,
      currency: "BRL",
      liveMode: false,
      collectorId: "12345",
      status: "pending",
      expiraEm: new Date(Date.now() + 60 * 60 * 1000),
    });
    const pagamento = {
      id: paymentId, status: "approved", external_reference: attemptId,
      currency_id: "BRL", transaction_amount: 49.90, live_mode: false,
      collector_id: "12345", date_approved: new Date().toISOString(),
      payment_type_id: "pix",
    };
    await executarProcessarPagamentoProAprovado(db, attemptId, pagamento);
    const assinaturaAntes = (await restRef.get()).data().assinatura;

    const parcial = await executarProcessarEstornoPagamentoPro(db, attemptId, {
      ...pagamento, transaction_amount_refunded: 10.00,
    });
    assert.strictEqual(parcial.status, "partial_refund_review");
    assert.strictEqual(parcial.revisaoNecessaria, true);
    const tentativaParcial = await db.doc(`pagamentos_pro/${attemptId}`).get();
    const ledgerParcial = await db.doc(`pagamentos_pro_processados/${paymentId}`).get();
    const restauranteParcial = await restRef.get();
    assert.strictEqual(tentativaParcial.data().status, "review_required");
    assert.strictEqual(tentativaParcial.data().valorEstornadoCentavos, 1000);
    assert.strictEqual(ledgerParcial.data().status, "partial_refund_review");
    assert.strictEqual(restauranteParcial.data().plano, "pro");
    assert.strictEqual(restauranteParcial.data().assinatura.paymentId, assinaturaAntes.paymentId);

    const repetido = await executarProcessarEstornoPagamentoPro(db, attemptId, {
      ...pagamento, transaction_amount_refunded: 10.00,
    });
    assert.strictEqual(repetido.idempotente, true);

    const integral = await executarProcessarEstornoPagamentoPro(db, attemptId, {
      ...pagamento, status: "refunded", transaction_amount_refunded: 49.90,
    });
    assert.strictEqual(integral.status, "refunded");
    const restauranteFinal = await restRef.get();
    assert.strictEqual(restauranteFinal.data().plano, "free");
    assert.strictEqual(restauranteFinal.data().assinatura, undefined);
    assert.strictEqual((await db.doc(`pagamentos_pro/${attemptId}`).get()).data().status, "refunded");
    assert.strictEqual((await db.doc(`pagamentos_pro_processados/${paymentId}`).get()).data().status, "refunded");
    const eventoParcialAtrasado = await executarProcessarEstornoPagamentoPro(db, attemptId, {
      ...pagamento, transaction_amount_refunded: 10.00,
    });
    assert.strictEqual(eventoParcialAtrasado.idempotente, true);
    assert.strictEqual(eventoParcialAtrasado.status, "refunded");
    assert.strictEqual((await db.doc(`pagamentos_pro/${attemptId}`).get()).data().status, "refunded");
  });

  await runTest("Emulador: pagamento PRO com valor incorreto não altera assinatura", async () => {
    const attemptId = "123e4567-e89b-12d3-a456-426614174002";
    const restRef = db.doc("restaurantes/rest_mp_valor_invalido");
    await restRef.set({ ownerId: "owner_mp_valor_invalido", plano: "free" });
    await db.doc(`pagamentos_pro/${attemptId}`).set({
      attemptId,
      ownerUid: "owner_mp_valor_invalido",
      restauranteId: "rest_mp_valor_invalido",
      planoId: "pro_mensal",
      valorCentavos: 4990,
      currency: "BRL",
      liveMode: false,
      status: "pending",
      expiraEm: new Date(Date.now() + 60 * 60 * 1000),
    });
    await assert.rejects(
      () => executarProcessarPagamentoProAprovado(db, attemptId, {
        id: "987654323",
        status: "approved",
        external_reference: attemptId,
        currency_id: "BRL",
        transaction_amount: 0.10,
        live_mode: false,
        date_approved: new Date().toISOString(),
      }),
      /valor pago/i
    );
    assert.strictEqual((await restRef.get()).data().plano, "free");
    assert.strictEqual((await db.doc(`pagamentos_pro/${attemptId}`).get()).data().status, "pending");
    assert.strictEqual((await db.doc("pagamentos_pro_processados/987654323").get()).exists, false);
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
    await assert.rejects(
      () => executarAtivarInstancia(db, "uid_sponsor_01", {
        role: "sponsor", patrocinadorId: "uid_sponsor_01",
        firebase: { sign_in_provider: "custom" },
      }, {
        codigo: "MAYA-ANON-01", slug: "sponsor-rest-01", restauranteNome: "Restaurante Sponsor",
      }),
      /sessões anônimas ou B2B/i
    );
    assert.strictEqual((await db.doc("concessoes/MAYA-ANON-01").get()).exists, true);
    assert.strictEqual((await db.doc("restaurantes/uid_anon_01").get()).exists, false);
    assert.strictEqual((await db.doc("restaurantes/uid_sponsor_01").get()).exists, false);
  });

  await runTest("Emulador: callable de ativação não permite contornar rate limit por chamada direta", async () => {
    const authToken = { firebase: { sign_in_provider: "password" } };
    const rawRequest = { headers: { "x-forwarded-for": "198.51.100.88" } };
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await assert.rejects(
        () => executarAtivarInstancia(db, "owner_brute_force", authToken, {
          codigo: "MAYA-CODIGO-INEXISTENTE-99",
          slug: `slug-inexistente-${tentativa}`,
          restauranteNome: "Teste Rate Limit",
        }, rawRequest),
        /inválido|inexistente|não encontrada/i
      );
    }
    await assert.rejects(
      () => executarAtivarInstancia(db, "owner_brute_force", authToken, {
        codigo: "MAYA-CODIGO-INEXISTENTE-99",
        slug: "slug-inexistente-final",
        restauranteNome: "Teste Rate Limit",
      }, rawRequest),
      /muitas tentativas|bloqueado temporariamente/i
    );
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
    const retry = await executarAtivarInstancia(db, "owner_atomic_01", { firebase: { sign_in_provider: "password" } }, {
      codigo: "MAYA-ATOMIC-01", slug: "atomic-rest-01", restauranteNome: "Atomic Restaurante",
      modoOperacao: "hibrido",
    });
    assert.strictEqual(retry.idempotente, true);
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

  await runTest("Emulador: código de licença arquivado não pode ser reutilizado como voucher B2B", async () => {
    const codigo = "CODIGO-ARQUIVADO-NAO-REUTILIZAR";
    await db.doc(`arquivo_morto_licencas/${codigo}`).set({
      id: codigo, codigo, ownerId: "owner_antigo", motivo: "ativacao_concluida",
    });
    const pat = db.doc("patrocinadores/spn_codigo_arquivado");
    await pat.set({ nomeFantasia: "Marca Arquivada", ativo: true });
    await pat.collection("catalogo_master").doc("item").set({
      id: "item", nome: "Produto", categoriaSugerida: "Bebidas", precoSugerido: 5,
      obrigatorioNoCardapio: true,
    });
    await pat.collection("lotes_licencas").doc("lote-arquivado").set({
      id: "lote-arquivado", patrocinadorId: pat.id, nome: "Lote",
      codigoCampanha: codigo, totalLicencas: 2, licencasAtivadas: 0,
      validadeMeses: 6, ativo: true, restaurantesVinculados: [],
    });
    await assert.rejects(
      () => executarValidarCodigoAtivacao(db, { codigo }),
      /já foi consumido e está arquivado/i
    );
  });

  await runTest("Emulador: concessão, lote e patrocinador sem estado ativo explícito falham fechados", async () => {
    await db.doc("concessoes/LICENCA-SEM-STATUS-001").set({
      plano: "pro", limites: { maxMesas: 30, maxPratos: 60 },
      expiracaoEm: new Date(Date.now() + 86400000).toISOString(),
    });
    await assert.rejects(
      () => executarValidarCodigoAtivacao(db, { codigo: "LICENCA-SEM-STATUS-001" }),
      /não está disponível/i
    );

    const patAtivo = db.doc("patrocinadores/spn_lote_sem_ativo");
    await patAtivo.set({ nomeFantasia: "Marca", ativo: true });
    await patAtivo.collection("lotes_licencas").doc("lote-sem-ativo").set({
      id: "lote-sem-ativo", patrocinadorId: patAtivo.id,
      codigoCampanha: "VOUCHER-SEM-ATIVO-001",
      totalLicencas: 2, licencasAtivadas: 0, validadeMeses: 6,
      restaurantesVinculados: [],
    });
    await assert.rejects(
      () => executarValidarCodigoAtivacao(db, { codigo: "VOUCHER-SEM-ATIVO-001" }),
      /lote de patrocínio está inativo/i
    );

    const patSemAtivo = db.doc("patrocinadores/spn_sem_ativo");
    await patSemAtivo.set({ nomeFantasia: "Marca sem status" });
    await patSemAtivo.collection("lotes_licencas").doc("lote-pat-sem-ativo").set({
      id: "lote-pat-sem-ativo", patrocinadorId: patSemAtivo.id,
      codigoCampanha: "VOUCHER-SPONSOR-SEM-ATIVO",
      totalLicencas: 2, licencasAtivadas: 0, validadeMeses: 6, ativo: true,
      restaurantesVinculados: [],
    });
    await assert.rejects(
      () => executarValidarCodigoAtivacao(db, { codigo: "VOUCHER-SPONSOR-SEM-ATIVO" }),
      /patrocinador inativo ou inexistente/i
    );
  });

  await runTest("Emulador: voucher de lote B2B inativo não pode ser validado nem consumido", async () => {
    const pat = db.doc("patrocinadores/spn_lote_inativo");
    await pat.set({ nomeFantasia: "Marca Inativa", ativo: true });
    await pat.collection("lotes_licencas").doc("lote-inativo").set({
      id: "lote-inativo", patrocinadorId: pat.id, nome: "Lote Inativo",
      codigoCampanha: "VOUCHER-LOTE-INATIVO", totalLicencas: 5,
      licencasAtivadas: 0, validadeMeses: 6, ativo: false,
      restaurantesVinculados: [],
    });
    await assert.rejects(
      () => executarValidarCodigoAtivacao(db, { codigo: "VOUCHER-LOTE-INATIVO" }),
      /lote de patrocínio está inativo/i
    );
    await pat.collection("lotes_licencas").doc("lote-duplicado").set({
      id: "lote-duplicado", patrocinadorId: pat.id, nome: "Lote Duplicado",
      codigoCampanha: "VOUCHER-LOTE-INATIVO", totalLicencas: 5,
      licencasAtivadas: 0, validadeMeses: 6, ativo: true,
      restaurantesVinculados: [],
    });
    await assert.rejects(
      () => executarValidarCodigoAtivacao(db, { codigo: "VOUCHER-LOTE-INATIVO" }),
      /código de campanha ambíguo/i
    );
  });

  await runTest("Emulador: callable de patrocínio não permite contornar rate limit por chamada direta", async () => {
    await db.doc("restaurantes/rest_rate_b2b").set({ ownerId: "owner_rate_b2b" });
    const rawRequest = { headers: { "x-forwarded-for": "198.51.100.89" } };
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await assert.rejects(
        () => executarAtivarPatrocinio(db, "owner_rate_b2b", {}, {
          restauranteId: "rest_rate_b2b", codigoVoucher: "VOUCHER-B2B-INEXISTENTE",
        }, rawRequest),
        /inválido|inexistente|não encontrada/i
      );
    }
    await assert.rejects(
      () => executarAtivarPatrocinio(db, "owner_rate_b2b", {}, {
        restauranteId: "rest_rate_b2b", codigoVoucher: "VOUCHER-B2B-INEXISTENTE",
      }, rawRequest),
      /muitas tentativas|bloqueado temporariamente/i
    );
  });

  await runTest("Emulador: validação correta não zera rate limit de IP contra enumeração", async () => {
    await db.doc("concessoes/MAYA-RATE-VALID-01").set({
      status: "disponivel", plano: "free",
      limites: { maxMesas: 10, maxPratos: 20 },
    });
    const authToken = { firebase: { sign_in_provider: "password" } };
    const rawRequest = { headers: { "x-forwarded-for": "198.51.100.90" } };
    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      await assert.rejects(
        () => executarAtivarInstancia(db, "owner_rate_valid", authToken, {
          codigo: `MAYA-ERRO-RATE-${String(tentativa).padStart(2, "0")}`,
          slug: `slug-rate-erro-${tentativa}`,
          restauranteNome: "Teste Rate Limit",
        }, rawRequest),
        /inválido|inexistente|não encontrada/i
      );
    }
    await executarAtivarInstancia(db, "owner_rate_valid", authToken, {
      codigo: "MAYA-RATE-VALID-01",
      slug: "slug-rate-valid",
      restauranteNome: "Teste Rate Limit",
    }, rawRequest);
    await assert.rejects(
      () => executarAtivarInstancia(db, "owner_rate_valid_2", authToken, {
        codigo: "MAYA-ERRO-RATE-05",
        slug: "slug-rate-erro-5",
        restauranteNome: "Teste Rate Limit",
      }, rawRequest),
      /inválido|inexistente|não encontrada/i
    );
    await assert.rejects(
      () => executarAtivarInstancia(db, "owner_rate_valid_3", authToken, {
        codigo: "MAYA-ERRO-RATE-06",
        slug: "slug-rate-erro-6",
        restauranteNome: "Teste Rate Limit",
      }, rawRequest),
      /muitas tentativas|bloqueado temporariamente/i
    );
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
    await patRef.collection("catalogo_master").doc("item-canonical").set({
      id: "item-spoofed", nome: "Produto com ID adulterado", categoriaSugerida: "Alimentos",
      precoSugerido: 8, obrigatorioNoCardapio: true,
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
    assert.strictEqual((await db.doc("restaurantes/owner_b2b_01/cardapio/spn-item-canonical").get()).exists, true);
    assert.strictEqual((await db.doc("restaurantes/owner_b2b_01/cardapio/spn-item-spoofed").get()).exists, false);
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

  await runTest("Emulador: emissão inicial e rotação de QR só retornam segredo uma vez", async () => {
    const rest = db.doc("restaurantes/rest_qr_inicial");
    await rest.set({ ownerId: "owner_qr_inicial", nome: "Rest QR", slug: "rest-qr" });
    await rest.collection("mesas").doc("11").set({
      numero: 11, ativa: true, statusEstrutural: "livre", qrVersao: 0,
    });
    const payload = { restauranteId: "rest_qr_inicial", mesa: 11 };
    const primeira = await executarGarantirCredencialMesa(db, "owner_qr_inicial", {}, payload);
    assert.strictEqual(primeira.jaConfigurada, false);
    assert.strictEqual(primeira.qrCredencial.length, 48);
    assert.strictEqual(primeira.qrVersao, 1);
    const mesa = await rest.collection("mesas").doc("11").get();
    assert.strictEqual(mesa.data().qrCredencial, undefined);
    assert.strictEqual(
      mesa.data().qrCredencialHash,
      crypto.createHash("sha256").update(primeira.qrCredencial).digest("hex")
    );
    const repetida = await executarGarantirCredencialMesa(db, "owner_qr_inicial", {}, payload);
    assert.strictEqual(repetida.jaConfigurada, true);
    assert.strictEqual(repetida.qrCredencial, undefined);
    const rotacionada = await executarGarantirCredencialMesa(db, "owner_qr_inicial", {}, {
      ...payload, rotacionar: true,
    });
    assert.strictEqual(rotacionada.jaConfigurada, false);
    assert.strictEqual(rotacionada.qrVersao, 2);
    assert.notStrictEqual(rotacionada.qrCredencial, primeira.qrCredencial);
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

  await runTest("Emulador: chamado do garçom rejeita mesa reservada", async () => {
    const { rest } = await seed(db, 10, "cliente_mesa_reservada");
    const qr = "qr-credencial-mesa-reservada-123456";
    await rest.collection("mesas").doc("10").set({
      ativa: true,
      statusEstrutural: "reservada",
      qrCredencialHash: crypto.createHash("sha256").update(qr).digest("hex"),
      qrVersao: 1,
    }, { merge: true });
    await assert.rejects(
      () => executarChamarGarcom(db, "cliente_mesa_reservada", {
        ...base, mesa: 10, qrCredencial: qr,
      }),
      /mesa indisponível/i
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

    await assert.rejects(
      () => executarReativarMesa(db, "garcom_e", {}, { ...base, mesa: 6 }),
      /permissão/i
    );
    const reativada = await executarReativarMesa(db, "owner_e", {}, { ...base, mesa: 6 });
    assert.strictEqual(reativada.sucesso, true);
    assert.strictEqual(reativada.idempotente, false);
    assert.strictEqual(typeof reativada.qrCredencial, "string");
    assert.strictEqual(reativada.qrCredencial.length, 48);
    const mesaReativada = await rest.collection("mesas").doc("6").get();
    assert.strictEqual(mesaReativada.data().ativa, true);
    assert.strictEqual(mesaReativada.data().statusEstrutural, "livre");
    assert.strictEqual(mesaReativada.data().qrVersao, 4);
    assert.strictEqual(mesaReativada.data().qrCredencial, undefined);
    assert.strictEqual(
      mesaReativada.data().qrCredencialHash,
      crypto.createHash("sha256").update(reativada.qrCredencial).digest("hex")
    );
    const retryReativacao = await executarReativarMesa(db, "owner_e", {}, { ...base, mesa: 6 });
    assert.strictEqual(retryReativacao.idempotente, true);
    assert.strictEqual(retryReativacao.qrCredencial, undefined);
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

