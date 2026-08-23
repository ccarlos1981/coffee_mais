import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExecutiveReportData } from "./executive-report-collector";

export class ExecutiveAiAnalyst {
  /**
   * Gera o corpo institucional limpo do e-mail executivo conforme Demanda 091
   */
  static async generateEmailSummary(data: ExecutiveReportData): Promise<string> {
    return this.generateInstitutionalEmail(data);
  }

  /**
   * Retorna o corpo institucional padronizado do e-mail
   */
  static generateInstitutionalEmail(data: ExecutiveReportData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.6; margin: 0; padding: 24px; background-color: #f9fafb; }
    .card { background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; max-width: 580px; margin: 0 auto; }
    p { margin: 0 0 16px 0; font-size: 14px; color: #374151; }
    .footer { font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <p>Cristiano,</p>
    <p>Segue o <strong>Relatório Executivo Diário Coffee++</strong> em anexo (${data.dataReferencia}).</p>
    <p>Abs.</p>
    <div class="footer">
      Coffee++ Plataforma de Inteligência Comercial &bull; Envio Automático Diário
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Constrói o prompt com dados 100% estruturados e regras de blindagem contra alucinação
   */
  private static buildPrompt(data: ExecutiveReportData): string {
    const consol = data.vendas.consolidadoKaDist;
    const inv = data.investimentosResumo.consolidado;

    const payloadCompacto = {
      dataReferencia: data.dataReferencia,
      competencia: data.competenciaAtual,
      diaDoMes: data.diaDoMes,
      diasUteis: `${data.diasUteisDecorridos}/${data.diasUteisTotais}`,
      vendasConsolidado: {
        realFat: Math.round(consol.realFat),
        metaFat: Math.round(consol.metaFat),
        pctAtgFat: Number(consol.pctAtgFat.toFixed(1)),
        realUnd: Math.round(consol.realUnd),
        metaUnd: Math.round(consol.metaUnd),
        pctAtgUnd: Number(consol.pctAtgUnd.toFixed(1)),
        realMaco: Math.round(consol.realMaco),
        metaMaco: Math.round(consol.metaMaco),
        pctAtgMaco: Number(consol.pctAtgMaco.toFixed(1)),
      },
      gerentesVendas: data.vendas.gerentes.map((g) => ({
        gerente: g.managerName,
        fatReal: Math.round(g.realFat),
        fatMeta: Math.round(g.metaFat),
        fatPct: Number(g.pctAtgFat.toFixed(1)),
        undReal: Math.round(g.realUnd),
        undMeta: Math.round(g.metaUnd),
        undPct: Number(g.pctAtgUnd.toFixed(1)),
        macoReal: Math.round(g.realMaco),
        macoPct: Number(g.pctAtgMaco.toFixed(1)),
        badge: g.statusBadge,
      })),
      investimentos: {
        faturamento: Math.round(inv.faturamento),
        expectativa: Math.round(inv.expectativaInvestimento),
        pctInvest: Number(inv.pctInvestimento.toFixed(1)),
        naoProvisionado: Math.round(inv.naoProvisionado),
        provisionado: Math.round(inv.provisionado),
        acoesAtrasadasQtd: inv.acoesAtrasadasQtd,
        acoesAtrasadasValor: Math.round(inv.acoesAtrasadasValor),
      },
      redesAlertaMtd: data.inteligenciaMtd.redesAlerta.map((r) => ({
        rede: r.rede,
        gerente: r.gerente,
        fatAtual: Math.round(r.faturamentoMtd),
        fatAnterior: Math.round(r.faturamentoMtdAnterior),
        quedaPct: Number(r.variacaoMtdPct.toFixed(1)),
        quedaValor: Math.round(r.variacaoMtdValor),
        evidencia: r.evidenciaMatematica,
      })),
      redesOportunidadeMtd: data.inteligenciaMtd.redesOportunidade.map((o) => ({
        rede: o.rede,
        gerente: o.gerente,
        fatAtual: Math.round(o.faturamentoMtd),
        crescimentoPct: Number(o.crescimentoMtdPct.toFixed(1)),
        crescimentoValor: Math.round(o.crescimentoMtdValor),
        destaque: o.destaque,
      })),
    };

    return `
Você é o Coffee_IA, Analista Executivo da diretoria da Coffee Mais.
Analise os dados estruturados fornecidos abaixo para compor o Relatório Executivo Diário.

## REGRAS MANDATÓRIAS:
1. NÃO INVENTE CAUSAS EXTERNAS (ex: proibido dizer "cliente perdeu espaço", "concorrente entrou"). Fale apenas FATOS MATEMÁTICOS baseados nos dados.
2. Comparações são MTD simétricas (1 a ${data.diaDoMes} deste mês vs 1 a ${data.diaDoMes} do mês anterior).
3. Seja direto, assertivo e executivo.

## DADOS REAIS DO DIA:
${JSON.stringify(payloadCompacto, null, 2)}

## FORMATO DE RESPOSTA OBRIGATÓRIO (Em Markdown limpo):

### HOJE, O QUE EU PRECISO SABER?

#### 🔴 3 PRINCIPAIS ALERTAS
1. [Alerta 1 com números exatos em R$ e %]
2. [Alerta 2 com números exatos em R$ e %]
3. [Alerta 3 com números exatos em R$ e %]

#### 🟢 3 PRINCIPAIS OPORTUNIDADES
1. [Oportunidade 1 com números exatos]
2. [Oportunidade 2 com números exatos]
3. [Oportunidade 3 com números exatos]

### 📊 NÚMEROS-CHAVE (CONSOLIDADO)
- **Faturamento:** R$ [Real] (Meta: R$ [Meta] | [Pct]%)
- **Volume:** [Real] un (Meta: [Meta] un | [Pct]%)
- **MACO:** R$ [Real] (Meta: R$ [Meta] | [Pct]%)
- **Investimento:** R$ [Exp] ([Pct]% sobre faturamento)
- **Não Provisionado:** R$ [NaoProv]
- **Ações Atrasadas:** [Qtd] ações (R$ [Valor])

### 🔎 REDES QUE MERECEM ATENÇÃO (QUEDAS MTD)
[Para cada rede em alerta, 1 bullet explicando a queda matemática exata e o gerente responsável]

### 🚀 OPORTUNIDADES E CRESCIMENTO
[Para cada rede em oportunidade, 1 bullet explicando o ganho matemático exato]

### 💰 INVESTIMENTOS E GARGALOS OPERACIONAIS
[Diagnóstico curto sobre provisionamento e atrasos de Trade]
`;
  }

  /**
   * Converte a resposta em markdown para HTML corporativo de e-mail
   */
  private static formatHtmlEmail(aiMarkdown: string, data: ExecutiveReportData): string {
    const formatBrCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    const formatNumber = (v: number) => v.toLocaleString("pt-BR");
    const consol = data.vendas.consolidadoKaDist;
    const inv = data.investimentosResumo.consolidado;

    // Converter markdown básico para HTML
    let htmlContent = aiMarkdown
      .replace(/### (.*)/g, "<h3 style='color: #1f2937; margin: 18px 0 8px 0; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;'>$1</h3>")
      .replace(/#### 🔴 (.*)/g, "<h4 style='color: #dc2626; margin: 12px 0 6px 0; font-size: 13px;'>🔴 $1</h4>")
      .replace(/#### 🟢 (.*)/g, "<h4 style='color: #059669; margin: 12px 0 6px 0; font-size: 13px;'>🟢 $1</h4>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.*)/gm, "<li style='margin-bottom: 4px; font-size: 13px; color: #374151;'>$1</li>")
      .replace(/^\d+\. (.*)/gm, "<li style='margin-bottom: 4px; font-size: 13px; color: #374151;'>$1</li>");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #111827; }
    .card { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
    .header { background: #18181b; padding: 20px 24px; color: #ffffff; }
    .content { padding: 24px; line-height: 1.5; }
    .kpi-grid { display: table; width: 100%; margin: 16px 0; border-spacing: 6px; }
    .kpi-box { display: table-cell; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .footer { background: #fafafa; padding: 16px 24px; font-size: 11px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin: 0; color: #f59e0b; font-size: 18px;">☕ Coffee++ &bull; Relatório Executivo Diário</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">Data de Referência: ${data.dataReferencia} | Competência: ${data.competenciaAtual}</p>
    </div>

    <div class="content">
      <div class="kpi-grid">
        <div class="kpi-box">
          <div style="font-size: 10px; color: #6b7280; font-weight: 700;">FATURAMENTO KA/DIST</div>
          <div style="font-size: 14px; font-weight: 700; color: #111827;">${formatBrCurrency(consol.realFat)}</div>
          <div style="font-size: 11px; font-weight: 700; color: ${consol.pctAtgFat >= 100 ? "#059669" : consol.pctAtgFat >= 80 ? "#d97706" : "#dc2626"};">${consol.pctAtgFat.toFixed(1)}% atingido</div>
        </div>
        <div class="kpi-box">
          <div style="font-size: 10px; color: #6b7280; font-weight: 700;">UNIDADES</div>
          <div style="font-size: 14px; font-weight: 700; color: #111827;">${formatNumber(consol.realUnd)} un</div>
          <div style="font-size: 11px; font-weight: 700; color: #4b5563;">${consol.pctAtgUnd.toFixed(1)}% atingido</div>
        </div>
        <div class="kpi-box">
          <div style="font-size: 10px; color: #6b7280; font-weight: 700;">INVESTIMENTO</div>
          <div style="font-size: 14px; font-weight: 700; color: #111827;">${formatBrCurrency(inv.expectativaInvestimento)}</div>
          <div style="font-size: 11px; font-weight: 700; color: ${inv.pctInvestimento > 5 ? "#dc2626" : "#059669"};">${inv.pctInvestimento.toFixed(1)}% s/ fat</div>
        </div>
      </div>

      <div>
        ${htmlContent}
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; border-radius: 6px; margin-top: 20px; font-size: 12px; color: #1e40af;">
        📎 <strong>PDF Anexo:</strong> O relatório executivo detalhado de 4 páginas (Vendas KA/Dist, Resumo de Investimentos, Investimento por Canal e Investimento por Cliente/Rede) encontra-se anexado a este e-mail.
      </div>
    </div>

    <div class="footer">
      Coffee++ Plataforma de Inteligência Comercial &bull; Envio Automático Diário (Seg a Sáb às 07:30 BRT)<br>
      Última importação confirmada: ${data.ultimaImportacao.finalizadaEm} (${data.ultimaImportacao.nomeArquivo})
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * Fallback determinístico caso o Gemini esteja indisponível
   */
  private static generateDeterministicFallback(data: ExecutiveReportData): string {
    const consol = data.vendas.consolidadoKaDist;
    const inv = data.investimentosResumo.consolidado;

    const alertasTexto = data.inteligenciaMtd.redesAlerta.length > 0
      ? data.inteligenciaMtd.redesAlerta.map((r) => `<li><strong>${r.rede} (${r.gerente}):</strong> ${r.evidenciaMatematica}</li>`).join("\n")
      : "<li>Nenhuma rede com queda expressiva superior a 10% no período MTD.</li>";

    const oportunidadesTexto = data.inteligenciaMtd.redesOportunidade.length > 0
      ? data.inteligenciaMtd.redesOportunidade.map((o) => `<li><strong>${o.rede} (${o.gerente}):</strong> ${o.destaque}</li>`).join("\n")
      : "<li>Operação mantendo ritmo regular de vendas.</li>";

    const aiMarkdown = `
### HOJE, O QUE EU PRECISO SABER?

#### 🔴 3 PRINCIPAIS ALERTAS
1. Atingimento consolidado KA + Dist em ${consol.pctAtgFat.toFixed(1)}% da meta no dia ${data.diaDoMes}.
2. Investimentos não provisionados somam R$ ${inv.naoProvisionado.toLocaleString("pt-BR")}.
3. Existem ${inv.acoesAtrasadasQtd} ações atrasadas totalizando R$ ${inv.acoesAtrasadasValor.toLocaleString("pt-BR")}.

#### 🟢 3 PRINCIPAIS OPORTUNIDADES
1. Carteira de distribuição mantendo faturamento ativo.
2. Redes com crescimento acelerado identificadas no comparativo MTD.
3. Margem MACO com controle de gastos nos principais canais de Key Account.

### 🔎 REDES QUE MERECEM ATENÇÃO (QUEDAS MTD)
${alertasTexto}

### 🚀 OPORTUNIDADES E CRESCIMENTO
${oportunidadesTexto}

### 💰 INVESTIMENTOS E GARGALOS OPERACIONAIS
- **Expectativa Total:** R$ ${inv.expectativaInvestimento.toLocaleString("pt-BR")} (${inv.pctInvestimento.toFixed(1)}% do faturamento)
- **Não Provisionado:** R$ ${inv.naoProvisionado.toLocaleString("pt-BR")}
- **Ações Atrasadas:** ${inv.acoesAtrasadasQtd} ações pendentes de encerramento.
`;

    return this.formatHtmlEmail(aiMarkdown, data);
  }
}
