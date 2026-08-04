# IMPORT HUB v2.0 LTS — BASELINE OFICIAL

> **Status Arquitetural:** `IMPORT_HUB_V2 = LOCKED` & `BASELINE = CONFIRMED`
>
> **Data de Homologação:** 04/08/2026
>
> **Classificação:** LTS (Long-Term Support) — Baseline Permanente

---

## 1. Resultado Homologado em Produção

| Métrica | Valor |
|---|---|
| Upload máximo suportado | **50 MB** |
| Arquivo oficial importado | `CFOP_01jul a 02ago (1).xlsx` — **18,6 MB** |
| Registros promovidos | **87.215** |
| Clientes únicos | **19.270** |
| Faturamento líquido conciliado | **R$ 16.175.172,40** |
| Barreira de Integridade | **✅ Aprovada** |
| Finalização | **✅ Executada** |
| Rollback Inteligente | **Não acionado** |
| Resultado final | **Importação concluída com sucesso** |

---

## 2. Decisões Arquiteturais Oficializadas

### 2.1 Upload

| Configuração | Valor | Arquivo |
|---|---|---|
| `experimental.proxyClientMaxBodySize` | `"50mb"` | `next.config.ts` |

O Next.js 16.2.2 utiliza o parser Undici para multipart/form-data. O limite padrão é 10 MB. A configuração `proxyClientMaxBodySize` eleva esse limite para 50 MB.

### 2.2 Promoção (Staging → Tabela Oficial)

| Componente | Valor |
|---|---|
| RPC | `promover_lote_faturamento` |
| Estratégia de cursor | Baseada exclusivamente em `cm_faturamento_staging.id` |
| Retorno do cursor | `MAX(staging_id)` da CTE `lote_staging` |
| Tabela de origem | `cm_faturamento_staging` |
| Tabela de destino | `cm_faturamento` |

> [!IMPORTANT]
> O cursor **nunca** deve utilizar o `id` gerado pela tabela destino (`cm_faturamento.id = gen_random_uuid()`). O `last_id` retornado ao cliente deve ser derivado exclusivamente da tabela de origem (`cm_faturamento_staging.id`).

### 2.3 Performance

| Parâmetro | Valor | Justificativa |
|---|---|---|
| `BATCH_SIZE` | `1000` | Cada chamada RPC processa ~300-500ms, garantindo margem de segurança >95% sob o `statement_timeout` de 8s do PostgREST |

### 2.4 Barreira de Integridade Pré-Finalização

A Barreira de Integridade possui **exatamente duas** validações mandatórias:

| # | Validação | Expressão | Descrição |
|---|---|---|---|
| 1 | **Contagem** | `totalRows === actualPromotedCount` | Todos os registros da staging foram promovidos para `cm_faturamento` |
| 2 | **Financeira** | `Math.abs(actualPromotedNet - expectedNet) < 0.05` | Paridade financeira entre o valor calculado no Excel e o valor no banco |

#### Soma financeira — Regra obrigatória

A validação financeira **deve** utilizar exclusivamente a RPC SQL server-side `fn_sum_net_by_batch`, que executa `SUM(vlr_total_liq)` diretamente no PostgreSQL.

> [!CAUTION]
> É **expressamente proibido** utilizar queries PostgREST que retornem milhares de linhas para o Node.js (`.select("vlr_total_liq")` + `.reduce()`). O PostgREST possui limite padrão de 1.000 linhas por resposta, o que trunca silenciosamente o resultado financeiro.

#### Validação removida — `isStagingEmpty`

A condição `isStagingEmpty` foi **permanentemente removida** da Barreira de Integridade.

**Justificativa arquitetural:**
- A RPC `promover_lote_faturamento` apenas **copia** dados (INSERT), sem deletar da staging.
- A deleção da staging é responsabilidade exclusiva de `finalizar_importacao_faturamento`.
- `finalizar_importacao_faturamento` é executada **após** a Barreira.
- Portanto, `isStagingEmpty` é **estruturalmente impossível** de ser `true` no ponto do fluxo onde a Barreira é avaliada.
- A verificação é semanticamente redundante com `isCountValid`.

### 2.5 Finalização

A RPC `finalizar_importacao_faturamento` é executada **somente** após aprovação completa da Barreira de Integridade (ambas as condições `true`).

Responsabilidades de `finalizar_importacao_faturamento`:
1. Atualizar `base_atendimento.faturamento_mensal` para parceiros afetados.
2. Deletar registros da staging (`cm_faturamento_staging`).
3. Limpar parceiros afetados (`cm_import_affected_partners`).

### 2.6 Limpeza da Staging

A limpeza da staging permanece **responsabilidade exclusiva** de `finalizar_importacao_faturamento`. Nenhuma outra etapa do pipeline deve deletar registros da staging.

### 2.7 Rollback Inteligente

Em caso de falha na Barreira ou em qualquer etapa pós-promoção:
- Os dados parciais em `cm_faturamento` são deletados (`DELETE WHERE batch_id`).
- A staging é **preservada** para diagnóstico e reprocessamento.
- A staging só é deletada se o erro ocorrer **antes** do início da promoção.

---

## 3. Fluxo Arquitetural Oficial

