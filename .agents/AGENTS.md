# Índice Executivo — Coffee++

## Governança
- Seção 10 — Governança Financeira
- Seção 14 — Analytics Engine
- Seção 67 — Governança MCP
- Seção 68 — Operação Segura da Infraestrutura MCP
- Seção 69 — Catálogo Oficial de Baselines

## Arquiteturas LTS
- Analytics Engine V1
- Presentation Framework
- Import Hub
- Dashboard Favorites
- Customer Ownership
- Investment Engine
- Authentication Layer
- Notification Engine
- Telemetry
- MCP Infrastructure

## Regras Permanentes
- Fontes Oficiais
- Ownership Comercial
- Favoritos
- Importação
- Segurança
- Auditoria

---

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

---

## 67. Baseline Oficial — Governança da Infraestrutura MCP (Baseline Permanente)

A partir de 01/08/2026, a governança da infraestrutura MCP torna-se uma diretriz permanente e oficial do Coffee++, operando em camada completamente separada e independente do código da aplicação.

### Objetivo:
Garantir que a infraestrutura MCP permaneça estável, reproduzível e independente da aplicação Coffee++.

### Contexto e Motivação:
Em 01/08/2026, um problema de infraestrutura MCP (npm registry configurado com HTTP plano em `~/.npmrc`, causando `"context deadline exceeded"`) foi diagnosticado e corrigido. Este baseline garante que problemas similares não se repitam e que sejam tratados na camada correta (infraestrutura), jamais como bugs da aplicação Coffee++.

### Diretrizes Mandatórias:

1. **Separação Absoluta de Diagnóstico**: Toda investigação deve separar claramente:
   - Problemas da infraestrutura MCP (npm, Node.js, TLS, tokens, PATH, `.npmrc`, CLIs).
   - Problemas do código da aplicação Coffee++.
   - Problemas de banco de dados (Supabase/Postgres).
   Erros de inicialização de MCP servers (Firebase, GitHub, Supabase, Sequential Thinking) devem ser investigados e corrigidos exclusivamente na camada de infraestrutura. É expressamente proibido alterar código do Coffee++ para contornar falhas de MCP.

2. **Registro HTTPS Obrigatório**: O npm registry deve utilizar exclusivamente `https://registry.npmjs.org/`. Qualquer referência a `http://registry.npmjs.org` (HTTP plano) em `~/.npmrc`, `.npmrc` de projeto, variáveis de ambiente ou configuração MCP é considerada violação de segurança e deve ser corrigida imediatamente.

3. **TLS 1.2+ Obrigatório**: É proibido utilizar configurações que desabilitem TLS/SSL em ambiente de desenvolvimento permanente. Todas as conexões de MCP servers com registries, APIs e serviços externos devem utilizar TLS 1.2 ou superior. A configuração `strict-ssl = false` no npm é expressamente proibida.

4. **Health Check Mandatório**: O comando `npm run health:mcp` é a referência oficial para validar a infraestrutura antes de iniciar alterações no projeto. Toda alteração em Node.js, npm, Firebase CLI, GitHub CLI, Supabase CLI ou configuração dos MCPs deverá ser seguida da execução obrigatória do `npm run health:mcp`. Deve ser executado:
   - Após qualquer atualização de Node.js, npm ou nvm.
   - Após qualquer alteração em `~/.npmrc` ou configurações de MCP.
   - Sempre que um MCP server apresentar erro de inicialização.
   - Periodicamente como verificação preventiva.

5. **Nenhum Diagnóstico sem Validação de Infraestrutura**: Nenhum diagnóstico poderá concluir que o problema está no Coffee++ sem antes validar a infraestrutura MCP via `npm run health:mcp`.

6. **Diagnóstico Estruturado Obrigatório**: Mensagens genéricas como "MCP Error" ou "context deadline exceeded" não são consideradas diagnósticos válidos. Toda falha deve identificar obrigatoriamente:
   - MCP server afetado.
   - Causa raiz (root cause).
   - Evidência técnica (log, output, stack trace).
   - Ação corretiva recomendada.

7. **Cinco MCP Servers Oficiais**: Os servidores MCP oficiais do ecossistema Coffee++ são:
   - `firebase-mcp-server` — Firebase CLI + OAuth browser login.
   - `github-mcp-server` — GitHub API via Personal Access Token (PAT).
   - `supabase-mcp-server` — Supabase Management API via Access Token.
   - `sequential-thinking-mcp-server` — Motor de raciocínio sequencial (stateless).
   - Workspace Local — Ferramentas locais do IDE.

8. **Tokens e Credenciais**: Tokens de autenticação (`GITHUB_PERSONAL_ACCESS_TOKEN`, `SUPABASE_ACCESS_TOKEN`, Firebase OAuth) são configurados exclusivamente nos arquivos `mcp_config.json` do IDE. É proibido hardcodar tokens no código da aplicação ou em variáveis de ambiente do projeto.

9. **Auditoria Mandatória de Encerramento**: Ao final de qualquer ciclo de manutenção da infraestrutura MCP, é obrigatória a execução do `npm run health:mcp` com todos os checks passando (0 FAIL).

### Componentes Oficiais:
- **Script**: `scripts/health-mcp.ts`
- **Comando**: `npm run health:mcp`
- **Configurações**: `~/.gemini/antigravity-ide/mcp_config.json`, `~/.gemini/config/mcp_config.json`

Status Arquitetural: `MCP_INFRASTRUCTURE_GOVERNANCE = LOCKED` & `BASELINE = CONFIRMED`.

---

## 68. Baseline Oficial — Operação Segura da Infraestrutura MCP (Baseline Permanente)

A partir de 01/08/2026, as diretrizes de operação segura da infraestrutura MCP tornam-se baseline permanente e oficial do Coffee++.

### Objetivo:
Garantir que toda evolução do Coffee++ ocorra sobre uma infraestrutura MCP íntegra, validada e desacoplada da lógica de negócio da aplicação.

### Diretrizes Mandatórias:

1. **Validação Prévia Obrigatória**: Antes de qualquer refatoração arquitetural, atualização de dependências, alteração de ambiente ou investigação de falhas sistêmicas, deverá ser executado obrigatoriamente: `npm run health:mcp`.

2. **Proibição de Diagnóstico sem Validação**: Nenhuma investigação poderá atribuir causa ao Coffee++ sem que a infraestrutura MCP tenha sido previamente validada com sucesso.

3. **Identificação Explícita de Camada**: Toda conclusão técnica deverá indicar explicitamente em qual camada o problema foi identificado:
   - Infraestrutura MCP.
   - Aplicação (Coffee++).
   - Banco de Dados / Supabase.
   - Serviços externos.

4. **Diagnóstico Completo Obrigatório**: Todo diagnóstico deverá apresentar obrigatoriamente:
   - Evidências técnicas.
   - Logs.
   - Stack trace (quando existir).
   - Causa raiz.
   - Impacto.
   - Ação corretiva.

5. **MCP como Camada de Acesso**: A infraestrutura MCP é considerada exclusivamente uma camada de acesso, automação e diagnóstico.

6. **Proibição de Regras de Negócio no MCP**: É proibido implementar regras de negócio, validações funcionais ou decisões comerciais dentro da infraestrutura MCP.

7. **Independência da Aplicação**: O Coffee++ não poderá depender do estado operacional dos MCPs para executar sua lógica de negócio. Os MCPs devem ser utilizados apenas para desenvolvimento, auditoria, manutenção e automação.

8. **Revalidação Pós-Alteração**: Toda alteração em Node.js, npm, Firebase CLI, GitHub CLI, Supabase CLI ou configuração dos servidores MCP deverá ser seguida obrigatoriamente da execução completa do `npm run health:mcp`.

9. **Homologação Oficial**: O comando `health:mcp` passa a ser a referência oficial para homologação da infraestrutura antes de qualquer deploy, investigação ou refatoração de grande porte.

10. **Correção Antes da Continuidade**: Qualquer falha de infraestrutura identificada deverá ser corrigida antes da continuidade do desenvolvimento, evitando diagnósticos incorretos sobre o código da aplicação.

Status Arquitetural: `MCP_INFRASTRUCTURE_OPERATION = LOCKED` & `MCP_HEALTHCHECK = MANDATORY` & `APPLICATION_AND_MCP = FULLY_DECOUPLED` & `BASELINE = CONFIRMED`.

---

## 69. Catálogo Oficial de Baselines Arquiteturais (LTS)

A partir de 01/08/2026, o catálogo oficial de baselines arquiteturais torna-se a referência permanente e centralizada do Coffee++.

### Objetivo:
Centralizar os componentes estruturais oficialmente homologados do Coffee++, permitindo que qualquer nova funcionalidade, refatoração ou auditoria identifique imediatamente quais arquiteturas possuem baseline permanente e regras próprias de governança.

### Componentes Arquiteturais Homologados:

| Componente | Status | Governança |
|------------|--------|------------|
| Analytics Engine V1 | ✅ LOCKED | Fonte única para consultas analíticas |
| Financial Governance | ✅ LOCKED | Cinco fontes oficiais e regras financeiras |
| Dashboard Favorites | ✅ LOCKED | Favoritos persistidos via banco e RLS |
| Customer Ownership | ✅ LOCKED | Cadastro Único como fonte oficial de ownership |
| Investment Engine | ✅ LOCKED | Campanhas, ações e ownership comercial |
| Import Hub | ✅ LOCKED | Pipeline oficial de importação e validação |
| Presentation Framework | ✅ LOCKED | Componentes visuais corporativos |
| Authentication Layer | ✅ LOCKED | Autenticação, perfis e autorização |
| Notification Engine | ✅ LOCKED | Notificações e mensageria |
| Telemetry | ✅ LOCKED | Logs, auditoria e observabilidade |
| MCP Infrastructure | ✅ LOCKED | Infraestrutura de desenvolvimento e automação |
| Metas Integrity | ✅ LOCKED | Identidade matemática, SSOT targets, segregação KA×Dist |

### Regras Gerais:

1. **Verificação Prévia Obrigatória**: Todo novo módulo deverá verificar previamente se já existe uma baseline arquitetural aplicável.

2. **Proibição de Implementações Paralelas**: É proibida a criação de implementações paralelas para componentes já homologados.

3. **Evolução por Extensão**: Toda evolução deverá ocorrer por extensão da baseline existente, preservando compatibilidade e retrocompatibilidade sempre que possível.

4. **Critérios de Homologação**: Qualquer nova arquitetura somente poderá ser considerada oficial após:
   - Implementação concluída.
   - Validação funcional.
   - Compilação sem erros.
   - Documentação técnica.
   - Registro formal no AGENTS.md.

5. **Atualização Contínua**: Este catálogo representa a relação oficial das arquiteturas permanentes do Coffee++ e deve ser mantido atualizado sempre que uma nova baseline for homologada.

Status Arquitetural: `ARCHITECTURE_BASELINES = OFFICIAL` & `LTS_COMPONENTS = REGISTERED` & `PROJECT_GOVERNANCE = CENTRALIZED` & `BASELINE_CATALOG = ACTIVE`.

---

## 70. Baseline Oficial — Governança de Conformidade Arquitetural Contínua (Baseline Permanente)

A partir de 01/08/2026, a governança de conformidade arquitetural contínua torna-se diretriz permanente e oficial do Coffee++.

### Objetivo:
Garantir que toda evolução do Coffee++ permaneça aderente às arquiteturas homologadas, às baselines permanentes e às regras de governança registradas neste documento.

### Diretrizes Mandatórias:

1. **Verificação Prévia de Baseline**: Toda nova funcionalidade deverá identificar previamente se existe uma arquitetura, baseline ou componente oficial aplicável antes da implementação.

2. **Proibição de Duplicação de Responsabilidades**: Nenhuma implementação poderá duplicar responsabilidades já pertencentes a componentes homologados (Analytics Engine, Import Hub, Presentation Framework, Ownership, Authentication, Notification Engine, Telemetry, etc.).

3. **Atualização Documental Obrigatória**: Sempre que uma alteração modificar uma arquitetura homologada, deverá ser avaliado se é necessário atualizar:
   - AGENTS.md.
   - ADR correspondente (`docs/adr/`).
   - Documentação de Arquitetura (`docs/architecture/`).
   - Runbook operacional (`docs/runbooks/`).

4. **Compatibilidade com Regras Permanentes**: Toda mudança estrutural deverá preservar compatibilidade com as regras permanentes já registradas, salvo quando houver decisão arquitetural formal aprovando uma nova baseline.

5. **Rastreabilidade Código–Documentação–Governança**: Alterações em APIs, banco de dados, materialized views, RPCs, componentes compartilhados ou infraestrutura deverão manter rastreabilidade entre código, documentação e governança.

6. **Critérios de Promoção a Baseline LTS**: Novos componentes somente poderão ser promovidos ao status de Baseline LTS após:
   - Implementação concluída.
   - Validação funcional.
   - Validação técnica.
   - Compilação sem erros.
   - Documentação técnica concluída.
   - Registro formal no Catálogo Oficial de Baselines (Seção 69).

7. **Validações Técnicas Pré-Homologação**: Antes de qualquer homologação final deverão ser executadas todas as validações técnicas aplicáveis ao componente alterado (build, tipagem, auditorias, testes e verificações de integridade).

8. **Sincronização Documentação–Arquitetura**: A documentação do projeto deverá permanecer sincronizada com a arquitetura implementada, evitando divergências entre código, operação e governança.

Status Arquitetural: `ARCHITECTURE_COMPLIANCE = MANDATORY` & `DOCUMENTATION_SYNC = REQUIRED` & `GOVERNANCE_TRACEABILITY = ENABLED` & `CONTINUOUS_ARCHITECTURE_REVIEW = ACTIVE`.

---

## 71. Política de Evolução da Governança (Encerramento da Estrutura)

A partir de 01/08/2026, a estrutura do AGENTS.md passa a ser governada por política formal de evolução controlada.

### Objetivo:
Preservar a qualidade, a clareza e a sustentabilidade do AGENTS.md como documento oficial de governança do Coffee++, evitando crescimento desnecessário e duplicação de regras.

### Diretrizes Permanentes:

1. **Escopo Exclusivo**: O AGENTS.md representa exclusivamente as diretrizes permanentes de arquitetura, governança e operação do Coffee++.

2. **Critério para Novas Seções**: Novas seções somente poderão ser criadas quando representarem uma nova capacidade arquitetural permanente do sistema (ex.: novo Engine, novo Framework, nova Camada de Infraestrutura ou novo Componente Corporativo).

3. **Exclusões do AGENTS.md**: Funcionalidades, correções, incidentes, melhorias de UX, ajustes de banco de dados ou evoluções de módulos existentes não deverão gerar novas seções no AGENTS.md.

4. **Documentação no Local Apropriado**: Toda documentação específica deverá ser registrada no local correto:
   - `docs/adr/` — Decisões arquiteturais.
   - `docs/architecture/` — Documentação técnica.
   - `docs/runbooks/` — Operação e suporte.
   - Walkthroughs — Implementação e homologação.

5. **Complementação sobre Duplicação**: Sempre que possível, novas regras deverão complementar ou atualizar uma seção existente, evitando duplicidade de conteúdo.

6. **Referência Centralizada**: O Catálogo Oficial de Baselines (Seção 69) passa a ser a referência para identificar quais componentes possuem governança própria.

7. **Princípio de Sustentabilidade**: A manutenção do AGENTS.md deverá priorizar simplicidade, rastreabilidade e estabilidade ao longo do ciclo de vida do projeto.

### Diretriz de Manutenção:
A partir desta versão, o AGENTS.md entra em regime de manutenção contínua.

Novas funcionalidades, módulos ou correções não deverão ampliar este documento, salvo quando introduzirem uma nova capacidade arquitetural permanente.

As evoluções do Coffee++ deverão ser registradas preferencialmente em:
- ADRs (`docs/adr/`);
- Documentação de Arquitetura (`docs/architecture/`);
- Runbooks Operacionais (`docs/runbooks/`);
- Walkthroughs de implementação.

O AGENTS.md permanece como o documento normativo de mais alto nível do projeto e deverá evoluir prioritariamente por revisão das diretrizes existentes, preservando simplicidade, consistência e estabilidade.

Status Arquitetural: `AGENTS_STRUCTURE = STABLE` & `GOVERNANCE_GROWTH = CONTROLLED` & `DOCUMENTATION_STRATEGY = CONSOLIDATED` & `BASELINE_EVOLUTION = MANAGED`.

---

## 72. Baseline Oficial — Single Source of Truth de Autenticação e Autorização (`cm_user_profiles`)

A partir de 05/08/2026, a tabela `cm_user_profiles` é a única fonte oficial e soberana para autenticação, perfis e permissões em toda a plataforma Coffee++.

### Diretrizes Mandatórias:

1. **Fonte Única Soberana**: A tabela `public.cm_user_profiles` é a única estrutura autorizada para armazenamento, consulta e validação de perfis, cargos, papéis (roles) e permissões de usuários.
2. **Proibição Absoluta de Tabelas Legadas ou Paralelas**: É expressamente proibida a criação ou utilização de consultas às tabelas `profiles`, `public.profiles` ou qualquer outra estrutura paralela de usuários no frontend, backend, Server Actions, APIs HTTP, Hooks, Helpers ou RPCs.
3. **Reutilização Obrigatória**: Qualquer novo módulo, funcionalidade, API, Server Action, Hook ou Serviço que necessite consultar o perfil ou permissões do usuário logado deverá reutilizar exclusivamente os helpers de autenticação baseados em `cm_user_profiles` (`src/lib/supabase/auth-helpers.ts` ou `supabase.from("cm_user_profiles")`).
4. **Validação Automática em Code Review**:
   - É mandatório verificar a ausência de consultas a `from("profiles")` ou `from('profiles')`.
   - Havendo qualquer ocorrência, a alteração deverá ser sumariamente reprovada e corrigida para `from("cm_user_profiles")`.
5. **Preservação do Controle de Segurança**: Checagens de permissão de perfis executivos (`Admin`, `CEO`, `Presidência`, `Diretoria`) devem utilizar correspondência normalizada insensível a maiúsculas/minúsculas (`toLowerCase().trim()`).

Status Arquitetural: `AUTHORIZATION_SINGLE_SOURCE_OF_TRUTH = cm_user_profiles` & `LEGACY_PROFILE_TABLE = FORBIDDEN` & `SECURITY_BASELINE = LOCKED`.

---

## 73. Diretriz Permanente — Implementação Baseada em Evidências (`IMPLEMENTATION_EVIDENCE`)

A partir de 05/08/2026, qualquer nova funcionalidade ou alteração na plataforma Coffee++ seguirá obrigatoriamente o ciclo estrito de evidências:

### Fluxo Obrigatório de Engenharia:
1. **IMPLEMENTAÇÃO**: Desenvolver a funcionalidade ou alteração aprovada.
2. **VALIDAÇÃO**:
   - Executar suíte de testes automatizados aplicáveis.
   - Executar `npx tsc --noEmit` com 0 erros.
   - Executar `npm run build` com sucesso (quando aplicável).
   - Validar visualmente a interface quando houver alterações de frontend.
3. **HOMOLOGAÇÃO**: Emitir relatório de conclusão SOMENTE APÓS a validação completa com evidências empíricas.

### Taxonomia Mandatória nos Relatórios:
- 🟢 **IMPLEMENTADO E VALIDADO**: Funcionalidades comprovadamente implementadas, compiladas e verificadas.
- 🟡 **IMPLEMENTADO MAS NÃO VALIDADO**: Código desenvolvido, porém sem comprovação de execução ou validação visual.
- 🔴 **NÃO IMPLEMENTADO**: Funcionalidades apenas propostas, parciais ou pendentes.

### Regra de Prioridade em Caso de Inconsistência:
Havendo qualquer divergência entre o relatório e o comportamento real na aplicação, a prioridade passa a ser **estritamente a investigação da causa raiz**, sendo proibida a geração de relatórios de homologação prematuros.

Princípio Permanente: *"Primeiro implementar. Depois validar. Somente então homologar."*

Status Arquitetural: `IMPLEMENTATION_EVIDENCE = LOCKED` & `REPORTS_MUST_MATCH_REALITY = TRUE` & `EVIDENCE_FIRST = MANDATORY`.

---

## 74. Diretriz Permanente — Padronização de Evidências Visuais (`EVIDENCE_METADATA_STANDARD`)

A partir de 05/08/2026, toda e qualquer evidência visual apresentada em relatórios, auditorias ou homologações de frontend deverá obrigatoriamente incluir os seguintes 4 metadados estruturados:

### Formato Mandatório de Apresentação:
1. **Caminho do arquivo gerado**: Caminho exato no repositório/artefatos (ex: `artifacts/tests/metas-rede/test2_meta_744k.png`).
2. **Data/Hora da captura**: Timestamp em formato pt-BR (`DD/MM/YYYY HH:MM`).
3. **Tela auditada**: Rota ou endpoint correspondente (ex: `/gestao/metas-rede`).
4. **Cenário executado**: Parâmetros de entrada e resultado obtido em tela.

Status Arquitetural: `EVIDENCE_METADATA_STANDARD = LOCKED` & `EVIDENCE_FORMATTING = MANDATORY`.

---

## 75. Baseline Oficial — Responsividade da Tabela "Resumo do Mês"

### Status
`BASELINE PERMANENTE = HOMOLOGADA` & `RESUMO_MES_RESPONSIVENESS = LOCKED`.

