"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
                {/* Label de valor dentro da barra */}
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
                    if (!v || h < 24) return null;
                    const cx = x + w / 2;
                    const cy = y + h - 10;
                    return (
                      <text x={cx} y={cy} textAnchor="middle"
                        fontSize={Math.min(7.5, w * 0.32)} fontWeight={600} fill="#1a6b8a"
                        fontFamily="var(--font-geist-sans, system-ui)"
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
    { key: 'agenda',           label: 'Pauta' },
    { key: 'farol_metas',      label: 'Farol de Metas' },
    { key: 'dre',              label: 'Resultado DRE' },
    { key: 'fat_mensal',       label: 'Resultado Faturamento' },
    { key: 'vol_mensal',       label: 'Resultado Volume' },
    { key: 'vol_preco_medio',  label: 'Volume e Preço Médio' },
    { key: 'preco_yoy',        label: 'Resultado Preço KA' },
    { key: 'preco_tabela',     label: 'Preço por Canal/Matriz' },
    { key: 'vol_matriz',       label: 'Volume por Matriz' },
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
