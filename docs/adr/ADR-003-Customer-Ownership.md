# ADR-003: Customer Ownership (Cadastro Único)

**Status**: Aceita  
**Data**: 2026-07-14  
**Baseline**: Seção 13 do AGENTS.md  

---

## Contexto

O Coffee++ necessitava de uma fonte única e autoritativa para o ownership comercial de clientes, eliminando ambiguidades sobre qual gerente/regional é responsável por cada rede ou cliente, e garantindo consistência entre módulos (Investimentos, RPS, Dashboards, Faturamento).

## Decisão

Estabelecer o **Cadastro Único de Clientes** (`cm_clientes`) como a Single Source of Truth para ownership comercial.

### Princípios Fundamentais

1. **Fonte Única**: `cm_clientes` é o único regulador de ownership (gerente, regional, canal, rede).
2. **Proibição de Derivação**: Nenhum módulo pode derivar ownership a partir de faturamento, histórico de vendas ou qualquer outra fonte.
3. **Propagação Automática**: Alterações no Cadastro Único propagam automaticamente para módulos dependentes.
4. **Consistência Cross-Module**: Investimentos, RPS, Dashboards e Faturamento consomem exclusivamente `cm_clientes`.

### Campos de Ownership

| Campo | Descrição |
|-------|-----------|
| `gerente_responsavel` | Gerente comercial responsável |
| `regional` | Regional de atuação |
| `canal` | Canal comercial |
| `rede` | Rede de distribuição |
| `codigo_matriz` | Código da matriz (chave de integração) |
| `uf` | Unidade Federativa |

### Módulos Consumidores

- Investimentos (ownership de campanhas/ações)
- RPS (ownership de projeções)
- Dashboards de vendas
- Analytics Engine (filtros dimensionais)
- Faturamento (agrupamento por gerente/rede)

## Consequências

### Positivas
- Eliminação de inconsistências de ownership entre módulos.
- Ponto único de manutenção cadastral.
- Rastreabilidade completa de alterações.

### Negativas
- Dependência crítica de `cm_clientes` — qualquer erro cadastral impacta todos os módulos.
- Necessidade de processo de governança para alterações no cadastro.

## Referências

- AGENTS.md — Seção 13
- AGENTS.md — Seção 7 (Identidade de Redes)
- `src/app/config-financeiro/clientes/`
