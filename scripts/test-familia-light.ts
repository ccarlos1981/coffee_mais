import { createAdminClient } from '@/lib/supabase/admin';
import { OFFICIAL_ANALYTICS_SOURCES } from '@/lib/governance/analytics/sources';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runLightTest() {
  const supabase = createAdminClient();
  const source = OFFICIAL_ANALYTICS_SOURCES.POSITIVACAO_SKU_MENSAL;

  const sqlByFamilia = `
    SELECT 
      COALESCE(tipo_produto, 'Outros') as familia,
      SUM(fat) as fat,
      SUM(qty) as qty,
      COUNT(DISTINCT nome_parceiro) as clientes,
      COUNT(DISTINCT rede) as matrizes,
      COUNT(DISTINCT product) as skus
    FROM ${source}
    WHERE mes >= '2025-06' AND mes <= '2026-06'
    GROUP BY COALESCE(tipo_produto, 'Outros')
    ORDER BY fat DESC
  `;

  console.log("Executing light query on", source);
  const start = Date.now();
  const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sqlByFamilia });
  const duration = Date.now() - start;

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log(`Success! Query executed in ${duration}ms. Rows returned:`, data.length);
    console.log("Data sample:", data);
  }
}

runLightTest();
