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

interface ModalConfigDesafioPctProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentManagerKey?: string;
}

export function ModalConfigDesafioPct({
  isOpen,
  onClose,
  onSuccess,
  currentManagerKey = 'CRISTIANO',
}: ModalConfigDesafioPctProps) {
  const [selectedManagerId, setSelectedManagerId] = useState<string>('CRISTIANO');
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

  // Carregar configurações da API ao abrir
  useEffect(() => {
    if (!isOpen) return;

    // Tentar selecionar a regional atual se bater com a lista
    const matched = MANAGERS_LIST.find(m => m.managerId === currentManagerKey || m.displayName.toLowerCase().includes(currentManagerKey.toLowerCase()));
    if (matched) {
      setSelectedManagerId(matched.managerId);
    } else {
      setSelectedManagerId('CRISTIANO');
    }

    loadConfigs();
  }, [isOpen, currentManagerKey]);

  // Atualizar os inputs ao trocar de gerente no modal
  useEffect(() => {
    if (!selectedManagerId || !configsMap[selectedManagerId]) {
      setImpostosStr(DEFAULTS_PCT.impostos.toString());
      setInvestimentoStr(DEFAULTS_PCT.investimento.toString());
      setCpvStr(DEFAULTS_PCT.cpv.toString());
      setFreteStr(DEFAULTS_PCT.frete.toString());
      setIsCustom(false);
      return;
    }

    const cfg = configsMap[selectedManagerId];
    setImpostosStr((cfg.impostos_pct * 100).toFixed(1));
    setInvestimentoStr((cfg.investimento_pct * 100).toFixed(1));
    setCpvStr((cfg.cpv_pct * 100).toFixed(1));
    setFreteStr((cfg.frete_pct * 100).toFixed(1));
    setIsCustom(Boolean(cfg.is_custom));
  }, [selectedManagerId, configsMap]);

  async function loadConfigs() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/processo-comercial/rdm/config');
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

      setSuccessMsg(data.message || 'Configuração salva com sucesso!');
      await loadConfigs();
      onSuccess();
      setTimeout(() => {
        setSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const currentMgrObj = MANAGERS_LIST.find(m => m.managerId === selectedManagerId) || MANAGERS_LIST[0];

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
        maxWidth: 580,
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
              Personalização das variáveis de cálculo da coluna DESAFIO do RDM (Slide 8)
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

          {/* Seletor de Gerente/Regional */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              SELECIONE A REGIONAL / GERENTE:
            </label>
            <select
              value={selectedManagerId}
              onChange={e => setSelectedManagerId(e.target.value)}
              disabled={loading || saving}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#0f172a',
                background: '#f8fafc',
              }}
            >
              {MANAGERS_LIST.map(m => (
                <option key={m.managerId} value={m.managerId}>
                  {m.displayName} {configsMap[m.managerId]?.is_custom ? '★ (Personalizada)' : '(Padrão)'}
                </option>
              ))}
            </select>
          </div>

          {/* Formulário de % */}
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
                DESAFIO DRE — {currentMgrObj.displayName.toUpperCase()}
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: isCustom ? '#fef3c7' : '#e2e8f0',
                color: isCustom ? '#92400e' : '#475569',
              }}>
                {isCustom ? 'Personalizado' : 'Valores Padrão'}
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
            disabled={loading || saving || !isCustom}
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