```
Excel (≤50 MB)
    │
    ▼
analyzeExcel()
    │  parseNumber() → totalNet (JavaScript float64)
    │  INSERT INTO cm_faturamento_staging (chunks de 2.500)
    │  Grava metadata.total_net em cm_sync_logs
    ▼
confirmImport()
    │
    ├─ 1. preparar_importacao_faturamento
    │     └─ DELETE cm_faturamento WHERE período (se mode='replace')
    │
    ├─ 2. promover_lote_faturamento (×N, BATCH_SIZE=1000)
    │     └─ INSERT INTO cm_faturamento SELECT FROM staging
    │        Cursor: staging.id > p_last_id → MAX(staging_id)
    │
    ├─ 3. BARREIRA DE INTEGRIDADE
    │     ├─ isCountValid:  staging_count === cm_faturamento_count
    │     └─ isNetValid:    |SUM(vlr_total_liq) - metadata.total_net| < 0.05
    │                       (via RPC fn_sum_net_by_batch)
    │
    ├─ 4. finalizar_importacao_faturamento
    │     ├─ UPDATE base_atendimento.faturamento_mensal
    │     ├─ DELETE cm_faturamento_staging
    │     └─ DELETE cm_import_affected_partners
    │
    ├─ 5. fn_validate_import_integrity (Auditoria 5 Camadas)
    │
    └─ 6. fn_enqueue_mv_refresh (Materialized Views)
```

---

## 4. Lições Aprendidas

As seguintes causas raízes foram definitivamente identificadas e resolvidas durante o ciclo de homologação:

| # | Causa Raiz | Sintoma | Solução | Migration/Arquivo |
|---|---|---|---|---|
| 1 | Limite de upload do Next.js (10 MB padrão) | `Failed to parse body as FormData` | `proxyClientMaxBodySize: "50mb"` | `next.config.ts` |
| 2 | Cursor da RPC retornando UUID da tabela destino | Promoção terminava prematuramente (24.516 de 87.215) | CTE `lote_staging` + `MAX(staging_id)` | `20260804_fix_promover_lote_staging_cursor.sql` |
| 3 | `statement_timeout` por lote excessivo (5.000 rows) | `canceling statement due to statement timeout` | `BATCH_SIZE = 1000` | `import-service.ts:804` |
| 4 | Soma financeira truncada pelo PostgREST (1.000 linhas) | Divergência de R$ 16M na Barreira | RPC `fn_sum_net_by_batch` | `20260804_barreira_rpc_sum_net.sql` |
| 5 | Condição `isStagingEmpty` estruturalmente impossível | Barreira sempre falhava | Remoção da condição | `import-service.ts` (Barreira) |

---

## 5. RPCs Oficiais do Import Hub

| RPC | Propósito | Migration |
|---|---|---|
| `preparar_importacao_faturamento` | Bypass de triggers + DELETE do período anterior | `20260722_fix_import_statement_timeout.sql` |
| `promover_lote_faturamento` | Promoção por lotes com cursor de staging | `20260804_fix_promover_lote_staging_cursor.sql` |
| `fn_sum_net_by_batch` | Soma financeira server-side para a Barreira | `20260804_barreira_rpc_sum_net.sql` |
| `finalizar_importacao_faturamento` | Atualização de base_atendimento + limpeza | `20260719_optimize_dashboard_filters_and_import_triggers.sql` |
| `fn_validate_import_integrity` | Auditoria de integridade em 5 camadas | `20260722_fix_import_statement_timeout.sql` |
| `fn_get_import_baseline_stats` | Estatísticas do período existente | `20260722_fix_import_statement_timeout.sql` |
| `fn_enqueue_mv_refresh` | Enfileiramento de refresh das MVs | `20260718_fix_async_refresh_queue.sql` |

---

## 6. Regras de Não Regressão

As seguintes decisões fazem parte da arquitetura oficial do projeto e **não devem ser alteradas** sem nova auditoria técnica:

1. **`proxyClientMaxBodySize = "50mb"`** — Limite de upload do Next.js.
2. **Cursor baseado em `staging.id`** — O `last_id` retornado pela RPC de promoção deve ser derivado da tabela de origem.
3. **`BATCH_SIZE = 1000`** — Tamanho do lote de promoção.
4. **Soma financeira via RPC SQL** — `fn_sum_net_by_batch` executa `SUM()` server-side.
5. **Barreira composta por 2 validações** — Contagem + Financeira. Nenhuma outra condição.
6. **Finalização somente após aprovação da Barreira** — `finalizar_importacao_faturamento` nunca deve ser chamada sem validação prévia.
7. **Staging preservada em caso de falha** — O Rollback Inteligente preserva a staging para diagnóstico.

> [!WARNING]
> Qualquer alteração nestas decisões requer:
> - Auditoria técnica documentada
> - Teste com arquivo oficial (≥87.000 registros)
> - Validação de paridade financeira (desvio máximo: R$ 0,05)
> - Aprovação explícita do responsável técnico

---

## 7. Arquivos Oficiais do Import Hub v2.0

| Arquivo | Propósito |
|---|---|
| `src/lib/services/import-service.ts` | Motor principal de importação |
| `src/app/api/import/excel/upload/route.ts` | Endpoint de upload |
| `src/app/api/import/confirm/route.ts` | Endpoint de confirmação |
| `src/app/upload/page.tsx` | Interface do usuário |
| `next.config.ts` | Configuração de upload (50 MB) |
| `supabase/migrations/20260706_create_import_hub.sql` | Estrutura da staging |
| `supabase/migrations/20260804_fix_promover_lote_staging_cursor.sql` | RPC de promoção (cursor corrigido) |
| `supabase/migrations/20260804_barreira_rpc_sum_net.sql` | RPC de soma financeira |
| `supabase/migrations/20260722_fix_import_statement_timeout.sql` | RPCs de preparação e auditoria |
| `supabase/migrations/20260719_optimize_dashboard_filters_and_import_triggers.sql` | RPC de finalização |

---

*Documento de governança gerado em 04/08/2026. Baseline permanente do Coffee++.*
