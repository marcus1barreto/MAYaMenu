import { EscPosBuilder } from "@/lib/esc-pos";
import { despacharParaImpressoraSerial, obterImpressoraSalva } from "@/lib/web-serial";
import type { PedidoKDS } from "@/components/admin/kds-view";

/**
 * Monta o cupom térmico padrão ESC/POS para a comanda de produção da Cozinha/Bar
 */
export function gerarCupomKdsEscPos(pedido: PedidoKDS, nomeRestaurante: string = "MAYaMenu"): Uint8Array {
  const builder = new EscPosBuilder();

  builder
    .init()
    .align("center")
    .bold(true)
    .size("double")
    .textLine(nomeRestaurante.toUpperCase())
    .size("normal")
    .textLine("--- COMANDA DE PRODUCAO ---")
    .feed(1)
    .align("left")
    .bold(true)
    .size("double-height")
    .textLine(`MESA: ${pedido.mesa}`)
    .size("normal")
    .textLine(`CLIENTE: ${pedido.nomeCliente || "Cliente"}`)
    .textLine(`HORARIO: ${pedido.horario || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`)
    .textLine(`PEDIDO: #${pedido.id.slice(-6).toUpperCase()}`)
    .feed(1)
    .bold(true)
    .textLine("================================")
    .textLine("QTD  ITEM")
    .textLine("================================")
    .bold(false);

  // Lista os itens da rodada
  pedido.itens.forEach((it) => {
    builder
      .bold(true)
      .textLine(`${it.quantidade}x  ${it.nome}`)
      .bold(false);

    // Modificadores / Adicionais
    if (it.modificadores && it.modificadores.length > 0) {
      it.modificadores.forEach((m) => {
        builder.textLine(`    + ${m.grupo}: ${m.opcao}`);
      });
    }

    // Observações críticas da cozinha
    if (it.observacoes) {
      builder
        .bold(true)
        .textLine(`    ** OBS: ${it.observacoes} **`)
        .bold(false);
    }

    builder.feed(1);
  });

  builder
    .bold(true)
    .textLine("================================")
    .align("center")
    .feed(2)
    .cut(false);

  return builder.build();
}

/**
 * Despacha o cupom de produção do KDS para a impressora térmica conectada via Web Serial
 */
export async function imprimirComandaKds(
  pedido: PedidoKDS,
  nomeRestaurante: string = "MAYaMenu",
  forcarSelecao: boolean = false
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const payload = gerarCupomKdsEscPos(pedido, nomeRestaurante);
    await despacharParaImpressoraSerial(payload, { forcarSelecao });
    return { sucesso: true };
  } catch (err: any) {
    console.warn("Falha ao imprimir comanda de produção KDS:", err);
    return {
      sucesso: false,
      erro: err?.message || "Não foi possível comunicar com a impressora térmica.",
    };
  }
}
