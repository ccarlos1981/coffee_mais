"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateUserApproval } from "./actions";

interface ApproveUserToggleProps {
  userId: string;
  initialApproved: boolean;
}

export function ApproveUserToggle({ userId, initialApproved }: ApproveUserToggleProps) {
  const [approved, setApproved] = useState(initialApproved);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextVal = !approved;
    // Optimistic update
    setApproved(nextVal);

    startTransition(async () => {
      const result = await updateUserApproval(userId, nextVal);
      if (result.error) {
        toast.error(result.error);
        setApproved(approved); // Revert
      } else {
        toast.success(nextVal ? "Acesso liberado!" : "Acesso revogado!");
      }
    });
  };

  return (
    <div className="flex items-center gap-2 bg-background-elevated/40 border border-border px-3 py-1.5 rounded-xl">
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${
        approved ? "text-success" : "text-amber-500"
      }`}>
        {approved ? "Aprovado" : "Pendente"}
      </span>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-accent-gold/40 ${
          approved ? "bg-success" : "bg-neutral-800"
        } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
        title={approved ? "Revogar acesso" : "Liberar acesso"}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            approved ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
