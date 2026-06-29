import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  calculateAchievement, 
  calculateBonusPercentage, 
  getPerformanceBadge, 
  getProgressBarColor,
  PromotorRankingEntry 
} from "@/lib/engines/challenge-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region");
    const supervisor = searchParams.get("supervisor");
    const uf = searchParams.get("uf");

    // Fetch all promoters from user_profiles
    const { data: userProfiles, error: upErr } = await adminClient
      .from("cm_user_profiles")
      .select("id, employee_code")
      .eq("role", "Promotor");

    if (upErr) throw upErr;

    if (!userProfiles || userProfiles.length === 0) {
      return NextResponse.json({
        total_eligible: 0,
        above_target: 0,
        ranking: [],
        lastUpdated: new Date().toISOString()
      });
    }

    // Fetch employee names from cm_employees
    const { data: employees } = await adminClient
      .from("cm_employees")
      .select("id, nome_completo");
    const empNameMap = new Map((employees || []).map(e => [e.id, e.nome_completo]));

    // Fetch promotor profiles to link them to employee names
    const { data: promotorPerfil } = await adminClient
      .from("cm_promotor_perfil")
      .select("user_id, employee_id");
    const userToEmpMap = new Map((promotorPerfil || []).map(p => [p.user_id, p.employee_id]));

    // Construir lista real de promotores (vazia por enquanto de faturamento, pois depende da apuração real)
    let promotersList = (userProfiles || [])
      .map(prof => {
        const empId = userToEmpMap.get(prof.id);
        const name = empId ? empNameMap.get(empId) : undefined;
        
        // Se não tiver um employee real atrelado no banco (mocks de dev), ignoramos
        if (!name) return null;
        
        return {
          id: prof.id,
          name: name,
          code: prof.employee_code || "0000",
          supervisor: "Sem Supervisor", // Isso virá do cadastro real no futuro
          uf: "SP", // Isso virá do cadastro real no futuro
          region: "Sudeste",
          jul: { meta: 0, realizado: 0 },
          ago: { meta: 0, realizado: 0 },
          set: { meta: 0, realizado: 0 }
        };
      })
      .filter(Boolean) as any[];

    if (region && region !== "Geral") {
      promotersList = promotersList.filter(p => p.region === region);
    }
    if (supervisor && supervisor !== "Todos") {
      promotersList = promotersList.filter(p => p.supervisor === supervisor);
    }
    if (uf && uf !== "Todos") {
      promotersList = promotersList.filter(p => p.uf === uf);
    }

    const ranking: PromotorRankingEntry[] = promotersList.map((p) => {
      const julAch = calculateAchievement(p.jul.realizado, p.jul.meta);
      const agoAch = calculateAchievement(p.ago.realizado, p.ago.meta);
      const setAch = calculateAchievement(p.set.realizado, p.set.meta);

      const metaQ3 = p.jul.meta + p.ago.meta + p.set.meta;
      const realizadoQ3 = p.jul.realizado + p.ago.realizado + p.set.realizado;
      const achQ3 = calculateAchievement(realizadoQ3, metaQ3);

      const bonusPct = calculateBonusPercentage(achQ3);
      const maxBonusPool = metaQ3 * 0.03; 
      const estimatedBonus = maxBonusPool * (bonusPct / 100);

      return {
        promotor_id: p.id,
        position: 0, 
        name: p.name,
        employee_code: p.code,
        supervisor: p.supervisor,
        uf: p.uf,
        region: p.region,
        
        jul: { meta: p.jul.meta, realizado: p.jul.realizado, achievement: julAch },
        ago: { meta: p.ago.meta, realizado: p.ago.realizado, achievement: agoAch },
        set: { meta: p.set.meta, realizado: p.set.realizado, achievement: setAch },

        meta_q3: metaQ3,
        realizado_q3: realizadoQ3,
        achievement_q3: achQ3,
        
        bonus_percent: bonusPct,
        estimated_bonus_value: estimatedBonus,
        status: getPerformanceBadge(achQ3),
        progressColor: getProgressBarColor(achQ3),
      };
    });

    ranking.sort((a, b) => {
      if (a.achievement_q3 === null && b.achievement_q3 === null) return 0;
      if (a.achievement_q3 === null) return 1;
      if (b.achievement_q3 === null) return -1;
      return b.achievement_q3 - a.achievement_q3;
    });
    
    ranking.forEach((r, i) => r.position = i + 1);

    return NextResponse.json({
      total_eligible: ranking.filter(r => r.achievement_q3 !== null).length,
      above_target: ranking.filter(r => r.achievement_q3 !== null && r.achievement_q3 >= 100).length,
      ranking,
      lastUpdated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[DESAFIO PROMOTOR GET API ERROR]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
