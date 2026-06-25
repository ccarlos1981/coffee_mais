require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== SIMULATING FATURAMENTO EXCLUDING INVALID TOP CODES ===");
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      WITH sales_enriched AS (
        SELECT 
          COALESCE(
            CASE 
              WHEN f.nome_vendedor = 'AMAZON 1P' THEN 'Amazon 1P'
              WHEN f.nome_vendedor = 'DISTRIBUIDOR' THEN 'Distribuidor'
              WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
              WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') THEN 'Marketplace'
              ELSE b.manager
            END,
            'Outros'
          ) as manager,
          CASE 
            WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_total_liq AS numeric), 0) - COALESCE(CAST(f.vlr_desconto AS numeric), 0))
            ELSE COALESCE(CAST(f.vlr_total_liq AS numeric), 0) - COALESCE(CAST(f.vlr_desconto AS numeric), 0)
          END as net_value,
          CASE 
            WHEN f.cod_top IN ('1200', '1201') THEN -ABS(
              COALESCE(CAST(f.custo_icms AS numeric), 0) + 
              CASE 
                WHEN COALESCE(CAST(f.vlr_total_st AS numeric), 0) >= ABS(COALESCE(CAST(f.vlr_total_liq AS numeric), 0)) THEN 0 
                ELSE COALESCE(CAST(f.vlr_total_st AS numeric), 0) 
              END
            )
            ELSE (
              COALESCE(CAST(f.custo_icms AS numeric), 0) + 
              CASE 
                WHEN COALESCE(CAST(f.vlr_total_st AS numeric), 0) >= ABS(COALESCE(CAST(f.vlr_total_liq AS numeric), 0)) THEN 0 
                ELSE COALESCE(CAST(f.vlr_total_st AS numeric), 0) 
              END
            )
          END as imposto,
          CASE 
            WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.custo_total AS numeric), 0))
            ELSE COALESCE(CAST(f.custo_total AS numeric), 0)
          END as custo_total,
          CASE 
            WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_frete AS numeric), 0))
            ELSE COALESCE(CAST(f.vlr_frete AS numeric), 0)
          END as custo_frete
        FROM cm_faturamento_sankhya f
        LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
        WHERE f.dt_faturamento >= '2026-06-01' AND f.dt_faturamento <= '2026-06-30'
          AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
          AND f.nome_parceiro != 'CAFE UTAM S/A'
          AND f.nome_parceiro != 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'
          AND (
            -- Canais Digitais (Ecommerce e Marketplace) - ONLY VALID CODES (1100, 1200, 1201, 1723)
            (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') 
             AND f.cod_top::numeric IN (1100, 1200, 1201, 1723))
            OR
            -- Canais B2B e outros
            (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI')
             AND f.cod_top::numeric IN (1100, 1200, 1201, 1713)
             AND (b.manager IS NULL OR b.manager NOT IN ('Ecommerce', 'Marketplace')))
          )
      )
      SELECT 
        manager,
        SUM(net_value) as simulated_fat,
        SUM(net_value - imposto - custo_total - custo_frete) as simulated_maco
      FROM sales_enriched
      GROUP BY manager
      ORDER BY simulated_fat DESC
    `
  });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log("Simulated Results by manager:", data);
  const totalFat = data.reduce((acc, curr) => acc + Number(curr.simulated_fat), 0);
  const totalMaco = data.reduce((acc, curr) => acc + Number(curr.simulated_maco), 0);
  console.log("TOTAL SIMULATED FATURAMENTO:", totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  console.log("TOTAL SIMULATED MACO:", totalMaco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
}
run();
