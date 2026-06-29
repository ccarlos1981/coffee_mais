import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  calculateAchievement, 
  calculateBonusPercentage, 
  getPerformanceBadge, 
  calculateProportionalFactor 
} from "@/lib/engines/challenge-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "7", 10);
    const year = parseInt(searchParams.get("year") || "2026", 10);
    const quarter = Math.ceil(month / 3);
    const isQuarterEnd = (month % 3 === 0);

    // 1. Fetch Promotores with their default variables
    const { data: userProfiles, error: upErr } = await adminClient
      .from("cm_user_profiles")
      .select("id, employee_code, default_variavel_mensal")
      .eq("role", "Promotor");

    if (upErr) throw upErr;

    // 2. Fetch Employee details
    const { data: promotorPerfil } = await adminClient.from("cm_promotor_perfil").select("user_id, employee_id");
    const { data: employees } = await adminClient.from("cm_employees").select("id, nome_completo, uf_alocacao, data_admissao, data_desligamento");
    
    const empMap = new Map();
    if (employees) employees.forEach(e => empMap.set(e.id, e));
    const userToEmpMap = new Map((promotorPerfil || []).map(p => [p.user_id, p.employee_id]));

    // 3. Fetch existing remuneration records for the ENTIRE QUARTER to calculate catch-up
    const qMonths = quarter === 1 ? [1,2,3] : quarter === 2 ? [4,5,6] : quarter === 3 ? [7,8,9] : [10,11,12];
    const { data: qRemuneracoes, error: remErr } = await adminClient
      .from("cm_promotor_remuneracao")
      .select("*")
      .eq("competency_year", year)
      .in("competency_month", qMonths);

    if (remErr) throw remErr;
    
    const qRemMap = new Map<string, any[]>();
    (qRemuneracoes || []).forEach(r => {
      if(!qRemMap.has(r.promotor_id)) qRemMap.set(r.promotor_id, []);
      qRemMap.get(r.promotor_id)!.push(r);
    });

    const result = (userProfiles || [])
      .map(prof => {
        const empId = userToEmpMap.get(prof.id);
        const emp = empId ? empMap.get(empId) : null;
        
        // Se não tiver um employee real atrelado no banco (mocks de dev), ignoramos
        if (!emp) return null;
        
        const name = emp.nome_completo;
        const uf = emp.uf_alocacao || "SP";
        const dtAdm = emp.data_admissao || null;
        const dtDeslig = emp.data_desligamento || null;

        const profRems = qRemMap.get(prof.id) || [];
        const savedRem = profRems.find(r => r.competency_month === month);
        
        const variavelBase = savedRem ? parseFloat(savedRem.variavel_base_utilizada || 0) : parseFloat(prof.default_variavel_mensal || 0);
        const factor = calculateProportionalFactor(month, year, dtAdm, dtDeslig);
        
        // Mock Realizado (MVP)
        const hash = prof.id.charCodeAt(0) + month;
        const realAch = factor === 0 ? null : (90 + (hash % 15)); // between 90% and 105%
        
        const atingimento_mensal = savedRem ? parseFloat(savedRem.atingimento_mensal_percent || 0) : (factor === 0 ? 0 : realAch);
        const bonusPct = calculateBonusPercentage(atingimento_mensal);
        
        const propVariabel = variavelBase * factor;
        let valor_calculado = propVariabel * (bonusPct / 100);
        let recuperacao_trimestral = 0;

        // RECUPERAÇÃO TRIMESTRAL LÓGICA (CATCH-UP) - Com verificação de Idempotência
        const catchupAlreadyProcessed = savedRem?.catchup_processed;

        if (isQuarterEnd && factor > 0) {
          if (catchupAlreadyProcessed) {
            // Idempotent: Just load saved recuperacao
            recuperacao_trimestral = parseFloat(savedRem.recuperacao_trimestral || 0);
            valor_calculado += recuperacao_trimestral;
          } else {
            // Not yet processed, so we dynamically calculate
            const q3Ach = 98 + (hash % 5); // 98 to 102
            if (q3Ach >= 100) {
               let paidPrevMonths = 0;
               profRems.forEach(pr => {
                 if (pr.competency_month !== month) {
                   paidPrevMonths += parseFloat(pr.valor_pago_mensal || 0);
                 }
               });
               
               const trimestersWorked = 3; 
               const totalQPotential = (variavelBase * trimestersWorked);
               
               const targetCatchUp = totalQPotential - paidPrevMonths - valor_calculado;
               if (targetCatchUp > 0) {
                 recuperacao_trimestral = targetCatchUp;
                 valor_calculado += recuperacao_trimestral;
               }
            }
          }
        }

        return {
          id: prof.id,
          remuneracao_id: savedRem?.id || null,
          employee_code: prof.employee_code,
          name,
          uf,
          variavel_base: variavelBase,
          fator_proporcional: factor,
          atingimento_mensal,
          status_performance: getPerformanceBadge(atingimento_mensal),
          valor_calculado,
          recuperacao_trimestral,
          valor_pago_mensal: savedRem ? parseFloat(savedRem.valor_pago_mensal || 0) : valor_calculado,
          override_reason: savedRem?.override_reason || "",
          status_pagamento: savedRem?.status || "DRAFT",
          payment_year: savedRem?.payment_year || year,
          payment_month: savedRem?.payment_month || (month + 1 > 12 ? 1 : month + 1),
          quarter_locked: savedRem?.quarter_locked || false,
          catchup_processed: catchupAlreadyProcessed || false
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[REMUNERACAO GET ERROR]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { records, competency_year, competency_month, quarter, new_status, lock_quarter } = body;

    const upserts = records.map((r: any) => {
      const isOverride = Math.abs((r.valor_pago_mensal || 0) - (r.valor_calculado || 0)) > 1.0;
      
      const payload: any = {
        promotor_id: r.id,
        competency_year,
        competency_month,
        quarter,
        payment_year: r.payment_year,
        payment_month: r.payment_month,
        variavel_base_utilizada: r.variavel_base,
        atingimento_mensal_percent: r.atingimento_mensal,
        valor_pago_mensal: r.valor_pago_mensal,
        recuperacao_trimestral: r.recuperacao_trimestral,
        status: new_status || r.status_pagamento,
        updated_by: user.id
      };

      if (isOverride && r.override_reason) {
        payload.override_reason = r.override_reason;
        payload.override_by = user.id;
        payload.override_at = new Date().toISOString();
      }
      
      if (lock_quarter) {
        payload.quarter_locked = true;
        payload.locked_by = user.id;
        payload.locked_at = new Date().toISOString();
      }

      // Se recuperamos trimestralmente, e ainda nao processamos na DB, marca para nao duplicar
      if (r.recuperacao_trimestral > 0 && !r.catchup_processed) {
        payload.catchup_processed = true;
        payload.catchup_processed_at = new Date().toISOString();
      }

      return payload;
    });

    if (upserts.length > 0) {
      const { error } = await adminClient
        .from("cm_promotor_remuneracao")
        .upsert(upserts, { onConflict: "promotor_id,competency_year,competency_month" });
      
      if (error) throw error;
    }

    await adminClient.from("cm_audit_logs").insert({
      user_id: user.id,
      action: lock_quarter ? `REMUNERACAO_PROMOTOR_LOCKED` : `REMUNERACAO_PROMOTOR_SALVAR`,
      table_name: "cm_promotor_remuneracao",
      details: { competency_year, competency_month, count: upserts.length, status: new_status }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[REMUNERACAO POST ERROR]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
