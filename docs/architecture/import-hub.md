# Arquitetura — Import Hub

**Baseline**: Seções 1–3 do AGENTS.md  
**Status**: `IMPORT_HUB = LOCKED`  

---

## Visão Geral

O Import Hub é o pipeline oficial de importação e validação de dados do Coffee++. Responsável por ingerir dados externos (Sankhya, MyMetrics, planilhas), validar, transformar e persistir nas tabelas oficiais do Supabase.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Sankhya    │    │  MyMetrics   │    │  Planilhas   │
│   (ERP)      │    │  (Metabase)  │    │  (Excel)     │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Import Hub     │
                  │  (Validação +   │
                  │   Transformação)│
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼──┐  ┌──────▼─────┐  ┌──▼──────────┐
     │cm_fatura- │  │cm_clientes │  │cm_skus_     │
     │mento      │  │            │  │conversao    │
     └───────────┘  └────────────┘  └─────────────┘
              │            │            │
              └────────────┼────────────┘
                           │
                  ┌────────▼────────┐
                  │  refresh_       │
                  │  materialized_  │
                  │  views()        │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼──┐  ┌──────▼─────┐  ┌──▼──────────┐
     │mv_vendas_ │  │mv_vendas_  │  │mv_positi-   │
     │mensal     │  │cliente_    │  │vacao_sku_   │
     │           │  │mensal      │  │mensal       │
     └───────────┘  └────────────┘  └─────────────┘
```

## Regras de Consolidação (Alinhamento MyMetrics)

| Regra | Descrição |
|-------|-----------|
| Faturamento | `vlr_total_liq` sem dedução de `vlr_desconto` |
| Bonificações | TOP `1117` incluída na receita |
| Depósitos Digitais | TOP `1703` incluída |
| Devoluções | TOPs `1200`, `1201` com sinal invertido |
| TOPs Permitidas | `1100`, `1117`, `1200`, `1201`, `1703`, `1713`, `1723` |
| Exclusões | TOP `1701`, `CAFE UTAM S/A`, NFs canceladas |

## Conversão Logística

O `ProdutoConversaoService` é a fonte única para conversões entre UN, Caixas e Kg. Nenhum módulo pode implementar cálculos próprios ou hardcodar fatores logísticos.

Fonte: `cm_skus_conversao` (Cadastro Mestre)

## Referências

- AGENTS.md — Seções 1–4, 9–10
- `src/lib/import/`
