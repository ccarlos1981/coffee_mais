"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateUserRole } from "./actions";

interface EditUserRoleSelectProps {
  userId: string;
  currentRole: string;
  roles: string[];
}

export function EditUserRoleSelect({ userId, currentRole, roles }: EditUserRoleSelectProps) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (newRole === currentRole) return;
    
    setLoading(true);
    const result = await updateUserRole(userId, newRole);
    
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(result?.message || "Cargo atualizado com sucesso!");
    }
    
    setLoading(false);
  };

  return (
    <div className="relative">
      <select
        value={currentRole}
        onChange={handleChange}
        disabled={loading}
        className="px-2 py-1 pr-6 rounded text-xs font-medium bg-accent-gold/10 text-accent-gold border border-accent-gold/20 hover:bg-accent-gold/20 focus:outline-none focus:ring-1 focus:ring-accent-gold/50 transition-colors appearance-none cursor-pointer disabled:opacity-50"
      >
        <option value="">Sem cargo</option>
        {roles.map(role => (
          <option key={role} value={role}>{role}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-accent-gold">
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        )}
      </div>
    </div>
  );
}
