/**
 * ============================================================================
 * GOVERNANÇA DA ESTRUTURA COMERCIAL — COMMERCIAL ROLES v2 (BASELINE PERMANENTE)
 * ============================================================================
 * 
 * COMPONENTE INFRAESTRUTURAL INTEGRANTE DA BASELINE_ARQUITETURAL_v1 DA PLATAFORMA COFFEE++
 * 
 * DIRETRIZES MANDATÓRIAS DE ARQUITETURA:
 * 1. `OFFICIAL_COMMERCIAL_ROLES` neste arquivo é a ÚNICA E EXCLUSIVA fonte oficial
 *    de verdade (Single Source of Truth) para funções comerciais (Commercial Roles),
 *    gerentes, distribuidores, códigos de parceiro, códigos de matriz, CNPJs e rótulos no Coffee++.
 * 2. É PROIBIDO a qualquer componente da aplicação, página, rota de API, hook ou serviço React
 *    criar ou manter listas locais paralelas de gerentes, distribuidores ou Commercial Roles.
 * 3. Todo e qualquer novo gerente, distribuidor ou Commercial Role (ex: EXPORT, FOOD, ATACADO)
 *    deverá ser adicionado EXCLUSIVAMENTE mediante alteração configuracional neste arquivo.
 * 4. A função de validação `validateCommercialStructure()` é executada automaticamente no
 *    carregamento do módulo e garante aborto imediato do build (Fail-Fast) em caso de inconsistência.
 * 
 * Status Arquitetural: `COMMERCIAL_STRUCTURE_V2 = LOCKED & CONFIRMED` (Baseline Permanente).
 * @see docs/governance/COMMERCIAL_STRUCTURE_BASELINE.md e BASELINE_ARQUITETURAL_v1.md
 */

import { OFFICIAL_ANALYTICS_SOURCES } from '@/lib/governance/analytics/sources';

export type CommercialRole =
  | 'KA'
  | 'DIST'
  | 'EXPORT'
  | 'FOOD'
  | 'ATACADO'
  | 'PRIVATE_LABEL'
  | 'ECOMMERCE'
  | 'MARKETPLACE';

export const VALID_COMMERCIAL_ROLES: ReadonlyArray<CommercialRole> = [
  'KA',
  'DIST',
  'EXPORT',
  'FOOD',
  'ATACADO',
  'PRIVATE_LABEL',
  'ECOMMERCE',
  'MARKETPLACE'
];

export interface CommercialRoleMatchCriteria {
  partnerCodes: string[];    // Identificadores oficiais de parceiro (cod_parceiro / codigo_cliente)
  matrizCodes: string[];     // Códigos oficiais da matriz (codigo_matriz)
  cnpjs: string[];           // CNPJs oficiais cadastrados
  aliases: string[];         // Nomes comerciais, redes ou razões sociais homologadas
}

export interface CommercialManagerRole {
  id: string;                // Identificador lógico único de filtro UI (ex: "1002-KA", "1002-DIST")
  key: string;               // Alias para retrocompatibilidade (ex: "1002-KA", "1002-DIST")
  managerId: string;         // Identificador oficial do gerente no banco (ex: "1002")
  managerName: string;       // Nome oficial do gerente (ex: "Luiz")
  role: CommercialRole;      // Função comercial ativa
  label: string;             // Rótulo visual formatado para UI (ex: "Luiz (KA)", "Luiz (Dist)")
  match?: CommercialRoleMatchCriteria; // Critérios de resolução e vinculação oficial
}

export interface DistributorDefinition {
  managerId: string;
  partnerCodes: string[];
  matrizCodes: string[];
  redes: string[];
}

/**
 * Catálogo Oficial de Funções Comerciais orientadas a Configuração (SINGLE SOURCE OF TRUTH)
 */
