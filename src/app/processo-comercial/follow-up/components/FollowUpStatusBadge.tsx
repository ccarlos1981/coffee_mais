"use client";

import React from "react";
import { Clock, PlayCircle, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { FollowUpStatus } from "@/lib/services/follow-up-service";

interface FollowUpStatusBadgeProps {
  status: FollowUpStatus | string;
  isAtrasada?: boolean;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDENTE: {
    label: "Pendente",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/30",
    icon: Clock,
  },
  EM_ANDAMENTO: {
    label: "Em Andamento",
    bg: "bg-sky-500/15",
    text: "text-sky-300",
    border: "border-sky-500/30",
    icon: PlayCircle,
  },
  CONCLUIDA: {
    label: "Concluída",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  NAO_EFETIVA: {
    label: "Não Efetiva",
    bg: "bg-orange-500/15",
    text: "text-orange-300",
    border: "border-orange-500/30",
    icon: AlertTriangle,
  },
  CANCELADA: {
    label: "Cancelada",
    bg: "bg-zinc-500/15",
    text: "text-zinc-400",
    border: "border-zinc-500/30",
    icon: XCircle,
  },
};

export function FollowUpStatusBadge({
  status,
  isAtrasada = false,
  size = "sm",
  showIcon = true,
  onClick,
  title,
  className = "",
}: FollowUpStatusBadgeProps) {
  const upperStatus = String(status || "").toUpperCase();
  const cfg = STATUS_CONFIG[upperStatus] || {
    label: status || "—",
    bg: "bg-muted/30",
    text: "text-foreground-muted",
    border: "border-border/40",
    icon: Clock,
  };

  const Icon = cfg.icon;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-[11px] px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
  }[size];

  return (
    <span
      onClick={onClick}
      title={title || `Status do Follow-up: ${cfg.label}`}
      className={`inline-flex items-center font-bold rounded-md border tracking-wide transition-all ${
        cfg.bg
      } ${cfg.text} ${cfg.border} ${sizeClasses} ${onClick ? "cursor-pointer hover:opacity-80" : ""} ${className}`}
    >
      {showIcon && <Icon className={iconSizes} />}
      <span>{cfg.label}</span>
      {isAtrasada && (
        <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-500/20 border border-rose-500/40 rounded px-1 ml-0.5">
          Atrasada
        </span>
      )}
    </span>
  );
}
