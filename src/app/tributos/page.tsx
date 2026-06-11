"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Home,
  DollarSign,
  History,
  Users,
  Upload,
  TrendingUp,
  Receipt,
  Calendar,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

/* ═══ FAKE DATA ═══ */
interface TributoData {
  sku: string;
  skuLabel: string;
  origem: string;
  destino: string;
  aliqIcms: string;
  pis: string;
  cofins: string;
  cclassTrib: string;
  cstIbsCbs: string;
  aliqEfetivaIcms: string;
  mvaIvaSt: string;
  redBCalcIcmsSt: string;
  pctIcmsStPreco: string;
  tributacaoTotal: string;
  ncm: string;
  cest: string;
  cstIcms: string;
  cstPisCofins: string;
  obs: string;
}

const FAKE_SKUS = [
  { value: "40.05.0001", label: "PQ Forno de Minas Coquetel FS 10 x 1000g" },
  { value: "40.05.0002", label: "PQ Forno de Minas Pão de Queijo 20 x 400g" },
  { value: "40.05.0003", label: "PQ Forno de Minas Tradicional 12 x 500g" },
  { value: "40.05.0004", label: "PQ Forno de Minas Lanche 8 x 800g" },
];

const UFS = ["BA","CE","DF","ES","GO","MA","MG","MS","PR","RJ","RS","SC","SP"];

const FAKE_TRIBUTO: TributoData = {
  sku: "40.05.0001",
  skuLabel: "PQ Forno de Minas Coquetel FS 10 x 1000g",
  origem: "MG",
  destino: "MG",
  aliqIcms: "18,00%",
  pis: "1,65%",
  cofins: "7,60%",
  cclassTrib: "000001",
  cstIbsCbs: "000",
  aliqEfetivaIcms: "7,00%",
  mvaIvaSt: "45,00%",
  redBCalcIcmsSt: "61,11%",
  pctIcmsStPreco: "3,15%",
  tributacaoTotal: "18,7526%",
  ncm: "1901.20.90.",
  cest: "17.046.15",
  cstIcms: "070",
  cstPisCofins: "01",
  obs: "Aliq. interna em MG de 18%, mas devido ao benefício do PQ, a aliq. efetiva se torna 7%",
};

