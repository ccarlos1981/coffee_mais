# CATÁLOGO DE COMPONENTES CORPORATIVOS COFFEE++

**Plataforma**: Coffee++  
**Última Atualização**: 30 de Julho de 2026  

---

## 1. MÓDULO: HUB DE IMPORTAÇÃO DE DADOS

### Componente: Import Hub Core Service (`ImportService`)
- **Escopo**: Serviço transacional responsável pela ingestão, análise, staging, validação de integridade e promoção de planilhas de faturamento oficial.
- **Tecnologias**: Next.js Node.js Runtime, Supabase Service Role Client, XLSX Parser, PostgreSQL RPCs.
- **Status de Governança**: `LTS` | `Stable` | `Governed`

#### Recursos Principais:
1. **Reimportação Controlada de Faturamento** (`LTS` | `Stable` | `Governed`):
   - **Descrição**: Mecanismo de override seguro para reprocessamento de cargas idênticas (SHA-256) mediante autorização de perfil (`Admin` / `Admin Master`), recálculo server-side de período e justificativa padronizada obrigatória.
   - **Garantias**:
     - Upload estritamente read-only/staging.
     - Confirm é o único ponto de alteração de estado.
     - Imutabilidade do histórico (`status = SUCCESS` preservado).
     - Rastreabilidade bidirecional (`superseded_by_batch_id` / `replacement_of_batch_id`).
     - Invalidação automática de cache via `CacheInvalidationService`.
   - **Governança**: Seção 69 do `AGENTS.md` & `ADR-003`.

---

## 2. MÓDULO: CACHE & ORQUESTRAÇÃO DE EVENTOS

### Componente: Event-Driven Infrastructure Orchestration (`CacheInvalidationService`)
- **Escopo**: Coordenador desacoplado de eventos de domínio e invalidação de caches visuais.
- **Status de Governança**: `LTS` | `Stable` | `Governed`
- **Governança**: Seção 68 do `AGENTS.md` & `ADR-002`.

### Componente: Presentation Cache Manager (`DashboardCache`)
- **Escopo**: Gerenciador de cache em memória para endpoints executivos com TTL de 5 minutos e invalidação por evento.
- **Status de Governança**: `LTS` | `Stable` | `Governed`
