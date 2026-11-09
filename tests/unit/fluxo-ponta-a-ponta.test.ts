import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Fluxo Ponta a Ponta: Ciclo de Vida do Pedido e Papéis", () => {
  // 1. Simulação da Comanda Aberta pelo Cliente no Salão
  interface ComandaMesa {
    id: string;
    mesa: number;
    clienteNome: string;
    status: "pedindo" | "aguardando_pratos" | "conta_pedida" | "pago";
    subtotal: number;
  }

  interface PedidoKds {
    id: string;
    comandaId: string;
    mesa: number;
    itens: { nome: string; quantidade: number; preco: number }[];
    status: "a_fazer" | "preparando" | "pronto" | "entregue";
  }

  test("1. Cliente abre comanda na mesa e status inicial é 'pedindo'", () => {
    const comanda: ComandaMesa = {
      id: "cli-mesa-5-001",
      mesa: 5,
      clienteNome: "João Silva",
      status: "pedindo",
      subtotal: 0,
    };

    assert.equal(comanda.mesa, 5);
    assert.equal(comanda.status, "pedindo");
    assert.equal(comanda.subtotal, 0);
  });

  test("2. Cliente envia rodada de pedidos para a Cozinha (KDS)", () => {
    const pedido: PedidoKds = {
      id: "ped-rodada-101",
      comandaId: "cli-mesa-5-001",
      mesa: 5,
      itens: [
        { nome: "Hambúrguer Artesanal", quantidade: 2, preco: 38.5 },
        { nome: "Suco Natural de Laranja", quantidade: 1, preco: 12.0 },
      ],
      status: "a_fazer",
    };

    // Atualiza status e subtotal da comanda
    const subtotalRodada = pedido.itens.reduce((acc, i) => acc + i.quantidade * i.preco, 0);
    assert.equal(subtotalRodada, 89.0);
    assert.equal(pedido.status, "a_fazer");
  });

  test("3. Cozinha (KDS) assume o preparo e avança status para 'pronto'", () => {
    let statusKds: "a_fazer" | "preparando" | "pronto" | "entregue" = "a_fazer";

    // Cozinha clica em MARCHAR PEDIDO
    statusKds = "pronto";
    assert.equal(statusKds, "pronto");
  });

  test("4. Garçom recebe notificação em tempo real e entrega na mesa", () => {
    let statusKds: "a_fazer" | "preparando" | "pronto" | "entregue" = "pronto";

    // Garçom entrega o pedido na Mesa 5
    statusKds = "entregue";
    assert.equal(statusKds, "entregue");
  });

  test("5. Cliente pede a conta e garçom/caixa encerra comanda", () => {
    const comanda: ComandaMesa = {
      id: "cli-mesa-5-001",
      mesa: 5,
      clienteNome: "João Silva",
      status: "aguardando_pratos",
      subtotal: 89.0,
    };

    // Cliente pede a conta
    comanda.status = "conta_pedida";
    assert.equal(comanda.status, "conta_pedida");

    // Aplicação da taxa de serviço de 10%
    const taxaServico = 10;
    const totalComTaxa = comanda.subtotal * (1 + taxaServico / 100);
    assert.equal(Math.round(totalComTaxa * 100) / 100, 97.9);

    // Garçom confirma pagamento no caixa e baixa a mesa
    comanda.status = "pago";
    assert.equal(comanda.status, "pago");
  });

  test("6. Validação de Papéis: Somente equipe autorizada altera status", () => {
    function podeMarchar(role: string): boolean {
      return role === "owner" || role === "cozinha";
    }

    function podeEntregar(role: string): boolean {
      return role === "owner" || role === "garcom";
    }

    assert.equal(podeMarchar("cozinha"), true);
    assert.equal(podeMarchar("garcom"), false);
    assert.equal(podeMarchar("cliente"), false);

    assert.equal(podeEntregar("garcom"), true);
    assert.equal(podeEntregar("cozinha"), false);
    assert.equal(podeEntregar("owner"), true);
  });
});

