import { NextResponse } from "next/server";
import { API_VERSION, ErrorCode } from "./constants";

export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  field?: string;
}

export interface GovernanceResponseEnvelope<T = any> {
  success: boolean;
  data: T | null;
  meta: {
    timestamp: string;
    version: string;
    [key: string]: any;
  };
  errors: ErrorDetail[];
}

export function successResponse<T = any>(
  data: T,
  additionalMeta?: Record<string, any>,
  status = 200
) {
  const envelope: GovernanceResponseEnvelope<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      ...additionalMeta,
    },
    errors: [],
  };
  return NextResponse.json(envelope, { status });
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  field?: string
) {
  const envelope: GovernanceResponseEnvelope = {
    success: false,
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    },
    errors: [
      {
        code,
        message,
        field,
      },
    ],
  };
  return NextResponse.json(envelope, { status });
}
