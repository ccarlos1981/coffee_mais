# DOCUMENTO DE ENCERRAMENTO TÉCNICO E POSTMORTEM — PIPELINE DE IMPORTAÇÃO E GOVERNANÇA ANALÍTICA

**Data de Conclusão:** 04/08/2026  
**Autor:** Antigravity (Engenharia de Dados & Governança Coffee++)  
**Status Oficial:** `ESTABILIZADO` | `BASELINE = PERMANENTE` | `FINANCIAL_GOVERNANCE = LOCKED`

---

## 1. LINHA DO TEMPO DOS PROBLEMAS E RESOLUÇÕES

| Data / Etapa | Problema Encontrado | Causa Raiz | Correção Aplicada | Evidência de Validação |
|---|---|---|---|---|
| **04/08 (09:00)** | Falha no upload de arquivos grandes (>10MB) no Import Hub | Limite padrão de payload do Next.js/Turbopack | Configuração do `proxyClientMaxBodySize: "50mb"` no `next.config.ts` | Upload de arquivo de 18,6 MB (87.215 registros) concluído |
| **04/08 (10:00)** | Promoção em lote travando por timeout de cursor | Paginador offset tradicional e RPCs não otimizadas | Refatoração da RPC `promover_lote_faturamento` com cursor Keyset por ID físico e tamanho de lote 1.000 | 87.215 registros promovidos em 87 lotes em < 2 min |
| **04/08 (11:30)** | Barreira Quádrupla abortando por soma divergente via PostgREST | PostgREST aplicando limite default de 1.000 linhas na requisição `.select("vlr_total_liq")` | Substituição da agregação Node.js por RPC PostgreSQL dedicada (`SELECT SUM(vlr_total_liq)...`) | Soma conciliada em R$ 16.175.172,40 sem carregar dados |
| **04/08 (12:30)** | Divergência entre cm_faturamento e MVs no Dashboard Vendas | Materialized Views desatualizadas por ausência da view `vw_mv_health_check` na fila cron | Restauração da view e inclusão das 4 MVs no pipeline de refresh automático | `mv_vendas_mensal` conciliada em R$ 9.686.478,14 |
| **04/08 (13:30)** | EPA aparecendo no bloco "SEM RESPONSÁVEL" na Gestão de Metas | View `vw_redes_planejaveis_oficiais` lendo da `base_atendimento` com PDVs órfãos | Reescrita da view para consumir exclusivamente `cm_clientes` (SSOT) | EPA 100% limpo sob Luiz (1002), 0 gerentes nulos |
| **04/08 (14:30)** | R$ 11.942,04 não aparecendo no planejamento de redes KA | 2 clientes (22250 e 96660) com `matriz = ''` e `codigo_matriz = NULL` | Criação da view de governança `vw_clientes_sem_matriz` para monitoramento automático | View ativa identificando os 2 clientes em tempo real |

---

## 2. DECISÕES ARQUITETURAIS ADOTADAS

### 2.1 Single Source of Truth (SSOT)
- **Domínio Comercial (Faturamento, Metas, DRE, Cockpit, RPS):** Consome exclusivamente `cm_clientes` e views/materialized views derivadas de `cm_faturamento`.
- **Domínio de Campo (Promotor, Supervisor, Lojas, Visitas):** Consome exclusivamente `base_atendimento` e tabelas operacionais de loja.
- **Proibição de JOINs Cruzados:** Fica proibida a leitura de `base_atendimento` para composição de redes comerciais faturadas.

### 2.2 Barreira Quádrupla de Integridade
- **Execução Server-Side:** Toda validação pós-promoção (contagem de linhas, soma de faturamento, integridade de lotes) é executada 100% no PostgreSQL via RPCs agregadas, sem tráfego de arrays em Node.js.
- **Rollback Inteligente:** Caso qualquer divergência seja detectada, a transação aborta e a staging é preservada para auditoria sem corromper o banco oficial.

### 2.3 Refresh Automático de Materialized Views
- **Fila de Execução:** O pipeline `fn_process_mv_refresh_queue` processa assincronamente as 4 MVs vitais (`mv_vendas_agg`, `mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`).
- **Paridade Garantida:** Nenhuma importação é considerada concluída antes da sincronização das MVs com `cm_faturamento`.

### 2.4 Governança Cadastral Ativa
- **View `vw_clientes_sem_matriz`:** Monitora continuamente clientes faturados com gerente atribuído mas sem Matriz preenchida.
- **Atualização Dinâmica:** Quando um cadastro é preenchido em `cm_clientes`, ele integra o Planejamento Comercial no próximo request sem necessidade de deploy ou código.

---

## 3. LIÇÕES APRENDIDAS

1. **Evitar truncamento de APIs de dados:** Agregações financeiras de grandes volumes devem ocorrer no SGBD (PostgreSQL), nunca via iteração de arrays carregados via HTTP REST.
2. **Separação Rígida de Domínios:** Tabelas operacionais de campo (como `base_atendimento`) não devem ser reutilizadas para consolidar métricas financeiras corporativas.
3. **Guard-rails em Banco > Guards no Frontend:** Corrigir a inconsistência na origem dos dados (View SQL) é infinitamente mais robusto do que adicionar verificações condicionais espalhadas pelo código TypeScript.

---

## 4. CHECKLIST OBRIGATÓRIO PARA EVOLUÇÕES FUTURAS

Antes de aprovar qualquer alteração no pipeline de importação ou nas views analíticas, é mandatório validar:

- [ ] A consulta consome a fonte oficial (`cm_clientes` ou views homologadas)?
- [ ] Existe qualquer JOIN cruzado com `base_atendimento` em views comerciais?
- [ ] O teste de paridade financeira (`npm run verify:parity`) retornou `0,0000%` de desvio?
- [ ] O script de suíte analítica (`npm run health:analytics`) passou 100% sem falhas?
- [ ] A checagem de tipos (`npx tsc --noEmit`) retornou 0 erros?
- [ ] O build oficial (`npm run build`) compilou com sucesso?

---

## 5. STATUS ARQUITETURAL FINAL

```
=================================================================
🏆 IMPORT HUB v2.0 LTS — STATUS: ESTABILIZADO & HOMOLOGADO
=================================================================
  - Importação de grandes volumes: FUNCIONAL E AUDITADA (87k linhas)
  - Governança Financeira: LOCKED (0,0000% de desvio)
  - Separação de Domínios Comercial/Campo: CONFIRMADA E ISOLADA
  - Monitoramento Cadastral: ATIVO (vw_clientes_sem_matriz)
=================================================================
```
