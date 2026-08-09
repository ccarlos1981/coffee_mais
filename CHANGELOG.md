# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.4] - 2026-08-09

### Fixed
- **Config Financeiro Channel SSOT Resolution (SOLVED & HOMOLOGATED)**:
  - Integrada a fachada de resolução oficial `CommercialDomainService.resolveChannel()` em `src/app/config-financeiro/cadastro/page.tsx` (`buscarPorCodigoDirect`).
  - **Mapeamento de Canais Legados Operacionais**: Canais operacionais legados (como `"CONVENIENCIA"` no `PDV06`) são resolvidos automaticamente para a chave do canal oficial correspondente do Domínio Comercial (`KA`).
  - **Exibição dos 10 Canais Oficiais**: Garante que os 10 canais oficiais (`KA`, `Distribuidor`, `Inside Sales`, `Inside Inter`, `Exportação`, `Marca Própria`, `E-commerce`, `Marketplace`, `Amazon 1P`, `Outros`) sejam exibidos no `<select>` do formulário com fallback defensivo.

---

## [1.5.3] - 2026-08-09

### Fixed
- **Config Financeiro Hybrid Code Resolution (SOLVED & HOMOLOGATED)**:
  - Implementada resolução híbrida em `src/app/config-financeiro/cadastro/page.tsx` (`buscarPorCodigoDirect`).
  - **Suporte Híbrido a Códigos Alfanuméricos e Numéricos**: Códigos numéricos consultam `cm_clientes.codigo` enquanto códigos alfanuméricos (ex: `PDV06`) consultam `public.base_atendimento.cod_parceiro`.
  - **Eliminação de Cast `NaN`**: Eliminado o parsing numérico forçado `parseInt(code)` que impedia a busca de parceiros alfanuméricos.
  - **Validação de PDV06**: Homologada a busca direta `/config-financeiro/cadastro?codigo=PDV06` com preenchimento completo do formulário do cliente `HIROTA CONVENIENCIA SP` (`HIROTA`).

---

## [1.5.2] - 2026-08-09

### Fixed
- **Atendimento Paginated Fetch & SOST Visibility (SOLVED & HOMOLOGATED)**:
  - Implementado carregamento paginado em `src/app/atendimento/page.tsx` via `.range(from, to)` em lotes sequenciais de 1.000 registros, eliminando o limite REST de truncação do PostgREST.
  - **Visibilidade Integral dos 2.343 PDVs**: Garantido carregamento de 100% dos parceiros da `base_atendimento` (do início ao fim do alfabeto), restaurando a visibilidade completa dos distribuidores e parceiros após a letra G.
  - **Distribuidor SOST (`212424`)**: Homologada a busca e exibição do SOST COMERCIAL (`212424` / `Dist Sost` / `Luiz`) na grid e no filtro `Canal = Distribuidor`.
  - **7 Distribuidores Oficiais Validados**: Confirmada a visibilidade dos 7 distribuidores homologados (`212424`, `185369`, `147201`, `221911`, `221912`, `118143`, `114527`).

---

## [1.5.1] - 2026-08-09

### Fixed
- **Atendimento Data Integrity (COMPLETED & HOMOLOGATED)**:
  - Sincronizada a tabela `public.base_atendimento` com o Cadastro Único SSOT (`cm_redes_matrizes` e `OFFICIAL_COMMERCIAL_ROLES`).
  - **BRASSOL**: Inseridos os registros ausentes `221911` e `221912` vinculados à rede BRASSOL, canal Distribuidor e gerente John Guedes.
  - **Distribuidores Homologados**: Alinhados todos os 7 distribuidores oficiais (`212424`, `185369`, `147201`, `221911`, `221912`, `118143`, `114527`) para `canal = 'Distribuidor'`.
  - **EPA PLUS GUTIERREZ (PDV07)**: Alinhado o canal para `KA` e gerente `Luiz`, em consonância com a Rede `EPA` em `cm_redes_matrizes`.
  - **Zero Hardcodes**: Zero condicionais de string, zero workarounds na UI, 100% de integridade fundamentada nas fontes oficiais de cadastro.

---

## [1.5.0] - 2026-08-09

