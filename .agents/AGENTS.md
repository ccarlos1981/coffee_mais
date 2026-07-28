# Project-Scoped Rules: Coffee Mais Hub de Importação

## Modo de Estabilização Ativo
A partir de 06/07/2026, o Hub de Importação de Dados e todo o ecossistema do Coffee++ entraram oficialmente em fase de estabilização.

### Regras Mandatórias de Estabilização:
1. **Não refatorar código que já funciona**: Evitar qualquer refatoração de código que esteja operacional.
2. **Preservar a arquitetura existente**: Não alterar a arquitetura ou infraestrutura atual.
3. **Não substituir componentes sem necessidade**: Evitar substituições de componentes visuais ou lógicos estáveis.
4. **Preservar regras de negócio homologadas**: Não alterar regras de domínio já validadas e em produção.
5. **Sem melhorias estéticas não solicitadas**: Não realizar ajustes de estilo ou layout sem solicitação expressa.
6. **Não alterar APIs públicas**: Preservar contratos de rotas e serviços existentes para evitar quebras.
7. **Abordagem Incremental**: Toda alteração deve ser uma extensão incremental e retrocompatível.
8. **Verificação Prévia**: Verificar se uma lógica ou serviço (ex: `ProdutoConversaoService`) já existe antes de codificar. Reutilizar sempre para evitar duplicação.
9. **Minimização de Impacto**: Havendo múltiplas abordagens de implementação, adotar a que cause menor atrito e impacto no sistema global.

### Lista de Verificação Obrigatória (Fim de Sprint):
* Executar `npx tsc --noEmit` para garantir ausência de erros de tipagem.
* Executar `npm run build` para garantir que o pacote Next.js compila perfeitamente.
* Validar lints, migrações SQL, integridade de RLS e garantir ausência total de regressões.

---

## 4. Diretrizes de Master Data e Conversão Logística (Coffee++)
A partir de 06/07/2026, o **Cadastro Mestre de Conversão Logística** torna-se um componente de domínio oficial do Coffee++.
Qualquer desenvolvimento futuro que manipule produtos ou volumes de venda deve seguir rigorosamente as regras abaixo:

1. **Sem Cálculos Próprios**: Nenhum módulo ou funcionalidade poderá implementar cálculos próprios de conversão física entre Unidades (UN), Caixas ou Kg.
2. **Exclusividade do Serviço**: Toda conversão lógica do sistema deve consumir exclusivamente o `ProdutoConversaoService`.
3. **Sem Hardcoding**: Nenhum valor de fator logístico (ex: 20 un/caixa, 12 un/caixa, etc.) poderá ficar fixo (hardcoded) no frontend, backend, SQL, relatórios, dashboards, RPCs ou automações.
4. **Verificação Prévia**: Ao criar novos fluxos ou módulos que manipulem produtos, verifique e integre o `ProdutoConversaoService` antes de introduzir qualquer regra aritmética de volume.
5. **Fonte Única de Verdade (Single Source of Truth)**: O Cadastro Mestre (`cm_skus_conversao`) é o único regulador do sistema para obter:
   * Unidades por caixa;
   * Peso unitário da embalagem;
   * Peso total por caixa;
   * Conversões físicas cruzadas;
   * Vigências das regras de embalagem.
6. **Preservação de Compatibilidade**: Qualquer evolução deste domínio deve preservar compatibilidade reversa com os módulos consumidores existentes (Promotor, Investimentos, Planejamento, Faturamento, Dashboards/BI e futuros módulos).
7. **Privilegiar Reutilização**: Em vez de criar tabelas, serviços ou regras paralelas de volume ou faturamento, sempre privilegie e reaproveite as estruturas do Master Data.

---

## 5. Baseline Oficial da Arquitetura do Módulo de Investimentos (Sprints 6, 7 e 8)
A partir de 09/07/2026, as conclusões das Sprints 6, 7 e 8 tornam-se o baseline oficial e permanente da arquitetura do módulo de Investimentos.
Qualquer alteração ou novo desenvolvimento deve seguir estritamente as regras abaixo:

1. **Modelo Consolidado e Congelado**: O modelo relacional `Campanha (1) -> N Ações Independentes` é a arquitetura definitiva do módulo.
2. **Alterações Estruturais Bloqueadas**: Não propor alterações em `cm_campanhas`, `cm_acoes_investimento`, fluxo financeiro consolidado ou dashboard agrupado sem justificativa e aprovação explícita.
3. **Legado Congelado**: As estruturas antigas (`cm_investimento_familias`, `cm_investimento_familias_history`, `familias_detalhes`, `skus_detalhes`) permanecem em modo somente leitura (read-only) e intocadas durante o período de estabilização.
4. **Data Alvo para DROP Físico**: A data oficial recomendada para avaliação e execução da migração de remoção física definitiva do legado é **09/08/2026** (30 dias após o go-live).
5. **Diretrizes para Novas Funcionalidades**: Todo novo recurso ou lógica deve consumir e operar exclusivamente sobre as entidades do novo modelo (Campanhas, Ações unitárias desmembradas, checklists diretos na ação, array de evidências na ação e status financeiros na campanha/ação).
6. **Passos Obrigatórios Pré-DROP**: Antes de aplicar a migração de DROP físico futuro, é mandatório:
   - Executar auditoria minuciosa de referências no código-fonte.
   - Validar o histórico de estabilidade dos snapshots na tabela `cm_investimentos_daily_snapshots`.
   - Executar a RPC `check_investimentos_integrity()` e obter zero inconsistências.
   - Garantir build Next.js completo com sucesso.
   - Realizar teste manual fim-a-fim nos fluxos de lançamento, trade e financeiro.
7. **Mitigação de Riscos**: Qualquer anomalia ou risco arquitetural identificado durante o período de estabilização deve ser registrado e informado de imediato.

---

## 6. Regra Funcional Permanente — Cobertura Comercial
O dashboard de Investimentos passa a suportar o conceito de Cobertura Comercial da carteira.

### Definições:
- **Rede com ação**: Possui pelo menos uma ação cadastrada para o período selecionado.
- **Rede sem ação**: Não possui nenhuma ação cadastrada para o período selecionado, respeitando todos os filtros ativos da tela (gerente, período, região, rede, etc.).

### Objetivos da funcionalidade:
- Identificar oportunidades não trabalhadas.
- Medir cobertura comercial da carteira.
- Apoiar planejamento e fechamento mensal.
- Facilitar acompanhamento gerencial e definição de metas.

### Indicadores derivados:
- Redes ativas
- Redes com ação
- Redes sem ação
- Cobertura comercial (%)

### Fórmula oficial:
Cobertura Comercial (%) = (Redes com ação / Total de redes ativas) * 100

Esta funcionalidade possui caráter analítico e não altera qualquer comportamento operacional, financeiro ou arquitetural do modelo Campanha → Ações Independentes.

---

## 7. Regra Funcional Permanente — Identidade de Redes e Matrizes

### Redes com código de matriz compartilhado
O sistema deve permitir a coexistência de múltiplas redes utilizando o mesmo `codigo_matriz`, desde que pertençam a contextos operacionais distintos (regional, gerente responsável ou unidade comercial diferente).

Exemplos:
- ZAFFARI
- ZAFFARI (CESTO)

Estas entidades são consideradas redes independentes para fins operacionais, comerciais e de planejamento de investimentos.

---

### Chave lógica de identificação operacional
A identificação operacional de uma rede não deve utilizar exclusivamente o `codigo_matriz`. A identificação deverá considerar o conjunto:
- código da matriz
- nome da rede
- gerente responsável
- regional (quando aplicável)

---

### Regra de exibição para seleção de redes
As interfaces de seleção de redes devem exibir informações suficientes para eliminar ambiguidades operacionais, incluindo:
- UF
- Regional
- Gerente responsável

Formato recomendado:
`[Nome da Rede] (UF - Regional - Gerente)`

Exemplo:
`ZAFFARI (RS - Sul - Leandro)`
`ZAFFARI (SP - Sudeste - Julliano)`

---

### Regra de diferenciação visual
Quando múltiplas redes compartilham o mesmo código de matriz, o sistema poderá utilizar identificadores visuais auxiliares (como incrementos decimais virtuais `.1`, `.2` etc. no código de exibição) para facilitar a seleção do usuário. 
Esses identificadores possuem finalidade exclusivamente visual e não devem ser utilizados como chave de negócio, chave de integração ou relacionamento financeiro.

---

### Integridade de faturamento
O `codigo_matriz` original permanece como a referência oficial para integrações de faturamento, BI e sistemas externos, não devendo sofrer alterações físicas ou transformações persistidas.

---

## 8. Baseline Oficial — Divergência Operacional de Calendário (Trade Fase 2)
A partir de 10/07/2026, a funcionalidade de **Divergência Operacional de Calendário** torna-se componente oficial do módulo de Investimentos, sob período de estabilização e monitoramento.

### Princípio fundamental
O calendário comercial planejado permanece **imutável** nos campos originais da ação (`data_inicio`, `data_fim`). Divergências operacionais são registradas **exclusivamente** nos campos de execução real, preservando a rastreabilidade entre planejamento comercial e execução Trade.

### Estrutura de dados oficial
Colunas em `cm_acoes_investimento` (adicionadas em 10/07/2026):
- `possui_divergencia_calendario` — `BOOLEAN DEFAULT FALSE`
- `data_inicio_real` — `DATE NULL`
- `data_fim_real` — `DATE NULL`
- `motivo_divergencia_calendario` — `motivo_divergencia_enum NULL`
- `observacao_divergencia` — `TEXT NULL`

Enum Postgres `motivo_divergencia_enum` com valores controlados:
`ATRASO_LOGISTICO`, `ALTERACAO_REDE`, `ALTERACAO_COMERCIAL`, `PROBLEMA_OPERACIONAL_LOJA`, `RUPTURA_ESTOQUE`, `ALTERACAO_ENCARTE`, `OUTROS`

Constraint física de integridade: `chk_divergencia_calendario` — garante apenas dois estados válidos em qualquer origem de escrita.

### Dois estados válidos (exclusivos)
1. **Sem divergência:** `possui_divergencia_calendario = false` e todos os campos de divergência `NULL`.
2. **Com divergência:** `possui_divergencia_calendario = true` e todos os quatro campos preenchidos, com `data_inicio_real <= data_fim_real`.
Estados intermediários ou parcialmente preenchidos são rejeitados pela constraint Postgres.

### Validação em três camadas obrigatórias
1. **Frontend** — erro inline amigável, botão "Aprovar" bloqueado se divergência marcada e incompleta.
2. **Server Action** (`atualizarChecklistTrade`) — validação programática antes do UPDATE.
3. **Constraint Postgres** (`chk_divergencia_calendario`) — barreira física, independente da origem da escrita.

### Regras operacionais permanentes
1. **A divergência é opcional** e não representa erro operacional automaticamente.
2. **A ausência de divergência não bloqueia aprovação** da ação Trade.
3. **Divergência marcada e incompleta bloqueia aprovação** até que todos os campos sejam preenchidos.
4. **Nenhuma alteração em datas planejadas** (`data_inicio`, `data_fim`) deverá ser realizada manualmente após a criação da ação.
5. **O badge "⚠ Divergência de Calendário"** faz parte da rastreabilidade oficial das ações e deve ser preservado em todas as interfaces que exibam ações da Fase 2+.
6. **Exportações CSV/Excel** devem sempre incluir as 5 colunas de divergência para fins de auditoria e BI.

### Observabilidade futura (sem dashboard nesta sprint)
Os dados ficam preservados para análises futuras de:
- SLA comercial × execução real
- Produtividade operacional do Trade
- Causas de replanejamento
- Taxa de divergência operacional: `taxa_divergencia = acoes_com_divergencia / acoes_aprovadas_trade`

### Arquivos e constantes oficiais
- Constantes: `src/app/investimento/divergencia-constants.ts` (fora do `use server`)
- Enum TypeScript: `MotivoDivergencia` (espelho do enum Postgres)
- Labels amigáveis: `MOTIVOS_DIVERGENCIA` (Record)
- Migration: `supabase/migrations/20260710_divergencia_calendario_trade.sql`

### Regras para evoluções futuras
1. **Reutilizar os campos existentes** — não criar estruturas paralelas de datas de execução.
2. **Qualquer alteração estrutural** nos campos de divergência exige revisão arquitetural explícita e aprovação.
3. **Novos motivos de divergência** devem ser adicionados ao enum Postgres via migration versionada.
4. **Compatibilidade reversa obrigatória** — ações existentes não devem ser afetadas por nenhuma evolução.
5. **A constraint `chk_divergencia_calendario` não deve ser removida ou relaxada** sem aprovação explícita.

---

## 9. Baseline Oficial — Alinhamento de Real Faturamento (MyMetrics / Sankhya)
A partir de 13/07/2026, o indicador **REAL FATURAMENTO** do Coffee++ passa a seguir as mesmas diretrizes de cálculo oficiais consolidadas do MyMetrics (Metabase / Sankhya) para garantir paridade absoluta (desvio máximo tolerável de 0,5%).

### Regras Físicas e Lógicas de Consolidação:
1. **Não deduzir descontos comerciais**: O faturamento líquido real é consolidado diretamente a partir de `vlr_total_liq` sem sofrer subtração de `vlr_desconto`.
2. **Inclusão de Bonificações**: As remessas em bonificação ou brinde (TOP `1117`) devem ser computadas na receita total e na receita de Key Account.
3. **Inclusão de Depósitos Digitais**: As remessas digitais para depósitos fechados/armazéns (TOP `1703` - ex: Shopee) são consideradas receita comercial.
4. **Devoluções Negativas**: As devoluções de vendas (TOPs `1200` e `1201`) reduzem o faturamento líquido através da inversão de sinal (`-ABS(vlr_total_liq)`).
5. **Filtro de TOPs Permitidas**: Apenas as TOPs `1100`, `1117`, `1200`, `1201`, `1703`, `1713` e `1723` são aceitas para consolidação de receita comercial.
6. **Exclusões Obrigatórias**:
   * Operações industriais/encomenda (TOP `1701`) e parceiro `CAFE UTAM S/A` são expurgados.
   * Notas fiscais canceladas (`status_nfe = 'CANCELADA'`) são expurgadas.
   * Transferências/remessas internas não comerciais e o parceiro `COFFEE MAIS INDUSTRIA DE CAFE LTDA` são expurgados.

