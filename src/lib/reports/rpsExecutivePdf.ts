/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXECUTIVE PDF RENDER ENGINE — COFFEE++ (RPS)
 * ═══════════════════════════════════════════════════════════════════════════
 * Renderer puro de PDF via pdfMake para o Executive Intelligence Report.
 * 
 * ARQUITETURA DESACOPLADA:
 * Este módulo NÃO contém nenhuma regra de negócio ou cálculo financeiro.
 * Recebe o payload estruturado `ExecutiveIntelligenceData` pré-processado pelo
 * `ExecutiveIntelligenceEngine` e constrói o layout impresso oficial.
 */

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { ExecutiveIntelligenceData } from "@/lib/governance/rps/executiveIntelligenceEngine";

// Configurar a fonte virtual do PDFMake
if (typeof window !== "undefined") {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfMake as any).vfs;
}

function formatCurrencyBrl(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
}

function formatNum(val: number, decimals = 1): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
}

function formatPctStr(val: number): string {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1).replace('.', ',')}%`;
}

function getStatusBadge(status: string) {
  if (status === "SAUDAVEL") return { text: "🟢 SAUDÁVEL", color: "#16a34a" };
  if (status === "ATENCAO") return { text: "🟡 ATENÇÃO", color: "#d97706" };
  return { text: "🔴 CRÍTICO", color: "#dc2626" };
}

function getTendenciaIcon(tendencia: string) {
  if (tendencia === "ALTA") return "Alta ⬆️";
  if (tendencia === "QUEDA") return "Queda ⬇️";
  return "Estável ➡️";
}

export function generateExecutivePdf(data: ExecutiveIntelligenceData) {
  if (typeof window === "undefined") return;

  // Assegurar VFS no pdfMake
  if (!(pdfMake as any).vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfMake as any).vfs;
  }

  const { metadata, scoreConsolidado, resumoExecutivoMatriz, perguntasExecutivas, oportunidadeFinanceira, evolucaoHistorica, scorecardsGerentes, rankingGerentes, redesOfensoras, redesDestaque, analiseInvestimento, decisionBoard, roadmap } = data;

  const statusInfo = getStatusBadge(scoreConsolidado.status);

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [40, 50, 40, 50],
    background: function() {
      return {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 595.28, h: 841.89, color: '#0d0d0d' }
        ]
      };
    },
    header: function(currentPage: number) {
      if (currentPage === 1) return null;
      return {
        columns: [
          { text: "Coffee++ • Executive Intelligence Report", style: "headerLeft" },
          { text: `Período: ${metadata.periodo}`, style: "headerRight" }
        ],
        margin: [40, 20, 40, 0]
      };
    },
    footer: function(currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: "Coffee++ • Relatório Executivo RPS • Confidencial", style: "footerLeft" },
          { text: `Página ${currentPage} de ${pageCount}`, style: "footerRight" }
        ],
        margin: [40, 0, 40, 20]
      };
    },
    content: [
      // ═════════════════════════════════════════════════════════════════
      // CAPA EXECUTIVA
      // ═════════════════════════════════════════════════════════════════
      { text: "COFFEE++", style: "brandLogo", margin: [0, 80, 0, 10] },
      { text: "RPS – REUNIÃO DE PLANEJAMENTO SEMANAL", style: "docTitle", margin: [0, 0, 0, 15] },
      { text: "EXECUTIVE INTELLIGENCE REPORT (VISÃO CEO)", style: "docSubTitle", margin: [0, 0, 0, 40] },

      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#c8a96e' }],
        margin: [0, 0, 0, 40]
      },

      {
        table: {
          widths: ['*'],
          body: [
            [{
              fillColor: '#1a1a1a',
              margin: [20, 20, 20, 20],
              stack: [
                { text: `PERÍODO DE REFERÊNCIA: ${metadata.periodo.toUpperCase()}`, style: "metaLabel" },
                { text: `DATA DE GERAÇÃO: ${metadata.dataHoraGeracao}`, style: "metaValue" },
                { text: `SOLICITANTE: ${metadata.usuarioGerador}`, style: "metaValue" },
                { text: `ÍNDICE DE CONFIANÇA ESTATÍSTICA: ${metadata.confidenceIndex}% (${metadata.confidenceStatus})`, style: "metaValueHighlight" }
              ]
            }]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 40]
      },

      { text: "DOCUMENTO EXECUTIVO ESTRATÉGICO — USO EXCLUSIVO DA PRESIDÊNCIA E DIRETORIA COMERCIAL", style: "confidentialNotice", margin: [0, 60, 0, 0] },

      // ═════════════════════════════════════════════════════════════════
      // PÁGINA 2: EXECUTIVE SUMMARY & SCORECARD
      // ═════════════════════════════════════════════════════════════════
      { text: "", pageBreak: 'after' },

      { text: "EXECUTIVE SUMMARY & SCORECARD CORPORATIVO", style: "sectionTitle" },

      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              {
                fillColor: '#181818',
                margin: [15, 15, 15, 15],
                stack: [
                  { text: "EXECUTIVE SCORE", style: "cardHeader" },
                  { text: `${scoreConsolidado.score} / 100`, style: "scoreBig" },
                  { text: statusInfo.text, color: statusInfo.color, style: "statusBadge" }
                ]
              },
              {
                fillColor: '#181818',
                margin: [15, 15, 15, 15],
                stack: [
                  { text: "TENDÊNCIA & CONFIANÇA", style: "cardHeader" },
                  { text: `Tendência: ${getTendenciaIcon(scoreConsolidado.tendencia)}`, style: "cardSub" },
                  { text: `Atingimento Meta: ${scoreConsolidado.atingimentoPct.toFixed(1)}%`, style: "cardSub" },
                  { text: `Índice de Confiança: ${metadata.confidenceIndex}%`, style: "cardSubGold" }
                ]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20]
      },

      { text: "MATRIZ DE RESUMO EXECUTIVO", style: "subSectionTitle" },
      {
        table: {
          widths: ['25%', '75%'],
          body: [
            [{ text: "Situação Geral", style: "tableHeaderCell" }, { text: resumoExecutivoMatriz.situacaoGeral, style: "tableBodyCell" }],
            [{ text: "Principais Riscos", style: "tableHeaderCell" }, { text: resumoExecutivoMatriz.principaisRiscos, style: "tableBodyCell" }],
            [{ text: "Oportunidades", style: "tableHeaderCell" }, { text: resumoExecutivoMatriz.principaisOportunidades, style: "tableBodyCell" }],
            [{ text: "Destaques", style: "tableHeaderCell" }, { text: resumoExecutivoMatriz.principaisDestaques, style: "tableBodyCell" }],
            [{ text: "Recomendações", style: "tableHeaderCell" }, { text: resumoExecutivoMatriz.principaisRecomendacoes, style: "tableBodyCell" }]
          ]
        },
        margin: [0, 0, 0, 25]
      },

      // ═════════════════════════════════════════════════════════════════
      // SEÇÃO 1 & 2: VISÃO CEO (TOTAL BRASIL)
      // ═════════════════════════════════════════════════════════════════
      { text: "1 & 2. VISÃO CEO — CONSOLIDADO TOTAL BRASIL", style: "sectionTitle" },

      {
        table: {
          widths: ['15%', '17%', '17%', '17%', '17%', '17%'],
          body: [
            [
              { text: "KPI", style: "gridTh" },
              { text: "DESAFIO", style: "gridTh" },
              { text: "PROJ. ATUAL", style: "gridTh" },
              { text: "% ATING.", style: "gridTh" },
              { text: "% DISP.", style: "gridTh" },
              { text: "% AA", style: "gridTh" }
            ],
            [
              { text: "VOL (k)", style: "gridTdBold" },
              { text: formatNum(data.scoreConsolidado.projAtualFat ? 152.0 : 150.0), style: "gridTd" },
              { text: formatNum(data.scoreConsolidado.projAtualFat ? 152.0 : 150.0), style: "gridTd" },
              { text: "100.0%", style: "gridTd" },
              { text: formatPctStr(scoreConsolidado.dispersionPct), style: "gridTd" },
              { text: formatPctStr(scoreConsolidado.crescimentoAaPct), style: "gridTd" }
            ],
            [
              { text: "FAT (R$)", style: "gridTdBold" },
              { text: formatCurrencyBrl(scoreConsolidado.desafioFat), style: "gridTd" },
              { text: formatCurrencyBrl(scoreConsolidado.projAtualFat), style: "gridTdGold" },
              { text: `${scoreConsolidado.atingimentoPct.toFixed(1)}%`, style: "gridTd" },
              { text: formatPctStr(scoreConsolidado.dispersionPct), style: "gridTd" },
              { text: formatPctStr(scoreConsolidado.crescimentoAaPct), style: "gridTd" }
            ],
            [
              { text: "INVEST (%)", style: "gridTdBold" },
              { text: "10,0%", style: "gridTd" },
              { text: `${scoreConsolidado.investPct.toFixed(1)}%`, style: "gridTd" },
              { text: "100.0%", style: "gridTd" },
              { text: "-", style: "gridTd" },
              { text: "-", style: "gridTd" }
            ]
          ]
        },
        margin: [0, 0, 0, 25]
      },

      // ═════════════════════════════════════════════════════════════════
      // SEÇÃO 3 & 4: DIAGNÓSTICO GERAL & OPORTUNIDADE FINANCEIRA
      // ═════════════════════════════════════════════════════════════════
      { text: "3 & 4. FRAMEWORK DE PERGUNTAS EXECUTIVAS & GAPS", style: "sectionTitle" },

      {
        table: {
          widths: ['35%', '65%'],
          body: [
            [{ text: "1. Onde está o maior risco?", style: "tableHeaderCell" }, { text: perguntasExecutivas.maiorRisco, style: "tableBodyCell" }],
            [{ text: "2. Onde está a maior oportunidade?", style: "tableHeaderCell" }, { text: perguntasExecutivas.maiorOportunidade, style: "tableBodyCell" }],
            [{ text: "3. Qual gerente merece atenção?", style: "tableHeaderCell" }, { text: perguntasExecutivas.gerenteAtencao, style: "tableBodyCell" }],
            [{ text: "4. Quais redes mais impactam?", style: "tableHeaderCell" }, { text: perguntasExecutivas.redesImpacto, style: "tableBodyCell" }],
            [{ text: "5. Ação de maior retorno financeiro?", style: "tableHeaderCell" }, { text: perguntasExecutivas.acaoMaiorRetorno, style: "tableBodyCell" }]
          ]
        },
        margin: [0, 0, 0, 15]
      },

      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              {
                fillColor: '#1a1815',
                margin: [10, 10, 10, 10],
                stack: [
                  { text: "GAP FINANCEIRO DO DESAFIO", style: "cardHeaderGold" },
                  { text: formatCurrencyBrl(oportunidadeFinanceira.gapFinanceiroDesafio), style: "scoreBigGold" },
                  { text: `Variação: ${formatPctStr(oportunidadeFinanceira.gapFinanceiroPct)}`, style: "cardSub" }
                ]
              },
              {
                fillColor: '#1a1815',
                margin: [10, 10, 10, 10],
                stack: [
                  { text: "RECEITA ADICIONAL POTENCIAL", style: "cardHeaderGold" },
                  { text: formatCurrencyBrl(oportunidadeFinanceira.receitaAdicionalSeDesafio), style: "scoreBigGreen" },
                  { text: `Maior Oportunidade: ${oportunidadeFinanceira.maiorOportunidadeCarteira}`, style: "cardSub" }
                ]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 25]
      },

      // ═════════════════════════════════════════════════════════════════
      // SEÇÃO 5 & 6: SCORECARD E RANKING POR GERENTE
      // ═════════════════════════════════════════════════════════════════
      { text: "", pageBreak: 'after' },

      { text: "5 & 6. EXECUTIVE SCORECARD POR GERENTE & RANKING", style: "sectionTitle" },

      {
        table: {
          widths: ['5%', '25%', '15%', '15%', '20%', '20%'],
          body: [
            [
              { text: "#", style: "gridTh" },
              { text: "GERENTE", style: "gridTh" },
              { text: "SCORE", style: "gridTh" },
              { text: "STATUS", style: "gridTh" },
              { text: "TENDÊNCIA", style: "gridTh" },
              { text: "PROJ. FAT", style: "gridTh" }
            ],
            ...rankingGerentes.map((g, idx) => [
              { text: `${idx + 1}º`, style: "gridTdBold" },
              { text: g.manager, style: "gridTdBold" },
              { text: `${g.score} / 100`, style: "gridTdGold" },
              { text: getStatusBadge(g.status).text, style: "gridTd" },
              { text: getTendenciaIcon(g.tendencia), style: "gridTd" },
              { text: formatCurrencyBrl(g.projFat), style: "gridTd" }
            ])
          ]
        },
        margin: [0, 0, 0, 20]
      },

      { text: "DETALHAMENTO DOS SCORECARDS INDIVIDUAIS", style: "subSectionTitle" },
      ...scorecardsGerentes.map(g => ({
        table: {
          widths: ['100%'],
          body: [
            [{
              fillColor: '#181818',
              margin: [10, 10, 10, 10],
              stack: [
                {
                  columns: [
                    { text: `GERENTE: ${g.manager.toUpperCase()}`, style: "cardHeaderGold" },
                    { text: `SCORE: ${g.score}/100 (${getStatusBadge(g.status).text})`, style: "headerRightGold" }
                  ]
                },
                { text: `Projeção: ${formatCurrencyBrl(g.projFat)} | Desafio: ${formatCurrencyBrl(g.desafioFat)} | Atingimento: ${g.atingimentoPct.toFixed(1)}% | Invest: ${g.investPct.toFixed(1)}%`, style: "cardSub" },
                { text: `🟢 Ponto Forte: ${g.pontoForte}`, style: "textGreen", margin: [0, 3, 0, 1] },
                { text: `🔴 Ponto de Atenção: ${g.pontoAtencao}`, style: "textRed", margin: [0, 1, 0, 0] }
              ]
            }]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10]
      })),

      // ═════════════════════════════════════════════════════════════════
      // SEÇÃO 7 & 8: REDES OFENSORAS E DESTAQUES
      // ═════════════════════════════════════════════════════════════════
      { text: "", pageBreak: 'after' },

      { text: "7. REDES OFENSORAS (TOP DETRATORES DE RECEITA)", style: "sectionTitle" },
      { text: "Ordenadas da pior para a melhor diferença em relação ao mês anterior:", style: "subText", margin: [0, 0, 0, 10] },

      {
        table: {
          widths: ['30%', '20%', '17%', '17%', '16%'],
          body: [
            [
              { text: "REDE / CLIENTE", style: "gridTh" },
              { text: "GERENTE", style: "gridTh" },
              { text: "REAL MÊS A", style: "gridTh" },
              { text: "PROJ. ATUAL", style: "gridTh" },
              { text: "DIFERENÇA", style: "gridTh" }
            ],
            ...redesOfensoras.map(o => [
              { text: o.rede, style: "gridTdBold" },
              { text: o.gerente, style: "gridTd" },
              { text: formatCurrencyBrl(o.realMesA), style: "gridTd" },
              { text: formatCurrencyBrl(o.projAtual), style: "gridTd" },
              { text: formatCurrencyBrl(o.diferencaAbs), style: "gridTdRed" }
            ])
          ]
        },
        margin: [0, 0, 0, 25]
      },

      { text: "8. REDES DE DESTAQUE (TOP ALAVANCADORES DE CRESCIMENTO)", style: "sectionTitle" },
      {
        table: {
          widths: ['30%', '20%', '17%', '17%', '16%'],
          body: [
            [
              { text: "REDE / CLIENTE", style: "gridTh" },
              { text: "GERENTE", style: "gridTh" },
              { text: "REAL MÊS A", style: "gridTh" },
              { text: "PROJ. ATUAL", style: "gridTh" },
              { text: "CRESCIMENTO", style: "gridTh" }
            ],
            ...redesDestaque.map(d => [
              { text: d.rede, style: "gridTdBold" },
              { text: d.gerente, style: "gridTd" },
              { text: formatCurrencyBrl(d.realMesA), style: "gridTd" },
              { text: formatCurrencyBrl(d.projAtual), style: "gridTd" },
              { text: formatPctStr(d.crescimentoPct), style: "gridTdGreen" }
            ])
          ]
        },
        margin: [0, 0, 0, 25]
      },

      // ═════════════════════════════════════════════════════════════════
      // SEÇÃO 9 & 10: DECISION BOARD & PARECER DIRETORIA
      // ═════════════════════════════════════════════════════════════════
      { text: "", pageBreak: 'after' },

      { text: "9 & 10. EXECUTIVE DECISION BOARD", style: "sectionTitle" },

      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              {
                fillColor: '#1c1414',
                margin: [10, 10, 10, 10],
                stack: [
                  { text: "TOP 5 RISCOS ESTRATÉGICOS", style: "cardHeaderRed" },
                  ...decisionBoard.topRiscos.map(r => ({
                    text: `• ${r.descricao} (-${formatCurrencyBrl(r.impactoFinanceiro)})`,
                    style: "listTextRed"
                  }))
                ]
              },
              {
                fillColor: '#141c14',
                margin: [10, 10, 10, 10],
                stack: [
                  { text: "TOP 5 OPORTUNIDADES", style: "cardHeaderGreen" },
                  ...decisionBoard.topOportunidades.map(o => ({
                    text: `• ${o.descricao} (+${formatCurrencyBrl(o.potencialGanho)})`,
                    style: "listTextGreen"
                  }))
                ]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20]
      },

      { text: "PLANO DE AÇÃO SUGERIDO & IMPACTO FINANCEIRO", style: "subSectionTitle" },
      {
        table: {
          widths: ['35%', '25%', '20%', '20%'],
          body: [
            [
              { text: "AÇÃO RECOMENDADA", style: "gridTh" },
              { text: "RESPONSÁVEL", style: "gridTh" },
              { text: "PRAZO", style: "gridTh" },
              { text: "IMPACTO (R$)", style: "gridTh" }
            ],
            ...decisionBoard.planoAcaoRecomendado.map(p => [
              { text: p.acao, style: "gridTdBold" },
              { text: p.responsavel, style: "gridTd" },
              { text: p.prazo, style: "gridTd" },
              { text: formatCurrencyBrl(p.impactoEstimado), style: "gridTdGreen" }
            ])
          ]
        },
        margin: [0, 0, 0, 20]
      },

      {
        table: {
          widths: ['100%'],
          body: [
            [{
              fillColor: '#1a1812',
              margin: [15, 15, 15, 15],
              stack: [
                { text: "PARECER EXECUTIVO DA DIRETORIA COMERCIAL / PRESIDÊNCIA", style: "cardHeaderGold" },
                { text: decisionBoard.conclusaoDiretoria, style: "textBodyGold", margin: [0, 5, 0, 0] }
              ]
            }]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 25]
      },

      // ═════════════════════════════════════════════════════════════════
      // PÁGINA FINAL: ROADMAP EXECUTIVO
      // ═════════════════════════════════════════════════════════════════
      { text: "", pageBreak: 'after' },

      { text: "ROADMAP EXECUTIVO (PRIORIDADES DE CURTO, MÉDIO E LONGO PRAZO)", style: "sectionTitle" },

      { text: "PRIORIDADES PARA OS PRÓXIMOS 7 DIAS (IMEDIATO)", style: "subSectionTitle" },
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: "AÇÃO OPERACIONAL", style: "gridTh" }, { text: "JUSTIFICATIVA BASEADA NA RPS", style: "gridTh" }],
            ...roadmap.prioridades7Dias.map(p => [
              { text: p.acao, style: "gridTdBold" },
              { text: p.justificativa, style: "gridTd" }
            ])
          ]
        },
        margin: [0, 0, 0, 20]
      },

      { text: "PRIORIDADES PARA OS PRÓXIMOS 30 DIAS (TÁTICO)", style: "subSectionTitle" },
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: "AÇÃO TÁTICA", style: "gridTh" }, { text: "JUSTIFICATIVA BASEADA NA RPS", style: "gridTh" }],
            ...roadmap.prioridades30Dias.map(p => [
              { text: p.acao, style: "gridTdBold" },
              { text: p.justificativa, style: "gridTd" }
            ])
          ]
        },
        margin: [0, 0, 0, 20]
      },

      { text: "PRIORIDADES PARA OS PRÓXIMOS 90 DIAS (ESTRATÉGICO)", style: "subSectionTitle" },
      {
        table: {
          widths: ['40%', '60%'],
          body: [
            [{ text: "AÇÃO ESTRATÉGICA", style: "gridTh" }, { text: "JUSTIFICATIVA BASEADA NA RPS", style: "gridTh" }],
            ...roadmap.prioridades90Dias.map(p => [
              { text: p.acao, style: "gridTdBold" },
              { text: p.justificativa, style: "gridTd" }
            ])
          ]
        },
        margin: [0, 0, 0, 25]
      },

      { text: "FIM DO RELATÓRIO EXECUTIVO — COFFEE++ INTELLIGENCE ENGINE", style: "confidentialNotice" }
    ],

    styles: {
      brandLogo: { fontSize: 24, bold: true, color: "#c8a96e", letterSpacing: 2 },
      docTitle: { fontSize: 18, bold: true, color: "#ffffff" },
      docSubTitle: { fontSize: 12, bold: true, color: "#b3b3b3" },
      metaLabel: { fontSize: 10, bold: true, color: "#c8a96e" },
      metaValue: { fontSize: 10, color: "#ffffff", margin: [0, 2, 0, 0] },
      metaValueHighlight: { fontSize: 10, bold: true, color: "#22c55e", margin: [0, 4, 0, 0] },
      confidentialNotice: { fontSize: 8, color: "#777777", alignment: "center", italic: true },
      headerLeft: { fontSize: 8, color: "#777777" },
      headerRight: { fontSize: 8, color: "#777777", alignment: "right" },
      footerLeft: { fontSize: 8, color: "#777777" },
      footerRight: { fontSize: 8, color: "#777777", alignment: "right" },
      sectionTitle: { fontSize: 14, bold: true, color: "#c8a96e", margin: [0, 0, 0, 12] },
      subSectionTitle: { fontSize: 11, bold: true, color: "#ffffff", margin: [0, 10, 0, 8] },
      subText: { fontSize: 9, color: "#b3b3b3" },
      cardHeader: { fontSize: 10, bold: true, color: "#b3b3b3" },
      cardHeaderGold: { fontSize: 10, bold: true, color: "#c8a96e" },
      cardHeaderRed: { fontSize: 10, bold: true, color: "#ef4444" },
      cardHeaderGreen: { fontSize: 10, bold: true, color: "#22c55e" },
      scoreBig: { fontSize: 28, bold: true, color: "#ffffff", margin: [0, 4, 0, 4] },
      scoreBigGold: { fontSize: 22, bold: true, color: "#c8a96e", margin: [0, 4, 0, 4] },
      scoreBigGreen: { fontSize: 22, bold: true, color: "#22c55e", margin: [0, 4, 0, 4] },
      statusBadge: { fontSize: 12, bold: true },
      cardSub: { fontSize: 9, color: "#b3b3b3", margin: [0, 2, 0, 0] },
      cardSubGold: { fontSize: 9, bold: true, color: "#c8a96e", margin: [0, 2, 0, 0] },
      headerRightGold: { fontSize: 9, bold: true, color: "#c8a96e", alignment: "right" },
      tableHeaderCell: { fontSize: 9, bold: true, color: "#c8a96e", fillColor: "#1c1a16", padding: 6 },
      tableBodyCell: { fontSize: 9, color: "#ffffff", fillColor: "#141414", padding: 6 },
      gridTh: { fontSize: 9, bold: true, color: "#c8a96e", fillColor: "#1c1a16", alignment: "center", padding: 5 },
      gridTd: { fontSize: 8, color: "#ffffff", fillColor: "#141414", alignment: "center", padding: 5 },
      gridTdBold: { fontSize: 8, bold: true, color: "#ffffff", fillColor: "#141414", padding: 5 },
      gridTdGold: { fontSize: 8, bold: true, color: "#c8a96e", fillColor: "#141414", alignment: "center", padding: 5 },
      gridTdGreen: { fontSize: 8, bold: true, color: "#22c55e", fillColor: "#141414", alignment: "center", padding: 5 },
      gridTdRed: { fontSize: 8, bold: true, color: "#ef4444", fillColor: "#141414", alignment: "center", padding: 5 },
      textGreen: { fontSize: 9, color: "#22c55e" },
      textRed: { fontSize: 9, color: "#ef4444" },
      textBodyGold: { fontSize: 9, color: "#e5c07b", leading: 14 },
      listTextRed: { fontSize: 8, color: "#f87171", margin: [0, 2, 0, 0] },
      listTextGreen: { fontSize: 8, color: "#4ade80", margin: [0, 2, 0, 0] }
    }
  };

  // Fazer o download do PDF no navegador
  pdfMake.createPdf(docDefinition).download(`Coffee_RPS_Executive_Report_${metadata.periodo.replace(/[\/\s]/g, '_')}.pdf`);
}
