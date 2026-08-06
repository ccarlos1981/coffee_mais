# 🏛️ BASELINE ARQUITETURAL OFICIAL v1.0 — COFFEE++

**Data de Atualização:** 05/08/2026  
**Status Arquitetural:** `BASELINE_ARQUITETURAL_v1.0 = LOCKED` & `SINGLE_SOURCE_OF_TRUTH = CONFIRMED` & `SSOT_HARDENING = ACTIVE`  
**Escopo:** Ecossistema Corporativo Coffee++ (Faturamento, Planejamento, Analytics, DRE, Cockpit, CRM, RPS, Gateway RPC e Operação de Campo)

---

## 1. SINGLE SOURCE OF TRUTH (FONTE ÚNICA DA VERDADE)

A arquitetura do Coffee++ é governada pela separação rigorosa de domínios e responsabilidades por camada de dados:

| Entidade / Camada | Domínio Oficial | Descrição e Atribuição Arquitetural |
|---|---|---|
| **`cm_faturamento`** | **Fonte Financeira Oficial** | Tabela transacional física que armazena todas as notas fiscais de venda faturadas (Sankhya/MyMetrics). É a fonte primária e imutável para toda receita e volume corporativo. |
| **`cm_clientes`** | **Cadastro Mestre Comercial (SSOT)** | Single Source of Truth para dimensões comerciais. Define exclusivamente o **Gerente Comercial** (`responsavel`, `manager_id`), **Canal** (`tipo_parceiro`), **Rede/Matriz** (`matriz`, `codigo_matriz`) e **UF/Regional**. Protegido contra sobrescritas automáticas via Gateway RPC. |
| **`base_atendimento`** | **Operação de Campo** | Tabela operacional dedicada exclusivamente ao módulo de campo (Promotores, Supervisores e Atendimento). Não possui autoridade sobre regras de faturamento comercial ou planejamento. |
| **`cm_redes_matrizes`** | **Registry Oficial de Redes** | Registry derivado mantido em tempo real via triggers nativas de banco (`trg_sync_cm_clientes_to_redes_matrizes`). Consolida chaves de agrupamento de redes e gerentes responsáveis. |
| **`cm_audit_commercial_attempts`** | **Auditoria de Governança** | Tabela de rastreabilidade para tentativas do ERP em alterar gerentes, canais ou matrizes durante importações. |
| **Materialized Views** | **Camada Analítica** | MVs de alta performance (`mv_vendas_agg`, `mv_vendas_mensal`, `mv_vendas_cliente_mensal`). Consumidas exclusivamente pela `AnalyticsEngine` para servir Dashboards e APIs em < 100ms. |

---

## 2. REGRAS OFICIAIS DE DOMÍNIO E ISOLAMENTO

1. **Definição Exclusiva de Gerente**: O Gerente Comercial é definido exclusivamente no Cadastro Mestre (`cm_clientes.responsavel` / `cm_clientes.manager_id`).
2. **Definição Exclusiva de Canal**: O Canal Comercial é definido exclusivamente no Cadastro Mestre (`cm_clientes.tipo_parceiro`).
3. **Gateway Único de Ingestão**: Toda ingestão de planilhas/Sankhya deve consumir a RPC `public.rpc_importar_atendimento_sankhya()`. É expressamente proibido o uso de `INSERT/UPDATE/UPSERT` direto em `base_atendimento`.
4. **Imunidade SSOT em Modo IMPORT**: Em modo `'IMPORT'`, a trigger `sync_base_atendimento_to_cm_clientes` bloqueia alterações em atributos comerciais de parceiros existentes e registra auditoria.
5. **Propagação Unidirecional em Modo NORMAL**: Edições administrativas em `cm_clientes` propagam-se para `base_atendimento` e `cm_redes_matrizes`.
6. **Vetação de Acesso Direto**: Fica expressamente proibido qualquer componente React, API Handler ou Server Action comercial consultar `base_atendimento` diretamente para exibição de vendas ou gerentes.

---

## 3. PIPELINE OFICIAL DE IMPORTAÇÃO DE DADOS

O fluxo oficial de ingestão e processamento de dados faturados e cadastrais segue a pipeline desacoplada:

```
[Importação Sankhya / Upload Excel]
               │
               ▼
[Gateway RPC: public.rpc_importar_atendimento_sankhya]
               │ (Define: SET LOCAL coffee_mais.operation_mode = 'IMPORT')
               ▼
     [UPSERT em base_atendimento]
               │
               ▼ (Trigger: sync_base_atendimento_to_cm_clientes)
               │
     [Validação Auto-Defensiva da SSOT cm_clientes]
               ├── Parceiro Novo? ──► Insere em cm_clientes com dados iniciais.
               └── Parceiro Existente? ──► Protege Gerente/Canal/Matriz + Grava Audit Log.
               │
               ▼
 [Barreira de Integridade RPC: isCountValid & isNetValid]
               │
               ▼
    [Refresh Materialized Views (mv_vendas_agg ➔ mensal)]
               │
               ▼
   [Analytics Engine] ───► AnalyticsEngine.getVendasSummary()
               │
               ▼
      [Dashboard] (Interfaces de Vendas / Cockpit / DRE / CRM)
```

