<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## 14. Baseline Oficial — Analytics Engine V1 (Baseline Permanente)

A partir de 22/07/2026, a arquitetura e a suíte de ferramentas da **Analytics Engine V1** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Camada Analítica Única**: Toda e qualquer nova funcionalidade analítica ou dashboard deverá utilizar exclusivamente a `AnalyticsEngine` (`src/lib/governance/analytics`).
2. **Proibição de Consultas Locais**: Nenhuma nova rota de API analítica poderá montar SQL diretamente, construir cláusulas WHERE/GROUP BY locais ou implementar regras comerciais paralelas fora da `AnalyticsEngine`.
3. **Registry Oficial de Fontes**: O Registry Oficial em `src/lib/governance/analytics/sources.ts` é o único local autorizado para cadastro de fontes de dados. Nomes de views oficiais hardcoded fora do Registry são expressamente proibidos.
4. **Preservação da Governança Financeira**: Toda evolução analítica deve garantir 0,0000% de desvio em relação às views oficiais (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`, `public.sales`, `base_atendimento.faturamento_mensal`).
5. **Auditoria Contínua**: O comando `npm run health:analytics` (que inclui a auditoria de código, verificação de paridade financeira, `npx tsc --noEmit` e `npm run build`) é obrigatório no encerramento de qualquer ciclo de desenvolvimento.

Status Arquitetural: `ANALYTICS_ENGINE_V1 = LOCKED` & `BASELINE = CONFIRMED`.

---

## 15. Baseline Oficial — Ordenação das Redes Planejáveis pelo Ranking Comercial (Rolling FAT 3M)

A partir de 26/07/2026, todas as listas de Redes Planejáveis do ecossistema Coffee++ passam a utilizar obrigatoriamente a ordenação padrão do Ranking Oficial Comercial.

### Diretrizes Mandatórias:
1. **Critério Principal de Ordenação**: A ordenação de Redes Planejáveis deve ser baseada no faturamento acumulado dos últimos 3 meses fechados (**Rolling FAT 3M**).
2. **Direção do Ranking**: A ordenação deve ser **decrescente** (do maior faturamento para o menor).
3. **Regra de Desempate**: Em caso de empate no faturamento acumulado (ex: redes sem vendas nos últimos 3 meses), a ordenação deve utilizar **ordem alfabética pt-BR**.
4. **Fixação da Linha de Agrupamento**: A linha especial de agrupamento **"OUTROS"** deve permanecer **permanentemente fixada na última posição** da lista.
5. **Single Source of Truth**: O cálculo do Rolling FAT 3M deve consumir exclusivamente as fontes oficiais do Analytics (`mv_vendas_cliente_mensal` / `AnalyticsEngine`), sendo proibida a duplicação de regras aritméticas paralelas ou ordenações por faturamento corrente/projeção.

Status Arquitetural: `REDES_RANKING_SORT = LOCKED` & `BASELINE = CONFIRMED`.

---

## 16. Baseline Oficial — Governança do Desafio por Rede

A partir de 26/07/2026, a governança do Desafio por Rede no módulo RPS passa a seguir estritamente o modelo estratégico administrativo:

### Diretrizes Mandatórias:
1. **Single Source of Truth**: O Desafio por Rede é uma informação estratégica definida exclusivamente pela Administração Comercial, obtida unicamente de `cm_weekly_projections` (`kpi = 'META'`).
2. **Proibição Absoluta de Fallbacks**: É expressamente proibida qualquer derivação automática baseada em faturamento do mês anterior, rateio proporcional, Ano A, Mês A ou qualquer outra heurística. Quando não houver valor gravado, o sistema exibirá valor `0` (campo em branco / `—`).
3. **Exclusividade de Escrita**: Apenas usuários com perfil `Admin` ou `Admin Master` podem criar, editar ou remover o Desafio por Rede.
4. **Autorização Obrigatória no Backend**: O servidor deve validar a role do usuário autenticado no handler `POST` e rejeitar com HTTP `403 Forbidden` qualquer tentativa não autorizada de salvar/alterar `kpi = 'META'`.
5. **Auditoria Rastreável**: Toda alteração no Desafio por Rede deve registrar log de auditoria via `logAuditAction` com dados do usuário, timestamp, gerente, rede e valor novo.

Status Arquitetural: `DESAFIO_POR_REDE_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 17. Baseline Oficial — Gestão de Logos das Redes e Carta de Anuência (Baseline Permanente)

A partir de 26/07/2026, a arquitetura de gestão de logos das redes e snapshots do módulo Carta de Anuência torna-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Eliminação de URLs Textuais**: É expressamente proibido o uso de campos de entrada textual para URLs de logos (`URL da Logo da Rede`). A gestão da logo deve ser feita exclusivamente via upload de arquivo no componente `LogoUpload`.
2. **Processamento 100% Server-Side**: O frontend é responsável apenas por UX e preview local. Toda validação definitiva de extensões/MIME/tamanho, cálculo do hash SHA-256, dimensões, geração do `storage_path` e persistência física no bucket `logos-redes` deve ser realizada EXCLUSIVAMENTE pelo backend (Server Action `processarEUploadLogoRede`).
3. **Separação entre Cadastro Operacional e Histórico**:
   - `cm_logos_redes`: Mantém a logo oficial vigente (1 registro por `rede_id`).
   - `cm_logos_redes_historico`: Tabela dedicada que armazena todas as versões anteriores arquivadas.
4. **Snapshot Imutável em Cartas Emitidas**: Toda Carta de Anuência salva um snapshot imutável em `logo_snapshot_path`. Alterações futuras na logo oficial da rede não afetam cartas já emitidas.
5. **Proibição de URLs Absolutas no Banco**: Nenhuma tabela armazena URLs completas. A URL pública é resolvida 100% dinamicamente via `getStoragePublicUrl(...)`.
6. **Limpeza Controlada**: Remoção física de arquivos obsoletos do Storage é restrita a arquivos em `cm_logos_redes_historico` que NÃO estejam ativos em `cm_logos_redes` e NÃ0 estejam vinculados a NENHUMA Carta de Anuência.

Status Arquitetural: `LOGOS_REDES_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 55. Baseline Oficial — Sistema Inovações Fase 1 — Cockpit Comercial

A partir de 26/07/2026, a arquitetura e a suíte de componentes do **Sistema Inovações Fase 1 — Cockpit Comercial** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Fonte Única de Verdade**: O Cockpit Comercial consome exclusivamente dados homologados através da `AnalyticsEngine.getCockpitComercial(filters)`.
2. **Isolamento de Regras**: É proibida a implementação de regras comerciais ou aritméticas no frontend ou nos handlers da API. Toda lógica reside na `AnalyticsEngine`.
3. **Fluxo Arquitetural Único**: Dados Oficiais → `AnalyticsEngine.getCockpitComercial()` → API `GET /api/inovacoes/cockpit` → Interface `/inovacoes/cockpit`.
4. **Preservação de Paridade Financeira**: Toda evolução do Cockpit Comercial deve manter 0,0000% de desvio em relação às views oficiais (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`).
5. **Componentes Oficiais Congelados**: `ExecutiveKpis`, `SaudeCarteiraGrid`, `RankingComercialTabs`, `OportunidadesEngine` e `CockpitFilterBar`.
6. **Auditoria Mandatória**: Nenhuma alteração pode ser submetida sem aprovação prévia em `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `SISTEMA_INOVACOES_COCKPIT = LOCKED` & `BASELINE = CONFIRMED`.

---

## 56. Baseline Oficial — Sistema Inovações Fase 2 — DRE Comercial

A partir de 26/07/2026, as diretrizes da **Fase 2 — DRE Comercial** do Sistema Inovações passam a integrar o planejamento e arquitetura oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Não Regressão**: A DRE Comercial não altera tabelas oficiais, módulos existentes, indicadores homologados ou regras financeiras atuais. Toda evolução deve ocorrer através de camada analítica isolada.
2. **Fonte Oficial dos Dados**: A DRE Comercial consome exclusivamente `vw_faturamento_comercial_oficial`, `cm_clientes`, fontes financeiras homologadas e a `AnalyticsEngine`. É proibida a criação de duplicidade financeira.
3. **Dimensões Oficiais de Análise**: Permite visões multidimensionais por cliente, rede, gerente, região, canal e SKU.
4. **Fórmula Financeira Oficial de MACO**: MACO = Faturamento - Custo - Impostos - Frete - Investimento Comercial.
5. **Fluxo Arquitetural Único**: Dados Oficiais → `AnalyticsEngine.getDreComercial()` → API Read-Only → Interface DRE Comercial.

Status Arquitetural: `SISTEMA_INOVACOES_DRE_COMERCIAL = CONFIRMED`.

---

## 57. Baseline Oficial — Sistema Inovações Fase 2 — DRE Comercial / MACO

A partir de 09/08/2026, a arquitetura, fórmulas financeiras, dimensões e a suíte de componentes do **Sistema Inovações Fase 2 — DRE Comercial / MACO** tornam-se o baseline permanente e oficial do Coffee++.

### Status
`DRE_COMERCIAL = HOMOLOGADO_E_CONGELADO`

### Fonte única de verdade
`AnalyticsEngine.getDreComercial(filters)`

A DRE Comercial e todos os seus consumidores analíticos devem utilizar a mesma definição financeira centralizada.

### Fórmula oficial

**Faturamento Bruto**
= `SUM(vlr_total_liq + vlr_desconto)`

**Descontos**
= `SUM(vlr_desconto)`

**Receita Comercial Líquida**
= `Faturamento Bruto − Descontos`

**Impostos / Deduções Fiscais**
= `ABS(ICMS + ST)`

**Receita Após Impostos**
= `Receita Comercial Líquida − Impostos`

**CPV**
= `SUM(custo_total)`

**Margem Bruta Contábil**
= `Receita Após Impostos − CPV`

**Frete**
= `Receita Comercial Líquida × 3%`

**Investimento Comercial**
= `SUM(valor_investimento)` onde `verba_aprovada = true`

**MACO**
= `Receita Após Impostos − CPV − Frete − Investimento`

**% MACO**
= `MACO / Receita Comercial Líquida × 100`

### Dimensões oficiais

O DRE suporta:
1. Cliente / PDV
2. Rede / Matriz
3. Gerente Comercial
4. Região
5. UF
6. Canal de Vendas
7. SKU / Produto

O backend deve respeitar efetivamente a dimensão selecionada.

### Consumidores oficiais

Os seguintes módulos devem permanecer alinhados ao `AnalyticsEngine.getDreComercial()`:
* DRE Comercial
* CRM Comercial
* Centro de Inteligência
* Forecast Comercial
* Simulador Comercial
* Assistente Comercial IA
* Painel Presidência
* ExecutiveCommercial

É proibida a criação de fórmula paralela de MACO nesses consumidores sem alteração formal desta baseline.

### Evidência de homologação

Junho/2026:
* Receita Comercial Líquida: R$ 8.987.355,39
* Impostos: R$ 3.481.463,15
* Receita Após Impostos: R$ 5.505.892,24
* CPV: R$ 4.106.753,97
* Margem Bruta: R$ 1.399.138,27
* Frete: R$ 269.620,66
* Investimento: R$ 38,00
* MACO: R$ 1.129.479,61
* % MACO: 12,57%

### Auditoria

* Erro anterior de inversão de sinal: CORRIGIDO
* MACO anterior de R$ 8.092.405,91: ELIMINADO
* % MACO anterior de 90,04%: ELIMINADO
* Ocorrências residuais do cálculo antigo: 0
* Consumidores divergentes: 0
* Desvio downstream: 0,0000%
* TypeScript: aprovado
* Testes de domínio: 20/20
* Build de produção: aprovado

### Regra de governança

A fórmula acima passa a ser a **única definição oficial de MACO Comercial da plataforma**.

Qualquer alteração futura em:
* Receita Líquida;
* Impostos;
* CPV;
* Frete;
* Investimento;
* MACO;
* % MACO;
* dimensões do DRE;

deverá ser tratada como alteração de baseline financeira e não poderá ser realizada como ajuste isolado de interface ou módulo.

A homologação desta baseline foi precedida por:
1. Auditoria READ_ONLY;
2. Correção controlada;
3. Teste de regressão;
4. Auditoria dimensional;
5. Auditoria de impacto downstream;
6. Reconciliação matemática.

Status Arquitetural: `DRE_COMERCIAL = HOMOLOGADO_E_CONGELADO` & `BASELINE = PERMANENTE`.

---

## 58. Sistema Inovações Fase 3 — CRM Comercial (Planejamento Oficial)

A partir de 26/07/2026, a arquitetura e diretrizes de planejamento da **Fase 3 — CRM Comercial** do Sistema Inovações passam a integrar o plano diretor oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Objetivo Central**: Instituir oficialmente a Fase 3 destinada à gestão ativa da carteira comercial por meio de inteligência prescritiva, respondendo à pergunta: *"Qual ação comercial deve ser executada agora?"*.
2. **Escopo Funcional Prescritivo**: O CRM Comercial não será um CRM operacional ou tradicional. Será uma camada analítica prescritiva que transforma os indicadores do Cockpit Comercial e da DRE Comercial em recomendações priorizadas por impacto financeiro.
3. **Fluxo Arquitetural Único**: Dados Oficiais → `AnalyticsEngine.getCockpitComercial(filters)` & `AnalyticsEngine.getDreComercial(filters)` → `AnalyticsEngine.getCrmComercial(filters)` → API `GET /api/inovacoes/crm` → Interface `/inovacoes/crm`.
4. **Fontes Oficiais Homologadas**: Exclusivamente `cm_clientes`, `vw_faturamento_comercial_oficial`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`, `cm_acoes_investimento` e a `AnalyticsEngine`. É proibido o consumo de fontes não homologadas.
5. **Centralização na AnalyticsEngine**: É proibida a implementação de regras comerciais no React, na API ou em SQL local na camada HTTP. Toda lógica permanece centralizada na `AnalyticsEngine`.
6. **Escopo MVP 100% Read-Only**: Nesta fase, o CRM Comercial será estritamente read-only. É proibida qualquer implementação de workflow, tarefas, edição, anotações, persistência operacional ou CRM transacional.

Status Arquitetural: `CRM_COMERCIAL = PLANNING`.

---

## 59. Baseline Oficial — Sistema Inovações Fase 3 — CRM Comercial (Baseline Permanente)

A partir de 26/07/2026, a arquitetura e a suíte de componentes do **Sistema Inovações Fase 3 — CRM Comercial** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Responder deterministicamente à pergunta: *"Qual ação comercial deve ser executada agora?"*.
2. **Fluxo Arquitetural Único**: Dados Oficiais → `AnalyticsEngine.getCrmComercial(filters)` → API `GET /api/inovacoes/crm` → Interface `/inovacoes/crm`. Nenhuma camada intermediária poderá conter regras comerciais ou SQL.
3. **Motor Analítico Centralizado**: Toda inteligência e cálculo de recomendações pertencem exclusivamente à `AnalyticsEngine.getCrmComercial(filters)`. São proibidos cálculos no React, na API ou SQL local na camada HTTP.
4. **Fontes Oficiais**: Exclusivamente `vw_faturamento_comercial_oficial`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`, `cm_clientes` e `cm_acoes_investimento`.
5. **Metodologia Oficial do Score Comercial**: Score padronizado entre 0 e 100 baseado em Impacto Financeiro (40%), Criticidade (30%), Relevância Comercial (20%) e Urgência Temporal (10%). Alterações exigem nova baseline.
6. **Contrato Oficial Congelado**: `CrmComercialData` (composto por `CrmResumoCarteira`, `CrmOportunidade` e `rankingGerentesScore`).
7. **Componentes Oficiais Congelados**: `CrmFilterBar`, `CrmResumoExecutivo`, `CrmRecomendacoes`, `CrmScoreCard`, `CrmOportunidadesGrid` e `CrmClienteDrawer`.
8. **Auditoria Obrigatória**: Toda evolução futura deverá comprovar aprovação prévia em `npm run health:analytics`, `npx tsc --noEmit` e `npm run build` com 0 erros, 0 regressões e 0,0000% de desvio financeiro.

Status Arquitetural: `CRM_COMERCIAL = LOCKED` & `BASELINE = CONFIRMED`.

---

## 60. Termo de Encerramento Oficial — Sistema Inovações (Ciclo 1)

A partir de 26/07/2026, o primeiro ciclo do **Sistema Inovações** do Coffee++ encontra-se oficialmente encerrado, homologado e congelado em baseline permanente.

### Consolidação Arquitetural do Ciclo 1:
- **Seção 55**: Baseline Oficial — Cockpit Comercial (Fase 1) `[LOCKED & CONFIRMED]`
- **Seção 57**: Baseline Oficial — DRE Comercial / MACO (Fase 2) `[HOMOLOGADO & CONGELADO]`
- **Seção 59**: Baseline Oficial — CRM Comercial (Fase 3) `[LOCKED & CONFIRMED]`

### Diretrizes Permanentes de Governança:
1. **Centralização Total**: Toda e qualquer regra de negócio analítica permanece 100% centralizada na `AnalyticsEngine`. São proibidos cálculos no React ou nas APIs HTTP.
2. **Fontes Oficiais Homologadas**: Consumo exclusivo de `vw_faturamento_comercial_oficial`, `mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`, `cm_clientes` e `cm_acoes_investimento`.
3. **Auditoria Obrigatória de Encerramento**: Nenhuma alteração futura poderá ser submetida sem aprovação prévia em `npm run health:analytics`, `npx tsc --noEmit` e `npm run build` com 0 erros, 0 regressões e 0,0000% de desvio financeiro.
4. **Evoluções Futuras**: Qualquer nova funcionalidade deverá ser tratada como nova Fase ou nova baseline homologada, preservando integralmente a estabilidade das Fases 1, 2 e 3.

Status Geral: `SISTEMA INOVAÇÕES — CICLO 1 ENCERRADO` | `ARQUITETURA = LOCKED` | `GOVERNANÇA = CONFIRMED` | `BASELINE = PERMANENTE`.

---

## 61. Baseline Oficial — Centro de Inteligência Comercial (Módulo Independente)

A partir de 26/07/2026, o **Centro de Inteligência Comercial** passa a integrar o ecossistema Coffee++ como um **módulo totalmente independente**, desenvolvido sob arquitetura desacoplada e sem qualquer alteração nas Fases 1, 2 e 3 do Sistema Inovações.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Consolidar análises executivas avançadas para apoio à tomada de decisão comercial, reunindo indicadores estratégicos, oportunidades, riscos e eficiência da carteira em uma interface única.
2. **Fluxo Arquitetural Único**: Fontes Oficiais → `CommercialIntelligenceEngine` → API `GET /api/inteligencia` → Interface `/inteligencia`.
3. **Componentes Oficiais Congelados**: `CommercialIntelligenceEngine`, `GET /api/inteligencia`, `/inteligencia`, `InteligenciaFilterBar`, `InteligenciaKpis`, `InteligenciaRadarGrid`, `InteligenciaRegionalScore` e `InteligenciaDrawer`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs, contratos ou páginas do Sistema Inovações (`/inovacoes/cockpit`, `/inovacoes/dre`, `/inovacoes/crm`). Toda evolução do novo módulo ocorre exclusivamente em arquivos isolados.
5. **Garantia de Paridade e Compatibilidade**: Mantidos 100% de compatibilidade retroativa, 0 arquivos existentes alterados, 0 breaking changes, 0 regressões e 0,0000% de desvio financeiro.
6. **Auditoria Mandatória**: Toda evolução deverá ser homologada mediante `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `COMMERCIAL_INTELLIGENCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 62. Baseline Oficial — Forecast Comercial (Módulo Independente)

A partir de 26/07/2026, o **Forecast Comercial** passa a integrar o ecossistema Coffee++ como um **módulo totalmente independente**, desenvolvido sob arquitetura desacoplada e sem qualquer alteração no Sistema Inovações ou no Centro de Inteligência Comercial.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Fornecer projeções executivas de fechamento do mês utilizando exclusivamente fontes oficiais homologadas, permitindo antecipar faturamento, rentabilidade, margem, MACO, tendências, riscos, oportunidades e recomendações, mantendo processamento integralmente read-only em memória.
2. **Fluxo Arquitetural Único**: Fontes Oficiais → `ForecastEngine` → API `GET /api/forecast` → Interface `/forecast`.
3. **Componentes Oficiais Congelados**: `ForecastEngine`, `ForecastCalculator`, `ForecastConfidence`, `ForecastExplanation`, `ForecastRecommendation`, `ForecastScenario`, `ForecastQuality`, `GET /api/forecast`, `/forecast`, `ForecastFilterBar`, `ForecastResumoExecutivo`, `ForecastFaturamentoCard`, `ForecastRentabilidadeCard`, `ForecastTrendCard`, `ForecastConfidenceCard`, `ForecastExplanationCard`, `ForecastScenarioCard`, `ForecastRecommendationCard`, `ForecastModelQualityCard`, `ForecastRiscosCard`, `ForecastOportunidadesCard`, `ForecastRegionalGrid`, `ForecastGerenteGrid`, `ForecastCanalGrid`, `ForecastRedeGrid`, `ForecastUfGrid` e `ForecastDrawer`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs, contratos ou páginas do Sistema Inovações ou Centro de Inteligência Comercial (`/inovacoes/cockpit`, `/inovacoes/dre`, `/inovacoes/crm`, `/inteligencia`). Toda evolução do novo módulo ocorre exclusivamente em arquivos isolados.
5. **Garantia de Paridade e Compatibilidade**: Mantidos 100% de compatibilidade retroativa, 0 arquivos existentes alterados, 0 breaking changes, 0 regressões e 0,0000% de desvio financeiro.
6. **Auditoria Mandatória**: Toda evolução deverá ser homologada mediante `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `FORECAST_COMERCIAL = LOCKED` & `BASELINE = CONFIRMED`.

---

## 63. Baseline Oficial — Simulador Comercial (Módulo Independente)

A partir de 26/07/2026, o **Simulador Comercial** passa a integrar o ecossistema Coffee++ como um **módulo totalmente independente**, desenvolvido sob arquitetura desacoplada e sem qualquer alteração no Sistema Inovações, Centro de Inteligência Comercial ou Forecast Comercial.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Fornecer um ambiente executivo para simulação de cenários estratégicos utilizando exclusivamente dados oficiais homologados do Coffee++, permitindo avaliar impactos financeiros e comerciais sem qualquer persistência de dados. Todas as simulações ocorrem 100% em memória (read-only).
2. **Fluxo Arquitetural Único**: Fontes Oficiais → `SimulationEngine` → API `GET /api/simulador` → Interface `/simulador`.
3. **Componentes Oficiais Congelados**: `SimulationEngine`, `ScenarioEngine`, `ImpactCalculator`, `ROIEngine`, `RecommendationEngine`, `SimulationData`, `SimulationScenario`, `SimulationImpact`, `SimulationRecommendation`, `GET /api/simulador`, `/simulador`, `SimulationFilterBar`, `ScenarioEditor`, `ScenarioComparison`, `SimulationForecastCard`, `SimulationImpactCard`, `SimulationROI`, `SimulationPayback`, `SimulationRecommendationCard`, `SimulationRiskCard`, `SimulationOpportunityCard`, `SimulationRegionalGrid`, `SimulationGerenteGrid`, `SimulationCanalGrid`, `SimulationRedeGrid`, `SimulationUfGrid`, `SimulationSkuGrid`, `SimulationTimeline` e `SimulationDrawer`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs, contratos ou páginas do Sistema Inovações, Centro de Inteligência Comercial ou Forecast Comercial (`/inovacoes/cockpit`, `/inovacoes/dre`, `/inovacoes/crm`, `/inteligencia`, `/forecast`). Toda evolução do novo módulo ocorre exclusivamente em arquivos isolados.
5. **Garantia de Paridade e Compatibilidade**: Mantidos 100% de compatibilidade retroativa, 0 arquivos existentes alterados, 0 breaking changes, 0 regressões, 0 persistência de dados e 0,0000% de desvio financeiro.
6. **Auditoria Mandatória**: Toda evolução deverá ser homologada mediante `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `SIMULADOR_COMERCIAL = LOCKED` & `BASELINE = CONFIRMED`.

---

## 64. Baseline Oficial — Assistente Comercial (Módulo Independente)

A partir de 26/07/2026, o **Assistente Comercial** passa a integrar o ecossistema Coffee++ como um **módulo totalmente independente**, desenvolvido sob arquitetura desacoplada e sem qualquer alteração no Sistema Inovações, Centro de Inteligência Comercial, Forecast Comercial ou Simulador Comercial.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Fornecer um ambiente executivo de consulta em linguagem natural capaz de interpretar diagnósticos e responder perguntas estratégicas utilizando exclusivamente dados oficiais homologados do Coffee++, sem qualquer persistência de dados (read-only).
2. **Fluxo Arquitetural Único**: Fontes Oficiais → `CommercialAssistantEngine` → API `GET/POST /api/assistente` → Interface `/assistente`.
3. **Componentes Oficiais Congelados**: `CommercialAssistantEngine`, `GET/POST /api/assistente`, `/assistente`, `AssistantFilterBar`, `AssistantChat`, `AssistantSuggestedQueries`, `AssistantKpis` e `AssistantDrawer`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs, contratos ou páginas do Sistema Inovações, Centro de Inteligência Comercial, Forecast Comercial ou Simulador Comercial (`/inovacoes/cockpit`, `/inovacoes/dre`, `/inovacoes/crm`, `/inteligencia`, `/forecast`, `/simulador`). Toda evolução do novo módulo ocorre exclusivamente em arquivos isolados.
5. **Garantia de Paridade e Compatibilidade**: Mantidos 100% de compatibilidade retroativa, 0 arquivos existentes alterados, 0 breaking changes, 0 regressões, 0 persistência de dados e 0,0000% de desvio financeiro.
6. **Auditoria Mandatória**: Toda evolução deverá ser homologada mediante `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `COMMERCIAL_ASSISTANT = LOCKED` & `BASELINE = CONFIRMED`.