A Refatoração da Responsividade da Tabela "Resumo do Mês" foi oficialmente homologada e incorporada à Baseline Funcional Permanente da Plataforma Coffee++.

### Objetivo
Garantir que a tabela de indicadores do Dashboard de Vendas utilize integralmente a largura disponível do container, mantendo todos os grupos de indicadores completamente visíveis em notebooks e desktops, sem necessidade de scroll horizontal.

### Diretrizes Permanentes
A partir desta baseline, qualquer alteração neste componente deverá preservar obrigatoriamente:
- Responsividade integral da tabela.
- Utilização de 100% da largura útil disponível.
- Ausência de scroll horizontal em notebooks e desktops.
- Exibição simultânea de todos os grupos de indicadores.
- Preservação da identidade visual do Dashboard.
- Distribuição proporcional das colunas.
- Escalabilidade para inclusão de novos indicadores sem necessidade de refatoração estrutural.
- Compatibilidade com as resoluções homologadas.

### Resoluções Homologadas
A implementação foi validada para:
- 1366×768
- 1440×900
- 1536×864
- 1920×1080

Em todas elas a tabela deverá permanecer totalmente visível.

### Requisitos Arquiteturais Permanentes
Toda evolução futura deverá seguir os seguintes princípios:
- Responsividade nativa.
- Layout fluido.
- Aproveitamento integral da largura disponível.
- Componentização reutilizável.
- Escalabilidade para novos grupos de indicadores.
- Ausência de soluções paliativas baseadas em larguras fixas.
- Conformidade com o Design System da Plataforma Coffee++.

### Restrições
É vedado:
- introduzir scroll horizontal em notebooks ou desktops;
- ocultar indicadores para acomodar largura;
- remover grupos de métricas;
- reduzir a legibilidade da tabela;
- criar exceções específicas para resoluções isoladas.

Qualquer alteração deverá resolver a causa raiz do problema, preservando a arquitetura responsiva homologada.

### Governança
Toda modificação futura neste componente deverá ser precedida por auditoria arquitetural e validada nas resoluções homologadas.
Esta baseline passa a ser a referência oficial para qualquer evolução da tabela "Resumo do Mês" do Dashboard de Vendas da Plataforma Coffee++.

### Proteção da Baseline
Toda alteração futura na Tabela "Resumo do Mês" deverá obrigatoriamente:
- preservar a responsividade homologada;
- manter a ausência de scroll horizontal em notebooks e desktops;
- preservar a distribuição automática das colunas;
- validar compatibilidade nas resoluções homologadas;
- apresentar auditoria arquitetural antes da homologação;
- atualizar esta seção caso a arquitetura do componente seja modificada.

É vedada qualquer alteração que reduza a usabilidade ou descaracterize a baseline homologada sem abertura formal de uma nova Demanda Arquitetural e respectiva homologação.

---

## 76. Política Permanente de Proteção de Baselines (`BASELINE_PROTECTION_POLICY`)

### Status
`POLICY = PERMANENT` & `GOVERNANCE = ACTIVE` & `BASELINE_PROTECTION = MANDATORY`.

### Objetivo
Estabelecer uma política permanente de governança para garantir que toda Baseline Oficial homologada da Plataforma Coffee++ permaneça protegida contra regressões arquiteturais, funcionais e de experiência do usuário.

### Princípios Gerais
Toda Baseline Oficial passa a ser considerada um ativo permanente da Plataforma Coffee++.
Após homologada, nenhuma implementação poderá reduzir sua qualidade, alterar seu comportamento ou descaracterizar sua arquitetura sem abertura formal de uma nova Demanda Arquitetural.

### Regras Obrigatórias
Toda alteração em componentes protegidos deverá:
- preservar integralmente a funcionalidade homologada;
- preservar a experiência do usuário (UX);
- preservar a arquitetura aprovada;
- preservar o desempenho;
- preservar a responsividade homologada;
- preservar regras de negócio;
- preservar contratos de APIs e integrações;
- preservar compatibilidade com módulos existentes.

### Processo Obrigatório
Antes de qualquer alteração em uma Baseline Oficial deverá existir:
1. Auditoria Arquitetural.
2. Identificação de impactos.
3. Plano de implementação.
4. Plano de rollback.
5. Critérios de aceitação.
6. Homologação técnica.
7. Atualização do AGENTS.md.

Nenhuma etapa poderá ser ignorada.

### Proibição de Regressões
É expressamente proibido:
- reduzir funcionalidades;
- criar soluções paliativas;
- introduzir regressões visuais;
- degradar performance;
- alterar comportamento homologado sem justificativa técnica;
- remover recursos previamente homologados;
- quebrar compatibilidade com funcionalidades existentes.

Toda alteração deverá manter compatibilidade retroativa sempre que tecnicamente possível.

### Evolução Controlada
Toda evolução deverá ser cumulativa.
Sempre que possível, novas funcionalidades deverão expandir a arquitetura existente, nunca substituí-la por soluções inferiores.
Caso uma refatoração estrutural seja necessária, deverá existir justificativa técnica documentada e nova homologação.

### Auditoria Obrigatória
Toda implementação deverá responder, antes da homologação, às seguintes perguntas:
- A solução preserva todas as funcionalidades existentes?
- Existe alguma regressão visual?
- Existe alguma regressão funcional?
- Existe impacto em performance?
- Existe impacto em escalabilidade?
- Existe impacto em governança?
- Existe impacto em segurança?
- Existe impacto em acessibilidade?
- Existe impacto em responsividade?

Caso qualquer resposta seja positiva, a homologação somente poderá ocorrer após análise técnica.

### Status de Baseline
Toda Baseline Oficial deverá possuir um dos seguintes estados:
- EM DESENVOLVIMENTO
- EM VALIDAÇÃO
- HOMOLOGADA
- PROTEGIDA
- SUPERSEDED (substituída por nova baseline)

### Diretriz Permanente
A Plataforma Coffee++ adota como princípio permanente que toda evolução deve aumentar a qualidade da arquitetura.
Nenhuma Release poderá reduzir o nível técnico previamente homologado.
Toda implementação deverá deixar a plataforma igual ou melhor do que estava anteriormente.

Esta política passa a ser obrigatória para todas as futuras Releases da Plataforma Coffee++.

---

## 77. Política Permanente de Isolamento de Demandas (`DEMAND_ISOLATION_POLICY`)

### Status
`POLICY = PERMANENT` & `DEMAND_ISOLATION = MANDATORY` & `CHANGE_SCOPE = CONTROLLED`.

### Objetivo
Garantir que toda demanda seja implementada exclusivamente dentro do seu escopo aprovado, evitando efeitos colaterais em módulos já homologados da Plataforma Coffee++.

### Princípio
Cada demanda deverá possuir um escopo claramente definido.
Nenhuma implementação poderá alterar componentes, serviços, regras de negócio, layouts, APIs ou módulos que não pertençam diretamente ao escopo da demanda sem autorização formal.

### Regra Geral
Toda implementação deverá obedecer ao princípio do menor impacto.
Sempre que possível:
- modificar apenas o componente necessário;
- evitar alterações compartilhadas;
- evitar refatorações amplas durante demandas pontuais;
- preservar contratos existentes.

### Alterações Fora do Escopo
Caso seja identificada a necessidade de modificar outro módulo durante uma implementação, o processo deverá ser interrompido para apresentação de:
- justificativa técnica;
- análise de impacto;
- riscos;
- benefícios;
- componentes afetados.

Somente após aprovação poderá haver expansão do escopo.

### Componentes Protegidos
São considerados protegidos:
- componentes pertencentes a Baselines Oficiais;
- módulos homologados;
- APIs públicas;
- Design System;
- Analytics;
- Dashboards;
- Import Hub;
- Engine de KPIs;
- Promotor;
- qualquer outro componente marcado como Baseline Permanente.

### Auditoria Obrigatória
Antes da homologação responder:
- esta demanda alterou algum componente fora do escopo?
- algum módulo protegido foi modificado?
- alguma API pública sofreu alteração?
- alguma Baseline Oficial foi impactada?
- existe risco de regressão indireta?

Caso qualquer resposta seja positiva, deverá existir documentação formal da expansão do escopo.

### Diretriz Permanente
A Plataforma Coffee++ adota como princípio que cada demanda deve produzir o menor impacto possível sobre o restante da arquitetura.
Quanto menor o raio de alteração, maior a previsibilidade, estabilidade e segurança das Releases.

Toda exceção deverá ser documentada e homologada.

---

## 78. Política Permanente de Controle de Mudanças Arquiteturais (`ARCHITECTURE_CHANGE_CONTROL_POLICY`)

### Status
`POLICY = PERMANENT` & `ARCHITECTURE_CHANGE_CONTROL = MANDATORY` & `TECHNICAL_DEBT_PREVENTION = ACTIVE`.

### Objetivo
Garantir que toda alteração arquitetural da Plataforma Coffee++ seja realizada de forma planejada, documentada, auditável e compatível com as Baselines Oficiais existentes.

### Definição
Considera-se Mudança Arquitetural qualquer alteração que impacte:
- estrutura de componentes;
- organização dos módulos;
- Design System;
- contratos de APIs;
- banco de dados;
- modelos de dados;
- autenticação;
- autorização;
- pipelines;
- integrações;
- motores de cálculo;
- componentes compartilhados;
- infraestrutura da aplicação.

### Obrigatoriedade
Nenhuma Mudança Arquitetural poderá ser implementada sem documentação prévia.
Antes da implementação deverá existir obrigatoriamente:
- objetivo da mudança;
- justificativa técnica;
- benefícios esperados;
- análise de impacto;
- riscos identificados;
- estratégia de rollback;
- plano de validação;
- critérios de aceitação.

### Compatibilidade
Toda Mudança Arquitetural deverá preservar, sempre que tecnicamente possível:
- compatibilidade com Baselines existentes;
- compatibilidade com APIs públicas;
- compatibilidade com módulos homologados;
- estabilidade funcional da plataforma.

Caso a compatibilidade não seja possível, deverá existir um plano formal de migração e depreciação.

### Controle de Dívida Técnica
Nenhuma mudança poderá aumentar deliberadamente a dívida técnica da plataforma.
Sempre que possível, a implementação deverá:
- simplificar a arquitetura;
- reduzir acoplamento;
- aumentar reutilização;
- melhorar legibilidade;
- reduzir complexidade;
- melhorar testabilidade.

### Auditoria Obrigatória
Antes da homologação responder:
- houve alteração arquitetural?
- existe impacto em componentes compartilhados?
- houve alteração em contratos públicos?
- existe plano de rollback?
- a documentação foi atualizada?
- houve aumento de dívida técnica?
- a mudança preserva as Baselines existentes?

Caso qualquer resposta exija ação corretiva, a homologação deverá ocorrer somente após sua resolução.

### Diretriz Permanente
A Plataforma Coffee++ adota como princípio permanente que toda mudança arquitetural deve aumentar ou preservar a qualidade estrutural da solução.
Mudanças que aumentem complexidade sem benefício técnico comprovado não deverão ser homologadas.

---

## 79. Política Permanente de Compatibilidade Retroativa (`BACKWARD_COMPATIBILITY_POLICY`)

### Status
`POLICY = PERMANENT` & `BACKWARD_COMPATIBILITY = MANDATORY` & `BREAKING_CHANGES = CONTROLLED`.

### Objetivo
Garantir que toda evolução da Plataforma Coffee++ preserve a compatibilidade com funcionalidades, componentes, APIs, módulos e Baselines previamente homologados, evitando que novas implementações introduzam quebras de comportamento ou exijam adaptações inesperadas.

### Princípio Soberano
A evolução da plataforma deverá ser cumulativa.
Sempre que tecnicamente possível, novas funcionalidades deverão coexistir com as funcionalidades existentes, preservando contratos, comportamentos e integrações previamente homologados.

### Compatibilidade Obrigatória
Toda implementação deverá preservar:
- APIs públicas;
- contratos entre componentes;
- estruturas de dados;
- regras de negócio homologadas;
- componentes compartilhados;
- Design System;
- permissões e perfis de acesso;
- integrações existentes;
- indicadores e dashboards;
- Baselines Oficiais.

### Breaking Changes
Qualquer alteração que possa modificar comportamento previamente homologado será considerada um Breaking Change.
Nenhum Breaking Change poderá ser implementado sem:
- justificativa técnica;
- análise de impacto;
- plano de migração;
- plano de rollback;
- aprovação formal;
- atualização da documentação oficial.

### Estratégia de Evolução
Sempre que possível deverá ser adotada uma das seguintes estratégias:
- evolução incremental;
- versionamento de APIs;
- depreciação controlada;
- período de convivência entre versões;
- migração gradual.

### Auditoria Obrigatória
Antes da homologação responder:
- existe quebra de compatibilidade?
- alguma API mudou?
- alguma regra de negócio foi alterada?
- algum módulo homologado foi impactado?
- existe plano de migração?
- existe plano de rollback?
- a documentação foi atualizada?

Caso qualquer resposta seja positiva, a homologação somente poderá ocorrer após validação técnica formal.

### Diretriz Permanente
A Plataforma Coffee++ adota como princípio permanente que novas funcionalidades deverão ampliar a capacidade da plataforma sem comprometer a estabilidade das funcionalidades já homologadas.
Sempre que possível, preservar compatibilidade retroativa será obrigatório.

---

## 80. Constituição da Engenharia da Plataforma Coffee++ (`ENGINEERING_CONSTITUTION`)

### Status
`POLICY = PERMANENT` & `ENGINEERING_CONSTITUTION = ACTIVE` & `GOVERNANCE = SOVEREIGN`.

### Objetivo
Estabelecer os princípios fundamentais que deverão orientar toda decisão técnica, arquitetural e funcional da Plataforma Coffee++, servindo como referência superior para todas as políticas permanentes, baselines e futuras releases.

### Princípios Fundamentais
Toda evolução da Plataforma Coffee++ deverá respeitar obrigatoriamente os seguintes princípios, apresentados em ordem de prioridade:

1. **Correção**: A solução deverá estar correta antes de estar otimizada. Nenhuma otimização justifica comportamento incorreto.
2. **Estabilidade**: A plataforma deverá priorizar previsibilidade e confiabilidade. Toda mudança deverá minimizar riscos de regressão.
3. **Simplicidade**: Sempre que houver mais de uma solução tecnicamente válida, deverá ser escolhida a de menor complexidade estrutural.
4. **Escalabilidade**: Toda implementação deverá considerar a evolução futura da plataforma. Evitar soluções que exijam reescritas frequentes.
5. **Manutenibilidade**: O código deverá ser facilmente compreendido, revisado e evoluído por outros desenvolvedores.
6. **Reutilização**: Sempre que possível deverão ser utilizados componentes, serviços e padrões já existentes antes da criação de novas implementações.
7. **Compatibilidade**: Toda evolução deverá preservar contratos, APIs, Baselines e funcionalidades previamente homologadas.
8. **Segurança**: Segurança deverá ser considerada requisito funcional obrigatório, e não uma etapa posterior.
9. **Performance**: Otimizações deverão ser realizadas sem comprometer legibilidade, governança ou estabilidade.
10. **Governança**: Toda alteração deverá ser documentada, auditável e rastreável. Nenhuma decisão arquitetural relevante poderá existir apenas no código.

### Hierarquia Normativa
Em caso de conflito entre documentos, prevalecerá a seguinte ordem:
1. Constituição da Engenharia (Seção 80)
2. Políticas Permanentes
3. Baselines Oficiais
4. Diretrizes de Release
5. Demandas Arquiteturais
6. Implementações

### Regra de Decisão
Sempre que houver dúvida técnica, a decisão deverá favorecer a alternativa que:
- reduz riscos;
- preserva compatibilidade;
- reduz dívida técnica;
- melhora a arquitetura;
- facilita manutenção;
- mantém aderência às Baselines Oficiais.

### Princípio da Evolução Contínua
Toda Release deverá deixar a Plataforma Coffee++ igual ou melhor do que estava antes da sua implementação.
São vedadas implementações que aumentem deliberadamente a complexidade, reduzam a qualidade arquitetural ou comprometam a governança estabelecida.

### Vigência
Esta Constituição passa a orientar permanentemente todas as decisões técnicas da Plataforma Coffee++, servindo como referência normativa superior para qualquer implementação futura.

---

## 81. Índice Mestre de Governança da Plataforma Coffee++ (`MASTER_GOVERNANCE_INDEX`)

### Status
`INDEX = OFFICIAL` & `GOVERNANCE_CATALOG = ACTIVE`.

### Objetivo
Centralizar e organizar todas as Políticas Permanentes, Baselines Oficiais e Diretrizes Arquiteturais da Plataforma Coffee++, estabelecendo um ponto único de consulta para desenvolvimento, auditoria, homologação e evolução da plataforma.

### Hierarquia Normativa
A Plataforma Coffee++ adota a seguinte ordem de precedência normativa:
1. Constituição da Engenharia (Seção 80)
2. Políticas Permanentes
3. Baselines Oficiais
4. Diretrizes de Release
5. Demandas Arquiteturais
6. Implementações

Em caso de conflito, prevalecerá sempre o documento de maior hierarquia.

### Catálogo Oficial

#### Constituição e Manifesto
- Seção 80 — Constituição da Engenharia
- Seção 86 — Manifesto de Engenharia da Plataforma Coffee++


#### Políticas Permanentes
- Seção 76 — Política Permanente de Proteção de Baselines
- Seção 77 — Política Permanente de Isolamento de Demandas
- Seção 78 — Política Permanente de Controle de Mudanças Arquiteturais
- Seção 79 — Política Permanente de Compatibilidade Retroativa
- Seção 82 — Registro Oficial de Decisões Arquiteturais (ADR)
- Seção 83 — Política Permanente de Depreciação e Descontinuação



#### Diretrizes e Processos de Release
- Seção 84 — Template Oficial de Demandas e Releases
- Seção 85 — Processo Permanente de Auditoria de Governança

#### Baselines Oficiais
- Seção 75 — Responsividade da Tabela "Resumo do Mês"

#### Encerramento e Certificação
- Seção 87 — Encerramento Oficial da Governança Institucional v1.0

Novas Baselines deverão ser registradas nesta relação após homologação.

### Obrigatoriedade
Toda nova Release deverá indicar explicitamente:
- quais Baselines são impactadas;
- quais Políticas Permanentes foram consideradas;
- se existe Mudança Arquitetural;
- se existe Breaking Change;
- se existe atualização deste índice.

### Governança
Este índice deverá permanecer atualizado.
Sempre que uma nova Política Permanente ou Baseline Oficial for criada, este catálogo deverá ser revisado na mesma Release.
Nenhuma política ou baseline será considerada plenamente institucionalizada enquanto não constar neste Índice Mestre.

---

## 82. Registro Oficial de Decisões Arquiteturais (`ADR_GOVERNANCE`)

### Status: `POLÍTICA PERMANENTE` | `SITUAÇÃO = LOCKED & CONFIRMED`.

---

## 70. Baseline Oficial — Governança da DRE Comercial / P&L Vertical Executivo

A partir de 10/08/2026, a arquitetura, estrutura visual e regras de integridade do **P&L Vertical Executivo da DRE Comercial** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **P&L Vertical Executivo**: A apresentação da DRE Comercial (`/inovacoes/dre`) é padronizada como uma demonstração sequencial em tabela vertical composta por 21 linhas de resultado e indicadores de margem.
2. **Separação Rígida entre MACO Core e Despesas Operacionais**:
   - `MACO CORE` = Camada final do DRE Comercial Core (`Receita Comercial Líquida - Impostos - CPV - Frete (3%) - Investimento Comercial`).
   - `Despesa Pessoal` (Linha 14) e `Marketing` (Linha 15) = Despesas pertencentes à camada posterior do P&L.
   - **É expressamente proibido** subtrair Despesa Pessoal ou Marketing do MACO Core ou alterar a fórmula do MACO.
3. **Identificação Transparente da Fonte de Dados**:
   - Módulo DRE Core (Supabase / Views): Badge **`Oficial`** (Verde).
   - Despesas Operacionais Auditadas (`dre gerencial 06-08-26 julho_oficial.xlsx`): Badge **`Planilha Cia`** (Âmbar).
   - Períodos sem fonte auditada: Exibição **`—`** com badge **`N/D`** (sem rateios, estimativas ou interpolações).
4. **Valores de Controle Homologados**:
   - **Julho/2026**:
     - Receita Comercial Líquida: `R$ 9.779.467,88`
     - CPV (Custo de Produtos): `R$ 4.471.167,68`
     - Frete & Logística (3%): `R$ 293.384,04`
     - Investimento Comercial: `R$ 1.058,72`
     - **MACO Core**: `R$ 3.511.444,83` (35,91% NS)
     - Despesa Pessoal: `R$ 733.385,18` (7,50% NS)
     - Marketing: `R$ 298.216,94` (3,05% NS)
   - **Junho/2026 (Baseline)**:
     - **MACO Baseline**: `R$ 1.129.479,61`
     - Despesa Pessoal: `R$ 763.342,58` (9,27% NS)
     - Marketing: `R$ 285.497,92` (3,47% NS)
5. **Preservação de Dimensões e Autonomia**: As 6 dimensões oficiais (`Por Cliente`, `Por Rede`, `Por Gerente`, `Por Região/UF`, `Por Canal`, `Por SKU`) permanecem intocadas e 100% funcionais.

Status Arquitetural: `DRE_CORE = LOCKED` & `BASELINE = PERMANENT` & `P&L_VERTICAL = HOMOLOGATED`. & `ARCHITECTURAL_DECISIONS = VERSIONED`.