---

## 4. DIAGRAMA DE GOVERNANÇA E AUDITORIA

```
                               ┌──────────────────────────────────────────────────────────┐
                               │                 SANKHYA / PLANILHA EXCEL                 │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │             RPC CENTRALIZADA DE INGESTÃO                 │
                               │        public.rpc_importar_atendimento_sankhya()         │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │         TRIGGER: sync_base_atendimento_to_cm_clientes   │
                               └──────────────┬────────────────────────────┬──────────────┘
                                              │                            │
                                   Modo = 'IMPORT'              Modo = 'NORMAL' (Admin UI)
                                              │                            │
                                              ▼                            ▼
                               ┌─────────────────────────────┐ ┌──────────────────────────┐
                               │  Protece SSOT em cm_clientes│ │ Atualiza SSOT cm_clientes│
                               │  Registra auditoria em:     │ │ Propaga para Campo via   │
                               │  cm_audit_commercial_       │ │ trg_sync_cm_clientes_    │
                               │  attempts                   │ │ to_base_atendimento      │
                               └─────────────────────────────┘ └──────────────────────────┘
```

---

## 5. REFRESH DAS MATERIALIZED VIEWS

1. **Ordem Oficial Mandatória de Refresh**:
   ```sql
   1. REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_agg;
   2. REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_mensal;
   3. REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_cliente_mensal;
   ```
2. **Execução Assíncrona**: O comando `REFRESH MATERIALIZED VIEW CONCURRENTLY` **não pode ser executado dentro de blocos transacionais (`BEGIN ... COMMIT`)**.

---

## 6. GUARD RAILS PERMANENTES (REGRAS INVIOLÁVEIS)

1. 🚫 **Nunca usar `base_atendimento` como fonte comercial.**
2. 🚫 **Nunca realizar escritas diretas em `base_atendimento` fora da RPC `rpc_importar_atendimento_sankhya`.**
3. 🚫 **Nunca atualizar Materialized Views diretamente via UPDATE.**
4. ⚡ **Toda soma financeira deve ocorrer em SQL Server-Side / Materialized Views.**
5. ⚖️ **Toda alteração de atribuição comercial deve preservar Soma Zero** (Desvio = R$ 0,00).
6. 🎯 **Toda reorganização comercial deve ocorrer em `cm_clientes` via Chave Primária numéricas (`codigo`).**
7. 🔍 **Toda alteração estrutural exige auditoria prévia de paridade financeira.**

---

## 7. CHECKLIST OBRIGATÓRIO DE DESENVOLVIMENTO

* [ ] `npm run health:analytics` (100% aprovado com 0 regressões)
* [ ] **Verify Parity** (0,0000% de desvio em R$ 197.237,57)
* [ ] `npx tsc --noEmit` (0 erros de compilação)
* [ ] `npm run build` (Compilação Next.js completa com sucesso)
* [ ] **Gate 3 Test Suite** (`npx ts-node scripts/test-gate3-regression.ts` sem falhas)
* [ ] **Auditoria de Direct Writes** (0 ocorrências de `from("base_atendimento").upsert`)

---

## 9. BASELINE DE ESTRUTURA COMERCIAL & COMMERCIAL ROLES v2

A partir de 05/08/2026, o módulo **Commercial Structure v2** (`src/lib/domain/commercial-structure.ts`) torna-se o componente infraestrutural oficial e permanente da **BASELINE_ARQUITETURAL_v1** para resolução de gerentes e Commercial Roles (`KA`, `DIST`, `EXPORT`, etc.).

### Diretrizes Mandatórias:
1. **Single Source of Truth Exclusiva**: O catálogo `OFFICIAL_COMMERCIAL_ROLES` em `commercial-structure.ts` é a única fonte autorizada para funções comerciais, gerentes, distribuidores e identificadores homologados.
2. **Proibição de Listas Locais**: É expressamente proibido a qualquer componente React, API ou serviço criar listas próprias ou hardcode de gerentes/distribuidores.
3. **Validação Automática Fail-Fast**: O build executa obrigatoriamente `validateCommercialStructure()` garantindo zero inconsistências.
4. **Governança Consolidada**: Detalhes e checklists oficiais disponíveis em `docs/governance/COMMERCIAL_STRUCTURE_BASELINE.md`.

Status Arquitetural: `COMMERCIAL_STRUCTURE_V2 = LOCKED & CONFIRMED`.

---

## 10. STATUS FINAL E PARECER ARQUITETURAL

Declaramos oficialmente a arquitetura descrita neste documento como a **BASELINE ARQUITETURAL v1.0 DO COFFEE++ COM BLINDAGEM DA SSOT ATIVA E COMMERCIAL STRUCTURE V2 LOCKED**.

**Status Final:** `ARQUITETURA = LOCKED` | `SSOT_HARDENING = ACTIVE` | `COMMERCIAL_STRUCTURE_V2 = LOCKED` | `RPC_GATEWAY = ENABLED` | `BASELINE v1.0 = PERMANENTE`.
