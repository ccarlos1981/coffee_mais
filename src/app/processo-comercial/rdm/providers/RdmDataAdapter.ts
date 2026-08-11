/**
 * RDM Consumer Adapter — RdmDataAdapter (ADR-001)
 *
 * Implements IDataProvider contract by converting RDM API payload into normalized widget data.
 * The core Presentation Framework does NOT import or depend on this file!
 */

import { IDataProvider, NormalizedWidgetData, WidgetConfig } from '@/lib/presentation-framework/core';
import { formatCurrency, formatNumber } from '@/lib/formatters';

export class RdmDataAdapter implements IDataProvider {
  private rdmPayload: any;

  constructor(rdmPayload: any) {
    this.rdmPayload = rdmPayload || {};
  }

  public getDreData() {
    return this.rdmPayload.dre || null;
  }

  public getWidgetData(widget: WidgetConfig): NormalizedWidgetData {
    const farol = this.rdmPayload.farol || {};
    const monthlyFat = this.rdmPayload.monthlyFat || [];
    const volPreco = this.rdmPayload.volPreco || [];
    const familias = this.rdmPayload.familias || [];
    const dre = this.rdmPayload.dre || null;

    // Direct DRE targets handling
    if (widget.id === 'w_dre_kpis' || widget.customProps?.target === 'dre_kpis') {
      const totais = dre?.totais || {};
      const metrics = [
        {
          label: 'Receita Líquida',
          value: formatCurrency(totais.faturamentoLiquido || 0),
          target: formatCurrency(totais.faturamentoBruto || 0),
          delta: 'NS',
          status: 'green' as const,
        },
        {
          label: 'MACO',
          value: formatCurrency(totais.macoTotal || 0),
          delta: `${(totais.margemMacoMedia || 0).toFixed(2)}%`,
          status: ((totais.macoTotal || 0) >= 0 ? 'green' : 'red') as 'green' | 'red',
        },
        {
          label: 'MACO %',
          value: `${(totais.margemMacoMedia || 0).toFixed(2)}%`,
          status: ((totais.margemMacoMedia || 0) >= 10 ? 'green' : (totais.margemMacoMedia || 0) >= 0 ? 'yellow' : 'red') as 'green' | 'yellow' | 'red',
        },
        {
          label: 'CPV',
          value: formatCurrency(totais.cpv || 0),
          status: 'neutral' as const,
        },
        {
          label: 'Frete (3%)',
          value: formatCurrency(totais.frete || 0),
          status: 'neutral' as const,
        },
        {
          label: 'Investimentos',
          value: formatCurrency(totais.investimentoComercial || 0),
          status: 'neutral' as const,
        },
      ];

      return {
        title: widget.title,
        subtitle: widget.subtitle,
        metrics,
        raw: { totais },
      };
    }

    if (widget.id === 'w_dre_sintetica' || widget.customProps?.target === 'dre_sintetica') {
      const sintetica = dre?.sintetica || [];
      const steps = sintetica.map((s: any) => ({
        label: s.label,
        value: s.valor,
        percentual: s.percentual,
        tipo: s.tipo,
      }));

      return {
        title: widget.title,
        subtitle: widget.subtitle,
        raw: { steps, sintetica, totais: dre?.totais },
      };
    }

    if (widget.id === 'w_dre_rede_table' || widget.customProps?.target === 'dre_rede_table') {
      const rawDimensionais = dre?.dimensionais || [];
      // ORDENAÇÃO ABSOLUTA DA DRE: Receita Líquida DESC
      const sorted = [...rawDimensionais].sort((a: any, b: any) => (b.faturamentoLiquido || 0) - (a.faturamentoLiquido || 0));

      const columns = [
        { key: 'ranking', label: '#', align: 'center' as const },
        { key: 'rede', label: 'REDE / MATRIZ', align: 'left' as const },
        { key: 'faturamentoBruto', label: 'REC. BRUTA', align: 'right' as const },
        { key: 'faturamentoLiquido', label: 'REC. LÍQUIDA', align: 'right' as const },
        { key: 'cpv', label: 'CPV', align: 'right' as const },
        { key: 'frete', label: 'FRETE', align: 'right' as const },
        { key: 'investimentoComercial', label: 'INVESTIMENTO', align: 'right' as const },
        { key: 'maco', label: 'MACO', align: 'right' as const },
        { key: 'margemMacoPercentual', label: 'MACO %', align: 'right' as const },
      ];

      const rows = sorted.map((dim: any, idx: number) => ({
        ranking: idx + 1,
        rede: dim.nome || 'Outros',
        faturamentoBruto: formatCurrency(dim.faturamentoBruto || 0),
        faturamentoLiquido: formatCurrency(dim.faturamentoLiquido || 0),
        cpv: formatCurrency(dim.cpv || 0),
        frete: formatCurrency(dim.frete || 0),
        investimentoComercial: formatCurrency(dim.investimentoComercial || 0),
        maco: formatCurrency(dim.maco || 0),
        margemMacoPercentual: `${(dim.margemMacoPercentual || 0).toFixed(2)}%`,
        raw: dim,
      }));

      return {
        title: widget.title,
        subtitle: widget.subtitle,
        tableData: { columns, rows },
        raw: { dimensionais: sorted },
      };
    }

    switch (widget.type) {
      case 'kpi_card': {
        const metrics = [];

        if (farol.faturamento) {
          metrics.push({
            label: 'Faturamento',
            value: formatCurrency(farol.faturamento.realMonth || 0),
            target: formatCurrency(farol.faturamento.targetMonth || 0),
            delta: `${farol.faturamento.pctMonth >= 0 ? '+' : ''}${farol.faturamento.pctMonth?.toFixed(1)}%`,
            status: (farol.faturamento.pctMonth >= 0 ? 'green' : 'red') as any,
          });
        }

        if (farol.volume) {
          metrics.push({
            label: 'Volume (cx)',
            value: formatNumber(farol.volume.realMonth || 0),
            target: formatNumber(farol.volume.targetMonth || 0),
            delta: `${farol.volume.pctMonth >= 0 ? '+' : ''}${farol.volume.pctMonth?.toFixed(1)}%`,
            status: (farol.volume.pctMonth >= 0 ? 'green' : 'red') as any,
          });
        }

        if (farol.investimento) {
          metrics.push({
            label: 'Investimento (%)',
            value: `${farol.investimento.realMonth?.toFixed(1)}%`,
            target: `${farol.investimento.desafioMonth?.toFixed(1)}%`,
            delta: `${farol.investimento.realMonth <= farol.investimento.desafioMonth ? '-' : '+'}${Math.abs(farol.investimento.realMonth - farol.investimento.desafioMonth).toFixed(1)} p.p.`,
            status: (farol.investimento.realMonth <= farol.investimento.desafioMonth ? 'green' : 'red') as any,
          });
        }

        return {
          title: widget.title,
          subtitle: widget.subtitle,
          metrics,
        };
      }

      case 'bar_chart':
      case 'line_chart': {
        const chartData = (monthlyFat.length > 0 ? monthlyFat : volPreco).map((item: any) => ({
          name: item.monthLabel || item.mes || item.month || 'Mês',
          Faturamento: item.real || item.vlr_total_liq || item.faturamento || 0,
          Meta: item.target || item.meta || 0,
        }));

        return {
          title: widget.title,
          subtitle: widget.subtitle,
          chartData,
        };
      }

      case 'ranking': {
        const rankingData = familias.map((f: any, idx: number) => ({
          rank: idx + 1,
          name: f.familia || f.name || `Família ${idx + 1}`,
          value: formatNumber(f.vol_real || f.volume || 0),
          subtitle: `Preço Médio: R$ ${f.preco_medio?.toFixed(2) || '0,00'}`,
          highlight: idx < 3,
        }));

        return {
          title: widget.title,
          subtitle: widget.subtitle,
          rankingData,
        };
      }

      case 'table': {
        const columns = [
          { key: 'familia', label: 'Família', align: 'left' as const },
          { key: 'volume', label: 'Volume (un)', align: 'right' as const },
          { key: 'pctMesAnt', label: '% VS MÊS ANT', align: 'right' as const },
        ];

        const rows = familias.map((f: any) => ({
          familia: f.familia || f.name || 'Família',
          volume: formatNumber(f.vol_real || 0),
          pctMesAnt: `${f.pct_mes_ant >= 0 ? '+' : ''}${f.pct_mes_ant?.toFixed(1) || '0,0'}%`,
        }));

        return {
          title: widget.title,
          subtitle: widget.subtitle,
          tableData: { columns, rows },
        };
      }

      case 'heatmap': {
        return {
          title: widget.title,
          subtitle: widget.subtitle,
          raw: {
            columns: ['Mês Ant', 'Ano Ant', 'Desafio', 'Real'],
            rows: (familias.length > 0 ? familias : [
              { familia: 'Moído' }, { familia: 'Grão' }, { familia: 'Cápsula' }, { familia: 'Drip' }, { familia: '1 KG' }
            ]).map((f: any) => ({
              label: f.familia || f.name || 'Família',
              values: [
                f.pct_mes_ant ?? -8,
                f.pct_ano_ant ?? -20,
                100,
                Math.round(f.pct_desafio ?? 92),
              ],
            })),
          },
        };
      }

      case 'waterfall': {
        const steps = dre?.sintetica && Array.isArray(dre.sintetica) && dre.sintetica.length > 0
          ? dre.sintetica.map((s: any) => ({
              label: s.label,
              value: s.valor,
              percentual: s.percentual,
              tipo: s.tipo,
            }))
          : [
              { label: 'Receita Bruta', value: farol.faturamento?.realMonth || 1250000, type: 'positive' },
              { label: 'Deduções / Impostos', value: -150000, type: 'negative' },
              { label: 'Receita Líquida', value: 1100000, type: 'subtotal' },
              { label: 'CPV (Custo Produto)', value: -620000, type: 'negative' },
              { label: 'Frete (3%)', value: -33000, type: 'negative' },
              { label: 'Investimento Comercial', value: -110000, type: 'negative' },
              { label: 'MACO Final', value: 337000, type: 'total' },
            ];

        return {
          title: widget.title,
          subtitle: widget.subtitle,
          raw: { steps, totais: dre?.totais },
        };
      }

      case 'gauge': {
        const pct = farol.faturamento?.pctMonth ?? 96.5;
        return {
          title: widget.title,
          subtitle: widget.subtitle,
          metrics: [
            {
              label: 'Atingimento da Meta',
              value: `${pct.toFixed(1)}%`,
              percentage: pct,
              target: '100,0%',
            },
          ],
        };
      }

      case 'comments': {
        return {
          title: widget.title,
          subtitle: widget.subtitle,
          commentsData: [
            {
              id: 'c_1',
              author: 'Cristiano Santos',
              createdAt: new Date().toLocaleDateString('pt-BR'),
              category: 'observacao',
              text: 'Desempenho superou a meta no canal Ka com forte tração na linha de Grão.',
              isResolved: true,
            },
            {
              id: 'c_2',
              author: 'Luiz Silva',
              createdAt: new Date().toLocaleDateString('pt-BR'),
              category: 'alerta',
              text: 'Atenção para o limite do investimento comercial no canal Sudeste.',
              isResolved: false,
            },
          ],
        };
      }

      case 'action_plan': {
        return {
          title: widget.title,
          subtitle: widget.subtitle,
          actionPlanData: [
            {
              id: 'act_1',
              title: 'Ajuste de Mix na Rede Zaffari',
              description: 'Expandir distribuição da linha de Cápsulas nas lojas de Porto Alegre.',
              owner: 'Cristiano Santos',
              dueDate: '15/08/2026',
              priority: 'alta',
              status: 'em_andamento',
              createdAt: '25/07/2026',
              notes: 'Alinhado com o comprador comercial.',
            },
            {
              id: 'act_2',
              title: 'Revisão da Verba Trade SP',
              description: 'Readequar o investimento em encartes para respeitar o limite de 10%.',
              owner: 'Julliano (SPC)',
              dueDate: '10/08/2026',
              priority: 'urgente',
              status: 'pendente',
              createdAt: '26/07/2026',
              notes: 'Aguardando aprovação da Diretoria.',
            },
          ],
        };
      }

      case 'radar': {
        return {
          title: widget.title,
          subtitle: widget.subtitle,
          analyticsSpec: {
            metric: 'Atingimento de Indicadores',
            dimensions: ['Volume', 'Faturamento', 'Investimento', 'Positivação', 'Ticket Médio', 'Preço Médio'],
            formatting: 'percentage',
            legend: true,
          },
          radarData: [
            { subject: 'Volume', Meta: 100, Real: Math.round(farol.volume?.pctMonth ?? 92) },
            { subject: 'Faturamento', Meta: 100, Real: Math.round(farol.faturamento?.pctMonth ?? 96) },
            { subject: 'Investimento', Meta: 100, Real: Math.round(farol.investimento?.pctMonth ?? 88) },
            { subject: 'Positivação', Meta: 100, Real: Math.round(farol.positivacao?.pctMonth ?? 104) },
            { subject: 'Ticket Médio', Meta: 100, Real: 95 },
            { subject: 'Preço Médio', Meta: 100, Real: 98 },
          ],
        };
      }

      case 'text_block':
      default: {
        return {
          title: widget.title,
          subtitle: widget.subtitle,
          textData: {
            content: (widget.customProps?.text as string) || 'Slide personalizado do framework corporativo de apresentações.',
          },
        };
      }
    }
  }
}
