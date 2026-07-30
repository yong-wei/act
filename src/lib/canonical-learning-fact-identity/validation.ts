/**
 * Fail-closed Canonical LearningFact write admission (#1116).
 *
 * Shared by the formal Canonical adapter and shadow validation. Candidate
 * ReleaseSets, incomplete/drifted identity, coverage misses, missing
 * resource/KAQ support, dual-write, and incomplete source identity all reject.
 */

import {
  CANONICAL_LEARNING_FACT_IDENTITY_VERSION,
  type CanonicalLearningFactIdentity,
  type CanonicalWriteAdmissionContext,
  type CanonicalWriteRejectionCode,
  type LearningFactWriteRow,
} from './contracts';

export class CanonicalLearningFactWriteError extends Error {
  readonly code: CanonicalWriteRejectionCode;
  readonly details?: readonly string[];

  constructor(
    code: CanonicalWriteRejectionCode,
    message: string,
    details?: readonly string[],
  ) {
    super(message);
    this.name = 'CanonicalLearningFactWriteError';
    this.code = code;
    this.details = details;
  }
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sourceIdentityOf(row: Pick<LearningFactWriteRow, 'sourceEventId' | 'sourceLogId'>): {
  sourceEventId: string | null;
  sourceLogId: string | null;
} {
  return {
    sourceEventId: nonEmpty(row.sourceEventId) ? row.sourceEventId.trim() : null,
    sourceLogId: nonEmpty(row.sourceLogId) ? row.sourceLogId.trim() : null,
  };
}

function sourceHasAllowedPrefix(
  source: string,
  allowedPrefixes: readonly string[],
): boolean {
  return allowedPrefixes.some(
    (prefix) => source === prefix || source.startsWith(`${prefix}:`),
  );
}

function readContextRecord(contextJson: unknown): Record<string, unknown> {
  return contextJson && typeof contextJson === 'object' && !Array.isArray(contextJson)
    ? contextJson as Record<string, unknown>
    : {};
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * Detect dual Legacy+Canonical identity on a Canonical write request.
 * Post-cutover facts must not carry Legacy knowledge-node identity arrays.
 */
export function detectDualKnowledgeIdentity(input: {
  identity: CanonicalLearningFactIdentity;
  rows: readonly LearningFactWriteRow[];
}): string[] {
  const issues: string[] = [];
  if (input.identity.identityNamespace !== 'CANONICAL') {
    issues.push('identity-namespace-not-canonical');
  }
  for (const [index, row] of input.rows.entries()) {
    if (row.knowledgeIdentityNamespace === 'LEGACY') {
      issues.push(`row[${index}].knowledgeIdentityNamespace=LEGACY`);
    }
    const context = readContextRecord(row.contextJson);
    const evidence = readContextRecord(context.evidenceGovernance);
    const legacyNodeIds = [
      ...readStringArray(context.knowledgeNodeIds),
      ...readStringArray(evidence.knowledgeNodeIds),
    ];
    if (legacyNodeIds.length > 0) {
      issues.push(`row[${index}].legacy-knowledge-node-ids`);
    }
    // Dual columns: Legacy stamp alongside Canonical columns.
    if (
      row.knowledgeIdentityNamespace === 'CANONICAL'
      && nonEmpty(row.canonicalObjectId)
      && legacyNodeIds.length > 0
    ) {
      issues.push(`row[${index}].dual-column-identity`);
    }
  }
  return issues;
}

export function assertCompleteCanonicalIdentity(
  identity: CanonicalLearningFactIdentity | null | undefined,
): CanonicalLearningFactIdentity {
  if (!identity) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact write requires a complete fixed identity atom',
    );
  }
  if (identity.schemaVersion !== CANONICAL_LEARNING_FACT_IDENTITY_VERSION) {
    throw new CanonicalLearningFactWriteError(
      'identity-drift',
      `Canonical LearningFact identity schemaVersion mismatch: ${identity.schemaVersion}`,
    );
  }
  if (identity.identityNamespace !== 'CANONICAL') {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact identityNamespace must be CANONICAL',
    );
  }
  if (!nonEmpty(identity.canonicalObjectId)) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact requires canonicalObjectId',
    );
  }
  if (!nonEmpty(identity.aggregateReleaseSetId) || !nonEmpty(identity.aggregateReleaseId)) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact requires aggregate ReleaseSet/Release identity',
    );
  }
  if (!nonEmpty(identity.knowledgeRevisionRef)) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact requires knowledgeRevisionRef (active aggregate releaseHash)',
    );
  }
  if (!nonEmpty(identity.knowledgeProjectionId)) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact requires knowledgeProjectionId (active aggregate projection)',
    );
  }
  if (!nonEmpty(identity.sourceEventId) && !nonEmpty(identity.sourceLogId)) {
    throw new CanonicalLearningFactWriteError(
      'source-identity-missing',
      'Canonical LearningFact requires sourceEventId or sourceLogId',
    );
  }
  return identity;
}

