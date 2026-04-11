"use client";

import React, { useState, useRef, useEffect, MouseEvent } from "react";
import { ChevronDown, Search } from "lucide-react";

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ value, onChange, options, placeholder = "Selecione...", className = "" }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayValue = value === "Todos" ? "Todos" : value;

  const handleSelect = (option: string, e: MouseEvent) => {
    e.stopPropagation();
    onChange(option);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      {/* TRIGGER BUTTON */}
      <div
        className={className}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none"
        }}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchTerm("");
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayValue || placeholder}
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
            maxHeight: 250,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* SEARCH INPUT */}
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
            <Search style={{ width: 14, height: 14, color: "var(--foreground-muted)" }} />
            <input
              autoFocus
              type="text"
              placeholder="Pesquisar SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
          <div style={{ overflowY: "auto" }}>
            <div
              onClick={(e) => handleSelect("Todos", e)}
              style={{
                padding: "8px 12px",
                fontSize: "0.75rem",
                cursor: "pointer",
                backgroundColor: value === "Todos" ? "var(--accent-light)" : "transparent",
                color: value === "Todos" ? "var(--accent-gold)" : "var(--foreground)",
                fontWeight: value === "Todos" ? 600 : 400
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--accent-light)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value === "Todos" ? "var(--accent-light)" : "transparent"}
            >
              Todos
            </div>
            
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "8px 12px", fontSize: "0.75rem", color: "var(--foreground-muted)", textAlign: "center" }}>
                Nenhum resultado
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  onClick={(e) => handleSelect(option, e)}
                  style={{
                    padding: "8px 12px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    backgroundColor: value === option ? "var(--accent-light)" : "transparent",
                    color: value === option ? "var(--accent-gold)" : "var(--foreground)",
                    fontWeight: value === option ? 600 : 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--accent-light)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value === option ? "var(--accent-light)" : "transparent"}
                >
                  {option}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
