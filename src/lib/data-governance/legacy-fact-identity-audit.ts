/**
 * Historical LearningFact identity audit and zero-weight isolation (#2084).
 * Does not write CANONICAL identity columns or mint new facts.
 */

import {
  buildLearningFactCrosswalkIndex,
  resolveHistoricalLearningFactDisplayContext,
  type LearningFactCrosswalkIndex,
} from '@/lib/canonical-learning-fact-identity/crosswalk-serving';
import {
  projectLearningFactServingIdentity,
  type LearningFactServingRecord,
} from '@/lib/canonical-learning-fact-identity/serving';
import type { LegacyIdCrosswalkEntry } from '@/lib/teaching-projection/migration-contracts';
import type { LearnerFactTransitionDraft } from './cumulative-learner-state';

export const UNRECOVERABLE_IDENTITY_POLICY = 'unrecoverable_identity_isolated';
export const IDENTITY_AUDIT_RULES = 'serving-projection+legacy-crosswalk/v1';

export type IdentityAuditClass = 'mappable' | 'legacy_only' | 'undetermined';

export interface IdentityAuditFact extends LearningFactServingRecord {
  userId?: string;
  sourceEventId?: string | null;
}

export interface IdentityAuditRow {
  factId: string;
  classification: IdentityAuditClass;
  reason: string;
  identityNamespace: ReturnType<typeof projectLearningFactServingIdentity>['identityNamespace'];
  knowledgeRevisionRef: string;
  displayCanonicalIds: string[];
  unresolvedLegacyIds: string[];
  isolated: boolean;
}

export interface IdentityAuditReport {
  userId: string;
  mode: 'audit' | 'isolate' | 'restore';
  rules: typeof IDENTITY_AUDIT_RULES;
  executionRevision: string;
  input: { factCount: number; crosswalkEntries: number };
  rows: IdentityAuditRow[];
  counts: {
    mappable: number;
    legacy_only: number;
    undetermined: number;
    isolated: number;
    anomalies: number;
  };
  anomalies: Array<{ factId: string; message: string }>;
  writes: number;
  countsBefore?: IdentityAuditReport['counts'];
}

export function resolveAuditExecutionRevision(options: {
  requireCapture?: boolean;
  gitHead?: string | null;
} = {}): string {
  const captured = process.env.APP_REVISION?.trim()
    || process.env.GIT_SHA?.trim()
    || options.gitHead?.trim()
    || '';
  if (captured) return captured;
  if (options.requireCapture) {
    throw new Error('identity-audit-missing-execution-revision');
  }
  return 'unspecified-local';
}

function toCrosswalkIndex(
  crosswalk?: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[],
): LearningFactCrosswalkIndex {
  if (!crosswalk) return buildLearningFactCrosswalkIndex([]);
  if ('byLegacyId' in crosswalk) return crosswalk;
  return buildLearningFactCrosswalkIndex(crosswalk);
}

type IsolationWrite = {
  factId: string;
  nextContext: Record<string, unknown>;
  transition: LearnerFactTransitionDraft;
};

export function isolationSourceReference(factId: string): string {
  return `identity-isolation:${factId}`;
}

