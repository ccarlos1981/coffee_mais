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
import { supabase } from "@/lib/supabase";

export default function BoletosPage() {
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [redesDisponiveis, setRedesDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  
  const [editBoletoId, setEditBoletoId] = useState<string | null>(null);
  const [editBoletoData, setEditBoletoData] = useState<Partial<Boleto>>({});
  const [userRole, setUserRole] = useState<string | null>(null);

  // Form states for manual addition
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualBoleto, setManualBoleto] = useState({
    rede: "",
    numero_boleto: "",
    valor_total: "",
    vencimento: "",
    parceiro_codigo: "",
    tipo_titulo: "BOLETO",
    valor_liquido: ""
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
        const code = (boleto.parceiro_codigo || "").toLowerCase();
        const search = filterRede.toLowerCase();
        if (!original.includes(search) && !matriz.includes(search) && !code.includes(search)) {
          return false;
        }
      }
      if (filterNumeroBoleto) {
        const numero = boleto.numero_boleto.toLowerCase();
        const nota = (boleto.nro_nota || "").toLowerCase();
        const search = filterNumeroBoleto.toLowerCase();
        if (!numero.includes(search) && !nota.includes(search)) {
          return false;
        }
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
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('cm_user_profiles').select('role').eq('id', user.id).single();
        if (data) setUserRole(data.role);
      }
    };
    fetchUserRole();
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

        // Helper to parse CSV line respecting quotes
        const parseCSVLine = (lineText: string): string[] => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < lineText.length; i++) {
            const char = lineText[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          return result;
        };

        // Helper to parse currency values in Brazilian (1.500,00) or US (1,500.00) format
        const parseCurrency = (valStr: string): number => {
          let cleaned = valStr.trim().replace(/^["']|["']$/g, '');
          const lastComma = cleaned.lastIndexOf(',');
          const lastDot = cleaned.lastIndexOf('.');
          if (lastComma > lastDot) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          } else if (lastDot > lastComma) {
            cleaned = cleaned.replace(/,/g, '');
          } else if (lastComma !== -1) {
            cleaned = cleaned.replace(',', '.');
          }
          return parseFloat(cleaned) || 0;
        };
        
        const newBoletos = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols = parseCSVLine(line);
          if (cols.length >= 4) {
            newBoletos.push({
              rede: cols[0].trim().replace(/^["']|["']$/g, ''),
              numero_boleto: cols[1].trim().replace(/^["']|["']$/g, ''),
              valor_total: parseCurrency(cols[2]),
              vencimento: cols[3].trim().replace(/^["']|["']$/g, '')
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
      if (!manualBoleto.rede || !manualBoleto.numero_boleto || !manualBoleto.valor_liquido || !manualBoleto.vencimento) {
        setFeedback({ type: "error", msg: "Preencha Parceiro, Nr da nota, Valor Líquido e Vencimento." });
        return;
      }
      setImporting(true);
      const val = parseFloat(manualBoleto.valor_liquido.replace(',', '.'));
      const res = await importarBoletos([{
        rede: manualBoleto.rede,
        numero_boleto: manualBoleto.numero_boleto,
        valor_total: val,
        vencimento: manualBoleto.vencimento,
        nro_nota: manualBoleto.numero_boleto,
        parceiro_codigo: manualBoleto.parceiro_codigo,
        valor_liquido: val,
        tipo_titulo: manualBoleto.tipo_titulo || "BOLETO",
      }]);

      if (res.success) {
        setFeedback({ type: "success", msg: "Boleto adicionado com sucesso!" });
        setShowManualForm(false);
        setManualBoleto({ rede: "", numero_boleto: "", valor_total: "", vencimento: "", parceiro_codigo: "", tipo_titulo: "BOLETO", valor_liquido: "" });
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
      vencimento: boleto.vencimento,
      nro_nota: boleto.nro_nota,
      parceiro_codigo: boleto.parceiro_codigo,
      valor_liquido: boleto.valor_liquido,
      tipo_titulo: boleto.tipo_titulo,
      rede: boleto.rede,
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editBoletoData.numero_boleto || !editBoletoData.vencimento) {
      setFeedback({ type: "error", msg: "Preencha o número do boleto e o vencimento." });
      return;
    }

    setLoading(true);
    const valTotal = editBoletoData.valor_total !== undefined ? Number(editBoletoData.valor_total) : 0;
    const valLiq = editBoletoData.valor_liquido !== undefined ? Number(editBoletoData.valor_liquido) : valTotal;

    const res = await atualizarBoleto(id, {
      numero_boleto: editBoletoData.numero_boleto,
      valor_total: valLiq || valTotal,
      vencimento: editBoletoData.vencimento,
      nro_nota: editBoletoData.nro_nota || editBoletoData.numero_boleto,
      parceiro_codigo: editBoletoData.parceiro_codigo,
      valor_liquido: valLiq,
      tipo_titulo: editBoletoData.tipo_titulo,
      rede: editBoletoData.rede,
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
          {(userRole === 'Admin' || userRole === 'Financeiro') && (
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
          )}
        </div>
                {feedback && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
            {feedback.type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <AlertCircleIcon className="w-5 h-5" />}
            <p className="text-sm font-medium">{feedback.msg}</p>
          </div>
        )}

        {showManualForm && (userRole === 'Admin' || userRole === 'Financeiro') && (
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Nome do Parceiro</label>
              <SearchableSelect 
                value={manualBoleto.rede} 
                onChange={(val) => setManualBoleto({...manualBoleto, rede: val})} 
                options={redesDisponiveis}
                placeholder="Selecione..."
                searchPlaceholder="Pesquisar..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Cód. Parceiro</label>
              <input type="text" value={manualBoleto.parceiro_codigo} onChange={e => setManualBoleto({...manualBoleto, parceiro_codigo: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px]" placeholder="Ex: 24554" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Nr da nota</label>
              <input type="text" value={manualBoleto.numero_boleto} onChange={e => setManualBoleto({...manualBoleto, numero_boleto: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px]" placeholder="Ex: 19839" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Descrição</label>
              <input type="text" value={manualBoleto.tipo_titulo} onChange={e => setManualBoleto({...manualBoleto, tipo_titulo: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px]" placeholder="Ex: BOLETO" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Valor Líquido (R$)</label>
              <input type="text" value={manualBoleto.valor_liquido} onChange={e => setManualBoleto({...manualBoleto, valor_liquido: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px]" placeholder="Ex: 1428.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Vencimento</label>
              <input type="date" value={manualBoleto.vencimento} onChange={e => setManualBoleto({...manualBoleto, vencimento: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 h-[38px] [color-scheme:dark]" />
            </div>
            <button onClick={handleAddManual} disabled={importing} className="w-full md:col-span-6 bg-foreground text-background py-2.5 rounded-xl text-sm font-black uppercase hover:opacity-90 transition-opacity mt-2">
              Salvar Novo Boleto
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
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Nr da nota</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Parceiro</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Nome do parceiro</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Data de vencimento</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Descrição</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase text-right">Valor Líquido</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 font-semibold text-muted text-xs tracking-wider uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted">Carregando boletos...</td>
                  </tr>
                ) : boletos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted">Nenhum boleto importado ainda.</td>
                  </tr>
                ) : filteredBoletos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted">Nenhum boleto encontrado com os filtros selecionados.</td>
                  </tr>
                ) : (
                  filteredBoletos.map((boleto) => {
                    const isEditing = editBoletoId === boleto.id;
                    const matriz = shortenRedeName(boleto.rede);

                    return (
                    <tr key={boleto.id} className="hover:bg-elevated/50 transition-colors">
                      {/* Nr da nota */}
                      <td className="px-6 py-4 font-mono text-muted text-[13px]">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editBoletoData.numero_boleto || ''} 
                            onChange={(e) => setEditBoletoData({...editBoletoData, numero_boleto: e.target.value, nro_nota: e.target.value})}
                            className="bg-background border border-border rounded px-2 py-1 text-sm w-full max-w-[120px]"
                          />
                        ) : (
                          boleto.nro_nota || boleto.numero_boleto
                        )}
                      </td>

                      {/* Parceiro */}
                      <td className="px-6 py-4 font-mono text-muted text-[13px]">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editBoletoData.parceiro_codigo || ''} 
                            onChange={(e) => setEditBoletoData({...editBoletoData, parceiro_codigo: e.target.value})}
                            className="bg-background border border-border rounded px-2 py-1 text-sm w-full max-w-[100px]"
                          />
                        ) : (
                          boleto.parceiro_codigo || '-'
                        )}
                      </td>

                      {/* Nome do parceiro */}
                      <td className="px-6 py-4 font-medium">
                        {isEditing ? (
                          <SearchableSelect 
                            value={editBoletoData.rede || ''} 
                            onChange={(val) => setEditBoletoData({...editBoletoData, rede: val})} 
                            options={redesDisponiveis}
                            placeholder="Selecione a Rede..."
                            searchPlaceholder="Pesquisar..."
                            className="w-full bg-background border border-border rounded px-2 py-1 text-sm max-w-[200px]"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span>{matriz}</span>
                            {matriz.toUpperCase() !== boleto.rede.toUpperCase() && (
                              <span className="text-[10px] text-muted font-normal block max-w-[250px] truncate" title={boleto.rede}>
                                {boleto.rede}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Data de vencimento */}
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

                      {/* Descrição (Tipo de Título) */}
                      <td className="px-6 py-4 text-muted text-xs uppercase tracking-wider font-semibold">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editBoletoData.tipo_titulo || ''} 
                            onChange={(e) => setEditBoletoData({...editBoletoData, tipo_titulo: e.target.value})}
                            className="bg-background border border-border rounded px-2 py-1 text-sm w-full max-w-[120px]"
                          />
                        ) : (
                          boleto.tipo_titulo || 'BOLETO'
                        )}
                      </td>

                      {/* Valor Líquido */}
                      <td className="px-6 py-4 font-black text-right text-foreground">
                        {isEditing ? (
                          <input 
                            type="number" 
                            step="0.01"
                            value={(editBoletoData.valor_liquido !== undefined && editBoletoData.valor_liquido !== null) ? editBoletoData.valor_liquido : (editBoletoData.valor_total || '')} 
                            onChange={(e) => setEditBoletoData({...editBoletoData, valor_liquido: Number(e.target.value), valor_total: Number(e.target.value)})}
                            className="bg-background border border-border rounded px-2 py-1 text-sm w-full max-w-[120px] text-right"
                          />
                        ) : (
                          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(boleto.valor_liquido !== null && boleto.valor_liquido !== undefined ? boleto.valor_liquido : boleto.valor_total)
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider
                          ${boleto.status === 'Aberto' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                            boleto.status === 'Abatido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                            'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                          {boleto.status}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        {(userRole === 'Admin' || userRole === 'Financeiro') && (
                          isEditing ? (
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
                          )
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
