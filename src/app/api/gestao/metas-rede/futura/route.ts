import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
  logAuditAction,
} from "@/lib/supabase/auth-helpers";

const ALLOWED_METAS_ROLES = [
  "Admin",
  "Admin Master",
  "CEO",
  "Presidência",
  "Presidencia",
  "Presidente",
  "Diretoria",
  "Diretor",
  "Diretor Comercial",
  "Gerente Nacional",
  "Trade",
  "Gerente Regional",
  "Gerente Comercial",
  "Gerente",
];

const VALID_FUTURE_COMPETENCES = [
  { year: 2026, month: 3 },
  { year: 2026, month: 11 },
  { year: 2028, month: 12 },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/gestao/metas-rede/futura
 * Retorna as projeções de Meta Futura cadastradas para as 3 competências fixas:
 * Março/2026, Novembro/2026 e Dezembro/2028.
 * Totalmente isolado de public.targets e cm_weekly_projections.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isGerenteOnly = false;
    let userManagerName = "";

    if (user) {
      const { data: profile } = await supabase
        .from("cm_user_profiles")
        .select("role, name, manager_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        const userRole = (profile.role || "Gerente").toLowerCase().trim();
        const allAccessRoles = [
          "admin",
          "admin master",
          "ceo",
          "presidência",
          "presidencia",
          "presidente",
          "diretoria",
          "diretor",
          "diretor comercial",
        ];
        isGerenteOnly = !allAccessRoles.includes(userRole);
        userManagerName = profile.manager_name || profile.name || "";
      }
    }

    let query = supabase
      .from("cm_metas_futuras_rede")
      .select("id, manager, manager_id, codigo_matriz, rede, canal, target_year, target_month, valor_planejado, updated_at");

    // Filtragem por competências válidas
    query = query.or(
      "and(target_year.eq.2026,target_month.eq.3),and(target_year.eq.2026,target_month.eq.11),and(target_year.eq.2028,target_month.eq.12)"
    );

    const { data: records, error } = await query;

    if (error) {
      console.error("[GET /api/gestao/metas-rede/futura] Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    let filteredRecords = records || [];

    // Se for perfil restrito a gerente, filtra pela carteira do gerente
    if (isGerenteOnly && userManagerName) {
      const normMgr = userManagerName.toLowerCase().trim();
      filteredRecords = filteredRecords.filter((r) => {
        const rMgr = (r.manager || "").toLowerCase().trim();
        const rMgrId = (r.manager_id || "").toLowerCase().trim();
        return rMgr.includes(normMgr) || normMgr.includes(rMgr) || rMgrId === normMgr;
      });
    }

    const response = NextResponse.json({
      success: true,
      futureMetas: filteredRecords,
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return response;
  } catch (err: any) {
    console.error("[GET /api/gestao/metas-rede/futura] Fatal:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Erro interno ao carregar Meta Futura." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gestao/metas-rede/futura
 * Salva/atualiza em lote as projeções de Meta Futura na tabela cm_metas_futuras_rede.
 * Isolamento absoluto: não altera cm_weekly_projections nem targets.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    requireRole(profile, ALLOWED_METAS_ROLES);

    const body = await req.json();
    const { records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum registro informado para salvar na Meta Futura." },
        { status: 400 }
      );
    }

    const validUpserts: any[] = [];
    const nowIso = new Date().toISOString();

    for (const r of records) {
      const year = Number(r.target_year);
      const month = Number(r.target_month);
      const val = Number(r.valor_planejado);

      // Validação estrita de competência
      const isValidComp = VALID_FUTURE_COMPETENCES.some(
        (c) => c.year === year && c.month === month
      );
      if (!isValidComp) {
        return NextResponse.json(
          {
            success: false,
            error: `Competência futura inválida: ${month}/${year}. As competências permitidas são: Março/2026, Novembro/2026 e Dezembro/2028.`,
          },
          { status: 400 }
        );
      }

      if (isNaN(val) || val < 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Valor de meta futura inválido para a rede ${r.rede}: ${r.valor_planejado}`,
          },
          { status: 400 }
        );
      }

      if (!r.rede || !r.manager) {
        return NextResponse.json(
          {
            success: false,
            error: "Parâmetros incompletos: rede e manager são obrigatórios.",
          },
          { status: 400 }
        );
      }

      validUpserts.push({
        manager: String(r.manager).trim(),
        manager_id: String(r.manager_id || "").trim(),
        codigo_matriz: String(r.codigo_matriz || "").trim(),
        rede: String(r.rede).trim(),
        canal: String(r.canal || "KA").trim(),
        target_year: year,
        target_month: month,
        valor_planejado: val,
        updated_at: nowIso,
        updated_by: user.id,
      });
    }

    const supabase = await createClient();

    const { error } = await supabase.from("cm_metas_futuras_rede").upsert(validUpserts, {
      onConflict: "manager_id,codigo_matriz,rede,target_year,target_month",
    });

    if (error) {
      console.error("[POST /api/gestao/metas-rede/futura] Upsert error:", error);
      return NextResponse.json(
        { success: false, error: `Erro ao salvar no banco: ${error.message}` },
        { status: 500 }
      );
    }

    await logAuditAction(user.id, "METAS_REDE_SALVAR_META_FUTURA", "cm_metas_futuras_rede", {
      count: validUpserts.length,
      competences: ["2026-03", "2026-11", "2028-12"],
      executedBy: profile.name || profile.manager_name || user.email || user.id,
      role: profile.role,
    });

    return NextResponse.json({
      success: true,
      count: validUpserts.length,
      message: "Projeções futuras salvas com sucesso!",
    });
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message === "NOT_FOUND" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED") ||
      error.message === "FORBIDDEN"
    ) {
      return handleAuthError(error);
    }
    console.error("[POST /api/gestao/metas-rede/futura] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro ao processar requisição de Meta Futura." },
      { status: 500 }
    );
  }
}
