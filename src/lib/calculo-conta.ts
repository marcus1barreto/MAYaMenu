/**
 * Cálculo único de totais da conta (fonte de verdade para cliente, garçom e admin).
 * Ignora pedidos cancelados/estornados e aplica a taxa de serviço configurada.
 */

export const TAXA_SERVICO_PADRAO = 10;

export interface PedidoParaCalculo {
  status?: string;
  subtotal?: number;
}

export interface TotaisConta {
  subtotal: number;
  taxa: number;
  total: number;
  percentual: number;
}

const arredondar = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function somarPedidosAtivos(pedidos: PedidoParaCalculo[]): number {
  return arredondar(
    pedidos.reduce((acc, p) => {
      if (p.status === "cancelado" || p.status === "estornado") return acc;
      return acc + (Number(p.subtotal) || 0);
    }, 0)
  );
}

export function calcularTotais(
  subtotal: number,
  taxaPercentual?: number,
  taxaAtiva: boolean = true
): TotaisConta {
  const percentual =
    typeof taxaPercentual === "number" && taxaPercentual >= 0 ? taxaPercentual : TAXA_SERVICO_PADRAO;
  const base = arredondar(Number(subtotal) || 0);
  const taxa = taxaAtiva ? arredondar(base * (percentual / 100)) : 0;
  return { subtotal: base, taxa, total: arredondar(base + taxa), percentual };
}
