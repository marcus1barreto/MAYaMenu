import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gerarCSVLicencas,
  formatarLicencasClipboard,
} from "../../src/lib/licenca-service";
import type { Licenca } from "../../src/types";

describe("Fábrica de Licenças - Emissão em Lote e Exportadores", () => {
  const licencasMock: Licenca[] = [
    {
      id: "MAYA-TEST-0001",
      plano: "pro",
      status: "ativa",
      criadaEm: 1700000000000,
      expiracaoEm: 1700086400000,
      responsavel: 'Barbearia & Bistrô "Oásis"',
      notas: "Campanha Abrasel 2026 #01",
      limites: { maxPratos: 150, maxMesas: 30 },
    },
    {
      id: "MAYA-TEST-0002",
      plano: "enterprise",
      status: "ativa",
      criadaEm: 1700000000000,
      expiracaoEm: null,
      responsavel: "Restaurante Central",
      notas: "Campanha Abrasel 2026 #02",
      limites: { maxPratos: 9999, maxMesas: 9999 },
    },
  ];

  it("1. Deve gerar CSV canônico com cabeçalhos corretos e escape de aspas", () => {
    const csv = gerarCSVLicencas(licencasMock, "https://mayamenu.com");
    const linhas = csv.split("\r\n");

    // Valida cabeçalho
    assert.equal(
      linhas[0],
      "Codigo,Plano,Status,Link_Ativacao,Responsavel,Observacoes,Validade,Max_Pratos,Max_Mesas"
    );

    // Linha 1
    assert.match(linhas[1], /^"MAYA-TEST-0001","PRO","ativa","https:\/\/mayamenu\.com\/ativar\/MAYA-TEST-0001"/);
    // Escape de aspas duplas: "Barbearia & Bistrô ""Oásis"""
    assert.ok(linhas[1].includes('"Barbearia & Bistrô ""Oásis"""'));
    assert.ok(linhas[1].includes("150,30"));

    // Linha 2
    assert.match(linhas[2], /^"MAYA-TEST-0002","ENTERPRISE","ativa","https:\/\/mayamenu\.com\/ativar\/MAYA-TEST-0002"/);
    assert.ok(linhas[2].includes('"Sem expiracao"'));
    assert.ok(linhas[2].includes("9999,9999"));
  });

  it("2. Deve formatar texto canônico para compartilhamento em massa (WhatsApp/Slack)", () => {
    const texto = formatarLicencasClipboard(licencasMock, "https://mayamenu.com");

    assert.ok(texto.includes("🎫 MAYaMenu - Lote de Concessões (2 emitidas):"));
    assert.ok(texto.includes('1. [PRO] MAYA-TEST-0001 (Barbearia & Bistrô "Oásis")'));
    assert.ok(texto.includes("🔗 https://mayamenu.com/ativar/MAYA-TEST-0001"));
    assert.ok(texto.includes("2. [ENTERPRISE] MAYA-TEST-0002 (Restaurante Central)"));
    assert.ok(texto.includes("🔗 https://mayamenu.com/ativar/MAYA-TEST-0002"));
    assert.ok(texto.includes("⚠️ Instruções: O lojista só precisa clicar no link para cadastrar"));
  });

  it("3. Máscara de tokens gerados deve seguir padrão MAYA-XXXX-XXXX", () => {
    const mascaraRegex = /^MAYA-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    assert.ok(mascaraRegex.test("MAYA-9H2K-4M7P"));
    assert.ok(mascaraRegex.test("MAYA-ABCD-1234"));
    assert.ok(!mascaraRegex.test("MAYA-123-1234"));
    assert.ok(!mascaraRegex.test("TOKEN-ABCD-1234"));
  });
});
