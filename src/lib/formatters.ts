/**
 * Formatadores para o padrão brasileiro (pt-BR)
 */

/** Formata valor em Reais: R$ 1.234 */
export function formatCurrency(value: number | null | undefined, decimals = 0): string {
  if (value == null || isNaN(value)) return decimals > 0 ? `R$ 0,${"0".repeat(decimals)}` : `R$ 0`;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formata valor em milhares: 1.234 (÷1000) */
export function formatThousands(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  return (value / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Formata número genérico: 1.234 */
export function formatNumber(
  value: number | null | undefined,
  decimals = 0
): string {
  if (value == null || isNaN(value)) return "0";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formata percentual: 98,5% */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0%";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** Formata toneladas: 12,5 */
export function formatTons(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0,0";
  const tons = value / 1000; // kg → tons
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
