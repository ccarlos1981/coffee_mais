"use client";

import { useId, useMemo } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
}

/**
 * Ultra-lightweight SVG sparkline for KPI cards.
 * Renders a smooth area chart with gradient fill.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "#c8a96e",
  fillOpacity = 0.15,
  strokeWidth = 1.5,
}: SparklineProps) {
  // useId() generates a stable, unique ID per component instance (React 18+)
  const uid = useId();
  const gradId = `spark-${uid.replace(/:/g, "")}`;

  const { linePath, areaPath } = useMemo(() => {
    if (!data || data.length < 2) return { linePath: "", areaPath: "" };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const points = data.map((val, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((val - min) / range) * h,
    }));

    // Create smooth cubic bezier path
    const lineSegments = points.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
    });

    const line = lineSegments.join(" ");
    const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { linePath: line, areaPath: area };
  }, [data, width, height]);

  if (!data || data.length < 2) return null;

  // Determine trend: last value vs first
  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={2 + ((data.length - 1) / (data.length - 1)) * (width - 4)}
        cy={2 + (height - 4) - ((data[data.length - 1] - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * (height - 4)}
        r={2.5}
        fill={isUp ? "var(--success)" : "var(--danger)"}
        stroke="var(--background-card)"
        strokeWidth={1}
      />
    </svg>
  );
}
