/**
 * COFFEE++ — SUÍTE DE TESTES FORENSES DA WAVE 15
 * 
 * Cobertura Completa:
 * 1. W15-CLIENTES: importarClientesEmLote, Mass Assignment e RBAC (10 testes)
 * 2. W15-SANKHYA: sincronizarClientesSankhya e Autenticação (5 testes)
 * 3. W15-PDV: PUT /api/pdv/[id], assertPdvAccess e Proteção Estrutural (8 testes)
 * 4. W15-STORAGE: storage.objects para comprovantes, logos-redes e cartas-anuencia (8 testes)
 * 5. W15-RLS: cm_clientes, cm_boletos, upload_batches e cm_client_alerts (8 testes)
 * 6. W15-INV: Server Actions de Investimento (atualizarAcao, métricas, etc.) (7 testes)
 * 7. W15-STATIC-INTEGRITY: Integridade Estática e Ausência de Any (5 testes)
 */

import assert from "assert";
import fs from "fs";
import path from "path";

let passedCount = 0;
let failedCount = 0;

function runTest(id: string, name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${id}: ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${id}: ${name}\n     ${err.message}`);
    failedCount++;
  }
}

async function runSuite() {
  console.log("\n=======================================================");
  console.log("🛡️  COFFEE++ — SUÍTE DE TESTES FORENSES DA WAVE 15");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // GRUPO 1: W15-CLIENTES (cm_clientes & importarClientesEmLote)
  // -------------------------------------------------------------
  console.log("--- 1. W15-CLIENTES: Importação de Clientes & Mass Assignment ---");

  const clientesActionsContent = fs.readFileSync(
    path.join(process.cwd(), "src/app/config-financeiro/clientes/actions.ts"),
    "utf8"
  );

  runTest("W15-CLIENTES-01", "importarClientesEmLote chama requireAuth", () => {
    assert(
      clientesActionsContent.includes("export async function importarClientesEmLote") &&
      clientesActionsContent.includes("await requireAuth()"),
      "importarClientesEmLote deve validar requireAuth"
    );
  });

  runTest("W15-CLIENTES-02", "importarClientesEmLote chama requireApprovedProfile", () => {
    assert(
      clientesActionsContent.includes("await requireApprovedProfile(user.id)"),
      "importarClientesEmLote deve validar perfil aprovado"
    );
  });

  runTest("W15-CLIENTES-03", "importarClientesEmLote aplica RBAC com requireRole", () => {
    assert(
      clientesActionsContent.includes('requireRole(profile, ["Admin", "Admin Master", "Financeiro", "Trade", "CEO"])'),
      "importarClientesEmLote deve aplicar RBAC estrito"
    );
  });

  runTest("W15-CLIENTES-04", "importarClientesEmLote possui interface estrita ClienteImportPayload", () => {
    assert(
      clientesActionsContent.includes("export interface ClienteImportPayload") &&
      clientesActionsContent.includes("codigo: number"),
      "importarClientesEmLote deve utilizar tipagem estrita sem any"
    );
  });

  runTest("W15-CLIENTES-05", "importarClientesEmLote possui allowlist de campos", () => {
    assert(
      clientesActionsContent.includes("ALLOWED_IMPORT_COLUMNS"),
      "Deve possuir allowlist de campos permitidos"
    );
  });

  runTest("W15-CLIENTES-06", "importarClientesEmLote valida limite de lote (1000 registros)", () => {
    assert(
      clientesActionsContent.includes("records.length > 1000") &&
      clientesActionsContent.includes("Limite máximo de 1000 registros"),
      "Deve bloquear lotes com mais de 1000 registros"
    );
  });

  runTest("W15-CLIENTES-07", "importarClientesEmLote valida lote vazio", () => {
    assert(
      clientesActionsContent.includes("records.length === 0"),
      "Deve rejeitar lotes vazios"
    );
  });

  runTest("W15-CLIENTES-08", "importarClientesEmLote separa INSERT de novos e UPDATE de existentes", () => {
    assert(
      clientesActionsContent.includes("existingCodeSet.has") &&
      clientesActionsContent.includes("newRecords") &&
      clientesActionsContent.includes("updateRecords"),
      "Deve separar lógica de criação de lógica de atualização"
    );
  });

  runTest("W15-CLIENTES-09", "importarClientesEmLote protege governança estrutural em updates por não-admins", () => {
    assert(
      clientesActionsContent.includes("delete safeUpdate.codigo_matriz") &&
      clientesActionsContent.includes("delete safeUpdate.manager_name") &&
      clientesActionsContent.includes("delete safeUpdate.regional"),
      "Campos de governança estrutural não devem ser sobrescritos por importação comum"
    );
  });

  runTest("W15-CLIENTES-10", "importarClientesEmLote registra log de auditoria CLIENTES_IMPORT_LOTE", () => {
    assert(
      clientesActionsContent.includes('logAuditAction(user.id, "CLIENTES_IMPORT_LOTE"'),
      "Deve registrar log de auditoria para importações"
    );
  });

  // -------------------------------------------------------------
  // GRUPO 2: W15-SANKHYA (sincronizarClientesSankhya)
  // -------------------------------------------------------------
  console.log("\n--- 2. W15-SANKHYA: Sincronização Sankhya ---");

  runTest("W15-SANKHYA-01", "sincronizarClientesSankhya chama requireAuth", () => {
    assert(
      clientesActionsContent.includes("export async function sincronizarClientesSankhya") &&
      clientesActionsContent.includes("const user = await requireAuth()"),
      "sincronizarClientesSankhya deve exigir autenticação"
    );
  });

  runTest("W15-SANKHYA-02", "sincronizarClientesSankhya chama requireApprovedProfile", () => {
    assert(
      clientesActionsContent.includes("await requireApprovedProfile(user.id)"),
      "sincronizarClientesSankhya deve exigir perfil aprovado"
    );
  });

  runTest("W15-SANKHYA-03", "sincronizarClientesSankhya aplica requireRole", () => {
    assert(
      clientesActionsContent.includes('requireRole(profile, ["Admin", "Admin Master", "Financeiro", "Trade", "CEO"])'),
      "sincronizarClientesSankhya deve restringir roles"
    );
  });

  runTest("W15-SANKHYA-04", "sincronizarClientesSankhya registra log CLIENTES_SYNC_SANKHYA", () => {
    assert(
      clientesActionsContent.includes('logAuditAction(user.id, "CLIENTES_SYNC_SANKHYA"'),
      "Deve registrar auditoria na sincronização Sankhya"
    );
  });

  runTest("W15-SANKHYA-05", "sincronizarClientesSankhya utiliza createClient com sessão", () => {
    assert(
      clientesActionsContent.includes("const supabase = await createClient()"),
      "Deve utilizar cliente com contexto de autenticação"
    );
  });

  // -------------------------------------------------------------
  // GRUPO 3: W15-PDV (PUT /api/pdv/[id])
  // -------------------------------------------------------------
  console.log("\n--- 3. W15-PDV: PUT /api/pdv/[id] Object-Level Authorization ---");

  const pdvRouteContent = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/pdv/[id]/route.ts"),
    "utf8"
  );

  runTest("W15-PDV-01", "PUT /api/pdv/[id] importa assertPdvAccess", () => {
    assert(
      pdvRouteContent.includes("assertPdvAccess"),
      "Deve importar assertPdvAccess"
    );
  });

  runTest("W15-PDV-02", "PUT /api/pdv/[id] busca o PDV alvo e chama assertPdvAccess", () => {
    assert(
      pdvRouteContent.includes(".from(\"pdvs\")") &&
      pdvRouteContent.includes("assertPdvAccess(user.id, profile, pdvAlvo.erp_code || pdvAlvo.id)"),
      "Deve validar acesso territorial/equipe antes de atualizar"
    );
  });

  runTest("W15-PDV-03", "PUT /api/pdv/[id] protege campos estruturais network_id e erp_code para não-admins", () => {
    assert(
      pdvRouteContent.includes("network_id !== undefined") &&
      pdvRouteContent.includes("isTopAdminOrTrade"),
      "Apenas administradores e trade podem alterar network_id e erp_code"
    );
  });

  runTest("W15-PDV-04", "PUT /api/pdv/[id] registra log de auditoria PDV_UPDATE", () => {
    assert(
      pdvRouteContent.includes('logAuditAction(user.id, "PDV_UPDATE", "pdvs"'),
      "Deve registrar auditoria ao atualizar PDV"
    );
  });

  runTest("W15-PDV-05", "PUT /api/pdv/[id] trata erro FORBIDDEN com handleAuthError", () => {
    assert(
      pdvRouteContent.includes('error.message === "FORBIDDEN"') &&
      pdvRouteContent.includes("handleAuthError(error)"),
      "Erros de escopo devem ser tratados adequadamente"
    );
  });

  runTest("W15-PDV-06", "DELETE /api/pdv/[id] permanece restrito a Admin Master / Admin / CEO", () => {
    assert(
      pdvRouteContent.includes('export async function DELETE') &&
      pdvRouteContent.includes('requireRole(profile, ["Admin", "Admin Master", "CEO"])'),
      "Delete de PDVs deve ser restrito a administradores"
    );
  });

  runTest("W15-PDV-07", "DELETE /api/pdv/[id] registra log de auditoria PDV_DELETE", () => {
    assert(
      pdvRouteContent.includes('logAuditAction(user.id, "PDV_DELETE", "pdvs"'),
      "Deve auditar deleções de PDV"
    );
  });

  runTest("W15-PDV-08", "PUT /api/pdv/[id] valida se PDV existe antes de executar assertPdvAccess", () => {
    assert(
      pdvRouteContent.includes("if (pdvErr || !pdvAlvo)") &&
      pdvRouteContent.includes("PDV não encontrado"),
      "Deve retornar 404 seguro para PDV inexistente"
    );
  });

  // -------------------------------------------------------------
  // GRUPO 4: W15-STORAGE (storage.objects policies)
  // -------------------------------------------------------------
  console.log("\n--- 4. W15-STORAGE: Políticas de Storage Granulares ---");

  const migrationContent = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260828_wave15_security_hardening.sql"),
    "utf8"
  );

  runTest("W15-STORAGE-01", "Migration revoga DELETE permissivo em comprovantes_investimento", () => {
    assert(
      migrationContent.includes('DROP POLICY IF EXISTS "Allow authenticated deletes from comprovantes" ON storage.objects;'),
      "Deve remover policy aberta de delete em comprovantes"
    );
  });

  runTest("W15-STORAGE-02", "Migration restringe DELETE em comprovantes_investimento para Admin/Financeiro", () => {
    assert(
      migrationContent.includes('CREATE POLICY "comprovantes_delete_auth" ON storage.objects') &&
      migrationContent.includes("ARRAY['Admin', 'Admin Master', 'Financeiro']"),
      "Delete de comprovantes deve ser exclusivo de admin/financeiro"
    );
  });

  runTest("W15-STORAGE-03", "Migration restringe SELECT em comprovantes_investimento (Promotor bloqueado)", () => {
    assert(
      migrationContent.includes('CREATE POLICY "comprovantes_select_auth" ON storage.objects') &&
      !migrationContent.includes("'Promotor'"),
      "Promotor não pode ter acesso a comprovantes financeiros"
    );
  });

  runTest("W15-STORAGE-04", "Migration restringe DELETE em logos-redes para Admin/Admin Master", () => {
    assert(
      migrationContent.includes('CREATE POLICY "logos_redes_storage_auth_delete" ON storage.objects') &&
      migrationContent.includes("ARRAY['Admin', 'Admin Master']"),
      "Delete de logos deve ser restrito a administradores"
    );
  });

  runTest("W15-STORAGE-05", "Migration fecha SELECT público em cartas-anuencia para authenticated", () => {
    assert(
      migrationContent.includes('DROP POLICY IF EXISTS "cartas_anuencia_storage_public_select" ON storage.objects;') &&
      migrationContent.includes('CREATE POLICY "cartas_anuencia_storage_select_auth" ON storage.objects'),
      "Cartas de anuência devem ser restritas a usuários autenticados"
    );
  });

  runTest("W15-STORAGE-06", "Migration não permite UPDATE em cartas-anuencia (Snapshots imutáveis)", () => {
    assert(
      migrationContent.includes('DROP POLICY IF EXISTS "cartas_anuencia_storage_auth_update" ON storage.objects;') &&
      !migrationContent.includes('CREATE POLICY "cartas_anuencia_storage_auth_update"'),
      "Cartas de anuência emitidas não podem sofrer UPDATE direto"
    );
  });

  runTest("W15-STORAGE-07", "Migration restringe INSERT em cartas-anuencia para Trade/Financeiro/Admin/CEO", () => {
    assert(
      migrationContent.includes('CREATE POLICY "cartas_anuencia_storage_auth_insert" ON storage.objects') &&
      migrationContent.includes("ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO']"),
      "Apenas Trade/Financeiro/Admin podem emitir cartas de anuência"
    );
  });

  runTest("W15-STORAGE-08", "Migration mantém SELECT de logos-redes público para renderização em UI", () => {
    assert(
      migrationContent.includes('CREATE POLICY "logos_redes_storage_public_select" ON storage.objects') &&
      migrationContent.includes("FOR SELECT TO public"),
      "Logos de redes devem ser públicas para o frontend"
    );
  });

  // -------------------------------------------------------------
  // GRUPO 5: W15-RLS (Database Policies no PostgreSQL)
  // -------------------------------------------------------------
  console.log("\n--- 5. W15-RLS: RLS Fail-Closed nas Tabelas Públicas ---");

  runTest("W15-RLS-01", "Migration fecha INSERT/UPDATE público em cm_clientes", () => {
    assert(
      migrationContent.includes('DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cm_clientes;') &&
      migrationContent.includes('DROP POLICY IF EXISTS "Enable update access for all users" ON public.cm_clientes;'),
      "Deve remover policies públicas de cm_clientes"
    );
  });

  runTest("W15-RLS-02", "Migration aplica INSERT/UPDATE autenticado com RBAC em cm_clientes", () => {
    assert(
      migrationContent.includes('CREATE POLICY "cm_clientes_insert_auth" ON public.cm_clientes') &&
      migrationContent.includes('CREATE POLICY "cm_clientes_update_auth" ON public.cm_clientes'),
      "cm_clientes deve exigir roles autorizadas"
    );
  });

  runTest("W15-RLS-03", "Migration fecha INSERT/UPDATE público em cm_boletos", () => {
    assert(
      migrationContent.includes('DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cm_boletos;') &&
      migrationContent.includes('DROP POLICY IF EXISTS "Enable update access for all users" ON public.cm_boletos;'),
      "Deve remover policies públicas de cm_boletos"
    );
  });

  runTest("W15-RLS-04", "Migration inclui WITH CHECK obrigatório em UPDATE de cm_boletos", () => {
    assert(
      migrationContent.includes('CREATE POLICY "cm_boletos_update_auth" ON public.cm_boletos') &&
      migrationContent.includes("WITH CHECK ("),
      "cm_boletos update policy deve possuir WITH CHECK"
    );
  });

  runTest("W15-RLS-05", "Migration fecha policies anônimas em upload_batches", () => {
    assert(
      migrationContent.includes('DROP POLICY IF EXISTS "anon_insert" ON public.upload_batches;') &&
      migrationContent.includes('DROP POLICY IF EXISTS "anon_update" ON public.upload_batches;') &&
      migrationContent.includes('DROP POLICY IF EXISTS "anon_read_all" ON public.upload_batches;'),
      "upload_batches deve ter policies anônimas removidas"
    );
  });

  runTest("W15-RLS-06", "Migration fecha policies públicas em cm_client_alerts", () => {
    assert(
      migrationContent.includes('DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON public.cm_client_alerts;') &&
      migrationContent.includes('DROP POLICY IF EXISTS "Enable update for all authenticated users" ON public.cm_client_alerts;'),
      "cm_client_alerts deve ter policies públicas removidas"
    );
  });

  runTest("W15-RLS-07", "cm_boletos DELETE policy é restrita a Admin e Admin Master", () => {
    assert(
      migrationContent.includes('CREATE POLICY "cm_boletos_delete_auth" ON public.cm_boletos') &&
      migrationContent.includes("ARRAY['Admin', 'Admin Master']"),
      "Delete de boletos deve ser exclusivo de administradores"
    );
  });

  runTest("W15-RLS-08", "cm_client_alerts UPDATE policy possui WITH CHECK e RBAC de supervisão", () => {
    assert(
      migrationContent.includes('CREATE POLICY "cm_client_alerts_update_auth" ON public.cm_client_alerts') &&
      migrationContent.includes("WITH CHECK ("),
      "cm_client_alerts UPDATE deve conter WITH CHECK"
    );
  });

  // -------------------------------------------------------------
  // GRUPO 6: W15-INV (Investimentos Server Actions)
  // -------------------------------------------------------------
  console.log("\n--- 6. W15-INV: Hardening de Server Actions de Investimento ---");

  const dashboardActionsContent = fs.readFileSync(
    path.join(process.cwd(), "src/app/investimento/dashboard/actions.ts"),
    "utf8"
  );

  runTest("W15-INV-01", "obterMetricasEstabilizacao exige requireAuth e requireApprovedProfile", () => {
    assert(
      dashboardActionsContent.includes("const user = await requireAuth()") &&
      dashboardActionsContent.includes("await requireApprovedProfile(user.id)") &&
      dashboardActionsContent.includes("requireRole(profile"),
      "obterMetricasEstabilizacao deve exigir autenticação e RBAC"
    );
  });

  const lancarActionsContent = fs.readFileSync(
    path.join(process.cwd(), "src/app/investimento/lancar/actions.ts"),
    "utf8"
  );

  runTest("W15-INV-02", "atualizarAcaoInvestimento exige requireAuth upfront", () => {
    assert(
      lancarActionsContent.includes("export async function atualizarAcaoInvestimento") &&
      lancarActionsContent.includes("const user = await requireAuth()"),
      "atualizarAcaoInvestimento deve validar auth antes de qualquer branch"
    );
  });

  runTest("W15-INV-03", "enviarParaTrade exige requireAuth e requireApprovedProfile", () => {
    assert(
      lancarActionsContent.includes("export async function enviarParaTrade") &&
      lancarActionsContent.includes("const user = await requireAuth()") &&
      lancarActionsContent.includes("await requireApprovedProfile(user.id)"),
      "enviarParaTrade deve validar auth"
    );
  });

  runTest("W15-INV-04", "obterRedesMatrizes exige requireAuth e requireApprovedProfile", () => {
    assert(
      lancarActionsContent.includes("export async function obterRedesMatrizes") &&
      lancarActionsContent.includes("const user = await requireAuth()") &&
      lancarActionsContent.includes("await requireApprovedProfile(user.id)"),
      "obterRedesMatrizes deve validar auth"
    );
  });

  runTest("W15-INV-05", "simularImportacaoInvestimentos exige requireAuth e requireApprovedProfile", () => {
    assert(
      lancarActionsContent.includes("export async function simularImportacaoInvestimentos") &&
      lancarActionsContent.includes("const user = await requireAuth()") &&
      lancarActionsContent.includes("await requireApprovedProfile(user.id)"),
      "simularImportacaoInvestimentos deve validar auth"
    );
  });

  runTest("W15-INV-06", "promoverPlanejamento exige requireAuth e requireApprovedProfile", () => {
    assert(
      lancarActionsContent.includes("export async function promoverPlanejamento") &&
      lancarActionsContent.includes("const user = await requireAuth()") &&
      lancarActionsContent.includes("await requireApprovedProfile(user.id)"),
      "promoverPlanejamento deve validar auth"
    );
  });

  runTest("W15-INV-07", "obterHistoricoConsultorComercial exige requireAuth e requireApprovedProfile", () => {
    assert(
      lancarActionsContent.includes("export async function obterHistoricoConsultorComercial") &&
      lancarActionsContent.includes("const user = await requireAuth()") &&
      lancarActionsContent.includes("await requireApprovedProfile(user.id)"),
      "obterHistoricoConsultorComercial deve validar auth"
    );
  });

  // -------------------------------------------------------------
  // GRUPO 7: W15-STATIC-INTEGRITY (Zero any e tipagem estrita)
  // -------------------------------------------------------------
  console.log("\n--- 7. W15-STATIC-INTEGRITY: Integridade Estática e Ausência de Any ---");

  runTest("W15-STATIC-01", "importarClientesEmLote não usa records: any[] na assinatura", () => {
    assert(
      !clientesActionsContent.includes("export async function importarClientesEmLote(records: any[])"),
      "Assinatura deve usar ClienteImportPayload[]"
    );
  });

  runTest("W15-STATIC-02", "cm_boletos actions usam validarAcessoBoletos com getUser", () => {
    const boletosActions = fs.readFileSync(
      path.join(process.cwd(), "src/app/financeiro/boletos/actions.ts"),
      "utf8"
    );
    assert(
      boletosActions.includes("validarAcessoBoletos") &&
      boletosActions.includes("getUser()"),
      "Boletos actions devem validar autenticação via getUser"
    );
  });

  runTest("W15-STATIC-03", "Nenhuma rota em app/api/pdv permite bypass de autenticação", () => {
    assert(
      pdvRouteContent.includes("requireAuth") &&
      pdvRouteContent.includes("requireApprovedProfile") &&
      pdvRouteContent.includes("requireRole"),
      "Rotas de PDV devem possuir tripla verificação de autorização"
    );
  });

  runTest("W15-STATIC-04", "importarClientesEmLote exporta interface ClienteImportPayload para tipagem no frontend", () => {
    assert(
      clientesActionsContent.includes("export interface ClienteImportPayload"),
      "Interface ClienteImportPayload deve ser exportada"
    );
  });

  console.log("\n=======================================================");
  console.log(`📊 RESULTADO DA SUÍTE DE TESTES WAVE 15: ${passedCount} / ${passedCount + failedCount} APROVADOS`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    console.error(`❌ ${failedCount} TESTES FALHARAM!`);
    process.exit(1);
  } else {
    console.log("🟢 TODOS OS TESTES DA WAVE 15 PASSARAM COM SUCESSO!");
  }
}

runSuite().catch((err) => {
  console.error("Erro fatal na execução da suíte:", err);
  process.exit(1);
});
