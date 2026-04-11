"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Search,
  Save,
  AlertCircle,
  RefreshCw,
  Home,
  BarChart3,
  History,
  Target,
  Upload,
  Users,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeProvider";

interface InvestimentoRow {
  id: string;
  cliente: string;
  investimento: number;
  despesas: number;
  cpv_percentual: number;
  lucro: number;
  dga_percentual: number;
  custo_rede: number;
  numero_lojas: number;
  contrato_percentual: number;
  cpv_custo: number;
  contrato_frete_icms: number;
}

type EditableField = keyof Omit<InvestimentoRow, "id">;

const FIELD_DEFS: { key: EditableField; label: string; type: "currency" | "percent" | "integer"; width: number }[] = [
  { key: "cliente", label: "Cliente", type: "currency", width: 200 }, // text, but reuse type for rendering
  { key: "investimento", label: "Investimento", type: "currency", width: 130 },
  { key: "despesas", label: "Despesas", type: "currency", width: 120 },
  { key: "cpv_percentual", label: "CPV (%)", type: "percent", width: 90 },
  { key: "lucro", label: "Lucro", type: "currency", width: 120 },
  { key: "dga_percentual", label: "DGA (%)", type: "percent", width: 90 },
  { key: "custo_rede", label: "Custo Rede", type: "currency", width: 120 },
  { key: "numero_lojas", label: "Nº Lojas", type: "integer", width: 80 },
  { key: "contrato_percentual", label: "Contrato (%)", type: "percent", width: 100 },
  { key: "cpv_custo", label: "CPV Custo", type: "currency", width: 120 },
  { key: "contrato_frete_icms", label: "Contrato+Frete+ICMS", type: "currency", width: 150 },
];

