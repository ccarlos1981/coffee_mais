/**
 * DRE Gerencial + RDM — Tipos Oficiais
 * 
 * Contratos de dados compartilhados entre DRE e RDM.
 * Fonte única de verdade para interfaces TypeScript.
 */

// ─── Dados da Planilha (por rede/competência) ───

export interface DreRedePlanilha {
  rede: string;
  competencia: string;
  icmsPct: number;
  cpvValor: number;           // R$ (já ×1000)
  investimentoValor: number;  // Abatimento R$
  contratoValor: number;      // R$
  bonificacaoValor: number;   // 0
}

// ─── KPIs Calculados ───

export interface DreKpis {
  volume: number;
  faturamento: number;
  impostos: number;
  investComercial: number;
  abatimento: number;
  contrato: number;
  bonificacao: number;
  receitaLiquida: number;
  cpv: number;
  frete: number;
  margemContribuicao: number;
}

// ─── Rede com KPIs ───

export interface DreRedeRow {
  rede: string;
  gerente: string;
  volume: number;
  faturamento: number;
  icmsPct: number;
  impPct: number | null;           // Impostos / Fat
  investPct: number | null;        // Invest. Comercial / Fat
  freteUnidade: number | null;     // Frete / Volume
  cpvUnidade: number | null;       // CPV / Volume
  mc: number;
}

// ─── RDM Slide 1 ───

export interface RdmSlide1Linha {
  kpi: string;
  actual: number;
  desafio: number | null;
  deltaDesafio: number | null;
  pctDeltaDesafio: number | null;
  mesAnterior: number;
  deltaMesAnterior: number;
  pctDeltaMesAnterior: number | null;
  anoAnterior: number | null;
  isHighlighted: boolean;
  indent?: boolean;
}

export interface RdmSlide1Data {
  titulo: string;
  competenciaLabel: string;
  linhas: RdmSlide1Linha[];
}

// ─── RDM Slide 2 ───

export interface RdmSlide2Grupo {
  gerente: string;
  redes: DreRedeRow[];
}

export interface RdmSlide2Data {
  grupos: RdmSlide2Grupo[];
}

// ─── DRE Consolidado (mensal) ───

export interface DreMensalColuna {
  competencia: string;
  label: string;        // 'Jan', 'Fev', etc.
  kpis: DreKpis;
}

export interface DreConsolidadoData {
  colunas: DreMensalColuna[];
}

// ─── DRE Por Gerente ───

export interface DrePorGerenteData {
  gerentes: {
    gerente: string;
    colunas: DreMensalColuna[];
  }[];
}

// ─── DRE Por Rede ───

export interface DrePorRedeData {
  redes: {
    rede: string;
    gerente: string;
    colunas: DreMensalColuna[];
  }[];
}

// ─── Filtros ───

export interface DreGerencialFilters {
  ano: number;
  competencia?: string;   // '2026-07' (RDM usa, DRE mostra todos)
  gerente?: string;       // 'Leandro', 'Luiz', etc.
  canal?: string;         // 'KA'
  rede?: string;          // Nome da rede
  visao?: 'consolidado' | 'gerente' | 'rede';
}

// ─── Importação ───

export interface ImportPreviewRow {
  redePlanilha: string;
  redeNormalizada: string;
  redeSistema: string | null;
  matchStatus: 'matched' | 'unmatched' | 'auto_named' | 'alias';
  responsavelPlanilha: string;
  gerenteSistema: string | null;
  icmsPct: number;
  cpvValor: number;
  investimentoValor: number;
  contratoValor: number;
}

export interface ImportPreview {
  batchId: string;
  competencia: string;
  filename: string;
  totalRows: number;
  totalRedes: number;
  redesMatched: number;
  redesUnmatched: number;
  rows: ImportPreviewRow[];
  canImport: boolean;  // false se houver unmatched
  isReimport: boolean; // true se competência já existir
}

// ─── Mapeamento de Gerentes ───

export const GERENTE_DISPLAY_MAP: Record<string, string> = {
  'Leandro Saffi': 'Leandro',
  'John Guedes': 'John',
  'Luiz': 'Luiz',
  'Julliano': 'Julliano',
};

export const GERENTE_SYSTEM_MAP: Record<string, string> = {
  'Leandro': 'Leandro Saffi',
  'John': 'John Guedes',
  'Luiz': 'Luiz',
  'Julliano': 'Julliano',
};

export const GERENTES_KA = ['Leandro Saffi', 'John Guedes', 'Luiz', 'Julliano'];

export const GERENTE_TARGET_MAP: Record<string, string> = {
  'Leandro Saffi': 'Leandro (KA)',
  'John Guedes': 'John Guedes (KA)',
  'Luiz': 'Luiz (KA)',
  'Julliano': 'Julliano (KA)',
};

// ─── Meses ───

export const MESES_LABEL: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr',
  5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago',
  9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
};

// ─── Prefixos UF ───

export const UF_PREFIXES = [
  'SP', 'MG', 'SC', 'RS', 'PR', 'RJ', 'DF', 'ES', 'GO',
  'BA', 'CE', 'MT', 'AM', 'PE', 'PA', 'MA', 'PI', 'RN',
  'SE', 'AL', 'PB', 'MS', 'RO', 'TO', 'AC', 'AP', 'RR',
];

// ─── RDM Slide DRE Acumulado por Período (Novo) ───

export interface RdmAcumuladoColuna {
  key: string;      // e.g. 'JAN', 'FEV', 'MAR', 'ACUM_Q1'
  label: string;    // e.g. 'JAN', 'FEV', 'MAR', 'ACUM'
  isAcum: boolean;
  hasData: boolean; // false para meses futuros sem dados reais
}

export interface RdmAcumuladoValor {
  desafio: number | null;
  actual: number | null;
  delta: number | null;
  pctDelta: number | null;
}

export interface RdmAcumuladoLinha {
  kpi: string;
  isHighlighted?: boolean;
  indent?: boolean;
  valores: Record<string, RdmAcumuladoValor>;
}

export interface RdmTrimestreData {
  trimestre: number; // 1, 2, 3, 4
  label: string;     // '1º TRIMESTRE', etc.
  colunas: RdmAcumuladoColuna[];
  linhas: RdmAcumuladoLinha[];
}

export interface RdmSlideAcumuladoData {
  titulo: string;
  year: number;
  trimestres: RdmTrimestreData[];
}
