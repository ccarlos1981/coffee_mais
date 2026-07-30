# ADR-002 — Estabilização do Import Hub e Invalidação Coordenada de Cache

## Status
Accepted

## Contexto

Durante as operações de carga do Hub de Importação de Faturamento em grande escala (ex: planilhas com mais de 75.000 registros), observou-se a ocorrência do erro `canceling statement due to statement timeout` (60.000ms). 

Diagnóstico técnico detalhado via `pg_stat_statements` e `EXPLAIN ANALYZE` revelou que a promoção e staging dos dados de faturamento eram extremamente velozes, mas a requisição síncrona HTTP estourava devido ao acoplamento com a rotina analítica secundária `refresh_clientes_atividade()` (~42,8s de recálculo em tempo real de atividade comercial).

Adicionalmente, observou-se que após a conclusão com sucesso de uma carga, o Dashboard de Vendas continuava exibindo valores da captura anterior por até 5 minutos devido ao cache em memória (`API_CACHE`, `CACHE_TTL = 5 min`) mantido no servidor Node.js na rota `/api/dashboard`.

Fez-se necessária uma evolução arquitetural para resolver ambos os gargalos garantindo desacoplamento, resiliência e tempestividade visual sem qualquer perda de performance rotineira.

---

## Decisão

Fica formalmente decidido e homologado que:

1. **Desacoplamento de Processamento Analítico**: A requisição síncrona de confirmação da importação (`ImportService.confirmImport()`) encerra-se estritamente após a promoção de faturamento, atualização da `base_atendimento`, validação da auditoria de integridade de 5 camadas e refresh das views de vendas. O recálculo de atividade comercial (`refresh_clientes_atividade()`) permanece 100% desacoplado e executa assincronamente em segundo plano via fila (`cm_clientes_atividade_jobs`) com controle de concorrência por Mutex no PostgreSQL (`pg_try_advisory_lock`). Falhas nesse recálculo analítico jamais provocam rollback da importação.
2. **Invalidação Coordenada de Cache por Evento**: A invalidação de caches visuais de apresentação ocorre obrigatoriamente acionada pelo evento oficial de sucesso do domínio (`CacheInvalidationService.onImportSuccess(batchId)`).
3. **Desacoplamento de Camadas de Apresentação**: O `ImportService` (serviço de domínio) é proibido de conhecer ou manipular diretamente estruturas de cache de UI (como `DashboardCache` ou `Map.clear()`). Toda invalidação é intermediada pelo `CacheInvalidationService`.
4. **Encapsulamento de Caches**: Caches de rotas e componentes expõem métodos formais de invalidação (ex: `DashboardCache.invalidate()`).
5. **Preservação de TTL para Navegação Normal**: O mecanismo de cache em memória com `CACHE_TTL = 5 minutos` é integralmente mantido para a navegabilidade do dia a dia, sendo descarregado estritamente por eventos oficiais de atualização.

---

## Consequências

### Benefícios:
- **Redução Drástica do Tempo de Importação**: O tempo da requisição síncrona de importação foi reduzido de > 118s (sujeito a timeout) para **~15,2s**, zerando incidents de timeout HTTP/API.
- **Atualização Imediata do Dashboard**: A primeira consulta do usuário pós-importação sofre Cache MISS, consulta o PostgreSQL e reconstrói o payload com dados frescos em **0,0000% de desvio**.
- **Baixo Acoplamento**: Separação clara entre domínio de dados, rotinas assíncronas em background e caches de UI.
- **Manutenção Simplificada e Escalabilidade**: Novos caches ou novos consumidores de eventos de carga podem ser acoplados ao `CacheInvalidationService` sem modificar uma única linha do `ImportService`.

### Trade-offs:
- **Aumento Discreto da Quantidade de Componentes**: Introdução das abstrações `CacheInvalidationService`, `DashboardCache` e da tabela de jobs `cm_clientes_atividade_jobs`.
- **Necessidade de Governança no Ponto Central**: O `CacheInvalidationService` passa a ser o regulador central de eventos de invalidação de cache da plataforma.

---

## Evidências

- **Baseline Oficial Seção 66 (`AGENTS.md`)**: Estabilização do Hub de Importação e Desacoplamento de Jobs Analíticos.
- **Baseline Oficial Seção 67 (`AGENTS.md`)**: Invalidação Coordenada de Cache de Apresentação.
- **Relatório de Homologação**: Teste de estresse com 75.705 registros (`CFOP_01 a 29jul.xlsx`), Batch ID `1e09b7c0-2921-4367-a220-75d7d6229186`, 0 erros, paridade de R$ 1.815.558,59 (0,0000% de desvio em relação ao MyMetrics).
- **Documento Técnico de Encerramento**: `documento_encerramento_import_hub_dashboard_cache.md`.

---

## Status Final

```text
IMPORT_HUB_STATUS = STABLE
DASHBOARD_CACHE_STATUS = STABLE
CACHE_INVALIDATION_STATUS = HOMOLOGATED
INCIDENT_STATUS = CLOSED
```
