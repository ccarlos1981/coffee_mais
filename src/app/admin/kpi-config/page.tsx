"use client";

import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  Settings, 
  Save, 
  ArrowLeft, 
  Layers, 
  Cpu, 
  Check, 
  AlertCircle, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  EyeOff
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface KPIConfig {
  id: string;
  kpi_id: string;
  weight: number;
  target_value: number;
  warning_threshold: number;
  critical_threshold: number;
  is_enabled: boolean;
  kpi: {
    kpi_key: string;
    display_name: string;
    category: string;
  };
}

interface WidgetConfig {
  widget_key: string;
  widget_order: number;
  is_enabled: boolean;
}

export default function KPIConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kpis, setKpis] = useState<KPIConfig[]>([]);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [useRealAi, setUseRealAi] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kpi-config");
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis);
        setWidgets(data.widgets);
        setUseRealAi(data.use_real_ai);
      } else {
        toast.error("Erro ao carregar configurações: " + data.error);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/kpi-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpis,
          widgets,
          use_real_ai: useRealAi
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Configurações salvas com sucesso!");
        await fetchSettings();
      } else {
        toast.error("Erro ao salvar: " + data.error);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const updateKpiField = (id: string, field: keyof KPIConfig, value: any) => {
    setKpis(prev => prev.map(k => k.id === id ? { ...k, [field]: value } : k));
  };

  const moveWidget = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === widgets.length - 1) return;

    const newWidgets = [...widgets];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    // Swap elements
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;

    // Update widget_order attributes
    const updated = newWidgets.map((w, idx) => ({ ...w, widget_order: idx + 1 }));
    setWidgets(updated);
  };

  const toggleWidgetActive = (key: string) => {
    setWidgets(prev => prev.map(w => w.widget_key === key ? { ...w, is_enabled: !w.is_enabled } : w));
  };

  const getWidgetDisplayName = (key: string) => {
    const names: Record<string, string> = {
      operacional: "Monitoramento Operacional",
      investigativa: "Painel Investigativo",
      executiva: "Visão Executiva",
      ai_vision: "Gôndola AI (Shelf / Price)",
      route_intelligence: "Route & Sell-Out Intelligence"
    };
    return names[key] || key;
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
                <Settings className="w-4 h-4" />
                Painel Administrativo
              </h1>
              <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-tight">
                Configurador de KPI & Widgets Dinâmicos
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
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Configurações
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
              Carregando Configurações...
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* KPI Config Table Column */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sliders className="w-40 h-40 text-amber-500" />
                </div>
                <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2 mb-1">
                  <Sliders className="w-4.5 h-4.5" />
                  Pesos & Limites de KPIs
                </h2>
                <p className="text-xs text-neutral-400 mb-6">
                  Defina os pesos de cálculo de score (0 a 100) e os limites de conformidade operacional.
                </p>

                <div className="space-y-6">
                  {kpis.map((kpi) => (
                    <div 
                      key={kpi.id} 
                      className={`border p-5 rounded-xl transition-all ${
                        kpi.is_enabled 
                          ? "bg-neutral-950/50 border-neutral-800" 
                          : "bg-neutral-950/20 border-neutral-950/80 opacity-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wide text-white">
                              {kpi.kpi.display_name}
                            </h3>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                              {kpi.kpi.category}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-500">
                            ID: {kpi.kpi.kpi_key}
                          </span>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => updateKpiField(kpi.id, "is_enabled", !kpi.is_enabled)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border flex items-center gap-1.5 ${
                            kpi.is_enabled
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                              : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800"
                          }`}
                        >
                          {kpi.is_enabled ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Ativo
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Inativo
                            </>
                          )}
                        </button>
                      </div>

                      {kpi.is_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                          {/* Weight Slider */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400 flex justify-between">
                              <span>Peso</span>
                              <span className="text-amber-500">{kpi.weight} pts</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={kpi.weight}
                              onChange={(e) => updateKpiField(kpi.id, "weight", parseFloat(e.target.value))}
                              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
                            />
                          </div>

                          {/* Target value */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400">
                              Alvo (Ideal)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={kpi.target_value}
                              onChange={(e) => updateKpiField(kpi.id, "target_value", parseFloat(e.target.value) || 0)}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                            />
                          </div>

                          {/* Warning threshold */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400">
                              Alerta (Warning)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={kpi.warning_threshold}
                              onChange={(e) => updateKpiField(kpi.id, "warning_threshold", parseFloat(e.target.value) || 0)}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                            />
                          </div>

                          {/* Critical threshold */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400">
                              Crítico (Critical)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={kpi.critical_threshold}
                              onChange={(e) => updateKpiField(kpi.id, "critical_threshold", parseFloat(e.target.value) || 0)}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Widget layout and AI Switcher column */}
            <div className="space-y-6">
              {/* AI Provider Switcher card */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2 mb-2">
                  <Cpu className="w-4.5 h-4.5" />
                  AI Native Foundation
                </h2>
                <p className="text-xs text-neutral-400 mb-5">
                  Selecione o mecanismo de execução de inteligência artificial em toda a plataforma.
                </p>

                <div className="flex items-center justify-between bg-neutral-950/50 p-4 border border-neutral-850 rounded-xl">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wide text-white">
                      Mecanismo AI Real
                    </h3>
                    <p className="text-[9px] text-neutral-500 mt-0.5">
                      {useRealAi 
                        ? "Usando Cloud Vision API / YOLOv8" 
                        : "Usando Simulação Analítica Legada"}
                    </p>
                  </div>

                  {/* Switcher Toggle */}
                  <button
                    onClick={() => setUseRealAi(!useRealAi)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                      useRealAi ? "bg-amber-500" : "bg-neutral-800"
                    }`}
                  >
                    <div
                      className={`bg-neutral-950 w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                        useRealAi ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-4 flex gap-2 border border-neutral-900 bg-neutral-950/20 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-neutral-400 leading-relaxed">
                    Ativar o mecanismo AI real roteará as requisições de shelf analysis e preços diretamente para os provedores configurados, consumindo créditos de APIs na nuvem.
                  </p>
                </div>
              </div>

              {/* Widget ordering card */}
              <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <h2 className="text-sm font-black uppercase text-amber-500 flex items-center gap-2 mb-2">
                  <Layers className="w-4.5 h-4.5" />
                  Layout do Dashboard
                </h2>
                <p className="text-xs text-neutral-400 mb-6">
                  Ordene e ative as abas de monitoramento mostradas no Command Center de supervisão.
                </p>

                <div className="space-y-3">
                  {widgets.map((widget, idx) => (
                    <div 
                      key={widget.widget_key} 
                      className={`flex items-center justify-between p-3.5 bg-neutral-950/50 border rounded-xl transition-all ${
                        widget.is_enabled ? "border-neutral-800" : "border-neutral-950/80 opacity-55"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Eye toggle check */}
                        <button
                          onClick={() => toggleWidgetActive(widget.widget_key)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            widget.is_enabled 
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                              : "bg-neutral-900 border-neutral-850 text-neutral-600 hover:text-neutral-400"
                          }`}
                        >
                          {widget.is_enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        
                        <div>
                          <h3 className="text-[11px] font-black uppercase text-white tracking-wide">
                            {getWidgetDisplayName(widget.widget_key)}
                          </h3>
                          <span className="text-[8px] font-mono text-neutral-500 uppercase">
                            Ordenação: {widget.widget_order}
                          </span>
                        </div>
                      </div>

                      {/* Direction Sorters */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveWidget(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 hover:bg-neutral-900 text-neutral-500 hover:text-white disabled:text-neutral-800 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveWidget(idx, "down")}
                          disabled={idx === widgets.length - 1}
                          className="p-1 hover:bg-neutral-900 text-neutral-500 hover:text-white disabled:text-neutral-800 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
