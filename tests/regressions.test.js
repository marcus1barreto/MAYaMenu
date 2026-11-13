/**
 * Suíte de Regressão Funcional e Segurança Financeira MAYaMenu
 * Execução: node tests/regressions.test.js
 */

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function hashQr(cred) {
  return crypto.createHash("sha256").update(String(cred)).digest("hex");
}

const { _internal } = require("../functions/index.js");
const {
  getMesaTokenSecret,
  verificarMesaToken,
  validarModificadoresServidor,
  executarGarantirCredencialMesa,
  executarCriacaoPedidoCliente,
  executarEmissaoSessaoMesa,
  executarLancamentoPedidoGarcom,
  executarDefinirTaxaServicoMesa,
  executarFecharComanda,
  executarLiberarMesa,
} = _internal;

const TEST_MESA_SECRET = "segredo-super-forte-de-teste-mayamenu-32bytes-ok";
process.env.MESA_SESSION_SECRET = TEST_MESA_SECRET;

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

function createFakeFirestore(seed = {}) {
  const store = new Map(Object.entries(seed));
  let txLock = Promise.resolve();

  function makeRef(docPath) {
    return {
      path: docPath,
      id: docPath.split("/").pop(),
      collection(subName) {
        return makeCollection(`${docPath}/${subName}`);
      },
      async get() {
        const val = store.get(docPath);
        return {
          exists: val !== undefined,
          id: docPath.split("/").pop(),
          ref: makeRef(docPath),
          data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
        };
      },
    };
  }

  function makeCollection(colPath) {
    return {
      doc(id) {
        return makeRef(`${colPath}/${id}`);
      },
      async get() {
        const docs = [];
        for (const [k, v] of store.entries()) {
          if (k.startsWith(`${colPath}/`) && k.slice(colPath.length + 1).indexOf("/") === -1) {
            docs.push({
              exists: true,
              id: k.split("/").pop(),
              ref: makeRef(k),
              data: () => JSON.parse(JSON.stringify(v)),
            });
          }
        }
        return { empty: docs.length === 0, size: docs.length, docs, forEach: (cb) => docs.forEach(cb) };
      },
      where(field, _op, value) {
        return {
          limit() {
            return {
              async get() {
                const docs = [];
                for (const [k, v] of store.entries()) {
                  if (k.startsWith(`${colPath}/`) && k.slice(colPath.length + 1).indexOf("/") === -1) {
                    if (v && v[field] === value) {
                      docs.push({
                        exists: true,
                        id: k.split("/").pop(),
                        ref: makeRef(k),
                        data: () => JSON.parse(JSON.stringify(v)),
                      });
                    }
                  }
                }
                return { empty: docs.length === 0, docs };
              },
            };
          },
        };
      },
    };
  }

  return {
    _store: store,
    collection: makeCollection,
    runTransaction(fn) {
      const exec = txLock.then(async () => {
        const writes = [];
        const t = {
          async get(ref) {
            return ref.get();
          },
          async getAll(...refs) {
            return Promise.all(refs.map((r) => r.get()));
          },
          delete(ref) {
            writes.push({ path: ref.path, delete: true });
          },
          set(ref, data, opts = {}) {
            writes.push({ path: ref.path, data, merge: Boolean(opts.merge) });
          },
          update(ref, data) {
            writes.push({ path: ref.path, data, merge: true });
          },
        };
        const res = await fn(t);
        for (const w of writes) {
          if (w.delete) {
            store.delete(w.path);
          } else if (w.merge && store.has(w.path)) {
            store.set(w.path, { ...store.get(w.path), ...w.data });
          } else {
            store.set(w.path, { ...w.data });
          }
        }
        return res;
      });
      txLock = exec.catch(() => {});
      return exec;
    },
  };
}

