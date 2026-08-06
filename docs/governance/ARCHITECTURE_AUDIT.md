# 🔍 AUDITORIA ARQUITETURAL AUTOMÁTICA (ESPECIFICAÇÃO DE GOVERNANÇA)

**Data de Atualização:** 05/08/2026  
**Status da Especificação:** `SPECIFICATION = LOCKED` & `AUTOMATION_ROADMAP = APPROVED` & `SSOT_HARDENING_AUDIT = ENABLED`  
**Referência Primária:** [BASELINE_ARQUITETURAL_v1.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/BASELINE_ARQUITETURAL_v1.md) e [ENGINEERING_GOVERNANCE.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/ENGINEERING_GOVERNANCE.md)

---

## 1. OBJETIVO

Garantir deterministicamente que nenhuma alteração futura, PR, refatoração ou manutenção viole os princípios da **Baseline Arquitetural v1.0**, preservando 100,0000% da integridade da Single Source of Truth (SSOT), paridade financeira e performance do Coffee++.

---

## 2. ITENS AUDITADOS AUTOMATICAMENTE

A suíte de auditoria arquitetural automática verificará obrigatoriamente os 14 pilares da infraestrutura:

1. **SSOT Preservada**: Verificação de isolamento entre faturamento transacional (`cm_faturamento`) e dimensões comerciais (`cm_clientes`).
2. **Gateway RPC de Ingestão**: Uso obrigatório da RPC `rpc_importar_atendimento_sankhya` para qualquer escrita de atendimento (`0` escritas diretas em `base_atendimento`).
3. **Auditoria de Bloqueios ERP**: Registro de tentativas de sobrescrita cadastral na tabela `cm_audit_commercial_attempts`.
4. **Detector de Divergências ERP**: Monitoramento contínuo via `vw_divergencias_cadastro_sankhya`.
5. **Materialized Views Íntegras**: Estado válido e consultável das views `mv_vendas_agg`, `mv_vendas_mensal` e `mv_vendas_cliente_mensal`.
6. **Triggers Existentes**: Auditoria de existência e ativação das triggers nativas (`sync_base_atendimento_to_cm_clientes`, `trg_sync_cm_clientes_to_base_atendimento`, `trg_sync_cm_clientes_to_redes_matrizes`).
7. **RPCs Obrigatórias**: Validação da integridade das funções RPC de importação (`promover_lote_staging_v2`, `isCountValid`, `isNetValid`, `rpc_importar_atendimento_sankhya`).
8. **Analytics Engine**: Integridade dos métodos centrais (`getVendasSummary`, `getCockpitComercial`, `getDreComercial`, `getCrmComercial`).
9. **Refresh das MVs**: Execução do pipeline sequencial assíncrono de refresh sem bloqueios de transação.
10. **Paridade Financeira**: Comparação determinística entre `cm_faturamento`, `mv_vendas_agg` e views agregadas (< 0,0000% de desvio em D0).
11. **Soma Zero**: Auditoria de reatribuições comerciais garantindo variação nula (R$ 0,00) no total corporativo.
12. **Build de Produção**: Sucesso completo do comando `npm run build`.
13. **TypeScript Typecheck**: Execução limpa do `npx tsc --noEmit` (0 erros).
14. **Health Analytics**: Aprovação na suíte de testes de saúde `npm run health:analytics`.

---

## 3. SCORE ARQUITETURAL

$$\text{Score Arquitetural} = \sum_{i=1}^{14} w_i \cdot P_i$$

> ⚠️ **A release só poderá ser APROVADA se o Score Arquitetural for rigorosamente IGUAL A 100.**
