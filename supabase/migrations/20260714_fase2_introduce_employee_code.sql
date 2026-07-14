-- Migration: 20260714_fase2_introduce_employee_code.sql
-- Description: Fase 2 - Introdução do employee_code (manager_id) e triggers de dupla-escrita

-- 1. Adicionar coluna manager_id nas tabelas críticas
ALTER TABLE public.targets ADD COLUMN IF NOT EXISTS manager_id character varying;
ALTER TABLE public.cm_weekly_projections ADD COLUMN IF NOT EXISTS manager_id character varying;
ALTER TABLE public.network_matrix ADD COLUMN IF NOT EXISTS manager_id character varying;
ALTER TABLE public.base_atendimento ADD COLUMN IF NOT EXISTS manager_id character varying;
ALTER TABLE public.cm_clientes ADD COLUMN IF NOT EXISTS manager_id character varying;
ALTER TABLE public.sales_legacy ADD COLUMN IF NOT EXISTS manager_id character varying;
ALTER TABLE public.cm_trade_calendario_anual ADD COLUMN IF NOT EXISTS manager_id character varying;

-- 2. Criar função auxiliar de mapeamento de nome para employee_code (manager_id)
CREATE OR REPLACE FUNCTION public.fn_get_manager_employee_code(p_name text)
RETURNS text AS $$
BEGIN
  RETURN CASE 
    WHEN p_name IN ('Julliano') THEN '1000'
    WHEN p_name IN ('Leandro', 'Leandro Saffi') THEN '1001'
    WHEN p_name IN ('Luiz') THEN '1002'
    WHEN p_name IN ('Inside Sales') THEN '1004'
    WHEN p_name IN ('Ecommerce') THEN '1005'
    WHEN p_name IN ('Marketplace') THEN '1006'
    WHEN p_name IN ('Distribuidor') THEN '1007'
    WHEN p_name IN ('Amazon 1P', '1p') THEN '1008'
    WHEN p_name IN ('Private Label', 'Marca Própria') THEN '1009'
    WHEN p_name IN ('Luisa') THEN '1010'
    ELSE '9999'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Backfill dos registros existentes
UPDATE public.targets SET manager_id = public.fn_get_manager_employee_code(manager) WHERE manager_id IS NULL;
UPDATE public.cm_weekly_projections SET manager_id = public.fn_get_manager_employee_code(manager) WHERE manager_id IS NULL;
UPDATE public.network_matrix SET manager_id = public.fn_get_manager_employee_code(manager) WHERE manager_id IS NULL;
UPDATE public.base_atendimento SET manager_id = public.fn_get_manager_employee_code(manager) WHERE manager_id IS NULL;
UPDATE public.cm_clientes SET manager_id = public.fn_get_manager_employee_code(responsavel) WHERE manager_id IS NULL;
UPDATE public.sales_legacy SET manager_id = public.fn_get_manager_employee_code(manager) WHERE manager_id IS NULL;
UPDATE public.cm_trade_calendario_anual SET manager_id = public.fn_get_manager_employee_code(gerente) WHERE manager_id IS NULL;

-- 4. Criar função de trigger para dupla escrita (manager_id <=> manager/responsavel/gerente)
CREATE OR REPLACE FUNCTION public.tg_fn_double_write_manager()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'cm_clientes' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.responsavel IS DISTINCT FROM OLD.responsavel THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.responsavel);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.responsavel := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE 'Outros'
        END;
      END IF;
    ELSE
      -- INSERT
      IF NEW.responsavel IS NOT NULL AND NEW.manager_id IS NULL THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.responsavel);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.responsavel IS NULL THEN
        NEW.responsavel := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE 'Outros'
        END;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'cm_trade_calendario_anual' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.gerente IS DISTINCT FROM OLD.gerente THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.gerente);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.gerente := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE 'Outros'
        END;
      END IF;
    ELSE
      -- INSERT
      IF NEW.gerente IS NOT NULL AND NEW.manager_id IS NULL THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.gerente);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.gerente IS NULL THEN
        NEW.gerente := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE 'Outros'
        END;
      END IF;
    END IF;

  ELSE
    -- targets, cm_weekly_projections, network_matrix, base_atendimento, sales_legacy
    IF TG_OP = 'UPDATE' THEN
      IF NEW.manager IS DISTINCT FROM OLD.manager THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.manager := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE 'Outros'
        END;
      END IF;
    ELSE
      -- INSERT
      IF NEW.manager IS NOT NULL AND NEW.manager_id IS NULL THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.manager IS NULL THEN
        NEW.manager := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE 'Outros'
        END;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar triggers de dupla escrita (antes de inserir/atualizar)
