import { ErrorCode } from "./constants";

export function logGovernanceError(
  endpoint: string,
  code: ErrorCode,
  message: string,
  error?: any
) {
  console.error(
    `[GOVERNANCE_ERROR] [${new Date().toISOString()}] Endpoint: ${endpoint} | Code: ${code} | Message: ${message}`,
    error ? (error instanceof Error ? { message: error.message, stack: error.stack } : error) : ""
  );
}
