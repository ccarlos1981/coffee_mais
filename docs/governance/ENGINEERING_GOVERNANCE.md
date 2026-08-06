# 🛡️ GOVERNANÇA PERMANENTE DE ENGENHARIA DE SOFTWARE — COFFEE++

**Data de Emissão:** 05/08/2026  
**Status de Governança:** `ENGINEERING_GOVERNANCE = ACTIVE` & `TECHNICAL_CONSTITUTION = LOCKED` & `GATEWAY_RPC_MANDATORY = ENABLED`  
**Referência Suprema:** [docs/governance/BASELINE_ARQUITETURAL_v1.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/BASELINE_ARQUITETURAL_v1.md)

---

## 1. A BASELINE ARQUITETURAL COMO CONSTITUIÇÃO TÉCNICA

A [BASELINE_ARQUITETURAL_v1.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/BASELINE_ARQUITETURAL_v1.md) é estabelecida oficialmente como a **Constituição Técnica Suprema do Coffee++**.

* Toda nova funcionalidade, refatoração, manutenção, módulo ou migração de dados **deverá respeitar integralmente** os princípios, pipelines, gateways RPC e delimitações de domínio nela contidos.
* Nenhuma alteração de código ou de banco de dados poderá contrariar essa arquitetura sem aprovação formal por escrito e emissão prévia de um parecer de exceção arquitetural.

---

## 2. GATES OBRIGATÓRIOS DE VALIDAÇÃO (CHECKLIST DE ENGENHARIA)

Antes de qualquer merge em branch principal, commit de release ou deploy em ambiente de produção, todos os 9 gates abaixo devem ser executados e homologados com **100% de aprovação**:

- [ ] **1. Auditoria Arquitetural**: Confirmação de não-violação do Single Source of Truth e do Gateway RPC (`rpc_importar_atendimento_sankhya`).
- [ ] **2. Verify Parity**: Auditoria de paridade financeira determinando 0,0000% de desvio entre `cm_faturamento` e as Materialized Views.
- [ ] **3. Health Analytics**: Execução do comando `npm run health:analytics` sem advertências ou quebras de contrato na `AnalyticsEngine`.
- [ ] **4. TypeScript Typecheck**: Execução de `npx tsc --noEmit` apresentando rigorosamente **0 erros de compilação**.
- [ ] **5. Build de Produção**: Execução de `npm run build` com sucesso completo da aplicação Next.js.
- [ ] **6. Refresh Validation**: Teste e confirmação da atualização sequencial assíncrona das Materialized Views (`mv_vendas_agg` → `mv_vendas_mensal` → `mv_vendas_cliente_mensal`).
- [ ] **7. Dashboard Validation**: Validação visual e numérica dos cards executivos, gráficos e tabelas consumidos do Analytics Engine.
- [ ] **8. Soma Zero**: Prova matemática comprovando que redistribuições gerenciais ou cadastrais resultam em desvio total de **R$ 0,00**.
- [ ] **9. Reconciliação Financeira**: Verificação de paridade global contra MyMetrics / Sankhya dentro da margem de tolerância (< 0,5%).

---

## 3. AS REGRAS DE OURO DA ENGENHARIA COFFEE++

1. 🔐 **Nunca violar o Single Source of Truth**: `cm_faturamento` é a única fonte financeira; `cm_clientes` é o único cadastro mestre comercial.
2. 🚫 **Nunca utilizar `base_atendimento` como fonte comercial**: Domínio estritamente operacional de campo.
3. ⚡ **Toda ingestão de atendimento deve consumir a RPC `rpc_importar_atendimento_sankhya`**: Proibido o uso de `upsert` direto em `base_atendimento`.
4. 🧠 **Nunca realizar agregações financeiras pesadas no Node.js**: Toda agregação volumosa ocorre em SQL Server-Side / Materialized Views.
5. 📊 **Toda soma financeira deve ocorrer em SQL Server-Side**: Preservar o consumo de dados em < 100ms.
6. ⚖️ **Toda reorganização comercial deve preservar Soma Zero**: Alteração de responsabilidade ou canal é redistribuição (diferença = R$ 0,00).
7. 🔍 **Toda alteração estrutural exige auditoria de paridade**: Provar 0,0000% de variação numérica antes do deploy.
8. 📜 **Toda mudança deve ser rastreável e auditável**: Registrada por IDs primários numéricos (`codigo IN (...)`) e acompanhada de relatório de homologação.

---

## 4. ESTRUTURA COMERCIAL & COMMERCIAL ROLES v2
- A gestão de gerentes e Commercial Roles (`KA`, `DIST`, `EXPORT`, etc.) é governada por `src/lib/domain/commercial-structure.ts`.
- É expressamente proibida a criação de listas locais paralelas de gerentes ou distribuidores.
- Detalhes e checklists oficiais: [docs/governance/COMMERCIAL_STRUCTURE_BASELINE.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/COMMERCIAL_STRUCTURE_BASELINE.md).

---

## 5. STATUS E DECLARAÇÃO FINAL

Declaramos que a [BASELINE_ARQUITETURAL_v1.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/BASELINE_ARQUITETURAL_v1.md) e o [COMMERCIAL_STRUCTURE_BASELINE.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/COMMERCIAL_STRUCTURE_BASELINE.md) constituem a **Constituição Técnica Oficial do Coffee++**.

**Status Oficial:** `ENGINEERING_GOVERNANCE = ACTIVE` | `TECHNICAL_CONSTITUTION = LOCKED` | `COMMERCIAL_STRUCTURE_V2 = LOCKED` | `BASELINE = v1.0`.
