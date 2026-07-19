import { NextRequest } from "next/server";
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT, INCONSISTENCIA_CODES, TipoInconsistencia } from "./constants";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface InconsistencyQueryParams extends PaginationParams {
  tipo_inconsistencia?: TipoInconsistencia;
  search?: string;
}

export function parsePaginationParams(req: NextRequest): PaginationParams {
  const { searchParams } = new URL(req.url);
  const pageStr = searchParams.get("page");
  const limitStr = searchParams.get("limit");

  let page = pageStr ? parseInt(pageStr, 10) : DEFAULT_PAGE;
  let limit = limitStr ? parseInt(limitStr, 10) : DEFAULT_LIMIT;

  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit };
}

export function parseInconsistencyQueryParams(req: NextRequest): InconsistencyQueryParams {
  const pagination = parsePaginationParams(req);
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo_inconsistencia") as TipoInconsistencia | null;
  const search = searchParams.get("search") || undefined;

  const validTipos = Object.values(INCONSISTENCIA_CODES) as string[];
  const tipo_inconsistencia = tipo && validTipos.includes(tipo) ? tipo : undefined;

  return {
    ...pagination,
    tipo_inconsistencia,
    search: search ? decodeURIComponent(search).trim() : undefined,
  };
}

export function parseMetricsQueryParams(req: NextRequest): { limit: number } {
  const { searchParams } = new URL(req.url);
  const limitStr = searchParams.get("limit");
  let limit = limitStr ? parseInt(limitStr, 10) : DEFAULT_LIMIT;
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { limit };
}

export interface PatchSettingBody {
  key: string;
  value: any;
}

export async function parsePatchSettingBody(req: NextRequest): Promise<PatchSettingBody> {
  const body = await req.json();
  if (!body || typeof body !== "object") {
    throw new Error("INVALID_BODY");
  }
  if (typeof body.key !== "string" || body.key.trim() === "") {
    throw new Error("INVALID_KEY");
  }
  if (body.value === undefined) {
    throw new Error("MISSING_VALUE");
  }
  return {
    key: body.key.trim(),
    value: body.value,
  };
}
