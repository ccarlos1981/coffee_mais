"use client";

import { useGovernanceMetrics } from "../hooks";
import { LineChart, AlertCircle, TrendingUp } from "lucide-react";

export function QualityTrendChart() {
  const { loading, error, data } = useGovernanceMetrics();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm animate-pulse space-y-6 h-[320px]">
        <div className="h-5 bg-muted rounded w-1/3"></div>
        <div className="h-48 bg-muted rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return null; // The cards will display the error, no need to duplicate error displays
  }

  const history = data?.history || [];

  if (history.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm h-[320px] flex flex-col items-center justify-center text-center">
        <LineChart className="w-12 h-12 text-muted-foreground/30 mb-3" />
        <h4 className="font-semibold text-foreground">Histórico Vazio</h4>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          Aguardando a execução do primeiro pg_cron semanal para plotagem de tendências.
        </p>
      </div>
    );
  }

  // Width and Height of SVG viewBox
  const width = 600;
  const height = 220;
  const padding = 25;

  const pointsCount = history.length;
  const getX = (index: number) => {
    if (pointsCount <= 1) return width / 2;
    return padding + (index * (width - 2 * padding)) / (pointsCount - 1);
  };

  // Maps score (0 - 100) to SVG height (height-padding down to padding)
  const getY = (scoreStr: string) => {
    const score = parseFloat(scoreStr) || 0;
    const chartHeight = height - 2 * padding;
    return height - padding - (score / 100) * chartHeight;
  };

  // Build SVG Path strings
  let iqcPath = "";
  let cobPath = "";

  history.forEach((point, i) => {
    const x = getX(i);
    const yIqc = getY(point.iqc_score);
    const yCob = getY(point.cobertura_score);

    if (i === 0) {
      iqcPath = `M ${x} ${yIqc}`;
      cobPath = `M ${x} ${yCob}`;
    } else {
      iqcPath += ` L ${x} ${yIqc}`;
      cobPath += ` L ${x} ${yCob}`;
    }
  });

  // If only 1 point, draw flat line or circle
  if (pointsCount === 1) {
    const yIqc = getY(history[0].iqc_score);
    const yCob = getY(history[0].cobertura_score);
    iqcPath = `M ${padding} ${yIqc} L ${width - padding} ${yIqc}`;
    cobPath = `M ${padding} ${yCob} L ${width - padding} ${yCob}`;
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          Tendência Histórica da Qualidade
        </h3>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-muted-foreground">IQC (Qualidade)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
            <span className="text-muted-foreground">Cobertura</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Grid lines */}
          <line x1={padding} y1={getY("100")} x2={width - padding} y2={getY("100")} className="stroke-border/30 stroke-1" strokeDasharray="4 4" />
          <line x1={padding} y1={getY("75")} x2={width - padding} y2={getY("75")} className="stroke-border/30 stroke-1" strokeDasharray="4 4" />
          <line x1={padding} y1={getY("50")} x2={width - padding} y2={getY("50")} className="stroke-border/30 stroke-1" strokeDasharray="4 4" />
          <line x1={padding} y1={getY("25")} x2={width - padding} y2={getY("25")} className="stroke-border/30 stroke-1" strokeDasharray="4 4" />
          <line x1={padding} y1={getY("0")} x2={width - padding} y2={getY("0")} className="stroke-border/50 stroke-1" />

          {/* Grid Labels */}
          <text x={padding - 5} y={getY("100") + 4} className="text-[10px] font-semibold fill-muted-foreground/60 text-right" textAnchor="end">100%</text>
          <text x={padding - 5} y={getY("75") + 4} className="text-[10px] font-semibold fill-muted-foreground/60 text-right" textAnchor="end">75%</text>
          <text x={padding - 5} y={getY("50") + 4} className="text-[10px] font-semibold fill-muted-foreground/60 text-right" textAnchor="end">50%</text>
          <text x={padding - 5} y={getY("25") + 4} className="text-[10px] font-semibold fill-muted-foreground/60 text-right" textAnchor="end">25%</text>
          <text x={padding - 5} y={getY("0") + 4} className="text-[10px] font-semibold fill-muted-foreground/60 text-right" textAnchor="end">0%</text>

          {/* Paths */}
          <path d={iqcPath} fill="none" className="stroke-amber-500 stroke-[3] stroke-round" />
          <path d={cobPath} fill="none" className="stroke-indigo-500 stroke-[3] stroke-round" />

          {/* Circles at data points */}
          {history.map((point, i) => {
            const x = getX(i);
            const yIqc = getY(point.iqc_score);
            const yCob = getY(point.cobertura_score);
            return (
              <g key={i} className="group/dot cursor-pointer">
                {/* IQC Dot */}
                <circle cx={x} cy={yIqc} r="5" className="fill-background stroke-amber-500 stroke-2 transition-all group-hover/dot:r-7" />
                {/* Cobertura Dot */}
                <circle cx={x} cy={yCob} r="5" className="fill-background stroke-indigo-500 stroke-2 transition-all group-hover/dot:r-7" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Dates row below the chart */}
      <div className="flex justify-between px-6 text-[10px] font-semibold text-muted-foreground border-t border-border/30 pt-3">
        {history.map((point, i) => (
          <div key={i} className="text-center">
            {new Date(point.snapshot_date + "T12:00:00").toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
