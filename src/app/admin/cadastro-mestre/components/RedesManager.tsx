"use client";

import { useCadastroMestre, RedeData } from "../hooks";
import { Plus, Edit2, ShieldAlert, Award, Hash, ArrowUpRight, HelpCircle } from "lucide-react";
import React, { useState, useEffect } from "react";
import { CommercialDomainService, SelectOption } from "@/lib/domain";

export function RedesManager() {
  const { redes, managers, loading, error, createRede, updateRede } = useCadastroMestre();
  const [isEditing, setIsEditing] = useState(false);
  const [editingRede, setEditingRede] = useState<RedeData | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("KA");
  const [managerId, setManagerId] = useState("");
  const [channelOptions, setChannelOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    CommercialDomainService.getChannelOptions().then((opts) => {
      setChannelOptions(opts);
      if (opts.length > 0) {
        setChannel(opts[0].value);
      }
    });
  }, []);

  const resetForm = () => {
    setCode("");
    setName("");
    setChannel(channelOptions[0]?.value || "KA");
    setManagerId("");
    setEditingRede(null);
    setIsEditing(false);
  };

  const handleEditInit = (rede: RedeData) => {
    setEditingRede(rede);
    setCode(rede.codigo);
    setName(rede.nome);
    setChannel(rede.canal || "Key Account");
    setManagerId(rede.manager_id || "");
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !managerId) {
      alert("Todos os campos obrigatórios (*) devem ser preenchidos.");
      return;
    }

    const selectedManager = managers.find(m => m.id === managerId);
    if (!selectedManager) {
      alert("Gerente selecionado inválido.");
      return;
    }

    const payload = {
      codigo: code,
      nome: name,
      canal: channel,
      manager_id: selectedManager.id,
      manager: selectedManager.name
    };

    const success = editingRede ? await updateRede(payload) : await createRede(payload);
    if (success) resetForm();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h3 className="text-sm uppercase tracking-wider font-extrabold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Cadastro de Redes & Matrizes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manutenção direta da tabela oficial cm_redes_matrizes.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-semibold text-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Rede/Matriz
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-background/20 border border-border p-5 rounded-2xl">
          <h4 className="text-xs uppercase tracking-wider font-bold text-foreground border-b border-border/50 pb-2">
            {editingRede ? `Editar Rede: ${editingRede.nome}` : "Cadastrar Nova Rede / Matriz"}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Código Matriz *</label>
              <input
                type="text"
                disabled={!!editingRede}
                placeholder="Ex: 76191.2"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Nome da Rede *</label>
              <input
                type="text"
                placeholder="Ex: SUPERMERCADO ZAFFARI"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Canal Comercial *</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {channelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Gerente Autorizado *</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full px-3 py-1.5 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Selecione um gerente...</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
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
              {editingRede ? "Salvar Alterações" : "Criar Rede/Matriz"}
            </button>
          </div>
        </form>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 text-[10px] uppercase text-muted-foreground tracking-wider">
                <th className="pb-3 px-4 font-semibold">Cód. Matriz</th>
                <th className="pb-3 px-4 font-semibold">Rede Comercial</th>
                <th className="pb-3 px-4 font-semibold">Canal</th>
                <th className="pb-3 px-4 font-semibold">Gerente Responsável</th>
                <th className="pb-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-xs">
              {redes.map((rede) => (
                <tr key={rede.codigo} className="hover:bg-muted/5 transition-colors group">
                  <td className="py-3 px-4 font-mono font-bold text-foreground/80">{rede.codigo}</td>
                  <td className="py-3 px-4 font-semibold text-foreground">{rede.nome}</td>
                  <td className="py-3 px-4 text-muted-foreground">{rede.canal || "-"}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{rede.manager || "Não associado"}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleEditInit(rede)}
                      className="p-1 px-2.5 bg-card hover:bg-muted border border-border text-[10px] font-bold rounded-lg text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
