/**
 * ManagerPerformanceScoreService — Coffee++
 *
 * Serviço puro e determinístico responsável por transformar dados analíticos brutos
 * de gerentes de campo em um Score de Performance normalizado (0–100).
 *
 * Diretrizes:
 * 1. Este serviço NÃO consulta banco de dados. Recebe dados prontos do AnalyticsEngine.
 * 2. O Score é transparente, auditável e justificável por dimensões individuais.
 * 3. Toda normalização é relativa à equipe, evitando viés de tamanho de carteira.
 * 4. Casos extremos (NaN, Infinity, divisão por zero) são tratados deterministicamente.
 *
 * Dimensões do Score:
 *   Resultado Financeiro = 35%
 *   Crescimento          = 25%
 *   Saúde da Carteira    = 20%
 *   Frequência           = 10%
 *   Consistência         = 10%
 *
 * @see Feature 7 — Ranking Dinâmico de Performance de Gerentes de Campo
 */

// ============================================================
// CONTRATOS DE ENTRADA (dados brutos do AnalyticsEngine)
// ============================================================

export interface ManagerRawAnalyticsData {
  managerId: string;
  managerName: string;
  /** Faturamento Rolling 3M atual (3 últimos meses fechados) */
  rollingFat3m: number;
  /** Faturamento Rolling 3M do período anterior (M-5, M-4, M-3) */
  rollingFat3mAnterior: number;
  /** Faturamento individual por mês dentro do Rolling 3M [M-2, M-1, M] */
  fatMensalRolling: number[];
  /** Clientes distintos com compra no Rolling 3M */
  clientesAtivos: number;
  /** Clientes cadastrados do gerente SEM compra no Rolling 3M */
  clientesSemCompra: number;
  /** Média de meses com compra dos clientes no Rolling 3M (0.0 a 3.0) */
  frequenciaMedia: number;
  /** Share dos Top 3 clientes no faturamento do gerente (0-100) */
  concentracaoTop3: number;
}

// ============================================================
// CONTRATOS DE SAÍDA (ranking final para a API)
// ============================================================

export type PerformanceStatus = 'TOP_PERFORMER' | 'CONSISTENTE' | 'ATENCAO' | 'CRITICO';
export type PerformanceTrend = 'EM_EVOLUCAO' | 'ESTAVEL' | 'EM_QUEDA';
export type DataQuality = 'COMPLETO' | 'CARTEIRA_REDUZIDA' | 'AVALIACAO' | 'SEM_DADOS';

export interface ManagerRankingEntry {
  position: number;
  managerId: string;
  managerName: string;
  // Métricas brutas
  rollingFat3m: number;
  rollingFat3mAnterior: number;
  variacaoPct: number | null;
  clientesAtivos: number;
  clientesSemCompra: number;
  taxaAtivacao: number;
  frequenciaMedia: number;
  concentracaoTop3: number;
  coeficienteVariacao: number;
  // Scores por dimensão (0-100)
  scoreFinanceiro: number;
  scoreCrescimento: number;
  scoreCarteira: number;
  scoreFrequencia: number;
  scoreConsistencia: number;
  // Score final e classificação
  scorePerformance: number;
  tendencia: PerformanceTrend;
  status: PerformanceStatus;
  dataQuality: DataQuality;
}

// ============================================================
// CONSTANTES
// ============================================================

const WEIGHTS = {
  FINANCEIRO: 0.35,
  CRESCIMENTO: 0.25,
  CARTEIRA: 0.20,
  FREQUENCIA: 0.10,
  CONSISTENCIA: 0.10,
} as const;

/** Frequência máxima teórica em janela de 3 meses */
const MAX_FREQUENCIA = 3.0;

/** Limiar mínimo de clientes para "Carteira Reduzida" */
const MIN_CLIENTES_CARTEIRA_NORMAL = 5;

/** Cap máximo de variação percentual para normalização (evita outliers) */
const MAX_VARIACAO_CAP = 100;

// ============================================================
// SERVIÇO PRINCIPAL
// ============================================================

