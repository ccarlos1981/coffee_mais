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
  if (!r) return 0;

  // 1. Regra Canônica Gate 5.15B: valor_investimento é a fonte soberana do TOTAL da ação
  if (r.valor_investimento !== null && r.valor_investimento !== undefined) {
    const val = Number(r.valor_investimento);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  // 2. Fallback para registros legados onde valor_investimento não estava gravado
  if (r.abrangencia === "SKU" && Array.isArray(r.skus_detalhes) && r.skus_detalhes.length > 0) {
    return r.skus_detalhes.reduce(
      (acc: number, curr: any) =>
        acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0),
      0
    );
  }
  if (Array.isArray(r.familias_detalhes) && r.familias_detalhes.length > 0) {
    return r.familias_detalhes.reduce(
      (acc: number, curr: any) =>
        acc + (Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0),
      0
    );
  }

  // 3. Fallback seguro: retorna valor_investimento diretamente (nunca multiplicado por volume)
  if (r.valor_investimento !== null && r.valor_investimento !== undefined) {
    const val = Number(r.valor_investimento);
    if (!isNaN(val)) return val;
  }

  return 0;
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
