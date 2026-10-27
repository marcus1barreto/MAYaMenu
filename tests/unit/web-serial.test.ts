import test from "node:test";
import assert from "node:assert/strict";
import {
  salvarImpressoraUSB,
  obterImpressoraSalva,
  esquecerImpressoraUSB,
} from "../../src/lib/web-serial";

test("Gerenciador Web Serial - Memorização de Portas USB", async (t) => {
  // Mock window e localStorage em ambiente de teste Node
  const storageMap = new Map<string, string>();
  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, val: string) => storageMap.set(key, val),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };

  await t.test("1. Deve salvar e recuperar metadados de impressora USB pareada", () => {
    salvarImpressoraUSB({ usbVendorId: 0x04b8, usbProductId: 0x0e15 }); // Epson TM-T20
    const salva = obterImpressoraSalva();

    assert.ok(salva !== null);
    assert.equal(salva.usbVendorId, 0x04b8);
    assert.equal(salva.usbProductId, 0x0e15);
    assert.ok(typeof salva.salvoEm === "number");
  });

  await t.test("2. Deve esquecer a impressora quando solicitado", () => {
    esquecerImpressoraUSB();
    const salva = obterImpressoraSalva();
    assert.equal(salva, null);
  });

  await t.test("3. Deve tolerar gravação sem identificadores explícitos", () => {
    salvarImpressoraUSB(undefined);
    const salva = obterImpressoraSalva();
    assert.ok(salva !== null);
    assert.equal(salva.usbVendorId, undefined);
  });

  // Limpeza
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});
