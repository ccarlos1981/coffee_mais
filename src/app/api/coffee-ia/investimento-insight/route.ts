import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `Você é o Coffee_IA, auditor e analista de processos da Coffee Mais.

## Sua Missão:
Analisar o histórico e o momento atual das ações de investimento (Trade, Sell Out, etc.) e identificar **O QUE ESTÁ CHAMANDO ATENÇÃO NEGATIVAMENTE**. O objetivo principal é encontrar gargalos, lentidão de aprovação e dinheiro parado.

## Formato de Resposta:
Responda de forma curta, direta e com foco no problema. Use markdown. NO MÁXIMO 350 palavras.

## Estrutura obrigatória:
1. **🚨 Alertas Críticos** (2-3 bullets): Quais ações estão travadas há mais tempo? Algum processo (Trade, Apuração, Financeiro) está demorando muito para andar?
2. **⏳ Gargalos por Fase** (2-3 bullets): Onde as ações mais enroscam? Tem muita ação parada no Financeiro ou na Apuração? Quem (ou qual etapa) está demorando para executar o processo?
3. **📉 Redes com Problemas** (1-2 bullets): Existe alguma rede que sempre tem ações demoradas ou travadas?
4. **✅ Situação Geral** (1 frase): Se não houver nenhum histórico de atraso ou se estiver tudo fluindo perfeitamente, diga claramente: "Não há gargalos ou ações chamando atenção negativamente no momento. O fluxo está saudável."

## Regras:
- Compare a "Data atual" com as datas das fases (criado, inicio, fim, validado_trade, apurado, conferido) para descobrir se algo está atrasado.
- Se uma ação já passou da data de fim e ainda não foi apurada ou paga, isso é um gargalo.
- Se a diferença entre a data de criação e a validação for muito grande, aponte.
- NÃO invente dados. Se não houver atrasos ou ações com problema, apenas avise que está tudo certo.
- Seja direto ao ponto. Sem introduções longas.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { investimentos, dataAtual } = body;

    if (!investimentos || !Array.isArray(investimentos)) {
      return Response.json({ error: "Dados insuficientes" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
    }

    // Aggregate data to reduce tokens
    const totalAcoes = investimentos.length;
    const faseDistribuicao: Record<string, number> = {};
    const redeAgg: Record<string, { count: number; valor: number }> = {};
    const familiaAgg: Record<string, { count: number; valor: number }> = {};
    const tipoAgg: Record<string, number> = {};
    let totalInvestido = 0;

    const acoes = investimentos.map((inv: any) => {
      const fase = inv.fase_atual || 1;
      const faseLabel = fase === 1 ? "Planejamento" : fase === 2 ? "Trade" : fase === 3 ? "Apuração" : fase === 4 ? "Conferência" : fase === 5 ? "Financeiro" : "Concluído";
      
      faseDistribuicao[faseLabel] = (faseDistribuicao[faseLabel] || 0) + 1;

      let valor = 0;
      if (inv.abrangencia === "SKU" && inv.skus_detalhes) {
        valor = inv.skus_detalhes.reduce((acc: number, s: any) => acc + ((Number(s.investimento) || 0) * (Number(s.expectativa_volume) || 0)), 0);
      } else {
        valor = (Number(inv.valor_investimento) || 0) * (Number(inv.expectativa_volume) || 0);
      }
      totalInvestido += valor;

      // By rede
      if (!redeAgg[inv.rede]) redeAgg[inv.rede] = { count: 0, valor: 0 };
      redeAgg[inv.rede].count++;
      redeAgg[inv.rede].valor += valor;

      // By familia
      const fam = inv.familia_produto || "SKU Múltiplos";
      if (!familiaAgg[fam]) familiaAgg[fam] = { count: 0, valor: 0 };
      familiaAgg[fam].count++;
      familiaAgg[fam].valor += valor;

      // By tipo
      tipoAgg[inv.tipo_acao] = (tipoAgg[inv.tipo_acao] || 0) + 1;

      return {
        cod: inv.codigo,
        rede: inv.rede,
        fase: faseLabel,
        val: Math.round(valor),
        dt_criado: inv.created_at?.split('T')[0],
        dt_inicio: inv.data_inicio,
        dt_fim: inv.data_fim,
        dt_trade_validou: inv.trade_validado_em?.split('T')[0],
        dt_apurado: inv.apuracao_preenchida_em?.split('T')[0],
        dt_conferido: inv.trade_conferido_em?.split('T')[0],
        dt_pago: inv.financeiro_pago_em?.split('T')[0],
      };
    });

    // Sort redes by valor
    const topRedes = Object.entries(redeAgg)
      .sort(([, a], [, b]) => b.valor - a.valor)
      .slice(0, 10)
      .map(([rede, info]) => `${rede}: ${info.count} ações, R$ ${Math.round(info.valor).toLocaleString("pt-BR")}`);

    const topFamilias = Object.entries(familiaAgg)
      .sort(([, a], [, b]) => b.valor - a.valor)
      .slice(0, 8)
      .map(([fam, info]) => `${fam}: ${info.count} ações, R$ ${Math.round(info.valor).toLocaleString("pt-BR")}`);

    const dataPrompt = `
Data atual: ${dataAtual || new Date().toISOString().split('T')[0]}

RESUMO GERAL:
- Total de ações: ${totalAcoes}
- Total investido: R$ ${Math.round(totalInvestido).toLocaleString("pt-BR")}
- Valor médio por ação: R$ ${totalAcoes > 0 ? Math.round(totalInvestido / totalAcoes).toLocaleString("pt-BR") : "0"}

DISTRIBUIÇÃO POR FASE:
${Object.entries(faseDistribuicao).map(([f, c]) => `- ${f}: ${c} ações`).join("\n")}

POR TIPO DE AÇÃO:
${Object.entries(tipoAgg).map(([t, c]) => `- ${t}: ${c} ações`).join("\n")}

TOP REDES (por valor investido):
${topRedes.join("\n")}

TOP FAMÍLIAS:
${topFamilias.join("\n")}

DETALHES DAS AÇÕES (últimas 30):
${JSON.stringify(acoes.slice(0, 30))}
`;

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nDADOS DE INVESTIMENTOS:\n" + dataPrompt }] },
      ],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });

    const text = result.response.text();

    return Response.json({ insight: text });
  } catch (err) {
    console.error("Coffee IA Investimento Insight error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return Response.json({ error: message }, { status: 500 });
  }
}