export function assertNotCandidateRelease(
  identity: CanonicalLearningFactIdentity,
): void {
  if (identity.releasePublicationState === 'CANDIDATE') {
    throw new CanonicalLearningFactWriteError(
      'candidate-release-set',
      `Candidate ReleaseSet ${identity.aggregateReleaseSetId} cannot receive formal LearningFacts`,
    );
  }
}

export function assertIdentityMatchesAdmission(
  identity: CanonicalLearningFactIdentity,
  admission: CanonicalWriteAdmissionContext,
): void {
  if (
    identity.aggregateReleaseSetId !== admission.expectedReleaseSetId
    || identity.aggregateReleaseId !== admission.expectedReleaseId
  ) {
    throw new CanonicalLearningFactWriteError(
      'identity-drift',
      'Canonical LearningFact aggregate identity drifted from verified admission context',
      [
        `identity.releaseSetId=${identity.aggregateReleaseSetId}`,
        `admission.releaseSetId=${admission.expectedReleaseSetId}`,
        `identity.releaseId=${identity.aggregateReleaseId}`,
        `admission.releaseId=${admission.expectedReleaseId}`,
      ],
    );
  }

  // Projection and revision are required closed identity fields. Omitting either
  // side to evade comparison is itself identity-drift / incomplete-identity.
  if (!nonEmpty(admission.expectedKnowledgeRevisionRef)) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Admission is missing expectedKnowledgeRevisionRef (must equal pinned releaseHash)',
    );
  }
  if (!nonEmpty(identity.knowledgeRevisionRef)) {
    throw new CanonicalLearningFactWriteError(
      'identity-drift',
      'Canonical LearningFact omitted knowledgeRevisionRef while admission requires it',
    );
  }
  if (identity.knowledgeRevisionRef !== admission.expectedKnowledgeRevisionRef) {
    throw new CanonicalLearningFactWriteError(
      'identity-drift',
      'Canonical LearningFact knowledge revision drifted from admission context',
      [
        `identity.knowledgeRevisionRef=${identity.knowledgeRevisionRef}`,
        `admission.expectedKnowledgeRevisionRef=${admission.expectedKnowledgeRevisionRef}`,
      ],
    );
  }

  if (!nonEmpty(admission.expectedProjectionId)) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Admission is missing expectedProjectionId',
    );
  }
  if (!nonEmpty(identity.knowledgeProjectionId)) {
    throw new CanonicalLearningFactWriteError(
      'identity-drift',
      'Canonical LearningFact omitted knowledgeProjectionId while admission requires it',
    );
  }
  if (identity.knowledgeProjectionId !== admission.expectedProjectionId) {
    throw new CanonicalLearningFactWriteError(
      'identity-drift',
      'Canonical LearningFact projection identity drifted from admission context',
      [
        `identity.knowledgeProjectionId=${identity.knowledgeProjectionId}`,
        `admission.expectedProjectionId=${admission.expectedProjectionId}`,
      ],
    );
  }
}

export function assertInCourseCoverage(
  identity: CanonicalLearningFactIdentity,
  admission: CanonicalWriteAdmissionContext,
): void {
  const admitted = new Set(admission.admittedCanonicalIds);
  if (!admitted.has(identity.canonicalObjectId)) {
    throw new CanonicalLearningFactWriteError(
      'not-in-course-coverage',
      `Canonical object ${identity.canonicalObjectId} is not admitted by current aggregate CourseCoverage`,
    );
  }
}

export function assertResourceOrKaqSupport(
  identity: CanonicalLearningFactIdentity,
  admission: CanonicalWriteAdmissionContext,
): void {
  const supported = new Set(admission.resourceOrKaqSupportedCanonicalIds);
  if (!supported.has(identity.canonicalObjectId)) {
    throw new CanonicalLearningFactWriteError(
      'resource-or-kaq-support-missing',
      `Canonical object ${identity.canonicalObjectId} lacks current aggregate resource binding or reviewed KAQ producer support`,
    );
  }
}

