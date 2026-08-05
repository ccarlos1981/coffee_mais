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
}

export function ExecutiveMoneyInput({
  value,
  onChangeValue,
  placeholder = "0",
  className,
  onKeyDown,
  inputRef,
  disabled = false,
}: ExecutiveMoneyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [tempText, setTempText] = useState("");

  const formattedDisplay = useMemo(() => {
    if (!value || isNaN(value) || value <= 0) return "";
    return formatExecutiveMoneyDisplay(value);
  }, [value]);

  useEffect(() => {
    if (!isFocused) {
      setTempText(formattedDisplay);
    }
  }, [value, isFocused, formattedDisplay]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // If there is an existing rawReais > 0, show the text for easy editing
    setTempText(value > 0 ? String(value) : "");
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (tempText.trim()) {
      const parsedReais = parseExecutiveMoneyInput(tempText);
      onChangeValue(parsedReais);
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
        const liveReais = parseExecutiveMoneyInput(valStr);
        if (liveReais >= 0) {
          onChangeValue(liveReais);
        }
      }}
      className={className}
    />
  );
}
