"use client";

import { useGovernanceMetrics } from "../hooks";
import { AlertCircle, ShieldCheck, Percent, Users, AlertTriangle } from "lucide-react";

export function QualityKpiCards() {
  const { loading, error, data } = useGovernanceMetrics();

  // Helper to format values as pt-BR thousands separators
  const formatNumber = (num: number) => {
    return num.toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6 h-32 space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-2xl flex items-center gap-3">
        <AlertCircle className="w-8 h-8 shrink-0" />
        <div>
          <h4 className="font-semibold">Erro ao carregar indicadores</h4>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.current_metrics) {
    return (
      <div className="bg-card border border-border text-muted-foreground p-6 rounded-2xl text-center">
        Nenhum indicador disponível no momento.
      </div>
    );
  }

  const kpis = data.current_metrics;
  const iqcNum = parseFloat(kpis.iqc_score);

  // Dynamic scale colors for IQC
  const getIqcColor = (score: number) => {
    if (score >= 95) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 90) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-destructive bg-destructive/10 border-destructive/20";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* IQC Score */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">IQC (Qualidade)</span>
          <div className="text-3xl font-extrabold text-foreground">{kpis.iqc_score}%</div>
          <p className="text-xs text-muted-foreground">Cadastros consistentes</p>
        </div>
        <div className={`p-3 rounded-xl border ${getIqcColor(iqcNum)}`}>
          <ShieldCheck className="w-6 h-6" />
        </div>
      </div>

      {/* Cobertura Comercial */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cobertura Comercial</span>
          <div className="text-3xl font-extrabold text-foreground">{kpis.cobertura_score}%</div>
          <p className="text-xs text-muted-foreground">Clientes com responsável</p>
        </div>
        <div className="p-3 rounded-xl border bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
          <Percent className="w-6 h-6" />
        </div>
      </div>

      {/* Clientes Totais */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clientes Auditados</span>
          <div className="text-3xl font-extrabold text-foreground">{formatNumber(kpis.total_clientes)}</div>
          <p className="text-xs text-muted-foreground">Total da base cadastral</p>
        </div>
        <div className="p-3 rounded-xl border bg-blue-500/10 text-blue-500 border-blue-500/20">
          <Users className="w-6 h-6" />
        </div>
      </div>

      {/* Inconsistências Ativas */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inconsistências</span>
          <div className={`text-3xl font-extrabold ${kpis.total_inconsistencias > 0 ? "text-amber-500" : "text-foreground"}`}>
            {formatNumber(kpis.total_inconsistencias)}
          </div>
          <p className="text-xs text-muted-foreground">Correções preventivas pendentes</p>
        </div>
        <div className={`p-3 rounded-xl border ${kpis.total_inconsistencias > 0 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-muted text-muted-foreground border-border"}`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
