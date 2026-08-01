# Runbook — Incident Response

**Responsável**: Equipe de Desenvolvimento  
**Baseline**: Seções 67–69 do AGENTS.md  

---

## Visão Geral

Este runbook define o procedimento oficial de resposta a incidentes do Coffee++, garantindo separação de camadas, diagnóstico estruturado e correção rastreável.

---

## Classificação de Incidentes

| Severidade | Descrição | SLA |
|-----------|-----------|-----|
| **P0 — Crítico** | Sistema indisponível, perda de dados, falha financeira | Imediato |
| **P1 — Alto** | Funcionalidade principal degradada, importação falha | 4 horas |
| **P2 — Médio** | Funcionalidade secundária com erro, UI com defeito | 24 horas |
| **P3 — Baixo** | Melhoria cosmética, otimização, documentação | Backlog |

---

## Procedimento de Diagnóstico

### Passo 1 — Identificar Camada

Antes de qualquer investigação no código, executar:

```bash
npm run health:mcp
```

**Se falhar**: O problema é de infraestrutura MCP. Seguir o [Runbook MCP](mcp.md).

**Se passar**: Prosseguir para o Passo 2.

### Passo 2 — Validar Analytics

```bash
npm run health:analytics
```

**Se falhar**: O problema é na camada analítica. Seguir o [Runbook Analytics](analytics.md).

**Se passar**: Prosseguir para o Passo 3.

### Passo 3 — Validar Compilação

```bash
npx tsc --noEmit
npm run build
```

**Se falhar**: O problema é no código da aplicação. Investigar erros de TypeScript.

**Se passar**: Prosseguir para o Passo 4.

### Passo 4 — Validar Banco de Dados

Verificar:
- Migrations pendentes
- RLS policies
- Views materializadas desatualizadas
- Conectividade Supabase

### Passo 5 — Investigar Aplicação

Somente após passar os passos 1–4, investigar a lógica da aplicação.

---

## Template de Diagnóstico

Todo diagnóstico deve ser documentado com o seguinte template:

```markdown
## Incidente: [Título]

**Data**: YYYY-MM-DD
**Severidade**: P0/P1/P2/P3
**Camada**: Infraestrutura MCP / Aplicação / Banco de Dados / Serviços Externos

### Sintoma
[Descrição do comportamento observado]

### Evidência Técnica
[Logs, screenshots, output de comandos]

### Causa Raiz
[Explicação técnica da causa]

### Impacto
[Escopo do impacto — módulos, usuários, dados afetados]

### Correção Aplicada
[Descrição da correção com comandos/arquivos alterados]

### Validação
[Comandos executados para confirmar a correção]

### Prevenção
[Ações para evitar recorrência]
```

---

## Regras de Ouro

1. **Nunca** diagnosticar problema no Coffee++ sem antes validar infraestrutura MCP.
2. **Nunca** aceitar "MCP Error" ou "context deadline exceeded" como diagnóstico final.
3. **Sempre** indicar explicitamente a camada onde o problema foi identificado.
4. **Sempre** documentar evidências técnicas (logs, output, stack trace).
5. **Sempre** validar a correção com os health checks oficiais.

---

## Comandos de Diagnóstico Rápido

| Comando | O que valida |
|---------|-------------|
| `npm run health:mcp` | Infraestrutura MCP (20 checks) |
| `npm run health:analytics` | Paridade financeira e regras analíticas |
| `npx tsc --noEmit` | Integridade de tipos TypeScript |
| `npm run build` | Compilação Next.js completa |
| `npm run audit:analytics` | Auditoria de SQL local |
| `npm run verify:parity` | Verificação de paridade financeira |
