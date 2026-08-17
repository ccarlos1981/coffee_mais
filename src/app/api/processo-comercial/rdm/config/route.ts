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

// ─── GET: Retorna as configurações das regionais ──────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from('cm_rdm_desafio_config')
      .select('*');

    if (error) throw error;

    const configMap = new Map<string, any>();
    (rows || []).forEach(r => {
      if (r.manager_id) {
        configMap.set(r.manager_id, r);
      }
    });

    const result = MANAGERS_CONFIG_LIST.map(m => {
      const saved = configMap.get(m.managerId);
      return {
        manager_id: m.managerId,
        manager_name: m.managerName,
        is_custom: !!saved,
        impostos_pct: saved ? Number(saved.impostos_pct) : DEFAULT_PCTS.impostos_pct,
        investimento_pct: saved ? Number(saved.investimento_pct) : DEFAULT_PCTS.investimento_pct,
        cpv_pct: saved ? Number(saved.cpv_pct) : DEFAULT_PCTS.cpv_pct,
        frete_pct: saved ? Number(saved.frete_pct) : DEFAULT_PCTS.frete_pct,
        updated_at: saved?.updated_at || null,
        updated_by: saved?.updated_by || null,
      };
    });

    const userRole = profile?.role || '';
    const isAdmin = ['Admin', 'Admin Master'].includes(userRole);

    return NextResponse.json({
      success: true,
      isAdmin,
      defaults: DEFAULT_PCTS,
      configs: result,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

// ─── POST: Cria/Atualiza ou Restaura Padrão de Regional (Admin Only) ──────────
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const userRole = profile?.role || '';
    const isAdmin = ['Admin', 'Admin Master'].includes(userRole);

    // Trava de segurança no backend (HTTP 403)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado (403 Forbidden): Apenas Administradores podem alterar a configuração dos percentuais do Desafio DRE.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { manager_id, manager, isReset, impostos_pct, investimento_pct, cpv_pct, frete_pct } = body;

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

    const supabase = createAdminClient();

    if (isReset) {
      // Restaurar Padrão: remove configuração customizada da regional
      const { error: delErr } = await supabase
        .from('cm_rdm_desafio_config')
        .delete()
        .eq('manager_id', canonicalId);

      if (delErr) throw delErr;

      await logAuditAction(
        user.id,
        'RESTORE_RDM_DESAFIO_CONFIG',
        'cm_rdm_desafio_config',
        { manager_id: canonicalId, displayName }
      );

      return NextResponse.json({
        success: true,
        message: `Configuração padrão restaurada com sucesso para ${displayName}.`,
        config: {
          manager_id: canonicalId,
          manager_name: displayName,
          is_custom: false,
          ...DEFAULT_PCTS,
        },
      });
    }

    // Normalização e validação dos percentuais
    const impFinal = normalizePct(impostos_pct, DEFAULT_PCTS.impostos_pct);
    const invFinal = normalizePct(investimento_pct, DEFAULT_PCTS.investimento_pct);
    const cpvFinal = normalizePct(cpv_pct, DEFAULT_PCTS.cpv_pct);
    const freFinal = normalizePct(frete_pct, DEFAULT_PCTS.frete_pct);

    const rowToUpsert = {
      manager_id: canonicalId,
      manager_name: displayName,
      impostos_pct: impFinal,
      investimento_pct: invFinal,
      cpv_pct: cpvFinal,
      frete_pct: freFinal,
      updated_at: new Date().toISOString(),
      updated_by: user.email || user.id,
    };

    const { data: saved, error: upsertErr } = await supabase
      .from('cm_rdm_desafio_config')
      .upsert(rowToUpsert, { onConflict: 'manager_id' })
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
      message: `Configuração salva com sucesso para ${displayName}.`,
      config: {
        manager_id: saved.manager_id,
        manager_name: saved.manager_name,
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
