import { MatchingResult } from "./clienteMatching";

export interface ConfidenceScoreResult {
  confianca: number; // 0 to 100
  fatores: string[]; // List of factors/justifications
}

/**
 * Camada 3 – Score de Confiança e Explicabilidade
 * Calcula a confiança final baseado na estratégia de pareamento e no comportamento do faturamento.
 */
export function calcularScoreConfianca(
  matchingResult: MatchingResult,
  faturamentoRecords: any[] // All faturamento records (from cm_faturamento) for this client's code or matched name
): ConfidenceScoreResult {
  const fatores: string[] = [];
  let baseScore = 0;

  // 1. Base Score depending on Matching Strategy
  switch (matchingResult.matchingStrategy) {
    case 'codigo':
      baseScore = 100;
      fatores.push("Correspondência exata por código de parceiro (Base: 100%)");
      break;
    case 'cnpj':
      baseScore = 100;
      fatores.push("Correspondência exata por CNPJ (Base: 100%)");
      break;
    case 'nome_normalizado':
      baseScore = 95;
      fatores.push("Correspondência exata por nome normalizado (Base: 95%)");
      break;
    case 'similarity':
      baseScore = Math.round(matchingResult.matchingScore * 100);
      fatores.push(`Pareamento por similaridade textual de ${baseScore}% (Base: ${baseScore}%)`);
      break;
  }

  // 2. Faturamento Bonuses (only if we have faturamento records and base score < 100)
  // Let's summarize the faturamento records first.
  if (faturamentoRecords.length > 0) {
    const totalVal = faturamentoRecords.reduce((acc, r) => acc + Number(r.total_faturamento || 0), 0);
    const totalFreq = faturamentoRecords.reduce((acc, r) => acc + Number(r.frequencia || 0), 0);
    
    // Find latest date in faturamento
    let latestDate: Date | null = null;
    for (const r of faturamentoRecords) {
      if (r.latest_date) {
        const d = new Date(r.latest_date);
        if (!latestDate || d > latestDate) {
          latestDate = d;
        }
      }
    }

    let bonus = 0;

    // A. Recency Bonus (last faturamento date)
    if (latestDate) {
      const now = new Date();
      const diffMs = now.getTime() - latestDate.getTime();
      const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);

      if (diffMonths <= 3) {
        bonus += 10;
        fatores.push("Faturamento ativo e recente nos últimos 3 meses (Bônus: +10%)");
      } else if (diffMonths <= 6) {
        bonus += 5;
        fatores.push("Faturamento ativo nos últimos 6 meses (Bônus: +5%)");
      } else {
        fatores.push("Faturamento inativo há mais de 6 meses (Sem bônus de recência)");
      }
    }

    // B. Frequency Bonus (number of transactions)
    if (totalFreq > 10) {
      bonus += 10;
      fatores.push(`Frequência alta de faturamento: ${totalFreq} notas (Bônus: +10%)`);
    } else if (totalFreq >= 3) {
      bonus += 5;
      fatores.push(`Frequência moderada de faturamento: ${totalFreq} notas (Bônus: +5%)`);
    } else {
      fatores.push(`Frequência baixa de faturamento: ${totalFreq} notas (Sem bônus de frequência)`);
    }

    // C. Value Bonus (total liquid faturamento value)
    if (totalVal > 100000) {
      bonus += 10;
      fatores.push(`Volume financeiro alto: R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Bônus: +10%)`);
    } else if (totalVal >= 10000) {
      bonus += 5;
      fatores.push(`Volume financeiro moderado: R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Bônus: +5%)`);
    } else {
      fatores.push(`Volume financeiro baixo: R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Sem bônus de volume)`);
    }

    baseScore = Math.min(100, baseScore + bonus);
  } else {
    fatores.push("Nenhum histórico de faturamento recente localizado (Sem bônus de faturamento)");
  }

  return {
    confianca: baseScore,
    fatores
  };
}
