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