---

## 65. Baseline Oficial — Painel Presidência (Módulo Independente)

A partir de 26/07/2026, o **Painel Presidência** passa a integrar o ecossistema Coffee++ como um **módulo totalmente independente**, desenvolvido sob arquitetura desacoplada e sem qualquer alteração no Sistema Inovações, Centro de Inteligência Comercial, Forecast Comercial, Simulador Comercial ou Assistente Comercial.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Prover uma visão executiva única para a diretoria capaz de consolidar a saúde geral do negócio e orientar decisões estratégicas imediatas, consumindo exclusivamente os módulos homologados sem duplicar regras ou recalcular métricas.
2. **Fluxo Arquitetural Único**: Módulos Homologados → `PresidencyDashboardEngine` → API `GET /api/presidencia` → Interface `/presidencia`.
3. **Componentes Oficiais Congelados**: `PresidencyDashboardEngine`, `GET /api/presidencia`, `/presidencia`, `PresidencyHeader`, `PresidencyKpis`, `PresidencyFinancialPanel`, `PresidencyCommercialHealth`, `PresidencyRiskPanel`, `PresidencyOpportunityPanel`, `PresidencyScenarioPanel`, `PresidencyAssistantPanel` e `PresidencyDrawer`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs, contratos ou páginas do Sistema Inovações, Centro de Inteligência Comercial, Forecast Comercial, Simulador Comercial ou Assistente Comercial (`/inovacoes/cockpit`, `/inovacoes/dre`, `/inovacoes/crm`, `/inteligencia`, `/forecast`, `/simulador`, `/assistente`). Toda evolução do novo módulo ocorre exclusivamente em arquivos isolados.
5. **Garantia de Paridade e Compatibilidade**: Mantidos 100% de compatibilidade retroativa, 0 arquivos existentes alterados, 0 breaking changes, 0 regressões, 0 persistência de dados e 0,0000% de desvio financeiro.
6. **Auditoria Mandatória**: Toda evolução deverá ser homologada mediante `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `PRESIDENCY_DASHBOARD = LOCKED` & `BASELINE = CONFIRMED`.

---

## 66. Baseline Oficial — Módulo Analítico Hist Família (Baseline Permanente)

A partir de 28/07/2026, a arquitetura e a suíte de componentes do **Módulo Analítico Hist Família** tornam-se o baseline permanente e oficial do Coffee++.

### Termo de Homologação:
1. **Objetivo Oficial**: Fornecer à diretoria comercial uma visão executiva completa e profunda da evolução histórica das famílias de produtos da Coffee Mais, abrangendo análises de participação de mercado (Share Filtrado % e Share Empresa %), crescimento multiperíodo (MoM e YoY), curva Pareto 80/20 (Análise ABC), matriz sazonal (Heatmap), mix de vendas (Treemap), inteligência de insights automáticos e navegação interativa em 3 níveis (Família → Linha/SKU → Clientes Compradores).
2. **Fluxo Arquitetural Único**: Fontes Oficiais (`mv_positivacao_sku_mensal`, `mv_vendas_mensal`) → `AnalyticsEngine.getHistoricoFamiliaData(filters)` → API `GET /api/dashboard/historico-familia` → Interface `/historico-familia`.
3. **Consumo Exclusivo da AnalyticsEngine**: É expressamente proibida qualquer montagem de SQL local nas APIs HTTP ou no React. Toda a lógica de agregação e inteligência analítica reside 100% centralizada na `AnalyticsEngine`.
4. **Fontes de Dados Homologadas**: Consumo exclusivo de `public.mv_positivacao_sku_mensal` (para faturamento, volume, positivadores e SKU/cliente) e `public.mv_vendas_mensal` (para total faturamento corporativo da empresa).
5. **Aderência Total à Governança Analítica**: Mantida 0,0000% de divergência financeira, isolamento absoluto de código existente e sem criação de campos ou estruturas fictícias de Tipologia (conforme restrição de governança).
6. **Componentes Oficiais Congelados**: `AnalyticsEngine.getHistoricoFamiliaData()`, `GET /api/dashboard/historico-familia`, `/historico-familia`, KPIs Executivos, Card Família Líder, Insights Automáticos, Ranking com chave Top 10/Todas, Pareto 80/20, Treemap Executivo, Área Empilhada Mês a Mês, Heatmap Sazonal, Tabela Analítica Ordenável/Exportável (Excel/CSV) e Drawer de Drill Down 3 Níveis.
7. **Homologação Documental**: Walkthrough executivo homologado e especificações aprovadas.
8. **Homologação Técnica**: 100% aprovado nos testes automatizados `npm run audit:analytics`, `npm run verify:parity`, `npx tsc --noEmit` e `npm run build`.
9. **Estratégia Oficial de Carregamento & Performance (Diretriz Permanente)**:
   - Carregamento inicial executado exclusivamente com consultas agregadas essenciais para a renderização completa da página (Totais, KPIs, Ranking, Pareto, Evolução Mensal, Heatmap e Treemap).
   - Qualquer consulta de alta cardinalidade (ex.: detalhamento de clientes compradores por SKU no Nível 3 do Drill Down) utilizará obrigatoriamente carregamento sob demanda (*Lazy Loading*) via `AnalyticsEngine.getFamiliaClientBreakdownData()`.
   - O carregamento inicial da tela nunca deverá depender de consultas de terceiro nível do Drill Down.
   - Esta estratégia de carregamento faz parte da baseline oficial congelada do módulo Hist Família e deverá ser preservada em todas as evoluções futuras, salvo nova Sprint de Arquitetura e nova homologação.

Status Arquitetural: `HISTORICO_FAMILIA = LOCKED` & `BASELINE = CONFIRMED`.

---


## 66. Baseline Oficial — Ciclo 2 Enterprise Maturity Program & Health Center

A partir de 27/07/2026, o **Ciclo 2 — Enterprise Maturity Program** entra oficialmente em vigor no ecossistema Coffee++, introduzindo o novo módulo administrativo **Health Center** (`/health`) sob arquitetura desacoplada e sem qualquer alteração comportamental ou financeira em módulos homologados do Ciclo 1.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Elevar a plataforma Coffee++ ao nível Enterprise por meio das 9 frentes estratégicas (Observabilidade, Performance, Segurança, UX Executiva, Testes, Telemetria, Documentação, Health Center e Qualidade), sem alterar nenhuma regra comercial ou financeira homologada.
2. **Fluxo Arquitetural Único**: Telemetria & Diagnósticos → `EnterpriseObservabilityEngine` → API `GET /api/health` → Interface `/health`.
3. **Componentes Oficiais Congelados**: `EnterpriseObservabilityEngine`, `GET /api/health`, `/health`, `HealthKpis`, `GovernanceHealthPanel`, `PerformanceTelemetryPanel`, `SecurityAuditPanel` e `TestCoveragePanel`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs, contratos ou páginas do Ciclo 1 (`/inovacoes/cockpit`, `/inovacoes/dre`, `/inovacoes/crm`, `/inteligencia`, `/forecast`, `/simulador`, `/assistente`, `/presidencia`). Toda evolução da maturidade ocorre em arquivos isolados.
5. **Garantia de Paridade e Compatibilidade**: Mantidos 100% de compatibilidade retroativa, 0 arquivos existentes alterados, 0 breaking changes, 0 regressões, 0 persistência de dados e 0,0000% de desvio financeiro.
6. **Auditoria Mandatória**: Toda evolução deverá ser homologada mediante `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `ENTERPRISE_MATURITY_PROGRAM = LOCKED` & `BASELINE = CONFIRMED`.

---

## 67. Baseline Oficial — Sprint 2.1 — Enterprise Observability Program

A partir de 27/07/2026, a **Sprint 2.1 — Enterprise Observability Program** passa a integrar a plataforma Coffee++ sob arquitetura desacoplada e sem qualquer alteração nos módulos homologados do Ciclo 1.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Monitorar continuamente a disponibilidade, vazão de requisições, tempo de resposta P95/P99, Health Scores por módulo (0–100) e histórico de exceções tratadas da plataforma.
2. **Fluxo Arquitetural Único**: Telemetria em Tempo Real → `EnterpriseObservabilityMetricsEngine` → API `GET /api/health/metrics` → Interface `/health`.
3. **Componentes Oficiais Congelados**: `EnterpriseObservabilityMetricsEngine`, `GET /api/health/metrics`, `ObservabilityOverview`, `ModuleHealthScore`, `ApiPerformanceTable`, `ErrorTimeline` e `SystemTrendPanel`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs ou páginas dos módulos homologados. Toda evolução ocorre exclusivamente em novos arquivos isolados.

Status Arquitetural: `OBSERVABILITY_ENTERPRISE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 68. Baseline Oficial — Sprint 2.2 — Enterprise Performance & Optimization Program

A partir de 27/07/2026, a **Sprint 2.2 — Enterprise Performance & Optimization Program** passa a integrar o ecossistema Coffee++ sob arquitetura desacoplada e sem qualquer alteração no comportamento funcional ou regras financeiras homologadas.

### Diretrizes Mandatórias:
1. **Objetivo Oficial**: Prover diagnósticos avançados de performance (Profiling de execução de Engines, Análise de tamanho de Bundles, Análise de leituras de Views Oficiais via Registry e Recomendações de Otimização Segura em memória).
2. **Fluxo Arquitetural Único**: Telemetria de Eficiência → `EnterprisePerformanceEngine` → API `GET /api/health/performance` → Interface `/health`.
3. **Componentes Oficiais Congelados**: `EnterprisePerformanceEngine`, `GET /api/health/performance`, `PerformanceOverview`, `EngineProfiler`, `QueryAnalyzerPanel`, `BundleAnalyzerPanel` e `OptimizationRecommendations`.
4. **Isolamento Absoluto**: Fica expressamente proibida qualquer alteração em componentes, APIs, contratos ou páginas do Ciclo 1 e da Sprint 2.1. Toda evolução de otimização ocorre exclusivamente em arquivos isolados de leitura.
5. **Garantia de Paridade e Compatibilidade**: Mantidos 100% de compatibilidade retroativa, 0 arquivos existentes alterados, 0 breaking changes, 0 regressões, 0 persistência de dados e 0,0000% de desvio financeiro.
6. **Auditoria Mandatória**: Toda evolução deverá ser homologada mediante `npm run health:analytics`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `PERFORMANCE_ENTERPRISE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 69. Baseline Oficial — Carteira Dinâmica de Planejamento (Admin Only)

A partir de 27/07/2026, a funcionalidade de **Gestão Dinâmica da Carteira de Planejamento** passa a integrar a RPS (`/processo-comercial/rps`), permitindo a customização das redes participantes do planejamento mensal por administradores sem alterar o cadastro oficial de vendas ou a carteira comercial de outros módulos.

### Diretrizes Mandatórias:
1. **Exclusividade de Acesso (Admin Only)**: Somente usuários autenticados com perfis `Admin` ou `Admin Master` possuem autorização para incluir redes (`+`), remover redes (`-`) ou reordenar posições (`▲` / `▼`). Demais perfis possuem acesso estritamente leitura.
2. **Carregamento Automático de Dados Oficiais**: Quando uma nova rede é adicionada ao planejamento, seus indicadores históricos (Rolling FAT 3M, Ano A, Mês A, Real, Meta e projeções) são carregados automaticamente consumindo as fontes oficiais homologadas.
3. **Persistência em Tabela Dedicada**: Toda customização de planejamento é salva na tabela `cm_rps_custom_carteira` (`year`, `month`, `manager`, `client_matrix`, `display_order`, `is_excluded`).
4. **Isolamento de Cadastro**: A inclusão ou exclusão afeta exclusivamente a visão de planejamento da RPS para o mês correspondente, preservando 100% da integridade de vendas, clientes e faturamento nos demais módulos.
5. **Auditoria Rastreável**: Operações de inclusão, remoção e reordenação registram logs de auditoria via `logAuditAction` (`RPS_REDE_INCLUSAO`, `RPS_REDE_EXCLUSAO`, `RPS_REDE_REORDENACAO`).
6. **Segurança no Backend**: Tentativas não autorizadas de manipular a carteira por perfis não administrativos são rejeitadas pelo servidor com **HTTP 403 Forbidden**.

Status Arquitetural: `RPS_DYNAMIC_PLANNING_CARTEIRA = LOCKED` & `BASELINE = CONFIRMED`.

---

## 70. Regra Geral de Governança — Preservação de Permissões e Regras de Negócio (Baseline Permanente)

A partir de 27/07/2026, estabelece-se a regra geral e permanente de governança funcional para o ecossistema Coffee++:

### Diretrizes Mandatórias:
1. **Preservação de Permissões Homologadas**: Novas funcionalidades não podem alterar regras de permissão existentes sem uma decisão explícita de negócio e aprovação arquitetural prévia.
2. **Não Regressão em Sprints**: Toda Sprint deve preservar integralmente as regras funcionais previamente homologadas, salvo quando houver mudança explicitamente aprovada de requisito.
3. **Escopo Restrito de Modificações**: O desenvolvimento de novas funcionalidades deve restringir seus impactos exclusivamente ao escopo solicitado, sendo proibido alterar permissões de células, visibilidade de papéis ou fluxos operacionais vigentes.

Status Arquitetural: `PERMISSIONS_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 71. Baseline Oficial — Restrição da Linha "TOTAL BRASIL" na RPS (Admin Only)

A partir de 27/07/2026, a visualização da linha consolidada **TOTAL BRASIL** no módulo RPS (`/processo-comercial/rps`) passa a ser restrita exclusivamente a administradores:

### Diretrizes Mandatórias:
1. **Exclusividade de Acesso (Admin Only)**: Apenas usuários autenticados com perfis `Admin` ou `Admin Master` podem visualizar a linha consolidada `TOTAL BRASIL`. Demais perfis (Gerente Nacional, Gerente Regional, Supervisor, Promotor, Consulta, etc.) não possuem acesso a este consolidado.
2. **Decisão no Servidor (Server-Side Enforcement)**: A API `GET /api/processo-comercial/rps` valida o perfil do usuário e retorna `canViewTotalBrasil = false` para perfis não administrativos.
3. **Renderização Limpa**: Quando o usuário não possui permissão, o frontend renderiza as demais linhas dos gerentes normalmente, sem lacunas visuais, linhas em branco ou alterações de layout.

Status Arquitetural: `TOTAL_BRASIL_RPS_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 72. Baseline Oficial — Padronização de Formatação e Divisória de Gerentes (RPS)

A partir de 27/07/2026, a interface do módulo RPS (`/processo-comercial/rps`) segue o padrão oficial de apresentação executiva:

### Diretrizes Mandatórias:
1. **Formatação de VOL**: Exibido estritamente com **1 casa decimal** (ex: `83,4`, `152,8`, `95,0`).
2. **Formatação de FAT**: Exibido estritamente em **números inteiros sem casas decimais** (ex: `3072`, `1814`, `665`, `676`).
3. **Formatação de INVEST**: Exibido estritamente com **1 casa decimal** (ex: `10,0%`, `9,5%`, `12,6%`, `0,0%`).
4. **Divisória Visual entre Gerentes**: Cada grupo de gerente (`tbody`) possui separador superior em tom accent-gold/40 e borda inferior reforçada para garantir legibilidade executiva.
5. **Preservação Total**: A padronização é estritamente de UI/UX, mantendo intocada a precisão matemática dos cálculos e dados persistidos.

Status Arquitetural: `RPS_UI_FORMATTING = LOCKED` & `BASELINE = CONFIRMED`.

---

## 73. Baseline Oficial — Refinamento Executivo de UX da RPS (Baseline Permanente)

A partir de 27/07/2026, a interface do módulo RPS (`/processo-comercial/rps`) adota o padrão oficial de refinamento visual executivo:

### Diretrizes Mandatórias:
1. **Agrupamento Visual de Gerentes**: Separadores superiores nítidos (`border-t-2 border-accent-gold/60`), destaque na célula de identificação do gerente e respiro vertical adequado entre blocos.
2. **Ponto Focal da Coluna DESAFIO**: Fundo dourado/bege suave (`bg-amber-500/15`), borda lateral discreta e fonte em negrito (`font-extrabold`), destacando a meta oficial da Administração Comercial.
3. **Destaque da Semana Corrente**: Coluna da semana ativa identificada por cabeçalho em destaque, badge `▲ ATUAL`, fundo diferenciado e inputs sobressalentes.
4. **Rodapé Restaurado**: Preservação da legenda explicativa dos indicadores (`% DISP`, `% DESAFIO`, `%AA`, `%MA`) e do botão primário `SALVAR PROJEÇÕES` fixado no rodapé da tabela.
5. **Preservação Integral de Negócio**: Refinamentos estritamente visuais, sem qualquer impacto em regras, APIs, cálculos, SSOT ou governança.

Status Arquitetural: `RPS_EXECUTIVE_UX = LOCKED` & `BASELINE = CONFIRMED`.

---

## 74. Baseline Oficial — Destaque e Bordas Verticais Contínuas da Coluna DESAFIO (RPS)

A partir de 27/07/2026, a coluna **DESAFIO** no módulo RPS (`/processo-comercial/rps`) passa a utilizar bordas verticais contínuas de 2px do topo até o rodapé:

### Diretrizes Mandatórias:
1. **Bloco Visual Único**: A coluna DESAFIO é envolvida por bordas verticais contínuas de 2px (`border-x-2 border-amber-500/50`) em toda a sua extensão, englobando o cabeçalho (`th`), células de gerentes, clientes/redes expandidas e a linha `TOTAL BRASIL` no rodapé (`tfoot`).
2. **Preservação do Fundo e Formatação**: Mantidos o fundo bege/amber suave (`bg-amber-500/10` / `bg-amber-500/15`), a tipagem numérica e os destaques visuais existentes, elevando o contraste executivo sem cores estridentes.
3. **Imutabilidade de Negócio**: Refinamento puramente visual (UI/UX), com 0 alteração em regras, APIs, cálculos, SSOT ou governança.

Status Arquitetural: `RPS_DESAFIO_COLUMN_BORDERS = LOCKED` & `BASELINE = CONFIRMED`.

---

## 75. Baseline Oficial — Moldura Dourada Dupla e Preservação Geométrica (RPS)

A partir de 27/07/2026, a interface executiva da RPS (`/processo-comercial/rps`) consolida rigorosamente o alinhamento de tabela e destaque de colunas:

### Diretrizes Mandatórias:
1. **Preservação Rígida da Geometria da Tabela**: A estrutura relacional da tabela (número de colunas `REGIONAL`, `KPI`, `ANO A`, `MÊS A`, `DESAFIO`, `REAL`, projeções semanais, `% DISP`, `% DESAFIO`, `%AA`, `%MA`), bem como `colspan`, `rowspan`, alinhamentos entre `thead`, `tbody` e `tfoot` são estritamente imutáveis. O valor `R$ 6.750` permanece obrigatoriamente alinhado na coluna `DESAFIO` e `R$ 3.701` na coluna `REAL`.
2. **Moldura Dourada Dupla (DESAFIO e Semana Atual)**: As colunas **DESAFIO** e **Semana Corrente (`27/JUL`)** são delimitadas por duas linhas douradas idênticas de 2px de espessura (`borderLeft: 2px solid #f59e0b` e `borderRight: 2px solid #f59e0b` com especificidade CSS alta `.col-highlight-gold`), sem alterar larguras, grids ou posicionamento de colunas.
3. **Blocos Visuais Independentes por Gerente**: Cada gerente comercial é enquadrado em um contêiner visual próprio delimitado por moldura externa completa (`border-t-2 border-b-2 border-l-2 border-r-2 border-accent-gold/70`) e célula de identificação com fundo sobressalente (`bg-background-elevated/70`), separado do bloco vizinho por um espaçador vertical de 12px.
4. **Preservação Absoluta de Negócio**: Refinamentos estritamente de apresentação (UI/UX), com 0 alteração em regras, APIs, cálculos, SSOT ou governança.

Status Arquitetural: `RPS_EXECUTIVE_BLOCKS_AND_DOUBLE_GOLD_BORDERS = LOCKED` & `BASELINE = CONFIRMED`.

---

## 76. Baseline Oficial — Fundo Contínuo e Janela de Edição da Semana Atual (RPS)

A partir de 27/07/2026, a interface executiva da RPS (`/processo-comercial/rps`) institui oficialmente a padronização visual e temporal de edição:

### Diretrizes Mandatórias:
1. **Fundo Amarelo Suave Executivo (`bg-amber-500/8`)**: As colunas **DESAFIO** e **Semana Corrente (`ATUAL`)** utilizam uma tonalidade de fundo amarelo ultra-suave com opacidade ajustada para 8% (`bg-amber-500/8` / `rgba(245, 158, 11, 0.08)`) de forma 100% contínua e idêntica através de todas as camadas da tabela: cabeçalho (`th`), linhas dos gerentes, linhas de clientes expandidas e rodapé (`TOTAL BRASIL`). Essa opacidade destaca visualmente as colunas sem competir com a legibilidade dos números.
2. **Janela Temporal Oficial de Edição para Gerentes (15:00 de Segunda-feira)**:
   - **Administradores (`Admin`, `Admin Master`, `Gerente Nacional`)**: Permanece autorizada a edição de qualquer semana a qualquer momento sem restrição temporal.
   - **Gerentes Comerciais**: Autorizada a edição **exclusivamente da coluna da semana corrente** e estritamente **até as 15:00 da segunda-feira correspondente** (no fuso horário oficial do Brasil `America/Sao_Paulo`).
   - Às 15:00 da segunda-feira, todas as células daquela semana tornam-se automaticamente somente leitura no frontend (`disabled`) e o botão "Salvar Projeções" é desabilitado caso não existam outros campos editáveis.
3. **Fonte Única do Horário (Server Time)**: A validação temporal utiliza **exclusivamente o horário oficial do servidor (Server Time no backend)** transmitido no endpoint `GET /api/processo-comercial/rps`. É proibido utilizar o relógio local do navegador do cliente.
4. **Trava Temporal de Segurança HTTP 403 no Backend**: O handler `POST /api/processo-comercial/rps` valida no servidor a janela temporal (segunda-feira $< 15:00$) para perfil gerente e rejeita qualquer tentativa de persistência fora do horário com `HTTP 403 Forbidden`.

---

## 77. Baseline Oficial — Hierarquia Visual Executiva da RPS (Resumos vs. Detalhes)

A partir de 27/07/2026, a interface executiva da RPS (`/processo-comercial/rps`) institui a hierarquia visual de contraste por nível de agregação:

