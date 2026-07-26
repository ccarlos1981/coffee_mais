import { NextRequest, NextResponse } from 'next/server';
import { OFFICIAL_ANALYTICS_SOURCES } from "@/lib/governance/analytics";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError, logAuditAction } from "@/lib/supabase/auth-helpers";
import { resolveCanonicalManager, isSameManager } from "@/lib/domain/canonical";
import { resolveSupabaseTableName } from '@/lib/governance/analytics/sources';
import { getInvestimentoRealizadoOficial } from '@/lib/investimento/getValorTotal';

export const runtime = 'nodejs';

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

// Helper interno para consolidar projeções semanais por identidade canônica de gerente
function consolidateProjectionsByCanonicalManager(rawProjections: any[]): any[] {
  const map = new Map<string, any>();
  rawProjections.forEach((p: any) => {
    const canonicalName = resolveCanonicalManager(p.manager).managerName;
    const clientMatrixKey = (p.client_matrix || '').trim().toUpperCase();
    const key = `${canonicalName}|${clientMatrixKey}|${p.week_start_date}|${p.kpi}`;

    if (!map.has(key)) {
      map.set(key, { ...p, manager: canonicalName });
    } else {
      const existing = map.get(key);
      if (Number(p.projection_value) > 0 && Number(existing.projection_value) === 0) {
        map.set(key, { ...p, manager: canonicalName });
      }
    }
  });
  return Array.from(map.values());
}

