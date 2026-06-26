import { UserRole } from '@prisma/client';

import type {
  AdminOperationArtifactRef,
  AdminOperationLedgerEntry,
  PiiMinimizedFailedImportRow,
} from '@/lib/admin-operation-ledger';
import { prisma } from '@/lib/prisma';

type PersistArtifactInput = {
  ref: AdminOperationArtifactRef;
  operationId: string;
  payload: {
    failedRows?: PiiMinimizedFailedImportRow[];
  };
};

type AdminOperationLedgerDb = {
  adminOperationLedger: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  adminOperationArtifact: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique?: (args: unknown) => Promise<unknown>;
  };
};

export async function persistAdminOperationLedger(
  entry: AdminOperationLedgerEntry,
  artifacts: PersistArtifactInput[] = [],
  db: AdminOperationLedgerDb = prisma as unknown as AdminOperationLedgerDb,
) {
  const client = db;

  await client.adminOperationLedger.upsert({
    where: { idempotencyKey: entry.idempotencyKey },
    create: {
      operationId: entry.operationId,
      kind: entry.kind,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      scope: entry.scope,
      startedAt: new Date(entry.startedAt),
      completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
      outcome: entry.outcome,
      idempotencyKey: entry.idempotencyKey,
      sourceFileHash: entry.sourceFileHash ?? null,
      artifactRefs: entry.artifactRefs,
      retentionPolicy: entry.retentionPolicy,
      rollback: entry.rollback,
      auditSummary: entry.auditSummary,
      recoveryState: entry.recoveryState,
    },
    update: {
      completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
      outcome: entry.outcome,
      artifactRefs: entry.artifactRefs,
      retentionPolicy: entry.retentionPolicy,
      rollback: entry.rollback,
      auditSummary: entry.auditSummary,
      recoveryState: entry.recoveryState,
    },
  });

  for (const artifact of artifacts) {
    await client.adminOperationArtifact.upsert({
      where: { artifactId: artifact.ref.id },
      create: {
        artifactId: artifact.ref.id,
        operationId: artifact.operationId,
        kind: artifact.ref.kind,
        label: artifact.ref.label,
        authorizedRoles: artifact.ref.authorizedRoles,
        piiMinimized: artifact.ref.piiMinimized,
        rowCount: artifact.ref.rowCount ?? null,
        expiresAt: artifact.ref.expiresAt ? new Date(artifact.ref.expiresAt) : null,
        payload: artifact.payload,
      },
      update: {
        label: artifact.ref.label,
        authorizedRoles: artifact.ref.authorizedRoles,
        piiMinimized: artifact.ref.piiMinimized,
        rowCount: artifact.ref.rowCount ?? null,
        expiresAt: artifact.ref.expiresAt ? new Date(artifact.ref.expiresAt) : null,
        payload: artifact.payload,
      },
    });
  }
}

export async function loadAuthorizedAdminOperationArtifact(input: {
  artifactId: string;
  actorRole: UserRole | string;
  now?: Date;
}) {
  const client = prisma as unknown as {
    adminOperationArtifact: {
      findUnique: (args: unknown) => Promise<{
        artifactId: string;
        label: string;
        kind: string;
        authorizedRoles: unknown;
        piiMinimized: boolean;
        rowCount: number | null;
        expiresAt: Date | null;
        revokedAt: Date | null;
        payload: unknown;
      } | null>;
    };
  };
  const artifact = await client.adminOperationArtifact.findUnique({
    where: { artifactId: input.artifactId },
  });

  if (!artifact) {
    return { status: 'missing' as const };
  }
  const authorizedRoles = Array.isArray(artifact.authorizedRoles)
    ? artifact.authorizedRoles.map(String)
    : [];
  if (!authorizedRoles.includes(String(input.actorRole))) {
    return { status: 'forbidden' as const };
  }
  if (artifact.revokedAt) {
    return { status: 'revoked' as const };
  }
  const now = input.now ?? new Date();
  if (artifact.expiresAt && artifact.expiresAt.getTime() <= now.getTime()) {
    return { status: 'expired' as const };
  }

  return {
    status: 'ok' as const,
    artifact,
  };
}