### Diretrizes Mandatórias:
1. **Destaque Visual Restrito aos Resumos (Amarelo Suave 8%)**:
   - O fundo amarelo suave (`bg-amber-500/8`) é aplicado **exclusivamente** nas colunas **DESAFIO** e **Semana Corrente (`ATUAL`)** das linhas de resumo:
     - Cabeçalho da tabela (`thead`);
     - Linhas dos Gerentes (`VOL`, `FAT`, `INVEST`);
     - Rodapé `TOTAL BRASIL` (`tfoot`).
2. **Fundo Neutro nas Linhas de Detalhamento das Redes (Clientes)**:
   - Todas as linhas de clientes/redes expandidas permanecem com **fundo neutro (branco/subtle)** nas células das colunas destacadas, garantindo que o nível analítico detalhado fique visualmente limpo.
3. **Continuidade Rígida das Molduras Douradas Verticais**:
   - As linhas verticais douradas de 2px (`border-l-2 border-r-2 border-amber-500/80`) permanecem idênticas, contínuas e alinhadas através de **todas as linhas da tabela** (cabeçalho, gerentes, clientes e TOTAL BRASIL), delimitando a coluna como um bloco estrutural simétrico.
4. **Badges Executivos de Cabeçalho**:
   - Cabeçalho **DESAFIO**: Inclui o badge discreto `META` em destaque dourado abaixo do título.
   - Cabeçalho da **Semana Corrente**: Mantém o badge discreto `ATUAL` em destaque dourado abaixo da data.

5. **Separação Visual Entre Resumo do Gerente e Clientes**:
   - A linha `INVEST` do resumo do gerente possui **borda inferior dourada permanente (`border-b-2 border-accent-gold/80`)**. Quando os clientes daquele gerente são expandidos, a separação é feita via spacer vertical (`tr h-3`), delimitando com clareza o término do Bloco Resumo do Gerente (`VOL`, `FAT`, `INVEST`) e o início do detalhamento por Redes.

Status Arquitetural: `RPS_EXECUTIVE_VISUAL_HIERARCHY = LOCKED` & `BASELINE = CONFIRMED`.

---

## 78. Baseline Oficial — Fórmulas dos Indicadores Analíticos da RPS

A partir de 27/07/2026, os quatro indicadores da coluna **ANÁLISE** da RPS passam a seguir rigorosamente a convenção matemática única de variação percentual:

$$\text{Indicador} = \left(\frac{\text{Valor Comparado}}{\text{Valor Base}} - 1\right) \times 100$$

### Fórmulas Oficiais Homologadas:
1. **`% DISP` (Dispersão do Mês Anterior)**:
   $$\%\text{DISP} = \left(\frac{\text{REAL\_FECHADO\_MES\_ANTERIOR}}{\text{ULTIMA\_PROJECAO\_MES\_ANTERIOR}} - 1\right) \times 100$$
   *Exemplo Homologado*: $(528.000 / 600.000 - 1) \times 100 = -12,0\%$.

2. **`% DESAFIO` (Atingimento do Desafio)**:
   $$\%\text{DESAFIO} = \left(\frac{\text{PROJECAO\_ATUAL}}{\text{DESAFIO}} - 1\right) \times 100$$
   *Exemplo Homologado*: $(620 / 665 - 1) \times 100 = -6,8\%$.

3. **`%AA` (Crescimento Ano a Ano)**:
   $$\%AA = \left(\frac{\text{PROJECAO\_ATUAL}}{\text{ANO\_A}} - 1\right) \times 100$$

4. **`%MA` (Crescimento Mês a Mês)**:
   $$\%MA = \left(\frac{\text{PROJECAO\_ATUAL}}{\text{MES\_A}} - 1\right) \times 100$$

Status Arquitetural: `RPS_ANALYSIS_FORMULAS = LOCKED` & `BASELINE = PERMANENTE`.

---

## 69. Baseline Oficial — Enterprise Security & Compliance Program (Sprint 2.3)

A partir de 28/07/2026, a arquitetura e a suíte de ferramentas do **Enterprise Security & Compliance Program** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Camada de Auditoria e Diagnóstico 100% Read-Only**: O `EnterpriseSecurityEngine` (`src/lib/governance/security`) é a única fonte oficial de auditoria técnica de segurança e compliance, operando exclusivamente em memória de forma não intervencionista.
2. **Proibição de Alterações Automáticas**: É expressamente proibida qualquer alteração em permissões, políticas RLS, rotas de API, variáveis de ambiente, dependências ou segredos por meio do motor de diagnóstico.
3. **Mapeamento Transparente e Ocultação de Segredos**: O audit de variáveis de ambiente exibe estritamente o status de validação (`CONFIGURED`, `MASKED`, `VALIDATED`, `MISSING`) sem jamais expor qualquer valor ou chave sensível.
4. **Matriz de Governança e Compliance Score**: Cálculo do Compliance Score Global (0–100) baseado na ponderação oficial homologada (25% Autenticação, 20% Autorização, 15% RLS, 15% APIs, 10% Ambiente, 10% Dependências, 5% Governança).
5. **APIs e Componentes Congelados**: `EnterpriseSecurityEngine`, `GET /api/health/security`, `GET /api/health/compliance`, `/health`, `SecurityOverview`, `ComplianceScoreCard`, `AccessMatrixPanel`, `ApiSecurityPanel`, `EnvironmentPanel`, `DependencyInventoryPanel`, `DependencyRiskPanel`, `ComplianceRecommendations` e `SecurityTimeline`.
6. **Auditoria Mandatória de Encerramento**: Aprovado com 0 desvios financeiros, 0 regressões, 0 breaking changes e aprovação total em `npm run health:analytics`, `npm run verify:parity`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `SECURITY_ENTERPRISE = LOCKED` & `COMPLIANCE_ENTERPRISE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 70. Baseline Oficial — Enterprise Data Quality & Governance Program (Sprint 2.4)

A partir de 28/07/2026, a arquitetura e a suíte de ferramentas do **Enterprise Data Quality & Governance Program** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Camada de Auditoria de Dados 100% Read-Only**: O `EnterpriseDataQualityEngine` e o `EnterpriseDataLineageEngine` (`src/lib/governance/data-quality`) constituem a única fonte oficial para medição da qualidade, consistência, integridade, tempestividade (freshness), cobertura e rastreabilidade (data lineage) de dados, operando exclusivamente em memória de forma não intervencionista.
2. **Princípio de Não Intervenção em Dados**: É expressamente proibida qualquer execução de `UPDATE`, `INSERT`, `DELETE`, `MERGE` ou alteração de tabelas, views, triggers e procedimentos por meio dos motores de qualidade de dados.
3. **Ponderação Oficial do Data Quality Score**: O Data Quality Score Global (0–100) é calculado pela soma ponderada oficial (25% Completude, 20% Consistência, 15% Integridade, 15% Atualização, 10% Unicidade, 10% Validação, 5% Governança), mantendo scores independentes para os 14 domínios de dados homologados.
4. **Respeito às Métricas Oficiais (`NOT_AVAILABLE`)**: Indicadores que não possuam fonte oficial de dados deverão obrigatoriamente retornar `STATUS = NOT_AVAILABLE`, sendo proibida a criação de métricas artificiais ou estimativas paralelas.
5. **APIs e Componentes Congelados**: `EnterpriseDataQualityEngine`, `EnterpriseDataLineageEngine`, `GET /api/health/data-quality`, `GET /api/health/data-lineage`, `/health`, `DataQualityOverview`, `DataQualityScoreCard`, `CompletenessPanel`, `ConsistencyPanel`, `IntegrityPanel`, `FreshnessPanel`, `CoveragePanel`, `DataLineagePanel` e `DataRecommendations`.
6. **Auditoria Mandatória de Encerramento**: Aprovado com 0 desvios financeiros, 0 regressões, 0 breaking changes, 0 persistência adicional e aprovação total em `npm run health:analytics`, `npm run verify:parity`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `DATA_QUALITY_ENTERPRISE = LOCKED` & `DATA_LINEAGE_ENTERPRISE = LOCKED` & `DATA_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 71. Baseline Oficial — Sprint 2.5 — Enterprise Test Automation & Quality Assurance

A partir de 28/07/2026, a **Sprint 2.5 — Enterprise Test Automation & Quality Assurance** passa a integrar oficialmente a arquitetura do Coffee++, constituindo a camada Enterprise responsável pela governança da qualidade técnica, inventário de testes, análise de regressões, validação de build e consolidação do Quality Score, desenvolvida sob arquitetura completamente isolada, sem qualquer alteração dos módulos homologados anteriormente.

### Objetivo
Consolidar a camada oficial de Quality Assurance da plataforma, fornecendo uma visão executiva da saúde dos testes automatizados, estabilidade da plataforma e qualidade do processo de entrega. Toda a implementação opera exclusivamente em modo Read-Only, sem alterar regras de negócio, estruturas de banco de dados ou comportamento operacional.

### Arquitetura Oficial
- `Test Suites` → `EnterpriseQualityEngine` → `GET /api/health/quality` & `GET /api/health/tests` → `Health Center (/health)`

### Componentes Oficiais
Passam a compor oficialmente a arquitetura:
- `EnterpriseQualityEngine`
- `GET /api/health/quality`
- `GET /api/health/tests`
- `QualityOverview`
- `QualityScoreCard`
- `EnterpriseTestInventoryPanel`
- `RegressionPanel`
- `BuildValidationPanel`
- `QualityRecommendations`

### Princípios Arquiteturais
Esta Sprint segue rigorosamente o Princípio de Não Intervenção. É expressamente proibida qualquer alteração em Engines homologadas, regras comerciais, financeiras, tabelas, views, procedimentos ou triggers, e execução de `UPDATE`, `INSERT`, `DELETE` ou `MERGE`. Toda a operação permanece exclusivamente observacional.

### Quality Score Oficial
O Quality Score representa a maturidade técnica da plataforma (25% Unitários, 20% Integração, 15% APIs, 15% Engines, 10% Cobertura, 10% Build, 5% Governança). Indicadores sem fonte oficial verificável serão apresentados como `NOT_AVAILABLE`.

### Build Validation
A validação oficial da plataforma permanece composta por: Auditoria de Governança, Paridade Financeira, Validação TypeScript, Build Next.js e Compatibilidade Arquitetural.

### Garantias de Compatibilidade
Preservados 0 alterações em módulos homologados, 0 alterações financeiras/comerciais/comportamentais, 0 Breaking Changes, 0 Regressões e 100% de compatibilidade com todas as Baselines Oficiais.

Status Arquitetural: `QUALITY_ASSURANCE_ENTERPRISE = LOCKED` & `TEST_AUTOMATION_ENTERPRISE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 72. Baseline Oficial — Enterprise Operational Telemetry & Usage Analytics Program (Sprint 2.6)

A partir de 28/07/2026, a arquitetura e a suíte de ferramentas do **Enterprise Operational Telemetry & Usage Analytics Program** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Camada de Telemetria 100% Read-Only e LGPD Compliant**: O `EnterpriseTelemetryEngine` (`src/lib/governance/telemetry`) constitui a única fonte oficial para medição agregada de utilização de módulos, adoção de funcionalidades, jornadas de usuários, sessões e análise de dispositivos, operando exclusivamente em modo diagnósticos sem expor qualquer PII ou conteúdo de digitação.
2. **Princípio de Não Intervenção no Usuário**: É expressamente proibida qualquer alteração no fluxo de navegação, experiência do usuário, permissões, rotas ou regras comerciais por meio da camada de telemetria.
3. **Ponderação Oficial do Adoption Score**: O Adoption Score Global (0–100) é calculated pela soma ponderada oficial (30% Utilização dos Módulos, 20% Utilização das Funcionalidades, 20% Frequência de Acesso, 15% Jornada Completa, 10% Retenção, 5% Governança).
4. **Respeito às Métricas Verificáveis (`NOT_AVAILABLE`)**: Indicadores que não possuam fonte oficial de dados verificável deverão obrigatoriamente retornar `STATUS = NOT_AVAILABLE`.
5. **APIs e Componentes Congelados**: `EnterpriseTelemetryEngine`, `GET /api/health/telemetry`, `GET /api/health/adoption`, `/health`, `TelemetryOverview`, `AdoptionScoreCard`, `ModuleUsagePanel`, `UserJourneyPanel`, `FeatureUsagePanel`, `SessionAnalyticsPanel`, `DeviceAnalyticsPanel` e `TelemetryRecommendations`.
6. **Auditoria Mandatória de Encerramento**: Aprovado com 0 desvios financeiros, 0 regressões, 0 breaking changes, 0 persistência adicional e aprovação total em `npm run health:analytics`, `npm run verify:parity`, `npx tsc --noEmit` e `npm run build`.

Status Arquitetural: `TELEMETRY_ENTERPRISE = LOCKED` & `USAGE_ANALYTICS_ENTERPRISE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 73. Baseline Oficial — Enterprise Developer Experience & CI/CD Governance Program (Sprint 2.7)

A partir de 28/07/2026, a arquitetura e a suíte de ferramentas do **Enterprise Developer Experience & CI/CD Governance Program** passam a integrar oficialmente a arquitetura do Coffee++, constituindo a camada Enterprise responsável pela governança da experiência de desenvolvimento, monitoramento dos pipelines de integração e entrega contínua, saúde dos builds, prontidão para releases e consolidação do DevEx Score, desenvolvida sob arquitetura completamente isolada, sem qualquer alteração dos módulos homologados anteriormente.

### Objetivo
Consolidar a camada oficial de Developer Experience & CI/CD Governance da plataforma, fornecendo uma visão executiva da maturidade do processo de desenvolvimento e entrega, operando exclusivamente em modo Read-Only e preservando integralmente todas as baselines homologadas anteriormente.

### Arquitetura Oficial
- `Pipelines Oficiais` → `EnterpriseCICDEngine` → `EnterpriseDevExEngine` → `GET /api/health/devex` & `GET /api/health/cicd` → `Health Center (/health)`

### Componentes Oficiais
Passam a compor oficialmente a arquitetura:
- `EnterpriseDevExEngine`
- `EnterpriseCICDEngine`
- `GET /api/health/devex`
- `GET /api/health/cicd`
- `DevExOverview`
- `DevExScoreCard`
- `PipelineInventoryPanel`
- `BuildHealthPanel`
- `ReleaseReadinessPanel`
- `DevExRecommendations`

### Princípios Arquiteturais
Esta Sprint segue rigorosamente o Princípio de Não Intervenção. É expressamente proibido modificar qualquer Engine homologada, regras comerciais, financeiras, comportamento operacional ou estruturas do banco de dados, e executar `UPDATE`, `INSERT`, `DELETE` ou `MERGE`. Toda a operação permanece exclusivamente observacional.

### DevEx Score Oficial
O DevEx Score representa a maturidade técnica do processo de desenvolvimento (30% Sucesso de Pipelines, 20% Tempo de Build/Deploy, 20% Estabilidade de Releases, 15% Cobertura de Workflows, 10% Release Readiness, 5% Governança). Indicadores sem fonte oficial verificável serão apresentados como `NOT_AVAILABLE`.

### Release Readiness
A prontidão de releases consolida exclusivamente verificações objetivas da plataforma: Auditoria de Governança, Paridade Financeira 0.0000%, Tipagem TypeScript sem erros, Compilação de Produção Next.js 16 e Segurança/RLS.

### Garantias de Compatibilidade
Preservados 0 alterações em módulos homologados, 0 alterações financeiras/comerciais/comportamentais, 0 Breaking Changes, 0 Regressões e 100% de compatibilidade com todas as Baselines Oficiais.

Status Arquitetural: `DEVELOPER_EXPERIENCE_ENTERPRISE = LOCKED` & `CICD_GOVERNANCE_ENTERPRISE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 74. Baseline Oficial — Enterprise Architecture & Documentation Governance Program (Sprint 2.8)

A partir de 28/07/2026, a arquitetura e a suíte de ferramentas do **Enterprise Architecture & Documentation Governance Program** passam a integrar oficialmente a arquitetura do Coffee++, constituindo a camada Enterprise responsável pela governança da arquitetura da plataforma, documentação viva, rastreabilidade técnica, inventário de ativos arquiteturais (14 Engines e 118 APIs HTTP) e análise das dependências entre módulos, APIs, Engines e componentes, desenvolvida sob arquitetura completamente isolada, sem qualquer alteração dos módulos homologados anteriormente.

### Objetivo
Consolidar a camada oficial de Governança Arquitetural da plataforma, fornecendo uma visão executiva da estrutura técnica do sistema, preservando integralmente todas as baselines homologadas anteriormente.

### Arquitetura Oficial
- `Inventário Oficial` → `EnterpriseDocumentationEngine` → `EnterpriseArchitectureEngine` → `GET /api/health/architecture` & `GET /api/health/documentation` → `Health Center (/health)`

### Componentes Oficiais
Passam a compor oficialmente a arquitetura:
- `EnterpriseArchitectureEngine`
- `EnterpriseDocumentationEngine`
- `GET /api/health/architecture`
- `GET /api/health/documentation`
- `ArchitectureOverview`
- `ArchitectureScoreCard`
- `EngineInventoryPanel`
- `ApiInventoryPanel`
- `DependencyGraphPanel`
- `ArchitectureRecommendations`

### Princípios Arquiteturais
Esta Sprint segue rigorosamente o Princípio de Não Intervenção. É expressamente proibido modificar qualquer Engine homologada, regras comerciais, financeiras, comportamento operacional ou estruturas do banco de dados, e executar `UPDATE`, `INSERT`, `DELETE` ou `MERGE`. Toda a operação permanece exclusivamente observacional.

### Architecture Score Oficial
O Architecture Score representa a maturidade arquitetural da plataforma (30% Padronização, 20% Documentação, 20% Dependências, 15% Rastreabilidade, 10% Desacoplamento, 5% Governança). Indicadores sem fonte oficial verificável serão apresentados como `NOT_AVAILABLE`.

### Dependency Graph
O grafo de dependências é obtido exclusivamente da arquitetura oficial da plataforma, validando o desacoplamento de camadas em 5 níveis (Data Sources → Materialized Views → Core Analytics → Specialized Engines → HTTP APIs → UI Modules).

### Garantias de Compatibilidade
Preservados 0 alterações em módulos homologados, 0 alterações financeiras/comerciais/comportamentais, 0 Breaking Changes, 0 Regressões e 100% de compatibilidade com todas as Baselines Oficiais.

Status Arquitetural: `ARCHITECTURE_ENTERPRISE = LOCKED` & `DOCUMENTATION_GOVERNANCE_ENTERPRISE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 75. Baseline Oficial — Enterprise Maturity Program

A partir de 28/07/2026, considera-se oficialmente concluído o Enterprise Maturity Program do Coffee++, estabelecendo a arquitetura corporativa definitiva de governança técnica da plataforma.

O programa consolida uma suíte integrada de capacidades Enterprise, operando exclusivamente em modo Read-Only, preservando integralmente as regras de negócio, financeiras, operacionais e analíticas da plataforma.

### Capacidades Oficiais

O Enterprise Maturity Program passa a ser composto pelas seguintes camadas oficiais:

- Enterprise Observability
- Enterprise Performance
- Enterprise Security
- Enterprise Compliance
- Enterprise Data Quality & Governance
- Enterprise Test Automation & Quality Assurance
- Enterprise Operational Telemetry & Usage Analytics
- Enterprise Developer Experience & CI/CD Governance
- Enterprise Architecture & Documentation Governance

### Princípios Permanentes

Toda a suíte Enterprise deverá respeitar permanentemente os seguintes princípios:

- Operação exclusivamente Read-Only;
- Princípio de Não Intervenção;
- Ausência de persistência de dados;
- Ausência de alterações em regras comerciais;
- Ausência de alterações em regras financeiras;
- Ausência de alterações operacionais;
- Ausência de alterações comportamentais;
- Compatibilidade integral com todas as Baselines Oficiais homologadas.

### Evolução da Plataforma

Com o encerramento do Enterprise Maturity Program, novas funcionalidades deverão ser implementadas como capacidades independentes da plataforma, preservando a estabilidade das baselines homologadas e mantendo a arquitetura Enterprise congelada.

O Enterprise Maturity Program passa a constituir a fundação oficial de governança técnica do Coffee++.

### Status Oficial

```
ENTERPRISE_MATURITY_PROGRAM = LOCKED

ENTERPRISE_GOVERNANCE = LOCKED

PLATFORM_BASELINE = CONFIRMED

BASELINE = CONFIRMED
```

---

# CICLO 3 — EVOLUÇÃO FUNCIONAL DA PLATAFORMA

A partir de 28/07/2026, inicia-se oficialmente o **Ciclo 3 — Evolução Funcional da Plataforma Coffee++**.

O Enterprise Maturity Program (Seções 67 a 75) permanece permanentemente homologado e congelado (`LOCKED`), constituindo a fundação oficial de engenharia, arquitetura e governança técnica da plataforma.

Todas as novas funcionalidades desenvolvidas a partir deste ciclo deverão utilizar essa fundação, preservando integralmente as Baselines Oficiais homologadas.

## Objetivos do Ciclo 3

O foco do Ciclo 3 passa a ser exclusivamente a evolução funcional do Coffee++, ampliando as capacidades de negócio da plataforma sem modificar sua fundação arquitetural.

As evoluções deverão priorizar:

- Inteligência Comercial;
- CRM Comercial Enterprise;
- Planejamento Comercial;
- Execução em Campo;
- Trade Marketing;
- Inteligência Artificial aplicada ao negócio;
- Automações e Integrações Corporativas;
- Dashboards Executivos;
- Novos módulos estratégicos da plataforma.

## Princípios Permanentes

Todas as funcionalidades desenvolvidas durante o Ciclo 3 deverão respeitar obrigatoriamente:

- Enterprise Maturity Program preservado;
- Arquitetura Enterprise inalterada;
- Compatibilidade retroativa integral;
- Zero regressões funcionais;
- Preservação das regras comerciais;
- Preservação das regras financeiras;
- Preservação das regras operacionais;
- Utilização exclusiva das Engines homologadas como fundação da plataforma.

## Organização das Baselines

As novas Baselines passam a seguir a seguinte convenção:

- Seção 76 — Sprint 3.1
- Seção 77 — Sprint 3.2
- Seção 78 — Sprint 3.3
- ...

As numerações do Ciclo 3 representam exclusivamente novas capacidades funcionais da plataforma, mantendo intactas as Baselines do Enterprise Maturity Program.

## Status Oficial

```
CYCLE_3 = ACTIVE

ENTERPRISE_FOUNDATION = LOCKED

PLATFORM_EVOLUTION = ACTIVE

BASELINE = CONFIRMED
```

---

## 76. Baseline Oficial — Sprint 3.1 — CRM Comercial Enterprise

A partir de 28/07/2026, a **Sprint 3.1** institui oficialmente o CRM Comercial Enterprise do Coffee++, estabelecendo a camada corporativa de gestão comercial da plataforma.

O CRM Comercial Enterprise consolida o relacionamento com Clientes, Distribuidores, Redes, PDVs, Contatos e Oportunidades Comerciais, preservando integralmente a Fundação Enterprise homologada (Seções 67 a 75).

### Objetivo
Disponibilizar uma plataforma unificada para gestão do relacionamento comercial, pipeline de oportunidades em 9 estágios corporativos (`Lead → Prospect → Qualificação → Negociação → Proposta → Implantação → Cliente Ativo → Expansão → Renovação`), histórico cronológico de interações, planos de ação e indicadores executivos.

### Arquitetura Oficial
- `AnalyticsEngine & Engines Homologadas` → `CrmEnterpriseEngine (CustomerService, OpportunityService, TimelineService, ActionPlanService, DashboardService)` → `GET /api/crm-enterprise` → `CRM Comercial Enterprise (/crm-enterprise)`

### Componentes Oficiais
Passam a compor oficialmente a arquitetura:
- `CrmEnterpriseEngine`
- `GET /api/crm-enterprise`
- `/crm-enterprise`
- `CrmFilterBar`
- `CrmEnterpriseKpis`
- `CrmPipelineKanban`
- `CrmCadastroUnificadoPanel`
- `CrmTimelinePanel`
- `CrmPlanoAcaoPanel`
- `CrmAnalyticsDashboard`

