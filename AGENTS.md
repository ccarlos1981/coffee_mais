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
