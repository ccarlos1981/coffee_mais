"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateUserPdfPreferences } from "./actions";

interface EditUserPdfPreferencesProps {
  userId: string;
  receberVendas: boolean;
  receberInvestimento: boolean;
}

export function EditUserPdfPreferences({ userId, receberVendas, receberInvestimento }: EditUserPdfPreferencesProps) {
  const [vendas, setVendas] = useState(receberVendas);
  const [invest, setInvest] = useState(receberInvestimento);
  const [loading, setLoading] = useState(false);

  const handleChange = async (field: "vendas" | "investimento", value: boolean) => {
    if (field === "vendas") setVendas(value);
    if (field === "investimento") setInvest(value);
    
    setLoading(true);
    const result = await updateUserPdfPreferences(userId, field, value);
    
    if (result?.error) {
      toast.error(result.error);
      // Reverter em caso de erro
      if (field === "vendas") setVendas(!value);
      if (field === "investimento") setInvest(!value);
    } else {
      toast.success("Preferência de PDF atualizada!");
    }
    
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-4 mt-2">
      <label className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
        <input 
          type="checkbox" 
          checked={vendas}
          onChange={(e) => handleChange("vendas", e.target.checked)}
          disabled={loading}
          className="w-3 h-3 text-accent-gold border-border rounded focus:ring-accent-gold/20 disabled:opacity-50"
        />
        <span className="text-[10px] text-foreground-secondary uppercase font-semibold tracking-wider">PDF Vendas</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
        <input 
          type="checkbox" 
          checked={invest}
          onChange={(e) => handleChange("investimento", e.target.checked)}
          disabled={loading}
          className="w-3 h-3 text-accent-gold border-border rounded focus:ring-accent-gold/20 disabled:opacity-50"
        />
        <span className="text-[10px] text-foreground-secondary uppercase font-semibold tracking-wider">PDF Invest.</span>
      </label>
      {loading && <Loader2 className="w-3 h-3 animate-spin text-accent-gold" />}
    </div>
  );
}