### Princípios Arquiteturais
- Preservação integral da Fundação Enterprise (Seções 67 a 75).
- Reutilização exclusiva das Engines homologadas sem alterá-las.
- Arquitetura desacoplada.
- Ausência de duplicação de lógica analítica ou financeira.
- Compatibilidade retroativa integral com 0.0000% de desvio financeiro.

Status Oficial: `CRM_ENTERPRISE = ACTIVE` & `CYCLE_3 = ACTIVE` & `BASELINE = CONFIRMED`.

---

## 77. Baseline Oficial — Sprint 3.2 — Execução Comercial & Agenda Inteligente

A partir de 28/07/2026, a **Sprint 3.2** institui oficialmente a camada de Execução Comercial & Agenda Inteligente do Coffee++, ampliando o CRM Comercial Enterprise com capacidades de planejamento, execução e acompanhamento da rotina comercial.

A Sprint 3.2 transforma oportunidades comerciais em atividades operacionais, preservando integralmente a Fundação Enterprise (Seções 67 a 75) e a Baseline do CRM Comercial Enterprise (Seção 76).

### Objetivo
Disponibilizar uma plataforma corporativa para planejamento e execução da atividade comercial, consolidando agenda, visitas, follow-ups, tarefas, recomendações operacionais e indicadores de execução.

### Arquitetura Oficial
- `AnalyticsEngine & Engines Homologadas` → `CommercialExecutionEngine (PlanningService, AgendaService, ExecutionService, FollowUpService, AnalyticsService)` → `GET /api/commercial-execution` → `Execução Comercial & Agenda Inteligente (/execucao-comercial)`

### Componentes Oficiais
Passam a compor oficialmente a arquitetura:
- `CommercialExecutionEngine`
- `GET /api/commercial-execution`
- `/execucao-comercial`
- `ExecutionFilterBar`
- `ExecutionKpis`
- `DailyAgendaPanel`
- `VisitPlanningPanel`
- `FollowUpPanel`
- `TaskManagementPanel`
- `ExecutionAnalyticsPanel`

### Princípios Arquiteturais
- Preservação integral da Fundação Enterprise (Seções 67 a 75).
- Preservação da Baseline do CRM Comercial Enterprise (Seção 76).
- Reutilização exclusiva das Engines homologadas.
- Arquitetura desacoplada.
- Ausência de duplicação de regras comerciais.
- Compatibilidade retroativa integral com 0.0000% de desvio financeiro.

Status Oficial: `COMMERCIAL_EXECUTION = ACTIVE` & `CRM_ENTERPRISE = ACTIVE` & `CYCLE_3 = ACTIVE` & `BASELINE = CONFIRMED`.

---

## 78. Baseline Oficial — Sprint 3.3 — Inteligência Comercial & Assistente de Decisão

A partir de 28/07/2026, a **Sprint 3.3** institui oficialmente a camada de Inteligência Comercial & Assistente de Decisão do Coffee++, ampliando o CRM Comercial Enterprise e a Execução Comercial com capacidades de análise, priorização e recomendação para suporte à tomada de decisão.

A Sprint 3.3 transforma dados operacionais em recomendações estratégicas, preservando integralmente a Fundação Enterprise (Seções 67 a 75), a Baseline do CRM Comercial Enterprise (Seção 76) e a Baseline da Execução Comercial & Agenda Inteligente (Seção 77).

### Objetivo
Disponibilizar uma camada corporativa de inteligência comercial capaz de priorizar oportunidades, identificar riscos, recomendar ações e apoiar a tomada de decisão utilizando exclusivamente dados provenientes das Engines homologadas.

### Arquitetura Oficial
- `AnalyticsEngine & Engines Homologadas` → `CommercialDecisionEngine (ScoringService, RiskAnalysisService, RecommendationService, PrioritizationService, ExplainabilityService)` → `GET /api/commercial-decision` → `Assistente de Decisão Comercial (/assistente-decisao)`

### Componentes Oficiais
Passam a compor oficialmente a arquitetura:
- `CommercialDecisionEngine`
- `GET /api/commercial-decision`
- `/assistente-decisao`
- `DecisionFilterBar`
- `DecisionKpis`
- `RecommendationsPanel`
- `OpportunityScoringPanel`
- `RiskDetectionPanel`
- `PriorityRankingPanel`
- `DecisionAnalyticsPanel`

### Princípios Arquiteturais
- Preservação integral da Fundação Enterprise (Seções 67 a 75).
- Preservação das Baselines homologadas (Seções 76 e 77).
- Reutilização exclusiva das Engines homologadas.
- Arquitetura desacoplada e caráter 100% consultivo.
- Ausência de duplicação de lógica analítica.
- Compatibilidade retroativa integral com 0.0000% de desvio financeiro.

Status Oficial: `COMMERCIAL_DECISION = ACTIVE` & `COMMERCIAL_EXECUTION = ACTIVE` & `CRM_ENTERPRISE = ACTIVE` & `CYCLE_3 = ACTIVE` & `BASELINE = CONFIRMED`.

---

## 79. Baseline Oficial — Sprint 3.4 — Simulação Estratégica Comercial

A partir de 28/07/2026, a Sprint 3.4 institui oficialmente a camada de Simulação Estratégica Comercial do Coffee++, ampliando o ecossistema funcional do Ciclo 3 com capacidades de construção, comparação e validação de cenários prospectivos para suporte ao planejamento comercial.

A Simulação Estratégica Comercial opera exclusivamente em modo prospectivo (read-only em memória), reutilizando a `SimulationEngine` homologada como mecanismo oficial de projeção, preservando integralmente a Fundação Enterprise (Seções 67 a 75), a Baseline do CRM Comercial Enterprise (Seção 76), a Baseline da Execução Comercial (Seção 77) e a Baseline da Inteligência Comercial (Seção 78).

### Objetivo

Disponibilizar uma camada corporativa para construção e comparação de cenários estratégicos, permitindo avaliar impactos financeiros e operacionais antes da tomada de decisão, sem modificar dados oficiais da plataforma.

### Arquitetura Oficial

```
AnalyticsEngine
CommercialIntelligenceEngine
ForecastEngine
SimulationEngine
CrmEnterpriseEngine
CommercialExecutionEngine
CommercialDecisionEngine
        │
        ▼
CommercialScenarioEngine
        │
        ├── ScenarioBuilderService
        ├── ComparisonService
        ├── RecommendationValidationService
        │
        ▼
SimulationEngine
        │
        ▼
GET /api/commercial-scenarios
        │
        ▼
Simulação Estratégica Comercial
```

### Capacidades Oficiais

A Sprint 3.4 disponibiliza oficialmente:

- Construção de cenários comerciais prospectivos;
- Modelagem de premissas comerciais;
- Comparação lado a lado entre cenários;
- Análise de impacto financeiro e operacional;
- Validação prospectiva das recomendações do Assistente de Decisão;
- Dashboard de indicadores prospectivos.

### Princípios Arquiteturais

Toda a implementação deverá respeitar obrigatoriamente:

- Preservação integral da Fundação Enterprise;
- Preservação das Baselines homologadas;
- Arquitetura desacoplada;
- Reutilização obrigatória da `SimulationEngine` como mecanismo oficial de simulação;
- Ausência de duplicação de lógica de projeção;
- Compatibilidade retroativa integral.

As simulações possuem caráter exclusivamente prospectivo e consultivo, não alterando automaticamente dados operacionais, previsões oficiais, regras comerciais ou decisões dos usuários.

### Status Oficial

```
COMMERCIAL_SIMULATION = ACTIVE

COMMERCIAL_DECISION = ACTIVE

COMMERCIAL_EXECUTION = ACTIVE

CRM_ENTERPRISE = ACTIVE

CYCLE_3 = ACTIVE

BASELINE = CONFIRMED
```

---

## 80. Baseline Oficial — Sprint 3.5 — Planejamento Comercial Integrado (S&OP Comercial)

A partir de 28/07/2026, a **Sprint 3.5** institui oficialmente a camada de Planejamento Comercial Integrado (S&OP Comercial) do Coffee++, consolidando informações provenientes do CRM Comercial Enterprise, da Execução Comercial, da Inteligência Comercial e da Simulação Estratégica para suportar o ciclo corporativo de planejamento comercial.

O módulo atua como orquestrador do processo de planejamento, preservando integralmente a Fundação Enterprise (Seções 67 a 75) e todas as Baselines homologadas do Ciclo 3 (Seções 76 a 79).

### Objetivo
Disponibilizar uma camada corporativa para elaboração, consolidação, distribuição, acompanhamento e governança dos planos comerciais oficiais utilizando exclusivamente informações provenientes das Engines homologadas.

### Arquitetura Oficial
- `AnalyticsEngine & Engines Homologadas` → `CommercialPlanningEngine (PlanningCycleService, PlanningWorkflowService, CommercialPlanService, GoalDistributionService, ActionPlanService, PlanningAnalyticsService)` → `GET /api/commercial-planning` → `Planejamento Comercial Integrado (/planejamento-comercial)`

### Componentes Oficiais
Passam a compor oficialmente a arquitetura:
- `CommercialPlanningEngine`
- `GET /api/commercial-planning`
- `/planejamento-comercial`
- `PlanningFilterBar`
- `PlanningKpis`
- `PlanningCyclePanel`
- `CommercialPlanPanel`
- `GoalDistributionPanel`
- `ActionPlanOrchestratorPanel`
- `PlanningAnalyticsPanel`

### Princípios Arquiteturais
- Preservação integral da Fundação Enterprise (Seções 67 a 75).
- Preservação das Baselines homologadas (Seções 76, 77, 78 e 79).
- Reutilização exclusiva das Engines homologadas.
- Arquitetura desacoplada e caráter consultivo até aprovação formal.
- Ausência de duplicação de lógica de planejamento.
- Compatibilidade retroativa integral com 0.0000% de desvio financeiro.

Status Oficial: `COMMERCIAL_PLANNING = ACTIVE` & `COMMERCIAL_SIMULATION = ACTIVE` & `COMMERCIAL_DECISION = ACTIVE` & `COMMERCIAL_EXECUTION = ACTIVE` & `CRM_ENTERPRISE = ACTIVE` & `CYCLE_3 = ACTIVE` & `BASELINE = CONFIRMED`.

---

## 81. Baseline Oficial — Encerramento da Fase I do Ciclo 3

A partir de 28/07/2026, considera-se concluída a Fase I do Ciclo 3 — Evolução Funcional da Plataforma Coffee++.

A Fase I consolida uma arquitetura comercial corporativa composta pelos módulos de CRM Comercial Enterprise, Execução Comercial, Inteligência Comercial, Simulação Estratégica e Planejamento Comercial Integrado, preservando integralmente a Fundação Enterprise homologada.

### Escopo Consolidado

- CRM Comercial Enterprise;
- Execução Comercial & Agenda Inteligente;
- Inteligência Comercial & Assistente de Decisão;
- Simulação Estratégica Comercial;
- Planejamento Comercial Integrado (S&OP Comercial).

### Princípios Permanentes

- Preservação da Fundação Enterprise;
- Reutilização exclusiva das Engines homologadas;
- Arquitetura desacoplada;
- Ausência de duplicação de lógica;
- Compatibilidade retroativa integral;
- Aprovação humana para qualquer alteração operacional.

### Status Oficial

```
CYCLE_3_PHASE_1 = LOCKED

COMMERCIAL_PLATFORM = CONSOLIDATED

BASELINE = CONFIRMED
```

---

## 82. Baseline Oficial — Abertura da Fase II do Ciclo 3

A partir de 28/07/2026, inicia-se oficialmente a Fase II do Ciclo 3 da Plataforma Coffee++, destinada à evolução das capacidades de automação, colaboração e inteligência operacional da plataforma comercial.

A Fase II preserva integralmente a Fundação Enterprise (Seções 67 a 75) e a Plataforma Comercial Corporativa consolidada na Fase I (Seções 76 a 81).

### Objetivo

Expandir a plataforma com capacidades de automação de processos, assistência inteligente aos usuários, colaboração corporativa e visão executiva integrada, reutilizando exclusivamente os módulos homologados da Fase I.

### Escopo Inicial

A Fase II poderá contemplar, entre outros:

- Automação Comercial;
- Assistente Comercial baseado em IA;
- Workflows colaborativos;
- Aprovação eletrônica de planos;
- Notificações inteligentes;
- Executive Command Center.

### Princípios Permanentes

- Preservação integral da Fundação Enterprise;
- Preservação integral da Plataforma Comercial Corporativa;
- Arquitetura desacoplada;
- Reutilização exclusiva das Engines homologadas;
- Compatibilidade retroativa integral;
- Aprovação humana para alterações operacionais.

### Status Oficial

```
CYCLE_3_PHASE_2 = ACTIVE

COMMERCIAL_PLATFORM = LOCKED

ENTERPRISE_FOUNDATION = LOCKED

BASELINE = CONFIRMED
```

---

## 83. Baseline Oficial — Operação Assistida do Hub de Importação (Ciclo 3)

A partir de 28/07/2026, a pipeline do Hub de Importação de Faturamento é considerada operacionalmente estável e entra em regime de Operação Assistida.

### Critérios para alteração da baseline

Nenhuma alteração de código, SQL, arquitetura ou performance deverá ser realizada com base apenas em sugestões, hipóteses ou oportunidades de otimização.

Uma nova intervenção somente poderá ser iniciada quando houver evidência objetiva de um incidente em produção, incluindo pelo menos um dos seguintes eventos:

- Statement timeout;
- Erro SQL recorrente;
- Falha da auditoria de integridade;
- Divergência financeira entre Coffee++ e My Metrics;
- Regressão comprovada de desempenho;
- Incidente operacional reproduzível.

### Fluxo obrigatório

Toda solicitação deverá seguir obrigatoriamente a sequência:

Incidente → Diagnóstico → Causa Raiz → Plano de Correção → Aprovação → Implementação → Homologação → Nova Baseline.

Não são permitidas alterações diretas na pipeline sem esse fluxo.

### Indicadores da Operação Assistida

Monitorar continuamente:

- Tempo médio de importação
- Tempo médio por chunk
- Número de imports executados
- Taxa de sucesso (%)
- Rollbacks
- Timeouts
- Divergências financeiras
- Incidentes por mês

### Critério de saída da Operação Assistida

Após 30 importações consecutivas (ou 90 dias, o que ocorrer primeiro) sem:
- timeout;
- rollback inesperado;
- falha de integridade;
- divergência financeira;

a pipeline poderá ser reclassificada como: `IMPORT_HUB_STATUS = STABLE`.

### Status da Baseline

```
IMPORT_HUB_BASELINE = LOCKED

ASSISTED_OPERATION = ACTIVE

BASELINE = CONFIRMED
```

Qualquer futura alteração deverá gerar uma nova seção de baseline no `AGENTS.md`, preservando o histórico e a rastreabilidade das versões.

---

## 84. Encerramento Oficial — Ciclo 3 (Hub de Importação)

A partir desta baseline, o Ciclo 3 do Hub de Importação é considerado concluído.

### Status Oficial
- `IMPORT_HUB_BASELINE = LOCKED`
- `ASSISTED_OPERATION = ACTIVE`
- `ANALYTICS_ENGINE_V1 = LOCKED`
- `BASELINE = CONFIRMED`

As próximas evoluções do projeto deverão priorizar funcionalidades de negócio e geração de valor ao usuário final.

Alterações na pipeline de importação somente poderão ocorrer conforme os critérios estabelecidos na Seção 83.

---

## 83. Baseline Oficial — Enterprise Workflow Engine

A partir de 28/07/2026, a **Sprint 4.1** institui oficialmente o **Enterprise Workflow Engine** como a infraestrutura corporativa compartilhada de workflows da plataforma Coffee++.

### Diretrizes e Princípios Mandatórios

1. **Princípio da Neutralidade do Workflow**: O `EnterpriseWorkflowEngine` (`src/lib/workflow-enterprise/`) é um componente neutro da infraestrutura corporativa no grupo "Governança & Health". Ele não pertence exclusivamente à Plataforma Comercial nem a nenhum módulo de negócio específico.
2. **Separação entre Definição e Execução**:
   - `WorkflowDefinition` (`/api/workflow-definitions/*`): Modelos reusáveis e versionados de máquinas de estado (`workflowKey`, `entityType`, `version`, `stateMachine`, `approvalPolicies`, `metadata`, `active`).
   - `WorkflowInstance` (`/api/workflows/*`): Execuções ativas vinculadas à versão do modelo (`workflowId`, `definitionId`, `entityId`, `currentState`, `approvals`, `auditTrail`).
3. **Repository Pattern Obrigatório**: Toda leitura e gravação de `WorkflowDefinition` ocorre estritamente via `WorkflowDefinitionRepository`, isolando a camada HTTP (`/api/workflow-definitions/*`) de acessos diretos ao banco de dados.
4. **Versionamento dos Eventos Públicos de Domínio (v1)**: O `NotificationService` emite contratos de eventos fortemente tipados e versionados (`WorkflowDomainEventV1` com o campo `eventVersion: 'v1'`). Alterações estruturais no contrato exigirão nova versão (ex: `v2`), garantindo estabilidade para futuros consumidores (IA, Webhooks, Notificações).
5. **Consistência Transacional & Lock Service**: Alterações concorrentes em instâncias de workflow são protegidas por trava mutex em memória e validação otimista de versão (`WorkflowLockService.validateOptimisticLock`), prevenindo dupla aprovação e condições de corrida (*race conditions*).
6. **Múltiplos Modos de Aprovação**: Suporte a políticas de aprovação `SINGLE`, `SEQUENTIAL`, `PARALLEL` e `QUORUM` via `ApprovalService`, com suporte a ações de aprovar, rejeitar e devolver (*return for edit*).
7. **Trilha Imutável de Auditoria**: Registro permanente de todas as transições e decisões via `WorkflowAuditService`.

### Fluxo Arquitetural Único
`Camada HTTP REST (/api/workflow-definitions e /api/workflows)` → `EnterpriseWorkflowEngine` → `WorkflowLockService` → `WorkflowExecutionService` → `WorkflowDefinitionRepository` & `ApprovalService` & `WorkflowAuditService` & `NotificationService` (`WorkflowDomainEventV1`).

### Status Oficial

```
ENTERPRISE_WORKFLOW = ACTIVE

CYCLE_3_PHASE_2 = ACTIVE

ENTERPRISE_FOUNDATION = LOCKED

COMMERCIAL_PLATFORM = LOCKED

BASELINE = CONFIRMED
```

---

## 84. Baseline Oficial — Sprint 4.2 — Piloto de Integração Workflow + CRM Enterprise

A partir de 28/07/2026, a **Sprint 4.2** homologa oficialmente o **Piloto de Integração** entre o CRM Comercial Enterprise e o Enterprise Workflow Engine.

### Diretrizes e Princípios Mandatórios

1. **Princípio de Leitura sem Efeitos Colaterais (GET Idempotente)**: A rota `GET /api/crm-enterprise` e a ponte `CrmWorkflowBridge` operam estritamente em modo de leitura idempotente. A simples consulta à lista de oportunidades **NUNCA** instanciará automaticamente registros de workflow. Caso não exista workflow ativo para uma oportunidade, o sistema retorna `workflowStatus = "NOT_CREATED"`, `workflowId = null` e `canCreateWorkflow = true`.
2. **Criação Explícita de Workflow**: A criação de um `WorkflowInstance` para uma oportunidade ocorre **exclusivamente por ação explícita do usuário** (ex: acionamento do botão *"Iniciar Workflow"* no Kanban/Painel do CRM) ou evento de negócio homologado, consumindo `EnterpriseWorkflowEngine.createInstance()`.
3. **Utilização da Query API Especializada**: A integração consome a Query API especializada de lote `EnterpriseWorkflowEngine.findByEntities("CRM_OPPORTUNITY", oppIds)`, eliminando iterações completas e garantindo performance sub-milissegundo sem duplicar lógica de filtro nos módulos clientes.
4. **Sem Duplicação de Regras**: As regras de transição de estado, quórum e políticas de aprovação permanecem 100% centralizadas no `EnterpriseWorkflowEngine`. O CRM consome apenas as anotações públicas de estado e exibe links profundos para `/workflow-enterprise`.
5. **Preservação de Baselines Homologadas**: Mantida a paridade financeira de 0,0000%, 0 alterações em Engines existentes e 100% de compatibilidade retroativa.

### Fluxo Arquitetural Único
`CRM UI / API GET` → `CrmWorkflowBridge` → `EnterpriseWorkflowEngine.findByEntities()` (Leitura Idempotente)  
`Ação Explícita de Usuário ("Iniciar Workflow")` → `CrmWorkflowBridge.createWorkflowForOpportunity()` → `EnterpriseWorkflowEngine.createInstance()`

### Status Oficial

```
WORKFLOW_CRM_PILOT = ACTIVE

ENTERPRISE_WORKFLOW = LOCKED

COMMERCIAL_PLATFORM = LOCKED

BASELINE = CONFIRMED
```

---

## 85. Baseline Oficial — Integration Pattern for Enterprise Workflow Engine

### Objetivo

Padronizar definitivamente a forma como qualquer módulo da plataforma Coffee++ integra-se ao Enterprise Workflow Engine.

---

### Diretrizes Obrigatórias

#### 1. Consumo Exclusivo da API Pública
Todo módulo deverá consumir exclusivamente a fachada pública do `EnterpriseWorkflowEngine`. É proibido acessar diretamente `Repository`, `Storage`, tabelas internas ou serviços internos do Workflow Engine.

#### 2. Bridge de Integração
Cada módulo deverá possuir sua própria camada Bridge (ex: `CrmWorkflowBridge`, `SopWorkflowBridge`, `TradeWorkflowBridge`, `MasterDataWorkflowBridge`). A Bridge é responsável apenas por adaptar os dados do domínio ao Workflow Engine. Nenhuma regra de workflow poderá ser implementada dentro da Bridge.

#### 3. GET Idempotente
Operações GET nunca poderão criar `WorkflowInstance`s. Leituras apenas enriquecem informações utilizando `findByEntity()` e `findByEntities()`.

#### 4. Criação Explícita
`WorkflowInstance`s somente poderão ser criadas através de ações explícitas do usuário ou de automações previamente definidas. É proibida criação automática durante consultas.

#### 5. Query API
Integrações deverão utilizar consultas especializadas (`findByEntity()`, `findByEntities()`), evitando listagens completas para posterior filtragem.

#### 6. Neutralidade
O Enterprise Workflow Engine permanece neutro. Nenhuma regra específica de CRM, S&OP, Trade, RH, Promotor ou qualquer outro domínio poderá ser incorporada ao Engine.

#### 7. Eventos
Todos os módulos deverão consumir apenas eventos públicos versionados (`WorkflowDomainEventV1` permanece como contrato oficial).

#### 8. Auditoria
Toda alteração de estado deverá continuar registrada exclusivamente pelo `WorkflowAuditService`.

#### 9. Concorrência
Toda transição continuará protegida pelo `WorkflowLockService`. Nenhum módulo poderá implementar mecanismos próprios de lock.

#### 11. Governança Operacional & Reference Playbook
Todo novo módulo que utilizar o Enterprise Workflow Engine deverá seguir obrigatoriamente as diretrizes e checklists do **Enterprise Workflow Rollout Playbook** (`workflow_enterprise_rollout_playbook.md`). Os checklists de integração e homologação passam a integrar formalmente o processo de desenvolvimento e aprovação da Plataforma Comercial Enterprise.

---

### Gates de Governança Obrigatorios

#### Gate 1 — Gate de Arquitetura (Pré-Desenvolvimento)
Antes do início do desenvolvimento de qualquer nova integração com o Enterprise Workflow Engine, a engenharia deve validar formalmente:
1. **Critérios de Elegibilidade**: Confirmação de que o módulo atende aos requisitos (aprovações multi-nível, quórum, SLA, auditoria imutável ou fluxo colaborativo).
2. **Checklist de Integralização**: Planejamento de Bridge dedicada, leitura idempotente GET, acionamento explícito e consumo exclusivo da API pública (`findByEntity`/`findByEntities`).
3. **Bloqueio de Início**: Caso qualquer critério não seja satisfeito, a integração **NÃO PODERÁ** ser iniciada.

