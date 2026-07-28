"use client";

import React from "react";
import { Users, Building2, Store, Phone, Mail, MapPin } from "lucide-react";
import { CustomerUnifiedItem } from "@/lib/crm-enterprise";

interface CrmCadastroUnificadoPanelProps {
  customers: CustomerUnifiedItem[];
}

export const CrmCadastroUnificadoPanel: React.FC<CrmCadastroUnificadoPanelProps> = ({ customers }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Cadastro Comercial Unificado (Clientes, Redes & PDVs)</h3>
            <p className="text-[11px] text-muted-foreground">
              Visão consolidada de dados cadastrais, contatos estratégicos, gerente responsável e saúde comercial
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-gold/10 text-gold border border-gold/20">
          {customers.length} Entidades Cadastradas
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Código / Nome</th>
              <th className="py-2.5 px-3">Tipo</th>
              <th className="py-2.5 px-3">UF / Cidade</th>
              <th className="py-2.5 px-3">Gerente Responsável</th>
              <th className="py-2.5 px-3">Contato Principal</th>
              <th className="py-2.5 px-3">Fat. Médio Mensal</th>
              <th className="py-2.5 px-3 text-right">Status / Health Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gold" />
                    <div>
                      <span className="block font-bold">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{c.code} • CNPJ: {c.cnpj}</span>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <span className="px-2 py-0.5 rounded bg-muted text-gold font-bold border border-border/50 text-[10px]">
                    {c.type}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-sans">
                  {c.city}/{c.uf} ({c.regional})
                </td>
                <td className="py-2.5 px-3 text-foreground font-sans font-semibold">
                  {c.accountManager}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-sans">
                  <span className="block text-foreground font-medium">{c.primaryContactName}</span>
                  <span className="text-[10px] block">{c.primaryContactPhone}</span>
                </td>
                <td className="py-2.5 px-3 font-bold text-foreground">
                  {formatCurrency(c.monthlyRevenueAvg)}
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  <span
                    className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] border ${
                      c.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : c.status === "RISK"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    }`}
                  >
                    {c.status} ({c.healthScore}/100)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
