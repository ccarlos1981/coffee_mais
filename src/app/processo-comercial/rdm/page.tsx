"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Save, Loader2
} from "lucide-react";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MetricBlock {
  aa: number; fct: number; desafio: number; real: number; pct: number; delta: number;
}
interface FarolData {
  managerLabel: string;
  weights: { VOL: number; FAT: number; INVEST: number };
  month: { vol: MetricBlock; fat: MetricBlock; score: number };
  ytd:   { label: string; vol: MetricBlock; fat: MetricBlock; score: number };
}
interface RdmApiResponse {
  success: boolean;
  year: number; month: number; manager: string;
  managers: string[];
  farol: FarolData;
  comments: Record<string, string>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];
const YEARS = [2024, 2025, 2026, 2027];

const MANAGER_OPTIONS = [
  { value: "CRISTIANO", label: "CRISTIANO (Total)" },
  { value: "Julliano",  label: "Julliano (SPC)" },
  { value: "Leandro",   label: "Leandro (Sul)" },
  { value: "Luiz",      label: "Luiz (SU+CO+NE)" },
];

// ─── Semáforo de cores ────────────────────────────────────────────────────────
function trafficLight(pct: number): { bg: string; color: string } {
  if (pct >= 100)     return { bg: "#4caf5033", color: "#2e7d32" };
  if (pct >= 90)      return { bg: "#ff980033", color: "#e65100" };
  return               { bg: "#f4433633", color: "#c62828" };
}

// ─── CoffeeSlide Shell ───────────────────────────────────────────────────────
function SlideShell({ title, monthName, children }: { title: string; monthName: string; children: React.ReactNode }) {
  return (
    <div className="rdm-slide">
      {/* Header */}
      <div className="rdm-slide-header">
        <div className="rdm-slide-title-block">
          <h2 className="rdm-slide-title">
            {title} | <span className="rdm-slide-month">{monthName}</span>
          </h2>
          <div className="rdm-slide-divider" />
        </div>
        {/* Coffee++ logo */}
        <div className="rdm-slide-logo">
          Coffee<br /><span>++</span>
        </div>
      </div>

      {/* Content */}
      <div className="rdm-slide-body">
        {children}
      </div>

      {/* Footer logo */}
      <div className="rdm-slide-footer">
        <div className="rdm-footer-dot rdm-dot-red" />
        <div className="rdm-footer-dot rdm-dot-green" />
        <div className="rdm-footer-dot rdm-dot-blue" />
      </div>
    </div>
  );
}

// ─── Slide 1: Pauta ───────────────────────────────────────────────────────────
const AGENDA_ITEMS = [
  "Farol de Metas",
  "Follow up",
  "Resultado DRE",
  "Faturamento e Volume por Regional",
  "Volume por família",
  "Prioridades",
  "Plano de Ação",
];

function SlideAgenda({ monthName }: { monthName: string }) {
  return (
    <SlideShell title="Pauta KA" monthName={monthName}>
      <div className="rdm-agenda">
        <p className="rdm-agenda-header">
          <span className="rdm-agenda-plus">++</span> Temas principais
        </p>
        <ol className="rdm-agenda-list">
          {AGENDA_ITEMS.map((item, i) => (
            <li key={i} className="rdm-agenda-item">
              <span className="rdm-agenda-num">{i + 1}.</span>
              {item}
            </li>
          ))}
        </ol>
      </div>
    </SlideShell>
  );
}

