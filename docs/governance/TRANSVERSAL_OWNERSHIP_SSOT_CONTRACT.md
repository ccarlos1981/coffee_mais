# Manual de Governança Transversal e Contrato de SSOT (Coffee++)

**Documento:** Manual Operacional de Arquitetura e Integridade Sistêmica  
**Status:** HOMOLOGADO & PERMANENTE  
**Data de Publicação:** 24 de Agosto de 2026  
**Referência Arquitetural:** P0-1, P0-2, P0-3, P0-3.1, P0-4, P0-5 e P0-6  

---

## 1. Princípio Fundamental de Arquitetura

> **"Toda informação operacional no Coffee++ possui uma ÚNICA FONTE OFICIAL DE VERDADE (SSOT). Todos os módulos consumidores (dashboards, relatórios, apurações, projeções, rankings e engines) devem obter seus dados exclusivamente a partir dessa fonte. É expressamente proibida a criação de regras paralelas, derivações aritméticas locais ou mapeamentos auxiliares no frontend."**

---

## 2. Mapa Soberano de Fontes de Dados

| Domínio de Negócio | Fonte Soberana (SSOT) | Chave Primária | Consumidores Homologados |
| :--- | :--- | :--- | :--- |
| **Titularidade de Rede** | `public.cm_redes_matrizes` | `codigo` | Cadastro Mestre, Gestão Comercial |
| **Titularidade de Loja / PDV** | `public.cm_clientes` | `codigo` | Cadastro de Clientes, Atendimento |
| **Exceções Regionais (UF)** | `public.cm_base_atendimento_regional` | `cliente_matriz_id` + `estado` | Configuração Multiestado |
| **Regras Especiais KA** | `public.cm_regras_apuracao_comercial` | `matriz_nome` + `uf` | Faturamento e Apuração |
| **Faturamento Oficial** | `public.mv_vendas_mensal` | `cod_parceiro` + `mes` | AnalyticsEngine V1, Vendas, Histórico |
| **Investimentos Comerciais** | `public.v_acoes_investimento_com_gerente` | `id` (Ação) | Investimentos, DRE, Farol, RDM, RPS |
| **Planejamento de Vendas** | `public.vw_redes_planejaveis_oficiais` | `codigo_matriz` + `manager` | Metas por Rede, RPS |
| **Desafio por Rede** | `public.cm_weekly_projections` (`kpi='META'`) | `client_matrix` + `month` | RPS, Gestão de Metas |

---

## 3. Diretrizes de Propagação Automática de Ownership

1. **Origem da Alteração:** Toda mudança de gerente responsável por uma rede deve ocorrer **exclusivamente no Cadastro Mestre** (`cm_redes_matrizes`).
2. **Propagação Segura:** A trigger de banco `tg_sync_cm_redes_matrizes_to_clientes` atualiza as lojas elegíveis em `cm_clientes` e espelha em `base_atendimento`, respeitando integralmente as exceções regionais cadastradas.
3. **Resolução Dinâmica de Investimentos:** A view `v_acoes_investimento_com_gerente` vincula as ações de investimento ao titular vigente da rede/cliente em tempo real.
4. **Sem Edição Manual em Módulos Dependentes:** Nenhum módulo secundário (DRE, Farol, RDM, RPS, Metas, Ranking ou Forecast) deve exigir alteração de código ou edição manual para refletir a nova titularidade.

---

## 4. Classificação e Proteção de Snapshots

### Snapshots Legítimos (Imutáveis por Compliance e Auditoria):
* `cm_campanhas.gerente_id`: Registra o usuário que criou a campanha.
* `cm_acoes_investimento.approved_snapshot` e `approved_by`: Registra o estado dos dados no momento da aprovação comercial.
* `cm_cartas_anuencia.logo_snapshot_path`: Caminho físico da imagem congelada na data de emissão do termo.
* `cm_weekly_projections` (`kpi = 'META'`): Meta fixada administrativamente pela diretoria comercial.

### Snapshots Proibidos:
* Utilizar campos históricos de autoria (`gerente_id`) como se fossem o titular operacional atual da carteira.

---

## 5. Diretrizes para Auditorias Forenses Futuras

Toda futura auditoria de código ou governança deve obrigatoriamente classificar seus achados sob os seguintes critérios formais:

1. **FATO:** Evidência técnica diretamente comprovada no código-fonte ou no banco de dados.
2. **INFERÊNCIA:** Conclusão lógica derivada dos fatos comprovados.
3. **TESTE:** Comportamento operacional executado em ambiente real ou controlado.
4. **SIMULAÇÃO:** Demonstração determinística em modo exclusivamente read-only.
5. **GARANTIA:** Regra física, barreira de código ou trigger que impede regressões de forma definitiva.

### O que auditar explicitamente:
- Consultas SQL diretas em componentes React (`src/app/` e `src/components/`);
- Helpers locais de resolução de gerente (ex: `getManager...`);
- Nomes de gerentes ou códigos fixos (hardcoded);
- Tabelas ou views auxiliares não cadastradas no Registry Oficial da `AnalyticsEngine`;
- Divergências entre RDM, RPS, DRE, Farol e Dashboards.
