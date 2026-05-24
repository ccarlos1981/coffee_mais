"use client";

import React from "react";

interface GlassTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  labelFormatter?: (label: string, payload: GlassTooltipProps["payload"]) => string;
  formatter?: (value: number | string, name: string) => [string, string] | string;
  valuePrefix?: string;
  valueSuffix?: string;
}

export function GlassTooltip({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  valuePrefix = "",
  valueSuffix = "",
}: GlassTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const displayLabel = labelFormatter
    ? labelFormatter(label || "", payload)
    : label;

  return (
    <div
      style={{
        background: "rgba(var(--tooltip-bg-rgb, 30, 30, 30), 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
        minWidth: 140,
      }}
    >
      {displayLabel && (
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.92)",
            marginBottom: 6,
            letterSpacing: "0.01em",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            paddingBottom: 5,
          }}
        >
          {displayLabel}
        </p>
      )}
      {payload.map((entry, index) => {
        let displayValue: string;
        let displayName: string;

        if (formatter) {
          const result = formatter(entry.value ?? 0, entry.name || "");
          if (Array.isArray(result)) {
            [displayValue, displayName] = result;
          } else {
            displayValue = result;
            displayName = entry.name || "";
          }
        } else {
          displayValue = `${valuePrefix}${entry.value}${valueSuffix}`;
          displayName = entry.name || "";
        }

        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "3px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: entry.color || "var(--accent-gold)",
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${entry.color || "var(--accent-gold)"}60`,
                }}
              />
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontWeight: 500,
                }}
              >
                {displayName}
              </span>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}
