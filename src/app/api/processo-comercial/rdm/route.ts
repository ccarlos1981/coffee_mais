import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin client sem cookies (para queries sem RLS restritiva)
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );
}

// Lista oficial de gerentes KA
const KA_MANAGERS = ["Julliano", "Leandro", "Luiz"];

// Opção "CRISTIANO" = total de todos os gerentes KA
const CRISTIANO = "CRISTIANO";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));
    const manager = searchParams.get('manager') ?? CRISTIANO; // ex: "Leandro" ou "CRISTIANO"

    // Autenticação
    const supabaseServer = await createClient();
    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const supabase = getAdminClient();

    // ── Qual(is) gerente(s) filtrar ──
    const targetManagers = manager === CRISTIANO ? KA_MANAGERS : [manager];

    // ── Chaves de período ──
    const monthKey  = `${year}-${String(month).padStart(2, '0')}`;
    const prevYear  = year - 1;
    const prevYearMonthKey = `${prevYear}-${String(month).padStart(2, '0')}`;

    // Meses YTD: Jan até o mês selecionado (mesmo ano)
    const ytdKeys: string[] = [];
    for (let m = 1; m <= month; m++) {
      ytdKeys.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    // YTD ano anterior: Jan até mesmo mês do ano passado
    const ytdPrevKeys: string[] = [];
    for (let m = 1; m <= month; m++) {
      ytdPrevKeys.push(`${prevYear}-${String(m).padStart(2, '0')}`);
    }

    // ── Queries paralelas ──
    const allMesKeys = [monthKey, prevYearMonthKey, ...ytdKeys, ...ytdPrevKeys];
    const uniqueMesKeys = [...new Set(allMesKeys)];

    // Todos os meses do ano atual necessários para o gráfico + 3 meses anteriores ao mês 1 (do ano anterior, para cálculo de média)
    const allMonthKeysForChart: string[] = [];
    for (let m = 1; m <= 12; m++) {
      allMonthKeysForChart.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    // 3 meses anteriores para rolling average (podem ser do ano anterior)
    for (let lag = 1; lag <= 3; lag++) {
      let lagM = 1 - lag; // pode ser negativo/zero
      let lagY = year;
      if (lagM <= 0) { lagM += 12; lagY = year - 1; }
      allMonthKeysForChart.push(`${lagY}-${String(lagM).padStart(2, '0')}`);
    }

    // 13 meses para slide 6 (Volume + Preço Médio): do mês selecionado recuando 12 meses
    const trailing13: string[] = [];
    for (let i = 12; i >= 0; i--) {
      let tM = month - i;
      let tY = year;
      while (tM <= 0) { tM += 12; tY--; }
      trailing13.push(`${tY}-${String(tM).padStart(2, '0')}`);
    }

    // Meses para slide 7 (Preço YoY): Jan..month do ano atual + mesmo período do ano anterior
    const priceCompareKeys: string[] = [];
    for (let m = 1; m <= month; m++) {
      priceCompareKeys.push(`${year}-${String(m).padStart(2, '0')}`);
      priceCompareKeys.push(`${prevYear}-${String(m).padStart(2, '0')}`);
    }
    const familyQueryKeys = [...new Set([...trailing13, ...priceCompareKeys])];

    const chartMesKeys = [...new Set([...uniqueMesKeys, ...allMonthKeysForChart, ...familyQueryKeys])];

    const [resSales, resTargets, resProjections, resComments, resSalesByFamily] = await Promise.all([
      // 1. Vendas agregadas por mês e gerente (inclui todos os 12 meses dos 2 anos)
      supabase.rpc('execute_readonly_query', {
        query_text: `
          SELECT mes, COALESCE(manager,'Outros') as manager, SUM(fat) as fat, SUM(qty) as qty
          FROM mv_vendas_mensal
          WHERE mes IN (${chartMesKeys.map(k => `'${k}'`).join(',')})
          GROUP BY mes, COALESCE(manager,'Outros')
        `
      }),

      // 2. Metas (DESAFIO) e Forecast (FCT) do mês
      supabase
        .from('targets')
        .select('manager, target_revenue, target_tons, target_forecast, target_forecast_qty')
        .eq('year', year)
        .eq('month', month)
        .in('manager', KA_MANAGERS),

      // 3. Última projeção semanal (FAT e VOL) para usar como FCT quando não há target_forecast
      supabase
        .from('cm_weekly_projections')
        .select('manager, kpi, projection_value, week_start_date')
        .eq('year', year)
        .eq('month', month)
        .eq('client_matrix', '_TOTAL_')
        .in('manager', KA_MANAGERS)
        .order('week_start_date', { ascending: false }),

      // 4. Comentários dos slides deste gerente/mês
      supabase
        .from('cm_rdm_comments')
        .select('slide_key, comment, updated_at')
        .eq('year', year)
        .eq('month', month)
        .eq('manager', manager),

      // 5. Vendas por família (tipo_produto) — para slide 6 e 7
      supabase.rpc('execute_readonly_query', {
        query_text: `
          SELECT mes, COALESCE(manager,'Outros') as manager,
                 COALESCE(tipo_produto,'Outros') as tipo_produto,
                 SUM(fat) as fat, SUM(qty) as qty
          FROM mv_vendas_mensal
          WHERE mes IN (${familyQueryKeys.map(k => `'${k}'`).join(',')})
          GROUP BY mes, COALESCE(manager,'Outros'), COALESCE(tipo_produto,'Outros')
        `
      }),
    ]);

    if (resSales.error) throw new Error("Erro vendas: " + resSales.error.message);

    const sales       = (resSales.data ?? []) as { mes: string; manager: string; fat: string; qty: string }[];
    const targets     = (resTargets.data ?? []) as { manager: string; target_revenue: string; target_tons: string; target_forecast: string | null; target_forecast_qty: string | null }[];
    const projections = (resProjections.data ?? []) as { manager: string; kpi: string; projection_value: string; week_start_date: string }[];
    const comments    = (resComments.data ?? []) as { slide_key: string; comment: string; updated_at: string }[];
    const salesByFamily = (resSalesByFamily.data ?? []) as { mes: string; manager: string; tipo_produto: string; fat: string; qty: string }[];

    // ── Helper: somar vendas de vários gerentes em vários meses ──
    function sumSales(managers: string[], mesKeys: string[]) {
      return sales
        .filter(s => managers.includes(s.manager) && mesKeys.includes(s.mes))
        .reduce((acc, s) => ({ fat: acc.fat + Number(s.fat), qty: acc.qty + Number(s.qty) }), { fat: 0, qty: 0 });
    }

    // ── Helper: obter meta de um conjunto de gerentes ──
    function getTargetSum(managers: string[]) {
      return managers.reduce((acc, m) => {
        const t = targets.find(t => t.manager === m);
        return {
          revenue: acc.revenue + Number(t?.target_revenue ?? 0),
          tons:    acc.tons    + Number(t?.target_tons    ?? 0),
          fctRev:  acc.fctRev  + Number(t?.target_forecast     ?? 0),
          fctQty:  acc.fctQty  + Number(t?.target_forecast_qty ?? 0),
        };
      }, { revenue: 0, tons: 0, fctRev: 0, fctQty: 0 });
    }

    // ── Helper: última projeção (FCT) para conjunto de gerentes ──
    function getLatestProjection(managers: string[], kpi: string) {
      // Agrupa última projeção por gerente (projections já vêm ordenados desc)
      const seen = new Set<string>();
      let total = 0;
      for (const p of projections) {
        if (p.kpi === kpi && managers.includes(p.manager) && !seen.has(p.manager)) {
          total += Number(p.projection_value);
          seen.add(p.manager);
        }
      }
      return total;
    }

    // ── Calcular dados ──
    const realMonth  = sumSales(targetManagers, [monthKey]);
    const aaMonth    = sumSales(targetManagers, [prevYearMonthKey]);
    const realYtd    = sumSales(targetManagers, ytdKeys);
    const aaYtd      = sumSales(targetManagers, ytdPrevKeys);

    const targetSum  = getTargetSum(targetManagers);

    // FCT: usa target_forecast se preenchido, senão usa última projeção da RPS
    const fctFat = targetSum.fctRev > 0 ? targetSum.fctRev : getLatestProjection(targetManagers, 'FAT');
    const fctVol = targetSum.fctQty > 0 ? targetSum.fctQty : getLatestProjection(targetManagers, 'VOL');

    // YTD FCT: acumulado dos desafios mensais (simplificado: usa só o DESAFIO como proxy de FCT YTD)
    // Para YTD, vamos buscar todos os targets do período e somar
    const [resYtdTargets] = await Promise.all([
      supabase
        .from('targets')
        .select('manager, month, target_revenue, target_tons, target_forecast, target_forecast_qty')
        .eq('year', year)
        .lte('month', month)
        .in('manager', KA_MANAGERS),
    ]);

    const ytdTargets = (resYtdTargets.data ?? []) as { manager: string; month: number; target_revenue: string; target_tons: string; target_forecast: string | null; target_forecast_qty: string | null }[];

    const ytdTargetSum = targetManagers.reduce((acc, m) => {
      const mgrtgts = ytdTargets.filter(t => t.manager === m);
      return {
        revenue: acc.revenue + mgrtgts.reduce((s, t) => s + Number(t.target_revenue ?? 0), 0),
        tons:    acc.tons    + mgrtgts.reduce((s, t) => s + Number(t.target_tons    ?? 0), 0),
        fctRev:  acc.fctRev  + mgrtgts.reduce((s, t) => s + Number(t.target_forecast     ?? 0), 0),
        fctQty:  acc.fctQty  + mgrtgts.reduce((s, t) => s + Number(t.target_forecast_qty ?? 0), 0),
      };
    }, { revenue: 0, tons: 0, fctRev: 0, fctQty: 0 });

    // Pesos dos indicadores (fixo por enquanto)
    const WEIGHTS = { VOL: 34, FAT: 33, INVEST: 33 };

    // Calcular score ponderado do mês (apenas VOL e FAT por enquanto)
    function calcScore(volPct: number, fatPct: number) {
      const total = WEIGHTS.VOL + WEIGHTS.FAT; // 67
      return ((volPct * WEIGHTS.VOL) + (fatPct * WEIGHTS.FAT)) / total;
    }

    const volPctMonth = targetSum.tons > 0 ? (realMonth.qty / targetSum.tons) * 100 : 0;
    const fatPctMonth = targetSum.revenue > 0 ? (realMonth.fat / targetSum.revenue) * 100 : 0;
    const scoreMonth  = calcScore(volPctMonth, fatPctMonth);

    const volPctYtd = ytdTargetSum.tons > 0 ? (realYtd.qty / ytdTargetSum.tons) * 100 : 0;
    const fatPctYtd = ytdTargetSum.revenue > 0 ? (realYtd.fat / ytdTargetSum.revenue) * 100 : 0;
    const scoreYtd  = calcScore(volPctYtd, fatPctYtd);

    // ── Montar resposta ──
    const farolData = {
      managerLabel: manager === CRISTIANO ? "CRISTIANO" : manager,
      weights: WEIGHTS,

      // MAIO (mês selecionado)
      month: {
        vol: {
          aa:      aaMonth.qty,
          fct:     fctVol,
          desafio: targetSum.tons,
          real:    realMonth.qty,
          pct:     volPctMonth,
          delta:   realMonth.qty - fctVol,
        },
        fat: {
          aa:      aaMonth.fat,
          fct:     fctFat,
          desafio: targetSum.revenue,
          real:    realMonth.fat,
          pct:     fatPctMonth,
          delta:   realMonth.fat - fctFat,
        },
        score: scoreMonth,
      },

      // YTD (acumulado Jan → mês selecionado)
      ytd: {
        label: `YTD F${String(year).slice(-2)}`,
        vol: {
          aa:      aaYtd.qty,
          fct:     ytdTargetSum.fctQty > 0 ? ytdTargetSum.fctQty : ytdTargetSum.tons,
          desafio: ytdTargetSum.tons,
          real:    realYtd.qty,
          pct:     volPctYtd,
          delta:   realYtd.qty - (ytdTargetSum.fctQty > 0 ? ytdTargetSum.fctQty : ytdTargetSum.tons),
        },
        fat: {
          aa:      aaYtd.fat,
          fct:     ytdTargetSum.fctRev > 0 ? ytdTargetSum.fctRev : ytdTargetSum.revenue,
          desafio: ytdTargetSum.revenue,
          real:    realYtd.fat,
          pct:     fatPctYtd,
          delta:   realYtd.fat - (ytdTargetSum.fctRev > 0 ? ytdTargetSum.fctRev : ytdTargetSum.revenue),
        },
        score: scoreYtd,
      },
    };

    // ── Mapa de comentários ──
    const commentsMap: Record<string, string> = {};
    for (const c of comments) {
      commentsMap[c.slide_key] = c.comment;
    }

    // ── Dados mensais de faturamento para o gráfico (slide 4) ──
    // Compara: Mês Atual vs. Último Trimestre (média dos 3 meses anteriores no mesmo ano)
    const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    // Helper: fat de um mês específico (pode ser de qualquer ano)
    function getFat(y: number, m: number): number {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      return sales.filter(s => targetManagers.includes(s.manager) && s.mes === key)
                  .reduce((a, s) => a + Number(s.fat), 0);
    }

    function getQty(y: number, m: number): number {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      return sales.filter(s => targetManagers.includes(s.manager) && s.mes === key)
                  .reduce((a, s) => a + Number(s.qty), 0);
    }

    const monthlyFat = MONTH_LABELS.map((label, i) => {
      const m = i + 1;
      const fatCur = getFat(year, m);

      // Média dos 3 meses anteriores (rolling, atravessa virada de ano)
      let trimTotal = 0;
      let trimCount = 0;
      for (let lag = 1; lag <= 3; lag++) {
        let lagM = m - lag;
        let lagY = year;
        if (lagM <= 0) { lagM += 12; lagY = year - 1; }
        const v = getFat(lagY, lagM);
        if (v > 0) { trimTotal += v; trimCount++; }
      }
      const fatUltTrim = trimCount > 0 ? Math.round(trimTotal / trimCount) : 0;

      return { label, m, fatCur, fatUltTrim };
    });

    // Acumulado Jan → mês selecionado
    const acumCur     = monthlyFat.slice(0, month).reduce((a, r) => a + r.fatCur,     0);
    const acumUltTrim = monthlyFat.slice(0, month).reduce((a, r) => a + r.fatUltTrim, 0);

    // Record histórico: maior fatCur em qualquer mês do ano
    const recordFat = Math.max(...monthlyFat.map(r => r.fatCur).filter(v => v > 0), 0);

    // ── Dados mensais de VOLUME para o gráfico (slide 5) ──
    const monthlyVol = MONTH_LABELS.map((label, i) => {
      const m = i + 1;
      const volCur = getQty(year, m);

      let trimTotal = 0;
      let trimCount = 0;
      for (let lag = 1; lag <= 3; lag++) {
        let lagM = m - lag;
        let lagY = year;
        if (lagM <= 0) { lagM += 12; lagY = year - 1; }
        const v = getQty(lagY, lagM);
        if (v > 0) { trimTotal += v; trimCount++; }
      }
      const volUltTrim = trimCount > 0 ? Math.round(trimTotal / trimCount) : 0;

      return { label, m, volCur, volUltTrim };
    });

    const acumVolCur     = monthlyVol.slice(0, month).reduce((a, r) => a + r.volCur,     0);
    const acumVolUltTrim = monthlyVol.slice(0, month).reduce((a, r) => a + r.volUltTrim, 0);
    const recordVol = Math.max(...monthlyVol.map(r => r.volCur).filter(v => v > 0), 0);

    // ── Slide 6: Volume + Preço Médio (13 meses trailing) ──
    // Coletar famílias distintas
    const familiaSet = new Set<string>();
    salesByFamily.forEach(s => {
      if (s.tipo_produto && s.tipo_produto !== 'Outros') familiaSet.add(s.tipo_produto);
    });
    const familias = Array.from(familiaSet).sort();

    // Construir array de 13 meses com vol + preço por família
    const MONTH_SHORT_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const volPreco = trailing13.map(mesKey => {
      const [yStr, mStr] = mesKey.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const label = `${MONTH_SHORT_LABELS[m - 1]}/${String(y).slice(-2)}`;

      // Totais (todas famílias) filtrando pelos gerentes selecionados
      const rows = salesByFamily.filter(s => targetManagers.includes(s.manager) && s.mes === mesKey);
      const totalFat = rows.reduce((a, s) => a + Number(s.fat), 0);
      const totalQty = rows.reduce((a, s) => a + Number(s.qty), 0);
      const preco = totalQty > 0 ? totalFat / totalQty : 0;

      // Por família
      const byFam: Record<string, { fat: number; qty: number; preco: number }> = {};
      familias.forEach(fam => {
        const famRows = rows.filter(s => s.tipo_produto === fam);
        const fFat = famRows.reduce((a, s) => a + Number(s.fat), 0);
        const fQty = famRows.reduce((a, s) => a + Number(s.qty), 0);
        byFam[fam] = { fat: fFat, qty: fQty, preco: fQty > 0 ? fFat / fQty : 0 };
      });

      return { mesKey, label, m, y, vol: totalQty, fat: totalFat, preco, byFam };
    });

    return NextResponse.json({
      success:   true,
      year,
      month,
      manager,
      managers:  KA_MANAGERS,
      farol:     farolData,
      comments:  commentsMap,
      monthlyFat,
      acum: { fatCur: acumCur, fatUltTrim: acumUltTrim },
      recordFat,
      monthlyVol,
      acumVol: { volCur: acumVolCur, volUltTrim: acumVolUltTrim },
      recordVol,
      volPreco,
      familias,

      // ── Slide 7: Preço YoY (Jan..month, cur vs prev) ──
      precoCompare: (() => {
        const MONTH_SHORT_LABELS2 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

        // Helper: preço de um mês específico (total ou por família)
        function getPreco(y: number, m: number, fam?: string) {
          const key = `${y}-${String(m).padStart(2, '0')}`;
          let rows = salesByFamily.filter(s => targetManagers.includes(s.manager) && s.mes === key);
          if (fam) rows = rows.filter(s => s.tipo_produto === fam);
          const fat = rows.reduce((a, s) => a + Number(s.fat), 0);
          const qty = rows.reduce((a, s) => a + Number(s.qty), 0);
          return { fat, qty, preco: qty > 0 ? fat / qty : 0 };
        }

        const months = [];
        let acumCurFat = 0, acumCurQty = 0, acumPrevFat = 0, acumPrevQty = 0;
        const acumByFam: Record<string, { curFat: number; curQty: number; prevFat: number; prevQty: number }> = {};
        familias.forEach(f => { acumByFam[f] = { curFat: 0, curQty: 0, prevFat: 0, prevQty: 0 }; });

        for (let m = 1; m <= month; m++) {
          const cur = getPreco(year, m);
          const prev = getPreco(prevYear, m);
          acumCurFat += cur.fat; acumCurQty += cur.qty;
          acumPrevFat += prev.fat; acumPrevQty += prev.qty;

          const byFam: Record<string, { precoCur: number; precoPrev: number }> = {};
          familias.forEach(f => {
            const fc = getPreco(year, m, f);
            const fp = getPreco(prevYear, m, f);
            acumByFam[f].curFat += fc.fat; acumByFam[f].curQty += fc.qty;
            acumByFam[f].prevFat += fp.fat; acumByFam[f].prevQty += fp.qty;
            byFam[f] = {
              precoCur: fc.preco,
              precoPrev: fp.preco,
            };
          });

          months.push({
            label: MONTH_SHORT_LABELS2[m - 1],
            m,
            precoCur: cur.preco,
            precoPrev: prev.preco,
            byFam,
          });
        }

        // Acumulado
        const acumByFamFinal: Record<string, { precoCur: number; precoPrev: number }> = {};
        familias.forEach(f => {
          const a = acumByFam[f];
          acumByFamFinal[f] = {
            precoCur: a.curQty > 0 ? a.curFat / a.curQty : 0,
            precoPrev: a.prevQty > 0 ? a.prevFat / a.prevQty : 0,
          };
        });

        // Record: maior preço mensal do ano atual
        const allPrecos = months.map(m => m.precoCur).filter(p => p > 0);
        const record = allPrecos.length > 0 ? Math.max(...allPrecos) : 0;

        return {
          months,
          acum: {
            precoCur: acumCurQty > 0 ? acumCurFat / acumCurQty : 0,
            precoPrev: acumPrevQty > 0 ? acumPrevFat / acumPrevQty : 0,
            byFam: acumByFamFinal,
          },
          record,
          prevYear,
          curYear: year,
        };
      })(),

      prevYear,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[RDM API GET]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ─── POST — Salvar comentário ─────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json() as { year: number; month: number; manager: string; slide_key: string; comment: string };
    const { year, month, manager, slide_key, comment } = body;

    if (!year || !month || !manager || !slide_key) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('cm_rdm_comments')
      .upsert(
        { manager, year, month, slide_key, comment: comment ?? '', updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: 'manager,year,month,slide_key' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[RDM API POST]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