### Added
- **Feature A — Follow-up Comercial Inteligente (COMPLETED & HOMOLOGATED)**:
  - **Central Operacional `/processo-comercial/follow-up`**: Interface executiva completa com 7 KPI Cards (Ações Abertas, Concluídas, Atrasadas, Taxa de Conclusão %, Clientes Recuperados, Taxa de Efetividade %, Faturamento Recuperado R$), FilterBar operado via `CommercialDomainService` SSOT, Grid de Ações com paginação e badges de atraso do backend.
  - **CRUD & Lifecycle State Machine (`FollowUpService`)**: Gestão de ciclo de vida de ações (`PENDENTE` → `EM_ANDAMENTO` → `CONCLUIDA` / `NAO_EFETIVA` / `CANCELADA`), obrigatoriedade de resultado e motivo, reabertura restrita a Administradores e registro de timeline em `cm_follow_up_history` com auditoria via `logAuditAction()`.
  - **Efetividade Comercial Oficial (AnalyticsEngine V1)**:
    - **Elegibilidade Histórica**: Calculada na data de criação da ação via `cm_faturamento.dt_faturamento` ($\text{dias} > 90$).
    - **Cliente Recuperado**: Ação concluída com elegibilidade comprovada e nova compra faturada nas fontes oficiais (`cm_faturamento` com TOPs permitidas) dentro da janela estrita de 30 dias corridos pós-conclusão (`[concluded_at, concluded_at + 30d]`).
    - **Faturamento Recuperado**: Soma da receita líquida oficial (`vlr_total_liq`) das NFes válidas dos clientes recuperados. Fórmulas 100% read-only consumindo o `AnalyticsEngine V1`; campos digitados pelo usuário são ignorados para métricas financeiras.
    - **Máquina Anti-Duplicidade por NFe**: Atribuição determinística de cada NFe ao Follow-up concluído mais recente (`ROW_NUMBER() OVER (PARTITION BY f.id ORDER BY concluded_date DESC)`), impedindo dupla contagem de receita.
  - **Integração com Feature 6 & Feature 7**:
    - **Feature 6 (Cockpit Prescritivo — `/inovacoes/crm`)**: Adicionado botão `Gerar Follow-up` no `CrmClienteDrawer.tsx` com pré-preenchimento do cliente e origem `COCKPIT_PRESCRITIVO`.
    - **Feature 7 (Ranking de Performance — `/ranking-gerentes`)**: Adicionado botão `Gerar Follow-up` no `ManagerDrawer.tsx` com pré-preenchimento do gerente e origem `RANKING_PERFORMANCE`.
  - **Autocomplete de Clientes**: API `/api/clientes/search` para busca incremental de clientes no cadastro mestre sem expor Supabase ao React.
  - **Auditoria & Suíte de Saúde**: Incorporadas as suítes T8 (`FollowUpService`) e T9 (`AnalyticsEngine` Efetividade) ao `scripts/health-commercial-domain.ts` com 20/20 testes automatizados aprovados.

---

## [1.4.0] - 2026-08-09

### Added
- **Feature 7 — Ranking Dinâmico de Performance de Gerentes de Campo**: Dashboard executivo de performance dos Gerentes de Campo com Score 0–100 baseado em 5 dimensões (Resultado Financeiro 35%, Crescimento 25%, Saúde da Carteira 20%, Frequência 10%, Consistência 10%), normalização relativa à equipe ativa, classificação de Status (Top Performer / Consistente / Atenção / Crítico), Tendência (Em Evolução / Estável / Em Queda) e Data Quality.
- **Página `/ranking-gerentes` com FilterBar, KPI Cards e Ranking Grid**: Interface responsiva com filtros por gerente, UF e canal (via CommercialDomainService SSOT), 4 KPI Cards derivados do mesmo dataset da Grid e tabela ordenada por Score de Performance.
- **Drawer de Detalhamento 360° do Gerente**: Painel lateral com Radar SVG das 5 dimensões, evolução mensal (barras Rolling 3M), Top 10 clientes, clientes sem compra, concentração Top 3 com nomes e participação, e ações sugeridas derivadas do status/métricas.
- **Backend**: `ManagerPerformanceScoreService` (serviço puro de Score), `AnalyticsEngine.getManagerPerformanceRanking()`, `AnalyticsEngine.getManagerPerformanceDetail()`, `GET /api/ranking-gerentes` e `GET /api/ranking-gerentes/[managerId]`.

---

## [1.3.0] - 2026-08-09

### Added
- **Feature 1 — Visualizador de Tendência Diária de Vendas (Run Rate)**: Aprimorado o módulo de Análise Diária (`/dia`) e o handler HTTP `GET /api/dashboard/daily` para cálculo automático no backend da projeção de fechamento mensal (`Run Rate`), média diária realizada (R$/dia) e contagem de dias decorridos vs restantes.
- **Painel Executivo de Pace Diário (`/dia`)**: Adicionados 4 KPI Cards responsivos exibindo Realizado no Mês, Projeção de Fechamento (Run Rate), Média Diária Realizada e Volume em Unidades.

---

## [1.2.0] - 2026-08-09

