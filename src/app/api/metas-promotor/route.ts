import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProdutoConversaoService } from "@/lib/services/produto-conversao-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper to compute weighted average conversion factor (unidades/caixa) for a specific network based on history
async function obterFatorConversaoRede(adminClient: any, conversaoService: ProdutoConversaoService, rede: string, uf: string): Promise<number> {
  const sql = `
    SELECT p.id as product_id,
           SUM(s.quantity)::numeric as volume_boxes
    FROM sales s
    JOIN products p ON UPPER(TRIM(s.product)) = UPPER(TRIM(p.name))
    WHERE s.ano = 2026 AND s.mes BETWEEN 1 AND 6 
      AND UPPER(TRIM(s.rede)) = UPPER(TRIM($1))
      AND UPPER(TRIM(s.uf)) = UPPER(TRIM($2))
    GROUP BY p.id
  `;
  const { data, error } = await adminClient.rpc("execute_readonly_query", {
    query_text: sql.replace("$1", `'${rede.replace(/'/g, "''")}'`).replace("$2", `'${uf.replace(/'/g, "''")}'`)
  });

  if (error || !data || data.length === 0) {
    return 20.0; // Fallback standard (Café 250g)
  }

  let totalBoxes = 0;
  let totalUnits = 0;

  for (const row of data) {
    const boxes = parseFloat(row.volume_boxes || 0);
    totalBoxes += boxes;
    try {
      const productId = parseInt(row.product_id, 10);
      totalUnits += conversaoService.caixasParaUnidades(productId, boxes);
    } catch (err) {}
  }

  return totalBoxes > 0 ? (totalUnits / totalBoxes) : 20.0;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    // Get params
    const { searchParams } = new URL(request.url);
    const planningCycle = searchParams.get("planning_cycle") || "2026_Q3";
    const version = parseInt(searchParams.get("version") || "1", 10);
    const targetType = searchParams.get("target_type") || "revenue";

    // Initialize Domain Conversion Service
    const conversaoService = await ProdutoConversaoService.init(adminClient);

    // 1. Fetch user role
    const { data: profile } = await adminClient
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const userRole = profile?.role || "Trade";

    // 2. Fetch all approved promoters
    const { data: userProfiles, error: upErr } = await adminClient
      .from("cm_user_profiles")
      .select("id, role, employee_code")
      .eq("role", "Promotor")
      .eq("approved", true);

    if (upErr) throw upErr;

    // Fetch employee names
    const { data: employees } = await adminClient
      .from("cm_employees")
      .select("id, nome_completo");
    const empNameMap = new Map((employees || []).map(e => [e.id, e.nome_completo]));

    // Fetch promoter profiles
    const { data: promotorPerfil } = await adminClient
      .from("cm_promotor_perfil")
      .select("user_id, employee_id");
    const userToEmpMap = new Map((promotorPerfil || []).map(p => [p.user_id, p.employee_id]));

    // 3. Fetch active networks
    let { data: dbMetaNetworks, error: netErr } = await adminClient
      .from("cm_promotor_meta_network")
      .select("promotor_id, rede, uf")
      .eq("active", true);

    if (netErr) throw netErr;

    // Group dbMetaNetworks by promotor_id
    const metaNetworksMap = new Map<string, { rede: string; uf: string }[]>();
    (dbMetaNetworks || []).forEach(row => {
      if (!metaNetworksMap.has(row.promotor_id)) {
        metaNetworksMap.set(row.promotor_id, []);
      }
      metaNetworksMap.get(row.promotor_id)!.push({ rede: row.rede, uf: row.uf });
    });

    // 4. Fetch sales history (Jan-Jun 2026) at SKU level to perform deterministic conversions
    const sqlHistory = `
      SELECT s.rede, s.uf, s.mes, p.id as product_id,
             SUM(s.net_value)::numeric as faturamento,
             SUM(s.quantity)::numeric as volume_boxes
      FROM sales s
      JOIN products p ON UPPER(TRIM(s.product)) = UPPER(TRIM(p.name))
      WHERE s.ano = 2026 AND s.mes BETWEEN 1 AND 6 
      GROUP BY s.rede, s.uf, s.mes, p.id
    `;
    const { data: salesHistoryRes, error: rpcErr } = await adminClient.rpc("execute_readonly_query", { query_text: sqlHistory });
    if (rpcErr) console.error("History query error:", rpcErr.message);
    const salesHistory = salesHistoryRes || [];

    const historyMap = new Map<string, Record<number, { faturamento: number; volume: number }>>();
    const networkTotalsMap = new Map<string, { totalBoxes: number; totalUnits: number }>();

    salesHistory.forEach((row: any) => {
      const key = `${row.rede.toUpperCase()}_${row.uf.toUpperCase()}`;
      if (!historyMap.has(key)) {
        historyMap.set(key, {});
      }
      if (!networkTotalsMap.has(key)) {
        networkTotalsMap.set(key, { totalBoxes: 0, totalUnits: 0 });
      }

      const faturamento = parseFloat(row.faturamento || 0);
      const boxes = parseFloat(row.volume_boxes || 0);
      let volume = boxes;

      if (targetType === "volume") {
        try {
          const productId = parseInt(row.product_id, 10);
          volume = conversaoService.caixasParaUnidades(productId, boxes);
        } catch (err: any) {
          throw new Error(`Erro de conversão no histórico: ${err.message}`);
        }
      }

      if (!historyMap.get(key)![row.mes]) {
        historyMap.get(key)![row.mes] = { faturamento: 0, volume: 0 };
      }
      historyMap.get(key)![row.mes].faturamento += faturamento;
      historyMap.get(key)![row.mes].volume += volume;

      // Accumulate for network-level factor
      const totals = networkTotalsMap.get(key)!;
      totals.totalBoxes += boxes;
      try {
        const productId = parseInt(row.product_id, 10);
        totals.totalUnits += conversaoService.caixasParaUnidades(productId, boxes);
      } catch (err) {}
    });

    // 5. Fetch saved goals from cm_promotor_metas for this cycle and version
    const { data: savedMetas } = await adminClient
      .from("cm_promotor_metas")
      .select("*")
      .eq("planning_cycle", planningCycle)
      .eq("version", version);

    const savedMetasMap = new Map<string, any[]>();
    (savedMetas || []).forEach(meta => {
      if (!savedMetasMap.has(meta.promotor_id)) {
        savedMetasMap.set(meta.promotor_id, []);
      }
      savedMetasMap.get(meta.promotor_id)!.push(meta);
    });

    // 6. Construct Promoters list
    const promotersData = (userProfiles || [])
      .map(prof => {
        const empId = userToEmpMap.get(prof.id);
        let name = empId ? empNameMap.get(empId) : undefined;
        
        if (!name) return null;

        let supervisor = "—";

        // Load networks list
        const networksList = metaNetworksMap.get(prof.id) || [];
        const promoterSavedGoals = savedMetasMap.get(prof.id) || [];

        // Map networks to include history (Jan-Jun) and goals (Jul, Ago, Set)
        const networks = networksList.map(net => {
          const netKey = `${net.rede.toUpperCase()}_${net.uf.toUpperCase()}`;
          const histData = historyMap.get(netKey) || {};

          const history: number[] = [];
          for (let m = 1; m <= 6; m++) {
            history.push(histData[m]?.volume || 0);
          }

          const goals: number[] = [0, 0, 0];
          let status = "DRAFT";
          let requerConversao = false;
          
          const julGoal = promoterSavedGoals.find(g => g.rede === net.rede && g.uf === net.uf && g.month === 7);
          const agoGoal = promoterSavedGoals.find(g => g.rede === net.rede && g.uf === net.uf && g.month === 8);
          const setGoal = promoterSavedGoals.find(g => g.rede === net.rede && g.uf === net.uf && g.month === 9);

          if (targetType === "volume") {
            // Jul
            if (julGoal) {
              status = julGoal.status;
              if (julGoal.volume_target_units !== null && julGoal.volume_target_units !== undefined) {
                goals[0] = parseFloat(julGoal.volume_target_units);
              } else {
                goals[0] = 0;
                if (parseFloat(julGoal.volume_target_boxes || 0) > 0) {
                  requerConversao = true;
                }
              }
            }
            // Ago
            if (agoGoal) {
              if (agoGoal.volume_target_units !== null && agoGoal.volume_target_units !== undefined) {
                goals[1] = parseFloat(agoGoal.volume_target_units);
              } else {
                goals[1] = 0;
                if (parseFloat(agoGoal.volume_target_boxes || 0) > 0) {
                  requerConversao = true;
                }
              }
            }
            // Set
            if (setGoal) {
              if (setGoal.volume_target_units !== null && setGoal.volume_target_units !== undefined) {
                goals[2] = parseFloat(setGoal.volume_target_units);
              } else {
                goals[2] = 0;
                if (parseFloat(setGoal.volume_target_boxes || 0) > 0) {
                  requerConversao = true;
                }
              }
            }
          } else {
            // Revenue / Sellout
            if (julGoal) {
              status = julGoal.status;
              goals[0] = targetType === "sellout" ? parseFloat(julGoal.sellout_target) : parseFloat(julGoal.revenue_target);
            }
            if (agoGoal) {
              goals[1] = targetType === "sellout" ? parseFloat(agoGoal.sellout_target) : parseFloat(agoGoal.revenue_target);
            }
            if (setGoal) {
              goals[2] = targetType === "sellout" ? parseFloat(setGoal.sellout_target) : parseFloat(setGoal.revenue_target);
            }
          }

          return {
            rede: net.rede,
            uf: net.uf,
            history,
            goals,
            status,
            requerConversao
          };
        });

        const totalHistory = networks.reduce((sum, net) => sum + net.history.reduce((a, b) => a + b, 0), 0);
        const monthlyAverage = totalHistory / 6;
        const totalGoal = networks.reduce((sum, net) => sum + net.goals.reduce((a, b) => a + b, 0), 0);

        return {
          id: prof.id,
          employee_code: prof.employee_code,
          name,
          supervisor,
          networks,
          stats: {
            totalHistory: parseFloat(totalHistory.toFixed(2)),
            monthlyAverage: parseFloat(monthlyAverage.toFixed(2)),
            totalGoal: parseFloat(totalGoal.toFixed(2)),
            quarter_target: totalGoal,
            quarter_achieved: 0,
            quarter_gap: totalGoal
          }
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data: promotersData,
      role: userRole
    });

  } catch (error: any) {
    console.error("[METAS PROMOTOR GET API ERROR]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      planning_cycle, 
      version, 
      promoters, 
      action,
      target_type,
      single_network,
      promoter_id,
      network
    } = body;

    if (!planning_cycle || !version) {
      return NextResponse.json({ success: false, error: "Dados incompletos para salvar." }, { status: 400 });
    }

    const conversaoService = await ProdutoConversaoService.init(adminClient);

    // Scenario A: Save only a single network row reactively
    if (single_network) {
      if (!promoter_id || !network) {
        return NextResponse.json({ success: false, error: "Dados da rede incompletos para salvar." }, { status: 400 });
      }

      // 1. Sync active network
      await adminClient
        .from("cm_promotor_meta_network")
        .upsert([{
          promotor_id: promoter_id,
          rede: network.rede,
          uf: network.uf,
          active: true
        }], { onConflict: "promotor_id,rede,uf" });

      // 2. Compute the exact network conversion factor
      const fatorRede = await obterFatorConversaoRede(adminClient, conversaoService, network.rede, network.uf);

      // 3. Prepare goals
      const rowsToUpsert: any[] = [];
      const months = [7, 8, 9];
      
      const qTargetUnits = parseFloat((network.goals[0] || 0)) + parseFloat((network.goals[1] || 0)) + parseFloat((network.goals[2] || 0));
      const qTargetBoxes = qTargetUnits / fatorRede;

      months.forEach((m, idx) => {
        const valUnits = parseFloat(network.goals[idx] || 0);
        const valBoxes = valUnits / fatorRede;

        const row: any = {
          promotor_id: promoter_id,
          promotor_name_snapshot: body.promoter_name || "Promotor",
          rede: network.rede,
          uf: network.uf,
          planning_cycle,
          version: parseInt(version, 10),
          year: 2026,
          month: m,
          status: network.status || "DRAFT",
          updated_by: user.id,
          updated_at: new Date().toISOString(),
          created_by: user.id
        };

        if (target_type === "volume") {
          row.volume_target_units = valUnits;
          row.volume_target_boxes = valBoxes;
          row.quarter_target = qTargetBoxes;
          row.quarter_gap = qTargetBoxes;
        } else if (target_type === "sellout") {
          row.sellout_target = valUnits;
          row.quarter_target = qTargetUnits;
          row.quarter_gap = qTargetUnits;
        } else {
          row.revenue_target = valUnits;
          row.quarter_target = qTargetUnits;
          row.quarter_gap = qTargetUnits;
        }

        rowsToUpsert.push(row);
      });

      if (rowsToUpsert.length > 0) {
        const { error: upsertErr } = await adminClient
          .from("cm_promotor_metas")
          .upsert(rowsToUpsert, { 
            onConflict: "promotor_id,rede,uf,planning_cycle,version,year,month" 
          });

        if (upsertErr) throw upsertErr;
      }

      // Write audit log
      await adminClient.from("cm_audit_logs").insert({
        user_id: user.id,
        action: "METAS_PROMOTOR_SALVAR_REDE",
        table_name: "cm_promotor_metas",
        record_id: `${promoter_id}_${network.rede}_${network.uf}`,
        details: { planning_cycle, version, rede: network.rede, uf: network.uf }
      });

      return NextResponse.json({ success: true, message: `Meta de ${network.rede} (${network.uf}) salva com sucesso!` });
    }

    // Scenario B: Standard bulk action (submit, approve, unlock)
    if (!promoters) {
      return NextResponse.json({ success: false, error: "Lista de promotores ausente." }, { status: 400 });
    }

    let newStatus = "DRAFT";
    if (action === "submit") newStatus = "SUBMITTED";
    else if (action === "approve") newStatus = "LOCKED";
    else if (action === "unlock") newStatus = "DRAFT";

    // 1. Sync active network profiles
    const activeNetworkRows: any[] = [];
    promoters.forEach((prom: any) => {
      prom.networks.forEach((net: any) => {
        activeNetworkRows.push({
          promotor_id: prom.id,
          rede: net.rede,
          uf: net.uf,
          active: true
        });
      });
    });

    for (const prom of promoters) {
      await adminClient
        .from("cm_promotor_meta_network")
        .update({ active: false })
        .eq("promotor_id", prom.id);
    }

    if (activeNetworkRows.length > 0) {
      const { error: syncErr } = await adminClient
        .from("cm_promotor_meta_network")
        .upsert(activeNetworkRows, {
          onConflict: "promotor_id,rede,uf"
        });
      if (syncErr) throw syncErr;
    }

    // 2. Prepare target planning rows
    const rowsToUpsert: any[] = [];

    for (const prom of promoters) {
      for (const net of prom.networks) {
        const fatorRede = await obterFatorConversaoRede(adminClient, conversaoService, net.rede, net.uf);
        const months = [7, 8, 9];
        
        const qTargetUnits = parseFloat((net.goals[0] || 0)) + parseFloat((net.goals[1] || 0)) + parseFloat((net.goals[2] || 0));
        const qTargetBoxes = qTargetUnits / fatorRede;

        months.forEach((m, idx) => {
          const valUnits = parseFloat(net.goals[idx] || 0);
          const valBoxes = valUnits / fatorRede;

          const baseRow: any = {
            promotor_id: prom.id,
            promotor_name_snapshot: prom.name,
            rede: net.rede,
            uf: net.uf,
            planning_cycle,
            version: parseInt(version, 10),
            year: 2026,
            month: m,
            status: action === "save" ? (net.status || "DRAFT") : newStatus,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
            created_by: user.id
          };

          if (target_type === "volume") {
            baseRow.volume_target_units = valUnits;
            baseRow.volume_target_boxes = valBoxes;
            baseRow.quarter_target = qTargetBoxes;
            baseRow.quarter_gap = qTargetBoxes;
          } else if (target_type === "sellout") {
            baseRow.sellout_target = valUnits;
            baseRow.quarter_target = qTargetUnits;
            baseRow.quarter_gap = qTargetUnits;
          } else {
            baseRow.revenue_target = valUnits;
            baseRow.quarter_target = qTargetUnits;
            baseRow.quarter_gap = qTargetUnits;
          }

          rowsToUpsert.push(baseRow);
        });
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await adminClient
        .from("cm_promotor_metas")
        .upsert(rowsToUpsert, { 
          onConflict: "promotor_id,rede,uf,planning_cycle,version,year,month" 
        });

      if (upsertErr) throw upsertErr;
    }

    // Write audit log
    await adminClient.from("cm_audit_logs").insert({
      user_id: user.id,
      action: `METAS_PROMOTOR_${action.toUpperCase()}`,
      table_name: "cm_promotor_metas",
      record_id: planning_cycle,
      details: { planning_cycle, version, count: rowsToUpsert.length, status: newStatus }
    });

    return NextResponse.json({ success: true, message: "Ação concluída com sucesso!" });

  } catch (error: any) {
    console.error("[METAS PROMOTOR POST API ERROR]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
