# GUIA ARQUITETURAL CORPORATIVO — ORQUESTRAÇÃO ORIENTADA A EVENTOS DE DOMÍNIO

**Plataforma**: Coffee++  
**Versão**: 1.0.0  
**Data**: 30 de Julho de 2026  
**Status**: Approved & Mandatory Architectural Standard  

---

## 1. O PADRÃO CORPORATIVO

O padrão **Event-Driven Infrastructure Orchestration** estabelece uma divisão rígida e unidirecional entre as regras de negócio puras (domínio) e os efeitos colaterais de infraestrutura (caches, notificações, filas, telemetria e sincronizações).

### Fluxo Arquitetural Unificado:

```mermaid
flowchart TD
    subgraph Domain Layer (Regra de Negócio Pura)
        A[Domain Service\nex: ImportService] -->|Dispara| B[Domain Event\nex: ImportSuccess]
    end

    subgraph Orchestration Layer (Coordenador de Eventos)
        B --> C[Event Coordinator\nex: CacheInvalidationService / SystemEventCoordinator]
    end

    subgraph Infrastructure Layer (Efeitos Colaterais Assegurados)
        C -->|Invalida| D[UI Cache\nex: DashboardCache]
        C -->|Enfileira| E[Background Worker / Queue\nex: cm_clientes_atividade_jobs]
        C -->|Notifica| F[Notification Engine\nex: Push / WhatsApp]
        C -->|Audita| G[Telemetry & Audit Log\nex: logAuditAction]
        C -->|Sincroniza| H[External Integration\nex: BigQuery / ERP]
    end
```

---

## 2. PRINCÍPIOS FUNDAMENTAIS

1. **Baixo Acoplamento (Low Coupling)**:
   Os serviços de domínio operam sem qualquer dependência direta de módulos visuais, bibliotecas de cache ou serviços externos de comunicação.
2. **Responsabilidade Única (Single Responsibility)**:
   Cada componente realiza uma única função: os serviços de domínio aplicam regras de negócio; os coordenadores de eventos gerenciam fluxos de reação; os serviços de infraestrutura executam efeitos colaterais.
3. **Orquestração Orientada a Eventos (Event-Driven Orchestration)**:
   A propagação de mudanças de estado na plataforma é guiada por eventos explícitos de domínio (`onImportSuccess`, `onActionApproved`, `onVisitaCompleted`), eliminando dependências circulares e acoplamentos rígidos.
4. **Separação de Interesses (Separation of Concerns)**:
   A lógica de apresentação (ex: se o Dashboard usa `API_CACHE` ou Redis) é isolada da lógica de persistência e transação.
5. **Infraestrutura Desacoplada do Domínio**:
   Substituições ou evoluções nas tecnologias de infraestrutura (ex: migrar cache local para Redis ou alterar gateway de notificação) exigem **0 alterações** nos serviços de domínio.

---

## 3. REGRAS CORPORATIVAS MANDATÓRIAS

> [!IMPORTANT]
> **Proibição de Contaminação do Domínio**:
> Nenhum `DomainService` (serviço que altera estado de negócio no banco) pode importar, instanciar ou conhecer diretamente:
> - Caches (`*Cache`, `Map.clear()`, `Redis`, `SWR`);
> - Mecanismos de tempo real (`WebSocket`, `Pusher`, `Socket.io`);
> - Engrenagens de notificação (`PushNotification`, `WhatsApp`, `EmailService`);
> - Coleta de telemetria e métricas de apresentação;
> - Filas de background e workers diretamente;
> - APIs e SDKs de integrações externas.

**Regra de Ouro**: O `DomainService` limita-se a emitir a notificação do evento de domínio para o seu respectivo `Coordinator`. Toda a execução secundária e de infraestrutura é delegada ao `Coordinator`.

---

## 4. PADRÃO DE NOMENCLATURA E CONVENÇÕES DE ARQUIVOS

| Tipo de Componente | Sufixo Oficial | Localização Padrão | Exemplo |
| :--- | :--- | :--- | :--- |
| **Domain Service** | `*Service` | `src/lib/services/` | `ImportService`, `InvestimentoService` |
| **Event Coordinator** | `*Coordinator` / `*InvalidationService` | `src/lib/events/` ou `src/lib/services/` | `CacheInvalidationService`, `OrderEventCoordinator` |
| **Cache Storage** | `*Cache` | `src/lib/cache/` | `DashboardCache`, `DreCache` |
| **Domain Event** | `*Event` | `src/lib/events/types/` | `ImportSuccessEvent`, `ActionApprovedEvent` |
| **Event Listener** | `*Listener` | `src/lib/events/listeners/` | `AuditLogListener`, `PushNotificationListener` |

---

## 5. EXEMPLOS FUTUROS DE APLICAÇÃO NA PLATAFORMA

### 5.1. Módulo CRM Comercial (`/inovacoes/crm`)
- **Domain Event**: `ClienteScoreRecalculatedEvent`
- **Fluxo**: `CrmService.updateScore()` → `CrmEventCoordinator.onScoreUpdated()` → `CrmCache.invalidate()` + `NotificationCoordinator.notifyGerente()`.

### 5.2. Módulo de Promotores e Visitas (`/promotor`)
- **Domain Event**: `VisitaCheckoutCompletedEvent`
- **Fluxo**: `PromotorVisitaService.checkout()` → `VisitaEventCoordinator.onCheckout()` → `SupervisorDashboardCache.invalidate()` + `AILearningService.enqueueAnalysis()`.

### 5.3. Módulo RPS (`/processo-comercial/rps`)
- **Domain Event**: `MetaWeeklySavedEvent`
- **Fluxo**: `RpsProjectionService.saveMeta()` → `RpsEventCoordinator.onMetaUpdated()` → `RpsCache.invalidate()` + `AuditLogListener.logChange()`.

### 5.4. Módulo de Investimentos (`/investimento`)
- **Domain Event**: `AcaoTradeApprovedEvent`
- **Fluxo**: `TradeService.aprovarAcao()` → `TradeEventCoordinator.onAcaoApproved()` → `InvestimentoDashboardCache.invalidate()` + `WhatsAppNotificationService.sendApproval()`.

---

## 6. RECOMENDAÇÃO ARQUITETURAL

> [!TIP]
> **Inclusão no AGENTS.md**:
> Recomenda-se a formalização desta diretriz como **Seção 68 do `AGENTS.md`** ("Baseline Oficial — Padrão Corporativo de Orquestração Orientada a Eventos de Domínio"), tornando este documento um **guideline obrigatório** para o desenvolvimento de todas as Fases e Módulos futuros da plataforma Coffee++.
