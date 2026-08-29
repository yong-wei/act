/**
 * Rebuild published domain-teaching fragments against the live successor
 * Authority snapshot. Authoring composed-manifest is the live destination.
 */

import { LatestAuthorityCutoverError } from './contracts';
import {
  buildDomainTeachingFragment,
  composeDomainTeachingProjection,
  createDomainTeachingAuthorityEnvelope,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingComposedArtifacts,
  type DomainTeachingFragmentAuthoring,
  type DomainFragmentAuthorityBindingComplete,
} from '@/lib/teaching-projection';
import type { AuthorityNodeIndexEntry } from '@/lib/teaching-projection/contracts';

export const LIVE_AUTHORING_COMPOSED_MANIFEST_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/composed-manifest.json' as const;

export const GENERATION_3_AUTHORING_RELATIVES = [
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/foundation-fragment.authoring.json',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/foundation-three-domain-fragment.authoring.json',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/classical-fragment.authoring.json',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/modern-discrete-time.authoring.json',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/modern-state-space.authoring.json',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/cross-domain.authoring.json',
] as const;

export const GENERATION_3_PUBLISHED_RELATIVE_BY_FRAGMENT_KEY: Record<string, string> = {
  'foundation-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/foundation-fragment.json',
  'foundation-three-domain-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/foundation-three-domain-fragment.json',
  'classical-control-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/classical-fragment.json',
  'modern-discrete-time-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/modern-discrete-time.json',
  'modern-state-space-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/modern-state-space.json',
  'cross-domain-v1':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/cross-domain.json',
};

export const GENERATION_3_AUTHORING_RELATIVE_BY_FRAGMENT_KEY: Record<string, string> = {
  'foundation-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/foundation-fragment.authoring.json',
  'foundation-three-domain-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/foundation-three-domain-fragment.authoring.json',
  'classical-control-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/classical-fragment.authoring.json',
  'modern-discrete-time-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/modern-discrete-time.authoring.json',
  'modern-state-space-published-v3':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/modern-state-space.authoring.json',
  'cross-domain-v1':
    'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3/cross-domain.authoring.json',
};

export interface SuccessorAuthorityManifestBinding {
  readonly snapshotId: string;
  readonly snapshotHash: string;
  readonly releaseId: string;
  readonly releaseSetId: string;
  readonly sourceDatasetHash: string;
  readonly captureRevision: string;
}

export interface SuccessorEngineeringObject {
  readonly canonicalId?: string;
  readonly reviewStatus?: string | null;
  readonly publicationStatus?: string | null;
  readonly lifecycleStatus?: string | null;
  readonly payload?: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function successorCanonicalId(payload: unknown): string | null {
  const outer = record(payload);
  const nested = record(outer.payload);
  const candidates = [
    outer.successorCanonicalId,
    outer.successor_canonical_id,
    nested.successorCanonicalId,
    nested.successor_canonical_id,
  ];
  return candidates.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  ) ?? null;
}

export function successorAuthorityBinding(
  manifest: SuccessorAuthorityManifestBinding,
): DomainFragmentAuthorityBindingComplete {
  if (
    !/^snap-[a-f0-9]{64}$/u.test(manifest.snapshotId)
    || manifest.snapshotHash !== manifest.snapshotId.slice('snap-'.length)
  ) {
    throw new LatestAuthorityCutoverError(
      'successor-authority-invalid',
      'successor Authority snapshot identity is invalid',
    );
  }
  if (!manifest.releaseId || !manifest.releaseSetId) {
    throw new LatestAuthorityCutoverError(
      'successor-authority-invalid',
      'successor Authority release identity is incomplete',
    );
  }
  return {
    releaseId: manifest.releaseId,
    releaseSetId: manifest.releaseSetId,
    snapshotId: manifest.snapshotId,
    snapshotHash: manifest.snapshotHash,
  };
}

