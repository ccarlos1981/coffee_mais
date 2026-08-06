# 🚨 DO NOT BREAK — COMPONENTES E ARTEFATOS CRÍTICOS (COFFEE++)

**Data:** 05/08/2026 | **Status:** `CRITICAL_PROTECTION = ACTIVE` | **Nível de Risco:** 🔴 ALTO

---

## 1. OBJETOS CRÍTICOS DE BANCO DE DADOS (NÃO ALTERAR SEMAUDITORIA)

Os objetos abaixo formam o núcleo de estabilidade cadastral e financeira do Coffee++. **É EXPRESSAMENTE PROIBIDO** deletar, renomear ou alterar a assinatura desses objetos sem aprovação formal do Arquiteto do Projeto:

| Objeto de Banco | Tipo | Papel Crítico na Aplicação |
|---|---|---|
| **`public.cm_clientes`** | Tabela Física | Single Source of Truth para Gerente, Canal e Matrizes. |
| **`public.cm_faturamento`** | Tabela Física | Fonte Financeira Oficial imutável. |
| **`public.cm_audit_commercial_attempts`** | Tabela Física | Auditoria de tentativas de regressão do ERP. |
| **`public.rpc_importar_atendimento_sankhya`** | RPC Gateway | Portal ÚNICO obrigatorio para ingestão de planilhas/atendimento. |
| **`public.sync_base_atendimento_to_cm_clientes`** | Trigger Function | Mecanismo auto-defensivo da SSOT (Fail-Safe `CFM-GOV-001`). |
| **`public.trg_sync_cm_clientes_to_base_atendimento`** | Trigger | Sincronizador unidirecional SSOT ➔ Campo. |
| **`public.trg_sync_cm_clientes_to_redes_matrizes`** | Trigger | Mantenedor do Registry `cm_redes_matrizes`. |
| **`public.vw_divergencias_cadastro_sankhya`** | View | Detector de desalinhamento ERP vs Coffee++. |
| **`public.mv_vendas_agg`** | Materialized View | Pré-agregador principal da camada analítica. |
| **`public.mv_vendas_mensal`** | Materialized View | Visão mensal consolidada por mês, gerente e canal. |
| **`public.mv_vendas_cliente_mensal`** | Materialized View | Visão mensal por parceiro e rede. |

---

## 2. PROIBIÇÕES ABSOLUTAS (PROHIBITED PATTERNS)

1. 🛑 **NUNCA faça `INSERT`, `UPDATE` ou `UPSERT` direto em `base_atendimento` no código TypeScript/TSX.** Toda escrita deve passar pela RPC `rpc_importar_atendimento_sankhya`.
2. 🛑 **NUNCA altere a ordem de refresh das Materialized Views:** A sequência obrigatória é `mv_vendas_agg` ➔ `mv_vendas_mensal` ➔ `mv_vendas_cliente_mensal`.
3. 🛑 **NUNCA execute `REFRESH MATERIALIZED VIEW CONCURRENTLY` dentro de blocos `BEGIN...COMMIT` (Transações).**
4. 🛑 **NUNCA altere os valores fixos de `manager_id`:** (`1000` Julliano, `1001` Leandro Saffi, `1002` Luiz, `1003` John Guedes).
5. 🛑 **NUNCA consulte `base_atendimento` em telas de Vendas, DRE, Cockpit, CRM ou Meta.** Módulos comerciais leem exclusivamente `cm_clientes` e MVs.

---

## 3. COMPONENTES DE SOFTWARE PROTEGIDOS (FROZEN MODULES)

Os seguintes arquivos possuem contratos de API congelados e não devem ser refatorados sem testes de paridade prévios:

* `src/lib/governance/analytics/engine.ts` (`AnalyticsEngine V1`)
* `src/lib/governance/analytics/sources.ts` (`OFFICIAL_ANALYTICS_SOURCES`)
* `scripts/test-gate3-regression.ts` (Suíte de Testes de Regressão da SSOT)
* `scripts/verify-parity.ts` (Motor de Verificação de Paridade Financeira)
* `scripts/health-analytics.ts` (Suíte de Saúde Analítica)
