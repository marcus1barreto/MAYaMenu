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
    await db.doc("restaurantes_publicos/rest_a").set({
      restauranteId: "rest_a", slug: "rest-a", nome: "Restaurante A", suspenso: false,
      configuracoes: { corPrimaria: "#E11D48", tema: "light", modoOperacao: "hibrido" },
    });
    await db.doc("restaurantes_publicos/rest_b").set({
      restauranteId: "rest_b", slug: "rest-b", nome: "Restaurante B", suspenso: false,
      configuracoes: { corPrimaria: "#E11D48", tema: "light", modoOperacao: "hibrido" },
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

    // Equipe ativa e inativa
    await db.doc("restaurantes/rest_a/equipe/garcom_a").set({ role: "garcom", ativo: true });
    await db.doc("restaurantes/rest_a/equipe/cozinha_a").set({ role: "cozinha", ativo: true });
    await db.doc("restaurantes/rest_a/equipe/garcom_inativo").set({ role: "garcom", ativo: false });
    await db.doc("restaurantes/rest_b/equipe/garcom_b").set({ role: "garcom", ativo: true });
    await db.doc("restaurantes/rest_b/equipe/cozinha_b").set({ role: "cozinha", ativo: true });

    await db.doc("restaurantes/rest_a/cardapio/item_normal").set({
      id: "item_normal", nome: "Item normal", precoBase: 10, ativo: true,
    });
    await db.doc("restaurantes/rest_a/cardapio/spn_item").set({
      id: "spn_item", nome: "Produto patrocinado", precoBase: 12, ativo: true,
      origemPatrocinadorId: "pat_a", patrocinioId: "lote_a", idMaster: "master_1",
      bloqueadoParaExclusao: true, posicaoFixaTopo: true, seloPatrocinador: "Parceiro Oficial",
    });

    // Patrocinadores e dados B2B usados nos testes de isolamento.
    await db.doc("patrocinadores/pat_a").set({
      nomeFantasia: "Patrocinador A", chaveAcessoB2B: "CHAVE-SECRETA-A", ativo: true,
    });
    await db.doc("patrocinadores/pat_b").set({
      nomeFantasia: "Patrocinador B", chaveAcessoB2B: "CHAVE-SECRETA-B", ativo: true,
    });
    await db.doc("patrocinadores/pat_a/catalogo_master/item_a").set({ id: "item_a", nome: "Produto A" });
    await db.doc("patrocinadores/pat_a/metricas_sellout/item_a").set({
      patrocinadorId: "pat_a", itemId: "item_a", totalUnidadesVendidas: 10,
    });

    // Lotes de licenças B2B por patrocinador
    await db.doc("patrocinadores/pat_a/lotes_licencas/lote_a1").set({
      patrocinadorId: "pat_a",
      codigoCampanha: "CAMP_A",
      ativo: true,
    });
    await db.doc("patrocinadores/pat_b/lotes_licencas/lote_b1").set({
      patrocinadorId: "pat_b",
      codigoCampanha: "CAMP_B",
      ativo: true,
    });

    // Concessão disponível para teste de ativação controlada
    await db.doc("concessoes/lic_1").set({
      codigo: "LIC-TESTE-1",
      plano: "free",
      status: "disponivel",
    });
    await db.doc("concessoes/lic_2").set({ codigo: "LIC-TESTE-2", plano: "free", status: "disponivel" });
    await db.doc("concessoes/lic_3").set({ codigo: "LIC-TESTE-3", plano: "free", status: "disponivel" });
    await db.doc("concessoes/lic_4").set({ codigo: "LIC-TESTE-4", plano: "free", status: "suspensa" });
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

  await test("Restaurante: raiz privada, perfil público minimizado e titularidade/plano imutáveis pelo lojista", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const ownerDb = testEnv.authenticatedContext("owner_a", {
      role: "owner", restauranteId: "rest_a",
    }).firestore();
    const otherDb = testEnv.authenticatedContext("intruso").firestore();
    const superadminDb = testEnv.authenticatedContext("admin_uid", { superadmin: true }).firestore();
    await assertFails(anonDb.doc("concessoes/lic_1").get());
    await assertFails(ownerDb.doc("concessoes/lic_1").get());
    await assertSucceeds(superadminDb.doc("concessoes/lic_1").get());
    await assertSucceeds(anonDb.doc("restaurantes_publicos/rest_a").get());
    await assertFails(anonDb.doc("restaurantes/rest_a").get());
    await assertSucceeds(ownerDb.doc("restaurantes/rest_a").get());
    await assertFails(otherDb.doc("restaurantes/rest_a").get());
    await assertFails(ownerDb.doc("restaurantes/rest_a").update({ ownerId: "intruso" }));
    await assertFails(ownerDb.doc("restaurantes/rest_c").set({
      ownerId: "owner_a", slug: "rest-c", nome: "Tentativa de tenant direto",
    }));
    await assertFails(ownerDb.doc("restaurantes/rest_a").update({ plano: "pro", patrocinio: { ativo: true } }));
    await assertFails(ownerDb.doc("restaurantes_publicos/rest_a").update({ nome: "perfil adulterado" }));
  });

  await test("Cardápio: lojista não pode forjar, editar ou excluir itens patrocinados", async () => {
    const ownerDb = testEnv.authenticatedContext("owner_a", {
      role: "owner", restauranteId: "rest_a",
    }).firestore();
    await assertSucceeds(ownerDb.doc("restaurantes/rest_a/cardapio/item_normal").update({ precoBase: 11 }));
    await assertSucceeds(ownerDb.doc("restaurantes/rest_a/cardapio/item_novo").set({
      id: "item_novo", nome: "Novo item", precoBase: 8, ativo: true,
    }));
    await assertFails(ownerDb.doc("restaurantes/rest_a/cardapio/item_falso").set({
      id: "item_falso", nome: "Falso patrocinado", precoBase: 1,
      origemPatrocinadorId: "pat_a", bloqueadoParaExclusao: true,
    }));
    await assertFails(ownerDb.doc("restaurantes/rest_a/cardapio/spn_falso").set({
      id: "spn_falso", nome: "Produto com prefixo reservado", precoBase: 1,
    }));
    await assertFails(ownerDb.doc("restaurantes/rest_a/cardapio/spn_item").update({
      origemPatrocinadorId: "pat_b",
    }));
    await assertFails(ownerDb.doc("restaurantes/rest_a/cardapio/spn_item").update({
      bloqueadoParaExclusao: false,
    }));
    await assertFails(ownerDb.doc("restaurantes/rest_a/cardapio/spn_item").delete());
  });

  await test("B2B: documentos contratuais são privados e a sessão sponsor acessa somente seu tenant", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const sponsorADb = testEnv.authenticatedContext("pat_a", {
      role: "sponsor", patrocinadorId: "pat_a", authVersion: 0,
    }).firestore();
    const sponsorBDb = testEnv.authenticatedContext("pat_b", {
      role: "sponsor", patrocinadorId: "pat_b", authVersion: 0,
    }).firestore();
    await assertFails(anonDb.doc("patrocinadores/pat_a").get());
    await assertFails(anonDb.doc("patrocinadores/pat_a/catalogo_master/item_a").get());
    await assertFails(anonDb.doc("patrocinadores/pat_a/lotes_licencas/lote_a1").get());
    await assertFails(anonDb.doc("patrocinadores/pat_a/metricas_sellout/item_a").get());
    await assertSucceeds(sponsorADb.doc("patrocinadores/pat_a").get());
    await assertSucceeds(sponsorADb.doc("patrocinadores/pat_a/catalogo_master/item_a").get());
    await assertSucceeds(sponsorADb.doc("patrocinadores/pat_a/lotes_licencas/lote_a1").get());
    await assertSucceeds(sponsorADb.doc("patrocinadores/pat_a/metricas_sellout/item_a").get());
    await assertFails(sponsorADb.doc("patrocinadores/pat_a/metricas_sellout/item_a").update({ totalUnidadesVendidas: 999 }));
    await assertFails(sponsorBDb.doc("patrocinadores/pat_a").get());
    await assertFails(anonDb.doc("restaurantes/rest_a/_sellout_outbox/evento_fake").get());
    await assertFails(sponsorADb.doc("patrocinadores/pat_a/metricas_sellout_eventos/evento_fake").set({ eventId: "fake" }));
    await assertFails(sponsorADb.doc("patrocinadores/pat_a").update({ chaveAcessoB2B: "ROUBADA" }));
    await assertSucceeds(sponsorADb.doc("patrocinadores/pat_a/catalogo_master/item_b").set({ id: "item_b", nome: "Produto B" }));
    await assertFails(sponsorADb.doc("patrocinadores/pat_a/lotes_licencas/lote_b").set({ codigoCampanha: "FORJADO" }));
    const adminDb = testEnv.authenticatedContext("admin_uid", { superadmin: true }).firestore();
    await assertSucceeds(adminDb.doc("patrocinadores/pat_a").update({ ativo: false, authVersion: 2 }));
    await assertFails(sponsorADb.doc("patrocinadores/pat_a/catalogo_master/item_a").get());
    // Restaura o tenant para os testes subsequentes; o contexto antigo continua inválido.
    await assertSucceeds(adminDb.doc("patrocinadores/pat_a").update({ ativo: true, authVersion: 0 }));
  });

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
  await test("Cliente Titular NÃO pode criar comanda aberta diretamente no Firestore (apenas Cloud Function)", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_novo").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_novo").set({
        id: "cliente_novo",
        clienteId: "cliente_novo",
        restauranteId: "rest_a",
        status: "pedindo",
      })
    );
  });

  await test("Cliente NÃO pode criar comanda forjando restauranteId de outro restaurante (Anti-spoofing Multi-tenant)", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_hacker").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_hacker").set({
        id: "cliente_hacker",
        clienteId: "cliente_hacker",
        restauranteId: "rest_b", // Tentativa de forjar restaurante B no caminho do restaurante A
        status: "pedindo",
      })
    );
  });

  await test("Cliente NÃO pode alterar restauranteId de comanda já existente (Imutabilidade de Tenant)", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        restauranteId: "rest_b",
      })
    );
  });

  await test("Equipe NÃO pode alterar restauranteId de pedido existente (Imutabilidade em Pedidos)", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_1").update({
        restauranteId: "rest_b",
      })
    );
  });

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

  await test("Cliente Titular NÃO pode criar pedido diretamente no Firestore (apenas Cloud Function)", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_novo_valido").set({
        restauranteId: "rest_a",
        pratoNome: "Suco Natural",
        status: "a_fazer",
        quantidade: 1,
      })
    );
  });

  await test("Cliente NÃO pode manipular subtotal ou total da própria comanda aberta", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        subtotal: 0.01,
      })
    );
  });

  await test("Cliente NÃO pode alterar chamadoGarcom diretamente; deve usar callable com QR e cooldown", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        chamadoGarcom: { ativo: true, motivo: "Água" },
      })
    );
  });

  await test("Garçom desativado (ativo: false) com claim obsoleta NÃO pode ler mesas, atualizar pedidos ou ler comandas", async () => {
    const inactiveWaiterDb = testEnv.authenticatedContext("garcom_inativo", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(inactiveWaiterDb.doc("restaurantes/rest_a/mesas/1").get());
    await assertFails(
      inactiveWaiterDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_1").update({
        status: "pronto",
      })
    );
    await assertFails(
      inactiveWaiterDb.collectionGroup("comandas_abertas").where("restauranteId", "==", "rest_a").get()
    );
  });

  await test("Garçom ativo NÃO pode alterar subtotal de pedido existente (apenas status/atualizadoEm)", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_1").update({
        subtotal: 0,
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

  await test("Cliente comum NÃO pode criar kds_ticket diretamente (Elimina injeção arbitrária na cozinha)", async () => {
    const cliente1Db = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      cliente1Db.doc("restaurantes/rest_a/kds_tickets/ticket_cliente_1").set({
        id: "ticket_cliente_1",
        mesa: 1,
        clienteId: "cliente_1",
        status: "a_fazer",
        itens: [{ menuItemId: "item1", nome: "Hambúrguer", quantidade: 1 }],
      })
    );
  });

  await test("Usuário invasor NÃO pode criar kds_ticket em restaurante", async () => {
    const intrusoDb = testEnv.authenticatedContext("usuario_qualquer").firestore();
    await assertFails(
      intrusoDb.doc("restaurantes/rest_a/kds_tickets/ticket_invasor").set({
        id: "ticket_invasor",
        mesa: 1,
        clienteId: "usuario_qualquer",
        status: "a_fazer",
        itens: [{ menuItemId: "item1", nome: "Item Invasor", quantidade: 1 }],
      })
    );
  });

  await test("Garçom do Restaurante A NÃO pode criar kds_ticket diretamente no Firestore (apenas Cloud Function)", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/kds_tickets/ticket_garcom_1").set({
        id: "ticket_garcom_1",
        mesa: 1,
        clienteId: "cliente_1",
        status: "a_fazer",
        itens: [{ menuItemId: "item1", nome: "Hambúrguer", quantidade: 1 }],
      })
    );
  });

  await test("Patrocinador NÃO pode ler lotes_licencas de outro patrocinador via collectionGroup", async () => {
    const patBDb = testEnv.authenticatedContext("pat_b", {
      role: "sponsor", patrocinadorId: "pat_b", authVersion: 0,
    }).firestore();
    await assertFails(
      patBDb.collectionGroup("lotes_licencas").where("patrocinadorId", "==", "pat_a").get()
    );
    const patADb = testEnv.authenticatedContext("pat_a", {
      role: "sponsor", patrocinadorId: "pat_a", authVersion: 0,
    }).firestore();
    await assertSucceeds(
      patADb.collectionGroup("lotes_licencas").where("patrocinadorId", "==", "pat_a").get()
    );
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

  await test("Dono/Garçom consegue liberar mesa reservada removendo reserva com deleteField()", async () => {
    const { deleteField } = require("firebase/firestore");
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();

    const mesaRef = garcomADb.doc("restaurantes/rest_a/mesas/7");
    await assertSucceeds(
      mesaRef.set(
        {
          numero: 7,
          ativa: true,
          statusEstrutural: "reservada",
          reserva: { nomeCliente: "Ana", horario: "20:00", quantidadePessoas: 4 },
        },
        { merge: true }
      )
    );

    await assertSucceeds(
      mesaRef.set(
        {
          numero: 7,
          statusEstrutural: "livre",
          reserva: deleteField(),
        },
        { merge: true }
      )
    );

    const snap = await mesaRef.get();
    const mesaData = snap.data();
    if (mesaData.statusEstrutural !== "livre" || mesaData.reserva !== undefined) {
      throw new Error(`Reserva não foi removida corretamente: ${JSON.stringify(mesaData)}`);
    }
  });

  await test("Garçom/Dono NÃO pode alterar subtotal/total de comanda aberta diretamente", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        subtotal: 0,
      })
    );
    const ownerADb = testEnv.authenticatedContext("owner_a", {
      role: "owner",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(
      ownerADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        subtotal: 0,
      })
    );
  });

  await test("Garçom/Dono NÃO pode alterar qrCredencialHash ou qrVersao da mesa diretamente", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1").update({
        qrCredencialHash: "forjado",
      })
    );
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1").update({
        qrVersao: 99,
      })
    );
  });

  await test("Cozinha só pode atualizar status/atualizadoEm em kds_tickets e NÃO pode deletar tickets", async () => {
    const cozinhaADb = testEnv.authenticatedContext("cozinha_a", {
      role: "cozinha",
      restauranteId: "rest_a",
    }).firestore();
    await assertSucceeds(
      cozinhaADb.doc("restaurantes/rest_a/kds_tickets/ticket_1").update({
        status: "pronto",
      })
    );
    await assertFails(
      cozinhaADb.doc("restaurantes/rest_a/kds_tickets/ticket_1").update({
        pratoNome: "Alterado",
      })
    );
    await assertFails(cozinhaADb.doc("restaurantes/rest_a/kds_tickets/ticket_1").delete());
  });

  await test("Cliente NÃO pode enviar metodoPagamento inválido na comanda", async () => {
    const clientDb = testEnv.authenticatedContext("cliente_1").firestore();
    await assertFails(
      clientDb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        status: "conta_pedida",
        metodoPagamento: "gratuito",
      })
    );
  });

  await test("Garçom/Dono NÃO pode marcar comanda como 'pago', forjar pagoEm ou alterar taxaServicoAtiva diretamente", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        status: "pago",
      })
    );
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        pagoEm: "2026-01-01T00:00:00Z",
      })
    );
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        taxaServicoAtiva: false,
      })
    );
  });

  await test("Garçom PODE atualizar campos operacionais (chamadoGarcom e garcomResponsavel) na comanda", async () => {
    const garcomADb = testEnv.authenticatedContext("garcom_a", {
      role: "garcom",
      restauranteId: "rest_a",
    }).firestore();
    await assertSucceeds(
      garcomADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").update({
        "chamadoGarcom.ativo": false,
        garcomResponsavel: { uid: "garcom_a", nome: "Carlos" },
      })
    );
  });

  await test("Cozinha NÃO pode regredir ticket KDS ('pronto' -> 'a_fazer') nem escrever status inválido em pedido", async () => {
    const cozinhaADb = testEnv.authenticatedContext("cozinha_a", {
      role: "cozinha",
      restauranteId: "rest_a",
    }).firestore();
    // ticket_1 foi movido para 'pronto' no teste anterior
    await assertFails(
      cozinhaADb.doc("restaurantes/rest_a/kds_tickets/ticket_1").update({
        status: "a_fazer",
      })
    );
    await assertSucceeds(
      cozinhaADb.doc("restaurantes/rest_a/kds_tickets/ticket_1").update({
        status: "entregue",
      })
    );
    await assertFails(
      cozinhaADb.doc("restaurantes/rest_a/kds_tickets/ticket_1").update({
        status: "pronto",
      })
    );
    await assertFails(
      cozinhaADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_1").update({
        status: "status_invalido",
      })
    );
    await assertSucceeds(
      cozinhaADb.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_1").update({
        status: "em_preparo",
      })
    );
  });

  await test("Lojista NÃO pode atualizar concessão diretamente (somente SuperAdmin)", async () => {
    const ownerDb = testEnv.authenticatedContext("owner_novo", {
      firebase: { sign_in_provider: "password" },
    }).firestore();
    await assertFails(
      ownerDb.doc("concessoes/lic_1").update({
        status: "utilizada",
        ownerId: "owner_novo",
        plano: "pro",
      })
    );
    await assertFails(
      ownerDb.doc("concessoes/lic_1").update({
        status: "utilizada",
        ownerId: "owner_novo",
      })
    );
    const adminDb = testEnv.authenticatedContext("admin_uid", { superadmin: true }).firestore();
    await assertSucceeds(adminDb.doc("concessoes/lic_1").update({ observacao: "ok" }));
  });

  await test("Concessão: consumo e arquivamento pelo lojista são negados; somente SuperAdmin/backend", async () => {
    const authCtx = { firebase: { sign_in_provider: "password" } };
    const ownerDb = testEnv.authenticatedContext("owner_queima", authCtx).firestore();
    const adminDb = testEnv.authenticatedContext("admin_uid", { superadmin: true }).firestore();
    const arq = { id: "lic_2", codigo: "lic_2", ownerId: "owner_queima", dadosLicenca: { plano: "free" } };

    await assertFails(ownerDb.doc("concessoes/lic_2").delete());
    const batchLojista = ownerDb.batch();
    batchLojista.set(ownerDb.doc("arquivo_morto_licencas/lic_2"), arq);
    batchLojista.delete(ownerDb.doc("concessoes/lic_2"));
    await assertFails(batchLojista.commit());
    await assertFails(ownerDb.doc("arquivo_morto_licencas/lic_2").set(arq));

    const batchAdmin = adminDb.batch();
    batchAdmin.set(adminDb.doc("arquivo_morto_licencas/lic_2"), arq);
    batchAdmin.delete(adminDb.doc("concessoes/lic_2"));
    await assertSucceeds(batchAdmin.commit());
    await assertFails(adminDb.doc("arquivo_morto_licencas/lic_2").update({ ownerId: "intruso" }));
    await assertFails(adminDb.doc("arquivo_morto_licencas/lic_2").delete());
  });

  await test("Mesa: exclusão física direta negada para dono, garçom e SuperAdmin (usar desativarMesaBackend)", async () => {
    const ctxs = [
      testEnv.authenticatedContext("owner_a", { role: "owner", restauranteId: "rest_a" }).firestore(),
      testEnv.authenticatedContext("garcom_a", { role: "garcom", restauranteId: "rest_a" }).firestore(),
      testEnv.authenticatedContext("admin_uid", { superadmin: true }).firestore(),
    ];
    for (const db of ctxs) {
      await assertFails(db.doc("restaurantes/rest_a/mesas/1").delete());
    }
  });

  await test("Slug: reserva e alteração são exclusivas do backend/SuperAdmin", async () => {
    const ownerA = testEnv.authenticatedContext("owner_a", { firebase: { sign_in_provider: "password" } }).firestore();
    const ownerB = testEnv.authenticatedContext("owner_b", { firebase: { sign_in_provider: "password" } }).firestore();
    const adminDb = testEnv.authenticatedContext("admin_uid", { superadmin: true }).firestore();
    await assertFails(ownerA.doc("slugs/bistro-a").set({ slug: "bistro-a", ownerId: "owner_a" }));
    await assertFails(ownerB.doc("slugs/bistro-a").set({ slug: "bistro-a", ownerId: "owner_b" }));
    await assertSucceeds(adminDb.doc("slugs/bistro-a").set({ slug: "bistro-a", ownerId: "owner_a" }));
    await assertFails(ownerB.doc("slugs/bistro-a").delete());
    await assertFails(ownerB.doc("slugs/bistro-a").update({ ownerId: "owner_b" }));
  });

  await test("Comanda aberta: exclusão direta negada para dono, garçom e cliente titular", async () => {
    const ctxs = [
      testEnv.authenticatedContext("owner_a", { role: "owner", restauranteId: "rest_a" }).firestore(),
      testEnv.authenticatedContext("garcom_a", { role: "garcom", restauranteId: "rest_a" }).firestore(),
      testEnv.authenticatedContext("cliente_1").firestore(),
    ];
    for (const db of ctxs) {
      await assertFails(db.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1").delete());
    }
  });

  await test("Histórico de sessões e métricas consolidadas: escrita direta negada (inclusive dono)", async () => {
    const ownerADb = testEnv.authenticatedContext("owner_a", { role: "owner", restauranteId: "rest_a" }).firestore();
    const garcomADb = testEnv.authenticatedContext("garcom_a", { role: "garcom", restauranteId: "rest_a" }).firestore();
    await assertFails(
      garcomADb.doc("restaurantes/rest_a/historico_sessoes_mesas/h1").set({ subtotalTotal: 999, restauranteId: "rest_a" })
    );
    await assertFails(
      ownerADb.doc("restaurantes/rest_a/historico_sessoes_mesas/h2").set({ subtotalTotal: 999, restauranteId: "rest_a" })
    );
    await assertFails(
      ownerADb.doc("restaurantes/rest_a/metricas_consolidadas/2026-11").set({ totalFaturado: 1e6 })
    );
    await assertSucceeds(ownerADb.doc("restaurantes/rest_a/metricas_consolidadas/2026-11").get());
  });

  await test("Exclusão direta de pedidos e kds_tickets negada para dono, garçom e cozinha", async () => {
    const ctxs = [
      testEnv.authenticatedContext("owner_a", { role: "owner", restauranteId: "rest_a" }).firestore(),
      testEnv.authenticatedContext("garcom_a", { role: "garcom", restauranteId: "rest_a" }).firestore(),
      testEnv.authenticatedContext("cozinha_a", { role: "cozinha", restauranteId: "rest_a" }).firestore(),
    ];
    for (const db of ctxs) {
      await assertFails(db.doc("restaurantes/rest_a/mesas/1/comandas_abertas/cliente_1/pedidos/ped_1").delete());
      await assertFails(db.doc("restaurantes/rest_a/kds_tickets/ticket_1").delete());
    }
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

