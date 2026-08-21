/**
 * Helper Centralizado de Resolução Canônica de Matrizes — Módulo de Investimentos
 * 
 * Fonte Única da Verdade: public.cm_clientes
 * 
 * Regra de Não-Colisão:
 * - PROIBIDO utilizar `codigo_matriz` isoladamente como chave de identidade sem validação de unicidade.
 * - Códigos compartilhados (como 95580.0 e 84906.0) possuem múltiplos contextos (UF / Gerente / Matriz).
 * - O lookup trabalha prioritariamente com chaves compostas e código de cliente (PDV).
 * - Quando não houver contexto suficiente para desambiguar, o valor original é preservado como fallback seguro.
 */

export interface ClienteMatrizRecord {
  codigo?: string | number | null;
  codigo_matriz?: string | null;
  matriz?: string | null;
  uf?: string | null;
  responsavel?: string | null;
  manager_id?: string | null;
  regional?: string | null;
  tipo_parceiro?: string | null;
  nome_parceiro?: string | null;
  razao_social?: string | null;
}

export interface ClienteMatrizResolved {
  codigoCliente?: string | null;
  codigoMatriz: string | null;
  matriz: string;
  uf: string | null;
  responsavel: string | null;
  regional?: string | null;
  canal?: string | null;
  razaoSocial?: string | null;
  isAmbiguous?: boolean;
}

export interface MatrizLookup {
  // P1: Código de cliente / PDV (chave unívoca) -> ex: "155936" => FORT (SP)
  byClientCode: Map<string, ClienteMatrizResolved>;
  // P2: codigo_matriz + nome da matriz -> ex: "95580___FORT (SP)" => FORT (SP)
  byMatrixCodeAndName: Map<string, ClienteMatrizResolved>;
  // P3: codigo_matriz + UF -> ex: "95580___SP" => FORT (SP)
  byMatrixCodeAndUf: Map<string, ClienteMatrizResolved>;
  // P4: codigo_matriz + Responsável normalizado -> ex: "95580___JULLIANO" => FORT (SP)
  byMatrixCodeAndManager: Map<string, ClienteMatrizResolved>;
  // P5: Nome oficial exato da matriz -> ex: "FORT (SP)" => FORT (SP)
  byMatrixName: Map<string, ClienteMatrizResolved>;
  // P6: Códigos de matriz comprovadamente unívocos (cardinalidade 1:1 estrita)
  byUniqueMatrixCode: Map<string, ClienteMatrizResolved>;
  // Códigos com cardinalidade > 1 (bloqueados para resolução por código isolado)
  ambiguousMatrixCodes: Set<string>;
}

export interface ResolveMatrizInput {
  codigo?: string | number | null;
  cod_parceiro?: string | number | null;
  parceiro_codigo?: string | number | null;
  codigo_matriz?: string | null;
  matriz?: string | null;
  rede?: string | null;
  nome_parceiro?: string | null;
  razao_social?: string | null;
  uf?: string | null;
  regional?: string | null;
  responsavel?: string | null;
  gerente?: string | null;
  gerente_responsavel?: string | null;
  manager?: string | null;
}

/**
 * Normaliza o código da matriz para string limpa sem ponto decimal desnecessário.
 * Ex: "95580.0" => "95580", "84906.0" => "84906", 95580 => "95580".
 */
export function cleanMatrixCode(code: any): string {
  if (code === undefined || code === null) return "";
  const s = String(code).trim();
  if (!s) return "";
  // Se for algo como "95580.0", normaliza para "95580"
  if (/^\d+\.0$/.test(s)) {
    return s.replace(/\.0$/, "");
  }
  return s;
}

/**
 * Normaliza o nome do gerente/responsável para matching determinístico.
 */
export function normalizeGerenteKey(name?: string | null): string {
  if (!name) return "";
  const trimmed = name.trim().toUpperCase();
  if (trimmed.includes("JOHN")) return "JOHN";
  if (trimmed.includes("LEANDRO")) return "LEANDRO SAFFI";
  if (trimmed.includes("JULLIANO")) return "JULLIANO";
  if (trimmed.includes("LUIZ")) return "LUIZ";
  return trimmed;
}

/**
 * Constrói as tabelas de lookup em memória a partir de cm_clientes ou v_redes_matrizes_detalhes.
 */
