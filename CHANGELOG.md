# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
