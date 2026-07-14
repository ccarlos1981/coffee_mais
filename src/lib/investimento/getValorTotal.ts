/**
 * Calcula o valor total de investimento de uma ação física.
 * Reutilizado em múltiplas telas (Listagem e Dash Gerencial) para garantir paridade conceitual.
 */
export function getValorTotal(r: any): number {
  if (r.abrangencia === "SKU" && r.skus_detalhes) {
    return r.skus_detalhes.reduce(
      (acc: number, curr: any) =>
        acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0),
      0
    );
  }
  if (r.familias_detalhes && r.familias_detalhes.length > 0) {
    return r.familias_detalhes.reduce(
      (acc: number, curr: any) =>
        acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0),
      0
    );
  }
  return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
}
