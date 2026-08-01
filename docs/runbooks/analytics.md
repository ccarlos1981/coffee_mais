# Runbook — Analytics Engine

**Responsável**: Equipe de Desenvolvimento  
**Baseline**: Seção 14 do AGENTS.md  
**Health Check**: `npm run health:analytics`  

---

## Visão Geral

Este runbook cobre a operação, validação e troubleshooting da Analytics Engine do Coffee++.

## Validação Rápida

```bash
npm run health:analytics
npx tsc --noEmit
npm run build
```

Resultado esperado: 0 erros, 0 regressões, 0,0000% de desvio financeiro.

---

## Incidentes Comuns

### 1. Desvio Financeiro Detectado

**Sintoma**: `health:analytics` reporta desvio > 0% em relação às views oficiais.

**Diagnóstico**:
```bash
npm run verify:parity
```

**Causas prováveis**:
- Regra de negócio implementada fora da `AnalyticsEngine`.
- SQL local em rota de API.
- View materializada desatualizada.

**Correção**:
1. Identificar a fonte do desvio via `verify:parity`.
2. Migrar a regra para a `AnalyticsEngine`.
3. Executar `refresh_materialized_views()` se necessário.
4. Revalidar com `npm run health:analytics`.

---

### 2. SQL Local Detectado na Auditoria

**Sintoma**: `audit:analytics` reporta consultas SQL fora da `AnalyticsEngine`.

**Correção**:
1. Identificar o arquivo e rota onde o SQL foi detectado.
2. Migrar a consulta para um método da `AnalyticsEngine`.
3. Atualizar a rota para consumir o novo método.
4. Registrar a fonte no Registry se necessário.

---

### 3. View Materializada Desatualizada

**Sintoma**: Dados da dashboard não refletem importações recentes.

**Diagnóstico**:
```sql
SELECT schemaname, matviewname, last_refresh
FROM pg_matviews
WHERE matviewname LIKE 'mv_%';
```

**Correção**:
```sql
SELECT refresh_materialized_views();
```

---

### 4. Nova Funcionalidade Analítica

**Procedimento obrigatório**:
1. Verificar se a `AnalyticsEngine` já possui método equivalente.
2. Se não, criar novo método na Engine.
3. Registrar fontes no Registry (`sources.ts`).
4. Criar rota de API consumindo o novo método.
5. Validar paridade financeira.
6. Executar suíte completa: `health:analytics` + `tsc` + `build`.

---

## Checklist de Validação

- [ ] `npm run health:analytics` sem erros
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` sem erros
- [ ] Desvio financeiro = 0,0000%
- [ ] Nenhum SQL local nas rotas de API
- [ ] Todas as fontes registradas no Registry
