"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Upload, CheckCircle2, AlertCircle,
  DollarSign, Calendar, Users, BarChart3,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import ExcelParser from "./ExcelParser";
import { salvarDREHistorico, listarGerentesParaDRE } from "./actions";
import { DREItemInput } from "../constants";


const MESES_NOMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const CENARIOS = ["REAL", "BUDGET", "FORECAST"] as const;
type Cenario = typeof CENARIOS[number];

interface Gerente {
  id: string;
  name: string | null;
  role: string;
}

interface ParsedMonth {
  mes: number;
  items: DREItemInput[];
}

interface LancarDREFormProps {
  gerentes: Gerente[];
}

export default function LancarDREForm({ gerentes }: LancarDREFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [ano, setAno] = useState(new Date().getFullYear());
  const [cenario, setCenario] = useState<Cenario>("REAL");
  const [gerenteId, setGerenteId] = useState<string>(""); // "" = consolidado
  const [parsedData, setParsedData] = useState<{ meses: ParsedMonth[]; ano: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleParsed = (result: { meses: ParsedMonth[]; ano: number }) => {
    setParsedData(result);
    setAno(result.ano);
  };

  const handleSalvar = () => {
    if (!parsedData || parsedData.meses.length === 0) {
      setErrorMsg("Nenhum dado para salvar. Faça o upload de um arquivo Excel primeiro.");
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saving");
    setErrorMsg("");

    startTransition(async () => {
      try {
        // Salvar cada mês separadamente
        for (const { mes, items } of parsedData.meses) {
          await salvarDREHistorico({
            ano,
            mes,
            cenario,
            gerente_id: gerenteId || null,
            items,
          });
        }
        setSaveStatus("success");
        setTimeout(() => router.push("/dre/historico"), 1800);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao salvar dados.";
        setErrorMsg(msg);
        setSaveStatus("error");
      }
    });
  };

  const mesesComDados = parsedData?.meses.map((m) => m.mes) ?? [];
  const anos = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="cm-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="cm-header">
        <div className="cm-header-brand">
          <div className="cm-logo">
            <BarChart3 size={18} />
          </div>
          <div>
            <div className="cm-brand-name">Coffee++</div>
            <div className="cm-brand-sub">APURAÇÃO DE RESULTADOS COMERCIAIS</div>
          </div>
        </div>
        <nav className="cm-header-nav">
          <Link href="/dre" className="cm-nav-link">DRE</Link>
          <Link href="/dre/historico" className="cm-nav-link">Histórico</Link>
        </nav>
        <div className="cm-header-actions">
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="cm-main dre-lancar-main">
        {/* Breadcrumb */}
        <div className="dre-lancar-breadcrumb">
          <Link href="/dre/historico" className="dre-back-link">
            <ArrowLeft size={16} />
            Voltar ao Histórico
          </Link>
        </div>

        <div className="dre-lancar-header">
          <h1 className="dre-lancar-title">
            <Upload size={22} />
            Lançar Dados — DRE Histórico
          </h1>
          <p className="dre-lancar-subtitle">
            Faça upload do arquivo Excel com os dados do DRE. Os dados serão validados antes de salvar.
          </p>
        </div>

        <div className="dre-lancar-grid">
          {/* ── Coluna Esquerda: Configurações ── */}
          <div className="dre-lancar-config-card">
            <h2 className="dre-card-title">
              <Calendar size={16} />
              Configurações do Lançamento
            </h2>

            {/* Ano */}
            <div className="dre-form-group">
              <label htmlFor="dre-ano" className="dre-form-label">Ano de referência</label>
              <select
                id="dre-ano"
                className="dre-form-select"
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value))}
              >
                {anos.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Cenário */}
            <div className="dre-form-group">
              <label htmlFor="dre-cenario" className="dre-form-label">Cenário</label>
              <div className="dre-cenario-tabs">
                {CENARIOS.map((c) => (
                  <button
                    key={c}
                    id={`dre-cenario-${c.toLowerCase()}`}
                    className={`dre-cenario-tab ${cenario === c ? "dre-cenario-tab--active" : ""}`}
                    onClick={() => setCenario(c)}
                    type="button"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Gerente */}
            <div className="dre-form-group">
              <label htmlFor="dre-gerente" className="dre-form-label">
                <Users size={14} />
                Gerente / Unidade
              </label>
              <select
                id="dre-gerente"
                className="dre-form-select"
                value={gerenteId}
                onChange={(e) => setGerenteId(e.target.value)}
              >
                <option value="">Consolidado (toda a empresa)</option>
                {gerentes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name ?? g.id}
                  </option>
                ))}
              </select>
              <p className="dre-form-hint">
                Deixe "Consolidado" para dados da empresa toda, ou selecione um gerente para dados por unidade.
              </p>
            </div>

            {/* Resumo dos meses detectados */}
            {mesesComDados.length > 0 && (
              <div className="dre-meses-detectados">
                <p className="dre-meses-title">Meses detectados no arquivo:</p>
                <div className="dre-meses-chips">
                  {mesesComDados.sort((a, b) => a - b).map((m) => (
                    <span key={m} className="dre-mes-chip">
                      {MESES_NOMES[m - 1].slice(0, 3).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Botão Salvar */}
            <button
              id="dre-salvar-btn"
              className={`dre-salvar-btn ${!parsedData ? "dre-salvar-btn--disabled" : ""}`}
              onClick={handleSalvar}
              disabled={!parsedData || isPending || saveStatus === "saving"}
            >
              {saveStatus === "saving" ? (
                <>
                  <span className="dre-spinner-sm" />
                  Salvando...
                </>
              ) : (
                <>
                  <DollarSign size={16} />
                  Confirmar e Salvar
                </>
              )}
            </button>

            {/* Feedback */}
            {saveStatus === "success" && (
              <div className="dre-feedback dre-feedback--success">
                <CheckCircle2 size={16} />
                <span>Dados salvos com sucesso! Redirecionando...</span>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="dre-feedback dre-feedback--error">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* ── Coluna Direita: Upload ── */}
          <div className="dre-lancar-upload-card">
            <h2 className="dre-card-title">
              <Upload size={16} />
              Upload do Arquivo Excel
            </h2>
            <ExcelParser onParsed={handleParsed} />

            <div className="dre-instrucoes">
              <h3>Estrutura esperada do arquivo:</h3>
              <ul>
                <li>Coluna A: nome das linhas (ex: "Receita Bruta", "GGF"...)</li>
                <li>Demais colunas: meses (JAN, FEV, ..., DEZ)</li>
                <li>O sistema detecta automaticamente o ano e os rótulos</li>
                <li>Linhas não reconhecidas são ignoradas sem erro</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* ── Bottom Nav ─────────────────────────────────────────── */}
      <nav className="bottom-nav">
        <Link href="/" className="bottom-tab">
          <span className="bottom-tab-icon">🏠</span>
          <span>Início</span>
        </Link>
        <Link href="/dre" className="bottom-tab bottom-tab--active">
          <DollarSign className="bottom-tab-icon" />
          <span>DRE</span>
        </Link>
        <Link href="/vendas" className="bottom-tab">
          <BarChart3 className="bottom-tab-icon" />
          <span>Vendas</span>
        </Link>
      </nav>
    </div>
  );
}
