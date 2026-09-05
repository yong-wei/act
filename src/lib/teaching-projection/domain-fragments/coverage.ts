/**
 * Teaching coverage states independent of Engineering Authority readiness (#1370).
 */

import {
  REGISTERED_PEER_DOMAIN_IDS,
  type DomainCoverageReportEntry,
  type DomainFragmentCoreNodePublished,
  type DomainFragmentRelationPublished,
  type RegisteredPeerDomainId,
  type TeachingCoverageState,
} from './contracts';

export interface DomainCoverageInput {
  /** Domains that appear in accepted fragments (explicitly declared). */
  declaredDomainKeys: readonly RegisteredPeerDomainId[];
  coreNodes: readonly DomainFragmentCoreNodePublished[];
  relations: readonly DomainFragmentRelationPublished[];
  /**
   * When true, the optional teaching layer cannot be resolved at all
   * (service/store failure). Distinct from empty published coverage.
   */
  teachingLayerUnavailable?: boolean;
}

const COVERAGE_NOTES: Record<TeachingCoverageState, string> = {
  available: '该领域已发布可用的教学关系覆盖',
  partial: '该领域仅有部分教学关系已发布',
  empty: '该领域尚无已发布的教学关系',
  unavailable: '教学投影层暂不可用',
};

/**
 * Engineering browsing is never blocked by teaching coverage state.
 */
export function engineeringBrowsingAllowed(
  _coverage: TeachingCoverageState | null | undefined,
): true {
  return true;
}

/**
 * Authority activation is never blocked by teaching coverage.
 */
export function authorityActivationBlockedByTeachingCoverage(
  _coverage: TeachingCoverageState | null | undefined,
): false {
  return false;
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function domainCoreNodes(
  domainId: RegisteredPeerDomainId,
  coreNodes: readonly DomainFragmentCoreNodePublished[],
): DomainFragmentCoreNodePublished[] {
  return coreNodes.filter((node) => node.domainKeys.includes(domainId));
}

function domainRelations(
  domainId: RegisteredPeerDomainId,
  relations: readonly DomainFragmentRelationPublished[],
): DomainFragmentRelationPublished[] {
  return relations.filter((relation) => relation.domainKeys.includes(domainId));
}

function uncoveredCoreCount(
  domainId: RegisteredPeerDomainId,
  coreNodes: readonly DomainFragmentCoreNodePublished[],
  relations: readonly DomainFragmentRelationPublished[],
): number {
  const domainRels = domainRelations(domainId, relations);
  if (domainRels.length === 0) {
    return domainCoreNodes(domainId, coreNodes).length;
  }
  const covered = new Set<string>();
  for (const rel of domainRels) {
    covered.add(rel.sourceNodeId);
    covered.add(rel.targetNodeId);
  }
  return domainCoreNodes(domainId, coreNodes).filter(
    (node) => !covered.has(node.canonicalId),
  ).length;
}

export function evaluateDomainCoverage(
  domainId: RegisteredPeerDomainId,
  input: {
    coreNodes: readonly DomainFragmentCoreNodePublished[];
    relations: readonly DomainFragmentRelationPublished[];
    declared: boolean;
    teachingLayerUnavailable?: boolean;
  },
): DomainCoverageReportEntry {
  if (input.teachingLayerUnavailable) {
    return {
      domainId,
      coverage: 'unavailable',
      coreNodeCount: 0,
      relationCount: 0,
      uncoveredCoreNodeCount: 0,
      note: COVERAGE_NOTES.unavailable,
    };
  }

  const coreNodeCount = domainCoreNodes(domainId, input.coreNodes).length;
  const relationCount = domainRelations(domainId, input.relations).length;
  const uncoveredCoreNodeCount = uncoveredCoreCount(
    domainId,
    input.coreNodes,
    input.relations,
  );

  let coverage: TeachingCoverageState;
  if (!input.declared && relationCount === 0 && coreNodeCount === 0) {
    // Domain never entered any fragment — empty published coverage, not unavailable.
    coverage = 'empty';
  } else if (relationCount === 0) {
    coverage = 'empty';
  } else if (uncoveredCoreNodeCount > 0) {
    coverage = 'partial';
  } else {
    coverage = 'available';
  }

  return {
    domainId,
    coverage,
    coreNodeCount,
    relationCount,
    uncoveredCoreNodeCount,
    note: COVERAGE_NOTES[coverage],
  };
}

/**
 * Build coverage for all registered peer domains.
 * Incomplete teaching coverage never becomes a validity failure.
 */
export function buildDomainCoverageReport(
  input: DomainCoverageInput,
): DomainCoverageReportEntry[] {
  const declared = new Set(input.declaredDomainKeys);
  return [...new Set([...REGISTERED_PEER_DOMAIN_IDS, ...input.declaredDomainKeys])]
    .sort(compareCodePoint)
    .map((domainId) =>
      evaluateDomainCoverage(domainId, {
        coreNodes: input.coreNodes,
        relations: input.relations,
        declared: declared.has(domainId),
        teachingLayerUnavailable: input.teachingLayerUnavailable === true,
      }),
    );
}

export function coverageByDomainId(
  report: readonly DomainCoverageReportEntry[],
): ReadonlyMap<RegisteredPeerDomainId, TeachingCoverageState> {
  return new Map(report.map((entry) => [entry.domainId, entry.coverage]));
}

/**
 * Distinguish service unavailability from no published teaching relation.
 */
export function isTeachingServiceUnavailable(
  coverage: TeachingCoverageState,
): boolean {
  return coverage === 'unavailable';
}

export function isNoPublishedTeachingRelation(
  coverage: TeachingCoverageState,
): boolean {
  return coverage === 'empty';
}