### Added
- **Feature 6 — Cockpit Prescritivo de Pedidos Faltantes & Sugestão de Reposição**: Implementado motor prescritivo comercial desacoplado (`OpportunityRecommendationService`) com cálculo do Score Multi-Dimensional de Oportunidade (0 a 100).
- **Central de Decisão Comercial 360° (`CrmClienteDrawer`)**: Interface executiva para análise de perfil do cliente com diagnóstico de atraso, score de criticidade, gráfico/tabela da evolução do faturamento mensal, histórico dos últimos 3 pedidos e justificativa acionável.
- **Sugestão de Reposição por SKU com Conversão Física (UN / CX / KG)**: Tabela de SKUs com visão tripla de caixas e peso, preço unitário, valor subtotal em R$ e % de participação no mix histórico.
- **Cópia Formatada para WhatsApp com 1-Clique**: Gerador automático de mensagem pronta para envio ao cliente com dados do pedido, embalagens e totais.
- **Extensibilidade de Ações Comerciais**: Slots preparados para acionamento direto de geração de PDF Proposta, envio por E-mail, log em CRM e agendamento de Follow-up.
- **Backend Analytics Integration**: API read-only `GET /api/inovacoes/crm` desacoplada consumindo `AnalyticsEngine` como SSOT e `CommercialDomainService` para opções de filtros sem hardcodes.

---

## [1.1.0] - 2026-08-09

### Added
- **Princípio da Proporcionalidade da Governança**: Institucionalizada a segregação entre o Fluxo Completo de Governança (alterações estruturais e arquiteturais) e o Fluxo Simplificado (bugs, UX/UI, refatorações locais), direcionando o foco da engenharia para entregas contínuas de valor.
- **Protected Architecture**: Institucionalizada a proteção arquitetural permanente (`COMMERCIAL_DOMAIN_UNIFIED = PROTECTED`) sobre o `CommercialDomainService`, com auditoria estática contra bypass em `npm run test:domain`.
- **Domínio Comercial Unificado (SSOT)**: Institucionalizado o `CommercialDomainService` (`src/lib/domain`) como a única fachada oficial do domínio comercial da plataforma Coffee++.
- **Commercial Master Data Tables**: Criadas 8 tabelas de domínio configuráveis (`cm_domain_channels`, `cm_domain_segments`, `cm_domain_status`, `cm_domain_business_units`, `cm_domain_regions`, `cm_domain_roles`, `cm_domain_normalization_rules`, `cm_domain_version`).
- **Suíte de Saúde do Domínio**: Integrado script automatizado de auditoria estática e dinâmica `npm run test:domain` (`scripts/health-commercial-domain.ts`).

### Changed
- **Consumo Único de Domínio**: Módulos Atendimento, Cadastro Mestre, Vendas, Metas, RPS, RDM, Investimentos, Governança e Analytics migrados para consumir exclusivamente a fachada `CommercialDomainService`.
- **Analytics Engine**: `AnalyticsEngine.getGlobalFilterData()` atualizado para incorporar opções de domínio configuráveis com fallback para garantir alinhamento universal de filtros.

### Fixed
- **Eliminação Total de Hardcodes**: Removidas todas as constantes estáticas (`MANAGERS_LIST`, `CHANNELS_LIST`, `MANAGER_NAME_TO_ID`, `STANDALONE_CHANNEL_MANAGERS`, `KA_MANAGERS`, `ALL_MANAGERS`, `OFFICIAL_MANAGERS`) e condicionais hardcoded em telas e APIs.

---

## [1.0.0] - 2026-07-19

### Added
- **Batch Import Engine v1.0.0**: Novo mecanismo oficial de persistência para o Hub de Importação.
- **Processamento em Batches**: Particionamento e promoção de registros da staging em lotes sequenciais parametrizados (lotes de 5.000).
- **Rollback Automático**: Reversão completa automática e remoção física de dados parciais em `cm_faturamento` e tabelas de controle sob falha em qualquer lote.
- **Telemetria de Progresso**: Gravação progressiva de porcentagens e status no `cm_sync_logs` para acompanhamento do usuário.
- **Novo Pipeline de Importação**: Fluxo desacoplado com tabelas de controle permanente (`cm_import_affected_partners`) para suporte serverless sem estado (stateless).

### Changed
- **Importação de Faturamento**: A confirmação de importações pelo Hub de Importação passa a consumir obrigatoriamente a estrutura particionada do BIE.
- **Orquestração**: A orquestração das fatias de dados foi centralizada e transferida inteiramente do banco de dados (monolítico) para o backend TypeScript/Next.js.

### Deprecated
- A antiga RPC monolítica `confirmar_importacao_faturamento(...)` foi descontinuada e desativada da aplicação por apresentar limitação estrutural de timeout.

### Removed
- Nenhum componente ou tabela foi removido fisicamente nesta versão para preservar compatibilidade retrospectiva de migrations.
