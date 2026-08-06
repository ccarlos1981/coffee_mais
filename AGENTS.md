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

## 97. Baseline Oficial — Release 3 — Demanda 006 — Otimização do Layout do Dashboard de Vendas (/vendas)

A partir de 06/08/2026, a otimização visual do Dashboard de Vendas (`/vendas`) torna-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Ocultação Exclusiva de UI**: As colunas *Pace (Faturamento)*, *Venda Fut.*, *Fat + Venda Fut.* e *Pace (MaCo)* permanecem ocultadas exclusivamente na camada de renderização JSX, preservando 100% das fórmulas, cálculos, estados React e objetos computados em memória.
2. **Reaproveitamento de Área Útil**: A tabela principal desktop opera com 11 colunas e largura responsiva de 100%, eliminando scroll horizontal nas resoluções 1366×768, 1440×900, 1600×900 e 1920×1080 com zoom a 100%.
3. **Preservação de Motores e Contratos**: Fica proibida qualquer alteração em `AnalyticsEngine V1`, `ForecastEngine`, `SimulationEngine`, `CommercialIntelligenceEngine`, `CommercialAssistantEngine`, `commercial-structure.ts`, APIs, banco de dados ou arquivos de exportação em decorrência desta simplificação visual.
4. **Auditoria Obrigatória**: Nenhuma evolução do Dashboard de Vendas poderá ser submetida sem aprovação prévia em `npm run health:analytics`, `npx tsc --noEmit` e `npm run build` com 0 desvio financeiro.

Status Arquitetural: `RELEASE_3_DEMANDA_006 = LOCKED` & `BASELINE = CONFIRMED`.

































