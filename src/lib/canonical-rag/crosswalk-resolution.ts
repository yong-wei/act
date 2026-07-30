import { membershipMatchesContext } from './context-fingerprint';
import type {
  ActStructuralCitationTarget,
  CanonicalRagReleaseContext,
  CrosswalkResolutionDiagnostic,
  CrosswalkResolutionOutcome,
  UpstreamRagReferenceSeed,
  VersionBoundCrosswalk,
} from './contracts';
import type { ActStructuralUnitCrosswalkRecord } from '@/lib/aggregate-governance/contracts';

function tripleKey(upstream: UpstreamRagReferenceSeed): string {
  return [
    upstream.publishedEntityId,
    upstream.retrievalChunkId,
    upstream.citationTargetId,
  ].join('\u001f');
}

export function isCompleteValidatedCrosswalk(
  row: ActStructuralUnitCrosswalkRecord,
): boolean {
  return (
    row.validationState === 'VALIDATED'
    && row.lifecycleState === 'CURRENT'
    && nonEmpty(row.canonicalId)
    && nonEmpty(row.structuralUnitId)
    && nonEmpty(row.structuralUnitVersion)
    && nonEmpty(row.structuralUnitHash)
    && nonEmpty(row.retrievalChunkId)
    && nonEmpty(row.citationTargetId)
    && nonEmpty(row.sourceEditionId)
    && nonEmpty(row.sourceVersion)
    && nonEmpty(row.evidenceContentHash)
    && nonEmpty(row.inventoryRunId)
    && nonEmpty(row.atomicResourceId)
    && nonEmpty(row.resourceId)
    && nonEmpty(row.segmentId)
    && nonEmpty(row.resourceSegmentHash)
    && nonEmpty(row.captureRevision)
    && nonEmpty(row.deltaReceiptId)
    && nonEmpty(row.releaseSetId)
    && nonEmpty(row.releaseId)
  );
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const ENDPOINT_FIELDS = [
  'structuralUnitId',
  'structuralUnitVersion',
  'structuralUnitHash',
  'retrievalChunkId',
  'citationTargetId',
  'sourceEditionId',
  'sourceVersion',
  'evidenceContentHash',
  'inventoryRunId',
  'atomicResourceId',
  'resourceId',
  'segmentId',
  'resourceSegmentHash',
  'captureRevision',
] as const;

export function matchStructuralEndpoint(
  row: ActStructuralUnitCrosswalkRecord,
  unit: ActStructuralCitationTarget,
): { ok: true } | { ok: false; field: string; expected: string; actual: string | null } {
  if (unit.observationSource === ('crosswalk-copy' as string)) {
    return {
      ok: false,
      field: 'observationSource',
      expected: 'derived-from-independent-observations',
      actual: 'crosswalk-copy',
    };
  }
  for (const field of ENDPOINT_FIELDS) {
    const expected = row[field];
    const actual = unit[field];
    if (!nonEmpty(expected) || expected !== actual) {
      return {
        ok: false,
        field,
        expected: expected ?? '(missing)',
        actual: actual ?? null,
      };
    }
  }
  return { ok: true };
}

/**
 * Resolve upstream through a version-bound Crosswalk wrapper against an
 * independently derived structural target. Seeds only — not final citations.
 */
export function resolveUpstreamThroughActCrosswalk(input: {
  upstream: UpstreamRagReferenceSeed;
  crosswalks: readonly VersionBoundCrosswalk[];
  structuralUnits: readonly ActStructuralCitationTarget[];
  release: CanonicalRagReleaseContext;
}): CrosswalkResolutionOutcome {
  const diagnostics: CrosswalkResolutionDiagnostic[] = [];
  const { upstream } = input;

  if (!upstream.context) {
    diagnostics.push({
      code: 'missing-upstream-context',
      publishedEntityId: upstream.publishedEntityId,
      message: 'Upstream seed requires mandatory complete context fingerprint',
    });
    return {
      status: 'version-mismatch',
      upstream,
      crosswalk: null,
      structuralTarget: null,
      diagnostics,
    };
  }
  if (!membershipMatchesContext(upstream.context, input.release)) {
    diagnostics.push({
      code: 'version-mismatch',
      publishedEntityId: upstream.publishedEntityId,
      message: 'Upstream seed context fingerprint does not match closed candidate context',
    });
    diagnostics.push(legacyForbidden(upstream.publishedEntityId));
    return {
      status: 'version-mismatch',
      upstream,
      crosswalk: null,
      structuralTarget: null,
      diagnostics,
    };
  }

  if (upstream.canonicalId === null) {
    diagnostics.push({
      code: 'upstream-not-object',
      publishedEntityId: upstream.publishedEntityId,
      retrievalChunkId: upstream.retrievalChunkId,
      citationTargetId: upstream.citationTargetId,
      message: 'Upstream RAG reference is not a Canonical Object seed',
    });
    return {
      status: 'upstream-not-object',
      upstream,
      crosswalk: null,
      structuralTarget: null,
      diagnostics,
    };
  }

  const matching = input.crosswalks.filter((wrapped) => (
    membershipMatchesContext(wrapped, input.release)
    && wrapped.row.publishedEntityId === upstream.publishedEntityId
    && wrapped.row.retrievalChunkId === upstream.retrievalChunkId
    && wrapped.row.citationTargetId === upstream.citationTargetId
  ));

  if (matching.length === 0) {
    diagnostics.push({
      code: 'missing-crosswalk',
      publishedEntityId: upstream.publishedEntityId,
      retrievalChunkId: upstream.retrievalChunkId,
      citationTargetId: upstream.citationTargetId,
      canonicalId: upstream.canonicalId ?? null,
      message: 'No version-bound ACT Crosswalk for upstream RAG triple',
    });
    diagnostics.push(legacyForbidden(upstream.publishedEntityId));
    return {
      status: 'missing-crosswalk',
      upstream,
      crosswalk: null,
      structuralTarget: null,
      diagnostics,
    };
  }

  const identityOk = matching.filter((wrapped) => (
    !upstream.canonicalId
    || wrapped.row.canonicalId === upstream.canonicalId
  ));
  if (identityOk.length === 0) {
    diagnostics.push({
      code: 'endpoint-mismatch',
      field: 'canonicalId',
      publishedEntityId: upstream.publishedEntityId,
      canonicalId: upstream.canonicalId ?? null,
      message: 'Crosswalk canonicalId does not match upstream seed canonical object',
    });
    diagnostics.push(legacyForbidden(upstream.publishedEntityId));
    return {
      status: 'endpoint-mismatch',
      upstream,
      crosswalk: matching[0] ?? null,
      structuralTarget: null,
      diagnostics,
    };
  }

  const validated = identityOk.filter((wrapped) => isCompleteValidatedCrosswalk(wrapped.row));
  if (validated.length === 0) {
    diagnostics.push({
      code: 'drifted-crosswalk',
      publishedEntityId: upstream.publishedEntityId,
      retrievalChunkId: upstream.retrievalChunkId,
      citationTargetId: upstream.citationTargetId,
      message:
        'Crosswalk is present but not CURRENT VALIDATED with complete non-null ACT endpoints',
    });
    diagnostics.push(legacyForbidden(upstream.publishedEntityId));
    return {
      status: 'drifted-crosswalk',
      upstream,
      crosswalk: identityOk[0] ?? null,
      structuralTarget: null,
      diagnostics,
    };
  }

  const crosswalk = [...validated].sort((a, b) => a.row.id.localeCompare(b.row.id))[0]!;
  const row = crosswalk.row;

  const endpointMatches: ActStructuralCitationTarget[] = [];
  for (const unit of input.structuralUnits) {
    if (!membershipMatchesContext(unit, input.release)) continue;
    const match = matchStructuralEndpoint(row, unit);
    if (match.ok) endpointMatches.push(unit);
  }

  if (endpointMatches.length === 0) {
    const partial = input.structuralUnits.find((unit) => (
      unit.structuralUnitId === row.structuralUnitId
    ));
    if (partial) {
      const mismatch = matchStructuralEndpoint(row, partial);
      diagnostics.push({
        code: 'endpoint-mismatch',
        field: mismatch.ok ? null : mismatch.field,
        publishedEntityId: upstream.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
        canonicalId: row.canonicalId,
        message: mismatch.ok
          ? 'Structural unit endpoint identity mismatch'
          : `Structural unit endpoint mismatch on ${mismatch.field}: expected ${mismatch.expected}, actual ${mismatch.actual ?? '(missing)'}`,
      });
      diagnostics.push(legacyForbidden(upstream.publishedEntityId));
      return {
        status: 'endpoint-mismatch',
        upstream,
        crosswalk,
        structuralTarget: null,
        diagnostics,
      };
    }
    diagnostics.push({
      code: 'unreadable-structural-unit',
      publishedEntityId: upstream.publishedEntityId,
      retrievalChunkId: row.retrievalChunkId,
      citationTargetId: row.citationTargetId,
      canonicalId: row.canonicalId,
      message: 'No independently derived structural unit with exact Crosswalk endpoint identity',
    });
    return {
      status: 'unreadable-structural-unit',
      upstream,
      crosswalk,
      structuralTarget: null,
      diagnostics,
    };
  }

  const structuralTarget = [...endpointMatches]
    .sort((a, b) => a.structuralUnitId.localeCompare(b.structuralUnitId))[0]!;

  if (!structuralTarget.readable) {
    diagnostics.push({
      code: 'unreadable-structural-unit',
      publishedEntityId: upstream.publishedEntityId,
      retrievalChunkId: structuralTarget.retrievalChunkId,
      citationTargetId: structuralTarget.citationTargetId,
      canonicalId: row.canonicalId,
      message: 'Matched structural unit is not readable for citation',
    });
    return {
      status: 'unreadable-structural-unit',
      upstream,
      crosswalk,
      structuralTarget: null,
      diagnostics,
    };
  }

  return {
    status: 'resolved',
    upstream,
    crosswalk,
    structuralTarget,
    diagnostics: [],
  };
}

export function resolveUpstreamSeeds(input: {
  seeds: readonly UpstreamRagReferenceSeed[];
  crosswalks: readonly VersionBoundCrosswalk[];
  structuralUnits: readonly ActStructuralCitationTarget[];
  release: CanonicalRagReleaseContext;
}): CrosswalkResolutionOutcome[] {
  const seen = new Set<string>();
  const outcomes: CrosswalkResolutionOutcome[] = [];
  for (const upstream of input.seeds) {
    const key = tripleKey(upstream);
    if (seen.has(key)) continue;
    seen.add(key);
    outcomes.push(resolveUpstreamThroughActCrosswalk({
      upstream,
      crosswalks: input.crosswalks,
      structuralUnits: input.structuralUnits,
      release: input.release,
    }));
  }
  return outcomes;
}

function legacyForbidden(publishedEntityId: string): CrosswalkResolutionDiagnostic {
  return {
    code: 'legacy-fallback-forbidden',
    publishedEntityId,
    message: 'Crosswalk failure must not resolve through Legacy knowledge',
  };
}