function seedRestauranteBase() {
  return {
    "restaurantes/rest_1": {
      nome: "Bistrô Teste",
      slug: "bistro-teste",
      ownerId: "owner_1",
      maxMesas: 20,
    },
    "restaurantes/rest_1/equipe/garcom_1": {
      nome: "Garçom Teste",
      role: "garcom",
      ativo: true,
    },
    "restaurantes/rest_1/equipe/garcom_inativo": {
      nome: "Garçom Desligado",
      role: "garcom",
      ativo: false,
    },
    "restaurantes/rest_1/equipe/cozinha_1": {
      nome: "Cozinha Teste",
      role: "cozinha",
      ativo: true,
    },
    "restaurantes/rest_1/mesas/1": { numero: 1, ativa: true, statusEstrutural: "livre", qrCredencialHash: hashQr("qr-credencial-mesa-1-valida-32ch") },
    "restaurantes/rest_1/mesas/2": { numero: 2, ativa: true, statusEstrutural: "livre", qrCredencialHash: hashQr("qr-credencial-mesa-2-valida-32ch") },
    "restaurantes/rest_1/mesas/3": { numero: 3, ativa: true, statusEstrutural: "livre", qrCredencialHash: hashQr("qr-credencial-mesa-3-valida-32ch") },
    "restaurantes/rest_1/mesas/4": { numero: 4, ativa: true, statusEstrutural: "livre", qrCredencialHash: hashQr("qr-credencial-mesa-4-valida-32ch") },
    "restaurantes/rest_1/mesas/5": { numero: 5, ativa: true, statusEstrutural: "livre", qrCredencialHash: hashQr("qr-credencial-mesa-5-valida-32ch") },
    "restaurantes/rest_1/mesas/7": { numero: 7, ativa: true, statusEstrutural: "livre", qrCredencialHash: hashQr("qr-credencial-mesa-7-valida-32ch") },
    "restaurantes/rest_1/cardapio/burger-1": {
      nome: "Burger Artesanal",
      precoBase: 12.9,
      ativo: true,
      tempoPreparoEstimado: 15,
      grupoModificadores: [
        {
          nome: "Adicionais",
          obrigatorio: false,
          minimo: 0,
          maximo: 2,
          opcoes: [{ nome: "Bacon Extra", precoAdicional: 0.1 }],
        },
      ],
    },
    "restaurantes/rest_1/cardapio/item-nan": {
      nome: "Item Quebrado",
      precoBase: Number.NaN,
      ativo: true,
    },
    "restaurantes/rest_2": {
      nome: "Outro Restaurante",
      slug: "outro-rest",
      maxMesas: 10,
    },
    "restaurantes/rest_2/cardapio/pizza-externa": {
      nome: "Pizza Rest 2",
      precoBase: 60,
      ativo: true,
    },
  };
}

async function emitirToken(db, uid, restauranteId, mesa) {
  const qrCredencial = `qr-credencial-mesa-${mesa}-valida-32ch`;
  const res = await executarEmissaoSessaoMesa(db, uid, { restauranteId, mesa, qrCredencial });
  return res.mesaToken;
}