export const OFFICIAL_COMMERCIAL_ROLES: ReadonlyArray<CommercialManagerRole> = [
  {
    id: "1002-KA",
    key: "1002-KA",
    managerId: "1002",
    managerName: "Luiz",
    role: "KA",
    label: "Luiz (KA)",
    match: {
      partnerCodes: [],
      matrizCodes: [],
      cnpjs: [],
      aliases: []
    }
  },
  {
    id: "1002-DIST",
    key: "1002-DIST",
    managerId: "1002",
    managerName: "Luiz",
    role: "DIST",
    label: "Luiz (Dist)",
    match: {
      partnerCodes: ["212424", "185369", "147201"],
      matrizCodes: ["212424.1", "185369.1", "147201.1"],
      cnpjs: [],
      aliases: ["SOST", "SOST COMERCIAL", "DIST SOST", "ITA", "ITA COMERCIAL"]
    }
  },
  {
    id: "1003-KA",
    key: "1003-KA",
    managerId: "1003",
    managerName: "John Guedes",
    role: "KA",
    label: "John Guedes (KA)",
    match: {
      partnerCodes: [],
      matrizCodes: [],
      cnpjs: [],
      aliases: []
    }
  },
  {
    id: "1003-DIST",
    key: "1003-DIST",
    managerId: "1003",
    managerName: "John Guedes",
    role: "DIST",
    label: "John Guedes (Dist)",
    match: {
      partnerCodes: ["221911", "221912", "118143"],
      matrizCodes: ["221911.1", "221912.1", "118143.1"],
      cnpjs: [],
      aliases: ["BRASSOL", "VIDA E SAUDE DISTRIBUIDORA LTDA", "BRASSOL BRASILIA ALIMENTOS E SORVETES LTDA"]
    }
  },
  {
    id: "1001-KA",
    key: "1001-KA",
    managerId: "1001",
    managerName: "Leandro",
    role: "KA",
    label: "Leandro (KA)",
    match: {
      partnerCodes: [],
      matrizCodes: [],
      cnpjs: [],
      aliases: []
    }
  },
  {
    id: "1001-DIST",
    key: "1001-DIST",
    managerId: "1001",
    managerName: "Leandro",
    role: "DIST",
    label: "Leandro (Dist)",
    match: {
      partnerCodes: ["114527"],
      matrizCodes: ["114527.4"],
      cnpjs: [],
      aliases: ["DISTRA", "DISTRA ALIMENTOS", "DISTRA COMERCIO DE ALIMENTOS E SUPLEMENTOS LTDA."]
    }
  },
  {
    id: "1000-KA",
    key: "1000-KA",
    managerId: "1000",
    managerName: "Julliano",
    role: "KA",
    label: "Julliano (KA)",
    match: {
      partnerCodes: [],
      matrizCodes: [],
      cnpjs: [],
      aliases: []
    }
  }
];

/**
 * Validação Automática de Integridade Estrutural (Fail-Fast)
 * Esta função garante que a configuração de Commercial Roles seja 100% válida e sem duplicações.
 */
export function validateCommercialStructure(): void {
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  const seenPartnerCodes = new Map<string, string>();
  const seenMatrizCodes = new Map<string, string>();
  const seenAliases = new Map<string, string>();

  for (const roleDef of OFFICIAL_COMMERCIAL_ROLES) {
    // 1. Validação de ID
    if (!roleDef.id || roleDef.id.trim() === '') {
      throw new Error(`[CommercialStructure Governance Error] ID de Commercial Role inválido ou vazio.`);
    }
    if (seenIds.has(roleDef.id)) {
      throw new Error(`[CommercialStructure Governance Error] ID duplicado detectado: "${roleDef.id}".`);
    }
    seenIds.add(roleDef.id);

    // 2. Validação de managerId
    if (!roleDef.managerId || roleDef.managerId.trim() === '') {
      throw new Error(`[CommercialStructure Governance Error] managerId inexistente ou vazio para o ID "${roleDef.id}".`);
    }

    // 3. Validação de CommercialRole enum
    if (!VALID_COMMERCIAL_ROLES.includes(roleDef.role)) {
      throw new Error(`[CommercialStructure Governance Error] Role comercial inválido "${roleDef.role}" para o ID "${roleDef.id}". Roles válidos: ${VALID_COMMERCIAL_ROLES.join(', ')}.`);
    }

    // 4. Validação de Label duplicada
    if (!roleDef.label || roleDef.label.trim() === '') {
      throw new Error(`[CommercialStructure Governance Error] Label vazia para o ID "${roleDef.id}".`);
    }
    const labelUpper = roleDef.label.trim().toUpperCase();
    if (seenLabels.has(labelUpper)) {
      throw new Error(`[CommercialStructure Governance Error] Label duplicada detectada: "${roleDef.label}".`);
    }
    seenLabels.add(labelUpper);

    // 5. Validação de critérios de match (PartnerCodes, MatrizCodes, Aliases)
    if (roleDef.match) {
      // PartnerCodes
      for (const code of roleDef.match.partnerCodes || []) {
        const trimmed = code.trim();
        if (seenPartnerCodes.has(trimmed)) {
          throw new Error(`[CommercialStructure Governance Error] partnerCode duplicado "${trimmed}" encontrado em "${roleDef.id}" e "${seenPartnerCodes.get(trimmed)}".`);
        }
        seenPartnerCodes.set(trimmed, roleDef.id);
      }

      // MatrizCodes
      for (const mCode of roleDef.match.matrizCodes || []) {
        const trimmed = mCode.trim();
        if (seenMatrizCodes.has(trimmed)) {
          throw new Error(`[CommercialStructure Governance Error] matrizCode duplicado "${trimmed}" encontrado em "${roleDef.id}" e "${seenMatrizCodes.get(trimmed)}".`);
        }
        seenMatrizCodes.set(trimmed, roleDef.id);
      }

      // Aliases
      for (const alias of roleDef.match.aliases || []) {
        const upperAlias = alias.trim().toUpperCase();
        if (seenAliases.has(upperAlias)) {
          throw new Error(`[CommercialStructure Governance Error] alias duplicado "${alias}" encontrado em "${roleDef.id}" e "${seenAliases.get(upperAlias)}".`);
        }
        seenAliases.set(upperAlias, roleDef.id);
      }
    }
  }
}

