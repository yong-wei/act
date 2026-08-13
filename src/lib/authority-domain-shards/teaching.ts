/**
 * Optional domain Teaching Projection overlay for Authority shards (#1375).
 *
 * Missing, partial, empty or unavailable teaching never blocks engineering.
 * Runtime never reads authoring fragments.
 */

import { join } from 'node:path';

import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import {
  ACT_TEACHING_LAYER as FRAGMENT_TEACHING_LAYER,
  DOMAIN_TEACHING_CURRENT_CONTRACT,
  evaluateDomainCoverage,
  type DomainFragmentRelationPublished,
  type DomainTeachingCurrentPointer,
  type TeachingCoverageState,
} from '@/lib/teaching-projection/domain-fragments';

import {
  TEACHING_LAYER,
  type AuthorityShardRelation,
  type AuthorityShardTeachingCoverage,
} from './contracts';
import { defaultShardIo, type ShardIo } from './store';

export const DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE =
  'course-content/runtime/knowledge/teaching-projection/domain-fragments' as const;

export interface DomainTeachingRuntimePointer extends DomainTeachingCurrentPointer {
  relationsByDomain?: Partial<Record<RegisteredPeerDomainId, DomainFragmentRelationPublished[]>>;
}

export interface TeachingOverlay {
  pointer: DomainTeachingRuntimePointer | null;
  coverage(domainId: RegisteredPeerDomainId): AuthorityShardTeachingCoverage;
  relations(domainId: RegisteredPeerDomainId): AuthorityShardRelation[];
}

const UNAVAILABLE_NOTE = '教学关系暂不可用';

export function loadOptionalDomainTeachingPointer(
  repoRoot = process.cwd(),
  io: ShardIo = defaultShardIo,
  relative = DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
): DomainTeachingRuntimePointer | null {
  const pointerPath = join(repoRoot, relative, 'current.json');
  if (!io.exists(pointerPath)) return null;
  try {
    const pointer = JSON.parse(io.readFile(pointerPath)) as DomainTeachingRuntimePointer;
    if (pointer.contract !== DOMAIN_TEACHING_CURRENT_CONTRACT) return null;
    if (
      !pointer.projectionId
      || !pointer.projectionHash
      || !pointer.teachingCacheFamily
      || !pointer.authorityReleaseId
    ) {
      return null;
    }
    return pointer;
  } catch {
    return null;
  }
}

export function teachingCoverageFromState(
  domainId: RegisteredPeerDomainId,
  status: TeachingCoverageState,
  counts: {
    relationCount?: number;
    coreNodeCount?: number;
    uncoveredCoreNodeCount?: number;
    note?: string;
  } = {},
): AuthorityShardTeachingCoverage {
  const notes: Record<TeachingCoverageState, string> = {
    available: '该领域已发布可用的教学关系覆盖',
    partial: '该领域仅有部分教学关系已发布',
    empty: '该领域尚无已发布的教学关系',
    unavailable: UNAVAILABLE_NOTE,
  };
  return {
    status,
    domainId,
    relationCount: counts.relationCount ?? 0,
    coreNodeCount: counts.coreNodeCount ?? 0,
    uncoveredCoreNodeCount: counts.uncoveredCoreNodeCount ?? 0,
    note: counts.note ?? notes[status],
  };
}

export function projectTeachingRelation(
  relation: DomainFragmentRelationPublished,
): AuthorityShardRelation {
  return {
    id: relation.edgeId,
    predicate: relation.relationType,
    sourceId: relation.sourceNodeId,
    targetId: relation.targetNodeId,
    direction: 'source_to_target',
    direct: true,
    qualityTier: 'GOLD',
    governance: {
      reviewStatus: 'approved',
      publicationStatus: 'published',
    },
    semanticSupport: { supported: true, readOnly: true },
    layer: TEACHING_LAYER,
    relationFamily: 'teaching-prerequisite',
  };
}

export function createTeachingOverlay(
  pointer: DomainTeachingRuntimePointer | null,
  options: {
    coverageByDomain?: Partial<Record<RegisteredPeerDomainId, AuthorityShardTeachingCoverage>>;
    forceUnavailable?: boolean;
  } = {},
): TeachingOverlay {
  if (options.forceUnavailable || !pointer) {
    return {
      pointer: null,
      coverage(domainId) {
        return options.coverageByDomain?.[domainId]
          ?? teachingCoverageFromState(domainId, 'unavailable');
      },
      relations() {
        return [];
      },
    };
  }

  return {
    pointer,
    coverage(domainId) {
      if (options.coverageByDomain?.[domainId]) return options.coverageByDomain[domainId];
      const published = pointer.relationsByDomain?.[domainId] ?? [];
      const report = evaluateDomainCoverage(domainId, {
        coreNodes: [],
        relations: published,
        declared: published.length > 0,
      });
      return {
        status: report.coverage,
        domainId,
        relationCount: report.relationCount,
        coreNodeCount: report.coreNodeCount,
        uncoveredCoreNodeCount: report.uncoveredCoreNodeCount,
        note: report.note,
      };
    },
    relations(domainId) {
      return (pointer.relationsByDomain?.[domainId] ?? [])
        .filter((relation) => relation.layer === FRAGMENT_TEACHING_LAYER)
        .map(projectTeachingRelation);
    },
  };
}
