# ESPECIFICAÇÃO FUNCIONAL OFICIAL — MÓDULO DE INVESTIMENTOS

> **Status Arquitetural:** `INVESTIMENTOS_MODULE = LOCKED & CONFIRMED` (Release X.2)  
> **Versão do Documento:** 2.0 (Consolidado e Homologado)  
> **Data de Atualização:** 14/08/2026  
> **Single Source of Truth:** Este documento é a especificação técnica e operacional definitiva do Módulo de Investimentos do Coffee++. Consolida a esteira de 6 fases, regras de governança, notificação por e-mail e tratamento de exceções.

---

## SUMÁRIO DE SEÇÕES

1. [Objetivo Estratégico do Módulo](#1-objetivo-estratégico-do-módulo)
2. [Matriz RACI e Permissões por Perfil](#2-matriz-raci-e-permissões-por-perfil)
3. [Esteira Transacional das 6 Fases](#3-esteira-transacional-das-6-fases)
4. [Governança do Mês de Referência](#4-governança-do-mês-de-referência)
5. [Divergência Operacional de Calendário](#5-divergência-operacional-de-calendário)
6. [Regra de Fechamento em 10 Dias](#6-regra-de-fechamento-em-10-dias)
7. [Mapeamento Oficial de Notificações por E-mail](#7-mapeamento-oficial-de-notificações-por-e-mail)
8. [Vínculo Financeiro de Boletos & Abatimentos](#8-vínculo-financeiro-de-boletos--abatimentos)
9. [Ações Não Ocorridas & Rota de Revisão](#9-ações-não-ocorridas--rota-de-revisão)
10. [Reabertura de Ações por Perfil Autorizado](#10-reabertura-de-ações-por-perfil-autorizado)
11. [Carta de Anuência & Gestão de Logos](#11-carta-de-anuência--gestão-de-logos)
12. [Glossário do Domínio](#12-glossário-do-domínio)

---

## 1. OBJETIVO ESTRATÉGICO DO MÓDULO

O **Módulo de Investimentos** é a solução oficial de governança financeira e comercial da **Coffee Mais** para planejamento, validação, apuração, quitação e auditoria de todas as verbas promocionais de Trade Marketing aplicadas nas redes parceiras.

### Pilares Fundamentais:
- **Rastreabilidade 100% Auditável:** Nenhuma verba comercial é paga sem ter sido planejada comercialmente, validada pelo Trade, comprovada por evidências fotográficas/sell-out e auditada pela Tesouraria.
- **Isolamento de Responsabilidade (Segregating Duties):** O executivo que vende não possui permissão para aprovar a própria conta ou efetuar baixas financeiras diretas.
- **Imutabilidade Pós-Encerramento:** Após atingir a Fase 6 (Concluído), a ação fica blindada contra edições retroativas.

---

## 2. MATRIZ RACI E PERMISSÕES POR PERFIL

| Etapa do Processo | Gerente Regional (GRV) | Trade Marketing | Financeiro | Admin / CEO | Sistema |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Criação & Lançamento Rascunho** | **R / A** | C | I | I | I |
| **Promoção & Envio ao Trade (Fase 1 → 2)** | **R** | I | I | I | **A** |
| **Validação dos 4 Pilares (Fase 2 → 3)** | I | **R / A** | I | I | I |
| **Divergência de Calendário (Datas Reais)** | I | **R / A** | I | I | I |
| **Preenchimento de Apuração & Boleto (Fase 3 → 4)** | **R / A** | C | I | I | I |
| **Auditoria do Dossiê & Fotos (Fase 4 → 5)** | I | **R / A** | I | I | I |
| **Quitação Bancária & Baixa ERP (Fase 5 → 6)** | I | I | **R / A** | I | I |
| **Selo Verde & Arquivamento Imutável (Fase 6)** | I | I | I | I | **R / A** |
| **Sinalização Ação Não Ocorreu** | R | R | I | A | R |
| **Reabertura de Ação Concluída** | I | I | I | **R / A** | I |

---

## 3. ESTEIRA TRANSACIONAL DAS 6 FASES

```
[Rascunho] ──> (Fase 1: Planejamento) ──> (Fase 2: Trade) ──> (Fase 3: Apuração) ──> (Fase 4: Auditoria) ──> (Fase 5: Pagamento) ──> [Fase 6: Concluído ✅]
```

1. **Fase 1 — Planejamento Comercial:** Gerente cadastra a ação (Rede, Tipo, Preço Flat, Preço Ação, Volume, Mês de Referência) e clica em *Promover* e *Passar para o Trade*.
2. **Fase 2 — Validação Trade:** Trade verifica estoque no CD, alinha promotores e valida os 4 pilares (Comunicação, Logística, Auditoria, Garantia).
3. **Fase 3 — Apuração & Boleto:** Gerente digita o sell-out real, faz upload das fotos e do relatório em PDF e pesquisa a duplicata em aberto do cliente no ERP.
4. **Fase 4 — Auditoria Trade:** Trade confere a veracidade do dossiê. Aprova para o Financeiro ou Devolve para a Fase 3 com justificativa.
5. **Fase 5 — Pagamento Financeiro:** Tesouraria realiza o abatimento no ERP Sankhya/PIX, anexa o comprovante PDF e confirma a quitação.
6. **Fase 6 — Concluído (Imutável):** Ação recebe o selo verde e entra em modo read-only permanente.

---

## 4. GOVERNANÇA DO MÊS DE REFERÊNCIA

- **Definição:** O Mês de Referência representa o mês comercial/orçamentário a que pertence a verba (formato `YYYY-MM`).
- **Diferenciação:** Não se confunde com a *Data de Registro* (timestamp do sistema) nem com o *Período de Vigência* (dias reais em loja).
- **Exemplo:** Uma ação lançada em 15 de Julho para pagar uma promoção realizada em Agosto possui **Mês de Referência = 2026-08**.

---

## 5. DIVERGÊNCIA OPERACIONAL DE CALENDÁRIO

Em caso de atraso logístico ou alteração do tabloide pelo cliente:
- As datas planejadas originais (`data_inicio`, `data_fim`) permanecem intocadas no banco de dados.
- O Trade registra a **Divergência de Calendário** informando `data_inicio_real`, `data_fim_real` e o motivo do atraso (`ATRASO_LOGISTICO`, `ALTERACAO_REDE`, etc.).

---

## 6. REGRA DE FECHAMENTO EM 10 DIAS

- O Gerente Regional possui o prazo limite de até **10 dias corridos** após o término da promoção para preencher a apuração na Fase 3 e submeter ao Trade.
- Ações não concluídas dentro do prazo são marcadas no relatório de inconsistências corporativas.

---

## 7. MAPEAMENTO OFICIAL DE NOTIFICAÇÕES POR E-MAIL

O serviço `resolveNotificationRecipients` mapeia os 8 eventos reais de e-mail automático via Nodemailer:

1. `ENVIAR_TRADE` (Fase 1 → 2): Trade Marketing + Gerente Regional.
2. `REPROVAR_TRADE` (Fase 2 → 1): Gerente Regional + Trade.
3. `VALIDAR_TRADE` (Fase 2 → 3): Trade + Gerente Regional (Financeiro Excluído).
4. `CONCLUIR_APURACAO` (Fase 3 → 4): Financeiro + Gerente Regional + Admins.
5. `DEVOLVER_FINANCEIRO` (Fase 4 → 3): Gerente Regional + Trade.
6. `APROVAR_FINANCEIRO` (Fase 4 → 5): Financeiro + Gerente + Trade.
7. `PAGAMENTO_CONFIRMADO` (Fase 5 → 6): Gerente Regional + Trade.
8. `ACAO_NAO_OCORREU`: Gerente Regional + Trade + Admins.

---

## 8. VÍNCULO FINANCEIRO DE BOLETOS & ABATIMENTOS

- Abatimentos em boleto exigem vínculo formal de duplicata ativa no ERP Sankhya (`cm_acoes_boletos_vinculo`).
- Para ações quitadas via bonificação física ou PIX direto, marca-se a opção *Sem Boleto Físico* declarando a modalidade.

---

## 9. AÇÕES NÃO OCORRIDAS & ROTA DE REVISÃO

Se uma ação comercial não rodou nas lojas do cliente:
- Executa-se a ação `marcarAcaoNaoAconteceu(id, motivo)`.
- A ação é revertida para a Fase 1 em Rascunho com o motivo gravado em `cancel_reason`.
- O e-mail de notificação `ACAO_NAO_OCORREU` é disparado para o Gerente, Trade e Admins.

---

## 10. REABERTURA DE AÇÕES POR PERFIL AUTORIZADO

Apenas perfis **Admin**, **CEO** ou **Diretores** possuem permissão para executar a reabertura de ações na Fase 6 via Server Action `reabrirAcaoInvestimento(id, reason)`. Toda reabertura grava log compulsório em `cm_audit_logs`.

---

## 11. CARTA DE ANUÊNCIA & GESTÃO DE LOGOS

- **Carta de Anuência:** Documento formal autorizando o cliente a realizar o abatimento em títulos a vencer.
- **Logotipos:** Gerenciados exclusivamente via Server Action `processarEUploadLogoRede` no bucket `logos-redes` com persistência de hash SHA-256 e snapshot imutável na emissão da carta.

---

## 12. GLOSSÁRIO DO DOMÍNIO

- **Sell-In:** Venda da fábrica Coffee Mais para a rede parceira.
- **Sell-Out:** Venda da gôndola do supermercado para o consumidor final.
- **Preço Flat:** Tabela de preço regular sem desconto.
- **Investimento Unitário:** Subsídio Coffee Mais por unidade comercializada.
- **Dossiê Comercial:** Conjunto de comprovantes (relatório + fotos + boleto) enviado na apuração.
