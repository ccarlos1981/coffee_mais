/**
 * Domínio Oficial de Investimentos (Single Source of Truth)
 * 
 * Camada compartilhada responsável por calcular o valor financeiro 
 * das ações de trade, garantindo paridade entre módulos (RPS, Dash Gerencial, Lançamentos, etc).
 */

/**
 * Calcula o valor base projetado (orçamento comercial comprometido)
 * com base na mecânica da ação.
 */
export function getValorProjetadoComercial(r: any): number {
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

/**
 * Valor Oficial de Investimento (Realizado)
 * 
 * SSOT Rule: Se a ação já possui apuração financeira liquidada (`apuracao_valor_realizado`),
 * assume-se o desembolso exato. Caso contrário, assume-se o consumo do orçamento
 * comercial comprometido (cálculo oficial).
 */
export function getInvestimentoRealizadoOficial(acao: any): number {
  if (acao.apuracao_valor_realizado !== null && acao.apuracao_valor_realizado !== undefined) {
    return Number(acao.apuracao_valor_realizado);
  }
  return getValorProjetadoComercial(acao);
}

/**
 * Alias mantido temporariamente por compatibilidade.
 */
export const getValorTotal = getValorProjetadoComercial;
