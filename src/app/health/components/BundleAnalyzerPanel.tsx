"use client";

import React from "react";
import { Box } from "lucide-react";
import { BundleAnalyzerItem } from "@/lib/governance/performance";

interface BundleAnalyzerPanelProps {
  bundles: BundleAnalyzerItem[];
}

export const BundleAnalyzerPanel: React.FC<BundleAnalyzerPanelProps> = ({ bundles }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Box className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Analisador de Bundles Next.js & Code Splitting</h3>
          <p className="text-[11px] text-muted-foreground">Tamanho físico das páginas e estimativa de otimização Gzip</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
        {bundles.map((b) => (
          <div key={b.bundleName} className="p-3.5 bg-background border border-border rounded-xl space-y-1.5">
            <div className="flex items-center justify-between font-sans">
              <span className="font-bold text-foreground">{b.bundleName}</span>
              <span className="text-gold font-bold">{b.sizeKb} KB</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Gzip: {b.gzipSizeKb} KB</span>
              <span className="text-emerald-500 font-bold">{b.codeSplittingStatus}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
