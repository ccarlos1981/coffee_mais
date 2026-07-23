const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runCommercialAudit() {
  console.log('========================================================================');
  console.log('AUDITORIA COMERCIAL — RECONCILIAÇÃO CANAL x CANAL (JULHO/2026)');
  console.log('========================================================================\n');

  // Query 1: MyMetrics SSOT calculation per client for July 2026 using mv_vendas_agg + cm_clientes
  const { data: mvClients, error: mvErr } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        v.cod_parceiro,
        v.nome_parceiro,
        COALESCE(
          CASE
            WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
            WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
            ELSE c.matriz
          END, v.nome_parceiro, 'Não Mapeado'::text) AS rede_mymetrics,
        COALESCE(
          CASE
            WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
            WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
            ELSE c.responsavel
          END, 'SEM RESPONSÁVEL'::text) AS gerente_mymetrics,
        COALESCE(
          CASE
            WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
            WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
            ELSE c.tipo_parceiro
          END, 'Outros'::text) AS canal_mymetrics,
        c.tipo_parceiro as canal_coffee_mais,
        c.matriz as rede_coffee_mais,
        c.responsavel as gerente_coffee_mais,
        SUM(v.net_value) as fat_mymetrics
      FROM mv_vendas_agg v
      LEFT JOIN cm_clientes c ON c.codigo = v.cod_parceiro::integer
      WHERE v.mes = '2026-07'
        AND NOT (
          v.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])
          AND COALESCE(c.responsavel, 'SEM RESPONSÁVEL'::text) = ANY (ARRAY['Ecommerce'::text, 'Marketplace'::text])
        )
      GROUP BY 
        v.cod_parceiro, v.nome_parceiro, v.nome_vendedor,
        c.tipo_parceiro, c.matriz, c.responsavel
    `
  });

  if (mvErr) {
    console.error('Erro na consulta mv_vendas_agg:', mvErr);
    return;
  }

  // Query 2: Coffee++ raw calculation (using cm_clientes.tipo_parceiro as the direct channel without seller override)
  const { data: coffeeClients, error: coffeeErr } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        f.cod_parceiro,
        f.nome_parceiro,
        COALESCE(c.matriz, f.nome_parceiro) as rede_coffee_mais,
        COALESCE(c.responsavel, 'SEM RESPONSÁVEL') as gerente_coffee_mais,
        COALESCE(c.tipo_parceiro, 'Outros') as canal_coffee_mais,
        SUM(
          CASE WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(f.vlr_total_liq, 0))
               ELSE COALESCE(f.vlr_total_liq, 0)
          END
        ) as fat_coffee_mais
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
      GROUP BY f.cod_parceiro, f.nome_parceiro, c.matriz, c.responsavel, c.tipo_parceiro
    `
  });

  if (coffeeErr) {
    console.error('Erro na consulta cm_faturamento:', coffeeErr);
    return;
  }

  // Query 3: Total cm_clientes database
  const { data: allClientes, error: cliErr } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT codigo, nome_parceiro, matriz, responsavel, tipo_parceiro, status
      FROM cm_clientes
    `
  });

  if (cliErr) {
    console.error('Erro na consulta cm_clientes:', cliErr);
    return;
  }

  console.log(`Registros agregados MyMetrics (Jul/26): ${mvClients.length}`);
  console.log(`Registros agregados Coffee++ (Jul/26): ${coffeeClients.length}`);
  console.log(`Total de clientes no Cadastro Mestre (cm_clientes): ${allClientes.length}\n`);

  // Build partner maps for July 2026
  const mvPartnerMap = new Map();
  mvClients.forEach(r => {
    const cod = String(r.cod_parceiro || '').trim();
    if (!mvPartnerMap.has(cod)) {
      mvPartnerMap.set(cod, {
        cod_parceiro: cod,
        nome_parceiro: r.nome_parceiro,
        rede: r.rede_mymetrics,
        gerente: r.gerente_mymetrics,
        canal_mymetrics: r.canal_mymetrics,
        canal_coffee_mais: r.canal_coffee_mais || 'Outros',
        fat_mymetrics: 0,
        vendedores: new Set()
      });
    }
    const item = mvPartnerMap.get(cod);
    item.fat_mymetrics += Number(r.fat_mymetrics || 0);
  });

  const coffeePartnerMap = new Map();
  coffeeClients.forEach(r => {
    const cod = String(r.cod_parceiro || '').trim();
    if (!coffeePartnerMap.has(cod)) {
      coffeePartnerMap.set(cod, {
        cod_parceiro: cod,
        nome_parceiro: r.nome_parceiro,
        rede: r.rede_coffee_mais,
        gerente: r.gerente_coffee_mais,
        canal_coffee_mais: r.canal_coffee_mais || 'Outros',
        fat_coffee_mais: 0
      });
    }
    const item = coffeePartnerMap.get(cod);
    item.fat_coffee_mais += Number(r.fat_coffee_mais || 0);
  });

  const cliMap = new Map();
  allClientes.forEach(c => {
    cliMap.set(String(c.codigo), c);
  });

  // Standardize target channel names
  const knownChannels = [
    'Key Account',
    'Marketplace',
    'Ecommerce',
    'Inside Sales',
    'Distribuidor',
    'Amazon 1P',
    'Private Label',
    'Outros'
  ];

  // Channel summary
  const summary = {};
  knownChannels.forEach(ch => {
    summary[ch] = {
      channel: ch,
      clientsMyMetrics: new Set(),
      clientsCoffee: new Set(),
      fatMyMetrics: 0,
      fatCoffee: 0
    };
  });

  for (const [cod, p] of mvPartnerMap.entries()) {
    const ch = summary[p.canal_mymetrics] ? p.canal_mymetrics : 'Outros';
    summary[ch].clientsMyMetrics.add(cod);
    summary[ch].fatMyMetrics += p.fat_mymetrics;
  }

  for (const [cod, p] of coffeePartnerMap.entries()) {
    const ch = summary[p.canal_coffee_mais] ? p.canal_coffee_mais : 'Outros';
    summary[ch].clientsCoffee.add(cod);
    summary[ch].fatCoffee += p.fat_coffee_mais;
  }

  // Reconciliation analysis
  const allPartners = new Set([...mvPartnerMap.keys(), ...coffeePartnerMap.keys()]);
  const divergences = [];

  let countSameChannel = 0;
  let countDiffChannel = 0;
  let countOnlyMyMetrics = 0;
  let countOnlyCoffee = 0;

  for (const cod of allPartners) {
    const mv = mvPartnerMap.get(cod);
    const cf = coffeePartnerMap.get(cod);
    const masterCli = cliMap.get(cod);

    const inMv = !!mv;
    const inCf = !!cf;

    const nome = mv?.nome_parceiro || cf?.nome_parceiro || masterCli?.nome_parceiro || 'Desconhecido';
    const rede = mv?.rede || cf?.rede || masterCli?.matriz || 'Desconhecido';
    const gerente = mv?.gerente || cf?.gerente || masterCli?.responsavel || 'SEM RESPONSÁVEL';

    const canalMv = mv?.canal_mymetrics || 'N/A (Sem Venda MyMetrics)';
    const canalCf = masterCli?.tipo_parceiro || cf?.canal_coffee_mais || 'Outros';

    const fatMv = mv?.fat_mymetrics || 0;
    const fatCf = cf?.fat_coffee_mais || 0;
    const diff = fatCf - fatMv;

    if (inMv && inCf) {
      if (canalMv === canalCf) {
        countSameChannel++;
      } else {
        countDiffChannel++;
        divergences.push({
          cod_parceiro: cod,
          nome,
          rede,
          gerente,
          canal_mymetrics: canalMv,
          canal_coffee: canalCf,
          fat_mymetrics: fatMv,
          fat_coffee: fatCf,
          diferenca: diff,
          tipo: 'CANAL_DIFERENTE'
        });
      }
    } else if (inMv && !inCf) {
      countOnlyMyMetrics++;
      divergences.push({
        cod_parceiro: cod,
        nome,
        rede,
        gerente,
        canal_mymetrics: canalMv,
        canal_coffee: canalCf,
        fat_mymetrics: fatMv,
        fat_coffee: 0,
        diferenca: -fatMv,
        tipo: 'APENAS_MYMETRICS'
      });
    } else if (!inMv && inCf) {
      countOnlyCoffee++;
      divergences.push({
        cod_parceiro: cod,
        nome,
        rede,
        gerente,
        canal_mymetrics: canalMv,
        canal_coffee: canalCf,
        fat_mymetrics: 0,
        fat_coffee: fatCf,
        diferenca: fatCf,
        tipo: 'APENAS_COFFEE'
      });
    }
  }

  // Print Summary Table
  console.log('--- RESUMO COMPARATIVO CANAL A CANAL (JULHO/2026) ---');
  const summaryRows = Object.values(summary).map(s => {
    const diff = s.fatCoffee - s.fatMyMetrics;
    return {
      'Canal': s.channel,
      'Qtde Clientes MyMetrics': s.clientsMyMetrics.size,
      'Qtde Clientes Coffee++': s.clientsCoffee.size,
      'Receita MyMetrics (R$)': s.fatMyMetrics.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Receita Coffee++ (R$)': s.fatCoffee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Diferença (R$)': diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    };
  });
  console.table(summaryRows);

  console.log('\n--- ESTATÍSTICAS DE COMPOSIÇÃO DE CLIENTES ---');
  console.log({
    clientes_mesmo_canal_em_ambos: countSameChannel,
    clientes_classificados_em_canais_diferentes: countDiffChannel,
    clientes_existentes_apenas_no_mymetrics: countOnlyMyMetrics,
    clientes_existentes_apenas_no_coffee_mais: countOnlyCoffee,
    total_clientes_com_venda: allPartners.size
  });

  // Display top divergences
  console.log(`\n--- DIVERGÊNCIAS DE CLASSIFICAÇÃO COMERCIAL (${divergences.length} REGISTROS) ---`);
  if (divergences.length > 0) {
    console.table(divergences.slice(0, 50).map(d => ({
      'Código': d.cod_parceiro,
      'Nome Cliente': d.nome.length > 25 ? d.nome.substring(0, 22) + '...' : d.nome,
      'Rede': d.rede.length > 18 ? d.rede.substring(0, 15) + '...' : d.rede,
      'Gerente': d.gerente,
      'Canal MyMetrics': d.canal_mymetrics,
      'Canal Coffee++': d.canal_coffee,
      'Fat MyMetrics': d.fat_mymetrics.toFixed(2),
      'Fat Coffee++': d.fat_coffee.toFixed(2),
      'Impacto R$': d.diferenca.toFixed(2),
      'Tipo': d.tipo
    })));
    if (divergences.length > 50) {
      console.log(`... e mais ${divergences.length - 50} divergências.`);
    }
  }

  // Answer Questions (Item 7)
  const noChannelMaster = allClientes.filter(c => !c.tipo_parceiro || c.tipo_parceiro.trim() === '' || c.tipo_parceiro === 'Outros' || c.tipo_parceiro === 'Não Mapeado');
  const noManagerMaster = allClientes.filter(c => !c.responsavel || c.responsavel.trim() === '' || c.responsavel === 'SEM RESPONSÁVEL' || c.responsavel === 'Não Mapeado');

  // Check network channel inconsistencies
  const networkChannels = {};
  allClientes.forEach(c => {
    if (!c.matriz || c.matriz.trim() === '') return;
    if (!networkChannels[c.matriz]) networkChannels[c.matriz] = new Set();
    if (c.tipo_parceiro) networkChannels[c.matriz].add(c.tipo_parceiro);
  });
  const splitNetworks = Object.entries(networkChannels).filter(([net, set]) => set.size > 1);

  // Check partner multi-channel sales in July 2026
  const partnerChannelsInMv = {};
  mvClients.forEach(r => {
    const k = r.cod_parceiro;
    if (!partnerChannelsInMv[k]) partnerChannelsInMv[k] = new Set();
    partnerChannelsInMv[k].add(r.canal_mymetrics);
  });
  const multiChannelPartnersInMv = Object.entries(partnerChannelsInMv).filter(([k, set]) => set.size > 1);

  console.log('\n========================================================================');
  console.log('RESPOSTAS OBJETIVAS DA AUDITORIA (ITEM 7)');
  console.log('========================================================================');

  console.log(`\n1. Existe algum cliente ou rede que não está sendo classificado no mesmo canal entre os dois sistemas?`);
  console.log(`   -> SIM. Existem ${countDiffChannel} clientes com vendas em Julho/2026 cuja classificação de canal difere entre MyMetrics (regras de vendedor/top) e o Cadastro Mestre Coffee++ (cm_clientes.tipo_parceiro).`);

  console.log(`\n2. Existe algum cliente sem canal?`);
  console.log(`   -> SIM. No Cadastro Mestre (cm_clientes), existem ${noChannelMaster.length} clientes cadastrados sem canal ou com o canal em branco/Outros/Não Mapeado.`);

  console.log(`\n3. Existe algum cliente sem gerente?`);
  console.log(`   -> SIM. No Cadastro Mestre (cm_clientes), existem ${noManagerMaster.length} clientes sem gerente cadastrado (responsavel = 'SEM RESPONSÁVEL' ou nulo).`);

  console.log(`\n4. Existe alguma rede que mudou de canal (ou possui clientes em canais diferentes)?`);
  console.log(`   -> SIM. Existem ${splitNetworks.length} redes no Cadastro Mestre que possuem clientes associados a mais de um canal.`);
  console.log(`      Exemplos:`);
  splitNetworks.slice(0, 10).forEach(([net, set]) => {
    console.log(`      - Rede "${net}": canais [${Array.from(set).join(', ')}]`);
  });

  console.log(`\n5. Existe algum cliente duplicado em canais diferentes?`);
  console.log(`   -> SIM. ${multiChannelPartnersInMv.length} cliente(s) registraram vendas que foram divididas em canais diferentes em Jul/26 devido às regras operacionais de Vendedor (ex: vendas via SHOPIFY/Marketplace vs vendas diretas).`);
  multiChannelPartnersInMv.forEach(([cod, set]) => {
    const cli = cliMap.get(cod);
    console.log(`      - Parceiro #${cod} (${cli ? cli.nome_parceiro : 'N/A'}): canais em Jul/26 = [${Array.from(set).join(', ')}]`);
  });
}

runCommercialAudit().catch(console.error);
