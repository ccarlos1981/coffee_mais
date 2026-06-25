"use client";

import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  Settings, 
  Save, 
  ArrowLeft, 
  Cpu, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Power,
  ShieldAlert,
  History,
  Activity,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Layers
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface KPIConfig {
  id: string;
  kpi_code: string;
  weight: number;
  threshold_low: number;
  threshold_medium: number;
  threshold_high: number;
  target_value: number;
  is_enabled: boolean;
  kpi: {
    kpi_key: string;
    display_name: string;
    category: string;
  };
}

interface GovernancePolicies {
  ai_autonomy_level: "MANUAL" | "ASSISTED" | "SEMI_AUTONOMOUS" | "FULLY_AUTONOMOUS";
  min_confidence_to_act: number;
  require_human_approval: boolean;
  max_discount_allowed: number;
  emergency_ai_stop: boolean;
  max_kpi_weight_shift: number;
}

interface ConfigVersion {
  id: string;
  version: number;
  created_at: string;
  user?: {
    id: string;
    role: string;
  };
}

interface DecisionLog {
  id: string;
  decision_type: string;
  model_confidence: number;
  created_at: string;
  decision_payload: {
    approved: boolean;
    reason: string;
    badge: string;
  };
  input_payload?: any;
}

export default function AIGovernancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kpis, setKpis] = useState<KPIConfig[]>([]);
  const [policies, setPolicies] = useState<GovernancePolicies>({
    ai_autonomy_level: "SEMI_AUTONOMOUS",
    min_confidence_to_act: 80,
    require_human_approval: true,
    max_discount_allowed: 15,
    emergency_ai_stop: false,
    max_kpi_weight_shift: 5
  });
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchDecisionLogs();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch KPI config
      const resKpis = await fetch("/api/admin/kpi-config");
      const dataKpis = await resKpis.json();

      // 2. Fetch Governance policies
      const resGov = await fetch("/api/admin/ai-governance");
      const dataGov = await resGov.json();

      if (dataKpis.success && dataGov.success) {
        setKpis(dataKpis.kpis);
        setPolicies(dataGov.policies);
        setVersions(dataGov.versions);
      } else {
        toast.error("Erro ao carregar configurações.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDecisionLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/supervisor/decision-log");
      const data = await res.json();
      if (data.success) {
        setDecisionLogs(data.logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Calculate sum of weights of enabled KPIs
  const enabledKpisSum = kpis
    .filter(k => k.is_enabled)
    .reduce((sum, k) => sum + k.weight, 0);

  const isWeightSumValid = Math.abs(enabledKpisSum - 100) <= 0.01;

  const handleSave = async () => {
    if (!isWeightSumValid) {
      toast.error(`A soma dos pesos dos KPIs habilitados deve ser exatamente 100% (atual: ${enabledKpisSum.toFixed(1)}%).`);
      return;
    }

    setSaving(true);
    try {
      // 1. Save KPI configs
      const resKpi = await fetch("/api/admin/kpi-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpis })
      });
      const dataKpi = await resKpi.json();

      // 2. Save Governance Policies
      const resGov = await fetch("/api/admin/ai-governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policies })
      });
      const dataGov = await resGov.json();

      if (dataKpi.success && dataGov.success) {
        toast.success("Configurações de Governança salvas com sucesso!");
        fetchSettings();
      } else {
        toast.error(dataKpi.error || dataGov.error || "Erro ao salvar.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  };

  const updateKpiField = (id: string, field: keyof KPIConfig, value: any) => {
    setKpis(prev => prev.map(k => k.id === id ? { ...k, [field]: value } : k));
  };

  const updatePolicyField = (key: keyof GovernancePolicies, value: any) => {
    setPolicies(prev => ({ ...prev, [key]: value }));
  };

  const getAutonomyLabel = (level: string) => {
    const labels: Record<string, string> = {
      MANUAL: "Manual (Supervisor Aprova Tudo)",
      ASSISTED: "Assistida (Fila de Liberação)",
      SEMI_AUTONOMOUS: "Semi-Autônoma (Executa Ações Simples)",
      FULLY_AUTONOMOUS: "Totalmente Autônoma"
    };
    return labels[level] || level;
  };

  const getKPIFriendlyName = (code: string) => {
    const names: Record<string, string> = {
      rupture_rate: "Ruptura (Stock Risk)",
      price_gap: "Preço Competitivo (Price Gap)",
      share_of_shelf: "Participação de Gôndola (Shelf Share)",
      sellout_velocity: "Giro de Vendas (Sell-Out)",
      coverage_rate: "Cobertura de Visitas",
      conversion_rate: "Taxa de Conversão",
      ROI: "Retorno sobre Investimento (ROI)"
    };
    return names[code] || code;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-amber-500 selection:text-neutral-900">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/supervisor/command-center" 
              className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                AI Governance & Policy Editor
              </h1>
              <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight">
                Parametrização por Tenant, Autonomia e Controle Operacional
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-lg transition-all shadow-lg hover:shadow-amber-500/10 disabled:text-neutral-500"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                Gravando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Regras de Governança
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase font-black text-neutral-400 tracking-wider">
              Carregando Governança e Regras...
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1 & 2: KPI Configs and Thresholds */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Emergency Banner */}
              {policies.emergency_ai_stop && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3 animate-pulse">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black uppercase text-red-500">Parada de Emergência Ativa</h3>
                    <p className="text-[10px] text-red-400 leading-relaxed uppercase font-semibold mt-1">
                      A IA continuará recomendando, porém a execução ou aprovação automática foi desativada no backend. Todas as ações exigem liberação manual.
                    </p>
                  </div>
                </div>
              )}

              {/* KPI Weight Slider Card */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2">
                      <Sliders className="w-4.5 h-4.5" />
                      Widget 1 — KPI Weight Editor
                    </h2>
                    <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight">
                      Distribuição de importância analítica para o priority score das recomendações
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase border tracking-wider ${
                    isWeightSumValid 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                      : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                  }`}>
                    Soma: {enabledKpisSum.toFixed(1)}% / 100%
                  </div>
                </div>

                <div className="space-y-4">
                  {kpis.map((kpi) => (
                    <div 
                      key={kpi.id} 
                      className={`border p-4 rounded-xl transition-all ${
                        kpi.is_enabled 
                          ? "bg-neutral-950/50 border-neutral-800" 
                          : "bg-neutral-950/10 border-neutral-950 opacity-40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateKpiField(kpi.id, "is_enabled", !kpi.is_enabled)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              kpi.is_enabled
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                : "bg-neutral-900 border-neutral-850 text-neutral-600"
                            }`}
                          >
                            {kpi.is_enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <h3 className="text-[11px] font-black uppercase tracking-wide text-white">
                              {getKPIFriendlyName(kpi.kpi_code)}
                            </h3>
                            <span className="text-[9px] font-bold text-neutral-500 font-mono">
                              KEY: {kpi.kpi_code}
                            </span>
                          </div>
                        </div>

                        {kpi.is_enabled && (
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <span className="text-[11px] font-black font-mono text-amber-500 w-12 text-right">
                              {kpi.weight}%
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={kpi.weight}
                              onChange={(e) => updateKpiField(kpi.id, "weight", parseInt(e.target.value))}
                              className="accent-amber-500 cursor-pointer h-1.5 bg-neutral-850 rounded-lg appearance-none w-32 md:w-44"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Widget 2: Thresholds Configuration */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
                <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2 mb-1">
                  <Layers className="w-4.5 h-4.5" />
                  Widget 2 — Threshold Configuration
                </h2>
                <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight mb-6">
                  Limiares operacionais por KPI para escalonamento de alertas (LOW, MEDIUM, HIGH)
                </p>

                <div className="space-y-4">
                  {kpis.filter(k => k.is_enabled).map((kpi) => (
                    <div key={kpi.id} className="p-4 bg-neutral-950/40 border border-neutral-850 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div className="md:col-span-1">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
                          {kpi.kpi_code.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 md:col-span-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-500">LOW</label>
                          <input
                            type="number"
                            step="0.01"
                            value={kpi.threshold_low}
                            onChange={(e) => updateKpiField(kpi.id, "threshold_low", parseFloat(e.target.value) || 0)}
                            className="w-full bg-neutral-950 border border-neutral-900 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-500">MEDIUM (WARN)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={kpi.threshold_medium}
                            onChange={(e) => updateKpiField(kpi.id, "threshold_medium", parseFloat(e.target.value) || 0)}
                            className="w-full bg-neutral-950 border border-neutral-900 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-neutral-500">HIGH (CRIT)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={kpi.threshold_high}
                            onChange={(e) => updateKpiField(kpi.id, "threshold_high", parseFloat(e.target.value) || 0)}
                            className="w-full bg-neutral-950 border border-neutral-900 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Widget 4: Decision Audit Viewer */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2">
                      <Activity className="w-4.5 h-4.5" />
                      Widget 4 — Decision Audit Viewer
                    </h2>
                    <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight">
                      Registro em tempo real da governança e decisões avaliadas
                    </p>
                  </div>
                  <button 
                    onClick={fetchDecisionLogs}
                    className="p-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs font-black uppercase text-neutral-400 hover:text-white"
                  >
                    Recarregar Logs
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs text-neutral-400">
                    <thead>
                      <tr className="border-b border-neutral-900 text-[10px] text-neutral-500 font-black uppercase">
                        <th className="pb-2">Decisão</th>
                        <th className="pb-2">Resultado / Badge</th>
                        <th className="pb-2">Confiança</th>
                        <th className="pb-2">Data / Hora</th>
                        <th className="pb-2">Justificativa da Governança</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/40">
                      {loadingLogs ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-neutral-600">Carregando auditoria...</td>
                        </tr>
                      ) : decisionLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-neutral-600">Nenhuma decisão registrada até o momento.</td>
                        </tr>
                      ) : (
                        decisionLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-neutral-900/30 text-[11px]">
                            <td className="py-2.5 font-bold text-white uppercase">{log.decision_type.replace('_', ' ')}</td>
                            <td className="py-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                log.decision_payload.approved
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}>
                                {log.decision_payload.approved ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                                {log.decision_payload.badge}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono font-bold text-neutral-300">{log.model_confidence}%</td>
                            <td className="py-2.5 font-mono text-neutral-500">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="py-2.5 text-neutral-300 italic max-w-xs truncate">{log.decision_payload.reason}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Column 3: AI Policies & Versions */}
            <div className="space-y-6">
              
              {/* Widget 3: AI Autonomy Control */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Cpu className="w-40 h-40 text-amber-500" />
                </div>
                <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2 mb-1">
                  <Cpu className="w-4.5 h-4.5" />
                  Widget 3 — AI Autonomy Control
                </h2>
                <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight mb-6">
                  Gerencie a liberdade de execução operacional delegada à IA
                </p>

                <div className="space-y-6">
                  {/* Emergency Kill switch */}
                  <div className="p-4 rounded-xl border border-red-500/20 bg-neutral-950/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wide text-red-500 flex items-center gap-1.5">
                          <Power className="w-3.5 h-3.5" />
                          Emergency Stop
                        </h3>
                        <p className="text-[8px] text-neutral-500 uppercase font-semibold mt-0.5">
                          Parada operacional de execução de IA
                        </p>
                      </div>
                      <button
                        onClick={() => updatePolicyField("emergency_ai_stop", !policies.emergency_ai_stop)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border ${
                          policies.emergency_ai_stop
                            ? "bg-red-500 text-neutral-950 border-red-500 hover:bg-red-400"
                            : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white"
                        }`}
                      >
                        {policies.emergency_ai_stop ? "ATIVO" : "DESATIVADO"}
                      </button>
                    </div>
                  </div>

                  {/* Autonomy Level Select */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-neutral-400">Nível de Autonomia</label>
                    <div className="grid grid-cols-1 gap-2">
                      {["MANUAL", "ASSISTED", "SEMI_AUTONOMOUS", "FULLY_AUTONOMOUS"].map((level) => (
                        <button
                          key={level}
                          onClick={() => updatePolicyField("ai_autonomy_level", level)}
                          className={`p-3 text-left rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between ${
                            policies.ai_autonomy_level === level
                              ? "bg-amber-500/10 border-amber-500 text-amber-500"
                              : "bg-neutral-950/30 border-neutral-900 text-neutral-500 hover:text-white hover:border-neutral-800"
                          }`}
                        >
                          <span>{getAutonomyLabel(level)}</span>
                          {policies.ai_autonomy_level === level && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Min confidence to act */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-neutral-400 flex justify-between">
                      <span>Confiança Mínima para Agir</span>
                      <span className="text-amber-500">{policies.min_confidence_to_act}%</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      value={policies.min_confidence_to_act}
                      onChange={(e) => updatePolicyField("min_confidence_to_act", parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-850 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Max discount allowed */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-neutral-400 flex justify-between">
                      <span>Desconto Máximo Permitido</span>
                      <span className="text-amber-500">{policies.max_discount_allowed}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      step="1"
                      value={policies.max_discount_allowed}
                      onChange={(e) => updatePolicyField("max_discount_allowed", parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-850 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Max weights shift */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-neutral-400 flex justify-between">
                      <span>Variação Máxima de Pesos Recalibrados</span>
                      <span className="text-amber-500">±{policies.max_kpi_weight_shift}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={policies.max_kpi_weight_shift}
                      onChange={(e) => updatePolicyField("max_kpi_weight_shift", parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-850 rounded-lg appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Version snapshot history widget */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
                <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2 mb-1">
                  <History className="w-4.5 h-4.5" />
                  Config Version History
                </h2>
                <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight mb-6">
                  Histórico de Snapshots e Rollback de governança
                </p>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {versions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-neutral-600 uppercase font-bold">
                      Sem versões registradas
                    </div>
                  ) : (
                    versions.map((ver) => (
                      <div key={ver.id} className="p-3 bg-neutral-950/50 border border-neutral-850 rounded-xl text-xs flex flex-col gap-1 hover:border-neutral-800 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-amber-500 uppercase tracking-wide">Versão #{ver.version}</span>
                          <span className="text-[9px] text-neutral-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(ver.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-semibold uppercase mt-1">
                          <User className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Papel: {ver.user?.role || "Admin"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
