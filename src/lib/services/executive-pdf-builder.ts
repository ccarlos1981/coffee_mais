import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { ExecutiveReportData } from "./executive-report-collector";

// Configuração de fontes para ambiente Node.js
(pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfMake as any).vfs;

export class ExecutivePdfBuilder {
  private static formatCurrency(val: number): string {
    return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private static formatCurrencyK(val: number): string {
    return `R$ ${(val / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }

  private static formatNumber(val: number): string {
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  private static formatPercent(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return "N/A";
    return `${val.toFixed(1).replace(".", ",")}%`;
  }

  private static getStatusColor(pct: number): string {
    if (pct < 80) return "#DC2626"; // Vermelho Crítico
    if (pct < 100) return "#D97706"; // Âmbar Atenção
    return "#059669"; // Verde Atingido
  }

  /**
   * Constrói o buffer PDF de exatamente 5 páginas executivas estruturadas
   */
  static async buildPdfBuffer(data: ExecutiveReportData): Promise<Buffer> {
    const content: any[] = [];

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — KEY ACCOUNT (EXCLUSIVO)
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 1 — KEY ACCOUNT", style: "pageTitle", margin: [0, 5, 0, 4] },
      {
        text: `Consolidado e Detalhamento por Gerente (Exclusivo Key Account) | Competência: ${data.competenciaAtual} (1 a ${data.diaDoMes})`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 10],
      }
    );

    // Card Consolidado Exclusivo KA
    const consolKa = data.vendas.consolidadoKa;
    content.push({
      table: {
        widths: ["33.3%", "33.3%", "33.4%"],
        body: [
          [
            { text: "FATURAMENTO KEY ACCOUNT", style: "kpiCardTitle", fillColor: "#FEF3C7" },
            { text: "VOLUME KA (UNIDADES)", style: "kpiCardTitle", fillColor: "#E0E7FF" },
            { text: "MACO KA (MARGEM CONTRIB.)", style: "kpiCardTitle", fillColor: "#DCFCE7" },
          ],
          [
            {
              stack: [
                { text: `Real: ${this.formatCurrency(consolKa.realFat)}`, style: "kpiReal" },
                { text: `Meta: ${this.formatCurrency(consolKa.metaFat)}`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(consolKa.pctAtgFat)}`, style: "kpiPct", color: this.getStatusColor(consolKa.pctAtgFat) },
              ],
              fillColor: "#FFFDF5",
            },
            {
              stack: [
                { text: `Real: ${this.formatNumber(consolKa.realUnd)} un`, style: "kpiReal" },
                { text: `Meta: ${this.formatNumber(consolKa.metaUnd)} un`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(consolKa.pctAtgUnd)}`, style: "kpiPct", color: this.getStatusColor(consolKa.pctAtgUnd) },
              ],
              fillColor: "#F8FAFC",
            },
            {
              stack: [
                { text: `Real: ${this.formatCurrency(consolKa.realMaco)}`, style: "kpiReal" },
                { text: `Meta: ${this.formatCurrency(consolKa.metaMaco)}`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(consolKa.pctAtgMaco)}`, style: "kpiPct", color: this.getStatusColor(consolKa.pctAtgMaco) },
              ],
              fillColor: "#F0FDF4",
            },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 14],
    });

    // Tabela por Gerente KA
    const tableGerentesKaBody: any[] = [
      [
        { text: "Gerente Key Account", style: "th" },
        { text: "Meta Fat", style: "th", alignment: "right" },
        { text: "Real Fat", style: "th", alignment: "right" },
        { text: "% ATG", style: "th", alignment: "center" },
        { text: "Meta Und", style: "th", alignment: "right" },
        { text: "Real Und", style: "th", alignment: "right" },
        { text: "% ATG", style: "th", alignment: "center" },
        { text: "Meta MACO", style: "th", alignment: "right" },
        { text: "Real MACO", style: "th", alignment: "right" },
        { text: "% ATG", style: "th", alignment: "center" },
      ],
    ];

    data.vendas.gerentesKa.forEach((g) => {
      tableGerentesKaBody.push([
        { text: g.managerName, style: "tdBold" },
        { text: this.formatCurrencyK(g.metaFat), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(g.realFat), style: "td", alignment: "right" },
        { text: this.formatPercent(g.pctAtgFat), style: "tdPct", alignment: "center", color: this.getStatusColor(g.pctAtgFat) },
        { text: this.formatNumber(g.metaUnd), style: "td", alignment: "right" },
        { text: this.formatNumber(g.realUnd), style: "td", alignment: "right" },
        { text: this.formatPercent(g.pctAtgUnd), style: "tdPct", alignment: "center", color: this.getStatusColor(g.pctAtgUnd) },
        { text: this.formatCurrencyK(g.metaMaco), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(g.realMaco), style: "td", alignment: "right" },
        { text: this.formatPercent(g.pctAtgMaco), style: "tdPct", alignment: "center", color: this.getStatusColor(g.pctAtgMaco) },
      ]);
    });

    // Total Exclusivo KA
    tableGerentesKaBody.push([
      { text: "TOTAL KEY ACCOUNT", style: "tdTotal" },
      { text: this.formatCurrencyK(consolKa.metaFat), style: "tdTotal", alignment: "right" },
      { text: this.formatCurrencyK(consolKa.realFat), style: "tdTotal", alignment: "right" },
      { text: this.formatPercent(consolKa.pctAtgFat), style: "tdTotalPct", alignment: "center", color: this.getStatusColor(consolKa.pctAtgFat) },
      { text: this.formatNumber(consolKa.metaUnd), style: "tdTotal", alignment: "right" },
      { text: this.formatNumber(consolKa.realUnd), style: "tdTotal", alignment: "right" },
      { text: this.formatPercent(consolKa.pctAtgUnd), style: "tdTotalPct", alignment: "center", color: this.getStatusColor(consolKa.pctAtgUnd) },
      { text: this.formatCurrencyK(consolKa.metaMaco), style: "tdTotal", alignment: "right" },
      { text: this.formatCurrencyK(consolKa.realMaco), style: "tdTotal", alignment: "right" },
      { text: this.formatPercent(consolKa.pctAtgMaco), style: "tdTotalPct", alignment: "center", color: this.getStatusColor(consolKa.pctAtgMaco) },
    ]);

    content.push({
      table: {
        widths: ["20%", "9%", "9%", "8%", "9%", "9%", "8%", "10%", "10%", "8%"],
        body: tableGerentesKaBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 12],
    });

    // Nota de Segregação Baseline 077
    const inside = data.vendas.linhaInsideSalesSegregada;
    content.push({
      text: `* Linha Segregada (Baseline 077): Inside Sales faturou ${this.formatCurrency(inside.realFat)} (${this.formatNumber(inside.realUnd)} un | ${this.formatPercent(inside.pctAtgFat)} da meta). Faturamento deduzido das carteiras de campo.`,
      style: "footnote",
      margin: [0, 4, 0, 0],
      pageBreak: "after",
    });

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — DISTRIBUIDOR (EXCLUSIVO)
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 2 — DISTRIBUIDOR", style: "pageTitle", margin: [0, 5, 0, 4] },
      {
        text: `Consolidado e Detalhamento de Clientes do Canal Distribuidor | Competência: ${data.competenciaAtual} (1 a ${data.diaDoMes})`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 10],
      }
    );

    const dist = data.vendas.distribuidor;
    content.push({
      table: {
        widths: ["33.3%", "33.3%", "33.4%"],
        body: [
          [
            { text: "FATURAMENTO DISTRIBUIDOR", style: "kpiCardTitle", fillColor: "#FEF3C7" },
            { text: "VOLUME DISTRIBUIDOR (UNIDADES)", style: "kpiCardTitle", fillColor: "#E0E7FF" },
            { text: "MACO DISTRIBUIDOR", style: "kpiCardTitle", fillColor: "#DCFCE7" },
          ],
          [
            {
              stack: [
                { text: `Real: ${this.formatCurrency(dist.realFat)}`, style: "kpiReal" },
                { text: `Meta: ${this.formatCurrency(dist.metaFat)}`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(dist.pctAtgFat)}`, style: "kpiPct", color: this.getStatusColor(dist.pctAtgFat) },
              ],
              fillColor: "#FFFDF5",
            },
            {
              stack: [
                { text: `Real: ${this.formatNumber(dist.realUnd)} un`, style: "kpiReal" },
                { text: `Meta: ${this.formatNumber(dist.metaUnd)} un`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(dist.pctAtgUnd)}`, style: "kpiPct", color: this.getStatusColor(dist.pctAtgUnd) },
              ],
              fillColor: "#F8FAFC",
            },
            {
              stack: [
                { text: `Real: ${this.formatCurrency(dist.realMaco)}`, style: "kpiReal" },
                { text: `Meta: ${this.formatCurrency(dist.metaMaco)}`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(dist.pctAtgMaco)}`, style: "kpiPct", color: this.getStatusColor(dist.pctAtgMaco) },
              ],
              fillColor: "#F0FDF4",
            },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 14],
    });

    // Tabela de Clientes Distribuidores
    const tableDistClientes: any[] = [
      [
        { text: "Cliente / Distribuidor", style: "th" },
        { text: "Responsável", style: "th" },
        { text: "Faturamento Real", style: "th", alignment: "right" },
        { text: "Volume (un)", style: "th", alignment: "right" },
        { text: "MACO Real", style: "th", alignment: "right" },
        { text: "% Part. Canal", style: "th", alignment: "center" },
      ],
    ];

    dist.topClientes.forEach((c) => {
      const part = dist.realFat > 0 ? (c.fat / dist.realFat) * 100 : 0;
      tableDistClientes.push([
        { text: c.cliente, style: "tdBold" },
        { text: c.gerente, style: "td" },
        { text: this.formatCurrency(c.fat), style: "td", alignment: "right" },
        { text: `${this.formatNumber(c.und)} un`, style: "td", alignment: "right" },
        { text: this.formatCurrency(c.maco), style: "td", alignment: "right" },
        { text: this.formatPercent(part), style: "tdPct", alignment: "center" },
      ]);
    });

    // Total Distribuidor
    tableDistClientes.push([
      { text: "TOTAL CANAL DISTRIBUIDOR", style: "tdTotal" },
      { text: "—", style: "tdTotal" },
      { text: this.formatCurrency(dist.realFat), style: "tdTotal", alignment: "right" },
      { text: `${this.formatNumber(dist.realUnd)} un`, style: "tdTotal", alignment: "right" },
      { text: this.formatCurrency(dist.realMaco), style: "tdTotal", alignment: "right" },
      { text: "100,0%", style: "tdTotalPct", alignment: "center" },
    ]);

    content.push({
      table: {
        widths: ["30%", "16%", "14%", "12%", "14%", "14%"],
        body: tableDistClientes,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 10],
      pageBreak: "after",
    });

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 3 — INVESTIMENTO | RESUMO POR GERENTE
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 3 — INVESTIMENTO | RESUMO POR GERENTE", style: "pageTitle", margin: [0, 5, 0, 4] },
      {
        text: `Visão Executiva de Investimentos e Ações Atrasadas (/investimento/invest-cliente) | Competência: ${data.competenciaAtual}`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 10],
      }
    );

    const invConsol = data.investimentosResumo.consolidado;
    content.push({
      table: {
        widths: ["20%", "20%", "20%", "20%", "20%"],
        body: [
          [
            { text: "EXPECTATIVA TOTAL", style: "kpiCardTitle", fillColor: "#F3F4F6" },
            { text: "% SOBRE FATURAMENTO", style: "kpiCardTitle", fillColor: "#F3F4F6" },
            { text: "NÃO PROVISIONADO", style: "kpiCardTitle", fillColor: "#FEF3C7" },
            { text: "PROVISIONADO", style: "kpiCardTitle", fillColor: "#DCFCE7" },
            { text: "AÇÕES ATRASADAS", style: "kpiCardTitle", fillColor: "#FEE2E2" },
          ],
          [
            { text: this.formatCurrency(invConsol.expectativaInvestimento), style: "kpiReal", alignment: "center", fillColor: "#FFFFFF" },
            {
              text: this.formatPercent(invConsol.pctInvestimento),
              style: "kpiReal",
              alignment: "center",
              fillColor: "#FFFFFF",
              color: invConsol.pctInvestimento > 10 ? "#DC2626" : "#059669",
            },
            { text: this.formatCurrency(invConsol.naoProvisionado), style: "kpiReal", alignment: "center", fillColor: "#FFFDF5", color: "#D97706" },
            { text: this.formatCurrency(invConsol.provisionado), style: "kpiReal", alignment: "center", fillColor: "#F0FDF4", color: "#059669" },
            {
              text: `${invConsol.acoesAtrasadasQtd} ações (${this.formatCurrency(invConsol.acoesAtrasadasValor)})`,
              style: "kpiReal",
              alignment: "center",
              fillColor: "#FFF5F5",
              color: "#DC2626",
            },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 14],
    });

    // Blocos Executivos por Gerente
    data.investimentosResumo.porGerente.forEach((g) => {
      const temAtrasadas = g.acoesAtrasadasQtd > 0;
      const cardBgColor = "#F9FAFB";
      const borderColor = temAtrasadas ? "#FCA5A5" : "#E5E7EB";

      content.push({
        table: {
          widths: ["100%"],
          body: [
            [
              {
                fillColor: cardBgColor,
                margin: [10, 8, 10, 8],
                stack: [
                  // Linha superior: Nome Gerente + Clientes + Badge Atrasadas
                  {
                    columns: [
                      {
                        width: "auto",
                        text: g.responsavel.toUpperCase(),
                        style: "gerenteCardTitle",
                      },
                      {
                        width: "auto",
                        text: `${g.clientesQtd} ${g.clientesQtd === 1 ? "cliente" : "clientes"}`,
                        style: "badgeClientes",
                        margin: [8, 1, 0, 0],
                      },
                      {
                        width: "*",
                        text: temAtrasadas
                          ? `🔴 ${g.acoesAtrasadasQtd} atrasadas (${this.formatCurrency(g.acoesAtrasadasValor)})`
                          : "✓ Nenhuma ação atrasada",
                        style: temAtrasadas ? "badgeAtrasadas" : "badgeOk",
                        alignment: "right",
                      },
                    ],
                    margin: [0, 0, 0, 6],
                  },
                  // Linha de métricas: 5 colunas
                  {
                    table: {
                      widths: ["20%", "20%", "20%", "20%", "20%"],
                      body: [
                        [
                          { text: "FATURAMENTO", style: "gerenteKpiLabel" },
                          { text: "EXPECTATIVA", style: "gerenteKpiLabel" },
                          { text: "% INVEST.", style: "gerenteKpiLabel" },
                          { text: "NÃO PROV.", style: "gerenteKpiLabel" },
                          { text: "PROVISIONADO", style: "gerenteKpiLabel" },
                        ],
                        [
                          { text: this.formatCurrency(g.faturamento), style: "gerenteKpiValue" },
                          { text: this.formatCurrency(g.expectativaInvestimento), style: "gerenteKpiValue" },
                          {
                            text: this.formatPercent(g.pctInvestimento),
                            style: "gerenteKpiValue",
                            color: g.pctInvestimento > 10 ? "#DC2626" : g.pctInvestimento > 5 ? "#D97706" : "#059669",
                          },
                          {
                            text: this.formatCurrency(g.naoProvisionado),
                            style: "gerenteKpiValue",
                            color: g.naoProvisionado > 0 ? "#B45309" : "#111827",
                          },
                          {
                            text: this.formatCurrency(g.provisionado),
                            style: "gerenteKpiValue",
                            color: g.provisionado > 0 ? "#059669" : "#6B7280",
                          },
                        ],
                      ],
                    },
                    layout: "noBorders",
                  },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => borderColor,
          vLineColor: () => borderColor,
        },
        margin: [0, 0, 0, 10],
      });
    });

    // Finalizar Página 3
    content.push({
      text: "",
      pageBreak: "after",
    });

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 4 — INVESTIMENTO POR CLIENTE / REDE
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 4 — INVESTIMENTO POR CLIENTE / REDE", style: "pageTitle", margin: [0, 4, 0, 2] },
      {
        text: `Visão Operacional Detalhada (/investimento/invest-cliente) | Competência: ${data.competenciaAtual}`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 8],
      }
    );

    const tableClientesBody: any[] = [
      [
        { text: "Responsável", style: "th" },
        { text: "Cliente / Rede", style: "th" },
        { text: "Faturamento", style: "th", alignment: "right" },
        { text: "Expectativa", style: "th", alignment: "right" },
        { text: "% Invest.", style: "th", alignment: "center" },
        { text: "Não Provisionado", style: "th", alignment: "right" },
        { text: "Provisionado", style: "th", alignment: "right" },
        { text: "Atrasos", style: "th", alignment: "center" },
      ],
    ];

    const clientesDestaque = data.investimentosPorCliente.linhas.slice(0, 22);

    clientesDestaque.forEach((cl) => {
      tableClientesBody.push([
        { text: cl.responsavel, style: "tdBold" },
        { text: cl.clienteRede, style: "td" },
        { text: this.formatCurrencyK(cl.faturamento), style: "td", alignment: "right" },
        { text: this.formatCurrency(cl.expectativaInvestimento), style: "td", alignment: "right" },
        { text: this.formatPercent(cl.pctInvestimento), style: "tdPct", alignment: "center" },
        { text: this.formatCurrency(cl.naoProvisionado), style: "td", alignment: "right", color: cl.naoProvisionado > 0 ? "#DC2626" : "#111827" },
        { text: this.formatCurrency(cl.provisionado), style: "td", alignment: "right" },
        { text: cl.acoesAtrasadasQtd > 0 ? `${cl.acoesAtrasadasQtd} ⚠️` : "—", style: "td", alignment: "center", color: cl.acoesAtrasadasQtd > 0 ? "#DC2626" : "#059669" },
      ]);
    });

    content.push({
      table: {
        widths: ["18%", "26%", "11%", "12%", "9%", "12%", "8%", "4%"],
        body: tableClientesBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 6],
      pageBreak: "after",
    });

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 5 — TOP 10 REDES E ANÁLISE EXECUTIVA IA
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 5 — TOP 10 REDES E ANÁLISE EXECUTIVA", style: "pageTitle", margin: [0, 4, 0, 2] },
      {
        text: `Histórico Mensal 2026, Performance Simétrica MTD e Orientações Executivas`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 6],
      }
    );

    // Tabela A: Histórico Mensal 2026
    content.push({ text: "HISTÓRICO MENSAL 2026 (TOP 10 REDES)", style: "sectionHeader", margin: [0, 0, 0, 2] });
    const tableTop10Hist: any[] = [
      [
        { text: "#", style: "th", alignment: "center" },
        { text: "Rede / Cliente", style: "th" },
        { text: "Gerente", style: "th" },
        { text: "JAN", style: "th", alignment: "right" },
        { text: "FEV", style: "th", alignment: "right" },
        { text: "MAR", style: "th", alignment: "right" },
        { text: "ABR", style: "th", alignment: "right" },
        { text: "MAI", style: "th", alignment: "right" },
        { text: "JUN", style: "th", alignment: "right" },
        { text: "JUL", style: "th", alignment: "right" },
        { text: "AGO MTD", style: "th", alignment: "right" },
      ],
    ];

    data.top10Redes.forEach((r) => {
      const h = r.historico2026;
      tableTop10Hist.push([
        { text: String(r.ranking), style: "td", alignment: "center" },
        { text: r.rede, style: "tdBold" },
        { text: r.gerente, style: "td" },
        { text: this.formatCurrencyK(h.jan), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(h.fev), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(h.mar), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(h.abr), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(h.mai), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(h.jun), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(h.jul), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(h.agoMtd), style: "tdBold", alignment: "right", color: "#1E40AF" },
      ]);
    });

    content.push({
      table: {
        widths: ["4%", "26%", "14%", "7%", "7%", "7%", "7%", "7%", "7%", "7%", "7%"],
        body: tableTop10Hist,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 6],
    });

    // Tabela B: Performance MTD Simétrica e Trimestral Equivalente
    content.push({ text: "PERFORMANCE SIMÉTRICA (MTD ATUAL × MTD ANTERIOR) E TRIMESTRAL EQUIVALENTE", style: "sectionHeader", margin: [0, 2, 0, 2] });
    const tableTop10Perf: any[] = [
      [
        { text: "Rede / Cliente", style: "th" },
        { text: `AGO (1 a ${data.diaDoMes})`, style: "th", alignment: "right" },
        { text: `JUL (1 a ${data.diaDoMes})`, style: "th", alignment: "right" },
        { text: "Δ MTD (R$)", style: "th", alignment: "right" },
        { text: "Δ MTD (%)", style: "th", alignment: "center" },
        { text: "Trim. atual MTD", style: "th", alignment: "right" },
        { text: "Trim. ant. equiv.", style: "th", alignment: "right" },
        { text: "Δ Trim (%)", style: "th", alignment: "center" },
        { text: "Status", style: "th", alignment: "center" },
      ],
    ];

    data.top10Redes.forEach((r) => {
      const v = r.vsMesAnterior;
      const t = r.vsTrimestre;
      const statusColor = v.status === "NOVO" ? "#2563EB" : v.status === "CRESCIMENTO" ? "#059669" : v.status === "QUEDA" ? "#DC2626" : "#D97706";

      tableTop10Perf.push([
        { text: r.rede, style: "tdBold" },
        { text: this.formatCurrencyK(v.fatMtdAtual), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(v.fatMtdAnterior), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(v.diffValor), style: "tdBold", alignment: "right", color: statusColor },
        { text: this.formatPercent(v.diffPct), style: "tdPct", alignment: "center", color: statusColor },
        { text: this.formatCurrencyK(t.fatTrimAtualMtd), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(t.fatTrimAntEquiv), style: "td", alignment: "right" },
        { text: this.formatPercent(t.diffPct), style: "tdPct", alignment: "center" },
        { text: v.statusLabel || "🟡 Estável", style: "tdPct", alignment: "center", color: statusColor },
      ]);
    });

    content.push({
      table: {
        widths: ["22%", "10%", "10%", "11%", "8%", "11%", "11%", "7%", "10%"],
        body: tableTop10Perf,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 6],
    });

    // Seção C: IA Executiva ("HOJE, O QUE EU PRECISO SABER?")
    const ia = data.iaExecutiva;
    const alertItems = ia.alertas.map(a => ({ text: `• ${a}`, style: "iaBulletText", color: "#B91C1C" }));
    const oppItems = ia.oportunidades.map(o => ({ text: `• ${o}`, style: "iaBulletText", color: "#047857" }));
    const actionItems = ia.ondeAgirHoje.map(act => ({
      text: [
        { text: `🎯 ${act.responsavel}: `, bold: true, color: "#111827" },
        { text: `${act.prioridade}. `, bold: true, color: "#1E40AF" },
        { text: `${act.descricao}`, color: "#374151" },
      ],
      style: "iaBulletText",
    }));

    content.push({
      table: {
        widths: ["33%", "33%", "34%"],
        body: [
          [
            { text: "🔴 3 PRINCIPAIS ALERTAS", style: "iaCardHeader", fillColor: "#FEE2E2" },
            { text: "🟢 3 PRINCIPAIS OPORTUNIDADES", style: "iaCardHeader", fillColor: "#DCFCE7" },
            { text: "🎯 ONDE AGIR HOJE", style: "iaCardHeader", fillColor: "#E0E7FF" },
          ],
          [
            { stack: alertItems, fillColor: "#FFF5F5" },
            { stack: oppItems, fillColor: "#F0FDF4" },
            { stack: actionItems, fillColor: "#F8FAFC" },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 2, 0, 0],
    });

    // Definição Geral do Documento
    const docDefinition: any = {
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [20, 20, 20, 24],
      content,
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: "Coffee++ Plataforma Comercial &bull; Relatório Executivo Oficial", style: "footerText", margin: [20, 0, 0, 0] },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: "right", style: "footerText", margin: [0, 0, 20, 0] },
        ],
      }),
      styles: {
        docHeaderLogo: { fontSize: 11, bold: true, color: "#B45309" },
        docHeaderDate: { fontSize: 8, color: "#6B7280" },
        pageTitle: { fontSize: 12, bold: true, color: "#111827" },
        pageSubtitle: { fontSize: 7.5, color: "#6B7280" },
        sectionHeader: { fontSize: 8, bold: true, color: "#1F2937" },
        kpiCardTitle: { fontSize: 7, bold: true, color: "#374151", alignment: "center", margin: [0, 1.5, 0, 1.5] },
        kpiReal: { fontSize: 9, bold: true, color: "#111827", margin: [0, 1, 0, 1] },
        kpiMeta: { fontSize: 7, color: "#6B7280", margin: [0, 0.5, 0, 0.5] },
        kpiPct: { fontSize: 8, bold: true, margin: [0, 0.5, 0, 0.5] },
        th: { fontSize: 6.5, bold: true, color: "#111827", fillColor: "#F3F4F6", margin: [0, 2, 0, 2] },
        td: { fontSize: 6.5, color: "#374151", margin: [0, 1.5, 0, 1.5] },
        tdBold: { fontSize: 6.5, bold: true, color: "#111827", margin: [0, 1.5, 0, 1.5] },
        tdPct: { fontSize: 6.5, bold: true, margin: [0, 1.5, 0, 1.5] },
        tdTotal: { fontSize: 7, bold: true, color: "#111827", fillColor: "#F9FAFB", margin: [0, 2, 0, 2] },
        tdTotalPct: { fontSize: 7, bold: true, fillColor: "#F9FAFB", margin: [0, 2, 0, 2] },
        gerenteCardTitle: { fontSize: 9.5, bold: true, color: "#111827" },
        badgeClientes: { fontSize: 7, color: "#4B5563", bold: true },
        badgeAtrasadas: { fontSize: 8, bold: true, color: "#DC2626" },
        badgeOk: { fontSize: 7.5, bold: true, color: "#059669" },
        gerenteKpiLabel: { fontSize: 6.5, bold: true, color: "#6B7280", margin: [0, 1, 0, 1] },
        gerenteKpiValue: { fontSize: 8.5, bold: true, color: "#111827", margin: [0, 1, 0, 1] },
        iaCardHeader: { fontSize: 7, bold: true, color: "#1F2937", alignment: "center", margin: [0, 2, 0, 2] },
        iaBulletText: { fontSize: 6.2, margin: [0, 1.5, 0, 1.5], lineHeight: 1.1 },
        footnote: { fontSize: 6, color: "#6B7280", italics: true },
        footerText: { fontSize: 6.5, color: "#9CA3AF" },
      },
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout na geração do PDF executivo")), 25000);
      pdfDoc.getBuffer((buffer: any) => {
        clearTimeout(timeout);
        resolve(Buffer.from(buffer));
      });
    });
  }
}

