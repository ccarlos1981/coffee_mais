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
  DollarSign, Package, CheckCircle2, Edit } from "lucide-react";
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

import { CommercialDomainService } from "@/lib/domain";

export default function AtendimentoPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Verificação Canônica de Autenticação e RBAC
  useEffect(() => {
    const checkAuthAndPermissions = async () => {
      try {
        setAuthLoading(true);
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          setHasAccess(false);
          setAuthLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("cm_user_profiles")
          .select("role, approved")
          .eq("id", user.id)
          .single();

        if (!profile || !profile.approved) {
          setHasAccess(false);
          setAuthLoading(false);
          return;
        }

        const role = profile.role;
        setUserRole(role);

        // Super-usuários possuem acesso total
        if (role === "Admin" || role === "CEO" || role === "Admin Master" || role === "TI") {
          setHasAccess(true);
          setAuthLoading(false);
          return;
        }

        // Validação da permissão do módulo 'Atendimento' na matriz de permissões
        const { data: perm } = await supabase
          .from("cm_role_permissions")
          .select("has_access")
          .eq("role", role)
          .eq("module_name", "Atendimento")
          .maybeSingle();

        if (perm && perm.has_access) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (err) {
        console.error("Erro na verificação de permissões do módulo Atendimento:", err);
        setHasAccess(false);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuthAndPermissions();
  }, []);

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
      const pageSize = 1000;
      let allPdvs: PdvMapping[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const resPdv = await supabase
          .from("base_atendimento")
          .select("*")
          .order("nome_parceiro")
          .range(from, to);

        if (resPdv.error) throw resPdv.error;

        if (resPdv.data && resPdv.data.length > 0) {
          allPdvs = allPdvs.concat(resPdv.data);
          if (resPdv.data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setPdvData(allPdvs);
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
    setPdvData(prev => [{ cod_parceiro: virtualId, nome_parceiro: "Novo Parceiro", canal: "KA", manager: "Inside Sales", uf: "SP", rede: "" }, ...prev]);
    setModifiedPdvs(prev => ({ ...prev, [virtualId]: { nome_parceiro: "Novo Parceiro", canal: "KA", manager: "Inside Sales", uf: "SP" } }));
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
          const { error } = await supabase.rpc("rpc_importar_atendimento_sankhya", {
            p_items: batch,
            p_batch_id: `ui_save_${Date.now()}`,
            p_force_override: false,
          });
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

  // Validação de Autenticação e RBAC
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <RefreshCw style={{ width: 32, height: 32, color: "var(--accent-gold)" }} className="animate-spin" />
        <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
          Verificando permissões de acesso...
        </p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420, width: "100%", padding: "32px 24px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--card-bg, var(--background))", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", color: "#ef4444"
          }}>
            <Lock style={{ width: 28, height: 28 }} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", marginBottom: 8 }}>
            Acesso Não Autorizado
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: 24, lineHeight: 1.5 }}>
            Seu perfil ({userRole || "Não autenticado"}) não possui permissão para acessar o módulo de Atendimento.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 10,
              background: "var(--accent-gold)", color: "#fff",
              fontSize: "0.85rem", fontWeight: 600, textDecoration: "none",
              transition: "opacity 0.2s"
            }}
          >
            <Home style={{ width: 16, height: 16 }} /> Voltar ao Início
          </Link>
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
        {/* AVISO DE GOVERNANÇA COMERCIAL */}
        <div style={{ 
          padding: "14px 18px", 
          marginBottom: 24, 
          borderRadius: 10, 
          fontSize: "0.85rem", 
          display: "flex", 
          alignItems: "center", 
          gap: 12, 
          background: "rgba(184,134,11,0.08)", 
          color: "var(--accent-gold, #b8860b)", 
          border: "1px solid rgba(184,134,11,0.25)",
          fontWeight: 500
        }}>
          <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span>
            As informações comerciais (<strong>Gerente</strong>, <strong>Rede</strong> e <strong>Canal</strong>) são administradas exclusivamente pelo <strong>Cadastro Único</strong>.
          </span>
        </div>

        {/* TOP ACTIONS */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <button 
              onClick={handleExportBase}
              className="cm-btn-clear" 
              style={{ background: "rgba(184,134,11,0.1)", color: "var(--accent-gold)", border: "1px solid rgba(184,134,11,0.25)", cursor: "pointer" }}
            >
              <Download style={{ width: 14, height: 14 }} /> Exportar Base
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
                     {CommercialDomainService.getManagerList().map(m => (
                       <option key={m} value={m}>{m}</option>
                     ))}
                   </select>

                    {/* BOTÃO ADICIONAR (REDIRECIONADO PARA CADASTRO ÚNICO) */}
                    <Link 
                      href="/config-financeiro/cadastro" 
                      className="cm-btn-clear" 
                      style={{ background: "var(--accent-gold)", color: "#fff", border: "none", width: "auto", margin: 0, padding: "0 16px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", height: "38px", boxSizing: "border-box", textDecoration: "none" }}
                    >
                      <Plus style={{ width: 16, height: 16 }} /> Cadastrar Cliente
                    </Link>
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
                        <th style={{ width: 80, textAlign: "center" }}>Ação</th>
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
                              <span style={{ fontSize: "0.8rem", color: "var(--foreground)", fontWeight: 600 }}>
                                {currentNome}
                              </span>
                            </td>
                            <td style={{ width: 180 }}>
                              <span style={{ fontSize: "0.8rem", color: "var(--foreground-secondary)" }}>
                                {currentRede || "—"}
                              </span>
                            </td>
                            <td style={{ width: 90, textAlign: "center" }}>
                              <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                                {currentUf || "—"}
                              </span>
                            </td>
                            <td style={{ width: 180 }}>
                              <span style={{ fontSize: "0.8rem", color: "var(--foreground-secondary)" }}>
                                {currentCanal || "—"}
                              </span>
                            </td>
                            <td style={{ width: 180 }}>
                              <span style={{ fontSize: "0.8rem", color: "var(--foreground)", fontWeight: 600 }}>
                                {currentManager || "—"}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <Link 
                                href={`/config-financeiro/cadastro?codigo=${item.cod_parceiro}`}
                                style={{ padding: "4px 8px", color: "var(--accent-gold, #bba16e)", display: "inline-flex", alignItems: "center", textDecoration: "none" }}
                                className="hover:opacity-100 hover:bg-amber-500/10 rounded"
                                title="Editar Cadastro (Cadastro Único)"
                              >
                                <Edit style={{ width: 14, height: 14 }} />
                                <span style={{ fontSize: "0.75rem", marginLeft: 4, fontWeight: 500 }}>Editar</span>
                              </Link>
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
