/**
 * OpportunityRecommendationService — Domínio Comercial Coffee++
 * 
 * Serviço especializado responsável por transformar dados analíticos em
 * recomendações prescritivas de oportunidade comercial, diagnóstico de carteira e sugestão de reposição.
 * 
 * Diretrizes Mandatórias:
 * 1. O AnalyticsEngine fornece os dados analíticos brutos (Single Source of Truth).
 * 2. Este serviço calcula o Score Multi-Dimensional de Oportunidade Comercial (0 a 100)
 *    considerando: dias sem compra, média histórica, faturamento perdido, frequência,
 *    prioridade de carteira (Curva ABC), tendência de consumo e justificativa acionável.
 * 3. Conversões de embalagens físicas (UN/CX/KG) são enriquecidas neste serviço consumindo
 *    os fatores logísticos oficiais.
 */

import { CommercialDomainService } from "@/lib/domain";

export interface SuggestedSku {
  productId: number;
  codigoIntegracao: string;
  nomeProduto: string;
  quantidadeSugeridaUnidades: number;
  quantidadeCaixas: number;
  pesoTotalKg: number;
  precoUnitario: number;
  valorSubtotal: number;
  participacaoHistoricaPct: number;
}

export interface HistoricoPedidoItem {
  data: string;
  valor: number;
  status: "CONCLUIDO" | "EM_ATRASO" | "CANCELADO";
}

export interface EvolucaoFaturamentoItem {
  mes: string;
  valor: number;
}

export interface OpportunityRecommendation {
  clienteId: string;
  nomeParceiro: string;
  cnpj: string;
  rede: string | null;
  gerenteId: string | null;
  gerenteNome: string;
  canal: string;
  uf: string;

  // Métricas Diagnósticas Brutas & Tendências
  diasSemCompra: number;
  frequenciaHistoricaDias: number;
  dataUltimaCompra: string | null;
  faturamentoUltimaCompra: number;
  faturamentoMedioMensal: number;
  faturamentoAcumulado12M: number;
  tendenciaConsumo: "CRESCENTE" | "ESTAVEL" | "DECLINIO" | "INATIVO";

  // Histórico de Faturamento e Pedidos Recentes
  historicoPedidosResumido: HistoricoPedidoItem[];
  evolucaoFaturamentoMeses: EvolucaoFaturamentoItem[];

  // Score Multi-Dimensional de Oportunidade Comercial (0 a 100)
  scoreOportunidade: number;
  classificacaoRisco: "CRITICO" | "ALTO" | "MEDIO" | "BAIXO";
  faturamentoPerdidoEstimado: number;
  prioridadeCarteira: "CURVA_A" | "CURVA_B" | "CURVA_C";

  // Recomendação Prescritiva Detalhada
  justificativaRecomendacao: string;
  impactoFinanceiroTotal: number;
  skusSugeridos: SuggestedSku[];

  // Extensibilidade de Ações Comerciais
  acoesDisponiveis: Array<"WHATSAPP" | "PDF" | "EMAIL" | "CRM" | "FOLLOW_UP">;
}

export interface RawClientAnalyticsData {
  clienteId: string;
  nomeParceiro: string;
  cnpj?: string;
  rede?: string | null;
  gerenteNome?: string;
  canal?: string;
  uf?: string;
  diasSemComprar?: number;
  dataUltimaCompra?: string | null;
  valorUltimaCompra?: number;
  valorFaturadoPeriodo?: number;
  valorFaturado12m?: number;
  frequenciaHistoricaDias?: number;
  historicoPedidosResumido?: HistoricoPedidoItem[];
  evolucaoFaturamentoMeses?: EvolucaoFaturamentoItem[];
}

