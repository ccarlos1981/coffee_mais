# Master Data: Conversão Logística (Unidades, Caixas e Quilos)

Este documento define a especificação técnica e de arquitetura do **Cadastro Mestre de Conversão Logística** da plataforma Coffee Mais, estabelecido como o padrão arquitetural oficial do projeto Coffee++ para cadastros mestres compartilhados.

---

## 1. Diretrizes da Camada de Master Data

* **Fonte Única de Verdade**: O `ProdutoConversaoService` centraliza todas as operações matemáticas de conversão física. É expressamente proibido duplicar fórmulas ou manter fatores fixos de conversão em qualquer outra parte do código do sistema.
* **Unidade Canônica**: A unidade base oficial de armazenamento de todo o sistema é a **UNIDADE (UN)**. Caixas, pesos (Kg) e pallets são dados derivados calculados em tempo de execução.
* **Controle Rígido de Erros**: Não há fallbacks silenciosos. Se um produto não possuir fator cadastrado ou ativo para o período atual, a operação será abortada lançando um erro controlado para evitar discrepâncias em indicadores comerciais e de BI.
* **Preservação de Histórico**: É proibido realizar deleções físicas de registros de conversão. Ajustes e atualizações devem ser feitos desativando o registro atual (`ativo = false`) ou parametrizando uma data limite na vigência (`vigencia_fim`) e criando um novo registro.

---

## 2. Modelo de Banco de Dados

### Tabela: `public.cm_skus_conversao`
Tabela mestre contendo o histórico logístico e atributos de embalagem de cada produto:

```sql
CREATE TABLE public.cm_skus_conversao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    codigo_integracao VARCHAR(100), -- Código SKU/ERP
    peso_embalagem_kg NUMERIC(10, 4) NOT NULL CHECK (peso_embalagem_kg > 0),
    unidades_por_caixa INTEGER NOT NULL DEFAULT 1 CHECK (unidades_por_caixa > 0),
    
    -- Período de Vigência
    vigencia_inicio DATE,
    vigencia_fim DATE,
    
    -- Auditoria
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    observacao TEXT,
    motivo_alteracao TEXT,
    
    -- Evolução Futura
    unidade_medida VARCHAR(20) DEFAULT 'UN',
    caixas_por_pallet INTEGER,
    weight_pallet_kg NUMERIC(10, 4),
    
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### Gatilho de Integridade (Trigger): `check_cm_skus_conversao_overlap`
Trigger PL/pgSQL que impede programaticamente a inserção de vigências sobrepostas para o mesmo produto (apenas para registros ativos):

```sql
CREATE OR REPLACE TRIGGER trg_cm_skus_conversao_overlap
BEFORE INSERT OR UPDATE ON public.cm_skus_conversao
FOR EACH ROW EXECUTE FUNCTION public.check_cm_skus_conversao_overlap();
```

### View Relacional: `public.v_produtos_detalhes`
View destinada a telas, relatórios, BI e consultas de histórico de alteração de embalagem:

```sql
CREATE OR REPLACE VIEW public.v_produtos_detalhes AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.line AS product_line,
    p.type AS product_type,
    p.weight AS product_weight_desc,
    p.active AS product_active,
    c.id AS conversao_id,
    c.codigo_integracao,
    COALESCE(c.peso_embalagem_kg, 0) AS peso_embalagem_kg,
    COALESCE(c.unidades_por_caixa, 1) AS unidades_por_caixa,
    COALESCE(c.peso_embalagem_kg * c.unidades_por_caixa, 0) AS peso_total_caixa_kg,
    c.unidade_medida,
    c.caixas_por_pallet,
    c.weight_pallet_kg AS peso_pallet_kg,
    c.vigencia_inicio,
    c.vigencia_fim,
    c.observacao,
    c.motivo_alteracao,
    COALESCE(c.ativo, false) AS conversao_ativa
