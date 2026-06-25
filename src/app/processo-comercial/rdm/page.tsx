"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Save, Loader2
} from "lucide-react";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, LabelList,
} from "recharts";

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
interface VolPrecoEntry {
  mesKey: string;
  label: string;
  m: number;
  y: number;
  vol: number;
  fat: number;
  preco: number;
  byFam: Record<string, { fat: number; qty: number; preco: number }>;
}

interface RdmApiResponse {
  success: boolean;
  year: number; month: number; manager: string;
  managers: string[];
  farol: FarolData;
  comments: Record<string, string>;
  monthlyFat: { label: string; m: number; fatCur: number; fatUltTrim: number }[];
  acum: { fatCur: number; fatUltTrim: number };
  recordFat: number;
  monthlyVol: { label: string; m: number; volCur: number; volUltTrim: number }[];
  acumVol: { volCur: number; volUltTrim: number };
  recordVol: number;
  volPreco: VolPrecoEntry[];
  familias: string[];
  precoCompare: PrecoCompareData;
  prevYear: number;
}

interface PrecoCompareMonth {
  label: string;
  m: number;
  precoCur: number;
  precoPrev: number;
  byFam: Record<string, { precoCur: number; precoPrev: number }>;
}
interface PrecoCompareData {
  months: PrecoCompareMonth[];
  acum: {
    precoCur: number;
    precoPrev: number;
    byFam: Record<string, { precoCur: number; precoPrev: number }>;
  };
  record: number;
  prevYear: number;
  curYear: number;
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

const MANAGER_INFO: Record<string, { name: string; region: string }> = {
  CRISTIANO: { name: "CRISTIANO SANTOS", region: "Brasil" },
  Julliano:  { name: "JULLIANO",         region: "SPC – São Paulo Capital" },
  Leandro:   { name: "LEANDRO",          region: "SUL" },
  Luiz:      { name: "LUIZ",             region: "SU+CO+NE" },
};

// ─── Semáforo de cores ────────────────────────────────────────────────────────
function trafficLight(pct: number): { bg: string; color: string } {
  if (pct >= 100)     return { bg: "#4caf5033", color: "#2e7d32" };
  if (pct >= 90)      return { bg: "#ff980033", color: "#e65100" };
  return               { bg: "#f4433633", color: "#c62828" };
}

// ─── Slide 0: Capa ───────────────────────────────────────────────────────────

function SlideCapa({ manager, monthName, year }: { manager: string; monthName: string; year: number }) {
  const info = MANAGER_INFO[manager] ?? { name: manager.toUpperCase(), region: '' };
  const gold  = '#c9a96e';
  const goldD = '#a07840';

  // Large coffee bean watermark SVG (right-side, very faint)
  const beanWatermark = `url("data:image/svg+xml,%3Csvg width='320' height='440' viewBox='0 0 320 440' xmlns='http://www.w3.org/2000/svg'%3E%3Cellipse cx='160' cy='220' rx='130' ry='195' fill='none' stroke='%23c9a96e' stroke-width='1.5' opacity='0.12'/%3E%3Cellipse cx='160' cy='220' rx='100' ry='155' fill='none' stroke='%23c9a96e' stroke-width='1' opacity='0.07'/%3E%3Cpath d='M160 25 C160 25 80 120 80 220 C80 320 160 415 160 415' stroke='%23c9a96e' stroke-width='1.5' fill='none' opacity='0.14' stroke-linecap='round'/%3E%3C/svg%3E")`;

  // Fine grain noise texture
  const grain = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`;

  return (
    <div
      className="rdm-slide"
      style={{
        background: '#060606',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Subtle warm center glow — keeps full black feel ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 55% 55% at 72% 48%, rgba(120,70,20,0.18) 0%, transparent 70%),
          radial-gradient(ellipse 30% 40% at 15% 85%, rgba(100,55,15,0.10) 0%, transparent 60%)
        `,
        zIndex: 0,
      }} />

      {/* ── Grain texture ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: grain,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 200px',
        zIndex: 0,
      }} />

      {/* ── Coffee bean watermark — right side ── */}
      <div style={{
        position: 'absolute',
        right: '-2%', top: '50%',
        transform: 'translateY(-50%)',
        width: 320, height: 440,
        backgroundImage: beanWatermark,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        zIndex: 1,
      }} />

      {/* ── Steam wisps SVG ── */}
      <svg
        style={{ position: 'absolute', bottom: 0, right: '18%', zIndex: 1, opacity: 0.18 }}
        width="80" height="120" viewBox="0 0 80 120" fill="none"
      >
        <path d="M20 120 Q15 100 25 80 Q35 60 20 40 Q10 25 20 10" stroke={gold} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M45 120 Q38 98 50 78 Q62 58 45 38 Q34 22 45 8" stroke={gold} strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
        <path d="M68 120 Q63 102 72 84 Q80 65 68 46 Q58 30 68 15" stroke={gold} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      </svg>

      {/* ── Thin top accent line ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${goldD} 20%, ${gold} 50%, ${goldD} 80%, transparent 100%)`,
        zIndex: 2,
      }} />

      {/* ── Left edge accent bar ── */}
      <div style={{
        position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 2,
        background: `linear-gradient(to bottom, transparent, ${gold} 35%, ${gold} 65%, transparent)`,
        opacity: 0.35,
        zIndex: 2,
      }} />

      {/* ── Main content ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '6.5% 8% 5.5% 7%',
        zIndex: 3,
      }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Coffee++ wordmark */}
          <div style={{ userSelect: 'none', lineHeight: 1 }}>
            <div style={{
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '0.01em',
            }}>Coffee</div>
            <div style={{
              color: gold,
              fontSize: '0.95rem',
              fontWeight: 800,
              fontFamily: 'var(--font-geist-mono, "Courier New", monospace)',
              letterSpacing: '0.08em',
              marginTop: 1,
            }}>++</div>
          </div>

          {/* Period badge */}
          <div style={{
            border: `1px solid ${goldD}`,
            borderRadius: 2,
            padding: '3px 10px',
            color: gold,
            fontSize: '0.55rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            fontFamily: 'var(--font-geist-sans, system-ui)',
            background: 'rgba(201,169,110,0.05)',
          }}>
            {monthName} · {year}
          </div>
        </div>

        {/* Center — name block */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '2%' }}>
          {/* Eyebrow */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.1rem',
          }}>
            <div style={{ width: 22, height: 1, background: gold, opacity: 0.6 }} />
            <span style={{
              color: 'rgba(201,169,110,0.7)',
              fontSize: '0.5rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.32em',
              fontFamily: 'var(--font-geist-sans, system-ui)',
            }}>Gerente</span>
          </div>

          {/* Name — serif, luxury scale */}
          <div style={{
            fontSize: 'clamp(1.7rem, 4.2vw, 2.8rem)',
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: '-0.01em',
            lineHeight: 1.08,
            textShadow: `0 0 60px rgba(201,169,110,0.15)`,
          }}>
            {info.name.split(' ').map((word, i) => (
              <span key={i} style={{ display: 'block' }}>{word}</span>
            ))}
          </div>

          {/* Region */}
          {info.region && (
            <div style={{
              marginTop: '0.9rem',
              color: 'rgba(255,255,255,0.38)',
              fontSize: 'clamp(0.6rem, 1.3vw, 0.78rem)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.28em',
              fontFamily: 'var(--font-geist-sans, system-ui)',
            }}>
              {info.region}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            {/* Thin gold rule */}
            <div style={{ width: 40, height: 1, background: gold, opacity: 0.5, marginBottom: 8 }} />
            <div style={{
              color: 'rgba(255,255,255,0.22)',
              fontSize: '0.48rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.26em',
              fontFamily: 'var(--font-geist-sans, system-ui)',
              marginBottom: 3,
            }}>Reunião de Desempenho Mensal</div>
            <div style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              fontFamily: 'var(--font-geist-sans, system-ui)',
            }}>RDM</div>
          </div>

          {/* Three dots — coffee grounds pattern */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', paddingBottom: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: gold }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: gold, opacity: 0.55 }} />
            <div style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: gold, opacity: 0.28 }} />
          </div>
        </div>
      </div>
    </div>
  );
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

// ─── Slide 3: Resultado DRE (placeholder) ───────────────────────────────────
function SlideDre({ monthName }: { monthName: string }) {
  return (
    <SlideShell title="Resultado DRE" monthName={monthName}>
      <div className="rdm-dre-placeholder">
        <span className="rdm-dre-label">DRE</span>
        <p className="rdm-dre-sub">Dados em breve</p>
      </div>
    </SlideShell>
  );
}

// ─── Slide 4: Resultado Faturamento ──────────────────────────────────────────
// ── Paleta do gráfico (referência: foto) ─────────────────────────────────────
const COLOR_TRIM = "#4A6FA5"; // azul aço = último trimestre (coluna esquerda)
const COLOR_CUR  = "#1E88E5"; // azul vivo = mês atual (coluna direita)

const MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

type BarEntry = {
  label: string;            // X-axis label (mês curto ou meses do trim empilhados com \n)
  isCurrentMonth: boolean;  // seleciona cor
  isAccum: boolean;
  monthValue: number | null; // eixo esquerdo — barras mensais
  accumValue: number | null; // eixo direito  — coluna acum.
  trimPair: number;          // valor do trim do par, p/ cálculo de delta
};

