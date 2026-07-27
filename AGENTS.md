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

Status Arquitetural: `SISTEMA_INOVACOES_DRE_COMERCIAL = PLANNING_CONFIRMED`.



