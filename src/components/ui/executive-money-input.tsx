"use client";

import React, { useState, useMemo, useEffect } from "react";
import { parseExecutiveMoneyInput, formatExecutiveMoneyDisplay } from "@/lib/formatters";

interface ExecutiveMoneyInputProps {
  value: number; // Raw Reais value (e.g. 744000)
  onChangeValue: (rawReais: number) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  disabled?: boolean;
  inThousands?: boolean;
}

export function ExecutiveMoneyInput({
  value,
  onChangeValue,
  placeholder = "0,0",
  className,
  onKeyDown,
  inputRef,
  disabled = false,
  inThousands = false,
}: ExecutiveMoneyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [tempText, setTempText] = useState("");

  const formattedDisplay = useMemo(() => {
    if (!value || isNaN(value) || value <= 0) return "";
    if (inThousands) {
      const inK = value / 1000;
      return inK.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return formatExecutiveMoneyDisplay(value);
  }, [value, inThousands]);

  useEffect(() => {
    if (!isFocused) {
      setTempText(formattedDisplay);
    }
  }, [value, isFocused, formattedDisplay]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value > 0) {
      if (inThousands) {
        const inK = value / 1000;
        setTempText(inK.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
      } else {
        setTempText(String(value));
      }
    } else {
      setTempText("");
    }
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (tempText.trim()) {
      if (inThousands) {
        const clean = tempText.replace(/\./g, "").replace(",", ".").trim();
        const num = parseFloat(clean);
        onChangeValue(!isNaN(num) && num >= 0 ? Math.round(num * 1000) : 0);
      } else {
        const parsedReais = parseExecutiveMoneyInput(tempText);
        onChangeValue(parsedReais);
      }
    } else {
      onChangeValue(0);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      disabled={disabled}
      value={isFocused ? tempText : formattedDisplay}
      placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleBlur();
        }
        if (onKeyDown) onKeyDown(e);
      }}
      onChange={(e) => {
        const valStr = e.target.value;
        setTempText(valStr);
        if (inThousands) {
          const clean = valStr.replace(/\./g, "").replace(",", ".").trim();
          const num = parseFloat(clean);
          if (!isNaN(num) && num >= 0) {
            onChangeValue(Math.round(num * 1000));
          } else if (valStr.trim() === "") {
            onChangeValue(0);
          }
        } else {
          const liveReais = parseExecutiveMoneyInput(valStr);
          if (liveReais >= 0) {
            onChangeValue(liveReais);
          }
        }
      }}
      className={
        className ||
        "w-full text-right font-mono font-bold bg-white text-neutral-900 border border-neutral-300 rounded-md px-2.5 py-1.5 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 transition-all disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200"
      }
    />
  );
}