/* ═══ COMPONENT ═══ */
export default function TributosPage() {
  const [selectedSku, setSelectedSku] = useState(FAKE_SKUS[0].value);
  const [selectedOrigem, setSelectedOrigem] = useState("MG");
  const [selectedDestino, setSelectedDestino] = useState("MG");

  const currentSku = FAKE_SKUS.find(s => s.value === selectedSku);
  const data = FAKE_TRIBUTO;

  /* ─── MAIN PAGE ─── */
  return (
    <div className="cm-page">
      {/* TOP NAV */}
      <nav className="cm-topnav">
        <div className="cm-nav-links">
          <Link href="/vendas" className="cm-nav-link">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <BarChart3 style={{ width: 12, height: 12 }} /> Dashboard
            </span>
          </Link>
          <Link href="/investimento" className="cm-nav-link">Investimento</Link>
          <Link href="/dre" className="cm-nav-link">DRE</Link>
        </div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-heading)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            TRIBUTAÇÃO
          </h1>
        </div>
        <div className="cm-nav-right">
          <ThemeToggle />
        </div>
      </nav>

      {/* BODY: SIDEBAR + MAIN */}
      <div className="dash-body">
        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <p className="dash-sidebar-title" style={{ marginTop: 0 }}>SKU</p>
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            className="dash-filter-select"
            style={{ fontSize: "0.7rem" }}
          >
            {FAKE_SKUS.map(s => (
              <option key={s.value} value={s.value}>{s.value}</option>
            ))}
          </select>

          <p className="dash-sidebar-title">Origem</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {UFS.map(uf => (
              <label key={`o-${uf}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "var(--foreground-secondary)", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="origem"
                  value={uf}
                  checked={selectedOrigem === uf}
                  onChange={() => setSelectedOrigem(uf)}
                  style={{ accentColor: "var(--accent-gold)" }}
                />
                {uf}
              </label>
            ))}
          </div>

          <p className="dash-sidebar-title">Destino</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {UFS.map(uf => (
              <label key={`d-${uf}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "var(--foreground-secondary)", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="destino"
                  value={uf}
                  checked={selectedDestino === uf}
                  onChange={() => setSelectedDestino(uf)}
                  style={{ accentColor: "var(--accent-gold)" }}
                />
                {uf}
              </label>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="dash-content" style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* SKU Title */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)", letterSpacing: "0.01em" }}>
              {currentSku?.label}
            </p>
          </div>

          {/* Row 1: ALIQ ICMS, PIS, COFINS, CclassTrib, CST IBS e CBS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
            <TribCard label="ALIQ. ICMS" value={data.aliqIcms} />
            <TribCard label="PIS" value={data.pis} />
            <TribCard label="COFINS" value={data.cofins} />
            <TribCard label="CclassTrib" value={data.cclassTrib} />
            <TribCard label="CST IBS e CBS" value={data.cstIbsCbs} />
          </div>

          {/* Row 2: ALIQ EFETIVA, MVA/IVA ST, Red. B. Cálculo, % ICMS-ST, TRIBUTAÇÃO TOTAL */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
            <TribCard label="ALIQ. EFETIVA ICMS" value={data.aliqEfetivaIcms} accent />
            <TribCard label="MVA/IVA ST" value={data.mvaIvaSt} accent />
            <TribCard label="Red. B. Cálculo ICMS ST" value={data.redBCalcIcmsSt} accent />
            <TribCard label="% DO ICMS-ST SOBRE O PREÇO" value={data.pctIcmsStPreco} accent />
            <TribCard label="TRIBUTAÇÃO TOTAL" value={data.tributacaoTotal} accent highlight />
          </div>

          {/* Row 3: NCM, CEST, CST ICMS, CST PIS E COFINS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <TribCard label="NCM" value={data.ncm} small />
            <TribCard label="CEST" value={data.cest} small />
            <TribCard label="CST ICMS" value={data.cstIcms} small />
            <TribCard label="CST PIS E COFINS" value={data.cstPisCofins} small />
          </div>

          {/* OBS */}
          <div className="glass-card" style={{ padding: "12px 16px" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--foreground-muted)", marginBottom: 4 }}>OBS:</p>
            <p style={{ fontSize: "0.78rem", color: "var(--foreground-secondary)", lineHeight: 1.5 }}>
              {data.obs}
            </p>
          </div>
        </main>
      </div>

      {/* BOTTOM TAB BAR */}
      <nav className="bottom-tabs">
        <Link href="/" className="bottom-tab"><Home className="bottom-tab-icon" /> Menu</Link>
        <Link href="/vendas" className="bottom-tab"><BarChart3 className="bottom-tab-icon" /> Vendas</Link>
        <Link href="/historico" className="bottom-tab"><History className="bottom-tab-icon" /> Hist.</Link>
        <Link href="/preco" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Preço</Link>
        <Link href="/dia" className="bottom-tab"><Calendar className="bottom-tab-icon" /> Dia</Link>
        <Link href="/investimento" className="bottom-tab"><TrendingUp className="bottom-tab-icon" /> Inv.</Link>
        <Link href="/tributos" className="bottom-tab active"><Receipt className="bottom-tab-icon" /> Tributos</Link>
        <Link href="/upload" className="bottom-tab"><Upload className="bottom-tab-icon" /> Upload</Link>
        <Link href="/atendimento" className="bottom-tab"><Users className="bottom-tab-icon" /> Atendimento</Link>
        <span className="bottom-tab disabled"><DollarSign className="bottom-tab-icon" /> DRE</span>
      </nav>
    </div>
  );
}

/* ═══ TRIB CARD COMPONENT ═══ */
function TribCard({ label, value, accent, highlight, small }: {
  label: string;
  value: string;
  accent?: boolean;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: small ? "10px 8px" : "14px 10px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: small ? 4 : 6,
        border: highlight ? "1.5px solid var(--accent-gold)" : accent ? "1px solid rgba(100,140,180,0.3)" : undefined,
        background: accent ? "rgba(40,60,90,0.08)" : highlight ? "rgba(184,134,11,0.06)" : undefined,
        minHeight: small ? 60 : 80,
        transition: "transform 0.15s, box-shadow 0.15s",
        cursor: "default",
      }}
    >
      <span style={{
        fontSize: small ? "0.6rem" : "0.62rem",
        fontWeight: 600,
        color: "var(--foreground-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        lineHeight: 1.2,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: small ? "1.3rem" : "1.6rem",
        fontWeight: 800,
        color: highlight ? "var(--accent-gold)" : "var(--foreground)",
        letterSpacing: "-0.01em",
        lineHeight: 1,
        fontFamily: "var(--font-heading)",
      }}>
        {value}
      </span>
    </div>
  );
}
