'use client';

import React, { useState, useEffect } from 'react';

interface ManagerOption {
  managerId: string;
  displayName: string;
}

const MANAGERS_LIST: ManagerOption[] = [
  { managerId: 'CRISTIANO', displayName: 'Cristiano (Total)' },
  { managerId: '1001', displayName: 'Leandro (Sul)' },
  { managerId: '1002', displayName: 'Luiz (Nordeste/Sudeste)' },
  { managerId: '1000', displayName: 'Julliano (SPC)' },
  { managerId: '1003', displayName: 'John Guedes (CO+NO)' },
];

const DEFAULTS_PCT = {
  impostos: 3.5,
  investimento: 10.0,
  cpv: 46.0,
  frete: 3.0,
};

const MONTHS_LIST = [
  { value: 1, name: 'Janeiro' },
  { value: 2, name: 'Fevereiro' },
  { value: 3, name: 'Março' },
  { value: 4, name: 'Abril' },
  { value: 5, name: 'Maio' },
  { value: 6, name: 'Junho' },
  { value: 7, name: 'Julho' },
  { value: 8, name: 'Agosto' },
  { value: 9, name: 'Setembro' },
  { value: 10, name: 'Outubro' },
  { value: 11, name: 'Novembro' },
  { value: 12, name: 'Dezembro' },
];

const YEARS_LIST = [2024, 2025, 2026, 2027];

interface ModalConfigDesafioPctProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentManagerKey?: string;
  currentYear?: number;
  currentMonth?: number;
}

