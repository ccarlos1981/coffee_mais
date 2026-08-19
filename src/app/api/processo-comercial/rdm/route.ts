import { NextResponse } from "next/server";
import { OFFICIAL_ANALYTICS_SOURCES, AnalyticsEngine, AnalyticsFilters } from "@/lib/governance/analytics";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getInvestimentoRealizadoOficial } from "@/lib/investimento/getValorTotal";
import { resolveCanonicalManager } from "@/lib/domain/canonical";
import { CommercialDomainService } from "@/lib/domain";
import { getRdmData, getRdmDreAcumuladoData } from "@/lib/dre-gerencial/engine";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getPrevMonthKey(y: number, m: number): string {
  let pm = m - 1;
  let py = y;
  if (pm === 0) { pm = 12; py = y - 1; }
  return `${py}-${String(pm).padStart(2, '0')}`;
}

// Admin client sem cookies (para queries sem RLS restritiva)
function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );
}

import { requireApprovedProfile } from "@/lib/supabase/auth-helpers";
import { isSameManager } from "@/lib/domain/canonical";

// Roles com acesso total ao RDM (enxergam todos os gerentes e configuram % desafio)
const FULL_ACCESS_ROLES = ["Admin", "Admin Master", "CEO", "Gerente Nacional", "Diretor"];
const GERENTE_NACIONAL_EMAILS = ["cristiano@coffeemais.com", "cristiano.santos@coffeemais.com"];

export function checkIsGerenteNacionalAdmin(role?: string | null, email?: string | null): boolean {
  if (role && FULL_ACCESS_ROLES.includes(role)) {
    return true;
  }
  if (email && GERENTE_NACIONAL_EMAILS.includes(email.toLowerCase().trim())) {
    return true;
  }
  return false;
}

// Lista oficial de gerentes KA do Domínio Comercial
const KA_MANAGERS = CommercialDomainService.getFieldManagerList();

