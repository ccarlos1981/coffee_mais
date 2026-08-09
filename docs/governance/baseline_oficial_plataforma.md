# Baseline Oficial da Plataforma Coffee++

> **Status Arquitetural**: `BASELINE_OFICIAL = CONFIRMED` & `COMMERCIAL_DOMAIN_UNIFIED = PROTECTED` & `PROTECTED_ARCHITECTURE = ENFORCED`  
> **Status de Governança**: `GOVERNANCE_FRAMEWORK = COMPLETE` | `ARCHITECTURE_GOVERNANCE = STABLE` | `PROPORTIONAL_GOVERNANCE = ACTIVE` | `NEXT_PRIORITY = BUSINESS_FEATURES`  
> **Última Atualização**: 09/08/2026

---

## Sumário Executivo

Este documento consolida os componentes oficiais da arquitetura da plataforma Coffee++. Toda evolução de engenharia DEVE respeitar estas baselines congeladas e protegidas.

---

## 1. Domínio Comercial Unificado (SSOT) — `COMMERCIAL_DOMAIN_UNIFIED = PROTECTED`

A partir de 09/08/2026, a arquitetura do **Domínio Comercial Unificado** e a fachada pública `CommercialDomainService` (`src/lib/domain`) tornam-se o **Contrato Arquitetural Permanente (Protected Architecture)** da plataforma Coffee++.

### Componentes Oficiais Congelados:
- **Fachada Única**: `CommercialDomainService`
- **Acesso a Dados**: `CommercialDomainRepository` (com abstração em memória de `cm_redes_matrizes` e `manager_uf_mapping`)
- **Cache**: `CommercialDomainCache` (TTL 10 min, invalidação por prefixo)
- **Contratos de Tipagem**: `src/lib/domain/types.ts`
- **Suíte de Saúde e Testes**: `scripts/health-commercial-domain.ts` (`npm run test:domain`)

### Diretrizes de Governança:
1. **Single Source of Truth**: O Cadastro Mestre Comercial em banco (`cm_domain_*` e `cm_clientes`) é a única fonte oficial de todos os cadastros comerciais.
2. **Fachada Exclusiva**: Nenhum componente ou API pode consultar diretamente tabelas de domínio para montar filtros ou manter arrays hardcoded de canais, gerentes, segmentos ou UFs.
3. **Paridade em Rede**: Analytics, RDM, RPS, Cadastro Mestre, Atendimento, Metas, Investimentos, Governança, Dashboard e novos módulos consomem exatamente a mesma fachada.

---

## 2. Baselines Anteriores Confirmadas

- **Seção 10**: Governança Financeira Oficial (`FINANCIAL_GOVERNANCE = LOCKED`)
- **Seção 14**: Analytics Engine V1 (`ANALYTICS_ENGINE_V1 = LOCKED`)
- **Seção 15**: Ordenação de Redes pelo Rolling FAT 3M (`REDES_RANKING_SORT = LOCKED`)
- **Seção 16**: Governança do Desafio por Rede (`DESAFIO_POR_REDE_GOVERNANCE = LOCKED`)
- **Seção 17**: Gestão de Logos e Carta de Anuência (`LOGOS_REDES_GOVERNANCE = LOCKED`)
- **Seção 55-60**: Sistema Inovações Fases 1, 2 e 3 (`SISTEMA_INOVACOES = LOCKED`)
- **Seção 61**: Centro de Inteligência Comercial (`COMMERCIAL_INTELLIGENCE = LOCKED`)
- **Seção 62**: Forecast Comercial (`FORECAST_COMERCIAL = LOCKED`)
- **Seção 63**: Simulador Comercial (`SIMULADOR_COMERCIAL = LOCKED`)
- **Seção 64**: Assistente Comercial (`COMMERCIAL_ASSISTANT = LOCKED`)
- **Seção 65**: Painel Presidência (`PRESIDENCY_PANEL = LOCKED`)
- **Seção 67**: Governança MCP (`MCP_GOVERNANCE = LOCKED`)
- **Feature A**: Follow-up Comercial Inteligente (`FEATURE_A_FOLLOW_UP = COMPLETED & HOMOLOGATED`)
- **Integridade Atendimento**: Integridade de PDVs e Cadastro Único (`ATENDIMENTO_DATA_INTEGRITY = COMPLETED & HOMOLOGATED`)
- **Paginação Atendimento**: Visibilidade Total de PDVs e SOST (`ATENDIMENTO_PAGINATION = SOLVED` & `SOST = VISIBLE_AND_HOMOLOGATED`)
- **Resolução de Código Financeiro**: Suporte Híbrido Alfanumérico / Numérico (`CONFIG_FINANCEIRO_PDV06 = SOLVED_AND_HOMOLOGATED` & `CODE_RESOLUTION_HYBRID = OPERATIONAL`)
- **Resolução de Canais Financeiro**: Resolução de Canais Legados via SSOT (`CONFIG_FINANCEIRO_CANAL = SOLVED_AND_HOMOLOGATED` & `COMMERCIAL_DOMAIN_UNIFIED = OPERATIONAL`)

---

## 3. Baseline Oficial — Feature A (Follow-up Comercial Inteligente)

A partir de 09/08/2026, a arquitetura e a suíte do **Follow-up Comercial Inteligente (Feature A)** tornam-se baseline oficial e homologado da plataforma Coffee++.