// ─── Slide 2: Farol de Metas ──────────────────────────────────────────────────
function SlideFarol({
  monthName, farol, comment, onCommentChange, onCommentSave, saving
}: {
  monthName: string;
  farol: FarolData;
  comment: string;
  onCommentChange: (v: string) => void;
  onCommentSave: () => void;
  saving: boolean;
}) {
  const m = farol.month;
  const y = farol.ytd;

  function MetricRow({
    label, weight, block, isYtd
  }: { label: string; weight: number; block: MetricBlock; isYtd?: boolean }) {
    const light = trafficLight(block.pct);
    const isVol = label === "VOLUME";
    return (
      <tr className="rdm-farol-row">
        <td className="rdm-farol-label">{label}</td>
        <td className="rdm-farol-weight">{weight}%</td>
        <td className="rdm-farol-cell">
          {isVol ? formatNumber(block.aa, 0) : formatCurrency(block.aa / 1000, 0)}
        </td>
        <td className="rdm-farol-cell">
          {isVol ? formatNumber(block.fct, 0) : formatCurrency(block.fct / 1000, 0)}
        </td>
        <td className="rdm-farol-cell rdm-farol-desafio">
          {isVol ? formatNumber(block.desafio, 0) : formatCurrency(block.desafio / 1000, 0)}
        </td>
        <td className="rdm-farol-cell rdm-farol-real" style={{ background: "#FF6B001A" }}>
          {isVol ? formatNumber(block.real, 0) : formatCurrency(block.real / 1000, 0)}
        </td>
        <td className="rdm-farol-pct" style={{ background: light.bg, color: light.color }}>
          {formatNumber(block.pct, 1)}%
        </td>
        <td className="rdm-farol-delta" style={{ color: block.delta >= 0 ? "#2e7d32" : "#c62828" }}>
          {formatNumber(block.delta, 0)}
        </td>
      </tr>
    );
  }

  function ScoreRow({ score }: { score: number }) {
    const light = trafficLight(score);
    return (
      <tr className="rdm-farol-score-row">
        <td colSpan={5} />
        <td />
        <td className="rdm-farol-pct rdm-farol-score" style={{ background: light.bg, color: light.color }}>
          {formatNumber(score, 1)}%
        </td>
        <td />
      </tr>
    );
  }

  function FarolTable({ title, block }: { title: string; block: { vol: MetricBlock; fat: MetricBlock; score: number } }) {
    return (
      <div className="rdm-farol-table-wrap">
        {/* Manager label rotated */}
        <div className="rdm-farol-manager-col">
          <span>{farol.managerLabel}</span>
        </div>

        <table className="rdm-farol-table">
          <thead>
            <tr>
              <th className="rdm-th-indicador">INDICADOR</th>
              <th />
              <th colSpan={6} className="rdm-th-group">{title}</th>
            </tr>
            <tr>
              <th />
              <th />
              <th className="rdm-th-col">A A</th>
              <th className="rdm-th-col">FCT</th>
              <th className="rdm-th-col">DESAFIO</th>
              <th className="rdm-th-col">REAL</th>
              <th className="rdm-th-col">%</th>
              <th className="rdm-th-col">Δ</th>
            </tr>
          </thead>
          <tbody>
            <MetricRow label="VOLUME"      weight={34} block={block.vol} />
            <MetricRow label="FATURAMENTO" weight={33} block={block.fat} isYtd />
            <tr className="rdm-farol-invest-placeholder">
              <td className="rdm-farol-label rdm-invest-dim">INVESTIMENTO</td>
              <td className="rdm-farol-weight rdm-invest-dim">33%</td>
              <td colSpan={6} className="rdm-invest-dim" style={{ textAlign: "center", fontStyle: "italic", fontSize: "0.65rem" }}>
                Em breve
              </td>
            </tr>
            <ScoreRow score={block.score} />
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <SlideShell title="Farol de Metas" monthName={monthName}>
      <div className="rdm-farol-content">
        <div className="rdm-farol-tables-row">
          <FarolTable title={monthName.toUpperCase()} block={m} />
          <FarolTable title={y.label}                 block={y} />
        </div>

        {/* Comment area */}
        <div className="rdm-comment-wrap">
          <textarea
            className="rdm-comment-input"
            placeholder="Aqui será um multinput para o gerente poder comentar..."
            value={comment}
            onChange={e => onCommentChange(e.target.value)}
            rows={3}
          />
          <button
            className="rdm-comment-save"
            onClick={onCommentSave}
            disabled={saving}
            title="Salvar comentário"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RdmPage() {
  const router = useRouter();

  // Filtros
  const [manager, setManager] = useState("CRISTIANO");
  const [year,    setYear]    = useState(new Date().getFullYear());
  const [month,   setMonth]   = useState(new Date().getMonth() + 1);

  // Data
  const [data,    setData]    = useState<RdmApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Slides
  const [slideIdx,    setSlideIdx]    = useState(0);
  const [direction,   setDirection]   = useState<'next' | 'prev'>('next');
  const [animating,   setAnimating]   = useState(false);
  const [isFullscreen,setIsFullscreen]= useState(false);

  // Comments
  const [comments,    setComments]    = useState<Record<string, string>>({});
  const [savingKey,   setSavingKey]   = useState<string | null>(null);
  const [savedKey,    setSavedKey]    = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/processo-comercial/rdm?year=${year}&month=${month}&manager=${encodeURIComponent(manager)}`);
      const json = await res.json() as RdmApiResponse;
      if (!json.success) throw new Error((json as unknown as { error: string }).error);
      setData(json);
      setComments(json.comments ?? {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [year, month, manager]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save comment ──
  const saveComment = async (slideKey: string) => {
    setSavingKey(slideKey);
    try {
      await fetch('/api/processo-comercial/rdm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, manager, slide_key: slideKey, comment: comments[slideKey] ?? '' }),
      });
      setSavedKey(slideKey);
      setTimeout(() => setSavedKey(null), 2000);
    } finally {
      setSavingKey(null);
    }
  };

  // ── Slides definition ──
  const monthName = MONTHS[month - 1];

  const slides = [
    { key: 'agenda',       label: 'Pauta' },
    { key: 'farol_metas',  label: 'Farol de Metas' },
  ];
  const totalSlides = slides.length;

  // ── Navigation ──
  const goTo = useCallback((idx: number, dir: 'next' | 'prev') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setSlideIdx(idx);
      setAnimating(false);
    }, 280);
  }, [animating]);

  const prev = useCallback(() => {
    if (slideIdx > 0) goTo(slideIdx - 1, 'prev');
  }, [slideIdx, goTo]);

  const next = useCallback(() => {
    if (slideIdx < totalSlides - 1) goTo(slideIdx + 1, 'next');
  }, [slideIdx, totalSlides, goTo]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft')  prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Render current slide ──
  function renderSlide() {
    if (loading || !data) return (
      <div className="rdm-slide rdm-slide-loading">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--accent-gold)" }} />
        <p>Carregando dados...</p>
      </div>
    );

    const slideKey = slides[slideIdx].key;

    if (slideKey === 'agenda') {
      return <SlideAgenda monthName={monthName} />;
    }

    if (slideKey === 'farol_metas') {
      return (
        <SlideFarol
          monthName={monthName}
          farol={data.farol}
          comment={comments['farol_metas'] ?? ''}
          onCommentChange={v => setComments(prev => ({ ...prev, farol_metas: v }))}
          onCommentSave={() => saveComment('farol_metas')}
          saving={savingKey === 'farol_metas'}
        />
      );
    }

    return null;
  }

  return (
    <div ref={containerRef} className="rdm-page">
      {/* ── Top Nav ── */}
      <nav className="rdm-topnav">
        <button onClick={() => router.back()} className="rdm-back-btn">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>

        <div className="rdm-nav-title">
          📊 RDM — Reunião de Desempenho Mensal
        </div>

        <div className="rdm-nav-right">
          <ThemeToggle />
          <button onClick={toggleFullscreen} className="rdm-fullscreen-btn" title={isFullscreen ? "Sair do fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* ── Filters ── */}
      <div className="rdm-filters">
        <label className="rdm-filter-label">Gerente</label>
        <select
          className="rdm-select"
          value={manager}
          onChange={e => { setManager(e.target.value); setSlideIdx(0); }}
        >
          {MANAGER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label className="rdm-filter-label">Mês</label>
        <select
          className="rdm-select"
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>

        <label className="rdm-filter-label">Ano</label>
        <select
          className="rdm-select"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {error && <span className="rdm-filter-error">⚠ {error}</span>}
      </div>

      {/* ── Slide Player ── */}
      <div className="rdm-player-wrap">
        {/* Prev button */}
        <button
          className="rdm-nav-btn rdm-nav-btn-prev"
          onClick={prev}
          disabled={slideIdx === 0}
          title="Slide anterior (←)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Slide container with 16:9 ratio */}
        <div className="rdm-slide-container">
          <div
            className={`rdm-slide-inner rdm-anim-${direction} ${animating ? 'rdm-animating' : ''}`}
          >
            {renderSlide()}
          </div>
        </div>

        {/* Next button */}
        <button
          className="rdm-nav-btn rdm-nav-btn-next"
          onClick={next}
          disabled={slideIdx === totalSlides - 1}
          title="Próximo slide (→)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* ── Slide counter + dots ── */}
      <div className="rdm-slide-footer-nav">
        <span className="rdm-slide-counter">{slideIdx + 1} / {totalSlides}</span>
        <div className="rdm-dots">
          {slides.map((s, i) => (
            <button
              key={s.key}
              className={`rdm-dot ${i === slideIdx ? 'rdm-dot-active' : ''}`}
              onClick={() => goTo(i, i > slideIdx ? 'next' : 'prev')}
              title={s.label}
            />
          ))}
        </div>
        <span className="rdm-slide-label">{slides[slideIdx].label}</span>
      </div>
    </div>
  );
}
