import type {
  ActiveAuthorityProvenance,
  ActiveNodeResourceBindings,
} from '@/features/knowledge/active-authority-graph-contracts';
import type { KnowledgeGraphSourceKind } from '@/lib/knowledge-graph-source';
import type {
  AuthorityLearnerShard,
  AuthorityShardClass,
} from '@/lib/authority-domain-shards/contracts';
import type { KnowledgeRole } from '@/lib/authoritative-knowledge/contracts';
import type { ProjectionIdentity } from '@/lib/authoritative-knowledge/contracts';
import { GOVERNED_MATH_PRESENTATION_BUNDLE } from '@/lib/governed-math/sidecar';
import { readLearningContentManifestClassification } from './learning-content';
import { readKnowledgeSurface } from './read';
import type {
  KnowledgeSurfaceAuthorityIdentity,
  KnowledgeSurfaceKind,
  KnowledgeSurfaceMode,
  KnowledgeSurfaceReadResult,
  KnowledgeSurfaceRegistryIndexIdentity,
  KnowledgeSurfaceResponse,
  KnowledgeSurfaceRole,
  KnowledgeSurfaceTeachingIdentity,
} from './types';
import type { KnowledgeSurfaceLatestCutover } from './latest-cutover';

const SHARD_KIND: Record<AuthorityShardClass, KnowledgeSurfaceKind> = {
  root: 'root',
  'domain-default': 'domain',
  'relation-family': 'family',
  'node-neighborhood': 'neighborhood',
  'node-detail': 'detail',
};

export function surfaceKeyForShard(shard: AuthorityLearnerShard): string {
  switch (shard.shardClass) {
    case 'root':
      return 'root';
    case 'domain-default':
      return shard.domainId;
    case 'relation-family':
      return `${shard.domainId}/${shard.family}`;
    case 'node-neighborhood':
      return shard.nodeId;
    case 'node-detail':
      return shard.node.id;
  }
}

function teachingFromShard(
  shard: AuthorityLearnerShard,
  captureRevision?: string | null,
): {
  teaching: KnowledgeSurfaceTeachingIdentity | null;
  teachingMatch: boolean | null;
} {
  const teaching = shard.envelope.teaching;
  const teachingMatch = shard.envelope.match.teaching;
  if (
    teachingMatch === true
    && teaching.status === 'available'
    && teaching.projectionId
    && teaching.projectionHash
  ) {
    return {
      teaching: {
        projectionId: teaching.projectionId,
        projectionHash: teaching.projectionHash,
        cacheFamily: teaching.teachingCacheFamily,
        scopeId: teaching.teachingCacheFamily,
        captureRevision: captureRevision ?? null,
      },
      teachingMatch: true,
    };
  }
  return { teaching: null, teachingMatch };
}

export function knowledgeSurfaceFromLearnerShard(input: {
  shard: AuthorityLearnerShard;
  role: KnowledgeSurfaceRole;
  locale: string;
  resourceBindings?: ActiveNodeResourceBindings | null;
  registryIndex?: KnowledgeSurfaceRegistryIndexIdentity | null;
  teachingCaptureRevision?: string | null;
  classifyLearningContent?: boolean;
  latestCutover?: KnowledgeSurfaceLatestCutover;
}): KnowledgeSurfaceReadResult {
  const { teaching, teachingMatch } = teachingFromShard(
    input.shard,
    input.teachingCaptureRevision,
  );
  const resourceBindings = input.resourceBindings;
  const includeResourceContent = input.shard.shardClass === 'node-detail'
    && resourceBindings != null
    && resourceBindings.state !== 'empty';
  const registryIndex = includeResourceContent && resourceBindings.state === 'available'
    ? (input.registryIndex ?? null)
    : null;
  const learningContentStatus = input.shard.shardClass !== 'node-detail' || input.classifyLearningContent === false
    ? 'not-applicable'
    : teachingMatch === true
      ? readLearningContentManifestClassification({
        snapshotId: input.shard.envelope.authority.snapshotId,
        snapshotHash: input.shard.envelope.authority.snapshotHash,
        releaseId: input.shard.envelope.authority.releaseId,
        releaseSetId: input.shard.envelope.authority.releaseSetId,
      }).status
      : teachingMatch === false
        ? 'omitted'
        : 'not-applicable';

  return readKnowledgeSurface({
    mode: 'active',
    kind: SHARD_KIND[input.shard.shardClass],
    role: input.role,
    locale: input.locale,
    surfaceKey: surfaceKeyForShard(input.shard),
    authority: {
      snapshotId: input.shard.envelope.authority.snapshotId,
      snapshotHash: input.shard.envelope.authority.snapshotHash,
      releaseId: input.shard.envelope.authority.releaseId,
      releaseSetId: input.shard.envelope.authority.releaseSetId,
      activationId: input.shard.envelope.authority.activationId,
      activationHash: input.shard.envelope.authority.activationHash,
    },
    teaching,
    teachingMatch,
    registryIndex,
    includeTeachingContent: teachingMatch !== null,
    includeResourceContent,
    learningContentStatus,
    math: input.shard.shardClass === 'root'
      ? null
      : {
        owner: 'governed-rich-text-math-presentation',
        releaseId: GOVERNED_MATH_PRESENTATION_BUNDLE.releaseId,
        releaseHash: GOVERNED_MATH_PRESENTATION_BUNDLE.releaseHash,
        locale: input.locale,
      },
    latestCutover: input.latestCutover,
  });
}

