import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS cm_clientes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      tipo_cadastro TEXT,
      
      -- Identificação
      cnpj TEXT,
      matriz TEXT,
      tipo_parceiro TEXT,
      nome_parceiro TEXT,
      razao_social TEXT,
      inscricao_estadual TEXT,
      cep TEXT,
      endereco TEXT,
      numero TEXT,
      complemento TEXT,
      cidade TEXT,
      
      -- Tipo Negociação
      condicao_pagamento TEXT,
      
      -- Fiscal
      classificacao_icms TEXT,
      retirar_st TEXT,
      
      -- Informações
      empresa_preferencial TEXT,
      tipo_geracao_boleto TEXT,
      
      -- NF-e
      enviar_danfe TEXT,
      email_nfe TEXT,
      
      -- Dados Bancários
      banco TEXT,
      agencia TEXT,
      conta TEXT,
      
      -- Arquivos
      desconto_contratual_url TEXT,
      tabela_preco_url TEXT,
      data_vigor DATE
    );
  `;

  // Workaround: we can't run raw SQL directly with supabase-js unless via an RPC. 
  // Let's create an RPC or just use postgres.
  // Actually, wait, supabase-js doesn't support raw SQL from client.
  console.log("Please run this SQL directly in your Supabase SQL Editor:");
  console.log(query);
}

createTable();