FROM public.products p
LEFT JOIN public.cm_skus_conversao c ON p.id = c.product_id;
```

---

## 3. ProdutoConversaoService

O serviço está implementado em `src/lib/services/produto-conversao-service.ts`.

### Otimização e Comportamento do Cache Local (TTL)
* O serviço implementa cache local estático em memória com tempo de expiração (TTL) de **5 minutos** (`TTL_MS = 300000`).
* **Nota de Arquitetura Serverless**: O cache estático em memória é local ao processo. Runtimes de função serverless (Vercel) podem recriar a instância do container a qualquer momento. Não trate este cache como distribuído ou compartilhado entre threads.
* O cache pode ser invalidado manualmente chamando `ProdutoConversaoService.limparCache()`.

### Métodos Disponibilizados

| Assinatura do Método | Entrada | Retorno | Descrição |
| :--- | :--- | :--- | :--- |
| `unidadesParaCaixas(productId, unidades)` | `(number, number)` | `number` | Converte unidades físicas em caixas. |
| `caixasParaUnidades(productId, caixas)` | `(number, number)` | `number` | Converte caixas em unidades físicas. |
| `kgParaCaixas(productId, kg)` | `(number, number)` | `number` | Converte peso em Kg para número de caixas. |
| `caixasParaKg(productId, caixas)` | `(number, number)` | `number` | Converte caixas em peso total em Kg. |
| `unidadesParaKg(productId, unidades)` | `(number, number)` | `number` | Converte unidades físicas em peso Kg. |
| `kgParaUnidades(productId, kg)` | `(number, number)` | `number` | Converte peso em Kg para unidades físicas. |

### Exemplo de Uso
```typescript
import { createClient } from "@/lib/supabase/server";
import { ProdutoConversaoService } from "@/lib/services/produto-conversao-service";

async function processarMetaVendas(productId: number, unidadesMeta: number) {
  const supabase = await createClient();
  
  // Inicializa o serviço carregando/usando cache dos fatores de conversão
  const conversaoService = await ProdutoConversaoService.init(supabase);
  
  try {
    const caixas = conversaoService.unidadesParaCaixas(productId, unidadesMeta);
    const kg = conversaoService.unidadesParaKg(productId, unidadesMeta);
    
    console.log(`Caixas: ${caixas}, Peso: ${kg} kg`);
  } catch (error) {
    // Tratamento obrigatório: erro controlado caso o produto não possua vigência ativa
    console.error("Erro na conversão logística:", error.message);
  }
}
```

---

## 4. Módulos Consumidores e Responsabilidades
* **Módulo Promotor**: Abastecimentos e coletas em unidades no PDV são convertidos para caixas/quilos em relatórios gerenciais de supervisor.
* **Módulo Faturamento**: Notas recebidas em caixas/quilos são convertidas para unidades físicas para cruzamento de estoque.
* **Módulo Investimentos**: Importação de planejamentos e volume planejado expressos em caixas ou quilos são unificados via serviço.
* **KPIs & Dashboards**: Atingimento de metas de volume (expresso em caixas ou toneladas) convertido em tempo real a partir de vendas físicas unitárias.

---

## 5. Boas Práticas para Futuros Cadastros Mestres (Coffee++)

Toda nova entidade classificada como Master Data (ex: Cadastro de Clientes, Regras tributárias, SLA de Rotas, Metas corporativas) deve adotar este padrão:
1. **Banco de Dados Centralizado**: Tabelas de histórico e vigência exclusivas, com gatilhos (`triggers`) de integridade temporal no banco de dados.
2. **Serviço de Domínio Compartilhado**: Serviço puro isolado da camada de transporte (HTTP/Server Action), tipado de forma estrita, sem dependências client-side.
3. **Cache Inteligente**: Otimizações locais com tempos de expiração rápidos (TTL de 5 min) e controle manual de invalidação para evitar sobrecarga do banco sem quebrar a reatividade.
4. **Roadmap Administrativo**: Planejar desde o início painéis na interface administrativa para alteração e validação cadastral visual, eliminando execuções manuais de queries de inserção no console.