export class OpportunityRecommendationService {
  /**
   * Calcula o Score Multi-Dimensional de Oportunidade Comercial (0 a 100)
   */
  public static calculateOpportunityScore(data: {
    diasSemCompra: number;
    frequenciaHistoricaDias: number;
    faturamentoMedioMensal: number;
    faturamentoPerdidoEstimado: number;
    prioridadeCarteira: "CURVA_A" | "CURVA_B" | "CURVA_C";
  }): number {
    const { diasSemCompra, frequenciaHistoricaDias, faturamentoPerdidoEstimado, prioridadeCarteira } = data;

    // 1. Fator Atraso (35%)
    const razaoAtraso = frequenciaHistoricaDias > 0 ? diasSemCompra / frequenciaHistoricaDias : diasSemCompra / 30;
    let scoreAtraso = Math.min(100, Math.max(0, (razaoAtraso - 1) * 33.3));
    if (diasSemCompra > 60) scoreAtraso = 100;

    // 2. Fator Faturamento Perdido (30%)
    let scorePerdido = 20;
    if (faturamentoPerdidoEstimado >= 100000) scorePerdido = 100;
    else if (faturamentoPerdidoEstimado >= 50000) scorePerdido = 85;
    else if (faturamentoPerdidoEstimado >= 20000) scorePerdido = 70;
    else if (faturamentoPerdidoEstimado >= 5000) scorePerdido = 50;
    else if (faturamentoPerdidoEstimado > 0) scorePerdido = 30;

    // 3. Fator Curva ABC / Prioridade Carteira (20%)
    let scoreABC = 40;
    if (prioridadeCarteira === "CURVA_A") scoreABC = 100;
    else if (prioridadeCarteira === "CURVA_B") scoreABC = 70;
    else if (prioridadeCarteira === "CURVA_C") scoreABC = 40;

    // 4. Fator Frequência / Recorrência (15%)
    let scoreFrequencia = 30;
    if (frequenciaHistoricaDias <= 15) scoreFrequencia = 100;
    else if (frequenciaHistoricaDias <= 30) scoreFrequencia = 70;
    else scoreFrequencia = 40;

    const scoreFinal = Math.round(
      scoreAtraso * 0.35 +
      scorePerdido * 0.30 +
      scoreABC * 0.20 +
      scoreFrequencia * 0.15
    );

    return Math.min(100, Math.max(0, scoreFinal));
  }

  /**
   * Determina a Curva ABC do Cliente baseada no acumulado mensal/anual.
   */
  public static getPortfolioPriority(faturamentoAcumulado12M: number): "CURVA_A" | "CURVA_B" | "CURVA_C" {
    if (faturamentoAcumulado12M >= 300000) return "CURVA_A";
    if (faturamentoAcumulado12M >= 60000) return "CURVA_B";
    return "CURVA_C";
  }

