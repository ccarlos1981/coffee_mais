"use client";

import { useGovernanceSettings, SettingData } from "../hooks";
import { Settings, Save, X, AlertCircle, CheckCircle2 } from "lucide-react";
import React, { useState, useEffect } from "react";

export function GovernanceSettingsPanel() {
  const { loading, error, data: settings, updateSetting } = useGovernanceSettings();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [localValue, setLocalValue] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm animate-pulse space-y-4">
        <div className="h-5 bg-muted rounded w-1/4"></div>
        <div className="h-20 bg-muted rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return null; // Silent skip as metrics or table already logs communication errors
  }

  const startEdit = (setting: SettingData) => {
    setEditingKey(setting.key);
    setLocalValue(JSON.stringify(setting.value, null, 2));
    setValidationError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setLocalValue("");
    setValidationError(null);
  };

  const handleSave = async (key: string) => {
    setValidationError(null);
    let parsedValue: any;

    // 1. Local parsing
    try {
      parsedValue = JSON.parse(localValue);
    } catch {
      setValidationError("Formato JSON inválido. Verifique vírgulas e aspas.");
      return;
    }

    // 2. Local semantic validations
    if (key === "quality_alert_threshold") {
      const numVal = parseFloat(parsedValue);
      if (isNaN(numVal) || numVal < 0 || numVal > 100) {
        setValidationError("O threshold de qualidade deve ser um número entre 0 e 100.");
        return;
      }
    }

    if (key === "excluded_ufs_inside_sales") {
      const ufs = parsedValue.ufs;
      if (!Array.isArray(ufs)) {
        setValidationError("A chave 'ufs' deve conter um array de strings.");
        return;
      }
      const validUfs = [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
        "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
        "RS", "RO", "RR", "SC", "SP", "SE", "TO"
      ];
      for (const uf of ufs) {
        if (!validUfs.includes(uf)) {
          setValidationError(`UF inválida encontrada: '${uf}'.`);
          return;
        }
      }
    }

    // 3. Execution via Hook
    const success = await updateSetting(key, parsedValue);
    if (success) {
      setSuccessMessage(`Configuração '${key}' atualizada com sucesso!`);
      setEditingKey(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="border-b border-border/50 pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            Parâmetros de Governança
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurações dinâmicas de negócio lidas pelo motor de auditoria contínua.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-4 rounded-xl text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settings?.map((setting) => {
          const isEditing = editingKey === setting.key;

          return (
            <div
              key={setting.key}
              className={`border rounded-xl p-5 bg-background/50 transition-all ${
                isEditing ? "border-amber-500 shadow-sm" : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className="font-mono text-xs font-bold text-foreground">{setting.key}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(setting)}
                    className="text-xs font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                  >
                    Editar
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3 mt-3">
                  <textarea
                    rows={4}
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  {validationError && (
                    <div className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {validationError}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-2.5 py-1.5 border border-border hover:bg-muted/10 rounded-lg text-xs font-semibold text-muted-foreground flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSave(setting.key)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 bg-card/60 border border-border/30 rounded-lg p-3">
                  <pre className="text-[10px] font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(setting.value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
