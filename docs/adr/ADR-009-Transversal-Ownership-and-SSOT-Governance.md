# ADR-009: Governança de Ownership Transversal e Contrato SSOT (Single Source of Truth)

**Status**: Aceita / Homologada  
**Data**: 2026-08-24  
**Contexto**: P0-1, P0-2, P0-3, P0-3.1, P0-4, P0-5 e P0-6  
**Baseline**: Seções 10, 13, 14, 15, 16, 55, 57, 59 do AGENTS.md  

---

## 1. Contexto

Historicamente, o ecossistema Coffee++ apresentava assimetrias pontuais de ownership onde o faturamento migrava para o novo gerente da rede após alteração cadastral, mas certas ações de investimento, projeções ou slides executivos permaneciam congelados no autor original da campanha ou em lookups locais de frontend.

A auditoria Nível 3 e as etapas P0-1, P0-2, P0-3.1 e P0-4 estabeleceram a unificação completa e a eliminação definitiva de regras concorrentes de titularidade.

---

## 2. Decisão Arquitetural

Fica estabelecido como princípio fundamental e permanente do Coffee++:

> **"Uma informação operacional deve possuir uma única origem oficial de verdade (SSOT). Qualquer módulo que consuma essa informação deve obtê-la direta ou indiretamente da SSOT oficial. É expressamente proibida a criação de uma segunda regra de negócio ou derivação local para representar a mesma informação."**

### 2.1. Hierarquia Soberana de Ownership Operacional

```
Cadastro Mestre (/admin/cadastro-mestre)
  │
  ▼
cm_redes_matrizes (manager_id, manager) [SSOT da Titularidade de Rede]
  │
  ├──► [Trigger P0-1 tg_sync_cm_redes_matrizes_to_clientes]
  │       │
  │       ▼
  │    cm_clientes (responsavel, manager_id) [SSOT de Lojas e Filiais]
  │       │ (Cláusula NOT EXISTS protege cm_base_atendimento_regional e cm_regras_apuracao_comercial)
  │       │
  │       ├──► base_atendimento (Espelho operacional sincronizado)
  │       ├──► mv_vendas_mensal / mv_vendas_cliente_mensal (Faturamento do novo titular)
  │       └──► vw_redes_planejaveis_oficiais (Planejamento de vendas no titular correto)
  │
  └──► [View P0-2 v_acoes_investimento_com_gerente]
          │
          ▼
       gerente_responsavel (Resolução Dinâmica do Investimento)
          │
          ├──► AnalyticsEngine.getDreComercial() (MACO e Deduções íntegras)
          ├──► Farol Executivo & Relatórios (% Investimento sob o mesmo gerente)
          ├──► RDM Executivo (Slides 1 a 8 integrados)
          ├──► RPS (/processo-comercial/rps)
          ├──► Ranking de Performance de Gerentes (/api/ranking-gerentes)
          └──► Forecast Comercial (/forecast)
```

---

## 3. Contratos Oficiais por Domínio

1. **Redes e Matrizes:** `public.cm_redes_matrizes` é a SSOT primária de redes e titularidade de rede.
2. **Clientes e PDVs:** `public.cm_clientes` é a SSOT física de lojas.
3. **Exceções Regionais e Multiestado:** `cm_base_atendimento_regional` e `cm_regras_apuracao_comercial` são soberanas sobre lojas de estados específicos e não sofrem sobrescrita por alterações globais de rede.
4. **Faturamento Comercial Oficial:** `public.mv_vendas_mensal` e `AnalyticsEngine V1` (LOCKED).
5. **Investimentos Comerciais:** `public.v_acoes_investimento_com_gerente` resolve dinamicamente o `gerente_responsavel`.
6. **Autoria e Auditoria (Snapshots Legítimos):** `cm_campanhas.gerente_id` permanece estritamente como rastreabilidade de autoria/criação, sendo proibido seu uso para determinar titularidade operacional vigente.
7. **RDM, RPS, DRE, Farol, Ranking, Forecast:** Consomem exclusivamente as fontes oficiais homologadas. Proibida a criação de regras ou filtros locais de ownership em componentes React.

---

## 4. Proibição Absoluta de Fallbacks Silenciosos

É terminantemente proibido o uso de:
- Gerentes ou códigos hardcoded em código TypeScript/TSX ou SQL;
- Lookups em tabelas legadas ou não homologadas;
- Helpers locais de frontend para redefinir titularidade;
- Cálculos paralelos de faturamento, MACO ou investimento.

---

## 5. Checklist Obrigatório para Novas Funcionalidades

Antes de iniciar o desenvolvimento de qualquer funcionalidade comercial:
1. Qual é a SSOT oficial do domínio?
2. Qual chave de negócio identifica o registro?
3. Qual método da `AnalyticsEngine` ou view oficial deve ser consumido?
4. Existe regra de ownership já homologada?
5. A nova funcionalidade preserva 100% de paridade com `npm run verify:parity` e `npm run audit:analytics`?

---

## 6. Consequências

### Positivas
- **100% de Consistência Transversal:** Uma alteração no Cadastro Mestre propaga-se automaticamente por todo o sistema sem edição manual em módulos secundários.
- **Segurança de Negócio:** Numerador e denominador de indicadores executivos pertencem sempre ao mesmo gerente.
- **Rastreabilidade e Compliance:** Histórico de auditoria, quitações e autoria de campanhas permanecem imutáveis.

### Negativas / Restrições
- Nenhuma rota ou tela pode adotar atalhos de consulta direta sem validação pela arquitetura canônica.
