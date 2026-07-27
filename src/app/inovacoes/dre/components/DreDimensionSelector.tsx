"use client";

import React from "react";
import { Users, Building, UserCheck, MapPin, Tag, Box } from "lucide-react";

export type DreDimensionType = "cliente" | "rede" | "gerente" | "regiao" | "canal" | "sku";

interface DreDimensionSelectorProps {
  selectedDimension: DreDimensionType;
  onDimensionChange: (dim: DreDimensionType) => void;
  loading?: boolean;
}

export const DreDimensionSelector: React.FC<DreDimensionSelectorProps> = ({
  selectedDimension,
  onDimensionChange,
  loading = false,
}) => {
  const dimensions: Array<{ id: DreDimensionType; label: string; icon: React.ReactNode }> = [
    { id: "cliente", label: "Por Cliente", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "rede", label: "Por Rede", icon: <Building className="w-3.5 h-3.5" /> },
    { id: "gerente", label: "Por Gerente", icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: "regiao", label: "Por Região (UF)", icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: "canal", label: "Por Canal", icon: <Tag className="w-3.5 h-3.5" /> },
    { id: "sku", label: "Por SKU", icon: <Box className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border">
      {dimensions.map((dim) => (
        <button
          key={dim.id}
          type="button"
          onClick={() => onDimensionChange(dim.id)}
          disabled={loading}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50 ${
            selectedDimension === dim.id
              ? "bg-gold text-gold-foreground shadow-sm font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          }`}
        >
          {dim.icon}
          <span>{dim.label}</span>
        </button>
      ))}
    </div>
  );
};
