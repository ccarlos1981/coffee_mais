import { OFFICIAL_ANALYTICS_SOURCES } from "@/lib/governance/analytics/sources";

const ALLOWED_TABLES = new Set([
  "sales",
  "targets",
  "public.sales",
  "public.targets",
  OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL.toLowerCase(),
  OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL.toLowerCase(),
  OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL.replace(/^public\./, "").toLowerCase(),
  OFFICIAL_ANALYTICS_SOURCES.VENDAS_CLIENTE_MENSAL.replace(/^public\./, "").toLowerCase(),
]);

export function validateSqlSecurity(rawSql: string): { valid: boolean; error?: string } {
  // 1. Block statement stacking & comments
  if (rawSql.includes(";") || rawSql.includes("--") || rawSql.includes("/*") || rawSql.includes("*/")) {
    return { valid: false, error: "Consulta inválida: caracteres não permitidos na instrução SQL." };
  }

  // 2. Enforce SELECT / WITH only
  const sqlUpper = rawSql.trim().toUpperCase();
  if (!sqlUpper.startsWith("SELECT") && !sqlUpper.startsWith("WITH")) {
    return { valid: false, error: "Por segurança, apenas consultas analíticas de leitura (SELECT) são permitidas." };
  }

  // 3. Strip SQL string literals and normalize quoted identifiers
  const sqlWithoutStrings = rawSql.replace(/'(?:''|[^'])*'/g, "''");
  const sqlNormalized = sqlWithoutStrings.replace(/"/g, "");

  // 4. Block DDL / DML
  const ddlDmlForbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|CREATE|REPLACE|VACUUM|REINDEX|REFRESH)\b/i;
  if (ddlDmlForbidden.test(sqlNormalized)) {
    return { valid: false, error: "Operação não autorizada detectada na consulta SQL." };
  }

  // 5. Block sensitive tables and schemas
  const sensitiveForbidden = /\b(cm_user_profiles|cm_report_recipients|cm_sync_logs|cm_audit_logs|cm_role_permissions|auth\.|pg_catalog|information_schema|pg_authid|pg_shadow|pg_user|pg_proc|pg_tables)\b/i;
  if (sensitiveForbidden.test(sqlNormalized)) {
    return { valid: false, error: "Acesso negado a tabelas restritas do sistema." };
  }

  // 6. Extract and validate all tables in FROM and JOIN
  const tables: string[] = [];

  const fromMatches = Array.from(sqlNormalized.matchAll(/\bFROM\s+([^()]+?)(?=\bWHERE\b|\bGROUP\b|\bORDER\b|\bLIMIT\b|\bJOIN\b|\bON\b|\bHAVING\b|\bUNION\b|\bWINDOW\b|\)|$)/gi));
  for (const match of fromMatches) {
    const list = match[1].split(",");
    for (const item of list) {
      const parts = item.trim().split(/\s+/);
      const tableName = parts[0]?.trim();
      if (tableName && !tableName.startsWith("(") && !["SELECT", "WITH"].includes(tableName.toUpperCase())) {
        tables.push(tableName.toLowerCase());
      }
    }
  }

  const joinMatches = Array.from(sqlNormalized.matchAll(/\b(?:CROSS|NATURAL|INNER|LEFT|RIGHT|FULL|OUTER)?\s*JOIN\s+([a-zA-Z0-9_.]+)/gi));
  for (const match of joinMatches) {
    const tableName = match[1]?.trim();
    if (tableName) {
      tables.push(tableName.toLowerCase());
    }
  }

  if (tables.length === 0) {
    return { valid: false, error: "A consulta tenta acessar fontes de dados não homologadas." };
  }

  for (const tbl of tables) {
    if (!ALLOWED_TABLES.has(tbl)) {
      return { valid: false, error: `A consulta tenta acessar fontes de dados não homologadas (${tbl}).` };
    }
  }

  return { valid: true };
}
