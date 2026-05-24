"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  ArrowLeft, 
  Search, 
  Download, 
  Upload, 
  Users,
  MapPin,
  Building,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";

export default function ClientesListPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLocal, setSearchLocal] = useState("");
  
  // Fake loading for the buttons
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchClientes() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("cm_clientes")
          .select("*")
          .order("created_at", { ascending: false });
          
        if (error) {
          console.error("Erro ao buscar clientes:", error);
          // If table doesn't exist yet, just keep empty array
        } else if (data) {
          setClientes(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchClientes();
  }, [supabase]);

  // Filtro por localização
  const filteredClientes = clientes.filter(cliente => {
    if (!searchLocal.trim()) return true;
    
    const local = `${cliente.cidade || ""} ${cliente.endereco || ""}`.toLowerCase();
    return local.includes(searchLocal.toLowerCase());
  });

  const handleExport = () => {
    setExporting(true);
    
    setTimeout(() => {
      // Logic to build CSV
      const headers = ["CNPJ", "Razão Social", "Matriz", "Tipo Parceiro", "Cidade", "Estado", "Condição Pgto"];
      const rows = filteredClientes.map(c => [
        c.cnpj || "",
        c.razao_social || "",
        c.matriz || "",
        c.tipo_parceiro || "",
        c.cidade?.split("-")[0]?.trim() || "",
        c.cidade?.split("-")[1]?.trim() || "",
        c.condicao_pagamento || ""
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `clientes_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Arquivo exportado com sucesso!");
      setExporting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors font-medium text-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="text-accent-gold" /> 
              Lista de Clientes
            </h1>
            <p className="text-foreground-secondary mt-1">
              Gerencie sua carteira de clientes, pesquise por localização e importe/exporte dados.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => document.getElementById('import-file')?.click()}
              className="flex-1 md:flex-none h-10 px-4 bg-background-elevated border border-border hover:border-accent-gold/50 text-foreground rounded-lg flex items-center justify-center gap-2 transition-all font-semibold text-sm"
            >
              <Upload className="w-4 h-4 text-accent-gold" />
              Importar
            </button>
            <input 
              type="file" 
              id="import-file" 
              className="hidden" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => {
                if(e.target.files?.length) {
                  toast.success(`Arquivo ${e.target.files[0].name} selecionado. (Upload em breve!)`);
                }
              }}
            />
            
            <button
              onClick={handleExport}
              disabled={exporting || filteredClientes.length === 0}
              className="flex-1 md:flex-none h-10 px-4 bg-accent-gold/10 border border-accent-gold/20 hover:bg-accent-gold hover:text-white text-accent-gold rounded-lg flex items-center justify-center gap-2 transition-all font-semibold text-sm disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-background-card border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 shadow-sm">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
              Localização (Cidade / UF)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-dim" />
              <input
                type="text"
                value={searchLocal}
                onChange={(e) => setSearchLocal(e.target.value)}
                placeholder="Ex: São Paulo, Belo Horizonte..."
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
              Busca Rápida
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-dim" />
              <input
                type="text"
                placeholder="Buscar por CNPJ ou Nome..."
                disabled
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm opacity-50 cursor-not-allowed"
                title="Em breve"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-background-elevated border-b border-border text-foreground-secondary text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">CNPJ / Cliente</th>
                  <th className="px-6 py-4">Matriz / Tipo</th>
                  <th className="px-6 py-4">Localização</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-foreground-secondary">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent-gold" />
                      Carregando clientes...
                    </td>
                  </tr>
                ) : filteredClientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-foreground-secondary">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-base font-medium text-foreground">Nenhum cliente encontrado.</p>
                      {searchLocal ? (
                        <p className="text-sm mt-1">Tente mudar sua busca por localização.</p>
                      ) : (
                        <p className="text-sm mt-1">Sua base de dados está vazia ou a tabela ainda não foi criada no banco.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredClientes.map((cliente, idx) => (
                    <tr key={cliente.id || idx} className="hover:bg-background-elevated/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-background border border-border flex items-center justify-center flex-shrink-0">
                            <Building className="w-4 h-4 text-foreground-dim" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{cliente.nome_parceiro || cliente.razao_social || "Sem nome"}</p>
                            <p className="text-xs text-foreground-secondary font-mono mt-0.5">{cliente.cnpj || "Sem CNPJ"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{cliente.matriz || "-"}</p>
                        <p className="text-xs text-foreground-secondary mt-0.5">{cliente.tipo_parceiro || "-"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-foreground-dim" />
                          {cliente.cidade || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          Ativo
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
