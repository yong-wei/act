export type AdminOperationKind =
  | 'admin-user-import'
  | 'admin-import-failed-rows-download'
  | 'admin-user-template-download'
  | 'admin-users-export'
  | 'admin-config-save'
  | 'admin-config-model-test'
  | 'admin-governance-refresh'
  | 'admin-governance-export'
  | 'admin-governance-resolve'
  | 'admin-governance-assign'
  | 'admin-governance-ignore'
  | 'admin-governance-reopen'
  | 'admin-governance-undo'
  | 'admin-states-export';

export type AdminOperationOutcome =
  | 'pending'
  | 'completed'
  | 'completed-with-errors'
  | 'export-ready'
  | 'download-ready'
  | 'failed'
  | 'blocked';

export type AdminOperationArtifactRef = {
  id: string;
  kind: 'failed-rows' | 'download' | 'export' | 'config-diff';
  label: string;
  authorizedRoles: readonly ['ADMIN'];
  piiMinimized: boolean;
  downloadUrl?: string;
  rowCount?: number;
  expiresAt?: string;
  revocable: boolean;
};

export type AdminOperationLedgerEntry = {
  operationId: string;
  kind: AdminOperationKind;
  actorId: string;
  actorRole: string;
  scope: string;
  startedAt: string;
  completedAt?: string;
  outcome: AdminOperationOutcome;
  idempotencyKey: string;
  sourceFileHash?: string;
  artifactRefs: AdminOperationArtifactRef[];
  retentionPolicy: {
    policy: string;
    expiresAt?: string;
    revocable: boolean;
  };
  rollback: {
    available: boolean;
    rationale?: string;
  };
  auditSummary: string;
  recoveryState: {
    status: 'available' | 'not-available' | 'retry' | 'download-artifact';
    action: string;
  };
};

export type PiiMinimizedFailedImportRow = {
  row: number;
  accountFingerprint: string | null;
  reason: string;
};

export function buildAdminOperationId(input: {
  kind: AdminOperationKind;
  scope: string;
  seed: string;
}): string {
  return `${input.kind}:${sanitizeOperationSegment(input.scope)}:${stableFingerprint(input.seed).slice(0, 12)}`;
}

export function buildAdminOperationIdempotencyKey(parts: readonly unknown[]): string {
  return `admin-op:${stableFingerprint(parts.map((part) => String(part ?? '')).join('|'))}`;
}

export function buildAdminOperationLedgerEntry(input: {
  kind: AdminOperationKind;
  actorId: string;
  actorRole?: string | null;
  scope: string;
  startedAt: string;
  completedAt?: string;
  outcome: AdminOperationOutcome;
  idempotencyKey: string;
  sourceFileHash?: string;
  artifactRefs?: AdminOperationArtifactRef[];
  retentionPolicy?: AdminOperationLedgerEntry['retentionPolicy'];
  rollback?: AdminOperationLedgerEntry['rollback'];
  auditSummary: string;
  recoveryState?: AdminOperationLedgerEntry['recoveryState'];
}): AdminOperationLedgerEntry {
  return {
    operationId: buildAdminOperationId({
      kind: input.kind,
      scope: input.scope,
      seed: input.idempotencyKey,
    }),
    kind: input.kind,
    actorId: input.actorId,
    actorRole: input.actorRole ?? 'ADMIN',
    scope: input.scope,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    outcome: input.outcome,
    idempotencyKey: input.idempotencyKey,
    sourceFileHash: input.sourceFileHash,
    artifactRefs: input.artifactRefs ?? [],
    retentionPolicy: input.retentionPolicy ?? {
      policy: 'admin-operation-ledger-30d',
      revocable: true,
    },
    rollback: input.rollback ?? {
      available: false,
      rationale: '该操作未声明自动回滚策略。',
    },
    auditSummary: input.auditSummary,
    recoveryState: input.recoveryState ?? {
      status: 'retry',
      action: '复核状态后重试操作',
    },
  };
}

export function buildFailedImportArtifact(input: {
  batchId: string;
  artifactSeed?: string;
  failedRows: readonly PiiMinimizedFailedImportRow[];
  generatedAt: string;
  retentionDays?: number;
}): AdminOperationArtifactRef | null {
  if (input.failedRows.length === 0) return null;
  const expiresAt = new Date(
    new Date(input.generatedAt).getTime() + (input.retentionDays ?? 7) * 24 * 60 * 60 * 1000,
  ).toISOString();
  const artifactSegment = input.artifactSeed
    ? `${input.batchId}:${stableFingerprint(input.artifactSeed).slice(0, 12)}`
    : input.batchId;
  return {
    id: `${artifactSegment}:failed-rows`,
    kind: 'failed-rows',
    label: 'PII 最小化失败行',
    authorizedRoles: ['ADMIN'],
    piiMinimized: true,
    rowCount: input.failedRows.length,
    expiresAt,
    revocable: true,
  };
}

export function minimizeFailedImportRows(
  rows: readonly { row: number; account?: string | null; reason: string }[],
): PiiMinimizedFailedImportRow[] {
  return rows.map((item) => ({
    row: item.row,
    accountFingerprint: null,
    reason: item.reason,
  }));
}

export function operationLedgerHeaders(entry: AdminOperationLedgerEntry) {
  return {
    'x-admin-operation-id': entry.operationId,
    'x-admin-operation-scope': entry.scope,
    'x-admin-operation-outcome': entry.outcome,
    'x-admin-operation-idempotency-key': entry.idempotencyKey,
  };
}

function sanitizeOperationSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'scope';
}

function stableFingerprint(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  for (const byte of bytes) {
    h1 = Math.imul(h1 ^ byte, 2654435761);
    h2 = Math.imul(h2 ^ byte, 1597334677);
    h3 = Math.imul(h3 ^ byte, 2246822507);
    h4 = Math.imul(h4 ^ byte, 3266489909);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1, h2, h3, h4].map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('');
}