---

## 71. Baseline Oficial — Governança e Descontinuação Segura do DRE Legado

A partir de 10/08/2026, a política de governança e descontinuação do módulo **DRE Legado (`/dre`)** torna-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Classificação do Módulo**: O módulo `/dre` (`/dre`, `/dre/historico`, `/dre/rede`) é classificado oficialmente como **DRE LEGADO/HISTÓRICO**.
2. **Limite da Fonte Legada**: A tabela `public.cm_dre_financeiro` é uma estrutura estática cujo histórico possui registros exclusivamente até **Maio/2026**.
3. **Proibição de Zeros Fictícios**: É expressamente proibido apresentar zeros como resultados financeiros válidos nas rotas legadas para períodos posteriores a Maio/2026 quando a fonte legada não contiver dados.
4. **Comportamento Oficial por Rota**:
   - `/dre`: Para períodos posteriores a Maio/2026, renderizar banner institucional de encerramento da fonte legada + botão direcionador `[ACESSAR DRE COMERCIAL]` para `/inovacoes/dre`.
   - `/dre/historico`: Exibir aviso de encerramento da fonte e apresentar células sem dados pós-Maio/2026 marcadas claramente como **`N/D`**.
   - `/dre/rede`: Para períodos sem dados na fonte legada, renderizar banner institucional de aviso + botão direcionador `[ACESSAR DRE COMERCIAL]` para `/inovacoes/dre`.
5. **Módulo Oficial de Referência**: O módulo `/inovacoes/dre` (DRE Comercial) é a única interface oficial e homologada para consulta de resultados atuais e em tempo real.
6. **Single Source of Truth**: O `/inovacoes/dre` consome o DRE Core / `AnalyticsEngine`, permanecendo como a Fonte Única de Verdade da DRE Comercial.
7. **Proibição de Carga Automática / Workarounds**: É proibido reativar `cm_dre_financeiro` como fonte atual ou preencher períodos ausentes com zeros, estimativas, rateios ou interpolações.
8. **Preservação de Baselines**: A descontinuação do `/dre` legado não altera `DRE_CORE = LOCKED`, `DRE_BASELINE = PERMANENT`, `FINANCIAL_FORMULAS = UNCHANGED` ou qualquer dado no banco (`DATABASE_MODIFIED = NONE`).
9. **Independência Arquitetural**: Qualquer futura migração do `/dre` para a `AnalyticsEngine` deverá ser tratada como alteração arquitetural independente e submetida a nova homologação formal.

Status Arquitetural: `LEGACY_DRE_DEPRECATION = LOCKED` & `SINGLE_SOURCE_OF_TRUTH = /inovacoes/dre` & `BASELINE = CONFIRMED`.

---

## 72. Baseline Oficial — DRE Comercial / P&L Vertical — Encerramento e Fonte Oficial

A partir de 10/08/2026, a consolidação final da arquitetura, fontes de dados e baselines da **DRE Comercial** torna-se baseline permanente e oficial do Coffee++.

### 1. Fonte Oficial
- `/inovacoes/dre` = DRE Comercial Oficial.
- `AnalyticsEngine.getDreComercial()` = fonte oficial dos indicadores do DRE Comercial.
- `public.cm_dre_financeiro` = fonte legada/histórica, encerrada para períodos posteriores a Maio/2026.

### 2. DRE Legado
- As rotas `/dre`, `/dre/historico` e `/dre/rede` são classificadas como **DRE LEGADO / HISTÓRICO**.
- A fonte `public.cm_dre_financeiro` possui dados históricos somente até Maio/2026.
- É proibido interpretar ou apresentar ausência de registros pós-Maio/2026 como resultado financeiro igual a zero.
- Para períodos posteriores a Maio/2026:
  - `/dre` direciona o usuário para `/inovacoes/dre`;
  - `/dre/historico` apresenta `N/D` quando não houver fonte legada;
  - `/dre/rede` informa a indisponibilidade da fonte legada e direciona para `/inovacoes/dre`.

### 3. P&L Vertical Executivo
- O P&L Vertical da DRE Comercial permanece homologado e congelado como baseline.
- As despesas operacionais externas auditadas possuem fonte explicitamente identificada:
  - **Despesa Pessoal**: Jul/2026: R$ 733.385,18 | Jun/2026: R$ 763.342,58 (Fonte: Planilha Cia)
  - **Marketing**: Jul/2026: R$ 298.216,94 | Jun/2026: R$ 285.497,92 (Fonte: Planilha Cia)
- Essas despesas pertencem à camada posterior ao MACO e **NÃO devem ser subtraídas do MACO Core**.

### 4. Indicadores Financeiros Protegidos
Os seguintes indicadores permanecem imutáveis:
- Receita Comercial Líquida Jul/2026: R$ 9.779.467,88
- CPV Jul/2026: R$ 4.471.167,68
- Frete Jul/2026: R$ 293.384,04
- Investimento Comercial Jul/2026: R$ 1.058,72
- MACO Core Jul/2026: R$ 3.511.444,83
- MACO Baseline Jun/2026: R$ 1.129.479,61

### 5. Governança
Qualquer alteração futura em fonte do DRE, fórmula financeira, classificação gerencial, P&L Vertical, integração de despesas operacionais ou substituição da fonte legada deve ser tratada como **nova implementação controlada**, com auditoria de paridade antes da homologação. É proibida qualquer alteração direta no DRE Core para solucionar limitações da fonte legada.

Status Arquitetural: `DRE_CORE = LOCKED` & `DRE_BASELINE = PERMANENT` & `P&L_VERTICAL = HOMOLOGATED` & `DRE_LEGADO = HISTÓRICO / DESCONTINUADO` & `FINANCIAL_FORMULAS = UNCHANGED` & `DATABASE = UNCHANGED`.

### Objetivo
Estabelecer um padrão oficial para registrar todas as decisões arquiteturais relevantes da Plataforma Coffee++, garantindo rastreabilidade, contexto histórico e preservação do conhecimento técnico.

### Quando um ADR é Obrigatório
Um ADR deverá ser criado sempre que houver:
- criação de uma nova arquitetura;
- alteração estrutural em módulos existentes;
- mudança em contratos de APIs;
- alteração em modelos de dados;
- definição de novos padrões técnicos;
- adoção de novas tecnologias;
- decisões que impactem mais de um módulo;
- mudanças em componentes protegidos por Baseline.

### Estrutura Obrigatória
Todo ADR deverá conter obrigatoriamente:
1. Identificador único.
2. Título.
3. Data.
4. Status.
5. Contexto.
6. Problema.
7. Alternativas avaliadas.
8. Decisão adotada.
9. Justificativa técnica.
10. Consequências positivas.
11. Riscos.
12. Impacto em Baselines.
13. Compatibilidade retroativa.
14. Plano de rollback (quando aplicável).

### Estados Permitidos
- Proposed
- Accepted
- Superseded
- Deprecated

### Governança
Nenhuma decisão arquitetural relevante deverá existir apenas em código.
Toda decisão deverá possuir ADR correspondente.
Sempre que uma decisão substituir outra, o ADR anterior deverá permanecer preservado para fins históricos.

### Diretriz Permanente
A Plataforma Coffee++ adota ADRs como mecanismo oficial de preservação da memória arquitetural.
O código demonstra "como" a solução funciona.
O ADR registra "por que" a solução existe.
Ambos são obrigatórios para garantir a evolução sustentável da plataforma.

---

## 83. Política Permanente de Depreciação e Descontinuação (`DEPRECATION_POLICY`)

### Status
`POLICY = PERMANENT` & `DEPRECATION_POLICY = ACTIVE` & `LIFECYCLE_MANAGEMENT = MANDATORY`.

### Objetivo
Estabelecer um processo oficial para descontinuar funcionalidades, APIs, componentes, módulos e padrões técnicos da Plataforma Coffee++, preservando a estabilidade da plataforma e permitindo migração segura.

### Princípios
Nenhum componente homologado poderá ser removido imediatamente.
Toda descontinuação deverá seguir um ciclo formal de vida.

### Ciclo de Vida
```
ACTIVE
  ↓
DEPRECATED
  ↓
SUNSET
  ↓
REMOVED
```

### Requisitos para Depreciação
Antes de marcar qualquer recurso como DEPRECATED deverá existir:
- justificativa técnica;
- ADR correspondente;
- análise de impacto;
- plano de migração;
- prazo para remoção;
- comunicação na documentação.

### Regras
Enquanto um recurso estiver em estado DEPRECATED:
- deverá continuar funcionando;
- deverá possuir alternativa oficial;
- novas implementações não deverão utilizá-lo;
- correções críticas poderão ser realizadas.

### Remoção
Um recurso somente poderá ser removido quando:
- todas as migrações estiverem concluídas;
- não houver dependências ativas;
- existir homologação da remoção;
- o AGENTS.md for atualizado.

### Diretriz Permanente
A Plataforma Coffee++ adota evolução contínua sem remoções abruptas.
Toda descontinuação deverá preservar estabilidade, rastreabilidade e compatibilidade durante o período de transição.

---

## 84. Template Oficial de Demandas e Releases (`RELEASE_TEMPLATE`)

### Status
`STANDARD = OFFICIAL` & `RELEASE_TEMPLATE = MANDATORY` & `ENGINEERING_WORKFLOW = ACTIVE`.

### Objetivo
Padronizar a abertura, desenvolvimento, homologação e incorporação de toda demanda da Plataforma Coffee++, garantindo conformidade automática com a Constituição da Engenharia, Políticas Permanentes, Baselines Oficiais e ADRs.

### Estrutura Obrigatória
Toda nova demanda deverá seguir obrigatoriamente a seguinte sequência em 10 etapas:

1. **Contexto**: Descrição objetiva do problema.
2. **Objetivo**: Resultado esperado da implementação.
3. **Escopo**: Componentes que poderão ser alterados, componentes protegidos e itens fora do escopo.
4. **Impacto**: Baselines afetadas, mudanças arquiteturais, APIs, banco de dados, integrações, performance, segurança e compatibilidade.
5. **Plano Técnico**: Estratégia de implementação, alternativas consideradas e justificativa técnica.
6. **Plano de Rollback**: Como retornar ao estado anterior caso necessário.
7. **Critérios de Aceitação**: Critérios objetivos para homologação.
8. **Validação**: Checklist obrigatório (Build, TypeScript, Testes, Auditoria, Responsividade, Performance e Segurança).
9. **Homologação**: Registro formal da aprovação técnica.
10. **Baseline / ADR**: Ao finalizar, indicar obrigatoriamente:
    - Existe nova Baseline?
    - Existe alteração em Baseline?
    - Existe novo ADR?
    - Existe ADR atualizado?
    - AGENTS.md foi atualizado?

### Diretriz Permanente
Nenhuma demanda será considerada concluída enquanto este fluxo não estiver integralmente atendido.
Toda Release deverá deixar evidências documentadas de cada etapa.

---

## 85. Processo Permanente de Auditoria de Governança (`GOVERNANCE_AUDIT`)

### Status
`PROCESS = PERMANENT` & `GOVERNANCE_AUDIT = MANDATORY` & `CONTINUOUS_COMPLIANCE = ACTIVE`.

### Objetivo
Estabelecer um processo contínuo de auditoria para verificar se a Plataforma Coffee++ permanece aderente à Constituição da Engenharia, às Políticas Permanentes, às Baselines Oficiais, aos ADRs e ao Workflow Oficial de Engenharia.

### Escopo
Toda Release concluída deverá passar por uma Auditoria de Governança antes de ser considerada encerrada.
A auditoria tem como finalidade identificar desvios, regressões, inconsistências documentais ou não conformidades em relação às diretrizes institucionais.

### Itens Obrigatórios de Verificação
A auditoria deverá verificar, no mínimo:
1. Conformidade com a Constituição da Engenharia.
2. Conformidade com as Políticas Permanentes.
3. Preservação das Baselines Oficiais impactadas.
4. Existência e atualização dos ADRs obrigatórios.
5. Cumprimento do Template Oficial de Demandas e Releases.
6. Compatibilidade retroativa.
7. Ausência de Breaking Changes não autorizados.
8. Atualização do AGENTS.md e do Índice Mestre, quando aplicável.

### Resultado da Auditoria
Cada auditoria deverá ser classificada como:
- **APROVADA**
- **APROVADA COM RESSALVAS**
- **REPROVADA**

Quando houver ressalvas ou reprovação, deverão ser registradas as ações corretivas necessárias antes da homologação definitiva.

### Evidências
Toda auditoria deverá produzir evidências objetivas, tais como:
- resultados de build;
- validações de tipagem;
- testes executados;
- verificações arquiteturais;
- atualização documental;
- registros de homologação.

### Diretriz Permanente
A homologação de uma Release somente será considerada concluída quando a Auditoria de Governança estiver finalizada e classificada como APROVADA.
Este processo passa a integrar permanentemente o ciclo de engenharia da Plataforma Coffee++.

---

## 86. Manifesto de Engenharia da Plataforma Coffee++ (`ENGINEERING_MANIFESTO`)

### Status
`MANIFESTO = OFFICIAL` & `ENGINEERING_PHILOSOPHY = ACTIVE` & `GOVERNANCE_VERSION = 1.0`.

### Objetivo
Formalizar a filosofia de engenharia da Plataforma Coffee++, estabelecendo os princípios que orientam todas as decisões técnicas, arquiteturais e de produto.
Este Manifesto complementa a Constituição da Engenharia (Seção 80), descrevendo a cultura técnica da plataforma.

### Nossa Missão
Construir uma plataforma empresarial confiável, escalável, sustentável e preparada para evoluir continuamente, preservando qualidade, estabilidade e simplicidade.

### Nossos Compromissos
Toda decisão técnica deverá buscar:
- máxima confiabilidade;
- simplicidade arquitetural;
- baixo acoplamento;
- alta coesão;
- reutilização de componentes;
- escalabilidade;
- rastreabilidade;
- documentação adequada;
- facilidade de manutenção;
- evolução contínua.

### O que Nunca Sacrificamos
Nunca sacrificaremos:
- correção funcional;
- estabilidade;
- governança;
- segurança;
- compatibilidade retroativa;
- experiência do usuário;
- qualidade arquitetural.

Velocidade de entrega jamais deverá justificar redução da qualidade técnica.

### Filosofia de Evolução
A Plataforma Coffee++ evolui por meio de pequenas melhorias contínuas.
Cada Release deverá deixar o sistema melhor do que estava anteriormente.
Toda implementação deverá reduzir riscos, preservar conhecimento e ampliar a capacidade da plataforma.

### Engenharia Baseada em Evidências
Decisões deverão ser fundamentadas em:
- análises técnicas;
- auditorias;
- métricas;
- testes;
- ADRs;
- Baselines Oficiais;
- Governança documentada.

Opiniões não substituem evidências.

### Inteligência Artificial
Agentes de IA são parte integrante do processo de engenharia da Plataforma Coffee++.
Toda atuação deverá respeitar:
- Constituição da Engenharia;
- Políticas Permanentes;
- Baselines Oficiais;
- ADRs;
- Engineering Handbook;
- Governança Soberana.

### Princípio da Melhoria Contínua
A excelência não é considerada um estado final.
Todo componente poderá evoluir desde que:
- preserve compatibilidade;
- respeite a arquitetura;
- mantenha governança;
- não introduza regressões;
- agregue valor mensurável.

### Encerramento
A partir desta seção, considera-se estabelecida a Governança Institucional da Plataforma Coffee++ versão 1.0.
Novas funcionalidades deverão priorizar a criação de Baselines, ADRs e documentação técnica, evitando a criação desnecessária de novas políticas permanentes.
A governança deverá evoluir apenas quando houver necessidade institucional comprovada.

### Declaração Final
A Plataforma Coffee++ adota como princípio permanente que software de qualidade é construído por meio de arquitetura consistente, governança disciplinada, documentação viva e evolução contínua.
Toda decisão deverá preservar esse compromisso.

---

## 87. Encerramento Oficial da Governança Institucional v1.0 (`GOVERNANCE_V1_CLOSURE`)

### Status
`PROGRAM = COMPLETED` & `GOVERNANCE_VERSION = 1.0` & `ENGINEERING_MODEL = OPERATIONAL` & `MATURITY_LEVEL = INSTITUTIONALIZED`.

### Objetivo
Declarar oficialmente concluída a implantação da Governança Institucional da Plataforma Coffee++, consolidando todas as normas, políticas, baselines, processos, templates e documentos criados durante o Programa de Governança v1.0.

### Escopo Consolidado
Passam a integrar oficialmente o modelo de engenharia da Plataforma Coffee++:

#### Constituição
- Constituição da Engenharia (Seção 80)

#### Manifesto
- Manifesto de Engenharia (Seção 86)

#### Políticas Permanentes
- Proteção de Baselines (Seção 76)
- Isolamento de Demandas (Seção 77)
- Controle de Mudanças Arquiteturais (Seção 78)
- Compatibilidade Retroativa (Seção 79)
- Depreciação e Descontinuação (Seção 83)

#### Processos
- Template Oficial de Demandas e Releases (Seção 84)
- Processo Permanente de Auditoria de Governança (Seção 85)

#### Governança
- Índice Mestre (Seção 81)
- Registro Oficial de ADRs (Seção 82)
- Baselines Oficiais (Seção 75)

#### Documentação
- Engineering Handbook (`docs/ENGINEERING_HANDBOOK.md`)
- Templates Oficiais
- Catálogo de ADRs (`docs/adr/`)
- Catálogo de Baselines

### Modelo Oficial de Engenharia
A Plataforma Coffee++ passa a adotar oficialmente o seguinte ciclo de engenharia:
```
Demanda
  ↓
Análise Técnica
  ↓
Auditoria Arquitetural
  ↓
Implementação
  ↓
Validação
  ↓
Auditoria de Governança
  ↓
Homologação
  ↓
Baseline / ADR
  ↓
Atualização Documental
  ↓
Release
```

### Princípio Permanente
Toda evolução futura deverá utilizar este modelo como referência oficial.
Novas funcionalidades deverão ampliar a plataforma sem comprometer a estabilidade, a governança ou a compatibilidade previamente homologadas.

### Próxima Etapa
A partir deste marco institucional, a evolução da Plataforma Coffee++ passa a ocorrer prioritariamente por meio de:
- novas Baselines;
- novos ADRs;
- novas Releases;
- evolução do Engineering Handbook;
- documentação técnica dos módulos.

A criação de novas Políticas Permanentes deverá ocorrer apenas quando existir necessidade institucional comprovada.

### Declaração Oficial
Considera-se oficialmente encerrado o Programa de Implantação da Governança Institucional v1.0 da Plataforma Coffee++.
Todas as futuras decisões técnicas deverão observar integralmente a Constituição da Engenharia, as Políticas Permanentes, as Baselines Oficiais, os ADRs e o Engineering Handbook como referências institucionais obrigatórias.

### Certificação Institucional
A Plataforma Coffee++ passa a operar oficialmente sob um modelo de Engenharia Governada, com arquitetura documentada, memória arquitetural versionada, auditoria permanente, proteção de Baselines e evolução controlada.
Este registro formaliza a conclusão da Governança Institucional v1.0 e estabelece este modelo como padrão permanente de engenharia da Plataforma Coffee++.

---

## REGISTRO HISTÓRICO — CERTIFICAÇÃO DA GOVERNANÇA INSTITUCIONAL V1.0

- **Data de Certificação**: 06/08/2026
- **Status**: `CERTIFICADA` & `INSTITUTIONALIZED`

### Objetivo
Registrar oficialmente a conclusão do Programa de Implantação da Governança Institucional da Plataforma Coffee++, consolidando a adoção do modelo oficial de Engenharia Governada.

### Escopo Certificado
Foram institucionalizados:
- Constituição da Engenharia (Seção 80)
- Manifesto de Engenharia (Seção 86)
- Políticas Permanentes (Seções 76, 77, 78, 79, 83)
- Baselines Oficiais (Seção 75)
- Registro Oficial de ADRs (Seção 82, `docs/adr/`)
- Índice Mestre de Governança (Seção 81)
- Processo Permanente de Auditoria (Seção 85)
- Template Oficial de Demandas e Releases (Seção 84)
- Engineering Handbook (`docs/ENGINEERING_HANDBOOK.md`)
- Processo de Homologação (Seção 73)
- Processo de Evolução Controlada (Seção 87)

### Resultado da Certificação
A Plataforma Coffee++ passa a operar oficialmente segundo um modelo de Engenharia Governada, baseado em:
- arquitetura documentada;
- memória arquitetural versionada;
- proteção de Baselines;
- auditoria contínua;
- compatibilidade retroativa;
- evolução incremental;
- documentação viva.

### Compromisso Institucional
A partir desta certificação, toda evolução da plataforma deverá observar integralmente a Governança Institucional v1.0.
Alterações na estrutura de governança somente poderão ocorrer mediante decisão arquitetural formal, devidamente documentada e homologada.

### Encerramento
Este registro marca a conclusão oficial do Programa de Implantação da Governança Institucional v1.0 da Plataforma Coffee++.
As próximas evoluções da plataforma deverão concentrar-se na construção de novas funcionalidades, Baselines, ADRs e documentação técnica, preservando a estabilidade e a qualidade do modelo de engenharia estabelecido.

---

### DIRETRIZ OPERACIONAL PERMANENTE (Estabilidade Institucional do AGENTS.md)