// Execução imediata no carregamento do módulo para garantir Fail-Fast no build
validateCommercialStructure();

/**
 * Registro de Distribuidores derivado 100% dinamicamente das configurações de Commercial Role
 */
export const DISTRIBUTORS_REGISTRY: Record<string, DistributorDefinition> = OFFICIAL_COMMERCIAL_ROLES.reduce((acc, item) => {
  if (item.role === 'DIST' && item.match) {
    acc[item.managerId] = {
      managerId: item.managerId,
      partnerCodes: item.match.partnerCodes,
      matrizCodes: item.match.matrizCodes,
      redes: item.match.aliases
    };
  } else if (!acc[item.managerId]) {
    acc[item.managerId] = {
      managerId: item.managerId,
      partnerCodes: [],
      matrizCodes: [],
      redes: []
    };
  }
  return acc;
}, {} as Record<string, DistributorDefinition>);

/**
 * Lista de Gerentes Comerciais derivados dinamicamente
 */
export const COMMERCIAL_MANAGER_IDS: string[] = Array.from(
  new Set(OFFICIAL_COMMERCIAL_ROLES.map(r => r.managerId))
);

/**
 * Presets de Filtros Rápidos derivados 100% dinamicamente de OFFICIAL_COMMERCIAL_ROLES
 */
export const COMMERCIAL_ROLE_FILTER_PRESETS = OFFICIAL_COMMERCIAL_ROLES.map(item => ({
  id: item.id,
  key: item.key,
  label: item.label,
  managerId: item.managerId,
  role: item.role
}));

/**
 * Mapeamento de correspondência de chave/alias de filtro para a definição de CommercialRole
 */
const ROLE_LOOKUP_MAP: Record<string, CommercialManagerRole> = {};
OFFICIAL_COMMERCIAL_ROLES.forEach(item => {
  ROLE_LOOKUP_MAP[item.id] = item;
  ROLE_LOOKUP_MAP[item.key] = item;
  ROLE_LOOKUP_MAP[item.label.toUpperCase()] = item;
  ROLE_LOOKUP_MAP[`${item.managerName.toUpperCase()} (${item.role})`] = item;
});

/**
 * Retorna todas as opções de visualização comercial de gerentes para preenchimento de filtros e dropdowns
 */
export function getCommercialManagerRoleOptions(): { value: string; label: string; managerId: string; role: CommercialRole }[] {
  return OFFICIAL_COMMERCIAL_ROLES.map(item => ({
    value: item.id,
    label: item.label,
    managerId: item.managerId,
    role: item.role
  }));
}

/**
 * Resolve uma chave de seleção de gerente em um objeto estruturado de contexto comercial
 */
export function resolveCommercialRole(inputKey: string | null | undefined): CommercialManagerRole | null {
  if (!inputKey) return null;
  const normalized = inputKey.trim().toUpperCase();
  if (ROLE_LOOKUP_MAP[normalized]) {
    return ROLE_LOOKUP_MAP[normalized];
  }
  if (ROLE_LOOKUP_MAP[inputKey]) {
    return ROLE_LOOKUP_MAP[inputKey];
  }
  return null;
}

/**
 * Retorna o título correto do Drilldown (expansão de tabela) de acordo com o CommercialRole
 */
export function getDrilldownLabel(role?: CommercialRole | null, managerName?: string): string {
  const baseTitle = role === 'DIST' ? 'Top Distribuidores' : 'Top Matrizes';
  return managerName ? `${baseTitle} — ${managerName}` : baseTitle;
}