function getTrimLabel(m: number): string {
  const parts: string[] = [];
  for (let lag = 1; lag <= 3; lag++) {
    let lagM = m - lag;
    if (lagM <= 0) lagM += 12;
    parts.push(MONTH_SHORT[lagM - 1]);
  }
  return parts.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FatXTick(props: any) {
  const { x, y, payload, index, shiftPx = 0, chartData = [] } = props;
  const raw: string = payload?.value ?? '';
  const lines = raw.split('\n');
  const isMulti = lines.length > 1;
  const lineH = 11;
  const topY = y + 4;

  // Com 2 Bar components, Recharts divide cada slot em 2 metades.
  // O tick fica no CENTRO do slot, mas a barra visível fica em uma das metades.
  // Deslocamos o label para o centro da barra real:
  //   • entries com monthValue  → barra esquerda → shift para esquerda
  //   • entries com accumValue  → barra direita  → shift para direita
  const entry: BarEntry | undefined = chartData[index];
  const isAccum = entry?.isAccum ?? false;
  const adjustedX = isAccum ? x + shiftPx : x - shiftPx;

  return (
    <g>
      {lines.map((line: string, i: number) => (
        <text
          key={i}
          x={adjustedX}
          y={topY + i * lineH}
          textAnchor="middle"
          dominantBaseline="hanging"
          fill={'#1a1a1a'}
          fontSize={isMulti ? 8 : 12}
          fontWeight={isMulti ? 400 : 700}
          fontFamily="var(--font-geist-sans, system-ui)"
        >
          {line}
        </text>
      ))}
    </g>
  );
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VertBarLabel(props: any) {
  const x: number = props.x ?? 0;
  const y: number = props.y ?? 0;
  const w: number = props.width ?? 0;
  const h: number = props.height ?? 0;
  const v: number = props.value ?? 0;
  if (!v || v <= 0 || h < 24) return null;
  // Mostra número completo formatado (ex: 3.867.162)
  const label = Math.round(v).toLocaleString('pt-BR');
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      transform={`rotate(-90, ${cx}, ${cy})`}
      fontSize={Math.min(7.5, w * 0.38)} fontWeight={600} fill="rgba(255,255,255,0.92)"
      fontFamily="var(--font-geist-sans, system-ui)"
    >{label}</text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FatDeltaLabel(props: any) {
  const x: number = props.x ?? 0;
  const y: number = props.y ?? 0;
  const w: number = props.width ?? 0;
  const value: number = props.value ?? 0;
  const index: number = props.index ?? 0;
  const data: BarEntry[] = props.data ?? [];
  const entry = data[index];
  if (!entry?.isCurrentMonth || !value || !entry.trimPair) return null;
  const pct = Math.round(((value - entry.trimPair) / entry.trimPair) * 100);
  const sign = pct >= 0 ? '+' : '';
  const color = pct >= 0 ? '#1b7a36' : '#c0392b';
  return (
    <text x={x + w / 2} y={y - 5} textAnchor="middle"
      fontSize={8} fontWeight={700}
      fill={color}
      fontFamily="var(--font-geist-sans, system-ui)"
    >{sign}{pct}%</text>
  );
}

function SlideResultadoFaturamento({
  monthName, month,
  monthlyFat, acum, recordFat,
}: {
  monthName: string;
  year: number;
  month: number;
  prevYear: number;
  monthlyFat: { label: string; m: number; fatCur: number; fatUltTrim: number }[];
  acum: { fatCur: number; fatUltTrim: number };
  recordFat: number;
}) {
  const chartData: BarEntry[] = [];

  monthlyFat.filter(r => r.m <= month).forEach(r => {
    const trimVal = r.fatUltTrim;
    const curVal  = r.fatCur;
    chartData.push({
      label: getTrimLabel(r.m),
      isCurrentMonth: false, isAccum: false,
      monthValue: trimVal > 0 ? trimVal : null,
      accumValue: null, trimPair: trimVal,
    });
    chartData.push({
      label: r.label,
      isCurrentMonth: true, isAccum: false,
      monthValue: curVal > 0 ? curVal : null,
      accumValue: null, trimPair: trimVal,
    });
  });

  chartData.push({
    label: 'Acum.\n(Trim)',
    isCurrentMonth: false, isAccum: true,
    monthValue: null,
    accumValue: acum.fatUltTrim > 0 ? acum.fatUltTrim : null,
    trimPair: acum.fatUltTrim,
  });
  chartData.push({
    label: 'Acum.',
    isCurrentMonth: true, isAccum: true,
    monthValue: null,
    accumValue: acum.fatCur > 0 ? acum.fatCur : null,
    trimPair: acum.fatUltTrim,
  });

  const numSlots = chartData.length;
  const barSz = Math.max(18, Math.round(660 / numSlots * 0.80));

  // Formatador do eixo Y — mostra valores em milhar com separador pt-BR
  const yFmt = (v: number) =>
    v === 0 ? '0' : (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

  return (
    <SlideShell title="Resultado Faturamento" monthName={monthName}>
      <div className="rdm-fat-wrap">
        {/* Título do gráfico — igual à referência */}
        <p className="rdm-fat-subtitle">
          FATURAMENTO MENSAL (R$) — Mês Atual vs Último Trimestre
        </p>

        <div className="rdm-fat-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 26, right: 52, left: 4, bottom: 2 }}
              barCategoryGap="5%"
              barGap={2}
            >
              {/* Grid só horizontal, linhas sutis */}
              <CartesianGrid
                vertical={false}
                stroke="#e8ecf0"
                strokeDasharray="0"
              />

              {/* X-Axis: labels deslocados para o centro da barra real */}
              <XAxis
                dataKey="label"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tick={(p: any) => (
                  <FatXTick {...p} shiftPx={(barSz + 2) / 2} chartData={chartData} />
                )}
                axisLine={{ stroke: '#d0d5dd', strokeWidth: 1 }}
                tickLine={false}
                height={60}
                interval={0}
              />

              {/* Eixo esquerdo — mensal */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={yFmt}
                width={40}
                tickCount={6}
              />

              {/* Eixo direito — acumulado (escala maior, cor mais clara) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 8, fill: '#94a3b8', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={yFmt}
                width={46}
                tickCount={6}
              />

              <Tooltip
                cursor={{ fill: 'rgba(30,136,229,0.06)' }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  fontFamily: 'var(--font-geist-sans, system-ui)',
                }}
                formatter={(value: unknown, _name: unknown, props: unknown) => {
                  const n = value as number;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const idx = (props as any)?.index ?? 0;
                  const entry: BarEntry | undefined = chartData[idx];
                  const lbl = entry?.isCurrentMonth ? 'Mês Atual' : 'Último Trimestre';
                  return [
                    `R$ ${Math.round(n).toLocaleString('pt-BR')}`,
                    lbl,
                  ];
                }}
              />

              {/* Linha de record — dashed vermelha */}
              {recordFat > 0 && (
                <ReferenceLine
                  yAxisId="left"
                  y={recordFat}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Record: ${Math.round(recordFat).toLocaleString('pt-BR')}`,
                    position: 'insideTopRight',
                    fontSize: 7.5,
                    fill: '#ef4444',
                    fontWeight: 700,
                    fontFamily: 'var(--font-geist-sans, system-ui)',
                  }}
                />
              )}

              {/* Barras mensais — eixo esquerdo */}
              <Bar
                yAxisId="left"
                dataKey="monthValue"
                barSize={barSz}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                {chartData.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.isCurrentMonth ? COLOR_CUR : COLOR_TRIM}
                  />
                ))}
                {/* Label vertical com valor real */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="monthValue" content={(p: any) => <VertBarLabel {...p} />} />
                {/* Percentual delta acima da barra atual */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="monthValue" content={(p: any) => <FatDeltaLabel {...p} data={chartData} />} />
              </Bar>

              {/* Barras acumuladas — eixo direito */}
              <Bar
                yAxisId="right"
                dataKey="accumValue"
                barSize={barSz}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                {chartData.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.isCurrentMonth ? COLOR_CUR : COLOR_TRIM}
                  />
                ))}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="accumValue" content={(p: any) => <VertBarLabel {...p} />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda inferior — igual à referência */}
        <div className="rdm-fat-legend">
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_CUR }} />
            <span className="rdm-fat-leg-text">Mês Atual</span>
          </span>
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_TRIM }} />
            <span className="rdm-fat-leg-text">Último Trimestre</span>
          </span>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 5: Resultado Volume ────────────────────────────────────────────────────────
function SlideResultadoVolume({
  monthName, month,
  monthlyVol, acumVol, recordVol,
}: {
  monthName: string;
  year: number;
  month: number;
  prevYear: number;
  monthlyVol: { label: string; m: number; volCur: number; volUltTrim: number }[];
  acumVol: { volCur: number; volUltTrim: number };
  recordVol: number;
}) {
  const chartData: BarEntry[] = [];

  monthlyVol.filter(r => r.m <= month).forEach(r => {
    const trimVal = r.volUltTrim;
    const curVal  = r.volCur;
    chartData.push({
      label: getTrimLabel(r.m),
      isCurrentMonth: false, isAccum: false,
      monthValue: trimVal > 0 ? trimVal : null,
      accumValue: null, trimPair: trimVal,
    });
    chartData.push({
      label: r.label,
      isCurrentMonth: true, isAccum: false,
      monthValue: curVal > 0 ? curVal : null,
      accumValue: null, trimPair: trimVal,
    });
  });

  chartData.push({
    label: 'Acum.\n(Trim)',
    isCurrentMonth: false, isAccum: true,
    monthValue: null,
    accumValue: acumVol.volUltTrim > 0 ? acumVol.volUltTrim : null,
    trimPair: acumVol.volUltTrim,
  });
  chartData.push({
    label: 'Acum.',
    isCurrentMonth: true, isAccum: true,
    monthValue: null,
    accumValue: acumVol.volCur > 0 ? acumVol.volCur : null,
    trimPair: acumVol.volUltTrim,
  });

  const numSlots = chartData.length;
  const barSz = Math.max(18, Math.round(660 / numSlots * 0.80));

  // Formatador do eixo Y — mostra valores inteiros com separador pt-BR
  const yFmt = (v: number) =>
    v === 0 ? '0' : Math.round(v).toLocaleString('pt-BR');

  return (
    <SlideShell title="Resultado Volume" monthName={monthName}>
      <div className="rdm-fat-wrap">
        <p className="rdm-fat-subtitle">
          VOLUME MENSAL (UNIDADES) — Mês Atual vs Último Trimestre
        </p>

        <div className="rdm-fat-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 26, right: 52, left: 4, bottom: 2 }}
              barCategoryGap="5%"
              barGap={2}
            >
              <CartesianGrid
                vertical={false}
                stroke="#e8ecf0"
                strokeDasharray="0"
              />

              <XAxis
                dataKey="label"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tick={(p: any) => (
                  <FatXTick {...p} shiftPx={(barSz + 2) / 2} chartData={chartData} />
                )}
                axisLine={{ stroke: '#d0d5dd', strokeWidth: 1 }}
                tickLine={false}
                height={60}
                interval={0}
              />

              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={yFmt}
                width={50}
                tickCount={6}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 8, fill: '#94a3b8', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={yFmt}
                width={56}
                tickCount={6}
              />

              <Tooltip
                cursor={{ fill: 'rgba(30,136,229,0.06)' }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  fontFamily: 'var(--font-geist-sans, system-ui)',
                }}
                formatter={(value: unknown, _name: unknown, props: unknown) => {
                  const n = value as number;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const idx = (props as any)?.index ?? 0;
                  const entry: BarEntry | undefined = chartData[idx];
                  const lbl = entry?.isCurrentMonth ? 'Mês Atual' : 'Último Trimestre';
                  return [
                    `${Math.round(n).toLocaleString('pt-BR')} un.`,
                    lbl,
                  ];
                }}
              />

              {recordVol > 0 && (
                <ReferenceLine
                  yAxisId="left"
                  y={recordVol}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Record: ${Math.round(recordVol).toLocaleString('pt-BR')}`,
                    position: 'insideTopRight',
                    fontSize: 7.5,
                    fill: '#ef4444',
                    fontWeight: 700,
                    fontFamily: 'var(--font-geist-sans, system-ui)',
                  }}
                />
              )}

              <Bar
                yAxisId="left"
                dataKey="monthValue"
                barSize={barSz}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                {chartData.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.isCurrentMonth ? COLOR_CUR : COLOR_TRIM}
                  />
                ))}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="monthValue" content={(p: any) => <VertBarLabel {...p} />} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="monthValue" content={(p: any) => <FatDeltaLabel {...p} data={chartData} />} />
              </Bar>

              <Bar
                yAxisId="right"
                dataKey="accumValue"
                barSize={barSz}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                {chartData.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.isCurrentMonth ? COLOR_CUR : COLOR_TRIM}
                  />
                ))}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="accumValue" content={(p: any) => <VertBarLabel {...p} />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="rdm-fat-legend">
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_CUR }} />
            <span className="rdm-fat-leg-text">Mês Atual</span>
          </span>
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_TRIM }} />
            <span className="rdm-fat-leg-text">Último Trimestre</span>
          </span>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 6: Volume (Unid) e Preço Médio (R$/Unid) ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VolPrecoXTick(props: any) {
  const { x, y, payload } = props;
  const label: string = payload?.value ?? '';
  return (
    <text
      x={x} y={y + 10}
      textAnchor="middle"
      dominantBaseline="hanging"
      fill="#1a1a1a"
      fontSize={9}
      fontWeight={600}
      fontFamily="var(--font-geist-sans, system-ui)"
    >
      {label}
    </text>
  );
}