export function buildMatrizLookup(clients: ClienteMatrizRecord[]): MatrizLookup {
  const byClientCode = new Map<string, ClienteMatrizResolved>();
  const byMatrixCodeAndName = new Map<string, ClienteMatrizResolved>();
  const byMatrixCodeAndUf = new Map<string, ClienteMatrizResolved>();
  const byMatrixCodeAndManager = new Map<string, ClienteMatrizResolved>();
  const byMatrixName = new Map<string, ClienteMatrizResolved>();
  const byUniqueMatrixCode = new Map<string, ClienteMatrizResolved>();

  // Contagem de matrizes distintas por código de matriz para detectar ambiguidade
  const codeToMatrizes = new Map<string, Set<string>>();

  clients.forEach((c) => {
    const rawMatrix = (c.matriz || "").trim();
    if (!rawMatrix) return;

    const rawMatCode = cleanMatrixCode(c.codigo_matriz);
    if (rawMatCode) {
      if (!codeToMatrizes.has(rawMatCode)) {
        codeToMatrizes.set(rawMatCode, new Set());
      }
      codeToMatrizes.get(rawMatCode)!.add(rawMatrix.toUpperCase());
    }
  });

  const ambiguousMatrixCodes = new Set<string>();
  codeToMatrizes.forEach((matrizesSet, code) => {
    if (matrizesSet.size > 1) {
      ambiguousMatrixCodes.add(code);
    }
  });

  // Preenche os mapas estruturados
  clients.forEach((c) => {
    const rawMatrix = (c.matriz || "").trim();
    if (!rawMatrix) return;

    const rawMatCode = cleanMatrixCode(c.codigo_matriz);
    const clientCodeStr = c.codigo !== undefined && c.codigo !== null ? String(c.codigo).trim() : null;
    const uf = (c.uf || "").trim().toUpperCase() || null;
    const responsavel = (c.responsavel || "").trim() || null;
    const regional = (c.regional || "").trim() || null;
    const canal = (c.tipo_parceiro || "").trim() || null;
    const razaoSocial = (c.razao_social || c.nome_parceiro || "").trim() || null;
    const isAmbiguous = rawMatCode ? ambiguousMatrixCodes.has(rawMatCode) : false;

    const resolved: ClienteMatrizResolved = {
      codigoCliente: clientCodeStr,
      codigoMatriz: rawMatCode || null,
      matriz: rawMatrix,
      uf,
      responsavel,
      regional,
      canal,
      razaoSocial,
      isAmbiguous,
    };

    // P1: Índice por Código de Cliente / PDV
    if (clientCodeStr) {
      byClientCode.set(clientCodeStr, resolved);
    }

    // P2: Índice por codigo_matriz + matriz
    if (rawMatCode) {
      const keyName = `${rawMatCode}___${rawMatrix.toUpperCase()}`;
      if (!byMatrixCodeAndName.has(keyName)) {
        byMatrixCodeAndName.set(keyName, resolved);
      }
    }

    // P3: Índice por codigo_matriz + UF
    if (rawMatCode && uf) {
      const keyUf = `${rawMatCode}___${uf}`;
      if (!byMatrixCodeAndUf.has(keyUf)) {
        byMatrixCodeAndUf.set(keyUf, resolved);
      }
    }

    // P4: Índice por codigo_matriz + Responsável normalizado
    if (rawMatCode && responsavel) {
      const normMgr = normalizeGerenteKey(responsavel);
      if (normMgr) {
        const keyMgr = `${rawMatCode}___${normMgr}`;
        if (!byMatrixCodeAndManager.has(keyMgr)) {
          byMatrixCodeAndManager.set(keyMgr, resolved);
        }
      }
    }

    // P5: Índice por Nome Oficial da Matriz
    const matrixNameKey = rawMatrix.toUpperCase();
    if (!byMatrixName.has(matrixNameKey)) {
      byMatrixName.set(matrixNameKey, resolved);
    }

    // P6: Código Único (cardinalidade 1:1 estrita)
    if (rawMatCode && !isAmbiguous) {
      if (!byUniqueMatrixCode.has(rawMatCode)) {
        byUniqueMatrixCode.set(rawMatCode, resolved);
      }
    }
  });

  return {
    byClientCode,
    byMatrixCodeAndName,
    byMatrixCodeAndUf,
    byMatrixCodeAndManager,
    byMatrixName,
    byUniqueMatrixCode,
    ambiguousMatrixCodes,
  };
}