#### Gate 2 — Gate de Pull Request (Homologação Final)
Nenhum Pull Request envolvendo integração com o Enterprise Workflow Engine poderá ser aprovado ou sofrer merge sem a apresentação das seguintes evidências empíricas de validação:
- `npx tsc --noEmit` executado com **0 erros** de tipagem;
- `npm run health:analytics` executado com status **100% APROVADO** e desvio financeiro exato de **0,0000%**;
- Compilação oficial Next.js (`npm run build`) concluída com **sucesso**;
- Conformidade total verificada em relação às Baselines homologadas (Seções 67 a 85);
- Respeito integral ao **Enterprise Workflow Rollout Playbook**.

---

### Termo de Encerramento Oficial — Programa Enterprise Workflow

A partir de 28/07/2026, o ciclo de arquitetura e governança do **Enterprise Workflow Engine** (Sprints 4.1, 4.2 e Baselines 83, 84 e 85) encontra-se **oficialmente encerrado, homologado e congelado**.

#### Consolidação Arquitetural
- **Seção 83**: Enterprise Workflow Engine (Infraestrutura Corporativa) `[LOCKED & CONFIRMED]`
- **Seção 84**: Piloto de Integração CRM + Workflow Engine `[APPROVED & CONFIRMED]`
- **Seção 85**: Integration Pattern, Rollout Playbook & Gates de Governança `[INSTITUTIONALIZED & LOCKED]`

#### Diretrizes da Fase de Adoção Contínua (`PLATFORM_ADOPTION`)
1. **Congelamento Arquitetural**: Fica proibida a criação de novos motores paralelos ou alteração da arquitetura base do `EnterpriseWorkflowEngine` sem justificativa prévia de produção.
2. **Prioridade na Adoção**: Foco total na integração dos novos módulos da plataforma utilizando estritamente a fachada pública, a camada Bridge e os Gates de Governança.
3. **Melhorias Orientadas a Evidências**: Evoluções futuras no engine ocorrerão apenas se motivadas por necessidades reais comprovadas durante a operação.

---

### Status Geral Consolidador

```
ENTERPRISE_WORKFLOW = PRODUCTION_READY

WORKFLOW_ARCHITECTURE = FROZEN

WORKFLOW_GOVERNANCE = INSTITUTIONALIZED

NEXT_PHASE = PLATFORM_ADOPTION

BASELINE = CONFIRMED
```

---

## Baseline Oficial — Especificação Funcional do Módulo de Investimentos (Baseline Permanente)

A partir de 28/07/2026, o documento `docs/processos/modulo_investimentos_especificacao_funcional.md` torna-se a Especificação Funcional Oficial e permanente do Módulo de Investimentos do Coffee++.

### Diretrizes Mandatórias:
1. **Fonte Única de Verdade Funcional**: Em caso de divergência entre documentos operacionais, manuais legados ou páginas de ajuda, a `Especificação Funcional do Módulo de Investimentos` é a única fonte oficial para fluxo operacional, regras de negócio, responsabilidades, máquina de estados, permissões, integrações, notificações e critérios de encerramento.
2. **Manutenção Obrigatória**: Toda e qualquer nova evolução funcional do módulo deverá obrigatoriamente atualizar a especificação funcional.
3. **Governança Dual**: Novas regras de negócio devem ser registradas primeiro na especificação funcional e, quando representarem diretrizes permanentes de governança do sistema, também em `AGENTS.md`.
4. **Escopo dos Walkthroughs**: Walkthroughs continuam sendo utilizados exclusivamente para registrar implementações pontuais, migrações de banco e evidências técnicas de validação.

Status Arquitetural: `MODULO_INVESTIMENTOS_SPEC = LOCKED` & `BASELINE = CONFIRMED`.

---

## Baseline Oficial — Arquitetura de Documentação e Treinamento em 3 Níveis (Módulo de Investimentos)

A partir de 28/07/2026, a documentação do Módulo de Investimentos passa a ser oficialmente organizada em **três níveis complementares**:

### 1. Governança Arquitetural (`AGENTS.md`)
Contém exclusivamente regras permanentes de arquitetura, governança, padrões técnicos e decisões institucionais do projeto.

### 2. Especificação Funcional Oficial (`docs/processos/modulo_investimentos_especificacao_funcional.md`)
Documento canônico do módulo, contendo regras de negócio, fluxo operacional, máquina de estados, integrações, permissões, notificações e critérios funcionais. Toda evolução funcional deverá manter esta especificação atualizada.

### 3. Manual Operacional do Usuário (`docs/manuais/manual_operacional_gerente_regional_investimentos.md`)
Documento destinado aos Gerentes Regionais e usuários de negócio. Contém linguagem não técnica, procedimentos operacionais, exemplos práticos, boas práticas, perguntas frequentes, checklists e material de treinamento (sem detalhes de implementação, arquitetura, banco de dados ou código).

### Diretrizes Mandatórias de Manutenção:
Sempre que houver alteração no Módulo de Investimentos:
1. **Especificação Funcional:** Atualizar quando houver mudança de comportamento ou regra do sistema;
2. **Manual Operacional:** Atualizar quando houver impacto na forma de utilização pelos usuários de negócio;
3. **AGENTS.md:** Manter exclusivamente para regras permanentes de governança e arquitetura.

Status Arquitetural: `DOCUMENTACAO_3NIVEIS = HOMOLOGADA & LOCKED`.

---

## Baseline Oficial — Padrão Institucional de Documentação dos Módulos (Baseline Permanente)

A partir de 28/07/2026, **todo e qualquer módulo estratégico do ecossistema Coffee++** deverá adotar obrigatoriamente a estrutura de documentação em **três níveis complementares**:

### 1. Governança Arquitetural (`AGENTS.md`)
Regras permanentes de arquitetura, governança, restrições operacionais, diretrizes de segurança, paridade financeira e decisões institucionais da plataforma.

### 2. Especificação Funcional Oficial (`docs/processos/[modulo]_especificacao_funcional.md`)
Documento canônico do módulo, contendo regras de negócio, fluxos transacionais, máquina de estados, integrações, permissões, notificações e critérios funcionais.

### 3. Manual Operacional do Usuário (`docs/manuais/manual_operacional_[perfil]_[modulo].md`)
Documento destinado aos usuários finais de negócio (ex: Gerentes Regionais, Trade, Promotores, Supervisores). Deve utilizar linguagem 100% não técnica, procedimentos operacionais, exemplos práticos, boas práticas, perguntas frequentes, checklists e material de treinamento (sem detalhes de implementação, banco de dados, APIs ou código).

### Diretrizes Mandatórias de Manutenção:
Sempre que houver qualquer alteração funcional no sistema:
1. **Atualizar a Especificação Funcional** quando houver mudança no comportamento ou regra do sistema;
2. **Atualizar o Manual Operacional** quando houver impacto na operação dos usuários finais;
3. **Registrar no AGENTS.md** exclusivamente decisões permanentes de arquitetura e governança.

Status Arquitetural: `PADRAO_DOCUMENTACAO_INSTITUCIONAL = LOCKED` & `BASELINE = CONFIRMED`.

---

## Baseline Oficial — Infraestrutura Institucional de Exportação de PDF (Baseline Permanente)

A partir de 28/07/2026, a plataforma Coffee++ conta com uma **infraestrutura institucional compartilhada de exportação de documentos Markdown para PDF**.

### Diretrizes Mandatórias:
1. **Infraestrutura Reutilizável Única**: Toda e qualquer documentação institucional da plataforma (Especificações Funcionais, Manuais Operacionais e Guias de Treinamento) deverá utilizar a infraestrutura compartilhada (`src/lib/docs/markdownPdfExporter.ts` e `ExportPdfButton`), sendo proibida a criação de soluções específicas ou duplicadas por módulo.
2. **Preservação de Formatação e Mídia**: Os PDFs gerados devem obrigatoriamente converter e preservar:
   - Estrutura hierárquica dos títulos (H1-H4) e numeração;
   - Tabelas, listas e checklists (`☐`/`☑`);
   - Blocos de alerta/callout (`NOTE`, `TIP`, `WARNING`, `IMPORTANT`, `CAUTION`);
   - Diagramas Mermaid renderizados nativamente como imagens (proibida a exibição de código bruto);
   - Capa institucional, identidade visual Coffee++, metadados, cabeçalhos, rodapés e paginação dinâmica ("Página X de Y").
3. **Escopo de Aplicação**: Aplicável a todas as Especificações Funcionais, Manuais Operacionais de Usuários e documentos formais definidos pela governança do sistema.

Status Arquitetural: `INFRAESTRUTURA_PDF_INSTITUCIONAL = HOMOLOGADA & LOCKED`.

---

## Baseline Oficial — Ciclo de Vida da Documentação e Critérios de Homologação (Baseline Permanente)

A partir de 28/07/2026, toda documentação institucional da plataforma Coffee++ deverá permanecer continuamente sincronizada com a evolução funcional dos módulos.

### Diretrizes Mandatórias:
1. **Documentação Integrante da Homologação:** Nenhuma funcionalidade homologada poderá permanecer sem a documentação correspondente. A documentação é parte integrante do desenvolvimento, não uma atividade posterior.
2. **Atualização por Impacto:** Qualquer alteração funcional no sistema exige atualização imediata:
   - Da **Especificação Funcional**, quando houver mudança de comportamento, regra ou transição do sistema;
   - Do **Manual Operacional**, quando houver impacto na jornada de uso dos usuários finais de negócio;
   - Da **documentação de treinamento e exportação em PDF**, para refletir o comportamento atualizado;
   - Do **`AGENTS.md`**, apenas quando a alteração representar nova diretriz permanente de arquitetura, governança ou padrão institucional.

### Critério Obrigatório de Homologação Documental:
Um módulo é considerado **documentalmente homologado** apenas quando possuir cumulativamente:
1. Governança arquitetural registrada em `AGENTS.md`;
2. Especificação Funcional Oficial (`docs/processos/[modulo]_especificacao_funcional.md`);
3. Manual Operacional do Usuário (`docs/manuais/manual_operacional_[perfil]_[modulo].md`);
4. Exportação oficial em PDF institucional configurada;
5. Validação técnica de código (`npx tsc --noEmit` / `npm run build`) com 0 erros.

Status Arquitetural: `CICLO_VIDA_DOCUMENTAL = HOMOLOGADO & LOCKED`.

---

## Baseline Oficial — Resiliência Arquitetural do Módulo RDM (Baseline Permanente)

A partir de 29/07/2026, o módulo **RDM (Reunião de Desempenho Mensal)** passa a seguir a diretriz obrigatória de **Blindagem Permanente e Resiliência contra Erros de Runtime**.

### Diretrizes Mandatórias:
1. **Ausência de Runtime Error por Dados Faltantes**: Sempre que um KPI, indicador ou bloco de dados não estiver disponível ou for omitido pela API (incluindo estados iniciais de carregamento ou transição de payload), o sistema é proibido de gerar exceções de runtime (`TypeError`/`Undefined`).
2. **Uso de Fallbacks Estruturados**: O sistema deve obrigatoriamente utilizar objetos padrão contendo valores válidos default (ex: 0, `"-"`, `"Sem dados"` ou equivalente), garantindo que todos os slides da RDM (atuais e futuros) continuem sendo renderizados normalmente.
3. **Validação Obrigatória em Componentes de Apresentação**:
   - É proibido acessar propriedades encadeadas sem validação prévia.
   - É obrigatório o uso de *optional chaining* (`?.`) e *nullish coalescing* (`??`) em todos os pontos de desestruturação e leitura de propriedades de dados.
   - Os componentes de apresentação devem sempre receber e operar sobre objetos garantidamente completos.
4. **Escopo Geral no RDM**: Esta regra aplica-se a todos os slides, tabelas, subcomponentes e gráficos do módulo RDM.

Status Arquitetural: `RDM_RESILIENCE_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## Baseline Oficial — Validação em Duas Camadas / Defense in Depth (Baseline Permanente)

A partir de 29/07/2026, toda regra crítica de negócio da Plataforma Coffee++ deverá ser obrigatoriamente validada em duas camadas independentes.

### Diretrizes Mandatórias:
1. **Frontend (UX)**: Realizar validações preventivas, impedindo que o usuário conclua operações inválidas e apresentando mensagens claras de orientação.
2. **Backend**: Revalidar integralmente todas as regras críticas antes da persistência, independentemente da origem da requisição (Frontend, API, RPC, integrações, automações ou processos internos).
3. **Proibição de Validação Única**: Nenhuma regra crítica de negócio poderá depender exclusivamente da validação realizada no Frontend.
4. **Escopo de Aplicação**: Aplicável a toda a plataforma, cobrindo invariantes de negócio como:
   - Intervalos de datas (Data Final ≥ Data Inicial);
   - Obrigatoriedade de campos;
   - Transições de workflow;
   - Regras de aprovação;
   - Consistência entre entidades relacionadas;
   - Limites de valores;
   - Demais invariantes de negócio.

Status Arquitetural: `DEFENSE_IN_DEPTH_VALIDATION = LOCKED` & `BASELINE = CONFIRMED`.

---

## 66. Baseline Oficial — Estabilização do Hub de Importação e Desacoplamento de Jobs Analíticos (Baseline Permanente)

A partir de 30/07/2026, o Hub de Importação de Dados e o mecanismo de recálculo assíncrono passam a operar sob baseline definitivo e congelado.

### Diretrizes Mandatórias:
1. **Desacoplamento Obrigatório de Jobs Analíticos**: A requisição síncrona do Hub de Importação encerra-se estritamente após a promoção de faturamento, atualização da `base_atendimento`, validação da auditoria de 5 camadas e refresh das views de vendas. Nenhuma rotina analítica secundária (como `refresh_clientes_atividade()`) poderá ser executada de forma síncrona dentro da requisição do Hub.
2. **Execução Assíncrona e Isolamento de Erros**: O recálculo de atividade de clientes deve ser enfileirado e processado em segundo plano (`cm_clientes_atividade_jobs`). Nenhuma exceção nessa etapa poderá provocar rollback ou invalidar o status da importação.
3. **Controle de Concorrência via Mutex**: O processamento em background deve obrigatoriamente utilizar Advisory Lock no PostgreSQL (`pg_try_advisory_lock`) para evitar execuções simultâneas ou colisões de estado.
4. **Governança de Alterações**: Novas alterações na arquitetura do Hub de Importação somente poderão ocorrer mediante abertura formal de novo incidente ou evolução funcional aprovada pela governança da plataforma.

Status Arquitetural: `IMPORT_HUB_STATUS = STABLE` & `INCIDENT_STATUS = CLOSED` & `BASELINE = CONFIRMED`.

---

## 67. Baseline Oficial — Invalidação Coordenada de Cache de Apresentação (Baseline Permanente)

A partir de 30/07/2026, a arquitetura de invalidação coordenada de cache de apresentação passa a constituir baseline oficial e permanente do Coffee++.

### Diretrizes Mandatórias:
1. **Invalidação Automática Pós-Importação**: Sempre que uma importação oficial for concluída com status `SUCCESS` e auditoria de 5 camadas aprovada, todos os caches de apresentação afetados deverão ser invalidados imediatamente através do `CacheInvalidationService`.
2. **Desacoplamento entre Serviços de Domínio e Caches**: O `ImportService` (e qualquer outro serviço de carga de dados) é expressamente proibido de conhecer ou invocar diretamente implementarções de caches visuais (como `DashboardCache` ou `Map.clear()`). Toda invalidação deve ser intermediada pelo `CacheInvalidationService`.
3. **Métodos Específicos de Invalidação**: Caches de rotas e componentes devem expor métodos de invalidação específicos e reutilizáveis (ex: `DashboardCache.invalidate()`).
4. **Preservação do Cache em Navegação Normal**: O mecanismo de cache com `CACHE_TTL = 5 minutos` deve ser preservado para todas as consultas normais de navegação, sendo limpo estritamente por eventos oficiais de atualização de dados.
5. **Isolamento Total de Exceções**: A camada de invalidação de cache opera em blocos não-bloqueantes com tratamento de erro isolado, garantindo que inconsistências raras de cache jamais afetem a persistência ou o status final das cargas de dados.

Status Arquitetural: `DASHBOARD_CACHE_STATUS = STABLE` & `CACHE_INVALIDATION_STATUS = HOMOLOGATED` & `BASELINE = CONFIRMED`.

---

## 68. Baseline Oficial — Padrão Corporativo de Orquestração Orientada a Eventos de Domínio (Baseline Permanente)

A partir de 30/07/2026, o padrão **Event-Driven Infrastructure Orchestration** passa a ser o diretriz corporativa obrigatória para todos os novos módulos e serviços da plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Separation of Concerns Rígida**: `DomainService` → `DomainEvent` → `EventCoordinator` → `InfrastructureServices`.
2. **Proibição Absoluta de Contaminação**: Nenhum serviço de domínio poderá instanciar, importar ou manipular diretamente caches, websockets, mecanismos de notificação (push/email/whatsapp), telemetria visual ou SDKs de integrações externas.
3. **Orquestração via Coordenadores**: Todos os efeitos colaterais de infraestrutura decorrentes de uma alteração de negócio deverão ser orquestrados exclusivamente por um `Coordinator` (ex: `CacheInvalidationService`, `NotificationCoordinator`).
4. **Padrão de Nomenclatura Oficial**:
   - Domínio: `*Service` (ex: `ImportService`, `CrmService`)
   - Orquestrador: `*Coordinator` / `*InvalidationService` (ex: `CacheInvalidationService`)
   - Armazenamento de Cache: `*Cache` (ex: `DashboardCache`)
   - Eventos: `*Event` (ex: `ImportSuccessEvent`)
5. **Garantia de Evolução sem Quebras**: Alterações nas tecnologias de infraestrutura (ex: substituição de cache em memória por Redis ou troca de gateway de e-mail) devem ser realizadas estritamente no `Coordinator` ou `InfrastructureService`, sem modificar nenhuma linha dos serviços de domínio.

Status Arquitetural: `EVENT_DRIVEN_ORCHESTRATION_PATTERN = MANDATORY` & `BASELINE = CONFIRMED`.

---

## 69. Baseline Oficial — Reimportação Controlada de Faturamento (Baseline Permanente)

A partir de 30/07/2026, a arquitetura e diretrizes operacionais de **Reimportação Controlada de Faturamento** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Separação Rígida de Responsabilidades (Upload vs Confirm)**:
   - O endpoint de `Upload` (`/api/import/excel/upload`) realiza exclusivamente leitura, validação de formato, staging e análise preventiva de duplicidades.
   - O endpoint de `Confirm` (`/api/import/excel/confirm`) realiza exclusivamente alteração de estado, promoção de faturamento, validação de override, auditoria e invalidação de cache.
2. **Decisão de Override 100% Server-Side**:
   - O override de importação jamais poderá ser autorizado ou forçado por parâmetros, flags ou booleanos enviados pela aplicação cliente (frontend).
   - A decisão deve ser avaliada exclusivamente no backend, exigindo autenticação ativa via token JWT, autorização por perfil (`Admin` ou `Admin Master`), recálculo server-side do período via staging e justificativa padronizada obrigatória.
3. **Imutabilidade Histórica de Lotes**:
   - O histórico de sincronização é imutável. O `status = 'SUCCESS'` do lote original em `cm_sync_logs` jamais deve ser alterado ou sobrescrito.
   - O relacionamento entre lotes é registrado via ponteiros de substituição em metadados (`superseded_by_batch_id` no lote antigo e `replacement_of_batch_id` no lote novo).
4. **Auditoria Corporativa Mandatória**:
   - Toda reimportação com substituição de lote deve obrigatoriamente registrar um evento de auditoria corporativa via `logAuditAction` contendo: `user_id`, `role`, `timestamp`, `motivo_padrao`, `motivo_descricao` (quando aplicável), `old_batch_id` e `new_batch_id`.
5. **Invalidação Obrigatória de Cache**:
   - Toda promoção concluída com êxito deve obrigatoriamente acionar o `CacheInvalidationService.onImportSuccess(newBatchId)` para zerar os caches visuais afetados e forçar a reconstrução imediata com dados atualizados do PostgreSQL.
6. **Segurança por Design (Zero Trust Client Flags)**:
   - Nenhuma decisão transacional crítica da plataforma pode depender de flags enviadas pelo cliente. Toda permissão e alinhamento de dados (como `period_start` e `period_end`) deve ser recalculada integralmente no servidor antes da gravação final.

Status Arquitetural: `CONTROLLED_REIMPORT_STATUS = STABLE` & `GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 70. Baseline Oficial — Validade das Cartas de Anuência por Ciclo e Competência (Baseline Permanente)

A partir de 01/08/2026, a arquitetura e diretrizes operacionais de **Validade das Cartas de Anuência por Ciclo e Competência** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Coluna Oficial Única (`validade_ate DATE`)**: A tabela `cm_cartas_anuencia` utiliza exclusivamente o campo `validade_ate DATE` para persistência da data limite de validade da quitação. É expressamente proibida a criação ou manutenção paralela da antiga coluna `valida_ate`.
2. **Centralização Total no Helper da Aplicação**: Todo cálculo de validade deve ser realizado exclusivamente pela função compartilhada `calcularValidadeCartaAnuencia(competencia)` em `src/app/investimento/carta-anuencia/validade-helper.ts`. É proibido duplicar regras em Triggers no PostgreSQL ou em componentes frontend.
3. **Fluxo Oficial de Escrita**: `UI` → `Server Action` → `calcularValidadeCartaAnuencia()` → `Persistência em validade_ate`. O banco de dados apenas armazena a data calculada.
4. **Regras de Negócio Homologadas**:
   - **1º Ciclo (Janeiro, Fevereiro, Março)**: Validade em `31 de março` do mesmo ano da competência (`YYYY-03-31`).
   - **2º Ciclo (Junho, Julho, Agosto)**: Validade em `31 de agosto` do mesmo ano da competência (`YYYY-08-31`).
   - Competências não homologadas não possuem preenchimento automático arbitrário.
5. **Imutabilidade Histórica**: A validade gravada em `validade_ate` no momento da emissão passa a compor o documento histórico e imutável. Alterações retroativas ou re-cálculos automáticos em cartas já emitidas são proibidos sem migração formal aprovada.
6. **Proibição de Bloqueio por Expirado (Uso Informativo Exclusivo)**: A expiração da Carta de Anuência jamais poderá bloquear ou impedir a consulta, visualização, impressão ou exportação em PDF do documento. A verificação de expiração (`expirada` / `verificarCartaExpirada`) destina-se exclusivamente a fins informativos visuais (ex: badges e alertas visuais de "Expirada").
7. **Interface e Formatação**: Todos os pontos do módulo (Listagem, Modais, Preview, PDF e Impressão) devem exibir a validade formatada no padrão PT-BR (`31/08/2026` / `31/03/2026`) consumindo a função `formatarDataValidade(validade_ate)`.

Status Arquitetural: `CARTAS_ANUENCIAS_VALIDADE_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 71. Regra Permanente — Homologação de Dashboards Analíticos (Baseline Permanente)

A partir de 02/08/2026, a **Regra Permanente — Homologação de Dashboards Analíticos** torna-se o baseline oficial e definitivo da plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Auditoria Inicial Obrigatória**: Antes de qualquer implementação, deve ser realizada uma auditoria completa identificando fontes de dados, regras existentes, dependências arquiteturais, componentes envolvidos e potenciais duplicações de lógica. Nenhuma implementação poderá iniciar sem essa auditoria.
2. **Fonte Única de Verdade**: Toda métrica financeira ou analítica deverá utilizar exclusivamente a `AnalyticsEngine` ou outro componente oficialmente homologado como fonte de verdade. É expressamente proibido implementar cálculos financeiros diretamente no Frontend.
3. **Auditoria da Semântica dos Dados**: Antes da criação ou alteração de qualquer indicador, deverá ser comprovada documentalmente a semântica dos campos utilizados. É proibido assumir o significado de qualquer campo do banco de dados apenas pelo nome.
4. **Auditoria de Paridade Financeira (Desvio Máximo = 0%)**: Após a implementação, deverá ser executada obrigatoriamente uma auditoria comparando os indicadores do dashboard com as fontes oficiais (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`, etc.), validando Faturamento, Investimentos, Percentuais, Preços e Consolidações. O desvio financeiro aceitável é rigorosamente **0%**.
5. **Critérios Obrigatórios de Homologação**:
   - Auditoria inicial concluída;
   - `AnalyticsEngine` utilizada como fonte oficial;
   - Auditoria da semântica dos dados concluída;
   - Auditoria de paridade financeira aprovada (**0% de divergência**);
   - `npx tsc --noEmit` executado com 0 erros;
   - `npm run build` executado com sucesso;
   - Walkthrough técnico documentado;
   - Regras de negócio atualizadas na documentação oficial (`AGENTS.md`).

