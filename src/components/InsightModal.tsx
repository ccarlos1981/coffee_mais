"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Loader2 } from "lucide-react";

interface InsightModalProps {
  totals: {
    fat: number;
    metaFat: number;
    qty: number;
    metaUnd: number;
    maco: number;
    metaMaco: number;
  };
  managerRows: {
    manager: string;
    fat: number;
    metaFat: number;
    qty: number;
    metaUnd: number;
    maco: number;
    metaMaco: number;
    topClients?: { client: string; fat: number; qty: number; maco: number; prevMonthFat: number; prevYearFat: number }[];
  }[];
  familiaData: { familia: string; fat: number; pct: number }[];
  businessDays: { total_days: number; elapsed_days: number } | null;
  previousMonth: { fat: number; qty: number; maco: number };
  previousYear: { fat: number; qty: number; maco: number };
  filterMonth: number;
  filterYear: number;
}

export function InsightButton({
  totals,
  managerRows,
  familiaData,
  businessDays,
  previousMonth,
  previousYear,
  filterMonth,
  filterYear,
}: InsightModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setInsight(null);

    try {
      // Pre-process: extract all clients, biggest losses, and positivation
      const allClients: { client: string; fat: number; prevMonthFat: number; prevYearFat: number }[] = [];
      for (const row of managerRows) {
        for (const c of row.topClients || []) {
          const existing = allClients.find(a => a.client === c.client);
          if (existing) {
            existing.fat += c.fat;
            existing.prevMonthFat += c.prevMonthFat;
            existing.prevYearFat += c.prevYearFat;
          } else {
            allClients.push({ client: c.client, fat: c.fat, prevMonthFat: c.prevMonthFat, prevYearFat: c.prevYearFat });
          }
        }
      }

      // Top 3 networks losing revenue vs previous month
      const lostVsMonth = allClients
        .filter(c => c.prevMonthFat > 0)
        .map(c => ({ client: c.client, atual: Math.round(c.fat), anterior: Math.round(c.prevMonthFat), diff: Math.round(c.fat - c.prevMonthFat) }))
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 3);

      // Top 3 networks losing revenue vs previous year
      const lostVsYear = allClients
        .filter(c => c.prevYearFat > 0)
        .map(c => ({ client: c.client, atual: Math.round(c.fat), anoAnterior: Math.round(c.prevYearFat), diff: Math.round(c.fat - c.prevYearFat) }))
        .sort((a, b) => a.diff - b.diff)
        .slice(0, 3);

      // Positivation: count of active clients now vs prev month
      const activeFatClients = allClients.filter(c => c.fat > 0).length;
      const prevMonthActiveClients = allClients.filter(c => c.prevMonthFat > 0).length;

      const res = await fetch("/api/coffee-ia/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totals,
          managerRows,
          familiaData,
          businessDays,
          previousMonth,
          previousYear,
          month: filterMonth,
          year: filterYear,
          lostVsMonth,
          lostVsYear,
          positivation: { current: activeFatClients, prevMonth: prevMonthActiveClients },
        }),
      });

      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        setInsight(json.insight);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }

    setLoading(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // Simple markdown renderer for bold, headings, and lists
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();
      // Bold
      let html = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

      // Headings (### or ##)
      if (/^#{2,4}\s/.test(trimmed)) {
        html = html.replace(/^#{2,4}\s*/, "");
        return (
          <p key={i} className="insight-line" style={{ marginTop: 12, marginBottom: 2 }}>
            <strong dangerouslySetInnerHTML={{ __html: html }} />
          </p>
        );
      }

      // Bullet points (-, •, or *)
      const isBullet = /^[-•*]\s/.test(trimmed);
      if (isBullet) {
        html = html.replace(/^[-•*]\s/, "");
        return (
          <div key={i} className="insight-bullet">
            <span className="insight-bullet-dot" />
            <span dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      }
      // Empty line
      if (!trimmed) return <div key={i} style={{ height: 8 }} />;
      // Regular line
      return <p key={i} className="insight-line" dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  return (
    <>
      <button
        onClick={fetchInsight}
        className="insight-trigger-btn"
        disabled={loading}
      >
        <Sparkles style={{ width: 13, height: 13 }} />
        <span>Insight IA</span>
        <span className="insight-badge">✨</span>
      </button>

      <ModalPortal open={open} onClose={handleClose} loading={loading} error={error} insight={insight} onRetry={fetchInsight} renderMarkdown={renderMarkdown} />
    </>
  );
}

/* Portal component to render modal on document.body */
function ModalPortal({ open, onClose, loading, error, insight, onRetry, renderMarkdown }: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  insight: string | null;
  onRetry: () => void;
  renderMarkdown: (text: string) => React.ReactNode[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="insight-overlay" onClick={onClose}>
      <div className="insight-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="insight-header">
          <div className="insight-header-left">
            <Sparkles style={{ width: 16, height: 16, color: "var(--accent-gold)" }} />
            <div>
              <h3 className="insight-title">Coffee IA — Insight</h3>
              <p className="insight-subtitle">Análise inteligente do período</p>
            </div>
          </div>
          <button onClick={onClose} className="insight-close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Content */}
        <div className="insight-content">
          {loading && (
            <div className="insight-loading">
              <Loader2 className="insight-spinner" style={{ width: 24, height: 24 }} />
              <p>Analisando dados...</p>
              <span>Gerando resumo com IA</span>
            </div>
          )}

          {error && (
            <div className="insight-error">
              <p>⚠️ {error}</p>
              <button onClick={onRetry} className="insight-retry">
                Tentar novamente
              </button>
            </div>
          )}

          {insight && (
            <div className="insight-body">
              {renderMarkdown(insight)}
            </div>
          )}
        </div>

        {/* Footer */}
        {insight && (
          <div className="insight-footer">
            <span>Gerado por Gemini AI • Apenas sugestões baseadas nos dados</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
