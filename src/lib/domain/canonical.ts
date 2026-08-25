/**
 * Módulo Oficial de Normalização de Chaves de Domínio — Coffee++
 * 
 * Este módulo centraliza a resolução canônica de chaves de negócio (Gerente, Cliente, Rede, Matriz, Regional)
 * evitando hardcodes espalhados no código-fonte e garantindo a paridade de chaves lógicas.
 * 
 * Diretriz Arquitetural:
 * - A resolução é baseada prioritariamente no identificador canônico (manager_id).
 * - Aliases textuais históricos (ex: "Leandro Saffi", "Leandro (Sul)", "1001", "Leandro") são resolvidos
 *   de forma transparente e resiliente, sem exigir alteração/padronização física no banco de dados.
 */

export interface ManagerInfo {
  managerId: string;
  managerName: string;
  canonicalKey: string;
}

/**
 * Normaliza uma string de domínio (remove acentos, espaços extras e converte para maiúsculas)
 */
export function canonicalizeKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Tabela de mapeamento canônico de gerentes comerciais e canais corporativos.
 */
const MANAGERS_MAP: Record<string, ManagerInfo> = {
  // Julliano / Juliano (1000)
  "1000": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },
  "1000-KA": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },
  "JULLIANO": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },
  "JULLIANO (KA)": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },
  "JULLIANO (SPC)": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },
  "JULIANO": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },
  "JULIANO (KA)": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },
  "JULIANO (SPC)": { managerId: "1000", managerName: "Julliano", canonicalKey: "JULLIANO" },

  // Leandro Saffi / Leandro (1001)
  "1001": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },
  "1001-KA": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },
  "1001-DIST": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },
  "LEANDRO": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },
  "LEANDRO (KA)": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },
  "LEANDRO (DIST)": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },
  "LEANDRO SAFFI": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },
  "LEANDRO (SUL)": { managerId: "1001", managerName: "Leandro Saffi", canonicalKey: "LEANDRO SAFFI" },

  // Luiz (1002)
  "1002": { managerId: "1002", managerName: "Luiz", canonicalKey: "LUIZ" },
  "1002-KA": { managerId: "1002", managerName: "Luiz", canonicalKey: "LUIZ" },
  "1002-DIST": { managerId: "1002", managerName: "Luiz", canonicalKey: "LUIZ" },
  "LUIZ": { managerId: "1002", managerName: "Luiz", canonicalKey: "LUIZ" },
  "LUIZ (KA)": { managerId: "1002", managerName: "Luiz", canonicalKey: "LUIZ" },
  "LUIZ (DIST)": { managerId: "1002", managerName: "Luiz", canonicalKey: "LUIZ" },
  "LUIZ (SU+CO+NE)": { managerId: "1002", managerName: "Luiz", canonicalKey: "LUIZ" },

  // John Guedes (1003)
  "1003": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "1003-KA": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "1003-DIST": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "JOHN GUEDES": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "JOHN GUEDES (KA)": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "JOHN GUEDES (DIST)": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "JOHN": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "JOHN GUEDES (CO+NO)": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "JOHN GUEDES (CENTRO-OESTE/NORTE)": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },
  "JOHN (CO+NO)": { managerId: "1003", managerName: "John Guedes", canonicalKey: "JOHN GUEDES" },

  // Inside Sales (1004)
  "1004": { managerId: "1004", managerName: "Inside Sales", canonicalKey: "INSIDE SALES" },
  "INSIDE SALES": { managerId: "1004", managerName: "Inside Sales", canonicalKey: "INSIDE SALES" },

  // Ecommerce (1005)
  "1005": { managerId: "1005", managerName: "Ecommerce", canonicalKey: "ECOMMERCE" },
  "ECOMMERCE": { managerId: "1005", managerName: "Ecommerce", canonicalKey: "ECOMMERCE" },

  // Marketplace (1006)
  "1006": { managerId: "1006", managerName: "Marketplace", canonicalKey: "MARKETPLACE" },
  "MARKETPLACE": { managerId: "1006", managerName: "Marketplace", canonicalKey: "MARKETPLACE" },

  // Distribuidor (1007)
  "1007": { managerId: "1007", managerName: "Distribuidor", canonicalKey: "DISTRIBUIDOR" },
  "DISTRIBUIDOR": { managerId: "1007", managerName: "Distribuidor", canonicalKey: "DISTRIBUIDOR" },

  // Amazon 1P (1008)
  "1008": { managerId: "1008", managerName: "Amazon 1P", canonicalKey: "AMAZON 1P" },
  "AMAZON 1P": { managerId: "1008", managerName: "Amazon 1P", canonicalKey: "AMAZON 1P" },
  "1P": { managerId: "1008", managerName: "Amazon 1P", canonicalKey: "AMAZON 1P" },

  // Private Label / Marca Própria (1009)
  "1009": { managerId: "1009", managerName: "Private Label", canonicalKey: "PRIVATE LABEL" },
  "PRIVATE LABEL": { managerId: "1009", managerName: "Private Label", canonicalKey: "PRIVATE LABEL" },
  "MARCA PROPRIA": { managerId: "1009", managerName: "Private Label", canonicalKey: "PRIVATE LABEL" },
};

