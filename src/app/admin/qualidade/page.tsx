"use client";

import { QualityProvider } from "./hooks";
import { QualityHeader } from "./components/QualityHeader";
import { QualityKpiCards } from "./components/QualityKpiCards";
import { QualityTrendChart } from "./components/QualityTrendChart";
import { QualityAlertsTable } from "./components/QualityAlertsTable";
import { GovernanceSettingsPanel } from "./components/GovernanceSettingsPanel";

export default function QualidadePage() {
  return (
    <QualityProvider>
      <div className="flex h-screen bg-background font-sans transition-colors duration-300">
        <main className="flex-1 overflow-auto bg-[url('/noise.png')] bg-repeat opacity-95">
          <div className="p-8 max-w-6xl mx-auto space-y-8 pb-16">
            {/* Header section with back navigation */}
            <QualityHeader />

            {/* KPIs statistics layout */}
            <QualityKpiCards />

            {/* Historical trend visualization chart */}
            <QualityTrendChart />

            {/* Active alerts grid */}
            <QualityAlertsTable />

            {/* Governance parameters slide-over card */}
            <GovernanceSettingsPanel />
          </div>
        </main>
      </div>
    </QualityProvider>
  );
}
