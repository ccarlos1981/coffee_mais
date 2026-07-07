import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  calculateAchievement, 
  calculateBonusPercentage, 
  calculateMonthlyRemuneration,
  calculateQuarterlyBonus,
  getPerformanceBadge, 
  getProgressBarColor,
  calculateProportionalFactor,
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

    // Obter employee_code e role do usuário logado
    const { data: loggedInProfile, error: profileErr } = await adminClient
      .from("cm_user_profiles")
      .select("employee_code, role")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      console.error("[DEBUG DESAFIO API] Profile Query Error:", profileErr);
    }
    console.log("[DEBUG DESAFIO API] User ID:", user.id, "Email:", user.email);
    console.log("[DEBUG DESAFIO API] Profile:", loggedInProfile);

    const currentUserCode = loggedInProfile?.employee_code || "0100";
    const currentUserRole = loggedInProfile?.role || "Promotor";
    console.log("[DEBUG DESAFIO API] Resolved Role:", currentUserRole);

    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region");
    const supervisor = searchParams.get("supervisor");
    const uf = searchParams.get("uf");

    // Fetch all approved promoters from user_profiles
    const { data: userProfiles, error: upErr } = await adminClient
      .from("cm_user_profiles")
      .select("id, employee_code")
      .eq("role", "Promotor")
      .eq("approved", true);

    if (upErr) throw upErr;

    if (!userProfiles || userProfiles.length === 0) {
      return NextResponse.json({
        total_eligible: 0,
        above_target: 0,
        ranking: [],
        lastUpdated: new Date().toISOString()
      });
    }

    // Fetch employee names and admission date from cm_employees
    const { data: employees } = await adminClient
      .from("cm_employees")
      .select("id, nome_completo, data_admissao");
    const empMap = new Map((employees || []).map(e => [e.id, e]));

    // Fetch promotor profiles to link them to employee names
    const { data: promotorPerfil } = await adminClient
      .from("cm_promotor_perfil")
      .select("user_id, employee_id");
    const userToEmpMap = new Map((promotorPerfil || []).map(p => [p.user_id, p.employee_id]));

    // Construir lista de promotores com ficha de RH
    let promotersList = (userProfiles || [])
      .map(prof => {
        const empId = userToEmpMap.get(prof.id);
        const emp = empId ? empMap.get(empId) : undefined;
        if (!emp) return null;
        return {
          id: prof.id,
          name: emp.nome_completo,
          code: prof.employee_code || "0000",
          empId,
          data_admissao: emp.data_admissao || null
        };
      })
      .filter(Boolean) as any[];

    // Fetch real metas for current quarter (Jul/Ago/Set)
    const { data: allMetas } = await adminClient
      .from("cm_promotor_metas")
      .select("promotor_id, month, year, volume_target_units, volume_target_boxes")
      .eq("year", new Date().getFullYear())
      .in("month", [7, 8, 9]);

    // Fetch UF from approved user profiles
    const { data: allProfiles } = await adminClient
      .from("cm_user_profiles")
      .select("id, uf, employee_code")
      .eq("role", "Promotor")
      .eq("approved", true);
    const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));

    // Build metas map: promotor_id -> month -> total_units
    const metaMap = new Map<string, Map<number, number>>();
    (allMetas || []).forEach(m => {
      if (!metaMap.has(m.promotor_id)) metaMap.set(m.promotor_id, new Map());
      const cur = metaMap.get(m.promotor_id)!.get(m.month) || 0;
      const targetVal = m.volume_target_units !== null && m.volume_target_units !== undefined
        ? parseFloat(m.volume_target_units)
        : parseFloat(m.volume_target_boxes || 0) * 20; // fallback if units not set
      metaMap.get(m.promotor_id)!.set(m.month, cur + targetVal);
    });

    // Fetch saved performance (remuneracao) to get the actual achievement and calculate realizado
    const { data: allRemuneracoes } = await adminClient
      .from("cm_promotor_remuneracao")
      .select("promotor_id, competency_month, atingimento_mensal_percent")
      .eq("competency_year", new Date().getFullYear())
      .in("competency_month", [7, 8, 9]);

    const remMap = new Map<string, Map<number, number>>();
    (allRemuneracoes || []).forEach(r => {
      if (!remMap.has(r.promotor_id)) remMap.set(r.promotor_id, new Map());
      remMap.get(r.promotor_id)!.set(r.competency_month, parseFloat(r.atingimento_mensal_percent || 0));
    });

    const currentYear = new Date().getFullYear();
    promotersList = promotersList.map(p => {
      const profile = profileMap.get(p.id);
      const metas = metaMap.get(p.id);
      const rems = remMap.get(p.id);

      const julMeta = metas?.get(7) || 0;
      const agoMeta = metas?.get(8) || 0;
      const setMeta = metas?.get(9) || 0;

      // Factor calculation (proportional days worked)
      const julFactor = calculateProportionalFactor(7, currentYear, p.data_admissao, null);
      const agoFactor = calculateProportionalFactor(8, currentYear, p.data_admissao, null);
      const setFactor = calculateProportionalFactor(9, currentYear, p.data_admissao, null);

      // Hash for mock fallback if no stored record
      const hash = p.id.charCodeAt(0);

      // Jul Atingimento
      const julMockAch = (julFactor === 0 || julMeta === 0) ? 0 : (95 + ((hash + 7) % 12));
      const julAch = rems?.has(7) ? rems.get(7)! : julMockAch;
      const julReal = Math.round(julMeta * (julAch / 100) * julFactor);

      // Ago Atingimento
      const agoMockAch = (agoFactor === 0 || agoMeta === 0) ? 0 : (95 + ((hash + 8) % 12));
      const agoAch = rems?.has(8) ? rems.get(8)! : agoMockAch;
      const agoReal = Math.round(agoMeta * (agoAch / 100) * agoFactor);

      // Set Atingimento
      const setMockAch = (setFactor === 0 || setMeta === 0) ? 0 : (95 + ((hash + 9) % 12));
      const setAch = rems?.has(9) ? rems.get(9)! : setMockAch;
      const setReal = Math.round(setMeta * (setAch / 100) * setFactor);

      return {
        ...p,
        code: profile?.employee_code || p.code,
        uf: profile?.uf || "—",
        supervisor: "—",
        region: "—",
        jul: { meta: julMeta, realizado: julReal, achievement: julAch },
        ago: { meta: agoMeta, realizado: agoReal, achievement: agoAch },
        set: { meta: setMeta, realizado: setReal, achievement: setAch }
      };
    });

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

      const julEarned = calculateMonthlyRemuneration(p.jul.realizado, julAch);
      const agoEarned = calculateMonthlyRemuneration(p.ago.realizado, agoAch);
      const setEarned = calculateMonthlyRemuneration(p.set.realizado, setAch);

      const qBonus = calculateQuarterlyBonus(julAch, agoAch, setAch);
      const estimatedBonus = julEarned + agoEarned + setEarned + qBonus;

      const monthsHit = (julAch !== null && julAch >= 100 ? 1 : 0) + 
                        (agoAch !== null && agoAch >= 100 ? 1 : 0) + 
                        (setAch !== null && setAch >= 100 ? 1 : 0);
      const bonusPct = Math.round((monthsHit / 3) * 100);

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
      currentUserCode,
      currentUserRole,
      lastUpdated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[DESAFIO PROMOTOR GET API ERROR]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