export function authoringEndpointIds(
  authoring: DomainTeachingFragmentAuthoring,
): string[] {
  const ids = new Set<string>();
  for (const node of authoring.coreNodes) ids.add(node.canonicalId);
  for (const relation of authoring.relations) {
    ids.add(relation.sourceNodeId);
    ids.add(relation.targetNodeId);
  }
  return [...ids].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function isLiveEngineeringObject(object: SuccessorEngineeringObject): boolean {
  if (object.reviewStatus !== 'approved' || object.publicationStatus !== 'published') {
    return false;
  }
  return (
    object.lifecycleStatus === null
    || object.lifecycleStatus === undefined
    || object.lifecycleStatus === 'active'
  );
}

export function assertAuthoringEndpointsLiveInSuccessor(
  authoring: DomainTeachingFragmentAuthoring,
  objects: readonly SuccessorEngineeringObject[],
): void {
  const byId = new Map<string, SuccessorEngineeringObject>();
  for (const object of objects) {
    if (typeof object.canonicalId === 'string') byId.set(object.canonicalId, object);
  }
  for (const canonicalId of authoringEndpointIds(authoring)) {
    const object = byId.get(canonicalId);
    if (!object) {
      throw new LatestAuthorityCutoverError(
        'successor-authority-missing-endpoint',
        `successor Authority is missing fragment endpoint ${canonicalId}`,
      );
    }
    if (!isLiveEngineeringObject(object)) {
      throw new LatestAuthorityCutoverError(
        'successor-authority-endpoint-not-live',
        `successor Authority endpoint ${canonicalId} is not live`,
      );
    }
  }
}

export function successorAuthorityNodesFromEngineering(
  objects: readonly SuccessorEngineeringObject[],
): AuthorityNodeIndexEntry[] {
  return objects
    .filter((object): object is SuccessorEngineeringObject & { canonicalId: string } => (
      typeof object.canonicalId === 'string'
    ))
    .map((object) => ({
      canonicalId: object.canonicalId,
      lifecycleStatus: object.lifecycleStatus ?? 'active',
      successorCanonicalId: successorCanonicalId(object.payload),
    }))
    .sort((left, right) => (
      left.canonicalId < right.canonicalId ? -1 : left.canonicalId > right.canonicalId ? 1 : 0
    ));
}

export function createSuccessorDomainTeachingEnvelope(input: {
  readonly manifest: SuccessorAuthorityManifestBinding;
  readonly authorings: readonly DomainTeachingFragmentAuthoring[];
  readonly objects: readonly SuccessorEngineeringObject[];
}): DomainTeachingAuthorityEnvelope {
  for (const authoring of input.authorings) {
    assertAuthoringEndpointsLiveInSuccessor(authoring, input.objects);
  }
  return createDomainTeachingAuthorityEnvelope({
    binding: successorAuthorityBinding(input.manifest),
    sourceDatasetHash: input.manifest.sourceDatasetHash,
    captureRevision: input.manifest.captureRevision,
    authoringRevision: input.manifest.captureRevision,
    nodes: successorAuthorityNodesFromEngineering(input.objects),
  });
}

export function rebindFragmentAuthoringToSuccessorEnvelope(
  authoring: DomainTeachingFragmentAuthoring,
  envelope: DomainTeachingAuthorityEnvelope,
): DomainTeachingFragmentAuthoring {
  const {
    authoritySelection: _selection,
    nodeIndexDigest: _digest,
    captureRevision: _capture,
    sourceDatasetHash: _source,
    sourceInventoryDigest: _inventory,
    ...rest
  } = authoring;
  return {
    ...rest,
    authorityBinding: envelope.binding,
    authoringRevision: envelope.authoringRevision,
    captureRevision: envelope.captureRevision,
    sourceDatasetHash: envelope.sourceDatasetHash,
    nodeIndexDigest: envelope.nodeIndexDigest,
  };
}

export function composeSuccessorDomainTeachingProjection(input: {
  readonly manifest: SuccessorAuthorityManifestBinding;
  readonly authorings: readonly DomainTeachingFragmentAuthoring[];
  readonly objects: readonly SuccessorEngineeringObject[];
}): DomainTeachingComposedArtifacts {
  if (input.authorings.length === 0) {
    throw new LatestAuthorityCutoverError(
      'successor-domain-fragments-empty',
      'successor domain-fragment composition requires at least one authoring fragment',
    );
  }
  const envelope = createSuccessorDomainTeachingEnvelope(input);
  const fragments = input.authorings.map((authoring) => (
    buildDomainTeachingFragment(
      rebindFragmentAuthoringToSuccessorEnvelope(authoring, envelope),
      envelope,
    )
  ));
  return composeDomainTeachingProjection({
    fragments,
    authoringRevision: envelope.authoringRevision,
    authority: envelope,
  });
}

export function assertNotProductionSelectorPath(targetPath: string): void {
  const normalized = targetPath.replaceAll('\\', '/');
  if (
    normalized.endsWith('/authority/current.json')
    || normalized.endsWith('/production-cutover-transactions/current.json')
  ) {
    throw new LatestAuthorityCutoverError(
      'successor-domain-fragments-selector-path',
      'refusing to write a production selector; authoring migration is not activation',
    );
  }
}
