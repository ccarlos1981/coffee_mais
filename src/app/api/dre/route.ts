import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("year") || new Date().getFullYear());
  const mes = Number(searchParams.get("month") || new Date().getMonth() + 1);
  const manager = searchParams.get("manager") || "Todos";
  const familia = searchParams.get("familia") || "Todos";
  const uf = searchParams.get("uf") || "Todos";
  const channel = searchParams.get("channel") || "Todos";
  const product = searchParams.get("product") || "Todos";

  const supabase = getSupabaseClient();

  try {
    // 1. Construir query base de faturamento/custos ativos
    let q = supabase
      .from("cm_dre_financeiro")
      .select("*")
      .eq("is_active", true)
      .eq("is_deleted", false);

    // Filtros dinâmicos
    if (manager !== "Todos") q = q.eq("gerente_id", manager);
    if (familia !== "Todos") q = q.eq("familia_id", familia);
    if (channel !== "Todos") q = q.eq("canal_id", channel);
    if (product !== "Todos") q = q.eq("sku_id", product);
    // UF filter: em cm_dre_financeiro a UF vem mapeada por gerente ou canal, ou se vier em codigo_matriz, 
    // podemos cruzar com cm_redes_matrizes. Se não houver coluna uf direta, ignoramos ou fazemos fallback.
    // Como a v5 consolidada não tem campo uf, se for diferente de "Todos" podemos fazer fallback ou ignorar.

    const { data: allRows, error: fetchError } = await q;

    if (fetchError) {
      throw fetchError;
    }

    // Função de agregação por competência
    const aggregatePeriod = (rows: any[], targetAno: number, targetMes: number) => {
      const filtered = rows.filter(r => r.ano === targetAno && r.mes === targetMes);
      
      const sum = {
        volume: 0,
        receita_bruta: 0,
        impostos: 0,
        investimento_comercial: 0,
        receita_liquida: 0,
        custo_produtos: 0,
        frete: 0,
        margem_contribuicao: 0,
        dga: 0,
        custo_rede: 0,
        ebitda: 0,
      };

      filtered.forEach(row => {
        sum.volume += Number(row.volume) || 0;
        sum.receita_bruta += Number(row.receita_bruta) || 0;
        sum.impostos += Number(row.impostos) || 0;
        sum.investimento_comercial += Number(row.investimento_comercial) || 0;
        sum.receita_liquida += Number(row.receita_liquida) || 0;
        sum.custo_produtos += Number(row.custo_produtos) || 0;
        sum.frete += Number(row.frete) || 0;
        sum.margem_contribuicao += Number(row.margem_contribuicao) || 0;
        sum.dga += Number(row.dga) || 0;
        sum.custo_rede += Number(row.custo_rede) || 0;
        sum.ebitda += Number(row.ebitda) || 0;
      });

      return sum;
    };

    // Calcular períodos comparativos
    const actual = aggregatePeriod(allRows || [], ano, mes);
    
    // Mês anterior
    const prevMes = mes === 1 ? 12 : mes - 1;
    const prevAno = mes === 1 ? ano - 1 : ano;
    const prevMonth = aggregatePeriod(allRows || [], prevAno, prevMes);

    // Ano anterior
    const prevYear = aggregatePeriod(allRows || [], ano - 1, mes);

    // Mock Budget (Orçamento) baseado em 10% a mais do ano anterior ou fallback
    const budget = {
      volume: prevYear.volume > 0 ? prevYear.volume * 1.05 : actual.volume * 1.1,
      receita_bruta: prevYear.receita_bruta > 0 ? prevYear.receita_bruta * 1.05 : actual.receita_bruta * 1.1,
      impostos: prevYear.impostos > 0 ? prevYear.impostos * 1.05 : actual.impostos * 1.1,
      investimento_comercial: prevYear.investimento_comercial > 0 ? prevYear.investimento_comercial * 1.05 : actual.investimento_comercial * 1.1,
      receita_liquida: prevYear.receita_liquida > 0 ? prevYear.receita_liquida * 1.05 : actual.receita_liquida * 1.1,
      custo_produtos: prevYear.custo_produtos > 0 ? prevYear.custo_produtos * 1.05 : actual.custo_produtos * 1.1,
      frete: prevYear.frete > 0 ? prevYear.frete * 1.05 : actual.frete * 1.1,
      margem_contribuicao: prevYear.margem_contribuicao > 0 ? prevYear.margem_contribuicao * 1.05 : actual.margem_contribuicao * 1.1,
      dga: prevYear.dga > 0 ? prevYear.dga * 1.05 : actual.dga * 1.1,
      custo_rede: prevYear.custo_rede > 0 ? prevYear.custo_rede * 1.05 : actual.custo_rede * 1.1,
      ebitda: prevYear.ebitda > 0 ? prevYear.ebitda * 1.05 : actual.ebitda * 1.1,
    };

    // Formatar linhas para a tabela comparativa
    const dreRows = [
      { label: "Volume (Tons)", actual: actual.volume, budget: budget.volume, prevMonth: prevMonth.volume, prevYear: prevYear.volume },
      { label: "Receita Bruta", actual: actual.receita_bruta, budget: budget.receita_bruta, prevMonth: prevMonth.receita_bruta, prevYear: prevYear.receita_bruta, isHighlight: true },
      { label: "Impostos", actual: -actual.impostos, budget: -budget.impostos, prevMonth: -prevMonth.impostos, prevYear: -prevYear.impostos },
      { label: "Invest. Comerciais", actual: -actual.investimento_comercial, budget: -budget.investimento_comercial, prevMonth: -prevMonth.investimento_comercial, prevYear: -prevYear.investimento_comercial },
      { label: "Receita Líquida", actual: actual.receita_liquida, budget: budget.receita_liquida, prevMonth: prevMonth.receita_liquida, prevYear: prevYear.receita_liquida, isBold: true, isHighlight: true },
      { label: "Custo de Produtos", actual: -actual.custo_produtos, budget: -budget.custo_produtos, prevMonth: -prevMonth.custo_produtos, prevYear: -prevYear.custo_produtos },
      { label: "Fretes", actual: -actual.frete, budget: -budget.frete, prevMonth: -prevMonth.frete, prevYear: -prevYear.frete },
      { label: "Mrg de Contribuição", actual: actual.margem_contribuicao, budget: budget.margem_contribuicao, prevMonth: prevMonth.margem_contribuicao, prevYear: prevYear.margem_contribuicao, isBold: true, isHighlight: true },
      { label: "DGA", actual: -actual.dga, budget: -budget.dga, prevMonth: -prevMonth.dga, prevYear: -prevYear.dga },
      { label: "Custo Rede", actual: -actual.custo_rede, budget: -budget.custo_rede, prevMonth: -prevMonth.custo_rede, prevYear: -prevYear.custo_rede },
      { label: "EBITDA", actual: actual.ebitda, budget: budget.ebitda, prevMonth: prevMonth.ebitda, prevYear: prevYear.ebitda, isBold: true, isHighlight: true },
    ];

    // Formatar indicadores unitários
    const calcUnit = (metrics: typeof actual) => {
      // volume está em Toneladas, então preço/Kg = receita_bruta / (volume * 1000)
      // Se receita_bruta estiver em R$ Mil e volume em Ton: R$ 1.000 / 1.000 kg = R$/Kg.
      // Então a divisão direta dá R$/Kg!
      const vol = metrics.volume || 1;
      const rec = metrics.receita_bruta || 1;
      return {
        preco_kg: metrics.volume > 0 ? metrics.receita_bruta / metrics.volume : 0,
        pct_impostos: metrics.receita_bruta > 0 ? -(metrics.impostos / metrics.receita_bruta) * 100 : 0,
        pct_invest: metrics.receita_bruta > 0 ? -(metrics.investimento_comercial / metrics.receita_bruta) * 100 : 0,
        custo_kg: metrics.volume > 0 ? -metrics.custo_produtos / metrics.volume : 0,
        frete_kg: metrics.volume > 0 ? -metrics.frete / metrics.volume : 0,
        mc_kg: metrics.volume > 0 ? metrics.margem_contribuicao / metrics.volume : 0,
        ebitda_kg: metrics.volume > 0 ? metrics.ebitda / metrics.volume : 0,
        pct_ebitda: metrics.receita_bruta > 0 ? (metrics.ebitda / metrics.receita_bruta) * 100 : 0,
      };
    };

    const actualU = calcUnit(actual);
    const budgetU = calcUnit(budget);
    const prevMonthU = calcUnit(prevMonth);
    const prevYearU = calcUnit(prevYear);

    const unitRows = [
      { label: "Preço/Kg", actual: actualU.preco_kg, budget: budgetU.preco_kg, prevMonth: prevMonthU.preco_kg, prevYear: prevYearU.preco_kg },
      { label: "% Impostos", actual: actualU.pct_impostos, budget: budgetU.pct_impostos, prevMonth: prevMonthU.pct_impostos, prevYear: prevYearU.pct_impostos, isPercent: true },
      { label: "% Investimentos", actual: actualU.pct_invest, budget: budgetU.pct_invest, prevMonth: prevMonthU.pct_invest, prevYear: prevYearU.pct_invest, isPercent: true },
      { label: "Custo/Kg", actual: actualU.custo_kg, budget: budgetU.custo_kg, prevMonth: prevMonthU.custo_kg, prevYear: prevYearU.custo_kg },
      { label: "Frete/Kg", actual: actualU.frete_kg, budget: budgetU.frete_kg, prevMonth: prevMonthU.frete_kg, prevYear: prevYearU.frete_kg },
      { label: "MC/Kg", actual: actualU.mc_kg, budget: budgetU.mc_kg, prevMonth: prevMonthU.mc_kg, prevYear: prevYearU.mc_kg, isBold: true },
      { label: "EBITDA/Kg", actual: actualU.ebitda_kg, budget: budgetU.ebitda_kg, prevMonth: prevMonthU.ebitda_kg, prevYear: prevYearU.ebitda_kg },
      { label: "% EBITDA", actual: actualU.pct_ebitda, budget: budgetU.pct_ebitda, prevMonth: prevMonthU.pct_ebitda, prevYear: prevYearU.pct_ebitda, isPercent: true, isBold: true },
    ];

    // 2. Construir dados mensais do ano (12 meses)
    const monthlyList: typeof actual[] = Array(12).fill(null).map((_, i) => aggregatePeriod(allRows || [], ano, i + 1));
    
    const monthlyRows = [
      { label: "Volume (Tons)", months: monthlyList.map(m => m.volume) },
      { label: "Receita Bruta", months: monthlyList.map(m => m.receita_bruta), isHighlight: true },
      { label: "Impostos", months: monthlyList.map(m => -m.impostos) },
      { label: "Invest. Comerciais", months: monthlyList.map(m => -m.investimento_comercial) },
      { label: "Receita Líquida", months: monthlyList.map(m => m.receita_liquida), isBold: true, isHighlight: true },
      { label: "Custo de Produtos", months: monthlyList.map(m => -m.custo_produtos) },
      { label: "Fretes", months: monthlyList.map(m => -m.frete) },
      { label: "Mrg de Contribuição", months: monthlyList.map(m => m.margem_contribuicao), isBold: true, isHighlight: true },
      { label: "DGA", months: monthlyList.map(m => -m.dga) },
      { label: "Custo Rede", months: monthlyList.map(m => -m.custo_rede) },
      { label: "EBITDA", months: monthlyList.map(m => m.ebitda), isBold: true, isHighlight: true },
    ];

    const monthlyUnitRows = [
      { label: "Preço/Kg", months: monthlyList.map(m => m.volume > 0 ? m.receita_bruta / m.volume : 0) },
      { label: "% Impostos", months: monthlyList.map(m => m.receita_bruta > 0 ? -(m.impostos / m.receita_bruta) * 100 : 0), isPercent: true },
      { label: "% Investimentos", months: monthlyList.map(m => m.receita_bruta > 0 ? -(m.investimento_comercial / m.receita_bruta) * 100 : 0), isPercent: true },
      { label: "Custo/Kg", months: monthlyList.map(m => m.volume > 0 ? -m.custo_produtos / m.volume : 0) },
      { label: "Frete/Kg", months: monthlyList.map(m => m.volume > 0 ? -m.frete / m.volume : 0) },
      { label: "MC/Kg", months: monthlyList.map(m => m.volume > 0 ? m.margem_contribuicao / m.volume : 0), isBold: true },
      { label: "EBITDA/Kg", months: monthlyList.map(m => m.volume > 0 ? m.ebitda / m.volume : 0) },
      { label: "% EBITDA", months: monthlyList.map(m => m.receita_bruta > 0 ? (m.ebitda / m.receita_bruta) * 100 : 0), isPercent: true, isBold: true },
    ];

    return NextResponse.json({
      success: true,
      dreRows,
      unitRows,
      monthlyRows,
      monthlyUnitRows,
    });

  } catch (error: any) {
    console.error("Erro ao carregar dados do DRE:", error);
    return NextResponse.json({ error: "Erro interno do servidor.", details: error.message }, { status: 500 });
  }
}
