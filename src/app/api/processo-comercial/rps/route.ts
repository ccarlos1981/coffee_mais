import { NextRequest, NextResponse } from 'next/server';
import { OFFICIAL_ANALYTICS_SOURCES } from "@/lib/governance/analytics";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError, logAuditAction } from "@/lib/supabase/auth-helpers";
import { resolveCanonicalManager, isSameManager, resolveCanonicalNetwork } from "@/lib/domain/canonical";
import { CommercialDomainService } from "@/lib/domain";
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

    const normalized = { ...p, manager: canonicalName };
    if (!map.has(key)) {
      map.set(key, normalized);
    } else {
      const existing = map.get(key);
      const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      const newTime = p.updated_at ? new Date(p.updated_at).getTime() : 0;
      // Precedência soberana para o registro com updated_at mais recente
      if (newTime > existingTime) {
        map.set(key, normalized);
      }
    }
  });
  return Array.from(map.values());
}

// Roles com acesso total (enxergam todos os gerentes)
const FULL_ACCESS_ROLES = ["Admin", "CEO", "Diretor", "Gerente Nacional", "Admin Master"];
const GERENTE_NACIONAL_EMAILS = [
  "cristiano.santos@coffeemais.com"
];

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
    const allManagers = CommercialDomainService.getFieldManagerList();
    let activeManagers: string[];

    if (isGerenteNacionalAdmin || !userManagerName) {
      activeManagers = allManagers;
    } else {
      activeManagers = allManagers.filter(m => isSameManager(m, userManagerName));
    }

    const supabase = getSupabaseAdminClient();

    // Data e Hora oficiais do servidor no fuso horário do Brasil (America/Sao_Paulo)
    const serverTimeInfo = (() => {
      const now = new Date();
      const formatterDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatterDate.formatToParts(now);
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const dVal = parts.find(p => p.type === 'day')?.value;
      const todayStr = `${y}-${m}-${dVal}`;

      const formatterHour = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour: 'numeric',
        hour12: false
      });
      const hour = parseInt(formatterHour.format(now), 10);

      const dateSP = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const isTodayMonday = dateSP.getDay() === 1;
      const isCutoffReached = isTodayMonday && hour >= 15;
      const canManagerEdit = isTodayMonday && hour < 15;

      return {
        todayStr,
        hour,
        isTodayMonday,
        isCutoffReached,
        canManagerEdit,
        serverTimeISO: now.toISOString()
      };
    })();

    const todayStr = serverTimeInfo.todayStr;

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
      WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}', '${closedMonth2}', '${closedMonth3}')
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
        TRIM(rede) as client,
        codigo_matriz,
        uf
      FROM vw_redes_planejaveis_oficiais
      WHERE is_rede_planejavel = TRUE
    `;

    // SQL - Carteira Dinâmica Customizada (Sprint RPS Carteira Dinâmica)
    const sqlCustomCarteira = `
      SELECT manager, TRIM(client_matrix) as client_matrix, display_order, is_excluded
      FROM cm_rps_custom_carteira
      WHERE year = ${year} AND month = ${month}
    `;

    // SQL - Todas as redes disponíveis no sistema para pesquisa do Modal "+"
    const sqlAllAvailableRedes = `
      SELECT DISTINCT 
        TRIM(rede) as client,
        manager,
        codigo_matriz,
        uf
      FROM vw_redes_planejaveis_oficiais
      WHERE rede IS NOT NULL AND TRIM(rede) != ''
      ORDER BY TRIM(rede) ASC
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

    // Executar consultas via RPC e Supabase Client
    const [
      resMgrHist, 
      resCliHist, 
      resBaseCli, 
      resCustomCarteira, 
      resAllAvailable, 
      resMgrTargets, 
      resInvestHist, 
      resProj, 
      resPrevProj
    ] = await Promise.all([
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory }),
      supabase.rpc('execute_readonly_query', { query_text: sqlBaseClients }),
      supabase.rpc('execute_readonly_query', { query_text: sqlCustomCarteira }),
      supabase.rpc('execute_readonly_query', { query_text: sqlAllAvailableRedes }),
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerTargets }),
      supabase.rpc('execute_readonly_query', { query_text: sqlInvestmentsHistory }),
      supabase
        .from('cm_weekly_projections')
        .select('manager, client_matrix, week_start_date, kpi, projection_value, updated_at')
        .eq('year', year)
        .eq('month', month)
        .order('updated_at', { ascending: false }),
      supabase
        .from('cm_weekly_projections')
        .select('manager, client_matrix, week_start_date, kpi, projection_value, updated_at')
        .eq('year', prevMonthYear)
        .eq('month', prevMonthVal)
        .order('updated_at', { ascending: false }),
    ]);

    if (resMgrHist.error) throw new Error("Erro buscar histórico gerentes: " + resMgrHist.error.message);
    if (resCliHist.error) throw new Error("Erro buscar histórico clientes: " + resCliHist.error.message);
    if (resBaseCli.error) throw new Error("Erro buscar base clientes: " + resBaseCli.error.message);
    if (resCustomCarteira.error) throw new Error("Erro buscar carteira customizada: " + resCustomCarteira.error.message);
    if (resAllAvailable.error) throw new Error("Erro buscar redes disponíveis: " + resAllAvailable.error.message);
    if (resMgrTargets.error) throw new Error("Erro buscar metas: " + resMgrTargets.error.message);
    if (resInvestHist.error) throw new Error("Erro buscar investimento histórico: " + resInvestHist.error.message);
    if (resProj.error) throw new Error("Erro buscar projeções: " + resProj.error.message);
    if (resPrevProj.error) throw new Error("Erro buscar projeções do mês anterior: " + resPrevProj.error.message);

    const mgrHist = (resMgrHist.data || []) as any[];
    const cliHist = (resCliHist.data || []) as any[];
    const baseCli = (resBaseCli.data || []) as any[];
    const customCarteiraRows = (resCustomCarteira.data || []) as any[];
    const allAvailableRedes = (resAllAvailable.data || []) as any[];
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
      const mHist2 = mgrHist.filter((h: any) => isSameManager(h.manager, mName) && h.mes === closedMonth2);
      const mHist3 = mgrHist.filter((h: any) => isSameManager(h.manager, mName) && h.mes === closedMonth3);
      const pyHist = mgrHist.filter((h: any) => isSameManager(h.manager, mName) && h.mes === prevYearKey);

      const curFatVal = curHist.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);
      const pmFatVal = pmHist.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);
      const fatM2Val = mHist2.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);
      const fatM3Val = mHist3.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);
      const pyFatVal = pyHist.reduce((acc: number, h: any) => acc + Number(h.fat || 0), 0);

      const curQtyVal = curHist.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);
      const pmQtyVal = pmHist.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);
      const qtyM2Val = mHist2.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);
      const qtyM3Val = mHist3.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);
      const pyQtyVal = pyHist.reduce((acc: number, h: any) => acc + Number(h.qty || 0), 0);

      // Buscar Investimento Histórico Realizado
      const curInvest = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === curMonthKey);
      const pmInvest = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === prevMonthKey);
      const inv2Hist = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === closedMonth2);
      const inv3Hist = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === closedMonth3);
      const pyInvest = investHist.filter((i: any) => isSameManager(i.manager, mName) && i.mes_referencia === prevYearKey);

      const curInvestVal = curInvest.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);
      const pmInvestVal = pmInvest.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);
      const inv2Val = inv2Hist.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);
      const inv3Val = inv3Hist.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);
      const pyInvestVal = pyInvest.reduce((acc: number, i: any) => acc + Number(i.total_invest || 0), 0);

      const curInvestPct = curFatVal > 0 ? (curInvestVal / curFatVal) * 100 : 0;
      const pmInvestPct = pmFatVal > 0 ? (pmInvestVal / pmFatVal) * 100 : 0;
      const inv2Pct = fatM2Val > 0 ? (inv2Val / fatM2Val) * 100 : 0;
      const inv3Pct = fatM3Val > 0 ? (inv3Val / fatM3Val) * 100 : 0;
      const pyInvestPct = pyFatVal > 0 ? (pyInvestVal / pyFatVal) * 100 : 10.0;

      // Médias dos 3 meses fechados do Trimestre (Média do Trimestre: Mês-1, Mês-2, Mês-3)
      const mediaTrimestreFat = (pmFatVal + fatM2Val + fatM3Val) / 3;
      const mediaTrimestreVol = (pmQtyVal + qtyM2Val + qtyM3Val) / 3;
      const mediaTrimestreInvest = (pmInvestPct + inv2Pct + inv3Pct) / 3;

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

      const customDesafioVol = managerProjs.find((p: any) => p.kpi === 'DESAFIO_VOL');
      const customDesafioFat = managerProjs.find((p: any) => p.kpi === 'DESAFIO_FAT');

      const desafioVol = customDesafioVol ? Number(customDesafioVol.projection_value) : targetVol;
      const desafioFat = customDesafioFat ? Number(customDesafioFat.projection_value) : targetFat;

      const customDesafioInvest = managerProjs.find((p: any) => p.kpi === 'DESAFIO_INVEST');
      const desafioInvest = customDesafioInvest ? Number(customDesafioInvest.projection_value) : targetInvest;

      // KPIs estruturados para o gerente
      const kpis = {
        VOL: {
          ano_a: pyQtyVal,
          mes_a: pmQtyVal,
          media_trimestre: mediaTrimestreVol,
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
          media_trimestre: mediaTrimestreFat,
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
          media_trimestre: mediaTrimestreInvest,
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

      // --- CAMADA DE GESTÃO DINÂMICA DE CARTEIRA (RPS) ---
      const managerBaseCli = baseCli.filter((b: any) => isSameManager(b.manager, mName) || isSameManager(b.manager_id, mName));
      const managerCliHist = cliHist.filter((c: any) => isSameManager(c.manager, mName));
      const clientProjs = dbProjections.filter((p: any) => isSameManager(p.manager, mName) && p.client_matrix !== '_TOTAL_');
      const managerCustomCarteira = customCarteiraRows.filter((r: any) => isSameManager(r.manager, mName));

      // Base oficial estruturada de redes do gerente
      const managerOfficialRecords = managerBaseCli.map((b: any) => ({
        rede: b.client,
        manager: b.manager,
        managerId: b.manager_id,
        codigoMatriz: b.codigo_matriz,
        uf: b.uf,
      }));

      // Montar conjunto de redes base + customizadas ativas com canonicalização dinâmica
      const redeSet = new Set<string>(managerBaseCli.map((b: any) => b.client));

      // Adicionar redes ativas na customizacao
      managerCustomCarteira.forEach((r: any) => {
        if (!r.is_excluded && r.client_matrix) {
          const res = resolveCanonicalNetwork(
            { rawName: r.client_matrix, managerName: mName },
            managerOfficialRecords
          );
          const nameToAdd = res.status === "SUCCESS" && res.canonicalName ? res.canonicalName : r.client_matrix;
          redeSet.add(nameToAdd);
        }
      });

      // Remover redes excluídas manualmente na carteira dinâmica
      managerCustomCarteira.forEach((r: any) => {
        if (r.is_excluded && r.client_matrix) {
          const res = resolveCanonicalNetwork(
            { rawName: r.client_matrix, managerName: mName },
            managerOfficialRecords
          );
          const nameToDelete = res.status === "SUCCESS" && res.canonicalName ? res.canonicalName : r.client_matrix;
          redeSet.delete(nameToDelete);
          redeSet.delete(r.client_matrix);
        }
      });

      // Remover desmapeados e a linha especial de agrupamento OUTROS
      redeSet.delete('');
      redeSet.delete('Não Mapeado');
      redeSet.delete('OUTROS');

      // Mapear Rolling FAT 3M
      const redeRollingMap = new Map<string, number>();
      Array.from(redeSet).forEach(cName => {
        const r3m = managerCliHist
          .filter((c: any) => {
            if (c.client === cName) return true;
            const res = resolveCanonicalNetwork(
              { rawName: c.client, managerName: mName },
              managerOfficialRecords
            );
            return res.status === "SUCCESS" && res.canonicalName === cName;
          })
          .filter((c: any) => closedMonths.includes(c.mes))
          .reduce((acc: number, c: any) => acc + Number(c.fat || 0), 0);
        redeRollingMap.set(cName, r3m);
      });

      // Mapear Ordem Customizada se existir em cm_rps_custom_carteira
      const customOrderMap = new Map<string, number>();
      managerCustomCarteira.forEach((r: any) => {
        if (!r.is_excluded && r.display_order !== undefined && r.display_order !== null) {
          const res = resolveCanonicalNetwork(
            { rawName: r.client_matrix, managerName: mName },
            managerOfficialRecords
          );
          const canonicalKey = res.status === "SUCCESS" && res.canonicalName ? res.canonicalName.trim().toUpperCase() : r.client_matrix.trim().toUpperCase();
          customOrderMap.set(canonicalKey, Number(r.display_order));
          customOrderMap.set(r.client_matrix.trim().toUpperCase(), Number(r.display_order));
        }
      });

      const hasCustomOrder = customOrderMap.size > 0;

      const sortedRedeNames = Array.from(redeSet).sort((a, b) => {
        const keyA = a.trim().toUpperCase();
        const keyB = b.trim().toUpperCase();

        if (hasCustomOrder) {
          const orderA = customOrderMap.has(keyA) ? customOrderMap.get(keyA)! : 999999;
          const orderB = customOrderMap.has(keyB) ? customOrderMap.get(keyB)! : 999999;
          if (orderA !== orderB) return orderA - orderB;
        }

        const fatA = redeRollingMap.get(a) || 0;
        const fatB = redeRollingMap.get(b) || 0;
        if (fatB !== fatA) return fatB - fatA;
        return a.localeCompare(b, 'pt-BR');
      });

      // Mapear cada rede comercial pertencente ao gerente com dados oficiais carregados automaticamente
      const clientsList = sortedRedeNames.map((cName, idx) => {
        const cProj = clientProjs.filter((p: any) => {
          const pRaw = p.client_matrix.trim().toUpperCase();
          if (pRaw === cName.trim().toUpperCase()) return true;
          const res = resolveCanonicalNetwork(
            { rawName: p.client_matrix, codigoMatriz: p.codigo_matriz, managerName: mName },
            managerOfficialRecords
          );
          return res.status === "SUCCESS" && res.canonicalName?.trim().toUpperCase() === cName.trim().toUpperCase();
        });
        
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

        const mediaTrimestreCli = (redeRollingMap.get(cName) || 0) / 3;

        return {
          client: cName,
          ano_a: fatPy,
          mes_a: fatPm,
          media_trimestre: mediaTrimestreCli,
          desafio: 0,
          real: fatCur,
          meta: metaValue,
          prev_month_projection: prevCliFatProj,
          projections: mondays.map(date => {
            const p = cProj.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
            if (p) return Number(p.projection_value);
            return date > todayStr ? 0 : metaValue;
          }),
          display_order: customOrderMap.get(cName.trim().toUpperCase()) ?? idx
        };
      });

      // Adicionar permanentemente "OUTROS" como o último item
      const cProjOutros = clientProjs.filter((p: any) => p.client_matrix === 'OUTROS');
      const metaProjOutros = cProjOutros.find((p: any) => p.kpi === 'META');
      const metaValueOutros = metaProjOutros ? Number(metaProjOutros.projection_value) : 0;
      const curFatOutros = Math.max(0, curFatVal - clientsList.reduce((acc, c) => acc + c.real, 0));
      const mediaTrimestreOutros = Math.max(0, mediaTrimestreFat - clientsList.reduce((acc, c) => acc + c.media_trimestre, 0));

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
        media_trimestre: mediaTrimestreOutros,
        desafio: 0,
        real: curFatOutros,
        meta: metaValueOutros,
        prev_month_projection: prevOtherFatProj,
        projections: mondays.map(date => {
          const p = cProjOutros.find((p: any) => p.week_start_date === date && p.kpi === 'FAT');
          if (p) return Number(p.projection_value);
          return date > todayStr ? 0 : metaValueOutros;
        }),
        display_order: 999999
      });

      return {
        manager: mName,
        kpis,
        clients: clientsList
      };
    });

    const isAdmin = ["Admin", "Admin Master"].includes(userRole);
    const canViewTotalBrasil = isAdmin;

    return NextResponse.json({
      success: true,
      year,
      month,
      mondays,
      managers: managersData,
      allAvailableRedes,
      restrictedToManager: (!isGerenteNacionalAdmin && userManagerName && !FULL_ACCESS_ROLES.includes(userRole)) ? userManagerName : null,
      isGerenteNacionalAdmin,
      isAdmin,
      canViewTotalBrasil,
      serverTime: serverTimeInfo
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
    const { year, month, projections, customCarteira } = body;

    if (!year || !month || !projections || !Array.isArray(projections)) {
      return NextResponse.json({ success: false, error: "Parâmetros inválidos ou incompletos." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Data e Hora oficiais do servidor no fuso horário do Brasil (America/Sao_Paulo)
    const now = new Date();
    const formatterDate = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const yStr = parts.find(p => p.type === 'year')?.value || '2026';
    const mStr = parts.find(p => p.type === 'month')?.value || '08';
    const dStr = parts.find(p => p.type === 'day')?.value || '10';
    const hStr = parts.find(p => p.type === 'hour')?.value || '12';

    const serverYear = parseInt(yStr);
    const serverMonth = parseInt(mStr);
    const serverDay = parseInt(dStr);
    const serverHour = parseInt(hStr);
    const serverTodayStr = `${yStr}-${mStr}-${dStr}`;

    const dateObj = new Date(serverYear, serverMonth - 1, serverDay);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

    // Se for Domingo (0), a segunda-feira alvo de projeção é AMANHÃ (+1 dia)
    // Se for Segunda (1), a segunda-feira alvo é HOJE (0 dias)
    let diffToMonday = 0;
    if (dayOfWeek === 0) {
      diffToMonday = 1;
    } else {
      diffToMonday = 1 - dayOfWeek;
    }

    const targetMondayDate = new Date(dateObj);
    targetMondayDate.setDate(dateObj.getDate() + diffToMonday);

    const targetWeekStart = `${targetMondayDate.getFullYear()}-${String(targetMondayDate.getMonth() + 1).padStart(2, '0')}-${String(targetMondayDate.getDate()).padStart(2, '0')}`;

    // Janela de Edição dos Gerentes: Domingo (todo o dia) OU Segunda-feira até 15:00 BRT
    const isEditingAllowedForManager = (dayOfWeek === 0) || (dayOfWeek === 1 && serverHour < 15);

    // Exceção Operacional Temporária (11/08/2026): Regularização do DESAFIO por perfis administrativos autorizados (isAdmin)
    const isExceptionalDesafioWindow = serverTodayStr === '2026-08-11';

    const DESAFIO_KPIS_SET = new Set(['META', 'DESAFIO_FAT', 'DESAFIO_VOL', 'DESAFIO_INVEST']);
    const desafioRowsInPayload = projections.filter((p: any) => DESAFIO_KPIS_SET.has(p.kpi));

    // TRAVA OBRIGATÓRIA DE SEGURANÇA NO BACKEND (HTTP 403): Apenas perfis administrativos oficiais (isAdmin) podem salvar/alterar DESAFIO / METAS
    if (desafioRowsInPayload.length > 0 && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Acesso negado (403 Forbidden): Apenas Administradores podem definir ou alterar o Desafio por Rede ou Metas." },
        { status: 403 }
      );
    }

    // TRAVA OBRIGATÓRIA DE SEGURANÇA NO BACKEND (HTTP 403): Apenas Admin / Admin Master pode gerenciar a Carteira Dinâmica (Custom Carteira)
    if (customCarteira && Array.isArray(customCarteira) && customCarteira.length > 0 && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Acesso negado (403 Forbidden): Apenas Administradores podem alterar a Carteira de Planejamento da RPS." },
        { status: 403 }
      );
    }

    // TRAVA OBRIGATÓRIA DE SEGURANÇA TEMPORAL E DE GERENTE NO BACKEND (HTTP 403):
    // Gerentes podem editar APENAS a sua própria carteira, APENAS a semana corrente E APENAS no Domingo ou Segunda até 15:00.
    if (isRestricted) {
      // 1. Validar autorização de gerente/carteira: gerente restrito não pode alterar carteira de outros gerentes
      const invalidManagerProjections = projections.filter((p: any) => {
        return !isSameManager(p.manager, userManagerName);
      });

      if (invalidManagerProjections.length > 0) {
        return NextResponse.json(
          { success: false, error: "Acesso negado (403 Forbidden): Gerentes possuem autorização para alterar exclusivamente a sua própria carteira." },
          { status: 403 }
        );
      }

      // 2. Validar janela temporal (Domingo todo o dia OU Segunda-feira até 15:00 no fuso de SP)
      if (!isEditingAllowedForManager) {
        return NextResponse.json(
          { success: false, error: "Acesso negado (403 Forbidden): A janela de edição de projeções para gerentes é aberta no Domingo (todo o dia) e na Segunda-feira impreterivelmente até as 15:00." },
          { status: 403 }
        );
      }

      // 3. TRAVA DE AUTORIDADE ABSOLUTA NO BACKEND (HTTP 403):
      // Gerentes comerciais restritos possuem autorização para enviar exclusivamente itens da semana corrente de projeção (targetWeekStart).
      const nonCurrentWeekItems = projections.filter((p: any) => {
        return !DESAFIO_KPIS_SET.has(p.kpi) && p.week_start_date && p.week_start_date !== targetWeekStart;
      });

      if (nonCurrentWeekItems.length > 0) {
        return NextResponse.json(
          { success: false, error: "Acesso negado (403 Forbidden): Gerentes possuem autorização para alterar exclusivamente a semana corrente de projeção." },
          { status: 403 }
        );
      }
    }

    let filteredProjections = projections;
    if (isRestricted) {
      filteredProjections = projections.filter((p: any) => 
        isSameManager(p.manager, userManagerName) && p.week_start_date === targetWeekStart && !DESAFIO_KPIS_SET.has(p.kpi)
      );
    }

    // Converter SEMPRE a propriedade manager para o nome canônico único do gerente antes do UPSERT em cm_weekly_projections
    const rowsToUpsert = filteredProjections.map((p: any) => ({
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

    // 3. PERSISTÊNCIA DA CARTEIRA DINÂMICA DE PLANEJAMENTO (EXCLUSIVO PARA ADMIN)
    if (isAdmin && customCarteira && Array.isArray(customCarteira) && customCarteira.length > 0) {
      const customRowsToUpsert = customCarteira.map((c: any) => ({
        year: parseInt(year),
        month: parseInt(month),
        manager: resolveCanonicalManager(c.manager).managerName,
        client_matrix: (c.client_matrix || '').trim(),
        display_order: Number(c.display_order || 0),
        is_excluded: Boolean(c.is_excluded),
        updated_at: new Date().toISOString()
      }));

      const { error: customErr } = await supabase
        .from('cm_rps_custom_carteira')
        .upsert(customRowsToUpsert, { onConflict: 'year,month,manager,client_matrix' });

      if (customErr) throw customErr;

      // Auditoria Rastreável de Inclusão, Remoção e Reordenação
      for (const cRow of customRowsToUpsert) {
        let actionType = "RPS_REDE_REORDENACAO";
        if (cRow.is_excluded) {
          actionType = "RPS_REDE_EXCLUSAO";
        } else if (cRow.display_order === 0) {
          actionType = "RPS_REDE_INCLUSAO";
        }

        await logAuditAction(
          user.id,
          actionType,
          "cm_rps_custom_carteira",
          {
            manager: cRow.manager,
            client_matrix: cRow.client_matrix,
            year: cRow.year,
            month: cRow.month,
            display_order: cRow.display_order,
            is_excluded: cRow.is_excluded
          }
        );
      }
    }

    // Registrador oficial de auditoria para edições do Desafio por Rede efetuadas por Administrador
    if (isAdmin && desafioRowsInPayload.length > 0) {
      for (const mRow of desafioRowsInPayload) {
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

    return NextResponse.json({ success: true, count: rowsToUpsert.length });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