function SlideVolPrecoMedio({
  monthName,
  volPreco,
  familias,
}: {
  monthName: string;
  volPreco: VolPrecoEntry[];
  familias: string[];
}) {
  const [selFam, setSelFam] = useState('Todas');

  // Preparar dados: se família selecionada, filtrar; senão, usar total
  const chartData = volPreco.map(vp => {
    if (selFam === 'Todas') {
      return { label: vp.label, vol: vp.vol, preco: Math.round(vp.preco * 100) / 100 };
    }
    const fam = vp.byFam[selFam];
    return {
      label: vp.label,
      vol: fam?.qty ?? 0,
      preco: fam ? Math.round(fam.preco * 100) / 100 : 0,
    };
  });

  const volFmt = (v: number) =>
    v === 0 ? '0' : Math.round(v).toLocaleString('pt-BR');
  const precoFmt = (v: number) =>
    `R$ ${v.toFixed(0)}`;

  return (
    <SlideShell title="Volume e Preço Médio" monthName={monthName}>
      <div className="rdm-fat-wrap">
        {/* Título + filtro família inline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 2 }}>
          <p className="rdm-fat-subtitle" style={{ margin: 0 }}>
            Volume (Unid) e Preço Médio (R$/Unid)
          </p>
          <select
            value={selFam}
            onChange={e => setSelFam(e.target.value)}
            style={{
              fontSize: '0.62rem',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid #d0d5dd',
              background: '#fff',
              color: '#374151',
              fontFamily: 'var(--font-geist-sans, system-ui)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="Todas">Todas Famílias</option>
            {familias.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="rdm-fat-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 28, right: 48, left: 4, bottom: 2 }}
              barCategoryGap="18%"
            >
              <CartesianGrid
                vertical={false}
                stroke="#e8ecf0"
                strokeDasharray="0"
              />

              <XAxis
                dataKey="label"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tick={(p: any) => <VolPrecoXTick {...p} />}
                axisLine={{ stroke: '#d0d5dd', strokeWidth: 1 }}
                tickLine={false}
                height={32}
                interval={0}
              />

              {/* Eixo esquerdo — volume */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={volFmt}
                width={50}
                tickCount={6}
              />

              {/* Eixo direito — preço médio */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 8, fill: '#94a3b8', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={precoFmt}
                width={46}
                tickCount={6}
              />

              <Tooltip
                cursor={{ fill: 'rgba(30,136,229,0.06)' }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  fontFamily: 'var(--font-geist-sans, system-ui)',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  if (name === 'vol') return [`${Math.round(value).toLocaleString('pt-BR')} un.`, 'Volume (Unid)'];
                  return [`R$ ${Number(value).toFixed(2)}`, 'Preço/Unid'];
                }}
              />

              {/* Barras de volume — azul claro */}
              <Bar
                yAxisId="left"
                dataKey="vol"
                fill="#7ec8e3"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                barSize={Math.max(20, Math.round(600 / chartData.length * 0.65))}
              >
                {/* Label de valor vertical no centro da barra */}
                <LabelList
                  dataKey="vol"
                  position="inside"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={(p: any) => {
                    const x: number = p.x ?? 0;
                    const y: number = p.y ?? 0;
                    const w: number = p.width ?? 0;
                    const h: number = p.height ?? 0;
                    const v: number = p.value ?? 0;
                    if (!v || h < 30 || w < 10) return null;
                    const cx = x + w / 2;
                    const cy = y + h / 2;
                    const fontSize = Math.min(13, w * 0.58);
                    return (
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fontSize}
                        fontWeight={700}
                        fill="#1a6b8a"
                        fontFamily="var(--font-geist-sans, system-ui)"
                        transform={`rotate(-90, ${cx}, ${cy})`}
                      >
                        {Math.round(v).toLocaleString('pt-BR')}
                      </text>
                    );
                  }}
                />
              </Bar>

              {/* Linha de preço médio — coral */}
              <Line
                yAxisId="right"
                dataKey="preco"
                type="monotone"
                stroke="#e8837c"
                strokeWidth={2}
                dot={{ r: 4, fill: '#fff', stroke: '#e8837c', strokeWidth: 2 }}
                isAnimationActive={false}
              >
                {/* Label de preço acima de cada ponto */}
                <LabelList
                  dataKey="preco"
                  position="top"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={(p: any) => {
                    const x: number = p.x ?? 0;
                    const y: number = p.y ?? 0;
                    const v: number = p.value ?? 0;
                    if (!v) return null;
                    return (
                      <text x={x} y={y - 6} textAnchor="middle"
                        fontSize={7} fontWeight={600} fill="#c0574f"
                        fontFamily="var(--font-geist-sans, system-ui)"
                      >
                        {v.toFixed(2).replace('.', ',')}
                      </text>
                    );
                  }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="rdm-fat-legend">
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: '#e8837c' }} />
            <span className="rdm-fat-leg-text">Preço/Unid</span>
          </span>
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: '#7ec8e3' }} />
            <span className="rdm-fat-leg-text">Volume (Unid)</span>
          </span>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 7: Resultado Preço KA ─────────────────────────────────────────────