### Diretrizes Mandatórias:
1. **Single Source of Truth**: O `FollowUpService` (`src/lib/services/follow-up-service.ts`) concentra 100% da lógica de lifecycle, validação e auditoria do módulo.
2. **Camada Analítica Read-Only**: O cálculo de elegibilidade histórica (>90 dias na criação), Clientes Recuperados, Faturamento Recuperado e desduplicação por NFe consome exclusivamente o `AnalyticsEngine` (`AnalyticsEngine.getFollowUpEfetividadeAnalytics()`).
3. **Preservação de Fontes Oficiais**: Nenhuma fórmula financeira utiliza valores digitados pelo usuário. A apuração de receita consome exclusivamente a tabela física de vendas `cm_faturamento` com TOPs permitidas da Governança Financeira.
4. **Preservação da Protected Architecture**: `CommercialDomainService` permanece como SSOT de domínio comercial. Features 1, 6 e 7 permanecem intocadas em seus motores originais.
5. **Auditoria Contínua**: O comando `npm run test:domain` (incluindo as suítes T8 e T9) é obrigatório para validação de integridade.

Status Arquitetural: `FEATURE_A_FOLLOW_UP = COMPLETED & HOMOLOGATED` & `BASELINE = CONFIRMED`.

---

## 4. Baseline Oficial — Integridade da Base de Atendimento (Cadastro Único SSOT)

A partir de 09/08/2026, a base de dados do módulo de Atendimento (`public.base_atendimento`) encontra-se **100% alinhada e sincronizada** com o Cadastro Único de Redes (`cm_redes_matrizes`) e a estrutura de Commercial Roles (`OFFICIAL_COMMERCIAL_ROLES`).

### Diretrizes Mandatórias:
1. **Fidelidade ao SSOT**: A classificação de Canal e Gerente da base de atendimento deve refletir estritamente as regras e cadastros oficiais. É vedado qualquer hardcode na UI ou filtro de substring local.
2. **Distribuidores Homologados**: Os 7 parceiros distribuidores oficiais (`212424`, `185369`, `147201`, `221911`, `221912`, `118143`, `114527`) possuem obrigatoriamente a classificação `canal = 'Distribuidor'` no banco de dados.
3. **Rede EPA**: O PDV07 (`EPA PLUS GUTIERREZ`) herda obrigatoriamente a classificação `KA` e gerente `Luiz` da sua Rede mãe `EPA` (`cm_redes_matrizes`).

Status Arquitetural: `ATENDIMENTO_DATA_INTEGRITY = COMPLETED & HOMOLOGATED` & `BASELINE = CONFIRMED`.

---

## 5. Baseline Oficial — Paginação de Leitura do Módulo de Atendimento (`ATENDIMENTO_PAGINATION`)

A partir de 09/08/2026, a leitura da tabela `public.base_atendimento` no módulo `/atendimento` utiliza obrigatoriamente **carregamento paginado em lotes de backend** (`.range(from, to)`), evitando a truncação REST do limite de 1.000 registros do PostgREST.

### Diretrizes Mandatórias:
1. **Garantia de Visibilidade Total (2.343 PDVs)**: Toda consulta de carga de PDVs deve garantir que 100% da tabela seja recuperada para a memória frontend, assegurando visibilidade de parceiros em todo o espectro alfabético (de A a Z).
2. **Distribuidor SOST (`212424`)**: O distribuidor SOST COMERCIAL (`212424`) permanece como componente ativo e visível na grid e filtros do módulo.

Status Arquitetural: `ATENDIMENTO_PAGINATION = SOLVED` & `SOST = VISIBLE_AND_HOMOLOGATED` & `BASELINE = CONFIRMED`.

---

## 6. Baseline Oficial — Resolução Híbrida de Códigos e Canais Financeiros (`CODE_RESOLUTION_HYBRID` / `CONFIG_FINANCEIRO_CANAL`)

A partir de 09/08/2026, a busca de clientes pelo código e a resolução do canal no módulo `/config-financeiro/cadastro` (`buscarPorCodigoDirect`) consome obrigatoriamente a fachada do **Domínio Comercial Unificado**:

### Diretrizes Mandatórias:
1. **Suporte Híbrido de Chaves**: Códigos estritamente numéricos realizam busca indexada em `cm_clientes.codigo`, enquanto códigos alfanuméricos (ex: `PDV06`) realizam busca direta por `public.base_atendimento.cod_parceiro`.
2. **Resolução de Canais via SSOT**: Todo canal operacional carregado do cadastro (ex: `"CONVENIENCIA"` no `PDV06`) deve ser resolvido deterministicamente via `CommercialDomainService.resolveChannel()` para a chave do canal oficial do Domínio Comercial (ex: `KA`).
3. **Exibição dos 10 Canais Oficiais**: O dropdown de canal consome exclusivamente `CommercialDomainService.getChannelOptions()`, contendo os 10 canais homologados, acompanhado de guard defensivo fallback no JSX.

Status Arquitetural: `CONFIG_FINANCEIRO_CANAL = SOLVED_AND_HOMOLOGATED` & `CODE_RESOLUTION_HYBRID = OPERATIONAL` & `COMMERCIAL_DOMAIN_UNIFIED = OPERATIONAL` & `BASELINE = CONFIRMED`.





