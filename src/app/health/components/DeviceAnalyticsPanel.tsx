"use client";

import React from "react";
import { Monitor, Smartphone, Tablet, CheckCircle2 } from "lucide-react";
import { DeviceAnalyticsItem } from "@/lib/governance/telemetry";

interface DeviceAnalyticsPanelProps {
  deviceAnalytics: DeviceAnalyticsItem[];
}

export const DeviceAnalyticsPanel: React.FC<DeviceAnalyticsPanelProps> = ({ deviceAnalytics }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
          <Monitor className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Análise de Dispositivos & Navegadores (Frente 6)</h3>
          <p className="text-[11px] text-muted-foreground">
            Distribuição de uso entre Desktop, Mobile e Tablet e tempo de resposta médio
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {deviceAnalytics.map((item) => (
          <div key={item.deviceType} className="p-3.5 bg-background border border-border rounded-xl space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.deviceType === "DESKTOP" && <Monitor className="w-4 h-4 text-amber-500" />}
                {item.deviceType === "MOBILE" && <Smartphone className="w-4 h-4 text-amber-500" />}
                {item.deviceType === "TABLET" && <Tablet className="w-4 h-4 text-amber-500" />}
                <span className="font-bold text-foreground font-sans">{item.deviceType}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-sans">
                {item.experienceStatus}
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-sans">{item.browser}</p>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
              <span>Share de Acessos: <strong className="text-amber-500">{item.accessSharePct}%</strong></span>
              <span>Latência Média: <strong className="text-emerald-500">{item.avgResponseMs}ms</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
