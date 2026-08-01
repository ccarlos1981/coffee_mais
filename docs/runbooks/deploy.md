# Runbook — Deploy

**Responsável**: Equipe de Desenvolvimento  
**Plataforma**: Vercel (Next.js)  
**Banco de Dados**: Supabase (Postgres)  

---

## Visão Geral

Este runbook cobre o processo de deploy do Coffee++, incluindo validações pré-deploy, procedimentos de migração e rollback.

---

## Checklist Pré-Deploy

### Infraestrutura
- [ ] `npm run health:mcp` — Infraestrutura MCP validada (0 FAIL)

### Código
- [ ] `npx tsc --noEmit` — Zero erros de tipagem
- [ ] `npm run build` — Compilação Next.js bem-sucedida
- [ ] `npm run lint` — Sem erros de lint críticos

### Analytics
- [ ] `npm run health:analytics` — Auditoria analítica aprovada
- [ ] Desvio financeiro = 0,0000%

### Banco de Dados
- [ ] Migrations pendentes aplicadas em staging
- [ ] RLS policies validadas
- [ ] Views materializadas atualizadas

---

## Procedimento de Deploy

### 1. Validação Local

```bash
npm run health:mcp
npm run health:analytics
npx tsc --noEmit
npm run build
```

### 2. Push para Branch

```bash
git add .
git commit -m "feat/fix: descrição da alteração"
git push origin feature/nome-da-feature
```

### 3. Pull Request

- Criar PR para `main`.
- Aguardar build de preview na Vercel.
- Validar preview deployment.

### 4. Merge e Deploy

- Merge aprovado dispara deploy automático na Vercel.
- Monitorar logs de build na Vercel.

---

## Migrations de Banco de Dados

### Aplicar Migration

```bash
supabase db push
```

### Verificar Status

```bash
supabase db diff
```

### Refresh de Views Materializadas

```sql
SELECT refresh_materialized_views();
```

---

## Rollback

### Rollback de Deploy (Vercel)

1. Acessar Vercel Dashboard.
2. Navegar para o deployment anterior.
3. Clicar em "Promote to Production".

### Rollback de Migration

1. Criar migration reversa.
2. Aplicar via `supabase db push`.
3. Validar integridade com `npm run health:analytics`.

---

## Monitoramento Pós-Deploy

- [ ] Verificar logs de erro na Vercel
- [ ] Validar acesso ao dashboard
- [ ] Confirmar paridade financeira
- [ ] Testar fluxos críticos (login, importação, investimentos)