/**
 * Verifica se um registro (rede/parceiro/código) é um distribuidor registrado para o gerente
 */
export function isDistributorClient(
  clientObj: { rede?: string | null; nome_parceiro?: string | null; client?: string | null; cod_parceiro?: string | null; channel?: string | null },
  managerId: string
): boolean {
  const def = DISTRIBUTORS_REGISTRY[managerId];
  if (!def) return false;

  if (clientObj.channel === 'Distribuidor') return true;

  if (clientObj.cod_parceiro && def.partnerCodes.includes(String(clientObj.cod_parceiro))) {
    return true;
  }

  const redeUpper = (clientObj.client || clientObj.rede || clientObj.nome_parceiro || '').toUpperCase().trim();
  if (!redeUpper) return false;

  return def.redes.some(r => redeUpper.includes(r.toUpperCase()));
}

/**
 * Constrói o predicado SQL para o filtro de gerente com suporte transparente a CommercialRole.
 * Esta função garante que a Analytics Engine permaneça 100% genérica.
 */
export function buildCommercialRoleSqlFilter(
  selectedKeys: string | string[],
  tableAlias?: string,
  targetTable?: string
): string | null {
  if (!selectedKeys) return null;
  const keysArray = Array.isArray(selectedKeys) ? selectedKeys : selectedKeys.split(',');
  const prefix = tableAlias ? `${tableAlias}.` : '';

  const isMensalSummaryTable = targetTable && (targetTable.includes(OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL) || targetTable.includes('faturamento_mensal'));

  const clauses: string[] = [];

  for (const rawKey of keysArray) {
    const trimmed = rawKey.trim();
    if (!trimmed || trimmed === 'all') continue;

    const roleDef = resolveCommercialRole(trimmed);
    if (roleDef) {
      const match = roleDef.match || { partnerCodes: [], matrizCodes: [], cnpjs: [], aliases: [] };

      if (roleDef.role === 'DIST') {
        // Apenas Distribuidores do Gerente
        const distConditions: string[] = [`${prefix}channel = 'Distribuidor'`];

        if (!isMensalSummaryTable && match.partnerCodes && match.partnerCodes.length > 0) {
          const codes = match.partnerCodes.map(c => `'${c}'`).join(',');
          distConditions.push(`${prefix}cod_parceiro IN (${codes})`);
        }
        if (match.aliases && match.aliases.length > 0) {
          const redesSql = match.aliases.map(r => `'${r.replace(/'/g, "''")}'`).join(',');
          distConditions.push(`UPPER(${prefix}rede) IN (${redesSql})`);
          if (!isMensalSummaryTable) {
            distConditions.push(`UPPER(${prefix}nome_parceiro) IN (${redesSql})`);
          }
        }

        clauses.push(`(${prefix}manager_id = '${roleDef.managerId}' AND (${distConditions.join(' OR ')}))`);
      } else if (roleDef.role === 'KA') {
        // Apenas Carteira KA (exclui Distribuidores do Gerente)
        const distRole = OFFICIAL_COMMERCIAL_ROLES.find(r => r.managerId === roleDef.managerId && r.role === 'DIST');
        const distMatch = distRole?.match || { partnerCodes: [], matrizCodes: [], cnpjs: [], aliases: [] };

        const excludeConditions: string[] = [`${prefix}channel != 'Distribuidor'`];

        if (!isMensalSummaryTable && distMatch.partnerCodes && distMatch.partnerCodes.length > 0) {
          const codes = distMatch.partnerCodes.map(c => `'${c}'`).join(',');
          excludeConditions.push(`${prefix}cod_parceiro NOT IN (${codes})`);
        }
        if (distMatch.aliases && distMatch.aliases.length > 0) {
          const redesSql = distMatch.aliases.map(r => `'${r.replace(/'/g, "''")}'`).join(',');
          excludeConditions.push(`UPPER(${prefix}rede) NOT IN (${redesSql})`);
        }

        clauses.push(`(${prefix}manager_id = '${roleDef.managerId}' AND ${excludeConditions.join(' AND ')})`);
      } else {
        // Outros roles genéricos futuros (EXPORT, FOOD, ATACADO, etc.)
        clauses.push(`${prefix}manager_id = '${roleDef.managerId}'`);
      }
    } else {
      // Se for manager_id puro (ex: "1002" ou "1001") ou canal genérico ("1004")
      clauses.push(`(${prefix}manager_id = '${trimmed}' OR ${prefix}manager = '${trimmed.replace(/'/g, "''")}')`);
    }
  }

  if (clauses.length === 0) return null;
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`;
}
