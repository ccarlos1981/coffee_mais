"use client";

import { useTransition } from "react";
import { togglePermission } from "./actions";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

interface PermissionToggleProps {
  role: string;
  moduleName: string;
  hasAccess: boolean;
}

export function PermissionToggle({ role, moduleName, hasAccess }: PermissionToggleProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const result = await togglePermission(role, moduleName, hasAccess);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Permissão de ${role} para ${moduleName} atualizada!`);
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`w-full h-full min-h-[44px] flex items-center justify-center transition-all ${
        isPending ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:bg-foreground/5'
      }`}
    >
      {hasAccess ? (
        <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center border border-green-500/30">
          <Check className="w-5 h-5" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/30">
          <X className="w-5 h-5" />
        </div>
      )}
    </button>
  );
}