DROP TRIGGER IF EXISTS trg_double_write_targets ON public.targets;
CREATE TRIGGER trg_double_write_targets
  BEFORE INSERT OR UPDATE ON public.targets
  FOR EACH ROW EXECUTE FUNCTION public.tg_fn_double_write_manager();

DROP TRIGGER IF EXISTS trg_double_write_projections ON public.cm_weekly_projections;
CREATE TRIGGER trg_double_write_projections
  BEFORE INSERT OR UPDATE ON public.cm_weekly_projections
  FOR EACH ROW EXECUTE FUNCTION public.tg_fn_double_write_manager();

DROP TRIGGER IF EXISTS trg_double_write_network_matrix ON public.network_matrix;
CREATE TRIGGER trg_double_write_network_matrix
  BEFORE INSERT OR UPDATE ON public.network_matrix
  FOR EACH ROW EXECUTE FUNCTION public.tg_fn_double_write_manager();

DROP TRIGGER IF EXISTS trg_double_write_base_atendimento ON public.base_atendimento;
CREATE TRIGGER trg_double_write_base_atendimento
  BEFORE INSERT OR UPDATE ON public.base_atendimento
  FOR EACH ROW EXECUTE FUNCTION public.tg_fn_double_write_manager();

DROP TRIGGER IF EXISTS trg_double_write_cm_clientes ON public.cm_clientes;
CREATE TRIGGER trg_double_write_cm_clientes
  BEFORE INSERT OR UPDATE ON public.cm_clientes
  FOR EACH ROW EXECUTE FUNCTION public.tg_fn_double_write_manager();

DROP TRIGGER IF EXISTS trg_double_write_sales_legacy ON public.sales_legacy;
CREATE TRIGGER trg_double_write_sales_legacy
  BEFORE INSERT OR UPDATE ON public.sales_legacy
  FOR EACH ROW EXECUTE FUNCTION public.tg_fn_double_write_manager();

DROP TRIGGER IF EXISTS trg_double_write_cm_trade_calendario ON public.cm_trade_calendario_anual;
CREATE TRIGGER trg_double_write_cm_trade_calendario
  BEFORE INSERT OR UPDATE ON public.cm_trade_calendario_anual
  FOR EACH ROW EXECUTE FUNCTION public.tg_fn_double_write_manager();

-- 6. Recriar a View public.sales incluindo a coluna manager_id
CREATE OR REPLACE VIEW public.sales AS
 SELECT (s.id)::text AS id,
    s.chave,
    s.invoice_date,
    s.ano,
    s.mes,
    s.dia,
    s.ano_mes,
    s.invoice_number,
    s.unique_number,
    s.cod_parceiro,
    s.cod_produto,
    s.product,
    s.tipo_produto,
    (s.quantity)::numeric AS quantity,
    (s.net_value)::numeric AS net_value,
    (s.vlr_unitario)::numeric AS vlr_unitario,
    (s.imposto)::numeric AS imposto,
    (s.custo_unitario)::numeric AS custo_unitario,
    (s.custo_total)::numeric AS custo_total,
    (s.discount)::numeric AS discount,
    (s.receita_frete)::numeric AS receita_frete,
    (s.custo_frete)::numeric AS custo_frete,
    (s.vlr_frete)::numeric AS vlr_frete,
    (s.vlr_substituicao)::numeric AS vlr_substituicao,
    s.cfop,
    s.seller,
    s.empresa,
    s.payment_type,
    b.nome_parceiro,
    b.rede,
    b.rede_uf AS network_uf,
    b.canal AS channel,
    b.manager,
    b.uf,
    b.regional,
    b.ka,
    (((COALESCE(s.net_value, (0)::double precision) - COALESCE(s.imposto, (0)::double precision)) - COALESCE(s.custo_total, (0)::double precision)))::numeric AS maco,
    b.manager_id AS manager_id
   FROM (public.sales_v2 s
     LEFT JOIN public.base_atendimento b ON ((s.cod_parceiro = b.cod_parceiro)))
  WHERE (s.invoice_date < '2025-01-01'::date)
