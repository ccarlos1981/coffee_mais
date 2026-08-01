# Arquitetura — Investment Engine

**Baseline**: Seções 5–8, 13 do AGENTS.md  
**Status**: `INVESTMENT_ENGINE = LOCKED`  

---

## Visão Geral

O Investment Engine gerencia o ciclo completo de investimentos comerciais do Coffee++, desde o planejamento de campanhas até a execução Trade, controle financeiro e análise de cobertura comercial.

## Modelo de Dados

```
┌─────────────────────────┐
│     cm_campanhas        │
│  (Campanha comercial)   │
└───────────┬─────────────┘
            │ 1:N
┌───────────▼─────────────┐
│  cm_acoes_investimento  │
│  (Ação independente)    │
│  ┌────────────────────┐ │
│  │ Checklist Trade    │ │
│  │ Evidências (array) │ │
│  │ Status financeiro  │ │
│  │ Divergência calend.│ │
│  └────────────────────┘ │
└─────────────────────────┘
```

### Regra Fundamental
O modelo `Campanha (1) → N Ações Independentes` é a arquitetura definitiva e congelada.

## Ownership Comercial

| Entidade | Fonte de Ownership |
|----------|-------------------|
| Campanha | Gerente criador (`cm_clientes.gerente_responsavel`) |
| Ação | Rede/cliente associado via `cm_clientes` |
| Visibilidade | Filtrada por ownership do usuário autenticado |

## Divergência Operacional de Calendário

Campos em `cm_acoes_investimento`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `possui_divergencia_calendario` | BOOLEAN | Indica divergência |
| `data_inicio_real` | DATE | Data real de início |
| `data_fim_real` | DATE | Data real de término |
| `motivo_divergencia_calendario` | ENUM | Motivo padronizado |
| `observacao_divergencia` | TEXT | Observação livre |

### Dois Estados Válidos (exclusivos)
1. **Sem divergência**: `false` + campos NULL
2. **Com divergência**: `true` + todos os 4 campos preenchidos

Validação em 3 camadas: Frontend → Server Action → Constraint Postgres.

## Cobertura Comercial

```
Cobertura (%) = (Redes com ação / Total de redes ativas) × 100
```

## Legado (Read-Only)

As tabelas `cm_investimento_familias`, `cm_investimento_familias_history`, `familias_detalhes` e `skus_detalhes` permanecem congeladas em modo somente leitura.

## Referências

- AGENTS.md — Seções 5–8, 13
- `src/app/investimento/`
