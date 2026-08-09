# Protected Architecture — Contrato Arquitetural Permanente (Coffee++)

> **Status**: `ACTIVE & ENFORCED`  
> **Escopo**: Domínio Comercial Unificado (`COMMERCIAL_DOMAIN_UNIFIED`)  
> **Última Atualização**: 09/08/2026

---

## 1. Objetivo

A **Protected Architecture** (Arquitetura Protegida) institui barreiras de engenharia invioláveis sobre componentes críticos da Plataforma Coffee++, prevenindo regressões, bypasses, criação de caches paralelos ou reintrodução de hardcodes em ciclos de desenvolvimento futuros.

---

## 2. Princípios Gerais

1. **Inviolabilidade do SSOT**: Dados de domínio comercial possuem uma única origem oficial no banco de dados e uma única fachada de acesso no código.
2. **Imutabilidade sem RFC**: Nenhum contrato protegido pode ser alterado ou contornado sem uma RFC formal aprovada.
3. **Fail-Fast Automático**: Qualquer violação a componentes protegidos resulta em reprovação automática na esteira de compilação e teste (`npm run test:domain`).
4. **Retrocompatibilidade Garantida**: Evoluções em componentes protegidos devem obrigatoriamente manter compatibilidade retroativa com todos os módulos consumidores ativos.

---

## 3. Componentes Protegidos

| Componente | Localização | Papel Arquitetural | Status |
|------------|-------------|--------------------|--------|
| **`CommercialDomainService`** | `src/lib/domain/commercial-domain-service.ts` | Fachada Única de Acesso | `PROTECTED` |
| **`CommercialDomainRepository`** | `src/lib/domain/commercial-domain-repository.ts` | Camada de Acesso a Dados | `PROTECTED` |
| **`CommercialDomainCache`** | `src/lib/domain/commercial-domain-cache.ts` | Infraestrutura de Cache | `PROTECTED` |
| **Domain Contracts** | `src/lib/domain/types.ts` | Contratos de Tipagem | `PROTECTED` |
| **Health Audit Suite** | `scripts/health-commercial-domain.ts` | Auditoria Estática e Dinâmica | `PROTECTED` |

---

## 4. Contratos Públicos Exclusivos

Toda aplicação deve interagir com o Domínio Comercial exclusivamente através dos métodos estáticos da fachada pública `CommercialDomainService`:

- **Canais**: `getChannels()`, `getChannelOptions()`, `resolveChannel()`, `isValidChannel()`, `getDefaultChannel()`
- **Segmentos**: `getSegments()`, `getSegmentOptions()`
- **Status**: `getStatuses()`, `getStatusOptions()`
- **Unidades de Negócio**: `getBusinessUnits()`
- **Regionais**: `getRegions()`, `getRegionOptions()`
- **Roles**: `getRoles()`, `getManagerRoles()`
- **Redes / Matrizes**: `getNetworks()`, `getNetworkOptions()` (abstrai `cm_redes_matrizes`)
- **Estados / UFs**: `getStates()`, `getStateOptions()` (abstrai `manager_uf_mapping`)
- **Gerentes**: `getManagerOptions()`, `getFieldManagerList()`, `getManagerList()`, `resolveManager()`, `isStandaloneChannelManager()`, `resolveManagerId()`
- **Normalização**: `getNormalizationRules()`, `normalizeLegacyValue()`
- **Filtros Globais**: `getFilterOptions()`
- **Cache & Versão**: `invalidateCache()`, `getDomainVersion()`

---

## 5. Restrições e Regras Obrigatórias

1. **Acesso Direto Bloqueado**: É proibido consultar tabelas físicas de domínio (`cm_domain_*`, `cm_redes_matrizes`, `manager_uf_mapping`) diretamente por componentes React, APIs HTTP ou cron jobs. Todo acesso a dados deve obrigatoriamente utilizar o `CommercialDomainRepository`.
2. **Proibição de Hardcodes**: É expressamente proibido declarar arrays locais, enums comerciais, dicionários textuais (`Record<string, string>`), switch/case ou fallbacks inline contendo nomes de canais, gerentes, UFs ou regionais.
3. **Proibição de Cache Paralelo**: Nenhum módulo pode instanciar estruturas próprias de cache para entidades do domínio comercial.
4. **Padronização Visual em Dropdowns**: Todos os elementos `<select>`, autocompletes e filtros comerciais em telas UI devem obrigatoriamente preencher suas opções a partir do `CommercialDomainService`.

---

## 6. Fluxo Oficial de Consumo

```
[ Interface UI / Dropdowns / Filtros / APIs ]
                    │
                    ▼
       [ CommercialDomainService ] (Fachada Única)
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
[ CommercialDomainCache ]  [ CommercialDomainRepository ]
  (TTL 10 min / SSOT)       (SQL / Supabase Admin)
                              │
                              ▼
                 [ Tabelas cm_domain_* ]
```

---

## 7. Critérios para Evolução Controlada

Qualquer alteração estrutural no Domínio Comercial exige obrigatoriamente:
1. Submissão de uma RFC detalhando os motivos e impactos técnicos.
2. Atualização da Baseline Oficial em `docs/governance/baseline_oficial_plataforma.md`.
3. Atualização do Registro de Decisão de Arquitetura (`docs/adr/ADR-008-Dominio-Comercial-Unificado.md`).
4. Registro de versão no `CHANGELOG.md`.
5. Validação com 0 falhas na suíte de testes (`npm run test:domain`).
6. Homologação formal do time de arquitetura.

---

## 8. Política de Compatibilidade Retroativa

- Adição de novos canais, segmentos ou campos é **permitida** via migration cadastral sem alteração de contrato.
- Depreciação de um canal ou gerente exige regra de normalização ativa em `cm_domain_normalization_rules` mapeando a chave legada para o id oficial.
- Quebra de contrato (mudança de nomes de métodos públicos) é **estritamente proibida** e será bloqueada nos testes estáticos de integração.
