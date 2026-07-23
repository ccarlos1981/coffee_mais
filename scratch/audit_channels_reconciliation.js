const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runAudit() {
  console.log('=== INICIANDO AUDITORIA COMERCIAL — RECONCILIAÇÃO CANAL x CANAL (JULHO 2026) ===\n');

  // 1. Fetch sales from mv_vendas_cliente_mensal (MyMetrics SSOT) for 2026-07
  const { data: mvRows, error: mvErr } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        v.nome_parceiro,
        c.codigo as cod_parceiro_cliente,
        c.matriz as rede_cliente,
        v.rede as rede_mv,
        c.responsavel as gerente_cliente,
        v.manager as gerente_mv,
        c.tipo_parceiro as canal_coffee_mais,
        v.channel as canal_mymetrics,
        SUM(v.fat) as fat_mymetrics
      FROM mv_vendas_cliente_mensal v
      LEFT JOIN cm_clientes c ON c.codigo = (
        CASE 
          WHEN v.nome_parceiro SIMILAR TO '[0-9]+%' THEN split_part(v.nome_parceiro, ' ', 1)::integer 
          ELSE NULL 
        END
      )
      WHERE v.mes = '2026-07'
      GROUP BY 
        v.nome_parceiro, c.codigo, c.matriz, v.rede, c.responsavel, v.manager, c.tipo_parceiro, v.channel
    `
  });

  if (mvErr) {
    console.error('Erro ao buscar mv_vendas_cliente_mensal:', mvErr);
    return;
  }

  console.log(`Total de registros agregados no MyMetrics (Julho/2026): ${mvRows.length}`);

  // Also query raw cm_faturamento joined with cm_clientes to see Coffee++ raw attribution
  const { data: rawRows, error: rawErr } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        f.cod_parceiro,
        f.nome_parceiro,
        c.matriz as rede_coffee,
        c.responsavel as gerente_coffee,
        c.tipo_parceiro as canal_coffee,
        f.nome_vendedor,
        f.cod_top,
        SUM(f.vlr_total_liq) as fat_raw
      FROM cm_faturamento f
      LEFT JOIN cm_clientes c ON c.codigo = f.cod_parceiro::integer
      WHERE f.dt_faturamento >= '2026-07-01' AND f.dt_faturamento <= '2026-07-31'
        AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA')
        AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
        AND (
          (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') AND f.cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
          OR
          (f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]) AND f.cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703))
        )
      GROUP BY f.cod_parceiro, f.nome_parceiro, c.matriz, c.responsavel, c.tipo_parceiro, f.nome_vendedor, f.cod_top
    `
  });

  if (rawErr) {
    console.error('Erro ao buscar cm_faturamento:', rawErr);
    return;
  }

  console.log(`Total de grupos brutos no cm_faturamento (Julho/2026): ${rawRows.length}`);
}

runAudit();