UNION ALL
 SELECT (f.id)::text AS id,
    ((((f.nro_nota || '|'::text) || f.cod_produto) || '|'::text) || f.cod_parceiro) AS chave,
    f.dt_faturamento AS invoice_date,
    (EXTRACT(year FROM f.dt_faturamento))::integer AS ano,
    (EXTRACT(month FROM f.dt_faturamento))::integer AS mes,
    (EXTRACT(day FROM f.dt_faturamento))::integer AS dia,
    to_char((f.dt_faturamento)::timestamp with time zone, 'YYYY_MM'::text) AS ano_mes,
    f.nro_nota AS invoice_number,
    f.nro_unico AS unique_number,
    f.cod_parceiro,
    f.cod_produto,
    f.desc_produto AS product,
        CASE
            WHEN (upper(f.desc_produto) ~~ '%1KG%'::text) THEN '1 KG'::text
            WHEN ((upper(f.desc_produto) ~~ '%5KG%'::text) OR (upper(f.desc_produto) ~~ '%5 KG%'::text)) THEN '5 KG'::text
            WHEN ((upper(f.desc_produto) ~~ '%CAPSULA%'::text) OR (upper(f.desc_produto) ~~ '%CÁPSULA%'::text)) THEN 'Cápsula'::text
            WHEN (upper(f.desc_produto) ~~ '%DRIP%'::text) THEN 'Drip'::text
            WHEN (upper(f.desc_produto) ~~ '%GEISHA%'::text) THEN 'Geisha'::text
            WHEN (upper(f.desc_produto) ~~ '%VERDE%'::text) THEN 'Café Verde'::text
            WHEN ((upper(f.desc_produto) ~~ '%GRAO%'::text) OR (upper(f.desc_produto) ~~ '%GRÃO%'::text)) THEN 'Grão'::text
            WHEN ((upper(f.desc_produto) ~~ '%MOIDO%'::text) OR (upper(f.desc_produto) ~~ '%MOÍDO%'::text)) THEN 'Moído'::text
            WHEN ((upper(f.desc_produto) ~~ '%ACESSORIO%'::text) OR (upper(f.desc_produto) ~~ '%GARRAFA%'::text) OR (upper(f.desc_produto) ~~ '%CANECA%'::text) OR (upper(f.desc_produto) ~~ '%KIT%'::text)) THEN 'Acessório'::text
            ELSE 'Outros'::text
        END AS tipo_produto,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.quantidade, (0)::numeric)))
            ELSE COALESCE(f.quantidade, (0)::numeric)
        END AS quantity,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, (0)::numeric)))
            ELSE COALESCE(f.vlr_total_liq, (0)::numeric)
        END AS net_value,
    f.vlr_unitario,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs((COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))))
            ELSE (COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))
        END AS imposto,
    (f.custo_total / NULLIF(f.quantidade, (0)::numeric)) AS custo_unitario,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.custo_total, (0)::numeric)))
            ELSE COALESCE(f.custo_total, (0)::numeric)
        END AS custo_total,
    f.vlr_desconto AS discount,
    f.vlr_frete AS receita_frete,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_frete, (0)::numeric)))
            ELSE COALESCE(f.vlr_frete, (0)::numeric)
        END AS custo_frete,
    f.vlr_frete,
    f.vlr_substituicao,
    f.cod_cfop AS cfop,
    f.nome_vendedor AS seller,
    f.nome_vendedor AS empresa,
    f.desc_top AS payment_type,
    f.nome_parceiro,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            ELSE b.rede
        END, f.nome_parceiro, 'Não Mapeado'::text) AS rede,
    b.rede_uf AS network_uf,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            ELSE b.canal
        END, 'Outros'::text) AS channel,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            ELSE b.manager
        END, 'Outros'::text) AS manager,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
            ELSE b.uf
        END, 'SP'::text) AS uf,
    b.uf AS regional,
    b.ka,
    ((
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, (0)::numeric)))
            ELSE COALESCE(f.vlr_total_liq, (0)::numeric)
        END -
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs((COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))))
            ELSE (COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))
        END) -
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.custo_total, (0)::numeric)))
            ELSE COALESCE(f.custo_total, (0)::numeric)
        END) AS maco,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text -- Ecommerce
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN '1006'::text -- Marketplace
            ELSE b.manager_id
        END, '9999'::text) AS manager_id
   FROM (public.cm_faturamento f
     LEFT JOIN public.base_atendimento b ON ((b.cod_parceiro = f.cod_parceiro)))
  WHERE ((f.dt_faturamento IS NOT NULL) AND ((f.status_nfe IS NULL) OR (f.status_nfe <> 'CANCELADA'::text)) AND (f.nome_parceiro <> 'CAFE UTAM S/A'::text) AND (f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text) AND (((f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1723)::numeric, (1117)::numeric, (1703)::numeric]))) OR ((f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1713)::numeric, (1117)::numeric, (1703)::numeric])) AND ((b.manager IS NULL) OR (b.manager <> ALL (ARRAY['Ecommerce'::text, 'Marketplace'::text]))))));
