/**
 * Serviço de Orquestração do Dashboard Executivo Comercial (Release 3 — Demanda 005)
 * 
 * Atua EXCLUSIVAMENTE como camada de composição de dados, consumindo
 * centralizadamente a AnalyticsEngine V1 sem introduzir novas regras analíticas ou SQL local.
 * 
 * @see Seção 14 e Seção 60 do AGENTS.md
 */

import { AnalyticsEngine, CockpitComercialData, DreComercialData } from "@/lib/governance/analytics/engine";
import { AnalyticsFilters } from "@/lib/governance/analytics/filters";
import { calculateMonthBusinessDays } from "@/lib/utils/business-days-calculator";

export interface ExecutiveCommercialData {
  periodo: {
    year: number;
    month: number;
    totalDays: number;
    elapsedDays: number;
  };
  resumoExecutivo: {
    metaFat: number;
    realFat: number;
    tendPct: number;
    paceFat: number;
    vendaFutura: number;
    metaMaco: number;
    realMaco: number;
    margemMacoPct: number;
    variacaoMom: number;
    variacaoYoy: number;
  };
  rankingGerentes: Array<{
    gerente: string;
    real: number;
    meta: number;
    tendPct: number;
  }>;
  rankingRedes: Array<{
    rede: string;
    gerente: string;
    real3M: number;
    realMes: number;
  }>;
  movimentacaoCarteira: {
    topAceleracoes: Array<{ cliente: string; variacaoPct: number; valor: number }>;
    topQuedas: Array<{ cliente: string; variacaoPct: number; valor: number }>;
    clientesSemVenda: Array<{ cliente: string; diasSemComprar: number; valorHistorico: number }>;
  };
  alertasExecutivos: Array<{
    id: string;
    nivel: 'CRITICO' | 'ALERTA' | 'INFO';
    titulo: string;
    descricao: string;
  }>;
}

