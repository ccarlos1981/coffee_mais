# ADR-001: Analytics Engine V1

**Status**: Aceita  
**Data**: 2026-07-22  
**Baseline**: Seção 14 do AGENTS.md  

---

## Contexto

O Coffee++ necessitava de uma camada analítica centralizada para garantir paridade financeira absoluta com as views oficiais do banco de dados, eliminar consultas SQL dispersas nas rotas de API e unificar regras comerciais em um único ponto de manutenção.

## Decisão

Implementar a `AnalyticsEngine` como fonte única de verdade para todas as consultas analíticas do sistema.

### Princípios Fundamentais

1. **Centralização Total**: Toda regra de negócio analítica reside exclusivamente na `AnalyticsEngine`.
2. **Proibição de SQL Local**: Nenhuma rota de API pode montar SQL diretamente ou construir cláusulas WHERE/GROUP BY locais.
3. **Registry de Fontes**: O Registry Oficial (`src/lib/governance/analytics/sources.ts`) é o único local autorizado para cadastro de fontes de dados.
4. **Paridade Financeira**: Desvio tolerado de 0,0000% em relação às views oficiais.

### Fontes Oficiais

| View | Responsabilidade |
|------|------------------|
| `mv_vendas_mensal` | Faturamento mensal consolidado |
| `mv_vendas_cliente_mensal` | Faturamento por cliente/mês |
| `mv_positivacao_sku_mensal` | Positivação por SKU/mês |
| `public.sales` | Vendas alinhadas às regras oficiais |
| `base_atendimento.faturamento_mensal` | Faturamento mensal do atendimento |

### Módulos Consumidores

- Cockpit Comercial (`getCockpitComercial`)
- DRE Comercial (`getDreComercial`)
- CRM Comercial (`getCrmComercial`)
- Centro de Inteligência Comercial
- Forecast Comercial
- Simulador Comercial
- Assistente Comercial
- Painel Presidência

## Consequências

### Positivas
- Ponto único de manutenção para regras analíticas.
- Paridade financeira garantida por design.
- Auditoria automatizada via `npm run health:analytics`.

### Negativas
- Qualquer nova funcionalidade analítica exige passagem obrigatória pela `AnalyticsEngine`.
- Curva de aprendizado para novos desenvolvedores.

## Validação

```bash
npm run health:analytics
npx tsc --noEmit
npm run build
```

## Referências

- AGENTS.md — Seção 14
- AGENTS.md — Seções 55–60 (Sistema Inovações)
- `src/lib/governance/analytics/`