### Diretriz de Processamento Automático:
* **Sem Intervenção Manual**: A lógica está incorporada permanentemente na definição física das views materializadas (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`).
* Toda nova importação realizada pelo Hub de Importação e subsequente refresh (`refresh_materialized_views()`) aplicarão estas regras automaticamente.
* As views materializadas do banco Supabase mantêm-se como a fonte de verdade para APIs e telas do dashboard (Vendas, Clientes e Positivação).

---

## 10. Governança Financeira Oficial (Coffee++)
A partir de 13/07/2026, o Coffee++ passa a possuir uma única fonte oficial de faturamento corporativo.

### Escopo de Aplicação:
Toda funcionalidade existente ou futura que utilize: faturamento, sell-in, metas, ROI, rankings, positivação, remuneração, IA, previsões, DRE, dashboards, supervisão, promotores, exportações ou indicadores comerciais deverá consumir exclusivamente as estruturas homologadas do ecossistema financeiro oficial.

### Fontes Oficiais:
* `mv_vendas_mensal`
* `mv_vendas_cliente_mensal`
* `mv_positivacao_sku_mensal`
* `public.sales` (alinhada às regras oficiais)
* `base_atendimento.faturamento_mensal` (alinhado às regras oficiais)

### Restrições e Proibições:
* **É proibido** utilizar `SUM(vlr_total_liq)` bruto diretamente sobre a tabela física `cm_faturamento`.
* **É proibido** criar cálculos locais de faturamento, filtros de TOPs próprios ou regras paralelas de descontos.
* **É proibido** duplicar lógica financeira em frontend, APIs ou Server Actions.
* **É proibido** criar novas views financeiras paralelas sem aprovação arquitetural formal.

### Fluxo Obrigatório para Novas Funcionalidades:
Caso uma nova funcionalidade necessite de dados de faturamento, o fluxo obrigatório de implementação será:
1. **Verificar** se uma das fontes oficiais listadas acima já atende ao caso de uso.
2. **Reutilizar** a fonte oficial existente.
3. **Evoluir** a fonte oficial existente caso ela não atenda completamente, em vez de criar outra regra ou estrutura paralela.

### Single Source of Truth Financeira:
A arquitetura de dados deve fluir estritamente no seguinte sentido:
`MyMetrics → Views Oficiais → APIs → Frontend`. Nunca o contrário.
Toda nova implementação financeira deve garantir desvio máximo tolerado de **0,5%** em relação ao MyMetrics.

### Diretrizes de Ação para Evolução:
Sempre que for identificada uma nova funcionalidade envolvendo indicadores financeiros, é mandatório:
1. Validar se ela está utilizando a fonte oficial de dados.
2. Medir impactos financeiros de eventuais divergências encontradas.
3. Propor ou executar a migração do componente para a fonte oficial.
4. Preservar contratos de rotas/serviços existentes para garantir retrocompatibilidade.

### Validação Obrigatória para Pull Requests Financeiros:
Toda alteração que envolva faturamento, ROI, metas, sell-in, positivação, remuneração ou indicadores comerciais deverá obrigatoriamente responder às seguintes perguntas no corpo do PR:
* **Qual fonte oficial está sendo utilizada?** (Deve ser uma das 5 fontes oficiais listadas acima).
* **Existe consulta direta em `cm_faturamento`?** (Se sim, justificar a exceção técnica formal).
* **Existe cálculo local de faturamento?** (Não deve haver lógica aritmética/filtros customizados de TOP no código).
* **Existe divergência superior a 0,5% em relação ao MyMetrics?** (O limite máximo tolerável de desvio é de 0,5%).
* **Houve validação de paridade antes do merge?** (Confirmar a execução do teste de paridade e anexar os resultados).

> [!IMPORTANT]
> Caso qualquer resposta indique uso de fontes não oficiais sem aprovação arquitetural ou desvio financeiro acima de 0,5%, o merge deverá ser bloqueado imediatamente até correção completa.

### Encerramento da Governança Financeira (LOCKED):
A governança financeira do Coffee++ está oficialmente homologada e consolidada.
* **Status Oficial**: `FINANCIAL_GOVERNANCE = LOCKED` e `SINGLE_SOURCE_OF_TRUTH = ENABLED`.
* **Regra Geral**: Qualquer nova divergência financeira deve ser tratada como bug operacional e não como alteração de regra de negócio.
* **Exceções Homologadas**:
  - Infraestrutura de importação (`import-service.ts`).
  - BigQuery Sync (`sync-faturamento/route.ts`).
  - Trigger de sincronização (`tg_fn_sync_faturamento_sankhya_stmt`).
  - API Daily (`/api/dashboard/daily/route.ts`), enquanto não existir uma fonte diária oficial.

---

## 11. Governança Oficial — Favoritos do Dashboard

A tabela `cm_user_favorites` passa a ser a única fonte oficial para personalização da Home do Coffee++.

### Diretrizes Obrigatórias:
1. **Sem armazenamento local**: Nunca persistir favoritos ou sua ordenação em `localStorage`, `sessionStorage` ou cookies.
2. **Utilizar chave única estável**: Nunca utilizar `href` as chave de persistência. Toda persistência deve utilizar exclusivamente `module_key`.
3. **Respeito às regras de segurança (RLS)**: Toda leitura e escrita deve respeitar RLS utilizando `createClient()`. É proibido utilizar `createAdminClient()` ou bypass de RLS para favoritos.
4. **Ordenação Oficial**:
   - A ordenação dos favoritos é persistida exclusivamente na coluna `display_order` da tabela `cm_user_favorites`.
   - O fallback oficial para registros antigos é `created_at ASC`.
   - Toda leitura e escrita deve respeitar as políticas RLS da tabela `cm_user_favorites`.
   - A reordenação ocorre exclusivamente no escopo do usuário autenticado (`user_id = auth.uid()`).
5. **Posicionamento**: A seção Favoritos deve ser sempre renderizada antes das demais categorias do dashboard.
6. **Renderização Condicional**: Caso não existam favoritos, a seção não deve ser renderizada.
7. **Compatibilidade de Novos Módulos**: Novos módulos adicionados ao dashboard deverão obrigatoriamente possuir `module_key` estável e compatibilidade automática com o mecanismo de favoritos.

---

## 12. Baseline Arquitetural Oficial da RPS (Reunião de Planejamento Semanal)

A partir de 13/07/2026, a arquitetura do módulo de RPS passa a seguir um desacoplamento definitivo entre as camadas estratégica (gerente/nacional) e tática (redes/detalhes).

### Diretrizes de Arquitetura:
1. **Desacoplamento de Projeções (Gerente × Redes)**:
   - O compromisso comercial consolidado do gerente (`_TOTAL_`) e a linha do `TOTAL BRASIL` são completamente independentes do faturamento projetado nas redes.
   - As alterações feitas nas células semanais de faturamento das redes NÃO devem somar ou sobrescrever os cabeçalhos dos gerentes.
   - As alterações feitas no cabeçalho do gerente NÃO devem alterar os valores das redes.
2. **Cálculo da Dispersão (DISP)**:
   - A dispersão do gerente (comparação da projeção do mês anterior × execução) utiliza exclusivamente o registro consolidado do gerente (`client_matrix = '_TOTAL_'`). O faturamento das redes não é somado como fallback.
   - A dispersão das redes utiliza exclusivamente a série histórica da própria rede.
3. **Mecanismo de Visibilidade (Top 10)**:
   - O ranking acumulado dos 3 meses fechados (`rankingFat = fatC1 + fatC2 + fatC3`) serve **exclusivamente** como regulador de visibilidade (decidindo quais 10 maiores clientes são listados individualmente e quais são agrupados em `OUTROS`).
   - O ranking não interfere no preenchimento de metas, projeções, preenchimentos automáticos ou em qualquer lógica matemática/financeira subsequente.
4. **Padronização da Formatação Numérica (Visual)**:
   - Todo número inteiro igual ou superior a 1.000 em campos não editáveis (read-only) deve ser exibido com separadores de milhares pt-BR (ex: `1.000`, `125.000`, `1.250.000`).
   - Decimais nos campos read-only devem utilizar vírgula como separador (ex: `1.234,56`).
   - A formatação deve ser puramente visual no frontend, sem alterar a tipagem de dados, payloads de API, fórmulas de BI ou dados persistidos no banco.
   - Percentuais (%) e KPIs baseados em porcentagem (INVEST %, DISP %, %AA, %MA, %DESAFIO) devem continuar sendo renderizados no seu respectivo formato percentual original.
5. **Congelamento de Painéis (Sticky Header)**:
   - Para garantir usabilidade em reuniões comerciais com grande volume de dados (como a visualização de Top 10 Redes por gerente), a tabela da RPS deve manter obrigatoriamente o congelamento do cabeçalho de colunas (Excel-like "Congelar Painéis") durante o scroll vertical da página.
   - Os títulos das colunas (`REGIONAL`, `KPI`, `ANO A`, `MÊS A`, `DESAFIO`, as semanas do mês, e os KPIs percentuais `% DISP`, `% DESAFIO`, `%AA` e `%MA`) e os agrupadores superiores (`PROJEÇÃO DE VENDAS PARA O MÊS` e `ANÁLISE`) devem permanecer permanentemente visíveis e perfeitamente alinhados, sem sofrer desalinhamento de colunas ou sobreposição de células em quaisquer níveis de zoom do navegador (de 90% a 125%).
   - Para evitar conflitos de contêineres de bloco (*containing blocks*), qualquer elemento wrapper (como `.glass-card`) deve ter suas propriedades `transform` e `will-change` desabilitadas na página da RPS.
   - O congelamento deve ser aplicado diretamente no nível dos elementos `th` individualmente de forma controlada (linha 1 com `top: 56px` e linha 2 com `top: 84px` baseando-se em uma altura padronizada de `28px` por linha de cabeçalho).

---

## 13. Ownership Oficial dos Investimentos (Coffee++)
A partir de 14/07/2026, as diretrizes de governança e resolução de ownership comercial de investimentos entram em vigor permanentemente:

1. **Origem Única**: A campanha (`cm_campanhas`) é a única fonte oficial de ownership comercial de investimentos.
2. **Obrigatoriedade de Relacionamento**:
   - Toda campanha deve possuir `gerente_id` obrigatório (`NOT NULL`).
   - Toda ação de investimento deve possuir `campanha_id` obrigatório (`NOT NULL`).
3. **Resolução de Gerente (Sem Fallbacks)**:
   - Toda ação herda seu gerente exclusivamente da campanha associada.
   - O campo oficial para identificação do gerente responsável é `gerente_responsavel` da view `public.v_acoes_investimento_com_gerente`.
   - É expressamente proibido utilizar mapeamentos ou joins baseados em `cm_clientes`, `codigo_matriz`, nome da rede ou `DISTINCT ON` para determinar o gerente responsável de um investimento.
4. **Imutabilidade Histórica**: Mudanças futuras na carteira comercial de uma rede (ex: troca de gerente comercial no cadastro de clientes) não devem alterar retroativamente o histórico de investimentos já realizados.
5. **Agrupamento e Integridade**:
   - Uma ação pertence a exatamente um gerente responsável.
   - Um investimento nunca poderá ser contabilizado para mais de um gerente.
   - O Dash Gerencial deve consumir exclusivamente o ownership de gerente originado da campanha (`gerente_responsavel` da view) para cálculo do indicador INV.
6. **Correção de Ownership Histórico**: Correções de ownership histórico podem ser realizadas diretamente em `cm_campanhas.gerente_id` quando auditorias identificarem campanhas atribuídas ao gerente incorreto durante processos de backfill.
7. **Ajuste Focado na Campanha**: O ajuste de ownership deve ocorrer exclusivamente no nível da campanha e nunca diretamente nas ações individuais.

---

## 14. Baseline Oficial — Fórmula Oficial de Investimentos (Coffee++)
A partir de 14/07/2026, o investimento financeiro oficial do sistema Coffee++ é regulado sob as seguintes diretrizes:

1. **Fórmula Única e Centralizada**: O investimento financeiro de uma ação é calculado exclusivamente a partir do helper compartilhado:
   `src/lib/investimento/getValorTotal.ts`
2. **Proibição de Alternativas**: É expressamente proibido implementar qualquer cálculo local, fórmula customizada ou lógica paralela de investimento (INV) em dashboards, widgets, relatórios, exportações, RPCs ou views.
3. **Consistência Operacional e Financeira**: Todos os módulos existentes ou futuros que exibam valores de investimentos planejados ou reais devem consumir obrigatoriamente a função `getValorTotal` para garantir paridade operacional em todo o ecossistema.

---

## 15. Baseline Oficial — Governança de Faturamento (Coffee++)

Esta arquitetura está oficialmente homologada e passa a ser obrigatória para todo o ecossistema Coffee++.

### 15.1 Camada Operacional
Fonte Oficial: `cm_faturamento`

Representa todas as movimentações originadas do ERP, Import Hub e BigQuery, sem qualquer exclusão, ajuste comercial ou transformação.

Consumidores autorizados:
- Hub de Importação
- BigQuery
- Auditoria
- Fiscal
- Reconciliação Financeira
- Reprocessamentos
- Integrações externas

Regra:
Nenhuma regra comercial poderá ser aplicada nesta camada.

---

### 15.2 Camada Comercial Oficial
Fonte Oficial: `vw_faturamento_comercial_oficial`

Representa exclusivamente o faturamento utilizado pela gestão comercial e pelos dashboards executivos, mantendo paridade operacional com o MyMetrics.

Regras homologadas:
- Exclusão de NF canceladas.
- Exclusão dos parceiros:
  - `19587`
  - `1`
- Exclusão das TOPs:
  - `1701`
  - `1719`
  - `1720`
  - `1117`
- Devoluções (`1200` e `1201`) devem possuir sinal negativo.

Consumidores autorizados:
- Dashboard Comercial
- Dash Gerencial
- Ranking
- ROI Trade
- Investimentos
- Positivação
- Atendimento
- Indicadores Comerciais
- Metas Realizadas

Paridade homologada:
- Coffee++: R$ 3.402.415,71
- MyMetrics: R$ 3.400.761,34
- Desvio: 0,048%

---

### 15.3 Camada de Planejamento
Fonte Oficial: `cm_weekly_projections`

Representa exclusivamente:
- RPS
- Forecast
- Planejamento Comercial
- Metas Futuras
- Compromissos dos Regionais

Regra:
Nenhuma importação do ERP, Excel, BigQuery ou Hub de Importação poderá alterar automaticamente esta camada.

---

### 15.4 Regra de Ouro

Realizado, Comercial e Planejado são conceitos independentes e não poderão ser misturados.

Nenhum dashboard, API, RPC, view, materialized view, indicador ou módulo poderá consumir múltiplas camadas sem aprovação arquitetural explícita.

---

### 15.5 Regra Obrigatória para Novos Desenvolvimentos

Todo novo módulo, dashboard, API, RPC, view materializada ou indicador deverá declarar explicitamente qual camada de faturamento consome:

- OPERACIONAL (`cm_faturamento`)
- COMERCIAL OFICIAL (`vw_faturamento_comercial_oficial`)
- PLANEJAMENTO (`cm_weekly_projections`)

Na ausência de declaração explícita, considerar:

- Dashboards comerciais → `vw_faturamento_comercial_oficial`
- ERP, BigQuery e integrações → `cm_faturamento`
- Forecast, metas e RPS → `cm_weekly_projections`

Esta regra passa a fazer parte do baseline oficial do Coffee++.

---

### 15.6 Backlog Oficial

Registrar como evolução futura a criação da tabela:

`tb_governanca_comercial`

Objetivo:
Substituir regras fixas de TOP e parceiros dentro da view comercial por governança parametrizada, auditável e versionável.

---

### 15.7 Status de Estabilização e Observação

* **Status da Arquitetura**: `BASELINE CONGELADO`
* **Período mínimo de observação**: 1 fechamento mensal completo.

Durante esse período:
- Não adicionar novas exclusões comerciais.
- Não alterar TOPs filtradas.
- Não alterar regras de devolução.
- Não alterar consumidores das camadas.
- Apenas monitorar divergências com MyMetrics e registrar ocorrências.

**Objetivo**:
Validar estabilidade operacional antes de qualquer evolução da governança comercial.

---

## 16. Evolução Arquitetural — Identidade Única de Gerentes (Coffee++)

Durante a auditoria do dashboard comercial foi identificado um problema estrutural de identidade, onde o mesmo gerente pode aparecer múltiplas vezes no sistema devido à utilização de strings como chave de relacionamento.

Exemplo identificado:
- "Leandro"
- "Leandro Saffi"

Embora representem a mesma pessoa, os módulos de metas, vendas, carteira e planejamento tratam os nomes como entidades distintas, gerando fragmentação de resultados e inconsistências visuais nos dashboards.

### 16.1 Diretriz Arquitetural Oficial
Fica definido que, a partir de 14/07/2026, nenhum relacionamento entre módulos poderá utilizar o nome do gerente como chave técnica.

Toda referência deverá utilizar um identificador único e imutável, na seguinte ordem de prioridade:
1. `employee_code` (identidade de negócio)
2. UUID do usuário (identidade técnica)
3. Nome apenas para exibição visual

### 16.2 Modelo Oficial
*   `manager_id` (`employee_code`) -> chave de relacionamento
*   `manager_name` -> nome oficial
*   `display_name` -> nome apresentado no dashboard

Exemplos:
*   `employee_code`: `1001` \| `manager_name`: `"Leandro Saffi"` \| `display_name`: `"Leandro (Sul)"`
*   `employee_code`: `1002` \| `manager_name`: `"Leandro Oliveira"` \| `display_name`: `"Leandro (SP)"`

### 16.3 Regra Obrigatória para Novos Desenvolvimentos
É proibido utilizar:
*   `name`
*   `manager_name`
*   `nome_gerente`
*   `vendedor_nome`
*   `regional_nome`

como chave de JOIN, GROUP BY, filtros ou relacionamentos internos. Esses campos passam a ser considerados exclusivamente campos de apresentação (display layer).

### 16.4 Plano de Migração Gradual
*   **Fase 1**: Auditoria das tabelas que utilizam nome do gerente como relacionamento.
*   **Fase 2**: Inclusão de `employee_code`/`manager_id` nas tabelas operacionais.
*   **Fase 3**: Migração gradual dos JOINs e agregações para o identificador único.
*   **Fase 4**: Descontinuação definitiva dos relacionamentos por nome.

### 16.5 Benefícios
*   Elimina duplicidade de gerentes.
*   Permite homônimos sem conflitos.
*   Evita problemas de apelidos e abreviações.
*   Permite troca de nome sem impacto histórico.
*   Facilita integrações com Sankhya, BigQuery e CRM.
*   Garante escalabilidade para crescimento da operação comercial.

*   **Classificação arquitetural**: `BASELINE OFICIAL APROVADO PARA PRODUÇÃO`

---

## 17. Baseline Oficial — Homologação da Fase 3 Wave 1 (Identidade de Gestores)
A partir de 14/07/2026, com a aprovação da Wave 1 da migração de Identidade de Gestores, os seguintes componentes entram em regime de **Assisted Production (Change Freeze / Architecture Freeze)**:

- Regras de mapeamento e atribuição de `manager_id`
- Mapeamento e atribuição de `employee_code`
- Triggers de dupla escrita de gestores
- View `vw_matrix_ranking`
- Materialized Views `mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`
- RPC `get_actual_sales_v2`
- Regras de agregação dos dashboards Comercial, Metas e Ranking Executivo

### 17.1 Componentes Congelados (Frozen)
- Mapeamento de `employee_code` e `manager_id`
- Triggers de dupla escrita e nomes canônicos de gestores
- Lógica de agregação de vendas e agrupamento do dashboard
- Lógica de agregação de rankings e persistência de metas (targets)
- Materialized views que utilizam `manager_id`
- Assinatura da RPC `get_actual_sales_v2`
- Comportamento de filtragem de gestores na API

### 17.2 Alterações Permitidas (Allowed)
- Resoluções de bugs e incidentes em produção
- Scripts de correção de dados históricos
- Reparos de integridade física ou lógica
- Melhorias de observabilidade e logs

### 17.3 Alterações Proibidas (Forbidden)
- Inclusão de novos apelidos/aliases para gestores
- Alteração em atribuições de `employee_code` existentes
- Mudanças em chaves de agrupamento (aggregation keys) ou de negócio
- Mudanças nas assinaturas ou contratos de RPCs/APIs
- Mudança na arquitetura de relacionamento de gestores

### 17.4 Critérios de Saída (Exit Criteria)
A suspensão do congelamento arquitetural requer o preenchimento cumulativo dos seguintes requisitos:
1. Conclusão de um ciclo de fechamento mensal completo.
2. Execução de pelo menos um ciclo de importação de faturamento com sucesso.
3. Ausência total de incidentes de duplicidade de gestores ou registros órfãos.
4. Ausência total de incidentes operacionais relacionados a identidades de gestores.
5. Aprovação formal do relatório de observação de produção.

### 17.5 Lista de Validação de Consistência Pós-Importação
Após qualquer carga de faturamento, refresh de MVs ou deployment, é mandatório executar as seguintes validações de integridade no banco Supabase para garantir ausência de regressões:

1. **Cardinalidade Sales (Identidade de Gestores)**:
   ```sql
   SELECT manager_id, COUNT(DISTINCT manager)
   FROM public.sales
   GROUP BY manager_id
   HAVING COUNT(DISTINCT manager) > 1;

   SELECT manager, COUNT(DISTINCT manager_id)
   FROM public.sales
   GROUP BY manager
   HAVING COUNT(DISTINCT manager_id) > 1;
   ```
   *Resultado esperado: 0 linhas.*

2. **Consistência de Unicidade em vw_matrix_ranking**:
   ```sql
   SELECT matrix_name, COUNT(*) 
   FROM public.vw_matrix_ranking 
   GROUP BY matrix_name 
   HAVING COUNT(*) > 1;
   ```
   *Resultado esperado: 0 linhas.*

*   **Status Oficial**: `MANAGER_ID ARCHITECTURE = FROZEN`
*   **Observation Mode**: `ACTIVE`
*   **Next Eligible Phase**: `WAVE 2`

---

## 18. Regra Permanente — Dash Gerencial de Investimentos

### Objetivo:
Manter o Dash Gerencial focado exclusivamente na análise de investimentos ativos, reduzindo ruído visual de canais sem investimento no período.

### Regras Oficiais:
1. **Filtro de Investimento no Grid**: O grid principal deve exibir apenas gerentes e canais com `INV > 0`.
2. **Ocultação de Linhas sem Investimento**: Canais ou gerentes com `INV = 0` devem ser ocultados da visualização.
3. **Escopo de Apresentação**: O filtro atua exclusivamente na camada de apresentação (UI Render).
4. **Preservação de Totais**: O TOTAL GERAL permanece inalterado e continua considerando:
   - Todo o faturamento do período;
   - Todos os investimentos do período;
   - Inclusive registros ocultados pelo filtro visual.
5. **Consistência na Exportação**: Exportações do Dash Gerencial devem respeitar exatamente a mesma visualização apresentada ao usuário.
6. **Mensagem de Estado Vazio**: Caso nenhum gerente ou canal possua investimento no período selecionado, exibir:
   "Nenhum investimento encontrado para os filtros selecionados."

### Componentes Afetados:
- Dash Gerencial de Investimentos
- Exportação do Dash Gerencial

### Restrições de Alteração (Não Alterar):
- Cálculo do FAT;
- Cálculo do INV;
- Cálculo do percentual INV/FAT;
- Ownership de campanhas;
- Agregações e agrupamentos internos.

---

## Regra Permanente — Ownership Automático para Clientes Sem Carteira

Toda campanha de investimento do Coffee++ deve possuir obrigatoriamente um `gerente_id` válido.

Quando um cliente não possuir gerente, regional ou responsável comercial definido no momento da criação do investimento, o sistema deverá atribuir automaticamente a campanha ao perfil institucional "Inside Sales" utilizando o UUID oficial:

77777777-7777-7777-7777-777777777777

Diretrizes obrigatórias:

- É proibido criar campanhas com `gerente_id = NULL`.
- É proibido remover a constraint `NOT NULL` da coluna `cm_campanhas.gerente_id`.
- O fallback para Inside Sales deve ocorrer exclusivamente durante a criação da campanha.
- Toda utilização do fallback deverá gerar auditoria em `cm_audit_logs` utilizando a ação `CAMPAIGN_MANAGER_FALLBACK`.
- O log deverá registrar:
  - campanha_id
  - codigo_matriz
  - rede
  - gerente_id atribuído
  - motivo do fallback
- A atribuição ao Inside Sales é considerada temporária até a definição do responsável comercial definitivo.
- Esta regra aplica-se a Server Actions, APIs, importações, integrações e futuras evoluções do módulo de investimentos.

---

## Regra Permanente — Ownership Comercial Oficial

1. O Cadastro Único de Clientes é a única fonte oficial de ownership comercial do Coffee++.

2. O campo `manager_id` é a chave oficial e única para definição de carteira, ownership e relacionamento comercial entre módulos.

3. O campo `manager_name` possui finalidade exclusivamente descritiva e visual, sendo proibida sua utilização para joins, regras de negócio, agrupamentos, ownership ou integrações sistêmicas.

4. Todos os módulos corporativos devem resolver ownership exclusivamente através do `manager_id` oriundo do Cadastro Único de Clientes.

5. É proibida a criação de regras paralelas, fallbacks por nome, mapeamentos locais, `DISTINCT ON`, inferências por rede, matriz, canal ou qualquer outra heurística para definição de gerente responsável.

6. Alterações de ownership comercial exigem:
   - registro do motivo da alteração;
   - auditoria completa da mudança;
   - identificação do usuário executor;
   - rastreabilidade histórica permanente.

7. O ownership comercial definido no Cadastro Único deve ser automaticamente propagado para todos os módulos dependentes, incluindo:
   - Investimentos;
   - Dashboard Gerencial;
   - RPS;
   - Faturamento;
   - Promotor;
   - DRE por Cliente;
   - quaisquer futuros módulos corporativos.

---

## Regra Permanente — Validações Comerciais do Workflow de Investimentos

1. As validações comerciais:
   - Garantia Contratual;
   - Verba Aprovada;
   - Contrato Assinado;

   pertencem exclusivamente à Fase 2 (Trade).

2. As validações devem permanecer ocultas nas fases:
   - Fase 1 — Planejamento GRV;
   - Fase 3 — Apuração GRV;
   - Fase 4 — Conferência Financeira;
   - Fase 5 — Pagamento Financeiro;
   - Fase 6 — Concluído.

---

## 19. Baseline Operacional — Hub de Importação de Faturamento (Coffee++)

Após a instrumentação da RPC confirmar_importacao_faturamento() e da função refresh_materialized_views(), o Hub de Importação executou com sucesso em ambiente de produção utilizando o arquivo CFOP_01 a 15jul.xlsx.

### 19.1 Resultado da Homologação
*   **Status**: `APROVADO PARA PRODUÇÃO ASSISTIDA`
*   **Métricas observadas**:
    *   Linhas processadas: 36.222
    *   Clientes: 8.435
    *   Produtos: 78
    *   Tempo total de processamento: 140,3 segundos
    *   Faturamento bruto: R$ 7.671.548,41
    *   Faturamento líquido oficial: R$ 7.671.440,48

### 19.2 Diretrizes Operacionais
1. **Tempo Esperado**: O tempo esperado de processamento do Hub passa a ser considerado entre 90 e 180 segundos para cargas mensais completas.
2. **Processamento Assíncrono**: O processamento é assíncrono e tempos superiores a 60 segundos não devem ser tratados automaticamente como falha operacional.
3. **Telemetria Ativa**: A telemetria implantada em `confirmar_importacao_faturamento()` e `refresh_materialized_views()` deve permanecer habilitada durante pelo menos um ciclo completo de fechamento mensal.
4. **Tratamento de Timeouts**: Qualquer novo timeout deverá obrigatoriamente ser acompanhado da extração dos logs de telemetria antes de qualquer alteração arquitetural.
5. **Proibição de Alterações Preventivas**: Fica proibida a remoção preventiva de `refresh_materialized_views()`, triggers de sincronização, recálculo de `faturamento_mensal` e instrumentação de logs sem evidência objetiva proveniente da telemetria.
6. **Comportamento do Frontend**: O botão de upload passa a operar sob o princípio "Upload iniciado ≠ falha imediata". O frontend deve aguardar explicitamente o término da RPC antes de classificar a operação como sucesso ou erro.
7. **Canal Oficial**: O Hub de Importação torna-se oficialmente a única porta de entrada manual para faturamento operacional do Coffee++.

### 19.3 Critério de Saída da Produção Assistida
O Hub será considerado totalmente estabilizado após:
*   3 importações consecutivas bem sucedidas; OU
*   1 fechamento mensal completo sem timeout.


3. A ocultação é exclusivamente visual e nunca deve apagar informações já registradas.

4. Caso a ação retorne para a Fase 2, todas as validações previamente registradas devem reaparecer exatamente como foram salvas originalmente.

---

## 20. Architecture Hardening — Async Materialized View Refresh (Coffee++)

Esta seção complementa a arquitetura oficial de faturamento em três camadas e estabelece as regras permanentes para o processamento assíncrono das Materialized Views.

### 20.1 Regra de Refresh Único (Single Refresh Rule)
É proibida a execução concorrente de refresh das Materialized Views. Antes de iniciar qualquer processamento, o sistema deverá verificar se existe algum job com status `RUNNING` na fila `cm_mv_refresh_jobs`.
*   Se existir, nenhum novo refresh poderá ser iniciado.
*   O novo pedido deverá permanecer em estado `PENDING`.

### 20.2 Regra de Deduplicação de Fila (Queue Deduplication Rule)
Somente um refresh pendente ou em execução poderá existir simultaneamente para cada tipo de processamento.
*   **Implementação recomendada**: Utilizar indexação parcial única (`UNIQUE INDEX`) para status `PENDING` e `RUNNING`, combinando com `INSERT ... ON CONFLICT DO NOTHING`.
*   **Objetivo**: Evitar cargas redundantes e reduzir estresse no banco de dados.

### 20.3 Regra de Fallback do Agendador (Scheduler Fallback Rule)
O sistema deve possuir três níveis de execução para refresh de dashboards:
1.  **Prioridade 1**: `pg_cron` (agendamento assíncrono interno).
2.  **Fallback**: Endpoint administrativo `/api/process-mv-queue` (acionamento por trigger externa).
3.  **Último Recurso**: Botão administrativo "Atualizar Dashboards" (acionamento manual direto).

### 20.4 Hierarquia Oficial de Dados (Official Data Hierarchy)
A hierarquia de verdade do faturamento segue rigorosamente:
1.  `cm_faturamento`: Fonte operacional absoluta (raw).
2.  `vw_faturamento_comercial_oficial`: Fonte oficial comercial e financeira (auditoria, ROI, RPS, comissões, metas).
3.  `mv_vendas_*`: Cache analítico temporário (apenas visualização acelerada).
*   *As Materialized Views nunca poderão ser usadas como fonte de verdade fiscal ou fechamento financeiro.*

### 20.5 Regra de Monitoramento de Saúde (Health Monitoring Rule)
Toda execução de refresh assíncrono deve auditar início, fim, duração, contagem de linhas e divergência percentual contra `vw_faturamento_comercial_oficial`. Se a divergência for superior a 0,5%, gerar automaticamente alerta `HEALTH_ALERT` em `cm_audit_logs`.

### 20.6 Regra de Gerenciamento de Órfãos (Orphan Manager Rule)
Todo faturamento associado ao gerente `manager_id = '9999'` (Outros) deve ser continuamente monitorado através do relatório dinâmico de órfãos (`vw_orphan_partners_report`), recomendando owners baseados no histórico cadastral comercial.

---

## 21. Baseline Oficial — Refresh Assíncrono das Materialized Views

1. É proibido executar `REFRESH MATERIALIZED VIEW` dentro de requisições HTTP síncronas do Next.js.
2. Toda atualização das Materialized Views deverá ocorrer exclusivamente através da fila `cm_mv_refresh_jobs`.
3. Apenas um refresh poderá estar ativo simultaneamente. É proibida a execução concorrente de refresh das MVs.
4. A fila deverá respeitar deduplicação física, permitindo no máximo um job nos estados `PENDING` ou `RUNNING`.
5. O mecanismo oficial de processamento é:
   - Nível 1: `pg_cron`
   - Nível 2: `/api/admin/process-mv-queue`
   - Nível 3: acionamento administrativo manual
6. As Materialized Views (`mv_vendas_*`) são consideradas exclusivamente cache analítico e nunca poderão ser utilizadas como fonte oficial para: auditoria financeira, comissões, ROI, fechamento comercial, RPS, ou metas.
7. A única fonte oficial de faturamento comercial do ecossistema Coffee++ permanece sendo: `vw_faturamento_comercial_oficial`.
8. Divergências superiores a 0,5% entre a camada comercial oficial e o cache analítico deverão gerar automaticamente um evento `HEALTH_ALERT` em `cm_audit_logs`.
9. Parceiros sem ownership comercial (`manager_id = '9999'`) deverão ser monitorados continuamente através do relatório de parceiros órfãos.
10. O status atual desta arquitetura é:
    *   `MV ASYNC REFRESH = PRODUCTION APPROVED`
    *   `HEALTH MONITORING = ACTIVE`
    *   `ARCHITECTURE FREEZE = ACTIVE`

---

## 22. Baseline Oficial — TOP 1117

Existe atualmente divergência conceitual entre:
- MyMetrics
- vw_faturamento_comercial_oficial
- Materialized Views analíticas

Nenhuma alteração estrutural relacionada à TOP 1117 poderá ser realizada sem definição explícita do conceito oficial de faturamento comercial da companhia.

Até nova deliberação:
- o refresh assíncrono é considerado saudável;
- divergências inferiores a 1% decorrentes exclusivamente da TOP 1117 serão classificadas como divergências de governança e não como falha operacional;
- a prioridade operacional passa a ser a redução dos parceiros classificados sob manager_id = '9999'.

Status:
*   `TOP_1117_POLICY = PENDING`
*   `OWNERSHIP_REMEDIATION = PRIORITY_1`

---

## 23. Baseline Oficial — Ownership Comercial e Parceiros Órfãos

A arquitetura de faturamento e refresh assíncrono é considerada estável e homologada.

A principal fonte remanescente de divergência operacional passa a ser a ausência de ownership comercial para parceiros classificados sob `manager_id = '9999'`.

Diretrizes obrigatórias:

1. Todo novo parceiro importado sem ownership comercial definido deverá ser automaticamente classificado como `manager_id = '9999'`.

2. Todo processo de importação deverá registrar:
   - quantidade de parceiros órfãos;
   - faturamento associado aos parceiros órfãos;
   - percentual do faturamento total representado pelos órfãos.

3. Sempre que o faturamento órfão ultrapassar 1% do faturamento mensal consolidado, deverá ser gerado automaticamente um registro `HEALTH_ALERT` em `cm_audit_logs`.

4. Todo parceiro classificado como `manager_id = '9999'` deverá aparecer automaticamente no relatório `vw_orphan_partners_report` com:
   - código do parceiro;
   - nome do parceiro;
   - faturamento mensal;
   - UF;
   - sugestão de ownership comercial.

5. O objetivo operacional permanente do Coffee++ é manter:
   - percentual de faturamento órfão inferior a 1%;
   - percentual de clientes órfãos inferior a 1%.

Classificação operacional:
- <= 0,5% -> HEALTHY
- 0,5% a 1,0% -> WARNING
- > 1,0% -> CRITICAL

Status:
*   `ORPHAN_PARTNER_GOVERNANCE = ACTIVE`
*   `OWNERSHIP_DATA_QUALITY = MONITORED`

---

## 24. Seção 24 — Governança Consolidada e Freeze Arquitetural

As arquiteturas abaixo são consideradas homologadas e congeladas:

- Arquitetura de Faturamento em 3 Camadas;
- Refresh Assíncrono das Materialized Views;
- Governança da TOP 1117;
- Arquitetura de Identidade Única de Gerentes (`manager_id`);
- Governança de Ownership Comercial e Parceiros Órfãos.

A partir desta data:

1. Nenhuma nova regra arquitetural poderá ser adicionada ao AGENTS.md sem evidência operacional concreta ou incidente recorrente em produção.

2. Novas necessidades deverão ser tratadas preferencialmente:
   - por parametrização;
   - por configuração;
   - por tabelas de governança;
   - e não por expansão contínua do AGENTS.md.

3. O próximo ciclo evolutivo oficial do Coffee++ passa a ser:
   - Wave 2 — Carteira;
   - ROI Trade;
   - Investimentos;
   - Positivação;
   - Automação de Ownership.

Status:
*   `ARCHITECTURE_GOVERNANCE = FROZEN`
*   `AGENTS_EXPANSION = RESTRICTED`
*   `NEXT_PROGRAM_INCREMENT = WAVE_2`

---

## 25. Baseline Oficial — Timeout de Promoção do Faturamento

### 25.1 RCA Oficial

O timeout recorrente observado durante a execução de `confirmar_importacao_faturamento()` não é causado por:
- Materialized Views;
- refresh assíncrono;
- locks;
- triggers;
- nested loops;
- ausência de índices;
- sincronização de ownership.

A causa raiz oficial é:
> limitação física do `statement_timeout = 8s` aplicado pelo PostgREST/Kong do Supabase para chamadas RPC executadas através do cliente HTTP.

O timeout é armado no instante da execução da instrução externa:
```sql
SELECT confirmar_importacao_faturamento(...)
```

---

## Seção 26 — Baseline Oficial — Promoção de Clientes para o Cadastro Único

### 26.1 Single Source of Truth
O Cadastro Único (`cm_clientes`) permanece como a única fonte oficial para o cadastro comercial de clientes.

Nenhum módulo poderá inserir clientes diretamente em `base_atendimento` ou em outras tabelas cadastrais.

---

### 26.2 Promoção em Tempo Real
A promoção de novos clientes faturados deverá consumir exclusivamente a View `vw_clientes_faturamento_promocao`.

É proibida qualquer deduplicação, filtragem ou comparação em memória no Next.js.

Toda a identificação de parceiros pendentes deverá ocorrer no PostgreSQL.

---

### 26.3 Ownership Inicial
Todo cliente promovido sem ownership conhecido deverá ser criado obrigatoriamente com:

- `manager_id = '9999'`
- `responsavel = NULL`

É proibida qualquer inferência automática de ownership durante a promoção de clientes.

A classificação comercial ocorrerá exclusivamente pelo fluxo oficial de Ownership do Cadastro Único.

---

### 26.4 Performance
A View `vw_clientes_faturamento_promocao` passa a ser a camada oficial de promoção de clientes.

É proibido consumir diretamente `cm_faturamento` para identificar clientes pendentes em código TypeScript.

---

### 26.5 Critério de Aceitação
Toda nova importação de faturamento deverá garantir que qualquer parceiro ainda inexistente no Cadastro Único esteja disponível imediatamente para promoção, independentemente da quantidade de registros existentes em `cm_faturamento`.

A limitação de paginação do PostgREST não poderá mais impactar este processo.

---

## Seção 27 — Baseline Oficial — Ownership Comercial e Sincronização do Cadastro Único

### 27.1 Single Source of Truth (SSOT)
A tabela `cm_clientes` é a única fonte oficial para os campos `manager_id`, `manager_name` e `responsavel`. Nenhuma outra tabela no ecossistema Coffee Mais pode assumir ownership ou controle principal sobre esses campos.

---

### 27.2 Sincronização Unidirecional e Derivação
A sincronização lógica dos campos de atendimento/ownership deve ser obrigatoriamente unidirecional, fluindo do Cadastro Único para a tabela secundária:
`cm_clientes ──► base_atendimento`
A tabela `base_atendimento` é tratada estritamente como uma estrutura derivada e nunca poderá sobrescrever ou reverter as atribuições de gerentes definidas em `cm_clientes`.

---

### 27.3 Natureza de Sugestão/Fallback das Regras Regionais
As tabelas de regras regionais de território (`cm_base_atendimento_regional` e `manager_uf_mapping`) possuem finalidade exclusiva de sugestão e fallback. Podem ser acionadas no cadastro/promoção inicial ou quando o responsável estiver ausente (`INSERT`), mas **nunca** podem sobrescrever ou forçar valores de forma automática durante atualizações (`UPDATE`) iniciadas manualmente pelo usuário.

---

### 27.4 Triggers e Propagação de Ownership
As triggers associadas às tabelas integradas não devem recalcular ou inferir ownership de forma dinâmica durante atualizações de dados. Triggers de sincronização devem limitar-se à propagação passiva de dados e manter paridade exata.

---

### 27.5 Proteção de Reentrância e pg_trigger_depth
Todas as triggers de sincronização entre tabelas devem, obrigatoriamente, incluir um mecanismo defensivo explícito de proteção contra recursão/reentrada, utilizando `IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;` ou lógica equivalente. Esta salvaguarda é mandatória em qualquer processo de sincronização de dados de cadastro existente ou futuro.

---

### 27.6 Governança e Impedimento de Regras Concorrentes
Qualquer nova funcionalidade, script ou módulo do sistema que manipule os campos de ownership comercial (`manager_id`, `manager_name`, `responsavel`) deverá respeitar rigorosamente este baseline. É expressamente proibida a criação de regras automáticas ou triggers que concorram com a autoridade soberana do Cadastro Único.

---

## Seção 28 — Baseline Permanente: Camada Analítica e Ownership Comercial

### 28.1 Separação entre Fatos e Dimensões
A arquitetura analítica do Coffee++ segue obrigatoriamente o modelo:
`FATOS (Materialized Views) ──► DIMENSÕES (Cadastro Único) ──► Dashboards`

### 28.2 Materialized Views e Fatos Físicos
Materialized Views podem armazenar apenas fatos físicos e imutáveis, tais como: faturamento, quantidade, pedidos, custos, impostos, fretes, SKU, parceiro e período. É expressamente proibido materializar atributos comerciais sujeitos a alteração operacional na view materializada.

### 28.3 Resolução Dinâmica de Atributos Comerciais
Os seguintes atributos comerciais de atendimento devem ser resolvidos exclusivamente a partir da tabela do Cadastro Único (`cm_clientes`):
* `manager_id`
* `manager_name`
* `responsavel`
* `rede`
* `matriz`
* `canal`
* `UF`
* `classificação comercial`
O Cadastro Único permanece como a única Single Source of Truth (SSOT).

### 28.4 Dashboards
Todos os dashboards deverão obter ownership comercial dinamicamente por `JOIN` em tempo de execução com `cm_clientes`. É proibido utilizar ownership comercial persistido ou armazenado em: Materialized Views, tabelas agregadas, tabelas de cache ou snapshots analíticos.

### 28.5 Atualização Automática (Zero Latency)
Qualquer alteração realizada no Cadastro Único deve refletir automaticamente em todos os dashboards e views analíticas do sistema de forma imediata, sem necessidade de refresh manual, scripts SQL, reconstrução de views ou reinicialização de cache de ownership.

### 28.6 Governança Analítica
Qualquer nova implementação analítica ou alteração no ecossistema Coffee++ deverá respeitar obrigatoriamente este baseline. É vedada a criação de novas estruturas analíticas ou operacionais que armazenem permanentemente ownership comercial fora do Cadastro Único.

### 28.7 Evolução Controlada da Arquitetura
A partir da homologação da fase de estabilização do sistema (18/07/2026), visando assegurar a perenidade operacional:
* Evitar refatorações estruturais sem necessidade de negócio ou falha comprovada.
* Priorizar novas funcionalidades de negócio sobre modificações arquitetônicas.
* Qualquer proposta de alteração estrutural no ecossistema deve obrigatoriamente documentar: Motivação, Impacto esperado, Riscos, Plano de Rollback e Estratégia de Homologação.
* Na ausência de benefício técnico ou operacional mensurável, a arquitetura vigente deverá ser preservada.

### 28.8 Prioridade para Evolução de Negócio
Com a conclusão da fase de estabilização arquitetural, o Coffee++ entra na fase de evolução funcional.
* Toda nova demanda deve priorizar a geração de valor para o negócio.
* Prioridades estratégicas de evolução funcional:
  1. Inteligência Comercial;
  2. Analytics e Indicadores;
  3. Produtividade dos usuários;
  4. Automações operacionais;
  5. Inteligência Artificial aplicada ao negócio.
* Mudanças estruturais ou na base de dados só serão permitidas com necessidade comprovada, benefício técnico/de negócio mensurável, eliminação de risco operacional crítico ou ganho notável de performance e escalabilidade.
* As novas implementações devem priorizar recursos reutilizando a arquitetura vigente (Cockpit Comercial, DRE Comercial, CRM, Indicadores Gerenciais, Planejamento Comercial, Assistentes Inteligentes, Automações de Gestão), consumindo o Cadastro Único (`cm_clientes`) como SSOT e a camada analítica dinâmica, de forma a evitar redundância de regras de negócio.

### 28.9 Qualidade e Regressão
A partir da homologação da arquitetura, toda nova funcionalidade deverá preservar os baselines do Coffee++.
* Antes de qualquer entrega em produção, deverão ser verificados obrigatoriamente:
  1. **Integridade dos dados:** Garantia de consistência numérica e integridade referencial.
  2. **Compatibilidade com o Cadastro Único (SSOT):** Respeito à sincronização lógica de `cm_clientes`.
  3. **Compatibilidade com a camada analítica:** Consumo de dados via views unificadas sem materialização de atributos operacionais.
  4. **Segurança:** Validação de RLS e permissões por perfil.
  5. **Performance:** Testes sob carga real.
  6. **Compatibilidade de APIs:** Ausência de breaking changes em rotas ativas.
  7. **Ausência de Regressões:** Validação de fluxos ponta a ponta.
* Nenhuma funcionalidade poderá substituir ou contornar componentes homologados quando houver extensão compatível da arquitetura existente. Toda evolução deverá privilegiar reutilização, redução de complexidade e manutenção da consistência sistêmica.

---

## Seção 29 — Baseline Oficial — Batch Import Engine (BIE) v1

### 29.1 Princípio de Execução Particionada
A partir de 19/07/2026, com a homologação e ativação do **Batch Import Engine (BIE) v1**, toda promoção de dados de faturamento da tabela staging (`cm_faturamento_staging`) para a tabela física oficial (`cm_faturamento`) deve ocorrer obrigatoriamente através do processamento segmentado em lotes controlados (batches de tamanho parametrizado, padrão 5.000 registros).

### 29.2 Proibição de Promoção Monolítica
Fica expressamente proibido o uso de RPCs ou instruções SQL de statement único (ex.: `confirmar_importacao_faturamento(...)`) que realizem a promoção de toda a staging de uma única vez para produção. Esta restrição visa anular de forma definitiva o estouro do limite físico de `statement_timeout` da role do banco de dados (8 segundos).

### 29.3 Centralização e Orquestração no Backend
Toda a lógica de paginação, controle de offsets, cálculo de limites de lote e sequenciamento dos sub-lotes deve residir e ser orquestrada exclusivamente no backend (TypeScript/Next.js). O frontend não deve sob nenhuma circunstância gerenciar offsets ou offsets parciais de persistência. A rota do frontend apenas inicia a ação no servidor e acompanha o andamento de forma passiva através de polling de progresso.

### 29.4 Preservação de Integridade e Telemetria
Todo pipeline de importação em lotes deve garantir obrigatoriamente:
* **Preservação de Staging e Batch ID**: Utilização de chaves de vinculação de lote (`batch_id`) padronizadas durante toda a vida do upload até a confirmação física.
* **Auditabilidade e Telemetria**: Gravação do estado e progressão das sub-etapas na tabela `cm_sync_logs` para acompanhamento e auditoria de auditoria física.
* **Rollback Automático**: Em caso de falha física ou lógica em qualquer batch do loop, o backend deve reverter todas as inserções parciais daquele lote em `cm_faturamento` e limpar as estruturas auxiliares automaticamente, retornando a base ao estado imediatamente anterior.
* **Idempotência**: Garantia de re-processamento seguro de lotes idênticos sem geração de duplicidade física de dados em produção.

---

## Seção 30 — Baseline de Congelamento e Versionamento — Batch Import Engine v1.0.0

### 30.1 Estado de Congelamento Arquitetural (Frozen)
A partir de 19/07/2026, com o encerramento oficial da sprint, o módulo **Batch Import Engine (BIE) v1** entra em regime de **Architecture Freeze**. Nenhuma alteração de infraestrutura, rotinas de paginação, contratos de banco ou fluxos de rollback pode ser efetuada sem a emissão e aprovação prévia de uma RFC (Request for Change). Melhorias ou manutenções futuras devem preservar rigorosamente o contrato público das RPCs do BIE.

### 30.2 Reutilização Mandatória
Qualquer nova origem de importação manual ou automática de dados de faturamento (novas planilhas, integrações com Sankhya, importação de BigQuery ou novas APIs comerciais) deve reutilizar obrigatoriamente a estrutura particionada do BIE para sua persistência.

### 30.3 Metadados da Versão 1.0.0
* **Nome**: Batch Import Engine v1.0.0
* **Data de Entrada em Produção**: 19/07/2026
* **Status**: `PRODUCTION = ACTIVE` (Architecture Frozen)
* **Migrations Integradas**:
  * `supabase/migrations/20260719_batch_import_engine_functions.sql`
* **Arquivos Principais da Aplicação**:
  * `src/lib/services/import-service.ts` (Método `confirmImport`)
  * `src/app/api/import/excel/confirm/route.ts` (Endpoint e duração da Vercel)
* **RPCs Oficiais do Banco de Dados**:
  * `public.preparar_importacao_faturamento(uuid, text)`
  * `public.promover_lote_faturamento(uuid, integer, integer)`
  * `public.finalizar_importacao_faturamento(uuid)`
* **Tabela de Controle**:
  * `public.cm_import_affected_partners`

---

## Seção 31 — Baseline Permanente e Roadmap do BIE v1.0.0

### 31.1 Compatibilidade e Reutilização
O **Batch Import Engine v1.0.0** passa a ser o mecanismo oficial de importação do Coffee Mais. Ele é projetado para ser compatível e reutilizado por:
* Importação Excel.
* Importação BigQuery.
* Integrações futuras via API.
* Novas origens de dados.
* Processamento por `batch_id`.
* Telemetria centralizada.
* Rollback transacional.
* Idempotência.

### 31.2 Baseline Arquitetural Permanente
A partir da liberação da versão v1.0.0, passam a ser regras permanentes de governança da arquitetura:
1. Toda importação de faturamento comercial deverá utilizar obrigatoriamente o Batch Import Engine.
2. É terminantemente proibida a promoção monolítica de dados da staging para `cm_faturamento`.
3. Toda importação deverá possuir e associar um `batch_id` válido.
4. Toda importação deverá atualizar progressivamente a tabela de telemetria `cm_sync_logs`.
5. Toda importação deverá possuir mecanismos de rollback transacional automático em caso de exceções.
6. Toda importação deverá preservar auditoria e telemetria física.
7. Alterações arquiteturais neste componente somente poderão ocorrer mediante RFC formalmente aprovada.

### 31.3 Critérios para Evolução Arquitetural
O Batch Import Engine v1.0.0 entra permanentemente em modo de manutenção. Evoluções na arquitetura básica do BIE somente deverão ser consideradas caso ocorra um ou mais dos seguintes cenários de negócio ou infraestrutura:
* crescimento significativo do volume de importações mensais;
* necessidade comprovada de processamento distribuído;
* necessidade de filas de execução dedicadas (ex: Inngest/BullMQ);
* necessidade de cancelamento ou retomada automática (auto-resume) de jobs;
* limitação de processamento comprovada da arquitetura atual em ambiente de produção.

Na ausência dos cenários listados acima, qualquer nova funcionalidade ou integração deverá reutilizar o Batch Import Engine existente, preservando de forma estrita o seu contrato público e assinaturas de RPC.

### 31.4 Roadmap de Evoluções Futuras (Backlog de Negócio)
Caso os cenários de evolução descritos acima sejam disparados, os seguintes recursos secundários estão mapeados no backlog para implementação futura:
1. **Dashboard Operacional do BIE**: Painel administrativo para monitoramento de saúde de imports.
2. **Estimativa de Conclusão (ETA)**: Cálculo do tempo restante de execução do lote.
3. **Métricas Históricas**: Logs estatísticos comparativos de faturamento.
4. **Cancelamento de Importação**: Recurso para abortar e reverter a importação em tempo de execução.
5. **Retomada Automática (Auto-Resume)**: Retomada a partir do último offset válido.

### 31.5 Política de Prevenção de Sobrecarga (Overloading)
* **Regra Soberana**: Nunca manter simultaneamente versões legadas e novas de RPCs com assinaturas compatíveis (overloading) quando essas funções são consumidas pelo frontend via PostgREST/Supabase RPC.
* **Ações em Migrations**: Sempre que houver alteração de tipos de parâmetros em uma função, a migration correspondente deverá conter comandos explícitos de `DROP FUNCTION` para as assinaturas antigas, evitando ambiguidades de resolução de funções no Postgres.
* **Validação de Deploy**: É obrigatório validar, antes da aprovação de qualquer deploy de banco, que existe apenas uma única assinatura ativa para cada RPC consumida pelo frontend, prevenindo erros de resolução de candidatos no gateway API Rest.

---

## Seção 32 — Governança Comercial e Workflows de Alteração (Fase 4)

### 32.1 Regras Permanentes de Alteração de Ownership
1. **Canal Oficial de Ownership**: Toda alteração de ownership comercial (responsável, gerente, matriz e UF) deve ocorrer exclusivamente pelo workflow oficial de solicitações da Fase 4.
2. **Vedação de Escrita Direta**: É expressamente proibido que qualquer componente de frontend ou API execute atualizações diretas (`UPDATE`) de gerência ou UF diretamente na tabela `cm_clientes`.
3. **Máquina de Estados**: Toda mudança de status nas solicitações deve ocorrer exclusivamente por meio da chamada à função de banco `public.transition_ownership_request()`, que valida a transição de estado da máquina.
4. **Auditoria Obrigatória**: Toda alteração comercial homologada ou em transição deve gerar e persistir automaticamente trilhas de auditoria detalhadas na tabela `cm_audit_ownership_log`, contendo os estados anteriores e novos valores.
5. **SSOT Como Único Validador**: A função de banco `public.calcular_responsavel_cliente` permanece como a única fonte de verdade (Single Source of Truth) para o cálculo do gerente responsável pelo cliente, não devendo haver recálculos ou fallback duplicados nas telas ou rotas de API.

---

## Seção 33 — Baseline Oficial da Plataforma (v1.1.0)

### 33.1 Referência Arquitetural Obrigatória
1. **Referência Permanente**: Fica homologada a Baseline Arquitetural Unificada `v1.1.0` (detalhada no arquivo `baseline_oficial_plataforma.md`) como a especificação soberana da engenharia de dados, qualidade analítica e controle cadastral do Coffee Mais.
2. **Conformidade em Evoluções**: Qualquer novo módulo, API, dashboard ou automação a ser desenvolvido no Hub de Importação deve aderir de forma estrita e obrigatória aos princípios e componentes descritos nesta baseline.
3. **Garantia de Não-Regressão**: Alterações nas Fases 1, 2, 3 ou 4 que violem as restrições físicas de banco de dados, RLS ou triggers de lock de status serão rejeitadas imediatamente.
4. **Exclusões de Escopo**: Dados de homologação comercial e correções operacionais extraordinárias de TI (ex: Lote 05B) não constituem extensão permanente do modelo de dados da baseline e permanecem sob tratamento transicional.

---

# BASELINE ARQUITETURAL OFICIAL

A Baseline Arquitetural Unificada v1.1.0 torna-se a referência obrigatória para qualquer implementação futura.

Toda nova funcionalidade deverá preservar obrigatoriamente:
- Arquitetura Aditiva;
- Single Source of Truth (SSOT);
- Workflow Oficial da Fase 4;
- APIs como camada oficial de integração;
- Auditoria obrigatória;
- Compatibilidade retroativa.

É vedado ao AG:
- sugerir bypass da SSOT;
- duplicar regras de negócio no frontend;
- criar novos cálculos paralelos de ownership;
- alterar diretamente `cm_clientes`;
- alterar diretamente o status de `cm_ownership_requests`;
- contornar RLS;
- substituir componentes oficiais por implementações alternativas.

Sempre que uma nova funcionalidade impactar governança comercial, o AG deverá verificar previamente a aderência à Baseline v1.1.0 antes de propor qualquer implementação.

Caso uma solicitação do usuário entre em conflito com a baseline homologada, o AG deverá:
1. identificar explicitamente o conflito;
2. explicar qual princípio arquitetural seria violado;
3. propor uma solução compatível com a baseline;
4. somente sugerir alteração da arquitetura caso seja realmente necessária, caracterizando uma nova versão oficial da baseline.

Mudanças incompatíveis deverão ser tratadas como evolução arquitetural formal (Baseline v1.2.0 ou superior) e nunca como alteração pontual.

Esta diretriz possui caráter permanente e deverá prevalecer sobre implementações futuras, salvo substituição formal da Baseline Arquitetural Unificada.

---

## Seção 34 — Governança da Documentação

### 34.1 Regras Permanentes de Documentação e Versionamento
1. **Atualização da Baseline:** Toda evolução arquitetural deverá ser devidamente registrada e consolidada na Baseline Oficial.
2. **Entregáveis Obrigatórios de Fase:** Toda fase executada no projeto deverá possuir, obrigatoriamente:
   * **Checklist** (trilha de tarefas ativas);
   * **Walkthrough** (evidências e documentação das entregas);
   * **Closure Report** (relatório de encerramento homologado).
3. **Sincronismo Obrigatório:** Nenhuma alteração estrutural poderá ser implementada em produção sem a respectiva atualização e homologação da documentação técnica correspondente.
4. **Finalidade do Roadmap:** O Roadmap Executivo contém apenas a visão de negócio estratégica do projeto e não autoriza, por si só, qualquer tipo de implementação técnica.
5. **Finalidade do Changelog:** O Changelog do projeto registra exclusivamente alterações arquiteturais homologadas.
6. **Finalidade do Backlog Arquitetural:** O Backlog Arquitetural registra exclusivamente oportunidades e propostas de evolução futura do sistema, não representando sob qualquer hipótese funcionalidades aprovadas para desenvolvimento.

---

## Seção 35 — Governança de Implementação da Fase 6

### 35.1 Regras de Planejamento e Execução da Fase 6
1. **Documentação Oficial de Referência:** A Fase 6 possui documentação de planejamento oficial e homologada composta por:
   * **Discovery Executivo** (`discovery_executivo_fase6.md`);
   * **Especificação Funcional** (`documento_funcional_fase6.md`);
   * **Arquitetura de Referência** (`arquitetura_fase6.md`);
   * **Plano Oficial de Implementação** (`plano_implementacao_fase6.md`).
   Estes documentos constituem a única referência técnica e conceitual soberana para qualquer desenvolvimento da Fase 6.
2. **Rastreabilidade de Alterações:** Qualquer mudança funcional ou de arquitetura proposta para a Fase 6 durante a execução deverá ser precedida por uma revisão e atualização formal desta documentação.
3. **Sequenciamento Obrigatório:** A implementação das sprints lógicas da Fase 6 deve seguir estritamente a sequência definida no Plano Oficial de Implementação (começando pela Sprint 6.1 e avançando sequencialmente até a Sprint 6.7). Fica proibido antecipar de forma alguma funcionalidades previstas para as sprints posteriores sem a homologação prévia da sprint corrente.

### 35.2 Conclusão e Homologação Final da Fase 6
A Fase 6 (Inteligência de Alocação e Auditoria Pós-Faturamento) está oficialmente concluída e homologada (Ata de Encerramento em 19/07/2026).
1. **Conclusão das Sprints:** Todas as sete sprints (6.1 a 6.7) foram integralmente implementadas, testadas e validadas, cobrindo o Orquestrador, Motor de Conciliação, Motor de Auditoria, Motor de Alertas, Dashboard Executivo, Relatórios de Exportação e Caching Analítico.
2. **Nova Baseline Oficial:** A Arquitetura de Referência e os contratos públicos da Fase 6 passam a integrar a Baseline Oficial estável do sistema Coffee Mais.
3. **Governança de Evolução:** Qualquer alteração, refinamento ou evolução futura de conciliação ou auditoria pós-faturamento deverá ocorrer exclusivamente por meio de novas fases, RFCs (Request for Comments) ou Change Requests formais, mantendo retrocompatibilidade estrita com os contratos públicos estabelecidos.

---

## Seção 36 — Baseline Oficial — Conciliação Coffee++ × MyMetrics

O documento "Relatório de Auditoria e Conciliação Comercial (Coffee++ × MyMetrics) v1.0" é considerado a referência oficial da auditoria financeira do projeto.

Todas as conclusões nele contidas permanecem congeladas até que surja uma nova evidência objetiva proveniente do ambiente MyMetrics, tais como:
- SQL da Question do Metabase;
- Card utilizado pelo OnePage;
- View utilizada;
- Procedure;
- Endpoint/API;
- documentação oficial;
- confirmação formal da equipe responsável pelo MyMetrics.

Nenhuma hipótese deverá ser promovida a fato sem nova evidência.

Nenhuma conclusão comprovada deverá ser alterada sem nova auditoria técnica.

Qualquer futura revisão deverá:
- criar uma nova versão do relatório (v1.1, v1.2, etc.);
- preservar integralmente a versão 1.0;
- registrar claramente a origem da nova evidência.

---

## Seção 37 — Metodologia Oficial de Conciliação Financeira

A Bridge Sankhya → OnePage passa a ser a metodologia oficial de reconciliação financeira do projeto.

Qualquer futura análise deverá utilizar esta sequência:
1. Total bruto do Excel
2. Exclusão de Parceiros Industriais
3. Exclusão de Canceladas
4. Exclusão de Devoluções
5. Ajuste Residual
6. Total OnePage

Nenhuma nova bridge deverá ser criada sem nova evidência objetiva.

Mudanças futuras deverão gerar nova versão (v1.1, v1.2...) preservando integralmente a v1.0.

---

## Seção 38 — Lições Aprendidas — Conciliação Financeira

A reconciliação financeira entre o ERP Sankhya e o indicador Receita Mês do OnePage deverá utilizar exclusivamente a metodologia documentada na "Metodologia Oficial de Conciliação Financeira – Sankhya → OnePage (v1.0)".

É vedada a criação de novas bridges ou regras alternativas sem evidências objetivas que justifiquem uma nova versão da metodologia.

Qualquer alteração deverá:
- preservar integralmente a versão anterior;
- gerar uma nova versão (v1.1, v1.2...);
- documentar claramente as novas evidências que motivaram a mudança.

### 38.1 Lições Aprendidas de Auditoria
- A comparação entre ERP e dashboards gerenciais deve ser realizada por meio de uma bridge financeira baseada em regras globais de negócio, e não por diferenças isoladas entre documentos fiscais.
- A metodologia deve distinguir claramente:
  - fatos comprovados;
  - critérios observados;
  - hipóteses residuais;
  - limitações da auditoria.
- Toda etapa da bridge deve ser:
  - matematicamente demonstrável;
  - auditável;
  - mutuamente exclusiva.
- Nenhuma conclusão deve atribuir comportamento ao MyMetrics sem evidência objetiva de sua implementação.

---

## Seção 39 — Baseline Oficial — Autoassociação Inteligente de Responsável Comercial (v1.0)

A funcionalidade de Autoassociação Inteligente de Responsável Comercial (v1.0) passa a compor oficialmente a Baseline do Coffee++, sendo considerada estável para uso em produção.

### 39.1 Componentes Estáveis
* **Banco de Dados:** Tabelas `cm_responsavel_regras`, `cm_responsavel_sugestoes` e a RPC `fn_save_suggestions_transactional`.
* **Domínio:** `clienteMatching.ts`, `motorResponsavel.ts`, `scoreConfianca.ts` e `autoAssociacaoService.ts`.
* **Aplicação/UI:** Server Actions em `actions.ts` e a interface do usuário em `page.tsx`.

### 39.2 Diretrizes Arquiteturais e de Governança
* **Aprovação Manual:** Nenhuma sugestão altera o cadastro do cliente automaticamente; toda atribuição requer aprovação e confirmação humana na interface de usuário.
* **Auditabilidade:** Todas as decisões (incluindo aprovações, rejeições com motivos, score calculado, fatores, executor e data) devem ser persistidas nas tabelas de auditoria.
* **Desacoplamento:** A separação limpa entre os motores de pareamento (matching), de avaliação de regras e de cálculo de score de confiança deve ser permanentemente preservada.
* **Evolução:** Alterações futuras na estrutura de banco, na lógica de negócio ou na RPC devem manter compatibilidade reversa estrita com a versão 1.0 ou resultar no lançamento de uma nova versão de especificação (v1.1+).

---

## Seção 40 — Baseline Oficial — Indicador de Atividade Comercial (v1.3)

A funcionalidade de Indicador de Atividade Comercial no Cadastro Mestre de Clientes (v1.3) passa a compor oficialmente a Baseline do Coffee++, sendo considerada estável para uso em produção.

### 40.1 Componentes Estáveis
* **Banco de Dados:** Tabela física de cache `cm_clientes_atividade`, com índices de busca por situação e chave primária vinculada a `cm_clientes(id)`.
* **Serviços / RPCs:** RPC isolada de cálculo `refresh_clientes_atividade()` e RPC orquestradora `refresh_materialized_views()`.
* **Interface (UI):** Checkboxes de filtragem ("Clientes com venda e sem responsável" e "Clientes ativos sem responsável"), cards de resumo operacional superior, colunas adicionadas no grid e badges de situação coloridos.

### 40.2 Diretrizes Arquiteturais e de Governança
* **Desacoplamento de Leitura:** A UI consulta sempre a tabela mestre `cm_clientes`, realizando junção com a tabela física de cache `cm_clientes_atividade` (1:1). As consultas e a interface continuam agnósticas ao método de atualização (lote vs incremental).
* **Refresh e Atualização:** A atualização ocorre automaticamente após sincronizações do Sankhya, importação de faturamento ou manual via RPC administrativa. Lógica de atualização e telemetria permanecem isolados na RPC de atividade.
* **Métricas Estendidas:** Além da última compra, a tabela física de cache já preenche de forma nativa a primeira compra, o volume de faturamento e a quantidade de notas fiscais dos últimos 12 meses para futuras integrações comerciais.
* **Timezone Safety:** Toda renderização de datas na interface deve utilizar tratamento timezone-safe para evitar inconsistências durante a renderização no servidor (SSR).

### 40.3 Complemento Arquitetural — Correção RLS (v1.3.1)
* **Sintoma de Falha Identificado:** A relação `atividade` na listagem de clientes do Supabase retornava `null` no frontend (consultando com a role `anon`), fazendo com que todos os registros exibissem a última compra como "Nunca", dias sem comprar como "-" e situação como "Sem vendas".
* **Correção RLS Efetuada:** Ajustada a política de segurança RLS da tabela `cm_clientes_atividade`. A política única para `authenticated` foi removida e substituída por políticas granulares separadas:
  * **SELECT:** Liberado para a role `public` (permitindo consultas tanto de usuários autenticados quanto de visitantes/anon, equiparando-se ao comportamento da tabela principal `cm_clientes`).
  * **INSERT / UPDATE / DELETE:** Mantidos exclusivamente para a role `authenticated` (e service role) para garantir a integridade dos dados inseridos/modificados pelo sistema.
* **Diretiva de Governança Complementar:** Para tabelas auxiliares que servem de relacionamento (`LEFT JOIN` / PostgREST) com tabelas principais (como `cm_clientes`), as políticas RLS de leitura (SELECT) devem obrigatoriamente manter compatibilidade e equivalência de acesso com a tabela pai. Isso evita que falhas silenciosas de permissão façam relacionamentos retornarem `null` no cliente.

---

## Seção 41 — Baseline Permanente — Modo Administrativo da RPS (v1.0)

A funcionalidade de Modo Administrativo da RPS passa a compor oficialmente a Baseline do Coffee++, sendo considerada comportamento oficial da plataforma e não poderá ser alterada sem revisão arquitetural formal.

### 41.1 Controle de Acesso (Prioridade de Autorização)
A autorização para o Modo Administrativo obedece obrigatoriamente à seguinte prioridade:
1. **Perfil (Role) Autorizado:** `Gerente Nacional`, `Diretor`, `CEO`, `Admin` ou `Admin Master`.
2. **Fallback por E-mail:** `cristiano@coffeemais.com` ou `cristiano.santos@coffeemais.com`.
O perfil (role) sempre prevalece sobre a verificação por e-mail.

### 41.2 Capacidades do Modo Administrativo
Quando ativo, o usuário pode editar:
* **Desafio:** VOL, FAT e INVEST dos gerentes.
* **Projeções Semanais:** VOL, FAT e INVEST de todas as semanas do mês (passadas, atual ou futuras) para gerentes e redes.
* **Metas dos Clientes:** Edição liberada a qualquer tempo.
Independentemente do dia da semana (segunda-feira ou outros dias), da semana selecionada ou das restrições normais da RPS.

### 41.3 Campos Obrigatoriamente Somente Leitura
Nunca poderão ser editáveis, mesmo em Modo Administrativo:
* **ANO A, MÊS A:** Faturamento e volume históricos.
* **% DISP:** Percentual de dispersão (realizado vs projeção do mês anterior).
* **% DESAFIO, %AA, %MA:** Indicadores percentuais calculados.
* **Todos os indicadores históricos e calculados:** Valores sempre derivados exclusivamente dos cálculos do sistema.

### 41.4 Arquitetura e Integridade
O Modo Administrativo altera apenas permissões de edição no frontend e endpoints da API (`/api/processo-comercial/rps`).
Não altera: cálculos, regras de negócio, consolidação, ranking, indicadores ou histórico. A lógica matemática da RPS permanece exatamente igual.

### 41.5 Diretriz de Compatibilidade
Toda evolução futura da RPS deverá preservar este comportamento. Qualquer alteração que impacte estas regras deverá ser tratada como mudança arquitetural e nunca como ajuste de manutenção.

Status: **BASELINE OFICIAL HOMOLOGADA**.

---

## Seção 42 — Política Permanente de Baselines Homologados

Todo baseline oficialmente homologado da plataforma passa a ser considerado imutável.

Qualquer implementação futura que altere um comportamento pertencente a um baseline homologado deverá, obrigatoriamente:

1. **Identificar explicitamente** qual baseline será impactado.
2. **Justificar tecnicamente** a necessidade da alteração.
3. **Informar riscos** de regressão.
4. **Apresentar plano** de compatibilidade ou migração.
5. **Solicitar aprovação** antes da implementação.

É proibido alterar silenciosamente comportamentos pertencentes a um baseline homologado.

Na ausência de aprovação explícita, o comportamento original deverá ser preservado integralmente.

Status: **REGRA PERMANENTE DE GOVERNANÇA**.

---

## Seção 43 — Baseline Permanente — Padrão de Scroll para Telas Analíticas (Design System)

A partir desta versão, todas as telas analíticas do Coffee++ passam a seguir obrigatoriamente este padrão de navegação e rolagem para garantir consistência de UX, legibilidade e facilidade de manutenção.

### 43.1 Hierarquia de Sticky ("Apenas Um Sticky Principal")
É obrigatório existir apenas **um elemento sticky principal** durante a navegação pela massa de dados:
* **Preferencialmente:** O cabeçalho das colunas da tabela.
* Demais elementos da página (título, subtítulo, breadcrumbs, badges, filtros superiores e informações contextuais) **não devem** permanecer fixos durante o scroll, devendo subir e rolar naturally com a página, salvo justificativa funcional prévia e aprovada.

### 43.2 Cabeçalhos de Tabelas Sticky
Os cabeçalhos das tabelas devem:
* Permanecer visualmente estáveis durante a rolagem.
* Possuir fundo sólido (`var(--table-header-bg)` / `var(--background-card)`).
* Ocultar completamente o conteúdo que passa por trás (0% de transparência ou vazamento de texto).
* Manter alinhamento consistente em diferentes níveis de zoom do navegador (90%, 100%, 125%) via `border-collapse: separate; border-spacing: 0;`.
* Utilizar sombra discreta (`box-shadow`) no limite inferior para separar o cabeçalho congelado da massa de dados em movimento.

### 43.3 Operação via Sidebar Lateral
Quando existir painel lateral de operação (filtros, ações ou comandos), ele poderá permanecer fixo (`sticky`), desde que:
* Não sobreponha conteúdo da tabela.
* Não interfira na leitura dos dados.
* Mantenha comportamento consistente em diferentes resoluções (notebooks 1366x768, Full HD e Ultrawide).

### 43.4 Performance e Simplicidade
Implementações de sticky devem priorizar simplicidade CSS e desempenho na GPU, eliminando múltiplos elementos fixos concorrentes, cálculos JS desnecessários no evento de scroll e repaints de layout.

### 43.5 Consistência entre Módulos
Telas analíticas existentes e futuras devem reutilizar este padrão para garantir experiência uniforme em todo o ecossistema Coffee++:
* RPS;
* Faturamento;
* Atendimento;
* Investimentos;
* DRE;
* Dashboards Analíticos.

Qualquer exceção deverá possuir justificativa técnica formal e aprovação arquitetural prévia.

Status: **BASELINE OFICIAL — DESIGN SYSTEM (SCROLL E TABELAS ANALÍTICAS)**.

---

## Seção 44 — Baseline Permanente — Normalização de Chaves de Domínio

Todas as comparações de entidades de negócio utilizadas como chave lógica deverão ser realizadas utilizando representação canônica.

Aplica-se, entre outras, às entidades:
- Gerente
- Cliente
- Rede
- Matriz
- Regional

É proibido depender de:
- diferenças de maiúsculas/minúsculas;
- espaços em branco;
- aliases históricos;
- nomes legados.

Toda leitura e gravação deverá utilizar uma chave normalizada única.

Quando houver nomes históricos ou aliases, estes deverão ser convertidos para a representação oficial antes de qualquer comparação.

Alterações futuras deverão preservar essa regra em todos os módulos da plataforma.

Status: **BASELINE OFICIAL — NORMALIZAÇÃO DE CHAVES DE DOMÍNIO**.

---

## Seção 45 — Baseline Permanente — Single Source of Truth das Metas

Status: **OFICIAL — CONGELADA**.

### 1. Fonte Oficial
A tabela `public.targets` é a única fonte oficial para metas e desafios corporativos da empresa.
Os módulos consumidores (RPS, Dashboard, Relatórios e futuros módulos) devem ler e gravar metas exclusivamente nesta tabela.

### 2. Responsabilidade das Tabelas

#### `public.targets`
- Metas mensais oficiais
- Target de faturamento
- Target de volume

#### `public.cm_weekly_projections`
- Projeções semanais
- Forecasts
- Histórico semanal

É estritamente proibido armazenar os KPIs `DESAFIO_FAT` e `DESAFIO_VOL` na tabela `public.cm_weekly_projections`.

### 3. Normalização
A identificação de gerentes deve utilizar a camada oficial de normalização (`src/lib/domain/canonical.ts`), priorizando `manager_id` como identificador canônico.
Nenhuma regra de negócio pode depender de nomes literais ou hardcodes de aliases.

---

## Seção 46 — Baseline Permanente — Carteira Comercial Completa da RPS

Status: **OFICIAL — CONGELADA**.

### 1. Carteira Comercial
A RPS passa a exibir integralmente a carteira comercial de cada gerente.
É proibida a utilização de limites artificiais de exibição (Top N, `slice()`, `LIMIT` fixo ou qualquer outra restrição equivalente) para composição da carteira comercial.
A lista deverá representar fielmente todos os clientes ativos pertencentes ao gerente conforme o Ownership Comercial oficial.

### 2. Fonte Oficial
A composição da carteira deverá utilizar exclusivamente as fontes oficiais homologadas do sistema, respeitando o Ownership Comercial vigente.
É proibida a utilização de listas estáticas, arrays hardcoded ou cadastros paralelos para formação da carteira.

### 3. Performance
A expansão da carteira deverá utilizar consultas consolidadas, evitando consultas N+1.
Sempre que possível:
- carregar os dados em lote;
- realizar a consolidação em memória;
- manter complexidade linear;
- preservar o tempo de resposta da RPS mesmo com centenas de clientes por gerente.

### 4. Ordenação
Os clientes deverão permanecer ordenados alfabeticamente pelo nome comercial apresentado ao usuário.
O agrupador **OUTROS** deverá permanecer obrigatoriamente como o último item da carteira.

### 5. Compatibilidade
Esta diretriz deve permanecer compatível com:
- Baseline de Ownership Comercial;
- Baseline de Normalização Canônica de Domínio;
- Baseline Single Source of Truth das Metas;
- Modo Administrativo da RPS.

Nenhuma evolução futura poderá reintroduzir limitações artificiais na carteira comercial.

---

## Seção 47 — Baseline Permanente — Catálogo Oficial de Redes Planejáveis

Status: **BASELINE OFICIAL CONGELADA**

### 1. Objetivo
A composição da carteira comercial planejável do Coffee++ passa a utilizar uma única camada oficial de domínio.

### 2. Regra Arquitetural
A camada `vw_redes_planejaveis_oficiais` é a **Single Source of Truth** para identificação das Redes Comerciais Planejáveis da plataforma.

Nenhum módulo deverá construir carteiras comerciais diretamente a partir de tabelas operacionais como:
- `base_atendimento`
- `cm_clientes`
- `cm_acoes_investimento`
- tabelas de faturamento
- tabelas de projeções
- quaisquer outras fontes operacionais

Essas tabelas permanecem como fontes de dados operacionais e de enriquecimento, mas não definem, individualmente, a carteira comercial planejável.

### 3. Consumidores
Todos os módulos que necessitem da lista oficial de Redes Comerciais deverão consumir exclusivamente a camada oficial de domínio.

Inclui, entre outros:
- RPS
- Trade Marketing
- Dashboard Comercial
- BI
- Investimentos
- futuros módulos comerciais

### 4. Governança
A elegibilidade das Redes Comerciais Planejáveis permanece centralizada nesta camada de domínio.
Alterações futuras nos critérios de elegibilidade deverão ocorrer exclusivamente nesta camada, preservando a estabilidade dos módulos consumidores.

### 5. Objetivos Permanentes
Esta arquitetura garante:
- Single Source of Truth para Redes Comerciais Planejáveis;
- eliminação de regras duplicadas entre módulos;
- desacoplamento entre dados operacionais e regras comerciais;
- reutilização da mesma definição por toda a plataforma;
- evolução futura da governança sem impacto nas aplicações consumidoras.

**Esta baseline possui caráter permanente e normativo para toda a plataforma Coffee++.**

---

## Seção 48 — Baseline Oficial — Venda Futura no Pipeline de Faturamento

**Status:** BASELINE OFICIAL CONGELADA

### Objetivo

Estabelecer a governança permanente do tratamento da Venda Futura em todo o pipeline oficial de faturamento do Coffee++, garantindo consistência entre Import Hub, banco de dados, agregações analíticas, APIs, Dashboard Comercial e processo de homologação.

### Diretrizes Permanentes

1. **Modelo de Dados**
   - O campo oficial para persistência é `valor_venda_futura`.
   - O nome "Venda Entrega Futura" permanece restrito ao layout do Excel e não deverá ser utilizado como nome interno do modelo de dados.

2. **Retrocompatibilidade**
   - Arquivos que não contenham a coluna "Venda Entrega Futura" continuam sendo importados normalmente.
   - O sistema deverá preencher `valor_venda_futura = 0`.
   - O Preview deverá registrar um `WARNING`, sem impedir a importação.

3. **Auditoria do Pipeline**
   - Toda importação deverá manter consistência entre:
     - Excel;
     - Staging;
     - `cm_faturamento`;
     - Views Materializadas;
     - Dashboard Comercial;
     - My Metrics.
   - Divergências superiores a R$ 0,01 impedem a homologação.

4. **Regra Financeira**
   - A Venda Futura não altera o cálculo do faturamento líquido.
   - Permanece vigente a fórmula oficial:
     - Faturamento Líquido = Bruto − Devoluções − Bonificações.
   - Venda Futura é um indicador complementar.

5. **Dashboard Comercial**
   - A estrutura oficial da tabela de Faturamento passa a ser:
     - Meta;
     - Real;
     - %;
     - Pace;
     - Venda Fut.;
     - Fat + Venda Fut.;
     - % Ating.
   - As fórmulas oficiais permanecem:
     - Fat + Venda Fut. = Real + Venda Fut.
     - % Ating. = (Real + Venda Fut.) ÷ Meta.

6. **Governança**
   - O My Metrics permanece como referência oficial para homologação financeira.
   - Evoluções futuras do pipeline de faturamento deverão preservar integralmente esta baseline ou registrar formalmente uma nova versão da governança.

### Status Final

Esta baseline passa a integrar permanentemente a arquitetura oficial do Coffee++, servindo como referência obrigatória para todas as futuras evoluções do pipeline de faturamento e do Dashboard Comercial.

---

## Seção 49 — Baseline Oficial — Hardening do Pipeline de Importação de Faturamento

**Status:** BASELINE OFICIAL CONGELADA

### 1. Objetivo

Estabelecer a arquitetura oficial de desempenho, auditoria e resiliência do pipeline de importação de faturamento do Coffee++, eliminando processamentos redundantes, reduzindo o tempo de execução e fortalecendo a observabilidade operacional.

---

### 2. Preparação da Importação

A RPC `preparar_importacao_faturamento` deverá utilizar bypass transacional da trigger de recálculo durante a limpeza do período de importação.

Este bypass:

- possui escopo exclusivo da transação;
- não altera o resultado funcional do processamento;
- evita recálculos intermediários sobre estados temporários da base;
- preserva o estado final consolidado produzido por `finalizar_importacao_faturamento`.

---

### 3. Estatísticas da Base

Consultas estatísticas deverão ser realizadas exclusivamente por RPCs agregadas.

Fica vedado realizar download massivo de registros apenas para cálculo de indicadores no frontend.

As estatísticas oficiais deverão ser obtidas diretamente pelo banco de dados.

---

### 4. Persistência em Staging

A carga em `cm_faturamento_staging` deverá utilizar processamento otimizado em lotes, reduzindo a quantidade de requisições necessárias sem alterar a integridade dos dados.

Toda alteração futura deverá preservar desempenho e consistência da carga.

---

### 5. Auditoria Permanente

Toda importação deverá validar automaticamente:

- quantidade de registros;
- totais financeiros;
- Venda Futura;
- integridade do lote;
- consistência entre:
  - Staging;
  - cm_faturamento;
  - Views;
  - Dashboard;
  - My Metrics.

A importação somente poderá ser considerada concluída quando todas as validações forem aprovadas.

---

### 6. Telemetria

O pipeline deverá registrar, no mínimo:

- tempo de preparação;
- tempo de promoção;
- tempo de finalização;
- tempo de auditoria;
- tempo total da importação;
- batch_id;
- RPCs executadas;
- alertas de desempenho;
- status final.

---

### 7. Alertas de Performance

Registrar automaticamente:

- WARNING para etapas superiores a 10 segundos;
- CRITICAL para etapas superiores a 30 segundos.

Os alertas deverão permanecer disponíveis para auditoria operacional.

---

### 8. Critérios Permanentes

Toda evolução futura do pipeline deverá preservar:

- integridade transacional;
- equivalência funcional;
- auditoria automática;
- telemetria;
- desempenho;
- paridade financeira com o My Metrics.

Nenhuma alteração poderá remover ou degradar estes mecanismos sem atualização formal desta baseline.

---

### 9. Evolução Controlada

Qualquer alteração futura nas RPCs de importação, no fluxo de staging, na auditoria de integridade, na telemetria ou na estratégia de processamento em lote deverá:

- preservar as garantias estabelecidas nesta baseline;
- manter equivalência funcional comprovada;
- ser acompanhada por testes de regressão;
- demonstrar ausência de degradação de desempenho;
- manter paridade financeira com o My Metrics antes da homologação.

Mudanças que alterem essas garantias deverão ser formalmente registradas em uma nova versão da baseline.

---

### Status Final

Esta baseline passa a integrar permanentemente a arquitetura oficial do Coffee++, tornando-se referência obrigatória para todas as futuras evoluções do pipeline de importação de faturamento.

---

### Homologação Operacional — Primeira Importação Pós-Seção 49

**Status:** HOMOLOGADA EM PRODUÇÃO (22/07/2026)

Foi concluída com sucesso a primeira importação operacional após a implantação da Seção 49 — Baseline Oficial — Hardening do Pipeline de Importação de Faturamento.

Resultados da homologação:

- Importação concluída sem ocorrência de statement timeout (tempo de preparação reduzido de > 120s para 0,24s);
- Pipeline executado integralmente (preparação, staging, promoção, finalização e auditoria);
- Auditoria de integridade aprovada em 5 camadas (`fn_validate_import_integrity`);
- Telemetria registrada conforme a baseline em `cm_sync_logs`;
- Comparação Coffee++ × MyMetrics validada utilizando a mesma janela temporal;
- Paridade financeira confirmada para os períodos auditados;
- Desvio financeiro apurado: 0,00%;
- Nenhuma duplicidade de pedidos ou notas identificada;
- Nenhuma divergência funcional identificada.

**Conclusão:**
A arquitetura estabelecida na Seção 49 encontra-se validada operacionalmente para o cenário homologado, permanecendo como referência oficial para futuras importações.

Novas evoluções deverão continuar observando os critérios de desempenho, auditoria, equivalência funcional e governança definidos na baseline.

---

## 50. Baseline Oficial — Single Source of Truth do Valor Oficial de Investimento

### Diretriz Permanente

O cálculo do Valor Oficial de Investimento é responsabilidade exclusiva da camada de domínio de Investimentos.

Nenhum módulo consumidor (RPS, Dashboards, Analytics, BI, APIs ou futuras funcionalidades) poderá implementar, replicar ou adaptar sua própria lógica de cálculo.

Toda funcionalidade deverá consumir exclusivamente a camada oficial de domínio responsável por determinar o Valor Oficial de Investimento.

### Regras Arquiteturais

- A camada de domínio constitui a única Single Source of Truth para o cálculo do Valor Oficial de Investimento.
- Havendo apuração financeira válida, ela prevalece como valor oficial.
- Na ausência de apuração financeira, deverá ser utilizado o valor oficial do investimento comercial comprometido, conforme definido pela regra de domínio.
- É proibida a duplicação da lógica de cálculo em SQL, Views, RPCs, APIs, componentes, dashboards ou qualquer outro consumidor.
- Alterações futuras na metodologia de cálculo deverão ocorrer exclusivamente na camada de domínio, propagando automaticamente o novo comportamento para todos os consumidores.

### Objetivos

Esta diretriz garante:

- Single Source of Truth para Investimentos;
- Paridade permanente entre todos os módulos da plataforma;
- Eliminação de duplicação de regras de negócio;
- Evolução centralizada da governança de Investimentos;
- Consistência entre os indicadores apresentados em toda a aplicação.

---

## 51. Baseline Oficial — Indicador % DISP (Dispersão)

### Diretriz Permanente

O indicador **% DISP (Dispersão)** representa a variação percentual (delta %) entre o resultado efetivamente realizado e a última projeção registrada para o mês imediatamente anterior.

Sua finalidade é medir o desvio relativo (erro de dispersão para mais ou para menos) entre o fechamento oficial do mês e a última projeção assumida antes do encerramento.

### Regra Oficial

A fórmula oficial é:

**% DISP = ((Fechamento Oficial do Mês Anterior − Última Projeção do Mês Anterior) ÷ Última Projeção do Mês Anterior) × 100**

Onde:

- **Fechamento Oficial do Mês Anterior** corresponde ao resultado consolidado e oficial do KPI no mês imediatamente anterior.
- **Última Projeção do Mês Anterior** corresponde à última projeção semanal persistida para aquele KPI no mês imediatamente anterior.
- Exemplo: Fechamento = 103.528, Projeção = 100.887 ➔ % DISP = **+3%** (em vez de 103%).

### TOTAL BRASIL

A consolidação deverá seguir as regras oficiais:

- **VOL:** cálculo utilizando os valores consolidados.
- **FAT:** cálculo utilizando os valores consolidados.
- **INVEST:** cálculo utilizando percentual ponderado pelo faturamento consolidado.

É proibida a utilização de média simples dos percentuais.

### Objetivos

Esta diretriz garante:

- interpretação uniforme do indicador % DISP como variação delta de desvio;
- consistência entre RPS, Analytics e futuros módulos;
- preservação da governança dos indicadores comerciais;
- eliminação de ambiguidades entre percentual de atingimento e desvio relativo.

---

## 52. Regra Permanente — Notificações por Responsabilidade Funcional

Todo novo fluxo de notificações do Módulo de Investimentos deve utilizar o serviço centralizado de notificações (`notification-service.ts`), proibindo e-mails institucionais hardcoded dentro de Server Actions.

A resolução dos destinatários deve ocorrer por responsabilidade funcional, utilizando as fontes oficiais do sistema.

### Exceção:
Regras específicas de negócio (como gatilhos por fase) permanecem documentadas no módulo responsável.

---

## 53. Regra Permanente — React Keys e Renderização de Listas

### Governança de Identidade de Componentes React

Toda nova implementação de listas, tabelas, selects ou componentes renderizados via `.map()` no ecossistema Coffee++ deve garantir `key` com unicidade determinística.

### Regras Obrigatórias

- É proibido utilizar como `key` campos comerciais sem garantia de unicidade:
  - código de rede
  - código matriz
  - nome da rede
  - faturamento
  - valores financeiros
  - descrições

- Prioridade de identificação:
  1. UUID ou ID físico único do banco.
  2. Chave composta com atributos estáveis.
  3. Índice (`index`) somente como complemento de segurança quando não existir identificador único confiável.

### Padrões Aceitos

Exemplos:

```tsx
key={item.id}
```

```tsx
key={`${item.codigo_matriz}-${item.nome}-${index}`}
```

### Registro de Correção — React Keys Duplicadas (Investimentos)

Foi corrigida uma ocorrência de duplicidade de keys React no Módulo Investimentos.

- **Causa raiz**: Uso de campos comerciais não únicos (`codigo_matriz`) como identificador de renderização em componentes de lista.
- **Impacto**: Componentes React poderiam sofrer duplicação, omissão de elementos ou comportamento inconsistente durante re-renderizações.
- **Correção aplicada**:
  - Substituição de keys frágeis por identificadores determinísticos.
  - Uso de UUID quando disponível.
  - Uso de composição estável (`codigo + nome + índice`) quando necessário.
- **Componentes revisados**:
  - Carta de Anuência
  - Dashboard Investimentos
  - Planejamento
  - Lançamento
  - Invest Cliente

Status: `HARDENED`

---

## 54. Sistema Inovações: Camada de Inteligência Comercial

### Objetivo

O Sistema Inovações é uma nova camada analítica do Coffee++ destinada a transformar dados operacionais homologados em inteligência para tomada de decisão comercial.

O módulo deve atuar como uma camada independente de análise, sem substituir ou alterar módulos operacionais existentes.

---

### Princípios Obrigatórios

#### 1. Não regressão

O desenvolvimento do Sistema Inovações NÃO deve alterar:

- telas existentes;
- fluxos operacionais atuais;
- regras de negócio já homologadas;
- indicadores oficiais existentes;
- tabelas oficiais sem necessidade técnica comprovada.

Toda evolução deve ocorrer preferencialmente em novos componentes, novas páginas ou novas estruturas isoladas.

---

#### 2. Fonte Oficial dos Dados

O Sistema Inovações deve consumir somente dados homologados existentes no ecossistema Coffee++.

Fontes prioritárias:

- `cm_faturamento`;
- cadastro único de clientes;
- redes;
- gerentes;
- indicadores oficiais existentes;
- módulos homologados.

Não criar duplicidade de dados operacionais.

---

#### 3. Estrutura Inicial

O Sistema Inovações será organizado em módulos independentes:

##### Fase 1 — Cockpit Comercial

Objetivo:
Criar uma visão executiva da saúde comercial.

Indicadores iniciais:
- faturamento;
- crescimento versus períodos anteriores;
- clientes ativos;
- clientes sem compra;
- clientes em risco;
- clientes crescendo;
- ranking de redes;
- curva ABC;
- oportunidades comerciais.

---

##### Fase 2 — DRE Comercial

Visão de rentabilidade comercial por:
- cliente;
- rede;
- gerente;
- região;
- canal;
- SKU.

Utilizando dados financeiros homologados disponíveis.

---

##### Fase 3 — CRM Comercial

Camada de gestão comercial integrada contendo:
- visitas;
- oportunidades;
- negociações;
- planos de ação;
- follow-ups;
- metas.

---

##### Fase 4 — Inteligência Artificial Comercial

Após maturidade dos dados:
- previsão de queda de faturamento;
- identificação de riscos;
- sugestão de visitas;
- recomendação de mix;
- previsão de atingimento;
- geração automática de resumos comerciais.

---

### Regra de Implementação

Antes de qualquer alteração:

1. apresentar plano técnico;
2. identificar impacto;
3. garantir isolamento do módulo;
4. validar que nenhuma funcionalidade existente foi modificada.

Status inicial:
`PLANEJAMENTO OFICIAL` — Não iniciado desenvolvimento.

---

## 66. Baseline Oficial — Executive Intelligence Report (RPS)

A partir de 28/07/2026, a arquitetura e a suíte de componentes do **Executive Intelligence Report (RPS)** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Arquitetura Desacoplada**: O Executive Intelligence Report passa a integrar oficialmente a arquitetura da RPS como o mecanismo executivo padrão de análise estratégica. Toda a inteligência do relatório deverá permanecer concentrada no `ExecutiveIntelligenceEngine`, mantendo desacoplamento completo entre regras de negócio e formatos de apresentação. O renderer (PDF ou qualquer formato futuro) é estritamente responsável pela apresentação visual dos dados, sendo proibida a implementação de regras de negócio, cálculos, diagnósticos ou recomendações na camada de renderização.
2. **Single Source of Truth (SSOT)**: Todo cálculo, indicador, diagnóstico, ranking, score, tendência, oportunidade, recomendação e decisão deverá utilizar exclusivamente os dados oficiais da RPS (SSOT). É proibido duplicar cálculos, criar regras paralelas, utilizar dados externos ao pipeline oficial ou gerar recomendações sem evidência objetiva. Na ausência de evidências suficientes, a conclusão deverá ser omitida.
3. **Estrutura Oficial do Motor**: O Executive Intelligence Report possui como componentes oficiais congelados: `ExecutiveAnalyticalEngine`, `ExecutiveDiagnosticEngine`, `ExecutiveRankingEngine` e `ExecutiveRecommendationEngine`. Todos operando sobre um único payload estruturado (`ExecutiveIntelligenceData`), consumido por renderizadores desacoplados.
4. **Formatos de Saída**: O motor deverá permanecer independente do formato de saída. O PDF Executivo é o primeiro renderer oficial, permitindo reutilização futura para dashboards, apresentações, e-mails executivos e demais canais sem alteração da lógica analítica.
5. **Governança e Auditoria Mandatória**: Toda evolução futura deverá preservar a separação entre inteligência e apresentação, compatibilidade com o SSOT oficial da RPS, determinismo dos cálculos, rastreabilidade das recomendações e ausência total de regressão funcional na RPS (`npm run health:analytics`, `npx tsc --noEmit` e `npm run build`).

Status Arquitetural: `EXECUTIVE_INTELLIGENCE_REPORT = LOCKED` & `BASELINE = CONFIRMED`.






