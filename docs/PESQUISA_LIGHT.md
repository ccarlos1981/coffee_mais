# Módulo Gestão Promotor — Pesquisa Light

A **Pesquisa Light** é uma funcionalidade minimalista de inteligência comercial criada para capturar rapidamente movimentações e promoções de preços de café Flat (Moído ou Grão) e Gourmet diretamente no campo através de smartphones.

---

## 1. Banco de Dados

Os dados são armazenados na tabela `public.cm_promotor_pesquisa_light`, que possui políticas de Row Level Security (RLS) habilitadas para usuários autenticados.

### Schema da Tabela

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID` | Chave primária gerada automaticamente (`gen_random_uuid()`). |
| `created_at` | `TIMESTAMPTZ` | Data e hora do registro (default: `now()`). |
| `promotor_id` | `UUID` | ID do funcionário (`cm_employees.id`) obtido via `cm_promotor_perfil`. |
| `usuario_id` | `UUID` | ID do usuário autenticado no Supabase (`auth.users.id`). |
| `rede` | `VARCHAR(255)` | Nome do cliente/rede de supermercados onde a promoção foi identificada. |
| `codigo_matriz` | `TEXT` | Código de cadastro/identificador único da matriz/rede (cliente). |
| `preco_flat` | `NUMERIC(10,2)` | Preço praticado para o produto de café Flat. |
| `tipo_flat` | `VARCHAR(50)` | Tipo da embalagem Flat (Restrição: `'Moído'` ou `'Grão'`). |
| `preco_gourmet` | `NUMERIC(10,2)` | Preço praticado para o produto de café Gourmet. |

### Índices de Performance
* `idx_cm_promotor_pesquisa_light_promotor` em `(promotor_id)`
* `idx_cm_promotor_pesquisa_light_created_at` em `(created_at DESC)`

### Função RPC (Sugestões Dinâmicas)
A classificação e identificação das maiores redes é executada diretamente no banco de dados pela RPC `public.get_top_redes_por_uf(p_uf TEXT)`.
* **Critério de Ranking**:
  1. Maior faturamento líquido (`net_value`) nos últimos 12 meses (consumindo a view unificada `sales`).
  2. Maior volume vendido (`quantity`) nos últimos 12 meses.
  3. Maior quantidade de lojas positivadas (clientes distintos) nos últimos 12 meses.
* **Segurança**: Privilégios de execução pública foram revogados (`REVOKE EXECUTE ... FROM PUBLIC`). Apenas perfis `authenticated` e o `service_role` têm permissão de execução.

---

## 2. Lógica de Negócio e Notificações (Server Actions)

Localização da Server Action: `src/app/promotor/pesquisa-light/actions.ts`

### `salvarPesquisaLight`
1. **Validação de Sessão:** Ação protegida com `await createClient()`. Lança erro `UNAUTHORIZED` se o usuário não estiver logado.
2. **Sanitização de Dados:** Valida se a rede (`rede`), o código identificador (`codigoMatriz`), os preços e o tipo flat estão corretos.
3. **Resolução de Identidades:**
   - Busca em `cm_promotor_perfil` pelo `employee_id` correspondente ao `user.id`.
   - Recupera o nome do funcionário em `cm_employees`.
   - Fallback: se não houver perfil de promotor (ex: Admin testando), usa o nome do usuário de `cm_user_profiles` e grava `promotor_id` como `null`.
4. **Inserção no Banco:** Persiste a ocorrência.
5. **Resolução de Notificações:**
   - Lista os e-mails padrões fixados: `trade@coffeemais.com` e `cristiano.santos@coffeemais.com`.
   - Busca de forma dinâmica em `cm_user_profiles` e `auth.users` todos os usuários ativos com cargo de `Gerente Regional`, `Gerente Nacional` ou `Trade`.
6. **Notificação por SMTP (Gmail):** Dispara e-mail síncrono formatado com template HTML responsivo contendo os detalhes coletados em campo. O bloco é isolado em `try/catch` para impedir que falhas de e-mail revertam ou bloqueiem o formulário do promotor.

### `obterRedesRecomendadas` (Com Cache)
1. **Verificação de Acesso**: Protege a Server Action validando a sessão ativa do usuário (`supabase.auth.getUser()`).
2. **Mecanismo de Cache (`unstable_cache`)**:
   - Encapsula a invocação da RPC `get_top_redes_por_uf` utilizando um cliente admin (`createAdminClient()`) independente de cookies.
   - **TTL (Time To Live)**: **3600 segundos (1 hora)**.
   - **Chave de Cache**: Segmentada dinamicamente pelo argumento `uf`, gerando caches isolados por estado e para o fallback nacional.
   - **Invalidação**: Revalidação automática após a expiração de 1 hora ou manual por meio da tag `"top-redes"`.

---

## 3. Segurança e Controle de Acesso

O controle de visualização do módulo e seus atalhos respeita a matriz de permissões unificada do Coffee Mais:
* **Chave da Permissão:** `"Pesquisa Light"`.
* **Configuração:** Pode ser habilitada/desabilitada na tela de Matriz de Permissões (`/admin/permissoes`) gerenciada pela tabela `cm_role_permissions`.
* **Fallback:** Se nenhuma configuração de matriz existir no banco para a função do usuário, o sistema concede acesso automático por padrão aos papéis: `Promotor`, `Supervisor`, `Trade`, `Admin` e `CEO`.

---

## 4. Frontend (Mobile-First)

Localização: `src/app/promotor/pesquisa-light/page.tsx`

* **Layout:** Otimizado para smartphones (limite de largura de visualização `max-w-md` centralizado na tela).
* **Entrada de Dados:**
  - **Combobox Autocomplete**: Seleção pesquisável de redes integrada à view `v_redes_matrizes_detalhes` (idêntico ao comportamento e UX de Lançar Investimento).
  - **Sugestões Inteligentes (Chips)**:
    - Identifica a UF do promotor em seu perfil `cm_user_profiles.uf`. Em casos de múltiplos estados (ex: "MG, SP"), seleciona o primeiro como principal.
    - Caso o promotor não possua UF ou o estado não registre vendas recentes, ativa o fallback nacional.
    - Exibe as 10 principais redes como chips de preenchimento rápido com um único toque.
  - Seletor de moeda para Preço Flat e seletor amigável (toggle) entre Moído e Grão.
  - Seletor de moeda para Preço Gourmet.
* **Estados Visuais:** Carregamento de dados do usuário, tratamento de erros integrado em tempo real e cartão de sucesso de entrega pós-confirmação.
