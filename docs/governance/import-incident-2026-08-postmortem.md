# REGISTRO OFICIAL DE ENCERRAMENTO — INCIDENTE E SANEAMENTO DO IMPORT HUB
## RELEASE 3 — GOVERNANÇA PERMANENTE COFFEE++

**Data de Registro:** 14 de Agosto de 2026  
**Status Arquitetural:** `IMPORT_HUB_SANITIZED = TRUE` | `INCIDENT = CLOSED` | `FINANCIAL_PARITY = R$ 0,0000`

```
================================================================================
STATUS FINAL DO INCIDENTE E SANEAMENTO:
• IMPORT_HUB = SANEADO
• STAGING = 0 REGISTROS
• AUGUST_2026 = RESTAURADO (35.857 LINHAS | NET R$ 4.475.955,96)
• JULY_2026 = INTACTO (82.468 LINHAS | NET R$ 15.968.907,48)
• FINANCIAL_DEVIATION = R$ 0,0000
• INCIDENT = CLOSED
• DATABASE = STABLE
• BASELINE = PRESERVED
• HARDENING_ITEM = BACKLOG
================================================================================
```

---

## 1. RECUPERAÇÃO DE AGOSTO/2026

- **Batch Recuperado**: `3efec6e0-ccea-407c-b910-755780fe56fc`
- **Registros Promovidos para `cm_faturamento`**: **35.857 registros**
- **Net Total Promovido**: **R$ 4.475.955,96**
- **Status em `cm_sync_logs`**: `SUCCESS`
- **Integridade da Promoção**: Auditoria de 5 camadas (`fn_validate_import_integrity`) aprovada com 100% de paridade (Desvio R$ 0,0000).

---

## 2. SANEAMENTO CONTROLADO DA TABELA DE STAGING

- **Volume Expurgado**: **384.717 registros residuais** removidos exclusivamente dos 5 `batch_id`s auditados e confirmados como órfãos/descartáveis:
  1. `107b8473-57f4-4fb5-b602-ab74ad0fd0ad` (87.215 linhas - Julho/2026)
  2. `58df5d60-c46c-42ed-a75a-4a8346cad57b` (87.215 linhas - Julho/2026)
  3. `a5ed8259-bf95-4478-96c6-72c64861c690` (87.215 linhas - Julho/2026)
  4. `f8cbbe2d-2b72-4dca-ae96-ed5b812199de` (87.215 linhas - Julho/2026)
  5. `ee1c8ae9-fb89-4466-8cb5-feabba9105b0` (35.857 linhas - Agosto/2026 duplicado)
- **Método Utilizado**: `DELETE` controlado condicional por `batch_id`. **Nenhum TRUNCATE foi executado**.
- **Estado Final de `cm_faturamento_staging`**: **0 registros** (Tabela 100% limpa e consistente).

---

## 3. INTEGRIDADE FINANCEIRA E COMPARAÇÃO MENSAL

| Mês de Competência | Volumetria Oficial (`cm_faturamento`) | Net Total Oficial (R$) | Status de Governança |
| :--- | :---: | :---: | :---: |
| **Agosto/2026** | **35.857** | **R$ 4.475.955,96** | Restaurado via Batch `3efec6e0` |
| **Julho/2026** | **82.468** | **R$ 15.968.907,48** | Mantido 100% Intacto |
| **Desvio Financeiro** | — | **R$ 0,0000** | Paridade Absoluta Aprovada |
| **Alterações Indevidas em Banco** | — | **0** | Zero Regressão |

---

## 4. CAUSA RAIZ REGISTRADA DO INCIDENTE

A causa raiz primária do incidente ocorrido em 12/08/2026 foi a **interrupção/encerramento da conexão HTTP do processo web durante a sequência de promoção e finalização do lote**.

**Consequências Operacionais do Incidente**:
1. Os dados da nova importação de Agosto/2026 ficaram salvos em staging, mas a chamada de finalização foi abortada.
2. A purga prévia (`replace`) já havia deletado a versão anterior de Agosto, deixando o mês de Agosto zerado em `cm_faturamento`.
3. Os logs em `cm_sync_logs` registraram estado de `ERROR` devido ao estouro de tempo/desconexão.
4. Acúmulo de resíduos na tabela `cm_faturamento_staging`.

---

## 5. RISCO DE PERFORMANCE E DÍVIDA TÉCNICA (ITEM DE BACKLOG)

- **Identificação**: A view `public.sales` executa um **Parallel Full Table Scan** sobre a tabela `cm_faturamento` (> 1,05 milhão de linhas) devido à utilização da função de expressão `to_char(dt_faturamento, 'YYYY_MM')` nos filtros.
- **Risco**: Requisições simultâneas efetuadas em dashboards analíticos pesados durante a fase de promoção do Import Hub geram alta disputa de CPU/I/O de disco.
- **Diretriz de Governança**: Este item permanece estritamente registrado como **Item de Backlog Técnico / Hardening Futuro**. Nenhuma alteração em views, índices, RPCs ou timeout foi efetuada nesta Release.

---

## 6. LIÇÕES OPERACIONAIS & DIRETRIZES FUTURAS DO IMPORT HUB

1. **Observabilidade das Etapas**: Toda operação de promoção deve registrar progresso por chunk no banco.
2. **Confirmação de Finalização**: A chamada à `finalizar_importacao_faturamento` deve ter status auditável e garantido.
3. **Detecção de Staging Residual**: O Import Hub deve alertar caso a tabela `cm_faturamento_staging` contenha registros de lotes anteriores antes do envio de um novo lote.
4. **Proteção contra Interrupções HTTP**: Operações de promoção de grande volume devem ser imunes a desconexões do cliente.
5. **Isolamento de Janela**: Evitar navegação pesada em BI/Dashboards durante a janela de promoção para otimizar o tempo de I/O do banco.

---

## 7. TERMO DE ENCERRAMENTO E CONSERVAÇÃO DA BASELINE

Nenhuma alteração funcional, de schema, de migration, de RPC ou de código foi realizada além das operações de dados homologadas na FASE 2.

```text
STATUS GERAL:
INCIDENT = CLOSED
IMPORT_HUB_SANITIZED = TRUE
AUGUST_2026_RESTORED = TRUE
JULY_2026_INTACT = TRUE
FINANCIAL_PARITY = R$ 0,0000
DATABASE_INTEGRITY = CONFIRMED
BASELINE = PRESERVED & LOCKED
```
