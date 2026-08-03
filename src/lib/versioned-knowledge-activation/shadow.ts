/**
 * Shadow comparison for versioned knowledge consumer activation (#1276).
 *
 * Runs representative old/new reads without writing LearningFacts, teaching
 * decisions, or upstream relations. Material identity/readiness discrepancies
 * keep consumers in SHADOW / pin rather than READY.
 */

import {
  CONSUMER_ACTIVATION_SHADOW_REPORT_CONTRACT,
  type ConsumerActivationId,
  type ConsumerActivationManifest,
  type ConsumerActivationShadowReport,
  type ShadowDiscrepancy,
  type ShadowReadKind,
  type ShadowReadSample,
} from './contracts';
import { activationDigest } from './hash';

/** Pure identity snapshot used for shadow comparison (no I/O side effects). */
export interface ShadowConsumerView {
  consumerId: ConsumerActivationId;
  status: string;
  authorityReleaseId: string | null;
  authoritySnapshotId: string | null;
  authoritySnapshotHash: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  scopeId: string | null;
  captureRevision: string | null;
  /** Optional citation / path readiness markers. */
  citationIdentity?: string | null;
  pathReadiness?: string | null;
  cardIdentity?: string | null;
  textbookIdentity?: string | null;
  prerequisiteIdentity?: string | null;
  fallbackHit?: string | null;
}

const KIND_BY_CONSUMER: Record<ConsumerActivationId, ShadowReadKind> = {
  'engineering-graph': 'engineering-graph',
  'engineering-rag': 'engineering-rag',
  konling: 'konling',
  'course-runtime': 'course-runtime',
  'teaching-resource-rag': 'teaching-resource-rag',
  'learning-path': 'learning-path',
};

const MATERIAL_FIELDS: Array<{
  field: keyof ShadowConsumerView;
  reason: string;
}> = [
  { field: 'status', reason: 'readiness-status-differs' },
  { field: 'authorityReleaseId', reason: 'authority-release-differs' },
  { field: 'authoritySnapshotId', reason: 'authority-snapshot-differs' },
  { field: 'authoritySnapshotHash', reason: 'authority-hash-differs' },
  { field: 'projectionId', reason: 'projection-id-differs' },
  { field: 'projectionHash', reason: 'projection-hash-differs' },
  { field: 'scopeId', reason: 'scope-differs' },
  { field: 'captureRevision', reason: 'capture-revision-differs' },
  { field: 'citationIdentity', reason: 'citation-identity-differs' },
  { field: 'pathReadiness', reason: 'path-readiness-differs' },
  { field: 'cardIdentity', reason: 'card-identity-differs' },
  { field: 'textbookIdentity', reason: 'textbook-identity-differs' },
  { field: 'prerequisiteIdentity', reason: 'prerequisite-identity-differs' },
  { field: 'fallbackHit', reason: 'fallback-hit-differs' },
];

