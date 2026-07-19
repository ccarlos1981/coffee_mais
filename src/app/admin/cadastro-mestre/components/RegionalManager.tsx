"use client";

import { useCadastroMestre, RegionalRule } from "../hooks";
import { Plus, Trash2, ShieldAlert, Award, Globe } from "lucide-react";
import React, { useState } from "react";

export function RegionalManager() {
  const { regionals, redes, managers, createRegional, deleteRegional } = useCadastroMestre();
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [matrizId, setMatrizId] = useState("");
  const [estado, setEstado] = useState("");
  const [gerenteId, setGerenteId] = useState("");

  const resetForm = () => {
    setMatrizId("");
    setEstado("");
    setGerenteId("");
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matrizId || !estado || !gerenteId) {
      alert("Preencha todos os campos obrigatórios (*).");
      return;
    }

    if (estado.length !== 2) {
      alert("A UF deve possuir exatamente 2 caracteres.");
      return;
    }

    const success = await createRegional(matrizId, estado.toUpperCase(), gerenteId);
    if (success) resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente remover esta regionalização comercial?")) {
      await deleteRegional(id);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h3 className="text-sm uppercase tracking-wider font-extrabold text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-500" />
            Regionalização de Carteiras (Key Accounts)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exceções regionais onde uma Matriz é atendida por gerentes específicos dependendo da UF física da filial.
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-semibold text-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Regra
          </button>
        )}
      </div>

      {isAdding ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-background/20 border border-border p-5 rounded-2xl">
          <h4 className="text-xs uppercase tracking-wider font-bold text-foreground border-b border-border/50 pb-2">
            Adicionar Regra Regionalizada
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Matriz Comercial *</label>
              <select
                value={matrizId}
                onChange={(e) => setMatrizId(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Selecione a matriz...</option>
                {redes.map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {r.nome} (Cód. {r.codigo})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Estado (UF) *</label>
              <input
                type="text"
                placeholder="Ex: RS"
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Gerente Comercial Responsável *</label>
            <select
              value={gerenteId}
              onChange={(e) => setGerenteId(e.target.value)}
              className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="">Selecione o gerente...</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 border border-border hover:bg-muted/10 rounded-xl text-xs font-semibold text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-semibold text-white"
            >
              Salvar Regra
            </button>
          </div>
        </form>
      ) : (
        <div className="overflow-x-auto">
          {regionals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs bg-background/20 border border-dashed border-border rounded-xl">
              Nenhuma regionalização customizada de atendimento cadastrada.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[10px] uppercase text-muted-foreground tracking-wider bg-background/10">
                  <th className="py-2.5 px-4 font-semibold">Cód. Matriz</th>
                  <th className="py-2.5 px-4 font-semibold">Rede Comercial</th>
                  <th className="py-2.5 px-4 font-semibold">Estado (UF)</th>
                  <th className="py-2.5 px-4 font-semibold">Gerente Regionalizado</th>
                  <th className="py-2.5 px-4 font-semibold text-right w-24">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {regionals.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground/80">{r.cliente_matriz_id}</td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {r.cm_redes_matrizes?.nome || "Carregando..."}
                    </td>
                    <td className="py-3 px-4 font-mono">{r.estado}</td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {r.cm_user_profiles?.name || "Carregando..."}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                        title="Remover Regionalização"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