/**
 * Resolve qualquer identificador de gerente (ID numérico, nome oficial, alias histórico ou chave amigável)
 * para a sua representação canônica padronizada.
 */
export function resolveCanonicalManager(identifier: string | null | undefined): ManagerInfo {
  if (!identifier) {
    return { managerId: "9999", managerName: "Outros", canonicalKey: "OUTROS" };
  }

  const rawKey = canonicalizeKey(identifier);
  if (MANAGERS_MAP[rawKey]) {
    return MANAGERS_MAP[rawKey];
  }

  // Resolução inteligente por correspondência de prefixo/nome do gerente
  if (rawKey.startsWith("LEANDRO") || rawKey.includes("LEANDRO")) {
    return MANAGERS_MAP["LEANDRO"];
  }
  if (rawKey.startsWith("JULLIANO") || rawKey.startsWith("JULIANO") || rawKey.includes("JULLIANO") || rawKey.includes("JULIANO")) {
    return MANAGERS_MAP["JULLIANO"];
  }
  if (rawKey.startsWith("LUIZ") || rawKey.includes("LUIZ")) {
    return MANAGERS_MAP["LUIZ"];
  }
  if (rawKey.startsWith("JOHN") || rawKey.includes("JOHN")) {
    return MANAGERS_MAP["JOHN"];
  }
  if (rawKey.includes("INSIDE")) {
    return MANAGERS_MAP["INSIDE SALES"];
  }
  if (rawKey.includes("AMAZON")) {
    return MANAGERS_MAP["AMAZON 1P"];
  }

  return {
    managerId: "9999",
    managerName: identifier.trim(),
    canonicalKey: rawKey
  };
}

/**
 * Verifica se duas chaves ou identificadores de gerente pertencem à mesma entidade canônica.
 * Prioriza a correspondência pelo managerId e utiliza a chave canônica como fallback.
 */
export function isSameManager(managerA: string | null | undefined, managerB: string | null | undefined): boolean {
  if (!managerA || !managerB) return false;

  const infoA = resolveCanonicalManager(managerA);
  const infoB = resolveCanonicalManager(managerB);

  // 1. Comparação prioritária pelo identificador canônico managerId (quando válido)
  if (infoA.managerId !== "9999" && infoB.managerId !== "9999") {
    return infoA.managerId === infoB.managerId;
  }

  // 2. Fallback pela chave canônica normalizada
  return infoA.canonicalKey === infoB.canonicalKey;
}

// ============================================================
// CANONICALIZAÇÃO DE REDES COMERCIAIS (P4.11)
// ============================================================

export type CanonicalResolutionStatus =
  | "SUCCESS"
  | "CANONICALIZACAO_AMBIGUA"
  | "NAO_ENCONTRADA";

export interface CanonicalNetworkIdentity {
  rawName?: string | null;
  codigoMatriz?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  uf?: string | null;
  codParceiro?: number | string | null;
  networkId?: number | string | null;
}

export interface OfficialNetworkRecord {
  rede: string;
  manager: string;
  managerId: string;
  codigoMatriz: string;
  uf?: string | null;
  totalPdvsVinculados?: number;
  codigosParceiros?: (number | string)[];
}

export interface CanonicalNetworkResult {
  status: CanonicalResolutionStatus;
  canonicalName: string | null;
  codigoMatriz: string | null;
  managerId: string | null;
  uf: string | null;
  candidates?: string[];
  auditReason?: string;
}

/**
 * Resolução Canônica Dinâmica de Redes do Coffee++
 * 
 * Regras Obrigatórias de Governança (P4.11):
 * 1. O Cadastro Único (vw_redes_planejaveis_oficiais / cm_clientes) é a SSOT.
 * 2. PROIBIDO o uso de startsWith(), substring(), regex ou fuzzy matching quando houver múltiplos candidatos.
 * 3. Precedência estrita por identificadores físicos estáveis:
 *    - networkId
 *    - codParceiro
 *    - (codigoMatriz + managerId + uf), com validação 1:1 inequívoca
 *    - Match exato case-insensitive no nome oficial para o mesmo gerente
 * 4. Se houver ambiguidade (múltiplos candidatos sem discriminador unívoco):
 *    - Retorna CANONICALIZACAO_AMBIGUA com lista de candidatos e auditReason.
 *    - NÃO adivinha e NÃO altera o registro.
 */