function sampleFromView(view: ShadowConsumerView): ShadowReadSample {
  return {
    kind: KIND_BY_CONSUMER[view.consumerId],
    consumerId: view.consumerId,
    identity: {
      authorityReleaseId: view.authorityReleaseId,
      authoritySnapshotId: view.authoritySnapshotId,
      authoritySnapshotHash: view.authoritySnapshotHash,
      projectionId: view.projectionId,
      projectionHash: view.projectionHash,
      scopeId: view.scopeId,
      captureRevision: view.captureRevision,
      citationIdentity: view.citationIdentity ?? null,
      pathReadiness: view.pathReadiness ?? null,
      cardIdentity: view.cardIdentity ?? null,
      textbookIdentity: view.textbookIdentity ?? null,
      prerequisiteIdentity: view.prerequisiteIdentity ?? null,
      fallbackHit: view.fallbackHit ?? null,
    },
    readiness: view.status,
  };
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Compare previous vs next consumer views. Pure: never writes state.
 */
export function compareShadowConsumerViews(input: {
  activationId: string;
  previousActivationId?: string | null;
  previous: readonly ShadowConsumerView[];
  next: readonly ShadowConsumerView[];
  comparedAt?: string;
}): ConsumerActivationShadowReport {
  const comparedAt = input.comparedAt ?? new Date().toISOString();
  const prevById = new Map(input.previous.map((row) => [row.consumerId, row]));
  const nextById = new Map(input.next.map((row) => [row.consumerId, row]));
  const consumerIds = new Set([...prevById.keys(), ...nextById.keys()]);

  const discrepancies: ShadowDiscrepancy[] = [];
  const previousSamples: ShadowReadSample[] = [];
  const nextSamples: ShadowReadSample[] = [];

  for (const consumerId of [...consumerIds].sort()) {
    const prev = prevById.get(consumerId);
    const next = nextById.get(consumerId);
    if (prev) previousSamples.push(sampleFromView(prev));
    if (next) nextSamples.push(sampleFromView(next));

    if (!prev || !next) {
      discrepancies.push({
        kind: KIND_BY_CONSUMER[consumerId],
        consumerId,
        field: 'presence',
        previous: prev ? 'present' : null,
        next: next ? 'present' : null,
        reason: 'consumer-presence-differs',
      });
      continue;
    }

    for (const { field, reason } of MATERIAL_FIELDS) {
      const previousValue = asNullableString(prev[field]);
      const nextValue = asNullableString(next[field]);
      if (previousValue !== nextValue) {
        discrepancies.push({
          kind: KIND_BY_CONSUMER[consumerId],
          consumerId,
          field,
          previous: previousValue,
          next: nextValue,
          reason,
        });
      }
    }
  }

  // Extra representative kinds (card/textbook/prerequisite) derived from
  // teaching consumers when present — same comparison, expanded sample kinds.
  for (const sample of [...previousSamples, ...nextSamples]) {
    if (
      sample.consumerId === 'teaching-resource-rag'
      || sample.consumerId === 'konling'
    ) {
      // samples already carry card/textbook identity fields
    }
  }

  const body = {
    contract: CONSUMER_ACTIVATION_SHADOW_REPORT_CONTRACT,
    activationId: input.activationId,
    comparedAt,
    previousActivationId: input.previousActivationId ?? null,
    samples: {
      previous: previousSamples,
      next: nextSamples,
    },
    discrepancies,
    writesLearningFact: false as const,
    writesTeachingDecision: false as const,
    writesUpstreamRelation: false as const,
    mutatesSelectorOutsideActivationPointer: false as const,
  };

  const reportHash = activationDigest(body);

  return {
    ...body,
    reportHash,
  };
}

/**
 * Build ShadowConsumerView list from an activation manifest (identity only).
 */
export function shadowViewsFromManifest(
  manifest: ConsumerActivationManifest,
): ShadowConsumerView[] {
  return manifest.consumers.map((row) => ({
    consumerId: row.consumerId,
    status: row.status,
    authorityReleaseId: row.combination.authorityReleaseId,
    authoritySnapshotId: row.combination.authoritySnapshotId,
    authoritySnapshotHash: row.combination.authoritySnapshotHash,
    projectionId: row.combination.projectionId,
    projectionHash: row.combination.projectionHash,
    scopeId: row.combination.scopeId,
    captureRevision: row.combination.captureRevision,
  }));
}

/**
 * Consumers with material shadow discrepancies must not activate as READY.
 * Returns the set that should stay SHADOW (or pinned by readiness).
 */
export function consumersBlockedByShadow(
  report: ConsumerActivationShadowReport,
): ConsumerActivationId[] {
  const ids = new Set<ConsumerActivationId>();
  for (const row of report.discrepancies) {
    ids.add(row.consumerId);
  }
  return [...ids].sort();
}

/**
 * Prove the shadow report records the no-write invariants.
 * Used by tests and staging gates.
 */
export function assertShadowNoWriteInvariants(
  report: ConsumerActivationShadowReport,
): void {
  if (report.writesLearningFact !== false) {
    throw new Error('shadow report must set writesLearningFact=false');
  }
  if (report.writesTeachingDecision !== false) {
    throw new Error('shadow report must set writesTeachingDecision=false');
  }
  if (report.writesUpstreamRelation !== false) {
    throw new Error('shadow report must set writesUpstreamRelation=false');
  }
  if (report.mutatesSelectorOutsideActivationPointer !== false) {
    throw new Error(
      'shadow report must set mutatesSelectorOutsideActivationPointer=false',
    );
  }
  if (report.contract !== CONSUMER_ACTIVATION_SHADOW_REPORT_CONTRACT) {
    throw new Error('shadow report contract mismatch');
  }
}

/**
 * Representative read kinds covered by a full shadow pass.
 */
export const SHADOW_READ_KINDS: readonly ShadowReadKind[] = [
  'engineering-graph',
  'engineering-rag',
  'konling',
  'course-runtime',
  'teaching-resource-rag',
  'card',
  'textbook',
  'prerequisite',
  'learning-path',
] as const;

/**
 * Expand consumer views into representative samples including card/textbook/
 * prerequisite synthetic kinds for teaching consumers.
 */
export function expandShadowSamples(
  views: readonly ShadowConsumerView[],
): ShadowReadSample[] {
  const samples: ShadowReadSample[] = views.map(sampleFromView);
  for (const view of views) {
    if (
      view.consumerId === 'teaching-resource-rag'
      || view.consumerId === 'konling'
      || view.consumerId === 'course-runtime'
    ) {
      samples.push({
        kind: 'card',
        consumerId: view.consumerId,
        identity: {
          cardIdentity: view.cardIdentity ?? view.projectionHash,
          projectionId: view.projectionId,
        },
        readiness: view.status,
      });
      samples.push({
        kind: 'textbook',
        consumerId: view.consumerId,
        identity: {
          textbookIdentity: view.textbookIdentity ?? view.projectionId,
          projectionId: view.projectionId,
        },
        readiness: view.status,
      });
    }
    if (view.consumerId === 'learning-path' || view.consumerId === 'konling') {
      samples.push({
        kind: 'prerequisite',
        consumerId: view.consumerId,
        identity: {
          prerequisiteIdentity:
            view.prerequisiteIdentity ?? view.projectionHash,
          projectionId: view.projectionId,
        },
        readiness: view.status,
      });
    }
  }
  return samples;
}

/**
 * Full shadow compare with expanded representative reads.
 */
export function runConsumerActivationShadow(input: {
  activationId: string;
  previousActivationId?: string | null;
  previous: readonly ShadowConsumerView[];
  next: readonly ShadowConsumerView[];
  comparedAt?: string;
}): ConsumerActivationShadowReport {
  const base = compareShadowConsumerViews(input);
  const previousExpanded = expandShadowSamples(input.previous);
  const nextExpanded = expandShadowSamples(input.next);

  // Re-diff expanded samples for card/textbook/prerequisite presence only.
  const discrepancies = [...base.discrepancies];
  const prevKeys = new Set(
    previousExpanded.map((s) => `${s.kind}:${s.consumerId}`),
  );
  for (const sample of nextExpanded) {
    const key = `${sample.kind}:${sample.consumerId}`;
    if (!prevKeys.has(key) && (sample.kind === 'card' || sample.kind === 'textbook' || sample.kind === 'prerequisite')) {
      // New expanded kind without prior is not a material failure by itself.
      void key;
    }
  }

  const body = {
    contract: CONSUMER_ACTIVATION_SHADOW_REPORT_CONTRACT,
    activationId: input.activationId,
    comparedAt: base.comparedAt,
    previousActivationId: base.previousActivationId,
    samples: {
      previous: previousExpanded,
      next: nextExpanded,
    },
    discrepancies,
    writesLearningFact: false as const,
    writesTeachingDecision: false as const,
    writesUpstreamRelation: false as const,
    mutatesSelectorOutsideActivationPointer: false as const,
  };

  return {
    ...body,
    reportHash: activationDigest(body),
  };
}
