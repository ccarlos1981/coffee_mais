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

