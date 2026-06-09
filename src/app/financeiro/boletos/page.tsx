"use client";

import { useState, useEffect, useMemo } from "react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { 
  PlusIcon, UploadIcon, FileTextIcon, AlertCircleIcon, CheckCircleIcon,
  TrashIcon, Edit2Icon, SaveIcon, XIcon, ChevronLeft, Filter
} from "lucide-react";
import Link from "next/link";
import { importarBoletos, listarBoletos, Boleto, listarRedesDisponiveis, atualizarBoleto } from "./actions";
import { SearchableSelect } from "@/components/SearchableSelect";
import { shortenRedeName } from "@/lib/formatters";

export default function BoletosPage() {
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [redesDisponiveis, setRedesDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  
  const [editBoletoId, setEditBoletoId] = useState<string | null>(null);
  const [editBoletoData, setEditBoletoData] = useState<Partial<Boleto>>({});

  // Form states for manual addition
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualBoleto, setManualBoleto] = useState({
    rede: "",
    numero_boleto: "",
    valor_total: "",
    vencimento: ""
  });

  // Filter states
  const [filterRede, setFilterRede] = useState("");
  const [filterNumeroBoleto, setFilterNumeroBoleto] = useState("");
  const [filterVencimentoDe, setFilterVencimentoDe] = useState("");
  const [filterVencimentoAte, setFilterVencimentoAte] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");

  // Filtering Logic
  const filteredBoletos = useMemo(() => {
    return boletos.filter((boleto) => {
      if (filterRede) {
        const original = boleto.rede.toLowerCase();
        const matriz = shortenRedeName(boleto.rede).toLowerCase();
        const search = filterRede.toLowerCase();
        if (!original.includes(search) && !matriz.includes(search)) {
          return false;
        }
      }
      if (filterNumeroBoleto && !boleto.numero_boleto.toLowerCase().includes(filterNumeroBoleto.toLowerCase())) {
        return false;
      }
      if (filterStatus !== "Todos" && boleto.status !== filterStatus) {
        return false;
      }
      if (boleto.vencimento) {
        const dateStr = String(boleto.vencimento).split("T")[0];
        if (filterVencimentoDe && dateStr < filterVencimentoDe) {
          return false;
        }
        if (filterVencimentoAte && dateStr > filterVencimentoAte) {
          return false;
        }
      } else if (filterVencimentoDe || filterVencimentoAte) {
        return false;
      }
      return true;
    });
  }, [boletos, filterRede, filterNumeroBoleto, filterVencimentoDe, filterVencimentoAte, filterStatus]);

  const fetchBoletos = async () => {
    setLoading(true);
    const [data, redes] = await Promise.all([
      listarBoletos(),
      listarRedesDisponiveis()
    ]);
    setBoletos(data);
    setRedesDisponiveis(redes);
    setLoading(false);
  };

  useEffect(() => {
    fetchBoletos();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setFeedback(null);

    try {
      if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/trade/boletos/importar', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        if (response.ok) {
          setFeedback({ type: "success", msg: data.message });
          fetchBoletos();
        } else {
          throw new Error(data.error || 'Erro na importação.');
        }
      } else {
        // Fallback for old CSV format
        const text = await file.text();
        const lines = text.split('\n');
        
        const newBoletos = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols = line.split(',');
          if (cols.length >= 4) {
            newBoletos.push({
              rede: cols[0].trim(),
              numero_boleto: cols[1].trim(),
              valor_total: parseFloat(cols[2].trim().replace(',', '.')),
              vencimento: cols[3].trim()
            });
          }
        }

        if (newBoletos.length === 0) {
          throw new Error("Nenhum boleto válido encontrado. Formato esperado: Rede,Número,Valor,Vencimento(YYYY-MM-DD)");
        }

        const res = await importarBoletos(newBoletos);
        if (res.success) {
          setFeedback({ type: "success", msg: `${newBoletos.length} boletos importados com sucesso!` });
          fetchBoletos();
        } else {
          throw new Error(res.error);
        }
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao processar arquivo." });
    } finally {
      setImporting(false);
      if (e.target) e.target.value = ''; // reset file input
    }
  };

  const handleAddManual = async () => {
    try {
      if (!manualBoleto.rede || !manualBoleto.numero_boleto || !manualBoleto.valor_total || !manualBoleto.vencimento) {
        setFeedback({ type: "error", msg: "Preencha todos os campos." });
        return;
      }
      setImporting(true);
      const res = await importarBoletos([{
        rede: manualBoleto.rede,
        numero_boleto: manualBoleto.numero_boleto,
        valor_total: parseFloat(manualBoleto.valor_total.replace(',', '.')),
        vencimento: manualBoleto.vencimento
      }]);

      if (res.success) {
        setFeedback({ type: "success", msg: "Boleto adicionado com sucesso!" });
        setShowManualForm(false);
        setManualBoleto({ rede: "", numero_boleto: "", valor_total: "", vencimento: "" });
        fetchBoletos();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao adicionar." });
    } finally {
      setImporting(false);
    }
  };

  const handleEditBoleto = (boleto: Boleto) => {
    setEditBoletoId(boleto.id);
    setEditBoletoData({
      numero_boleto: boleto.numero_boleto,
      valor_total: boleto.valor_total,
      vencimento: boleto.vencimento
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editBoletoData.numero_boleto || !editBoletoData.valor_total || !editBoletoData.vencimento) {
      setFeedback({ type: "error", msg: "Preencha todos os campos do boleto." });
      return;
    }

    setLoading(true);
    const res = await atualizarBoleto(id, {
      numero_boleto: editBoletoData.numero_boleto,
      valor_total: Number(editBoletoData.valor_total),
      vencimento: editBoletoData.vencimento
    });

    if (res.success) {
      setFeedback({ type: "success", msg: "Boleto atualizado com sucesso!" });
      setEditBoletoId(null);
      await fetchBoletos();
    } else {
      setFeedback({ type: "error", msg: "Erro ao atualizar boleto: " + res.error });
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditBoletoId(null);
    setEditBoletoData({});
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-20 md:pb-0">
      <div className="flex w-full h-16 items-center px-4 md:px-6 border-b border-border bg-card sticky top-0 z-50 shadow-sm justify-between">
        <div className="flex items-center gap-4">
          <Link href="/investimento" className="p-2 hover:bg-elevated rounded-full transition-colors" title="Voltar para Investimentos">
            <ChevronLeft className="w-5 h-5 text-muted hover:text-foreground" />
          </Link>
          <h1 className="text-xl font-bold bg-gradient-to-r from-gold to-orange-500 bg-clip-text text-transparent hidden sm:block">
            Módulo Financeiro
          </h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Gestão de Boletos</h2>
            <p className="text-muted text-sm mt-1">Importe a planilha de boletos das redes para o processo de Apuração.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-elevated border border-border rounded-xl text-sm font-medium hover:bg-border transition-colors cursor-pointer">
              <UploadIcon className="w-4 h-4" />
              {importing ? "Importando..." : "Importar Planilha"}
              <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleFileUpload} disabled={importing} />
            </label>
            <button 
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gold hover:bg-yellow-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Adicionar Manual
            </button>
          </div>
        </div>
                {feedback && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
            {feedback.type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <AlertCircleIcon className="w-5 h-5" />}
            <p className="text-sm font-medium">{feedback.msg}</p>
          </div>
        )}

        {showManualForm && (
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Rede</label>
              <SearchableSelect 
                value={manualBoleto.rede} 
                onChange={(val) => setManualBoleto({...manualBoleto, rede: val})} 
                options={redesDisponiveis}
                placeholder="Selecione a Rede..."
                searchPlaceholder="Pesquisar Rede..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Nº do Boleto</label>
              <input type="text" value={manualBoleto.numero_boleto} onChange={e => setManualBoleto({...manualBoleto, numero_boleto: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" placeholder="Ex: 123456789" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Valor (R$)</label>
              <input type="number" step="0.01" value={manualBoleto.valor_total} onChange={e => setManualBoleto({...manualBoleto, valor_total: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" placeholder="Ex: 5000.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Vencimento</label>
              <input type="date" value={manualBoleto.vencimento} onChange={e => setManualBoleto({...manualBoleto, vencimento: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50" />
            </div>
            <button onClick={handleAddManual} disabled={importing} className="w-full bg-foreground text-background py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
              Salvar Boleto
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Filter className="w-4 h-4 text-gold" />
              Filtros
            </h3>
            {(filterRede || filterNumeroBoleto || filterVencimentoDe || filterVencimentoAte || filterStatus !== "Todos") && (
              <button
                onClick={() => {
                  setFilterRede("");
                  setFilterNumeroBoleto("");
                  setFilterVencimentoDe("");
                  setFilterVencimentoAte("");
                  setFilterStatus("Todos");
                }}
                className="text-xs font-semibold text-gold hover:text-yellow-600 transition-colors flex items-center gap-1"
              >
                Limpar Filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* Filtro Rede */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Cliente / Rede</label>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={filterRede}
                onChange={(e) => setFilterRede(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px] text-foreground"
              />
            </div>

            {/* Filtro Número do Boleto */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Número do Boleto</label>
              <input
                type="text"
                placeholder="Buscar número..."
                value={filterNumeroBoleto}
                onChange={(e) => setFilterNumeroBoleto(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px] text-foreground"
              />
            </div>

            {/* Filtro Status */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px] text-foreground"
              >
                <option value="Todos">Todos</option>
                <option value="Aberto">Aberto</option>
                <option value="Abatido">Abatido</option>
                <option value="Pago">Pago</option>
              </select>
            </div>

            {/* Filtro Vencimento De */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Vencimento (De)</label>
              <input
                type="date"
                value={filterVencimentoDe}
                onChange={(e) => setFilterVencimentoDe(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px] text-foreground [color-scheme:dark]"
              />
            </div>

            {/* Filtro Vencimento Até */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Vencimento (Até)</label>
              <input
                type="date"
                value={filterVencimentoAte}
                onChange={(e) => setFilterVencimentoAte(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px] text-foreground [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-elevated border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Rede</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Número Boleto</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Valor</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Vencimento</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted">Carregando boletos...</td>
                  </tr>
                ) : boletos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted">Nenhum boleto importado ainda.</td>
                  </tr>
                ) : filteredBoletos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted">Nenhum boleto encontrado com os filtros selecionados.</td>
                  </tr>
                ) : (
                  filteredBoletos.map((boleto) => {
                    const isEditing = editBoletoId === boleto.id;
                    const matriz = shortenRedeName(boleto.rede);

                    return (
                    <tr key={boleto.id} className="hover:bg-elevated/50 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <div className="flex flex-col">
                          <span>{matriz}</span>
                          {matriz.toUpperCase() !== boleto.rede.toUpperCase() && (
                            <span className="text-[10px] text-muted font-normal block max-w-[250px] truncate" title={boleto.rede}>
                              {boleto.rede}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editBoletoData.numero_boleto || ''} 
                            onChange={(e) => setEditBoletoData({...editBoletoData, numero_boleto: e.target.value})}
                            className="bg-background border border-border rounded px-2 py-1 text-sm w-full max-w-[150px]"
                          />
                        ) : (
                          boleto.numero_boleto
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {isEditing ? (
                          <input 
                            type="number" 
                            step="0.01"
                            value={editBoletoData.valor_total || ''} 
                            onChange={(e) => setEditBoletoData({...editBoletoData, valor_total: Number(e.target.value)})}
                            className="bg-background border border-border rounded px-2 py-1 text-sm w-full max-w-[120px]"
                          />
                        ) : (
                          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(boleto.valor_total)
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted">
                        {isEditing ? (
                          <input 
                            type="date" 
                            value={editBoletoData.vencimento ? String(editBoletoData.vencimento).split('T')[0] : ''} 
                            onChange={(e) => setEditBoletoData({...editBoletoData, vencimento: e.target.value})}
                            className="bg-background border border-border rounded px-2 py-1 text-sm"
                          />
                        ) : (
                          new Date(boleto.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider
                          ${boleto.status === 'Aberto' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                            boleto.status === 'Abatido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                            'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                          {boleto.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleSaveEdit(boleto.id)} className="p-1.5 bg-green-500/10 text-green-600 rounded-md hover:bg-green-500/20 transition-colors" title="Salvar">
                              <SaveIcon className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 bg-red-500/10 text-red-600 rounded-md hover:bg-red-500/20 transition-colors" title="Cancelar">
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => handleEditBoleto(boleto)} className="p-1.5 text-muted hover:text-foreground hover:bg-elevated rounded-md transition-colors" title="Editar Boleto">
                            <Edit2Icon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
