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

    // 3. Buscar Dados (Matrizes que afundaram)
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let { data: alerts } = await supabase
        .from('cm_client_alerts')
        .select('*')
        .eq('alert_month', currentMonth);

    alerts = alerts || [];
    alerts.sort((a, b) => (b.fat_previous - b.fat_current) - (a.fat_previous - a.fat_current));
    const top10 = alerts.slice(0, 50); // Manda ate os top 50
    const totalRuptura = top10.reduce((acc, a) => acc + (a.fat_previous - a.fat_current), 0);

    // 4. Montar o PDF (pdfmake)
    const tableBody = [
      [{ text: 'Cliente (Matriz)', style: 'tableHeader' }, { text: 'Gerente', style: 'tableHeader' }, { text: 'Mês Passado', style: 'tableHeader' }, { text: 'Atual', style: 'tableHeader' }, { text: 'Queda %', style: 'tableHeader' }, { text: 'GAP Financeiro', style: 'tableHeader' }]
    ];

    top10.forEach(al => {
       tableBody.push([
         { text: al.client_name, style: 'cell' },
         { text: al.manager, style: 'cell' },
         { text: formatBrCurrency(al.fat_previous), style: 'cell' },
         { text: formatBrCurrency(al.fat_current), style: 'cell' },
         { text: `-${al.drop_pct.toFixed(1)}%`, style: 'cellDanger' },
         { text: `-${formatBrCurrency(al.fat_previous - al.fat_current)}`, style: 'cellDangerBold' }
       ]);
    });

    const docDefinition: any = {
      watermark: { text: 'CONFIDENCIAL — COFFEE MAIS', color: 'red', opacity: 0.1, bold: true, italics: false },
      content: [
        { text: 'Coffee Mais - Relatório Executivo', style: 'header' },
        { text: `Data do Relatório: ${now.toLocaleDateString('pt-BR')}`, style: 'subheader' },
        { text: '\nResumo Consolidado de Rupturas de Rede (Mês Atual)', style: 'section' },
        { text: `Total Ameaçado neste período: ${formatBrCurrency(totalRuptura)}\n\n`, style: 'highlight' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: {
        header: { fontSize: 22, bold: true, color: '#d97706' },
        subheader: { fontSize: 12, italics: true, color: '#666' },
        section: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        highlight: { fontSize: 12, bold: true, color: '#ef4444' },
        tableHeader: { bold: true, fontSize: 10, color: '#333' },
        cell: { fontSize: 9 },
        cellDanger: { fontSize: 9, color: '#ef4444' },
        cellDangerBold: { fontSize: 9, bold: true, color: '#ef4444' }
      }
    };

    // 5. Gerar Buffer do PDF
    console.log("[Send Report] Gerando PDF com pdfMake...");
    const pdfDoc = pdfMake.createPdf(docDefinition);
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout ao gerar PDF (pdfMake travou)")), 15000);
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
        pass: process.env.SMTP_PASS, // Tem que ser APP Password de 16 digitos e não a senha de login real
      },
      tls: {
          rejectUnauthorized: false
      }
    });

    const emailList = recps.map(r => r.email).join(', ');
    console.log("[Send Report] Disparando email para:", emailList);

    const info = await transporter.sendMail({
      from: `"Coffee Mais AI" <${process.env.SMTP_USER}>`,
      to: emailList,
      subject: `🚨 [CEO Report] Rupturas Coffee Mais - ${now.toLocaleDateString()}`,
      text: "Enviado de forma automática via Coffee Mais Smart Hub.",
      html: `
        <div style="font-family: sans-serif; color: #333">
           <h2>Resumo Executivo de Faturamento</h2>
           <p>Bom dia. Anexo a este e-mail, encontra-se o <strong>Relatório Confidencial</strong> contendo as matrizes que alertaram quedas superiores a 30% em relação ao mês anterior.</p>
           <p>Total em R$ mapeado sob GAP grave no período: <b>${formatBrCurrency(totalRuptura)}</b></p>
           <br/>
           <p><small>Este e-mail é gerado automaticamente. As equipes de campo já estão atuando sob os mesmos alarmes no módulo Mobile.</small></p>
        </div>
      `,
      attachments: [{
          filename: `Report_CEO_${now.getTime()}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
      }]
    });

    return NextResponse.json({ success: true, message: "PDF Transmitido!", messageId: info.messageId });
  } catch (error: unknown) {
    console.error("[Disparo PDF] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