A partir da certificação da Governança Institucional v1.0, fica estabelecido que o `AGENTS.md` entra em **regime de estabilidade institucional**.

Salvo necessidade institucional devidamente justificada e homologada, não deverão ser criadas novas políticas permanentes, princípios constitucionais ou regras gerais de governança.

A evolução da Plataforma Coffee++ deverá ocorrer prioritariamente por meio de:
- Baselines Oficiais;
- Architectural Decision Records (ADRs);
- Diretrizes de Release;
- Atualizações do Engineering Handbook (`docs/ENGINEERING_HANDBOOK.md`);
- Documentação técnica dos módulos.

O `AGENTS.md` passa a representar o arcabouço institucional estável da Plataforma Coffee++, sendo atualizado apenas quando houver mudanças estruturais na governança.

Este princípio busca preservar a simplicidade, evitar inflação normativa e garantir que a evolução da plataforma ocorra por meio de decisões arquiteturais e funcionais, e não pela expansão contínua das regras de governança.

---

## CHANGELOG DA GOVERNANÇA DA PLATAFORMA COFFEE++

Todos os registros abaixo documentam a evolução institucional da governança após a certificação da versão 1.0.

---

### Governança v1.0
- **Data**: 06/08/2026
- **Status**: `CERTIFICADA`

#### Marco Institucional:
- Conclusão do Programa de Implantação da Governança Institucional.
- Certificação da Governança v1.0.
- Estabelecimento do regime de estabilidade institucional do `AGENTS.md`.
- Publicação do Engineering Handbook (`docs/ENGINEERING_HANDBOOK.md`).
- Consolidação das Baselines Oficiais.
- Institucionalização dos ADRs (`docs/adr/`).
- Implantação do Processo Permanente de Auditoria (`npm run health:analytics`).

---

### Próximos Registros
Novas entradas neste changelog deverão ocorrer apenas quando houver:
- evolução formal da governança;
- criação de uma Governança v2.0;
- alteração da Constituição da Engenharia;
- revisão de políticas permanentes;
- mudanças estruturais homologadas.

---

## ATO ADMINISTRATIVO — CONGELAMENTO DA GOVERNANÇA INSTITUCIONAL V1.0

- **Status**: `GOVERNANCE = FROZEN` & `VERSION = 1.0` & `GOVERNANCE_STATE = LOCKED`

Fica oficialmente encerrado o Programa de Implantação da Governança Institucional da Plataforma Coffee++.

A partir deste registro, o `AGENTS.md` passa a operar em regime de estabilidade institucional.

Novas Políticas Permanentes, Princípios Constitucionais ou Diretrizes Gerais somente poderão ser criadas mediante abertura formal de um Programa de Evolução da Governança (Governança v2.0), devidamente justificado, documentado e homologado.

Enquanto isso, a evolução da Plataforma Coffee++ ocorrerá exclusivamente por meio de:
- Baselines Oficiais;
- Architectural Decision Records (ADRs);
- Diretrizes de Release;
- Atualizações do Engineering Handbook (`docs/ENGINEERING_HANDBOOK.md`);
- Documentação técnica dos módulos.

Este ato formaliza o congelamento da Governança Institucional v1.0 e estabelece sua utilização como referência permanente para todas as futuras evoluções da Plataforma Coffee++.

---

## 88. Baseline Oficial — Correção Definitiva de Integridade do Domínio Metas (Baseline Permanente)

A partir de 09/08/2026, as correções de integridade do domínio Metas tornam-se baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:

1. **Marketplace — Identificador Oficial**: O canal Marketplace deverá utilizar obrigatoriamente `manager = 'Marketplace'` e `manager_id = '1006'`. Fica expressamente proibida qualquer gravação futura utilizando `manager_id = 'Total'` para o canal Marketplace.

2. **Single Source of Truth — Meta Oficial**: A tabela `public.targets` permanece como única fonte oficial de metas. Somente o módulo `/metas` poderá criar, alterar ou manter registros de metas dos gerentes comerciais. Nenhum outro módulo poderá gravar metas oficiais dos gerentes em `public.targets`.

3. **RPS — Proibição de Gravação de Metas de Gerentes Comerciais**: A RPS (`POST /api/processo-comercial/rps`) não poderá criar nem atualizar registros de Meta Oficial dos gerentes comerciais (IDs 1000-1003) em `public.targets`. Sua responsabilidade permanece exclusivamente sobre o planejamento operacional e o desdobramento das metas em `public.cm_weekly_projections`.

4. **Gerentes Comerciais — Sufixo Obrigatório**: Todos os registros oficiais de gerentes comerciais em `public.targets` deverão utilizar obrigatoriamente o sufixo de canal: `Luiz (KA)`, `Luiz (Dist)`, `Leandro (KA)`, `Leandro (Dist)`, `Julliano (KA)`, `Julliano (Dist)`, `John Guedes (KA)`, `John Guedes (Dist)`. Fica proibida a criação de registros utilizando apenas o nome canônico sem sufixo.

5. **Identidade Matemática Obrigatória**: A seguinte identidade é obrigatória para qualquer evolução futura do domínio Metas: `Σ Meta Oficial da Empresa = Σ Metas dos Canais = Σ public.targets`. Qualquer divergência deverá ser considerada regressão e tratada como bug bloqueante.

6. **Governança Preservada**: Permanecem preservadas integralmente: `public.targets` como SSOT da Meta Oficial; `public.cm_weekly_projections` como SSOT das Metas por Rede; segregação KA × Distribuidor; contratos públicos; APIs; ViewModels.

Status Arquitetural: `METAS_INTEGRITY_BASELINE = LOCKED` & `BASELINE = CONFIRMED` & `MARKETPLACE_MANAGER_ID = 1006` & `RPS_TARGET_WRITE_FOR_COMMERCIAL_MANAGERS = FORBIDDEN` & `MATHEMATICAL_IDENTITY = ENFORCED`.

---

## 110. Baseline Permanente — Domínio Comercial Unificado (SSOT)

A partir de 09/08/2026, a arquitetura e a fachada única do **Domínio Comercial Unificado** tornam-se baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Fachada Única Exclusiva**: O `CommercialDomainService` (`src/lib/domain`) é a ÚNICA fachada pública autorizada para consumo de:
   - Canais Comerciais (`getChannels`, `getChannelOptions`, `resolveChannel`)
   - Segmentos Comerciais (`getSegments`, `getSegmentOptions`)
   - Gerentes Comerciais (`getManagerOptions`, `getFieldManagerList`, `resolveManager`)
   - Regionais Comerciais (`getRegions`, `getRegionOptions`)
   - UFs / Estados Comerciais (`getStates`, `getStateOptions`)
   - Papéis Comerciais / Roles (`getRoles`)
   - Filtros Globais (`getFilterOptions`)
2. **Proibição Absoluta de Hardcodes**: É expressamente proibido criar arrays locais, enums, constantes, switch/case, if ou fallbacks textuais contendo informações comerciais (canais, gerentes, segmentos, UFs, regionais).
3. **Obrigatoriedade para Novos Módulos**: Todo e qualquer novo módulo ou funcionalidade deverá consumir exclusivamente o `CommercialDomainService`.
4. **Proibição de Consultas Locais para Filtros**: Nenhuma tela ou componente UI poderá consultar diretamente tabelas de domínio (`cm_clientes`, `cm_domain_*`) para montar dropdowns ou filtros comerciais.
5. **Proibição de Listas Próprias em APIs**: Nenhuma rota de API poderá manter listas próprias de gerentes, canais ou segmentos.
6. **Sincronização em Rede**: Analytics, RDM, RPS, Cadastro Mestre, Atendimento, Metas, Investimentos, Governança, Dashboard e futuros módulos deverão permanecer sincronizados através do `CommercialDomainService`.
7. **Sincronização Cadastral em Cascata**: Toda alteração estrutural do domínio comercial deverá ocorrer primeiro no Cadastro Mestre (`cm_clientes`) e somente depois refletir automaticamente em toda a plataforma via triggers e invalidação de cache.

Status Arquitetural: `COMMERCIAL_DOMAIN_UNIFIED = LOCKED` & `BASELINE = CONFIRMED`.

---

## 111. Arquitetura Protegida (Protected Architecture)

A partir de 09/08/2026, a arquitetura do **Domínio Comercial Unificado** e do `CommercialDomainService` é alçada à categoria de **Contrato Arquitetural Permanente (Protected Architecture)** da Plataforma Coffee++.

### Diretrizes Mandatórias de Proteção:
1. **Fachada Exclusiva de Acesso**: O `CommercialDomainService` é a única fachada pública autorizada para acesso a dados do domínio comercial.
2. **Acesso a Dados Restrito ao Repository**: É proibido qualquer acesso direto às tabelas de domínio comercial por telas, APIs, cron jobs ou serviços de negócio, exceto por meio do `CommercialDomainRepository`.
3. **Proibição de Hardcodes e Fallbacks**: É estritamente proibido criar arrays hardcoded, enums comerciais, listas de gerentes, canais, segmentos, regionais, estados, switch/case, if/else ou fallbacks contendo informações comerciais.
4. **Consumo Obrigatório por Novos Módulos**: Todo e qualquer novo módulo deverá consumir exclusivamente o `CommercialDomainService`.
5. **Padronização de Componentes UI**: Todo dropdown, filtro, autocomplete ou selector comercial deverá utilizar exclusivamente o catálogo oficial fornecido pelo domínio.
6. **Centralização de Cache**: Nenhum módulo poderá manter cache próprio do domínio comercial. Todo cache deverá utilizar a infraestrutura oficial do `CommercialDomainCache`.
7. **Propagação Automática**: Alterações realizadas no Cadastro Mestre deverão propagar automaticamente para todos os módulos consumidores sem necessidade de manutenção manual.
8. **Governança de Evolução**: Qualquer alteração estrutural no domínio comercial exigirá obrigatoriamente:
   - Atualização da Baseline Oficial;
   - Atualização do ADR correspondente;
   - Atualização do CHANGELOG;
   - Homologação formal com aprovação no `npm run test:domain`.

Status Arquitetural: `COMMERCIAL_DOMAIN_UNIFIED = PROTECTED` & `PROTECTED_ARCHITECTURE = ENFORCED`.

---

## 112. Processo Oficial de RFC (Request For Change)

A partir de 09/08/2026, é instituído o **Processo Oficial de RFC (Request For Change)** como requisito obrigatório e prévio para qualquer alteração arquitetural na Plataforma Coffee++.

### Escopo Obrigatório da RFC:
Toda e qualquer proposta de alteração que impacte:
- Baselines Oficiais Homologadas (`AGENTS.md`);
- Arquitetura Protegida (`Protected Architecture`);
- Domínio Comercial Unificado (`CommercialDomainService`, `CommercialDomainRepository`, `CommercialDomainCache`);
- Contratos Públicos e Interfaces TypeScript do Domínio;
- APIs Públicas da Plataforma;
- Estruturas de Fonte Única de Verdade (Single Source of Truth - SSOT);
- Diretrizes de Governança Financeira e Comercial;
- Motores Analíticos (`AnalyticsEngine`, `ForecastEngine`, `SimulationEngine`, etc.);
- Cadastro Mestre Comercial (`cm_clientes`, `cm_domain_*`);

somente poderá ser implementada após a elaboração, submissão e aprovação formal de uma **RFC**.

### Estrutura Obrigatória da RFC:
Toda RFC submetida deverá ser criada a partir do template oficial (`docs/rfc/RFC_TEMPLATE.md`) e conter obrigatoriamente as 12 seções:
1. **Motivação**: Razão de negócio e contexto que justificam a mudança.
2. **Problema Atual**: Diagnóstico detalhado do cenário vigente a ser modificado.
3. **Objetivo**: O que a proposta visa realizar e os resultados esperados.
4. **Alternativas Avaliadas**: Opções técnicas analisadas e razões do descarte.
5. **Impacto Arquitetural**: Análise de efeitos em componentes, fluxos de dados e infraestrutura.
6. **Impacto Funcional**: Módulos afetados e mudanças de experiência (UX/UI).
7. **Compatibilidade Retroativa**: Garantia de não-regressão e conformidade com os módulos consumidores ativos.
8. **Plano de Migração**: Passos sequenciais de execução do ambiente atual para a nova solução.
9. **Estratégia de Rollback**: Procedimentos de reversão imediata em caso de anomalia.
10. **Plano de Testes**: Suíte de testes estáticos, unitários e de integração necessários.
11. **Critérios de Homologação**: Indicadores objetivos para aprovação da alteração.
12. **Atualizações Documentais Obrigatórias**:
   - Baseline Oficial (`AGENTS.md` e `docs/governance/baseline_oficial_plataforma.md`)
   - Registro de Decisão de Arquitetura (`docs/adr/ADR-XXX.md`)
   - Histórico de Mudanças (`CHANGELOG.md`)
   - Índice Geral (`docs/INDEX.md`)
   - Guia de Implementação (`Walkthrough`)
   - Termo de Encerramento (`Closure Report`)

Nenhuma alteração arquitetural poderá ser iniciada ou homologada sem a aprovação prévia de sua respectiva RFC.

Status Arquitetural: `RFC_PROCESS = MANDATORY` & `GOVERNANCE = ACTIVE`.

---

## 113. Termo de Encerramento e Consolidação da Estrutura de Governança

A partir de 09/08/2026, a estrutura de governança da Plataforma Coffee++ é considerada **oficialmente completa, estável e madura**.

### Diretrizes Mandatórias de Consolidação:
1. **Conclusão do Framework de Governança**: Fica vedada a criação de novos documentos permanentes ou frameworks paralelos de governança, salvo por necessidade técnica formalmente justificada e aprovada via RFC.
2. **Fluxo Institucional Obrigatório**: Toda nova funcionalidade ou expansão da plataforma deverá obrigatoriamente seguir o fluxo institucional padronizado:  
   `RFC → Discovery → Documento Funcional → Arquitetura → Plano de Implementação → Desenvolvimento → Walkthrough → Homologação → Atualização da Baseline → Atualização do CHANGELOG`.
3. **Proibição de Processos Paralelos**: É proibida a criação de processos paralelos, informais ou ad-hoc de documentação ou governança.
4. **Foco na Evolução Funcional**: O objetivo prioritário da engenharia passa a ser o desenvolvimento e a entrega de valor através de funcionalidades de negócio (**Business Features**), reutilizando integralmente a infraestrutura de governança e arquitetura protegida existentes.
5. **Justificativa prévia via RFC**: Qualquer proposta que introduza novos padrões arquiteturais deverá justificar rigorosamente a necessidade técnica em uma RFC aprovada antes do início de qualquer código.

Status da Plataforma: `GOVERNANCE_FRAMEWORK = COMPLETE` \| `ARCHITECTURE_GOVERNANCE = STABLE` \| `NEXT_PRIORITY = BUSINESS_FEATURES`.

---

## 114. Princípio da Proporcionalidade da Governança

A partir de 09/08/2026, a Plataforma Coffee++ adota oficialmente o **Princípio da Proporcionalidade da Governança**, visando eliminar burocracia desnecessária em alterações de baixo risco e acelerar a entrega contínua de valor ao negócio (**Business Features**).

### Classificação e Fluxos Obrigatórios:

1. **Fluxo Completo de Governança (Alto Impacto / Risco Arquitetural)**:  
   `RFC → Discovery → Documento Funcional → Arquitetura → Plano de Implementação → Desenvolvimento → Walkthrough → Homologação → Atualização da Baseline → Atualização do CHANGELOG`  
   **Obrigatório EXCLUSIVAMENTE para alterações que envolvam**:
   - Arquitetura global da plataforma;
   - Baselines Oficiais Homologadas;
   - Arquitetura Protegida (`Protected Architecture`);
   - `CommercialDomainService`, `CommercialDomainRepository` ou `CommercialDomainCache`;
   - Estruturas de Fonte Única de Verdade (SSOT);
   - APIs públicas e contratos de comunicação;
   - Schema do banco de dados (tabelas, colunas, RLS, triggers, migrations);
   - Motores analíticos (`AnalyticsEngine`, `ForecastEngine`, `SimulationEngine`, etc.);
   - Infraestrutura de segurança, autenticação e RLS;
   - Componentes compartilhados do core da aplicação.

2. **Fluxo Simplificado (Baixo Impacto / Manutenção e UX)**:  
   `Desenvolvimento → Testes → Homologação → Atualização do CHANGELOG (quando aplicável)`  
   **Permitido para**:
   - Correções de bugs pontuais;
   - Ajustes visuais, CSS e refinamentos estéticos;
   - Melhorias de interface e usabilidade (UX/UI);
   - Refatorações internas de código sem alteração de comportamento;
   - Otimizações locais de performance sem alteração arquitetural;
   - Ajustes de textos, rótulos, posicionamento de filtros e layouts responsivos.

### Regras de Aplicação:
- **Vedação de RFCs Desnecessárias**: É expressamente proibido abrir RFCs ou criar documentação arquitetural pesada para mudanças que não alterem a arquitetura oficial da plataforma.
- **Regra de Desempate por Menor Risco**: Em caso de dúvida sobre a classificação de uma demanda, prevalecerá o menor nível de governança compatível com o risco real da alteração.
- **Imutabilidade das Baselines Protegidas**: O uso do fluxo simplificado NÃO isenta nenhuma alteração do cumprimento estrito de todas as baselines protegidas, RLS, integridade financeira e testes automatizados (`npm run test:domain`, `npx tsc --noEmit`).

Status da Governança: `PROPORTIONAL_GOVERNANCE = ACTIVE` \| `RISK_BASED_WORKFLOW = ENFORCED`.

---

## 115. Baseline Oficial — Autorização e Gravação de Gerentes Restritos na RPS

A partir de 10/08/2026, a arquitetura e a governança de autorização no módulo RPS (`/processo-comercial/rps` e `POST /api/processo-comercial/rps`) tornam-se baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Escopo de Carteira**: Gerentes com perfil restrito (`isRestricted = true`) visualizam e alteram exclusivamente sua própria carteira.
2. **Edição Restrita à Semana Corrente**: Gerentes restritos possuem autorização para alterar e salvar exclusivamente a **semana corrente** (`serverTodayStr`).
3. **Janela Temporal Oficial**: A janela de edição para gerentes restritos encerra-se impreterivelmente às **15:00 da segunda-feira**, utilizando exclusivamente o horário do servidor em `America/Sao_Paulo`.
4. **Resiliência do Payload Frontend**: O frontend envia o payload completo com todas as semanas do mês. Semanas não correntes com valores mantidos (idênticos ao banco de dados) são aceitas e ignoradas na gravação.
5. **Bloqueio de Alteração de Semana Não Corrente (HTTP 403)**: Qualquer tentativa de alteração efetiva em semana que não seja a semana corrente resulta em `HTTP 403 Forbidden`.
6. **Bloqueio de Carteira de Outro Gerente (HTTP 403)**: Qualquer tentativa por usuário restrito de alterar carteira de outro gerente resulta em `HTTP 403 Forbidden`.
7. **Escrita Controlada (`rowsToUpsert`)**: O `rowsToUpsert` para gerentes restritos persiste exclusivamente registros da semana corrente.
8. **Perfis Administrativos Sem Restrição**: Administradores (`Admin`, `Admin Master`, `Gerente Nacional`, `CEO`, `Diretor`) mantêm permissão total sobre todas as carteiras e semanas.
9. **Identificação Oficial SSOT**: É expressamente proibida a criação de exceções ou hardcodes de nomes. A autorização baseia-se unicamente em:
   `requireAuth() → requireApprovedProfile() → profile.manager_name → resolveCanonicalManager() → isSameManager()`.

### Homologação dos 6 Cenários Mandatórios:
- **Cenário A** (alteração apenas na semana corrente): `HTTP 200`
- **Cenário B** (payload completo com semanas não correntes intocadas): `HTTP 200` (upsert exclusivo da semana corrente)
- **Cenário C** (alteração em semana não corrente): `HTTP 403`
- **Cenário D** (alteração na carteira de outro gerente): `HTTP 403`
- **Cenário E** (salvamento após cutoff de 15:00 de segunda-feira): `HTTP 403`
- **Cenário F** (Admin / Admin Master / Gerente Nacional): `HTTP 200` (sem restrição de carteira/semana)

### Validação de Qualidade:
- `npx tsc --noEmit`: 0 erros
- `npm run build`: aprovado
- `scripts/test-rps-scenarios.ts`: 6/6 cenários aprovados

Status Arquitetural: `RPS_RESTRICTED_MANAGER_AUTHORIZATION = LOCKED` & `BASELINE = CONFIRMED`.

---

## 116. Baseline Oficial — Sanitização Simétrica de ST e Normalização Gerencial DRE Comercial

A partir de 11/08/2026, a arquitetura e a regra de agregação de impostos e classificação gerencial do DRE Comercial (`/inovacoes/dre` → Por Gerente) tornam-se baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Sanitização Simétrica de ST na Camada Analítica**: Toda apuração de impostos sobre faturamento oficial deve utilizar sanitização simétrica para a coluna `vlr_total_st`:
   ```sql
   CASE 
     WHEN ABS(COALESCE(v.vlr_total_st, 0)) >= ABS(COALESCE(v.vlr_total_liq, 0)) THEN 0 
     ELSE COALESCE(v.vlr_total_st, 0) 
   END
   ```
   Esta regra zera exclusivamente valores fora de escala (inteiros/multiplicadores de centavos do ERP), tanto em vendas quanto em devoluções, e preserva 100% dos valores fiscais válidos e a reversão real de ICMS/ST. É proibido substituir esta regra por uma política simplista de "ST sempre zero".
