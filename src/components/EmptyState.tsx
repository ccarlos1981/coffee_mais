import React from "react";
import { SearchX, BarChart3, PackageOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  type?: "filter" | "chart" | "data";
  onClearFilters?: () => void;
  className?: string;
  minHeight?: number;
}

export function EmptyState({
  title = "Nenhum dado encontrado",
  message = "Tente ajustar seus filtros para ver resultados.",
  type = "filter",
  onClearFilters,
  className = "",
  minHeight = 300,
}: EmptyStateProps) {
  const Icon = type === "filter" ? SearchX : type === "chart" ? BarChart3 : PackageOpen;

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center h-full w-full rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--background-card)]/50 ${className}`}
      style={{ minHeight: `${minHeight}px` }}
    >
      <div className="w-16 h-16 rounded-full shadow-inner bg-[var(--border-light)] flex items-center justify-center mb-4 relative overflow-hidden">
        {/* Decorative inner glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent-gold)]/20 to-transparent opacity-50" />
        <Icon className="w-8 h-8 text-[var(--foreground-muted)] relative z-10" />
      </div>
      
      <h3 className="text-lg font-bold text-[var(--foreground-secondary)] mb-2 tracking-tight">
        {title}
      </h3>
      
      <p className="text-[0.8rem] text-[var(--foreground-muted)] max-w-sm mx-auto mb-6 leading-relaxed">
        {message}
      </p>
      
      {onClearFilters && (
        <button
          onClick={onClearFilters}
          className="px-5 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-all duration-200 text-xs font-semibold uppercase tracking-wider"
        >
          Limpar Filtros
        </button>
      )}
    </div>
  );
}
