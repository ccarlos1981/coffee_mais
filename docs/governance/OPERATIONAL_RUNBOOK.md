# 📖 RUNBOOK OPERACIONAL — GOVERNANÇA E INGESTÃO DE DADOS (COFFEE++)

**Data:** 05/08/2026 | **Versão:** 1.0.0 | **Status:** `OPERATIONAL = ACTIVE`

---

## 1. FLUXO OPERACIONAL DE IMPORTAÇÃO DE ATENDIMENTO/SANKHYA

Todo upload de planilha Excel de atendimento ou sincronização do ERP Sankhya segue o procedimento operacional automatizado:

1. **Origem:** Upload feito pelo usuário na tela `/atendimento` ou envio via API `/api/atendimento/import` ou `/api/supervisor/pdv-import`.
2. **Ingestão:** O backend lê o arquivo, converte em payload JSON e aciona o **Gateway RPC**:
   ```typescript
   const { data, error } = await supabase.rpc("rpc_importar_atendimento_sankhya", {
     p_items: batchPayload,
     p_batch_id: `import_${Date.now()}`,
     p_force_override: false
   });
   ```
3. **Execução no Banco:**
   - A RPC configura a sessão em modo `'IMPORT'`.
   - Insere/Atualiza os registros operacionais na `base_atendimento`.
   - A trigger `sync_base_atendimento_to_cm_clientes` protege os gerentes e canais existentes na SSOT `cm_clientes`.
   - Caso haja divergência, a tentativa é gravada em `cm_audit_commercial_attempts` e a `base_atendimento` é re-alinhada com a SSOT.

---

## 2. COMO DIAGNOSTICAR DIVERGÊNCIAS (ERP × SSOT)

Caso a equipe comercial suspeite que o ERP Sankhya está com gerentes ou canais diferentes do Coffee++:

1. Acesse o SQL Editor do Supabase ou execute a query de diagnóstico:
   ```sql
   SELECT * FROM public.vw_divergencias_cadastro_sankhya ORDER BY ultima_tentativa_sankhya DESC;
   ```
2. A view apresentará lado a lado:
   - `gerente_coffee` (Valor oficial homologado na SSOT)
   - `gerente_sankhya` (Valor recebido da planilha desatualizada do ERP)
   - `canal_coffee` (Canal oficial, ex: KA)
   - `canal_sankhya` (Canal recebido, ex: Outros)

---

## 3. COMO INTERPRETAR A TABELA DE AUDITORIA (`cm_audit_commercial_attempts`)

Para verificar quais alterações o ERP tentou fazer e foram bloqueadas pelo sistema:

```sql
SELECT 
  created_at,
  cod_parceiro,
  nome_parceiro,
  campo_alterado,
  valor_antigo AS oficial_coffee,
  valor_recebido_erp AS rejeitado_erp,
  motivo_bloqueio
FROM public.cm_audit_commercial_attempts
ORDER BY id DESC
LIMIT 50;
```

---

## 4. PROCEDIMENTO DE FORCE OVERRIDE (EXCEÇÃO ADMINISTRATIVA)

Caso a Diretoria Comercial autorize expressamente a atualização em lote de gerentes/canais a partir da planilha do ERP:

1. Chame a RPC habilitando o parâmetro `p_force_override = TRUE`:
   ```sql
   SELECT public.rpc_importar_atendimento_sankhya(
     p_items := '[{"cod_parceiro":"19838","manager":"Novo Gerente","canal":"KA"}]'::jsonb,
     p_batch_id := 'override_manual_autorizado',
     p_force_override := TRUE
   );
   ```
2. A RPC configurará o modo `'FORCE_ERP_OVERRIDE'`, atualizando a SSOT e registrando o override na tabela de auditoria.

---

## 5. COMO EXECUTAR O ROLLBACK OPERACIONAL

Em caso de emergência que exija restaurar a trigger ao estado anterior:

1. Execute a migration de rollback:
   ```sql
   CREATE OR REPLACE FUNCTION public.sync_base_atendimento_to_cm_clientes()
   RETURNS TRIGGER AS $$
   BEGIN
     IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
     -- (Comportamento legado de sync simples)
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```
2. Execute o refresh manual das Materialized Views:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_agg;
   REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_mensal;
   REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_cliente_mensal;
   ```

---

## 6. COMO VALIDAR VERIFY PARITY E HEALTH ANALYTICS

Antes de qualquer deploy em ambiente de produção:

1. **Executar Paridade Financeira**:
   ```bash
   npm run verify:parity
   ```
   *Resultado esperado:* **0,0000% de desvio financeiro** e mensagem `PARIDADE APROVADA`.

2. **Executar Suíte de Saúde Analítica**:
   ```bash
   npm run health:analytics
   ```
   *Resultado esperado:* **15 Aprovados | 0 Falhas**.

3. **Executar Testes de Regressão do Gate 3**:
   ```bash
   npx ts-node -r tsconfig-paths/register -O '{"module":"commonjs"}' scripts/test-gate3-regression.ts
   ```
   *Resultado esperado:* **TODOS OS 6 CENÁRIOS PASSARAM COM 100% DE SUCESSO**.

---

## 7. CHECKLIST OPERACIONAL PÓS-IMPORTAÇÃO

Após a conclusão de uma importação de grande porte:

- [ ] Verificar retorno JSON da RPC (`success: true`, `total_processed > 0`).
- [ ] Checar número de tentativas bloqueadas registradas no log de auditoria.
- [ ] Executar `npm run verify:parity` para confirmar paridade do faturamento.
- [ ] Consultar `vw_clientes_sem_matriz` para garantir que não há parceiros orfãos.
- [ ] Validar a paridade dos cards do Dashboard em relação à `AnalyticsEngine`.