2. **Preservação do Sinal Econômico (Sem Math.abs)**: É proibido o uso de `Math.abs()` para mascarar o sinal dos impostos na camada HTTP ou no backend. O sinal fiscal deve resultar da agregação legítima de vendas (dedução positiva) e devoluções (reversão).
3. **Normalização Gerencial Exclusivamente Analítica**: Na dimensão `gerente`, registros com `c.responsavel = 'Leandro'` ou `c.manager_name = 'Leandro'` devem ser consolidados analiticamente sob `'Leandro Saffi'`. A tabela física `cm_clientes` e o banco de dados permanecem **100% intocados (`DATABASE_MODIFIED = NONE`)**.
4. **Preservação Intacta do DRE Core**: Esta adequação não altera as fórmulas estruturais de Receita Comercial Líquida, CPV, Frete 3%, Investimentos Comerciais ou MACO Core.

### Resultado Homologado — Junho/2026 (Leandro Saffi Consolidado):
- Receita Líquida: **R$ 3.182.057,23**
- Impostos Finais: **R$ 5.343,51** (0,17%)
- CPV: **R$ 1.431.398,54**
- MACO: **R$ 1.588.433,24**
- Grid Visual: 1 única linha (`Leandro Saffi`), 0 linhas isoladas para `Leandro`.

### Evidência de Validação e Homologação:
- `npx tsc --noEmit`: 0 erros
- `npm run test:domain`: 20/20 aprovados
- `npm run build`: sucesso (Exit Code 0)
- Auditoria READ_ONLY: `AUDITORIA_FINAL = APROVADA`, `ST_VALIDO_PRESERVADO = TRUE`, `ST_OUT_OF_SCALE_SANITIZADO = TRUE`, `LEANDRO_UNIFICADO = TRUE`, `DRE_CORE_PRESERVADO = TRUE`.

Status Arquitetural: `DRE_CORE = LOCKED` | `DRE_BASELINE = PERMANENT` | `P&L_VERTICAL = HOMOLOGATED` | `FINANCIAL_FORMULAS = UNCHANGED` | `DATABASE_MODIFIED = NONE`.

---

## 117. Baseline Oficial — Auditoria Forense Completa e Homologação do Módulo RPS (Baseline Permanente)

A partir de 13/08/2026, o módulo **RPS (Reunião de Planejamento Semanal)** foi submetido a uma auditoria forense completa de todos os campos editáveis, calculados, persistidos e derivados, resultando na homologação integral após correções funcionais e de UX.

### Correções Funcionais Homologadas:
1. **Desacoplamento Absoluto Gerente × Redes**: A função `handleClientProjChange` não recalcula mais `mgr.kpis.FAT.projections` a partir de `clients.reduce()`. A projeção FAT do gerente (`_TOTAL_`) é soberana e definida exclusivamente pelo Admin via `handleManagerKpiChange`.
2. **DESAFIO VOL ×1000**: O handler `handleManagerDesafioChange` aplica corretamente `val * 1000` para `kpi === 'VOL'` (anteriormente era valor direto, causando divergência de escala).
3. **Override de Desafio via cm_weekly_projections**: O GET da RPS prioriza `customDesafioVol` e `customDesafioFat` gravados em `cm_weekly_projections` (`kpi = 'DESAFIO_VOL'` / `'DESAFIO_FAT'`), com fallback para `public.targets`.
4. **Remoção da Mutação em public.targets**: O POST da RPS não realiza mais `upsert` em `public.targets`. Toda persistência de desafios ocorre exclusivamente em `cm_weekly_projections`.

### Correções de UX Homologadas:
1. **VOL semanal do Gerente**: Removido `.toFixed(1)` do `value` do input, eliminando reposicionamento artificial do cursor durante digitação.
2. **INVEST semanal do Gerente**: Removido `.toFixed(1)` do `value` do input.
3. **DESAFIO INVEST**: Removido `.toFixed(1)` do `value` do input.

### Regras Permanentes de Integridade da RPS:
1. **O valor digitado pelo usuário nos campos de projeção deve ser preservado.** O sistema não pode substituir, recalcular ou sobrescrever o valor informado manualmente pelo Admin ou Gerente.
2. **Projeções do gerente (`_TOTAL_`) NÃO podem ser recalculadas a partir das redes.** A projeção consolidada é soberana.
3. **Alterações de redes NÃO podem sobrescrever o consolidado do gerente.** Desacoplamento absoluto.
4. **DESAFIO e PROJEÇÃO são conceitos independentes.** Handlers separados (`handleManagerDesafioChange` ≠ `handleManagerKpiChange`), KPIs separados (`DESAFIO_*` ≠ `VOL`/`FAT`/`INVEST`), chaves de persistência separadas.
5. **Semana, gerente e rede devem permanecer isolados.** Nenhum handler pode propagar valores entre semanas (`wIdx`), entre gerentes (`mIdx`) ou entre rede e gerente.
6. **A RPS não pode alterar `public.targets`.** `RPS_PUBLIC_TARGETS_MUTATION = FORBIDDEN`.
7. **Overrides de Desafio da RPS permanecem em `cm_weekly_projections`** com `kpi = 'DESAFIO_VOL'`, `'DESAFIO_FAT'`, `'DESAFIO_INVEST'` e `client_matrix = '_TOTAL_'`.
8. **O fallback para `public.targets` permanece somente leitura.** É utilizado apenas quando não existe override operacional em `cm_weekly_projections`.
9. **A UX dos inputs foi homologada para digitação contínua** sem reposicionamento artificial do cursor. Nenhum campo editável utiliza `.toFixed()` no `value` durante a edição.
10. **O alerta das 14h e os consumidores downstream permanecem intactos.** AnalyticsEngine, DRE, Cockpit, CRM, PACE, RDM, Metas, Visão CEO — nenhuma alteração.

### Conversões Oficiais:
- **VOL**: UI (milhares) → ×1000 → estado/banco (kg).
- **FAT**: UI (milhares) → ×1000 → estado/banco (R$).
- **INVEST**: UI (percentual) → valor direto → estado/banco (%).

### Permissões Oficiais:
- **Admin / Admin Master**: Pode editar Desafios, Projeções (todas as semanas), META de Redes e Carteira.
- **Gerente Nacional Admin**: Pode editar Projeções (todas as semanas). Não pode editar Desafios ou META.
- **Gerente Restrito**: Somente própria carteira, somente semana corrente (até 15:00 BRT de segunda-feira). `HTTP 403` para tentativa de edição de Desafio.

### Evidência de Validação e Homologação:
- `npx tsc --noEmit`: 0 erros.
- `scripts/test-rps-scenarios.ts`: 15/15 aprovados (A–O).
- `npm run health:analytics`: 100% conforme.
- `npm run build`: sucesso.

### Status Final:
```
RPS_FINAL_FULL_AUDIT = PASSED
RPS_UX_FINAL = PASSED
RPS_FULL_FIELD_AUDIT = PASSED
RPS_REAL_PERSISTENCE_CHECK = PASSED
RPS_NON_REGRESSION = PASSED
RPS_MANAGER_NETWORK_DECOUPLING = CONFIRMED
RPS_MANAGER_ISOLATION = CONFIRMED
RPS_WEEK_ISOLATION = CONFIRMED
RPS_DESAFIO_PROJECTION_SEPARATION = CONFIRMED
RPS_DESAFIO_OVERRIDE = cm_weekly_projections
RPS_DESAFIO_FALLBACK = public.targets
RPS_PUBLIC_TARGETS_MUTATION = FORBIDDEN
RPS_ADMIN_DESAFIO_EDIT = ENABLED
RPS_MANAGER_DESAFIO_EDIT = HTTP_403
RPS_ALERT_14H = INTACT
RPS_ANALYTICS = INTACT
RPS_INPUT_UX = PASSED
RPS_VOL_X1000 = CONFIRMED
RPS_FAT_X1000 = CONFIRMED
RPS_INVEST_DIRECT_PERCENT = CONFIRMED
RPS_ALL_FIELDS_AUDITED = YES
RPS_READY_FOR_USE = YES
```

Status Arquitetural: `RPS_GOVERNANCE = LOCKED` & `RPS_BASELINE = PERMANENT`.

---

## 118. Baseline Oficial — Controle de Acesso e Governança de Visibilidade do Módulo RDM (Baseline Permanente)

A partir de 19/08/2026, as diretrizes de controle de acesso, matriz de autorização e governança de visibilidade do módulo **RDM (Reunião de Desempenho Mensal)** tornam-se o baseline permanente e oficial do Coffee++.

### Status Arquitetural:
`RDM_ACCESS_CONTROL = LOCKED` & `RDM_VISIBILITY_GOVERNANCE = CONFIRMED` & `BASELINE = PERMANENTE`

### Diretrizes Mandatórias:

1. **Autorização da Configuração de % Desafio**:
   - O recurso "Configurar % Desafio" (leitura e gravação de percentuais em `cm_rdm_desafio_config`) é restrito exclusivamente aos perfis com visão executiva/corporativa:
     - `CEO`
     - `Admin`
     - `Admin Master`
     - `Gerente Nacional` (e e-mails oficiais de Gerente Nacional homologados).
   - Perfis não autorizados (incluindo `Gerente Regional`, `Trade`, `Financeiro`, `Vendedor`) permanecem **100% READ-ONLY** em relação aos percentuais do Desafio.

2. **Escopo Obrigatório e Isolado do Gerente Regional**:
   - O perfil `Gerente Regional` possui escopo obrigatório e estrito exclusivamente sobre o seu próprio `manager_id` / RDM.
   - O Gerente Regional **não pode**:
     - Visualizar a apresentação ou dados de outros gerentes regionais;
     - Acessar a visão consolidada Brasil (`CRISTIANO` / Total);
     - Acessar ou alterar percentuais de `% Desafio`;
     - Alterar dados de outros gerentes;
     - Salvar anotações ou comentários em RDM de outras regionais;
     - Exportar apresentação (PowerPoint) de outro gerente.

3. **Dupla Camada de Segurança (Backend e Frontend)**:
   - A restrição e isolamento de dados são aplicados de forma mandatória tanto no **BACKEND** quanto no **FRONTEND**.
   - A simples ocultação visual de botões ou campos na interface **NÃO constitui controle de segurança suficiente**.
   - No Frontend: o seletor de gerentes é substituído por identificação fixa da regional do usuário e o botão "Configurar % Desafio" é totalmente suprimido.
   - No Backend: as rotas (`GET/POST /api/processo-comercial/rdm`, `GET/POST /api/processo-comercial/rdm/config`, `GET /api/rdm-gerencial`) validam a sessão e forçam a regional associada ao usuário autenticado.

4. **Derivação da Identidade no Servidor (Anti-Bypass)**:
   - O `manager_id` / regional permitido para o `Gerente Regional` é derivado exclusivamente da identidade autenticada (`cm_user_profiles.manager_name` / `cm_user_profiles.name`) e resolvido canonicamente via `resolveCanonicalManager(...)`.
   - O backend **nunca confia** exclusivamente em parâmetros de URL ou corpo de requisição enviados pelo frontend.

5. **Bloqueio Ativo contra Bypass (HTTP 403 Forbidden)**:
   - Qualquer tentativa de burlar filtros, trocar `manager_id` na URL, chamar APIs diretamente ou gravar dados de outra regional resulta em bloqueio estrito com **`HTTP 403 Forbidden`**.

6. **Preservação Financeira Absoluta**:
   - As regras de controle de acesso não alteram nenhuma regra financeira, fórmula ou base analítica existente: `AnalyticsEngine`, `DRE`, `Meta MACO`, `Real MACO`, faturamento, CPV, impostos, frete, investimentos e demais baselines financeiras permanecem 100% intactas e congeladas.

Status de Governança: `RDM_ACCESS_CONTROL = HOMOLOGADO_E_CONGELADO` & `BASELINE = PERMANENTE`.

---

## 119. Baseline Oficial — Importação Automática CFOP.CSV via Google Drive

A partir de 21/08/2026, o ecossistema Coffee++ passa a operar com importação diária automática de faturamento através de integração direta com o Google Drive, substituindo o processo manual diário de upload XLSX.

### Status Arquitetural:
`IMPORT_HUB_AUTO_DRIVE = ATIVO_E_CONGELADO` & `BASELINE = PERMANENTE`

### Diretrizes Mandatórias:

1. **Origem Oficial dos Dados**:
   - A pasta corporativa oficial do Google Drive configurada em `GOOGLE_DRIVE_FOLDER_ID` é a única fonte primária para ingestão de faturamento comercial.
   - O arquivo oficial possui obrigatoriamente o nome padronizado `CFOP.CSV`.
   - O arquivo é de natureza acumulada desde o primeiro dia do mês até a data de extração, sendo substituído diariamente pelo ERP Sankhya.

2. **Agendamento e Janela de Execução**:
   - A rotina automática executa de **segunda-feira a sábado às 07:00** (horário oficial de Brasília — `America/Sao_Paulo`).
   - Política oficial de retries automáticos em caso de indisponibilidade transitória ou atraso na disponibilização do arquivo:
     - 07:00 — Tentativa principal;
     - 07:15 — Retry 1;
     - 07:30 — Retry 2;
     - 08:00 — Retry final.
   - **Regra Estrita de Domingo**: Execuções aos domingos são bloqueadas a nível de agendamento (`schedule: "0 10 * * 1-6"`) e por barreira lógica de código (`dayOfWeek === 0`).

3. **Arquitetura de Isolamento e Processamento em Staging**:
   - O processamento nunca toca diretamente na tabela oficial `cm_faturamento` durante a ingestão.
   - Todo parsing streaming, validação sintática das 29 colunas, tipagem e cálculo de métricas ocorrem isoladamente em memória e na tabela `cm_faturamento_staging`.

4. **Transacionalidade e Atomic Swap**:
   - A promoção dos dados de `cm_faturamento_staging` para `cm_faturamento` é 100% transacional e atômica via RPC PostgREST (`executar_atomic_swap_faturamento`).
   - A exclusão do mês corrente em `cm_faturamento` e a inserção dos novos dados ocorrem na mesma transação atômica (`BEGIN ... COMMIT`).
   - Em caso de qualquer erro em qualquer etapa, ocorre `ROLLBACK` total instantâneo, mantendo a base oficial intacta.

5. **Exclusividade e Proteção Concorrente (Advisory Lock)**:
   - Toda execução adquire obrigatoriamente um lock transacional exclusivo do Postgres (`pg_try_advisory_lock('coffee_mais_import_drive_lock')`).
   - Múltiplas importações concorrentes são expressamente proibidas e rejeitadas.

6. **Barreiras Obrigatórias de Segurança (Zero Data Loss)**:
   A promoção para a base oficial é terminantemente bloqueada se qualquer uma das 6 barreiras falhar:
   - **Barreira A (Idempotência / Deduplicação)**: Se o hash SHA-256 for idêntico ao de um lote já processado com sucesso, a importação é ignorada (`SKIPPED_DUPLICATE_HASH`);
   - **Barreira B (Validação Estrutural e de Tipagem)**: Arquivo vazio, delimitador divergente ou ausência de qualquer uma das 29 colunas obrigatórias abortam o pipeline;
   - **Barreira C (Não-Regressão de Período)**: O período de dados do CSV deve cobrir desde o dia 01 até a data atual, sendo proibida a ingestão de períodos parciais ou retroativos;
   - **Barreira D (Monotonicidade de Volume e Receita)**: O arquivo do dia deve conter volume de linhas, NFs e faturamento maiores ou iguais aos do lote anterior;
   - **Barreira E (Missing Invoice Guard)**: Nenhuma Nota Fiscal faturada em lote anterior pode desaparecer no lote novo;
   - **Barreira F (Spike Guard)**: O incremento diário de faturamento não pode exceder 4x a média diária histórica sem autorização.

7. **Reconciliação em Camadas e Sincronização Automática**:
   - Após a promoção atômica com sucesso, a RPC `refresh_materialized_views()` atualiza instantaneamente as views oficiais:
     `public.sales` = `mv_vendas_mensal` = `mv_vendas_cliente_mensal` = `/vendas`.
   - O pipeline afere paridade matemática entre Staging, `cm_faturamento` e Materialized Views, garantindo **0,0000% de desvio financeiro**.

8. **Sistema de Alertas e Notificações Executivas**:
   - Ao término de cada execução (sucesso, aviso, bloqueio ou erro), um relatório detalhado é enviado automaticamente para `cristiano.santos@coffeemais.com` contendo:
     - Data/hora e horário de Brasília;
     - Nome do arquivo, modifiedTime e SHA-256;
     - Batch ID e período acumulado;
     - Linhas, NFs, faturamento líquido, bruto, devoluções e cancelamentos;
     - Status da promoção e das Materialized Views;
     - Delta financeiro e duração da execução;
     - Motivo do bloqueio / erro, quando houver.

9. **Plano de Contingência (Preservação do Upload Manual)**:
   - A interface de upload manual XLSX em `/upload` permanece 100% ativa e funcional como contingência operacional.
   - Nenhuma lógica manual existente foi removida ou depreciada.

10. **Preservação Absoluta das Regras Financeiras**:
    - A ativação do Import Hub não altera nenhuma regra de negócio, cálculo de DRE, MACO, CPV, impostos, frete, investimentos, TOPs ou regras de expurgo de devoluções e cancelamentos.

Status Arquitetural: `IMPORT_HUB_AUTO_DRIVE = ATIVO_E_CONGELADO` & `BASELINE = PERMANENTE`.

---

## 120. Baseline Oficial — Domínio Metas: Segregação do Real Faturamento por Canal × Gerente (Baseline Permanente)

A partir de 22/08/2026, a arquitetura de segregação de faturamento realizado por Canal e Gerente, a RPC oficial `public.get_actual_sales_v2` e as identidades matemáticas do **Domínio Metas (`/metas`)** tornam-se o baseline permanente e oficial do Coffee++.

### Status Arquitetural
`DOMAIN_METAS = HOMOLOGATED` & `REAL_CHANNEL_MANAGER_SEGREGATION = ENFORCED` & `MATHEMATICAL_IDENTITY = PASS` & `REGRESSION_STATUS = PASS` & `PRODUCTION_READY = TRUE`

### RPC Oficial
- `public.get_actual_sales_v2(p_channel text, p_manager_id text, p_manager_name text, p_years text[])`
- `public.get_actual_sales_v2(p_channel text, p_manager text, p_years text[])` (overload canônico de 3 parâmetros)

### Regras Homologadas de Negócio e Consulta:
1. **Toda Empresa**: Consolida todos os canais e todos os gerentes da organização.
2. **Canal KA**:
   - Quando `p_manager_id = 'Total'`, retorna o consolidado de todos os gerentes no canal KA.
   - Quando um gerente individual for selecionado (ex: `1000`, `1001`, `1002`, `1003`), filtra estritamente por `m.channel = 'KA'` e `m.manager_id = p_manager_id` (com fallback por nome).
3. **Canal Distribuidor**:
   - Quando `p_manager_id = 'Total'`, retorna o faturamento consolidado de todos os distribuidores da empresa (incluindo carteiras gerenciais e distribuidor corporativo).
   - Quando um gerente individual for selecionado, o filtro por `m.manager_id = p_manager_id` (ou `p_manager_name`) é **estritamente obrigatório**.
   - É expressamente proibido retornar o total da empresa no canal Distribuidor quando um gerente específico estiver selecionado.
4. **Demais Canais Corporativos**:
   - Os canais `Inside Sales`, `Ecommerce`, `Marketplace`, `Amazon 1P` e `Private Label` (Marca Própria) não possuem seletor de gerente na interface e operam em modo corporativo consolidado (`m.channel = p_channel`).

### Evidências Homologadas (Agosto/2026):
* **Toda Empresa**: R$ 5.135.187,27 (190.808,1 UN)
* **KA Total**: R$ 2.038.747,32 (75.991 UN)
  - `KA Luiz (1002)`: R$ 928.069,80 (36.089 UN)
  - `KA Leandro (1001)`: R$ 590.412,40 (20.540 UN)
  - `KA Julliano (1000)`: R$ 416.525,56 (15.718 UN)
  - `KA John Guedes (1003)`: R$ 103.739,56 (3.644 UN)
* **Distribuidor Total**: R$ 574.434,06 (28.374 UN)
  - `Distribuidor John Guedes (1003)`: R$ 602,70 (50 UN)
  - `Distribuidor Leandro (1001)`: R$ 0,00 (0 UN)
  - `Distribuidor Luiz (1002)`: R$ 0,00 (0 UN)
  - `Distribuidor Corporativo (1007)`: R$ 573.831,36 (28.324 UN)
* **Inside Sales**: R$ 98.184,31 (3.036 UN)
* **Ecommerce**: R$ 1.001.134,52 (28.905,1 UN)
* **Marketplace**: R$ 1.033.664,80 (36.636 UN)
* **Amazon 1P**: R$ 306.606,00 (13.420 UN)
* **Private Label (Marca Própria)**: R$ 0,00 (0 UN)

### Identidade Matemática Homologada:
1. **Identidade por Gerente (John Guedes — Agosto/2026)**:
   $$\text{Real KA} \ (\text{R\$ } 103.739,56) + \text{Real Distribuidor} \ (\text{R\$ } 602,70) + \text{Real Inside Sales} \ (\text{R\$ } 3.724,58) + \text{Demais} \ (\text{R\$ } 0,00) = \mathbf{\text{R\$ } 108.066,84}$$
   $$\text{Real Total John} = \mathbf{\text{R\$ } 108.066,84} \quad (\Delta = \mathbf{\text{R\$ } 0,00})$$

