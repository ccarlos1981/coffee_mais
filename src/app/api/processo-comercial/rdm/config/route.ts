import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, requireApprovedProfile, handleAuthError, logAuditAction } from '@/lib/supabase/auth-helpers';
import { resolveCanonicalManager } from '@/lib/domain/canonical';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lista das regionais oficiais homologadas
const MANAGERS_CONFIG_LIST = [
  { managerId: 'CRISTIANO', managerName: 'Cristiano (Total)' },
  { managerId: '1001', managerName: 'Leandro (Sul)' },
  { managerId: '1002', managerName: 'Luiz (Nordeste/Sudeste)' },
  { managerId: '1000', managerName: 'Julliano (SPC)' },
  { managerId: '1003', managerName: 'John Guedes (CO+NO)' },
];

const DEFAULT_PCTS = {
  impostos_pct: 0.035,
  investimento_pct: 0.100,
  cpv_pct: 0.460,
  frete_pct: 0.030,
};

function normalizePct(val: any, defaultVal: number): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = Number(val);
  if (isNaN(num) || num < 0) return defaultVal;
  // Se veio em percentual inteiro (ex: 10 ou 46 ao invés de 0.10 ou 0.46), converter para escala 0..1
  if (num > 1) {
    return Math.min(num / 100, 1.0);
  }
  return Math.min(num, 1.0);
}

const FULL_ACCESS_ROLES = ["Admin", "Admin Master", "CEO", "Gerente Nacional", "Diretor"];
const GERENTE_NACIONAL_EMAILS = ["cristiano@coffeemais.com", "cristiano.santos@coffeemais.com"];

export function canConfigureDesafioPct(role?: string | null, email?: string | null): boolean {
  if (role && FULL_ACCESS_ROLES.includes(role)) {
    return true;
  }
  if (email && GERENTE_NACIONAL_EMAILS.includes(email.toLowerCase().trim())) {
    return true;
  }
  return false;
}

