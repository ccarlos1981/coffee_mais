"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { useGovernanceMetrics } from "../hooks";

export function QualityHeader() {
  const { loading, refresh } = useGovernanceMetrics();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Painel
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-amber-500" />
          Qualidade Cadastral & Governança
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitoramento preventivo, índices de integridade cadastral e alertas de inconsistências.
        </p>
      </div>

      <div className="flex items-center gap-4 self-end sm:self-center">
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-muted/5 border border-border rounded-xl text-sm transition-colors text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-500" : ""}`} />
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