Status Arquitetural: `DASHBOARD_AUDIT_STANDARD = LOCKED` & `FINANCIAL_PARITY_REQUIRED = TRUE` & `OFFICIAL_ANALYTICS_SOURCE = AnalyticsEngine` & `MAX_ALLOWED_FINANCIAL_DEVIATION = 0%`.

---

## 72. Registro Arquitetural — Consumo de Master Data em AnalyticsEngine (Baseline Permanente)

A partir de 02/08/2026, as diretrizes do **Consumo de Master Data em AnalyticsEngine** tornam-se o baseline arquitetural definitivo da plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Exclusividade de Campos Físicos**: Ao implementar consultas analíticas na `AnalyticsEngine`, utilizar exclusivamente os campos físicos existentes na tabela consultada.
2. **Proibição de Atributos Presumidos**: É expressamente proibido assumir que atributos provenientes de views, joins ou enriquecimentos (ex.: `gerente`, `uf`, `canal`, `regional`) existam fisicamente na tabela transacional principal.
3. **Enriquecimento via Fonte Oficial de Master Data**: Quando esses atributos pertencerem ao Cadastro Mestre/Master Data, eles deverão ser obtidos exclusivamente pela fonte oficial correspondente (ex.: `v_redes_matrizes_detalhes`) e utilizados apenas na camada de enriquecimento dos dados no backend, preservando a separação entre dados transacionais e dados cadastrais.
4. **Objetivos Institucionais**:
   - Evitar consultas inválidas ao banco de dados;
   - Preservar a integridade do modelo relacional;
   - Manter a `AnalyticsEngine` desacoplada do Master Data;
   - Impedir dependências implícitas de campos inexistentes.

Status Arquitetural: `ANALYTICS_MASTER_DATA_DECOUPLING = LOCKED` & `BASELINE = CONFIRMED`.

---

## 73. Regra Permanente — Separação entre Dados Transacionais e Master Data (Baseline Permanente)

A partir de 02/08/2026, a **Separação entre Dados Transacionais e Master Data** torna-se o baseline arquitetural obrigatório e permanente da Plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Dados Transacionais**:
   - As tabelas transacionais deverão armazenar exclusivamente informações próprias do evento de negócio (ações, vendas, apurações, investimentos, pagamentos, etc.).
   - Não deverão ser utilizadas para armazenar atributos cadastrais sujeitos a alteração.
2. **Master Data**:
   - Informações cadastrais como Gerente, Rede, Matriz, Canal, Regional, UF, Cidade, Segmentação e demais atributos de cadastro deverão ser obtidas exclusivamente das fontes oficiais de Master Data (`v_redes_matrizes_detalhes`, `cm_clientes`, etc.).
   - É proibido duplicar essas informações em tabelas transacionais apenas para facilitar consultas.
3. **Enriquecimento de Dados**:
   - O enriquecimento entre dados transacionais e cadastrais deverá ocorrer somente na camada de serviço (`AnalyticsEngine`, Services ou Views oficiais).
   - O Frontend não deverá executar lógica de enriquecimento nem assumir relacionamentos implícitos.
4. **Evolução do Modelo**:
   - Sempre que um novo atributo cadastral for necessário, deverá ser avaliado se pertence ao domínio transacional ou ao Master Data antes da implementação.
   - Novos atributos cadastrais deverão ser adicionados exclusivamente às estruturas oficiais de cadastro.
5. **Objetivos Institucionais**:
   - Preservar a integridade do modelo relacional;
   - Evitar redundância de dados;
   - Reduzir inconsistências entre módulos;
   - Facilitar manutenção e evolução do sistema;
   - Garantir uma única fonte oficial para informações cadastrais.

Status Arquitetural: `MASTER_DATA_SEPARATION = LOCKED` & `TRANSACTIONAL_DATA_ISOLATION = REQUIRED` & `MASTER_DATA_SINGLE_SOURCE = TRUE`.

---

## 74. Regra Permanente — Consolidação Hierárquica de Dashboards Analíticos (Baseline Permanente)

A partir de 02/08/2026, a **Consolidação Hierárquica de Dashboards Analíticos** torna-se o baseline arquitetural obrigatório e permanente da Plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Consistência Hierárquica**: Toda agregação deverá possuir consistência matemática entre todos os níveis da hierarquia (ex.: `Família → Rede → Total Geral`). O valor consolidado do nível pai deverá ser exatamente igual à soma/ponderação de seus níveis filhos. Não são permitidas divergências entre níveis de consolidação.
2. **Médias Ponderadas**: Sempre que houver consolidação de indicadores financeiros (Preço Médio, Desconto Médio, Investimento Médio ou equivalentes), é proibida a utilização de médias simples. Deverão ser utilizadas exclusivamente médias ponderadas segundo a regra oficial do indicador (ex.: $\sum(\text{Preço} \times \text{Volume}) \div \sum(\text{Volume})$).
3. **Agregação Exclusivamente na Camada Analítica**: Toda consolidação deverá ocorrer exclusivamente na `AnalyticsEngine` (ou componente analítico oficialmente homologado). O Frontend deverá apenas consumir e apresentar os dados. É proibida qualquer agregação financeira no Client.
4. **Drill-down**: Sempre que um dashboard possuir navegação hierárquica, os níveis inferiores deverão ser derivados da mesma estrutura utilizada para gerar o consolidado. É proibido recalcular indicadores diferentes em cada nível da hierarquia.
5. **Paridade Financeira**: Todo novo dashboard deverá comprovar paridade entre níveis hierárquicos, paridade com a fonte oficial de dados e desvio financeiro máximo permitido de **0,0000%**.

Status Arquitetural: `HIERARCHICAL_ANALYTICS = LOCKED` & `WEIGHTED_AGGREGATION_REQUIRED = TRUE` & `FRONTEND_FINANCIAL_AGGREGATION = FORBIDDEN` & `HIERARCHICAL_PARITY_REQUIRED = TRUE`.

---

### Critério Institucional de Homologação de Dashboards Analíticos

Além das diretrizes desta seção, todo dashboard analítico da Plataforma Coffee++ somente poderá ser considerado oficialmente homologado quando atender cumulativamente aos seguintes critérios:

- Auditoria inicial concluída e documentada;
- Semântica dos dados validada e comprovada;
- `AnalyticsEngine` (ou componente analítico oficialmente homologado) utilizada como única fonte de verdade;
- Consolidação hierárquica validada em todos os níveis da informação;
- Médias ponderadas aplicadas sempre que exigidas pelas regras de negócio;
- Paridade financeira comprovada com desvio máximo de **0,0000%**;
- Ausência de lógica financeira implementada no Frontend;
- Walkthrough técnico documentado;
- Especificação funcional atualizada em `AGENTS.md`, quando houver alteração de regra de negócio;
- `npx tsc --noEmit` executado com **0 erros**;
- `npm run build` executado com sucesso.

### Objetivos da Homologação

Garantir que todos os dashboards executivos da Plataforma Coffee++ apresentem consistência matemática, rastreabilidade, reprodutibilidade dos indicadores e conformidade com as diretrizes de governança analítica da plataforma.

Status Arquitetural: `DASHBOARD_HOMOLOGATION_CHECKLIST = REQUIRED` & `ANALYTICS_GOVERNANCE_COMPLIANCE = MANDATORY`.

---

### Evidência de Aplicação das Baselines

As baselines arquiteturais e de governança definidas neste documento estabelecem os critérios permanentes da Plataforma Coffee++.

A comprovação de conformidade de cada implementação (dashboards, módulos, serviços ou componentes) **não deverá ser registrada neste documento**, mas sim na documentação técnica específica do respectivo módulo, por meio de:

- `implementation_plan.md`;
- `walkthrough.md`;
- Especificação Funcional Oficial;
- Manual Operacional, quando aplicável;
- Relatórios formais de auditoria e homologação.

O **AGENTS.md** deverá permanecer exclusivamente como documento de governança, arquitetura e diretrizes permanentes da plataforma, evitando o acúmulo de históricos de implementação.

Status Arquitetural: `AGENTS_GOVERNANCE_ONLY = TRUE` & `IMPLEMENTATION_EVIDENCE_OUTSIDE_AGENTS = REQUIRED` & `ARCHITECTURAL_BASELINES = PERMANENT`.

---

## 75. Regra Permanente — Walkthrough Técnico de Implementações (Baseline Permanente)

A partir de 02/08/2026, a **Regra Permanente — Walkthrough Técnico de Implementações** torna-se o baseline arquitetural obrigatório e permanente da Plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Obrigatoriedade**: Todo módulo estratégico da Plataforma Coffee++ que introduzir alteração arquitetural, funcional ou analítica relevante deverá possuir um Walkthrough Técnico oficial como evidência da implementação.
2. **Objetivos Institucionais**: O Walkthrough Técnico tem como finalidade registrar:
   - Diagnóstico da situação anterior;
   - Decisões arquiteturais adotadas;
   - Regras de negócio implementadas;
   - Validações e auditorias executadas;
   - Evidências de homologação;
   - Componentes impactados;
   - Status final da implementação.
3. **Escopo e Limites Documentais**: O Walkthrough Técnico é um documento de implementação e homologação. Ele não substitui `AGENTS.md` (governança permanente), Especificação Funcional (regras de negócio) nem Manual Operacional (orientação ao usuário). Cada documento possui responsabilidade própria e complementar.
4. **Estrutura Mínima Obrigatória (9 Seções)**: Todo Walkthrough Técnico deverá conter, no mínimo:
   1. Objetivo da implementação;
   2. Auditoria inicial;
   3. Alterações realizadas;
   4. Regras e fórmulas implementadas;
   5. Evidências de validação;
   6. Lições aprendidas e decisões arquiteturais;
   7. Critérios de homologação;
   8. Arquivos impactados;
   9. Controle documental.

Status Arquitetural: `TECHNICAL_WALKTHROUGH_REQUIRED = TRUE` & `IMPLEMENTATION_EVIDENCE_REQUIRED = TRUE` & `TECHNICAL_HOMOLOGATION_DOCUMENT = MANDATORY`.

---

## 86. Baseline Oficial — Arquitetura Comercial V2 (Baseline Permanente)

A partir de 04/08/2026, a **Arquitetura Comercial V2** passa a ser o baseline oficial, definitivo e permanente da hierarquia comercial, territorialidade e governança de gerentes do Coffee++.

### Diretrizes Mandatórias:
1. **Single Source of Truth de Cadastro**: O cadastro oficial de gerentes e perfis comerciais é exclusivamente a tabela `public.cm_user_profiles` (`employee_code` soberano).
2. **Single Source of Truth de Resolução Canônica**: Todo mapeamento de nomes, aliases e IDs de gerentes em código TypeScript/TSX DEVE utilizar exclusivamente `src/lib/domain/canonical.ts` (`resolveCanonicalManager`).
3. **Single Source of Truth de Territorialidade**: O mapeamento de UFs é definido exclusivamente por `public.manager_uf_mapping` e a regionalização por rede/estado em `public.cm_base_atendimento_regional`. É proibida a criação de filtros de estado hardcoded.
4. **Proibição de Listas Locais**: É expressamente proibido declarar arrays locais com nomes ou IDs de gerentes (ex: `const MANAGERS = [...]`) em arquivos de rotas, Server Actions ou componentes React.
5. **Preservação de Paridade e AnalyticsEngine**: Toda agregação ou cálculo comercial deve ser realizado exclusivamente via `AnalyticsEngine`, comprovando 0,0000% de desvio financeiro.

Status Arquitetural: `COMMERCIAL_ARCHITECTURE_V2 = LOCKED` & `BASELINE = CONFIRMED`.

---

## 87. Baseline Oficial — Média das Redes Planejáveis (Méd 3M Dinâmica)

A partir de 04/08/2026, o indicador e coluna **Méd 3M** no módulo de Metas por Rede (`src/app/gestao/metas-rede/page.tsx`) passa a ser o baseline oficial e permanente da plataforma.

### Diretrizes Mandatórias:
1. **Nomenclatura Oficial:** A coluna de histórico na tabela de Abertura de Meta por Rede é obrigatoriamente nomeada como **"Méd 3M"**.
2. **Fórmula Oficial:** A média é calculada exclusivamente via Média Aritmética Fixa dos 3 últimos meses fechados:
   $$\text{Méd 3M} = \frac{\text{Mês}_{-3} + \text{Mês}_{-2} + \text{Mês}_{-1}}{3}$$
3. **Resolução Dinâmica:** A seleção dos 3 meses fechados é efetuada 100% dinamicamente via `getPreceding3ClosedMonths(metaMonth, year)` a partir do mês e ano da meta. É proibido qualquer hardcode de meses no código.
4. **Isolamento de Componentes:** Fica congelada e proibida qualquer alteração de layout, CSS, ordenação ou contratos de API do módulo sem nova homologação formal.

Status Arquitetural: `MED_3M_DYNAMIC_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 88. Baseline Oficial — Origem Soberana de Metas por Rede (Single Source of Truth na RPS)

A partir de 04/08/2026, a arquitetura do módulo **Metas por Rede** (`src/app/gestao/metas-rede/page.tsx`) e sua integração com a RPS passa a ser o baseline oficial, soberano e permanente da plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Single Source of Truth:** A tabela `public.cm_weekly_projections` é a única fonte da verdade de persistência de metas por rede no sistema.
2. **Integração com RPS:** A tela Metas por Rede é a origem oficial de cadastro. O salvamento executa o UPSERT direto em `cm_weekly_projections` vinculando obrigatoriamente `manager_id`, `codigo_matriz`, `manager` (nome canônico), `client_matrix` (rede), `year`, `month`, `kpi = 'META'` e `projection_value`.
3. **Resumo Executivo no Accordion:** O cabeçalho por gerente exibe o resumo executivo horizontal em **linha única de altura fixa** (Fat, Méd 3M, Meta, Pace, Preenchidas, Vol Prev Kg).
4. **Seletor Dinâmico de Período:** A alteração de mês e ano dispara o recálculo dinâmico da tela e das colunas de histórico via `getPreceding3ClosedMonths(month, year)`.
5. **Coluna % vs Méd 3M:** Exibida após `Vol. Kg`, calculada via `(Meta Kg / Média 3M Kg) * 100` com coloração reativa e tooltip detalhado.
6. **Ordenação Soberana:** Redes e gerentes são ordenados obrigatoriamente pela `Méd 3M` em ordem decrescente (desempate de redes: alfabética pt-BR).

Status Arquitetural: `METAS_REDE_SOVEREIGN_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED` & `PRODUCTION_READY = TRUE`.

---

## 89. Baseline Oficial — Arquitetura Corporativa V4 (Metas por Rede)

A partir de 04/08/2026, a arquitetura corporativa **Metas por Rede V4** torna-se a baseline oficial, soberana e permanente da plataforma Coffee++.

### Diretrizes Mandatórias da Fase 4:
1. **Unificação via `MetasRedeViewModel`:** A API `/api/gestao/metas-rede` e o `CommercialPlanningService.getMetasRedeViewModel(year, month)` entregam um DTO corporativo 100% pré-agregado e pré-ordenado no backend.
2. **Cache Inteligente de Faturamento:** A consulta pesada de faturamento em `mv_vendas_cliente_mensal` utiliza cache em memória por `${year}-${month}` com TTL de 5 minutos, invalidado automaticamente a cada salvamento em `cm_weekly_projections`.
3. **Telemetria e Observabilidade Expandida:** `PlanningTelemetry` monitora `sqlTimeMs`, `backendTimeMs`, `apiTimeMs`, `totalTimeMs`, `memoryUsedMb`, `cacheHit` e `cacheMiss`.
4. **Auditoria de Salvamento:** Toda escrita em `cm_weekly_projections` grava log auditável com usuário, timestamp, manager_id, codigo_matriz, valores anterior/novo e origem.
5. **Zero Regressão:** Mantidos 100% da paridade com a RPS, AnalyticsEngine, regras financeiras, ordenação por `Méd 3M` e layout executivo horizontal.

Status Arquitetural: `METAS_REDE_CORPORATE_V4 = LOCKED` & `BASELINE = CONFIRMED` & `PRODUCTION_READY = TRUE`.

---

## 90. Baseline Oficial — Workflow Corporativo de Planejamento Comercial (Fase 5)

A partir de 04/08/2026, o **Workflow Corporativo de Planejamento Comercial** (Fase 5) do módulo Metas por Rede torna-se o baseline oficial, soberano e permanente da plataforma Coffee++.

### Diretrizes Mandatórias da Fase 5:
1. **Estados Oficiais do Workflow:** Todo planejamento de meta possui um estado controlado em `cm_weekly_projections_workflow` (`DRAFT` 🟡 Em Elaboração, `REVIEW` 🔵 Em Revisão, `APPROVED` 🟢 Aprovado, `FROZEN` ⚫ Congelado).
2. **Esteira de Transição Multinível:** Transições de status são rastreadas com `submitted_by`, `approved_by`, `approved_comments`, `frozen_by` e timestamps.
3. **Locks e Travas de Edição:** Alterações de metas são permitidas exclusivamente quando `status = 'DRAFT'`. Estados `APPROVED` e `FROZEN` bloqueiam edições no frontend e no backend.
4. **Single Source of Truth na RPS:** Mantidos 100% da paridade e consumo direto sobre `public.cm_weekly_projections`.

Status Arquitetural: `WORKFLOW_PLANNING_V5 = LOCKED` & `BASELINE = CONFIRMED` & `PRODUCTION_READY = TRUE`.

---

## 91. Baseline Oficial — Cockpit Comercial Nacional (Fase 6)

A partir de 04/08/2026, o **Cockpit Comercial Nacional** (Fase 6) torna-se o baseline oficial, soberano e permanente da plataforma Coffee++.

### Diretrizes Mandatórias da Fase 6:
1. **Consumo Exclusivo da `AnalyticsEngine V1`:** O Cockpit Comercial Nacional consome exclusivamente dados da `AnalyticsEngine.getCockpitComercial(filters)` e do `CommercialPlanningService.getCockpitNacionalViewModel(year, month)`. São proibidas SQLs locais ou discrepâncias de faturamento.
2. **Componentes Congelados:** Módulo 1 (Dashboard Executivo Cards), Módulo 2 (Rankings Gerentes, Redes, UFs, Clientes), Módulo 3 (Mapa UF Executivo), Módulo 4 (Painel de Risco), Módulo 5 (Radar de Oportunidades), Módulo 6 (Simulador Executivo 100% em Memória), Módulo 7 (Drill Down Multinível), Módulo 8 (Alertas Corporativos), Módulo 9 (Export Engine).
3. **Paridade Financeira de 0,0000%:** Mantidos 100% de paridade financeira em relação à baseline MyMetrics (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`).

Status Arquitetural: `COCKPIT_COMERCIAL_NACIONAL_V6 = LOCKED` & `BASELINE = CONFIRMED` & `PRODUCTION_READY = TRUE`.

---

## 92. Baseline Oficial — AI Commercial Copilot (Fase 7)

A partir de 04/08/2026, a camada de inteligência prescritiva **AI Commercial Copilot** (Fase 7) torna-se o baseline oficial, soberano e permanente da plataforma Coffee++.

### Diretrizes Mandatórias da Fase 7:
1. **Reutilização Integral do Baseline:** O AI Commercial Copilot consome exclusivamente `CockpitService`, `AnalyticsEngine V1` e `CommercialPlanningService`. São proibidas alterações em regras financeiras, fórmulas ou views oficiais.
2. **Nódulos Prescritivos Homologados:** Módulo 1 (Executive Insights), Módulo 2 (Explainable KPI), Módulo 3 (Recomendações Prescritivas), Módulo 4 (Executive Chat Engine), Módulo 5 (What-If Simulator 100% em Memória), Módulo 6 (Executive Briefing), Módulo 7 (Score Comercial 0–100), Módulo 8 (Alertas Inteligentes 🔴 🟠 🟢), Módulo 9 (Executive Timeline), Módulo 10 (IA Executiva LLM Interface).
3. **Paridade Financeira de 0,0000%:** Mantidos 100% de desvio financeiro zero em relação à baseline homologada.

Status Arquitetural: `COFFEE_AI_COPILOT_V1 = LOCKED` & `BASELINE = CONFIRMED` & `PRODUCTION_READY = TRUE`.

---

## 93. Baseline Oficial — Decision Platform Enterprise V2

A partir de 04/08/2026, a **Decision Platform Enterprise V2** passa a integrar a plataforma Coffee++ como a camada superior de orquestração executiva e auditabilidade de decisões.

### Diretrizes Mandatórias:
1. **Camada Superior de Orquestração:** A Decision Platform V2 opera unicamente como orquestradora sobre os módulos homologados (`AnalyticsEngine V1`, `CommercialPlanningService`, `CockpitService`, `CopilotService`, `CommercialIntelligenceService`). Fica proibida qualquer alteração em serviços ou regras financeiras existentes.
2. **Decision Pipeline Sequencial:** O fluxo de decisão segue a esteira determinística: Cockpit → Insights → Diagnosis → Priorities → Recommendations → Action Plans → Executive Briefing → Decision Graph.
3. **Rule Registry Centralizado:** Todas as regras corporativas residem em `src/lib/decision-platform/registry/rules/` (`GrowthRules`, `RiskRules`, `ForecastRules`, `PricingRules`, `MixRules`, `HealthRules`, `PriorityRules`, `BriefingRules`).
4. **Score Registry Catálogo:** Catálogo padronizado de scores (`Health Score`, `Commercial Score`, `Growth Score`, `Opportunity Score`, `Priority Score`, `Risk Score`, `Forecast Confidence`) com fórmulas, escalas e rastreabilidade.
5. **Decision Graph Inviolável:** Cada recomendação gerada pela plataforma registra obrigatoriamente a árvore completa de rastreabilidade (KPIs de entrada, regras aplicadas, pesos, score final, justificativa, impacto financeiro R$ e percentual de confiança).
6. **Zero SQL & Zero DB Direct Access:** Processamento 100% em memória, mantendo 0,0000% de desvio financeiro e zero regressão.

Status Arquitetural: `DECISION_PLATFORM_V2 = LOCKED` & `BASELINE = CONFIRMED` & `PRODUCTION_READY = TRUE`.

---

## 94. Baseline Oficial — Revenue Growth Management Platform (RGM) — Fase 8

A partir de 04/08/2026, a **Revenue Growth Management Platform (RGM)** (Fase 8) passa a integrar o ecossistema Coffee++ como a camada prescritiva de alavancagem de receita e margem comercial.

### Diretrizes Mandatórias:
1. **Camada Prescritiva sobre a Decision Platform V2:** A RGM Platform opera unicamente como camada prescritiva sobre a `DecisionPlatformService` (LOCKED). Fica proibida qualquer alteração em serviços ou regras financeiras existentes.
2. **Motores RGM Prescritivos:** 9 motores independentes em `src/lib/rgm/engines/` (`OpportunityEngine`, `WhiteSpaceEngine`, `ShareOfWalletEngine`, `PriorityMatrixEngine`, `PriceOpportunityEngine`, `MixOpportunityEngine`, `RevenueSimulatorEngine`, `ExecutiveActionPlanEngine`, `CEOBoardEngine`).
3. **Simulação 100% em Memória:** Simulações de faturamento, preço, volume e expansão de mix ocorrem 100% em memória sem gravações ou mutações no banco de dados.
4. **Single Source of Truth Preservada:** Mantidos 0,0000% de desvio financeiro e zero alteração de tabelas ou SQLs.
5. **Componentes Congelados:** DTO `RGMViewModel`, `RGMService`, API HTTP `GET /api/rgm` e suíte automatizada de testes.

Status Arquitetural: `REVENUE_GROWTH_MANAGEMENT_V1 = LOCKED` & `BASELINE = CONFIRMED` & `PRODUCTION_READY = TRUE`.

