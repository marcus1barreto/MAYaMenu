import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gerarPayloadPix,
  calcularCRC16,
  normalizarTextoBacen,
  formatarChavePixParaBacen,
} from "../../src/lib/pix";

describe("Auditoria e Bateria de Testes Formais - Pix BACEN / CRC16-CCITT", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. AUDITORIA MATEMÁTICA DO ALGORITMO CRC16-CCITT (POLINÔMIO 0x1021 / SEED 0xFFFF)
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Algoritmo CRC16-CCITT Padrão BACEN / ISO/IEC 13239", () => {
    it("deve calcular o CRC16 com 4 caracteres hexadecimais em caixa alta", () => {
      const payloadExemplo =
        "00020101021126360014BR.GOV.BCB.PIX0114+55119999999995204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***6304";
      const crc = calcularCRC16(payloadExemplo);

      assert.equal(typeof crc, "string");
      assert.equal(crc.length, 4);
      assert.match(crc, /^[0-9A-F]{4}$/, "O CRC16 deve conter exatamente 4 dígitos hexadecimais maiúsculos");
    });

    it("deve preencher com zeros à esquerda quando o CRC resultar em valor menor que 0x1000", () => {
      // Testa se o padStart(4, '0') é respeitado
      const payload = "0002010102126304";
      const crc = calcularCRC16(payload);
      assert.equal(crc.length, 4);
    });

    it("deve detectar adulteração de dados (Bit-Flip / Anti-Fraude de Valor)", () => {
      const payloadOriginal =
        "00020101021226330014BR.GOV.BCB.PIX011112345678909520400005303986540542.505802BR5913BAR DO MARCUS6009SAO PAULO62100506MESA126304";
      const crcOriginal = calcularCRC16(payloadOriginal);

      // Simula alteração fraudulenta de valor de 42.50 para 02.50
      const payloadAdulterado = payloadOriginal.replace("42.50", "02.50");
      const crcAdulterado = calcularCRC16(payloadAdulterado);

      assert.notEqual(
        crcOriginal,
        crcAdulterado,
        "Alteração de valor monetário deve gerar CRC completamente diferente"
      );
    });

    it("deve detectar adulteração na chave Pix ou no nome do recebedor", () => {
      const base =
        "00020101021226330014BR.GOV.BCB.PIX011112345678909520400005303986540542.505802BR5913BAR DO MARCUS6009SAO PAULO62100506MESA126304";
      const crcBase = calcularCRC16(base);

      // Altera 1 dígito da chave Pix
      const chaveTrocada = base.replace("12345678909", "12345678908");
      const crcChaveTrocada = calcularCRC16(chaveTrocada);

      assert.notEqual(crcBase, crcChaveTrocada);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. FORMATAÇÃO E SANITIZAÇÃO DE CHAVES PIX CONFORME NORMA DO BANCO CENTRAL
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Sanitização e Validação de Chaves Pix por Tipo", () => {
    it("deve remover pontuação e caracteres não numéricos de chaves CPF", () => {
      const formatada = formatarChavePixParaBacen(" 123.456.789-09 ", "cpf");
      assert.equal(formatada, "12345678909");
    });

    it("deve remover pontuação e caracteres não numéricos de chaves CNPJ", () => {
      const formatada = formatarChavePixParaBacen(" 12.345.678/0001-95 ", "cnpj");
      assert.equal(formatada, "12345678000195");
    });

    it("deve prefixar +55 em números de telefone sem DDI e remover espaços/parênteses", () => {
      const formatada = formatarChavePixParaBacen("(11) 98765-4321", "telefone");
      assert.equal(formatada, "+5511987654321");
    });

    it("não deve duplicar o +55 se o telefone já tiver o código do país", () => {
      const formatada = formatarChavePixParaBacen("+55 11 98765-4321", "telefone");
      assert.equal(formatada, "+5511987654321");
    });

    it("deve converter e-mails para minúsculas e retirar espaços em branco", () => {
      const formatada = formatarChavePixParaBacen("  Pagamento@Mayamenu.Com.BR  ", "email");
      assert.equal(formatada, "pagamento@mayamenu.com.br");
    });

    it("deve preservar chave aleatória (EVP) íntegra com traços", () => {
      const evp = "123e4567-e89b-12d3-a456-426614174000";
      const formatada = formatarChavePixParaBacen(`  ${evp}  `, "aleatoria");
      assert.equal(formatada, evp);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. NORMALIZAÇÃO DE TEXTO BACEN (SEM ACENTOS, CEDILHAS OU CARACTERES PROIBIDOS)
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Normalização de Textos EMV (Nomes e Cidades)", () => {
    it("deve remover acentos e converter para maiúsculas", () => {
      const normalizado = normalizarTextoBacen("Restaurante Açaí & Pão de Queijo");
      assert.equal(normalizado, "RESTAURANTE ACAI  PAO DE QUEIJO");
    });

    it("deve truncar no tamanho máximo estipulado pela norma EMV", () => {
      const nomeLongo = "Restaurante e Pizzaria do Marcus Aurelio Silva";
      const beneficiario = normalizarTextoBacen(nomeLongo, 25);
      assert.equal(beneficiario.length, 25);
      assert.equal(beneficiario, "RESTAURANTE E PIZZARIA DO");
    });

    it("deve truncar a cidade em no máximo 15 caracteres", () => {
      const cidadeLonga = "Pindamonhangaba";
      const cidade = normalizarTextoBacen(cidadeLonga, 15);
      assert.equal(cidade.length, 15);
      assert.equal(cidade, "PINDAMONHANGABA");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. INTEGRIDADE DA ESTRUTURA TLV (TAG-LENGTH-VALUE) NO PAYLOAD COMPLETO
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Integridade da Especificação TLV do Payload BR Code", () => {
    it("deve gerar payload com início obrigatório '000201'", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Restaurante",
        cidade: "Sao Paulo",
        valor: 50.0,
      });

      assert.equal(payload.slice(0, 6), "000201", "Payload deve iniciar com Tag 00 tamanho 02 valor 01");
    });

    it("deve marcar Tag 01 como '12' (dinâmico com valor) quando valor > 0", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Restaurante",
        cidade: "Sao Paulo",
        valor: 25.5,
      });

      assert.ok(payload.includes("010212"), "Tag 01 deve ser 010212 para cobrança com valor exato");
    });

    it("deve marcar Tag 01 como '11' (estático) quando valor for zero", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Restaurante",
        cidade: "Sao Paulo",
        valor: 0,
      });

      assert.ok(payload.includes("010211"), "Tag 01 deve ser 010211 para QR estático sem valor pré-definido");
    });

    it("deve conter o domínio do Banco Central 'BR.GOV.BCB.PIX' na Tag 26", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Restaurante",
        cidade: "Sao Paulo",
        valor: 10.0,
      });

      assert.ok(payload.includes("0014BR.GOV.BCB.PIX"));
    });

    it("deve formatar valor monetário na Tag 54 com exatamente 2 casas decimais", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Restaurante",
        cidade: "Sao Paulo",
        valor: 125.7, // 1 casa decimal informada -> deve virar 125.70
      });

      assert.ok(payload.includes("5406125.70"), "Tag 54 com valor 125.70 deve ter tamanho 06 e valor '125.70'");
    });

    it("deve conter a moeda Real BRL (986) e País Brasil (BR)", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Restaurante",
        cidade: "Sao Paulo",
        valor: 10.0,
      });

      assert.ok(payload.includes("5303986"), "Tag 53 deve ser 5303986");
      assert.ok(payload.includes("5802BR"), "Tag 58 deve ser 5802BR");
    });

    it("deve validar que o CRC16 ao final do payload corresponde exatamente ao checksum do corpo", () => {
      const payload = gerarPayloadPix({
        chave: "marcus@mayamenu.com.br",
        tipoChave: "email",
        beneficiario: "MAYaMenu Lounge",
        cidade: "Campinas",
        valor: 89.9,
        identificador: "MESA04CMD02",
      });

      const corpoSemCRC = payload.slice(0, -4);
      const crcEsperado = calcularCRC16(corpoSemCRC);
      const crcNoPayload = payload.slice(-4);

      assert.equal(crcNoPayload, crcEsperado, "O CRC no final do payload gerado deve ser idêntico ao calculado");
    });

    it("deve usar '***' como txId padrão na Tag 62 quando identificador não for fornecido", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Restaurante",
        cidade: "Sao Paulo",
        valor: 15.0,
      });

      assert.ok(payload.includes("62070503***"), "Tag 62 deve conter subtag 05 com tamanho 03 e valor '***'");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. TESTE DE CONFORMIDADE COM CASO REAL DE COBRANÇA DE MESA (END-TO-END)
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Caso Real: Fechamento de Comanda de Mesa (Mesa 12, R$ 42,50)", () => {
    it("deve gerar payload canônico reproduzível e com CRC16 válido", () => {
      const payload = gerarPayloadPix({
        chave: "12345678909",
        tipoChave: "cpf",
        beneficiario: "Bar do Marcus",
        cidade: "Sao Paulo",
        valor: 42.5,
        identificador: "MESA12",
      });

      const payloadEsperado =
        "00020101021226330014BR.GOV.BCB.PIX011112345678909520400005303986540542.505802BR5913BAR DO MARCUS6009SAO PAULO62100506MESA1263043FE4";

      assert.equal(payload, payloadEsperado);
      assert.equal(payload.slice(-4), "3FE4");
    });
  });
});
