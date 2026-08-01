# ADR-004: MCP Infrastructure Governance

**Status**: Aceita  
**Data**: 2026-08-01  
**Baseline**: Seções 67 e 68 do AGENTS.md  

---

## Contexto

Em 01/08/2026, o firebase-mcp-server falhou com o erro `"context deadline exceeded"`. A investigação revelou que a causa raiz era a configuração `registry=http://registry.npmjs.org/` no `~/.npmrc` (HTTP plano), e não um problema no código da aplicação Coffee++. O npm registry exige TLS 1.2+ desde outubro de 2021.

Este incidente demonstrou a necessidade de separação formal entre diagnósticos de infraestrutura MCP e diagnósticos da aplicação.

## Decisão

Estabelecer governança permanente para a infraestrutura MCP com três pilares:

### 1. Separação Absoluta de Camadas

Toda investigação deve separar:
- **Infraestrutura MCP**: npm, Node.js, TLS, tokens, PATH, `.npmrc`, CLIs.
- **Aplicação Coffee++**: Código, componentes, regras de negócio.
- **Banco de Dados**: Supabase, Postgres, views, RLS.
- **Serviços Externos**: APIs de terceiros.

### 2. Health Check Mandatório

O comando `npm run health:mcp` valida automaticamente 20 checks:

| Categoria | Checks |
|-----------|--------|
| Runtime | Node.js, npm, PATH |
| Security | Registry HTTPS, strict-ssl, .npmrc, TLS version |
| Network | npm connectivity (PING/PONG) |
| Firebase MCP | Config, CLI, Auth, JSON-RPC |
| GitHub MCP | Config, CLI, PAT |
| Supabase MCP | Config, Token |
| Sequential Thinking | Config |

### 3. Diagnóstico Estruturado

Toda falha deve identificar:
- MCP server afetado.
- Causa raiz.
- Evidência técnica (log, output, stack trace).
- Ação corretiva recomendada.

## Cinco MCP Servers Oficiais

| Server | Autenticação |
|--------|-------------|
| `firebase-mcp-server` | Firebase CLI + OAuth |
| `github-mcp-server` | Personal Access Token (PAT) |
| `supabase-mcp-server` | Supabase Access Token |
| `sequential-thinking-mcp-server` | Stateless (sem auth) |
| Workspace Local | Ferramentas do IDE |

## Consequências

### Positivas
- Diagnósticos precisos e separados por camada.
- Prevenção de falsos positivos na aplicação.
- Validação automatizada pré-desenvolvimento.

### Negativas
- Overhead de execução do health check antes de investigações.
- Manutenção adicional do script `health-mcp.ts`.

## Validação

```bash
npm run health:mcp
```

## Referências

- AGENTS.md — Seção 67 (Governança MCP)
- AGENTS.md — Seção 68 (Operação Segura)
- AGENTS.md — Seção 69 (Catálogo de Baselines)
- `scripts/health-mcp.ts`
