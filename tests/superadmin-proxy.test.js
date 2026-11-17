/**
 * Testes unitários de sessão, decodificação JWT base64url e redirecionamento do Proxy SuperAdmin.
 * Execução: node tests/superadmin-proxy.test.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const tsSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "superadmin-auth.ts"),
  "utf8"
);
const compiled = esbuild.transformSync(tsSource, {
  loader: "ts",
  format: "cjs",
  target: "node20",
});

const moduleObj = { exports: {} };
const fn = new Function("exports", "module", "require", compiled.code);
fn(moduleObj.exports, moduleObj, require);

const {
  avaliarTokenSessaoSuperadmin,
  isSafeInternalRedirect,
  isPrivilegedSuperadminPath,
} = moduleObj.exports;

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

let passed = 0;
let failed = 0;

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`[PASSOU] ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`[FALHOU] ${name}:`, err);
    failed += 1;
  }
}

const NOW_MS = 1_800_000_000_000;
const FUTURE_EXP = Math.floor(NOW_MS / 1000) + 3600;
const PAST_EXP = Math.floor(NOW_MS / 1000) - 60;

runTest("Cookie ausente ou malformado redireciona para login", () => {
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin(undefined, NOW_MS), {
    autorizado: false,
    motivo: "sem_cookie",
  });
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin("token-invalido", NOW_MS), {
    autorizado: false,
    motivo: "token_invalido",
  });
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin("a.!!!.b", NOW_MS), {
    autorizado: false,
    motivo: "token_invalido",
  });
});

runTest("Token expirado ou anônimo não causa 404 silencioso e força novo login", () => {
  const expirado = makeJwt({
    email: "marcus1fialho@gmail.com",
    exp: PAST_EXP,
  });
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin(expirado, NOW_MS), {
    autorizado: false,
    motivo: "token_expirado",
  });

  const anonimo = makeJwt({
    firebase: { sign_in_provider: "anonymous" },
    exp: FUTURE_EXP,
  });
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin(anonimo, NOW_MS), {
    autorizado: false,
    motivo: "anonimo",
  });
});

runTest("Usuário autenticado comum sinaliza conta_sem_permissao sem liberar painel", () => {
  const restauranteJwt = makeJwt({
    email: "dono@restaurante.com",
    role: "owner",
    exp: FUTURE_EXP,
  });
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin(restauranteJwt, NOW_MS), {
    autorizado: false,
    motivo: "conta_sem_permissao",
    email: "dono@restaurante.com",
  });
});

runTest("Operador autorizado via e-mail whitelist ou claim superadmin passa com base64url", () => {
  const emailJwt = makeJwt({
    email: "Marcus1Fialho@gmail.com",
    note: "~~~???___utf8-çãõ",
    exp: FUTURE_EXP,
  });
  assert.strictEqual(
    emailJwt.split(".")[1].includes("-") && emailJwt.split(".")[1].includes("_"),
    true
  );
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin(emailJwt, NOW_MS), {
    autorizado: true,
    motivo: "autorizado",
    email: "marcus1fialho@gmail.com",
  });

  const claimJwt = makeJwt({
    email: "operador@parceiro.com",
    superadmin: true,
    exp: FUTURE_EXP,
  });
  assert.deepStrictEqual(avaliarTokenSessaoSuperadmin(claimJwt, NOW_MS), {
    autorizado: true,
    motivo: "autorizado",
    email: "operador@parceiro.com",
  });
});

runTest("Valida redirecionamento interno seguro e rotas privilegiadas", () => {
  assert.strictEqual(isSafeInternalRedirect("/superadmin"), true);
  assert.strictEqual(isSafeInternalRedirect("//evil.com"), false);
  assert.strictEqual(isSafeInternalRedirect("https://evil.com"), false);
  assert.strictEqual(isPrivilegedSuperadminPath("/superadmin"), true);
  assert.strictEqual(isPrivilegedSuperadminPath("/superadmin/diagnostico"), true);
  assert.strictEqual(isPrivilegedSuperadminPath("/hq/ajuda"), true);
  assert.strictEqual(isPrivilegedSuperadminPath("/admin/operacao"), false);
  assert.strictEqual(isPrivilegedSuperadminPath("//superadmin"), false);
});

console.log("\n=================================================");
console.log(`Relatório Proxy SuperAdmin: ${passed} Passaram | ${failed} Falharam`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
}
