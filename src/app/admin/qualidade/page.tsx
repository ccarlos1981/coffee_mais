"use client";

import { useState } from "react";
import { QualityProvider } from "./hooks";
import { QualityHeader } from "./components/QualityHeader";
import { QualityKpiCards } from "./components/QualityKpiCards";
import { QualityTrendChart } from "./components/QualityTrendChart";
import { QualityAlertsTable } from "./components/QualityAlertsTable";
import { GovernanceSettingsPanel } from "./components/GovernanceSettingsPanel";
import { QualityRequestsList } from "./components/QualityRequestsList";
import { QualityApprovalQueue } from "./components/QualityApprovalQueue";
import { BarChart3, FileText, ShieldAlert, Settings } from "lucide-react";

type ActiveTab = "dash" | "requests" | "queue" | "settings";

export default function QualidadePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dash");

  return (
    <QualityProvider>
      <div className="flex h-screen bg-background font-sans transition-colors duration-300">
        <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95">
          <div className="p-8 max-w-6xl mx-auto space-y-8 pb-16">
            {/* Header section with back navigation */}
            <QualityHeader />

            {/* Navigation Tabs */}
            <div className="flex border-b border-border/60">
              <button
                onClick={() => setActiveTab("dash")}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                  activeTab === "dash"
                    ? "border-amber-500 text-amber-500 font-extrabold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Painel Geral & Alertas
              </button>

              <button
                onClick={() => setActiveTab("requests")}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                  activeTab === "requests"
                    ? "border-amber-500 text-amber-500 font-extrabold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="w-4 h-4" />
                Minhas Solicitações
              </button>

              <button
                onClick={() => setActiveTab("queue")}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider font-bold border-b-2 transition-all ${
                  activeTab === "queue"
                    ? "border-amber-500 text-amber-500 font-extrabold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Fila de Homologação
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
                Configurações
              </button>
            </div>

            {/* Tab Contents */}
            <div className="space-y-8">
              {activeTab === "dash" && (
                <>
                  <QualityKpiCards />
                  <QualityTrendChart />
                  <QualityAlertsTable />
                </>
              )}

              {activeTab === "requests" && <QualityRequestsList />}

              {activeTab === "queue" && <QualityApprovalQueue />}

              {activeTab === "settings" && <GovernanceSettingsPanel />}
            </div>
          </div>
        </main>
      </div>
    </QualityProvider>
  );
}