---

## 95. Baseline Oficial — Segregação Definitiva KA × Distribuidor (Módulo Metas por Rede)

A partir de 06/08/2026, a **Segregação Definitiva KA × Distribuidor** no módulo de Metas por Rede (`/gestao/metas-rede`) torna-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Segregação Obrigatória por Canal**: Cada gerente comercial possui obrigatoriamente duas carteiras e canais independentes: **KA (Key Accounts)** e **Distribuidor**. É terminantemente proibida qualquer mistura, unificação ou taxa cruzada entre eles.
2. **Single Source of Truth da Meta Oficial**: A Meta Oficial do Gerente por Canal é lida exclusivamente da tabela `public.targets` (`manager (KA)` e `manager (Dist)`). A Meta Consolidada do gerente é calculada via $\text{Meta Consolidada} = \text{Meta KA} + \text{Meta Dist}$.
3. **Single Source of Truth das Metas por Rede**: As metas por rede permanecem persistidas exclusivamente na tabela `public.cm_weekly_projections` (`kpi = 'META'`).
4. **Isolamento de Rateio Assistido**: O botão de rateio assistido KA atua exclusivamente nas redes KA. O botão de rateio assistido Distribuidor atua exclusivamente nos distribuidores. Fica proibido qualquer rateio cruzado entre os canais.
5. **Manutenção do Fluxo de Sincronização**: A esteira de sincronização bidirecional com a RPS permanece intacta: `public.targets` → `CommercialPlanningService` → `Metas por Rede` → `public.cm_weekly_projections` → `RPS`.
6. **Fronteiras de Responsabilidade**:
   - `/metas`: Responsável exclusivamente pelo cadastro e edição da Meta Oficial.
   - `/gestao/metas-rede`: Responsável exclusivamente pelo desdobramento da Meta Oficial entre as redes.
   - `RPS`: Responsável pelo acompanhamento e edição operacional das metas por rede.
7. **Proteção Contra Regressão**: Qualquer alteração futura deverá obrigatoriamente preservar a segregação KA × Distribuidor, `targets` como única fonte da Meta Oficial, `cm_weekly_projections` como única fonte das Metas por Rede e o isolamento completo entre os canais. Qualquer Pull Request que viole essas diretrizes deverá ser rejeitado.

Status Arquitetural: `KA_DIST_SEGREGATION = LOCKED` & `FEATURE_COMPLETE = TRUE` & `PRODUCTION_READY = TRUE` & `REGRESSION_PROTECTED = TRUE` & `SINGLE_SOURCE_OF_TRUTH = ENFORCED`.

---

## 96. Diretriz Permanente — Engenharia Orientada a Valor de Negócio

A partir de 06/08/2026, a prioridade da engenharia da plataforma Coffee++ passa a ser exclusivamente a entrega de valor ao negócio.

### Diretrizes Mandatórias:
1. **Origem por Necessidade Real**: Novas implementações deverão nascer de uma necessidade real de negócio ou solicitação explícita do Product Owner.
2. **Justificativa Técnica Estrita**: Melhorias técnicas, refatorações ou otimizações somente deverão ser executadas quando resolverem um problema comprovado, reduzirem risco operacional ou suportarem uma funcionalidade de negócio.
3. **Proibição de Refatoração Estética**: É proibida a realização de refatorações por iniciativa própria apenas por preferência técnica, estética ou organizacional.
4. **Reutilização de Arquitetura**: Sempre que possível, alterações deverão reutilizar componentes, serviços, contratos e estruturas já existentes, preservando a arquitetura vigente.
5. **Métrica Principal de Sucesso**: O sucesso de uma entrega será medido prioritariamente pelo impacto no negócio, estabilidade operacional e experiência do usuário, e não pela quantidade de código alterado.

Status Arquitetural: `ENGINEERING_MODE = BUSINESS_VALUE` & `BUSINESS_FIRST = TRUE` & `ARCHITECTURE_REUSE = MANDATORY` & `UNNECESSARY_REFACTORING = FORBIDDEN`.

---

## 98. Baseline Oficial — Acesso Read-Only ao Módulo Financeiro (Boletos) para Gerentes

A partir de 06/08/2026, a autorização de acesso em modo leitura ao Módulo Financeiro (`/financeiro/boletos`) para usuários com perfil **GERENTE** torna-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Escopo Read-Only**: Usuários com perfil GERENTE possuem permissão exclusivamente para visualizar, pesquisar, filtrar, ordenar e exportar boletos. É expressamente proibida qualquer ação de importação de planilhas, adição manual, edição, exclusão ou alteração de dados.
2. **Ocultação DOM no Frontend**: Os componentes de escrita (*Importar Planilha*, *Adicionar Manual*, formulários e ações de edição/exclusão da tabela) são completamente omitidos da renderização DOM para perfis GERENTE (não apenas desabilitados).
3. **Validação de Autorização no Backend**: Toda validação de acesso é realizada obrigatoriamente no servidor (Server Actions e API HTTP `/api/trade/boletos/importar`) com verificação do token de autenticação e consulta à role em `cm_user_profiles`. O servidor responde com HTTP `403 Forbidden` a qualquer tentativa não autorizada de escrita.
4. **Identidade da Exportação com a Grid**: O botão *Exportar* gera planilhas Excel (`.xlsx`) exclusivamente a partir do mesmo DTO já filtrado e ordenado exibido na grid (`filteredBoletos`), mantendo paridade absoluta de registros, filtros ativos e formatação.
5. **Preservação Total do Ecossistema**: Fica proibida qualquer alteração na `AnalyticsEngine`, banco de dados, RLS, migrations, views oficiais, fórmulas ou regras de negócio em decorrência deste controle de acesso.
6. **Auditoria Mandatória**: Toda evolução deste módulo exige aprovação em `npm run health:analytics`, `npx tsc --noEmit` e `npm run build` com 0 desvio financeiro e 0 regressões.