2. **Identidade do Canal Distribuidor (Agosto/2026)**:
   $$\text{John} \ (\text{R\$ } 602,70) + \text{Leandro} \ (\text{R\$ } 0,00) + \text{Luiz} \ (\text{R\$ } 0,00) + \text{Corp} \ (\text{R\$ } 573.831,36) = \mathbf{\text{R\$ } 574.434,06}$$
   $$\text{Total Distribuidor Empresa} = \mathbf{\text{R\$ } 574.434,06} \quad (\Delta = \mathbf{\text{R\$ } 0,00})$$

### Integridade dos Dados e Não-Regressão:
* `public.targets`: 0 alterações durante o ciclo de auditoria e correção. Metas, Forecast e Desafio 100% preservados.
* `public.cm_weekly_projections` (RPS): 0 alterações. Projeções semanais 100% preservadas.
* `mv_vendas_mensal`: Operação estritamente somente leitura mantida.
* `AnalyticsEngine`, ViewModels e Contratos de APIs: Intactos e sem desvios.
* Eliminação definitiva da cláusula permissiva `OR (p_channel <> 'KA' AND m.channel = p_channel)` na definição ativa da RPC.

### Validação Técnica:
* `npx tsc --noEmit`: 0 erros.
* `npm run build`: Sucesso (139 rotas compiladas).

### Diretriz de Governança:
A partir desta baseline, qualquer alteração na lógica de segregação de REAL por Canal × Gerente, na RPC `get_actual_sales_v2` ou na identidade matemática do domínio Metas deverá ser tratada como alteração controlada de baseline, exigindo nova auditoria forense de regressão e nova homologação formal.

Status Arquitetural: `DOMAIN_METAS = HOMOLOGATED` & `BASELINE = PERMANENTE` & `STATUS = CONFIRMED`.

---

## 121. Baseline Oficial — Atribuição de Distribuidores por Carteira Comercial na `mv_vendas_mensal` (Baseline Permanente)

A partir de 22/08/2026, a regra de classificação e atribuição de faturamento de parceiros do canal Distribuidor às suas respectivas carteiras comerciais oficiais na Materialized View `public.mv_vendas_mensal` torna-se o baseline permanente e oficial de governança do Coffee++.

### Status Arquitetural
`DISTRIBUTOR_MANAGER_ATTRIBUTION = ENFORCED` & `OFFICIAL_COMMERCIAL_MANAGER_IDS = 1000,1001,1002,1003` & `CORPORATE_DISTRIBUTOR_MANAGER_ID = 1007` & `MATHEMATICAL_IDENTITY = ENFORCED` & `DUPLICATION = FORBIDDEN` & `LOSS_OF_REVENUE = FORBIDDEN` & `BASELINE_STATUS = LOCKED`

### Regra Oficial Homologada de Classificação
A atribuição do faturamento de distribuidores **NÃO** pode utilizar o texto do vendedor Sankhya `"DISTRIBUIDOR"` como critério prioritário para direcionar automaticamente o faturamento ao `manager_id = '1007'`.

A hierarquia oficial e imutável de apuração de `manager_id` em `public.mv_vendas_mensal` é:
1. **Canais Fixos Oficiais**:
   - `AMAZON 1P` $\rightarrow$ `1008`
   - `SHOPIFY` / `LIVELO` $\rightarrow$ `1005`
   - `AMAZONFBA` / `MELI FULL` / `SHOPEE` / `AMAZONBR` / `ANYMARKET` / `MAGALU` / `MELI` $\rightarrow$ `1006`
2. **Regras Especiais de Apuração**:
   - Se `r.manager_id_apuracao IS NOT NULL` $\rightarrow$ utilizar `r.manager_id_apuracao`.
3. **Carteiras Comerciais Oficiais (Prioridade Absoluta)**:
   - Se `c.manager_id IN ('1000', '1001', '1002', '1003')` $\rightarrow$ utilizar obrigatoriamente `c.manager_id` (o faturamento pertence ao respectivo gerente comercial oficial).
4. **Distribuidor Corporativo (Fallback Controlado)**:
   - Se `v.nome_vendedor = 'DISTRIBUIDOR'` OU `c.tipo_parceiro = 'Distribuidor'` (e o parceiro não possuir gerente comercial 1000-1003) $\rightarrow$ atribuir a `1007` (Distribuidor Corporativo).
5. **Fallback Geral**:
   - `COALESCE(c.manager_id, '9999')`.

### Carteiras Oficiais Homologadas
* **BRASSOL** (códigos `221911` e `221912`): Pertence ao gerente **John Guedes** (`manager_id = '1003'`).
* **DISTRA** (código `114527`): Pertence ao gerente **Leandro** (`manager_id = '1001'`).
* **SOST** (código `212424`): Pertence ao gerente **Luiz** (`manager_id = '1002'`).
* **MANACAS** (código `223911`): Pertence ao gerente **Luiz** (`manager_id = '1002'`).
* **Distribuidores sem gerente comercial oficial** (ex: `217953` MGE DISTRIBUIDORA, `228858` ARMAZENS MARTINS): Atribuídos a **Distribuidor Corporativo** (`manager_id = '1007'`).

### Princípio Fundamental
O `manager_id` existente no cadastro oficial de `public.cm_clientes` é a fonte única de verdade (**Single Source of Truth**) para atribuição da carteira comercial.
O nome textual do vendedor no ERP Sankhya (`v.nome_vendedor = 'DISTRIBUIDOR'`) **NÃO pode sobrescrever** uma carteira comercial oficial válida (`1000`, `1001`, `1002`, `1003`).

### Identidade Matemática e Preservação Financeira
A redistribuição da classificação de gerente é estritamente neutra em relação aos totais financeiros:
$$\sum \text{Faturamento por Gerentes (1001, 1002, 1003)} + \text{Corporativo (1007)} = \text{Total Canal Distribuidor} \quad (\Delta = \mathbf{\text{R\$ } 0,0000})$$
$$\sum \text{Todos os Canais} = \text{Total Faturamento Empresa} \quad (\Delta = \mathbf{\text{R\$ } 0,0000})$$

### Duplicidade e Perda de Faturamento
A atribuição é estritamente **mutuamente exclusiva**:
* **É expressamente proibido**: duplicar faturamento, criar faturamento artificial, perder faturamento, atribuir simultaneamente uma nota a gerente comercial e corporativo, ou reter faturamento comercial oficial em `1007`.

### Fluxo Arquitetural Oficial (SSOT)
$$\text{public.cm\_clientes} \longrightarrow \text{public.mv\_vendas\_mensal} \longrightarrow \text{public.get\_actual\_sales\_v2} \longrightarrow \text{/metas}$$
* `public.mv\_vendas\_mensal`: Preserva na origem a segregação oficial por gerente comercial.
* `public.get\_actual\_sales\_v2`: Respeita a classificação da view sem regras intermediárias arbitrárias.
* `/metas`: Consome diretamente a RPC sem regras comerciais locais no React.

### Evidências da Homologação (Acumulado 2026):
* **BRASSOL**: Julho/2026 = `R$ 216.787,65` | Agosto/2026 = `R$ 6.066,30` $\rightarrow$ John Guedes (`1003`)
* **DISTRA**: Julho/2026 = `R$ 120.681,60` | Agosto/2026 = `R$ 50.438,40` $\rightarrow$ Leandro (`1001`)
* **SOST**: Junho/2026 = `R$ 175.513,00` | Agosto/2026 = `R$ 49.950,80` $\rightarrow$ Luiz (`1002`)
* **MANACAS**: Agosto/2026 = `R$ 467.260,60` $\rightarrow$ Luiz (`1002`)
* **Distribuidor Corporativo (1007)**: `R$ 26.577,76` (MGE `R$ 25.859,80` + Armazéns Martins `R$ 717,96`)
* **Total Canal Distribuidor 2026**: `R$ 1.242.687,31` (63.527 UN)
* **Total Empresa 2026**: `R$ 65.058.981,34` (2.256.393,6 UN)
* **Duplicação**: ZERO | **Perda**: ZERO | **Regressão em Outros Canais**: PASS

### Testes Técnicos Homologados:
* Migration aplicada: `supabase/migrations/20260822_fix_mv_vendas_mensal_distributor_manager_attribution.sql`
* `npx tsc --noEmit`: 0 erros.
* `npm run build`: Sucesso (139/139 rotas compiladas).
* RPC `get_actual_sales_v2`: PASS.
* Interface `/metas`: PASS.
* View de monitoramento `public.vw_mv_health_check`: `STATUS = OK`.

### Regra de Não-Regressão
Futuras alterações em `mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `cm_clientes`, `get_actual_sales_v2`, `commercial-structure.ts` ou na tela `/metas` **NÃO podem quebrar a segregação Canal × Gerente × Distribuidor**. Qualquer modificação futura exigirá auditoria formal de atribuição, identidade matemática e não-regressão.

Status Arquitetural: `DISTRIBUTOR_MANAGER_ATTRIBUTION = LOCKED` & `CORPORATE_DISTRIBUTOR_FALLBACK = LOCKED` & `MATHEMATICAL_IDENTITY = ENFORCED` & `DUPLICATION = FORBIDDEN` & `LOSS = FORBIDDEN` & `REGRESSION_TEST_REQUIRED = TRUE` & `BASELINE = PERMANENTE`.

---

## 122. Baseline Oficial — Alinhamento da Classificação Dimensional de Canais e Gerentes em `public.sales` (Baseline Permanente)

A partir de 22/08/2026, a classificação dimensional de canais e gerentes na view oficial de vendas realtime `public.sales` foi homologada, alinhada à view materializada `public.mv_vendas_mensal` e congelada como baseline permanente do Coffee++.

### Status
* `CLASSIFICATION_BASELINE_073 = TRUE`
* `FINANCIAL_PARITY = TRUE`
* `DIMENSIONAL_PARITY = TRUE`
* `IMPORT_HUB_FROZEN = TRUE`
* `CRON_FROZEN = TRUE`
* `BIGQUERY_CHANGED = FALSE`
* `FINANCIAL_RULES_FROZEN = TRUE`
* `TOPS_1705_1716_1714 = UNTOUCHED`
* `DELTA_FINANCEIRO = R$ 0,00`
* `STATUS = BASELINE_PERMANENT`

### Hierarquia Oficial de Classificação Dimensional
A view `public.sales` passa a obedecer estritamente à seguinte ordem hierárquica e determinística para derivar `channel`, `manager_id`, `manager` e `rede`:

1. **Canais Digitais Identificados por Vendedor/Origem Sankhya**:
   - `SHOPIFY`, `LIVELO` $\rightarrow$ `channel = 'Ecommerce'`, `manager = 'Ecommerce'`, `manager_id = '1005'`
   - `AMAZONFBA`, `MELI FULL`, `SHOPEE`, `AMAZONBR`, `ANYMARKET`, `MAGALU`, `MELI` $\rightarrow$ `channel = 'Marketplace'`, `manager = 'Marketplace'`, `manager_id = '1006'`
   - `AMAZON 1P` $\rightarrow$ `channel = 'Amazon 1P'`, `manager = 'Amazon 1P'`, `manager_id = '1008'` *(permanece desmembrada, sem ser absorvida por Inside Sales ou Julliano)*.
2. **Regras Especiais de Apuração Comercial**:
   - `r.manager_id_apuracao` e `r.gerente_apuracao` a partir de `cm_regras_apuracao_comercial` quando ativas.
3. **Carteira Oficial de Gerentes de Campo (KA)**:
   - Respeita a prioridade oficial de `cm_clientes` (`c.manager_id IN ('1000', '1001', '1002', '1003')`).
4. **Distribuidores Homologados**:
   - Respeita as regras de atribuição homologadas na Seção 77 (`v.nome_vendedor = 'DISTRIBUIDOR' OR c.tipo_parceiro = 'Distribuidor'`), mantendo distribuidores comerciais com seus respectivos gerentes e distribuidores corporativos em `1007`.
5. **Demais Classificações Cadastrais Oficiais**:
   - Utiliza `c.tipo_parceiro`, `c.responsavel`, `c.manager_id` de `cm_clientes`.
6. **Resíduo Legítimo em `SEM RESPONSÁVEL` / `Outros`**:
   - Apenas clientes e transações que genuinamente não possuem vínculo comercial cadastrado permanecem em `manager = 'SEM RESPONSÁVEL'` e `channel = 'Outros'`.

### Valores Oficiais de Referência (Acumulado 2026):
* **KA**: `R$ 38.975.031,53` (8.707 linhas)
* **Ecommerce**: `R$ 11.680.806,69` (258.003 linhas)
* **Marketplace**: `R$ 6.669.660,54` (177.841 linhas)
* **Amazon 1P**: `R$ 3.112.415,42` (329 linhas)
* **Distribuidor**: `R$ 1.242.687,31` (281 linhas)
* **Inside Sales**: `R$ 1.217.865,81` (4.285 linhas)
* **Marca Própria (Private Label)**: `R$ 880.290,00` (12 linhas)
* **Inside inter**: `R$ 300.265,24` (211 linhas)
* **Exportação**: `R$ 44.148,16` (16 linhas)
* **Outros / SEM RESPONSÁVEL**: `R$ 935.810,64` (4.306 linhas)
* **TOTAL EMPRESA**: `R$ 65.058.981,34` (453.991 linhas)

### Regras de Preservação e Não-Regressão
1. **Preservação de TOPs**: As TOPs `1705` (Venda Exportação Direta), `1716` (Venda Girus MT) e `1714` (Venda Suframa) permanecem fora do escopo e inalteradas. Qualquer inclusão futura exigirá decisão e homologação comercial formal prévia.
2. **Paridade Financeira e Dimensional Absoluta**: Toda consulta sobre `public.sales` deve obrigatoriamente manter 0,0000% de desvio em relação a `mv_vendas_mensal`:
   $$\text{TOTAL } \texttt{public.sales} = \text{TOTAL } \texttt{mv\_vendas\_mensal} \quad (\Delta = \text{R\$ } 0,00)$$
3. **Imutabilidade Operacional**: A integridade do Import Hub, rotinas do cron de importação, arquivos do Google Drive e filtros fiscais/contábeis permanece 100% blindada e inalterada.

Status Arquitetural: `SALES_DIMENSIONAL_CLASSIFICATION = LOCKED` & `DIGITAL_CHANNELS_SEGREGATION = ENFORCED` & `AMAZON_1P_SEGREGATION = ENFORCED` & `FINANCIAL_PARITY = CONFIRMED` & `DIMENSIONAL_PARITY = CONFIRMED` & `BASELINE = PERMANENTE`.

---

## 123. Baseline Oficial — Segregação Oficial do Canal Inside Sales no Dashboard `/vendas` (Demanda 077)

A partir de 22/08/2026, a apresentação dimensional do canal Inside Sales no dashboard `/vendas` passa a seguir a segregação comercial homologada na Demanda 077, tornando-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Canal Consolidado no `/vendas`**: O canal Inside Sales deve ser apresentado no dashboard `/vendas` como uma linha consolidada e dedicada, independentemente do `manager_id` cadastral do parceiro em `cm_clientes`.
2. **Critério Oficial de Identificação**: A identificação oficial utiliza estritamente `channel = 'Inside Sales'` (via função canônica de domínio `isInsideSalesClient`).
3. **Dedução das Linhas KA**: O faturamento, volume (unidades) e MACO de Inside Sales pertencentes aos clientes das carteiras dos gerentes de campo (`1000 Julliano`, `1001 Leandro`, `1002 Luiz`, `1003 John Guedes`) são retirados das respectivas linhas KA e consolidados exclusivamente na linha `"Inside Sales"`.
4. **Fórmulas Homologadas**:
   $$\text{kaOfficialFat} = \max(0, \text{officialManagerFat} - \text{distFat} - \text{insideFat})$$
   $$\text{kaOfficialQty} = \max(0, \text{officialManagerQty} - \text{distQty} - \text{insideQty})$$
   $$\text{kaOfficialMaco} = \max(0, \text{officialManagerMaco} - \text{distMaco} - \text{insideMaco})$$
5. **Conservação Financeira Absoluta**: A segregação é exclusivamente dimensional/apresentacional. Nenhum valor financeiro total da empresa pode sofrer alteração ($\text{TOTAL\_ANTES} = \text{TOTAL\_DEPOIS}$, com $\Delta = \text{R\$ } 0,00$).
6. **Referência Homologada — Agosto/2026**:
   * **Linha "Inside Sales" no `/vendas`**: `R$ 98.184,31`
   * **Composição Dimensional**:
     - Leandro / 1001: `R$ 34.890,33`
     - Luiz / 1002: `R$ 33.574,64`
     - Inside Sales / 1004: `R$ 18.685,88`
     - Julliano / 1000: `R$ 7.308,88`
     - John Guedes / 1003: `R$ 3.724,58`
     - **Total**: `R$ 98.184,31`
7. **Auditoria Complementar Homologada**:
   - Junho/2026: Paridade financeira $\Delta = \text{R\$ } 0,00$
   - Julho/2026: Paridade financeira $\Delta = \text{R\$ } 0,00$
   - Agosto/2026: Paridade financeira $\Delta = \text{R\$ } 0,00$
   - Valores negativos brutos encontrados: 0
   - Sobreposições Distribuidor × Inside Sales: 0
   - Casos onde $\text{distFat} + \text{insideFat} > \text{officialManagerFat}$: 0
   - Mascaramento por `Math.max(0, ...)`: 0 ocorrências
8. **Status de Governança**:
   * `FINANCIAL_PARITY = TRUE`
   * `DIMENSIONAL_PARITY = TRUE`
   * `NO_DIMENSIONAL_OVERLAP = TRUE`
   * `MATH_MAX_MASKING = FALSE`
   * `DATABASE_MUTATIONS = 0`
   * `FINANCIAL_RULES_CHANGED = FALSE`
   * `IMPORT_HUB_CHANGED = FALSE`
   * `CRON_CHANGED = FALSE`
   * `BIGQUERY_CHANGED = FALSE`
   * `BASELINE_073_CHANGED = FALSE`

Status Arquitetural: `INSIDE_SALES_SEGREGATION = LOCKED` & `INSIDE_SALES_CONSOLIDATION = ENFORCED` & `KA_LINES_PURITY = ENFORCED` & `FINANCIAL_PARITY = CONFIRMED` & `BASELINE = PERMANENTE`.

---

## 124. Baseline Oficial — Conclusão da Auditoria de CPV/MACO e Governança do Master Data (Demandas 077 a 083)

A partir de 22/08/2026, com base nas conclusões das Demandas 077, 078, 079, 081 e 082, a governança de CPV (Custo dos Produtos Vendidos), MACO (Margem de Contribuição) e a arquitetura do futuro Master Data de Custos Unitários tornam-se baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias de Governança:
1. **Preservação Integral da Fórmula Oficial de MACO**:
   $$\text{MACO} = \text{Faturamento Líquido} - \text{Impostos} - \text{Investimento Comercial} - \text{Frete (3\%)} - \text{CPV}$$
   A fórmula oficial permanece 100% inalterada em toda a plataforma.
2. **Classificação Oficial da Fonte Atual de CPV**:
   * O campo `cm_faturamento_sankhya.custo_total` fica formalmente classificado como:
     $$\texttt{CPV\_SOURCE\_STATUS} = \texttt{NOT\_SUITABLE}$$
     para fins de cálculo direto e agregação da MACO analítica.
3. **Fundamentação Técnica da Assimetria Estrutural do ERP**:
   * O campo `custo_total` no Sankhya ERP apresenta comportamento estruturalmente assimétrico entre canais B2C e B2B:
     - **Canais B2C (Marketplace / Ecommerce)**: O ERP registra o valor integral da tabela de varejo/consumidor por nota/linha (R$ 28,00 a R$ 39,99/un), gerando superestimação artificial de CPV e MACO negativa de até -53%.
     - **Canais B2B (Key Account / Amazon 1P / Distribuidores)**: O ERP registra o custo padrão unitário de 1 unidade para notas contendo centenas ou milhares de itens, gerando subestimação extrema de CPV (R$ 0,01 a R$ 0,28/un) e MACO artificial de 96% a 99%.
4. **Interpretação da MACO Negativa do Marketplace**:
   * A MACO negativa atualmente reportada no Marketplace (ex: -R$ 538.383,82 em Agosto/2026) constitui **indicador de distorção de fonte de CPV do ERP** e **NÃO deve ser interpretada como resultado econômico homologado da operação**.
5. **Natureza Estritamente Analítica da Simulação (Ref. R$ 11,80/un)**:
   * A simulação executada na Demanda 082 utilizando a referência de R$ 11,80/un constitui exclusivamente um teste analítico de sensibilidade:
     ```ini
     SIMULATION_CPV = R$ 11,80/un
     SIMULATION_ONLY = TRUE
     OFFICIAL_CPV = FALSE
     CONTROLADORIA_HOMOLOGATION = PENDING
     ```
   * **Resultado Comparativo da Simulação (Agosto/2026)**:
     - $\text{MACO Atual (Sankhya ERP)} = -\text{R\$ } 538.383,82 \quad (-52,08\%)$
     - $\text{MACO Simulada (Ref. R\$ 11,80/un)} = +\text{R\$ } 209.312,00 \quad (+20,25\%)$
     - $\Delta \text{ MACO (Recuperação Analítica)} = +\text{R\$ } 747.695,82 \quad (+72,33\text{ p.p.})$
     *(Estes valores representam estritamente o resultado de simulação paramétrica e não resultado contábil oficial).*
6. **Fonte Futura Homologada do Master Data**:
   * A futura fonte oficial de CPV unitário será a tabela `public.cm_skus_custos`.
   * A criação física da tabela e sua integração analítica em produção **somente poderão ocorrer após o recebimento formal e aprovação da planilha de custos fornecida pela Controladoria**.
7. **Regra de Cálculo Futuro do CPV por Linha**:
   $$\text{CPV}_{\text{linha}} = \text{quantidade\_faturada} \times \text{custo\_unitario\_vigente}(\text{codigo\_sku}, \text{data\_venda})$$
8. **Regra de Governança para SKUs sem Custo Homologado**:
   * Caso um SKU comercializado não possua custo homologado na data da venda:
     ```ini
     CPV = NULL
     cpv_status = COST_NOT_FOUND
     ```
   * **Proibições Absolutas**: É expressamente proibido utilizar 45%, taxa média arbitrária, `custo_total` do Sankhya como fallback, custo zero silencioso ou custo de outro SKU.
9. **Condicionamento de Eventos Futuros**:
   * Qualquer implementação física em banco (`DATABASE_MUTATIONS > 0`), criação de migration ou alteração na camada de dados do dashboard `/vendas` depende exclusivamente do envio e homologação formal do arquivo da Controladoria.

### Declaração de Conformidade:
```ini
CPV_SANKHYA_COST_TOTAL = NOT_SUITABLE
CPV_MASTER_DATA = FUTURE_OFFICIAL_SOURCE
CONTROLADORIA_FILE = PENDING
R$11_80_SIMULATION = NON_OFFICIAL
MACO_FORMULA = PRESERVED
MARKETPLACE_MACO_NEGATIVE = CPV_SOURCE_DISTORTION_INDICATOR
DATABASE_MUTATIONS = 0
FUNCTIONAL_CODE_CHANGES = 0
SQL_CHANGES = 0
VIEWS_CHANGED = FALSE
ANALYTICS_ENGINE_CHANGED = FALSE
MACO_RULES_CHANGED = FALSE
BASELINES_073_077_078_079_PRESERVED = TRUE

