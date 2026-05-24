"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  data: any[];
  filename?: string;
  sheetName?: string;
  variant?: 'outline' | 'primary' | 'subtle';
  className?: string;
}

export function ExportButton({
  data,
  filename = "exportacao",
  sheetName = "Dados",
  variant = "subtle",
  className = ""
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation(); // Previne qualquer bubble de react

    if (!data || data.length === 0) {
      toast.error("Filtro Vazio", {
        description: "Nenhum dado disponível para exportar no filtro atual.",
      });
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading("Gerando arquivo Excel...");

    // Give UI time to update to "Gerando..."
    setTimeout(() => {
      try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        const dateStr = new Date().toISOString().split("T")[0];
        const finalFilename = `${filename}_${dateStr}.xlsx`;

        // Salvar localmente usando ArrayBuffer puro 
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        
        const uri = window.URL.createObjectURL(dataBlob);

        // Bypass NEXT.JS interceptors by adding target=_blank and noopener
        const link = document.createElement('a');
        link.href = uri;
        link.download = finalFilename;
        link.target = "_blank";         // Essencial para o Next.js ignorar o evento
        link.rel = "noopener noreferrer";
        
        document.body.appendChild(link);
        
        // Bloqueia React events
        link.addEventListener('click', (ev) => ev.stopPropagation());
        
        link.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(uri);
        }, 100);

        toast.success("Download Concluído", {
          id: toastId,
          description: `O arquivo ${finalFilename} foi baixado.`,
        });

      } catch (error) {
        console.error("Erro ao exportar:", error);
        toast.error("Falha ao gerar o Excel", { id: toastId });
      } finally {
        setIsExporting(false);
      }
    }, 50);
  };

  // Base styles
  let btnClasses = "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border";
  
  if (variant === 'primary') {
    btnClasses += " bg-[#D4A373] text-white border-transparent hover:bg-opacity-90";
  } else if (variant === 'outline') {
    btnClasses += " bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50";
  } else {
    // subtle
    btnClasses += " bg-white text-gray-600 border-gray-200 shadow-sm hover:bg-gray-50 hover:text-gray-900";
  }

  return (
    <button 
      onClick={handleExport} 
      className={`${btnClasses} ${className} ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`} 
      title="Baixar os dados em visualização como Excel"
      disabled={isExporting}
    >
      <FileSpreadsheet className={`w-4 h-4 ${isExporting ? 'text-gray-500 animate-pulse' : 'text-green-600'}`} />
      <span>{isExporting ? "Criando Excel..." : "📊 Baixar Planilha"}</span>
    </button>
  );
}
