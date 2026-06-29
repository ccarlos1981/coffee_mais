import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as xlsx from 'xlsx';

// Helper to convert Excel serial date to JS Date
function excelDateToJSDate(serial: number) {
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  // Using UTC to avoid timezone shifts
  return new Date(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate()).toISOString();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse Excel
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Find the header row dynamically (by looking for 'Nro Nota' ignoring casing/spaces)
    const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const headerIndex = rawRows.findIndex(row => 
      Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'nro nota')
    );
    
    const data: any[] = xlsx.utils.sheet_to_json(sheet, { range: headerIndex !== -1 ? headerIndex : 0 });

    if (data.length === 0) {
      return NextResponse.json({ error: 'A planilha está vazia.' }, { status: 400 });
    }

    // Initialize Supabase Client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }); } catch (error) {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.delete({ name, ...options }); } catch (error) {}
          },
        },
      }
    );

    const rowsToInsert = [];

    for (const row of data) {
      // Data format from spreadsheet inspection:
      // "Nro Nota" -> nro_nota / numero_boleto
      // "Parceiro" -> parceiro_codigo
      // "Nome Parceiro (Parceiro)" -> rede
      // "Vlr do Desdobramento" -> valor_desdobramento
      // "Vlr Desconto" -> valor_desconto
      // "Abatimento" -> abatimento
      // "Valor Líquido" -> valor_liquido / valor_total
      // "Dt. Vencimento" -> vencimento (Serial Date)
      // "Descrição (Tipo de Título)" -> tipo_titulo
      // "Histórico" -> historico
      // "Descrição (Tipo de Operação)" -> tipo_operacao
      // "CNPJ / CPF" -> cnpj_cpf
      // "Dt. Negociação" -> data_negociacao (Serial Date)
      // "Empresa" -> empresa

      // Skip rows that don't have basic required info
      if (!row['Nro Nota'] || !row['Valor Líquido']) continue;

      let vencimento = new Date().toISOString();
      if (typeof row['Dt. Vencimento'] === 'number') {
        vencimento = excelDateToJSDate(row['Dt. Vencimento']);
      } else if (typeof row['Dt. Vencimento'] === 'string') {
        // try to parse as ISO or similar
        vencimento = new Date(row['Dt. Vencimento']).toISOString();
      }

      let data_negociacao = null;
      if (typeof row['Dt. Negociação'] === 'number') {
        data_negociacao = excelDateToJSDate(row['Dt. Negociação']);
      }

      const insertData = {
        numero_boleto: String(row['Nro Nota']),
        nro_nota: String(row['Nro Nota']),
        parceiro_codigo: String(row['Parceiro'] || ''),
        rede: String(row['Nome Parceiro (Parceiro)'] || ''),
        valor_desdobramento: parseFloat(row['Vlr do Desdobramento']) || 0,
        valor_desconto: parseFloat(row['Vlr Desconto']) || 0,
        abatimento: parseFloat(row['Abatimento']) || 0,
        valor_liquido: parseFloat(row['Valor Líquido']) || 0,
        valor_total: parseFloat(row['Valor Líquido']) || 0, // Keep backwards compatibility with cm_boletos required fields
        vencimento: vencimento,
        tipo_titulo: String(row['Descrição (Tipo de Título)'] || ''),
        historico: String(row['Histórico'] || ''),
        tipo_operacao: String(row['Descrição (Tipo de Operação)'] || ''),
        cnpj_cpf: String(row['CNPJ / CPF'] || ''),
        data_negociacao: data_negociacao,
        empresa: String(row['Empresa'] || ''),
        prazo: row['Prazo'] !== undefined && row['Prazo'] !== null ? String(row['Prazo']) : null,
        status: 'Aberto'
      };

      rowsToInsert.push(insertData);
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha válida encontrada na planilha.' }, { status: 400 });
    }

    // Insert in batches of 500 to prevent huge requests
    const batchSize = 500;
    let insertedCount = 0;

    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize);
      
      // Use service role to bypass RLS if there's no active user session, or we can just use normal client.
      // We will use the normal client created above which will have the user's cookies.
      const { data: result, error } = await supabase
        .from('cm_boletos')
        .insert(batch);

      if (error) {
        console.error('Supabase Insert Error:', error);
        return NextResponse.json({ 
          error: `Erro ao inserir boletos: ${error.message}` 
        }, { status: 500 });
      }
      
      insertedCount += batch.length;
    }

    // Update client terms (condições de pagamento) in cm_clientes dynamically based on imported tipo_titulo (Boleto/Transferência)
    try {
      const clientTermsToUpdate: { [key: number]: string } = {};
      for (const row of rowsToInsert) {
        const pCode = parseInt(row.parceiro_codigo, 10);
        if (!isNaN(pCode) && row.tipo_titulo) {
          // Capitalize: "BOLETO" -> "Boleto", "TRANSFERÊNCIA" -> "Transferência"
          let condStr = row.tipo_titulo.trim().toLowerCase();
          condStr = condStr.charAt(0).toUpperCase() + condStr.slice(1);
          clientTermsToUpdate[pCode] = condStr;
        }
      }

      const partnerCodes = Object.keys(clientTermsToUpdate).map(Number);
      if (partnerCodes.length > 0) {
        // Fetch matrix codes for the partners
        const { data: clientsData } = await supabase
          .from('cm_clientes')
          .select('codigo, codigo_matriz')
          .in('codigo', partnerCodes);

        const matrixTermsToUpdate: { [key: string]: string } = {};
        if (clientsData) {
          for (const c of clientsData) {
            if (c.codigo_matriz) {
              const term = clientTermsToUpdate[c.codigo];
              if (term) {
                matrixTermsToUpdate[c.codigo_matriz] = term;
              }
            }
          }
        }

        // Update all clients with the same matrix code
        const matrixPromises = Object.entries(matrixTermsToUpdate).map(async ([matrixCode, prazo]) => {
          return supabase
            .from('cm_clientes')
            .update({ condicao_pagamento: prazo })
            .eq('codigo_matriz', matrixCode);
        });

        // Update direct code as fallback
        const directPromises = Object.entries(clientTermsToUpdate).map(async ([codeStr, prazo]) => {
          const code = parseInt(codeStr, 10);
          return supabase
            .from('cm_clientes')
            .update({ condicao_pagamento: prazo })
            .eq('codigo', code);
        });

        await Promise.all([...matrixPromises, ...directPromises]);
      }
    } catch (clientUpdateError) {
      console.error('Failed to update client payment conditions:', clientUpdateError);
      // We don't fail the entire boleto import if client update fails, just log it.
    }

    return NextResponse.json({ 
      success: true, 
      message: `${insertedCount} boletos importados com sucesso.` 
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
