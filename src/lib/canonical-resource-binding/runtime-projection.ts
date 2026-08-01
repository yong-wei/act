import type { RuntimeResourceProjectionInput } from '@/lib/resource-node-registry';

import type { ResourceInventoryObservation } from './contracts';
import { buildAtomicResourceId, canonicalSha256, normalizeSha256 } from './inventory';

const EVIDENCE_FIELDS = [
  'eventSource',
  'eventType',
  'clientEventIdPolicy',
  'attemptKey',
  'sourceLogId',
  'dedupeKey',
  'timestamps',
  'confidencePolicy',
  'privacyScope',
] as const;

function hasCompleteEvidenceContract(
  projection: RuntimeResourceProjectionInput,
): boolean {
  const contract = projection.evidenceContract;
  return contract?.complete === true
    && (contract.missingFields?.length ?? 0) === 0
    && EVIDENCE_FIELDS.every((field) => contract[field] === true)
    && contract.learningFactMaterializationPolicy !== 'missing';
}

function isAuditedPathTarget(projection: RuntimeResourceProjectionInput): boolean {
  const sourceHash = normalizeSha256(projection.sourceHash);
  const reviewedHash = normalizeSha256(projection.reviewAudit?.reviewedSourceHash);
  return projection.pathEligibility?.current === true
    && (projection.pathEligibility.blockedBy?.length ?? 0) === 0
    && Boolean(projection.routeTarget || projection.renderTarget)
    && projection.reviewAudit?.status === 'human-confirmed'
    && sourceHash !== null
    && reviewedHash === sourceHash
    && projection.reviewConcluded !== false
    && projection.semanticConfirmed !== false;
}

export function runtimeProjectionObservation(input: {
  projection: RuntimeResourceProjectionInput;
  captureRevision: string;
  capturedAt: string;
  dbWatermark: string;
}): ResourceInventoryObservation {
  const { projection } = input;
  const structuralUnitId = projection.id;
  const segmentId = projection.sourceRecord ?? `${projection.id}:base`;
  const sourceHash = normalizeSha256(projection.sourceHash);
  const pathEligible = isAuditedPathTarget(projection);
  const evidenceProducing = hasCompleteEvidenceContract(projection)
    && projection.evidenceContract?.learningFactPolicy === true;
  const auditOnly = projection.lifecycleScope === 'audit-only';
  return {
    sourceObservationId: `runtime-projection:${projection.id}`,
    sourceKind: 'runtime_resource_projection',
    sourceAvailable: sourceHash !== null,
    captureRevision: input.captureRevision,
    capturedAt: input.capturedAt,
    dbWatermark: input.dbWatermark,
    atomicResourceId: buildAtomicResourceId({
      sourceKind: 'runtime_resource_projection',
      resourceId: projection.resourceNodeId ?? projection.id,
      structuralUnitId,
    }),
    resourceId: projection.resourceNodeId ?? projection.id,
    structuralUnitId,
    segmentId,
    resourceSegmentHash: sourceHash ?? canonicalSha256({
      id: projection.id,
      sourceKind: projection.sourceKind,
      sourceRef: projection.sourceRef,
      sourceVersionRef: projection.sourceVersionRef,
    }),
    positiveSignals: { pathEligible, evidenceProducing },
    exclusionSignals: { auditOnly },
    teacherOnly: projection.teacherPolicy === 'teacher-only',
    dispositionDeclared: pathEligible || evidenceProducing || auditOnly,
  };
}
