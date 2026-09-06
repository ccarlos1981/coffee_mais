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

  // Regra Canônica Gate 5.14B: valor_investimento representa o VALOR FINANCEIRO TOTAL da ação comercial
  const valor_investimento = Math.round(total_investimento * 100) / 100;
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

/**
 * Determina se a ação foi lançada após o encerramento do seu período (atrasada/retroativa).
 * Compara a data_fim da ação com a data de criação efetiva em horário de Brasília (America/Sao_Paulo).
 */
export function isAcaoAtrasada(dataFim?: string | null, createdAt?: string | null): boolean {
  if (!dataFim || !createdAt) return false;
  try {
    const d = new Date(createdAt);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const dataRegistroBRT = formatter.format(d); // "YYYY-MM-DD"
    const dataFimStr = dataFim.slice(0, 10);
    return dataFimStr < dataRegistroBRT;
  } catch {
    return false;
  }
}

/**
 * Valida se o período de execução [dataInicio, dataFim] possui interseção com o mês de referência (competência).
 * Regra: dataInicio <= último dia do mês E dataFim >= primeiro dia do mês.
 */
export function validarIntersecaoCompetencia(
  dataInicio?: string | null,
  dataFim?: string | null,
  mesReferencia?: string | null
): { valido: boolean; mensagem?: string } {
  if (!dataInicio || !dataFim || !mesReferencia) {
    return { valido: true };
  }

  const cleanMes = mesReferencia.trim();
  if (!/^\d{4}-\d{2}$/.test(cleanMes)) {
    return { valido: false, mensagem: `Mês de referência com formato inválido: ${mesReferencia}. Esperado YYYY-MM.` };
  }

  const [anoStr, mesStr] = cleanMes.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);

  // Primeiro dia do mês da competência (ex: 2026-09-01)
  const primeiroDiaCompetencia = `${cleanMes}-01`;
  // Último dia do mês da competência (ex: 2026-09-30)
  const ultimoDiaNum = new Date(ano, mes, 0).getDate();
  const ultimoDiaCompetencia = `${cleanMes}-${String(ultimoDiaNum).padStart(2, '0')}`;

  const inicioStr = dataInicio.slice(0, 10);
  const fimStr = dataFim.slice(0, 10);

  // Interseção entre [inicioStr, fimStr] e [primeiroDiaCompetencia, ultimoDiaCompetencia]
  const temIntersecao = inicioStr <= ultimoDiaCompetencia && fimStr >= primeiroDiaCompetencia;

  if (!temIntersecao) {
    return {
      valido: false,
      mensagem: `Competência incompatível: o período da ação (${inicioStr} a ${fimStr}) não possui interseção com o mês de referência selecionado (${cleanMes}).`
    };
  }

  return { valido: true };
}