export class ManagerPerformanceScoreService {
  /**
   * Calcula o ranking completo de performance dos gerentes de campo.
   *
   * @param rawDataArray Dados brutos de cada gerente do AnalyticsEngine
   * @returns Array de ManagerRankingEntry ordenado por scorePerformance desc
   */
  static calculate(rawDataArray: ManagerRawAnalyticsData[]): ManagerRankingEntry[] {
    if (!rawDataArray || rawDataArray.length === 0) {
      return [];
    }

    // 1. Calcular métricas derivadas para cada gerente
    const enriched = rawDataArray.map((raw) => this.enrichMetrics(raw));

    // 2. Normalizar cada dimensão relativamente à equipe
    const normalized = this.normalizeScores(enriched);

    // 3. Calcular Score final ponderado, status e tendência
    const scored = normalized.map((entry) => this.applyWeightsAndClassify(entry));

    // 4. Ordenar por scorePerformance desc e atribuir posição
    scored.sort((a, b) => b.scorePerformance - a.scorePerformance);
    scored.forEach((entry, idx) => {
      entry.position = idx + 1;
    });

    return scored;
  }

  // ============================================================
  // ETAPA 1: Enriquecimento de métricas derivadas
  // ============================================================

  private static enrichMetrics(raw: ManagerRawAnalyticsData): EnrichedManagerData {
    const totalClientes = raw.clientesAtivos + raw.clientesSemCompra;
    const taxaAtivacao = totalClientes > 0
      ? (raw.clientesAtivos / totalClientes) * 100
      : 0;

    // Variação Rolling 3M vs anterior
    let variacaoPct: number | null = null;
    if (raw.rollingFat3mAnterior > 0) {
      variacaoPct = ((raw.rollingFat3m - raw.rollingFat3mAnterior) / raw.rollingFat3mAnterior) * 100;
    } else if (raw.rollingFat3m > 0) {
      // Novo gerente com vendas: crescimento indeterminado
      variacaoPct = null;
    }

    // Coeficiente de variação mensal (consistência)
    const coeficienteVariacao = this.calcCoeficienteVariacao(raw.fatMensalRolling);

    // Faturamento per capita (normalizado por tamanho de carteira)
    const fatPerCapita = raw.clientesAtivos > 0
      ? raw.rollingFat3m / raw.clientesAtivos
      : 0;

    // Data quality assessment
    const dataQuality = this.assessDataQuality(raw);

    return {
      ...raw,
      taxaAtivacao,
      variacaoPct,
      coeficienteVariacao,
      fatPerCapita,
      dataQuality,
      // Scores por dimensão serão preenchidos na normalização
      scoreFinanceiro: 0,
      scoreCrescimento: 0,
      scoreCarteira: 0,
      scoreFrequencia: 0,
      scoreConsistencia: 0,
      scorePerformance: 0,
      tendencia: 'ESTAVEL' as PerformanceTrend,
      status: 'ATENCAO' as PerformanceStatus,
      position: 0,
    };
  }

  // ============================================================
  // ETAPA 2: Normalização relativa à equipe
  // ============================================================