export function ModalConfigDesafioPct({
  isOpen,
  onClose,
  onSuccess,
  currentManagerKey = 'CRISTIANO',
  currentYear = 2026,
  currentMonth = 7,
}: ModalConfigDesafioPctProps) {
  const [selectedManagerId, setSelectedManagerId] = useState<string>('CRISTIANO');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedScope, setSelectedScope] = useState<'MONTH' | 'GLOBAL'>('MONTH');

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [configsMap, setConfigsMap] = useState<Record<string, any>>({});

  const [impostosStr, setImpostosStr] = useState<string>('3.5');
  const [investimentoStr, setInvestimentoStr] = useState<string>('10.0');
  const [cpvStr, setCpvStr] = useState<string>('46.0');
  const [freteStr, setFreteStr] = useState<string>('3.0');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [activeScope, setActiveScope] = useState<string>('DEFAULT');

  // Atualiza contexto inicial ao abrir modal
  useEffect(() => {
    if (!isOpen) return;

    const matched = MANAGERS_LIST.find(m => m.managerId === currentManagerKey || m.displayName.toLowerCase().includes(currentManagerKey.toLowerCase()));
    if (matched) {
      setSelectedManagerId(matched.managerId);
    } else {
      setSelectedManagerId('CRISTIANO');
    }

    if (currentYear) setSelectedYear(currentYear);
    if (currentMonth) setSelectedMonth(currentMonth);
    setSelectedScope('MONTH');
  }, [isOpen, currentManagerKey, currentYear, currentMonth]);

  // Carregar configurações da API sempre que manager, ano ou mês mudarem
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen, selectedManagerId, selectedYear, selectedMonth]);

  // Atualizar os inputs ao carregar dados ou trocar gerente/escopo
  useEffect(() => {
    if (!selectedManagerId || !configsMap[selectedManagerId]) {
      setImpostosStr(DEFAULTS_PCT.impostos.toFixed(1));
      setInvestimentoStr(DEFAULTS_PCT.investimento.toFixed(1));
      setCpvStr(DEFAULTS_PCT.cpv.toFixed(1));
      setFreteStr(DEFAULTS_PCT.frete.toFixed(1));
      setIsCustom(false);
      setActiveScope('DEFAULT');
      return;
    }

    const mgrData = configsMap[selectedManagerId];
    if (selectedScope === 'GLOBAL') {
      const gCfg = mgrData.global_config;
      if (gCfg) {
        setImpostosStr((Number(gCfg.impostos_pct) * 100).toFixed(1));
        setInvestimentoStr((Number(gCfg.investimento_pct) * 100).toFixed(1));
        setCpvStr((Number(gCfg.cpv_pct) * 100).toFixed(1));
        setFreteStr((Number(gCfg.frete_pct) * 100).toFixed(1));
        setIsCustom(true);
        setActiveScope('GLOBAL');
      } else {
        setImpostosStr(DEFAULTS_PCT.impostos.toFixed(1));
        setInvestimentoStr(DEFAULTS_PCT.investimento.toFixed(1));
        setCpvStr(DEFAULTS_PCT.cpv.toFixed(1));
        setFreteStr(DEFAULTS_PCT.frete.toFixed(1));
        setIsCustom(false);
        setActiveScope('DEFAULT');
      }
    } else {
      // selectedScope === 'MONTH'
      const mCfg = mgrData.month_config;
      const gCfg = mgrData.global_config;
      if (mCfg) {
        setImpostosStr((Number(mCfg.impostos_pct) * 100).toFixed(1));
        setInvestimentoStr((Number(mCfg.investimento_pct) * 100).toFixed(1));
        setCpvStr((Number(mCfg.cpv_pct) * 100).toFixed(1));
        setFreteStr((Number(mCfg.frete_pct) * 100).toFixed(1));
        setIsCustom(true);
        setActiveScope('MONTH');
      } else if (gCfg) {
        setImpostosStr((Number(gCfg.impostos_pct) * 100).toFixed(1));
        setInvestimentoStr((Number(gCfg.investimento_pct) * 100).toFixed(1));
        setCpvStr((Number(gCfg.cpv_pct) * 100).toFixed(1));
        setFreteStr((Number(gCfg.frete_pct) * 100).toFixed(1));
        setIsCustom(false);
        setActiveScope('GLOBAL');
      } else {
        setImpostosStr(DEFAULTS_PCT.impostos.toFixed(1));
        setInvestimentoStr(DEFAULTS_PCT.investimento.toFixed(1));
        setCpvStr(DEFAULTS_PCT.cpv.toFixed(1));
        setFreteStr(DEFAULTS_PCT.frete.toFixed(1));
        setIsCustom(false);
        setActiveScope('DEFAULT');
      }
    }
  }, [selectedManagerId, configsMap, selectedScope]);

  async function loadConfigs(tgtYear = selectedYear, tgtMonth = selectedMonth) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/processo-comercial/rdm/config?year=${tgtYear}&month=${tgtMonth}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao carregar configurações.');
      }

      const map: Record<string, any> = {};
      (data.configs || []).forEach((c: any) => {
        map[c.manager_id] = c;
      });
      setConfigsMap(map);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(isReset = false) {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        manager_id: selectedManagerId,
        year: selectedYear,
        month: selectedMonth,
        scope: selectedScope,
        isReset,
      };

      if (!isReset) {
        const imp = parseFloat(impostosStr.replace(',', '.'));
        const inv = parseFloat(investimentoStr.replace(',', '.'));
        const cpv = parseFloat(cpvStr.replace(',', '.'));
        const fre = parseFloat(freteStr.replace(',', '.'));

        if (isNaN(imp) || isNaN(inv) || isNaN(cpv) || isNaN(fre)) {
          throw new Error('Todos os percentuais devem ser números válidos.');
        }

        payload.impostos_pct = imp / 100;
        payload.investimento_pct = inv / 100;
        payload.cpv_pct = cpv / 100;
        payload.frete_pct = fre / 100;
      }

      const res = await fetch('/api/processo-comercial/rdm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar configuração.');
      }

      setSuccessMsg(data.message || 'Configuração salva com sucesso no banco de dados!');
      await loadConfigs();
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const currentMgrObj = MANAGERS_LIST.find(m => m.managerId === selectedManagerId) || MANAGERS_LIST[0];
  const currentMonthName = MONTHS_LIST.find(m => m.value === selectedMonth)?.name || 'Mês';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 620,
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              ⚙ Configuração de Percentuais do Desafio DRE
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
              Personalização por Mês das variáveis de cálculo da coluna DESAFIO no RDM (Slide 8 e Slide 9)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}>
              ⚠ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}>
              ✓ {successMsg}
            </div>
          )}

          {/* Grid de Filtros: Regional/Gerente + Mês/Ano */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                REGIONAL / GERENTE:
              </label>
              <select
                value={selectedManagerId}
                onChange={e => setSelectedManagerId(e.target.value)}
                disabled={loading || saving}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#f8fafc',
                }}
              >
                {MANAGERS_LIST.map(m => (
                  <option key={m.managerId} value={m.managerId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                MÊS:
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                disabled={loading || saving}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#f8fafc',
                }}
              >
                {MONTHS_LIST.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                ANO:
              </label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                disabled={loading || saving}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#f8fafc',
                }}
              >
                {YEARS_LIST.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seletor do Escopo de Aplicação (Mês Atual vs Padrão Geral) */}
          <div style={{ display: 'flex', gap: 10, background: '#f1f5f9', padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setSelectedScope('MONTH')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 6,
                border: 'none',
                background: selectedScope === 'MONTH' ? '#ffffff' : 'transparent',
                color: selectedScope === 'MONTH' ? '#0f172a' : '#64748b',
                fontWeight: selectedScope === 'MONTH' ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: selectedScope === 'MONTH' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              📅 Específico para {currentMonthName} / {selectedYear}
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope('GLOBAL')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 6,
                border: 'none',
                background: selectedScope === 'GLOBAL' ? '#ffffff' : 'transparent',
                color: selectedScope === 'GLOBAL' ? '#0f172a' : '#64748b',
                fontWeight: selectedScope === 'GLOBAL' ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: selectedScope === 'GLOBAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              🌐 Padrão Geral da Regional (Todos os Meses)
            </button>
          </div>

          {/* Formulário de Percentuais */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em' }}>
                DESAFIO DRE — {currentMgrObj.displayName.toUpperCase()} ({selectedScope === 'MONTH' ? `${currentMonthName.toUpperCase()} / ${selectedYear}` : 'PADRÃO GERAL'})
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: loading ? '#f1f5f9' : (activeScope === 'MONTH' ? '#fef3c7' : (activeScope === 'GLOBAL' ? '#e0f2fe' : '#e2e8f0')),
                color: loading ? '#64748b' : (activeScope === 'MONTH' ? '#92400e' : (activeScope === 'GLOBAL' ? '#0369a1' : '#475569')),
              }}>
                {loading ? '⏳ Carregando...' : (
                  selectedScope === 'GLOBAL'
                    ? (activeScope === 'GLOBAL' ? '🌐 Padrão Regional Personalizado' : '⚙ Padrão Regional (Default)')
                    : (activeScope === 'MONTH' ? `📌 Mês ${selectedYear}-${String(selectedMonth).padStart(2, '0')}` : (activeScope === 'GLOBAL' ? '🌐 Herdado do Padrão Regional' : '⚙ Padrão Sistema'))
                )}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Impostos */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  <span>Impostos (%)</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>Ref: 3,5%</span>
                </label>
                <input
                  type="text"
                  value={impostosStr}
                  onChange={e => setImpostosStr(e.target.value)}
                  disabled={loading || saving}
                  placeholder="3.5"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Investimento Comercial */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  <span>Investimento (%)</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>Ref: 10,0%</span>
                </label>
                <input
                  type="text"
                  value={investimentoStr}
                  onChange={e => setInvestimentoStr(e.target.value)}
                  disabled={loading || saving}
                  placeholder="10.0"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* CPV */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  <span>CPV (%)</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>Ref: 46,0%</span>
                </label>
                <input
                  type="text"
                  value={cpvStr}
                  onChange={e => setCpvStr(e.target.value)}
                  disabled={loading || saving}
                  placeholder="46.0"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Frete */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  <span>Frete (%)</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>Ref: 3,0%</span>
                </label>
                <input
                  type="text"
                  value={freteStr}
                  onChange={e => setFreteStr(e.target.value)}
                  disabled={loading || saving}
                  placeholder="3.0"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading || saving || (!isCustom && activeScope === 'DEFAULT')}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: isCustom ? '#dc2626' : '#94a3b8',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: isCustom ? 'pointer' : 'not-allowed',
            }}
          >
            RESTAURAR PADRÃO
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={loading || saving}
              style={{
                padding: '7px 18px',
                borderRadius: 6,
                border: 'none',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {saving ? 'SALVANDO...' : 'SALVAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