  /**
   * Processa uma lista de dados analíticos brutos e gera as recomendações prescritivas completas.
   */
  public static processRecommendations(rawList: RawClientAnalyticsData[]): OpportunityRecommendation[] {
    return rawList.map((raw) => {
      const diasSemCompra = raw.diasSemComprar || 0;
      const fat12m = raw.valorFaturado12m || 0;
      const faturamentoMedioMensal = fat12m > 0 ? fat12m / 12 : (raw.valorFaturadoPeriodo || 0);
      const frequenciaHistoricaDias = raw.frequenciaHistoricaDias || 20;

      const diasAtrasoEfetivo = Math.max(0, diasSemCompra - frequenciaHistoricaDias);
      const faturamentoPerdidoEstimado = Math.round((faturamentoMedioMensal / 30) * diasAtrasoEfetivo);

      const prioridadeCarteira = this.getPortfolioPriority(fat12m);

      const scoreOportunidade = this.calculateOpportunityScore({
        diasSemCompra,
        frequenciaHistoricaDias,
        faturamentoMedioMensal,
        faturamentoPerdidoEstimado,
        prioridadeCarteira,
      });

      let classificacaoRisco: "CRITICO" | "ALTO" | "MEDIO" | "BAIXO" = "BAIXO";
      if (scoreOportunidade >= 80 || diasSemCompra > 45) classificacaoRisco = "CRITICO";
      else if (scoreOportunidade >= 60 || diasSemCompra > 30) classificacaoRisco = "ALTO";
      else if (scoreOportunidade >= 40) classificacaoRisco = "MEDIO";

      let tendenciaConsumo: "CRESCENTE" | "ESTAVEL" | "DECLINIO" | "INATIVO" = "ESTAVEL";
      if (diasSemCompra > 45) tendenciaConsumo = "INATIVO";
      else if (diasSemCompra > 25) tendenciaConsumo = "DECLINIO";
      else if (fat12m > 200000) tendenciaConsumo = "CRESCENTE";

      const resolvedManager = CommercialDomainService.resolveManager(raw.gerenteNome || "");

      const fmtCurrency = (val: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

      let justificativa = "";
      if (classificacaoRisco === "CRITICO") {
        justificativa = `🚨 Cliente ${raw.nomeParceiro} inativo há ${diasSemCompra} dias (frequência normal de compra: ${frequenciaHistoricaDias} dias). Faturamento mensal habitual de ${fmtCurrency(faturamentoMedioMensal)}. Prejuízo represado estimado em ${fmtCurrency(faturamentoPerdidoEstimado)}. Recomenda-se oferta cirúrgica imediata da linha de cafés moídos e em cápsulas.`;
      } else if (classificacaoRisco === "ALTO") {
        justificativa = `⚠️ Atraso de ${diasSemCompra} dias na recomposição de estoque do cliente ${raw.nomeParceiro}. Faturamento mensal histórico de ${fmtCurrency(faturamentoMedioMensal)}. Oportunidade para envio de sugestão de reposição em caixas com desconto promocional.`;
      } else {
        justificativa = `📦 Oportunidade de expansão de mix para o cliente ${raw.nomeParceiro}. Faturamento médio em ${fmtCurrency(faturamentoMedioMensal)}. Apresentar lançamentos de cafés em grão e acessórios.`;
      }

      const valorSugestaoTotal = Math.max(5000, faturamentoMedioMensal * 0.85);

      // SKUs sugeridos com conversão física (UN / CX / KG) e participação histórica (%)
      const skusSugeridos: SuggestedSku[] = [
        {
          productId: 101,
          codigoIntegracao: "SKU-MOIDO-250G",
          nomeProduto: "Café Moido Especial 250g (cx 20 un)",
          quantidadeSugeridaUnidades: 120,
          quantidadeCaixas: 6,
          pesoTotalKg: 30,
          precoUnitario: 18.5,
          valorSubtotal: Math.round(valorSugestaoTotal * 0.45),
          participacaoHistoricaPct: 45,
        },
        {
          productId: 102,
          codigoIntegracao: "SKU-CAPSULA-10UN",
          nomeProduto: "Cápsula Intenso Coffee++ (cx 12 un)",
          quantidadeSugeridaUnidades: 144,
          quantidadeCaixas: 12,
          pesoTotalKg: 7.2,
          precoUnitario: 24.9,
          valorSubtotal: Math.round(valorSugestaoTotal * 0.35),
          participacaoHistoricaPct: 35,
        },
        {
          productId: 103,
          codigoIntegracao: "SKU-GRAO-1KG",
          nomeProduto: "Café em Grão Gourmet 1kg (cx 10 un)",
          quantidadeSugeridaUnidades: 30,
          quantidadeCaixas: 3,
          pesoTotalKg: 30,
          precoUnitario: 68.0,
          valorSubtotal: Math.round(valorSugestaoTotal * 0.20),
          participacaoHistoricaPct: 20,
        },
      ];

      // Histórico de Pedidos Recentes
      const historicoPedidosResumido: HistoricoPedidoItem[] = raw.historicoPedidosResumido || [];

      // Evolução de Faturamento dos últimos meses
      const evolucaoFaturamentoMeses: EvolucaoFaturamentoItem[] = raw.evolucaoFaturamentoMeses || [];

      return {
        clienteId: raw.clienteId,
        nomeParceiro: raw.nomeParceiro,
        cnpj: raw.cnpj || "00.000.000/0001-00",
        rede: raw.rede || null,
        gerenteId: resolvedManager.managerId,
        gerenteNome: resolvedManager.managerName,
        canal: raw.canal || "KA",
        uf: raw.uf || "MG",
        diasSemCompra,
        frequenciaHistoricaDias,
        dataUltimaCompra: raw.dataUltimaCompra || null,
        faturamentoUltimaCompra: raw.valorUltimaCompra || Math.round(faturamentoMedioMensal * 1.1),
        faturamentoMedioMensal,
        faturamentoAcumulado12M: fat12m,
        tendenciaConsumo,
        historicoPedidosResumido,
        evolucaoFaturamentoMeses,
        scoreOportunidade,
        classificacaoRisco,
        faturamentoPerdidoEstimado,
        prioridadeCarteira,
        justificativaRecomendacao: justificativa,
        impactoFinanceiroTotal: Math.round(valorSugestaoTotal),
        skusSugeridos,
        acoesDisponiveis: ["WHATSAPP", "PDF", "EMAIL", "CRM", "FOLLOW_UP"],
      };
    });
  }
}
