# 🚀 GUIA DE ONBOARDING DE ENGENHARIA — COFFEE++

**Seja bem-vindo à equipe de Engenharia de Software do Coffee++!**

Este documento é a leitura inicial obrigatória para todos os desenvolvedores antes de criar novos componentes, APIs ou migrations.

---

## 1. O CONCEITO DA SINGLE SOURCE OF TRUTH (SSOT)

No Coffee++, **não existe ambiguidade sobre quem manda em qual dado**:

* 💰 **Faturamento e Receita:** Pertencem exclusivamente à tabela física `cm_faturamento`.
* 🏢 **Cadastro Mestre Comercial (Gerente, Canal, Rede):** Pertence exclusivamente à tabela `cm_clientes`.
* 🚚 **Operação de Campo (Promotores/Supervisores):** Pertence à tabela subordinada `base_atendimento`.

> ⚠️ **Regra Fundamental:** `cm_clientes` é o Master Data imune a planilhas antigas. O ERP Sankhya é um alimentador, mas a palavra final sobre quem atende qual cliente é da equipe comercial do Coffee++ em `cm_clientes`.

---

## 2. O GATEWAY RPC DE IMPORTAÇÃO (`rpc_importar_atendimento_sankhya`)

Se você for criar uma nova funcionalidade, tela ou API que receba dados de atendimento, clientes ou planilhas Excel, **VOCÊ É OBRIGADO A USAR A RPC DE BANCO**:

```typescript
// ✅ FORMA CORRETA (Utilizando o Gateway RPC)
const { data, error } = await supabase.rpc("rpc_importar_atendimento_sankhya", {
  p_items: batchOfRows,
  p_batch_id: `my_batch_id`,
  p_force_override: false,
});

// ❌ FORMA PROIBIDA (Lança erro de governança ou quebra o ambiente)
const { error } = await supabase.from("base_atendimento").upsert(batchOfRows);
```

---

## 3. OS 9 GATES DE ENGENHARIA OBRIGATÓRIOS

Nenhum código vai para produção sem passar pelo checklist oficial:

1. **Verify Parity** (`npm run verify:parity`) ➔ 0,0000% de desvio financeiro.
2. **Health Analytics** (`npm run health:analytics`) ➔ 100% de aprovação.
3. **TypeScript** (`npx tsc --noEmit`) ➔ 0 erros de compilação.
4. **Next.js Build** (`npm run build`) ➔ Compilação de produção limpa.
5. **SSOT Regression Test** (`npx ts-node scripts/test-gate3-regression.ts`) ➔ 6 cenários aprovados.
6. **Refresh MVs** ➔ Sequência assíncrona fora de bloco transacional.
7. **Soma Zero** ➔ Redistribuições gerenciais com variação de R$ 0,00.
8. **Dashboard Validation** ➔ Paridade com a AnalyticsEngine.
9. **Single Source of Truth** ➔ Preservação dos isolamentos de domínio.

---

## 4. LINKS E DOCUMENTOS VINCULANTES

Antes de abrir seu primeiro Pull Request, leia com atenção:

* [BASELINE_ARQUITETURAL_v1.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/BASELINE_ARQUITETURAL_v1.md)
* [ENGINEERING_GOVERNANCE.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/ENGINEERING_GOVERNANCE.md)
* [OPERATIONAL_RUNBOOK.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/OPERATIONAL_RUNBOOK.md)
* [DO_NOT_BREAK.md](file:///Users/cristiano/Projetos/Coffe%20Mais/docs/governance/DO_NOT_BREAK.md)
