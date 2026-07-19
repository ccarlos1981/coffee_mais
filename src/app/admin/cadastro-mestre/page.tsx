"use client";

import { useState } from "react";
import { CadastroMestreProvider } from "./hooks";
import { QualityProvider } from "../qualidade/hooks";
import { UnifiedSearch } from "./components/UnifiedSearch";
import { RedesManager } from "./components/RedesManager";
import { TerritoryManager } from "./components/TerritoryManager";
import { RegionalManager } from "./components/RegionalManager";
import { GovernanceSettingsPanel } from "../qualidade/components/GovernanceSettingsPanel";
import { Search, Award, Map, Globe, Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Tab = "search" | "redes" | "territory" | "regional" | "settings";

export default function CadastroMestrePage() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  return (
    <QualityProvider>
      <CadastroMestreProvider>
        <div className="flex h-screen bg-background font-sans transition-colors duration-300">
          <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95">
            <div className="p-8 max-w-6xl mx-auto space-y-8 pb-16">
              
              {/* Header section with back navigation */}
              <div className="flex items-center justify-between border-b border-border/60 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Link href="/admin/qualidade" className="hover:text-foreground flex items-center gap-1">
                      <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel de Qualidade
                    </Link>
                  </div>
                  <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                    Cadastro Mestre Comercial
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Fonte operacional unificada para Redes, Matrizes, Filiais, Gerentes e UFs do Coffee Mais.
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-border/60 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button
                  onClick={() => setActiveTab("search")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                    activeTab === "search"
                      ? "border-amber-500 text-amber-500 font-extrabold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  Pesquisa Unificada
                </button>

                <button
                  onClick={() => setActiveTab("redes")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                    activeTab === "redes"
                      ? "border-amber-500 text-amber-500 font-extrabold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  Redes & Matrizes
                </button>

                <button
                  onClick={() => setActiveTab("territory")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                    activeTab === "territory"
                      ? "border-amber-500 text-amber-500 font-extrabold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Map className="w-4 h-4" />
                  UFs Territórios
                </button>

                <button
                  onClick={() => setActiveTab("regional")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                    activeTab === "regional"
                      ? "border-amber-500 text-amber-500 font-extrabold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Regionalização KA
                </button>

                <button
                  onClick={() => setActiveTab("settings")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                    activeTab === "settings"
                      ? "border-amber-500 text-amber-500 font-extrabold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Configurações Globais
                </button>
              </div>

              {/* Tab Contents */}
              <div className="space-y-8">
                {activeTab === "search" && <UnifiedSearch />}
                {activeTab === "redes" && <RedesManager />}
                {activeTab === "territory" && <TerritoryManager />}
                {activeTab === "regional" && <RegionalManager />}
                {activeTab === "settings" && <GovernanceSettingsPanel />}
              </div>

            </div>
          </main>
        </div>
      </CadastroMestreProvider>
    </QualityProvider>
  );
}
