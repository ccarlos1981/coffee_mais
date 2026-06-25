# MANUAL DE TREINAMENTO: COFFEE MAIS AI PLATFORM
## VOLUME 2: MANUAL TRADE, SUPERVISÃO & OPERAÇÕES

---

> [!NOTE]
> **Paleta de Identidade Visual Utilizada para Impressão e PDF:**
> * **Primary**: Deep Velvet Black (#0F0A06)
> * **Secondary**: Coffee Brown (#4A2C11)
> * **Accent**: Premium Gold (#D4A373)
> * **Background**: Clean Ivory White (#F9F6F0)

---

## SUMÁRIO

1. [Primeiro Acesso ao Command Center](#1-primeiro-acesso-ao-command-center)
2. [Entendendo o Dashboard & Abas de Inteligência](#2-entendendo-o-dashboard--abas-de-inteligência)
3. [Importação de PDVs (Módulo Crítico)](#3-importação-de-pdvs-módulo-crítico)
4. [Configuração de SLA (Módulo Crítico)](#4-configuração-de-sla-módulo-crítico)
5. [Configurações de Roteirização que Impactam Tempo](#5-configurações-de-roteirização-que-impactam-tempo)
6. [Como a Roteirização Inteligente Funciona (Cálculo)](#6-como-a-roteirização-inteligente-funciona-cálculo)
7. [Ajustando a Rota & Balanceamento de Carteiras](#7-ajustando-a-rota--balanceamento-de-carteiras)
8. [Auditoria de Fotos & Reprocessamento de Imagens](#8-auditoria-de-fotos--reprocessamento-de-imagens)
9. [Painel Price Intelligence](#9-painel-price-intelligence)
10. [Painel Route Intelligence](#10-painel-route-intelligence)
11. [Painel Sell-Out Intelligence](#11-painel-sell-out-intelligence)
12. [Painel Prescriptive AI (Simulador & ROI)](#12-painel-prescriptive-ai-simulador--roi)
13. [Painel AI Governance (Controles de Autonomia)](#13-painel-ai-governance-controles-de-autonomia)
14. [Melhores Práticas de Gestão de Trade](#14-melhores-práticas-de-gestão-de-trade)
15. [FAQ — Perguntas Frequentes (40 Questões)](#15-faq--perguntas-frequentes-40-questões)
16. [Glossário de Termos Operacionais](#16-glossário-de-termos-operacionais)

---

## 1. PRIMEIRO ACESSO AO COMMAND CENTER

O **Command Center** é o painel de controle administrativo da Coffee Mais AI Platform. Ele serve para supervisionar a execução de campo, gerenciar rotas, definir regras de IA e aprovar recomendações complexas de Trade.

### Acesso Inicial:
1. Acesse o endereço web corporativo (ex: `https://platform.coffeemais.com.br/admin`).
2. Insira suas credenciais corporativas (E-mail e Senha) autenticadas via SSO.
3. Se seu usuário for do perfil **Trade**, **Supervisor** ou **Admin**, a interface desbloqueará o Command Center correspondente ao seu nível de visibilidade tenant.

```
+-------------------------------------------------------------------+
| [IMAGEM 1 — TELA DE LOGIN DO COMMAND CENTER WEB]                  |
| Legenda: Interface moderna com acabamento escuro e detalhes ouro.  |
+-------------------------------------------------------------------+
```

### Perfis de Acesso:
* **Admin**: Acesso total a configurações, integrações de banco de dados e controle multi-tenant.
* **Supervisor**: Focado em auditar rotas, aprovar recomendações de promotores e revisar alertas de conformidade.
* **Trade**: Responsável por precificação, metas de planograma e importação física de cadastros (PDVs).

```
+-------------------------------------------------------------------+
| [IMAGEM 2 — TELA DE GESTÃO DE USUÁRIOS E PERFIS DE ACESSO]        |
| Legenda: Tabela administrativa listando papéis (Supervisor, Trade).|
+-------------------------------------------------------------------+
```

---

## 2. ENTENDENDO O DASHBOARD & ABAS DE INTELIGÊNCIA

Ao fazer o login, você é direcionado para a tela central da plataforma.

```
+-------------------------------------------------------------------+
| [IMAGEM 3 — TELA INICIAL DO COMMAND CENTER: QUADRO OPERACIONAL]   |
| Legenda: Resumo de eficiência diária, cobertura de rotas e alertas.|
+-------------------------------------------------------------------+
```

O Command Center é dividido em abas modulares dedicadas a cada dimensão do negócio:

* **AI Vision**: Auditoria de imagens enviadas pelos promotores. Exibe conformidade física e detecções do Shelf AI.
* **Price Intelligence**: Painel de conformidade de preços contra tabelas sugeridas, margens de lucro de lojistas e concorrência.
* **Route Intelligence**: Estatísticas de deslocamento, tempo útil em loja e SLAs operacionais.
* **Sell-Out**: Otimização de giro de estoque, previsão matemática de ruptura e pedidos sugeridos de reposição.
* **Prescriptive AI**: Painel de recomendações automáticas da IA e simuladores de retorno financeiro (ROI).
* **AI Governance**: Configurações de autonomia da IA e snapshots históricos de políticas por empresa.

```
+-------------------------------------------------------------------+
| [IMAGEM 4 — MENUS LATERAIS E BOTÃO DE NAVEGAÇÃO DE ABAS DE IA]    |
| Legenda: Detalhe das abas operacionais do Command Center.          |
+-------------------------------------------------------------------+
```

---

## 3. IMPORTAÇÃO DE PDVs (MÓDULO CRÍTICO)

A importação manual ou em lote dos PDVs (Pontos de Venda) é uma ação crítica. Se a base de PDVs estiver desatualizada, a roteirização automática calculará trajetos incorretos.

### 3.1 Onde Importar PDVs
Navegue no menu principal em: **Admin** -> **Importação de PDVs**.

```
+-------------------------------------------------------------------+
| [IMAGEM 5 — TELA DE IMPORTAÇÃO DE ARQUIVOS DE PDVS NO PAINEL ADMIN]|
| Legenda: Botão de arrastar arquivos XLSX/CSV para processamento.   |
+-------------------------------------------------------------------+
```

### 3.2 Estrutura da Planilha
A planilha deve estar em formato CSV ou XLSX com cabeçalhos exatos em minúsculo:

| Coluna | Tipo | Obrigatório? | Descrição |
| :--- | :--- | :--- | :--- |
| `cod_parceiro` | Texto | **Sim** | Código único do cliente no sistema ERP da Coffee Mais. |
| `nome_pdv` | Texto | **Sim** | Nome de cadastro ou razão social do estabelecimento. |
| `endereco` | Texto | **Sim** | Endereço completo (Rua, Número, Bairro). |
| `cidade` | Texto | **Sim** | Cidade da operação. |
| `uf` | Texto (2 carac) | **Sim** | Sigla do Estado da federação (ex: MG, SP). |
| `cluster_canal` | Texto | **Sim** | Tipo do PDV (ex: `SUPERMERCADO`, `CONVENIENCIA`, `HIPERMERCADO`). |
| `faturamento_mensal` | Numérico | **Sim** | Faturamento médio do PDV (importante para cálculo de SLA). |
| `latitude` | Decimal | Não | Coordenada geográfica para GPS (opcional, mas recomendado). |
| `longitude` | Decimal | Não | Coordenada geográfica para GPS (opcional, mas recomendado). |
| `rede` | Texto | Não | Nome da rede de supermercados (ex: Carrefour, Pão de Açúcar). |

```
+-------------------------------------------------------------------+
| [IMAGEM 6 — EXEMPLO DE PLANILHA DE PDVS FORMATADA CORRETAMENTE]   |
| Legenda: Visualização de linhas e colunas exatas em formato Excel. |
+-------------------------------------------------------------------+
```

### 3.3 Fluxo de Upload
1. Arraste a planilha de PDVs para a área de upload.
2. O sistema executará uma validação preliminar de integridade.
3. Se houver erros, a plataforma listará as linhas e colunas com falhas.
4. Caso a validação de 100% de integridade retorne sucesso, clique em **CONFIRMAR IMPORTAÇÃO**.

```
+-------------------------------------------------------------------+
| [IMAGEM 7 — TELA DE VALIDAÇÃO DE IMPORTAÇÃO COM ACERTO VERDE]    |
| Legenda: Tabela indicando 'Sucesso: 150 PDVs prontos para carga'.|
+-------------------------------------------------------------------+
```

```
+-------------------------------------------------------------------+
| [IMAGEM 8 — TELA COM LINHAS DE ERROS APONTADAS NA IMPORTAÇÃO]     |
| Legenda: Alertas vermelhos apontando 'Código duplicado na linha 14'|
+-------------------------------------------------------------------+
```

---

## 4. CONFIGURAÇÃO DE SLA (MÓDULO CRÍTICO)

O SLA define o **tempo ideal estimado que o promotor deve permanecer em loja** para concluir as auditorias com qualidade.

```
+-------------------------------------------------------------------+
| [IMAGEM 9 — PAINEL DE CONFIGURAÇÃO DE SLAS OPERACIONAIS POR PDV]  |
| Legenda: Ajuste de minutos de permanência baseados em faturamento. |
+-------------------------------------------------------------------+
```

### 4.1 Tempo de SLA por Faixa de Faturamento

Para manter a conformidade operacional, os SLAs da Coffee Mais são agrupados pelo faturamento da loja:

* **Faixa A (Até R$ 20.000,00/mês)**: SLA = **20 minutos**
* **Faixa B (De R$ 20.000,01 a R$ 50.000,00/mês)**: SLA = **35 minutos**
* **Faixa C (De R$ 50.000,01 a R$ 100.000,00/mês)**: SLA = **50 minutos**
* **Faixa D (Acima de R$ 100.000,00/mês)**: SLA = **70 minutos**

### 4.2 Por que o Faturamento Importa para o SLA?
Supermercados maiores e de faturamento elevado possuem frentes de gôndola extensas, maior número de SKUs cadastrados, maior reposição no estoque de apoio e exigem auditorias mais detalhadas. Se aplicarmos o mesmo SLA padrão de 20 minutos para hipermercados grandes, o promotor será forçado a efetuar checkouts com pressa, o que compromete a qualidade da foto ou a reposição física dos cafés.

---

## 5. CONFIGURAÇÕES DE ROTEIRIZAÇÃO QUE IMPACTAM TEMPO

Além do tempo básico de SLA de permanência, tarefas específicas executadas pelo promotor na loja somam tempo adicional calculado pela IA para as rotas:

```
+-------------------------------------------------------------------+
| [IMAGEM 10 — PAINEL DE AJUSTE DE INCREMENTOS DE TAREFAS DE ROTA]  |
| Legenda: Sliders para ativação de tempo extra de auditorias.       |
+-------------------------------------------------------------------+
```

* **FIFO (Primeiro que entra, primeiro que sai)**: Caso ativado, soma **+10 minutos** ao tempo útil de visita para permitir o alinhamento físico das validades dos produtos na frente da gôndola.
* **AI Photo (Auditoria por Fotos)**: Caso ativado, soma **+5 minutos** para o enquadramento de gôndola e processamento local preliminar.
* **Price OCR**: Caso ativado, soma **+5 minutos** para escanear e validar as etiquetas de preço físicas.
* **Ruptura Detalhada**: Caso ativado, soma **+8 minutos** para auditoria manual no estoque de apoio caso o Shelf AI detecte frentes zeradas.
* **Degustação (Ações Sazonais)**: Caso ativado, soma **+20 minutos** para conferência e manutenção do stand de degustação ativa.

---

## 6. COMO A ROTEIRIZAÇÃO INTELIGENTE FUNCIONA (CÁLCULO)

A IA de roteirização busca maximizar a quantidade de visitas produtivas minimizando o tempo e o custo de deslocamento do promotor de vendas.

```
+-------------------------------------------------------------------+
| [IMAGEM 11 — GRÁFICO DO CÁLCULO DE JORNADA E DIVISÃO DE MINUTOS]  |
| Legenda: Divisão visual de deslocamento, refeição e tempo em loja.|
+-------------------------------------------------------------------+
```

### A Fórmula de Capacidade
A jornada de trabalho padrão de um promotor é de **8 horas diárias (480 minutos)**, com acréscimo de 60 minutos de intervalo de almoço obrigatório por lei, totalizando **540 minutos**.

O cálculo de tempo útil realizado pela IA é:

$$\text{Tempo Útil para Lojas} = \text{Jornada Total} - (\text{Tempo de Almoço} + \text{Tempo Estimado de Deslocamento})$$

#### Exemplo Prático:
* **Jornada**: 540 minutos
* **Almoço**: 60 minutos
* **Deslocamento Acumulado (GPS)**: 90 minutos
* **Tempo Útil em Loja**: $540 - (60 + 90) = 390\text{ minutos}$

Se a média de SLA configurada para o conjunto de lojas daquele promotor no dia for de **39 minutos por visita**:

$$\text{Capacidade de Visitas} = \frac{390}{39} = 10\text{ visitas por dia}$$

> [!IMPORTANT]
> Se o tempo de deslocamento subir devido a trânsito ou balanceamento de roteiro ruim, a capacidade de visitas do promotor será reduzida automaticamente pela IA para manter a conformidade do SLA.

---

## 7. AJUSTANDO A ROTA & BALANCEAMENTO DE CARTEIRAS

O supervisor de Trade Marketing deve acompanhar diariamente o balanceamento das carteiras dos promotores de vendas para evitar sobrecarga ou subutilização de pessoal.

```
+-------------------------------------------------------------------+
| [IMAGEM 12 — TELA DE BALANCEAMENTO E DISTRIBUIÇÃO DE CARTEIRAS]   |
| Legenda: Mapa de calor comparando a carga horária dos promotores.  |
+-------------------------------------------------------------------+
```

* **Cenário de Sobrecarga**: O promotor A possui 18 lojas em um setor congestionado (inviável de cumprir os SLAs). A IA sinalizará o card em vermelho.
* **Cenário de Subutilização**: O promotor B possui apenas 5 lojas próximas (subutilizado).
* **Solução**: Use a ferramenta de laço de mapa (lasso tool) para redistribuir geograficamente os PDVs de um promotor para outro diretamente na interface, forçando a IA a recalcular a malha de trajetos instantaneamente.

```
+-------------------------------------------------------------------+
| [IMAGEM 13 — APLICAÇÃO DA FERRAMENTA LAÇO (LASSO TOOL) NO MAPA]   |
| Legenda: Desenho no mapa englobando 5 PDVs para remanejamento.    |
+-------------------------------------------------------------------+
```

---

## 8. AUDITORIA DE FOTOS & REPROCESSAMENTO DE IMAGENS

Na aba **AI Vision**, o supervisor pode auditar a qualidade e os resultados obtidos pela Inteligência Artificial nas fotos enviadas de campo.

```
+-------------------------------------------------------------------+
| [IMAGEM 14 — TELA DE AUDITORIA DE IMAGENS NO COMMAND CENTER]      |
| Legenda: Grid de fotos enviadas de campo organizadas por promotor. |
+-------------------------------------------------------------------+
```

### Ações Disponíveis:
* **Visualizar Detecção**: Abre a imagem original com os retângulos de detecção dos SKUs.
* **Reprovar Foto**: Caso a imagem esteja tremida ou fora do padrão de enquadramento, o supervisor pode marcar como "Reprovada". O promotor receberá uma notificação em campo solicitando nova foto na próxima visita.
* **Reprocessar Análise**: Se houver atualização recente no modelo de IA de leitura, clique em "Reprocessar" para rodar a análise de imagem novamente no servidor sem precisar de uma nova visita de campo.

```
+-------------------------------------------------------------------+
| [IMAGEM 15 — BOTÕES DE APROVAÇÃO, REPROVAÇÃO E REPROCESSAR VISÃO] |
| Legenda: Detalhes das opções administrativas de auditoria visual. |
+-------------------------------------------------------------------+
```

---

## 9. PAINEL PRICE INTELLIGENCE

A aba **Price Intelligence** exibe a conformidade da estratégia de preços da Coffee Mais em tempo real.

```
+-------------------------------------------------------------------+
| [IMAGEM 16 — PAINEL DE ANÁLISE DE PREÇOS E PRICE COMPLIANCE]      |
| Legenda: Gráfico de dispersão de preços medidos vs. preços ideais. |
+-------------------------------------------------------------------+
```

### Termos Chave:
* **Price Gap**: A diferença percentual medida entre o preço praticado pela Coffee Mais em relação ao principal concorrente monitorado no PDV.
* **Anomalia de Preço**: Ocorrências onde o preço praticado está fora do intervalo máximo ou mínimo configurado de conformidade.
* **Competitor Promo**: IA identifica e sinaliza quando a marca concorrente entra em promoção agressiva na mesma gôndola.

---

## 10. PAINEL ROUTE INTELLIGENCE

A aba **Route Intelligence** monitora o cumprimento físico das rotas de campo e a aderência das visitas.

```
+-------------------------------------------------------------------+
| [IMAGEM 17 — MAPA DE CALOR DE COBERTURA DE VISITAS DE ROTEIROS]   |
| Legenda: Densidade de cobertura por rotas regionais mapeadas.    |
+-------------------------------------------------------------------+
```

### Métricas Críticas:
* **Coverage Gap (Lacuna de Cobertura)**: Lojas ativas cadastradas que ficaram sem nenhuma visita nos últimos 14 dias.
* **Aderência ao Trajeto**: Mede se o promotor seguiu a ordem sequencial calculada ou efetuou desvios excessivos de rota.

---

## 11. PAINEL SELL-OUT INTELLIGENCE

Fornece uma visão preditiva das vendas diretas no supermercado, antecipando falhas logísticas.

```
+-------------------------------------------------------------------+
| [IMAGEM 18 — ANÁLISE DE PREVISÃO DE RUPTURAS E DADOS DE SELL-OUT] |
| Legenda: Gráfico de barras indicando risco de ruptura por produto.|
+-------------------------------------------------------------------+
```

### Funcionalidades:
* **Rupture Forecast**: IA calcula e aponta quais lojas ficarão desabastecidas nos próximos 3 a 7 dias caso não ocorra faturamento de pedido.
* **Slow Mover**: Sinaliza SKUs que estão sem venda há mais de 10 dias no PDV para ações promocionais de trade (degustação).

---

## 12. PAINEL PRESCRIPTIVE AI (SIMULADOR & ROI)

É o motor central de geração de recomendações inteligentes para otimização da operação.

```
+-------------------------------------------------------------------+
| [IMAGEM 19 — INTERFACE DO SIMULADOR DE INVESTIMENTOS EM TRADE]    |
| Legenda: Configuração de descontos e estimativa de ROI realizado.  |
+-------------------------------------------------------------------+
```

### Simulador de Trade:
Permite que o supervisor simule ações promocionais em lote antes de aplicá-las em campo.
* *Exemplo*: Selecione 10 lojas de faturamento C, simule um desconto de 8% e avalie o ROI projetado e a estimativa de uplift de sell-out antes de disparar a recomendação para os promotores.

---

## 13. PAINEL AI GOVERNANCE (CONTROLES DE AUTONOMIA)

A aba **AI Governance** gerencia a liberdade de tomada de decisão autônoma da Inteligência Artificial por tenant.

```
+-------------------------------------------------------------------+
| [IMAGEM 20 — SLIDERS DE AUTONOMIA DA IA NO PAINEL GOVERNANCE]     |
| Legenda: Opções de autonomia: MANUAL, ASSISTED, SEMI e FULLY.     |
+-------------------------------------------------------------------+
```

### Modos de Autonomia:
1. **MANUAL**: A IA gera insights, mas nenhuma ação é sugerida ou enviada a campo sem aprovação manual prévia do supervisor.
2. **ASSISTED**: A IA gera as recomendações e pré-configura os campos, aguardando apenas o clique de aprovação única do supervisor para liberar o lote.
3. **SEMI_AUTONOMOUS (Padrão)**: Ações simples (como agendar visita extra por quebra de SLA ou abastecer estoque com risco de ruptura) são enviadas a campo automaticamente. Ações comerciais complexas (como concessão de descontos e verbas de degustação) ficam travadas aguardando aprovação manual.
4. **FULLY_AUTONOMOUS**: A IA possui total autonomia para disparar inclusive pedidos sugeridos diretamente para o distribuidor integrado caso identifique anomalias de estoque críticas.

```
+-------------------------------------------------------------------+
| [IMAGEM 21 — HISTÓRICO DE CONFIGURAÇÕES DE VERSÕES (SNAPSHOTS)]   |
| Legenda: Tabela exibindo versões de calibrações salvas por data.  |
+-------------------------------------------------------------------+
```

---

## 14. MELHORES PRÁTICAS DE GESTÃO DE TRADE

* **Revisão Semanal**: Dedique a manhã de segunda-feira para revisar e aprovar as recomendações pendentes na fila de aprovação.
* **Auditoria de SLAs**: Reavalie mensalmente os SLAs de visita das lojas. Lojas com alta taxa de ruptura e conformidade de gôndola ruim geralmente exigem aumento de 10 a 15 minutos no SLA de visita.
* **Higienização de Cadastros**: Remova ou inative lojas que ficaram mais de 60 dias sem movimentação de compra ou visitas operacionais.

---

## 15. FAQ — PERGUNTAS FREQUENTES (40 QUESTÕES)

### Q1: O que é o Command Center da Coffee Mais AI Platform?
É o portal web completo de gestão operacional, inteligência de negócios, auditoria de imagens de campo e governança de Inteligência Artificial para supervisores e gestores da marca.

### Q2: Quais navegadores são recomendados para acessar o painel?
A interface foi otimizada para o Google Chrome, Microsoft Edge e Mozilla Firefox em versões modernas com suporte a aceleração gráfica por hardware para renderização de mapas 3D.

### Q3: Como altero a senha de um promotor de vendas?
Acesse Admin -> Usuários, procure o nome do promotor, selecione "Redefinir Senha de Acesso" e gere um código temporário de 6 caracteres.

### Q4: O que acontece se a soma dos pesos dos KPIs habilitados for diferente de 100% no painel?
O servidor da API rejeitará a operação e retornará erro HTTP 400 Bad Request. A soma de todos os pesos ativos configurados para a empresa deve ser matematicamente de exatamente 100%.

### Q5: O que é a ferramenta Lasso (Laço) no painel de rotas?
É uma ferramenta de mapa que permite desenhar círculos ao redor de pontos de venda dispersos no mapa para remanejar lojas em lote entre promotores de forma ágil.

### Q6: De onde vêm as coordenadas de latitude e longitude dos PDVs?
Elas podem ser carregadas na planilha de importação de PDVs. Caso não sejam informadas, o sistema coletará o ponto de GPS exato no momento em que o promotor fizer o primeiro check-in bem-sucedido na loja.

### Q7: O que é o "SLA de Visita"?
É o tempo padrão em minutos alocado e planejado para a execução de todas as tarefas de auditoria e organização dentro do ponto de venda.

### Q8: Como o faturamento mensal interfere no cálculo de SLA?
Hipermercados e lojas de grande porte (faturamento >100k) possuem categorias de gôndola muito extensas e maior estoque de retaguarda, demandando mais tempo de permanência física do promotor.

### Q9: O que é o "FIFO" nas configurações adicionais de roteirização?
É o acréscimo de tempo (+10 minutos) que garante que o promotor organizará as prateleiras de forma que os produtos de validade mais próxima fiquem expostos à frente da gôndola.

### Q10: Como o sistema calcula o tempo útil diário do promotor?
Subtrai da jornada legal (480 minutos) o tempo médio estimado de tráfego entre lojas obtido via API de trânsito em tempo real mais o tempo de almoço (60 minutos).

### Q11: O que é o "Coverage Gap" (Lacuna de Cobertura)?
É o indicador de risco que mostra lojas ativas em carteira que ficaram sem receber visitas produtivas nos últimos 14 dias.

### Q12: Como a IA estima o estoque sem integração direta com o ERP do cliente?
Ela usa um algoritmo matemático que desconta a velocidade histórica média de vendas diárias do supermercado (sell-out) da quantidade de produtos entregues (faturados).

### Q13: O que é um alerta de "Slow Mover"?
É o alerta gerado pela IA quando identifica que um determinado produto Coffee Mais de alto valor agregado ficou sem vendas registradas no PDV por mais de 10 dias seguidos.

### Q14: Como aprovar uma recomendação na fila de "Requires Approval"?
Vá na aba Prescriptive AI -> Painel de Aprovações, clique na recomendação pendente, revise a taxa de ROI simulada e clique em "Aprovar Ação".

### Q15: É possível rejeitar uma recomendação sem dar justificativa?
Não. A plataforma obriga o preenchimento de uma justificativa de override comercial para que a IA possa compreender por que a recomendação foi negada pelo supervisor.

### Q16: O que é um "Snapshot de Versão de Configurações"?
É o backup instantâneo da estrutura completa de regras do tenant gerado automaticamente sempre que houver alteração de pesos de KPIs ou regras de governança da IA.

### Q17: Como exportar os dados consolidados do painel para planilha Excel?
Qualquer grid de dados (como lista de rotas ou relatórios de auditorias) possui um botão superior direito rotulado "Exportar XLSX".

### Q18: Como a IA faz a detecção de preços via imagem?
Ela localiza etiquetas na imagem através de modelos de detecção de caixas e lê o texto do valor usando a inteligência integrada OCR (Optical Character Recognition).

### Q19: O que significa o alerta de "Price Anomaly"?
Indica que o preço detectado pelo promotor no ponto de venda está posicionado abaixo ou acima dos limites extremos estabelecidos pela gerência de Trade.

### Q20: Como auditar fotos borradas enviadas do campo?
Na aba AI Vision, selecione a foto com baixa nitidez, clique em "Reprovar" e justifique a recusa. O promotor será orientado no próximo check-in a reenviar a foto.

### Q21: O que é o "Closed Loop Learning" na prática administrativa?
É o mecanismo de validação da IA. O sistema monitora a venda real (sell-out) pós-ação em campo para recalibrar o impacto financeiro futuro do modelo.

### Q22: O que é o "Model Drift"?
É o alerta gerado caso a acurácia geral das predições da IA sofra uma degradação significativa acima do limite permitido da política de governança de TI.

### Q23: O que é "Emergency AI Stop" (Parada de Emergência)?
É o botão de pânico global nas configurações de governança. Se ativado, inibe as ações autônomas da IA e força todas as recomendações para aprovação manual.

### Q24: O que significa a métrica "Planogram Compliance"?
É a nota de 0 a 100% que reflete o quanto a organização dos produtos expostos pelo promotor corresponde ao modelo de exibição homologado.

### Q25: Como funciona a auditoria de preços da concorrência?
O promotor captura fotos contendo etiquetas de marcas concorrentes no mesmo bloco de exposição. O OCR lê os preços rivais para monitorar o posicionamento de preço.

### Q26: Posso agendar visitas avulsas para um promotor fora de sua rota padrão?
Sim. Vá em Rotas -> Visitas Rápidas, selecione o promotor, a loja e a data e agende a visita. A IA reordenará o trajeto do dia para acomodar a nova parada.

### Q27: O que são "Alternative Actions" (Ações Alternativas) no painel?
São as opções descartadas pela IA antes de gerar a recomendação final, exibidas no painel de auditoria de decisões para avaliação da lógica do sistema.

### Q28: Quem é o responsável por cadastrar os novos SKUs da marca na plataforma?
A administração corporativa central (geralmente por meio de integração direta de sistema ou suporte técnico do sistema SaaS).

### Q29: Como configurar regras de desconto máximo permitidas para a IA?
Na aba AI Governance, vá em Parâmetros Comerciais e defina o valor no campo de "Desconto Máximo Permitido (em %)".

### Q30: De quanto em quanto tempo o sistema recalcula os desvios de rota?
O recálculo de rotas e acompanhamento de GPS em tempo real acontece em intervalos aproximados de 5 a 15 minutos em campo.

### Q31: O que fazer se uma foto correta for rejeitada pelo processamento da IA?
Abra a foto na aba AI Vision, ajuste manualmente as leituras de detecção e selecione "Salvar Leitura Corrigida" para alimentar a base de treinamento da IA.

### Q32: O que significa o indicador "Aderência ao Roteiro"?
É a porcentagem que mede o quanto a ordem física de visitas realizadas pelo promotor seguiu a ordem inteligente projetada no início do dia.

### Q33: É possível restaurar uma configuração de pesos de KPIs anterior?
Sim, selecione a versão desejada na tabela de Snapshots Históricos e clique em "Restaurar Snapshot". O sistema gerará uma nova versão com os pesos restaurados.

### Q34: O que significa a métrica "Out of Stock Rate"?
Mete a taxa percentual de produtos da Coffee Mais cadastrados no PDV que se encontram em falta ativa nas prateleiras ou sem estoques.

### Q35: Qual perfil do usuário pode realizar importação de PDVs?
Apenas usuários configurados com o nível de privilégio "Admin" ou "Trade" possuem permissões de gravação de carga de planilhas.

### Q36: O que é o "Route Efficiency" (Eficiência de Rotas)?
É a relação matemática de aproveitamento de tempo entre horas produtivas de permanência em loja contra horas desperdiçadas em deslocamento urbano.

### Q37: O que significa o alerta "Autonomous Action Spike"?
Alerta disparado caso o sistema de IA dispare em lote um volume incomum e estatisticamente alto de ações de aprovação automatizada em 24h.

### Q38: É possível monitorar mais de uma concorrência por canal?
Sim, o sistema permite configurar no painel de concorrência múltiplas marcas rivais de café especial por região de mercado.

### Q39: O que é o "Uplift de Margem" exibido nos simuladores?
É a estimativa financeira em valor monetário que a Coffee Mais espera lucrar (margem líquida de lucro) com o aumento de vendas projetado.

### Q40: Quem recebe os alertas de degradação do modelo de IA?
E-mails automatizados e notificações no Command Center são disparados imediatamente para supervisores, líderes de Trade Marketing e analistas de TI da empresa.

---

## 16. GLOSSÁRIO DE TERMOS OPERACIONAIS

* **Command Center**: Painel web de administração central.
* **Lasso Tool**: Ferramenta de seleção de pontos geográficos em lote no mapa.
* **Overlapping (Costura)**: Sobreposição de 20% das imagens de fotos de gôndola para mapeamento correto de categorias.
* **SLA (Service Level Agreement)**: Tempo alocado e planejado para a execução de visitas e auditorias no PDV.
* **SSO (Single Sign-On)**: Autenticação única integrada de segurança corporativa.
