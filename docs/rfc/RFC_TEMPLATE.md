# RFC-XXX: [Título Resumido da Mudança Arquitetural]

> **Status**: `PROPOSED` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `SUPERSEDED`  
> **Autor**: [Nome / Time]  
> **Data de Criação**: YYYY-MM-DD  
> **Domínios Afetados**: [Domínio Comercial / Analytics / Financeiro / APIs / Outros]  
> **Versão Alvo**: v1.X.X  

---

## 1. Motivação
Descreva as razões de negócio, os motivadores estratégicos e o contexto operacional que justificam a necessidade desta mudança arquitetural.

---

## 2. Problema Atual
Apresente um diagnóstico técnico detalhado do cenário vigente a ser modificado, destacando limitações, gargalos, anomalias de dados ou vulnerabilidades de governança.

---

## 3. Objetivo
Especifique com clareza o que a RFC visa realizar, definindo o escopo exato da solução e os resultados esperados após a implementação.

---

## 4. Alternativas Avaliadas
Descreva outras abordagens ou tecnologias consideradas durante a fase de análise e as razões técnicas pelas quais foram descartadas em favor da solução proposta.

---

## 5. Impacto Arquitetural
Detalhe o impacto da mudança sobre os componentes do sistema, incluindo:
- Alterações no modelo relacional (tabelas, views, RLS, triggers);
- Serviços de backend, Server Actions e RPCs;
- Contratos de tipagem TypeScript e APIs HTTP;
- Infraestrutura de cache e pipelines de sincronização.

---

## 6. Impacto Funcional
Identifique os módulos, relatórios, dashboards ou telas UI afetados, descrevendo eventuais mudanças na experiência do usuário (UX) ou nos fluxos operacionais.

---

## 7. Compatibilidade Retroativa
Descreva como a solução garante 0% de quebra nos módulos consumidores existentes, especificando políticas de alias, fallbacks temporários ou pontes de transição.

---

## 8. Plano de Migração
Apresente o passo a passo sequencial de execução técnica para promover as alterações do ambiente atual para o novo estado desejado.

---

## 9. Estratégia de Rollback
Descreva o procedimento emergencial de reversão imediata (passo a passo de rollback de código, migrations e dados) em caso de falha durante a implantação.

---

## 10. Plano de Testes
Especifique a suíte de testes obrigatória a ser executada antes do merge, contendo:
- Testes de integridade estática (`npm run test:domain`);
- Checagem de tipagem (`npx tsc --noEmit`);
- Build completo de produção (`npm run build`);
- Validação de paridade de dados e cenários manuais.

---

## 11. Critérios de Homologação
Liste os critérios objetivos e mensuráveis que devem ser 100% satisfeitos para considerar a RFC formalmente homologada e concluída.

---

## 12. Atualizações Documentais Obrigatórias
Indique os arquivos de documentação que DEVERÃO ser atualizados obrigatoriamente durante ou ao encerramento do ciclo:
- [ ] **Baseline Oficial**: `AGENTS.md` & `docs/governance/baseline_oficial_plataforma.md`
- [ ] **Registro de Decisão de Arquitetura**: `docs/adr/ADR-XXX.md`
- [ ] **Histórico de Mudanças**: `CHANGELOG.md`
- [ ] **Índice Geral**: `docs/INDEX.md`
- [ ] **Guia de Implementação**: `Walkthrough`
- [ ] **Termo de Encerramento**: `Closure Report`
