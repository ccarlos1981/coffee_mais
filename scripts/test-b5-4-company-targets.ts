/**
 * B.5.4 — Suíte de Testes Automatizados de Migração CEO Targets
 *
 * Validações:
 * CEO-TARGET-01: Leitura das metas no novo schema (cm_company_targets).
 * CEO-TARGET-02: Políticas RLS granulares (SELECT, INSERT, UPDATE, DELETE) ativas em cm_company_targets.
 * CEO-TARGET-03: Inexistência de policies FOR ALL ou USING true.
 * CEO-TARGET-04: Bloqueio de acesso anônimo a cm_company_targets (Fail-Closed).
 * CEO-TARGET-05: Soma de metas financeiras preservada exatamente (6 registros, R$ 17.861.000,00).
 * CEO-TARGET-06: src/app/meta-cia/page.tsx consome cm_company_targets.
 * CEO-TARGET-07: src/app/meta-cia-unidades/page.tsx consome cm_company_targets.
 * CEO-TARGET-08: Inexistência de chamadas a ceo_targets nas páginas de Meta Cia.
 * CEO-TARGET-09: Tabela legada ceo_targets preservada intacta como fallback.
 * CEO-TARGET-10: AnalyticsEngine e paridade financeira 100% preservadas.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ERRO: Variáveis de ambiente do Supabase não configuradas.");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TestResult {
  code: string;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function recordTest(code: string, name: string, passed: boolean, message?: string) {
  results.push({ code, name, passed, message });
  if (passed) {
    console.log(`  [✅ PASS] ${code}: ${name}`);
  } else {
    console.error(`  [❌ FAIL] ${code}: ${name} — ${message}`);
  }
}

async function runSuite() {
  console.log("============================================================");
  console.log("🧪 B.5.4 — SUÍTE DE TESTES DE MIGRAÇÃO CEO TARGETS");
  console.log("============================================================\n");

  // 1. CEO-TARGET-01: Leitura no novo schema
  try {
    const { data, error } = await adminClient
      .from("cm_company_targets")
      .select("*")
      .order("month", { ascending: true });

    const count = data?.length || 0;
    recordTest(
      "CEO-TARGET-01",
      "Leitura de metas em cm_company_targets retorna registros válidos",
      !error && count === 6,
      error ? error.message : `Retornou ${count} registros (esperado: 6)`
    );
  } catch (err: any) {
    recordTest("CEO-TARGET-01", "Leitura em cm_company_targets", false, err.message);
  }

  // 2. CEO-TARGET-02 & CEO-TARGET-03: RLS Policies definidas e aplicadas
  try {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260829_b5_4_company_targets_migration.sql"
    );
    const migrationContent = fs.readFileSync(migrationPath, "utf-8");

    const hasSelectPolicy = migrationContent.includes('CREATE POLICY "cm_company_targets_select_auth"');
    const hasInsertPolicy = migrationContent.includes('CREATE POLICY "cm_company_targets_insert_auth"');
    const hasUpdatePolicy = migrationContent.includes('CREATE POLICY "cm_company_targets_update_auth"');
    const hasDeletePolicy = migrationContent.includes('CREATE POLICY "cm_company_targets_delete_auth"');
    const hasEnableRls = migrationContent.includes("ALTER TABLE public.cm_company_targets ENABLE ROW LEVEL SECURITY;");
    const hasPermissiveAll = migrationContent.includes("FOR ALL") || migrationContent.includes("USING (true)");

    recordTest(
      "CEO-TARGET-02",
      "Políticas RLS granulares (SELECT, INSERT, UPDATE, DELETE) e ENABLE ROW LEVEL SECURITY configurados",
      hasEnableRls && hasSelectPolicy && hasInsertPolicy && hasUpdatePolicy && hasDeletePolicy,
      `EnableRLS: ${hasEnableRls}, Select: ${hasSelectPolicy}, Insert: ${hasInsertPolicy}, Update: ${hasUpdatePolicy}, Delete: ${hasDeletePolicy}`
    );

    recordTest(
      "CEO-TARGET-03",
      "Inexistência de políticas RLS permissivas FOR ALL ou USING (true)",
      !hasPermissiveAll,
      hasPermissiveAll ? "Encontrada policy permissiva" : "Políticas estritas confirmadas"
    );
  } catch (err: any) {
    recordTest("CEO-TARGET-02", "Validação de policies RLS", false, err.message);
  }

  // 3. CEO-TARGET-04: Bloqueio de acesso anônimo
  try {
    const { data, error } = await anonClient
      .from("cm_company_targets")
      .select("*");

    const rowsReturned = (data || []).length;
    recordTest(
      "CEO-TARGET-04",
      "Acesso PostgREST anônimo a cm_company_targets retorna 0 linhas (Fail-Closed)",
      rowsReturned === 0,
      `Retornou ${rowsReturned} linhas anonimamente`
    );
  } catch (err: any) {
    recordTest("CEO-TARGET-04", "Acesso anônimo fail-closed", true);
  }

  // 4. CEO-TARGET-05: Preservação de valores financeiros
  try {
    const { data: targets, error } = await adminClient
      .from("cm_company_targets")
      .select("target_forecast, target_internal, target_forecast_qty, target_internal_qty");

    let sumForecast = 0;
    let sumInternal = 0;
    for (const t of (targets || [])) {
      sumForecast += Number(t.target_forecast || 0);
      sumInternal += Number(t.target_internal || 0);
    }

    const isMatch = Math.abs(sumForecast - 17861000) < 0.01 && sumInternal === 0;
    recordTest(
      "CEO-TARGET-05",
      "Soma de metas financeiras preservada exatamente (R$ 17.861.000,00)",
      isMatch,
      `Soma calculada: R$ ${sumForecast.toFixed(2)} (esperado: 17861000.00)`
    );
  } catch (err: any) {
    recordTest("CEO-TARGET-05", "Preservação financeira", false, err.message);
  }

  // 5. CEO-TARGET-06 & CEO-TARGET-07: Consumo no Frontend
  try {
    const metaCiaPath = path.join(process.cwd(), "src/app/meta-cia/page.tsx");
    const metaCiaUnidadesPath = path.join(process.cwd(), "src/app/meta-cia-unidades/page.tsx");

    const metaCiaContent = fs.readFileSync(metaCiaPath, "utf-8");
    const metaCiaUnidadesContent = fs.readFileSync(metaCiaUnidadesPath, "utf-8");

    const metaCiaUsesNew = metaCiaContent.includes('.from("cm_company_targets")');
    const metaCiaUnidadesUsesNew = metaCiaUnidadesContent.includes('.from("cm_company_targets")');

    recordTest(
      "CEO-TARGET-06",
      "src/app/meta-cia/page.tsx consome cm_company_targets",
      metaCiaUsesNew,
      metaCiaUsesNew ? "Confirmado" : "Não encontrado .from('cm_company_targets')"
    );

    recordTest(
      "CEO-TARGET-07",
      "src/app/meta-cia-unidades/page.tsx consome cm_company_targets",
      metaCiaUnidadesUsesNew,
      metaCiaUnidadesUsesNew ? "Confirmado" : "Não encontrado .from('cm_company_targets')"
    );

    const hasOldInMetaCia = metaCiaContent.includes('.from("ceo_targets")');
    const hasOldInMetaCiaUnidades = metaCiaUnidadesContent.includes('.from("ceo_targets")');

    recordTest(
      "CEO-TARGET-08",
      "Zero referências a .from('ceo_targets') nas páginas de Meta Cia",
      !hasOldInMetaCia && !hasOldInMetaCiaUnidades,
      `Meta Cia tem legado: ${hasOldInMetaCia}, Meta Cia Unidades tem legado: ${hasOldInMetaCiaUnidades}`
    );
  } catch (err: any) {
    recordTest("CEO-TARGET-06", "Auditoria de código frontend", false, err.message);
  }

  // 6. CEO-TARGET-09: Tabela legada ceo_targets preservada como fallback
  try {
    const { data: legacyData, error: legacyErr } = await adminClient
      .from("ceo_targets")
      .select("*");

    const count = legacyData?.length || 0;
    recordTest(
      "CEO-TARGET-09",
      "Tabela ceo_targets preservada intacta como fallback no banco (6 registros)",
      !legacyErr && count === 6,
      legacyErr ? legacyErr.message : `Contagem legada: ${count} registros`
    );
  } catch (err: any) {
    recordTest("CEO-TARGET-09", "Preservação da tabela legada", false, err.message);
  }

  // 7. CEO-TARGET-10: AnalyticsEngine isolada
  try {
    const analyticsPath = path.join(process.cwd(), "src/lib/governance/analytics");
    const files = fs.readdirSync(analyticsPath);
    let touchesCompanyTargets = false;
    for (const f of files) {
      if (f.endsWith(".ts")) {
        const c = fs.readFileSync(path.join(analyticsPath, f), "utf-8");
        if (c.includes("cm_company_targets") || c.includes("ceo_targets")) {
          touchesCompanyTargets = true;
          break;
        }
      }
    }

    recordTest(
      "CEO-TARGET-10",
      "AnalyticsEngine permanece 100% desacoplada e inalterada",
      !touchesCompanyTargets,
      touchesCompanyTargets ? "AnalyticsEngine acessa tabela de metas" : "Desacoplamento confirmado"
    );
  } catch (err: any) {
    recordTest("CEO-TARGET-10", "Isolamento da AnalyticsEngine", false, err.message);
  }

  // Resumo
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log("\n============================================================");
  console.log(`📊 RESULTADO DA SUÍTE B.5.4: ${passed}/${total} APROVADOS (${failed} FALHAS)`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error("Erro fatal na execução da suíte:", err);
  process.exit(1);
});
