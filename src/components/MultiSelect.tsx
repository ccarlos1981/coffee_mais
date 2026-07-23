"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { ChevronDown, Search, CheckSquare, Square } from "lucide-react";

interface MultiSelectProps {
  value?: (string | number)[];
  onChange: (val: string[]) => void;
  options?: (string | number)[];
  placeholder?: string;
  className?: string;
  title?: string;
}

export const MultiSelect = memo(function MultiSelect({ 
  value = [], 
  onChange, 
  options = [], 
  placeholder = "Todos", 
  className = "",
  title
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalizar array de opções para garantir exclusivamente strings limpas
  const safeOptions = useMemo<string[]>(() => {
    return (options || [])
      .filter((opt) => opt !== null && opt !== undefined)
      .map((opt) => String(opt));
  }, [options]);

  const safeValue = useMemo<string[]>(() => {
    return (value || []).map((v) => String(v));
  }, [value]);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtro na busca
  const filteredOptions = useMemo<string[]>(() => {
    const term = (searchTerm || "").toLowerCase();
    return safeOptions.filter((option: string) =>
      option.toLowerCase().includes(term)
    );
  }, [safeOptions, searchTerm]);

  const isAllSelected = safeValue.length === 0;

  const toggleAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const toggleOption = useCallback((optionStr: string) => {
    if (safeValue.length === 0) {
      // Se era "Todos", o primeiro clique num específico desmarca o resto e deixa só ele
      onChange([optionStr]);
    } else {
      if (safeValue.includes(optionStr)) {
        const next = safeValue.filter((v: string) => v !== optionStr);
        onChange(next);
      } else {
        onChange([...safeValue, optionStr]);
      }
    }
  }, [safeValue, onChange]);

  // Label display logic
  let displayValue = placeholder;
  if (!isAllSelected) {
    if (safeValue.length === 1) {
      displayValue = safeValue[0];
    } else {
      displayValue = `${safeValue.length} itens`;
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }} title={title}>
      {/* TRIGGER BUTTON */}
      <div
        className={className}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
          width: "100%"
        }}
        onClick={() => {
          setIsOpen(prev => !prev);
          if (!isOpen) setSearchTerm("");
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayValue}
        </span>
        <ChevronDown style={{ width: 14, height: 14, opacity: 0.6 }} />
      </div>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            backgroundColor: "var(--background-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 1000,
            maxHeight: 300,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* SEARCH INPUT */}
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
            <Search style={{ width: 14, height: 14, color: "var(--foreground-muted)" }} />
            <input
              autoFocus
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                width: "100%",
                fontSize: "0.75rem",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* OPTIONS LIST */}
          <div style={{ overflowY: "auto", paddingBottom: 4 }}>
            {/* TODOS OPTION */}
            <div
              onClick={(e) => { e.stopPropagation(); toggleAll(); }}
              style={{
                padding: "8px 12px",
                fontSize: "0.75rem",
                cursor: "pointer",
                backgroundColor: isAllSelected ? "var(--accent-light)" : "transparent",
                color: isAllSelected ? "var(--accent-gold)" : "var(--foreground)",
                fontWeight: isAllSelected ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--accent-light)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isAllSelected ? "var(--accent-light)" : "transparent"}
            >
              {isAllSelected ? (
                <CheckSquare style={{ width: 14, height: 14, minWidth: 14 }} />
              ) : (
                <Square style={{ width: 14, height: 14, minWidth: 14, opacity: 0.5 }} />
              )}
              Todos
            </div>
            
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "8px 12px", fontSize: "0.75rem", color: "var(--foreground-muted)", textAlign: "center" }}>
                {safeOptions.length === 0 ? "Carregando..." : "Nenhum resultado"}
              </div>
            ) : (
              filteredOptions.map((option: string) => {
                const isSelected = isAllSelected || safeValue.includes(option);
                return (
                  <div
                    key={option}
                    onClick={(e) => { e.stopPropagation(); toggleOption(option); }}
                    style={{
                      padding: "8px 12px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      backgroundColor: "transparent",
                      color: isSelected ? "var(--accent-gold)" : "var(--foreground)",
                      fontWeight: isSelected ? 600 : 400,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--accent-light)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {isSelected ? (
                      <CheckSquare style={{ width: 14, height: 14, minWidth: 14 }} />
                    ) : (
                      <Square style={{ width: 14, height: 14, minWidth: 14, opacity: 0.5 }} />
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {option}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});