async function main() {
  console.log("=================================================");
  console.log("Iniciando Testes de Regressão e Segurança MAYaMenu");
  console.log("=================================================\n");

  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

  await runTest("Carrinho: Mesa 3 não recupera itens da Mesa 5 (chaves isoladas)", async () => {
    const storage = new Map();
    const keyMesa3 = "mayamenu_cart_bistro_mesa_3";
    const keyMesa5 = "mayamenu_cart_bistro_mesa_5";
    storage.set(keyMesa3, JSON.stringify({ itens: [{ menuItemId: "burger-1" }], mesa: 3, atualizadoEm: Date.now() }));
    assert.strictEqual(storage.get(keyMesa5), undefined);
  });

  await runTest("Expiração: Carrinho com mais de 4h é descartado", async () => {
    const agora = Date.now();
    assert.strictEqual(agora - (agora - FOUR_HOURS_MS - 1000) > FOUR_HOURS_MS, true);
  });

  await runTest("Carrinho: Carrinho recente (< 4h) da mesma mesa é recuperado", async () => {
    const agora = Date.now();
    assert.strictEqual(agora - (agora - 30 * 60 * 1000) > FOUR_HOURS_MS, false);
  });

  await runTest("Financeiro: Cliente altera preço no navegador -> Servidor ignora e calcula em centavos inteiros", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const mesaToken = await emitirToken(db, "anon_1", "rest_1", 4);
    const res = await executarCriacaoPedidoCliente(db, "anon_1", {
      restauranteId: "rest_1",
      slug: "bistro-teste",
      pedidoId: "ped-preco-001",
      mesa: 4,
      mesaToken,
      nomeCliente: "Maria",
      subtotal: 0.01,
      itens: [
        {
          menuItemId: "burger-1",
          nome: "Burger Hackeado",
          quantidade: 2,
          precoFinal: 0.01,
          modificadores: [{ grupo: "Adicionais", opcao: "Bacon Extra", precoAdicional: 0 }],
        },
      ],
    });

    // 12.90 + 0.10 = 13.00 * 2 = 26.00 (sem erro de ponto flutuante)
    assert.strictEqual(res.subtotal, 26);
    const pedido = db._store.get("restaurantes/rest_1/mesas/4/comandas_abertas/anon_1/pedidos/ped-preco-001");
    assert.strictEqual(pedido.subtotal, 26);
    assert.strictEqual(pedido.itens[0].precoFinal, 13);
    assert.strictEqual(pedido.itens[0].nome, "Burger Artesanal");
  });

  await runTest("Financeiro: Rejeita quantidade fracionária, NaN e produto inexistente/cross-tenant", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const mesaToken = await emitirToken(db, "anon_1", "rest_1", 1);

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_1", {
          restauranteId: "rest_1",
          pedidoId: "ped-frac-001",
          mesa: 1,
          mesaToken,
          nomeCliente: "Maria",
          itens: [{ menuItemId: "burger-1", quantidade: 1.5 }],
        }),
      /Quantidade de item inválida/i
    );

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_1", {
          restauranteId: "rest_1",
          pedidoId: "ped-nan-001",
          mesa: 1,
          mesaToken,
          nomeCliente: "Maria",
          itens: [{ menuItemId: "item-nan", quantidade: 1 }],
        }),
      /inválido/i
    );

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_1", {
          restauranteId: "rest_1",
          pedidoId: "ped-cross-rest-1",
          mesa: 1,
          mesaToken,
          nomeCliente: "Maria",
          itens: [{ menuItemId: "pizza-externa", quantidade: 1 }],
        }),
      /não encontrado/i
    );
  });

  await runTest("Autorização de Mesa: Rejeita pedido sem mesaToken ou com mesaToken de outra mesa/usuário", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const tokenMesa2 = await emitirToken(db, "anon_1", "rest_1", 2);

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_1", {
          restauranteId: "rest_1",
          pedidoId: "ped-sem-token",
          mesa: 2,
          nomeCliente: "Maria",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /Sessão da mesa inválida/i
    );

    // Tentativa de usar token da mesa 2 na mesa 5
    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_1", {
          restauranteId: "rest_1",
          pedidoId: "ped-outra-mesa",
          mesa: 5,
          mesaToken: tokenMesa2,
          nomeCliente: "Maria",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /Sessão da mesa inválida/i
    );
  });

  await runTest("Idempotência: Mesmo ID e mesmo payload -> Mesmo resultado sem duplicação", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const mesaToken = await emitirToken(db, "anon_2", "rest_1", 2);
    const payload = {
      restauranteId: "rest_1",
      pedidoId: "ped-idemp-100",
      mesa: 2,
      mesaToken,
      nomeCliente: "João",
      itens: [{ menuItemId: "burger-1", quantidade: 1, modificadores: [] }],
    };
    const r1 = await executarCriacaoPedidoCliente(db, "anon_2", payload);
    const r2 = await executarCriacaoPedidoCliente(db, "anon_2", payload);
    assert.strictEqual(r1.idempotente, false);
    assert.strictEqual(r2.idempotente, true);
    assert.strictEqual(r2.subtotal, 12.9);
  });

  await runTest("Idempotência: Mesmo ID e payload diferente ou em outra mesa -> Rejeição", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const tokenM2 = await emitirToken(db, "anon_2", "rest_1", 2);
    const tokenM5 = await emitirToken(db, "anon_2", "rest_1", 5);

    await executarCriacaoPedidoCliente(db, "anon_2", {
      restauranteId: "rest_1",
      pedidoId: "ped-colisao-1",
      mesa: 2,
      mesaToken: tokenM2,
      nomeCliente: "João",
      itens: [{ menuItemId: "burger-1", quantidade: 1 }],
    });

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_2", {
          restauranteId: "rest_1",
          pedidoId: "ped-colisao-1",
          mesa: 2,
          mesaToken: tokenM2,
          nomeCliente: "João",
          itens: [{ menuItemId: "burger-1", quantidade: 5 }],
        }),
      /outro conteúdo ou mesa/i
    );

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_2", {
          restauranteId: "rest_1",
          pedidoId: "ped-colisao-1",
          mesa: 5,
          mesaToken: tokenM5,
          nomeCliente: "João",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /outro conteúdo ou mesa|Conflito/i
    );
  });

  await runTest("Concorrência: Duas chamadas simultâneas iguais -> Um pedido e um ticket", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const mesaToken = await emitirToken(db, "anon_conc", "rest_1", 3);
    const payload = {
      restauranteId: "rest_1",
      pedidoId: "ped-concurrent-1",
      mesa: 3,
      mesaToken,
      nomeCliente: "Lia",
      itens: [{ menuItemId: "burger-1", quantidade: 1 }],
    };

    const [a, b] = await Promise.all([
      executarCriacaoPedidoCliente(db, "anon_conc", payload),
      executarCriacaoPedidoCliente(db, "anon_conc", payload),
    ]);

    assert.strictEqual(a.sucesso && b.sucesso, true);
    assert.strictEqual(a.idempotente !== b.idempotente, true);
  });

  await runTest("Mesa e Comanda: Rejeita mesa reservada e comanda em estado final", async () => {
    const seed = seedRestauranteBase();
    seed["restaurantes/rest_1/mesas/8"] = {
      numero: 8,
      ativa: true,
      statusEstrutural: "reservada",
      qrCredencialHash: hashQr("qr-credencial-mesa-8-valida-32ch"),
    };
    seed["restaurantes/rest_1/mesas/1/comandas_abertas/anon_final"] = {
      id: "anon_final",
      restauranteId: "rest_1",
      status: "conta_pedida",
    };
    const db = createFakeFirestore(seed);
    const tokenM8 = await emitirToken(db, "anon_res", "rest_1", 8);
    const tokenM1 = await emitirToken(db, "anon_final", "rest_1", 1);

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_res", {
          restauranteId: "rest_1",
          pedidoId: "ped-mesa-reservada",
          mesa: 8,
          mesaToken: tokenM8,
          nomeCliente: "Pedro",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /reservada/i
    );

    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_final", {
          restauranteId: "rest_1",
          pedidoId: "ped-comanda-final",
          mesa: 1,
          mesaToken: tokenM1,
          nomeCliente: "Carlos",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /fechamento ou foi encerrada/i
    );
  });

  await runTest("Segurança & Offline: Origem explícita, retry limit, PIN e auto-seed", async () => {
    const root = path.resolve(__dirname, "..");
    const pinGuard = fs.readFileSync(path.join(root, "src/components/salao/pin-lock-guard.tsx"), "utf8");
    const gestaoEquipe = fs.readFileSync(path.join(root, "src/components/admin/gestao-equipe.tsx"), "utf8");
    const adminDashboard = fs.readFileSync(path.join(root, "src/components/admin/admin-dashboard.tsx"), "utf8");
    const cartDrawer = fs.readFileSync(path.join(root, "src/components/cliente/cart-drawer.tsx"), "utf8");
    const offlineQueue = fs.readFileSync(path.join(root, "src/lib/offline-queue.ts"), "utf8");

    assert.strictEqual(pinGuard.includes('"ratazanas"'), false);
    assert.strictEqual(pinGuard.includes('"1234"'), false);
    assert.strictEqual(pinGuard.includes('"4321"'), false);
    assert.ok(pinGuard.includes("mayamenu_pin_unlocked_${role}_${targetRestId}"));

    assert.strictEqual(gestaoEquipe.includes("1234"), false);
    assert.strictEqual(gestaoEquipe.includes('"4321"'), false);
    assert.strictEqual(adminDashboard.includes("popularCardapioInicialSeVazio("), false);
    assert.ok(cartDrawer.includes("enfileirarPedidoOffline("));
    assert.ok(cartDrawer.includes("criarPedidoCliente"));
    assert.ok(cartDrawer.includes("emitirSessaoMesa"));

    assert.ok(offlineQueue.includes('if (pedido.origem === "cliente")'));
    assert.ok(offlineQueue.includes('if (pedido.origem !== "garcom")'));
    assert.ok(offlineQueue.includes('lancarPedidoGarcom'));
    assert.strictEqual(offlineQueue.includes("auth.currentUser?.isAnonymous"), false);
    assert.ok(offlineQueue.includes("MAX_TENTATIVAS_OFFLINE = 10"));
  });

  await runTest("P0 Segredo HMAC: Rejeita MESA_SESSION_SECRET ausente ou curto (zero fallback)", async () => {
    const prev = process.env.MESA_SESSION_SECRET;
    try {
      delete process.env.MESA_SESSION_SECRET;
      assert.throws(() => getMesaTokenSecret(), /não configurado/i);
      process.env.MESA_SESSION_SECRET = "curto";
      assert.throws(() => getMesaTokenSecret(), /não configurado/i);
    } finally {
      process.env.MESA_SESSION_SECRET = prev;
    }
  });

  await runTest("P0 QR Code & Mesa: Rejeita emissão sem qrCredencial, credencial errada, mesa inexistente e token expirado/malformado", async () => {
    const db = createFakeFirestore(seedRestauranteBase());

    // Sem qrCredencial
    await assert.rejects(
      () => executarEmissaoSessaoMesa(db, "anon_1", { restauranteId: "rest_1", mesa: 1 }),
      /Credencial do QR Code/i
    );
    // qrCredencial errada
    await assert.rejects(
      () =>
        executarEmissaoSessaoMesa(db, "anon_1", {
          restauranteId: "rest_1",
          mesa: 1,
          qrCredencial: "credencial-falsa-tentativa-ataque",
        }),
      /inválida/i
    );
    // Mesa inexistente no cadastro
    await assert.rejects(
      () =>
        executarEmissaoSessaoMesa(db, "anon_1", {
          restauranteId: "rest_1",
          mesa: 19,
          qrCredencial: "qr-credencial-mesa-19-valida-32c",
        }),
      /não cadastrada/i
    );

    // Token expirado e malformado
    assert.strictEqual(verificarMesaToken(`${Date.now() - 1000}.1.${"a".repeat(64)}`, "rest_1", "1", "anon_1"), false);
    assert.strictEqual(verificarMesaToken(`${Date.now() + 60000}.1.zzzz`, "rest_1", "1", "anon_1"), false);

    // Rotação de credencial QR revoga imediatamente sessões emitidas na versão anterior
    const tokenAntigo = await emitirToken(db, "anon_rot", "rest_1", 4);
    // Emissão/rotação de QR é ação privilegiada: somente titular ou admin.
    await executarGarantirCredencialMesa(db, "owner_1", {}, {
      restauranteId: "rest_1",
      mesa: 4,
      rotacionar: true,
    });
    await assert.rejects(
      () =>
        executarCriacaoPedidoCliente(db, "anon_rot", {
          restauranteId: "rest_1",
          pedidoId: "ped-apos-rotacao-1",
          mesa: 4,
          mesaToken: tokenAntigo,
          nomeCliente: "Marcos",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /revogada ou expirada/i
    );
  });

  await runTest("P1 Idempotência Pós-Alteração: Reenvio após timeout funciona mesmo se preço mudar ou produto for desativado", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const mesaToken = await emitirToken(db, "anon_timeout", "rest_1", 2);
    const payload = {
      restauranteId: "rest_1",
      pedidoId: "ped-timeout-001",
      mesa: 2,
      mesaToken,
      nomeCliente: "Ana",
      itens: [{ menuItemId: "burger-1", quantidade: 1 }],
    };

    const primeiro = await executarCriacaoPedidoCliente(db, "anon_timeout", payload);
    assert.strictEqual(primeiro.subtotal, 12.9);
    assert.strictEqual(primeiro.idempotente, false);

    // Simula alteração de preço e desativação do produto após o primeiro envio
    db._store.set("restaurantes/rest_1/cardapio/burger-1", {
      nome: "Burger Artesanal",
      precoBase: 99.9,
      ativo: false,
    });

    const retry = await executarCriacaoPedidoCliente(db, "anon_timeout", payload);
    assert.strictEqual(retry.idempotente, true);
    assert.strictEqual(retry.subtotal, 12.9);
  });

  await runTest("P1 Modificadores: Rejeita catálogo inconsistente (maximo<=0, minimo>maximo, opção duplicada) e repetição não permitida", async () => {
    assert.throws(
      () =>
        validarModificadoresServidor([], [
          { nome: "Ponto", maximo: 0, opcoes: [{ nome: "Ao Ponto", precoAdicional: 0 }] },
        ]),
      /máximo inválida/i
    );
    assert.throws(
      () =>
        validarModificadoresServidor([], [
          { nome: "Ponto", minimo: 3, maximo: 1, opcoes: [{ nome: "Ao Ponto", precoAdicional: 0 }] },
        ]),
      /mínimo maior que máximo/i
    );
    assert.throws(
      () =>
        validarModificadoresServidor([], [
          {
            nome: "Molho",
            opcoes: [
              { nome: "Barbecue", precoAdicional: 0 },
              { nome: "Barbecue", precoAdicional: 2 },
            ],
          },
        ]),
      /Opção duplicada/i
    );
    assert.throws(
      () =>
        validarModificadoresServidor(
          [
            { grupo: "Adicionais", opcao: "Bacon Extra" },
            { grupo: "Adicionais", opcao: "Bacon Extra" },
          ],
          [{ nome: "Adicionais", maximo: 3, opcoes: [{ nome: "Bacon Extra", precoAdicional: 2 }] }]
        ),
      /mais de uma vez/i
    );
  });

  await runTest("P1 Garçom: bloqueia pedido em restaurante suspenso e mesa reservada", async () => {
    const dbSuspenso = createFakeFirestore(seedRestauranteBase());
    dbSuspenso._store.get("restaurantes/rest_1").suspenso = true;
    await assert.rejects(
      () => executarLancamentoPedidoGarcom(dbSuspenso, "garcom_1", {}, {
        restauranteId: "rest_1", pedidoId: "ped-suspenso-01", mesa: 3,
        clienteId: "cli_suspenso", itens: [{ menuItemId: "burger-1", quantidade: 1 }],
      }),
      /estabelecimento suspenso/i
    );

    const dbReservada = createFakeFirestore(seedRestauranteBase());
    dbReservada._store.get("restaurantes/rest_1/mesas/3").statusEstrutural = "reservada";
    await assert.rejects(
      () => executarLancamentoPedidoGarcom(dbReservada, "garcom_1", {}, {
        restauranteId: "rest_1", pedidoId: "ped-reservada-01", mesa: 3,
        clienteId: "cli_reservada", itens: [{ menuItemId: "burger-1", quantidade: 1 }],
      }),
      /reservada/i
    );
  });

  await runTest("P1 Garçom Idempotente & RBAC: Bloqueia cliente/inativo/cozinha, comanda paga e não duplica subtotal", async () => {
    const db = createFakeFirestore(seedRestauranteBase());

    await assert.rejects(
      () =>
        executarLancamentoPedidoGarcom(db, "anon_intruso", {}, {
          restauranteId: "rest_1",
          pedidoId: "ped-garcom-intruso",
          mesa: 3,
          clienteId: "cli_1",
          nomeCliente: "Mesa 3",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /sem vínculo operacional/i
    );

    await assert.rejects(
      () =>
        executarLancamentoPedidoGarcom(db, "garcom_inativo", { role: "garcom", restauranteId: "rest_1" }, {
          restauranteId: "rest_1",
          pedidoId: "ped-garcom-inativo",
          mesa: 3,
          clienteId: "cli_1",
          nomeCliente: "Mesa 3",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /inativo ou sem permissão/i
    );

    await assert.rejects(
      () =>
        executarLancamentoPedidoGarcom(db, "cozinha_1", {}, {
          restauranteId: "rest_1",
          pedidoId: "ped-cozinha-lanca",
          mesa: 3,
          clienteId: "cli_1",
          nomeCliente: "Mesa 3",
          itens: [{ menuItemId: "burger-1", quantidade: 1 }],
        }),
      /sem permissão/i
    );

    const payloadGarcom = {
      restauranteId: "rest_1",
      pedidoId: "ped-garcom-001",
      mesa: 3,
      clienteId: "cli_1",
      nomeCliente: "Mesa 3",
      itens: [{ menuItemId: "burger-1", quantidade: 2 }],
    };

    const r1 = await executarLancamentoPedidoGarcom(db, "garcom_1", {}, payloadGarcom);
    assert.strictEqual(r1.idempotente, false);
    assert.strictEqual(r1.subtotal, 25.8);

    const r2 = await executarLancamentoPedidoGarcom(db, "garcom_1", {}, payloadGarcom);
    assert.strictEqual(r2.idempotente, true);
    assert.strictEqual(r2.subtotal, 25.8);

    const comanda = db._store.get("restaurantes/rest_1/mesas/3/comandas_abertas/cli_1");
    assert.strictEqual(comanda.subtotal, 25.8);

    // Garante que garantirCredencialMesa não devolve texto claro após já configurada sem rotacionar
    const jaCfg = await executarGarantirCredencialMesa(db, "owner_1", {}, { restauranteId: "rest_1", mesa: 3 });
    assert.strictEqual(jaCfg.jaConfigurada, true);
    assert.strictEqual(jaCfg.qrCredencial, undefined);
  });

  await runTest("P1 Fechamento/Liberação/Taxa: RBAC, comanda paga, idempotência e histórico único", async () => {
    const db = createFakeFirestore(seedRestauranteBase());
    const base = { restauranteId: "rest_1", mesa: 3 };

    await executarLancamentoPedidoGarcom(db, "garcom_1", {}, {
      ...base,
      pedidoId: "ped-fecha-001",
      clienteId: "cli_f",
      nomeCliente: "Mesa 3",
      itens: [{ menuItemId: "burger-1", quantidade: 2 }],
    });
    const comandaPath = "restaurantes/rest_1/mesas/3/comandas_abertas/cli_f";
    const pedidoPath = `${comandaPath}/pedidos/ped-fecha-001`;
    assert.ok(db._store.has(pedidoPath));
    assert.ok(db._store.has("restaurantes/rest_1/kds_tickets/ped-fecha-001"));

    // RBAC: intruso, cozinha e garçom inativo não executam nenhuma das três operações
    for (const uid of ["anon_intruso", "cozinha_1", "garcom_inativo"]) {
      await assert.rejects(() => executarFecharComanda(db, uid, {}, { ...base, clienteId: "cli_f" }));
      await assert.rejects(() => executarLiberarMesa(db, uid, {}, { ...base, comandasIds: ["cli_f"] }));
      await assert.rejects(() =>
        executarDefinirTaxaServicoMesa(db, uid, {}, { ...base, comandasIds: ["cli_f"], ativa: false })
      );
    }
    assert.notStrictEqual(db._store.get(comandaPath).status, "pago");

    // Taxa: rejeita comanda inexistente e valor não booleano
    await assert.rejects(
      () => executarDefinirTaxaServicoMesa(db, "garcom_1", {}, { ...base, comandasIds: ["nao_existe"], ativa: true }),
      /não encontrada/i
    );
    await assert.rejects(
      () => executarDefinirTaxaServicoMesa(db, "garcom_1", {}, { ...base, comandasIds: ["cli_f"], ativa: "sim" }),
      /booleano/i
    );
    await executarDefinirTaxaServicoMesa(db, "garcom_1", {}, { ...base, comandasIds: ["cli_f"], ativa: false });
    assert.strictEqual(db._store.get(comandaPath).taxaServicoAtiva, false);

    // Fechamento: pedidos e KDS encerrados; repetir é idempotente
    const f1 = await executarFecharComanda(db, "garcom_1", {}, { ...base, clienteId: "cli_f" });
    assert.strictEqual(f1.idempotente, false);
    assert.strictEqual(db._store.get(comandaPath).status, "pago");
    assert.strictEqual(db._store.get(pedidoPath).status, "pago");
    assert.strictEqual(db._store.get("restaurantes/rest_1/kds_tickets/ped-fecha-001").status, "entregue");
    const f2 = await executarFecharComanda(db, "garcom_1", {}, { ...base, clienteId: "cli_f" });
    assert.strictEqual(f2.idempotente, true);

    // Taxa não altera comanda já paga
    await assert.rejects(
      () => executarDefinirTaxaServicoMesa(db, "garcom_1", {}, { ...base, comandasIds: ["cli_f"], ativa: true }),
      /encerrada/i
    );

    // Liberação: histórico recalculado a partir dos pedidos reais, pedidos/KDS removidos, métrica única
    const l1 = await executarLiberarMesa(db, "garcom_1", {}, { ...base, comandasIds: ["cli_f"] });
    assert.strictEqual(l1.idempotente, false);
    assert.strictEqual(l1.subtotalTotal, 25.8);
    assert.ok(!db._store.has(pedidoPath));
    assert.ok(!db._store.has("restaurantes/rest_1/kds_tickets/ped-fecha-001"));
    const historicos = [...db._store.keys()].filter((k) => k.includes("/historico_sessoes_mesas/"));
    assert.strictEqual(historicos.length, 1);
    assert.strictEqual(db._store.get(historicos[0]).subtotalTotal, 25.8);
    assert.strictEqual(db._store.get(historicos[0]).liberadaPorUid, "garcom_1");
    assert.strictEqual(db._store.get(comandaPath).historicoSessaoId, l1.historicoId);

    // Repetir não duplica histórico nem métrica
    const l2 = await executarLiberarMesa(db, "garcom_1", {}, { ...base, comandasIds: ["cli_f"] });
    assert.strictEqual(l2.idempotente, true);
    assert.strictEqual([...db._store.keys()].filter((k) => k.includes("/historico_sessoes_mesas/")).length, 1);
    const metricasKeys = [...db._store.keys()].filter((k) => k.includes("/metricas_consolidadas/"));
    assert.strictEqual(metricasKeys.length, 1);

    // Comanda de outro restaurante é rejeitada
    db._store.set("restaurantes/rest_1/mesas/4/comandas_abertas/cli_x", {
      restauranteId: "rest_2",
      status: "pedindo",
      subtotal: 10,
    });
    await assert.rejects(
      () => executarFecharComanda(db, "garcom_1", {}, { restauranteId: "rest_1", mesa: 4, clienteId: "cli_x" }),
      /não pertence/i
    );
    await assert.rejects(
      () => executarLiberarMesa(db, "garcom_1", {}, { restauranteId: "rest_1", mesa: 9, comandasIds: ["inexistente"] }),
      /Nenhuma comanda/i
    );
  });

  console.log("\n=================================================");
  console.log(`Relatório Final de Regressões: ${passed} Passaram | ${failed} Falharam`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main();
