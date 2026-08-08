# Coffee++ Engineering Handbook

> **Manual Operacional de Engenharia de Software da Plataforma Coffee++**  
> **Versão:** 1.0.0  
> **Status:** OFICIAL — OPERACIONAL  
> **Norma Soberana de Referência:** [AGENTS.md](file:///Users/cristiano/Projetos/Coffe%20Mais/.agents/AGENTS.md)

---

## Table of Contents
1. [Introdução](#1-introdução)
2. [Fluxo Oficial de Engenharia](#2-fluxo-oficial-de-engenharia)
3. [Como Abrir uma Demanda](#3-como-abrir-uma-demanda)
4. [Como Criar uma Baseline](#4-como-criar-uma-baseline)
5. [Como Criar um ADR](#5-como-criar-um-adr)
6. [Processo Oficial de Releases](#6-processo-oficial-de-releases)
7. [Auditoria de Governança](#7-auditoria-de-governança)
8. [Controle de Mudanças Arquiteturais](#8-controle-de-mudanças-arquiteturais)
9. [Ciclo de Vida dos Componentes](#9-ciclo-de-vida-dos-componentes)
10. [Boas Práticas de Engenharia](#10-boas-práticas-de-engenharia)
11. [Templates Oficiais](#11-templates-oficiais)
12. [FAQ — Perguntas Frequentes](#12-faq--perguntas-frequentes)

---

## 1. Introdução

### 1.1 Objetivo do Handbook
O **Coffee++ Engineering Handbook** é o guia operacional oficial de desenvolvimento, arquitetura, testes e homologação para todos os engenheiros de software, arquitetos, analistas de dados e agentes de IA que atuam na Plataforma Coffee++.

O objetivo deste manual é **explicar como aplicar na prática** todas as normas, políticas, baselines e processos de engenharia do sistema.

### 1.2 Relação com o AGENTS.md
- **AGENTS.md**: Documento Soberano de Governança. Define **O QUE** é obrigatório, estabelece a Constituição da Engenharia (Seção 80), as Políticas Permanentes (Seções 76-79) e o Índice Mestre (Seção 81).
- **Engineering Handbook**: Manual Operacional de Execução. Explica **COMO EXECUTAR** no dia a dia.

> [!IMPORTANT]
> Em caso de qualquer divergência entre este Handbook e o `AGENTS.md`, a palavra do `AGENTS.md` prevalecerá soberanamente (Seção 80 — Hierarquia Normativa).

### 1.3 Escopo de Utilização
Este guia aplica-se a 100% dos repositórios, serviços, Server Actions, APIs, rotas Next.js, scripts de migração SQL e componentes visuais do ecossistema Coffee++.

---

## 2. Fluxo Oficial de Engenharia

Todo ciclo de vida de desenvolvimento na Plataforma Coffee++ segue rigorosamente a sequência de 9 etapas:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 1. Abertura da  │ ──► │ 2. Análise      │ ──► │ 3. Auditoria    │
│    Demanda      │     │    Técnica      │     │    Arquitetural │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐              ▼
│ 6. Homologação  │ ◄── │ 5. Validação    │ ◄── ┌─────────────────┐
│    Técnica      │     │    Efetiva      │     │ 4. Implementação│
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 7. Criação de   │ ──► │ 8. Registro de  │ ──► │ 9. Atualização  │
│    Baseline     │     │    ADR (se houver)│   │    Índice Mestre│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Abertura da Demanda**: Preenchimento do Template Oficial (Seção 84 do `AGENTS.md`).
2. **Análise Técnica**: Investigação da causa raiz e definição das alternativas.
3. **Auditoria Arquitetural**: Verificação de impactos em baselines protegidas (Seção 76) e isolamento de escopo (Seção 77).
4. **Implementação**: Código limpo, desacoplado, sem alterar arquivos fora do escopo.
5. **Validação Efetiva**: Execução de `npx tsc --noEmit`, `npm run build` e `npm run health:analytics`.
6. **Homologação Técnica**: Emissão do Termo de Homologação com evidências empíricas (Seção 73).
7. **Criação / Atualização de Baseline**: Registro das regras permanentes homologadas.
8. **Registro de ADR**: Criação ou atualização do registro de decisão técnica em `docs/adr/`.
9. **Atualização do Índice Mestre**: Inserção da nova baseline/política na Seção 81 do `AGENTS.md`.

---

## 3. Como Abrir uma Demanda

### 3.1 Quando Abrir uma Demanda
Toda e qualquer alteração no código da aplicação, estilos, banco de dados ou infraestrutura exige a abertura prévia de uma demanda estruturada.

### 3.2 Campos Obrigatórios
De acordo com o Template Oficial (Seção 84), os 10 tópicos obrigatórios são:
1. **Contexto**: Qual o problema identificado?
2. **Objetivo**: O que a alteração visa atingir?
3. **Escopo**: Arquivos permitidos, componentes protegidos e o que está fora do escopo.
4. **Impacto**: Baselines afetadas, APIs, banco de dados, performance e segurança.
5. **Plano Técnico**: Estratégia de resolução e alternativas avaliadas.
6. **Plano de Rollback**: Como reverter com segurança se necessário.
7. **Critérios de Aceitação**: Condições objetivas para considerar a tarefa concluída.
8. **Validação**: Testes, build e verificações de responsividade/tipagem.
9. **Homologação**: Registro final de aprovação.
10. **Baseline / ADR**: Declaração explícita de novos registros no `AGENTS.md`.

---

## 4. Como Criar uma Baseline

### 4.1 Quando Criar uma Baseline
Uma **Baseline Oficial** é criada quando uma nova funcionalidade, padrão visual, componente estrutural ou regra financeira atinge estabilidade e deve ser **protegida permanentemente contra regressões** (Seção 76 do `AGENTS.md`).

### 4.2 Critérios para Homologação de Baseline
- 0 erros de compilação TypeScript (`npx tsc --noEmit`).
- Build de produção sem warnings críticos (`npm run build`).
- Auditoria de governança aprovada (`npm run health:analytics`).
- Validação visual e funcional nas resoluções homologadas (1366×768, 1440×900, 1536×864, 1920×1080).

### 4.3 Estrutura de Registro no AGENTS.md
As Baselines devem ser adicionadas como uma nova Seção numerada no `AGENTS.md` e registradas na Seção 81 (Índice Mestre).

---

## 5. Como Criar um ADR (Architectural Decision Record)

### 5.1 Quando um ADR é Obrigatório
Conforme a Seção 82 do `AGENTS.md`, um ADR é mandatório sempre que houver:
- Criação de nova arquitetura ou engine analítica.
- Alteração estrutural em componentes ou modelos de dados.
- Mudança em contratos de APIs ou regras de autorização/autenticação.
- Alteração em componentes protegidos por Baseline.

### 5.2 Estrutura e Localização
- Os arquivos de ADR devem ser salvos em `docs/adr/ADR-XXX-[titulo-curto].md`.
- Estados válidos: `Proposed`, `Accepted`, `Superseded`, `Deprecated`.

---

## 6. Processo Oficial de Releases

### 6.1 Checklist de Pré-Release
Antes de realizar qualquer deploy ou mesclagem na branch principal:
- [ ] Executar `npx tsc --noEmit` (Resultado: 0 erros).
- [ ] Executar `npm run build` (Resultado: Sucesso).
- [ ] Executar `npm run health:analytics` (Resultado: LOCKED & CONFIRMED).
- [ ] Executar `npm run health:mcp` (Resultado: 0 falhas em infraestrutura).
- [ ] Validar compatibilidade retroativa (Seção 79).
- [ ] Atualizar a documentação oficial e o `AGENTS.md`.

---

## 7. Auditoria de Governança

### 7.1 Como Executar a Auditoria
A Auditoria de Governança (Seção 85) é o portão de saída obrigatório de qualquer ciclo de desenvolvimento.

Comando principal:
```bash
npm run health:analytics
```

### 7.2 Classificação da Auditoria
- **APROVADA**: Todos os testes passaram, 0 desvios de governança, build 100% limpo.
- **APROVADA COM RESSALVAS**: Validações técnicas passaram, mas existem pendências documentais secundárias.
- **REPROVADA**: Qualquer falha de build, erro de tipagem, desvio financeiro ou alteração não autorizada fora do escopo.

---

## 8. Controle de Mudanças Arquiteturais

### 8.1 Princípio do Isolamento de Demandas
De acordo com a Seção 77 (`DEMAND_ISOLATION_POLICY`), alterações devem ter o menor raio de impacto possível. É expressamente proibido alterar arquivos fora do escopo da demanda sem justificativa formal.

### 8.2 Gestão de Breaking Changes
Conforme a Seção 79 (`BACKWARD_COMPATIBILITY_POLICY`), qualquer alteração que quebre compatibilidade exige:
1. Análise de impacto e justificativa.
2. Plano de convivência/transição gradual.
3. Plano de rollback seguro.
4. Atualização de documentação.

---

## 9. Ciclo de Vida dos Componentes

Todos os componentes, APIs e estruturas de dados seguem a máquina de estados oficial (Seção 83):

$$\text{ACTIVE} \longrightarrow \text{DEPRECATED} \longrightarrow \text{SUNSET} \longrightarrow \text{REMOVED}$$

- **ACTIVE**: Em produção, mantido e recomendado.
- **DEPRECATED**: Marcado para futura remoção; continua funcionando, mas possui alternativa oficial.
- **SUNSET**: Em período final de migração; bloqueado para novos usos.
- **REMOVED**: Excluído fisicamente da aplicação.

---

## 10. Boas Práticas de Engenharia

Alinhadas à **Constituição da Engenharia (Seção 80)**:

1. **Correção sobre Otimização**: A solução deve estar correta antes de ser otimizada.
2. **Estabilidade**: Priorizar previsibilidade e segurança contra regressões.
3. **Simplicidade**: Escolher a alternativa de menor complexidade estrutural.
4. **Single Source of Truth**: Reutilizar sempre a `AnalyticsEngine` e as fontes de dados homologadas (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`, etc.).
5. **Sem Hardcoding**: Proibido hardcodar fatores de embalagem, URLs ou parâmetros operacionais.

---

## 11. Templates Oficiais

### 11.1 Template de Demanda
```markdown
# DEMANDA — [NOME DA DEMANDA]

## 1. Contexto
[Descrição objetiva do problema]

## 2. Objetivo
[Resultado esperado]

## 3. Escopo
- Arquivos afetados: ...
- Componentes protegidos: ...
- Fora do escopo: ...

## 4. Impacto & Plano Técnico
[Estratégia de resolução e alternativas]

## 5. Plano de Rollback
[Instruções de reversão]

## 6. Critérios de Aceitação & Validação
- [ ] tsc --noEmit
- [ ] npm run build
- [ ] health:analytics
```

### 11.2 Template de ADR
```markdown
# ADR-XXX: [Título da Decisão]

- **Data**: YYYY-MM-DD
- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Autores**: [Nome/Time]

## Contexto e Problema
[Descrição do cenário]

## Decisão Adotada
[Descrição clara da solução escolhida]

## Consequências e Impacto
- **Positivas**: ...
- **Riscos/Desvantagens**: ...
```

---

## 12. FAQ — Perguntas Frequentes

### Q1: O que fazer se eu precisar alterar um componente protegido por Baseline?
**R:** Você deve abrir uma Demanda Arquitetural formal, apresentar a análise de impacto, obter aprovação prévia, executar os testes de regressão e atualizar a Seção correspondente no `AGENTS.md`.

### Q2: Posso criar uma nova consulta SQL direta no frontend ou em uma API Route?
**R:** Não. Conforme a Seção 14 (Analytics Engine V1), toda consulta analítica deve consumir exclusivamente a `AnalyticsEngine` (`src/lib/governance/analytics`). Consultas diretas paralelas são expressamente proibidas.

### Q3: Qual a diferença entre o AGENTS.md e este Handbook?
**R:** O `AGENTS.md` é a norma soberana (O QUE deve ser feito e mantido). O Handbook é o manual operacional de execução (COMO fazer). Em qualquer conflito, o `AGENTS.md` prevalece.
