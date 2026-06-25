"use client";

import React from "react";
import { ArrowLeft, Smartphone, Download, ShieldCheck, Mail, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeProvider";

export default function PromotorIndisponivelPage() {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Gold/Amber Glow Effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="p-5 flex justify-between items-center z-10 max-w-4xl mx-auto w-full">
        <h1 className="text-xl font-extrabold bg-gradient-to-r from-amber-500 to-amber-200 bg-clip-text text-transparent tracking-wide">
          Coffee Mais Campo
        </h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="p-2 text-neutral-400 hover:text-red-400 transition-colors duration-200"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 max-w-lg mx-auto w-full">
        <div className="w-full backdrop-blur-md bg-neutral-900/40 border border-neutral-900 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
          
          {/* Glass Card Inner Glow */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

          {/* Icon Header */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-6 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-pulse">
            <Smartphone className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-neutral-100 mb-3 bg-gradient-to-b from-white to-neutral-300 bg-clip-text text-transparent">
            Módulo Web Desativado
          </h2>
          
          <p className="text-neutral-400 text-xs leading-relaxed max-w-sm mb-8">
            Para garantir o funcionamento correto de geofencing, inteligência anti-spoofing e registro de ponto off-line, o Módulo Promotor agora é <strong>100% nativo</strong>.
          </p>

          {/* Download Options */}
          <div className="flex flex-col gap-4 w-full">
            
            {/* Android Option */}
            <div className="p-4 rounded-2xl bg-neutral-950/40 border border-neutral-900 flex items-center justify-between hover:border-amber-500/30 transition-all duration-300 group">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-950">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Dispositivo Android</h4>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Versão mais recente (AAB/APK)</p>
                </div>
              </div>
              <a 
                href="/downloads/coffee-mais-promotor.apk" 
                className="px-4 py-2 bg-neutral-900 border border-neutral-800 group-hover:bg-amber-500 group-hover:text-neutral-950 text-neutral-300 text-xs font-extrabold rounded-xl transition-all duration-300 shadow-sm"
              >
                Instalar APK
              </a>
            </div>

            {/* iOS Option */}
            <div className="p-4 rounded-2xl bg-neutral-950/40 border border-neutral-900 flex items-center justify-between hover:border-amber-500/30 transition-all duration-300 group">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-950">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Dispositivo iPhone</h4>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Disponível no Apple TestFlight</p>
                </div>
              </div>
              <a 
                href="https://testflight.apple.com/join/coffeemais" 
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-neutral-900 border border-neutral-800 group-hover:bg-amber-500 group-hover:text-neutral-950 text-neutral-300 text-xs font-extrabold rounded-xl transition-all duration-300 shadow-sm"
              >
                TestFlight
              </a>
            </div>

          </div>

          <div className="mt-8 flex flex-col gap-1 items-center">
            <span className="text-[10px] text-neutral-500 font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-neutral-600" />
              Precisa de ajuda? Contate o suporte.
            </span>
            <p className="text-[9px] text-neutral-600">Coffee Mais S.A. | Divisão de Tecnologia</p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="p-5 text-center text-[10px] text-neutral-600 z-10">
        &copy; {new Date().getFullYear()} Coffee Mais. Todos os direitos reservados.
      </footer>
    </div>
  );
}
