# ADR-001 — Framework Corporativo de Apresentações (Presentation Framework)

**Status:** APPROVED  
**Data:** 29/07/2026  
**Autor:** Equipe de Arquitetura Coffee++  

---

## 1. Contexto e Objetivo

A plataforma Coffee++ demanda apresentações gerenciais e comerciais dinâmicas em múltiplos módulos (RDM, RPS, Analytics, Diretoria, Trade Marketing, Promotores, Financeiro, etc.).

O objetivo desta Architecture Decision Record (ADR-001) é instituir o **Framework Corporativo de Apresentações** como um componente desacoplado e reutilizável em toda a plataforma, substituindo abordagens engessadas e garantindo composição dinâmica via Widgets.

---

## 2. Decisões Arquiteturais Mandatórias

1. **Separação Rígida (Core vs React UI)**:
   - **`Presentation Core` (`src/lib/presentation-framework/core/`)**: 100% UI-agnóstico, sem qualquer dependência de React, Next.js ou DOM. Responsável por tipagens, contratos, registro OCP de widgets, layout engine, data provider, storage provider, versionamento e migração de schemas.
   - **`Presentation React` (`src/lib/presentation-framework/react/`)**: Camada de renderização UI contendo componentes React, custom slide renderers e widgets visuais.

2. **Arquitetura Baseada em Widgets**:
   - Todo slide é uma composição declarativa de Widgets independentes.
   - Templates são arranjos configurados de Widgets.

3. **Widget SDK como Contrato Oficial**:
   - Todo Widget implementa obrigatoriamente a interface `IWidgetSDK` (`id`, `name`, `version`, `icon`, `supportsPreview`, `supportsExport`, `render()`, `getData()`, `validate()`).

4. **Widget Registry (Open/Closed Principle - OCP)**:
   - O `WidgetRegistry` é o catálogo central do framework. Novos widgets são adicionados unicamente registrando-os no Registry, sem alterar o núcleo do Slide Builder.

5. **Layout Engine Desacoplado**:
   - Mecanismo de distribuição de layout independente dos componentes visuais (`full`, `2col`, `3col`, `dashboard`, `responsive_grid`, `custom`).

6. **Data Provider (Single Source of Truth)**:
   - Nenhum Widget acessa APIs ou SQL diretamente.
   - Fluxo obrigatório: `AnalyticsEngine / API -> Data Provider (IDataProvider) -> Widget`.

7. **Storage Provider Desacoplado**:
   - Persistência abstraída via `IStorageProvider`. Provedor padrão: `LocalStorageProvider`, preparado para `SupabaseStorageProvider` e compartilhamento corporativo.

8. **Versionamento e Migração de Schema**:
   - Metadados obrigatórios em Templates/Slides (`id`, `name`, `version`, `createdAt`, `updatedAt`, `author`, `origin`).
   - Utilitário `VersionMigrator` para garantir compatibilidade retroativa automática quando o schema evoluir.

9. **Inversão de Controle e Desacoplamento de Módulos Consumidores**:
   - O Framework não possui NENHUMA dependência dos módulos consumidores (RDM, RPS, etc.). A dependência ocorre sempre no sentido: `Framework <- Módulo Consumidor`.

---

## 3. Módulos Consumidores Homologados

O Framework Corporativo de Apresentações será consumido por:
- **RDM** (Reunião de Desempenho Mensal)
- **RPS** (Reunião de Planejamento Semanal)
- **Analytics & BI**
- **Diretoria & Presidência**
- **Trade Marketing & Promotores**
- **Módulos Futuros**

---

## 4. Princípios Não Negociáveis

1. **Nenhum componente do Core poderá depender de React, Next.js ou DOM.**
2. **Nenhum Widget poderá acessar APIs ou SQL diretamente.**
3. **Toda regra de negócio permanecerá no Core.**
4. **Todo componente visual deverá apenas renderizar informações produzidas pelo Core.**
5. **Toda evolução deverá preservar compatibilidade retroativa (0 breaking changes em slides oficiais, slides customizados, templates salvos e exportação PowerPoint).**

---

## 5. Critério de Evolução

Qualquer evolução futura do Framework Corporativo de Apresentações deverá respeitar estritamente esta ADR-001.

Caso alguma decisão arquitetural precise ser alterada no futuro, um novo ADR (ex: ADR-002) deverá ser criado formalmente, justificando a motivação, analisando impactos e definindo o plano de migração.
