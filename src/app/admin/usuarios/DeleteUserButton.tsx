"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

export function DeleteUserButton({ userId, deleteAction }: { userId: string, deleteAction: (id: string) => Promise<{ success?: boolean; error?: string }> }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button 
      type="button"
      title="Excluir usuário"
      disabled={isPending}
      className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
      onClick={() => {
        if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
          startTransition(async () => {
            await deleteAction(userId);
          });
        }
      }}
    >
      <Trash2 className="w-5 h-5" />
    </button>
  );
}
