# Histórico Técnico de Incidentes - Coffee Mais

Este documento registra o histórico de incidentes técnicos identificados, investigados e resolvidos no ecossistema Coffee++.

---

## [INC-2026-07-09-001] Divergência Cadastral na Matriz ZAFFARI

* **Data de Resolução:** 2026-07-09
* **Usuário Afetado:** Leonardo
* **Módulo:** Investimentos
* **Severidade:** Baixa
* **Categoria:** Integridade Cadastral
* **Causa Raiz:**
  Divergência entre o campo `codigo_matriz` na tabela `cm_clientes` e a chave primária `codigo` na tabela `cm_redes_matrizes` para o cliente **ZAFFARI (código 84906)**.
  O cadastro do cliente possuía o valor `"184206"`, enquanto a tabela mestre de referência continha o valor correto `"84906.0"`. Essa inconsistência causava uma falha de chave estrangeira (`fk_cm_acoes_codigo_matriz`) no banco de dados durante o salvamento de investimentos por meio da RPC `criar_campanha_e_acoes_v2`.
* **Correção Aplicada:**
  O campo `codigo_matriz` do cliente `84906` na tabela `cm_clientes` foi atualizado de `"184206"` para `"84906.0"`. O timestamp `created_at` foi atualizado para garantir a prioridade da ordenação na view `v_redes_matrizes_detalhes`.
* **Qtd. Registros Atualizados:** 1 registro.
* **Resultado:**
  Exibição do dropdown normalizada para `"84906.0 - ZAFFARI (CESTO)"` e gravação de novos lançamentos de investimentos liberada sem erros.

---

### Recomendações Preventivas

1. **Auditoria Cadastral Periódica:**
   Criar uma rotina automatizada ou query de monitoramento para rodar periodicamente identificando registros órfãos na tabela `cm_clientes` cuja matriz não esteja presente na `cm_redes_matrizes`.
   
   * **Query de Auditoria:**
     ```sql
     SELECT id, codigo, nome_parceiro, matriz, codigo_matriz
     FROM public.cm_clientes
     WHERE codigo_matriz IS NOT NULL
       AND codigo_matriz NOT IN (SELECT codigo FROM public.cm_redes_matrizes);
     ```
