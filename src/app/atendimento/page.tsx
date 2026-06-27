"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Users,
  Search,
  Save,
  Download,
  AlertCircle,
  RefreshCw,
  Home,
  BarChart3,
  History,
  TrendingUp,
  Target,
  Upload,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  DollarSign, Package, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeProvider";

interface UfMapping {
  uf: string;
  manager: string;
}

interface PdvMapping {
  cod_parceiro: string;
  nome_parceiro: string;
  canal: string;
  manager: string;
  rede: string;
  uf: string;
}

const MANAGERS_LIST = ["Julliano", "Leandro", "Luiz", "Inside Sales"];
const CHANNELS_LIST = [
  "ATACADO",
  "CASH & CARRY",
  "DISTRIBUIDOR",
  "B2B",
  "VAREJO C ON",
  "VAREJO F OUT",
  "FARMACIA",
  "E-COMMERCE",
  "KEY ACCOUNT"
];

const PAGE_PASSWORD = "123456";

export default function AtendimentoPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Check sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("atendimento_auth") === "true") {
      setAuthenticated(true);
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === PAGE_PASSWORD) {
      setAuthenticated(true);
      setPasswordError(false);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("atendimento_auth", "true");
      }
    } else {
      setPasswordError(true);
      setPasswordInput("");
    }
  };

  // Dados
  const [pdvData, setPdvData] = useState<PdvMapping[]>([]);

  // Edições Locais (Dirty State)
  const [modifiedPdvs, setModifiedPdvs] = useState<Record<string, { canal?: string; manager?: string; nome_parceiro?: string; uf?: string; rede?: string }>>({});
  const [deletedPdvs, setDeletedPdvs] = useState<Set<string>>(new Set());
  const [newPdvsCount, setNewPdvsCount] = useState(0);

  const [pdvSearch, setPdvSearch] = useState("");
  const [ufFilter, setUfFilter] = useState("Todos");
  const [managerFilter, setManagerFilter] = useState("Todos");
  const [channelFilter, setChannelFilter] = useState("Todos");
  const [pdvPage, setPdvPage] = useState(0);
  const itemsPerPage = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const resPdv = await supabase.from("base_atendimento").select("*").order("nome_parceiro");
      if (resPdv.error) throw resPdv.error;

      setPdvData(resPdv.data || []);
      setModifiedPdvs({});
      setDeletedPdvs(new Set());
      setNewPdvsCount(0);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("does not exist")) {
        setFeedback({ type: "error", msg: "As tabelas ainda não foram criadas no Supabase. Execute o script SQl gerado no seu Dashboard." });
      } else {
        setFeedback({ type: "error", msg: "Erro ao carregar dados: " + errMsg });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // PDVs filtrados e paginados
  const filteredPdvs = useMemo(() => {
    const base = pdvData.filter(p => !deletedPdvs.has(p.cod_parceiro));
    if (!pdvSearch && ufFilter === "Todos" && managerFilter === "Todos" && channelFilter === "Todos") return base;
    const lower = pdvSearch.toLowerCase();
    return base.filter(
      p => {
        const pUf = modifiedPdvs[p.cod_parceiro]?.uf || p.uf;
        const pNome = modifiedPdvs[p.cod_parceiro]?.nome_parceiro || p.nome_parceiro;
        const pRede = modifiedPdvs[p.cod_parceiro]?.rede || p.rede;
        const pManager = modifiedPdvs[p.cod_parceiro]?.manager || p.manager;
        const pCanal = modifiedPdvs[p.cod_parceiro]?.canal || p.canal;
        return (ufFilter === "Todos" || (pUf && pUf === ufFilter)) && 
               (managerFilter === "Todos" || (pManager && pManager === managerFilter)) &&
               (channelFilter === "Todos" || (pCanal && pCanal === channelFilter)) &&
               (pNome?.toLowerCase().includes(lower) || p.cod_parceiro?.toLowerCase().includes(lower) || pRede?.toLowerCase().includes(lower))
      }
    );
  }, [pdvData, pdvSearch, ufFilter, managerFilter, channelFilter, deletedPdvs, modifiedPdvs]);

  const paginatedPdvs = useMemo(() => {
    const start = pdvPage * itemsPerPage;
    return filteredPdvs.slice(start, start + itemsPerPage);
  }, [filteredPdvs, pdvPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPdvs.length / itemsPerPage);

  const handlePdvChange = (cod: string, field: "manager" | "canal" | "nome_parceiro" | "uf" | "rede", value: string) => {
    setModifiedPdvs(prev => ({
      ...prev,
      [cod]: { ...prev[cod], [field]: value }
    }));
  };

  const handleAddRow = () => {
    const virtualId = "NOVO-" + Date.now();
    setPdvData(prev => [{ cod_parceiro: virtualId, nome_parceiro: "Novo Parceiro", canal: "VAREJO F OUT", manager: "Inside Sales", uf: "SP", rede: "" }, ...prev]);
    setModifiedPdvs(prev => ({ ...prev, [virtualId]: { nome_parceiro: "Novo Parceiro", canal: "VAREJO F OUT", manager: "Inside Sales", uf: "SP" } }));
    setNewPdvsCount(c => c + 1);
    setPdvPage(0); // View the new row
  };

  const handleDeleteRow = (cod: string) => {
    if (cod.startsWith("NOVO-")) {
      setPdvData(prev => prev.filter(p => p.cod_parceiro !== cod));
      const newM = { ...modifiedPdvs };
      delete newM[cod];
      setModifiedPdvs(newM);
      setNewPdvsCount(c => Math.max(0, c - 1));
      return;
    }
    setDeletedPdvs(prev => {
      const next = new Set(prev);
      next.add(cod);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      // Delete PDVs
      if (deletedPdvs.size > 0) {
        const { error } = await supabase.from("base_atendimento").delete().in("cod_parceiro", Array.from(deletedPdvs));
        if (error) throw error;
      }

      // Save PDVs
      const pdvUpdates = Object.entries(modifiedPdvs).map(([cod, changes]) => {
        const existing = pdvData.find(p => p.cod_parceiro === cod)!;
        return {
          cod_parceiro: cod.startsWith("NOVO-") ? `P-${Math.floor(Math.random() * 1000000)}` : cod,
          nome_parceiro: changes.nome_parceiro !== undefined ? changes.nome_parceiro : existing.nome_parceiro,
          rede: changes.rede !== undefined ? changes.rede : existing.rede,
          canal: changes.canal || existing.canal,
          manager: changes.manager || existing.manager,
          uf: changes.uf !== undefined ? changes.uf : existing.uf,
        };
      });
      if (pdvUpdates.length > 0) {
        for (let i = 0; i < pdvUpdates.length; i += 500) {
          const batch = pdvUpdates.slice(i, i + 500);
          const { error } = await supabase.from("base_atendimento").upsert(batch, { onConflict: "cod_parceiro" });
          if (error) throw error;
        }
      }

      setFeedback({ type: "success", msg: "Alterações salvas com sucesso!" });
      setModifiedPdvs({});
      setDeletedPdvs(new Set());
      await loadData();
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: "Erro ao salvar: " + (err instanceof Error ? err.message : String(err)) });
    }
    setSaving(false);
  };

  const handleSeed = async () => {
    console.log('[SEED] Button clicked, starting seed...');
    setSeeding(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/atendimento/seed", { method: "POST" });
      const json = await res.json();
      console.log('[SEED] Response:', json);
      if (json.success) {
        setFeedback({ type: "success", msg: json.message });
        await loadData();
      } else {
        throw new Error(json.error || 'Erro desconhecido');
      }
    } catch (err: unknown) {
      console.error('[SEED] Error:', err);
      setFeedback({ type: "error", msg: "Erro ao popular base: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setSeeding(false);
    }
  };

  const handleSyncHistorical = async () => {
    if (!confirm("Isso modificará o Faturamento e Volume histórico das vendas com base nas regras atuais configuradas e SALVAS nesta tela. Os painéis de vendas usarão essa nova visão. Deseja prosseguir?")) return;
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/atendimento/sync", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: "success", msg: json.message + ` (${json.rowsAffected} linhas de vendas atualizadas)` });
      } else {
        throw new Error(json.error);
      }
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: "Erro na sincronização: " + (err instanceof Error ? err.message : String(err)) });
    }
    setSyncing(false);
  };

  const handleImportClientes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/atendimento/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: "success", msg: json.message });
        await loadData();
      } else {
        throw new Error(json.error || "Erro na importação");
      }
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: "Erro ao importar: " + (err instanceof Error ? err.message : String(err)) });
    }
    setImporting(false);
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const templateData = [
      {
        cod_parceiro: "12345",
        nome_parceiro: "NOME DO CLIENTE LTDA",
        uf: "SP",
        manager: "Leandro",
        channel: "KA",
        rede: "REDE EXEMPLO",
      },
      {
        cod_parceiro: "67890",
        nome_parceiro: "OUTRO CLIENTE S/A",
        uf: "MG",
        manager: "Leandro",
        channel: "ATACADO",
        rede: "MATRIZ EXEMPLO",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 14 }, { wch: 35 }, { wch: 5 }, { wch: 16 }, { wch: 14 }, { wch: 25 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "template_clientes_time.xlsx");
  };

  const handleExportBase = async () => {
    try {
      const XLSX = await import("xlsx");
      const exportData = pdvData.map(p => ({
        "Cód. Parceiro": p.cod_parceiro,
        "Nome / Razão": p.nome_parceiro,
        "UF": p.uf || "",
        "Canal": p.canal || "",
        "Gerente": p.manager || "",
        "Rede": p.rede || ""
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 15 }, { wch: 40 }, { wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Base Atendimento");
      XLSX.writeFile(wb, "base_atendimento_clientes.xlsx");
    } catch (err: unknown) {
      console.error(err);
      setFeedback({ type: "error", msg: "Erro ao exportar base: " + (err instanceof Error ? err.message : String(err)) });
    }
  };

  const hasChanges = Object.keys(modifiedPdvs).length > 0 || deletedPdvs.size > 0;

  // PASSWORD GATE
  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 380, width: "100%", padding: "0 24px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(184,134,11,0.15), rgba(184,134,11,0.05))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", border: "1px solid rgba(184,134,11,0.2)"
          }}>
            <Lock style={{ width: 28, height: 28, color: "var(--accent-gold)" }} />
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", marginBottom: 6 }}>
            Área Restrita
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginBottom: 24 }}>
            Configuração de Atendimento requer autenticação.
          </p>
          <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                placeholder="Digite a senha"
                autoFocus
                style={{
                  width: "100%", padding: "12px 44px 12px 16px", fontSize: "0.95rem",
                  borderRadius: 10, border: `1px solid ${passwordError ? "rgba(200,80,80,0.5)" : "var(--border)"}`,
                  background: "var(--card-bg, var(--background))", color: "var(--foreground)",
                  outline: "none", transition: "border-color 0.2s",
                  boxSizing: "border-box"
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--foreground-muted)", padding: 4 }}
              >
                {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
              </button>
            </div>
            {passwordError && (
              <p style={{ fontSize: "0.8rem", color: "#c85050", margin: 0 }}>
                Senha incorreta. Tente novamente.
              </p>
            )}
            <button
              type="submit"
              style={{
                padding: "12px", borderRadius: 10, border: "none",
                background: "var(--accent-gold)", color: "#fff",
                fontSize: "0.9rem", fontWeight: 600, cursor: "pointer",
                transition: "opacity 0.2s"
              }}
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "80px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            Configuração de Atendimento
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            Regras de Gerenciamento
          </p>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      <main className="cm-main" style={{ paddingTop: 24, maxWidth: "1200px", margin: "0 auto" }}>
        {/* TOP ACTIONS */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {(pdvData.length === 0 && !loading) && (
              <button 
                onClick={handleSeed} 
                disabled={seeding}
                className="cm-btn-clear" 
                style={{ background: "rgba(107,143,173,0.1)", color: "#6b8fad", border: "1px solid rgba(107,143,173,0.2)", opacity: seeding ? 0.6 : 1, cursor: seeding ? "wait" : "pointer" }}
              >
                {seeding ? (
                  <><RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Populando...</>
                ) : (
                  <><Download style={{ width: 14, height: 14 }} /> Popular Inicialmente</>
                )}
              </button>
            )}
            
            <button 
              onClick={() => importInputRef.current?.click()} 
              disabled={importing}
              className="cm-btn-clear" 
              style={{ background: "rgba(34,139,34,0.1)", color: "#228b22", border: "1px solid rgba(34,139,34,0.3)", opacity: importing ? 0.5 : 1, cursor: importing ? "wait" : "pointer" }}
            >
              <Upload style={{ width: 14, height: 14 }} /> 
              {importing ? "Importando..." : "Importar Clientes/Time"}
            </button>
            <button 
              onClick={downloadTemplate}
              className="cm-btn-clear" 
              style={{ background: "rgba(107,143,173,0.1)", color: "#6b8fad", border: "1px solid rgba(107,143,173,0.2)", cursor: "pointer" }}
            >
              <Download style={{ width: 14, height: 14 }} /> Planilha Padrão
            </button>
            <button 
              onClick={handleExportBase}
              className="cm-btn-clear" 
              style={{ background: "rgba(107,143,173,0.1)", color: "#6b8fad", border: "1px solid rgba(107,143,173,0.2)", cursor: "pointer" }}
            >
              <Download style={{ width: 14, height: 14 }} /> Exportar Base
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xls,.xlsx,.xlsm,.xlsb"
              className="hidden"
              style={{ display: "none" }}
              onChange={handleImportClientes}
            />

            <button 
              onClick={handleSyncHistorical} 
              disabled={syncing || hasChanges}
              className="cm-btn-clear" 
              title={hasChanges ? "Salve as alterações primeiro" : "Aplicar aos dados historicos"}
              style={{ background: "rgba(184,134,11,0.1)", color: "#b8860b", border: "1px solid rgba(184,134,11,0.3)", opacity: (syncing || hasChanges) ? 0.5 : 1, cursor: (syncing || hasChanges) ? "not-allowed" : "pointer" }}
            >
              <History style={{ width: 14, height: 14 }} /> 
              {syncing ? "Sincronizando..." : "Ler para Trás (Sincronizar Histórico)"}
            </button>

            <button 
              onClick={handleSave} 
              disabled={!hasChanges || saving}
              className="cm-btn-clear" 
              style={{ background: "var(--accent-gold)", color: "#fff", opacity: (!hasChanges || saving) ? 0.5 : 1, pointerEvents: (!hasChanges || saving) ? "none" : "auto" }}
            >
              <Save style={{ width: 14, height: 14 }} /> 
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>

        {/* FEEDBACK */}
        {feedback && (
          <div style={{ padding: "12px 16px", marginBottom: 24, borderRadius: 8, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8, background: feedback.type === "success" ? "rgba(90,128,90,0.1)" : "rgba(200,80,80,0.1)", color: feedback.type === "success" ? "#5a805a" : "#c85050", border: `1px solid ${feedback.type === "success" ? "rgba(90,128,90,0.3)" : "rgba(200,80,80,0.3)"}` }}>
            <AlertCircle style={{ width: 16, height: 16 }} />
            {feedback.msg}
          </div>
        )}

        {/* TAB CONTROLS E DATALOADING */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--foreground-muted)" }}>
            <RefreshCw style={{ width: 24, height: 24, animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            Carregando configurações...
          </div>
        ) : (
          <div className="glass-card" style={{ padding: 20 }}>
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
                 {/* LINHA 1: FILTROS */}
                 <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                   {/* BARRA DE BUSCA */}
                   <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--background)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "300px", height: "38px", boxSizing: "border-box" }}>
                     <Search style={{ width: 15, height: 15, color: "var(--foreground-muted)" }} />
                     <input 
                       placeholder="Buscar por parceiro ou ID..." 
                       value={pdvSearch}
                       onChange={(e) => { setPdvSearch(e.target.value); setPdvPage(0); }}
                       style={{ background: "transparent", border: "none", outline: "none", fontSize: "0.85rem", width: "100%", color: "var(--foreground)" }}
                     />
                   </div>

                   {/* SELECT UF */}
                   <select 
                     value={ufFilter}
                     onChange={(e) => { setUfFilter(e.target.value); setPdvPage(0); }}
                     className="dash-filter-select"
                     style={{ background: "var(--background)", width: "120px", height: "38px" }}
                   >
                     <option value="Todos">UFs (Todas)</option>
                     {Array.from(new Set(pdvData.map(p => p.uf).filter(Boolean))).sort().map(u => (
                       <option key={u} value={u}>{u}</option>
                     ))}
                   </select>

                   {/* SELECT CANAL */}
                   <select 
                     value={channelFilter}
                     onChange={(e) => { setChannelFilter(e.target.value); setPdvPage(0); }}
                     className="dash-filter-select"
                     style={{ background: "var(--background)", width: "170px", height: "38px" }}
                   >
                     <option value="Todos">Canais (Todos)</option>
                     {Array.from(new Set(pdvData.map(p => p.canal).filter(Boolean))).sort().map(c => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                   </select>

                   {/* SELECT GERENTE */}
                   <select 
                     value={managerFilter}
                     onChange={(e) => { setManagerFilter(e.target.value); setPdvPage(0); }}
                     className="dash-filter-select"
                     style={{ background: "var(--background)", width: "170px", height: "38px" }}
                   >
                     <option value="Todos">Gerentes (Todos)</option>
                     {MANAGERS_LIST.map(m => (
                       <option key={m} value={m}>{m}</option>
                     ))}
                   </select>

                   {/* BOTÃO ADICIONAR */}
                   <button 
                     onClick={handleAddRow} 
                     className="cm-btn-clear" 
                     style={{ background: "var(--accent-gold)", color: "#fff", border: "none", width: "auto", margin: 0, padding: "0 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", height: "38px", boxSizing: "border-box" }}
                   >
                     <Plus style={{ width: 16, height: 16 }} /> Adicionar Parceiro
                   </button>
                 </div>

                 {/* LINHA 2: PAGINAÇÃO */}
                 <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                   <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", display: "flex", alignItems: "center", gap: 16 }}>
                     <span style={{ fontWeight: 500 }}>{filteredPdvs.length} PDVs encontrados</span>
                     {totalPages > 1 && (
                       <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                         <button 
                           onClick={() => setPdvPage(p => Math.max(0, p - 1))} 
                           disabled={pdvPage === 0} 
                           style={{ padding: "6px 8px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, cursor: pdvPage === 0 ? "not-allowed" : "pointer", opacity: pdvPage === 0 ? 0.5 : 1, display: "flex", alignItems: "center" }}
                         >
                           <ChevronLeft style={{ width: 15, height: 15, color: "var(--foreground)" }} />
                         </button>
                         <span style={{ minWidth: "90px", textAlign: "center", fontWeight: 600 }}>Pág {pdvPage + 1} de {totalPages}</span>
                         <button 
                           onClick={() => setPdvPage(p => Math.min(totalPages - 1, p + 1))} 
                           disabled={pdvPage === totalPages - 1} 
                           style={{ padding: "6px 8px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, cursor: pdvPage === totalPages - 1 ? "not-allowed" : "pointer", opacity: pdvPage === totalPages - 1 ? 0.5 : 1, display: "flex", alignItems: "center" }}
                         >
                           <ChevronRight style={{ width: 15, height: 15, color: "var(--foreground)" }} />
                         </button>
                       </div>
                     )}
                   </div>
                 </div>
               </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cód. Parceiro</th>
                        <th>Nome / Razão</th>
                        <th>Rede</th>
                        <th>UF</th>
                        <th>Canal</th>
                        <th>Gerente</th>
                        <th style={{ width: 60, textAlign: "center" }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPdvs.map(item => {
                        const mState = modifiedPdvs[item.cod_parceiro] || {};
                        const currentCanal = mState.canal !== undefined ? mState.canal : item.canal;
                        const currentManager = mState.manager !== undefined ? mState.manager : item.manager;
                        const currentUf = mState.uf !== undefined ? mState.uf : item.uf;
                        const currentNome = mState.nome_parceiro !== undefined ? mState.nome_parceiro : item.nome_parceiro;
                        const currentRede = mState.rede !== undefined ? mState.rede : item.rede;
                        const isDirty = Object.keys(mState).length > 0;
                        const isNew = item.cod_parceiro.startsWith("NOVO-");

                        return (
                          <tr key={item.cod_parceiro} style={{ background: isDirty ? "rgba(184,134,11,0.05)" : "transparent" }}>
                            <td style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", width: 120 }}>
                              {isNew ? <span style={{ color: "var(--accent-gold)", fontWeight: "bold" }}>[NOVO]</span> : item.cod_parceiro}
                            </td>
                            <td style={{ width: 220 }}>
                              <input 
                                className="dash-filter-select"
                                style={{ width: "100%", background: "transparent", border: isDirty ? "1px dashed var(--accent-gold)" : "1px solid var(--border)", color: "var(--foreground)", fontWeight: 600, fontSize: "0.8rem", borderRadius: 4, padding: "4px 6px" }}
                                value={currentNome}
                                placeholder="Nome da Loja"
                                onChange={(e) => handlePdvChange(item.cod_parceiro, "nome_parceiro", e.target.value)}
                              />
                            </td>
                            <td style={{ width: 180 }}>
                              <input 
                                className="dash-filter-select"
                                style={{ width: "100%", background: "transparent", border: isDirty ? "1px dashed var(--accent-gold)" : "1px solid var(--border)", color: "var(--foreground-secondary)", fontSize: "0.8rem", borderRadius: 4, padding: "4px 6px" }}
                                value={currentRede || ""}
                                placeholder="Rede"
                                onChange={(e) => handlePdvChange(item.cod_parceiro, "rede", e.target.value)}
                              />
                            </td>
                            <td style={{ width: 90 }}>
                              <input 
                                className="dash-filter-select"
                                style={{ width: "100%", background: "transparent", border: isDirty ? "1px dashed var(--accent-gold)" : "1px solid var(--border)", color: "var(--foreground-muted)", fontSize: "0.8rem", textAlign: "center", borderRadius: 4, padding: "4px 6px" }}
                                value={currentUf || ""}
                                placeholder="UF"
                                maxLength={2}
                                onChange={(e) => handlePdvChange(item.cod_parceiro, "uf", e.target.value.toUpperCase())}
                              />
                            </td>
                            <td style={{ width: 180 }}>
                              <select 
                                className="dash-filter-select"
                                style={{ width: "100%", background: "var(--background)", color: "var(--foreground)" }}
                                value={currentCanal || ""}
                                onChange={(e) => handlePdvChange(item.cod_parceiro, "canal", e.target.value)}
                              >
                                <option value="">-- Sem canal --</option>
                                {Array.from(new Set([...CHANNELS_LIST, item.canal].filter(Boolean))).map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ width: 180 }}>
                              <select 
                                className="dash-filter-select"
                                style={{ width: "100%", background: "var(--background)", color: "var(--foreground)" }}
                                value={currentManager || ""}
                                onChange={(e) => handlePdvChange(item.cod_parceiro, "manager", e.target.value)}
                              >
                                <option value="">-- Sem gerente --</option>
                                {Array.from(new Set([...MANAGERS_LIST, item.manager].filter(Boolean))).map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button onClick={() => handleDeleteRow(item.cod_parceiro)} style={{ padding: "4px 8px", color: "var(--error-color, #ef4444)", opacity: 0.7 }} className="hover:opacity-100 hover:bg-red-500/10 rounded">
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedPdvs.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--foreground-dim)" }}>Nenhum PDV encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            
          </div>
        )}
      </main>

      {/* BOTTOM TAB BAR */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab">
          <Home className="bottom-tab-icon" /> Menu
        </Link>
        <Link href="/vendas" className="bottom-tab">
          <BarChart3 className="bottom-tab-icon" /> Vendas
        </Link>
        <Link href="/historico" className="bottom-tab">
          <History className="bottom-tab-icon" /> Hist.
        </Link>
        <Link href="/preco" className="bottom-tab">
          <TrendingUp className="bottom-tab-icon" /> Preço
        </Link>
        <Link href="/dia" className="bottom-tab">
          <Calendar className="bottom-tab-icon" /> Dia
        </Link>
        <Link href="/positivacao" className="bottom-tab"><CheckCircle2 className="bottom-tab-icon" /> Posit.</Link>
        <Link href="/sku-pdv" className="bottom-tab"><Package className="bottom-tab-icon" /> Sku PDV</Link>
        <Link href="/investimento" className="bottom-tab">
          <TrendingUp className="bottom-tab-icon" /> Inv.
        </Link>
        <Link href="/metas" className="bottom-tab">
          <Target className="bottom-tab-icon" /> Metas
        </Link>
        <Link href="/upload" className="bottom-tab">
          <Upload className="bottom-tab-icon" /> Upload
        </Link>
        <Link href="/atendimento" className="bottom-tab active">
          <Users className="bottom-tab-icon" /> Atendimento
        </Link>
        <span className="bottom-tab disabled">
          <DollarSign className="bottom-tab-icon" /> DRE
        </span>
      </nav>
    </div>
  );
}