// Roles com acesso total (enxergam todos os gerentes)
const FULL_ACCESS_ROLES = ["Admin", "CEO", "Diretor", "Gerente Nacional", "Admin Master"];
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
    const userEmail = (user.email || '').toLowerCase().trim();

    const isGerenteNacionalAdmin = checkIsGerenteNacionalAdmin(userRole, userEmail);

    // Definir quais gerentes este usuário pode ver
    const allManagers = ["Julliano", "Leandro", "Luiz"];
    let activeManagers: string[];

    if (isGerenteNacionalAdmin || !userManagerName) {
      activeManagers = allManagers;
    } else {
      activeManagers = allManagers.filter(m => isSameManager(m, userManagerName));
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
    const closedMonths: string[] = [];
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

    // SQL - Faturamento e Volume históricos de gerentes
    const sqlManagerHistory = `
      SELECT 
        mes,
        manager,
        SUM(fat) as fat,
        SUM(qty) as qty
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL}
      WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}')
      GROUP BY mes, manager
    `;

    // SQL - Faturamento histórico de REDES COMERCIAIS
    const sqlClientHistory = `
      SELECT 
        mes,
        manager,
        TRIM(rede) as client,
        SUM(fat) as fat
      FROM ${OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL}
      WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}', '${closedMonth2}', '${closedMonth3}')
        AND rede IS NOT NULL AND TRIM(rede) != ''
      GROUP BY mes, manager, TRIM(rede)
    `;

    // SQL - CAMADA OFICIAL DE DOMÍNIO: Redes Comerciais Planejáveis do Coffee++
    const sqlBaseClients = `
      SELECT 
        manager,
        manager_id,
        TRIM(rede) as client
      FROM vw_redes_planejaveis_oficiais
      WHERE is_rede_planejavel = TRUE
    `;

    // SQL - Metas Oficiais dos gerentes (SSOT: public.targets)
    const sqlManagerTargets = `
      SELECT manager, manager_id, target_revenue, target_tons
      FROM targets
      WHERE year = ${year} AND month = ${month}
    `;

    // SQL - Origem oficial de ações de investimentos (Single Source of Truth, cardinalidade 1:1)
    const sqlInvestmentsHistory = `
      SELECT 
        gerente_responsavel as manager,
        mes_referencia,
        apuracao_valor_realizado,
        valor_investimento,
        expectativa_volume,
        abrangencia,
        skus_detalhes,
        familias_detalhes
      FROM v_acoes_investimento_com_gerente
      WHERE mes_referencia IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}')
        AND is_planejamento = false
        AND cancel_reason IS NULL
    `;

    // SQL - Projeções semanais gravadas no banco (cm_weekly_projections)
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

    // Executar consultas via RPC (Sem N+1, buscando todos em consultas únicas em paralelo)
    const [resMgrHist, resCliHist, resBaseCli, resMgrTargets, resInvestHist, resProj, resPrevProj] = await Promise.all([
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlBaseClients }),
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerTargets }),
      supabase.rpc('execute_readonly_query', { query_text: sqlInvestmentsHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlWeeklyProjections }),
      supabase.rpc('execute_readonly_query', { query_text: sqlPrevWeeklyProjections }),
    ]);

    if (resMgrHist.error) throw new Error("Erro buscar histórico gerentes: " + resMgrHist.error.message);
    if (resCliHist.error) throw new Error("Erro buscar histórico clientes: " + resCliHist.error.message);
    if (resBaseCli.error) throw new Error("Erro buscar base clientes: " + resBaseCli.error.message);
    if (resMgrTargets.error) throw new Error("Erro buscar metas: " + resMgrTargets.error.message);
    if (resInvestHist.error) throw new Error("Erro buscar investimento histórico: " + resInvestHist.error.message);
    if (resProj.error) throw new Error("Erro buscar projeções: " + resProj.error.message);
    if (resPrevProj.error) throw new Error("Erro buscar projeções do mês anterior: " + resPrevProj.error.message);

    const mgrHist = (resMgrHist.data || []) as any[];
    const cliHist = (resCliHist.data || []) as any[];
    const baseCli = (resBaseCli.data || []) as any[];
    const mgrTargets = (resMgrTargets.data || []) as any[];
    
    // Processamento Typescript SSOT: Calcular valor total e agrupar
    const rawInvests = (resInvestHist.data || []) as any[];
    const investHistMap: Record<string, number> = {};
    rawInvests.forEach(acao => {
      const key = `${acao.manager}|${acao.mes_referencia}`;
      if (!investHistMap[key]) investHistMap[key] = 0;
      investHistMap[key] += getInvestimentoRealizadoOficial(acao);
    });
    
    const investHist = Object.keys(investHistMap).map(key => {
      const [manager, mes_referencia] = key.split('|');
      return { manager, mes_referencia, total_invest: investHistMap[key] };
    });

    
    // Consolidar projeções brutas pela identidade canônica antes da montagem de managerProjs
    const dbProjections = consolidateProjectionsByCanonicalManager((resProj.data || []) as any[]);
    const dbPrevProjections = consolidateProjectionsByCanonicalManager((resPrevProj.data || []) as any[]);

    // Estruturar dados consolidados dos gerentes (filtrados por acesso)
    const managersData = activeManagers.map(mName => {
      const canonicalTargetMgr = resolveCanonicalManager(mName);

      // SSOT: Buscar Metas (Desafios) exclusivamente da tabela public.targets
      const target = mgrTargets.find((t: any) => {
        return isSameManager(t.manager, mName) || (t.manager_id && t.manager_id === canonicalTargetMgr.managerId);
      });

      const targetFat = Number(target?.target_revenue || 0);
      const targetVol = Number(target?.target_tons || 0);
      const targetInvest = 10.0; // Padrão 10.0%

      // Buscar Históricos Gerente unificados via isSameManager
      const curHist = mgrHist.filter((h: any) => isSameManager(h.manager, mName) && h.mes === curMonthKey);
      const pmHist = mgrHist.filter((h: any) => isSameManager(h.manager, mName) && h.mes === prevMonthKey);
      const pyHist = mgrHist.filter((h: any) => isSameManager(h.manager, mName) && h.mes === prevYearKey);

      const curFatVal = curHist.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);
      const pmFatVal = pmHist.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);
      const pyFatVal = pyHist.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);
      const curQtyVal = curHist.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);
      const pmQtyVal = pmHist.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);
      const pyQtyVal = pyHist.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);

      // Buscar Investimento Histórico Realizado
      const curInvest = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === curMonthKey);
      const pmInvest = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === prevMonthKey);
      const pyInvest = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === prevYearKey);

      const curInvestVal = curInvest.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);
      const pmInvestVal = pmInvest.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);
      const pyInvestVal = pyInvest.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);

      const curInvestPct = curFatVal > 0 ? (curInvestVal / curFatVal) * 100 : 0;
      const pmInvestPct = pmFatVal > 0 ? (pmInvestVal / pmFatVal) * 100 : 0;
      const pyInvestPct = pyFatVal > 0 ? (pyInvestVal / pyFatVal) * 100 : 10.0;

      // Projeções do mês anterior (DISPERSÃO)
      const prevMondays = getMondaysOfMonth(prevMonthYear, prevMonthVal);
      const prevManagerProjs = dbPrevProjections.filter((p: any) => isSameManager(p.manager, mName));

      const prevVolWeekly = prevMondays.map(date => {
        const p = prevManagerProjs.find((p: any) => p.client_matrix === '_TOTAL_' && p.week_start_date === date && p.kpi === 'VOL');
        return p ? Number(p.projection_value) : 0;
      });
      const prevVolProj = prevVolWeekly.length > 0
        ? (prevVolWeekly.slice().reverse().find(v => v !== 0) || prevVolWeekly[prevVolWeekly.length - 1] || 0)
        : 0;

      const prevInvestWeekly = prevMondays.map(date => {
        const p = prevManagerProjs.find((p: any) => p.client_matrix === '_TOTAL_' && p.week_start_date === date && p.kpi === 'INVEST');
        return p ? Number(p.projection_value) : 0;
      });
      const prevInvestProj = prevInvestWeekly.length > 0 ? (prevInvestWeekly.slice().reverse().find(v => v !== 0) || prevInvestWeekly[prevInvestWeekly.length - 1] || 0) : 0;

      const prevFatWeekly = prevMondays.map(date => {
        const totalP = prevManagerProjs.find((p: any) => p.client_matrix === '_TOTAL_' && p.week_start_date === date && p.kpi === 'FAT');
        return totalP ? Number(totalP.projection_value) : 0;
      });
      const prevFatProj = prevFatWeekly.length > 0
        ? (prevFatWeekly.slice().reverse().find(v => v !== 0) || prevFatWeekly[prevFatWeekly.length - 1] || 0)
        : 0;

      // Projeções semanais gravadas para este gerente em cm_weekly_projections
      const managerProjs = dbProjections.filter((p: any) => isSameManager(p.manager, mName) && p.client_matrix === '_TOTAL_');

      // REGRA MANTIDA: DESAFIO_VOL e DESAFIO_FAT vêm EXCLUSIVAMENTE da fonte oficial public.targets (SSOT)
      const desafioVol = targetVol;
      const desafioFat = targetFat;

      // DESAFIO_INVEST pode consultar cm_weekly_projections para personalização visual ou manter o padrão
      const customDesafioInvest = managerProjs.find((p: any) => p.kpi === 'DESAFIO_INVEST');
      const desafioInvest = customDesafioInvest ? Number(customDesafioInvest.projection_value) : targetInvest;

      // KPIs estruturados para o gerente
      const kpis = {
        VOL: {
          ano_a: pyQtyVal,
          mes_a: pmQtyVal,
          desafio: desafioVol,
          real: curQtyVal,
          prev_month_projection: prevVolProj,
          projections: mondays.map(date => {
            const p = managerProjs.find((p: any) => p.week_start_date === date && p.kpi === 'VOL');
            if (p) return Number(p.projection_value);
            return date > todayStr ? 0 : desafioVol;
          })
        },
        FAT: {
          ano_a: pyFatVal,
          mes_a: pmFatVal,
          desafio: desafioFat,
          real: curFatVal,
          prev_month_projection: prevFatProj,
          projections: mondays.map(date => {
            const p = managerProjs.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            if (p) return Number(p.projection_value);
            return 0;
          })
        },
        INVEST: {
          ano_a: pyInvestPct,
          mes_a: pmInvestPct,
          desafio: desafioInvest,
          real: curInvestPct,
          prev_month_projection: prevInvestProj,
          projections: mondays.map(date => {
            const p = managerProjs.find((p: any) => p.week_start_date === date && p.kpi === 'INVEST');
            if (p) return Number(p.projection_value);
            return date > todayStr ? 0 : desafioInvest;
          })
        }
      };

      // --- CAMADA OFICIAL DE DOMÍNIO: REDES COMERCIAIS PLANEJÁVEIS VIA VW_REDES_PLANEJAVEIS_OFICIAIS ---
      const managerBaseCli = baseCli.filter((b: any) => isSameManager(b.manager, mName) || isSameManager(b.manager_id, mName));
      const managerCliHist = cliHist.filter((c: any) => isSameManager(c.manager, mName));
      const clientProjs = dbProjections.filter((p: any) => isSameManager(p.manager, mName) && p.client_matrix !== '_TOTAL_');

      // Conjunto de redes pertencentes EXCLUSIVAMENTE à camada oficial de redes planejáveis
      const redeSet = new Set<string>(
        managerBaseCli.map((b: any) => b.client)
      );

      // Remover desmapeados e a linha especial de agrupamento OUTROS
      redeSet.delete('');
      redeSet.delete('Não Mapeado');
      redeSet.delete('OUTROS');

      // Ordenar redes comerciais pelo Ranking Oficial Comercial: Rolling 3M FAT (Maior -> Menor), desempate por nome
      const redeRollingMap = new Map<string, number>();
      Array.from(redeSet).forEach(cName => {
        const r3m = managerCliHist
          .filter((c: any) => c.client === cName && closedMonths.includes(c.mes))
          .reduce((acc: number, c: any) => acc + Number(c.fat || 0), 0);
        redeRollingMap.set(cName, r3m);
      });

      const sortedRedeNames = Array.from(redeSet).sort((a, b) => {
        const fatA = redeRollingMap.get(a) || 0;
        const fatB = redeRollingMap.get(b) || 0;
        if (fatB !== fatA) return fatB - fatA;
        return a.localeCompare(b, 'pt-BR');
      });

      // Mapear cada rede comercial pertencente ao gerente
      const clientsList = sortedRedeNames.map(cName => {
        const cProj = clientProjs.filter((p: any) => p.client_matrix.trim().toUpperCase() === cName.trim().toUpperCase());
        
        const curSales = managerCliHist.find((c: any) => c.client === cName && c.mes === curMonthKey);
        const pmSales = managerCliHist.find((c: any) => c.client === cName && c.mes === prevMonthKey);
        const pySales = managerCliHist.find((c: any) => c.client === cName && c.mes === prevYearKey);

        const fatCur = Number(curSales?.fat || 0);
        const fatPm = Number(pmSales?.fat || 0);
        const fatPy = Number(pySales?.fat || 0);

        const metaProj = cProj.find((p: any) => p.kpi === 'META');
        const metaValue = metaProj ? Number(metaProj.projection_value) : 0;

        const clientPrevProjs = prevManagerProjs.filter((p: any) => p.client_matrix.trim().toUpperCase() === cName.trim().toUpperCase() && p.kpi === 'FAT');
        const prevCliFatWeekly = prevMondays.map(date => {
          const p = clientPrevProjs.find((p: any) => p.week_start_date === date);
          return p ? Number(p.projection_value) : 0;
        });
        const prevCliFatProj = prevCliFatWeekly.length > 0
          ? (prevCliFatWeekly.slice().reverse().find(v => v !== 0) || prevCliFatWeekly[prevCliFatWeekly.length - 1] || 0)
          : 0;

        return {
          client: cName,
          ano_a: fatPy,
          mes_a: fatPm,
          desafio: 0, // Fallback estético
          real: fatCur,
          meta: metaValue,
          prev_month_projection: prevCliFatProj,
          projections: mondays.map(date => {
            const p = cProj.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            if (p) return Number(p.projection_value);
            return date > todayStr ? 0 : metaValue;
          })
        };
      });

      // Adicionar permanentemente "OUTROS" como o último item para vendas de PDVs/parceiros sem rede vinculada
      const cProjOutros = clientProjs.filter((p: any) => p.client_matrix === 'OUTROS');
      const metaProjOutros = cProjOutros.find((p: any) => p.kpi === 'META');
      const metaValueOutros = metaProjOutros ? Number(metaProjOutros.projection_value) : 0;
      const curFatOutros = Math.max(0, curFatVal - clientsList.reduce((acc, c) => acc + c.real, 0));

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
        desafio: 0,
        real: curFatOutros,
        meta: metaValueOutros,
        prev_month_projection: prevOtherFatProj,
        projections: mondays.map(date => {
          const p = cProjOutros.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
          if (p) return Number(p.projection_value);
          return date > todayStr ? 0 : metaValueOutros;
        })
      });

      return {
        manager: mName,
        kpis,
        clients: clientsList
      };
    });

    const isAdmin = ["Admin", "Admin Master"].includes(userRole);

    return NextResponse.json({
      success: true,
      year,
      month,
      mondays,
      managers: managersData,
      restrictedToManager: (!isGerenteNacionalAdmin && userManagerName && !FULL_ACCESS_ROLES.includes(userRole)) ? userManagerName : null,
      isGerenteNacionalAdmin,
      isAdmin
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "RPS");

    const userRole = profile.role || '';
    const userManagerName = profile.manager_name || null;
    const userEmail = (user.email || '').toLowerCase().trim();

    const isAdmin = ["Admin", "Admin Master"].includes(userRole);
    const isGerenteNacionalAdmin = checkIsGerenteNacionalAdmin(userRole, userEmail);
    const isRestricted = !isGerenteNacionalAdmin && userManagerName && !FULL_ACCESS_ROLES.includes(userRole);

    const body = await request.json();
    const { year, month, projections } = body;

    if (!year || !month || !projections || !Array.isArray(projections)) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos ou incompletos." }, { status: 400 });
    }

    // TRAVA OBRIGATÓRIA DE SEGURANÇA NO BACKEND (HTTP 403): Apenas Admin / Admin Master pode salvar/alterar kpi === 'META' (Desafio por Rede)
    const metaRowsInPayload = projections.filter((p: any) => p.kpi === 'META');
    if (metaRowsInPayload.length > 0 && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Acesso negado (403 Forbidden): Apenas Administradores podem definir ou alterar o Desafio por Rede." },
        { status: 403 }
      );
    }

    let filteredProjections = projections;
    if (isRestricted) {
      filteredProjections = projections.filter((p: any) => isSameManager(p.manager, userManagerName));
    }

    const supabase = getSupabaseAdminClient();

    // 1. Processar edições de Desafios (DESAFIO_FAT e DESAFIO_VOL) salvando diretamente na fonte oficial public.targets
    const managersInPayload = Array.from(new Set(filteredProjections.map((p: any) => p.manager)));
    const targetsToUpsert: any[] = [];

    for (const mName of managersInPayload) {
      const canonical = resolveCanonicalManager(mName as string);
      const fatItem = filteredProjections.find((p: any) => isSameManager(p.manager, mName as string) && p.client_matrix === '_TOTAL_' && p.kpi === 'DESAFIO_FAT');
      const volItem = filteredProjections.find((p: any) => isSameManager(p.manager, mName as string) && p.client_matrix === '_TOTAL_' && p.kpi === 'DESAFIO_VOL');

      if (fatItem || volItem) {
        targetsToUpsert.push({
          manager: canonical.managerName,
          manager_id: canonical.managerId,
          year: parseInt(year),
          month: parseInt(month),
          target_revenue: fatItem ? Number(fatItem.projection_value) : 0,
          target_tons: volItem ? Number(volItem.projection_value) : 0,
          updated_at: new Date().toISOString()
        });
      }
    }

    if (targetsToUpsert.length > 0) {
      const { error: targetsErr } = await supabase
        .from('targets')
        .upsert(targetsToUpsert, { onConflict: 'manager,year,month' });
      if (targetsErr) throw targetsErr;
    }

    // 2. PROIBIÇÃO DE DUPLICIDADE: Filtrar rowsToUpsert para NUNCA persistir DESAFIO_FAT ou DESAFIO_VOL em cm_weekly_projections
    const weeklyProjectionsOnly = filteredProjections.filter((p: any) => {
      return p.kpi !== 'DESAFIO_FAT' && p.kpi !== 'DESAFIO_VOL';
    });

    // Converter SEMPRE a propriedade manager para o nome canônico único do gerente antes do UPSERT
    const rowsToUpsert = weeklyProjectionsOnly.map((p: any) => ({
      manager: resolveCanonicalManager(p.manager).managerName,
      client_matrix: p.client_matrix,
      year: parseInt(year),
      month: parseInt(month),
      week_start_date: p.week_start_date,
      kpi: p.kpi,
      projection_value: Number(p.projection_value),
      updated_at: new Date().toISOString()
    }));

    if (rowsToUpsert.length > 0) {
      const { error } = await supabase
        .from('cm_weekly_projections')
        .upsert(rowsToUpsert, { onConflict: 'manager,client_matrix,year,month,week_start_date,kpi' });

      if (error) throw error;
    }

    // Registrador oficial de auditoria para edições do Desafio por Rede efetuadas por Administrador
    if (isAdmin && metaRowsInPayload.length > 0) {
      for (const mRow of metaRowsInPayload) {
        const canonicalMgr = resolveCanonicalManager(mRow.manager).managerName;
        await logAuditAction(
          user.id,
          "DESAFIO_POR_REDE_UPDATE",
          "cm_weekly_projections",
          {
            manager: canonicalMgr,
            client_matrix: mRow.client_matrix,
            year: parseInt(year),
            month: parseInt(month),
            projection_value: Number(mRow.projection_value)
          }
        );
      }
    }

    return NextResponse.json({ success: true, count: targetsToUpsert.length + rowsToUpsert.length });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
