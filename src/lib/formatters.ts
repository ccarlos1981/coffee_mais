/**
 * Formatadores para o padrão brasileiro (pt-BR)
 */

/** Formata valor compacto: 1,5M, 742K, 300 */
export function formatCompact(value: number | string | null | undefined): string {
  if (value == null) return "0";
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num) || num === 0) return "0";

  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    const val = num / 1_000_000;
    return `${val.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    const val = num / 1_000;
    return `${val.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}K`;
  }
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/** Formata valor em Reais: R$ 1.234 */
export function formatCurrency(value: number | string | null | undefined, decimals = 0): string {
  if (value == null) return decimals > 0 ? `R$ 0,${"0".repeat(decimals)}` : `R$ 0`;
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return decimals > 0 ? `R$ 0,${"0".repeat(decimals)}` : `R$ 0`;
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formata valor em milhares: 1.234 (÷1000) */
export function formatThousands(value: number | string | null | undefined): string {
  if (value == null) return "0";
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "0";
  return (num / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Formata número genérico: 1.234 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals = 0
): string {
  if (value == null) return "0";
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "0";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formata percentual: 98,5% */
export function formatPercent(value: number | string | null | undefined): string {
  if (value == null) return "0%";
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "0%";
  return `${num.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** Formata toneladas: 12,5 */
export function formatTons(value: number | string | null | undefined): string {
  if (value == null) return "0,0";
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "0,0";
  const tons = num / 1000; // kg → tons
  return tons.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Formata data: 07/04/2026 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
}

/** Formata data e hora: 07/04/2026 21:30 */
export function formatDateTime(
  date: string | Date | null | undefined
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Nome abreviado do mês: Jan, Fev, Mar... */
export function formatMonthShort(month: number): string {
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return months[(month - 1) % 12] || "";
}

/** Cor baseada no percentual de atingimento */
export function getPerformanceColor(pct: number): string {
  if (pct >= 100) return "var(--accent-green)";
  if (pct >= 80) return "var(--accent-yellow)";
  return "var(--accent-red)";
}

/** Classe CSS para valor positivo/negativo */
export function getValueClass(value: number): string {
  if (value > 0) return "num-positive";
  if (value < 0) return "num-negative";
  return "num-neutral";
}

/** Simplifica e encurta nomes de Redes/Clientes muito extensos */
export function shortenRedeName(name: string): string {
  if (!name) return "";
  const clean = name.trim().toUpperCase();

  // Mapeamentos conhecidos de grandes redes
  if (clean.includes("AMAZON")) return "Amazon";
  if (clean.includes("ANGELONI")) return "Angeloni";
  if (clean.includes("DONA DE CASA")) return "Dona de Casa";
  if (clean.includes("ZONA SUL")) return "Zona Sul";
  if (clean.includes("VERDEMAR")) return "Verdemar";
  if (clean.includes("ZAFFARI")) return "Zaffari";
  if (clean.includes("SUPERNOSSO")) return "Supernosso";
  if (clean.includes("REDEMIX")) return "Redemix";
  if (clean.includes("MAMBO")) return "Mambo";
  if (clean.includes("COMPER")) return "Comper";
  if (clean.includes("DUFRY")) return "Dufry";
  if (clean.includes("SDB")) return "SDB";
  if (clean.includes("NOVO ATACAREJO")) return "Novo Atacarejo";
  if (clean.includes("ABC")) return "ABC";
  if (clean.includes("MARCELA ACCO BASSO")) return "Marcela Acco Basso";

  // Limpeza genérica de prefixos e sufixos comuns
  let cleanName = clean;

  const prefixes = [
    "CENTRO DE DISTRIBUICAO",
    "CENTRO DE DISTRIBUIÇÃO",
    "SUPERMERCADO",
    "SUPERMERCADOS",
    "SUPER MERCADO",
    "SUPER MERCADOS",
    "COMERCIAL DE ALIMENTOS",
    "COMERCIAL",
    "ORGANIZACAO",
    "ORGANIZAÇÃO",
    "DISTRIBUIDORA",
    "DISTRIBUIDOR"
  ];

  for (const prefix of prefixes) {
    if (cleanName.startsWith(prefix)) {
      cleanName = cleanName.substring(prefix.length).trim();
    }
  }

  const suffixes = [
    "S/A", "S.A", "S.A.", "LTDA", "LTDA.", "LIMITADA", "EIRELI", "ME", "EPP"
  ];

  const words = cleanName.split(/\s+/);
  const cleanWords = words.filter(word => !suffixes.includes(word));
  cleanName = cleanWords.join(" ");

  if (cleanName.startsWith("DE ") || cleanName.startsWith("DO ") || cleanName.startsWith("DA ")) {
    cleanName = cleanName.substring(3).trim();
  }

  const prepositions = ["de", "do", "da", "e", "o", "a", "em", "para", "com"];
  return cleanName.toLowerCase()
    .split(" ")
    .map((word, idx) => {
      if (prepositions.includes(word) && idx > 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Converte qualquer formato de entrada de meta digitado por executivo para Reais Brutos (R$).
 * Exemplos:
 *  - 744       -> 744000 (números <= 999 sem sufixo são interpretados como milhares)
 *  - 744k/744K -> 744000
 *  - 744.000   -> 744000
 *  - 744000    -> 744000
 *  - 1.2M/1,2M -> 1200000
 *  - 0,744M    -> 744000
 */
export function parseExecutiveMoneyInput(input: string | number | null | undefined): number {
  if (input == null) return 0;

  if (typeof input === "number") {
    if (isNaN(input) || input <= 0) return 0;
    if (input <= 9999) return Math.round(input * 1000);
    return Math.round(input);
  }

  const str = String(input).trim();
  if (!str) return 0;

  let cleaned = str.replace(/R\$\s*/gi, "").trim();

  const parseDecimalString = (valStr: string) => {
    if (valStr.includes(".") && valStr.includes(",")) {
      return parseFloat(valStr.replace(/\./g, "").replace(",", "."));
    }
    if (valStr.includes(",")) {
      return parseFloat(valStr.replace(",", "."));
    }
    if (valStr.includes(".")) {
      if (valStr.startsWith("0.")) {
        return parseFloat(valStr);
      }
      const parts = valStr.split(".");
      if (parts.length > 1 && parts.every((p, idx) => idx === 0 || p.length === 3)) {
        return parseFloat(valStr.replace(/\./g, ""));
      }
    }
    return parseFloat(valStr);
  };

  // Check suffix K / k
  if (/k$/i.test(cleaned)) {
    const numStr = cleaned.replace(/k$/i, "").trim();
    const rawNum = parseDecimalString(numStr);
    return isNaN(rawNum) ? 0 : Math.round(rawNum * 1000);
  }

  // Check suffix M / m
  if (/m$/i.test(cleaned)) {
    const numStr = cleaned.replace(/m$/i, "").trim();
    const rawNum = parseDecimalString(numStr);
    return isNaN(rawNum) ? 0 : Math.round(rawNum * 1000000);
  }

  const parsedVal = parseDecimalString(cleaned);

  if (isNaN(parsedVal) || parsedVal <= 0) return 0;

  // Numbers <= 9999 entered without suffix represent thousands (e.g. 744 -> 744000, 2750 -> 2750000)
  if (parsedVal <= 9999) {
    return Math.round(parsedVal * 1000);
  }

  return Math.round(parsedVal);
}

/**
 * Formata valor em Reais Brutos para exibição no campo de input executivo
 * Ex: 744000 -> 744.000 (ou R$ 744.000)
 */
export function formatExecutiveMoneyDisplay(rawReais: number | null | undefined): string {
  if (!rawReais || isNaN(rawReais) || rawReais <= 0) return "";
  return rawReais.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
