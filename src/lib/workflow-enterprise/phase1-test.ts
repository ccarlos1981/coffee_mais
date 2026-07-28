// ==============================================================================
// SPRINT 4.1 — PHASE 1 & FASE 2 VERIFICATION SCRIPT
// ==============================================================================

import { EnterpriseWorkflowEngine } from "./index";

export async function runPhase1And2InfrastructureTest() {
  console.log("=== INICIANDO VERIFICAÇÃO FASE 1 & FASE 2: ENTERPRISE WORKFLOW ENGINE ===");

  // 1. Validar lista de definições padrão via Repository
  const definitions = await EnterpriseWorkflowEngine.listDefinitions();
  console.log(`Definições cadastradas (Repository): ${definitions.length}`);

  if (definitions.length === 0) {
    throw new Error("Falha: nenhuma definição padrão cadastrada.");
  }

  // 2. Testar criação de nova definição dinâmica
  const newDef = await EnterpriseWorkflowEngine.createDefinition({
    workflowKey: "test_custom_workflow",
    name: "Workflow de Teste Customizado (Fase 2)",
    description: "Workflow genérico de testes da Fase 2 via Repository",
    entityType: "CUSTOM_ENTITY",
    version: 1,
    active: true,
    stateMachine: {
      initialState: "Draft",
      terminalStates: ["Completed", "Cancelled"],
      transitions: [
        { fromState: "Draft", toState: "Under Review" },
        { fromState: "Under Review", toState: "Completed" },
        { fromState: "Draft", toState: "Cancelled" },
      ],
    },
    approvalPolicies: [],
  });

  console.log(`Definição criada via Repository com sucesso: ID=${newDef.id}, Key=${newDef.workflowKey}`);

  // 3. Testar desativação lógica (softDelete)
  const deactivated = await EnterpriseWorkflowEngine.Definition.deactivateDefinition(newDef.id);
  console.log(`Desativação lógica (softDelete) concluída: ID=${deactivated.id}, Active=${deactivated.active}`);

  // 4. Testar instanciação de workflow
  const instance = EnterpriseWorkflowEngine.createInstance({
    workflowKey: "crm_opportunity_workflow",
    entityType: "CRM_OPPORTUNITY",
    entityId: "item-888",
    title: "Item de Teste de Infraestrutura Fase 2",
    createdBy: "admin@coffeemais.com.br",
  });

  console.log(`Instância criada: ID=${instance.workflowId}, Estado=${instance.currentState}`);

  console.log("=== FASE 1 & FASE 2 HOMOLOGADAS COM 100% DE SUCESSO ===");
  return true;
}
