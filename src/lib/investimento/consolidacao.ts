export interface SKUDetalhe {
  sku: string;
  preco_flat?: number | null;
  preco_acao?: number | null;
  investimento?: number | null;
  expectativa_volume?: number | null;
  start_date?: string;
  end_date?: string;
}

export interface FamiliaDetalhe {
  familia_id: string;
  familia_nome: string;
  preco_flat?: number | null;
  preco_acao?: number | null;
  investimento?: number | null;
  expectativa_volume?: number | null;
  start_date?: string;
  end_date?: string;
}

export interface ConsolidadasRetorno {
  familia_produto: string;
  preco_flat: number;
  preco_acao: number;
  valor_investimento: number;
  expectativa_volume: number;
}

/**
 * Consolida os campos financeiros e mercadológicos de uma ação de investimento
 * a partir de seus detalhes (Famílias ou SKUs).
 */
export function calcularCamposConsolidadosInvestimento(
  familiasDetalhes: FamiliaDetalhe[] | null | undefined,
  skusDetalhes: SKUDetalhe[] | null | undefined,
  familiaProdutoInput?: string | null
): ConsolidadasRetorno {
  const familias = familiasDetalhes || [];
  const skus = skusDetalhes || [];

  // Regra para definir o familia_produto (nome consolidado)
  let familia_produto = (familiaProdutoInput || "").trim();
  if (!familia_produto) {
    const famNames = familias.map(f => (f.familia_nome || "").trim()).filter(Boolean);
    if (famNames.length > 0) {
      familia_produto = famNames.join(", ");
    } else {
      familia_produto = "Múltiplos SKUs";
    }
  }

  let total_volume = 0;
  let total_investimento = 0;
  let total_flat_weighted = 0;
  let total_acao_weighted = 0;

  for (const f of familias) {
    const vol = Number(f.expectativa_volume) || 0;
    total_volume += vol;
    total_investimento += (Number(f.investimento) || 0) * vol;
    total_flat_weighted += (Number(f.preco_flat) || 0) * vol;
    total_acao_weighted += (Number(f.preco_acao) || 0) * vol;
  }

  for (const s of skus) {
    const vol = Number(s.expectativa_volume) || 0;
    total_volume += vol;
    total_investimento += (Number(s.investimento) || 0) * vol;
    total_flat_weighted += (Number(s.preco_flat) || 0) * vol;
    total_acao_weighted += (Number(s.preco_acao) || 0) * vol;
  }

  const valor_investimento = total_volume > 0 ? (total_investimento / total_volume) : 0;
  const preco_flat = total_volume > 0 ? (total_flat_weighted / total_volume) : 0;
  const preco_acao = total_volume > 0 ? (total_acao_weighted / total_volume) : 0;
  const expectativa_volume = total_volume;

  return {
    familia_produto,
    preco_flat,
    preco_acao,
    valor_investimento,
    expectativa_volume
  };
}
