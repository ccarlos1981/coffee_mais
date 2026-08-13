/**
 * Dados Oficiais da Empresa Emissora da Carta de Anuência
 */
export const EMISSORA_CARTA_ANUENCIA = {
  razaoSocial: "COFFEE MAIS INDÚSTRIA E COMÉRCIO DE CAFÉ LTDA",
  nomeFantasia: "Indústria e Comércio de Café Ltda",
  cnpj: "36.782.675/0001-87",
  cidadeEmissao: "Piumhi",
} as const;


/**
 * Calcula a data de validade em formato ISO (YYYY-MM-DD) a partir da string da competência.
 * Retorna null para competências sem regra homologada.
 */
export function calcularValidadeCartaAnuencia(competenciaStr: string): string | null {
  if (!competenciaStr || typeof competenciaStr !== "string") return null;

  // Extrair o ano com 4 dígitos (ex: 2026)
  const yearMatch = competenciaStr.match(/\b(20\d\d)\b/);
  if (!yearMatch) return null;
  const ano = yearMatch[1];

  // Normalizar a string para minúsculas e sem acentos
  const norm = competenciaStr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1º Ciclo: Janeiro, Fevereiro, Março
  const isPrimeiroCiclo =
    norm.includes("janeiro") ||
    norm.includes("fevereiro") ||
    norm.includes("marco") ||
    /\b(jan|fev|mar)\b/.test(norm);

  if (isPrimeiroCiclo) {
    return `${ano}-03-31`;
  }

  // 2º Ciclo: Junho, Julho, Agosto
  const isSegundoCiclo =
    norm.includes("junho") ||
    norm.includes("julho") ||
    norm.includes("agosto") ||
    /\b(jun|jul|ago)\b/.test(norm);

  if (isSegundoCiclo) {
    return `${ano}-08-31`;
  }

  return null;
}

/**
 * Formata a data de validade de YYYY-MM-DD para DD/MM/YYYY sem sofrer desvios de timezone.
 */
export function formatarDataValidade(validadeAteStr?: string | null): string {
  if (!validadeAteStr) return "—";

  const cleanDate = validadeAteStr.substring(0, 10);
  const parts = cleanDate.split("-");

  if (parts.length === 3) {
    const [ano, mes, dia] = parts;
    if (ano.length === 4 && mes.length === 2 && dia.length === 2) {
      return `${dia}/${mes}/${ano}`;
    }
  }

  // Fallback seguro caso seja uma data em formato ISO completo ou timestamp
  try {
    const d = new Date(validadeAteStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return validadeAteStr;
  }
}

/**
 * Determina se a validade da Carta de Anuência já foi ultrapassada exclusivamente para fins de exibição visual (ex.: selo 'Carta Vencida').
 * Esta função jamais poderá bloquear consulta, visualização, edição, impressão, exportação em PDF ou qualquer outra funcionalidade do sistema.
 * A validade possui caráter exclusivamente informativo, preservando integralmente o valor histórico do documento.
 */
export function verificarCartaExpirada(validadeAteStr?: string | null): boolean {
  if (!validadeAteStr) return false;
  const hojeIso = new Date().toISOString().substring(0, 10);
  const validadeIso = validadeAteStr.substring(0, 10);
  return validadeIso < hojeIso;
}
