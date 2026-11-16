/**
 * Testes Unitários - QR Codes de Acesso Rápido por Setor (Cozinha, Salão, Admin)
 * Execução: node tests/qr-acesso-setor.test.js
 */

const assert = require("assert");
const crypto = require("crypto");
const { _internal } = require("../functions/index.js");

const {
  validarMembroEquipeParaLogin,
  executarGerenciarQrAcessoSetor,
  executarLoginComQrSetor,
} = _internal;

function hashQr(cred) {
  return crypto.createHash("sha256").update(String(cred)).digest("hex");
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

function seedBase() {
  return {
    "restaurantes/rest_1": {
      nome: "Bistrô Teste",
      slug: "bistro-teste",
      ownerId: "owner_1",
      maxMesas: 20,
    },
    "restaurantes/rest_1/equipe/garcom_1": {
      uid: "garcom_1",
      nome: "Garçom Teste",
      role: "garcom",
      ativo: true,
    },
  };
}

function createMockAuth() {
  const revokedUids = [];
  const mintedTokens = [];
  return {
    revokedUids,
    mintedTokens,
    async revokeRefreshTokens(uid) {
      revokedUids.push(uid);
    },
    async createCustomToken(uid, claims) {
      const tok = `custom_${uid}_${claims.role}_${mintedTokens.length + 1}`;
      mintedTokens.push({ uid, claims, tok });
      return tok;
    },
  };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
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

  await test("Autorização: apenas proprietário/superadmin pode gerenciar QR de setor", async () => {
    const db = createFakeFirestore(seedBase());
    const auth = createMockAuth();

    await assert.rejects(
      () => executarGerenciarQrAcessoSetor(db, null, {}, { restauranteId: "rest_1", setor: "cozinha", acao: "emitir" }, auth),
      /Autenticação necessária/i
    );
    await assert.rejects(
      () => executarGerenciarQrAcessoSetor(db, "garcom_1", {}, { restauranteId: "rest_1", setor: "cozinha", acao: "emitir" }, auth),
      /proprietário/i
    );
  });

  await test("Cozinha (Módulo Chef): emite apenas hash SHA-256, cria vínculo oculto e bloqueia login por PIN", async () => {
    const db = createFakeFirestore(seedBase());
    const auth = createMockAuth();

    const emitido = await executarGerenciarQrAcessoSetor(
      db,
      "owner_1",
      {},
      { restauranteId: "rest_1", setor: "cozinha", acao: "emitir" },
      auth
    );
    assert.strictEqual(emitido.sucesso, true);
    assert.strictEqual(emitido.versao, 1);
    assert.strictEqual(emitido.ativo, true);
    assert.ok(emitido.token && emitido.token.length === 48);

    const restDoc = db._store.get("restaurantes/rest_1");
    assert.strictEqual(restDoc.acessosSetores.cozinha.ativo, true);
    assert.strictEqual(restDoc.acessosSetores.cozinha.versao, 1);
    assert.strictEqual(restDoc.acessosSetores.cozinha.hash, hashQr(emitido.token));
    assert.strictEqual(restDoc.acessosSetores.cozinha.token, undefined);

    const staffDoc = db._store.get("restaurantes/rest_1/equipe/qr_setor_cozinha_rest_1");
    assert.strictEqual(staffDoc.ativo, true);
    assert.strictEqual(staffDoc.role, "cozinha");
    assert.strictEqual(staffDoc.tipo, "qr_setor");
    assert.strictEqual(staffDoc.ocultoListaPin, true);
    assert.strictEqual(validarMembroEquipeParaLogin(staffDoc, "qr_setor_cozinha_rest_1"), false);
  });

  await test("Login Cozinha e Salão: autentica por slug/ID e isola setores", async () => {
    const db = createFakeFirestore(seedBase());
    const auth = createMockAuth();
    const req = { headers: { "x-forwarded-for": "187.50.10.2" } };

    const cozinha = await executarGerenciarQrAcessoSetor(
      db,
      "owner_1",
      {},
      { restauranteId: "rest_1", setor: "cozinha", acao: "emitir" },
      auth
    );

    const loginOk = await executarLoginComQrSetor(
      db,
      { restauranteId: "bistro-teste", setor: "cozinha", token: cozinha.token },
      req,
      auth
    );
    assert.strictEqual(loginOk.sucesso, true);
    assert.strictEqual(loginOk.role, "cozinha");
    assert.strictEqual(loginOk.restauranteId, "rest_1");
    assert.strictEqual(auth.mintedTokens[0].uid, "qr_setor_cozinha_rest_1");
    assert.deepStrictEqual(auth.mintedTokens[0].claims, {
      role: "cozinha",
      restauranteId: "rest_1",
      acessoQrSetor: "cozinha",
    });

    await assert.rejects(
      () => executarLoginComQrSetor(db, { restauranteId: "rest_1", setor: "garcom", token: cozinha.token }, req, auth),
      /inválido/i
    );
  });

  await test("Rotação e Revogação: invalida token antigo, apaga hash e revoga refresh tokens", async () => {
    const db = createFakeFirestore(seedBase());
    const auth = createMockAuth();
    const req = { headers: { "x-forwarded-for": "187.50.10.3" } };

    const v1 = await executarGerenciarQrAcessoSetor(
      db,
      "owner_1",
      {},
      { restauranteId: "rest_1", setor: "cozinha", acao: "emitir" },
      auth
    );
    const v2 = await executarGerenciarQrAcessoSetor(
      db,
      "owner_1",
      {},
      { restauranteId: "rest_1", setor: "cozinha", acao: "rotacionar" },
      auth
    );
    assert.strictEqual(v2.versao, 2);
    assert.notStrictEqual(v2.token, v1.token);
    assert.ok(auth.revokedUids.includes("qr_setor_cozinha_rest_1"));

    await assert.rejects(
      () => executarLoginComQrSetor(db, { restauranteId: "rest_1", setor: "cozinha", token: v1.token }, req, auth),
      /inválido/i
    );

    const okV2 = await executarLoginComQrSetor(
      db,
      { restauranteId: "rest_1", setor: "cozinha", token: v2.token },
      req,
      auth
    );
    assert.strictEqual(okV2.sucesso, true);

    await executarGerenciarQrAcessoSetor(
      db,
      "owner_1",
      {},
      { restauranteId: "rest_1", setor: "cozinha", acao: "revogar" },
      auth
    );
    const restAposRevogar = db._store.get("restaurantes/rest_1");
    assert.strictEqual(restAposRevogar.acessosSetores.cozinha.ativo, false);
    assert.strictEqual(restAposRevogar.acessosSetores.cozinha.hash, undefined);
    assert.strictEqual(db._store.get("restaurantes/rest_1/equipe/qr_setor_cozinha_rest_1").ativo, false);
    await assert.rejects(
      () => executarLoginComQrSetor(db, { restauranteId: "rest_1", setor: "cozinha", token: v2.token }, req, auth),
      /inválido/i
    );
  });

  await test("Admin Opcional: emite, autentica owner_1 e revoga sem deixar vínculo em equipe", async () => {
    const db = createFakeFirestore(seedBase());
    const auth = createMockAuth();
    const req = { headers: { "x-forwarded-for": "187.50.10.4" } };

    const adminQr = await executarGerenciarQrAcessoSetor(
      db,
      "owner_1",
      {},
      { restauranteId: "rest_1", setor: "admin", acao: "emitir" },
      auth
    );
    assert.strictEqual(db._store.get("restaurantes/rest_1/equipe/qr_setor_admin_rest_1"), undefined);

    const loginAdmin = await executarLoginComQrSetor(
      db,
      { restauranteId: "rest_1", setor: "admin", token: adminQr.token },
      req,
      auth
    );
    assert.strictEqual(loginAdmin.role, "owner");
    assert.strictEqual(auth.mintedTokens[0].uid, "owner_1");

    await executarGerenciarQrAcessoSetor(
      db,
      "owner_1",
      {},
      { restauranteId: "rest_1", setor: "admin", acao: "revogar" },
      auth
    );
    await assert.rejects(
      () => executarLoginComQrSetor(db, { restauranteId: "rest_1", setor: "admin", token: adminQr.token }, req, auth),
      /inválido/i
    );
  });

  await test("Rate Limiting: bloqueia tentativas inválidas repetidas por IP e setor", async () => {
    const db = createFakeFirestore(seedBase());
    const auth = createMockAuth();
    const req = { headers: { "x-forwarded-for": "203.0.113.77" } };

    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        () => executarLoginComQrSetor(db, { restauranteId: "rest_1", setor: "garcom", token: "token_falso_invalido_123456" }, req, auth),
        /inválido/i
      );
    }

    await assert.rejects(
      () => executarLoginComQrSetor(db, { restauranteId: "rest_1", setor: "garcom", token: "token_falso_invalido_123456" }, req, auth),
      /bloqueado temporariamente/i
    );
  });

  console.log("\n=================================================");
  console.log(`Relatório Final QR de Setor: ${passed} Passaram | ${failed} Falharam`);
  console.log("=================================================");

  if (failed > 0) process.exit(1);
}

runTests();