// Opção "CRISTIANO" = total de todos os gerentes KA
const CRISTIANO = "CRISTIANO";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1));
    const requestedManager = searchParams.get('manager');

    // Autenticação e Perfil
    const supabaseServer = await createClient();
    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const profile = await requireApprovedProfile(user.id);
    const isFullAccess = checkIsGerenteNacionalAdmin(profile.role, user.email);

    let manager: string;
    let allowedManagers: string[];

    if (isFullAccess) {
      manager = requestedManager ?? CRISTIANO;
      allowedManagers = KA_MANAGERS;
    } else {
      // Perfil restrito (ex: Gerente Regional)
      const userCanonical = resolveCanonicalManager(profile.manager_name || profile.name);
      const userManagerName = userCanonical.managerName;
      
      // Se tentou requisitar outro gerente explicitamente, bloquear no backend com 403 Forbidden
      if (requestedManager && !isSameManager(requestedManager, userManagerName)) {
        return NextResponse.json({
          success: false,
          error: `Acesso negado (403 Forbidden): Você só possui permissão para visualizar os dados da sua própria regional (${userManagerName}).`,
        }, { status: 403 });
      }

      manager = userManagerName;
      allowedManagers = [userManagerName];
    }

    const supabase = getAdminClient();

    // ── Qual(is) gerente(s) filtrar ──
    const targetManagers = manager === CRISTIANO ? KA_MANAGERS : [manager];

    // ── Chaves de período ──
    const monthKey  = `${year}-${String(month).padStart(2, '0')}`;
    const prevMonthKey = getPrevMonthKey(year, month);
    const prevYear  = year - 1;
    const prevYearMonthKey = `${prevYear}-${String(month).padStart(2, '0')}`;

    // Meses acumulados do trimestre (Quarter-to-Date / YTD do trimestre)
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    const ytdKeys: string[] = [];
    const ytdPrevMonthKeys: string[] = [];
    const ytdPrevYearKeys: string[] = [];
    for (let m = quarterStartMonth; m <= month; m++) {
      ytdKeys.push(`${year}-${String(m).padStart(2, '0')}`);
      ytdPrevMonthKeys.push(getPrevMonthKey(year, m));
      ytdPrevYearKeys.push(`${prevYear}-${String(m).padStart(2, '0')}`);
    }

    // ── Queries paralelas ──
    const allMesKeys = [
      monthKey, prevMonthKey, prevYearMonthKey,
      ...ytdKeys, ...ytdPrevMonthKeys, ...ytdPrevYearKeys
    ];
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

    // ── Resolução genérica do filtro de gerente para a DRE Comercial ──
    const resolvedMgr = CommercialDomainService.resolveManager(manager);
    const dreManagerFilter = resolvedMgr.managerId !== "9999" ? resolvedMgr.managerName : null;
    const dreFilters: AnalyticsFilters = {
      startMonth: monthKey,
      endMonth: monthKey,
      manager: dreManagerFilter,
      manager_id: resolvedMgr.managerId !== "9999" ? resolvedMgr.managerId : undefined,
      channel: 'KA',
      dimension: 'rede',
    };

    const [resSales, resTargets, resProjections, resComments, resSalesByFamily, resInvestments, dreData, dreGerencialData, dreGerencialSlideAcumulado] = await Promise.all([
      // 1. Vendas agregadas por mês e gerente (inclui todos os 12 meses dos 2 anos)
      supabase.rpc('execute_readonly_query', {
        query_text: `
          SELECT mes, COALESCE(manager,'Outros') as manager, SUM(fat) as fat, SUM(qty) as qty
          FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL}
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
      supabaseServer
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
          FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL}
          WHERE mes IN (${familyQueryKeys.map(k => `'${k}'`).join(',')})
          GROUP BY mes, COALESCE(manager,'Outros'), COALESCE(tipo_produto,'Outros')
        `
      }),

      // 6. Investimentos realizados por mês e gerente (módulo de investimentos)
      supabase
        .from('v_acoes_investimento_com_gerente')
        .select('gerente_responsavel, mes_referencia, apuracao_valor_realizado, valor_investimento, expectativa_volume, abrangencia, skus_detalhes, familias_detalhes')
        .in('mes_referencia', uniqueMesKeys)
        .eq('is_planejamento', false)
        .is('cancel_reason', null),

      // 7. DRE Comercial Oficial (AnalyticsEngine)
      AnalyticsEngine.getDreComercial(dreFilters).catch((err) => {
        console.error('[RDM API] Erro ao carregar DRE Comercial:', err);
        return null;
      }),

      // 8. DRE Gerencial Oficial Homologado (Slide 1)
      getRdmData({
        ano: year,
        competencia: monthKey,
        gerente: manager === CRISTIANO ? 'KA' : manager,
        canal: 'KA',
      }).catch((err) => {
        console.error('[RDM API] Erro ao carregar DRE Gerencial:', err);
        return null;
      }),

      // 9. DRE Gerencial Acumulado (Trimestres / YTD)
      getRdmDreAcumuladoData(
        year,
        manager === CRISTIANO || manager === "CRISTIANO (Total)" ? 'KA' : manager
      ).catch((err) => {
        console.error('[RDM API] Erro ao carregar DRE Acumulado:', err);
        return null;
      }),
    ]);

    if (resSales.error) throw new Error("Erro vendas: " + resSales.error.message);

    const sales          = (resSales.data ?? []) as { mes: string; manager: string; fat: string; qty: string }[];
    const targets        = (resTargets.data ?? []) as { manager: string; target_revenue: string; target_tons: string; target_forecast: string | null; target_forecast_qty: string | null }[];
    const projections    = (resProjections.data ?? []) as { manager: string; kpi: string; projection_value: string; week_start_date: string }[];
    const comments       = (resComments.data ?? []) as { slide_key: string; comment: string; updated_at: string }[];
    const salesByFamily  = (resSalesByFamily.data ?? []) as { mes: string; manager: string; tipo_produto: string; fat: string; qty: string }[];
    const rawInvestments = (resInvestments.data ?? []) as any[];

    // ── Helper: somar vendas de vários gerentes em vários meses ──
    function sumSales(managers: string[], mesKeys: string[]) {
      const targetCanon = managers.map(m => resolveCanonicalManager(m).canonicalKey);
      return sales
        .filter(s => targetCanon.includes(resolveCanonicalManager(s.manager).canonicalKey) && mesKeys.includes(s.mes))
        .reduce((acc, s) => ({ fat: acc.fat + Number(s.fat), qty: acc.qty + Number(s.qty) }), { fat: 0, qty: 0 });
    }

    // ── Helper: somar investimentos realizados do módulo de investimentos ──
    function sumInvestments(managers: string[], mesKeys: string[]) {
      const targetCanon = managers.map(m => resolveCanonicalManager(m).canonicalKey);
      return rawInvestments
        .filter(inv => {
          const canonMgr = resolveCanonicalManager(inv.gerente_responsavel).canonicalKey;
          return targetCanon.includes(canonMgr) && mesKeys.includes(inv.mes_referencia);
        })
        .reduce((acc, inv) => acc + getInvestimentoRealizadoOficial(inv), 0);
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
    const realMonth   = sumSales(targetManagers, [monthKey]);
    const prevMonth   = sumSales(targetManagers, [prevMonthKey]);
    const aaMonth     = sumSales(targetManagers, [prevYearMonthKey]);

    const realYtd     = sumSales(targetManagers, ytdKeys);
    const prevYtdMonth = sumSales(targetManagers, ytdPrevMonthKeys);
    const aaYtd       = sumSales(targetManagers, ytdPrevYearKeys);

    const targetSum   = getTargetSum(targetManagers);

    // Investimentos realizados (R$)
    const realMonthInvestRs = sumInvestments(targetManagers, [monthKey]);
    const realYtdInvestRs   = sumInvestments(targetManagers, ytdKeys);

    // Percentual de investimento realizado sobre o faturamento (%)
    const realMonthInvestPct = realMonth.fat > 0 ? (realMonthInvestRs / realMonth.fat) * 100 : 0;
    const realYtdInvestPct   = realYtd.fat > 0 ? (realYtdInvestRs / realYtd.fat) * 100 : 0;

    // Desafio fixo = 10,0%
    const investDesafio = 10.0;

    // YTD targets
    const [resYtdTargets] = await Promise.all([
      supabase
        .from('targets')
        .select('manager, month, target_revenue, target_tons, target_forecast, target_forecast_qty')
        .eq('year', year)
        .gte('month', quarterStartMonth)
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

    // Determinar se é a competência especial de Agosto/2026
    const isAgosto2026 = (year === 2026 && month === 8);

    // Função oficial para cálculo de Score Inverso de Despesas Comerciais (Menor é Melhor)
    function calcDespScore(real: number, desafio: number): number {
      if (desafio > 0) {
        return Math.max(0, (2 - (real / desafio)) * 100);
      }
      if (desafio <= 0 && real <= 0) return 100;
      return 0;
    }

    // Pesos dos indicadores
    // Agosto/2026: Faturamento = 50%, MACO = 30%, Despesas Comerciais = 20%, Deflator = -0%
    // Histórico / Outros Meses: Faturamento = 100%, Volume = 0%, Investimento = 0%
    const WEIGHTS = isAgosto2026
      ? { FAT: 50, MACO: 30, DESP_COMERCIAIS: 20, DEFLATOR: 0, VOL: 0, INVEST: 0 }
      : { VOL: 0, FAT: 100, INVEST: 0 };

    // Calcular score ponderado do mês tradicional (100% Faturamento)
    function calcScore(volPct: number, fatPct: number) {
      const total = (WEIGHTS.VOL ?? 0) + (WEIGHTS.FAT ?? 0) + (WEIGHTS.INVEST ?? 0);
      if (total === 0) return 0;
      return (((volPct * (WEIGHTS.VOL ?? 0))) + (fatPct * (WEIGHTS.FAT ?? 0))) / total;
    }

    // Extração dos indicadores oficiais de DRE Gerencial para Agosto/2026
    const dreLinhas = dreGerencialData?.slide1?.linhas || [];
    const dreFatRow = dreLinhas.find(l => l.kpi === 'Faturamento');
    const dreMacoRow = dreLinhas.find(l => l.kpi === 'Margem de Contribuição');

    // Mês - Desafio Oficial de Faturamento e MACO
    const fatDesafioMonth = targetSum.revenue || (dreFatRow?.desafio ?? 0);
    const fatRealMonth = realMonth.fat || (dreFatRow?.actual ?? 0);
    const fatPctMonth = fatDesafioMonth > 0 ? (fatRealMonth / fatDesafioMonth) * 100 : 0;
    const fatDeltaMonth = fatRealMonth - prevMonth.fat;

    const volPctMonth    = targetSum.tons > 0 ? (realMonth.qty / targetSum.tons) * 100 : 0;
    const investPctMonth = investDesafio > 0 ? ((realMonthInvestPct - investDesafio) / investDesafio) * 100 : 0;
    const investDeltaMonth = realMonthInvestPct - investDesafio;

    const macoDesafioMonth = dreMacoRow?.desafio ?? 0;
    const macoRealMonth = dreMacoRow?.actual ?? 0;
    const macoPctMonth = macoDesafioMonth > 0 ? (macoRealMonth / macoDesafioMonth) * 100 : 0;
    const macoDeltaMonth = macoRealMonth - (dreMacoRow?.mesAnterior ?? 0);

    // Despesas Comerciais - Explicitamente Zeradas em Agosto/2026
    const despDesafioMonth = 0;
    const despRealMonth = 0;
    const despPctMonth = 0;
    const despDeltaMonth = 0;

    const scoreMonth = isAgosto2026
      ? (fatPctMonth * 0.50) + (macoPctMonth * 0.30) + (0 * 0.20) + (0 * 0)
      : calcScore(volPctMonth, fatPctMonth);

    // YTD - Trimestre 3 (Julho + Agosto somados)
    const currentQuarter = Math.ceil(month / 3);
    const qTrimestre = dreGerencialSlideAcumulado?.trimestres?.find(t => t.trimestre === currentQuarter);
    const qFatLine = qTrimestre?.linhas?.find(l => l.kpi === 'Faturamento');
    const qMacoLine = qTrimestre?.linhas?.find(l => l.kpi === 'Margem de Contribuição');

    const qFatVal = qFatLine?.valores[`ACUM_Q${currentQuarter}`];
    const qMacoVal = qMacoLine?.valores[`ACUM_Q${currentQuarter}`];

    const ytdFatDesafio = ytdTargetSum.revenue || (qFatVal?.desafio ?? 0);
    const ytdFatReal = realYtd.fat || (qFatVal?.actual ?? 0);
    const ytdFatPct = ytdFatDesafio > 0 ? (ytdFatReal / ytdFatDesafio) * 100 : 0;
    const ytdFatDelta = ytdFatReal - prevYtdMonth.fat;

    const volPctYtd    = ytdTargetSum.tons > 0 ? (realYtd.qty / ytdTargetSum.tons) * 100 : 0;
    const investPctYtd = investDesafio > 0 ? ((realYtdInvestPct - investDesafio) / investDesafio) * 100 : 0;
    const investDeltaYtd = realYtdInvestPct - investDesafio;

    const ytdMacoDesafio = qMacoVal?.desafio ?? 0;
    const ytdMacoReal = qMacoVal?.actual ?? 0;
    const ytdMacoPct = ytdMacoDesafio > 0 ? (ytdMacoReal / ytdMacoDesafio) * 100 : 0;
    const ytdMacoDelta = qMacoVal?.delta ?? (ytdMacoReal - (qMacoVal?.desafio ?? 0));

    const ytdDespDesafio = 0;
    const ytdDespReal = 0;
    const ytdDespPct = 0;
    const ytdDespDelta = 0;

    const scoreYtd = isAgosto2026
      ? (ytdFatPct * 0.50) + (ytdMacoPct * 0.30) + (0 * 0.20) + (0 * 0)
      : calcScore(volPctYtd, ytdFatPct);

    // ── Montar resposta ──
    const farolData = {
      managerLabel: manager === CRISTIANO ? "CRISTIANO" : manager,
      isAgosto2026,
      weights: WEIGHTS,

      // Mês selecionado
      month: {
        vol: {
          aa:      aaMonth.qty,
          mAnt:    prevMonth.qty,
          fct:     prevMonth.qty,
          desafio: targetSum.tons,
          real:    realMonth.qty,
          pct:     volPctMonth,
          delta:   realMonth.qty - prevMonth.qty,
        },
        fat: {
          aa:      aaMonth.fat,
          mAnt:    prevMonth.fat,
          fct:     prevMonth.fat,
          desafio: targetSum.revenue,
          real:    realMonth.fat,
          pct:     fatPctMonth,
          delta:   realMonth.fat - prevMonth.fat,
        },
        invest: {
          aa:      0,
          mAnt:    0,
          fct:     0,
          desafio: investDesafio,
          real:    realMonthInvestPct,
          pct:     investPctMonth,
          delta:   investDeltaMonth,
        },
        maco: {
          aa:      dreMacoRow?.anoAnterior ?? 0,
          mAnt:    dreMacoRow?.mesAnterior ?? 0,
          fct:     dreMacoRow?.mesAnterior ?? 0,
          desafio: macoDesafioMonth,
          real:    macoRealMonth,
          pct:     macoPctMonth,
          delta:   macoDeltaMonth,
        },
        despComerciais: {
          aa:      0,
          mAnt:    0,
          fct:     0,
          desafio: 0,
          real:    0,
          pct:     0,
          delta:   0,
        },
        deflator: {
          aa:      0,
          mAnt:    0,
          fct:     0,
          desafio: 0,
          real:    0,
          pct:     0,
          delta:   0,
        },
        score: scoreMonth,
      },

      // YTD (acumulado do trimestre)
      ytd: {
        label: `YTD F${String(year).slice(-2)}`,
        vol: {
          aa:      aaYtd.qty,
          mAnt:    prevYtdMonth.qty,
          fct:     prevYtdMonth.qty,
          desafio: ytdTargetSum.tons,
          real:    realYtd.qty,
          pct:     volPctYtd,
          delta:   realYtd.qty - prevYtdMonth.qty,
        },
        fat: {
          aa:      aaYtd.fat,
          mAnt:    prevYtdMonth.fat,
          fct:     prevYtdMonth.fat,
          desafio: ytdTargetSum.revenue,
          real:    realYtd.fat,
          pct:     ytdFatPct,
          delta:   ytdFatDelta,
        },
        invest: {
          aa:      0,
          mAnt:    0,
          fct:     0,
          desafio: investDesafio,
          real:    realYtdInvestPct,
          pct:     investPctYtd,
          delta:   investDeltaYtd,
        },
        maco: {
          aa:      0,
          mAnt:    0,
          fct:     0,
          desafio: ytdMacoDesafio,
          real:    ytdMacoReal,
          pct:     ytdMacoPct,
          delta:   ytdMacoDelta,
        },
        despComerciais: {
          aa:      0,
          mAnt:    0,
          fct:     0,
          desafio: ytdDespDesafio,
          real:    ytdDespReal,
          pct:     ytdDespPct,
          delta:   ytdDespDelta,
        },
        deflator: {
          aa:      0,
          mAnt:    0,
          fct:     0,
          desafio: 0,
          real:    0,
          pct:     0,
          delta:   0,
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
      managers:  allowedManagers,
      isRestrictedManager: !isFullAccess,
      canConfigureDesafio: isFullAccess,
      userRole:  profile.role,
      userManager: !isFullAccess ? manager : null,
      farol:     farolData,
      comments:  commentsMap,
      dre:       dreData,
      dreGerencialSlide1: (dreGerencialData as any)?.slide1 || null,
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

      dreGerencialSlideAcumulado,

      prevYear,
    });
  } catch (err: unknown) {
    let message = "Erro desconhecido";
    if (err instanceof Error) {
      message = err.message;
    } else if (err && typeof err === 'object') {
      message = (err as any).message || (err as any).error_description || JSON.stringify(err);
    } else {
      message = String(err);
    }
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

    const profile = await requireApprovedProfile(user.id);
    const isFullAccess = checkIsGerenteNacionalAdmin(profile.role, user.email);

    const body = await request.json() as { year: number; month: number; manager: string; slide_key: string; comment: string };
    const { year, month, manager, slide_key, comment } = body;

    if (!year || !month || !manager || !slide_key) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    if (!isFullAccess) {
      const userCanonical = resolveCanonicalManager(profile.manager_name || profile.name);
      if (!isSameManager(manager, userCanonical.managerName)) {
        return NextResponse.json({
          success: false,
          error: "Acesso negado (403 Forbidden): Você só pode salvar anotações na apresentação da sua própria regional."
        }, { status: 403 });
      }
    }

    const { error } = await supabaseServer
      .from('cm_rdm_comments')
      .upsert(
        { manager, year, month, slide_key, comment: comment ?? '', updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: 'manager,year,month,slide_key' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    let message = "Erro desconhecido";
    if (err instanceof Error) {
      message = err.message;
    } else if (err && typeof err === 'object') {
      message = (err as any).message || (err as any).error_description || JSON.stringify(err);
    } else {
      message = String(err);
    }
    console.error('[RDM API POST]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
