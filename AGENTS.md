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

## 57. Baseline Oficial — Sistema Inovações Fase 2 — DRE Comercial

A partir de 26/07/2026, a arquitetura e a suíte de componentes do **Sistema Inovações Fase 2 — DRE Comercial** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Fonte Única de Verdade**: A DRE Comercial consome exclusivamente `AnalyticsEngine.getDreComercial(filters)`. É proibida qualquer regra financeira no frontend, na API ou em componentes React. Toda lógica financeira permanece centralizada na `AnalyticsEngine`.
2. **Fluxo Arquitetural Único**: Dados Oficiais → `AnalyticsEngine.getDreComercial(filters)` → API `GET /api/inovacoes/dre` → Interface `/inovacoes/dre`.
3. **Fontes Oficiais**: `vw_faturamento_comercial_oficial`, `cm_acoes_investimento`, `cm_clientes` e demais fontes homologadas pela `AnalyticsEngine`.
4. **Fórmula Oficial de MACO**: MACO = Receita Líquida − CPV − Impostos − Frete (3% fixo via `DRE_FRETE_PERCENTUAL`) − Investimento Comercial.
5. **Componentes Oficiais Congelados**: `DreFilterBar`, `DreResumoExecutivo`, `DreSinteticaCard`, `DreDimensionSelector` e `DreDimensionalGrid`.
6. **Auditoria Obrigatória**: Toda evolução da DRE Comercial deverá comprovar aprovação prévia em `npm run health:analytics`, `npx tsc --noEmit` e `npm run build` com 0 erros, 0 regressões e 0,0000% de desvio financeiro.

Status Arquitetural: `DRE_COMERCIAL = LOCKED` & `BASELINE = CONFIRMED`.

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
- **Seção 57**: Baseline Oficial — DRE Comercial (Fase 2) `[LOCKED & CONFIRMED]`
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



















