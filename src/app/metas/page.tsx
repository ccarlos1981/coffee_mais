"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Coffee,
  Save,
  X,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatNumber, formatCurrency } from "@/lib/formatters";

interface TargetRecord {
  id: number;
  manager: string;
  year: number;
  month: number;
  target_tons: number | null;
  target_revenue: number | null;
  target_maco: number | null;
}

interface BusinessDay {
  id: number;
  year: number;
  month: number;
  total_days: number;
  elapsed_days: number;
}

const MANAGERS = ["Luciano", "Leandro", "Luiz", "Luisa", "Julliano", "Inside Sales"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const YEARS = [2022, 2023, 2024, 2025, 2026];

type Tab = "metas" | "dias-uteis";

export default function MetasPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("metas");
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [businessDays, setBusinessDays] = useState<BusinessDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string>("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Form state
  const [formManager, setFormManager] = useState(MANAGERS[0]);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formTons, setFormTons] = useState("");
  const [formRevenue, setFormRevenue] = useState("");
  const [formMaco, setFormMaco] = useState("");

  // Business days form
  const [bdYear, setBdYear] = useState(new Date().getFullYear());
  const [bdMonth, setBdMonth] = useState(new Date().getMonth() + 1);
  const [bdTotal, setBdTotal] = useState("");
  const [bdElapsed, setBdElapsed] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("targets")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: true });

    if (!err && data) setTargets(data);
    setLoading(false);
  }, []);

  const loadBusinessDays = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("business_days")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: true });

    if (!err && data) setBusinessDays(data);
  }, []);

  useEffect(() => {
    loadTargets();
    loadBusinessDays();
  }, [loadTargets, loadBusinessDays]);

  const resetForm = () => {
    setFormManager(MANAGERS[0]);
    setFormYear(2026);
    setFormMonth(1);
    setFormTons("");
    setFormRevenue("");
    setFormMaco("");
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const openEdit = (t: TargetRecord) => {
    setEditingId(t.id);
    setFormManager(t.manager);
    setFormYear(t.year);
    setFormMonth(t.month);
    setFormTons(t.target_tons?.toString() || "");
    setFormRevenue(t.target_revenue?.toString() || "");
    setFormMaco(t.target_maco?.toString() || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    setError(null);
    const payload = {
      manager: formManager,
      year: formYear,
      month: formMonth,
      target_tons: formTons ? parseFloat(formTons) : null,
      target_revenue: formRevenue ? parseFloat(formRevenue) : null,
      target_maco: formMaco ? parseFloat(formMaco) : null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error: err } = await supabase
        .from("targets")
        .update(payload)
        .eq("id", editingId);

      if (err) {
        setError(err.message);
        return;
      }
      setSuccess("Meta atualizada com sucesso!");
    } else {
      const { error: err } = await supabase
        .from("targets")
        .insert(payload);

      if (err) {
        if (err.message.includes("duplicate") || err.message.includes("unique")) {
          setError("Já existe uma meta para esse gerente/período. Edite a existente.");
        } else {
          setError(err.message);
        }
        return;
      }
      setSuccess("Meta cadastrada com sucesso!");
    }

    resetForm();
    loadTargets();
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return;

    const { error: err } = await supabase
      .from("targets")
      .delete()
      .eq("id", id);

    if (err) {
      setError(err.message);
      return;
    }
    setSuccess("Meta excluída com sucesso!");
    loadTargets();
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSaveBusinessDay = async () => {
    setError(null);
    const payload = {
      year: bdYear,
      month: bdMonth,
      total_days: bdTotal ? parseInt(bdTotal) : 0,
      elapsed_days: bdElapsed ? parseInt(bdElapsed) : 0,
    };

    // Upsert
    const existing = businessDays.find(
      (bd) => bd.year === bdYear && bd.month === bdMonth
    );

    if (existing) {
      const { error: err } = await supabase
        .from("business_days")
        .update(payload)
        .eq("id", existing.id);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase
        .from("business_days")
        .insert(payload);
      if (err) { setError(err.message); return; }
    }

    setSuccess("Dias úteis salvos!");
    loadBusinessDays();
    setBdTotal("");
    setBdElapsed("");
    setTimeout(() => setSuccess(null), 3000);
  };

  const sortedTargets = [...targets].sort((a, b) => {
    const aVal = a[sortField as keyof TargetRecord];
    const bVal = b[sortField as keyof TargetRecord];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="glass-card p-8 w-full max-w-sm text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-amber-500/5 z-0" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 mb-6 shadow-lg shadow-violet-500/30">
              <Target className="w-6 h-6 text-white" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-sm text-muted mb-6">Por favor, digite a senha para acessar a gestão de metas.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === "123456") {
                setIsAuthenticated(true);
                setError(null);
              } else {
                setError("Senha incorreta");
              }
            }} className="w-full flex flex-col gap-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Senha"
                className="w-full bg-background border border-border-light rounded-xl px-4 py-3 text-center tracking-widest text-foreground placeholder:tracking-normal placeholder:text-dim focus:outline-none focus:border-violet-500"
                autoFocus
              />
              
              {error && <p className="text-xs text-red-400 -mt-2">{error}</p>}
              
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white font-medium transition-all shadow-lg shadow-violet-500/20"
              >
                Acessar
              </button>
            </form>

            <Link href="/" className="mt-8 flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Menu Inicial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Gestão de Metas
            </h1>
            <p className="text-xs text-muted">
              Cadastro de metas por gerente e período
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-card rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("metas")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "metas"
                ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Target className="w-4 h-4 inline-block mr-2" />
            Metas
          </button>
          <button
            onClick={() => setActiveTab("dias-uteis")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "dias-uteis"
                ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Calendar className="w-4 h-4 inline-block mr-2" />
            Dias Úteis
          </button>
        </div>

        {/* Feedback */}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm animate-fade-in">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
            ✗ {error}
          </div>
        )}

        {/* =================== METAS TAB =================== */}
        {activeTab === "metas" && (
          <div className="animate-fade-in">
            {/* Actions */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted">
                {targets.length} meta{targets.length !== 1 ? "s" : ""}{" "}
                cadastrada{targets.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-500 transition-all"
              >
                <Plus className="w-4 h-4" />
                Nova Meta
              </button>
            </div>

            {/* Form Modal */}
            {showForm && (
              <div className="glass-card p-6 mb-6 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    {editingId ? "Editar Meta" : "Nova Meta"}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="text-muted hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {/* Gerente */}
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Gerente
                    </label>
                    <div className="relative">
                      <select
                        value={formManager}
                        onChange={(e) => setFormManager(e.target.value)}
                        className="w-full appearance-none bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500"
                      >
                        {MANAGERS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Ano */}
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Ano
                    </label>
                    <div className="relative">
                      <select
                        value={formYear}
                        onChange={(e) => setFormYear(Number(e.target.value))}
                        className="w-full appearance-none bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500"
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Mês */}
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Mês
                    </label>
                    <div className="relative">
                      <select
                        value={formMonth}
                        onChange={(e) => setFormMonth(Number(e.target.value))}
                        className="w-full appearance-none bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500"
                      >
                        {MONTHS.map((m, i) => (
                          <option key={i} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Meta Tons */}
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Meta Toneladas
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formTons}
                      onChange={(e) => setFormTons(e.target.value)}
                      placeholder="Ex: 15.5"
                      className="w-full bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-dim focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Meta R$ */}
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Meta Faturamento (R$)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={formRevenue}
                      onChange={(e) => setFormRevenue(e.target.value)}
                      placeholder="Ex: 500000"
                      className="w-full bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-dim focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Meta MaCo */}
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Meta MaCo (R$)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={formMaco}
                      onChange={(e) => setFormMaco(e.target.value)}
                      placeholder="Ex: 150000"
                      className="w-full bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-dim focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium hover:from-green-400 hover:to-green-500 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {editingId ? "Atualizar" : "Salvar"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-xl border border-border-light text-muted text-sm hover:text-foreground transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Targets Table */}
            {loading ? (
              <div className="text-center py-16 text-muted">
                Carregando...
              </div>
            ) : targets.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Target className="w-12 h-12 text-dim mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhuma meta cadastrada
                </h3>
                <p className="text-sm text-muted">
                  Clique em &quot;Nova Meta&quot; para começar
                </p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th onClick={() => toggleSort("manager")}>
                          Gerente {sortField === "manager" && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th onClick={() => toggleSort("year")}>
                          Ano {sortField === "year" && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th onClick={() => toggleSort("month")}>
                          Mês {sortField === "month" && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th onClick={() => toggleSort("target_tons")}>
                          Meta Tons {sortField === "target_tons" && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th onClick={() => toggleSort("target_revenue")}>
                          Meta R$ {sortField === "target_revenue" && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th onClick={() => toggleSort("target_maco")}>
                          Meta MaCo {sortField === "target_maco" && (sortDir === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTargets.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <span className="font-medium text-foreground">
                              {t.manager}
                            </span>
                          </td>
                          <td>{t.year}</td>
                          <td>{MONTHS[t.month - 1]}</td>
                          <td>
                            {t.target_tons != null
                              ? formatNumber(t.target_tons, 1)
                              : "-"}
                          </td>
                          <td>
                            {t.target_revenue != null
                              ? formatCurrency(t.target_revenue)
                              : "-"}
                          </td>
                          <td>
                            {t.target_maco != null
                              ? formatCurrency(t.target_maco)
                              : "-"}
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <button
                                onClick={() => openEdit(t)}
                                className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted hover:text-blue-400 transition-all"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400 transition-all"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================== DIAS ÚTEIS TAB =================== */}
        {activeTab === "dias-uteis" && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form */}
              <div className="glass-card p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  Cadastrar / Editar Dias Úteis
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Ano
                    </label>
                    <div className="relative">
                      <select
                        value={bdYear}
                        onChange={(e) => setBdYear(Number(e.target.value))}
                        className="w-full appearance-none bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500"
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Mês
                    </label>
                    <div className="relative">
                      <select
                        value={bdMonth}
                        onChange={(e) => setBdMonth(Number(e.target.value))}
                        className="w-full appearance-none bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500"
                      >
                        {MONTHS.map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Total Dias Úteis
                    </label>
                    <input
                      type="number"
                      value={bdTotal}
                      onChange={(e) => setBdTotal(e.target.value)}
                      placeholder="Ex: 22"
                      className="w-full bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-dim focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Dias Transcorridos
                    </label>
                    <input
                      type="number"
                      value={bdElapsed}
                      onChange={(e) => setBdElapsed(e.target.value)}
                      placeholder="Ex: 15"
                      className="w-full bg-background border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-dim focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                {bdTotal && bdElapsed && (
                  <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <p className="text-xs text-muted">Dias Faltantes</p>
                    <p className="text-lg font-bold text-violet-400">
                      {Math.max(0, parseInt(bdTotal || "0") - parseInt(bdElapsed || "0"))}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSaveBusinessDay}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-500 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
              </div>

              {/* Table */}
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    Dias Úteis Cadastrados
                  </h3>
                </div>
                {businessDays.length === 0 ? (
                  <div className="p-8 text-center text-muted text-sm">
                    Nenhum registro
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ano</th>
                          <th>Mês</th>
                          <th>Total</th>
                          <th>Transcorridos</th>
                          <th>Faltam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {businessDays.map((bd) => (
                          <tr
                            key={bd.id}
                            className="cursor-pointer"
                            onClick={() => {
                              setBdYear(bd.year);
                              setBdMonth(bd.month);
                              setBdTotal(bd.total_days.toString());
                              setBdElapsed(bd.elapsed_days.toString());
                            }}
                          >
                            <td>{bd.year}</td>
                            <td>{MONTHS[bd.month - 1]}</td>
                            <td className="font-medium text-foreground">
                              {bd.total_days}
                            </td>
                            <td>{bd.elapsed_days}</td>
                            <td className="text-accent-blue font-medium">
                              {Math.max(0, bd.total_days - bd.elapsed_days)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
