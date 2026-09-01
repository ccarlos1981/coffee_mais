/**
 * ==============================================================================
 * COFFEE++ — SERVIÇO DE PLANO FINANCEIRO E PARCELAMENTO (INVESTIMENTOS)
 * Baseline: BASELINE_INVESTIMENTOS_20260901_LOCKED
 * Gate 3: Múltiplas Ações + Plano Financeiro + Pagamentos N:N
 * ==============================================================================
 */

export interface ParcelaFinanceira {
  id?: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_previsto_original: number;
  valor_previsto: number;
  valor_pago_acumulado?: number;
  saldo_remanescente: number;
  data_vencimento: string; // YYYY-MM-DD
  status_parcela?: 'PENDENTE' | 'PARCIALMENTE_PAGA' | 'QUITADA' | 'CANCELADA_QUITACAO_ANTECIPADA' | 'CANCELADA_RENEGOCIACAO';
  tipo_pagamento: string;
  is_planejamento?: boolean;
  observacoes?: string | null;
}

export interface AcaoComercialItem {
  id?: string;
  familia_id: string;
  familia_nome: string;
  data_inicio: string;
  data_fim: string;
  preco_flat: number;
  preco_acao: number;
  valor_investimento: number;
  expectativa_volume: number;
  abrangencia: 'Família' | 'SKU' | 'Misto' | 'Pagamento Único';
  tipo_pagamento?: string;
  skus_detalhes?: any[];
  tipo_acao?: string;
  tipo_acao_detalhe?: string;
  mes_referencia?: string;
  is_materializada_futura?: boolean;
  acao_origem_recorrencia_id?: string | null;
}

export interface PagamentoRealizado {
  id?: string;
  campanha_id: string;
  valor_pago: number;
  data_pagamento: string;
  comprovante_url?: string | null;
  observacoes?: string | null;
  registrado_por?: string | null;
  created_at?: string;
  alocacoes?: Array<{
    id?: string;
    parcela_id: string;
    numero_parcela?: number;
    valor_alocado: number;
  }>;
}

export interface ReconciliacaoResultado {
  campanha_id: string;
  reconciliado: boolean;
  total_acoes: number;
  total_parcelas_original: number;
  total_pago_acumulado_parcelas: number;
  total_alocado_pagamentos: number;
  total_pagamentos_reais: number;
  saldo_parcelas: number;
  saldo_campanha: number;
  divergencia: number;
}

/**
 * Distribui um valor total em N parcelas com vencimento mensal a partir de uma data inicial,
 * garantindo ajuste exato de centavos na última parcela.
 */
export function gerarGradeParcelasIguais(
  totalValor: number,
  qtdParcelas: number,
  primeiroVencimento: string,
  tipoPagamento: string = "Transf. Bancária"
): ParcelaFinanceira[] {
  if (qtdParcelas <= 0 || totalValor <= 0) return [];

  const parcelas: ParcelaFinanceira[] = [];
  const valorBase = Math.floor((totalValor / qtdParcelas) * 100) / 100;
  let somaAcumulada = 0;

  // Data base inicial
  const [anoStr, mesStr, diaStr] = (primeiroVencimento || new Date().toISOString().slice(0, 10)).split("-");
  let ano = parseInt(anoStr, 10);
  let mes = parseInt(mesStr, 10) - 1; // 0-indexed para JS Date
  const diaPreferencial = parseInt(diaStr, 10);

  for (let i = 1; i <= qtdParcelas; i++) {
    const isUltima = i === qtdParcelas;
    const valorParcela = isUltima 
      ? Math.round((totalValor - somaAcumulada) * 100) / 100 
      : valorBase;
    
    somaAcumulada += valorParcela;

    // Calcular data com incremento de mês tratando dias finais de mês (28, 29, 30, 31)
    const targetDate = new Date(ano, mes + (i - 1), 1);
    const ultimoDiaDoMes = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const diaReal = Math.min(diaPreferencial, ultimoDiaDoMes);
    const finalDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), diaReal);

    const dataVencimentoStr = `${finalDate.getFullYear()}-${String(finalDate.getMonth() + 1).padStart(2, "0")}-${String(finalDate.getDate()).padStart(2, "0")}`;

    parcelas.push({
      numero_parcela: i,
      total_parcelas: qtdParcelas,
      valor_previsto_original: valorParcela,
      valor_previsto: valorParcela,
      valor_pago_acumulado: 0,
      saldo_remanescente: valorParcela,
      data_vencimento: dataVencimentoStr,
      status_parcela: "PENDENTE",
      tipo_pagamento: tipoPagamento,
      is_planejamento: false
    });
  }

  return parcelas;
}

/**
 * Valida a paridade financeira exata entre as Ações Comerciais e as Parcelas do Plano Financeiro.
 */
export function validarParidadeNegociacao(
  acoes: AcaoComercialItem[],
  parcelas: ParcelaFinanceira[]
): { valido: boolean; totalAcoes: number; totalParcelas: number; diferenca: number } {
  const totalAcoes = Math.round(acoes.reduce((acc, a) => acc + (Number(a.valor_investimento) || 0), 0) * 100) / 100;
  const totalParcelas = Math.round(parcelas.reduce((acc, p) => acc + (Number(p.valor_previsto) || 0), 0) * 100) / 100;
  const diferenca = Math.round((totalAcoes - totalParcelas) * 100) / 100;

  return {
    valido: Math.abs(diferenca) < 0.01,
    totalAcoes,
    totalParcelas,
    diferenca
  };
}

/**
 * Reconcilia o saldo devedor da campanha a partir do estado das parcelas.
 */
export function calcularSaldoDevedorCampanha(parcelas: ParcelaFinanceira[]): number {
  return parcelas
    .filter(p => p.status_parcela !== "CANCELADA_QUITACAO_ANTECIPADA" && p.status_parcela !== "CANCELADA_RENEGOCIACAO")
    .reduce((acc, p) => acc + (Number(p.saldo_remanescente) || 0), 0);
}