export function restoreSourceReference(factId: string): string {
  return `identity-isolation-restore:${factId}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function evidenceGovernance(contextJson: unknown): Record<string, unknown> {
  return asRecord(asRecord(contextJson).evidenceGovernance);
}

export function isIdentityIsolated(contextJson: unknown): boolean {
  const governance = evidenceGovernance(contextJson);
  const isolation = asRecord(governance.identityIsolation);
  return governance.policyReason === UNRECOVERABLE_IDENTITY_POLICY
    || isolation.isolated === true;
}

export function classifyLearningFactIdentity(
  fact: IdentityAuditFact,
  crosswalk: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[],
): IdentityAuditRow {
  const index = Array.isArray(crosswalk)
    ? buildLearningFactCrosswalkIndex(crosswalk)
    : crosswalk as LearningFactCrosswalkIndex;
  const serving = projectLearningFactServingIdentity(fact);
  const display = resolveHistoricalLearningFactDisplayContext({
    fact,
    servingIdentity: serving,
    crosswalk: index,
  });

  let classification: IdentityAuditClass;
  let reason: string;
  if (serving.identityNamespace === 'CANONICAL') {
    classification = 'mappable';
    reason = 'canonical_identity_present';
  } else if (display.crosswalkApplied) {
    classification = 'mappable';
    reason = 'legacy_crosswalk_resolved';
  } else if (serving.identityNamespace === 'LEGACY') {
    classification = 'legacy_only';
    reason = 'legacy_revision_without_crosswalk';
  } else {
    classification = 'undetermined';
    reason = serving.identityNamespace === 'LEGACY_UNVERSIONED'
      ? 'missing_namespace_or_revision'
      : 'unknown_namespace';
  }

  return {
    factId: fact.id,
    classification,
    reason,
    identityNamespace: serving.identityNamespace,
    knowledgeRevisionRef: serving.knowledgeRevisionRef,
    displayCanonicalIds: [...display.displayCanonicalIds],
    unresolvedLegacyIds: [...display.unresolvedLegacyIds],
    isolated: isIdentityIsolated(fact.contextJson),
  };
}

export function applyIdentityIsolationGovernance(
  contextJson: unknown,
  executionRevision: string,
): { nextContext: Record<string, unknown>; previousGovernance: Record<string, unknown>; changed: boolean } {
  const current = asRecord(contextJson);
  const previousGovernance = evidenceGovernance(current);
  if (isIdentityIsolated(current)) {
    return { nextContext: current, previousGovernance, changed: false };
  }
  return {
    previousGovernance,
    changed: true,
    nextContext: {
      ...current,
      evidenceGovernance: {
        ...previousGovernance,
        evidenceQuality: 'missing',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: UNRECOVERABLE_IDENTITY_POLICY,
        identityIsolation: {
          isolated: true,
          executionRevision,
          previousGovernance,
        },
      },
    },
  };
}

export function previousGovernanceFromIsolatedContext(contextJson: unknown): Record<string, unknown> | null {
  const stored = asRecord(asRecord(evidenceGovernance(contextJson).identityIsolation).previousGovernance);
  return Object.keys(stored).length > 0 ? stored : null;
}

export function restoreIdentityIsolationGovernance(
  contextJson: unknown,
  previousGovernance: Record<string, unknown> | null,
): { nextContext: Record<string, unknown>; changed: boolean } {
  const current = asRecord(contextJson);
  if (!isIdentityIsolated(current)) {
    return { nextContext: current, changed: false };
  }
  const recovered = previousGovernance && Object.keys(previousGovernance).length > 0
    ? previousGovernance
    : previousGovernanceFromIsolatedContext(current);
  const next = { ...current };
  if (recovered && Object.keys(recovered).length > 0) {
    next.evidenceGovernance = recovered;
  } else {
    delete next.evidenceGovernance;
  }
  return { nextContext: next, changed: true };
}

export function buildIdentityAuditReport(input: {
  userId: string;
  facts: readonly IdentityAuditFact[];
  crosswalk?: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[];
  executionRevision?: string;
  mode?: IdentityAuditReport['mode'];
  writes?: number;
  countsBefore?: IdentityAuditReport['counts'];
}): IdentityAuditReport {
  const index = toCrosswalkIndex(input.crosswalk);
  const rows = input.facts.map((fact) => classifyLearningFactIdentity(fact, index));
  const anomalies = rows.flatMap((row) => {
    if (row.identityNamespace === 'CANONICAL' && !row.knowledgeRevisionRef) {
      return [{ factId: row.factId, message: 'canonical_missing_revision' }];
    }
    return [];
  });
  return {
    userId: input.userId,
    mode: input.mode ?? 'audit',
    rules: IDENTITY_AUDIT_RULES,
    executionRevision: input.executionRevision ?? resolveAuditExecutionRevision(),
    input: {
      factCount: input.facts.length,
      crosswalkEntries: index.byLegacyId.size,
    },
    rows,
    counts: {
      mappable: rows.filter((row) => row.classification === 'mappable').length,
      legacy_only: rows.filter((row) => row.classification === 'legacy_only').length,
      undetermined: rows.filter((row) => row.classification === 'undetermined').length,
      isolated: rows.filter((row) => row.isolated).length,
      anomalies: anomalies.length,
    },
    anomalies,
    writes: input.writes ?? 0,
    ...(input.countsBefore ? { countsBefore: input.countsBefore } : {}),
  };
}

export function summarizeIdentityAuditForProfile(report: IdentityAuditReport) {
  const byNamespace = {
    LEGACY: 0,
    CANONICAL: 0,
    LEGACY_UNVERSIONED: 0,
  } as Record<'LEGACY' | 'CANONICAL' | 'LEGACY_UNVERSIONED', number>;
  const revisionRefs = new Set<string>();
  for (const row of report.rows) {
    byNamespace[row.identityNamespace] += 1;
    revisionRefs.add(row.knowledgeRevisionRef);
  }
  const mixedNamespaces = Object.values(byNamespace).filter((count) => count > 0).length > 1;
  const mixedRevisions = revisionRefs.size > 1;
  const singleVersionComparable = report.rows.length > 0 && !mixedNamespaces && !mixedRevisions;
  return {
    totalFacts: report.rows.length,
    byNamespace,
    byClass: {
      mappable: report.counts.mappable,
      legacy_only: report.counts.legacy_only,
      undetermined: report.counts.undetermined,
    },
    distinctRevisionRefs: [...revisionRefs].sort(),
    mixedNamespaces,
    mixedRevisions,
    singleVersionComparable,
    availability: report.rows.length === 0
      ? 'empty' as const
      : singleVersionComparable
        ? 'single-version' as const
        : 'mixed-version' as const,
    isolatedCount: report.counts.isolated,
    isolatedStatus: report.counts.isolated > 0 ? 'restricted' as const : 'none' as const,
    mixedVersionLimitation: singleVersionComparable
      ? null
      : report.rows.length === 0
        ? null
        : '证据跨越多个知识身份或版本，不能作为单一版本高置信度结论。',
  };
}

export function planIdentityIsolation(input: {
  userId: string;
  facts: readonly IdentityAuditFact[];
  existingSourceReferences: readonly string[];
  executionRevision: string;
  crosswalk?: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[];
}): {
  report: IdentityAuditReport;
  writes: Array<{
    factId: string;
    nextContext: Record<string, unknown>;
    transition: LearnerFactTransitionDraft;
  }>;
} {
  const existing = new Set(input.existingSourceReferences);
  const writes: IsolationWrite[] = [];
  for (const fact of input.facts) {
    const row = classifyLearningFactIdentity(fact, input.crosswalk ?? []);
    if (row.classification !== 'undetermined' || row.isolated) continue;
    const sourceReference = isolationSourceReference(fact.id);
    if (existing.has(sourceReference)) continue;
    const applied = applyIdentityIsolationGovernance(fact.contextJson, input.executionRevision);
    if (!applied.changed) continue;
    writes.push({
      factId: fact.id,
      nextContext: applied.nextContext,
      transition: {
        userId: input.userId,
        factId: fact.id,
        operation: 'UPSERT',
        occurredAt: new Date(),
        sourceReference,
        correctionOfSequence: null,
        transitionPayload: {
          kind: 'identity-isolation',
          executionRevision: input.executionRevision,
          previousGovernance: applied.previousGovernance,
        },
      },
    });
  }
  const afterFacts = input.facts.map((fact) => {
    const write = writes.find((item) => item.factId === fact.id);
    return write ? { ...fact, contextJson: write.nextContext } : fact;
  });
  return {
    writes,
    report: buildIdentityAuditReport({
      userId: input.userId,
      facts: afterFacts,
      crosswalk: input.crosswalk,
      executionRevision: input.executionRevision,
      mode: 'isolate',
      writes: writes.length,
      countsBefore: buildIdentityAuditReport({
        userId: input.userId,
        facts: input.facts,
        crosswalk: input.crosswalk,
        executionRevision: input.executionRevision,
      }).counts,
    }),
  };
}

export function planIdentityIsolationRestore(input: {
  userId: string;
  facts: readonly IdentityAuditFact[];
  previousGovernanceByFactId: ReadonlyMap<string, Record<string, unknown> | null>;
  existingSourceReferences: readonly string[];
  executionRevision: string;
  crosswalk?: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[];
}): {
  report: IdentityAuditReport;
  writes: Array<{
    factId: string;
    nextContext: Record<string, unknown>;
    transition: LearnerFactTransitionDraft;
  }>;
} {
  const existing = new Set(input.existingSourceReferences);
  const writes: IsolationWrite[] = [];
  for (const fact of input.facts) {
    if (!isIdentityIsolated(fact.contextJson)) continue;
    const sourceReference = restoreSourceReference(fact.id);
    if (existing.has(sourceReference)) continue;
    const restored = restoreIdentityIsolationGovernance(
      fact.contextJson,
      input.previousGovernanceByFactId.get(fact.id)
        ?? previousGovernanceFromIsolatedContext(fact.contextJson),
    );
    if (!restored.changed) continue;
    writes.push({
      factId: fact.id,
      nextContext: restored.nextContext,
      transition: {
        userId: input.userId,
        factId: fact.id,
        operation: 'UPSERT',
        occurredAt: new Date(),
        sourceReference,
        correctionOfSequence: null,
        transitionPayload: {
          kind: 'identity-isolation-restore',
          executionRevision: input.executionRevision,
        },
      },
    });
  }
  const afterFacts = input.facts.map((fact) => {
    const write = writes.find((item) => item.factId === fact.id);
    return write ? { ...fact, contextJson: write.nextContext } : fact;
  });
  return {
    writes,
    report: buildIdentityAuditReport({
      userId: input.userId,
      facts: afterFacts,
      crosswalk: input.crosswalk,
      executionRevision: input.executionRevision,
      mode: 'restore',
      writes: writes.length,
      countsBefore: buildIdentityAuditReport({
        userId: input.userId,
        facts: input.facts,
        crosswalk: input.crosswalk,
        executionRevision: input.executionRevision,
      }).counts,
    }),
  };
}

export function identityColumnsUnchanged(
  before: LearningFactServingRecord,
  after: LearningFactServingRecord,
): boolean {
  return before.knowledgeIdentityNamespace === after.knowledgeIdentityNamespace
    && before.canonicalObjectId === after.canonicalObjectId
    && before.aggregateReleaseSetId === after.aggregateReleaseSetId
    && before.aggregateReleaseId === after.aggregateReleaseId
    && before.knowledgeProjectionId === after.knowledgeProjectionId
    && before.knowledgeRevisionRef === after.knowledgeRevisionRef;
}
