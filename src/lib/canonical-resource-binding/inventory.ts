import { createHash } from 'node:crypto';

import type {
  ResourceBindingInventory,
  ResourceInventoryItem,
  ResourceInventoryObservation,
} from './contracts';

const GIT_COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalSha256(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function normalizeSha256(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.startsWith('sha256:') ? value.slice(7) : value;
  return SHA256.test(normalized) ? normalized : null;
}

export function buildAtomicResourceId(input: {
  sourceKind: string;
  resourceId: string;
  structuralUnitId: string;
  placementId?: string | null;
}): string {
  const placement = input.placementId?.trim() || 'base';
  return [
    input.sourceKind,
    input.resourceId,
    input.structuralUnitId,
    placement,
  ].map((part) => encodeURIComponent(part)).join(':');
}

function observedIdentity(observation: ResourceInventoryObservation): string {
  return canonicalJson({
    resourceId: observation.resourceId,
    structuralUnitId: observation.structuralUnitId,
    segmentId: observation.segmentId,
    resourceSegmentHash: observation.resourceSegmentHash,
  });
}

function privacySafeIdentifier(value: string): string {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(value)
    ? `redacted:${sha256(value)}`
    : value;
}

function observationProjection(observation: ResourceInventoryObservation) {
  return {
    sourceObservationId: observation.sourceObservationId,
    sourceKind: observation.sourceKind,
    sourceAvailable: observation.sourceAvailable,
    atomicResourceId: observation.atomicResourceId,
    resourceId: observation.resourceId,
    structuralUnitId: observation.structuralUnitId,
    segmentId: observation.segmentId,
    resourceSegmentHash: observation.resourceSegmentHash,
    positiveSignals: observation.positiveSignals ?? {},
    exclusionSignals: observation.exclusionSignals ?? {},
    teacherOnly: observation.teacherOnly === true,
    dispositionDeclared: observation.dispositionDeclared === true,
    placementRefs: [...new Set(observation.placementRefs ?? [])].sort(),
    publicationRevision: observation.publicationRevision ?? null,
    conflictReasonCodes: [...new Set(observation.conflictReasonCodes ?? [])].sort(),
  };
}

function classify(
  observations: ResourceInventoryObservation[],
  captureConflict: boolean,
): Pick<ResourceInventoryItem, 'disposition' | 'reasonCodes'> {
  const reasons = new Set<string>();
  for (const observation of observations) {
    for (const reason of observation.conflictReasonCodes ?? []) reasons.add(reason);
  }
  if (captureConflict) reasons.add('capture-identity-conflict');
  if (observations.some((row) => !row.sourceAvailable)) reasons.add('source-unavailable');
  if (new Set(observations.map(observedIdentity)).size !== 1) {
    reasons.add('atomic-identity-collision');
  }

  const positives = observations.flatMap((row) => Object.entries(row.positiveSignals ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([signal]) => signal));
  const exclusions = observations.flatMap((row) => Object.entries(row.exclusionSignals ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([signal]) => signal));
  const hasUndeclaredDisposition = observations.some((row) => !row.dispositionDeclared);

  if (positives.length > 0 && exclusions.length > 0) {
    reasons.add('positive-exclusion-conflict');
  }
  if (reasons.size > 0) {
    return { disposition: 'UNRESOLVED', reasonCodes: [...reasons].sort() };
  }
  if (positives.length > 0) {
    return {
      disposition: 'INCLUDED',
      reasonCodes: [...new Set(positives.map((signal) => `positive:${signal}`))].sort(),
    };
  }
  if (exclusions.length > 0) {
    return {
      disposition: 'EXCLUDED',
      reasonCodes: [...new Set(exclusions.map((signal) => `excluded:${signal}`))].sort(),
    };
  }
  if (hasUndeclaredDisposition || observations.length > 0) {
    return { disposition: 'UNRESOLVED', reasonCodes: ['missing-disposition'] };
  }
  return { disposition: 'UNRESOLVED', reasonCodes: ['missing-source-observation'] };
}

export function buildResourceBindingInventory(
  observations: readonly ResourceInventoryObservation[],
): ResourceBindingInventory {
  if (observations.length === 0) {
    throw new Error('resource binding inventory requires at least one source observation');
  }
  for (const observation of observations) {
    if (!GIT_COMMIT.test(observation.captureRevision)) {
      throw new Error(`invalid capture revision for ${observation.sourceObservationId}`);
    }
    if (!SHA256.test(observation.resourceSegmentHash)) {
      throw new Error(`invalid resource segment hash for ${observation.sourceObservationId}`);
    }
  }

  const captureRevisions = [...new Set(observations.map((row) => row.captureRevision))];
  const capturedAts = [...new Set(observations.map((row) => row.capturedAt))];
  const dbWatermarks = [...new Set(observations.map((row) => row.dbWatermark))];
  const captureConflict = (
    captureRevisions.length !== 1
    || capturedAts.length !== 1
    || dbWatermarks.length !== 1
  );
  const grouped = new Map<string, ResourceInventoryObservation[]>();
  for (const observation of observations) {
    const rows = grouped.get(observation.atomicResourceId) ?? [];
    rows.push(observation);
    grouped.set(observation.atomicResourceId, rows);
  }

  const items = [...grouped.entries()].map(([atomicResourceId, rows]) => {
    const orderedRows = [...rows].sort((left, right) => (
      left.sourceObservationId.localeCompare(right.sourceObservationId)
    ));
    const representative = orderedRows[0]!;
    const classification = classify(orderedRows, captureConflict);
    return {
      atomicResourceId,
      resourceId: representative.resourceId,
      structuralUnitId: representative.structuralUnitId,
      segmentId: representative.segmentId,
      resourceSegmentHash: representative.resourceSegmentHash,
      ...classification,
      sourceObservations: orderedRows.map((row) => ({
        sourceObservationId: privacySafeIdentifier(row.sourceObservationId),
        sourceKind: row.sourceKind,
        sourceAvailable: row.sourceAvailable,
        observedIdentityDigest: sha256(observedIdentity(row)),
        positiveSignals: Object.entries(row.positiveSignals ?? {})
          .filter(([, enabled]) => enabled === true)
          .map(([signal]) => signal)
          .sort(),
        exclusionSignals: Object.entries(row.exclusionSignals ?? {})
          .filter(([, enabled]) => enabled === true)
          .map(([signal]) => signal)
          .sort(),
        teacherOnly: row.teacherOnly === true,
        dispositionDeclared: row.dispositionDeclared === true,
        placementRefs: [...new Set(row.placementRefs ?? [])].sort(),
        publicationRevisionDigest: row.publicationRevision
          ? canonicalSha256(row.publicationRevision)
          : null,
      })),
      observationDigest: sha256(canonicalJson(orderedRows.map(observationProjection))),
    } satisfies ResourceInventoryItem;
  }).sort((left, right) => left.atomicResourceId.localeCompare(right.atomicResourceId));

  const summary = {
    itemCount: items.length,
    includedCount: items.filter((row) => row.disposition === 'INCLUDED').length,
    excludedCount: items.filter((row) => row.disposition === 'EXCLUDED').length,
    unresolvedCount: items.filter((row) => row.disposition === 'UNRESOLVED').length,
  };
  const captureRevision = captureRevisions.length === 1 ? captureRevisions[0]! : '0'.repeat(40);
  const capturedAt = capturedAts.length === 1 ? capturedAts[0]! : new Date(0).toISOString();
  const dbWatermark = dbWatermarks.length === 1 ? dbWatermarks[0]! : 'conflict';
  const sourceHash = sha256(canonicalJson(items));

  return {
    schemaVersion: 'canonical-resource-binding-inventory/v1',
    runId: `resource-binding-inventory:${captureRevision}:${sourceHash}`,
    captureRevision,
    capturedAt,
    dbWatermark,
    sourceHash,
    complete: true,
    // This change intentionally cannot activate Canonical authority.
    cutoverReady: false,
    authorityState: 'SHADOW',
    summary,
    items,
  };
}

export function toPublicResourceBindingInventory(
  inventory: ResourceBindingInventory,
): ResourceBindingInventory {
  return {
    ...inventory,
    items: inventory.items.map((item) => ({
      atomicResourceId: item.atomicResourceId,
      resourceId: item.resourceId,
      structuralUnitId: item.structuralUnitId,
      segmentId: item.segmentId,
      resourceSegmentHash: item.resourceSegmentHash,
      disposition: item.disposition,
      reasonCodes: [...item.reasonCodes],
      sourceObservations: item.sourceObservations.map((observation) => ({
        ...observation,
        positiveSignals: [...observation.positiveSignals],
        exclusionSignals: [...observation.exclusionSignals],
        placementRefs: [...observation.placementRefs],
      })),
      observationDigest: item.observationDigest,
    })),
  };
}