export function assertSourceIdentity(
  identity: CanonicalLearningFactIdentity,
  rows: readonly LearningFactWriteRow[],
  admission: CanonicalWriteAdmissionContext,
): void {
  if (rows.length === 0) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact write requires at least one row',
    );
  }
  for (const [index, row] of rows.entries()) {
    const source = sourceIdentityOf(row);
    if (!source.sourceEventId && !source.sourceLogId) {
      throw new CanonicalLearningFactWriteError(
        'source-identity-missing',
        `row[${index}] missing governed source identity`,
      );
    }
    const candidates = [source.sourceEventId, source.sourceLogId].filter(
      (value): value is string => Boolean(value),
    );
    for (const candidate of candidates) {
      if (!sourceHasAllowedPrefix(candidate, admission.allowedSourcePrefixes)) {
        throw new CanonicalLearningFactWriteError(
          'source-identity-mismatch',
          `row[${index}] source identity is not in the producer contract prefixes`,
          [candidate, ...admission.allowedSourcePrefixes],
        );
      }
    }
    // Identity atom source must match every row source when provided.
    if (
      nonEmpty(identity.sourceEventId)
      && source.sourceEventId
      && identity.sourceEventId !== source.sourceEventId
    ) {
      throw new CanonicalLearningFactWriteError(
        'source-identity-mismatch',
        `row[${index}] sourceEventId does not match Canonical identity atom`,
      );
    }
    if (
      nonEmpty(identity.sourceLogId)
      && source.sourceLogId
      && identity.sourceLogId !== source.sourceLogId
    ) {
      throw new CanonicalLearningFactWriteError(
        'source-identity-mismatch',
        `row[${index}] sourceLogId does not match Canonical identity atom`,
      );
    }
  }
}

/**
 * Full fail-closed admission for Canonical writes (formal and shadow).
 */
export function validateCanonicalLearningFactWrite(input: {
  identity: CanonicalLearningFactIdentity | null | undefined;
  rows: readonly LearningFactWriteRow[];
  admission: CanonicalWriteAdmissionContext | null | undefined;
}): {
  identity: CanonicalLearningFactIdentity;
  rejectionCodes: CanonicalWriteRejectionCode[];
} {
  if (!input.admission) {
    throw new CanonicalLearningFactWriteError(
      'incomplete-identity',
      'Canonical LearningFact write requires admission context',
    );
  }
  const identity = assertCompleteCanonicalIdentity(input.identity);
  assertNotCandidateRelease(identity);
  assertIdentityMatchesAdmission(identity, input.admission);
  assertInCourseCoverage(identity, input.admission);
  assertResourceOrKaqSupport(identity, input.admission);
  assertSourceIdentity(identity, input.rows, input.admission);

  const dualIssues = detectDualKnowledgeIdentity({
    identity,
    rows: input.rows,
  });
  if (dualIssues.length > 0) {
    throw new CanonicalLearningFactWriteError(
      'dual-write-forbidden',
      'Canonical LearningFact must not dual-write Legacy knowledge identity',
      dualIssues,
    );
  }

  return { identity, rejectionCodes: [] };
}

/**
 * Non-throwing variant used by shadow validation to collect rejection codes.
 */
export function evaluateCanonicalLearningFactWrite(input: {
  identity: CanonicalLearningFactIdentity | null | undefined;
  rows: readonly LearningFactWriteRow[];
  admission: CanonicalWriteAdmissionContext | null | undefined;
}): {
  accepted: boolean;
  identity: CanonicalLearningFactIdentity | null;
  rejectionCodes: CanonicalWriteRejectionCode[];
} {
  try {
    const result = validateCanonicalLearningFactWrite(input);
    return {
      accepted: true,
      identity: result.identity,
      rejectionCodes: [],
    };
  } catch (error) {
    if (error instanceof CanonicalLearningFactWriteError) {
      return {
        accepted: false,
        identity: null,
        rejectionCodes: [error.code],
      };
    }
    throw error;
  }
}

export function stampCanonicalIdentityOnRows(
  rows: readonly LearningFactWriteRow[],
  identity: CanonicalLearningFactIdentity,
): LearningFactWriteRow[] {
  return rows.map((row) => ({
    ...row,
    knowledgeIdentityNamespace: 'CANONICAL' as const,
    canonicalObjectId: identity.canonicalObjectId,
    aggregateReleaseSetId: identity.aggregateReleaseSetId,
    aggregateReleaseId: identity.aggregateReleaseId,
    knowledgeProjectionId: identity.knowledgeProjectionId,
    knowledgeRevisionRef: identity.knowledgeRevisionRef,
    sourceEventId: row.sourceEventId ?? identity.sourceEventId,
    sourceLogId: row.sourceLogId ?? identity.sourceLogId,
  }));
}

export function stampLegacyIdentityOnRows(
  rows: readonly LearningFactWriteRow[],
  knowledgeRevisionRef: string | null,
): LearningFactWriteRow[] {
  return rows.map((row) => {
    const context = readContextRecord(row.contextJson);
    const nextContext = knowledgeRevisionRef
      ? {
          ...context,
          knowledgeRevisionRef,
        }
      : context;
    return {
      ...row,
      knowledgeIdentityNamespace: 'LEGACY' as const,
      canonicalObjectId: null,
      aggregateReleaseSetId: null,
      aggregateReleaseId: null,
      knowledgeProjectionId: null,
      knowledgeRevisionRef: knowledgeRevisionRef,
      contextJson: Object.keys(nextContext).length > 0 ? nextContext : row.contextJson,
    };
  });
}
