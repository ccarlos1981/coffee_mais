"use client";

import { useState } from "react";
import { FileText, Download, Printer, Loader2 } from "lucide-react";
import { exportMarkdownToPdf, PdfExportOptions } from "@/lib/docs/markdownPdfExporter";

interface ExportPdfButtonProps {
  docPath?: string;
  markdownContent?: string;
  title: string;
  subtitle?: string;
  module: string;
  version?: string;
  baseline?: string;
  status?: string;
  author?: string;
  filename?: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "gold";
  mode?: "download" | "print";
  className?: string;
}

export function ExportPdfButton({
  docPath,
  markdownContent,
  title,
  subtitle,
  module,
  version = "2.0 (Homologado)",
  baseline = "BASELINE CONFIRMED",
  status = "CONFIDENCIAL / OFICIAL",
  author = "Equipe de Engenharia e Governança Coffee++",
  filename,
  label = "📄 Baixar PDF Institucional",
  variant = "gold",
  mode = "download",
  className = "",
}: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);
      let content = markdownContent;

      // Se um caminho de documento foi fornecido e não temos conteúdo direto, buscar via API
      if (!content && docPath) {
        const res = await fetch(`/api/docs/raw?path=${encodeURIComponent(docPath)}`);
        const data = await res.json();

        if (!res.ok || !data.content) {
          alert(`Erro ao carregar o documento: ${data.error || "Não encontrado"}`);
          return;
        }
        content = data.content;
      }

      if (!content) {
        alert("Nenhum conteúdo de documento foi encontrado para exportação.");
        return;
      }

      const options: PdfExportOptions = {
        title,
        subtitle,
        module,
        version,
        baseline,
        status,
        author,
        filename: filename || `${title.toLowerCase().replace(/[\/\s]/g, "_")}.pdf`,
        mode,
      };

      await exportMarkdownToPdf(content, options);
    } catch (err: any) {
      console.error("Erro na geração do PDF:", err);
      alert("Ocorreu uma falha ao gerar o PDF. Verifique o console para detalhes.");
    } finally {
      setLoading(false);
    }
  }

  // Estilos de botões por variante
  let variantStyle = "bg-gold text-black hover:bg-gold/90 border-gold";
  if (variant === "primary") {
    variantStyle = "bg-primary text-primary-foreground hover:bg-primary/90 border-primary";
  } else if (variant === "secondary") {
    variantStyle = "bg-muted text-foreground hover:bg-border border-border";
  } else if (variant === "outline") {
    variantStyle = "bg-transparent border border-border text-foreground hover:bg-muted";
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border ${variantStyle} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>Gerando PDF Institucional...</span>
        </>
      ) : (
        <>
          {mode === "print" ? (
            <Printer className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
