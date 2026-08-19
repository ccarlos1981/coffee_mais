"use client";

import React, { useState, useEffect, useMemo } from "react";
import { RdmSlideAcumuladoData, RdmAcumuladoValor } from "@/lib/dre-gerencial/types";
import { formatCompact } from "@/lib/formatters";

interface SlideDreAcumuladoProps {
  data: RdmSlideAcumuladoData | null | undefined;
  year: number;
  month?: number; // Mês global selecionado no RDM (1 a 12)
}

function fmtVal(v: number | null | undefined, isVolume: boolean): string {
  if (v === null || v === undefined) return "N/A";
  const prefix = isVolume ? "" : "R$ ";
  return prefix + formatCompact(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function fmtDelta(v: number | null | undefined, isVolume: boolean): string {
  if (v === null || v === undefined) return "N/A";
  const sign = v >= 0 ? "+" : "";
  const prefix = isVolume ? "" : "R$ ";
  return sign + prefix + formatCompact(Math.abs(v));
}

function getDeltaColor(v: number | null | undefined, isCost = false): string {
  if (v === null || v === undefined) return "#6b7280";
  if (isCost) {
    return v <= 0 ? "#16a34a" : "#dc2626";
  }
  return v >= 0 ? "#16a34a" : "#dc2626";
}

export function SlideDreAcumulado({ data, year, month }: SlideDreAcumuladoProps) {
  // Inicialização do trimestre padrão com base no mês global do RDM
  const initialTrimestre = useMemo(() => {
    if (!month || month < 1 || month > 12) return 1;
    return Math.ceil(month / 3);
  }, [month]);

  const [trimestre, setTrimestre] = useState<number>(initialTrimestre);

  useEffect(() => {
    if (month && month >= 1 && month <= 12) {
      setTrimestre(Math.ceil(month / 3));
    }
  }, [month]);

  if (!data || !data.trimestres || data.trimestres.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "2px 0", boxSizing: "border-box" }}>
        <div style={{ flex: 1, background: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Carregando dados acumulados por período...</span>
        </div>
      </div>
    );
  }

  const currentTrim = data.trimestres.find((t) => t.trimestre === trimestre) || data.trimestres[0];

  // Regra de Ocultação: Filtra apenas os meses que possuem apuração real (actual != null), preservando sempre a coluna ACUMULADO
  const activeColunas = useMemo(() => {
    if (!currentTrim || !currentTrim.colunas) return [];
    return currentTrim.colunas.filter((col) => {
      if (col.isAcum) return true;
      return currentTrim.linhas.some((linha) => {
        const val = linha.valores[col.key];
        return val && val.actual !== null && val.actual !== undefined;
      });
    });
  }, [currentTrim]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "2px 0", boxSizing: "border-box" }}>
      {/* Container Principal Claro — idêntico ao Slide 8 */}
      <div
        style={{
          flex: 1,
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #cbd5e1",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* Sub-barra superior com Seletor de Trimestre */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 12px",
            background: "#f8fafc",
            borderBottom: "1px solid #cbd5e1",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              TRIMESTRE:
            </span>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value))}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                color: "#0f172a",
                fontSize: "0.76rem",
                fontWeight: 700,
                padding: "3px 8px",
                cursor: "pointer",
                outline: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <option value={1}>1º Trimestre — JAN / FEV / MAR</option>
              <option value={2}>2º Trimestre — ABR / MAI / JUN</option>
              <option value={3}>3º Trimestre — JUL / AGO / SET</option>
              <option value={4}>4º Trimestre — OUT / NOV / DEZ</option>
            </select>
          </div>
          <span style={{ fontSize: "0.70rem", color: "#64748b", fontWeight: 600 }}>
            Resultado DRE | Acumulado por Período ({year})
          </span>
        </div>

        {/* Tabela DRE no Padrão Visual Claro do Slide 8 */}
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
          <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <thead>
              {/* Linha 1 do Cabeçalho: KPI + Períodos */}
              <tr style={{ background: "#f1f5f9" }}>
                <th
                  rowSpan={2}
                  style={{
                    padding: "6px 8px",
                    textAlign: "left",
                    fontWeight: 800,
                    fontSize: "0.70rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#1e293b",
                    borderRight: "2px solid #cbd5e1",
                    borderBottom: "2px solid #94a3b8",
                    verticalAlign: "middle",
                    width: "15%",
                  }}
                >
                  KPI
                </th>
                {activeColunas.map((col) => (
                  <React.Fragment key={col.key}>
                    {col.isAcum && (
                      <th
                        rowSpan={2}
                        style={{
                          width: "12px",
                          minWidth: "12px",
                          background: "#ffffff",
                          border: "none",
                          padding: 0,
                        }}
                      />
                    )}
                    <th
                      colSpan={4}
                      style={{
                        padding: "5px 6px",
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: "0.70rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#0f172a",
                        background: col.isAcum ? "#e2e8f0" : "#f8fafc",
                        borderRight: col.isAcum ? "none" : "2px solid #cbd5e1",
                        borderLeft: col.isAcum ? "3px solid #64748b" : "none",
                        borderBottom: "1px solid #cbd5e1",
                      }}
                    >
                      {col.isAcum ? `ACUMULADO (${currentTrim.label})` : col.label}
                    </th>
                  </React.Fragment>
                ))}
              </tr>

              {/* Linha 2 do Cabeçalho: Nomes das Subcolunas (Desafio, Actual, Δ, %Δ) */}
              <tr style={{ background: "#f8fafc" }}>
                {activeColunas.map((col) => (
                  <React.Fragment key={`sub_${col.key}`}>
                    <th style={{ padding: "4px 4px", textAlign: "right", fontWeight: 700, fontSize: "0.64rem", textTransform: "uppercase", color: "#475569", whiteSpace: "nowrap", borderLeft: col.isAcum ? "3px solid #64748b" : "none", borderBottom: "2px solid #94a3b8", background: col.isAcum ? "#f1f5f9" : "transparent" }}>Desafio</th>
                    <th style={{ padding: "4px 4px", textAlign: "right", fontWeight: 700, fontSize: "0.64rem", textTransform: "uppercase", color: "#475569", whiteSpace: "nowrap", borderBottom: "2px solid #94a3b8", background: col.isAcum ? "#f1f5f9" : "transparent" }}>Actual</th>
                    <th style={{ padding: "4px 4px", textAlign: "right", fontWeight: 700, fontSize: "0.64rem", textTransform: "uppercase", color: "#475569", whiteSpace: "nowrap", borderBottom: "2px solid #94a3b8", background: col.isAcum ? "#f1f5f9" : "transparent" }}>Δ</th>
                    <th style={{ padding: "4px 4px", textAlign: "right", fontWeight: 700, fontSize: "0.64rem", textTransform: "uppercase", color: "#475569", whiteSpace: "nowrap", borderRight: col.isAcum ? "none" : "2px solid #cbd5e1", borderBottom: "2px solid #94a3b8", background: col.isAcum ? "#f1f5f9" : "transparent" }}>%Δ</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {currentTrim.linhas.map((linha, i) => {
                const kpiName = linha.kpi.trim();
                const isHighlighted = kpiName === "Faturamento" || kpiName === "Receita Líquida" || kpiName === "Margem de Contribuição";
                const isVolume = kpiName.includes("Volume");
                const isCost = ["Impostos", "Invest. Comercial", "CPV", "Frete"].some((c) => kpiName.includes(c));

                const rowBg = isHighlighted ? "rgba(100, 116, 139, 0.14)" : i % 2 === 0 ? "#ffffff" : "#fafafa";
                const rowBorderTop = isHighlighted ? "1px solid rgba(100, 116, 139, 0.3)" : undefined;
                const rowBorderBottom = isHighlighted ? "1px solid rgba(100, 116, 139, 0.3)" : "1px solid #f1f5f9";

                return (
                  <tr
                    key={i}
                    style={{
                      fontWeight: isHighlighted ? 700 : 400,
                    }}
                  >
                    {/* Nome do KPI */}
                    <td
                      style={{
                        padding: "5px 8px",
                        color: isHighlighted ? "#0f172a" : "#334155",
                        whiteSpace: "nowrap",
                        borderRight: "2px solid #cbd5e1",
                        fontWeight: isHighlighted ? 800 : 500,
                        background: rowBg,
                        borderTop: rowBorderTop,
                        borderBottom: rowBorderBottom,
                      }}
                    >
                      {linha.kpi}
                    </td>

                    {/* Subcolunas dos Períodos */}
                    {activeColunas.map((col) => {
                      const val: RdmAcumuladoValor | undefined = linha.valores[col.key];

                      return (
                        <React.Fragment key={col.key}>
                          {col.isAcum && (
                            <td
                              style={{
                                width: "12px",
                                minWidth: "12px",
                                background: "#ffffff",
                                border: "none",
                                padding: 0,
                              }}
                            />
                          )}

                          {!val ? (
                            <>
                              <td style={{ textAlign: "right", color: "#94a3b8", background: rowBg, borderTop: rowBorderTop, borderBottom: rowBorderBottom }}>—</td>
                              <td style={{ textAlign: "right", color: "#94a3b8", background: rowBg, borderTop: rowBorderTop, borderBottom: rowBorderBottom }}>—</td>
                              <td style={{ textAlign: "right", color: "#94a3b8", background: rowBg, borderTop: rowBorderTop, borderBottom: rowBorderBottom }}>—</td>
                              <td style={{ textAlign: "right", color: "#94a3b8", borderRight: col.isAcum ? "none" : "2px solid #cbd5e1", background: rowBg, borderTop: rowBorderTop, borderBottom: rowBorderBottom }}>—</td>
                            </>
                          ) : (
                            <>
                              {/* Desafio */}
                              <td
                                style={{
                                  padding: "4px 4px",
                                  textAlign: "right",
                                  color: "#64748b",
                                  fontSize: "0.70rem",
                                  borderLeft: col.isAcum ? "3px solid #64748b" : "none",
                                  borderTop: rowBorderTop,
                                  borderBottom: rowBorderBottom,
                                  background: col.isAcum ? "rgba(226, 232, 240, 0.4)" : rowBg,
                                }}
                              >
                                {fmtVal(val.desafio, isVolume)}
                              </td>

                              {/* Actual */}
                              <td
                                style={{
                                  padding: "4px 4px",
                                  textAlign: "right",
                                  color: val.actual !== null ? "#0f172a" : "#94a3b8",
                                  fontWeight: val.actual !== null ? 700 : 400,
                                  fontSize: "0.70rem",
                                  borderTop: rowBorderTop,
                                  borderBottom: rowBorderBottom,
                                  background: col.isAcum ? "rgba(226, 232, 240, 0.4)" : rowBg,
                                }}
                              >
                                {val.actual !== null ? fmtVal(val.actual, isVolume) : "N/A"}
                              </td>

                              {/* Δ */}
                              <td
                                style={{
                                  padding: "4px 4px",
                                  textAlign: "right",
                                  color: val.actual !== null ? getDeltaColor(val.delta, isCost) : "#94a3b8",
                                  fontWeight: 600,
                                  fontSize: "0.70rem",
                                  borderTop: rowBorderTop,
                                  borderBottom: rowBorderBottom,
                                  background: col.isAcum ? "rgba(226, 232, 240, 0.4)" : rowBg,
                                }}
                              >
                                {val.actual !== null ? fmtDelta(val.delta, isVolume) : "N/A"}
                              </td>

                              {/* %Δ */}
                              <td
                                style={{
                                  padding: "4px 4px",
                                  textAlign: "right",
                                  color: val.actual !== null ? getDeltaColor(val.delta, isCost) : "#94a3b8",
                                  fontWeight: 600,
                                  fontSize: "0.70rem",
                                  borderRight: col.isAcum ? "none" : "2px solid #cbd5e1",
                                  borderTop: rowBorderTop,
                                  borderBottom: rowBorderBottom,
                                  background: col.isAcum ? "rgba(226, 232, 240, 0.4)" : rowBg,
                                }}
                              >
                                {val.actual !== null ? fmtPct(val.pctDelta) : "N/A"}
                              </td>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