export function resolveCanonicalNetwork(
  identity: CanonicalNetworkIdentity,
  officialNetworks: OfficialNetworkRecord[]
): CanonicalNetworkResult {
  if (!identity) {
    return {
      status: "NAO_ENCONTRADA",
      canonicalName: null,
      codigoMatriz: null,
      managerId: null,
      uf: null,
      auditReason: "Identidade não informada",
    };
  }

  const rawNameClean = (identity.rawName || "").trim();
  const rawKey = canonicalizeKey(rawNameClean);

  // 1. Identificar o Gerente Canônico
  const canonicalMgr = resolveCanonicalManager(identity.managerId || identity.managerName);
  const filterByManager = canonicalMgr.managerId !== "9999";

  // Filtrar base oficial para o escopo do gerente (se identificado)
  const scopedNetworks = filterByManager
    ? officialNetworks.filter(
        (n) => isSameManager(n.manager, canonicalMgr.managerName) || n.managerId === canonicalMgr.managerId
      )
    : officialNetworks;

  // ------------------------------------------------------------
  // PRECEDÊNCIA 1: networkId
  // ------------------------------------------------------------
  if (identity.networkId !== undefined && identity.networkId !== null && String(identity.networkId).trim() !== "") {
    const netIdStr = String(identity.networkId).trim();
    const match = scopedNetworks.find(
      (n) =>
        String(n.codigoMatriz).replace(/\.0$/, "") === netIdStr.replace(/\.0$/, "") ||
        (n.codigosParceiros && n.codigosParceiros.some((cp) => String(cp) === netIdStr))
    );
    if (match) {
      return {
        status: "SUCCESS",
        canonicalName: match.rede,
        codigoMatriz: match.codigoMatriz,
        managerId: match.managerId,
        uf: match.uf || identity.uf || null,
      };
    }
  }

  // ------------------------------------------------------------
  // PRECEDÊNCIA 2: codParceiro
  // ------------------------------------------------------------
  if (identity.codParceiro !== undefined && identity.codParceiro !== null && String(identity.codParceiro).trim() !== "") {
    const codStr = String(identity.codParceiro).trim();
    const matches = scopedNetworks.filter(
      (n) => n.codigosParceiros && n.codigosParceiros.some((cp) => String(cp) === codStr)
    );
    if (matches.length === 1) {
      return {
        status: "SUCCESS",
        canonicalName: matches[0].rede,
        codigoMatriz: matches[0].codigoMatriz,
        managerId: matches[0].managerId,
        uf: matches[0].uf || identity.uf || null,
      };
    }
    if (matches.length > 1) {
      return {
        status: "CANONICALIZACAO_AMBIGUA",
        canonicalName: null,
        codigoMatriz: matches[0].codigoMatriz,
        managerId: canonicalMgr.managerId,
        uf: identity.uf || null,
        candidates: matches.map((m) => m.rede),
        auditReason: `Múltiplas redes encontradas para o cod_parceiro ${codStr}`,
      };
    }
  }

  // ------------------------------------------------------------
  // PRECEDÊNCIA 3: (codigoMatriz + managerId + UF)
  // ------------------------------------------------------------
  if (identity.codigoMatriz) {
    const codMatrizClean = String(identity.codigoMatriz).trim();
    const codMatrizNorm = codMatrizClean.replace(/\.0$/, "");

    let candidates = scopedNetworks.filter(
      (n) =>
        String(n.codigoMatriz).trim() === codMatrizClean ||
        String(n.codigoMatriz).trim().replace(/\.0$/, "") === codMatrizNorm
    );

    if (identity.uf && candidates.length > 1) {
      const ufNorm = identity.uf.trim().toUpperCase();
      const ufCandidates = candidates.filter((n) => (n.uf || "").trim().toUpperCase() === ufNorm);
      if (ufCandidates.length > 0) {
        candidates = ufCandidates;
      }
    }

    if (candidates.length === 1) {
      return {
        status: "SUCCESS",
        canonicalName: candidates[0].rede,
        codigoMatriz: candidates[0].codigoMatriz,
        managerId: candidates[0].managerId,
        uf: candidates[0].uf || identity.uf || null,
      };
    }

    if (candidates.length > 1) {
      // Se houver nome exato entre os candidatos, desambigua determinísticamente
      if (rawKey) {
        const exactCandidate = candidates.find((c) => canonicalizeKey(c.rede) === rawKey);
        if (exactCandidate) {
          return {
            status: "SUCCESS",
            canonicalName: exactCandidate.rede,
            codigoMatriz: exactCandidate.codigoMatriz,
            managerId: exactCandidate.managerId,
            uf: exactCandidate.uf || identity.uf || null,
          };
        }
      }

      return {
        status: "CANONICALIZACAO_AMBIGUA",
        canonicalName: null,
        codigoMatriz: identity.codigoMatriz,
        managerId: canonicalMgr.managerId,
        uf: identity.uf || null,
        candidates: candidates.map((c) => c.rede),
        auditReason: `Código de matriz ${identity.codigoMatriz} possui ${candidates.length} redes oficiais para o gerente ${canonicalMgr.managerName} sem discriminador unívoco`,
      };
    }
  }

  // ------------------------------------------------------------
  // PRECEDÊNCIA 4: Correspondência EXATA case-insensitive na view oficial
  // ------------------------------------------------------------
  if (rawKey) {
    const exactMatches = scopedNetworks.filter((n) => canonicalizeKey(n.rede) === rawKey);
    if (exactMatches.length === 1) {
      return {
        status: "SUCCESS",
        canonicalName: exactMatches[0].rede,
        codigoMatriz: exactMatches[0].codigoMatriz,
        managerId: exactMatches[0].managerId,
        uf: exactMatches[0].uf || identity.uf || null,
      };
    }
    if (exactMatches.length > 1) {
      return {
        status: "CANONICALIZACAO_AMBIGUA",
        canonicalName: null,
        codigoMatriz: exactMatches[0].codigoMatriz,
        managerId: canonicalMgr.managerId,
        uf: identity.uf || null,
        candidates: exactMatches.map((m) => m.rede),
        auditReason: `Múltiplas redes encontradas com o mesmo nome exato "${rawNameClean}"`,
      };
    }

    // ------------------------------------------------------------
    // PRECEDÊNCIA 5: Identidade Equivalente Derivada da View Oficial (Desambiguação de Raiz com Guarda Estrita)
    // Se o nome legado for a raiz base sem sufixo regional (ex: "FORT" -> "FORT (SP)"):
    // Só é resolvido SE E SOMENTE SE existir EXATAMENTE 1 candidato oficial sob aquele gerente.
    // Se houver mais de 1 candidato (ex: "ZAFFARI" sob Leandro Saffi -> "ZAFFARI (RS)" e "ZAFFARI (CESTO)"):
    // RETORNA OBRIGATORIAMENTE CANONICALIZACAO_AMBIGUA sem adivinhação.
    // ------------------------------------------------------------
    const rootMatches = scopedNetworks.filter((n) => {
      const canonicalRede = canonicalizeKey(n.rede);
      const rootWithoutParens = canonicalRede.replace(/\s*\([^)]*\)$/, "").trim();
      const rootWithoutUf = canonicalRede.replace(/\s+(SP|SC|RS|PR|MG|RJ|DF|GO|BA|PE|CE)$/, "").trim();
      return rootWithoutParens === rawKey || rootWithoutUf === rawKey;
    });

    if (rootMatches.length === 1) {
      return {
        status: "SUCCESS",
        canonicalName: rootMatches[0].rede,
        codigoMatriz: rootMatches[0].codigoMatriz,
        managerId: rootMatches[0].managerId,
        uf: rootMatches[0].uf || identity.uf || null,
      };
    }

    if (rootMatches.length > 1) {
      return {
        status: "CANONICALIZACAO_AMBIGUA",
        canonicalName: null,
        codigoMatriz: rootMatches[0].codigoMatriz,
        managerId: canonicalMgr.managerId,
        uf: identity.uf || null,
        candidates: rootMatches.map((m) => m.rede),
        auditReason: `Nome base "${rawNameClean}" possui ${rootMatches.length} redes candidatas sob o gerente ${canonicalMgr.managerName} sem discriminador operacional`,
      };
    }

    // Se não encontrou no escopo do gerente, tentar match exato no catálogo global
    const globalExact = officialNetworks.filter((n) => canonicalizeKey(n.rede) === rawKey);
    if (globalExact.length === 1) {
      return {
        status: "SUCCESS",
        canonicalName: globalExact[0].rede,
        codigoMatriz: globalExact[0].codigoMatriz,
        managerId: globalExact[0].managerId,
        uf: globalExact[0].uf || identity.uf || null,
      };
    }
  }

  return {
    status: "NAO_ENCONTRADA",
    canonicalName: null,
    codigoMatriz: identity.codigoMatriz || null,
    managerId: canonicalMgr.managerId,
    uf: identity.uf || null,
    auditReason: `Nenhuma rede oficial encontrada para "${rawNameClean || identity.codigoMatriz || "identidade não informada"}"`,
  };
}
