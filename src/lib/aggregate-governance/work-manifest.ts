import type {
  CaptureIdentity,
  CrosswalkWorkItem,
  GovernanceMode,
  GovernanceWorkManifest,
  ObjectWorkItem,
  ResourceBindingWorkItem,
} from './contracts';
import { assertCaptureIdentityShape } from './capture';
import { sha256Canonical, tripleKey } from './hash';

export interface DeltaSignalLike {
  scope: string;
  identity: string;
  action: string;
  reason: string;
}

export interface BuildWorkManifestInput {
  capture: CaptureIdentity;
  /** True when a CURRENT governed coverage baseline already exists for this candidate lineage. */
  hasGovernedCoverageBaseline: boolean;
  deltaClassification: string;
  currentCanonicalIds: readonly string[];
  signals: readonly DeltaSignalLike[];
  /** Resource-side reverse index changes from #1124 inventory. */
  changedResourceSegments?: ReadonlyArray<{
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    candidateCanonicalIds?: string[];
  }>;
  priorBindingPairKeys?: readonly string[];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function packagingNoop(classification: string, signals: readonly DeltaSignalLike[]): boolean {
  return classification === 'COMPATIBLE_PACKAGING_REVISION' && signals.length === 0;
}

/**
 * Schedule governance work.
 * - No baseline → every current object is reviewed (exhaustive).
 * - Baseline exists → only Delta-affected objects/crosswalks/bindings.
 * - Packaging-only → empty work sets with packagingNoop=true.
 */
export function buildGovernanceWorkManifest(
  input: BuildWorkManifestInput,
): GovernanceWorkManifest {
  assertCaptureIdentityShape(input.capture);
  const membership = new Set(input.currentCanonicalIds);
  const isPackaging = packagingNoop(input.deltaClassification, input.signals);
  const mode: GovernanceMode = isPackaging
    ? 'packaging_noop'
    : input.hasGovernedCoverageBaseline
      ? 'incremental'
      : 'baseline';

  if (isPackaging) {
    const manifest: GovernanceWorkManifest = {
      schemaVersion: 'act-aggregate-course-resource-governance/v1',
      mode,
      capture: input.capture,
      objects: [],
      crosswalks: [],
      resourceBindings: [],
      packagingNoop: true,
      inputDigest: '',
    };
    manifest.inputDigest = sha256Canonical({
      mode: manifest.mode,
      capture: manifest.capture,
      packagingNoop: true,
      signalCount: 0,
    });
    return manifest;
  }

  const objectWork = new Map<string, ObjectWorkItem>();
  const crosswalkWork = new Map<string, CrosswalkWorkItem>();
  const bindingWork = new Map<string, ResourceBindingWorkItem>();

  const addObject = (
    canonicalId: string,
    action: ObjectWorkItem['action'],
    reason: string,
  ) => {
    const existing = objectWork.get(canonicalId);
    if (!existing) {
      objectWork.set(canonicalId, { canonicalId, action, reasons: [reason] });
      return;
    }
    if (action === 'invalidate' || existing.action === 'invalidate') {
      existing.action = 'invalidate';
    } else if (action === 'review' || existing.action === 'review') {
      existing.action = 'review';
    }
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
  };

  if (mode === 'baseline') {
    for (const canonicalId of uniqueSorted(input.currentCanonicalIds)) {
      addObject(canonicalId, 'review', 'baseline-exhaustive');
    }
  } else {
    for (const signal of input.signals) {
      if (signal.scope === 'object') {
        if (signal.action === 'invalidation' || signal.reason === 'removed') {
          addObject(signal.identity, 'invalidate', `object:${signal.reason}`);
        } else if (
          signal.reason === 'added'
          || signal.reason === 'payload_changed'
          || signal.reason === 'type_changed'
          || signal.reason === 'superseded'
        ) {
          addObject(signal.identity, 'review', `object:${signal.reason}`);
        } else if (signal.reason === 'tier_changed') {
          // Tier alone does not force semantic recomputation; revalidate identity.
          addObject(signal.identity, 'revalidate', `object:${signal.reason}`);
        }
      }
      if (signal.scope === 'crosswalk') {
        const key = signal.identity;
        const parts = key.split('\u001f');
        const publishedEntityId = parts[0] ?? key;
        const retrievalChunkId = parts[1] ?? '';
        const citationTargetId = parts[2] ?? '';
        const action: CrosswalkWorkItem['action'] =
          signal.action === 'invalidation' || signal.reason === 'removed'
            ? 'invalidate'
            : signal.reason === 'added'
              ? 'resolve'
              : 'revalidate';
        const existing = crosswalkWork.get(key);
        if (!existing) {
          crosswalkWork.set(key, {
            tripleKey: key,
            publishedEntityId,
            retrievalChunkId,
            citationTargetId,
            action,
            reasons: [`crosswalk:${signal.reason}`],
          });
        } else {
          if (action === 'invalidate') existing.action = 'invalidate';
          else if (action === 'resolve' && existing.action !== 'invalidate') {
            existing.action = 'resolve';
          }
          if (!existing.reasons.includes(`crosswalk:${signal.reason}`)) {
            existing.reasons.push(`crosswalk:${signal.reason}`);
          }
        }
        // Only Canonical Object membership may spawn coverage/binding object work.
        // Relation-type upstream published_entity_id stays crosswalk-only diagnostic.
        if (publishedEntityId && membership.has(publishedEntityId)) {
          addObject(
            publishedEntityId,
            action === 'invalidate' ? 'invalidate' : 'review',
            `crosswalk-side:${signal.reason}`,
          );
        }
      }
    }

    // Unchanged dispositions get revalidation without semantic recomputation.
    for (const canonicalId of uniqueSorted(input.currentCanonicalIds)) {
      if (!objectWork.has(canonicalId)) {
        addObject(canonicalId, 'revalidate', 'unchanged-identity');
      }
    }
  }

  for (const segment of input.changedResourceSegments ?? []) {
    const pairKey = [
      segment.resourceId,
      segment.structuralUnitId,
      segment.segmentId,
      segment.resourceSegmentHash,
    ].join('\u001f');
    bindingWork.set(pairKey, {
      pairKey,
      canonicalId: null,
      resourceId: segment.resourceId,
      structuralUnitId: segment.structuralUnitId,
      segmentId: segment.segmentId,
      action: 'invalidate',
      reasons: ['resource-segment-hash-changed'],
    });
    for (const canonicalId of segment.candidateCanonicalIds ?? []) {
      addObject(canonicalId, 'review', 'resource-side-change');
    }
  }

  // Object-side binding work for reviewed/invalidated objects.
  for (const object of objectWork.values()) {
    if (object.action === 'revalidate') {
      const pairKey = `object:${object.canonicalId}`;
      if (!bindingWork.has(pairKey)) {
        bindingWork.set(pairKey, {
          pairKey,
          canonicalId: object.canonicalId,
          resourceId: null,
          structuralUnitId: null,
          segmentId: null,
          action: 'revalidate',
          reasons: ['object-revalidation'],
        });
      }
      continue;
    }
    const pairKey = `object:${object.canonicalId}`;
    bindingWork.set(pairKey, {
      pairKey,
      canonicalId: object.canonicalId,
      resourceId: null,
      structuralUnitId: null,
      segmentId: null,
      action: object.action === 'invalidate' ? 'invalidate' : 'review',
      reasons: object.reasons.map((reason) => `from-object:${reason}`),
    });
  }

  // In baseline, every current upstream triple is a resolve candidate.
  // Caller may pre-seed crosswalk signals; otherwise leave empty for the
  // orchestration layer to expand from the accepted candidate.

  const objects = [...objectWork.values()]
    .map((row) => ({
      ...row,
      reasons: uniqueSorted(row.reasons),
    }))
    .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  const crosswalks = [...crosswalkWork.values()]
    .map((row) => ({
      ...row,
      reasons: uniqueSorted(row.reasons),
    }))
    .sort((a, b) => a.tripleKey.localeCompare(b.tripleKey));
  const resourceBindings = [...bindingWork.values()]
    .map((row) => ({
      ...row,
      reasons: uniqueSorted(row.reasons),
    }))
    .sort((a, b) => a.pairKey.localeCompare(b.pairKey));

  const manifest: GovernanceWorkManifest = {
    schemaVersion: 'act-aggregate-course-resource-governance/v1',
    mode,
    capture: input.capture,
    objects,
    crosswalks,
    resourceBindings,
    packagingNoop: false,
    inputDigest: '',
  };
  manifest.inputDigest = sha256Canonical({
    mode: manifest.mode,
    capture: manifest.capture,
    objects: manifest.objects,
    crosswalks: manifest.crosswalks,
    resourceBindings: manifest.resourceBindings.map((row) => ({
      pairKey: row.pairKey,
      action: row.action,
      reasons: row.reasons,
    })),
    packagingNoop: false,
  });
  return manifest;
}

export function expandBaselineCrosswalkWork(
  manifest: GovernanceWorkManifest,
  upstream: ReadonlyArray<{
    publishedEntityId: string;
    retrievalChunkId: string;
    citationTargetId: string;
  }>,
): GovernanceWorkManifest {
  if (manifest.mode !== 'baseline') return manifest;
  const crosswalks: CrosswalkWorkItem[] = upstream.map((row) => {
    const key = tripleKey(row);
    return {
      tripleKey: key,
      publishedEntityId: row.publishedEntityId,
      retrievalChunkId: row.retrievalChunkId,
      citationTargetId: row.citationTargetId,
      action: 'resolve' as const,
      reasons: ['baseline-exhaustive'],
    };
  }).sort((a, b) => a.tripleKey.localeCompare(b.tripleKey));
  const next: GovernanceWorkManifest = {
    ...manifest,
    crosswalks,
    inputDigest: '',
  };
  next.inputDigest = sha256Canonical({
    mode: next.mode,
    capture: next.capture,
    objects: next.objects,
    crosswalks: next.crosswalks,
    resourceBindings: next.resourceBindings.map((row) => ({
      pairKey: row.pairKey,
      action: row.action,
      reasons: row.reasons,
    })),
    packagingNoop: false,
  });
  return next;
}
