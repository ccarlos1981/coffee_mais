# Arquitetura — Analytics Engine V1

**Baseline**: Seção 14 do AGENTS.md  
**Status**: `ANALYTICS_ENGINE_V1 = LOCKED`  

---

## Visão Geral

A Analytics Engine é a camada analítica centralizada do Coffee++. Toda consulta analítica, indicador financeiro, ranking comercial ou diagnóstico estratégico passa obrigatoriamente por este motor.

```
┌─────────────────────────────────────────────────────┐
│                  Views Oficiais                     │
│  mv_vendas_mensal · mv_vendas_cliente_mensal        │
│  mv_positivacao_sku_mensal · public.sales           │
│  base_atendimento.faturamento_mensal                │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────▼────────┐
              │ AnalyticsEngine │
              └────────┬────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
  ┌────▼────┐    ┌─────▼─────┐   ┌────▼────┐
  │ Cockpit │    │    DRE    │   │   CRM   │
  │Comercial│    │ Comercial │   │Comercial│
  └─────────┘    └───────────┘   └─────────┘
```

## Fluxo de Dados

```
Fontes Oficiais → AnalyticsEngine.método(filters) → API GET → Interface React
```

### Regra Fundamental
- **Proibido**: SQL no frontend, SQL na API, regras comerciais fora da Engine.
- **Obrigatório**: Toda lógica analítica centralizada na `AnalyticsEngine`.

## Métodos Oficiais

| Método | Módulo |
|--------|--------|
| `getCockpitComercial(filters)` | Cockpit Comercial |
| `getDreComercial(filters)` | DRE Comercial |
| `getCrmComercial(filters)` | CRM Comercial |

## Registry de Fontes

Arquivo: `src/lib/governance/analytics/sources.ts`

Este é o único local autorizado para cadastro de fontes de dados. Views hardcoded fora do Registry são proibidas.

## Validação

```bash
npm run health:analytics    # Auditoria de código + paridade financeira
npx tsc --noEmit             # Verificação de tipos
npm run build                # Compilação Next.js
```

## Referências

- [ADR-001](../adr/ADR-001-Analytics-Engine.md)
- AGENTS.md — Seções 14, 55, 57, 59
