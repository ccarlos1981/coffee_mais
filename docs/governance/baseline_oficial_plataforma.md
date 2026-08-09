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
