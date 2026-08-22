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

  private static formatPercent(val: number): string {
    return `${val.toFixed(1).replace(".", ",")}%`;
  }

  private static getStatusColor(pct: number): string {
    if (pct < 80) return "#DC2626"; // Vermelho Crítico
    if (pct < 100) return "#D97706"; // Âmbar Atenção
    return "#059669"; // Verde Atingido
  }

  /**
   * Constrói o buffer PDF de 4 páginas executivas estruturadas
   */
  static async buildPdfBuffer(data: ExecutiveReportData): Promise<Buffer> {
    const content: any[] = [];

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — VENDAS KA + DISTRIBUIDOR
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 1 — VENDAS KEY ACCOUNT + DISTRIBUIDOR", style: "pageTitle", margin: [0, 5, 0, 10] },
      {
        text: `Competência: ${data.competenciaAtual} | Dados MTD (1 a ${data.diaDoMes}) | Última Importação: ${data.ultimaImportacao.finalizadaEm}`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 12],
      }
    );

    // Card Consolidado Geral KA + Dist
    const consol = data.vendas.consolidadoKaDist;
    content.push({
      table: {
        widths: ["33.3%", "33.3%", "33.4%"],
        body: [
          [
            { text: "FATURAMENTO CONSOLIDADO", style: "kpiCardTitle", fillColor: "#FEF3C7" },
            { text: "VOLUME (UNIDADES)", style: "kpiCardTitle", fillColor: "#E0E7FF" },
            { text: "MACO (MARGEM CONTRIB.)", style: "kpiCardTitle", fillColor: "#DCFCE7" },
          ],
          [
            {
              stack: [
                { text: `Real: ${this.formatCurrency(consol.realFat)}`, style: "kpiReal" },
                { text: `Meta: ${this.formatCurrency(consol.metaFat)}`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(consol.pctAtgFat)}`, style: "kpiPct", color: this.getStatusColor(consol.pctAtgFat) },
              ],
              fillColor: "#FFFDF5",
            },
            {
              stack: [
                { text: `Real: ${this.formatNumber(consol.realUnd)} un`, style: "kpiReal" },
                { text: `Meta: ${this.formatNumber(consol.metaUnd)} un`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(consol.pctAtgUnd)}`, style: "kpiPct", color: this.getStatusColor(consol.pctAtgUnd) },
              ],
              fillColor: "#F8FAFC",
            },
            {
              stack: [
                { text: `Real: ${this.formatCurrency(consol.realMaco)}`, style: "kpiReal" },
                { text: `Meta: ${this.formatCurrency(consol.metaMaco)}`, style: "kpiMeta" },
                { text: `Atingimento: ${this.formatPercent(consol.pctAtgMaco)}`, style: "kpiPct", color: this.getStatusColor(consol.pctAtgMaco) },
              ],
              fillColor: "#F0FDF4",
            },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 16],
    });

    // Tabela por Gerente
    const tableGerentesBody: any[] = [
      [
        { text: "Gerente / Canal", style: "th" },
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

    data.vendas.gerentes.forEach((g) => {
      tableGerentesBody.push([
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

    // Total da Tabela
    tableGerentesBody.push([
      { text: "TOTAL CONSOLIDADO", style: "tdTotal" },
      { text: this.formatCurrencyK(consol.metaFat), style: "tdTotal", alignment: "right" },
      { text: this.formatCurrencyK(consol.realFat), style: "tdTotal", alignment: "right" },
      { text: this.formatPercent(consol.pctAtgFat), style: "tdTotalPct", alignment: "center", color: this.getStatusColor(consol.pctAtgFat) },
      { text: this.formatNumber(consol.metaUnd), style: "tdTotal", alignment: "right" },
      { text: this.formatNumber(consol.realUnd), style: "tdTotal", alignment: "right" },
      { text: this.formatPercent(consol.pctAtgUnd), style: "tdTotalPct", alignment: "center", color: this.getStatusColor(consol.pctAtgUnd) },
      { text: this.formatCurrencyK(consol.metaMaco), style: "tdTotal", alignment: "right" },
      { text: this.formatCurrencyK(consol.realMaco), style: "tdTotal", alignment: "right" },
      { text: this.formatPercent(consol.pctAtgMaco), style: "tdTotalPct", alignment: "center", color: this.getStatusColor(consol.pctAtgMaco) },
    ]);

    content.push({
      table: {
        widths: ["20%", "9%", "9%", "8%", "9%", "9%", "8%", "10%", "10%", "8%"],
        body: tableGerentesBody,
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
    // PÁGINA 2 — RESUMO DE INVESTIMENTOS
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 2 — RESUMO GERAL DE INVESTIMENTOS", style: "pageTitle", margin: [0, 5, 0, 10] },
      {
        text: `Referência: /investimento/gerencial | Mês: ${data.competenciaAtual}`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 12],
      }
    );

    const invConsol = data.investimentosResumo.consolidado;
    content.push({
      table: {
        widths: ["25%", "25%", "25%", "25%"],
        body: [
          [
            { text: "EXPECTATIVA TOTAL", style: "kpiCardTitle", fillColor: "#F3F4F6" },
            { text: "% SOBRE FATURAMENTO", style: "kpiCardTitle", fillColor: "#F3F4F6" },
            { text: "NÃO PROVISIONADO", style: "kpiCardTitle", fillColor: "#FEE2E2" },
            { text: "AÇÕES ATRASADAS", style: "kpiCardTitle", fillColor: "#FEE2E2" },
          ],
          [
            { text: this.formatCurrency(invConsol.expectativaInvestimento), style: "kpiReal", alignment: "center", fillColor: "#FFFFFF" },
            { text: this.formatPercent(invConsol.pctInvestimento), style: "kpiReal", alignment: "center", fillColor: "#FFFFFF", color: invConsol.pctInvestimento > 5 ? "#DC2626" : "#059669" },
            { text: this.formatCurrency(invConsol.naoProvisionado), style: "kpiReal", alignment: "center", fillColor: "#FFF5F5", color: "#DC2626" },
            { text: `${invConsol.acoesAtrasadasQtd} ações (${this.formatCurrency(invConsol.acoesAtrasadasValor)})`, style: "kpiReal", alignment: "center", fillColor: "#FFF5F5", color: "#DC2626" },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 16],
    });

    // Tabela de Investimento por Gerente
    const tableInvestGerentes: any[] = [
      [
        { text: "Responsável", style: "th" },
        { text: "Faturamento", style: "th", alignment: "right" },
        { text: "Expectativa", style: "th", alignment: "right" },
        { text: "% Invest.", style: "th", alignment: "center" },
        { text: "Não Provisionado", style: "th", alignment: "right" },
        { text: "Provisionado", style: "th", alignment: "right" },
        { text: "Atrasadas", style: "th", alignment: "center" },
      ],
    ];

    data.investimentosResumo.porGerente.forEach((g) => {
      tableInvestGerentes.push([
        { text: g.responsavel, style: "tdBold" },
        { text: this.formatCurrency(g.faturamento), style: "td", alignment: "right" },
        { text: this.formatCurrency(g.expectativaInvestimento), style: "td", alignment: "right" },
        { text: this.formatPercent(g.pctInvestimento), style: "tdPct", alignment: "center", color: g.pctInvestimento > 5 ? "#DC2626" : "#059669" },
        { text: this.formatCurrency(g.naoProvisionado), style: "td", alignment: "right", color: g.naoProvisionado > 0 ? "#DC2626" : "#111827" },
        { text: this.formatCurrency(g.provisionado), style: "td", alignment: "right" },
        { text: `${g.acoesAtrasadasQtd} (${this.formatCurrency(g.acoesAtrasadasValor)})`, style: "td", alignment: "center", color: g.acoesAtrasadasQtd > 0 ? "#DC2626" : "#059669" },
      ]);
    });

    content.push({
      table: {
        widths: ["22%", "16%", "16%", "10%", "15%", "11%", "10%"],
        body: tableInvestGerentes,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 12],
      pageBreak: "after",
    });

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 3 — INVESTIMENTO POR GERENTE / CANAL
    // ════════════════════════════════════════════════════════════════════════
    content.push(
      {
        columns: [
          { text: "COFFEE++ &bull; RELATÓRIO EXECUTIVO DIÁRIO", style: "docHeaderLogo" },
          { text: `Data: ${data.dataReferencia}`, style: "docHeaderDate", alignment: "right" },
        ],
      },
      { text: "PÁGINA 3 — INVESTIMENTO POR GERENTE E CANAL", style: "pageTitle", margin: [0, 5, 0, 10] },
      {
        text: `Visão Temporal e Matricial (/investimento/gerencial)`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 12],
      }
    );

    const tableCanaisBody: any[] = [
      [
        { text: "Gerente", style: "th" },
        { text: "Canal", style: "th" },
        { text: `Fat. ${data.competenciaAtual}`, style: "th", alignment: "right" },
        { text: `Invest. ${data.competenciaAtual}`, style: "th", alignment: "right" },
        { text: `% Atual`, style: "th", alignment: "center" },
        { text: `Fat. ${data.competenciaAnterior}`, style: "th", alignment: "right" },
        { text: `Invest. ${data.competenciaAnterior}`, style: "th", alignment: "right" },
        { text: `% Ant.`, style: "th", alignment: "center" },
      ],
    ];

    data.investimentosPorCanal.linhas.forEach((c) => {
      tableCanaisBody.push([
        { text: c.gerente, style: "tdBold" },
        { text: c.canal, style: "td" },
        { text: this.formatCurrencyK(c.mesAtual.faturamento), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(c.mesAtual.investimento), style: "td", alignment: "right" },
        { text: this.formatPercent(c.mesAtual.pct), style: "tdPct", alignment: "center" },
        { text: this.formatCurrencyK(c.mesAnterior.faturamento), style: "td", alignment: "right" },
        { text: this.formatCurrencyK(c.mesAnterior.investimento), style: "td", alignment: "right" },
        { text: this.formatPercent(c.mesAnterior.pct), style: "tdPct", alignment: "center" },
      ]);
    });

    content.push({
      table: {
        widths: ["15%", "17%", "12%", "12%", "10%", "12%", "12%", "10%"],
        body: tableCanaisBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 16],
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
      { text: "PÁGINA 4 — INVESTIMENTO POR CLIENTE / REDE", style: "pageTitle", margin: [0, 5, 0, 10] },
      {
        text: `Visão Operacional Detalhada (/investimento/invest-cliente)`,
        style: "pageSubtitle",
        margin: [0, 0, 0, 12],
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

    data.investimentosPorCliente.linhas.forEach((cl) => {
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
      margin: [0, 0, 0, 10],
    });

    // Definição Geral do Documento
    const docDefinition: any = {
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [28, 28, 28, 32],
      content,
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: "Coffee++ Plataforma Comercial &bull; Relatório Executivo Oficial", style: "footerText", margin: [28, 0, 0, 0] },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: "right", style: "footerText", margin: [0, 0, 28, 0] },
        ],
      }),
      styles: {
        docHeaderLogo: { fontSize: 13, bold: true, color: "#B45309" },
        docHeaderDate: { fontSize: 9, color: "#6B7280" },
        pageTitle: { fontSize: 14, bold: true, color: "#111827" },
        pageSubtitle: { fontSize: 8.5, color: "#6B7280" },
        kpiCardTitle: { fontSize: 8, bold: true, color: "#374151", alignment: "center", margin: [0, 3, 0, 3] },
        kpiReal: { fontSize: 10, bold: true, color: "#111827", margin: [0, 2, 0, 1] },
        kpiMeta: { fontSize: 8, color: "#6B7280", margin: [0, 1, 0, 1] },
        kpiPct: { fontSize: 9, bold: true, margin: [0, 1, 0, 2] },
        th: { fontSize: 7.5, bold: true, color: "#111827", fillColor: "#F3F4F6", margin: [0, 4, 0, 4] },
        td: { fontSize: 7.5, color: "#374151", margin: [0, 2.5, 0, 2.5] },
        tdBold: { fontSize: 7.5, bold: true, color: "#111827", margin: [0, 2.5, 0, 2.5] },
        tdPct: { fontSize: 7.5, bold: true, margin: [0, 2.5, 0, 2.5] },
        tdTotal: { fontSize: 8, bold: true, color: "#111827", fillColor: "#F9FAFB", margin: [0, 4, 0, 4] },
        tdTotalPct: { fontSize: 8, bold: true, fillColor: "#F9FAFB", margin: [0, 4, 0, 4] },
        footnote: { fontSize: 7, color: "#6B7280", italics: true },
        footerText: { fontSize: 7.5, color: "#9CA3AF" },
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
