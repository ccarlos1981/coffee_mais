import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper para instanciar o cliente Supabase admin (sem cookies)
function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
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
    const supabaseServer = await createClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Buscar perfil do usuário para obter manager_name e role
    const { data: profile } = await supabaseServer
      .from('cm_user_profiles')
      .select('role, manager_name')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role || '';
    const userManagerName = profile?.manager_name || null;

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

    // Obter segundas-feiras do mês
    const mondays = getMondaysOfMonth(year, month);

    // SQL - Faturamento e Volume históricos de gerentes
    const sqlManagerHistory = `
      SELECT 
        mes,
        COALESCE(manager, 'Outros') as manager,
        SUM(fat) as fat,
        SUM(qty) as qty
      FROM mv_vendas_mensal
      WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}')
      GROUP BY mes, COALESCE(manager, 'Outros')
    `;

    // SQL - Faturamento histórico de clientes (redes/matrizes)
    const sqlClientHistory = `
      SELECT 
        mes,
        COALESCE(manager, 'Outros') as manager,
        COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
        SUM(fat) as fat
      FROM mv_vendas_cliente_mensal
      WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}')
      GROUP BY mes, COALESCE(manager, 'Outros'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
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

    // Executar consultas via RPC
    const [resMgrHist, resCliHist, resMgrTargets, resInvestHist, resProj] = await Promise.all([
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerTargets }),
      supabase.rpc('execute_readonly_query', { query_text: sqlInvestmentsHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlWeeklyProjections }),
    ]);

    if (resMgrHist.error) throw new Error("Erro buscar histórico gerentes: " + resMgrHist.error.message);
    if (resCliHist.error) throw new Error("Erro buscar histórico clientes: " + resCliHist.error.message);
    if (resMgrTargets.error) throw new Error("Erro buscar metas: " + resMgrTargets.error.message);
    if (resInvestHist.error) throw new Error("Erro buscar investimento histórico: " + resInvestHist.error.message);
    if (resProj.error) throw new Error("Erro buscar projeções: " + resProj.error.message);

    const mgrHist = (resMgrHist.data || []) as any[];
    const cliHist = (resCliHist.data || []) as any[];
    const mgrTargets = (resMgrTargets.data || []) as any[];
    const investHist = (resInvestHist.data || []) as any[];
    const dbProjections = (resProj.data || []) as any[];

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

      // Projeções gravadas para este gerente
      const managerProjs = dbProjections.filter((p: any) => p.manager === mName && p.client_matrix === '_TOTAL_');

      // KPIs estruturados para o gerente
      const kpis = {
        VOL: {
          ano_a: Number(pyHist?.qty || 0),
          mes_a: Number(pmHist?.qty || 0),
          desafio: targetVol,
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
          projections: mondays.map(() => 0) // Será calculado como a soma das projeções dos clientes
        },
        INVEST: {
          ano_a: pyInvestPct,
          mes_a: pmInvestPct,
          desafio: targetInvest,
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
      
      // Mapear faturamento máximo por cliente nas três referências para ranqueamento
      const clientSalesSummary = allClientNames.map(cName => {
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
          maxFat: Math.max(fatCur, fatPm, fatPy)
        };
      });

      // Ordenar e separar os Top 5 e o restante sob "OUTROS"
      clientSalesSummary.sort((a, b) => b.maxFat - a.maxFat);
      
      const topClientsSummary = clientSalesSummary.slice(0, 5);
      const otherClientsSummary = clientSalesSummary.slice(5);

      // Buscar projeções existentes para os clientes deste gerente
      const clientProjs = dbProjections.filter((p: any) => p.manager === mName && p.client_matrix !== '_TOTAL_');

      // Montar a lista final de clientes com seus valores estruturados
      const clientsList = topClientsSummary.map(cli => {
        const cProj = clientProjs.filter((p: any) => p.client_matrix === cli.clientName);
        
        // Carrega a meta customizada gravada, se não houver, calcula uma meta proporcional baseada no faturamento
        const metaProj = cProj.find((p: any) => p.kpi === 'META');
        const defaultMeta = targetFat > 0 ? (cli.fatPm / pmFatVal) * targetFat : 0;
        const metaValue = metaProj ? Number(metaProj.projection_value) : (cli.fatPm > 0 ? cli.fatPm : defaultMeta);

        return {
          client: cli.clientName,
          ano_a: cli.fatPy,
          mes_a: cli.fatPm,
          meta: metaValue,
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

        clientsList.push({
          client: "OUTROS",
          ano_a: sumAnoA,
          mes_a: sumMesA,
          meta: metaValue,
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

        clientsList.push({
          client: "OUTROS",
          ano_a: 0,
          mes_a: 0,
          meta: metaValue,
          projections: mondays.map(date => {
            if (date > todayStr) return 0;
            const p = cProj.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            return p ? Number(p.projection_value) : metaValue;
          })
        });
      }

      // Agora calculamos a projeção de FAT do gerente como a soma das projeções dos clientes
      mondays.forEach((_, wIdx) => {
        kpis.FAT.projections[wIdx] = clientsList.reduce((acc, c) => acc + c.projections[wIdx], 0);
      });

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[RPS API GET] Erro:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const supabaseServer = await createClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { year, month, projections } = body;

    if (!year || !month || !projections || !Array.isArray(projections)) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos ou incompletos." }, { status: 400 });
    }

    // Verificar se o usuário tem permissão para salvar as projeções enviadas
    const { data: profile } = await supabaseServer
      .from('cm_user_profiles')
      .select('role, manager_name')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role || '';
    const userManagerName = profile?.manager_name || null;
    const isRestricted = userManagerName && !FULL_ACCESS_ROLES.includes(userRole);

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[RPS API POST] Erro:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
