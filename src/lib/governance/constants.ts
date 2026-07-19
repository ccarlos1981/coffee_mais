// Constantes oficiais de governança cadastral da Fase 3

export const API_VERSION = "v1.0.0";
export const BASELINE_VERSION = "v1.0.1";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const INCONSISTENCIA_CODES = {
  SEM_UF: "SEM_UF",
  MATRIZ_INEXISTENTE: "MATRIZ_INEXISTENTE",
  GERENTE_SEM_MATRIZ: "GERENTE_SEM_MATRIZ",
  DIVERGENCIA_OWNERSHIP: "DIVERGENCIA_OWNERSHIP",
} as const;

export type TipoInconsistencia = typeof INCONSISTENCIA_CODES[keyof typeof INCONSISTENCIA_CODES];

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