Status Arquitetural: `BOLETOS_READONLY_GERENTE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 99. Baseline Oficial — Copiloto Comercial Inteligente de Lançamento

### Objetivo

O Copiloto Comercial Inteligente constitui a camada oficial de apoio à decisão do módulo de Lançamento de Investimentos.

Seu objetivo é orientar o gerente antes da confirmação do lançamento, utilizando exclusivamente informações históricas homologadas, sem interferir na decisão do usuário e sem alterar qualquer regra financeira da Plataforma Coffee++.

---

### Diretrizes Obrigatórias

1. O Copiloto atua exclusivamente em modo **Read-Only**.

2. É proibido alterar:
   - AnalyticsEngine;
   - Banco de Dados;
   - Views oficiais;
   - RLS;
   - Regras financeiras;
   - Apuração;
   - Fluxo de aprovação.

3. O Copiloto jamais poderá bloquear o lançamento.

4. O botão "Confirmar Lançamento" permanece sempre disponível.

---

### Critério de Comparabilidade

As comparações históricas deverão utilizar exclusivamente ações equivalentes.

Uma ação somente poderá ser utilizada como referência quando possuir simultaneamente:

- mesma Rede;
- mesma Abrangência (Família ou SKU);
- mesmo Item;
- mesmo Tipo da Ação (Sell In / Sell Out);
- mesmo Tipo Comercial;
- ação homologada.

É proibida a comparação entre cenários distintos.

---

### Hierarquia da Experiência

O painel deverá sempre seguir esta ordem de leitura:

1. Diagnóstico Geral
2. Indicadores Comparativos
3. Histórico Recente
4. O que mudou
5. Recomendação Comercial

---

### Linguagem Institucional

O Copiloto deve comunicar-se como um Diretor Comercial experiente.

É proibido utilizar linguagem técnica como:

- algoritmo;
- score;
- engine;
- IA;
- machine learning.

Sempre explicar o motivo das recomendações em linguagem executiva.

---

### Inteligência Comercial

As recomendações deverão considerar simultaneamente:

- Investimento;
- Volume Esperado;
- ROI Estimado;
- Eficiência Comercial;
- Custo por Unidade.

Sempre justificar o diagnóstico.

---

### Gatilho de Exibição

O Copiloto somente poderá ser exibido quando todos os campos obrigatórios do lançamento estiverem preenchidos.

Caso contrário, permanece totalmente oculto.

---

### Governança

Esta funcionalidade integra oficialmente a Plataforma Coffee++ como camada institucional de apoio à decisão comercial.

Qualquer evolução futura deverá preservar:

- ausência de impacto financeiro;
- ausência de impacto em AnalyticsEngine;
- ausência de impacto em Banco/RLS;
- comportamento exclusivamente consultivo.

Status:
HOMOLOGADO

Baseline Permanente.

---

## 100. Baseline Oficial — Copiloto Comercial Inteligente V2 — Comparação Lado a Lado

### Objetivo
O Copiloto Comercial Inteligente passa a utilizar como referência prioritária a última ação real equivalente, substituindo comparações baseadas em médias históricas.

### Diretrizes Permanentes

- A comparação deverá utilizar exclusivamente ações equivalentes:
  - mesma Rede (Código Matriz);
  - mesma UF;
  - mesmo Gerente;
  - mesma Abrangência (Família ou SKU);
  - mesmo Item;
  - mesmo Tipo Comercial;
  - mesmo Sell In / Sell Out.

- A prioridade de busca deverá obedecer:
  1. último lançamento equivalente;
  2. lançamento equivalente imediatamente anterior;
  3. histórico cronológico dos três últimos lançamentos equivalentes.

- É proibido utilizar médias, agregações ou combinações entre ações distintas como referência principal.

- O layout oficial do Copiloto deverá apresentar comparação visual lado a lado entre:
  - Último Lançamento Real;
  - Nova Proposta.

- Cada indicador deverá apresentar tendência visual (▲ ▼ =) e variação percentual para:
  - Preço Flat;
  - Preço Promo;
  - Investimento;
  - Expectativa de Volume;
  - ROI Estimado;
  - Eficiência Comercial;
  - Custo por Unidade.

- Caso não exista histórico equivalente, deverá ser exibida mensagem institucional informando tratar-se do primeiro lançamento comparável.

### Restrições Permanentes

Esta funcionalidade opera exclusivamente em modo Read-Only.

É vedada qualquer alteração em:
- AnalyticsEngine;
- Banco de Dados;
- RLS;
- Apuração;
- Regras Financeiras.

O Copiloto possui caráter exclusivamente consultivo e jamais poderá bloquear o lançamento do investimento.

Status:
HOMOLOGADO

Baseline Permanente.

---

## 101. Baseline Oficial — Copiloto Comercial V2 — Comparação Executiva Lado a Lado

### Diretrizes Permanentes

- O Copiloto Comercial deverá apresentar a comparação entre o último lançamento equivalente e a nova proposta em formato lado a lado.
- Os cabeçalhos deverão exibir explicitamente os meses comparados (ex.: JULHO/2026 × AGOSTO/2026).
- A comparação deverá contemplar obrigatoriamente os seguintes indicadores:
  - Preço Flat;
  - Preço Promo;
  - Investimento;
  - % Investimento (utilizando exclusivamente a fórmula institucional vigente);
  - Expectativa de Volume;
  - ROI Estimado;
  - Eficiência Comercial;
  - Custo por Unidade.
- Cada indicador deverá apresentar tendência visual (▲ ▼ =) e variação quando aplicável.
- Quando existirem três ou mais lançamentos equivalentes, deverá ser exibida uma linha do tempo cronológica dos lançamentos reais.
- A comparação utilizará exclusivamente lançamentos reais equivalentes, vedado o uso de médias ou agregações.

### Restrições Permanentes

- Operação exclusivamente Read-Only.
- Proibida qualquer alteração em AnalyticsEngine, Banco de Dados, RLS, Apuração ou Regras Financeiras.
- O Copiloto possui caráter consultivo e não poderá bloquear o lançamento do investimento.

Status:
HOMOLOGADO

Baseline Permanente.

---

## 102. Baseline Oficial — Copiloto Comercial V2 — Histórico Equivalente (Single Source of Truth)

### Single Source of Truth
- A comparação histórica no Copiloto Comercial consome uma ÚNICA fonte oficial de referência: o **Último Lançamento Real Equivalente**.
- Fica permanentemente PROIBIDO o uso de médias, médias ponderadas, agregações, consolidações ou médias históricas como referência principal.

### Regra Oficial de Equivalência
Toda comparação deve obedecer rigorosamente aos 8 pilares institucionais:
- mesma Rede;
- mesmo Código Matriz;
- mesma UF;
- mesmo Gerente;
- mesma Abrangência;
- mesma Família OU mesmo SKU;
- mesmo Tipo Comercial;
- mesmo Sell In / Sell Out.

### Seleção do Histórico (Workflow Real)
- A busca consome exclusivamente ações reais válidas do workflow oficial do Coffee++ (`fase_atual >= 1` e `is_planejamento IS NOT TRUE`).
- Fica permanentemente vedado o uso de `.gte("fase_atual", 5)` que eliminava o histórico válido do sistema.
- Prioridade de busca: 1. Último lançamento equivalente; 2. Penúltimo lançamento equivalente; 3. Terceiro lançamento equivalente.

### Indicadores Oficiais Mandatórios
A comparação executiva Lado a Lado apresenta obrigatoriamente 4 colunas (`INDICADOR COMERCIAL`, `MÊS ANTERIOR`, `PROPOSTA ATUAL`, `VARIAÇÃO`):
- Preço Flat
- Preço Promo
- Desconto (%) `[((Preço Flat - Preço Promo) / Preço Flat) × 100]`
- Investimento
- Expectativa de Volume
- ROI
- Eficiência Comercial
- Custo por Unidade

### Badges de Variação
- 🟢 **Verde**: melhoria comercial;
- 🔴 **Vermelho**: piora comercial;
- ⚪ **Cinza**: estabilidade / igual.

### Primeiro Lançamento
Quando não existir nenhuma ação equivalente, exibir a mensagem institucional:
*"Primeiro lançamento equivalente desta combinação. Esta proposta iniciará o histórico comercial desta Rede para esta Família/SKU."*
Vedada a renderização de tabelas vazias.

### Restrições Permanentes
- Operação 100% Read-Only.
- Zero impacto em AnalyticsEngine, Banco de Dados, RLS, Apuração e Regras Financeiras.
- Caráter consultivo e não bloqueante.

Status:
HOMOLOGADO — PRODUÇÃO

Baseline Permanente.

---

## 103. Termo de Encerramento Oficial — Copiloto Comercial Inteligente (Ciclo 1)

A partir de 06/08/2026, o primeiro ciclo de evolução do **Copiloto Comercial Inteligente** (`src/app/investimento/lancar`) encontra-se oficialmente encerrado, homologado e congelado em produção.

### Consolidação Arquitetural do Módulo:
- **Baseline 99**: Diagnóstico Executivo Read-Only e recomendações consultivas.
- **Baseline 100**: Comparação histórica Lado a Lado contra ações equivalentes.
- **Baseline 101**: 8 Indicadores comerciais mandatórios e meses reais nos cabeçalhos.
- **Baseline 102**: Single Source of Truth baseada no último lançamento real equivalente e substituição pelo indicador institucional `% DESCONTO`.

### Política de Evolução:
Ajustes visuais, UX e refatorações puramente cosméticas não originam novas Baselines. Novas Baselines (104, 105...) são restritas a alterações estruturais de arquitetura, fluxo operacional, schema de banco ou novas fontes de dados.

Status Geral: `COPILOTO COMERCIAL — CICLO 1 ENCERRADO` | `ARQUITETURA = LOCKED` | `GOVERNANÇA = CONFIRMED` | `BASELINE = PERMANENTE`.

---

## 104. Política Oficial de Evolução Contínua — Módulos Homologados (Baseline Permanente)

A partir de 06/08/2026, é instituída a política permanente da Plataforma Coffee++ para governança e evolução de todos os módulos que atingirem o status `HOMOLOGADO` & `LOCKED & CONFIRMED`.

### Diretrizes Mandatórias:

1. **Classificação por Releases (Sem Nova Baseline)**:
   - Todas as evoluções de UX, UI, layout, performance, responsividade, acessibilidade, usabilidade, textos, componentes visuais e refinamentos de recomendações consultivas devem ser tratadas exclusivamente como **Releases** (ex.: Release X.1, Release X.2).
   - Releases não alteram baselines arquiteturais e preservam integralmente os baselines vigentes.

2. **Gatilhos para Novas Baselines**:
   - Uma nova Baseline somente poderá ser criada quando houver:
     - Alteração arquitetural estrutural;
     - Novo fluxo operacional;
     - Mudança permanente de regra de negócio;
     - Mudança de modelo de governança;
     - Nova fonte oficial de dados;
     - Alteração física/estrutural do módulo.

3. **Homologação Mandatória por Sprint / Release**:
   - Nenhuma Release pode ser promovida a produção sem a emissão de Walkthrough Técnico, Relatório Oficial de Homologação e aprovação nos comandos:
     - `npx tsc --noEmit` (0 erros)
     - `npm run build` (100% Sucesso)

4. **Preservação de Infraestrutura e Governança**:
   - É expressamente proibida qualquer regressão em `AnalyticsEngine`, Banco de Dados, Views, RLS, Apuração e Regras Financeiras em evoluções classificadas como Releases.

Status Institucional: `POLÍTICA INSTITUCIONAL = LOCKED & CONFIRMED` & `BASELINE = PERMANENTE`.

---

## 105. Termo Institucional de Consolidação da Governança (Plataforma Coffee++)

A partir de 06/08/2026, é declarada oficialmente a consolidação definitiva da governança técnica da Plataforma Coffee++.

### Estado Atual do Ecossistema:
- **Arquitetura**: CONSOLIDADA
- **Governança**: PADRONIZADA
- **Processo de Homologação**: INSTITUCIONALIZADO
- **Rastreabilidade**: GARANTIDA
- **Evolução Contínua**: CONTROLADA POR RELEASES

### Fluxo Oficial de Desenvolvimento:
`Planejamento → Desenvolvimento → Walkthrough → Homologação → Release → Produção`

Status Geral: `PLATAFORMA COFFEE++ = LOCKED & CONFIRMED` | `GOVERNANÇA = CONSOLIDADA` | `EVOLUÇÃO = INSTITUCIONALIZADA`.

---

## 106. Constituição da Engenharia — Política de Documentação

A Plataforma Coffee++ adota a seguinte hierarquia oficial de documentação:

### AGENTS.md
Documento permanente de arquitetura e governança.

Contém exclusivamente:
- Baselines;
- Políticas institucionais;
- Regras permanentes;
- Single Source of Truth;
- Padrões oficiais.

### Walkthrough Técnico
Documento de implementação.

Contém:
- decisões técnicas;
- arquitetura da implementação;
- arquivos alterados;
- validações.

### Relatório de Homologação
Documento de evidências.

Contém:
- validações;
- testes;
- auditorias;
- builds;
- TypeScript;
- evidências.

### Release
Documento de evolução funcional.

Contém:
- melhorias;
- correções;
- UX;
- performance;
- funcionalidades.

### Critério Institucional

Antes de registrar qualquer informação no AGENTS.md deverá ser respondida a seguinte pergunta:

*"Esta informação continuará sendo válida independentemente da versão da plataforma?"*

Se NÃO...

...a informação pertence a outro documento.

Status Institucional: `CONSTITUIÇÃO DA ENGENHARIA = LOCKED & CONFIRMED` & `GOVERNANÇA = PERMANENTE`.

---

## 107. Política Oficial de Qualidade de Engenharia

### Objetivo
Garantir que todas as evoluções da Plataforma Coffee++ mantenham os mesmos padrões de qualidade, governança e rastreabilidade já estabelecidos.

### Critérios Obrigatórios para Entrega
Toda implementação deverá atender, obrigatoriamente, aos seguintes critérios antes da homologação:
- Compilação TypeScript sem erros (`npx tsc --noEmit`);
- Build de produção aprovado (`npm run build`);
- Preservação da arquitetura vigente;
- Ausência de regressões funcionais conhecidas;
- Atualização da documentação correspondente (quando aplicável);
- Homologação funcional concluída.

### Critérios para Atualização do AGENTS.md
O AGENTS.md somente poderá ser atualizado quando houver:
- criação de uma nova Baseline;
- alteração permanente de arquitetura;
- nova política institucional;
- mudança permanente de governança;
- alteração de uma fonte oficial de dados (Single Source of Truth).

Melhorias de UX, correções, otimizações, Releases, Hotfixes e ajustes visuais não justificam atualização do AGENTS.md.

### Princípios Permanentes
Toda evolução da Plataforma Coffee++ deverá respeitar os seguintes princípios:
- Segurança antes de conveniência;
- Governança antes de implementação;
- Simplicidade antes de complexidade;
- Rastreabilidade antes de velocidade;
- Preservação da arquitetura antes de novas funcionalidades;
- Evolução incremental antes de refatorações desnecessárias.

Status: `POLÍTICA PERMANENTE` | `CLASSIFICAÇÃO = GOVERNANÇA DE QUALIDADE` | `SITUAÇÃO = LOCKED & CONFIRMED`.

---

## 108. Política Oficial de Arquitetura Evolutiva

### Objetivo
Garantir a evolução contínua da Plataforma Coffee++ preservando estabilidade, governança e rastreabilidade arquitetural.

### Princípio da Evolução Incremental
Toda evolução deverá priorizar:
- reutilização dos componentes existentes;
- extensão da arquitetura vigente;
- compatibilidade retroativa;
- baixo impacto operacional;
- mínima alteração estrutural.

Refatorações completas somente serão autorizadas quando houver justificativa técnica formal aprovada.

### Princípio da Preservação Arquitetural
É vedado substituir arquiteturas consolidadas quando os objetivos puderem ser alcançados através de evolução incremental.

Toda nova funcionalidade deverá buscar:
- reutilizar serviços existentes;
- reutilizar componentes existentes;
- reutilizar padrões oficiais;
- preservar APIs públicas;
- preservar contratos funcionais.

### Critério de Decisão Arquitetural
Antes de qualquer alteração estrutural deverá ser respondido:
1. É possível evoluir a arquitetura existente?
2. Existe impacto em módulos homologados?
3. Existe quebra de compatibilidade?
4. Existe alteração de Single Source of Truth?
5. Existe alteração permanente de governança?

Se todas as respostas forem **NÃO**, a implementação deverá ser realizada como evolução incremental.

### Princípios Permanentes
A Plataforma Coffee++ adota oficialmente os seguintes princípios arquiteturais:
- Evoluir antes de substituir.
- Reutilizar antes de recriar.
- Simplificar antes de expandir.
- Preservar antes de refatorar.
- Documentar antes de homologar.
- Homologar antes de publicar.

### Complemento da Seção 108 — Regra da Menor Mudança Necessária

A Plataforma Coffee++ adota oficialmente o **Princípio da Menor Mudança Necessária**.

Toda evolução deverá buscar atender ao objetivo funcional realizando a menor alteração possível na arquitetura existente.

Antes de qualquer implementação, deverão ser observadas obrigatoriamente as seguintes prioridades:
1. Configuração antes de código.
2. Reutilização antes de criação.
3. Extensão antes de substituição.
4. Composição antes de duplicação.
5. Evolução antes de refatoração.
6. Refatoração antes de reescrita completa.

Toda proposta de alteração deverá demonstrar que avaliou essas alternativas antes de optar por mudanças estruturais.

Esta diretriz complementa a Política Oficial de Arquitetura Evolutiva e passa a integrar permanentemente os princípios de engenharia da Plataforma Coffee++.

---

## 109. Política Permanente de Versionamento e Releases

### Objetivo

Estabelecer a separação permanente entre decisões arquiteturais e evolução funcional da Plataforma Coffee++.

### Regras Permanentes

#### Baselines
- Registram exclusivamente decisões permanentes de arquitetura, governança, Single Source of Truth, fluxos oficiais e regras estruturais da plataforma.
- Alterações em Baselines atualizam obrigatoriamente o `AGENTS.md`.

#### Releases
- Registram evoluções funcionais, melhorias de UX/UI, performance, inteligência consultiva, correções e otimizações realizadas sob a arquitetura vigente.
- Devem preservar compatibilidade com a Baseline vigente.
- Não alteram o `AGENTS.md`, salvo quando introduzirem uma nova Baseline ou modificarem uma política permanente.

### Princípio Institucional

> **Arquiteturas evoluem por Baselines. Produtos evoluem por Releases.**

Toda alteração deve ser classificada inicialmente como Baseline ou Release antes do início da implementação, garantindo rastreabilidade, governança e consistência documental.

Status: `POLÍTICA PERMANENTE` | `SITUAÇÃO = LOCKED & CONFIRMED`.

---

## 110. Baseline Permanente — Domínio Comercial Unificado (SSOT)

A partir de 09/08/2026, a arquitetura e a fachada única do **Domínio Comercial Unificado** tornam-se baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Fachada Única Exclusiva**: O `CommercialDomainService` (`src/lib/domain`) é a ÚNICA fachada pública autorizada para consumo de:
   - Canais Comerciais (`getChannels`, `getChannelOptions`, `resolveChannel`)
   - Segmentos Comerciais (`getSegments`, `getSegmentOptions`)
   - Gerentes Comerciais (`getManagerOptions`, `getFieldManagerList`, `resolveManager`)
   - Regionais Comerciais (`getRegions`, `getRegionOptions`)
   - UFs / Estados Comerciais (`getStates`, `getStateOptions`)
   - Papéis Comerciais / Roles (`getRoles`)
   - Filtros Globais (`getFilterOptions`)
2. **Proibição Absoluta de Hardcodes**: É expressamente proibido criar arrays locais, enums, constantes, switch/case, if ou fallbacks textuais contendo informações comerciais (canais, gerentes, segmentos, UFs, regionais).
3. **Obrigatoriedade para Novos Módulos**: Todo e qualquer novo módulo ou funcionalidade deverá consumir exclusivamente o `CommercialDomainService`.
4. **Proibição de Consultas Locais para Filtros**: Nenhuma tela ou componente UI poderá consultar diretamente tabelas de domínio (`cm_clientes`, `cm_domain_*`) para montar dropdowns ou filtros comerciais.
5. **Proibição de Listas Próprias em APIs**: Nenhuma rota de API poderá manter listas próprias de gerentes, canais ou segmentos.
6. **Sincronização em Rede**: Analytics, RDM, RPS, Cadastro Mestre, Atendimento, Metas, Investimentos, Governança, Dashboard e futuros módulos deverão permanecer sincronizados através do `CommercialDomainService`.
7. **Sincronização Cadastral em Cascata**: Toda alteração estrutural do domínio comercial deverá ocorrer primeiro no Cadastro Mestre (`cm_clientes`) e somente depois refletir automaticamente em toda a plataforma via triggers e invalidação de cache.

Status Arquitetural: `COMMERCIAL_DOMAIN_UNIFIED = LOCKED` & `BASELINE = CONFIRMED`.

---

## 111. Arquitetura Protegida (Protected Architecture)

A partir de 09/08/2026, a arquitetura do **Domínio Comercial Unificado** e do `CommercialDomainService` é alçada à categoria de **Contrato Arquitetural Permanente (Protected Architecture)** da Plataforma Coffee++.

### Diretrizes Mandatórias de Proteção:
1. **Fachada Exclusiva de Acesso**: O `CommercialDomainService` é a única fachada pública autorizada para acesso a dados do domínio comercial.
2. **Acesso a Dados Restrito ao Repository**: É proibido qualquer acesso direto às tabelas de domínio comercial por telas, APIs, cron jobs ou serviços de negócio, exceto por meio do `CommercialDomainRepository`.
3. **Proibição de Hardcodes e Fallbacks**: É estritamente proibido criar arrays hardcoded, enums comerciais, listas de gerentes, canais, segmentos, regionais, estados, switch/case, if/else ou fallbacks contendo informações comerciais.
4. **Consumo Obrigatório por Novos Módulos**: Todo e qualquer novo módulo deverá consumir exclusivamente o `CommercialDomainService`.
5. **Padronização de Componentes UI**: Todo dropdown, filtro, autocomplete ou selector comercial deverá utilizar exclusivamente o catálogo oficial fornecido pelo domínio.
6. **Centralização de Cache**: Nenhum módulo poderá manter cache próprio do domínio comercial. Todo cache deverá utilizar a infraestrutura oficial do `CommercialDomainCache`.
7. **Propagação Automática**: Alterações realizadas no Cadastro Mestre deverão propagar automaticamente para todos os módulos consumidores sem necessidade de manutenção manual.
8. **Governança de Evolução**: Qualquer alteração estrutural no domínio comercial exigirá obrigatoriamente:
   - Atualização da Baseline Oficial;
   - Atualização do ADR correspondente;
   - Atualização do CHANGELOG;
   - Homologação formal com aprovação no `npm run test:domain`.

Status Arquitetural: `COMMERCIAL_DOMAIN_UNIFIED = PROTECTED` & `PROTECTED_ARCHITECTURE = ENFORCED`.

---

## 112. Processo Oficial de RFC (Request For Change)

A partir de 09/08/2026, é instituído o **Processo Oficial de RFC (Request For Change)** como requisito obrigatório e prévio para qualquer alteração arquitetural na Plataforma Coffee++.

### Escopo Obrigatório da RFC:
Toda e qualquer proposta de alteração que impacte:
- Baselines Oficiais Homologadas (`AGENTS.md`);
- Arquitetura Protegida (`Protected Architecture`);
- Domínio Comercial Unificado (`CommercialDomainService`, `CommercialDomainRepository`, `CommercialDomainCache`);
- Contratos Públicos e Interfaces TypeScript do Domínio;
- APIs Públicas da Plataforma;
- Estruturas de Fonte Única de Verdade (Single Source of Truth - SSOT);
- Diretrizes de Governança Financeira e Comercial;
- Motores Analíticos (`AnalyticsEngine`, `ForecastEngine`, `SimulationEngine`, etc.);
- Cadastro Mestre Comercial (`cm_clientes`, `cm_domain_*`);

somente poderá ser implementada após a elaboração, submissão e aprovação formal de uma **RFC**.

### Estrutura Obrigatória da RFC:
Toda RFC submetida deverá ser criada a partir do template oficial (`docs/rfc/RFC_TEMPLATE.md`) e conter obrigatoriamente as 12 seções:
1. **Motivação**: Razão de negócio e contexto que justificam a mudança.
2. **Problema Atual**: Diagnóstico detalhado do cenário vigente a ser modificado.
3. **Objetivo**: O que a proposta visa realizar e os resultados esperados.
4. **Alternativas Avaliadas**: Opções técnicas analisadas e razões do descarte.
5. **Impacto Arquitetural**: Análise de efeitos em componentes, fluxos de dados e infraestrutura.
6. **Impacto Funcional**: Módulos afetados e mudanças de experiência (UX/UI).
7. **Compatibilidade Retroativa**: Garantia de não-regressão e conformidade com os módulos consumidores ativos.
8. **Plano de Migração**: Passos sequenciais de execução do ambiente atual para a nova solução.
9. **Estratégia de Rollback**: Procedimentos de reversão imediata em caso de anomalia.
10. **Plano de Testes**: Suíte de testes estáticos, unitários e de integração necessários.
11. **Critérios de Homologação**: Indicadores objetivos para aprovação da alteração.
12. **Atualizações Documentais Obrigatórias**:
   - Baseline Oficial (`AGENTS.md` e `docs/governance/baseline_oficial_plataforma.md`)
   - Registro de Decisão de Arquitetura (`docs/adr/ADR-XXX.md`)
   - Histórico de Mudanças (`CHANGELOG.md`)
   - Índice Geral (`docs/INDEX.md`)
   - Guia de Implementação (`Walkthrough`)
   - Termo de Encerramento (`Closure Report`)

Nenhuma alteração arquitetural poderá ser iniciada ou homologada sem a aprovação prévia de sua respectiva RFC.

Status Arquitetural: `RFC_PROCESS = MANDATORY` & `GOVERNANCE = ACTIVE`.

---

## 113. Termo de Encerramento e Consolidação da Estrutura de Governança

A partir de 09/08/2026, a estrutura de governança da Plataforma Coffee++ é considerada **oficialmente completa, estável e madura**.

### Diretrizes Mandatórias de Consolidação:
1. **Conclusão do Framework de Governança**: Fica vedada a criação de novos documentos permanentes ou frameworks paralelos de governança, salvo por necessidade técnica formalmente justificada e aprovada via RFC.
2. **Fluxo Institucional Obrigatório**: Toda nova funcionalidade ou expansão da plataforma deverá obrigatoriamente seguir o fluxo institucional padronizado:  
   `RFC → Discovery → Documento Funcional → Arquitetura → Plano de Implementação → Desenvolvimento → Walkthrough → Homologação → Atualização da Baseline → Atualização do CHANGELOG`.
3. **Proibição de Processos Paralelos**: É proibida a criação de processos paralelos, informais ou ad-hoc de documentação ou governança.
4. **Foco na Evolução Funcional**: O objetivo prioritário da engenharia passa a ser o desenvolvimento e a entrega de valor através de funcionalidades de negócio (**Business Features**), reutilizando integralmente a infraestrutura de governança e arquitetura protegida existentes.
5. **Justificativa prévia via RFC**: Qualquer proposta que introduza novos padrões arquiteturais deverá justificar rigorosamente a necessidade técnica em uma RFC aprovada antes do início de qualquer código.

Status da Plataforma: `GOVERNANCE_FRAMEWORK = COMPLETE` \| `ARCHITECTURE_GOVERNANCE = STABLE` \| `NEXT_PRIORITY = BUSINESS_FEATURES`.

---

## 114. Princípio da Proporcionalidade da Governança

A partir de 09/08/2026, a Plataforma Coffee++ adota oficialmente o **Princípio da Proporcionalidade da Governança**, visando eliminar burocracia desnecessária em alterações de baixo risco e acelerar a entrega contínua de valor ao negócio (**Business Features**).

### Classificação e Fluxos Obrigatórios:

1. **Fluxo Completo de Governança (Alto Impacto / Risco Arquitetural)**:  
   `RFC → Discovery → Documento Funcional → Arquitetura → Plano de Implementação → Desenvolvimento → Walkthrough → Homologação → Atualização da Baseline → Atualização do CHANGELOG`  
   **Obrigatório EXCLUSIVAMENTE para alterações que envolvam**:
   - Arquitetura global da plataforma;
   - Baselines Oficiais Homologadas;
   - Arquitetura Protegida (`Protected Architecture`);
   - `CommercialDomainService`, `CommercialDomainRepository` ou `CommercialDomainCache`;
   - Estruturas de Fonte Única de Verdade (SSOT);
   - APIs públicas e contratos de comunicação;
   - Schema do banco de dados (tabelas, colunas, RLS, triggers, migrations);
   - Motores analíticos (`AnalyticsEngine`, `ForecastEngine`, `SimulationEngine`, etc.);
   - Infraestrutura de segurança, autenticação e RLS;
   - Componentes compartilhados do core da aplicação.

2. **Fluxo Simplificado (Baixo Impacto / Manutenção e UX)**:  
   `Desenvolvimento → Testes → Homologação → Atualização do CHANGELOG (quando aplicável)`  
   **Permitido para**:
   - Correções de bugs pontuais;
   - Ajustes visuais, CSS e refinamentos estéticos;
   - Melhorias de interface e usabilidade (UX/UI);
   - Refatorações internas de código sem alteração de comportamento;
   - Otimizações locais de performance sem alteração arquitetural;
   - Ajustes de textos, rótulos, posicionamento de filtros e layouts responsivos.

### Regras de Aplicação:
- **Vedação de RFCs Desnecessárias**: É expressamente proibido abrir RFCs ou criar documentação arquitetural pesada para mudanças que não alterem a arquitetura oficial da plataforma.
- **Regra de Desempate por Menor Risco**: Em caso de dúvida sobre a classificação de uma demanda, prevalecerá o menor nível de governança compatível com o risco real da alteração.
- **Imutabilidade das Baselines Protegidas**: O uso do fluxo simplificado NÃO isenta nenhuma alteração do cumprimento estrito de todas as baselines protegidas, RLS, integridade financeira e testes automatizados (`npm run test:domain`, `npx tsc --noEmit`).

Status da Governança: `PROPORTIONAL_GOVERNANCE = ACTIVE` \| `RISK_BASED_WORKFLOW = ENFORCED`.

---

## Disposição Final

O `AGENTS.md` constitui a referência oficial de arquitetura, governança e padrões permanentes da Plataforma Coffee++.

Sua atualização deverá ocorrer exclusivamente quando houver necessidade de registrar decisões arquiteturais permanentes, novas políticas institucionais ou alterações estruturais da plataforma.

Todo conteúdo de natureza transitória, incluindo Releases, Walkthroughs Técnicos, Relatórios de Homologação, Hotfixes, ajustes de UX/UI, otimizações, evidências de compilação ou validações operacionais, deverá permanecer em sua documentação específica, preservando o `AGENTS.md` como um documento enxuto, perene e de alta confiabilidade.

Esta disposição passa a integrar permanentemente a política de governança documental da Plataforma Coffee++.

Status: `POLÍTICA PERMANENTE` | `SITUAÇÃO = LOCKED & CONFIRMED`.

---

## 70. Baseline Oficial — Governança da DRE Comercial / P&L Vertical Executivo

A partir de 10/08/2026, a arquitetura, estrutura visual e regras de integridade do **P&L Vertical Executivo da DRE Comercial** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **P&L Vertical Executivo**: A apresentação da DRE Comercial (`/inovacoes/dre`) é padronizada como uma demonstração sequencial em tabela vertical composta por 21 linhas de resultado e indicadores de margem.
2. **Separação Rígida entre MACO Core e Despesas Operacionais**:
   - `MACO CORE` = Camada final do DRE Comercial Core (`Receita Comercial Líquida - Impostos - CPV - Frete (3%) - Investimento Comercial`).
   - `Despesa Pessoal` (Linha 14) e `Marketing` (Linha 15) = Despesas pertencentes à camada posterior do P&L.
   - **É expressamente proibido** subtrair Despesa Pessoal ou Marketing do MACO Core ou alterar a fórmula do MACO.
3. **Identificação Transparente da Fonte de Dados**:
   - Módulo DRE Core (Supabase / Views): Badge **`Oficial`** (Verde).
   - Despesas Operacionais Auditadas (`dre gerencial 06-08-26 julho_oficial.xlsx`): Badge **`Planilha Cia`** (Âmbar).
   - Períodos sem fonte auditada: Exibição **`—`** com badge **`N/D`** (sem rateios, estimativas ou interpolações).
4. **Valores de Controle Homologados**:
   - **Julho/2026**:
     - Receita Comercial Líquida: `R$ 9.779.467,88`
     - CPV (Custo de Produtos): `R$ 4.471.167,68`
     - Frete & Logística (3%): `R$ 293.384,04`
     - Investimento Comercial: `R$ 1.058,72`
     - **MACO Core**: `R$ 3.511.444,83` (35,91% NS)
     - Despesa Pessoal: `R$ 733.385,18` (7,50% NS)
     - Marketing: `R$ 298.216,94` (3,05% NS)
   - **Junho/2026 (Baseline)**:
     - **MACO Baseline**: `R$ 1.129.479,61`
     - Despesa Pessoal: `R$ 763.342,58` (9,27% NS)
     - Marketing: `R$ 285.497,92` (3,47% NS)
5. **Preservação de Dimensões e Autonomia**: As 6 dimensões oficiais (`Por Cliente`, `Por Rede`, `Por Gerente`, `Por Região/UF`, `Por Canal`, `Por SKU`) permanecem intocadas e 100% funcionais.

Status Arquitetural: `DRE_CORE = LOCKED` & `BASELINE = PERMANENT` & `P&L_VERTICAL = HOMOLOGATED`.

---

## 71. Baseline Oficial — Governança e Descontinuação Segura do DRE Legado

A partir de 10/08/2026, a política de governança e descontinuação do módulo **DRE Legado (`/dre`)** torna-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Classificação do Módulo**: O módulo `/dre` (`/dre`, `/dre/historico`, `/dre/rede`) é classificado oficialmente como **DRE LEGADO/HISTÓRICO**.
2. **Limite da Fonte Legada**: A tabela `public.cm_dre_financeiro` é uma estrutura estática cujo histórico possui registros exclusivamente até **Maio/2026**.
3. **Proibição de Zeros Fictícios**: É expressamente proibido apresentar zeros como resultados financeiros válidos nas rotas legadas para períodos posteriores a Maio/2026 quando a fonte legada não contiver dados.
4. **Comportamento Oficial por Rota**:
   - `/dre`: Para períodos posteriores a Maio/2026, renderizar banner institucional de encerramento da fonte legada + botão direcionador `[ACESSAR DRE COMERCIAL]` para `/inovacoes/dre`.
   - `/dre/historico`: Exibir aviso de encerramento da fonte e apresentar células sem dados pós-Maio/2026 marcadas claramente como **`N/D`**.
   - `/dre/rede`: Para períodos sem dados na fonte legada, renderizar banner institucional de aviso + botão direcionador `[ACESSAR DRE COMERCIAL]` para `/inovacoes/dre`.
5. **Módulo Oficial de Referência**: O módulo `/inovacoes/dre` (DRE Comercial) é a única interface oficial e homologada para consulta de resultados atuais e em tempo real.
6. **Single Source of Truth**: O `/inovacoes/dre` consome o DRE Core / `AnalyticsEngine`, permanecendo como a Fonte Única de Verdade da DRE Comercial.
7. **Proibição de Carga Automática / Workarounds**: É proibido reativar `cm_dre_financeiro` como fonte atual ou preencher períodos ausentes com zeros, estimativas, rateios ou interpolações.
8. **Preservação de Baselines**: A descontinuação do `/dre` legado não altera `DRE_CORE = LOCKED`, `DRE_BASELINE = PERMANENT`, `FINANCIAL_FORMULAS = UNCHANGED` ou qualquer dado no banco (`DATABASE_MODIFIED = NONE`).
9. **Independência Arquitetural**: Qualquer futura migração do `/dre` para a `AnalyticsEngine` deverá ser tratada como alteração arquitetural independente e submetida a nova homologação formal.

Status Arquitetural: `LEGACY_DRE_DEPRECATION = LOCKED` & `SINGLE_SOURCE_OF_TRUTH = /inovacoes/dre` & `BASELINE = CONFIRMED`.

---

## 72. Baseline Oficial — DRE Comercial / P&L Vertical — Encerramento e Fonte Oficial

A partir de 10/08/2026, a consolidação final da arquitetura, fontes de dados e baselines da **DRE Comercial** torna-se baseline permanente e oficial do Coffee++.

### 1. Fonte Oficial
- `/inovacoes/dre` = DRE Comercial Oficial.
- `AnalyticsEngine.getDreComercial()` = fonte oficial dos indicadores do DRE Comercial.
- `public.cm_dre_financeiro` = fonte legada/histórica, encerrada para períodos posteriores a Maio/2026.

### 2. DRE Legado
- As rotas `/dre`, `/dre/historico` e `/dre/rede` são classificadas como **DRE LEGADO / HISTÓRICO**.
- A fonte `public.cm_dre_financeiro` possui dados históricos somente até Maio/2026.
- É proibido interpretar ou apresentar ausência de registros pós-Maio/2026 como resultado financeiro igual a zero.
- Para períodos posteriores a Maio/2026:
  - `/dre` direciona o usuário para `/inovacoes/dre`;
  - `/dre/historico` apresenta `N/D` quando não houver fonte legada;
  - `/dre/rede` informa a indisponibilidade da fonte legada e direciona para `/inovacoes/dre`.

### 3. P&L Vertical Executivo
- O P&L Vertical da DRE Comercial permanece homologado e congelado como baseline.
- As despesas operacionais externas auditadas possuem fonte explicitamente identificada:
  - **Despesa Pessoal**: Jul/2026: R$ 733.385,18 | Jun/2026: R$ 763.342,58 (Fonte: Planilha Cia)
  - **Marketing**: Jul/2026: R$ 298.216,94 | Jun/2026: R$ 285.497,92 (Fonte: Planilha Cia)
- Essas despesas pertencem à camada posterior ao MACO e **NÃO devem ser subtraídas do MACO Core**.

### 4. Indicadores Financeiros Protegidos
Os seguintes indicadores permanecem imutáveis:
- Receita Comercial Líquida Jul/2026: R$ 9.779.467,88
- CPV Jul/2026: R$ 4.471.167,68
- Frete Jul/2026: R$ 293.384,04
- Investimento Comercial Jul/2026: R$ 1.058,72
- MACO Core Jul/2026: R$ 3.511.444,83
- MACO Baseline Jun/2026: R$ 1.129.479,61

### 5. Governança
Qualquer alteração futura em fonte do DRE, fórmula financeira, classificação gerencial, P&L Vertical, integração de despesas operacionais ou substituição da fonte legada deve ser tratada como **nova implementação controlada**, com auditoria de paridade antes da homologação. É proibida qualquer alteração direta no DRE Core para solucionar limitações da fonte legada.

Status Arquitetural: `DRE_CORE = LOCKED` & `DRE_BASELINE = PERMANENT` & `P&L_VERTICAL = HOMOLOGATED` & `DRE_LEGADO = HISTÓRICO / DESCONTINUADO` & `FINANCIAL_FORMULAS = UNCHANGED` & `DATABASE = UNCHANGED`.

---

## 115. Baseline Oficial — Autorização e Gravação de Gerentes Restritos na RPS

A partir de 10/08/2026, a arquitetura e a governança de autorização no módulo RPS (`/processo-comercial/rps` e `POST /api/processo-comercial/rps`) tornam-se baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Escopo de Carteira**: Gerentes com perfil restrito (`isRestricted = true`) visualizam e alteram exclusivamente sua própria carteira.
2. **Edição Restrita à Semana Corrente**: Gerentes restritos possuem autorização para alterar e salvar exclusivamente a **semana corrente** (`serverTodayStr`).
3. **Janela Temporal Oficial**: A janela de edição para gerentes restritos encerra-se impreterivelmente às **15:00 da segunda-feira**, utilizando exclusivamente o horário do servidor em `America/Sao_Paulo`.
4. **Resiliência do Payload Frontend**: O frontend envia o payload completo com todas as semanas do mês. Semanas não correntes com valores mantidos (idênticos ao banco de dados) são aceitas e ignoradas na gravação.
5. **Bloqueio de Alteração de Semana Não Corrente (HTTP 403)**: Qualquer tentativa de alteração efetiva em semana que não seja a semana corrente resulta em `HTTP 403 Forbidden`.
6. **Bloqueio de Carteira de Outro Gerente (HTTP 403)**: Qualquer tentativa por usuário restrito de alterar carteira de outro gerente resulta em `HTTP 403 Forbidden`.
7. **Escrita Controlada (`rowsToUpsert`)**: O `rowsToUpsert` para gerentes restritos persiste exclusivamente registros da semana corrente.
8. **Perfis Administrativos Sem Restrição**: Administradores (`Admin`, `Admin Master`, `Gerente Nacional`, `CEO`, `Diretor`) mantêm permissão total sobre todas as carteiras e semanas.
9. **Identificação Oficial SSOT**: É expressamente proibida a criação de exceções ou hardcodes de nomes. A autorização baseia-se unicamente em:
   `requireAuth() → requireApprovedProfile() → profile.manager_name → resolveCanonicalManager() → isSameManager()`.

### Homologação dos 6 Cenários Mandatórios:
- **Cenário A** (alteração apenas na semana corrente): `HTTP 200`
- **Cenário B** (payload completo com semanas não correntes intocadas): `HTTP 200` (upsert exclusivo da semana corrente)
- **Cenário C** (alteração em semana não corrente): `HTTP 403`
- **Cenário D** (alteração na carteira de outro gerente): `HTTP 403`
- **Cenário E** (salvamento após cutoff de 15:00 de segunda-feira): `HTTP 403`
- **Cenário F** (Admin / Admin Master / Gerente Nacional): `HTTP 200` (sem restrição de carteira/semana)

### Validação de Qualidade:
- `npx tsc --noEmit`: 0 erros
- `npm run build`: aprovado
- `scripts/test-rps-scenarios.ts`: 6/6 cenários aprovados

Status Arquitetural: `RPS_RESTRICTED_MANAGER_AUTHORIZATION = LOCKED` & `BASELINE = CONFIRMED`.



































