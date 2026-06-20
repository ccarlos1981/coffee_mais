"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";

export default function FollowUpPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          Follow Up
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <ClipboardList className="w-16 h-16 mx-auto text-amber-500 opacity-40" />
          <h2 className="text-2xl font-bold text-foreground">Follow Up</h2>
          <p className="text-muted text-sm max-w-md mx-auto">
            Módulo em desenvolvimento. Em breve você poderá acompanhar os follow ups comerciais aqui.
          </p>
        </div>
      </main>
    </div>
  );
}