STATUS = CPV_GOVERNANCE_BASELINE_REGISTERED
```

Status Arquitetural: `CPV_GOVERNANCE = LOCKED` & `CPV_SANKHYA_STATUS = NOT_SUITABLE` & `CPV_MASTER_DATA_SPECIFICATION = HOMOLOGATED` & `MACO_FORMULA = PRESERVED` & `BASELINE = PERMANENTE`.

---

## 125. Baseline Oficial — Relatório Executivo Diário Automático por E-mail (Demanda 085)

A partir de 22/08/2026, a infraestrutura e rotinas de geração do **Relatório Executivo Diário do Coffee++** tornam-se o baseline permanente e oficial do ecossistema executivo da plataforma.

### Diretrizes Mandatórias:
1. **Destinatário e Periodicidade**:
   - Destinatário oficial: `cristiano.santos@coffeemais.com`.
   - Frequência: Segunda a Sábado, às 07:30 (horário de Brasília / Timezone `America/Sao_Paulo`).
   - Bloqueio de Domingos: Execução é estritamente bloqueada aos domingos (`dayOfWeek === 0`).
2. **Dependência Crítica da Ingestão**:
   - O relatório só pode ser gerado após a confirmação de sucesso da rotina diária de importação do Import Hub (`cm_sync_logs`).
   - Se a importação do dia estiver pendente ou com erro, o envio do relatório principal é bloqueado e substituído pelo alerta institucional *"⚠️ Coffee++ — Relatório Executivo não gerado"*.
3. **Consumo Exclusivo das Fontes Oficiais**:
   - **Página 1 (Vendas KA + Distribuidor)**: Consome exclusivamente `vw_faturamento_comercial_oficial` e `public.targets`, aplicando a segregação estrita de Inside Sales (Baseline 077).
   - **Página 2 (Resumo de Investimentos)**: Consome `v_acoes_investimento_com_gerente` e faturamento oficial.
   - **Página 3 (Investimento por Gerente/Canal)**: Consome `v_acoes_investimento_com_gerente` em visão temporal e matricial.
   - **Página 4 (Investimento por Cliente/Rede)**: Consome `v_acoes_investimento_com_gerente` com detalhamento operacional.
4. **Motor de Inteligência Artificial Fact-Based (Google Gemini 2.5 Flash)**:
   - Alimentado estritamente com dados numéricos pré-calculados e estruturados em JSON.
   - Proibição absoluta de alucinação de causas causais externas não fundamentadas em dados.
   - Comparações históricas MTD simétricas ($D_1 \dots D_{\text{atual}}$ no mês corrente vs $D_1 \dots D_{\text{atual}}$ no mês anterior).
5. **Geração e Formato do PDF de 4 Páginas**:
   - Construção server-side via `pdfmake` estruturada em 4 páginas A4 corporativas com semáforo de performance (<80% crítico, 80-99,9% atenção, $\ge 100\%$ atingido).

Status Arquitetural: `EXECUTIVE_DAILY_REPORT = LOCKED` & `REPORT_AUTOMATION = HOMOLOGATED` & `BASELINE = PERMANENTE`.

---

## 126. Baseline Oficial — Governança Transversal de Ownership e Contrato de SSOT (Ciclo P0)

A partir de 24/08/2026, a arquitetura de **Governança Transversal de Ownership e Verdade Única de Negócio (SSOT)** torna-se o baseline permanente e oficial do Coffee++, após homologação conclusiva do Ciclo P0.

### Status Oficial das Entregas do Ciclo P0:
- **P0-1 — Hierarquia e Propagação Segura**: `HOMOLOGADO`
- **P0-2 — Resolução Dinâmica de Investimentos**: `HOMOLOGADO`
- **P0-3.1 — Unificação SSOT do RDM**: `HOMOLOGADO`
- **P0-5 — Teste Controlado de Integridade Transversal**: `HOMOLOGADO`
- **P0-6 — Contrato Transversal de SSOT (ADR-009)**: `HOMOLOGADO`
- **P0-8 — Correção do ACH-01**: `HOMOLOGADO`
- **P0-FINAL — Homologação Final do Ciclo SSOT**: `HOMOLOGADO`

### Invariantes Permanentes de Governança:
1. `cm_redes_matrizes` é a origem canônica de ownership de Redes.
2. `cm_clientes` é a representação operacional do ownership das lojas/PDVs.
3. `base_atendimento` deve permanecer sincronizada com o ownership operacional.
4. `v_acoes_investimento_com_gerente` é a fonte canônica de leitura para ownership dos investimentos.
5. `cm_campanhas.gerente_id` permanece como autoria histórica e não deve ser reinterpretado como ownership atual.
6. `mv_vendas_mensal` e `mv_vendas_cliente_mensal` permanecem como fontes oficiais de faturamento.
7. `AnalyticsEngine V1` permanece `LOCKED`.
8. Nenhum módulo pode criar regra paralela de gerente, lookup alternativo, gerente hardcoded ou fallback silencioso de ownership.
9. Alterações realizadas no Cadastro Mestre devem refletir transversalmente nos módulos consumidores por meio das fontes oficiais, sem edição manual de módulos secundários.
10. Novas funcionalidades devem consumir as SSOTs oficiais existentes e não criar uma segunda verdade para a mesma informação.

### Evidência Conclusiva da Homologação Final:
- **P0 (Crítico):** 0
- **P1 (Divergência Relevante):** 0
- **P2 (Bloqueante):** 0
- **P3 (Relevante):** 0
- **Desvio Financeiro Global:** 0,0000%
- **Tipagem TypeScript:** 0 erros (`npx tsc --noEmit`)
- **Testes de Domínio Comercial:** 20/20 Aprovados (`npm run test:domain`)
- **Auditoria de Governança Analytics & React:** 100% Conforme (`npm run audit:analytics`)
- **Compilação de Produção Next.js:** SUCCESS / 188 rotas compiladas (`npm run build`)

Status Arquitetural: `TRANSVERSAL_OWNERSHIP_SSOT = LOCKED` & `CICLO_P0 = HOMOLOGADO_E_CONGELADO` & `BASELINE = PERMANENTE`.

---

## 127. Baseline Oficial — Ciclo P1 de Segurança, Integridade e Governança

A partir de 24/08/2026, a arquitetura de **Segurança, Integridade, Governança e Eliminação de Mocks (Ciclo P1)** torna-se o baseline permanente e oficial do Coffee++, após homologação conclusiva da suíte de auditoria transversal.

### Status Oficial:
- `CICLO_P1 = HOMOLOGADO_E_CONCLUIDO`
- `TRANSVERSAL_OWNERSHIP_SSOT = LOCKED`
- `CICLO_P0 = HOMOLOGADO_E_CONGELADO`
- `CICLO_P1 = LOCKED`
- `BASELINE = PERMANENTE`

### Status Oficial das Entregas do Ciclo P1:
- **P1-1 — Correção do RBAC do Atendimento (`/atendimento`)**: `HOMOLOGADO`
- **P1-2 — Follow-up Comercial (`cm_follow_up_actions` / `cm_follow_up_history`)**: `HOMOLOGADO`
- **P1-3 — Saneamento da Home / Eliminação de Mocks**: `HOMOLOGADO`
- **P1-5.1 — Sincronização Automática de Ownership / Refresh de MVs (`cm_mv_refresh_jobs`)**: `HOMOLOGADO`
- **P1-5.2 — Saneamento de Regras Paralelas / SSOT (`v_acoes_investimento_com_gerente`)**: `HOMOLOGADO`
- **P1-6 — Saneamento Global de RBAC Legado (`/metas`, `/meta-cia`, `/meta-cia-unidades`, `/alertas`)**: `HOMOLOGADO`
- **P1-7 — Saneamento de Dados Fictícios do Promotor (`/api/promotor/desafio`, `/api/remuneracao-promotor`)**: `HOMOLOGADO`
- **P1-8 — Auditoria Forense Final de Fechamento**: `HOMOLOGADO`

### Invariantes Permanentes de Governança:
1. **Autenticação Canônica**: Supabase Auth permanece como mecanismo oficial exclusivo de autenticação da plataforma.
2. **Autorização por Módulo**: A tabela `public.cm_role_permissions` permanece como fonte oficial de autorização por perfil e módulo.
3. **Proibição de Bypasses Client-Side**: Nenhum módulo pode utilizar senha fixa (`123456`), PIN client-side, tokens em `localStorage` ou flags em `sessionStorage` como mecanismo de autorização.
4. **SSOT de Redes**: `public.cm_redes_matrizes` permanece como SSOT única e canônica de ownership de Redes.
5. **SSOT Operacional de Lojas**: `public.cm_clientes` permanece como representação operacional das lojas/PDVs.
6. **Alinhamento de Atendimento**: `base_atendimento` permanece sincronizada com o ownership operacional, preservando exceções regionais (`cm_base_atendimento_regional`).
7. **SSOT de Investimentos**: `public.v_acoes_investimento_com_gerente` permanece como fonte canônica de leitura dinâmica para ownership dos investimentos.
8. **Autoria Histórica**: `public.cm_campanhas.gerente_id` permanece como registro de autoria histórica e não deve ser reinterpretado como titularidade atual.
9. **SSOT de Faturamento**: `public.mv_vendas_mensal` e `public.mv_vendas_cliente_mensal` permanecem como fontes oficiais de faturamento corporativo.
10. **AnalyticsEngine V1**: A camada analítica `AnalyticsEngine V1` permanece `LOCKED` como ponto único de acesso aos dados.
11. **Metas Oficiais**: O carregamento de metas consome exclusivamente as fontes homologadas (`public.targets`, `public.cm_weekly_projections`, `public.cm_promotor_metas`), sendo vedada a geração de números artificiais.
12. **Integridade do Módulo Promotor**: É expressamente proibido fabricar atingimento, realizado, meta ou remuneração quando inexistirem registros oficiais no banco de dados.
13. **Proibição de Regras Paralelas**: Nenhum módulo pode criar regra paralela para representar uma informação já existente em uma SSOT oficial.
14. **Governança de Fallbacks**: Fallback técnico é permitido somente para proteção tipográfica (`|| 0`, `?? 0`, `|| []`, `|| "—"`), sendo proibidos fallbacks que criem regras de negócio artificiais.
15. **Zero Dados Fictícios em Produção**: Dados fictícios, pseudoaleatórios ou mocks não podem alimentar indicadores reais de produção.

### Estado de Segurança Homologado:
- `PAGE_PASSWORD` = Eliminado
- `passwordInput` = Eliminado
- `ceo_auth_exp` = Eliminado
- `sessionStorage` de autorização = Eliminado
- `Bypass client-side` = Eliminado
- APIs críticas protegidas por `requireAuth()`, `requireApprovedProfile()` e `requirePermission()`

### Integridade Comercial e Financeira:
- Fórmula oficial de MACO: Permanece estritamente a **Baseline 57** ($\text{Receita Líquida} - \text{Impostos} - \text{CPV} - \text{Frete 3\%} - \text{Investimento Comercial}$).
- Faturamento: Centralizado no `AnalyticsEngine V1`.
- Investimentos: Resolvidos dinamicamente pela view canônica `v_acoes_investimento_com_gerente`.
- Follow-up Comercial: Opera sobre as tabelas oficiais `cm_follow_up_actions` e `cm_follow_up_history`.
- Promotor: Metas e remuneração derivadas exclusivamente de `cm_promotor_metas` e `cm_promotor_remuneracao`.

### Pipeline de Sincronização Temporal (P1-5.1):
$$\text{cm\_redes\_matrizes} \xrightarrow{\text{Trigger P0-1}} \text{cm\_clientes} \xrightarrow{\text{fn\_enqueue\_mv\_refresh}} \text{cm\_mv\_refresh\_jobs} \xrightarrow{\text{pg\_cron}} \text{Materialized Views}$$
- A janela horária de divergência foi definitivamente eliminada e substituída pelo processamento assíncrono via fila oficial.

### Testes Homologados da Baseline:
- `npx tsc --noEmit` = **0 erros**
- `npm run test:domain` = **20/20 aprovados**
- `npm run audit:analytics` = **100% conforme**
- `npm run build` = **SUCCESS / 188 rotas**
- **Paridade financeira** = **0,0000% de desvio**

### Dívidas Técnicas Registradas (P2 — Não Bloqueantes):
- **P2-01**: Rotas legadas e protótipos mantidos fisicamente de forma isolada, sem referência na Home (`/assistente-decisao`, `/simulacao-estrategica`, `/crm-enterprise`, `/dre-gerencial`).
- **P2-02**: Rota legada `/api/dre/route.ts` contendo fallback de orçamento (não consumida pelo ecossistema oficial).
*(Nota: Itens P2 são mantidos sem alteração durante este fechamento).*

### Locks Oficiais:
- `CICLO_P0 = LOCKED`
- `TRANSVERSAL_OWNERSHIP_SSOT = LOCKED`
- `CICLO_P1 = LOCKED`
- `AnalyticsEngine V1 = LOCKED`
- `Baseline 57 — MACO = LOCKED`
- `Views oficiais de faturamento = LOCKED`
- `Ownership P0/P1 = LOCKED`
- `RBAC canônico = LOCKED`

### Diretriz para o Próximo Ciclo:
"Nenhum item P2 deve ser implementado automaticamente em consequência desta baseline."
Qualquer próximo ciclo de desenvolvimento deverá possuir objetivo próprio, diagnóstico, escopo delimitado, critérios de aceite, avaliação de impacto e autorização executiva explícita.

Status Arquitetural: `CICLO_P1 = HOMOLOGADO_E_CONGELADO` & `BASELINE = PERMANENTE`.

---

## 128. Baseline Oficial — Ciclo P2 de Saneamento, Descontinuação e Integridade Arquitetural

A partir de 24/08/2026, a arquitetura de **Saneamento, Descontinuação de Legados e Integridade Arquitetural (Ciclo P2)** torna-se o baseline permanente e oficial do Coffee++, após homologação conclusiva de todas as fases de descontinuação controlada e auditoria pós-limpeza.

### Status Oficial:
- `CICLO_P0 = LOCKED`
- `CICLO_P1 = LOCKED`
- `CICLO_P2 = HOMOLOGADO_E_CONCLUIDO`
- `CICLO_P2 = LOCKED`
- `BASELINE = PERMANENTE`

### Escopo Homologado do Ciclo P2:
1. **P2-1 — Descontinuação dos Protótipos Enterprise e DRE Legado 2024**:
   - Remoção física dos protótipos desacoplados (`/assistente-decisao`, `/simulacao-estrategica`, `/crm-enterprise`, `/planejamento-comercial`, `/execucao-comercial`, `/oportunidades`, APIs `/api/commercial-*`, libs `src/lib/commercial-*`).
   - Remoção da camada órfã de `/dre-gerencial` (preservando `src/lib/dre-gerencial/types.ts` e `engine.ts` para o RDM).
   - Migração das referências residuais e remoção física definitiva do ecossistema DRE 2024 (`/dre`, `/dre/historico`, `/dre/upload`, `/api/dre`), convergindo 100% dos fluxos para o DRE Comercial oficial (`/inovacoes/dre` — Baseline 57).
2. **P2-2 — Remoção dos Clusters Órfãos, Módulo Tributos e Workflow Enterprise**:
   - Remoção física dos endpoints e libs de prioridades comerciais (`/api/commercial-priorities`, `src/lib/priorities/**`).
   - Remoção física dos endpoints e libs de RGM (`/api/rgm`, `src/lib/rgm/**`).
   - Remoção do endpoint legado de debug (`/api/dashboard/debug`).
   - Saneamento e remoção do módulo `/tributos` (protótipo com dados estáticos *Forno de Minas*) e atualização do menu de navegação (`src/config/modules.ts`).
   - Descontinuação física do cluster `Workflow Enterprise` (25 arquivos, UI, APIs e lib in-memory) e saneamento da matriz de permissões (`src/app/admin/permissoes/page.tsx`).
3. **P2-3 — Descontinuação do Decision Platform e Auditoria de Feature Flags**:
   - Remoção física do cluster órfão `src/lib/decision-platform/` (15 arquivos e testes).
   - Homologação e preservação da infraestrutura de Feature Flags (`public.cm_feature_flags` e `src/lib/feature-flags/flags.ts`).

### Invariantes Permanentes do Ciclo P2:
1. **Descontinuação Baseada em Auditoria Prévia**: Código órfão e desacoplado só pode ser removido após auditoria formal de ausência de consumidores e dependências.
2. **Preservação Absoluta do Core Homologado**: Nenhuma remoção ou limpeza pode atingir módulos oficiais, telas ativas ou bibliotecas compartilhadas em produção.
3. **Imutabilidade das SSOTs Oficiais**: Nenhuma operação de limpeza pode alterar tabelas canônicas de ownership (`cm_redes_matrizes`, `cm_clientes`, `base_atendimento`, `v_acoes_investimento_com_gerente`).
4. **Preservação da AnalyticsEngine V1**: A camada analítica única (`src/lib/governance/analytics/`) permanece `LOCKED` e intocada.
5. **Preservação da Baseline 57 (Fórmula MACO Oficial)**: A fórmula oficial de Margem de Contribuição Comercial permanece única e imutável.
6. **Preservação do RBAC Canônico**: A integridade de autenticação e matriz de permissões por role deve ser rigorosamente mantida a cada intervenção de código.
7. **Validação Estrita de Não-Resíduo**: Nenhuma remoção física é concluída sem varredura global com ripgrep confirmando 0 referências residuais.
8. **Pipeline de Verificação Obrigatório**: Toda alteração de ciclo deve comprovar aprovação em `npx tsc --noEmit` (0 erros), `npm run test:domain` (20/20), `npm run audit:analytics` (100%) e `npm run build` (SUCCESS).
9. **Infraestrutura Ativa de Feature Flags**: A tabela `public.cm_feature_flags` e a biblioteca `src/lib/feature-flags/flags.ts` permanecem homologadas e preservadas como infraestrutura ativa do sistema.
10. **Single Source of Truth para Flags**: `public.cm_feature_flags` é a única fonte oficial para alternância dinâmica de comportamento em produção (`use_real_ai`, `war_room_enabled`, `force_native_only`).
11. **Zero Mocks em Fluxos Oficiais**: Dados fictícios, números artificiais ou protótipos são terminantemente proibidos em rotas de produção.
12. **Governança de Fallbacks**: Proibidos fallbacks que criem regras de negócio paralelas ou heurísticas comerciais artificiais.

### Core Protegido (DO_NOT_TOUCH):
- `AnalyticsEngine V1` (`src/lib/governance/analytics/*`)
- `Baseline 57` (MACO Oficial)
- `Ownership SSOT` (`cm_redes_matrizes`, `cm_clientes`, `base_atendimento`, `v_acoes_investimento_com_gerente`)
- `Views oficiais de faturamento` (`mv_vendas_mensal`, `mv_vendas_cliente_mensal`, `mv_positivacao_sku_mensal`)
- `Metas Oficiais` (`targets`, `cm_weekly_projections`, `cm_promotor_metas`, `cm_promotor_remuneracao`)
- `Sistema Inovações` (Cockpit Comercial, DRE Comercial, CRM Comercial)
- `Módulos Independentes` (Centro de Inteligência, Forecast Comercial, Simulador Comercial, Assistente IA)
- `Processo Comercial & Operações` (RPS, RDM, Follow-up Comercial, Promotor, Supervisor, Trade, Atendimento, Investimentos, Vendas)
- `Coffee IA` (`/coffee-ia`, `/api/coffee-ia/*`)
- `Feature Flags` (`cm_feature_flags`, `src/lib/feature-flags/flags.ts`)

### Estado Final Consolidado do Repositório:
- **Arquivos TypeScript/TSX:** 621 arquivos
- **Rotas de Aplicação:** 89 páginas ativas
- **Rotas de API:** 148 endpoints ativos
- **Rotas Compiladas no Build:** 120 rotas estáticas
- **Testes de Domínio:** 20/20 aprovados (`npm run test:domain`)
- **Auditoria de Governança Analytics & React:** 100% conforme (`npm run audit:analytics`)
- **TypeScript:** 0 erros (`npx tsc --noEmit`)
- **Compilação de Produção:** SUCCESS (`npm run build`)
- **Paridade Financeira:** 0,0000% de desvio

### Infraestrutura de Feature Flags Homologada:
- `public.cm_feature_flags` = **ATIVO / PRESERVAR**
- `src/lib/feature-flags/flags.ts` = **INFRAESTRUTURA VÁLIDA / PRESERVAR**
- **Casos de Uso Ativos:**
  - `use_real_ai`: Gestão via `/admin/kpi-config` e consumo pelo `AIProvider` (Cloud Vision API vs Simulação);
  - `war_room_enabled`: Ativação do modo War Room no Supervisor Command Center;
  - `force_native_only`: Middleware Next.js para forçar uso do app mobile pelos promotores.

### Diretriz para Próximos Ciclos:
"Nenhum ciclo subsequente (P3 ou posterior) deve ser iniciado automaticamente em decorrência desta baseline."
Qualquer evolução ou ciclo futuro deverá possuir objetivo próprio, diagnóstico forense, escopo delimitado, matriz de dependências, critérios de aceite, avaliação de impacto, mitigação de riscos e autorização executiva explícita.

Status Arquitetural: `CICLO_P2 = HOMOLOGADO_E_CONGELADO` & `BASELINE = PERMANENTE`.

---

## 118. Baseline Oficial — Trilha Comercial End-to-End (Follow-up Prescritivo, RPS Gap Recovery, CRM, Alertas & Cockpit)

A partir de 25/08/2026, a arquitetura, modelos de persistência, idempotência atômica, reconciliação analítica e componentes da **Trilha Comercial End-to-End** tornam-se o baseline permanente e oficial do Coffee++.

### 1. Arquitetura Homologada:
1. **Trilha CRM / Cockpit Prescritivo**: `CrmClienteDrawer` → `NewFollowUpModal` → `POST /api/follow-up` → `FollowUpService.create` → `cm_follow_up_actions` (`origem = 'COCKPIT_PRESCRITIVO'`, `origem_ref = 'CRM-{clienteId}-{YYYY-MM-DD}'`) → `AnalyticsEngine V1` → `CockpitService` → `FollowUpEfetividadeCard`.
2. **Trilha RPS (Dispersão Negativa)**: `rps/page.tsx` → `handleOpenCompromissoRps` → `NewFollowUpModal` (`gap_original_reais = Math.abs(gap)`, `origem = 'RPS_COMPROMISSO'`, `origem_ref = 'RPS-{targetMonth}-{client}'`) → `cm_follow_up_actions` → Conclusão da Ação → Janela de 30 Dias → `vw_faturamento_comercial_oficial` → `AnalyticsEngine.getFollowUpEfetividadeAnalytics` (`rpsGapRecovery`) → `FollowUpEfetividadeCard`.
3. **Trilha Alertas**: `alertas/page.tsx` → `handleOpenFollowUpAlert` → `NewFollowUpModal` (`origem = 'ALERTA_QUEDA'`, `origem_ref = alert.id`) → `FollowUpStatusBadge` → `AnalyticsEngine V1` → `Cockpit Comercial`.

### 2. Idempotência Atômica Canônica:
- **Índice Físico no PostgreSQL**: `uq_idx_follow_up_active_origem_ref` em `(origem, origem_ref) WHERE status IN ('PENDENTE', 'EM_ANDAMENTO') AND origem IS NOT NULL AND origem_ref IS NOT NULL`.
- **Tratamento de Concorrência**: `SELECT` preventivo + barreira física única + captura de erro `23505` convergindo deterministicamente para o registro ativo existente.
- Ações manuais sem `origem_ref` continuam permitidas; ações encerradas (`CONCLUIDA`, `NAO_EFETIVA`, `CANCELADA`) liberam a criação de novos ciclos.

### 3. Persistência Estruturada do GAP RPS:
- **Coluna Oficial**: `public.cm_follow_up_actions.gap_original_reais NUMERIC NULL`.
- **Proibição Absoluta**: É expressamente proibido qualquer parsing textual do campo `descricao` para finalidades financeiras ou de reconciliação de gap. O campo `descricao` é estritamente de contexto operacional humano.

### 4. Reconciliação Financeira Oficial do GAP RPS:
- **GAP Original Total**: `SUM(gap_original_reais)` para ações com `gap_original_reais > 0`.
- **Faturamento Recuperado**: Soma das notas fiscais comerciais emitidas na janela `[concluded_at, concluded_at + 30 dias]`.
- **GAP Remanescente por Ação**: `MAX(0, gap_original_reais - faturamento_recuperado)`.
- **Taxa de Recuperação por Ação**: `MIN(100, faturamento_recuperado / gap_original_reais * 100)` quando `gap_original_reais > 0`.
- **Superávit**: O faturamento recuperado real nunca é truncado; apenas o saldo remanescente é limitado a `R$ 0,00` e a taxa a `100,0%`.

### 5. Single Source of Truth Financeira & Anti-Duplicidade:
- **Fonte Financeira Única**: `vw_faturamento_comercial_oficial` com TOPs homologadas e expurgo de canceladas/parceiros não comerciais.
- **Join Relacional Canônico**: `vw_faturamento_comercial_oficial f ON f.cod_parceiro = el.cod_parceiro` (via `cliente_id` → `cm_clientes.id` → `cm_clientes.codigo`). É expressamente proibido cruzamento por nome, rede ou texto livre.
- **Máquina Anti-Duplicidade**: `ROW_NUMBER() OVER (PARTITION BY f.id ORDER BY el.concluded_date DESC, el.action_id DESC)`. Nenhuma NFe pode contribuir para duas ações comerciais simultaneamente.

### 6. Evidência Operacional Real da Homologação (P3.6F):
- **Cliente**: `MUNDIALMIX COMÉRCIO DE ALIMENTOS LTDA` (Código: `70563`, ID: `b4cf0180-e7fb-4701-92f9-977d7c2ced4e`, Rede: `IMPERATRIZ`, Gerente: `Leandro Saffi` - ID: `1001`).
- **Ação Real**: `Action ID: 6cb7448a-daa4-494a-865c-1aaaebcf36d3` (`origem = 'RPS_COMPROMISSO'`, `origem_ref = 'RPS-2026-08-IMPERATRIZ'`).
- **GAP Original Homologado**: `R$ 535.360,00` (Dispersão RPS de `-53,54%`).
- **Status da Janela Operacional**: Ação concluída em `25/08/2026`. Janela de reconciliação aberta até `24/09/2026` (`JANELA 30D ABERTA`).

### 7. Auditoria Técnica e Não-Regressão:
- TypeScript: `npx tsc --noEmit` = 0 erros
- Domínio Comercial: `npm run test:domain` = 20/20 aprovados
- Governança Analytics & React: `npm run audit:analytics` = 100% conforme
- Compilação de Produção: `npm run build` = SUCCESS
- Baseline 57 (MACO): 100% PRESERVADA
- Zero cálculos financeiros no React / Frontend.

Status Arquitetural: `TRILHA_COMERCIAL = LOCKED` | `ARQUITETURA = LOCKED` | `ANALYTICS = LOCKED` | `FINANCEIRO = LOCKED` | `UI = LOCKED` | `IDEMPOTENCIA = LOCKED` | `OWNERSHIP = LOCKED` | `RBAC = LOCKED` | `BASELINE = PERMANENTE`.

---

## 86. Baseline Oficial — Estabilização Pós-Ciclo P4.6 (Encerramento dos 8 Bugs Residuais BUG-RES-01 a BUG-RES-08)

A partir de 25/08/2026, a homologação e o fechamento formal dos 8 bugs residuais do sistema tornam-se o baseline permanente e oficial do Coffee++.

### Status
`SISTEMA_ESTABILIZADO = TRUE` | `P4_6C_GATE_FINAL = APROVADO` | `BASELINE = PERMANENTE`

### 1. Encerramento Formal dos Bugs Residuais (BUG-RES)
* **BUG-RES-01 (Boletos / `cm_acoes_investimento`)**: ENCERRADO. Tabela `cm_investimentos` descontinuada substituída por `cm_acoes_investimento` com guard de status aberto (`PLANEJADA`, `EM_ANDAMENTO`, `DRAFT`). Ações concluídas/pagas 100% protegidas.
* **BUG-RES-02 (Atendimento / Sincronização Histórica)**: ENCERRADO. RPC fantasma `sync_historical_sales` eliminada; substituída por `recalcular_responsaveis_clientes()` e enfileiramento `fn_enqueue_mv_refresh()`.
* **BUG-RES-03 (Metas Multicanal no Planejamento)**: ENCERRADO. Sobrescrita eliminada; `officialManagerTargetMap` acumula aditivamente $KA + Dist$ (Luiz: R$ 3.300.000, Leandro Saffi: R$ 2.810.000, John Guedes: R$ 550.000, Julliano: R$ 1.000.000).
* **BUG-RES-04 (Cron RPS Alert)**: ENCERRADO. Falso positivo de cobrança semanal de Leandro Saffi eliminado via normalização canônica centralizada (`resolveCanonicalManager`).
* **BUG-RES-05 (Mapeamento Territorial AC)**: ENCERRADO. Typo `Luisa` corrigido para `Luiz` em `public.manager_uf_mapping` via migration atômica com guard estrito `v_count = 1` (0 ocorrências de `Luisa`).
* **BUG-RES-06 (Cadastros / Networks / FK de PDVs)**: ENCERRADO. Sincronizadas 1.091 redes em `public.network_matrix`; FK física `pdvs.network_id REFERENCES network_matrix(id)` íntegra e ativa com 0 órfãos.
* **BUG-RES-07 (CRM Prescritivo / Remoção de Mock)**: ENCERRADO. Faturas e evolução fictícias removidas do motor analítico; arrays vazios `[]` e estado vazio visual elegante implementados.
* **BUG-RES-08 (Cron Ações Atrasadas)**: ENCERRADO. Normalização de perfis e ações via `resolveCanonicalManager`, garantindo entrega de notificações para todos os gerentes regionais.

### 2. Indicadores de Qualidade, Integridade e Governança
* **TypeScript**: 0 erros (`npx tsc --noEmit`).
* **Domínio Comercial**: 20/20 testes aprovados (`npm run test:domain`).
* **Governança Analytics & React**: 100% conforme (`npm run audit:analytics`).
* **Compilação de Produção**: 120/120 rotas compiladas com sucesso (`npm run build`).
* **Integridade Relacional**: FK `pdvs.network_id -> network_matrix.id` íntegra; 0 órfãos.
* **Tabelas e RPCs Descontinuadas**:
  - `sales_enriched`: 0 referências runtime.
  - `sync_historical_sales`: 0 chamadas runtime.
  - `cm_investimentos`: 0 consultas runtime à tabela física descontinuada.
* **Catálogo Canônico**: Aliases de gerentes 100% normalizados via `resolveCanonicalManager`.
* **Baselines Preservadas**:
  - `AnalyticsEngine V1`: `LOCKED`
  - `Baseline 57 MACO/DRE`: `LOCKED`
  - `RPS P3.6N`: `LOCKED`
  - `Trilha Comercial End-to-End`: `LOCKED`

### 3. Registro do Resíduo Técnico Conhecido (Não Operacional)
* **Componente**: `src/app/inovacoes/crm/components/CrmClienteDrawer.tsx` (linhas 52–77).
* **Descrição**: Contém fallback defensivo legado para objetos no formato não processado `CrmOportunidade`.
* **Classificação**: `🟢 INOFENSIVO / INACESSÍVEL EM RUNTIME`. No fluxo operacional da página `/inovacoes/crm`, o objeto injetado possui sempre `nomeParceiro` preenchido, tornando a ramificação `false` inalcançável. Mantido sem alteração como resíduo conhecido para limpeza em ciclo futuro.

### 4. Regra de Governança Futura
1. "P4.6C constitui o estado operacional homologado de referência do ecossistema Coffee++ após a estabilização dos BUG-RES-01 a BUG-RES-08."
2. "Qualquer novo bug, alteração funcional, melhoria ou refatoração identificada após P4.6C deverá iniciar um novo ciclo de implementação, com nova identificação de fase, sem modificar ou reabrir artificialmente as baselines anteriores."

Status Arquitetural: `P4_6C_POST_STABILIZATION = LOCKED` | `BUG_RES_01_TO_08 = CLOSED` | `SYSTEM_STABILITY = CONFIRMED` | `BASELINE = PERMANENTE`.

---

## 72. Baseline Oficial — Cadastro Único como SSOT e Canonical Network Engine (P4.11 / P4.12)

A partir de 25/08/2026, a arquitetura de **Cadastro Único (`public.cm_clientes`) como Single Source of Truth (SSOT)** e a **Canonical Network Engine** tornam-se o baseline permanente e oficial do Coffee++.

### Diretrizes Mandatórias:
1. **Single Source of Truth (SSOT)**: A tabela `public.cm_clientes` é a única fonte primária da verdade para identidade, nomenclatura, regionalidade e titularidade de redes comerciais em todo o ecossistema.
2. **Resolução Canônica Dinâmica**: A resolução de redes deve ocorrer exclusivamente através da arquitetura canônica implementada em `src/lib/domain/canonical.ts` e `CommercialDomainService.resolveNetwork()`.
3. **Proibição Absoluta de Aliases Hardcoded**: É expressamente proibida a criação de mapas estáticos de nomes de redes, tabelas em memória ou regras específicas por rede no TypeScript ou SQL.
4. **Proibição de Heurísticas Inseguras**: É proibido o uso de `startsWith`, `substring`, regex aproximativo ou fuzzy matching para resolução de redes.
5. **Ordem Estrita de Precedência**:
   1. `network_id` (quando disponível)
   2. `cod_parceiro` (quando disponível)
   3. `(codigo_matriz, manager_id, uf)` com unicidade 1:1 comprovada
   4. Discriminador operacional comprovado
   5. Correspondência exata na view oficial `vw_redes_planejaveis_oficiais`
6. **Ambiguity Guard Ativo**: Quando múltiplos candidatos coexistirem sem discriminador unívoco suficiente, o sistema deve retornar `status = CANONICALIZACAO_AMBIGUA`, preservando o registro intacto e bloqueando adivinhação automática.
7. **Propagação Sistêmica**: Qualquer alteração de `cm_clientes.matriz` reflete automaticamente nos consumidores dinâmicos (RPS, Metas por Rede, Investimentos, Cockpit, CRM, DRE e APIs), respeitando snapshots históricos imutáveis (ex: Cartas de Anuência).
8. **Paridade Financeira Absoluta**: A resolução canônica jamais altera ou duplica projeções financeiras, preservando estritamente o FAT consolidado do gerente (`FAT_CONSOLIDADO_GERENTE_SEMANA[w] = SUM(FAT_PROJECAO_REDE[w])` com $\Delta = \text{R\$} 0,00$).

Status Arquitetural: `CADASTRO_UNICO_SSOT = LOCKED` | `CANONICAL_NETWORK_ENGINE = LOCKED` | `AMBIGUITY_GUARD = ACTIVE` | `BASELINE = PERMANENTE`.

---

## 87. Baseline Oficial — RPS: Desacoplamento Soberano Gerente × Redes e Homologação Definitiva

A partir de 26/08/2026, após a conclusão da auditoria histórica forense e restauração cirúrgica baseada na baseline homologada `a372d61` (24/08/2026 23:41), a arquitetura do módulo de **RPS (Reunião de Planejamento Semanal)** torna-se o baseline permanente e oficial do Coffee++.

### 1. Desacoplamento Absoluto e Soberania do FAT Gerente
1. **Soberania do FAT Gerente (`_TOTAL_`)**: A projeção semanal de FAT do gerente gravada em `cm_weekly_projections` com `client_matrix = '_TOTAL_'` e `kpi = 'FAT'` é um valor manual, independente e soberano.
2. **Independência das Redes**: A projeção semanal de faturamento de cada rede é estritamente independente do cabeçalho do gerente.
3. **Proibição de Propagação Bidirecional**:
   - `GERENTE → REDE = PROIBIDO`: Alterar a projeção de faturamento do gerente NÃO pode alterar ou distribuir valores para as redes.
   - `REDE → GERENTE = PROIBIDO`: Alterar a projeção de faturamento de uma rede NÃO pode somar, recalcular ou sobrescrever `mgr.kpis.FAT.projections`.
4. **Rejeição Definitiva da Regra P4.7**: Fica expressamente proibido o uso de `clients.reduce(...)` ou `clientsList.reduce(...)` para atribuir ou sobrescrever a projeção de faturamento consolidada do gerente (`kpis.FAT.projections`). A regra P4.7 está formalmente revogada e rejeitada.

### 2. Governança de DESAFIOS e Imutabilidade de Metas
1. **Single Source of Truth para Desafios**:
   - `RPS_DESAFIO_OVERRIDE`: `cm_weekly_projections` (`client_matrix = '_TOTAL_'`, `kpi IN ('DESAFIO_VOL', 'DESAFIO_FAT', 'DESAFIO_INVEST')`).
   - `RPS_DESAFIO_FALLBACK`: `public.targets` (somente leitura).
2. **Imutabilidade de `public.targets`**: É expressamente proibida qualquer operação de `INSERT`, `UPDATE`, `UPSERT` ou `DELETE` sobre a tabela `public.targets` na API ou no frontend da RPS (`RPS_PUBLIC_TARGETS_MUTATION = FORBIDDEN`).
3. **Escala e Tipagem dos Desafios**:
   - `DESAFIO_VOL`: Digitado e exibido em milhares na UI, persistido em unidades absolutas (`×1000`).
   - `DESAFIO_FAT`: Digitado e exibido em milhares na UI, persistido em reais absolutos (`×1000`).
   - `DESAFIO_INVEST`: Digitado, exibido e persistido como percentual direto (ex: `10.0` para 10%).

### 3. Escala, Tipagem e Conversão das Projeções Semanais
1. **VOL Semanal**: UI em milhares (`/1000`), banco em unidades absolutas (`×1000`).
2. **FAT Semanal**: UI em milhares (`/1000`), banco em reais absolutos (`×1000`).
3. **INVEST Semanal**: UI e banco em percentual direto (`10.0` para 10%).

### 4. Isolamento e Segurança
1. **Isolamento entre Gerentes**: Toda e qualquer alteração de estado no frontend e de gravação no backend restringe-se estritamente ao gerente (`mIdx`, `manager_id`, `resolveCanonicalManager`). `GERENTE_A ≠ GERENTE_B`.
2. **Isolamento entre Semanas**: Alterações em uma segunda-feira (`wIdx`, `week_start_date`) afetam exclusivamente a referida semana. `SEMANA_A ≠ SEMANA_B`.
3. **Autorização RLS / Perfil**:
   - `Admin` e `Admin Master`: Podem alterar `DESAFIO`, `META` e qualquer semana de projeção.
   - `Gerente Regional`: Pode alterar apenas projeções (`VOL`, `FAT`, `INVEST`) da semana corrente, até às 15:00 de segunda-feira (via *Server Time*). Edição de `DESAFIO` e `META` é bloqueada com HTTP 403.

### 5. Regras de UX e Interação dos Inputs
1. **Digitação Natural sem Saltos**: É proibido o uso inline de `.toFixed()` ou formatações agressivas na propriedade `value` de elementos `<input>` durante a digitação que provoquem saltos de cursor ou injeção forçada de decimais. A entrada deve permitir digitação contínua de valores inteiros e decimais (ex: `1`, `10`, `90`, `200`, `3000`, `10.5`).

### 6. Automação do Alerta de Projeções (14:00 BRT)
1. **Critério de Preenchimento**: Um gerente regional só é considerado preenchido se possuir os 3 KPIs (`FAT`, `VOL`, `INVEST`) salvos na linha consolidada `_TOTAL_` para a semana corrente.
2. **Janela Operacional**: Domingo 00:00 BRT até Segunda-feira 14:00 BRT.
3. **Idempotência**: Garantida mediante gravação de log corporativo em `cm_audit_logs`.

Status Arquitetural: `RPS_GOVERNANCE = LOCKED` | `RPS_MANAGER_FAT_SOVEREIGN = LOCKED` | `RPS_NETWORK_FAT_INDEPENDENT = LOCKED` | `RPS_P4_7 = REJECTED` | `RPS_DESAFIO = LOCKED` | `RPS_PUBLIC_TARGETS_MUTATION = FORBIDDEN` | `RPS_MANAGER_ISOLATION = LOCKED` | `RPS_WEEK_ISOLATION = LOCKED` | `RPS_ALERT_14H = LOCKED` | `BASELINE = PERMANENTE`.





















