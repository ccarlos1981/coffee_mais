import crypto from "crypto";

export enum ActionErrorCode {
  DUPLICATE_FILE = "DUPLICATE_FILE",
  EMPTY_FILE = "EMPTY_FILE",
  MISSING_HEADERS = "MISSING_HEADERS",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  NOT_FOUND = "NOT_FOUND",
  BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

export interface ActionResult<T> {
  success: boolean;
  code?: ActionErrorCode | string;
  message?: string;
  error?: string;
  data?: T;
  requestId?: string;
}

/**
 * Cria uma resposta de sucesso padronizada para Server Actions.
 */
export function successResult<T>(data: T): ActionResult<T> {
  return {
    success: true,
    data
  };
}

/**
 * Cria uma resposta de erro de negócio esperada para Server Actions.
 */
export function errorResult(
  code: ActionErrorCode | string,
  message: string,
  requestId?: string
): ActionResult<never> {
  return {
    success: false,
    code,
    message,
    error: message,
    requestId
  };
}

interface ErrorContext {
  module: string;
  action: string;
  userId?: string | null;
}

/**
 * Centraliza o tratamento e log estruturado de exceções inesperadas nas Server Actions.
 * Registra os metadados no servidor e lança uma exceção contendo o requestId.
 */
export function handleActionError(error: any, context: ErrorContext): never {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.error("CRITICAL_ACTION_EXCEPTION:", {
    requestId,
    module: context.module,
    action: context.action,
    userId: context.userId || "anonymous",
    message: error.message,
    code: error.code || error.status || "UNKNOWN",
    stack: error.stack,
    details: error.details || null,
    supabaseError: error.supabaseError || null
  });

  throw new Error(`Erro interno inesperado no servidor. Incident ID: ${requestId}`);
}