type PrecoBarEntry = {
  label: string;
  precoPrev: number | null;
  precoCur: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PrecoVertLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (!value || height < 18) return null;
  const cx = (x ?? 0) + (width ?? 0) / 2;
  const cy = (y ?? 0) + (height ?? 0) / 2;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={Math.min(13, (width ?? 30) * 0.55)} fontWeight={700}
      fill="#fff" fontFamily="var(--font-geist-sans, system-ui)"
      transform={`rotate(-90, ${cx}, ${cy})`}
    >
      {Number(value).toFixed(1).replace('.', ',')}
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PrecoDeltaLabel(props: any) {
  const { x, y, width, value, index, data } = props;
  if (!value) return null;
  const entry: PrecoBarEntry | undefined = data?.[index];
  if (!entry?.precoPrev || entry.precoPrev === 0) return null;
  const pct = ((value - entry.precoPrev) / entry.precoPrev) * 100;
  const sign = pct >= 0 ? '+' : '';
  const color = pct >= 0 ? '#2e7d32' : '#c62828';
  const cx = (x ?? 0) + (width ?? 0) / 2;
  return (
    <text x={cx} y={(y ?? 0) - 6} textAnchor="middle"
      fontSize={11} fontWeight={700} fill={color}
      fontFamily="var(--font-geist-sans, system-ui)"
    >{sign}{Math.round(pct)}%</text>
  );
}

function SlideResultadoPreco({
  monthName,
  precoCompare,
  familias,
}: {
  monthName: string;
  precoCompare: PrecoCompareData;
  familias: string[];
}) {
  const [selFam, setSelFam] = useState('Todas');

  const COLOR_PREV = '#2d5016'; // verde escuro = ano anterior
  const COLOR_CUR_P = '#7cb342'; // verde claro = ano atual

  // Construir chartData: 1 entry por mês com ambos os valores
  const chartData: PrecoBarEntry[] = [];
  precoCompare.months.forEach(pm => {
    let precoPrev = pm.precoPrev;
    let precoCur = pm.precoCur;
    if (selFam !== 'Todas' && pm.byFam[selFam]) {
      precoPrev = pm.byFam[selFam].precoPrev;
      precoCur = pm.byFam[selFam].precoCur;
    }
    chartData.push({
      label: pm.label,
      precoPrev: precoPrev > 0 ? precoPrev : null,
      precoCur: precoCur > 0 ? precoCur : null,
    });
  });

  // Acumulado
  let acumPrev = precoCompare.acum.precoPrev;
  let acumCur = precoCompare.acum.precoCur;
  if (selFam !== 'Todas' && precoCompare.acum.byFam[selFam]) {
    acumPrev = precoCompare.acum.byFam[selFam].precoPrev;
    acumCur = precoCompare.acum.byFam[selFam].precoCur;
  }
  chartData.push({
    label: 'Acum.',
    precoPrev: acumPrev > 0 ? acumPrev : null,
    precoCur: acumCur > 0 ? acumCur : null,
  });

  const numSlots = chartData.length;
  const barSz = Math.max(20, Math.round(660 / numSlots * 0.35));

  const yFmt = (v: number) => `R$ ${Math.round(v)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function PrecoXTick(props: any) {
    const { x, y, payload } = props;
    const label: string = payload?.value ?? '';
    return (
      <text x={x} y={y + 6} textAnchor="middle"
        dominantBaseline="hanging" fill="#1a1a1a"
        fontSize={10} fontWeight={700}
        fontFamily="var(--font-geist-sans, system-ui)"
      >{label}</text>
    );
  }

  return (
    <SlideShell title="Resultado Preço KA" monthName={monthName}>
      <div className="rdm-fat-wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 2 }}>
          <p className="rdm-fat-subtitle" style={{ margin: 0 }}>
            PREÇO MÉDIO MENSAL (R$/UNIDADE) — {precoCompare.prevYear} x {precoCompare.curYear}
          </p>
          <select
            value={selFam}
            onChange={e => setSelFam(e.target.value)}
            style={{
              fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4,
              border: '1px solid #d0d5dd', background: '#fff', color: '#374151',
              fontFamily: 'var(--font-geist-sans, system-ui)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <option value="Todas">Todas Famílias</option>
            {familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="rdm-fat-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 26, right: 20, left: 4, bottom: 2 }}
              barCategoryGap="8%"
              barGap={1}
            >
              <CartesianGrid vertical={false} stroke="#e8ecf0" strokeDasharray="0" />

              <XAxis
                dataKey="label"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tick={(p: any) => <PrecoXTick {...p} />}
                axisLine={{ stroke: '#d0d5dd', strokeWidth: 1 }}
                tickLine={false}
                height={28}
                interval={0}
              />

              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                axisLine={false} tickLine={false}
                tickFormatter={yFmt}
                width={40}
                domain={[0, 35]}
                tickCount={8}
              />

              <Tooltip
                cursor={{ fill: 'rgba(30,136,229,0.06)' }}
                contentStyle={{
                  fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  fontFamily: 'var(--font-geist-sans, system-ui)',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  const yr = name === 'precoPrev' ? precoCompare.prevYear : precoCompare.curYear;
                  return [`R$ ${Number(value).toFixed(2)}`, `${yr}`];
                }}
              />

              {/* Record line */}
              {precoCompare.record > 0 && (
                <ReferenceLine
                  yAxisId="left" y={precoCompare.record}
                  stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
                  label={{
                    value: `Record: R$ ${precoCompare.record.toFixed(2).replace('.', ',')}`,
                    position: 'insideTopRight', fontSize: 7, fill: '#ef4444',
                    fontWeight: 700, fontFamily: 'var(--font-geist-sans, system-ui)',
                  }}
                />
              )}

              {/* Barra ano anterior */}
              <Bar yAxisId="left" dataKey="precoPrev" barSize={barSz}
                radius={[3, 3, 0, 0]} isAnimationActive={false} fill={COLOR_PREV}
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="precoPrev" content={(p: any) => <PrecoVertLabel {...p} />} />
              </Bar>

              {/* Barra ano atual */}
              <Bar yAxisId="left" dataKey="precoCur" barSize={barSz}
                radius={[3, 3, 0, 0]} isAnimationActive={false} fill={COLOR_CUR_P}
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="precoCur" content={(p: any) => <PrecoVertLabel {...p} />} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <LabelList dataKey="precoCur" content={(p: any) => <PrecoDeltaLabel {...p} data={chartData} />} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="rdm-fat-legend">
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_PREV }} />
            <span className="rdm-fat-leg-text">{precoCompare.prevYear}</span>
          </span>
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_CUR_P }} />
            <span className="rdm-fat-leg-text">{precoCompare.curYear}</span>
          </span>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 10: Tabela de Famílias ───────────────────────────────────────────

function SlidePrecoFamilia({
  monthName,
  month,
  volPreco,
  familias,
}: {
  monthName: string;
  month: number;
  volPreco: VolPrecoEntry[];
  familias: string[];
}) {
  const [selMetric, setSelMetric] = useState<'preco' | 'fat' | 'qty'>('qty');

  // volPreco possui 13 meses (do mês selecionado recuando 12 meses)
  // Index 0: Mesmo mês do ano anterior (mês atual - 12 meses)
  const prevYearMonthEntry = volPreco?.[0];
  // Index 8 a 12: Últimos 5 meses terminando no mês atual
  const recentMonths = volPreco?.slice(-5) ?? [];
  
  // O mês atual está na última posição (Index 12)
  const currentMonthEntry = volPreco?.[volPreco.length - 1];
  const prevMonthEntry = volPreco?.[volPreco.length - 2];

  // Ordenar famílias "pelo que mais vende para o que menos vende" (baseado no faturamento/volume do mês atual)
  const sortedFamilias = [...familias].sort((a, b) => {
    const entry = currentMonthEntry;
    if (!entry) return 0;
    const metricKey = selMetric === 'qty' ? 'qty' : 'fat';
    const valA = entry.byFam[a]?.[metricKey] ?? 0;
    const valB = entry.byFam[b]?.[metricKey] ?? 0;
    return valB - valA;
  });

  // Helper para obter valor da família pela métrica escolhida
  const getValue = (entry: VolPrecoEntry | undefined, fam: string) => {
    if (!entry) return 0;
    const famData = entry.byFam[fam];
    if (!famData) return 0;
    if (selMetric === 'preco') return famData.preco;
    if (selMetric === 'fat') return famData.fat;
    return famData.qty;
  };

  // Helper para formatar valores dependendo da métrica
  const formatVal = (v: number) => {
    if (v === 0) return "-";
    if (selMetric === 'preco') return `R$ ${v.toFixed(2).replace('.', ',')}`;
    if (selMetric === 'fat') {
      return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
    }
    return Math.round(v).toLocaleString('pt-BR');
  };

  // Helper para formatar comparativos percentuais
  const formatPct = (curVal: number, compVal: number) => {
    if (!compVal || compVal === 0) return "-";
    const pct = ((curVal - compVal) / compVal) * 100;
    const sign = pct >= 0 ? '+' : '';
    const color = pct >= 0 ? '#2e7d32' : '#c62828';
    return (
      <span style={{ color, fontWeight: 700 }}>
        {sign}{Math.round(pct)}%
      </span>
    );
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.62rem',
    fontFamily: 'var(--font-geist-sans, system-ui)',
  };

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderBottom: '2px solid #b8860b',
    fontWeight: 700,
    textAlign: 'center',
    fontSize: '0.58rem',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    background: '#fafafa',
  };

  const tdStyle: React.CSSProperties = {
    padding: '6px 8px',
    textAlign: 'center',
    fontWeight: 600,
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  };

  return (
    <SlideShell title="Tabela de Famílias" monthName={monthName}>
      <div className="rdm-fat-wrap" style={{ gap: '10px' }}>
        {/* Metric Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 2 }}>
          <p className="rdm-fat-subtitle" style={{ margin: 0 }}>
            Painel Comparativo de Famílias de Produtos
          </p>
          <select
            value={selMetric}
            onChange={e => setSelMetric(e.target.value as 'preco' | 'fat' | 'qty')}
            style={{
              fontSize: '0.62rem', padding: '3px 8px', borderRadius: 4,
              border: '1px solid #d0d5dd', background: '#fff', color: '#374151',
              fontFamily: 'var(--font-geist-sans, system-ui)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <option value="preco">Preço Médio (R$/un.)</option>
            <option value="fat">Faturamento (R$)</option>
            <option value="qty">Volume (un.)</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 80 }}>Família</th>
                {/* Histórico Ano Anterior */}
                <th style={thStyle}>{prevYearMonthEntry?.label ?? "Ano Anterior"}</th>
                {/* 5 Meses de tendência */}
                {recentMonths.map((mEntry, idx) => {
                  const isCurrent = idx === recentMonths.length - 1;
                  return (
                    <th
                      key={mEntry.mesKey}
                      style={{
                        ...thStyle,
                        background: isCurrent ? 'rgba(200, 169, 110, 0.15)' : '#fafafa',
                        borderBottom: isCurrent ? '2px solid var(--accent-gold)' : '2px solid #b8860b',
                      }}
                    >
                      {mEntry.label}
                    </th>
                  );
                })}
                {/* Comparativos Lado Direito */}
                <th style={{ ...thStyle, borderLeft: '1px solid #ddd', background: '#f5f5f5' }}>% vs Mês Ant.</th>
                <th style={{ ...thStyle, background: '#f5f5f5' }}>% vs Média</th>
                <th style={{ ...thStyle, background: '#f5f5f5' }}>% vs Ano Ant.</th>
              </tr>
            </thead>
            <tbody>
              {sortedFamilias.map((fam, rowIdx) => {
                const prevYearVal = getValue(prevYearMonthEntry, fam);
                const recentVals = recentMonths.map(mEntry => getValue(mEntry, fam));
                
                // Mês atual é o último da tendência
                const currentVal = recentVals[recentVals.length - 1];
                const prevVal = recentVals[recentVals.length - 2];
                
                // Calcular média dos 5 meses mostrados
                const validVals = recentVals.filter(v => v > 0);
                const avgVal = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0;

                return (
                  <tr key={fam} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                    {/* Família */}
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: '#1a3a5c' }}>
                      {fam}
                    </td>
                    {/* Histórico Ano Anterior */}
                    <td style={{ ...tdStyle, color: '#64748b' }}>
                      {formatVal(prevYearVal)}
                    </td>
                    {/* 5 Meses de tendência */}
                    {recentVals.map((v, idx) => {
                      const isCurrent = idx === recentVals.length - 1;
                      return (
                        <td
                          key={idx}
                          style={{
                            ...tdStyle,
                            background: isCurrent ? 'rgba(200, 169, 110, 0.06)' : 'transparent',
                            fontWeight: isCurrent ? 700 : 600,
                          }}
                        >
                          {formatVal(v)}
                        </td>
                      );
                    })}
                    {/* Comparativos Lado Direito */}
                    <td style={{ ...tdStyle, borderLeft: '1px solid #ddd', background: '#fafafa' }}>
                      {formatPct(currentVal, prevVal)}
                    </td>
                    <td style={{ ...tdStyle, background: '#fafafa' }}>
                      {formatPct(currentVal, avgVal)}
                    </td>
                    <td style={{ ...tdStyle, background: '#fafafa' }}>
                      {formatPct(currentVal, prevYearVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 11: Plano de Ação ─────────────────────────────────────────────────

interface ActionPlanRow {
  oQue: string;
  como: string;
  quem: string;
  quando: string;
  status: string;
}

function SlidePlanoAcao({
  monthName,
  comment,
  onCommentChange,
  onCommentSave,
  saving,
}: {
  monthName: string;
  comment: string;
  onCommentChange: (v: string) => void;
  onCommentSave: () => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState<ActionPlanRow[]>([]);
  const hasLoaded = useRef(false);

  // Sync / Parse comment from database on load
  useEffect(() => {
    if (comment) {
      try {
        const parsed = JSON.parse(comment);
        if (Array.isArray(parsed)) {
          setRows(parsed);
          hasLoaded.current = true;
          return;
        }
      } catch {
        // Fallback to initial rows
      }
    }
    // Se o comentário estiver vazio ou inválido, inicializa com a linha padrão
    setRows([
      {
        oQue: "Sem Distribuidor para atender a área (baixo potencial)",
        como: "Buscar um Distribuidor parceiro, para o atendimento da área",
        quem: "Cristiano + equipe",
        quando: "F26",
        status: "Fazendo triagem das oportunidades"
      }
    ]);
    hasLoaded.current = true;
  }, [comment]);

  // Sempre que a tabela mudar, atualiza o comment no componente pai
  const updateRows = (newRows: ActionPlanRow[]) => {
    setRows(newRows);
    onCommentChange(JSON.stringify(newRows));
  };

  const handleChange = (index: number, field: keyof ActionPlanRow, value: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    updateRows(newRows);
  };

  const addRow = () => {
    const newRows = [...rows, { oQue: "", como: "", quem: "", quando: "", status: "" }];
    updateRows(newRows);
  };

  const deleteRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    updateRows(newRows);
  };

  const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #111',
    fontWeight: 700,
    textAlign: 'center',
    fontSize: '0.85rem',
    color: '#ffffff',
    textTransform: 'uppercase',
    background: '#1a3a5c', // Azul marinho conforme a imagem
    letterSpacing: '0.04em',
    width: '20%',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0',
    border: '1px solid #111',
    background: '#ffffff',
    verticalAlign: 'top',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    minHeight: '75px',
    border: 'none',
    resize: 'none',
    outline: 'none',
    padding: '10px 12px',
    fontSize: '0.72rem',
    fontWeight: 500,
    color: '#111111',
    background: 'transparent',
    lineHeight: '1.4',
    fontFamily: 'var(--font-sans, system-ui, sans-serif)',
  };

  return (
    <SlideShell title="Plano de Ação" monthName={monthName}>
      <div className="rdm-fat-wrap" style={{ gap: '12px' }}>
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <p className="rdm-fat-subtitle" style={{ margin: 0 }}>
            Plano de Ação para Alinhamento e Metas
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={addRow}
              style={{
                fontSize: '0.62rem', padding: '4px 10px', borderRadius: 4,
                border: '1px solid #1a3a5c', background: '#fff', color: '#1a3a5c',
                fontFamily: 'var(--font-geist-sans, system-ui)', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(26,58,92,0.06)'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#fff'; }}
            >
              + Adicionar Linha
            </button>
            <button
              onClick={onCommentSave}
              disabled={saving}
              style={{
                fontSize: '0.62rem', padding: '4px 12px', borderRadius: 4,
                border: 'none', background: saving ? '#94a3b8' : '#2d5016', color: '#fff',
                fontFamily: 'var(--font-geist-sans, system-ui)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Plano'}
            </button>
          </div>
        </div>

        {/* Action Plan Table */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #111', borderRadius: '4px', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>O quê</th>
                <th style={thStyle}>Como</th>
                <th style={thStyle}>Quem</th>
                <th style={thStyle}>Quando</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: '40px', background: '#1a3a5c', border: '1px solid #111' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td style={tdStyle}>
                    <textarea
                      value={row.oQue}
                      onChange={e => handleChange(index, 'oQue', e.target.value)}
                      style={textareaStyle}
                      placeholder="Sem Distribuidor para atender a área..."
                    />
                  </td>
                  <td style={tdStyle}>
                    <textarea
                      value={row.como}
                      onChange={e => handleChange(index, 'como', e.target.value)}
                      style={textareaStyle}
                      placeholder="Buscar um Distribuidor parceiro..."
                    />
                  </td>
                  <td style={tdStyle}>
                    <textarea
                      value={row.quem}
                      onChange={e => handleChange(index, 'quem', e.target.value)}
                      style={textareaStyle}
                      placeholder="Cristiano + equipe"
                    />
                  </td>
                  <td style={tdStyle}>
                    <textarea
                      value={row.quando}
                      onChange={e => handleChange(index, 'quando', e.target.value)}
                      style={textareaStyle}
                      placeholder="F26"
                    />
                  </td>
                  <td style={tdStyle}>
                    <textarea
                      value={row.status}
                      onChange={e => handleChange(index, 'status', e.target.value)}
                      style={textareaStyle}
                      placeholder="Fazendo triagem..."
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'middle', width: '40px' }}>
                    <button
                      onClick={() => deleteRow(index)}
                      style={{
                        background: 'none', border: 'none', color: '#ef4444',
                        cursor: 'pointer', fontSize: '1rem', padding: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: 'auto',
                      }}
                      title="Excluir linha"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 11b: Projeção de Vendas ─────────────────────────────────────────────

function SlideProjecao({
  monthName,
  month,
  year,
  manager,
  farol,
  comment,
  onCommentChange,
  onCommentSave,
  saving,
}: {
  monthName: string;
  month: number;
  year: number;
  manager: string;
  farol: FarolData;
  comment: string;
  onCommentChange: (v: string) => void;
  onCommentSave: () => void;
  saving: boolean;
}) {
  const ytdLabel = `YTD - F${String(year).slice(-2)}`;

  const mVol   = farol.month.vol;
  const mFat   = farol.month.fat;
  const ytdVol = farol.ytd.vol;
  const ytdFat = farol.ytd.fat;

  const baseRows = useMemo(() => [
    {
      label: 'QUANTIDADE',
      unit: 'un.',
      weight: farol.weights.VOL,
      monthAA:      Math.round(mVol.aa),
      monthFct:     Math.round(mVol.fct),
      monthDesafio: Math.round(mVol.desafio),
      defaultProj:  Math.round(mVol.real),
      ytdAA:      Math.round(ytdVol.aa),
      ytdDesafio: Math.round(ytdVol.fct),
      ytdReal:    Math.round(ytdVol.real),
      ytdPct:     ytdVol.pct,
      ytdDelta:   Math.round(ytdVol.delta),
    },
    {
      label: 'FATURAMENTO',
      unit: 'R$k',
      weight: farol.weights.FAT,
      monthAA:      Math.round(mFat.aa / 1000),
      monthFct:     Math.round(mFat.fct / 1000),
      monthDesafio: Math.round(mFat.desafio / 1000),
      defaultProj:  Math.round(mFat.real / 1000),
      ytdAA:      Math.round(ytdFat.aa / 1000),
      ytdDesafio: Math.round(ytdFat.fct / 1000),
      ytdReal:    Math.round(ytdFat.real / 1000),
      ytdPct:     ytdFat.pct,
      ytdDelta:   Math.round(ytdFat.delta / 1000),
    },
    {
      label: 'INVESTIMENTO',
      unit: '%',
      weight: 0,           // sem dados ainda
      monthAA:      0,
      monthFct:     0,
      monthDesafio: 0,
      defaultProj:  0,
      ytdAA:      0,
      ytdDesafio: 0,
      ytdReal:    0,
      ytdPct:     0,
      ytdDelta:   0,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [mFat.aa, mFat.fct, mFat.desafio, mFat.real, mVol.aa, mVol.fct, mVol.desafio, mVol.real,
      ytdFat.aa, ytdFat.fct, ytdFat.real, ytdFat.pct, ytdFat.delta,
      ytdVol.aa, ytdVol.fct, ytdVol.real, ytdVol.pct, ytdVol.delta,
      farol.weights.FAT, farol.weights.VOL]);

  // Editable PROJ values
  const [projValues, setProjValues] = useState<Record<string, string>>({});
  const [savingProj, setSavingProj] = useState(false);
  const [projSaved, setProjSaved] = useState(false);
  const [projLoaded, setProjLoaded] = useState(false);

  useEffect(() => {
    setProjValues(prev => {
      const next: Record<string, string> = {};
      baseRows.forEach(r => { next[r.label] = prev[r.label] ?? String(r.defaultProj); });
      return next;
    });
  }, [baseRows]);

  // Load saved proj from comment prop
  useEffect(() => {
    if (projLoaded || !comment) return;
    try {
      const parsed = JSON.parse(comment);
      if (parsed && typeof parsed === 'object') {
        setProjValues(prev => ({ ...prev, ...parsed }));
        setProjLoaded(true);
      }
    } catch { /* not json, ignore */ }
  }, [comment, projLoaded]);

  const handleProjChange = (label: string, val: string) => {
    setProjValues(prev => ({ ...prev, [label]: val.replace(/[^\d]/g, '') }));
  };

  const handleSaveProj = async () => {
    setSavingProj(true);
    try {
      await fetch('/api/processo-comercial/rdm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, manager, slide_key: 'projecao_proj', comment: JSON.stringify(projValues) }),
      });
      setProjSaved(true);
      setTimeout(() => setProjSaved(false), 2500);
    } finally {
      setSavingProj(false);
    }
  };

  function getProjNum(label: string, def: number): number {
    const v = projValues[label];
    if (v === undefined || v === '') return def;
    return parseInt(v, 10) || 0;
  }

  function cPct(proj: number, desafio: number): number {
    return desafio > 0 ? (proj / desafio) * 100 : 0;
  }

  const totalMonthPct = useMemo(() => {
    // Only rows with a desafio > 0 contribute to total
    const rows = [
      { proj: getProjNum('QUANTIDADE',   baseRows[0].defaultProj), desafio: baseRows[0].monthDesafio, weight: baseRows[0].weight },
      { proj: getProjNum('FATURAMENTO',  baseRows[1].defaultProj), desafio: baseRows[1].monthDesafio, weight: baseRows[1].weight },
    ].filter(r => r.desafio > 0 && r.weight > 0);
    if (!rows.length) return 0;
    const totalW = rows.reduce((a, r) => a + r.weight, 0);
    return rows.reduce((a, r) => a + cPct(r.proj, r.desafio) * r.weight, 0) / totalW;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projValues, baseRows]);

  const totalYtdPct = (() => {
    const rows = [
      { pct: ytdVol.pct, weight: farol.weights.VOL },
      { pct: ytdFat.pct, weight: farol.weights.FAT },
    ].filter(r => r.weight > 0);
    if (!rows.length) return 0;
    const totalW = rows.reduce((a, r) => a + r.weight, 0);
    return rows.reduce((a, r) => a + r.pct * r.weight, 0) / totalW;
  })();

  function pctStyle(pct: number): React.CSSProperties {
    if (pct >= 100) return { background: '#4caf50', color: '#fff', fontWeight: 700 };
    if (pct >= 90)  return { background: '#ff9800', color: '#fff', fontWeight: 700 };
    if (pct >= 80)  return { background: '#ffeb3b', color: '#1a202c', fontWeight: 700 };
    return                  { background: '#f44336', color: '#fff', fontWeight: 700 };
  }

  function fmtN(n: number): string {
    if (n === 0) return '—';
    return n.toLocaleString('pt-BR');
  }

  const navy = '#1a3a5c';
  const navyMid = '#2d5a8e';

  const thSt: React.CSSProperties = {
    background: navy, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap',
    padding: '6px 5px', textAlign: 'center', fontSize: '0.62rem',
    border: '1px solid #2d5a8e',
  };
  const tdSt: React.CSSProperties = {
    padding: '8px 5px', textAlign: 'center', fontSize: '0.68rem',
    border: '1px solid #d1d9e0', background: '#fff', whiteSpace: 'nowrap',
  };
  const tdGr: React.CSSProperties = { ...tdSt, background: '#f4f6f9' };

  return (
    <SlideShell title="Projeção de Vendas" monthName={monthName}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>

        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#e53e3e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            PROJEÇÃO
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {projSaved && <span style={{ fontSize: '0.58rem', color: '#16a34a', fontWeight: 700 }}>✓ Projeção salva!</span>}
            <button
              onClick={handleSaveProj}
              disabled={savingProj}
              style={{
                fontSize: '0.58rem', padding: '3px 12px', borderRadius: 4,
                border: 'none', background: savingProj ? '#94a3b8' : navy, color: '#fff',
                fontWeight: 700, cursor: savingProj ? 'not-allowed' : 'pointer',
              }}
            >
              {savingProj ? 'Salvando...' : 'Salvar Projeção'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: '0 0 auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 700 }}>
            <colgroup>
              <col style={{ width: '3.5%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={3} style={{ ...thSt, textAlign: 'left', paddingLeft: 6 }}>INDICADOR</th>
                <th colSpan={6} style={{ ...thSt, background: navyMid }}>{monthName.toUpperCase()}</th>
                <th colSpan={5} style={{ ...thSt }}>{ytdLabel}</th>
              </tr>
              <tr>
                <th colSpan={2} style={thSt}></th>
                <th style={thSt}>Peso</th>
                <th style={thSt}>A A</th>
                <th style={thSt}>FCT</th>
                <th style={thSt}>Desafio</th>
                <th style={{ ...thSt, background: navyMid }}>PROJ</th>
                <th style={thSt}>%</th>
                <th style={thSt}>Δ</th>
                <th style={thSt}>A A</th>
                <th style={thSt}>Desafio</th>
                <th style={{ ...thSt, background: navyMid }}>REAL</th>
                <th style={thSt}>%</th>
                <th style={thSt}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {baseRows.map((row, i) => {
                const isInvest = row.label === 'INVESTIMENTO';
                const projNum = getProjNum(row.label, row.defaultProj);
                const mPct   = row.monthDesafio > 0 ? cPct(projNum, row.monthDesafio) : 0;
                const mDelta = row.monthDesafio > 0 ? projNum - row.monthDesafio : 0;
                return (
                  <tr key={row.label}>
                    {i === 0 && (
                      <td
                        rowSpan={baseRows.length}
                        style={{
                          ...tdSt, background: '#dce4ef', fontWeight: 800,
                          fontSize: '0.6rem', textAlign: 'center',
                          writingMode: 'vertical-rl', textOrientation: 'mixed',
                          transform: 'rotate(180deg)',
                          padding: '8px 3px', letterSpacing: '0.1em', color: navy,
                        }}
                      >
                        {farol.managerLabel}
                      </td>
                    )}
                    {/* Label + unit */}
                    <td style={{ ...tdGr, fontWeight: 700, textAlign: 'left', paddingLeft: 6 }}>
                      {row.label}
                      <span style={{ marginLeft: 4, fontSize: '0.52rem', color: '#94a3b8', fontWeight: 400 }}>{row.unit}</span>
                    </td>
                    <td style={{ ...tdSt, color: '#64748b', fontSize: '0.58rem', fontStyle: 'italic' }}>
                      {row.weight > 0 ? `${row.weight}%` : '—'}
                    </td>
                    {/* Month DB columns — N/D for Investimento */}
                    <td style={tdSt}>{isInvest ? <span style={{ color: '#94a3b8' }}>N/D</span> : fmtN(row.monthAA)}</td>
                    <td style={tdSt}>{isInvest ? <span style={{ color: '#94a3b8' }}>N/D</span> : fmtN(row.monthFct)}</td>
                    <td style={{ ...tdSt, fontWeight: 600, color: navy }}>{isInvest ? <span style={{ color: '#94a3b8' }}>N/D</span> : fmtN(row.monthDesafio)}</td>
                    {/* PROJ — always editable */}
                    <td style={{ ...tdSt, background: '#eef5ff', padding: '4px 3px' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={projValues[row.label] ?? String(row.defaultProj)}
                        onChange={e => handleProjChange(row.label, e.target.value)}
                        placeholder={isInvest ? 'R$' : undefined}
                        style={{
                          width: '100%', border: 'none', background: 'transparent',
                          textAlign: 'center', fontSize: '0.68rem', fontWeight: 700,
                          color: navy, outline: 'none',
                          fontFamily: 'var(--font-geist-sans, system-ui)',
                        }}
                      />
                    </td>
                    {/* % and Δ */}
                    <td style={{ ...tdSt, ...(isInvest ? {} : pctStyle(mPct)) }}>
                      {isInvest ? <span style={{ color: '#94a3b8' }}>—</span> : `${mPct.toFixed(1)}%`}
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700, color: (!isInvest && mDelta >= 0) ? '#2e7d32' : '#c62828' }}>
                      {isInvest ? <span style={{ color: '#94a3b8' }}>—</span> : `${mDelta >= 0 ? '+' : ''}${fmtN(mDelta)}`}
                    </td>
                    {/* YTD columns */}
                    <td style={tdSt}>{isInvest ? <span style={{ color: '#94a3b8' }}>N/D</span> : fmtN(row.ytdAA)}</td>
                    <td style={{ ...tdSt, fontWeight: 600, color: navy }}>{isInvest ? <span style={{ color: '#94a3b8' }}>N/D</span> : fmtN(row.ytdDesafio)}</td>
                    <td style={{ ...tdSt, background: '#eef5ff', fontWeight: 700 }}>{isInvest ? <span style={{ color: '#94a3b8' }}>N/D</span> : fmtN(row.ytdReal)}</td>
                    <td style={{ ...tdSt, ...(isInvest ? {} : pctStyle(row.ytdPct)) }}>
                      {isInvest ? <span style={{ color: '#94a3b8' }}>—</span> : `${row.ytdPct.toFixed(1)}%`}
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700, color: (!isInvest && row.ytdDelta >= 0) ? '#2e7d32' : '#c62828' }}>
                      {isInvest ? <span style={{ color: '#94a3b8' }}>—</span> : `${row.ytdDelta >= 0 ? '+' : ''}${fmtN(row.ytdDelta)}`}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '2px solid #1a3a5c' }}>
                <td style={{ ...tdGr, background: '#dce4ef' }}></td>
                <td colSpan={2} style={{ ...tdGr, fontWeight: 800, color: navy, textAlign: 'right', paddingRight: 8 }}>TOTAL</td>
                <td style={tdGr}></td>
                <td style={tdGr}></td>
                <td style={tdGr}></td>
                <td style={{ ...tdGr, background: '#eef5ff' }}></td>
                <td style={{ ...tdGr, fontWeight: 800, fontSize: '0.7rem', ...pctStyle(totalMonthPct) }}>
                  {totalMonthPct.toFixed(1)}%
                </td>
                <td style={tdGr}></td>
                <td style={tdGr}></td>
                <td style={tdGr}></td>
                <td style={{ ...tdGr, background: '#eef5ff' }}></td>
                <td style={{ ...tdGr, fontWeight: 800, fontSize: '0.7rem', ...pctStyle(totalYtdPct) }}>
                  {totalYtdPct.toFixed(1)}%
                </td>
                <td style={tdGr}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Observations */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📝 Observações
            </span>
            <button
              onClick={onCommentSave}
              disabled={saving}
              style={{
                fontSize: '0.55rem', padding: '3px 10px', borderRadius: 4,
                border: 'none', background: saving ? '#94a3b8' : navy, color: '#fff',
                fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <textarea
            value={comment}
            onChange={e => onCommentChange(e.target.value)}
            placeholder="Escreva aqui as observações sobre a projeção de vendas..."
            style={{
              flex: 1, resize: 'none',
              border: '1.5px solid #e2e8f0', borderRadius: 6,
              padding: '8px 10px', fontSize: '0.64rem',
              fontFamily: 'var(--font-geist-sans, system-ui)',
              color: '#1e293b', background: '#f8fafc',
              outline: 'none', lineHeight: 1.6, minHeight: 55,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = navy; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
          />
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 13: Encerramento — Obrigado! ───────────────────────────────────────────

function SlideObrigado() {
  return (
    <div
      className="rdm-slide"
      style={{
        background: '#111111',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Main text */}
      <span
        style={{
          color: '#ffffff',
          fontSize: '2.8rem',
          fontWeight: 800,
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-geist-sans, system-ui)',
          userSelect: 'none',
        }}
      >
        OBRIGADO!
      </span>

      {/* Coffee++ logo — bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: '7%',
          right: '5%',
          textAlign: 'right',
          lineHeight: 1.1,
          userSelect: 'none',
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: '1.6rem',
            fontWeight: 700,
            fontFamily: 'Georgia, serif',
            display: 'block',
          }}
        >
          Coffee
        </span>
        <span
          style={{
            color: '#ffffff',
            fontSize: '1.35rem',
            fontWeight: 700,
            fontFamily: 'var(--font-geist-sans, system-ui)',
            display: 'block',
            textAlign: 'center',
          }}
        >
          ++
        </span>
      </div>
    </div>
  );
}

// ─── Slide 12: Agenda de Rotas ───────────────────────────────────────────────

const AGENDA_MGR_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; badge: string; badgeText: string }> = {
  Julliano: { 
    bg: "rgba(59, 130, 246, 0.08)", 
    border: "rgba(59, 130, 246, 0.25)", 
    text: "#2b6cb0", 
    dot: "#3182ce",
    badge: "rgba(37, 99, 235, 0.85)",
    badgeText: "#ffffff"
  },
  Leandro:  { 
    bg: "rgba(16, 185, 129, 0.08)", 
    border: "rgba(16, 185, 129, 0.25)", 
    text: "#2c7a7b", 
    dot: "#319795",
    badge: "rgba(5, 150, 105, 0.85)",
    badgeText: "#ffffff"
  },
  Luiz:     { 
    bg: "rgba(245, 158, 11, 0.08)",  
    border: "rgba(245, 158, 11, 0.25)",  
    text: "#d69e2e", 
    dot: "#dd6b20",
    badge: "rgba(217, 119, 6, 0.85)",
    badgeText: "#ffffff"
  },
  Cristiano: {
    bg: "rgba(139, 92, 246, 0.08)", 
    border: "rgba(139, 92, 246, 0.25)", 
    text: "#6b46c1", 
    dot: "#805ad5",
    badge: "rgba(124, 58, 237, 0.85)",
    badgeText: "#ffffff"
  },
};

interface AgendaCalendarDay {
  date: Date;
  dateStr: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekday: boolean;
  dayOfWeek: number;
  isToday: boolean;
  monthLabel?: string;
}

const getAgendaCalendarGrid = (year: number, month: number, todayStr: string): AgendaCalendarDay[] => {
  const days: AgendaCalendarDay[] = [];
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startDayOfWeek = firstDayOfMonth.getUTCDay();
  const gridStart = new Date(firstDayOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - startDayOfWeek);
  
  const tempDate = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const dateStr = tempDate.toISOString().split('T')[0];
    const dayOfWeek = tempDate.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isCurrentMonth = tempDate.getUTCMonth() === month - 1;
    
    let monthLabel = undefined;
    if (tempDate.getUTCDate() === 1 || i === 0) {
      const monthsAbr = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
      monthLabel = monthsAbr[tempDate.getUTCMonth()];
    }
    
    days.push({
      date: new Date(tempDate),
      dateStr,
      dayOfMonth: tempDate.getUTCDate(),
      isCurrentMonth,
      isWeekday,
      dayOfWeek,
      isToday: dateStr === todayStr,
      monthLabel
    });
    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
  }
  return days;
};

function SlideAgendaRotas({
  monthName,
  year,
  month,
  manager: rawManager,
}: {
  monthName: string;
  year: number;
  month: number;
  manager: string;
}) {
  const manager = rawManager === 'CRISTIANO' ? 'Cristiano' : rawManager;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [managers, setManagers] = useState<string[]>([]);
  const [routesByManager, setRoutesByManager] = useState<Record<string, Record<string, string>>>({});
  const [isFullAccess, setIsFullAccess] = useState(false);
  const [currentUserManagerName, setCurrentUserManagerName] = useState<string | null>(null);
  
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const dVal = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${dVal}`;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        manager: manager,
      });
      const res = await fetch(`/api/processo-comercial/agenda?${params}`, { cache: 'no-store' });
      const json = await res.json();

      if (json.success) {
        setWeekdays(json.weekdays || []);
        setManagers(json.managers || []);
        setRoutesByManager(json.routesByManager || {});
        setIsFullAccess(json.isFullAccess ?? false);
        setCurrentUserManagerName(json.currentUserManagerName || null);
      } else {
        throw new Error(json.error || "Erro ao carregar.");
      }
    } catch (err: any) {
      setError(err?.message || "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [year, month, manager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveCell = (mgrName: string, date: string, value: string) => {
    setRoutesByManager(prev => ({
      ...prev,
      [mgrName]: {
        ...(prev[mgrName] || {}),
        [date]: value,
      },
    }));
    setEditingCell(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const routes: { manager: string; route_date: string; description: string }[] = [];

      managers.forEach(mgr => {
        if (!isFullAccess && mgr !== currentUserManagerName) return;

        const mgrRoutes = routesByManager[mgr] || {};
        weekdays.forEach(date => {
          routes.push({
            manager: mgr,
            route_date: date,
            description: mgrRoutes[date] || '',
          });
        });
      });

      const res = await fetch('/api/processo-comercial/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routes }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Salvo com sucesso!");
        setTimeout(() => setSuccess(null), 2500);
      } else {
        throw new Error(json.error || "Erro ao salvar.");
      }
    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const gridDays = getAgendaCalendarGrid(year, month, todayStr);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    fontFamily: 'var(--font-geist-sans, system-ui)',
    fontSize: '0.62rem',
  };

  const calendarGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    border: '1px solid #d0d5dd',
    borderRadius: '6px',
    overflow: 'hidden',
    flex: 1,
    background: '#fff',
  };

  const headerDayStyle: React.CSSProperties = {
    padding: '4px 2px',
    textAlign: 'center',
    fontWeight: 700,
    fontSize: '0.52rem',
    color: '#475569',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
  };

  const cellStyle = (day: AgendaCalendarDay, index: number): React.CSSProperties => {
    const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
    return {
      padding: '3px 4px',
      minHeight: '42px',
      display: 'flex',
      flexDirection: 'column',
      borderRight: (index + 1) % 7 === 0 ? 'none' : '1px solid #e2e8f0',
      borderBottom: index >= 35 ? 'none' : '1px solid #e2e8f0',
      background: day.isToday
        ? '#f0f7ff'
        : !day.isCurrentMonth
        ? '#f8fafc'
        : isWeekend
        ? '#faf5ff'
        : '#ffffff',
      opacity: !day.isCurrentMonth ? 0.45 : 1,
    };
  };

  const isConsolidated = false;

  return (
    <SlideShell title={`Agenda de Rotas | ${isConsolidated ? 'Consolidada' : manager}`} monthName={monthName}>
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p className="rdm-fat-subtitle" style={{ margin: 0 }}>
            {isConsolidated ? 'Rotas planejadas por Gerente' : `Rotas planejadas para ${manager}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {success && <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.6rem' }}>✓ {success}</span>}
            {error && <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.6rem' }}>⚠ {error}</span>}
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                fontSize: '0.58rem', padding: '3px 10px', borderRadius: 4,
                border: 'none', background: saving ? '#94a3b8' : '#1a3a5c', color: '#fff',
                fontFamily: 'var(--font-geist-sans, system-ui)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Agenda'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span style={{ marginLeft: 8 }}>Carregando rotas...</span>
          </div>
        ) : (
          <div style={calendarGridStyle}>
            {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((dayName, idx) => (
              <div key={dayName} style={{ ...headerDayStyle, borderRight: idx === 6 ? 'none' : '1px solid #e2e8f0' }}>
                {dayName}
              </div>
            ))}

            {gridDays.map((day, idx) => {
              const isEditable = day.isCurrentMonth && day.isWeekday && day.dateStr >= todayStr;

              return (
                <div key={day.dateStr} style={cellStyle(day, idx)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{
                      fontSize: '0.52rem',
                      fontWeight: day.isToday ? 900 : 700,
                      color: day.isToday ? '#2563eb' : '#475569',
                    }}>
                      {day.dayOfMonth}
                    </span>
                    {day.monthLabel && (
                      <span style={{ fontSize: '0.45rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                        {day.monthLabel}
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, overflowY: 'auto' }}>
                    {isConsolidated ? (
                      managers.map(mgr => {
                        const val = routesByManager[mgr]?.[day.dateStr] || '';
                        if (!val) return null;
                        const colors = AGENDA_MGR_COLORS[mgr] || { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155', dot: '#475569', badge: '#64748b', badgeText: '#fff' };
                        const isEditing = editingCell === `${mgr}_${day.dateStr}`;
                        const isEditableForManager = isEditable && (isFullAccess || mgr === currentUserManagerName);

                        return (
                          <div
                            key={mgr}
                            onClick={() => {
                              if (isEditableForManager && !isEditing) {
                                setEditingCell(`${mgr}_${day.dateStr}`);
                              }
                            }}
                            style={{
                              fontSize: '0.48rem',
                              padding: '1px 3px',
                              borderRadius: '2px',
                              border: `1px solid ${colors.border}`,
                              background: colors.bg,
                              color: colors.text,
                              cursor: isEditableForManager ? 'pointer' : 'default',
                              fontWeight: 600,
                              lineHeight: '1.2',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={`${mgr}: ${val}`}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                defaultValue={val}
                                onBlur={(e) => handleSaveCell(mgr, day.dateStr, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(mgr, day.dateStr, e.currentTarget.value);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                style={{
                                  width: '100%', fontSize: '0.45rem', border: 'none', background: '#fff', outline: 'none',
                                  padding: 0, height: '11px', color: '#111',
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span><strong>{mgr[0]}:</strong> {val}</span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      (() => {
                        const val = routesByManager[manager]?.[day.dateStr] || '';
                        const isEditing = editingCell === `${manager}_${day.dateStr}`;
                        const isEditableForManager = isEditable && (isFullAccess || manager === currentUserManagerName);
                        const colors = AGENDA_MGR_COLORS[manager] || { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155', dot: '#475569', badge: '#64748b', badgeText: '#fff' };

                        if (isEditing) {
                          return (
                            <textarea
                              autoFocus
                              defaultValue={val}
                              onBlur={(e) => handleSaveCell(manager, day.dateStr, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveCell(manager, day.dateStr, e.currentTarget.value);
                                }
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              style={{
                                width: '100%', height: '100%', minHeight: '26px', fontSize: '0.48rem',
                                border: '1px solid var(--accent-gold)', borderRadius: '2px', padding: '1px',
                                outline: 'none', background: '#fff', color: '#111', resize: 'none',
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          );
                        }

                        if (val) {
                          return (
                            <div
                              onClick={() => {
                                if (isEditableForManager) setEditingCell(`${manager}_${day.dateStr}`);
                              }}
                              style={{
                                flex: 1,
                                fontSize: '0.48rem',
                                padding: '2px 4px',
                                borderRadius: '2px',
                                background: colors.bg,
                                border: `1px solid ${colors.border}`,
                                color: colors.text,
                                cursor: isEditableForManager ? 'pointer' : 'default',
                                fontWeight: 600,
                                wordBreak: 'break-all',
                                display: 'flex',
                                alignItems: 'flex-start',
                              }}
                            >
                              {val}
                            </div>
                          );
                        }

                        return isEditableForManager ? (
                          <div
                            onClick={() => setEditingCell(`${manager}_${day.dateStr}`)}
                            style={{
                              flex: 1,
                              border: '1px dashed #cbd5e1',
                              borderRadius: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#94a3b8',
                              fontSize: '0.45rem',
                              cursor: 'pointer',
                              minHeight: '14px',
                            }}
                          >
                            + Rota
                          </div>
                        ) : null;
                      })()
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SlideShell>
  );
}

// ─── Slide 8: Preço KA — Tabela por Canal/Matriz ─────────────────────────────

interface PrecoTabelaRow {
  name: string;
  fatAcum: number;
  monthPrices: Record<number, number>;
}

function getHeatColor(val: number, avg: number): string {
  if (!val || !avg) return 'transparent';
  const ratio = val / avg;
  if (ratio >= 1.05) return '#2e7d32';       // verde forte
  if (ratio >= 1.00) return '#66bb6a';       // verde médio
  if (ratio >= 0.97) return '#a5d6a7';       // verde claro
  if (ratio >= 0.94) return 'transparent';    // neutro
  if (ratio >= 0.90) return '#ffcdd2';        // vermelho claro
  if (ratio >= 0.85) return '#ef5350';        // vermelho médio
  return '#c62828';                           // vermelho forte
}
function heatText(val: number, avg: number): string {
  if (!val || !avg) return '#374151';
  const ratio = val / avg;
  if (ratio >= 1.00) return '#fff';
  if (ratio >= 0.94) return '#374151';
  if (ratio >= 0.90) return '#7f1d1d';
  return '#fff';
}

function SlidePrecoTabela({
  monthName,
  year,
  month,
  managers,
  familias,
  comment,
  onCommentChange,
  onCommentSave,
  saving,
}: {
  monthName: string;
  year: number;
  month: number;
  managers: string[];
  familias: string[];
  comment: string;
  onCommentChange: (v: string) => void;
  onCommentSave: () => void;
  saving: boolean;
}) {
  const [selFam, setSelFam] = useState('Todas');
  const [channels, setChannels] = useState<PrecoTabelaRow[]>([]);
  const [matrizes, setMatrizes] = useState<PrecoTabelaRow[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync comment from parent into editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== comment) {
      editorRef.current.innerHTML = comment || '';
    }
  }, [comment]);

  // Fetch data from preco-matriz API
  useEffect(() => {
    const fetchData = async () => {
      setLoadingTable(true);
      try {
        const params = new URLSearchParams({ year: String(year) });
        if (managers.length > 0) params.set('manager', managers.join(','));
        if (selFam !== 'Todas') params.set('familia', selFam);
        const res = await fetch(`/api/dashboard/preco-matriz?${params}`);
        const json = await res.json();
        if (!json.success) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chRows: PrecoTabelaRow[] = (json.channels || []).map((c: any) => ({
          name: c.channel,
          fatAcum: c.totalFat,
          monthPrices: c.monthPrices,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mRows: PrecoTabelaRow[] = (json.matrizes || []).map((m: any) => ({
          name: m.matriz,
          fatAcum: m.totalFat,
          monthPrices: m.monthPrices,
        }));

        setChannels(chRows);
        setMatrizes(mRows.slice(0, 15)); // top 15 por faturamento
      } catch {
        /* ignore */
      } finally {
        setLoadingTable(false);
      }
    };
    fetchData();
  }, [year, managers, selFam]);

  const monthCols = Array.from({ length: month }, (_, i) => i + 1);
  const monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const fmtBrl = (v: number) =>
    v >= 1000000
      ? `R$ ${(v / 1000000).toFixed(1)}M`
      : v >= 1000
        ? `R$ ${Math.round(v / 1000)}.${String(Math.round(v) % 1000).padStart(3, '0')}`
        : `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  const fmtPrice = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // Compute overall average price across all rows for heatmap
  const allPrices = [...channels, ...matrizes].flatMap(r => monthCols.map(m => r.monthPrices[m]).filter(Boolean));
  const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;

  const tableStyle: React.CSSProperties = {
    width: '100%', borderCollapse: 'collapse', fontSize: '0.55rem',
    fontFamily: 'var(--font-geist-sans, system-ui)',
  };
  const thStyle: React.CSSProperties = {
    padding: '3px 4px', borderBottom: '2px solid #b8860b', fontWeight: 700,
    textAlign: 'center', fontSize: '0.5rem', color: '#374151',
    textTransform: 'uppercase', letterSpacing: '0.02em',
  };
  const tdStyle: React.CSSProperties = {
    padding: '2px 4px', textAlign: 'center', fontWeight: 600,
    borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  };

  function renderTable(title: string, rows: PrecoTabelaRow[], nameHeader: string) {
    return (
      <div style={{ marginBottom: 8 }}>
        <p style={{
          fontSize: '0.6rem', fontWeight: 700, color: '#b8860b', margin: '0 0 3px 0',
          fontFamily: 'var(--font-geist-sans, system-ui)', textTransform: 'uppercase',
        }}>{title}</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 80 }}>{nameHeader}</th>
              <th style={{ ...thStyle, minWidth: 70 }}>Fat. Acumulado</th>
              {monthCols.map(m => (
                <th key={m} style={thStyle}>{monthLabels[m - 1]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#64748b' }}>
                  {fmtBrl(row.fatAcum)}
                </td>
                {monthCols.map(m => {
                  const price = row.monthPrices[m];
                  const bg = price ? getHeatColor(price, avgPrice) : 'transparent';
                  const clr = price ? heatText(price, avgPrice) : '#94a3b8';
                  return (
                    <td key={m} style={{ ...tdStyle, background: bg, color: clr, borderRadius: 2 }}>
                      {price ? fmtPrice(price) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Média */}
            {rows.length > 0 && (
              <tr style={{ borderTop: '2px solid #374151' }}>
                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 800 }}>Média Geral</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#374151' }}>
                  {fmtBrl(rows.reduce((a, r) => a + r.fatAcum, 0))}
                </td>
                {monthCols.map(m => {
                  const vals = rows.map(r => r.monthPrices[m]).filter(Boolean);
                  const totalFat = rows.reduce((a, r) => {
                    const p = r.monthPrices[m];
                    return a + (p ? p * (r.fatAcum || 1) : 0);
                  }, 0);
                  const totalWeight = rows.reduce((a, r) => a + (r.monthPrices[m] ? (r.fatAcum || 1) : 0), 0);
                  const avg = totalWeight > 0 ? totalFat / totalWeight : 0;
                  return (
                    <td key={m} style={{ ...tdStyle, fontWeight: 800, color: '#374151' }}>
                      {vals.length > 0 ? fmtPrice(avg) : '-'}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <SlideShell title="Resultado Preço KA" monthName={monthName}>
      <div style={{ display: 'flex', gap: 12, height: '100%' }}>
        {/* LEFT — Tables */}
        <div style={{ flex: '1 1 62%', overflowY: 'auto', overflowX: 'auto' }}>
          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <p style={{
              fontSize: '0.55rem', fontWeight: 700, color: '#b8860b', margin: 0,
              fontFamily: 'var(--font-geist-sans, system-ui)', textTransform: 'uppercase',
            }}>Consolidado por Canal</p>
            <select
              value={selFam}
              onChange={e => setSelFam(e.target.value)}
              style={{
                fontSize: '0.55rem', padding: '1px 4px', borderRadius: 3,
                border: '1px solid #d0d5dd', background: '#fff', color: '#374151',
                fontFamily: 'var(--font-geist-sans, system-ui)', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <option value="Todas">Todas Famílias</option>
              {familias.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {loadingTable ? (
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', padding: 20 }}>
              Carregando...
            </p>
          ) : (
            <>
              {renderTable('', channels, 'Canal')}
              {renderTable('Preço por Matriz', matrizes, 'Matriz')}
            </>
          )}
        </div>

        {/* RIGHT — Rich text comment */}
        <div style={{
          flex: '0 0 36%', display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid #e5e7eb', paddingLeft: 12,
        }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              if (editorRef.current) onCommentChange(editorRef.current.innerHTML);
            }}
            style={{
              flex: 1, overflowY: 'auto',
              fontSize: '0.65rem', lineHeight: 1.5,
              fontFamily: 'var(--font-geist-sans, system-ui)',
              color: '#374151', padding: 8,
              border: '1px solid #e2e8f0', borderRadius: 6,
              background: '#fafafa', outline: 'none',
              minHeight: 120,
            }}
          />
          <button
            onClick={onCommentSave}
            disabled={saving}
            style={{
              marginTop: 6, padding: '4px 12px', fontSize: '0.6rem', fontWeight: 700,
              borderRadius: 4, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#94a3b8' : '#2d5016', color: '#fff',
              fontFamily: 'var(--font-geist-sans, system-ui)',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar Comentário'}
          </button>
        </div>
      </div>
    </SlideShell>
  );
}

// ─── Slide 9: Volume por Matriz (Gráfico de Barras YoY) ──────────────────────

interface VolMatrizEntry {
  matriz: string;
  volPrev: number;
  volCur: number;
}

function SlideVolumeMatriz({
  monthName,
  year,
  month,
  managers,
  familias,
}: {
  monthName: string;
  year: number;
  month: number;
  managers: string[];
  familias: string[];
}) {
  const [selFam, setSelFam] = useState('Todas');
  const [mesIni, setMesIni] = useState(1);
  const [mesFim, setMesFim] = useState(month);
  const [chartData, setChartData] = useState<VolMatrizEntry[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const prevYear = year - 1;

  useEffect(() => { setMesFim(month); }, [month]);

  // Fetch both years
  useEffect(() => {
    const fetchData = async () => {
      setLoadingChart(true);
      try {
        const baseParams: Record<string, string> = {};
        if (managers.length > 0) baseParams.manager = managers.join(',');
        if (selFam !== 'Todas') baseParams.familia = selFam;

        const [resCur, resPrev] = await Promise.all([
          fetch(`/api/dashboard/preco-matriz?${new URLSearchParams({ ...baseParams, year: String(year) })}`).then(r => r.json()),
          fetch(`/api/dashboard/preco-matriz?${new URLSearchParams({ ...baseParams, year: String(prevYear) })}`).then(r => r.json()),
        ]);

        if (!resCur.success || !resPrev.success) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const curMap = new Map<string, number>();
        for (const m of (resCur.matrizes || []) as { matriz: string; monthQty?: Record<string, number> }[]) {
          let qty = 0;
          for (let mo = mesIni; mo <= mesFim; mo++) {
            qty += Number(m.monthQty?.[mo] || 0);
          }
          if (qty > 0) curMap.set(m.matriz, qty);
        }

        const prevMap = new Map<string, number>();
        for (const m of (resPrev.matrizes || []) as { matriz: string; monthQty?: Record<string, number> }[]) {
          let qty = 0;
          for (let mo = mesIni; mo <= mesFim; mo++) {
            qty += Number(m.monthQty?.[mo] || 0);
          }
          if (qty > 0) prevMap.set(m.matriz, qty);
        }

        const allMatrizes = new Set([...curMap.keys(), ...prevMap.keys()]);
        const merged: VolMatrizEntry[] = [];
        allMatrizes.forEach(name => {
          merged.push({
            matriz: name,
            volPrev: prevMap.get(name) || 0,
            volCur: curMap.get(name) || 0,
          });
        });
        merged.sort((a, b) => b.volCur - a.volCur);
        setChartData(merged.slice(0, 10));
      } catch { /* ignore */ } finally {
        setLoadingChart(false);
      }
    };
    fetchData();
  }, [year, prevYear, managers, selFam, mesIni, mesFim]);

  const monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthShort = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  const fmtQty = (v: number) => v.toLocaleString('pt-BR');

  const selectStyle: React.CSSProperties = {
    fontSize: '0.55rem', padding: '1px 4px', borderRadius: 3,
    border: '1px solid #d0d5dd', background: '#fff', color: '#374151',
    fontFamily: 'var(--font-geist-sans, system-ui)', fontWeight: 600, cursor: 'pointer',
  };

  const COLOR_PREV = '#1a3a5c';
  const COLOR_CUR = '#5b9bd5';

  const barSz = Math.max(18, Math.round(700 / (chartData.length * 2 + 2) * 0.9));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function VolBarLabel(props: any) {
    const { x, y, width, height, value } = props;
    if (!value || height < 20) return null;
    const cx = (x ?? 0) + (width ?? 0) / 2;
    const cy = (y ?? 0) + (height ?? 0) / 2;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fontSize={Math.min(10, (width ?? 30) * 0.42)} fontWeight={700}
        fill="#fff" fontFamily="var(--font-geist-sans, system-ui)"
        transform={`rotate(-90, ${cx}, ${cy})`}
      >
        {fmtQty(Number(value))}
      </text>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function VolDeltaLabel(props: any) {
    const { x, y, width, value, index } = props;
    if (!value) return null;
    const entry = chartData[index];
    if (!entry || !entry.volPrev || entry.volPrev === 0) return null;
    const pct = ((entry.volCur - entry.volPrev) / entry.volPrev) * 100;
    const sign = pct >= 0 ? '+' : '';
    const color = pct >= 0 ? '#2e7d32' : '#c62828';
    const cx = (x ?? 0) + (width ?? 0) / 2;
    return (
      <text x={cx} y={(y ?? 0) - 8} textAnchor="middle"
        fontSize={9} fontWeight={700} fill={color}
        fontFamily="var(--font-geist-sans, system-ui)"
      >{sign}{Math.round(pct)}%</text>
    );
  }

  const titleRange = mesIni === mesFim
    ? monthLabels[mesIni - 1]
    : `${monthLabels[mesIni - 1]} a ${monthLabels[mesFim - 1]}`;

  return (
    <SlideShell title="Resultado Por Matriz" monthName={titleRange}>
      <div className="rdm-fat-wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
          <p className="rdm-fat-subtitle" style={{ margin: 0 }}>
            VOLUME ACUMULADO (UNIDADES) — TOP 10 MATRIZES — {monthShort[mesIni - 1]} A {monthShort[mesFim - 1]} {prevYear} x {year}
          </p>
          <select value={selFam} onChange={e => setSelFam(e.target.value)} style={selectStyle}>
            <option value="Todas">Todas Famílias</option>
            {familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <span style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 600 }}>Mês:</span>
          <select value={mesIni} onChange={e => setMesIni(Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{monthLabels[m - 1]}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 600 }}>a</span>
          <select value={mesFim} onChange={e => setMesFim(Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 12 }, (_, i) => i + 1).filter(m => m >= mesIni).map(m => (
              <option key={m} value={m}>{monthLabels[m - 1]}</option>
            ))}
          </select>
        </div>

        <div className="rdm-fat-chart">
          {loadingChart ? (
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', paddingTop: 80 }}>Carregando...</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 30, right: 10, left: 4, bottom: 2 }} barCategoryGap="18%" barGap={2}>
                <CartesianGrid vertical={false} stroke="#e8ecf0" strokeDasharray="0" />
                <XAxis
                  dataKey="matriz"
                  tick={{ fontSize: 8, fill: '#374151', fontWeight: 700, fontFamily: 'var(--font-geist-sans, system-ui)' }}
                  axisLine={{ stroke: '#d0d5dd', strokeWidth: 1 }}
                  tickLine={false} height={32} interval={0} angle={-15} textAnchor="end"
                />
                <YAxis yAxisId="left" orientation="left"
                  tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                  width={42} tickCount={6}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(30,136,229,0.06)' }}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', fontFamily: 'var(--font-geist-sans, system-ui)' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const yr = name === 'volPrev' ? prevYear : year;
                    return [Number(value).toLocaleString('pt-BR'), `${yr}`];
                  }}
                />
                <Bar yAxisId="left" dataKey="volPrev" barSize={barSz} radius={[3, 3, 0, 0]} isAnimationActive={false} fill={COLOR_PREV}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <LabelList dataKey="volPrev" content={(p: any) => <VolBarLabel {...p} />} />
                </Bar>
                <Bar yAxisId="left" dataKey="volCur" barSize={barSz} radius={[3, 3, 0, 0]} isAnimationActive={false} fill={COLOR_CUR}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <LabelList dataKey="volCur" content={(p: any) => <VolBarLabel {...p} />} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <LabelList dataKey="volCur" content={(p: any) => <VolDeltaLabel {...p} />} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rdm-fat-legend">
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_PREV }} />
            <span className="rdm-fat-leg-text">{prevYear}</span>
          </span>
          <span className="rdm-fat-leg-item">
            <span className="rdm-fat-dot" style={{ background: COLOR_CUR }} />
            <span className="rdm-fat-leg-text">{year}</span>
          </span>
        </div>
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
          <label className="rdm-comment-label">Comentários</label>
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
  const [isPresenting, setIsPresenting] = useState(false);
  const [barVisible,   setBarVisible]   = useState(false);
  const barTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    { key: 'capa',            label: 'Capa' },
    { key: 'agenda',           label: 'Pauta' },
    { key: 'farol_metas',      label: 'Farol de Metas' },
    { key: 'dre',              label: 'Resultado DRE' },
    { key: 'fat_mensal',       label: 'Resultado Faturamento' },
    { key: 'vol_mensal',       label: 'Resultado Volume' },
    { key: 'vol_preco_medio',  label: 'Volume e Preço Médio' },
    { key: 'preco_yoy',        label: 'Resultado Preço KA' },
    { key: 'preco_tabela',     label: 'Preço por Canal/Matriz' },
    { key: 'vol_matriz',       label: 'Volume por Matriz' },
    { key: 'preco_familia',    label: 'Preço por Família' },
    { key: 'plano_acao',        label: 'Plano de Ação' },
    { key: 'projecao_vendas',   label: 'Projeção de Vendas' },
    { key: 'agenda_rotas',      label: 'Agenda de Rotas' },
    { key: 'obrigado',           label: 'Encerramento' },
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
      if ((e.target as HTMLElement)?.isContentEditable) return;
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

  // Presentation mode — show bar on mouse move, hide after 2.5s
  const handlePresentMouseMove = useCallback(() => {
    setBarVisible(true);
    if (barTimerRef.current) clearTimeout(barTimerRef.current);
    barTimerRef.current = setTimeout(() => setBarVisible(false), 2500);
  }, []);

  const startPresenting = useCallback(() => {
    setIsPresenting(true);
    setBarVisible(true);
    if (barTimerRef.current) clearTimeout(barTimerRef.current);
    barTimerRef.current = setTimeout(() => setBarVisible(false), 3000);
    containerRef.current?.requestFullscreen().catch(() => {});
  }, []);

  const stopPresenting = useCallback(() => {
    setIsPresenting(false);
    setBarVisible(false);
    if (barTimerRef.current) clearTimeout(barTimerRef.current);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // ESC exits presenting
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPresenting) stopPresenting();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPresenting, stopPresenting]);

  // ── Render current slide ──
  function renderSlide() {
    if (loading || !data) return (
      <div className="rdm-slide rdm-slide-loading">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--accent-gold)" }} />
        <p>Carregando dados...</p>
      </div>
    );

    const slideKey = slides[slideIdx].key;

    if (slideKey === 'capa') {
      return (
        <SlideCapa
          manager={manager}
          monthName={monthName}
          year={year}
        />
      );
    }

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

    if (slideKey === 'dre') {
      return <SlideDre monthName={monthName} />;
    }

    if (slideKey === 'fat_mensal') {
      return (
        <SlideResultadoFaturamento
          monthName={monthName}
          year={data.year}
          month={data.month}
          prevYear={data.prevYear}
          monthlyFat={data.monthlyFat}
          acum={data.acum}
          recordFat={data.recordFat}
        />
      );
    }

    if (slideKey === 'vol_mensal') {
      return (
        <SlideResultadoVolume
          monthName={monthName}
          year={data.year}
          month={data.month}
          prevYear={data.prevYear}
          monthlyVol={data.monthlyVol}
          acumVol={data.acumVol}
          recordVol={data.recordVol}
        />
      );
    }

    if (slideKey === 'vol_preco_medio') {
      if (!data.volPreco) return (
        <SlideShell title="Volume e Preço Médio" monthName={monthName}>
          <div className="rdm-dre-placeholder">
            <span className="rdm-dre-label">Carregando...</span>
            <p className="rdm-dre-sub">Recarregue a página para atualizar os dados.</p>
          </div>
        </SlideShell>
      );
      return (
        <SlideVolPrecoMedio
          monthName={monthName}
          volPreco={data.volPreco}
          familias={data.familias ?? []}
        />
      );
    }

    if (slideKey === 'preco_yoy') {
      if (!data.precoCompare) return (
        <SlideShell title="Resultado Preço KA" monthName={monthName}>
          <div className="rdm-dre-placeholder">
            <span className="rdm-dre-label">Carregando...</span>
            <p className="rdm-dre-sub">Recarregue a página para atualizar os dados.</p>
          </div>
        </SlideShell>
      );
      return (
        <SlideResultadoPreco
          monthName={monthName}
          precoCompare={data.precoCompare}
          familias={data.familias ?? []}
        />
      );
    }

    if (slideKey === 'preco_tabela') {
      return (
        <SlidePrecoTabela
          monthName={monthName}
          year={data.year}
          month={data.month}
          managers={manager === 'CRISTIANO' ? (data.managers ?? []) : [manager]}
          familias={data.familias ?? []}
          comment={comments['preco_tabela'] ?? ''}
          onCommentChange={v => setComments(prev => ({ ...prev, preco_tabela: v }))}
          onCommentSave={() => saveComment('preco_tabela')}
          saving={savingKey === 'preco_tabela'}
        />
      );
    }

    if (slideKey === 'vol_matriz') {
      return (
        <SlideVolumeMatriz
          monthName={monthName}
          year={data.year}
          month={data.month}
          managers={manager === 'CRISTIANO' ? (data.managers ?? []) : [manager]}
          familias={data.familias ?? []}
        />
      );
    }

    if (slideKey === 'preco_familia') {
      if (!data.volPreco) return (
        <SlideShell title="Tabela de Famílias" monthName={monthName}>
          <div className="rdm-dre-placeholder">
            <span className="rdm-dre-label">Carregando...</span>
            <p className="rdm-dre-sub">Recarregue a página para atualizar os dados.</p>
          </div>
        </SlideShell>
      );
      return (
        <SlidePrecoFamilia
          monthName={monthName}
          month={data.month}
          volPreco={data.volPreco}
          familias={data.familias ?? []}
        />
      );
    }

    if (slideKey === 'plano_acao') {
      return (
        <SlidePlanoAcao
          monthName={monthName}
          comment={comments['plano_acao'] ?? ''}
          onCommentChange={v => setComments(prev => ({ ...prev, plano_acao: v }))}
          onCommentSave={() => saveComment('plano_acao')}
          saving={savingKey === 'plano_acao'}
        />
      );
    }

    if (slideKey === 'projecao_vendas') {
      return (
        <SlideProjecao
          monthName={monthName}
          month={data.month}
          year={data.year}
          manager={manager}
          farol={data.farol}
          comment={comments['projecao_proj'] ?? ''}
          onCommentChange={v => setComments(prev => ({ ...prev, projecao_vendas: v }))}
          onCommentSave={() => saveComment('projecao_vendas')}
          saving={savingKey === 'projecao_vendas'}
        />
      );
    }

    if (slideKey === 'agenda_rotas') {
      return (
        <SlideAgendaRotas
          monthName={monthName}
          year={year}
          month={month}
          manager={manager}
        />
      );
    }

    if (slideKey === 'obrigado') {
      return <SlideObrigado />;
    }

    return null;
  }

  // ── Shared slide block ──
  const slideBlock = (
    <div
      className={`rdm-slide-inner rdm-anim-${direction} ${animating ? 'rdm-animating' : ''}`}
    >
      {renderSlide()}
    </div>
  );

  // ── Presentation mode ──
  if (isPresenting) {
    return (
      <div
        ref={containerRef}
        className="rdm-presentation-overlay"
        onMouseMove={handlePresentMouseMove}
      >
        {/* Floating control bar */}
        <div className={`rdm-present-bar${barVisible ? " rdm-bar-visible" : ""}`}>
          <label className="rdm-filter-label">GERENTE</label>
          <select className="rdm-select" value={manager} onChange={e => setManager(e.target.value)}>
            {MANAGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="rdm-present-sep" />
          <label className="rdm-filter-label">MÊS</label>
          <select className="rdm-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <div className="rdm-present-sep" />
          <label className="rdm-filter-label">ANO</label>
          <select className="rdm-select" value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="rdm-present-sep" />
          <span className="rdm-present-counter">{slideIdx + 1} / {totalSlides}</span>
          <span className="rdm-present-slide-label">{slides[slideIdx].label}</span>
          <button onClick={stopPresenting} className="rdm-present-exit-btn">
            ✕ Sair
          </button>
        </div>

        {/* Slide fullscreen */}
        <div className="rdm-present-canvas">
          <button className="rdm-nav-btn rdm-nav-btn-prev" onClick={prev} disabled={slideIdx === 0} title="← Anterior">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <div className="rdm-slide-container">
            {slideBlock}
          </div>
          <button className="rdm-nav-btn rdm-nav-btn-next" onClick={next} disabled={slideIdx === totalSlides - 1} title="Próximo →">
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>

        {/* Footer dots */}
        <div className={`rdm-present-footer${barVisible ? " rdm-present-footer-visible" : ""}`}>
          <div className="rdm-dots">
            {slides.map((s, i) => (
              <button
                key={s.key}
                className={`rdm-dot${i === slideIdx ? " rdm-dot-active" : ""}`}
                onClick={() => goTo(i, i > slideIdx ? "next" : "prev")}
                title={s.label}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Normal page ──
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
          <button onClick={startPresenting} className="rdm-present-btn" title="Modo Apresentação">
            ▶ Apresentar
          </button>
          <button onClick={toggleFullscreen} className="rdm-fullscreen-btn" title={isFullscreen ? "Sair do fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* ── Filters ── */}
      <div className="rdm-filters">
        <label className="rdm-filter-label">Gerente</label>
        <select className="rdm-select" value={manager} onChange={e => setManager(e.target.value)}>
          {MANAGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label className="rdm-filter-label">Mês</label>
        <select className="rdm-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>

        <label className="rdm-filter-label">Ano</label>
        <select className="rdm-select" value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {error && <span className="rdm-filter-error">⚠ {error}</span>}
      </div>

      {/* ── Slide Player ── */}
      <div className="rdm-player-wrap">
        <button className="rdm-nav-btn rdm-nav-btn-prev" onClick={prev} disabled={slideIdx === 0} title="Slide anterior (←)">
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="rdm-slide-container">
          {slideBlock}
        </div>

        <button className="rdm-nav-btn rdm-nav-btn-next" onClick={next} disabled={slideIdx === totalSlides - 1} title="Próximo slide (→)">
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
