# ADR-008: Domínio Comercial Unificado (Single Source of Truth)

- **Status**: `ACCEPTED` (Homologado Definitivamente)
- **Data**: 09/08/2026
- **Decisores**: Arquitetura Coffee++, Governança Comercial

---

## 1. Contexto

A plataforma Coffee++ cresceu integrando múltiplos módulos comerciais (Atendimento, Cadastro Mestre, Vendas, Metas, RPS, RDM, Investimentos, Governança e Analytics). Historicamente, diferentes módulos continham listas locais hardcoded ou tratavam autonomamente mapeamentos de canais, gerentes e UFs.

Isso gerou anomalias operacionais como:
- Clientes visíveis no Cadastro Mestre que não apareciam no Atendimento ou Vendas;
- Entidades duplicadas (ex.: "Distribuidor" e "DISTRIBUICAO");
- Segmentos comerciais (ex.: "Supermercado") tratados como canais isolados;
- Incompatibilidade de filtros entre relatórios do Dashboard e telas operacionais.

---

## 2. Problema

A ausência de uma **Fonte Única de Verdade (Single Source of Truth - SSOT)** para o cadastro comercial exigia sincronizações manuais, causava divergências de dados entre módulos e violava a governança de cadastros da plataforma.

---

## 3. Decisão Arquitetural

Fica estabelecido que:

1. **Centralização no Cadastro Mestre**: O Cadastro Mestre Comercial (`cm_domain_*` e `cm_clientes`) torna-se a ÚNICA fonte oficial de dados comerciais da plataforma Coffee++.
2. **Fachada Única Exclusiva**: É instituído o `CommercialDomainService` (`src/lib/domain`) como fachada pública obrigatória para leitura de Canais, Segmentos, Status, Unidades de Negócio, Regionais, Roles, Gerentes, UFs e Filtros Globais.
3. **Arquitetura em 4 Camadas**:
   `UI / Consumidores → CommercialDomainService → CommercialDomainRepository → Cache → Supabase`
4. **Política de Não-Duplicação**:
   - Redes Comerciais reutilizam a tabela oficial `cm_redes_matrizes` (Decisão DA1).
   - Estados/UFs reutilizam a estrutura oficial `manager_uf_mapping` (Decisão DA2).

---

## 4. Consequências

- **Positivas**:
  - Eliminação definitiva de clientes "invisíveis" ou divergentes entre telas.
  - Sincronização automática em tempo real entre Atendimento, Cadastro, Vendas, Metas, RPS, RDM e Investimentos.
  - Filtros universais alinhados que não perdem opções comerciais em meses sem faturamento.
  - Manutenção centralizada: novos canais ou gerentes cadastrados no banco refletem instantaneamente em toda a plataforma.
- **Negativas / Riscos Mitigados**:
  - Exige rigor absoluto de engenharia para evitar o retorno de hardcodes ou listas manuais em novos módulos (mitigado pela suíte de saúde `npm run test:domain`).

---

## 5. Restrições e Regras Obrigatórias

1. **Proibição de Hardcodes**: Fica estritamente proibido criar arrays locais, enums, constantes, switch/case, if ou fallbacks textuais contendo dados comerciais (`KA_MANAGERS`, `CHANNELS`, `MANAGERS_LIST`, etc.).
2. **Proibição de Consultas Locais para Filtros**: Telas e componentes UI não podem consultar o banco diretamente para construir dropdowns comerciais.
3. **Consultas em APIs**: APIs não podem declarar arrays ou filtros manuais de gerentes ou canais.
4. **Suíte de Saúde Obrigatória**: Toda esteira de CI/CD e release deve validar aprovação em `npm run test:domain`.

---

## 6. Impacto para Futuras Fases

Toda e qualquer nova funcionalidade ou módulo comercial criado na Plataforma Coffee++ (como novas fases do Sistema Inovações, CRM Prescritivo, Cockpit, etc.) DEVE obrigatoriamente consumir o `CommercialDomainService` a partir de sua concepção inicial.

---

## 7. Evolução Controlada

A partir de 09/08/2026, com a aprovação da **Protected Architecture (`COMMERCIAL_DOMAIN_UNIFIED = PROTECTED`)**, fica estabelecido que:

1. Futuras alterações ou expansões no Domínio Comercial somente poderão ocorrer mediante **RFC aprovada** pelo conselho de arquitetura.
2. É exigida a atualização simultânea do `AGENTS.md`, `baseline_oficial_plataforma.md`, `CHANGELOG.md` e `protected_architecture.md`.
3. Qualquer alteração deve obrigatoriamente manter 100% de aprovação na auditoria automatizada `npm run test:domain`.
4. Homologação formal com 0 regressões é requisito prévio e impeditivo para merge em ambiente de produção.