// ─── GET: Retorna as configurações das regionais por mês e global ─────────────
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const { searchParams } = request.nextUrl;
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    let targetCompetencia: string | undefined;
    if (yearStr && monthStr) {
      targetCompetencia = `${yearStr}-${String(monthStr).padStart(2, '0')}`;
    }

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from('cm_rdm_desafio_config')
      .select('*');

    if (error) throw error;

    const mgrMap = new Map<string, Map<string, any>>();
    (rows || []).forEach(r => {
      if (r.manager_id) {
        if (!mgrMap.has(r.manager_id)) {
          mgrMap.set(r.manager_id, new Map());
        }
        const compKey = r.competencia || 'GLOBAL';
        mgrMap.get(r.manager_id)!.set(compKey, r);
      }
    });

    const result = MANAGERS_CONFIG_LIST.map(m => {
      const compEntries = mgrMap.get(m.managerId);
      const monthRow = targetCompetencia && compEntries ? compEntries.get(targetCompetencia) : undefined;
      const globalRow = compEntries ? compEntries.get('GLOBAL') : undefined;

      const activeRow = monthRow || globalRow;
      const scope = monthRow ? 'MONTH' : (globalRow ? 'GLOBAL' : 'DEFAULT');

      return {
        manager_id: m.managerId,
        manager_name: m.managerName,
        scope,
        is_custom: !!(monthRow || globalRow),
        is_month_custom: !!monthRow,
        is_global_custom: !!globalRow,
        competencia: activeRow?.competencia || 'GLOBAL',
        impostos_pct: activeRow ? Number(activeRow.impostos_pct) : DEFAULT_PCTS.impostos_pct,
        investimento_pct: activeRow ? Number(activeRow.investimento_pct) : DEFAULT_PCTS.investimento_pct,
        cpv_pct: activeRow ? Number(activeRow.cpv_pct) : DEFAULT_PCTS.cpv_pct,
        frete_pct: activeRow ? Number(activeRow.frete_pct) : DEFAULT_PCTS.frete_pct,
        updated_at: activeRow?.updated_at || null,
        updated_by: activeRow?.updated_by || null,
      };
    });

    const userRole = profile?.role || '';
    const userEmail = user.email || '';
    const canConfigure = canConfigureDesafioPct(userRole, userEmail);

    return NextResponse.json({
      success: true,
      isAdmin: canConfigure,
      canConfigureDesafio: canConfigure,
      userRole,
      managerName: profile?.manager_name || null,
      defaults: DEFAULT_PCTS,
      competencia: targetCompetencia || 'GLOBAL',
      configs: result,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

// ─── POST: Cria/Atualiza ou Restaura Padrão de Regional/Mês (Admin Only) ──────
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const userRole = profile?.role || '';
    const userEmail = user.email || '';
    const canConfigure = canConfigureDesafioPct(userRole, userEmail);

    if (!canConfigure) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado (403 Forbidden): Apenas CEO, Administradores e Gerente Nacional podem alterar a configuração dos percentuais do Desafio DRE.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { manager_id, manager, year, month, scope, isReset, impostos_pct, investimento_pct, cpv_pct, frete_pct } = body;

    const rawMgr = manager_id || manager;
    if (!rawMgr) {
      return NextResponse.json({ success: false, error: 'Identificador do gerente/regional é obrigatório.' }, { status: 400 });
    }

    let canonicalId = String(rawMgr).trim();
    let displayName = rawMgr;

    if (canonicalId !== 'CRISTIANO') {
      const canonicalInfo = resolveCanonicalManager(rawMgr);
      canonicalId = canonicalInfo.managerId;
      displayName = canonicalInfo.managerName;
    } else {
      displayName = 'Cristiano (Total)';
    }

    const isMonthScope = scope === 'MONTH' || (!!year && !!month);
    const targetCompetencia = isMonthScope ? `${year}-${String(month).padStart(2, '0')}` : 'GLOBAL';
    const anoNum = isMonthScope ? Number(year) : null;
    const mesNum = isMonthScope ? Number(month) : null;

    const supabase = createAdminClient();

    if (isReset) {
      const { error: delErr } = await supabase
        .from('cm_rdm_desafio_config')
        .delete()
        .eq('manager_id', canonicalId)
        .eq('competencia', targetCompetencia);

      if (delErr) throw delErr;

      await logAuditAction(
        user.id,
        'RESTORE_RDM_DESAFIO_CONFIG',
        'cm_rdm_desafio_config',
        { manager_id: canonicalId, displayName, competencia: targetCompetencia }
      );

      return NextResponse.json({
        success: true,
        message: `Configuração para ${targetCompetencia === 'GLOBAL' ? 'Padrão Geral' : targetCompetencia} restaurada com sucesso para ${displayName}.`,
        config: {
          manager_id: canonicalId,
          manager_name: displayName,
          competencia: targetCompetencia,
          is_custom: false,
          ...DEFAULT_PCTS,
        },
      });
    }

    const impFinal = normalizePct(impostos_pct, DEFAULT_PCTS.impostos_pct);
    const invFinal = normalizePct(investimento_pct, DEFAULT_PCTS.investimento_pct);
    const cpvFinal = normalizePct(cpv_pct, DEFAULT_PCTS.cpv_pct);
    const freFinal = normalizePct(frete_pct, DEFAULT_PCTS.frete_pct);

    const rowToUpsert = {
      manager_id: canonicalId,
      manager_name: displayName,
      competencia: targetCompetencia,
      ano: anoNum,
      mes: mesNum,
      impostos_pct: impFinal,
      investimento_pct: invFinal,
      cpv_pct: cpvFinal,
      frete_pct: freFinal,
      updated_at: new Date().toISOString(),
      updated_by: user.email || user.id,
    };

    const { data: saved, error: upsertErr } = await supabase
      .from('cm_rdm_desafio_config')
      .upsert(rowToUpsert, { onConflict: 'manager_id,competencia' })
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    await logAuditAction(
      user.id,
      'UPDATE_RDM_DESAFIO_CONFIG',
      'cm_rdm_desafio_config',
      rowToUpsert
    );

    return NextResponse.json({
      success: true,
      message: `Configuração do mês ${targetCompetencia} salva com sucesso no banco de dados para ${displayName}!`,
      config: {
        manager_id: saved.manager_id,
        manager_name: saved.manager_name,
        competencia: saved.competencia,
        is_custom: true,
        impostos_pct: Number(saved.impostos_pct),
        investimento_pct: Number(saved.investimento_pct),
        cpv_pct: Number(saved.cpv_pct),
        frete_pct: Number(saved.frete_pct),
        updated_at: saved.updated_at,
        updated_by: saved.updated_by,
      },
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
