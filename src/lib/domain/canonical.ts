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
  "1001": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },
  "1001-KA": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },
  "1001-DIST": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },
  "LEANDRO": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },
  "LEANDRO (KA)": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },
  "LEANDRO (DIST)": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },
  "LEANDRO SAFFI": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },
  "LEANDRO (SUL)": { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" },

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
