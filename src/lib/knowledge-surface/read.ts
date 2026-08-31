import { GOVERNED_MATH_PRESENTATION_BUNDLE } from '@/lib/governed-math/sidecar';

import { buildKnowledgeSurfaceCacheKeyFromRequest } from './cache';
import { forbiddenIdentitySelectorKey } from './selectors';
import type {
  KnowledgeSurfaceAuthorityIdentity,
  KnowledgeSurfaceBlock,
  KnowledgeSurfaceBlocks,
  KnowledgeSurfaceMathIdentity,
  KnowledgeSurfaceReadRequest,
  KnowledgeSurfaceReadResult,
  KnowledgeSurfaceRegistryIndexIdentity,
  KnowledgeSurfaceResponse,
  KnowledgeSurfaceTeachingIdentity,
} from './types';
import { KNOWLEDGE_SURFACE_CONTRACT } from './types';
import { unavailableLatestKnowledgeCutover } from './latest-cutover';

function teachingIsClosed(
  teaching: KnowledgeSurfaceTeachingIdentity | null | undefined,
): teaching is KnowledgeSurfaceTeachingIdentity {
  return Boolean(teaching?.projectionId && teaching.projectionHash);
}

function block(status: KnowledgeSurfaceBlock['status'], reason?: string): KnowledgeSurfaceBlock {
  return reason ? { status, reason } : { status };
}

function resolveMath(
  request: KnowledgeSurfaceReadRequest,
  locale: string,
): KnowledgeSurfaceMathIdentity | null {
  if (request.math === null) return null;
  if (request.math) return request.math;
  if (
    request.kind === 'root'
    || request.kind === 'search'
    || request.kind === 'candidate-diagnostic'
  ) {
    return null;
  }
  return {
    owner: 'governed-rich-text-math-presentation',
    releaseId: GOVERNED_MATH_PRESENTATION_BUNDLE.releaseId,
    releaseHash: GOVERNED_MATH_PRESENTATION_BUNDLE.releaseHash,
    locale,
  };
}

function resolveBlocks(input: {
  includeTeachingContent: boolean;
  includeResourceContent: boolean;
  teaching: KnowledgeSurfaceTeachingIdentity | null;
  teachingMatch: boolean | null;
  registryIndex: KnowledgeSurfaceRegistryIndexIdentity | null;
  learningContentStatus: KnowledgeSurfaceBlock['status'];
  math: KnowledgeSurfaceMathIdentity | null;
}): KnowledgeSurfaceBlocks {
  const teaching = !input.includeTeachingContent
    ? block('not-applicable')
    : teachingIsClosed(input.teaching) && input.teachingMatch === true
      ? block('available')
      : input.teachingMatch === false
        ? block('identity-mismatch', 'teaching-projection-mismatch')
        : block('unavailable', 'teaching-projection-unavailable');

  const resources = !input.includeResourceContent
    ? block('not-applicable')
    : teaching.status !== 'available'
      ? block('omitted', 'teaching-block-not-available')
      : input.registryIndex
        ? block('available')
        : block('unavailable', 'registry-index-unavailable');

  const learningContent = !input.includeTeachingContent
    ? block('not-applicable')
    : teaching.status !== 'available'
      ? block('omitted', 'teaching-block-not-available')
      : block(input.learningContentStatus);

  const math = input.math
    ? block('available')
    : block('not-applicable');

  return {
    engineering: block('available'),
    teaching,
    resources,
    learningContent,
    math,
  };
}

export function readKnowledgeSurface(request: KnowledgeSurfaceReadRequest): KnowledgeSurfaceReadResult {
  const rejected = forbiddenIdentitySelectorKey(request.searchParams);
  if (rejected) {
    return { status: 'selector-rejected', parameter: rejected };
  }

  const locale = request.locale ?? 'zh-CN';
  const includeTeachingContent = request.includeTeachingContent === true;
  const includeResourceContent = request.includeResourceContent === true;
  const teachingMatch = request.teachingMatch ?? null;
  const teachingClosed = teachingIsClosed(request.teaching) && teachingMatch === true;
  const teaching = includeTeachingContent && teachingClosed ? request.teaching! : null;
  const math = resolveMath(request, locale);
  const registryIndex = includeResourceContent && teaching && request.registryIndex
    ? request.registryIndex
    : null;
  const blocks = resolveBlocks({
    includeTeachingContent,
    includeResourceContent,
    teaching: includeTeachingContent ? (request.teaching ?? null) : null,
    teachingMatch: includeTeachingContent ? teachingMatch : null,
    registryIndex,
    learningContentStatus: request.learningContentStatus ?? 'not-applicable',
    math,
  });

  const knowledgeSurface: KnowledgeSurfaceResponse = {
    contractVersion: KNOWLEDGE_SURFACE_CONTRACT,
    surface: { kind: request.kind, id: request.surfaceKey },
    mode: request.mode,
    role: request.role,
    locale,
    authority: request.authority,
    teaching: blocks.teaching.status === 'available' ? teaching : null,
    registryIndex: blocks.resources.status === 'available' ? registryIndex : null,
    math: blocks.math.status === 'available' ? math : null,
    latestCutover: request.latestCutover ?? unavailableLatestKnowledgeCutover(),
    blocks,
  };

  return {
    status: 'ok',
    knowledgeSurface,
    cacheKey: buildKnowledgeSurfaceCacheKeyFromRequest({
      ...request,
      teaching: knowledgeSurface.teaching,
      registryIndex: knowledgeSurface.registryIndex,
      math: knowledgeSurface.math,
      latestCutover: knowledgeSurface.latestCutover,
    }, locale),
  };
}

export function withKnowledgeSurface<T extends object>(
  payload: T,
  knowledgeSurface: KnowledgeSurfaceResponse,
): T & { knowledgeSurface: KnowledgeSurfaceResponse } {
  return { ...payload, knowledgeSurface };
}

export function authorityFromShardIdentity(authority: {
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  releaseSetId: string;
  activationId?: string | null;
  activationHash?: string | null;
}): KnowledgeSurfaceAuthorityIdentity {
  return {
    snapshotId: authority.snapshotId,
    snapshotHash: authority.snapshotHash,
    releaseId: authority.releaseId,
    releaseSetId: authority.releaseSetId,
    activationId: authority.activationId ?? null,
    activationHash: authority.activationHash ?? null,
  };
}
