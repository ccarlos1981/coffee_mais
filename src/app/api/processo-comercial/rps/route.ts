import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper para instanciar o cliente Supabase admin real
function getSupabaseAdminClient() {
  return createAdminClient();
}

// Helper para obter as segundas-feiras de um mês (formato YYYY-MM-DD)
function getMondaysOfMonth(year: number, month: number): string[] {
  const mondays: string[] = [];
  const date = new Date(Date.UTC(year, month - 1, 1));
  
  // Encontra a primeira segunda-feira
  while (date.getUTCDay() !== 1) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  
  // Coleta todas as segundas-feiras do mês
  while (date.getUTCMonth() === month - 1) {
    mondays.push(date.toISOString().split('T')[0]);
    date.setUTCDate(date.getUTCDate() + 7);
  }
  
  return mondays;
}

// Roles com acesso total (enxergam todos os gerentes)
const FULL_ACCESS_ROLES = ["Admin", "CEO", "Diretor", "Gerente Nacional"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    // --- Identificar o usuário logado e seu gerente vinculado ---
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "RPS");

    const userRole = profile.role || '';
    const userManagerName = profile.manager_name || null;

    // Definir quais gerentes este usuário pode ver
    const allManagers = ["Julliano", "Leandro", "Luiz"];
    let activeManagers: string[];

    if (userManagerName && !FULL_ACCESS_ROLES.includes(userRole)) {
      // Gerente restrito: vê apenas o seu próprio módulo
      activeManagers = allManagers.filter(m => m === userManagerName);
    } else {
      // Admin/CEO/Diretor/GN: vê todos
      activeManagers = allManagers;
    }

    const supabase = getSupabaseAdminClient();

    // Data de hoje no fuso horário do Brasil para checar semanas futuras
    const todayStr = (() => {
      const d = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(d);
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const dVal = parts.find(p => p.type === 'day')?.value;
      return `${y}-${m}-${dVal}`;
    })();

    // Chaves de período
    const curMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    
    // Cálculo do mês anterior
    const prevMonthYear = month === 1 ? year - 1 : year;
    const prevMonthVal = month === 1 ? 12 : month - 1;
    const prevMonthKey = `${prevMonthYear}-${String(prevMonthVal).padStart(2, '0')}`;

    // Cálculo do ano anterior
    const prevYearYear = year - 1;
    const prevYearKey = `${prevYearYear}-${String(month).padStart(2, '0')}`;

    // Cálculo dos últimos 3 meses fechados para ranking
    const closedMonths = [];
    let tempY = year;
    let tempM = month;
    for (let i = 0; i < 3; i++) {
      tempM--;
      if (tempM === 0) {
        tempM = 12;
        tempY--;
      }
      closedMonths.push(`${tempY}-${String(tempM).padStart(2, '0')}`);
    }
    const [closedMonth1, closedMonth2, closedMonth3] = closedMonths;

    // Obter segundas-feiras do mês
    const mondays = getMondaysOfMonth(year, month);

    // SQL - Faturamento e Volume históricos de gerentes (unificando Leandro Saffi)
    const sqlManagerHistory = `
      SELECT 
        mes,
        CASE WHEN manager = 'Leandro Saffi' THEN 'Leandro' ELSE COALESCE(manager, 'Outros') END as manager,
        SUM(fat) as fat,
        SUM(qty) as qty
      FROM mv_vendas_mensal
      WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}')
      GROUP BY mes, CASE WHEN manager = 'Leandro Saffi' THEN 'Leandro' ELSE COALESCE(manager, 'Outros') END
    `;

    // SQL - Faturamento histórico de clientes (redes/matrizes) (unificando Leandro Saffi e incluindo meses fechados)
    const sqlClientHistory = `
      SELECT 
        mes,
        CASE WHEN manager = 'Leandro Saffi' THEN 'Leandro' ELSE COALESCE(manager, 'Outros') END as manager,
        COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
        SUM(fat) as fat
      FROM mv_vendas_cliente_mensal
      WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}', '${closedMonth2}', '${closedMonth3}')
      GROUP BY mes, CASE WHEN manager = 'Leandro Saffi' THEN 'Leandro' ELSE COALESCE(manager, 'Outros') END, COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    // SQL - Metas (Desafios) dos gerentes
    const sqlManagerTargets = `
      SELECT manager, target_revenue, target_tons
      FROM targets
      WHERE year = ${year} AND month = ${month}
    `;

    // SQL - Investimentos realizados históricos (mês anterior e ano anterior)
    const sqlInvestmentsHistory = `
      SELECT 
        b.manager,
        a.mes_referencia,
        SUM(a.apuracao_valor_realizado) as total_invest
      FROM cm_acoes_investimento a
      JOIN base_atendimento b ON UPPER(a.rede) = UPPER(b.rede)
      WHERE a.mes_referencia IN ('${prevMonthKey}', '${prevYearKey}') AND a.is_planejamento = false
      GROUP BY b.manager, a.mes_referencia
    `;

    // SQL - Projeções semanais gravadas no banco
    const sqlWeeklyProjections = `
      SELECT manager, client_matrix, week_start_date::text as week_start_date, kpi, projection_value
      FROM cm_weekly_projections
      WHERE year = ${year} AND month = ${month}
    `;

    const sqlPrevWeeklyProjections = `
      SELECT manager, client_matrix, week_start_date::text as week_start_date, kpi, projection_value
      FROM cm_weekly_projections
      WHERE year = ${prevMonthYear} AND month = ${prevMonthVal}
    `;

    // Executar consultas via RPC
    const [resMgrHist, resCliHist, resMgrTargets, resInvestHist, resProj, resPrevProj] = await Promise.all([
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerTargets }),
      supabase.rpc('execute_readonly_query', { query_text: sqlInvestmentsHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlWeeklyProjections }),
      supabase.rpc('execute_readonly_query', { query_text: sqlPrevWeeklyProjections }),
    ]);

    if (resMgrHist.error) throw new Error("Erro buscar histórico gerentes: " + resMgrHist.error.message);
    if (resCliHist.error) throw new Error("Erro buscar histórico clientes: " + resCliHist.error.message);
    if (resMgrTargets.error) throw new Error("Erro buscar metas: " + resMgrTargets.error.message);
    if (resInvestHist.error) throw new Error("Erro buscar investimento histórico: " + resInvestHist.error.message);
    if (resProj.error) throw new Error("Erro buscar projeções: " + resProj.error.message);
    if (resPrevProj.error) throw new Error("Erro buscar projeções do mês anterior: " + resPrevProj.error.message);

    const mgrHist = (resMgrHist.data || []) as any[];
    const cliHist = (resCliHist.data || []) as any[];
    const mgrTargets = (resMgrTargets.data || []) as any[];
    const investHist = (resInvestHist.data || []) as any[];
    const dbProjections = (resProj.data || []) as any[];
    const dbPrevProjections = (resPrevProj.data || []) as any[];

    // Estruturar dados consolidados dos gerentes (filtrados por acesso)
    const managersData = activeManagers.map(mName => {
      // Buscar Metas (Desafios)
      const target = mgrTargets.find((t: any) => t.manager === mName);
      const targetFat = Number(target?.target_revenue || 0);
      const targetVol = Number(target?.target_tons || 0);
      const targetInvest = 10.0; // Padrão 10.0% conforme fotos

      // Buscar Históricos Gerente
      const curHist = mgrHist.find((h: any) => h.manager === mName && h.mes === curMonthKey);
      const pmHist = mgrHist.find((h: any) => h.manager === mName && h.mes === prevMonthKey);
      const pyHist = mgrHist.find((h: any) => h.manager === mName && h.mes === prevYearKey);

      // Buscar Investimento Histórico Realizado
      const pmInvest = investHist.find((i: any) => i.manager === mName && i.mes_referencia === prevMonthKey);
      const pyInvest = investHist.find((i: any) => i.manager === mName && i.mes_referencia === prevYearKey);

      const pmInvestVal = Number(pmInvest?.total_invest || 0);
      const pyInvestVal = Number(pyInvest?.total_invest || 0);

      const pmFatVal = Number(pmHist?.fat || 0);
      const pyFatVal = Number(pyHist?.fat || 0);

      // Calcular % Investimento Histórico Realizado (Investimento / Faturamento)
      const pmInvestPct = pmFatVal > 0 ? (pmInvestVal / pmFatVal) * 100 : 0;
      const pyInvestPct = pyFatVal > 0 ? (pyInvestVal / pyFatVal) * 100 : 10.0; // Fallback para 10%

      // --- CÁLCULO DAS PROJEÇÕES DO MÊS ANTERIOR (DISPERSÃO) ---
      const prevMondays = getMondaysOfMonth(prevMonthYear, prevMonthVal);
      const prevManagerProjs = dbPrevProjections.filter((p: any) => p.manager === mName);

      // Volume (VOL) do mês anterior (procura a última projeção não-zero)
      const prevVolWeekly = prevMondays.map(date => {
        const p = prevManagerProjs.find((p: any) => p.client_matrix === '_TOTAL_' && p.week_start_date === date && p.kpi === 'VOL');
        return p ? Number(p.projection_value) : 0;
      });
      const prevVolProj = prevVolWeekly.length > 0
        ? (prevVolWeekly.slice().reverse().find(v => v !== 0) || prevVolWeekly[prevVolWeekly.length - 1] || 0)
        : 0;

      // Investimento (INVEST) do mês anterior
      const prevInvestWeekly = prevMondays.map(date => {
        const p = prevManagerProjs.find((p: any) => p.client_matrix === '_TOTAL_' && p.week_start_date === date && p.kpi === 'INVEST');
        return p ? Number(p.projection_value) : 0;
      });
      const prevInvestProj = prevInvestWeekly.length > 0 ? (prevInvestWeekly.slice().reverse().find(v => v !== 0) || prevInvestWeekly[prevInvestWeekly.length - 1] || 0) : 0;

      // Faturamento (FAT) do mês anterior (procura a última projeção não-zero)
      const prevFatWeekly = prevMondays.map(date => {
        const totalP = prevManagerProjs.find((p: any) => p.client_matrix === '_TOTAL_' && p.week_start_date === date && p.kpi === 'FAT');
        return totalP ? Number(totalP.projection_value) : 0;
      });
      const prevFatProj = prevFatWeekly.length > 0
        ? (prevFatWeekly.slice().reverse().find(v => v !== 0) || prevFatWeekly[prevFatWeekly.length - 1] || 0)
        : 0;

      // Projeções gravadas para este gerente
      const managerProjs = dbProjections.filter((p: any) => p.manager === mName && p.client_matrix === '_TOTAL_');

      // KPIs estruturados para o gerente
      const kpis = {
        VOL: {
          ano_a: Number(pyHist?.qty || 0),
          mes_a: Number(pmHist?.qty || 0),
          desafio: targetVol,
          prev_month_projection: prevVolProj,
          projections: mondays.map(date => {
            if (date > todayStr) return 0;
            const p = managerProjs.find((p: any) => p.week_start_date === date && p.kpi === 'VOL');
            return p ? Number(p.projection_value) : targetVol;
          })
        },
        FAT: {
          ano_a: pyFatVal,
          mes_a: pmFatVal,
          desafio: targetFat,
          prev_month_projection: prevFatProj,
          projections: mondays.map(date => {
            if (date > todayStr) return 0;
            const p = managerProjs.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            return p ? Number(p.projection_value) : 0;
          })
        },
        INVEST: {
          ano_a: pyInvestPct,
          mes_a: pmInvestPct,
          desafio: targetInvest,
          prev_month_projection: prevInvestProj,
          projections: mondays.map(date => {
            if (date > todayStr) return 0;
            const p = managerProjs.find((p: any) => p.week_start_date === date && p.kpi === 'INVEST');
            return p ? Number(p.projection_value) : targetInvest;
          })
        }
      };

      // --- PROCESSAR CLIENTES (REDES/MATRIZES) DO GERENTE ---
      // Filtrar histórico de clientes para este gerente
      const managerCliHist = cliHist.filter((c: any) => c.manager === mName);
      
      // Obter lista única de clientes
      const allClientNames = Array.from(new Set(managerCliHist.map((c: any) => c.client)));
      
      // Mapear faturamento acumulado por cliente nos últimos 3 meses fechados para ranqueamento
      const clientSalesSummary = allClientNames.map(cName => {
        const salesC1 = managerCliHist.filter((c: any) => c.client === cName && c.mes === closedMonth1);
        const salesC2 = managerCliHist.filter((c: any) => c.client === cName && c.mes === closedMonth2);
        const salesC3 = managerCliHist.filter((c: any) => c.client === cName && c.mes === closedMonth3);

        const fatC1 = salesC1.reduce((acc, s) => acc + s.fat, 0);
        const fatC2 = salesC2.reduce((acc, s) => acc + s.fat, 0);
        const fatC3 = salesC3.reduce((acc, s) => acc + s.fat, 0);

        const rankingFat = fatC1 + fatC2 + fatC3;

        const curSales = managerCliHist.find((c: any) => c.client === cName && c.mes === curMonthKey);
        const pmSales = managerCliHist.find((c: any) => c.client === cName && c.mes === prevMonthKey);
        const pySales = managerCliHist.find((c: any) => c.client === cName && c.mes === prevYearKey);

        const fatCur = Number(curSales?.fat || 0);
        const fatPm = Number(pmSales?.fat || 0);
        const fatPy = Number(pySales?.fat || 0);

        return {
          clientName: cName,
          fatCur,
          fatPm,
          fatPy,
          rankingFat
        };
      });

      // Ordenar e separar os Top 10 e o restante sob "OUTROS" por rankingFat decrescente
      clientSalesSummary.sort((a, b) => b.rankingFat - a.rankingFat);
      
      const topClientsSummary = clientSalesSummary.slice(0, 10);
      const otherClientsSummary = clientSalesSummary.slice(10);

      // Buscar projeções existentes para os clientes deste gerente
      const clientProjs = dbProjections.filter((p: any) => p.manager === mName && p.client_matrix !== '_TOTAL_');

      // Montar a lista final de clientes com seus valores estruturados
      const clientsList = topClientsSummary.map(cli => {
        const cProj = clientProjs.filter((p: any) => p.client_matrix === cli.clientName);
        
        // Carrega a meta customizada gravada, se não houver, calcula uma meta proporcional baseada no faturamento
        const metaProj = cProj.find((p: any) => p.kpi === 'META');
        const defaultMeta = targetFat > 0 ? (cli.fatPm / pmFatVal) * targetFat : 0;
        const metaValue = metaProj ? Number(metaProj.projection_value) : (cli.fatPm > 0 ? cli.fatPm : defaultMeta);

        // Projeção do mês anterior para este cliente (procura a última projeção não-zero do mês anterior)
        const clientPrevProjs = prevManagerProjs.filter((p: any) => p.client_matrix === cli.clientName && p.kpi === 'FAT');
        const prevCliFatWeekly = prevMondays.map(date => {
          const p = clientPrevProjs.find((p: any) => p.week_start_date === date);
          return p ? Number(p.projection_value) : 0;
        });
        const prevCliFatProj = prevCliFatWeekly.length > 0
          ? (prevCliFatWeekly.slice().reverse().find(v => v !== 0) || prevCliFatWeekly[prevCliFatWeekly.length - 1] || 0)
          : 0;

        return {
          client: cli.clientName,
          ano_a: cli.fatPy,
          mes_a: cli.fatPm,
          meta: metaValue,
          prev_month_projection: prevCliFatProj,
          projections: mondays.map(date => {
            if (date > todayStr) return 0;
            const p = cProj.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            return p ? Number(p.projection_value) : metaValue;
          })
        };
      });

      // Agrupar "OUTROS"
      if (otherClientsSummary.length > 0) {
        const cProj = clientProjs.filter((p: any) => p.client_matrix === 'OUTROS');
        
        const sumAnoA = otherClientsSummary.reduce((acc, c) => acc + c.fatPy, 0);
        const sumMesA = otherClientsSummary.reduce((acc, c) => acc + c.fatPm, 0);
        
        const metaProj = cProj.find((p: any) => p.kpi === 'META');
        const defaultMeta = Math.max(0, targetFat - clientsList.reduce((acc, c) => acc + c.meta, 0));
        const metaValue = metaProj ? Number(metaProj.projection_value) : defaultMeta;

        // Projeção do mês anterior para "OUTROS" (procura a última projeção não-zero do mês anterior)
        const otherPrevProjs = prevManagerProjs.filter((p: any) => p.client_matrix === 'OUTROS' && p.kpi === 'FAT');
        const prevOtherFatWeekly = prevMondays.map(date => {
          const p = otherPrevProjs.find((p: any) => p.week_start_date === date);
          return p ? Number(p.projection_value) : 0;
        });
        const prevOtherFatProj = prevOtherFatWeekly.length > 0
          ? (prevOtherFatWeekly.slice().reverse().find(v => v !== 0) || prevOtherFatWeekly[prevOtherFatWeekly.length - 1] || 0)
          : 0;

        clientsList.push({
          client: "OUTROS",
          ano_a: sumAnoA,
          mes_a: sumMesA,
          meta: metaValue,
          prev_month_projection: prevOtherFatProj,
          projections: mondays.map(date => {
            if (date > todayStr) return 0;
            const p = cProj.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            return p ? Number(p.projection_value) : metaValue;
          })
        });
      } else {
        // Adicionar linha de "OUTROS" zerada caso não existam outros clientes, apenas para manter a consistência do layout
        const cProj = clientProjs.filter((p: any) => p.client_matrix === 'OUTROS');
        const metaProj = cProj.find((p: any) => p.kpi === 'META');
        const metaValue = metaProj ? Number(metaProj.projection_value) : 0;

        // Projeção do mês anterior para "OUTROS" (procura a última projeção não-zero do mês anterior)
        const otherPrevProjs = prevManagerProjs.filter((p: any) => p.client_matrix === 'OUTROS' && p.kpi === 'FAT');
        const prevOtherFatWeekly = prevMondays.map(date => {
          const p = otherPrevProjs.find((p: any) => p.week_start_date === date);
          return p ? Number(p.projection_value) : 0;
        });
        const prevOtherFatProj = prevOtherFatWeekly.length > 0
          ? (prevOtherFatWeekly.slice().reverse().find(v => v !== 0) || prevOtherFatWeekly[prevOtherFatWeekly.length - 1] || 0)
          : 0;

        clientsList.push({
          client: "OUTROS",
          ano_a: 0,
          mes_a: 0,
          meta: metaValue,
          prev_month_projection: prevOtherFatProj,
          projections: mondays.map(date => {
            if (date > todayStr) return 0;
            const p = cProj.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            return p ? Number(p.projection_value) : metaValue;
          })
        });
      }

      // A projeção de FAT do gerente é mantida como o valor próprio do gerente (totalmente independente das redes).

      return {
        manager: mName,
        kpis,
        clients: clientsList
      };
    });

    return NextResponse.json({
      success: true,
      year,
      month,
      mondays,
      managers: managersData,
      // Indica se este usuário está restrito a um único gerente
      restrictedToManager: (userManagerName && !FULL_ACCESS_ROLES.includes(userRole)) ? userManagerName : null
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "RPS");

    const userRole = profile.role || '';
    const userManagerName = profile.manager_name || null;
    const isRestricted = userManagerName && !FULL_ACCESS_ROLES.includes(userRole);

    const body = await request.json();
    const { year, month, projections } = body;

    if (!year || !month || !projections || !Array.isArray(projections)) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos ou incompletos." }, { status: 400 });
    }

    // Se restrito, filtrar apenas projeções do seu gerente
    let filteredProjections = projections;
    if (isRestricted) {
      filteredProjections = projections.filter((p: any) => p.manager === userManagerName);
    }

    const supabase = getSupabaseAdminClient();

    // Mapeia as projeções no formato esperado pelo banco
    const rowsToUpsert = filteredProjections.map((p: any) => ({
      manager: p.manager,
      client_matrix: p.client_matrix,
      year: parseInt(year),
      month: parseInt(month),
      week_start_date: p.week_start_date,
      kpi: p.kpi,
      projection_value: Number(p.projection_value),
      updated_at: new Date().toISOString()
    }));

    // Realizar upsert
    const { error } = await supabase
      .from('cm_weekly_projections')
      .upsert(rowsToUpsert, { onConflict: 'manager,client_matrix,year,month,week_start_date,kpi' });

    if (error) throw error;

    return NextResponse.json({ success: true, count: rowsToUpsert.length });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
