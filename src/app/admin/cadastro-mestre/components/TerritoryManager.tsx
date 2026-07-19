"use client";

import { useCadastroMestre, TerritoryMapping } from "../hooks";
import { Map, Edit2, Check, X } from "lucide-react";
import React, { useState } from "react";

export function TerritoryManager() {
  const { territories, managers, loading, updateTerritory } = useCadastroMestre();
  const [editingUf, setEditingUf] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState("");

  const handleEditInit = (t: TerritoryMapping) => {
    setEditingUf(t.uf);
    setSelectedManager(t.manager);
  };

  const handleSave = async (uf: string) => {
    if (!selectedManager) return;
    const success = await updateTerritory(uf, selectedManager);
    if (success) {
      setEditingUf(null);
      setSelectedManager("");
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-sm uppercase tracking-wider font-extrabold text-foreground flex items-center gap-2">
          <Map className="w-5 h-5 text-amber-500" />
          Mapeamento Territorial (UFs)
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Definição do gerente padrão responsável pelas UFs comerciais (Inside Sales / Carteiras default).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 text-[10px] uppercase text-muted-foreground tracking-wider bg-background/10">
              <th className="py-2.5 px-4 font-semibold w-24">Estado (UF)</th>
              <th className="py-2.5 px-4 font-semibold">Gerente Responsável Default</th>
              <th className="py-2.5 px-4 font-semibold text-right w-32">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-xs">
            {territories.map((t) => {
              const isEditing = editingUf === t.uf;

              return (
                <tr key={t.uf} className="hover:bg-muted/5 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-foreground/80">{t.uf}</td>
                  <td className="py-3 px-4">
                    {isEditing ? (
                      <select
                        value={selectedManager}
                        onChange={(e) => setSelectedManager(e.target.value)}
                        className="px-3 py-1 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      >
                        <option value="">Selecione um gerente...</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-medium text-foreground">{t.manager}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleSave(t.uf)}
                          className="p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingUf(null)}
                          className="p-1 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditInit(t)}
                        className="p-1 px-2.5 bg-card hover:bg-muted border border-border text-[10px] font-bold rounded-lg text-foreground transition-colors inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Alterar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
