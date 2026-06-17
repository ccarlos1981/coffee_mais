"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";

export async function notificarFinanceiroNovoCliente(cliente: any, tipo: "novo" | "atualizacao" = "novo") {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("Variáveis SMTP_USER ou SMTP_PASS não estão configuradas no .env.local.");
      return { success: false, error: "SMTP credentials not found" };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const isUpdate = tipo === "atualizacao";
    const subject = isUpdate 
      ? `[Coffee Mais] Atualização de Cadastro - Cliente #${cliente.codigo || ''}` 
      : `[Coffee Mais] Novo Cadastro de Cliente - #${cliente.codigo || ''}`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1f2937, #111827); padding: 24px; text-align: center; border-bottom: 3px solid #bba16e;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Coffee Mais</h1>
          <p style="color: #bba16e; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">
            ${isUpdate ? 'Atualização Cadastral' : 'Notificação de Novo Cadastro'}
          </p>
        </div>
        
        <!-- Body -->
        <div style="padding: 24px; background-color: #ffffff; color: #374151;">
          <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
            Olá Equipe Financeira,
          </p>
          <p style="font-size: 14px; line-height: 1.6;">
            Informamos que um cadastro de cliente foi <strong>${isUpdate ? 'atualizado' : 'realizado'}</strong> no portal Coffee Mais. Seguem abaixo todos os dados cadastrais do cliente:
          </p>
          
          <!-- Identificação -->
          <div style="margin-top: 24px;">
            <h3 style="color: #bba16e; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">1. Identificação Geral</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; width: 40%;">Código do Cliente:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827; font-family: monospace;">#${cliente.codigo || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">CNPJ:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827; font-family: monospace;">${cliente.cnpj || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Razão Social:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.razao_social || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Nome Fantasia:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.nome_parceiro || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Inscrição Estadual:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.inscricao_estadual || '—'}</td>
              </tr>
            </table>
          </div>

          <!-- Estrutura Comercial -->
          <div style="margin-top: 24px;">
            <h3 style="color: #bba16e; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">2. Estrutura Comercial e Matriz</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; width: 40%;">Matriz / Rede:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.matriz || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Código da Matriz:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827; font-family: monospace;">${cliente.codigo_matriz || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Responsável (Gerente):</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.responsavel || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Canal / Tipo Parceiro:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.tipo_parceiro || '—'}</td>
              </tr>
            </table>
          </div>

          <!-- Localização -->
          <div style="margin-top: 24px;">
            <h3 style="color: #bba16e; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">3. Localização</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; width: 40%;">Endereço:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.endereco || '—'}${cliente.numero ? ', Nº ' + cliente.numero : ''}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Complemento:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.complemento || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Cidade / UF:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.cidade || '—'} / ${cliente.uf || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">CEP:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827; font-family: monospace;">${cliente.cep || '—'}</td>
              </tr>
            </table>
          </div>

          <!-- Negociação & Regras Fiscais -->
          <div style="margin-top: 24px;">
            <h3 style="color: #bba16e; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">4. Negociação e Dados Fiscais</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; width: 40%;">Condição de Pagamento:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.condicao_pagamento || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Classificação ICMS:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.classificacao_icms || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Retirar ST do Preço:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.retirar_st || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Empresa Preferencial:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.empresa_preferencial || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Geração de Boleto:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.tipo_geracao_boleto || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Desconto Contratual:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.desconto_contratual || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Data Vigor:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.data_vigor || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Enviar DANFE p/ E-mail:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.enviar_danfe || 'Não'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">E-mail p/ envio NF-e:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827; font-family: monospace;">${cliente.email_nfe || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Status:</td>
                <td style="padding: 6px 0; font-weight: 700; color: ${cliente.status === 'ativo' ? '#10b981' : '#ef4444'}; text-transform: uppercase;">${cliente.status || 'ativo'}</td>
              </tr>
            </table>
          </div>

          <!-- Dados Bancários -->
          <div style="margin-top: 24px; background-color: #f9fafb; padding: 16px; border-radius: 8px; border: 1px dashed #e5e7eb;">
            <h3 style="color: #bba16e; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 0; margin-bottom: 12px;">5. Dados Bancários</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; width: 40%;">Banco:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827;">${cliente.banco || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Agência:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827; font-family: monospace;">${cliente.agencia || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Conta:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #111827; font-family: monospace;">${cliente.conta || '—'}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">
            Este e-mail foi enviado automaticamente pelo portal Coffee Mais.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Coffee Mais Portal" <${process.env.SMTP_USER}>`,
      to: "financeiro@coffeemais.com",
      subject: subject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`E-mail enviado para o financeiro: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("Erro ao enviar e-mail para o financeiro:", err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function sincronizarClientesSankhya() {
  const supabase = await createClient();

  // 1. Buscar todos os parceiros distintos nas vendas faturadas do Sankhya
  const { data: faturamentoParceiros, error: fatError } = await supabase
    .from("cm_faturamento_sankhya")
    .select("cod_parceiro, nome_parceiro")
    .not("cod_parceiro", "is", null);

  if (fatError) {
    console.error("Erro ao buscar parceiros do faturamento:", fatError);
    throw new Error("Erro ao buscar parceiros do faturamento: " + fatError.message);
  }

  // Deduplicar em memória
  const uniqueFatMap = new Map<string, string>();
  faturamentoParceiros?.forEach(row => {
    if (row.cod_parceiro) {
      uniqueFatMap.set(row.cod_parceiro.trim().replace(/\.0$/, ''), row.nome_parceiro || "");
    }
  });

  // 2. Buscar códigos de clientes que já estão na cm_clientes
  const { data: existingClientes, error: cliError } = await supabase
    .from("cm_clientes")
    .select("codigo");

  if (cliError) {
    console.error("Erro ao buscar clientes cadastrados:", cliError);
    throw new Error("Erro ao buscar clientes cadastrados: " + cliError.message);
  }

  const existingCodesSet = new Set(existingClientes?.map(c => c.codigo) || []);

  // 3. Descobrir códigos de faturamento que não constam no cadastro
  const missingCodes: { codigo: number; nome: string }[] = [];
  for (const [codeStr, name] of uniqueFatMap.entries()) {
    const codeVal = parseInt(codeStr);
    if (!isNaN(codeVal) && !existingCodesSet.has(codeVal)) {
      missingCodes.push({ codigo: codeVal, nome: name });
    }
  }

  if (missingCodes.length === 0) {
    return { success: true, count: 0 };
  }

  // 4. Buscar informações na base_atendimento para autocompletar o cadastro
  const missingCodesStr = missingCodes.map(c => String(c.codigo));
  const { data: bAtendimentoData } = await supabase
    .from("base_atendimento")
    .select("cod_parceiro, cnpj, nome_parceiro, rede, manager, uf, canal, regional, ka")
    .in("cod_parceiro", missingCodesStr);

  const bAtendimentoMap = new Map<string, any>();
  bAtendimentoData?.forEach(row => {
    bAtendimentoMap.set(row.cod_parceiro.trim(), row);
  });

  // 5. Construir registros para inserção
  const insertRecords = missingCodes.map(item => {
    const detail = bAtendimentoMap.get(String(item.codigo));
    return {
      codigo: item.codigo,
      nome_parceiro: item.nome || detail?.nome_parceiro || "Sem nome",
      razao_social: item.nome || detail?.nome_parceiro || "Sem nome",
      cnpj: detail?.cnpj || null,
      matriz: detail?.rede || null,
      tipo_parceiro: detail?.canal || null,
      responsavel: detail?.manager || null,
      uf: detail?.uf || null,
      regional: detail?.regional || null,
      ka: detail?.ka || null,
      status: "ativo"
    };
  });

  // 6. Inserir no Supabase (o trigger do banco se encarregará de sincronizar com base_atendimento)
  const batchSize = 100;
  let successCount = 0;
  for (let i = 0; i < insertRecords.length; i += batchSize) {
    const batch = insertRecords.slice(i, i + batchSize);
    const { error: insertErr } = await supabase
      .from("cm_clientes")
      .insert(batch);

    if (insertErr) {
      console.error("Erro ao inserir lote de novos clientes:", insertErr);
      throw new Error("Erro ao inserir novos clientes: " + insertErr.message);
    }
    successCount += batch.length;
  }

  revalidatePath("/config-financeiro/clientes");
  return { success: true, count: successCount };
}

export async function importarClientesEmLote(records: any[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cm_clientes")
    .upsert(records, { onConflict: 'codigo' });

  if (error) {
    console.error("Erro ao importar clientes em lote:", error);
    throw new Error(`Erro ao importar registros: ${error.message}`);
  }

  revalidatePath("/config-financeiro/clientes");
  return { success: true, count: records.length };
}
