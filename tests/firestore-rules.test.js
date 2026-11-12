/**
 * Suíte de Testes Automatizados para Firestore Security Rules
 * MAYaMenu - Validação de Isolamento Multi-tenant, Acesso Cruzado e Controle de Papéis
 * 
 * Cobre:
 * 1. Acesso cruzado entre Restaurantes (Tenant A vs Tenant B)
 * 2. Isolamento de Leitura em /mesas (fechado para público / clientes não autorizados)
 * 3. Criação de Pedidos e Comandas (Titularidade e travas contra comanda paga)
 * 4. Fila da Cozinha (kds_tickets) restrita à equipe
 * 5. CollectionGroup queries estritamente vinculadas ao restaurante
 * 6. SuperAdmin global com acesso controlado exclusivamente por custom claim
 */

const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "mayamenu-bd";
let testEnv;

async function setup() {
  const rules = fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("Iniciando Suíte de Testes de Regras do Firestore");
  console.log("=================================================\n");

  await setup();

  // Cenário Base: Pré-carregar Restaurantes A e B usando contexto de administrador
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    
    // Restaurante A (Dono: owner_a)
    await db.doc("restaurantes/rest_a").set({
      nome: "Restaurante A",
      ownerId: "owner_a",
      plano: "free",
    });

    // Restaurante B (Dono: owner_b)
    await db.doc("restaurantes/rest_b").set({
      nome: "Restaurante B",
      ownerId: "owner_b",
      plano: "free",
    });

    // Mesa 1 no Restaurante A
    await db.doc("restaurantes/rest_a/mesas/1").set({
      numero: 1,
      ativa: true,
      statusEstrutural: "livre",
    });

    // Mesa 1 no Restaurante B
    await db.doc("restaurantes/rest_b/mesas/1").set({
      numero: 1,
      ativa: true,
      statusEstrutural: "livre",
    });

    // Comanda aberta no Restaurante A para cliente_1
    await db.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").set({
      id: "cliente_1",
      clienteId: "cliente_1",
      restauranteId: "rest_a",
      status: "pedindo",
      total: 0,
    });

    // Pedido 1 do cliente_1 na comanda do Restaurante A
    await db.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_1").set({
      id: "ped_1",
      clienteId: "cliente_1",
      restauranteId: "rest_a",
      status: "a_fazer",
      pratoNome: "Hambúrguer A",
    });

    // Comanda aberta no Restaurante B para cliente_b
    await db.doc("restaurantes/rest_b/mesas/1/comandas_abertas/cliente_b").set({
      id: "cliente_b",
      clienteId: "cliente_b",
      restauranteId: "rest_b",
      status: "pedindo",
      total: 0,
    });

    // Pedido 1 do cliente_b no Restaurante B
    await db.doc("restaurantes/rest_b/mesas/1/comandas_abertas/cliente_b/pedidos/ped_b1").set({
      id: "ped_b1",
      clienteId: "cliente_b",
      restauranteId: "rest_b",
      status: "a_fazer",
      pratoNome: "Pizza B",
    });

    // Comanda PAGA no Restaurante A para cliente_2
    await db.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_2").set({
      id: "cliente_2",
      clienteId: "cliente_2",
      restauranteId: "rest_a",
      status: "pago",
      total: 50,
    });

    // KDS Ticket no Restaurante A
    await db.doc("restaurantes/rest_a/kds_tickets/ticket_1").set({
      pratoNome: "Hambúrguer Gourmet",
      status: "a_fazer",
      restauranteId: "rest_a",
    });
  });

  let passed = 0;
  let failed = 0;

  async function test(nome, fn) {
    try {
      await fn();
      console.log(`[PASSOU] ${nome}`);
      passed++;
    } catch (err) {
      console.error(`[FALHOU] ${nome}:`, err.message);
      failed++;
    }
  }

  // 1. ISOLAMENTO DE MESAS
  await test("Público/Anônimo NÃO pode ler /mesas", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.doc("restaurantes/rest_a/mesas/1").get());
  });

  await test("Cliente comum NÃO pode ler /mesas", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(clientDb.doc("restaurantes/rest_a/mesas/1").get());
  });

  await test("Garçom do Restaurante A PODE ler /mesas do Restaurante A", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertSucceeds(garcomADb.doc("restaurantes/rest_a/mesas/1").get());
  });

  await test("Garçom do Restaurante B NÃO pode ler /mesas do Restaurante A (Acesso Cruzado)", async () => {
    const garcomBDb = testEnv.authenticatedContext("garcom_b", {
      role: "garcom",
      restauranteId: "rest_b",
    }).firestore();
    await assertFails(garcomBDb.doc("restaurantes/rest_a/mesas/1").get());
  });

  await test("Dono do Restaurante A PODE ler e escrever /mesas do Restaurante A", async () => {
    const ownerADb = testEnv.authenticatedContext("owner_a", {
      role: "owner",
      restauranteId: "rest_a",
    }).firestore();
    await assertSucceeds(ownerADb.doc("restaurantes/rest_a/mesas/1").update({ ativa: false }));
  });

  await test("Dono do Restaurante B NÃO pode alterar /mesas do Restaurante A (Acesso Cruzado)", async () => {
    const ownerBDb = testEnv.authenticatedContext("owner_b", {
      role: "owner",
      restauranteId: "rest_b",
    }).firestore();
    await assertFails(ownerBDb.doc("restaurantes/rest_a/mesas/1").update({ ativa: false }));
  });

  // 2. COMANDAS E CHECKOUT
  await test("Cliente Titular PODE ler sua própria comanda aberta", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertSucceeds(clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").get());
  });

  await test("Outro Cliente NÃO pode ler a comanda alheia", async () => {
    const outroClientDb = testEnv.authenticatedContext("cliente_intruso").firestore();
    await assertFails(outroClientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").get());
  });

  await test("Cliente NÃO pode alterar comanda para 'pago' (Trava Antifraude)", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({ status: "pago" })
    );
  });

  await test("Cliente NÃO pode adicionar pedido em comanda que já está PAGA", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_2").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_2/pedidos/ped_novo").set({
        restauranteId: "rest_a",
        pratoNome: "Sobremesa",
        status: "a_fazer",
        quantidade: 1,
      })
    );
  });

  await test("Cliente NÃO pode criar pedido forjando restauranteId diferente do path (Tentativa de Falsificação Multi-tenant)", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_fake").set({
        restauranteId: "rest_b", // Falsificação deliberada!
        pratoNome: "Item Invasor",
        status: "a_fazer",
        quantidade: 1,
      })
    );
  });

  await test("Cliente Titular PODE criar pedido em comanda aberta informando o restauranteId correto", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertSucceeds(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_novo_valido").set({
        restauranteId: "rest_a",
        pratoNome: "Suco Natural",
        status: "a_fazer",
        quantidade: 1,
      })
    );
  });

  // 3. CONSULTAS COLLECTIONGROUP E ISOLAMENTO MULTI-TENANT
  await test("Garçom do Restaurante A PODE consultar collectionGroup de comandas do Restaurante A", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    const q = garcomADb.collectionGroup("comandas_abertas").where("restauranteId", "==", "rest_a");
    await assertSucceeds(q.get());
  });

  await test("Garçom do Restaurante A NÃO pode consultar collectionGroup de comandas do Restaurante B", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    const q = garcomADb.collectionGroup("comandas_abertas").where("restauranteId", "==", "rest_b");
    await assertFails(q.get());
  });

  await test("Cozinha do Restaurante A PODE consultar collectionGroup de pedidos do Restaurante A", async () => {
    const cozinhaADb = testEnv.authenticatedContext("cozinha_a", {
      role: "cozinha",
      restauranteId: "rest_a",
    }).firestore();
    const q = cozinhaADb.collectionGroup("pedidos").where("restauranteId", "==", "rest_a");
    await assertSucceeds(q.get());
  });

  await test("Cozinha do Restaurante A NÃO pode consultar collectionGroup de pedidos do Restaurante B (Acesso Cruzado)", async () => {
    const cozinhaADb = testEnv.authenticatedContext("cozinha_a", {
      role: "cozinha",
      restauranteId: "rest_a",
    }).firestore();
    const q = cozinhaADb.collectionGroup("pedidos").where("restauranteId", "==", "rest_b");
    await assertFails(q.get());
  });

  await test("Cliente Titular PODE ler seu pedido individual via collectionGroup", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    const q = clientDb.collectionGroup("pedidos").where("clienteId", "==", "cliente_1");
    await assertSucceeds(q.get());
  });

  await test("Cliente Intruso NÃO pode ler pedidos de outro cliente via collectionGroup", async () => {
    const intrusoDb = testEnv.authenticatedContext("cliente_intruso").firestore();
    const q = intrusoDb.collectionGroup("pedidos").where("clienteId", "==", "cliente_1");
    await assertFails(q.get());
  });

  // 3. FILA DA COZINHA (KDS TICKETS)
  await test("Público NÃO pode ler kds_tickets", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.doc("restaurantes/rest_a/kds_tickets/ticket_1").get());
  });

  await test("Cozinha do Restaurante A PODE ler kds_tickets do Restaurante A", async () => {
    const cozinhaADb = testEnv.authenticatedContext("cozinha_a", {
      role: "cozinha",
      restauranteId: "rest_a",
    }).firestore();
    await assertSucceeds(cozinhaADb.doc("restaurantes/rest_a/kds_tickets/ticket_1").get());
  });

  await test("Cozinha do Restaurante B NÃO pode ler kds_tickets do Restaurante A (Isolamento)", async () => {
    const cozinhaBDb = testEnv.authenticatedContext("cozinha_b", {
      role: "cozinha",
      restauranteId: "rest_b",
    }).firestore();
    await assertFails(cozinhaBDb.doc("restaurantes/rest_a/kds_tickets/ticket_1").get());
  });

  // 4. SUPERADMIN GLOBAL
  await test("SuperAdmin com claim token.superadmin==true PODE ler mesas de qualquer restaurante", async () => {
    const adminDb = testEnv.authenticatedContext("admin_uid", {
      superadmin: true,
    }).firestore();
    await assertSucceeds(adminDb.doc("restaurantes/rest_a/mesas/1").get());
    await assertSucceeds(adminDb.doc("restaurantes/rest_b/mesas/1").get());
  });

  await test("Usuário apenas com e-mail de admin sem claim NÃO tem acesso de superadmin", async () => {
    const fakeAdminDb = testEnv.authenticatedContext("fake_uid", {
      email: "admin@mayamenu.com",
    }).firestore();
    await assertFails(fakeAdminDb.doc("restaurantes/rest_a/mesas/1").get());
  });

  console.log("\n=================================================");
  console.log(`Relatório Final de Testes: ${passed} Passaram | ${failed} Falharam`);
  console.log("=================================================");

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Erro fatal ao rodar testes:", err);
  process.exit(1);
});

