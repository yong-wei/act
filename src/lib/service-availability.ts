import { NextResponse } from 'next/server';

const DATABASE_CONNECTIVITY_ERROR_CODES = new Set([
  'P1001',
  'P1002',
  'P2024',
  'P2037',
]);

const DATABASE_CONNECTIVITY_PATTERNS = [
  /can't reach database server/i,
  /timed out fetching a new connection from the pool/i,
  /database.*unreachable/i,
];

export function isDatabaseConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };

  if (typeof candidate.code === 'string' && DATABASE_CONNECTIVITY_ERROR_CODES.has(candidate.code)) {
    return true;
  }

  const message = candidate.message;
  if (typeof message === 'string') {
    return DATABASE_CONNECTIVITY_PATTERNS.some((pattern) => pattern.test(message));
  }

  return false;
}

export function buildServiceUnavailablePayload(detail: string) {
  return {
    error: 'SERVICE_UNAVAILABLE',
    detail,
    retryable: true,
  };
}

export function createDatabaseUnavailableResponse(detail = 'database_unreachable') {
  return NextResponse.json(buildServiceUnavailablePayload(detail), { status: 503 });
}
