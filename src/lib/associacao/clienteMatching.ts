export interface MatchingResult {
  matchedRecord: any; // Can be base_atendimento or faturamento record
  origem: 'base_atendimento' | 'cm_faturamento';
  matchingStrategy: 'codigo' | 'cnpj' | 'nome_normalizado' | 'similarity';
  matchingScore: number; // 0.0 to 1.0
}

export function normalizarNome(nome: string): string {
  if (!nome) return "";
  let res = nome.toUpperCase();
  // Remove accents
  res = res.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Remove punctuation
  res = res.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  // Remove corporate terms
  const termos = ["LTDA", "S/A", "SA", "ME", "EPP", "EIRELI", "COMERCIO", "DISTRIBUIDORA", "INDUSTRIA"];
  termos.forEach(termo => {
    const regex = new RegExp(`\\b${termo}\\b`, "g");
    res = res.replace(regex, "");
  });
  // Remove double spaces
  return res.replace(/\s+/g, " ").trim();
}

export function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function getSimilarity(a: string, b: string): number {
  const normA = normalizarNome(a);
  const normB = normalizarNome(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  
  const distance = getLevenshteinDistance(normA, normB);
  const maxLength = Math.max(normA.length, normB.length);
  return 1 - distance / maxLength;
}

/**
 * Camada 1 – Matching do Cliente
 * Identifica a entidade pareada do cliente (base_atendimento ou cm_faturamento) em cascata.
 */
export function encontrarCorrespondenciaCliente(
  cliente: { codigo: number; cnpj: string | null; nome_parceiro: string; razao_social: string | null },
  baseAtendimento: any[],
  faturamentoConsolidado: any[],
  minConfidence: number = 0.90
): MatchingResult | null {
  const codeStr = cliente.codigo.toString();
  const cleanCnpj = cliente.cnpj ? cliente.cnpj.replace(/\D/g, "") : null;
  const normNome = normalizarNome(cliente.nome_parceiro);
  const normRazao = cliente.razao_social ? normalizarNome(cliente.razao_social) : "";

  // 1. Código do parceiro (Prioridade 1)
  const atCodeMatch = baseAtendimento.find(item => item.cod_parceiro === codeStr);
  if (atCodeMatch) {
    return { matchedRecord: atCodeMatch, origem: 'base_atendimento', matchingStrategy: 'codigo', matchingScore: 1.0 };
  }
  const fatCodeMatch = faturamentoConsolidado.find(item => item.cod_parceiro === codeStr);
  if (fatCodeMatch) {
    return { matchedRecord: fatCodeMatch, origem: 'cm_faturamento', matchingStrategy: 'codigo', matchingScore: 1.0 };
  }

  // 2. CNPJ (Prioridade 2)
  if (cleanCnpj) {
    const atCnpjMatch = baseAtendimento.find(item => item.cnpj && item.cnpj.replace(/\D/g, "") === cleanCnpj);
    if (atCnpjMatch) {
      return { matchedRecord: atCnpjMatch, origem: 'base_atendimento', matchingStrategy: 'cnpj', matchingScore: 1.0 };
    }
  }

  // 3. Nome Normalizado (Prioridade 3)
  if (normNome) {
    const atNameMatch = baseAtendimento.find(item => normalizarNome(item.nome_parceiro) === normNome);
    if (atNameMatch) {
      return { matchedRecord: atNameMatch, origem: 'base_atendimento', matchingStrategy: 'nome_normalizado', matchingScore: 0.95 };
    }
    const fatNameMatch = faturamentoConsolidado.find(item => normalizarNome(item.nome_parceiro) === normNome);
    if (fatNameMatch) {
      return { matchedRecord: fatNameMatch, origem: 'cm_faturamento', matchingStrategy: 'nome_normalizado', matchingScore: 0.95 };
    }
  }

  // 4. Similaridade Textual (Prioridade 4)
  let bestMatch: MatchingResult | null = null;

  // Busca em base_atendimento
  for (const item of baseAtendimento) {
    const sim = getSimilarity(cliente.nome_parceiro, item.nome_parceiro);
    if (sim >= minConfidence && (!bestMatch || sim > bestMatch.matchingScore)) {
      bestMatch = { matchedRecord: item, origem: 'base_atendimento', matchingStrategy: 'similarity', matchingScore: sim };
    }
  }

  // Busca em faturamento
  for (const item of faturamentoConsolidado) {
    const sim = getSimilarity(cliente.nome_parceiro, item.nome_parceiro);
    if (sim >= minConfidence && (!bestMatch || sim > bestMatch.matchingScore)) {
      bestMatch = { matchedRecord: item, origem: 'cm_faturamento', matchingStrategy: 'similarity', matchingScore: sim };
    }
  }

  return bestMatch;
}
