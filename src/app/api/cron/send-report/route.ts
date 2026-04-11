import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

export const runtime = 'nodejs';

// Configuração do FS VFS do PDFMake para rodar no backend
(pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfMake as any).vfs;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function formatBrCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDateBr(dateString: string | null) {
  if (!dateString) return "Primeira Compra";
  const d = new Date(dateString);
  // Neutralize timezone offset to prevent shifting day backwards for UTC midnight dates
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  return d.toLocaleDateString('pt-BR');
}

export async function GET(request: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

    // 1. Validar Variáveis de Email
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json({ success: false, error: "SMTP_USER ou SMTP_PASS faltantes no .env.local" }, { status: 500 });
    }

    // 2. Buscar Destinatários
    const { data: recps, error: recError } = await supabase.from('cm_report_recipients').select('*');
    if (recError) throw recError;
    if (!recps || recps.length === 0) {
      return NextResponse.json({ success: false, message: "Nenhum email cadastrado" });
    }

    // 3. Buscar Dados (Agrupados por Gerente em RPC rápida)
    const { data: sales, error: salesError } = await supabase.rpc('get_last_day_sales');
    if (salesError) throw salesError;

    const baseData = sales || [];
    if (baseData.length === 0) {
       return NextResponse.json({ success: true, message: "Sem vendas recentes para relatar." });
    }

    const diaRefData = baseData[0]?.dia_referencia;
    const diaReferenciaLabel = diaRefData ? formatDateBr(diaRefData) : new Date().toLocaleDateString('pt-BR');

    // Agrupar e Calcular o total do dia e da compra anterior
    const grouped: Record<string, any[]> = {};
    let totalFatTop = 0;
    let totalFatAnterior = 0;
    
    baseData.forEach((sale: any) => {
      const g = sale.manager || 'Sem Gerente';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(sale);
      totalFatTop += Number(sale.fat_dia || 0);
      totalFatAnterior += Number(sale.valor_ultima_compra || 0);
    });
    
    // Calculando a variação percentual
    let percentVariation = 0;
    let percentColor = '#666';
    let percentText = '-';

    if (totalFatAnterior > 0) {
      percentVariation = ((totalFatTop - totalFatAnterior) / totalFatAnterior) * 100;
      if (percentVariation > 0) {
        percentColor = '#047857'; // Verde
        percentText = `+${percentVariation.toFixed(2).replace('.', ',')}% ▲`;
      } else if (percentVariation < 0) {
        percentColor = '#EF4444'; // Vermelho
        percentText = `${percentVariation.toFixed(2).replace('.', ',')}% ▼`;
      } else {
        percentText = `0% -`;
      }
    } else if (totalFatTop > 0 && totalFatAnterior === 0) {
       percentColor = '#047857'; // Verde
       percentText = `+100% ▲`;
    }

    // 4. Montar a Estrutura do PDF Dinamicamente
    const contentBlocks: any[] = [
      { text: 'COFFEE++ MAIS', style: 'headerLogo' },
      { text: 'Relatório Diário de Faturamento', style: 'header' },
      { text: `Data de Referência (Vendas): ${diaReferenciaLabel}`, style: 'subheader', margin: [0, 0, 0, 15] }
    ];

    // Resumo Consolidado
    contentBlocks.push({ text: 'CONSOLIDADO GERAL DA EMPRESA', style: 'managerHeader', alignment: 'center', margin: [0, 5, 0, 5] });
    contentBlocks.push({
       table: {
            widths: ['*', '*', 'auto'],
            body: [
               [{ text: 'Faturado no Dia', style: 'tableHeader', alignment: 'center' }, { text: 'Valor Compra Anterior', style: 'tableHeader', alignment: 'center'}, { text: 'Evolução (%)', style: 'tableHeader', alignment: 'center' }],
               [
                 { text: formatBrCurrency(totalFatTop), style: 'tableFooterCenter', color: '#047857', fontSize: 13 },
                 { text: formatBrCurrency(totalFatAnterior), style: 'tableFooterCenter', color: '#666', fontSize: 13 },
                 { text: percentText, style: 'tableFooterCenter', color: percentColor, fontSize: 13 }
               ]
            ]
       },
       layout: 'lightHorizontalLines',
       margin: [0, 0, 0, 20]
    });

    Object.keys(grouped).sort().forEach(managerName => { // Alfabética por Gerente
       
       contentBlocks.push({ text: `Gerente: ${managerName}`, style: 'managerHeader', margin: [0, 15, 0, 5] });
       
       const tableBody = [
         [
           { text: 'Cliente (Rede)', style: 'tableHeader' }, 
           { text: 'Faturado no Dia', style: 'tableHeader', alignment: 'right' }, 
           { text: 'Última Compra', style: 'tableHeader', alignment: 'center' },
           { text: 'Valor Compra Anterior', style: 'tableHeader', alignment: 'right' }
         ]
       ];

       // Ordenar clientes deste gerente do maior pro menor faturamento
       const managerSales = grouped[managerName].sort((a,b) => Number(b.fat_dia) - Number(a.fat_dia)); 
       let managerTotal = 0;
       let managerCompraAnteriorTotal = 0;

       managerSales.forEach((s: any) => {
          managerTotal += Number(s.fat_dia);
          managerCompraAnteriorTotal += Number(s.valor_ultima_compra || 0);
          tableBody.push([
            { text: s.rede || 'Sem Nome Cadastrado', style: 'cell' } as any,
            { text: formatBrCurrency(Number(s.fat_dia)), style: 'cellValue' } as any,
            { text: formatDateBr(s.ultima_compra_antes), style: 'cellCenter' } as any,
            { text: s.valor_ultima_compra ? formatBrCurrency(Number(s.valor_ultima_compra)) : '-', style: 'cellValue' } as any
          ]);
       });

       // Rodapé com o subtotal do gerente
       tableBody.push([
          { text: 'SUBTOTAL DO GERENTE', style: 'tableFooter' } as any,
          { text: formatBrCurrency(managerTotal), style: 'tableFooterValue' } as any,
          { text: '-', style: 'tableFooterCenter' } as any,
          { text: formatBrCurrency(managerCompraAnteriorTotal), style: 'tableFooterValue' } as any
       ]);

       contentBlocks.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
       });
    });

    const docDefinition: any = {
      watermark: { text: 'COFFEE MAIS', color: '#eaeaea', opacity: 0.3, bold: true, italics: false },
      content: contentBlocks,
      styles: {
        headerLogo: { fontSize: 24, bold: true, color: '#d97706', alignment: 'center', margin: [0, 0, 0, 10] },
        header: { fontSize: 18, bold: true, color: '#333', alignment: 'center' },
        subheader: { fontSize: 12, italics: true, color: '#666', alignment: 'center' },
        managerHeader: { fontSize: 13, bold: true, color: '#b45309', margin: [0, 10, 0, 5] },
        highlight: { fontSize: 14, bold: true, color: '#047857', alignment: 'center' },
        tableHeader: { bold: true, fontSize: 10, color: '#111827', fillColor: '#f3f4f6', margin: [0, 5, 0, 5] },
        tableFooter: { bold: true, fontSize: 10, color: '#111827', fillColor: '#f9fafb', margin: [0, 5, 0, 5] },
        tableFooterValue: { bold: true, fontSize: 10, color: '#047857', fillColor: '#f9fafb', alignment: 'right', margin: [0, 5, 0, 5] },
        tableFooterCenter: { bold: true, fontSize: 10, color: '#111827', fillColor: '#f9fafb', alignment: 'center', margin: [0, 5, 0, 5] },
        cell: { fontSize: 9, margin: [0, 3, 0, 3] },
        cellValue: { fontSize: 9, alignment: 'right', margin: [0, 3, 0, 3] },
        cellCenter: { fontSize: 9, alignment: 'center', margin: [0, 3, 0, 3], color: '#666' }
      }
    };

    // 5. Gerar Buffer do PDF
    console.log("[Send Report] Gerando PDF com pdfMake...");
    const pdfDoc = pdfMake.createPdf(docDefinition);
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout ao gerar PDF (pdfMake travou)")), 20000);
        pdfDoc.getBuffer((buffer: Buffer) => {
             clearTimeout(timeout);
             resolve(buffer);
        });
    });
    console.log("[Send Report] PDF gerado com sucesso, tamanho:", pdfBuffer.length);

    // 6. Transmissão com Nodemailer (Gmail)
    console.log("[Send Report] Conectando ao Gmail SMTP...");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // true para 465, false para outras portas
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // APP Password do Gmail de 16 digitos
      },
      tls: {
          rejectUnauthorized: false
      }
    });

    const emailList = recps.map(r => r.email).join(', ');
    console.log("[Send Report] Disparando email para:", emailList);

    const info = await transporter.sendMail({
      from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
      to: emailList,
      subject: `Venda do dia anterior (${diaReferenciaLabel})`,
      text: "Segue em anexo o relatório diário de faturamento consolidado por gerente.",
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
           <h2 style="color: #d97706; margin-bottom: 0;">Coffee++ Mais</h2>
           <h3 style="color: #333; margin-top: 5px;">Relatório Diário de Faturamento</h3>
           <p>Olá,</p>
           <p>O fechamento de vendas referente ao dia <strong>${diaReferenciaLabel}</strong> foi consolidado e gerou um faturamento de <b style="color: #047857;">${formatBrCurrency(totalFatTop)}</b>.</p>
           <p>Anexamos neste e-mail o documento em PDF contendo a lista detalhada das redes que realizaram compras nesta data, separada e agrupada por Equipe/Gerente. O documento também apresenta a data base da última nota registrada para o respectivo cliente no sistema (para monitoramento de recompra).</p>
           <br/>
           <hr style="border: none; border-top: 1px solid #eee;" />
           <p><small style="color: #999;">Este é um e-mail gerado automaticamente pelas automações Cron da Vercel.<br/>Não é necessário responder.</small></p>
        </div>
      `,
      attachments: [{
          // Nome do Arquivo no Anexo
          filename: `Faturamento_${diaReferenciaLabel.replaceAll('/', '-')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
      }]
    });

    return NextResponse.json({ success: true, message: "Relatório Emitido e Email Enviado!", messageId: info.messageId });
  } catch (error: unknown) {
    console.error("[Disparo PDF] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
