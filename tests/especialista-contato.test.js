/**
 * Testes Unitários - Contato "Falar com Especialista" (Honeypot, Validação, Rate Limit, Fail-Soft)
 * Execução: node tests/especialista-contato.test.js
 */

const assert = require("assert");
const { _internal } = require("../functions/index.js");

const { executarEnviarContatoEspecialista } = _internal;

function createFakeDb() {
  const store = new Map();
  let lock = Promise.resolve();

  function makeRef(docPath) {
    return {
      path: docPath,
      id: docPath.split("/").pop(),
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

  return {
    _store: store,
    collection(col) {
      return {
        doc(id) {
          return makeRef(`${col}/${id}`);
        },
      };
    },
    runTransaction(fn) {
      const exec = lock.then(async () => {
        const writes = [];
        const tx = {
          async get(ref) {
            return ref.get();
          },
          set(ref, data, opts = {}) {
            writes.push({ path: ref.path, data, merge: Boolean(opts.merge) });
          },
        };
        const res = await fn(tx);
        for (const w of writes) {
          if (w.merge && store.has(w.path)) {
            store.set(w.path, { ...store.get(w.path), ...w.data });
          } else {
            store.set(w.path, { ...w.data });
          }
        }
        return res;
      });
      lock = exec.catch(() => {});
      return exec;
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

  await test("Validação: rejeita nome curto, e-mail inválido e mensagem vazia", async () => {
    const db = createFakeDb();
    const req = { headers: { "x-forwarded-for": "187.10.20.1" } };

    await assert.rejects(
      () => executarEnviarContatoEspecialista(db, { nome: "A", email: "a@b.com", mensagem: "1234567890" }, req),
      /nome/i
    );
    await assert.rejects(
      () => executarEnviarContatoEspecialista(db, { nome: "Maria", email: "invalido", mensagem: "1234567890" }, req),
      /e-mail/i
    );
    await assert.rejects(
      () => executarEnviarContatoEspecialista(db, { nome: "Maria", email: "maria@loja.com", mensagem: "oi" }, req),
      /mínimo 10 caracteres/i
    );
  });

  await test("Honeypot anti-bot: ignora silenciosamente sem gravar no banco", async () => {
    const db = createFakeDb();
    const req = { headers: { "x-forwarded-for": "187.10.20.2" } };

    const res = await executarEnviarContatoEspecialista(
      db,
      {
        nome: "Bot Spam",
        email: "bot@spam.com",
        mensagem: "Compre seguidores agora mesmo!",
        website: "https://spam.example.com",
      },
      req
    );
    assert.strictEqual(res.sucesso, true);
    assert.strictEqual(res.ignorado, true);
    assert.strictEqual(db._store.size, 0);
  });

  await test("Grava chamado válido e não quebra se webhook externo de notificação falhar", async () => {
    const db = createFakeDb();
    const req = { headers: { "x-forwarded-for": "187.10.20.3" } };
    process.env.NTFY_CONTATO_URL = "https://ntfy.sh/mayamenu-teste-falha";

    const failingFetch = async () => {
      throw new Error("timeout simulado");
    };

    const res = await executarEnviarContatoEspecialista(
      db,
      {
        nome: "Carlos Restaurante",
        email: "Carlos@Bistro.com.br",
        assunto: "comercial_pro",
        mensagem: "Gostaria de entender como funciona a contratação de 15 mesas extras.",
        restauranteNome: "Bistrô do Carlos",
        origem: "/admin/gerencial",
      },
      req,
      "uid_carlos",
      failingFetch
    );
    delete process.env.NTFY_CONTATO_URL;

    assert.strictEqual(res.sucesso, true);
    assert.ok(res.chamadoId.startsWith("sup-"));
    const saved = db._store.get(`chamados_suporte/${res.chamadoId}`);
    assert.strictEqual(saved.email, "carlos@bistro.com.br");
    assert.strictEqual(saved.status, "pendente");
    assert.strictEqual(saved.authUid, "uid_carlos");
  });

  await test("Rate limiting: bloqueia após 4 envios seguidos do mesmo IP", async () => {
    const db = createFakeDb();
    const req = { headers: { "x-forwarded-for": "187.10.20.99" } };

    for (let i = 0; i < 4; i++) {
      await executarEnviarContatoEspecialista(
        db,
        {
          nome: "Visitante",
          email: "visitante@teste.com",
          mensagem: "Dúvida válida número " + (i + 1) + " sobre o funcionamento.",
        },
        req
      );
    }

    await assert.rejects(
      () =>
        executarEnviarContatoEspecialista(
          db,
          {
            nome: "Visitante",
            email: "visitante@teste.com",
            mensagem: "Tentativa 5 bloqueada contra spam.",
          },
          req
        ),
      /Limite de envios/i
    );
  });

  console.log("\n=================================================");
  console.log(`Relatório Especialista/Suporte: ${passed} Passaram | ${failed} Falharam`);
  console.log("=================================================");

  if (failed > 0) process.exit(1);
}

runTests();