export default function InvestimentoPage() {
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [data, setData] = useState<InvestimentoRow[]>([]);
  const [modified, setModified] = useState<Record<string, Partial<InvestimentoRow>>>({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());

  // Search & Pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const itemsPerPage = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data: rows, error } = await supabase
        .from("investimento_cliente")
        .select("*")
        .order("cliente");
      if (error) throw error;
      setData(rows || []);
      setModified({});
      setDeleted(new Set());
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      if (errMsg.includes("does not exist")) {
        setFeedback({ type: "error", msg: "A tabela 'investimento_cliente' ainda não existe. Execute o SQL no Supabase Dashboard." });
      } else {
        setFeedback({ type: "error", msg: "Erro ao carregar dados: " + errMsg });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    const base = data.filter(r => !deleted.has(r.id));
    if (!search) return base;
    const lower = search.toLowerCase();
    return base.filter(r => {
      const displayCliente = (modified[r.id]?.cliente ?? r.cliente) || "";
      return displayCliente.toLowerCase().includes(lower);
    });
  }, [data, search, deleted, modified]);

  const paginatedData = useMemo(() => {
    const start = page * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleChange = (id: string, field: EditableField, value: string) => {
    let parsed: string | number = value;
    if (field !== "cliente") {
      // Allow empty string while typing
      if (value === "" || value === "-") {
        parsed = 0;
      } else {
        const num = parseFloat(value.replace(",", "."));
        parsed = isNaN(num) ? 0 : num;
      }
    }
    setModified(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: parsed }
    }));
  };

  const handleAddRow = () => {
    const virtualId = "NOVO-" + Date.now();
    const newRow: InvestimentoRow = {
      id: virtualId,
      cliente: "Novo Cliente",
      investimento: 0,
      despesas: 0,
      cpv_percentual: 0,
      lucro: 0,
      dga_percentual: 0,
      custo_rede: 0,
      numero_lojas: 0,
      contrato_percentual: 0,
      cpv_custo: 0,
      contrato_frete_icms: 0,
    };
    setData(prev => [newRow, ...prev]);
    setModified(prev => ({ ...prev, [virtualId]: { cliente: "Novo Cliente" } }));
    setPage(0);
  };

  const handleDeleteRow = (id: string) => {
    if (id.startsWith("NOVO-")) {
      setData(prev => prev.filter(r => r.id !== id));
      const newM = { ...modified };
      delete newM[id];
      setModified(newM);
      return;
    }
    setDeleted(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      // Deletions
      if (deleted.size > 0) {
        const { error } = await supabase
          .from("investimento_cliente")
          .delete()
          .in("id", Array.from(deleted));
        if (error) throw error;
      }

      // Upserts
      const updates = Object.entries(modified).map(([id, changes]) => {
        const existing = data.find(r => r.id === id)!;
        const isNewRow = id.startsWith("NOVO-");
        const row: Record<string, string | number> = {
          cliente: changes.cliente !== undefined ? changes.cliente : existing.cliente,
          investimento: changes.investimento !== undefined ? changes.investimento : existing.investimento,
          despesas: changes.despesas !== undefined ? changes.despesas : existing.despesas,
          cpv_percentual: changes.cpv_percentual !== undefined ? changes.cpv_percentual : existing.cpv_percentual,
          lucro: changes.lucro !== undefined ? changes.lucro : existing.lucro,
          dga_percentual: changes.dga_percentual !== undefined ? changes.dga_percentual : existing.dga_percentual,
          custo_rede: changes.custo_rede !== undefined ? changes.custo_rede : existing.custo_rede,
          numero_lojas: changes.numero_lojas !== undefined ? changes.numero_lojas : existing.numero_lojas,
          contrato_percentual: changes.contrato_percentual !== undefined ? changes.contrato_percentual : existing.contrato_percentual,
          cpv_custo: changes.cpv_custo !== undefined ? changes.cpv_custo : existing.cpv_custo,
          contrato_frete_icms: changes.contrato_frete_icms !== undefined ? changes.contrato_frete_icms : existing.contrato_frete_icms,
        };
        if (!isNewRow) row.id = id;
        return row;
      });

      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 500) {
          const batch = updates.slice(i, i + 500);
          const { error } = await supabase
            .from("investimento_cliente")
            .upsert(batch, { onConflict: "cliente" });
          if (error) throw error;
        }
      }

      setFeedback({ type: "success", msg: "Alterações salvas com sucesso!" });
      await loadData();
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: "Erro ao salvar: " + (err instanceof Error ? err.message : String(err)) });
    }
    setSaving(false);
  };

  const hasChanges = Object.keys(modified).length > 0 || deleted.size > 0;

  // formatValue removed - unused

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", paddingBottom: "80px" }}>
      {/* NAVBAR */}
      <nav className="cm-navbar" style={{ position: "relative" }}>
        <Link href="/" className="cm-logo">Coffee<span>++</span></Link>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            Investimento por Cliente
          </h1>
          <p style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: 2 }}>
            Gestão Financeira
          </p>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      <main className="cm-main" style={{ paddingTop: 24, maxWidth: "1400px", margin: "0 auto" }}>
        {/* TOP ACTIONS */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
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

        {/* CONTENT */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--foreground-muted)" }}>
            <RefreshCw style={{ width: 24, height: 24, animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            Carregando investimentos...
          </div>
        ) : (
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={handleAddRow} className="cm-btn-clear" style={{ background: "var(--background)", color: "var(--foreground)", border: "1px dashed var(--border)" }}>
                  <Plus style={{ width: 14, height: 14 }} /> Adicionar
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--background)", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "280px" }}>
                  <Search style={{ width: 14, height: 14, color: "var(--foreground-muted)" }} />
                  <input
                    placeholder="Buscar por cliente..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    style={{ background: "transparent", border: "none", outline: "none", fontSize: "0.85rem", width: "100%", color: "var(--foreground)" }}
                  />
                </div>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", display: "flex", alignItems: "center", gap: 12 }}>
                <span>{filteredData.length} clientes encontrados</span>
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: 4, background: "var(--background)", borderRadius: 4, cursor: page === 0 ? "not-allowed" : "pointer" }}>
                      <ChevronLeft style={{ width: 14, height: 14 }} />
                    </button>
                    <span>Pág {page + 1} de {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: 4, background: "var(--background)", borderRadius: 4, cursor: page === totalPages - 1 ? "not-allowed" : "pointer" }}>
                      <ChevronRight style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {FIELD_DEFS.map(f => (
                      <th key={f.key} style={{ minWidth: f.width }}>{f.label}</th>
                    ))}
                    <th style={{ width: 60, textAlign: "center" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(item => {
                    const mState = modified[item.id] || {};
                    const isDirty = Object.keys(mState).length > 0;
                    const isNew = item.id.startsWith("NOVO-");

                    return (
                      <tr key={item.id} style={{ background: isDirty ? "rgba(184,134,11,0.05)" : "transparent" }}>
                        {FIELD_DEFS.map(f => {
                          const rawValue = mState[f.key] !== undefined ? mState[f.key] : item[f.key];

                          if (f.key === "cliente") {
                            return (
                              <td key={f.key} style={{ width: f.width }}>
                                <input
                                  className="dash-filter-select"
                                  style={{
                                    width: "100%", background: "transparent",
                                    border: isDirty ? "1px dashed var(--accent-gold)" : "1px solid var(--border)",
                                    color: "var(--foreground)", fontWeight: 600, fontSize: "0.8rem",
                                    borderRadius: 4, padding: "4px 6px"
                                  }}
                                  value={rawValue as string}
                                  placeholder="Nome do Cliente"
                                  onChange={(e) => handleChange(item.id, f.key, e.target.value)}
                                />
                              </td>
                            );
                          }

                          return (
                            <td key={f.key} style={{ width: f.width }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                {f.type === "currency" && <span style={{ fontSize: "0.7rem", color: "var(--foreground-dim)", flexShrink: 0 }}>R$</span>}
                                <input
                                  className="dash-filter-select"
                                  type="text"
                                  inputMode="decimal"
                                  style={{
                                    width: "100%", background: "transparent",
                                    border: isDirty ? "1px dashed var(--accent-gold)" : "1px solid var(--border)",
                                    color: "var(--foreground)", fontSize: "0.8rem",
                                    textAlign: "right", borderRadius: 4, padding: "4px 6px"
                                  }}
                                  value={rawValue as number}
                                  onChange={(e) => handleChange(item.id, f.key, e.target.value)}
                                />
                                {f.type === "percent" && <span style={{ fontSize: "0.7rem", color: "var(--foreground-dim)", flexShrink: 0 }}>%</span>}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => handleDeleteRow(item.id)} style={{ padding: "4px 8px", color: "var(--error-color, #ef4444)", opacity: 0.7, background: "none", border: "none", cursor: "pointer" }}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedData.length === 0 && (
                    <tr><td colSpan={FIELD_DEFS.length + 1} style={{ textAlign: "center", padding: 30, color: "var(--foreground-dim)" }}>Nenhum investimento encontrado. Clique em &quot;+ Adicionar&quot; para começar.</td></tr>
                  )}
                </tbody>
              </table>
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
        <Link href="/investimento" className="bottom-tab active">
          <TrendingUp className="bottom-tab-icon" /> Inv.
        </Link>
        <Link href="/metas" className="bottom-tab">
          <Target className="bottom-tab-icon" /> Metas
        </Link>
        <Link href="/upload" className="bottom-tab">
          <Upload className="bottom-tab-icon" /> Upload
        </Link>
        <Link href="/atendimento" className="bottom-tab">
          <Users className="bottom-tab-icon" /> Atendimento
        </Link>
      </nav>
    </div>
  );
}
