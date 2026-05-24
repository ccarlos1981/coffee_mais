import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `Você é o Coffee_IA, analista de dados da Coffee Mais (empresa de café gourmet).

## Sua Missão:
Analisar os dados do dashboard de vendas e gerar um RESUMO EXECUTIVO curto e prático.

## Formato de Resposta:
Responda em texto corrido usando markdown leve (negrito, listas curtas). O texto deve ter NO MÁXIMO 350 palavras.

## Estrutura obrigatória:
1. **📊 Visão Geral** (2-3 frases): Diagnóstico do mês — está acima/abaixo da meta? Qual o ritmo (pace)?
2. **🏆 Destaques Positivos** (2-3 bullets): Quem está performando bem e merece reconhecimento.
3. **⚠️ Pontos de Atenção** (2-3 bullets): Quem precisa de suporte, onde estão os gaps.
4. **📉 Redes com Maior Perda** (2-3 bullets): Cite as redes que mais perderam faturamento vs mês anterior e/ou ano anterior, incluindo o valor da queda em R$.
5. **👥 Positivação** (1-2 frases): Quantos clientes ativos agora vs mês anterior. Está expandindo ou retraindo a base?
6. **🎯 Sugestão de Ação** (1-2 frases): O que fazer AGORA para melhorar o resultado do mês.

## Regras:
- Use português brasileiro, seja direto e profissional.
- Formate valores monetários em R$ com ponto para milhar e vírgula para decimal.
- Percentuais com 1 casa decimal.
- NÃO invente dados, use APENAS o que foi fornecido.
- Seja construtivo, não punitivo com baixa performance.
- Se todos estão abaixo da meta, foque em prioridades.
- Se todos estão acima, foque em oportunidades de superar.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { totals, managerRows, familiaData, businessDays, previousMonth, previousYear, month, year, lostVsMonth, lostVsYear, positivation } = body;

    if (!totals || !managerRows) {
      return Response.json({ error: "Dados insuficientes" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
    }

    // Build a compact data summary for the AI (minimal tokens)
    const managerSummary = managerRows.map((m: {
      manager: string;
      fat: number;
      metaFat: number;
      qty: number;
      metaUnd: number;
      maco: number;
      metaMaco: number;
    }) => ({
      nome: m.manager,
      fatReal: Math.round(m.fat),
      fatMeta: Math.round(m.metaFat),
      fatPct: m.metaFat > 0 ? Math.round((m.fat / m.metaFat) * 1000) / 10 : 0,
      undReal: Math.round(m.qty),
      undMeta: Math.round(m.metaUnd),
      macoReal: Math.round(m.maco),
      macoMeta: Math.round(m.metaMaco),
    }));

    const topFamilias = (familiaData || []).slice(0, 6).map((f: { familia: string; fat: number; pct: number }) => ({
      familia: f.familia,
      fat: Math.round(f.fat),
      pct: Math.round(f.pct * 10) / 10,
    }));

    const dataPrompt = `
Período: ${month}/${year}
Dias úteis: ${businessDays?.elapsed_days || "?"}/${businessDays?.total_days || "?"} (${businessDays?.total_days ? Math.round((businessDays.elapsed_days / businessDays.total_days) * 100) : "?"}% do mês)

TOTAIS:
- Fat: R$ ${Math.round(totals.fat).toLocaleString("pt-BR")} / Meta: R$ ${Math.round(totals.metaFat).toLocaleString("pt-BR")} (${totals.metaFat > 0 ? ((totals.fat / totals.metaFat) * 100).toFixed(1) : 0}%)
- Unid: ${Math.round(totals.qty).toLocaleString("pt-BR")} / Meta: ${Math.round(totals.metaUnd).toLocaleString("pt-BR")}
- MaCo: R$ ${Math.round(totals.maco).toLocaleString("pt-BR")} / Meta: R$ ${Math.round(totals.metaMaco).toLocaleString("pt-BR")}

vs MÊS ANTERIOR: Fat ${previousMonth?.fat ? ((totals.fat - previousMonth.fat) / previousMonth.fat * 100).toFixed(1) : "N/A"}%
vs ANO ANTERIOR: Fat ${previousYear?.fat ? ((totals.fat - previousYear.fat) / previousYear.fat * 100).toFixed(1) : "N/A"}%

POR GERENTE:
${JSON.stringify(managerSummary)}

TOP FAMÍLIAS:
${JSON.stringify(topFamilias)}

REDES COM MAIOR PERDA vs MÊS ANTERIOR:
${lostVsMonth && lostVsMonth.length > 0 ? lostVsMonth.map((l: { client: string; atual: number; anterior: number; diff: number }) => `- ${l.client}: R$ ${l.anterior.toLocaleString("pt-BR")} → R$ ${l.atual.toLocaleString("pt-BR")} (${l.diff > 0 ? "+" : ""}R$ ${l.diff.toLocaleString("pt-BR")})`).join("\n") : "Sem dados disponíveis"}

REDES COM MAIOR PERDA vs ANO ANTERIOR:
${lostVsYear && lostVsYear.length > 0 ? lostVsYear.map((l: { client: string; atual: number; anoAnterior: number; diff: number }) => `- ${l.client}: R$ ${l.anoAnterior.toLocaleString("pt-BR")} → R$ ${l.atual.toLocaleString("pt-BR")} (${l.diff > 0 ? "+" : ""}R$ ${l.diff.toLocaleString("pt-BR")})`).join("\n") : "Sem dados disponíveis"}

POSITIVAÇÃO (clientes ativos com faturamento):
- Mês atual: ${positivation?.current ?? "?"} clientes
- Mês anterior: ${positivation?.prevMonth ?? "?"} clientes
- Variação: ${positivation?.current && positivation?.prevMonth ? (positivation.current - positivation.prevMonth > 0 ? "+" : "") + (positivation.current - positivation.prevMonth) + " clientes" : "N/A"}
`;

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nDADOS DO DASHBOARD:\n" + dataPrompt }] },
      ],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.7,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });

    const text = result.response.text();

    return Response.json({ insight: text });
  } catch (err) {
    console.error("Coffee IA Insight error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return Response.json({ error: message }, { status: 500 });
  }
}