export function knowledgeSurfaceFromActiveProvenance(input: {
  provenance: ActiveAuthorityProvenance;
  kind: KnowledgeSurfaceKind;
  role: KnowledgeSurfaceRole;
  surfaceKey: string;
  locale?: string;
  latestCutover?: KnowledgeSurfaceLatestCutover;
}): KnowledgeSurfaceReadResult {
  return readKnowledgeSurface({
    mode: 'active',
    kind: input.kind,
    role: input.role,
    locale: input.locale ?? 'zh-CN',
    surfaceKey: input.surfaceKey,
    authority: {
      snapshotId: input.provenance.authority.snapshotId,
      snapshotHash: input.provenance.authority.snapshotHash,
      releaseId: input.provenance.authority.releaseId,
      releaseSetId: input.provenance.authority.releaseSetId,
      activationId: input.provenance.activation.activationId,
      activationHash: input.provenance.activation.activationHash,
    },
    includeTeachingContent: false,
    includeResourceContent: false,
    latestCutover: input.latestCutover,
  });
}

export function candidateAuthorityIdentity(
  source: ProjectionIdentity,
  authoritySnapshot?: { snapshotId: string; snapshotHash: string } | null,
):
  | { status: 'ok'; authority: KnowledgeSurfaceAuthorityIdentity }
  | { status: 'identity-unavailable'; reason: string } {
  if (!source.releaseId || !source.releaseSetId) {
    return { status: 'identity-unavailable', reason: 'candidate-release-identity-missing' };
  }
  const snapshotId = authoritySnapshot?.snapshotId?.trim() || null;
  const snapshotHash = authoritySnapshot?.snapshotHash?.trim() || null;
  if ((snapshotId && !snapshotHash) || (!snapshotId && snapshotHash)) {
    return { status: 'identity-unavailable', reason: 'candidate-snapshot-identity-incomplete' };
  }
  return {
    status: 'ok',
    authority: {
      snapshotId,
      snapshotHash,
      releaseId: source.releaseId,
      releaseSetId: source.releaseSetId,
      releaseHash: source.releaseHash ?? null,
      sourceDatasetHash: source.sourceDatasetHash ?? null,
      projectionDigest: source.projectionDigest ?? null,
    },
  };
}

export function knowledgeSurfaceFromCandidateProjection(input: {
  source: ProjectionIdentity;
  role: KnowledgeRole;
  kind?: KnowledgeSurfaceKind;
  surfaceKey: string;
  locale?: string;
  authoritySnapshot?: { snapshotId: string; snapshotHash: string } | null;
}): KnowledgeSurfaceReadResult {
  const identity = candidateAuthorityIdentity(input.source, input.authoritySnapshot);
  if (identity.status !== 'ok') {
    return { status: 'identity-unavailable', reason: identity.reason };
  }
  return readKnowledgeSurface({
    mode: 'candidate',
    kind: input.kind ?? 'candidate-diagnostic',
    role: input.role,
    locale: input.locale ?? 'zh-CN',
    surfaceKey: input.surfaceKey,
    authority: identity.authority,
    includeTeachingContent: false,
    includeResourceContent: false,
    math: null,
  });
}

export function knowledgeSurfaceFromLegacyGraph(input: {
  source: KnowledgeGraphSourceKind;
  versionDigest?: string;
  kind: KnowledgeSurfaceKind;
  surfaceKey: string;
  role?: KnowledgeSurfaceRole;
  locale?: string;
}): KnowledgeSurfaceReadResult {
  const identity = input.versionDigest ?? `legacy:${input.source}`;
  return readKnowledgeSurface({
    mode: 'legacy',
    kind: input.kind,
    role: input.role ?? 'NONE',
    locale: input.locale ?? 'zh-CN',
    surfaceKey: input.surfaceKey,
    authority: {
      snapshotId: identity,
      snapshotHash: identity,
      releaseId: identity,
      releaseSetId: `legacy:${input.source}`,
    },
    includeTeachingContent: false,
    includeResourceContent: false,
    math: null,
  });
}

export function requireKnowledgeSurface(
  result: KnowledgeSurfaceReadResult,
): KnowledgeSurfaceResponse {
  if (result.status === 'selector-rejected') {
    throw new Error(`knowledge surface selector rejected: ${result.parameter}`);
  }
  if (result.status !== 'ok') {
    throw new Error(`knowledge surface identity unavailable: ${result.reason}`);
  }
  return result.knowledgeSurface;
}

export type { KnowledgeSurfaceMode };