/**
 * Resolução Canônica da Matriz Oficial de um Cliente / Ação / Boleto.
 * 
 * Obedece estritamente à hierarquia de 7 prioridades sem adivinhação:
 * 1. Código do cliente/PDV (resolução exata)
 * 2. codigo_matriz + matriz
 * 3. codigo_matriz + UF
 * 4. codigo_matriz + responsável
 * 5. matriz oficial já existente
 * 6. codigo_matriz somente se comprovadamente único (cardinalidade 1:1)
 * 7. Fallback seguro preservando o valor original
 */
export function resolveClienteMatriz(
  input: ResolveMatrizInput,
  lookup: MatrizLookup
): ClienteMatrizResolved {
  // ───────────────────────────────────────────────────────────────────────────
  // PRIORIDADE 1 — Código do cliente / PDV (Mais segura e determinística)
  // ───────────────────────────────────────────────────────────────────────────
  const clientCode = input.codigo ?? input.cod_parceiro ?? input.parceiro_codigo;
  if (clientCode !== undefined && clientCode !== null && clientCode !== "") {
    const cleanClientCode = String(clientCode).trim();
    const match = lookup.byClientCode.get(cleanClientCode);
    if (match) {
      return match;
    }
  }

  const rawMatCode = cleanMatrixCode(input.codigo_matriz);
  const rawRedeName = (input.matriz || input.rede || "").trim();
  const rawRedeUpper = rawRedeName.toUpperCase();
  const rawUf = (input.uf || "").trim().toUpperCase();
  const rawManager = (input.responsavel || input.gerente || input.gerente_responsavel || input.manager || "").trim();
  const normManager = normalizeGerenteKey(rawManager);

  // ───────────────────────────────────────────────────────────────────────────
  // PRIORIDADE 2 — codigo_matriz + matriz
  // ───────────────────────────────────────────────────────────────────────────
  if (rawMatCode && rawRedeUpper) {
    const key = `${rawMatCode}___${rawRedeUpper}`;
    const match = lookup.byMatrixCodeAndName.get(key);
    if (match) {
      return match;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIORIDADE 3 — codigo_matriz + UF
  // ───────────────────────────────────────────────────────────────────────────
  if (rawMatCode && rawUf) {
    const key = `${rawMatCode}___${rawUf}`;
    const match = lookup.byMatrixCodeAndUf.get(key);
    if (match) {
      return match;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIORIDADE 4 — codigo_matriz + responsável
  // ───────────────────────────────────────────────────────────────────────────
  if (rawMatCode && normManager) {
    const key = `${rawMatCode}___${normManager}`;
    const match = lookup.byMatrixCodeAndManager.get(key);
    if (match) {
      return match;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIORIDADE 5 — Matriz oficial já existente em cm_clientes
  // ───────────────────────────────────────────────────────────────────────────
  if (rawRedeUpper) {
    const match = lookup.byMatrixName.get(rawRedeUpper);
    if (match) {
      return match;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIORIDADE 6 — codigo_matriz unívoco (cardinalidade 1:1 estrita)
  // ───────────────────────────────────────────────────────────────────────────
  if (rawMatCode && !lookup.ambiguousMatrixCodes.has(rawMatCode)) {
    const match = lookup.byUniqueMatrixCode.get(rawMatCode);
    if (match) {
      return match;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIORIDADE 7 — Fallback seguro (Preserva o valor original sem adivinhação)
  // ───────────────────────────────────────────────────────────────────────────
  const fallbackName = rawRedeName || (input.razao_social || input.nome_parceiro || "").trim() || "Sem Matriz";
  return {
    codigoCliente: clientCode ? String(clientCode).trim() : null,
    codigoMatriz: rawMatCode || null,
    matriz: fallbackName,
    uf: rawUf || null,
    responsavel: rawManager || null,
    razaoSocial: input.razao_social || input.nome_parceiro || null,
    isAmbiguous: rawMatCode ? lookup.ambiguousMatrixCodes.has(rawMatCode) : false,
  };
}
