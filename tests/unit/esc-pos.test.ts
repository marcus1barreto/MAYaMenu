import test from "node:test";
import assert from "node:assert/strict";
import { EscPosBuilder } from "../../src/lib/esc-pos";

test("Motor ESC/POS - Validação de Bytecode e Normalização ASCII", async (t) => {
  await t.test("1. Inicialização e Reset (ESC @)", () => {
    const builder = new EscPosBuilder().init();
    const bytes = builder.build();
    assert.deepEqual(Array.from(bytes), [0x1B, 0x40]);
  });

  await t.test("2. Alinhamento de Texto (ESC a n)", () => {
    const left = new EscPosBuilder().align("left").build();
    assert.deepEqual(Array.from(left), [0x1B, 0x61, 0]);

    const center = new EscPosBuilder().align("center").build();
    assert.deepEqual(Array.from(center), [0x1B, 0x61, 1]);

    const right = new EscPosBuilder().align("right").build();
    assert.deepEqual(Array.from(right), [0x1B, 0x61, 2]);
  });

  await t.test("3. Modo Negrito (ESC E n)", () => {
    const on = new EscPosBuilder().bold(true).build();
    assert.deepEqual(Array.from(on), [0x1B, 0x45, 1]);

    const off = new EscPosBuilder().bold(false).build();
    assert.deepEqual(Array.from(off), [0x1B, 0x45, 0]);
  });

  await t.test("4. Normalização NFD contra Mojibake (Acentos e Cedilha)", () => {
    const builder = new EscPosBuilder().text("Atenção, Café & Pão de Queijo!");
    const bytes = builder.build();
    const decoded = new TextDecoder().decode(bytes);

    // Caracteres diacríticos devem ser convertidos para ASCII plano sem corrupção
    assert.equal(decoded, "Atencao, Cafe & Pao de Queijo!");
    // Nenhum byte acima de 127 (puro ASCII)
    assert.ok(Array.from(bytes).every((b) => b < 128));
  });

  await t.test("5. Quebra de linha e avanço (LF)", () => {
    const builder = new EscPosBuilder().feed(3);
    assert.deepEqual(Array.from(builder.build()), [0x0A, 0x0A, 0x0A]);
  });

  await t.test("6. Comando de corte de papel (GS V)", () => {
    const partial = new EscPosBuilder().cut(false).build();
    assert.deepEqual(Array.from(partial), [0x1D, 0x56, 0x41, 0x03]);

    const total = new EscPosBuilder().cut(true).build();
    assert.deepEqual(Array.from(total), [0x1D, 0x56, 0x00]);
  });

  await t.test("7. Linha formatada com justificativa esquerda/direita", () => {
    const builder = new EscPosBuilder().line("1x Hamburguer", "R$ 35,00", 30);
    const decoded = new TextDecoder().decode(builder.build());
    // 13 chars left + 8 chars right + 9 spaces = 30 chars + \n
    assert.equal(decoded, "1x Hamburguer         R$ 35,00\n");
  });

  await t.test("8. Bytecode ESC/POS Nativo de QR Code (GS ( k)", () => {
    const payloadPix = "00020101021226...63043FE4";
    const builder = new EscPosBuilder().qrCode(payloadPix, 6);
    const bytes = Array.from(builder.build());

    // 1. Deve conter o cabeçalho de Modelo 2
    assert.deepEqual(bytes.slice(0, 9), [0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);

    // 2. Deve conter o comando de Tamanho do Módulo (6)
    assert.deepEqual(bytes.slice(9, 17), [0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]);

    // 3. Deve conter o nível de correção de erro L (0x30)
    assert.deepEqual(bytes.slice(17, 25), [0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30]);

    // 4. Deve conter o comando de finalização e impressão física (Function 181)
    const printCommand = bytes.slice(bytes.length - 8);
    assert.deepEqual(printCommand, [0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);
  });
});