  private static normalizeScores(data: EnrichedManagerData[]): EnrichedManagerData[] {
    // Filtrar gerentes com dados suficientes para normalização
    const withData = data.filter((d) => d.dataQuality !== 'SEM_DADOS');

    if (withData.length === 0) {
      // Todos sem dados — manter scores em 0
      return data;
    }

    // a) Resultado Financeiro: normalizado por fatPerCapita (evita viés de carteira)
    const fatPerCapitaValues = withData.map((d) => d.fatPerCapita);
    const fatMin = Math.min(...fatPerCapitaValues);
    const fatMax = Math.max(...fatPerCapitaValues);

    // b) Crescimento: normalizado pela variação percentual com cap
    const variacaoValues = withData
      .filter((d) => d.variacaoPct !== null)
      .map((d) => Math.max(-MAX_VARIACAO_CAP, Math.min(MAX_VARIACAO_CAP, d.variacaoPct!)));
    const varMin = variacaoValues.length > 0 ? Math.min(...variacaoValues) : 0;
    const varMax = variacaoValues.length > 0 ? Math.max(...variacaoValues) : 0;

    // c) Saúde da carteira: taxa de ativação (%) já normalizada naturalmente (0-100)

    // d) Frequência: normalizada pelo máximo teórico (3.0)

    // e) Consistência: CV invertido (menor CV = maior score)
    const cvValues = withData.map((d) => d.coeficienteVariacao);
    const cvMin = Math.min(...cvValues);
    const cvMax = Math.max(...cvValues);

    // Aplicar normalização a TODOS os gerentes (incluindo SEM_DADOS que ficam com 0)
    for (const entry of data) {
      if (entry.dataQuality === 'SEM_DADOS') {
        entry.scoreFinanceiro = 0;
        entry.scoreCrescimento = 0;
        entry.scoreCarteira = 0;
        entry.scoreFrequencia = 0;
        entry.scoreConsistencia = 0;
        continue;
      }

      // Resultado Financeiro (per capita normalizado)
      entry.scoreFinanceiro = this.safeNormalize(entry.fatPerCapita, fatMin, fatMax);

      // Crescimento
      if (entry.variacaoPct !== null) {
        const cappedVar = Math.max(-MAX_VARIACAO_CAP, Math.min(MAX_VARIACAO_CAP, entry.variacaoPct));
        entry.scoreCrescimento = this.safeNormalize(cappedVar, varMin, varMax);
      } else {
        // Sem período anterior para comparação → score neutro (50)
        entry.scoreCrescimento = 50;
      }

      // Saúde da Carteira (taxa de ativação — já é 0-100%)
      entry.scoreCarteira = Math.min(100, Math.max(0, entry.taxaAtivacao));

      // Frequência (normalizada pelo máximo teórico)
      entry.scoreFrequencia = Math.min(100, Math.max(0, (entry.frequenciaMedia / MAX_FREQUENCIA) * 100));

      // Consistência (CV invertido: menor CV = melhor)
      entry.scoreConsistencia = this.safeNormalizeInverted(entry.coeficienteVariacao, cvMin, cvMax);
    }

    return data;
  }

  // ============================================================
  // ETAPA 3: Score final ponderado + classificação
  // ============================================================

  private static applyWeightsAndClassify(entry: EnrichedManagerData): ManagerRankingEntry {
    // Score final ponderado
    let scorePerformance = 0;
    if (entry.dataQuality !== 'SEM_DADOS') {
      scorePerformance = Math.round(
        entry.scoreFinanceiro * WEIGHTS.FINANCEIRO +
        entry.scoreCrescimento * WEIGHTS.CRESCIMENTO +
        entry.scoreCarteira * WEIGHTS.CARTEIRA +
        entry.scoreFrequencia * WEIGHTS.FREQUENCIA +
        entry.scoreConsistencia * WEIGHTS.CONSISTENCIA
      );
      // Clamp final
      scorePerformance = Math.max(0, Math.min(100, scorePerformance));
    }

    // Status de performance
    let status: PerformanceStatus;
    if (entry.dataQuality === 'SEM_DADOS') {
      status = 'CRITICO';
    } else if (scorePerformance >= 80) {
      status = 'TOP_PERFORMER';
    } else if (scorePerformance >= 60) {
      status = 'CONSISTENTE';
    } else if (scorePerformance >= 40) {
      status = 'ATENCAO';
    } else {
      status = 'CRITICO';
    }

    // Tendência (variação do score vs. proxy de tendência via crescimento)
    let tendencia: PerformanceTrend = 'ESTAVEL';
    if (entry.variacaoPct !== null) {
      if (entry.variacaoPct >= 10) {
        tendencia = 'EM_EVOLUCAO';
      } else if (entry.variacaoPct <= -10) {
        tendencia = 'EM_QUEDA';
      }
    }

    return {
      position: entry.position,
      managerId: entry.managerId,
      managerName: entry.managerName,
      rollingFat3m: this.safeRound(entry.rollingFat3m),
      rollingFat3mAnterior: this.safeRound(entry.rollingFat3mAnterior),
      variacaoPct: entry.variacaoPct !== null ? this.safeRound(entry.variacaoPct, 1) : null,
      clientesAtivos: entry.clientesAtivos,
      clientesSemCompra: entry.clientesSemCompra,
      taxaAtivacao: this.safeRound(entry.taxaAtivacao, 1),
      frequenciaMedia: this.safeRound(entry.frequenciaMedia, 2),
      concentracaoTop3: this.safeRound(entry.concentracaoTop3, 1),
      coeficienteVariacao: this.safeRound(entry.coeficienteVariacao, 1),
      scoreFinanceiro: Math.round(entry.scoreFinanceiro),
      scoreCrescimento: Math.round(entry.scoreCrescimento),
      scoreCarteira: Math.round(entry.scoreCarteira),
      scoreFrequencia: Math.round(entry.scoreFrequencia),
      scoreConsistencia: Math.round(entry.scoreConsistencia),
      scorePerformance,
      tendencia,
      status,
      dataQuality: entry.dataQuality,
    };
  }