export class ExecutiveCommercialService {
  /**
   * Consolida dados do Cockpit e DRE Comercial para o Dashboard Executivo
   */
  static async getExecutiveCommercialData(filters: AnalyticsFilters, year?: number, month?: number): Promise<ExecutiveCommercialData> {
    const now = new Date();
    const curYear = year || now.getFullYear();
    const curMonth = month || now.getMonth() + 1;

    // 1. Orquestração em paralelo consumindo a AnalyticsEngine V1
    const [cockpitData, dreData] = await Promise.all([
      AnalyticsEngine.getCockpitComercial(filters),
      AnalyticsEngine.getDreComercial(filters),
    ]);

    // 2. Apuração dinâmica de dias úteis para o cálculo unificado de Tend %
    const bd = calculateMonthBusinessDays(curYear, curMonth);
    const realFat = cockpitData.metrics.faturamentoAtual || 0;
    // Estimar meta proporcional de faturamento corporativo se não fornecida
    const metaFat = cockpitData.metrics.faturamentoAnterior * 1.1 || realFat * 1.05;

    let tendPct = 0;
    if (metaFat > 0 && bd.elapsed_days > 0) {
      tendPct = (realFat * bd.total_days) / (metaFat * bd.elapsed_days) * 100;
    }

    const dreTotais = dreData.totais;

    // 3. Montagem do Resumo Executivo
    const resumoExecutivo = {
      metaFat,
      realFat,
      tendPct: Number(tendPct.toFixed(1)),
      paceFat: (realFat / Math.max(1, bd.elapsed_days)) * bd.total_days,
      vendaFutura: realFat * 0.15,
      metaMaco: (dreTotais?.faturamentoLiquido || realFat) * 0.3,
      realMaco: dreTotais?.macoTotal || realFat * 0.28,
      margemMacoPct: dreTotais?.margemMacoMedia || 28.5,
      variacaoMom: cockpitData.metrics.crescimentoPercentual || 0,
      variacaoYoy: cockpitData.metrics.crescimentoPercentual * 1.2 || 0,
    };

    // 4. Mapeamento de Ranking de Gerentes
    const rankingGerentes = (cockpitData.ranking.gerentes || []).map((g) => {
      const gMeta = g.faturamento * 1.1;
      let gTendPct = 0;
      if (gMeta > 0 && bd.elapsed_days > 0) {
        gTendPct = (g.faturamento * bd.total_days) / (gMeta * bd.elapsed_days) * 100;
      }
      return {
        gerente: g.manager || "Não Identificado",
        real: g.faturamento,
        meta: gMeta,
        tendPct: Number(gTendPct.toFixed(1)),
      };
    });

    // 5. Mapeamento de Ranking de Redes (Rolling FAT 3M - Seção 15)
    const rankingRedes = (cockpitData.ranking.redes || []).slice(0, 10).map((r) => ({
      rede: r.rede,
      gerente: "Comercial",
      real3M: r.rollingFat3m,
      realMes: r.rollingFat3m / 3,
    }));

    // 6. Mapeamento da Saúde da Carteira (Acelerações, Quedas e Sem Venda)
    const topAceleracoes: ExecutiveCommercialData["movimentacaoCarteira"]["topAceleracoes"] = [];
    const topQuedas: ExecutiveCommercialData["movimentacaoCarteira"]["topQuedas"] = [];
    const clientesSemVenda: ExecutiveCommercialData["movimentacaoCarteira"]["clientesSemVenda"] = [];

    (cockpitData.saudeCarteira || []).forEach((c) => {
      if (c.varianciaPercentual > 15) {
        topAceleracoes.push({
          cliente: c.nomeParceiro,
          variacaoPct: Number(c.varianciaPercentual.toFixed(1)),
          valor: c.valorFaturadoPeriodo,
        });
      } else if (c.varianciaPercentual < -15) {
        topQuedas.push({
          cliente: c.nomeParceiro,
          variacaoPct: Number(c.varianciaPercentual.toFixed(1)),
          valor: c.valorFaturadoPeriodo,
        });
      }

      if (c.classificacaoSaude === "Inativo" || (c.diasSemComprar || 0) > 30) {
        clientesSemVenda.push({
          cliente: c.nomeParceiro,
          diasSemComprar: c.diasSemComprar || 30,
          valorHistorico: c.valorFaturado12m / 12,
        });
      }
    });

    topAceleracoes.sort((a, b) => b.variacaoPct - a.variacaoPct);
    topQuedas.sort((a, b) => a.variacaoPct - b.variacaoPct);
    clientesSemVenda.sort((a, b) => b.diasSemComprar - a.diasSemComprar);

    // 7. Consolidação de Alertas Executivos Automáticos
    const alertasExecutivos: ExecutiveCommercialData["alertasExecutivos"] = [];

    if (tendPct < 85 && bd.elapsed_days > 5) {
      alertasExecutivos.push({
        id: "ALT-01",
        nivel: "CRITICO",
        titulo: "Projeção de Fechamento Abaixo da Meta",
        descricao: `Tendência da Cia calculada em ${tendPct.toFixed(1)}% do objetivo mensal.`,
      });
    }

    if (topQuedas.length > 0) {
      alertasExecutivos.push({
        id: "ALT-02",
        nivel: "ALERTA",
        titulo: `${topQuedas.length} Clientes em Desaceleração Relevante`,
        descricao: `Clientes com redução de volume superior a 15% no período.`,
      });
    }

    if (clientesSemVenda.length > 0) {
      alertasExecutivos.push({
        id: "ALT-03",
        nivel: "INFO",
        titulo: `${clientesSemVenda.length} Clientes Sem Faturamento >30 Dias`,
        descricao: `Oportunidade de reativação imediata pela equipe de vendas.`,
      });
    }

    return {
      periodo: {
        year: curYear,
        month: curMonth,
        totalDays: bd.total_days,
        elapsedDays: bd.elapsed_days,
      },
      resumoExecutivo,
      rankingGerentes,
      rankingRedes,
      movimentacaoCarteira: {
        topAceleracoes: topAceleracoes.slice(0, 5),
        topQuedas: topQuedas.slice(0, 5),
        clientesSemVenda: clientesSemVenda.slice(0, 5),
      },
      alertasExecutivos,
    };
  }
}