  // ============================================================
  // UTILITÁRIOS INTERNOS
  // ============================================================

  /**
   * Calcula o Coeficiente de Variação (CV) de uma série de valores mensais.
   * CV = (desvio padrão / média) * 100
   * Quanto menor, mais consistente.
   */
  private static calcCoeficienteVariacao(values: number[]): number {
    if (!values || values.length < 2) return 0;

    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;

    if (mean === 0) return 0;

    const sumSquaredDiffs = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
    const stddev = Math.sqrt(sumSquaredDiffs / values.length);
    const cv = (stddev / Math.abs(mean)) * 100;

    return this.safeNumber(cv);
  }

  /**
   * Avalia a qualidade dos dados disponíveis para o gerente.
   */
  private static assessDataQuality(raw: ManagerRawAnalyticsData): DataQuality {
    // Sem nenhum faturamento e nenhum cliente: SEM_DADOS
    if (raw.rollingFat3m === 0 && raw.clientesAtivos === 0 && raw.clientesSemCompra === 0) {
      return 'SEM_DADOS';
    }

    // Sem período anterior para comparação: EM AVALIAÇÃO
    if (raw.rollingFat3mAnterior === 0 && raw.rollingFat3m > 0) {
      return 'AVALIACAO';
    }

    // Carteira pequena
    const totalClientes = raw.clientesAtivos + raw.clientesSemCompra;
    if (totalClientes > 0 && totalClientes < MIN_CLIENTES_CARTEIRA_NORMAL) {
      return 'CARTEIRA_REDUZIDA';
    }

    return 'COMPLETO';
  }

  /**
   * Normalização min-max segura para o intervalo [0, 100].
   * Retorna 50 quando min === max (todos iguais → score neutro).
   */
  private static safeNormalize(value: number, min: number, max: number): number {
    if (max === min) return 50; // Todos iguais na equipe
    const normalized = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, this.safeNumber(normalized)));
  }

  /**
   * Normalização min-max invertida segura (menor valor = maior score).
   */
  private static safeNormalizeInverted(value: number, min: number, max: number): number {
    if (max === min) return 50;
    const normalized = ((max - value) / (max - min)) * 100;
    return Math.max(0, Math.min(100, this.safeNumber(normalized)));
  }

  /**
   * Garante que um número é finito e não NaN.
   */
  private static safeNumber(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value;
  }

  /**
   * Arredondamento seguro com proteção contra NaN/Infinity.
   */
  private static safeRound(value: number, decimals: number = 2): number {
    if (!Number.isFinite(value)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

// ============================================================
// TIPO INTERNO (enriquecido durante processamento)
// ============================================================

interface EnrichedManagerData extends ManagerRawAnalyticsData {
  taxaAtivacao: number;
  variacaoPct: number | null;
  coeficienteVariacao: number;
  fatPerCapita: number;
  dataQuality: DataQuality;
  scoreFinanceiro: number;
  scoreCrescimento: number;
  scoreCarteira: number;
  scoreFrequencia: number;
  scoreConsistencia: number;
  scorePerformance: number;
  tendencia: PerformanceTrend;
  status: PerformanceStatus;
  position: number;
}
