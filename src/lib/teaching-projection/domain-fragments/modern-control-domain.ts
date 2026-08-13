/**
 * Modern-control teaching fragments (#1373).
 *
 * This increment deliberately publishes two bounded empty fragments. The
 * pinned Authority snapshot verifies exact objects, while CourseCoverage and
 * ACT admission evidence keep both teaching denominators unresolved.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { projectionDigest } from '../hash';
import {
  buildDomainTeachingFragment,
} from './builder';
import { buildDomainCoverageReport } from './coverage';
import {
  assertDomainTeachingAuthorityEnvelope,
  authoritySelectionFromEnvelope,
} from './validate';
import { liveAuthorityEnvelopeForFirstFragment } from './translate';
import type { AuthorityNodeIndexEntry } from '../contracts';
import type {
  DomainFragmentCoreNodeAuthoring,
  DomainTeachingAuthorityEnvelope,
  DomainTeachingFragment,
  DomainTeachingFragmentAuthoring,
  DomainCoverageReportEntry,
  RegisteredPeerDomainId,
} from './contracts';
export const MODERN_CONTROL_SOURCE_CONTRACT =
  'act-modern-control-domain-source/v1' as const;
export const MODERN_CONTROL_WORKLIST_CONTRACT =
  'act-modern-control-domain-worklist/v1' as const;
export const MODERN_CONTROL_COVERAGE_CONTRACT =
  'act-modern-control-domain-coverage/v1' as const;
export const MODERN_CONTROL_FRAGMENT_VERSION = '1' as const;
export const MODERN_CONTROL_AUTHORITY_RELATIVE =
  'course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7/engineering.json' as const;
export const MODERN_CONTROL_CATALOG_RELATIVE =
  'course-content/authoring/knowledge/authority-domain-catalog/catalog.json' as const;
export const MODERN_CONTROL_ARTIFACT_ROOT =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments' as const;
export const MODERN_DISCRETE_DOMAIN =
  'discrete-time-control-analysis' as const;
export const MODERN_STATE_SPACE_DOMAIN =
  'state-space-control-analysis-and-design' as const;
export type ModernControlDomainId =
  | typeof MODERN_DISCRETE_DOMAIN
  | typeof MODERN_STATE_SPACE_DOMAIN;
export const MODERN_DISCRETE_NODE_ID =
  'ctkg:v3e-object-0e5df270abeaa062e3a81d33' as const;
export const MODERN_STATE_SPACE_NODE_ID =
  'ctkg:v3e-object-0bb7941e989275e607a110d0' as const;
export const MODERN_DISCRETE_FRAGMENT_KEY = 'modern-discrete-time-v1' as const;
export const MODERN_STATE_SPACE_FRAGMENT_KEY = 'modern-state-space-v1' as const;
const MODERN_DOMAIN_NODE_IDS = [
  MODERN_DISCRETE_NODE_ID,
  MODERN_STATE_SPACE_NODE_ID,
] as const;
type ModernControlNodeId = (typeof MODERN_DOMAIN_NODE_IDS)[number];

interface ModernDomainDefinition {
  domainId: ModernControlDomainId;
  fragmentKey:
    | typeof MODERN_DISCRETE_FRAGMENT_KEY
    | typeof MODERN_STATE_SPACE_FRAGMENT_KEY;
  canonicalId: ModernControlNodeId;
}
const DEFINITIONS: readonly ModernDomainDefinition[] = [
  {
    domainId: MODERN_DISCRETE_DOMAIN,
    fragmentKey: MODERN_DISCRETE_FRAGMENT_KEY,
    canonicalId: MODERN_DISCRETE_NODE_ID,
  },
  {
    domainId: MODERN_STATE_SPACE_DOMAIN,
    fragmentKey: MODERN_STATE_SPACE_FRAGMENT_KEY,
    canonicalId: MODERN_STATE_SPACE_NODE_ID,
  },
] as const;

export const MODERN_CONTROL_COURSE_COVERAGE_EVIDENCE = {
  [MODERN_DISCRETE_DOMAIN]:
    'course-content/authoring/knowledge/issue-1195-course-coverage-review/primary-independent-stage-source.json',
  [MODERN_STATE_SPACE_DOMAIN]:
    'course-content/authoring/knowledge/issue-1208-course-coverage-review/primary-independent-stage-source.json',
} as const;

export interface ModernControlUnresolvedCoreCandidate {
  canonicalId: ModernControlNodeId;
  status: 'DEFER';
  authorityResolution: 'unresolved';
  evidenceRefs: string[];
  reason: string;
}
export interface ModernControlBoundaryNotice {
  scope: 'cross-domain-entry' | 'non-catalog-engineering-adjacency';
  disposition: 'deferred' | 'excluded';
  reason: string;
}

export interface ModernControlCoreWorklistNode
  extends DomainFragmentCoreNodeAuthoring {
  status: 'selected-core';
  selectionEvidence: string[];
  denominatorReason: string;
}

export interface ModernControlSource {
  contract: typeof MODERN_CONTROL_SOURCE_CONTRACT;
  fragmentKey: ModernDomainDefinition['fragmentKey'];
  fragmentVersion: typeof MODERN_CONTROL_FRAGMENT_VERSION;
  domainId: ModernControlDomainId;
  authorityBinding: DomainTeachingAuthorityEnvelope['binding'];
  authoritySelection: ReturnType<typeof authoritySelectionFromEnvelope>;
  authorityNodeIds: string[];
  denominatorNodeIds: [];
  coreNodes: DomainFragmentCoreNodeAuthoring[];
  acceptedLocalRelationCount: 0;
  unresolvedCoreCandidates: ModernControlUnresolvedCoreCandidate[];
  deferredBoundaries: ModernControlBoundaryNotice[];
  excludedScopes: ModernControlBoundaryNotice[];
  sourceDigest: string;
}

export interface ModernControlWorklist {
  contract: typeof MODERN_CONTROL_WORKLIST_CONTRACT;
  fragmentKey: ModernDomainDefinition['fragmentKey'];
  fragmentVersion: typeof MODERN_CONTROL_FRAGMENT_VERSION;
  domainId: ModernControlDomainId;
  authorityBinding: DomainTeachingAuthorityEnvelope['binding'];
  authoritySelection: ReturnType<typeof authoritySelectionFromEnvelope>;
  authorityNodeIds: string[];
  denominatorNodeIds: [];
  coreNodes: ModernControlCoreWorklistNode[];
  acceptedLocalRelationCount: 0;
  unresolvedCoreCandidates: ModernControlUnresolvedCoreCandidate[];
  deferredBoundaries: ModernControlBoundaryNotice[];
  excludedScopes: ModernControlBoundaryNotice[];
  inputDigest: string;
}

export interface ModernControlCoverageArtifact {
  contract: typeof MODERN_CONTROL_COVERAGE_CONTRACT;
  fragmentKey: ModernDomainDefinition['fragmentKey'];
  fragmentVersion: typeof MODERN_CONTROL_FRAGMENT_VERSION;
  fragmentId: string;
  fragmentDigest: string;
  sourceInventoryDigest: string;
  domainId: ModernControlDomainId;
  denominatorNodeIds: [];
  denominatorEvidence: Partial<Record<ModernControlNodeId, string[]>>;
  acceptedLocalRelationCount: 0;
  coverage: DomainCoverageReportEntry[];
  coverageRationale: string;
  blocking: false;
}

export interface ModernControlDomainArtifacts {
  definition: ModernDomainDefinition;
  source: ModernControlSource;
  worklist: ModernControlWorklist;
  authoring: DomainTeachingFragmentAuthoring;
  fragment: DomainTeachingFragment;
  coverage: ModernControlCoverageArtifact;
}

interface EngineeringObject {
  canonicalId?: string;
  reviewStatus?: string | null;
  publicationStatus?: string | null;
  lifecycleStatus?: string | null;
}

interface CatalogMembership {
  canonicalId?: string;
  domainIds?: string[];
}

function compareCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCodePoint);
}

function readJson<T>(repoRoot: string, relativePath: string): T {
  return JSON.parse(
    readFileSync(path.join(repoRoot, relativePath), 'utf8'),
  ) as T;
}

function resolveDefinition(domainId: ModernControlDomainId): ModernDomainDefinition {
  const definition = DEFINITIONS.find((item) => item.domainId === domainId);
  if (!definition) throw new Error(`unknown modern-control domain ${domainId}`);
  return definition;
}

function unresolvedCoreCandidate(
  definition: ModernDomainDefinition,
): ModernControlUnresolvedCoreCandidate {
  return {
    canonicalId: definition.canonicalId,
    status: 'DEFER',
    authorityResolution: 'unresolved',
    evidenceRefs: [MODERN_CONTROL_COURSE_COVERAGE_EVIDENCE[definition.domainId]],
    reason:
      'CourseCoverage 阶段结论为 DEFER，authority unresolved；当前无 lesson、syllabus 或 curriculum 的独立 ACT admission evidence，因此候选不得进入已接纳分母。',
  };
}

function boundaryNoticesFor(): {
  deferredBoundaries: ModernControlBoundaryNotice[];
  excludedScopes: ModernControlBoundaryNotice[];
} {
  return {
    deferredBoundaries: [
      {
        scope: 'cross-domain-entry',
        disposition: 'deferred',
        reason: '跨域入口说明留给独立 cross-domain 变更审核。',
      },
    ],
    excludedScopes: [
      {
        scope: 'non-catalog-engineering-adjacency',
        disposition: 'excluded',
        reason: '非 catalog 工程邻接不是 ACT_TEACHING 证据，明确排除出本地分片。',
      },
    ],
  };
}

function buildAuthorityNodes(repoRoot: string): AuthorityNodeIndexEntry[] {
  const engineering = readJson<{ objects?: EngineeringObject[] }>(
    repoRoot,
    MODERN_CONTROL_AUTHORITY_RELATIVE,
  );
  const catalog = readJson<{ memberships?: CatalogMembership[] }>(
    repoRoot,
    MODERN_CONTROL_CATALOG_RELATIVE,
  );
  const objects = new Map(
    (engineering.objects ?? [])
      .filter((item): item is EngineeringObject & { canonicalId: string } =>
        typeof item.canonicalId === 'string',
      )
      .map((item) => [item.canonicalId, item]),
  );
  const memberships = new Map(
    (catalog.memberships ?? [])
      .filter((item): item is CatalogMembership & { canonicalId: string } =>
        typeof item.canonicalId === 'string',
      )
      .map((item) => [item.canonicalId, item.domainIds ?? []]),
  );
  return DEFINITIONS.map((definition) => {
    const object = objects.get(definition.canonicalId);
    if (!object) {
      throw new Error(`pinned Authority snapshot is missing ${definition.canonicalId}`);
    }
    if (object.reviewStatus !== 'approved' || object.publicationStatus !== 'published') {
      throw new Error(`Authority object ${definition.canonicalId} is not approved and published`);
    }
    const memberDomains = memberships.get(definition.canonicalId) ?? [];
    if (memberDomains.length !== 1 || memberDomains[0] !== definition.domainId) {
      throw new Error(`catalog membership drift for ${definition.canonicalId}`);
    }
    if (
      object.lifecycleStatus !== null
      && object.lifecycleStatus !== undefined
      && object.lifecycleStatus !== 'active'
    ) {
      throw new Error(`Authority object ${definition.canonicalId} is not live`);
    }
    return { canonicalId: definition.canonicalId, lifecycleStatus: 'active' };
  });
}

export function liveAuthorityEnvelopeForModernControl(
  repoRoot = process.cwd(),
): DomainTeachingAuthorityEnvelope {
  return liveAuthorityEnvelopeForFirstFragment(buildAuthorityNodes(repoRoot));
}

function coverageForEmptyDomain(
  domainId: ModernControlDomainId,
  fragment: DomainTeachingFragment,
): DomainCoverageReportEntry[] {
  const report = buildDomainCoverageReport({
    declaredDomainKeys: [domainId as RegisteredPeerDomainId],
    coreNodes: fragment.coreNodes,
    relations: fragment.relations,
  });
  return report;
}

export function buildModernControlDomainArtifacts(
  domainId: ModernControlDomainId,
  authority: DomainTeachingAuthorityEnvelope,
): ModernControlDomainArtifacts {
  const envelope = assertDomainTeachingAuthorityEnvelope(
    authority,
    `${domainId}.authority`,
  );
  const definition = resolveDefinition(domainId);
  if (!envelope.nodes.some((node) => node.canonicalId === definition.canonicalId)) {
    throw new Error(`modern Authority envelope is missing ${definition.canonicalId}`);
  }
  const authoritySelection = authoritySelectionFromEnvelope(envelope);
  const authorityNodeIds = sortedUnique(
    envelope.nodes.map((node) => node.canonicalId),
  );
  const denominatorNodeIds = [] as [];
  const coreNodes: DomainFragmentCoreNodeAuthoring[] = [];
  const unresolvedCoreCandidates = [unresolvedCoreCandidate(definition)];
  const { deferredBoundaries, excludedScopes } = boundaryNoticesFor();
  const sourceDigest = projectionDigest({
    contract: MODERN_CONTROL_SOURCE_CONTRACT,
    fragmentKey: definition.fragmentKey,
    fragmentVersion: MODERN_CONTROL_FRAGMENT_VERSION,
    domainId,
    authoritySelection,
    authorityNodeIds,
    denominatorNodeIds,
    coreNodes,
    acceptedLocalRelationCount: 0,
    unresolvedCoreCandidates,
    deferredBoundaries,
    excludedScopes,
  });
  const source: ModernControlSource = {
    contract: MODERN_CONTROL_SOURCE_CONTRACT,
    fragmentKey: definition.fragmentKey,
    fragmentVersion: MODERN_CONTROL_FRAGMENT_VERSION,
    domainId,
    authorityBinding: envelope.binding,
    authoritySelection,
    authorityNodeIds,
    denominatorNodeIds,
    coreNodes,
    acceptedLocalRelationCount: 0,
    unresolvedCoreCandidates,
    deferredBoundaries,
    excludedScopes,
    sourceDigest,
  };
  const inputDigest = projectionDigest({
    contract: MODERN_CONTROL_WORKLIST_CONTRACT,
    sourceDigest,
    denominatorNodeIds,
    acceptedLocalRelationCount: 0,
    deferredBoundaries,
    excludedScopes,
  });
  const worklistCoreNodes: ModernControlCoreWorklistNode[] = [];
  const worklist: ModernControlWorklist = {
    contract: MODERN_CONTROL_WORKLIST_CONTRACT,
    fragmentKey: definition.fragmentKey,
    fragmentVersion: MODERN_CONTROL_FRAGMENT_VERSION,
    domainId,
    authorityBinding: envelope.binding,
    authoritySelection,
    authorityNodeIds,
    denominatorNodeIds,
    coreNodes: worklistCoreNodes,
    acceptedLocalRelationCount: 0,
    unresolvedCoreCandidates,
    deferredBoundaries,
    excludedScopes,
    inputDigest,
  };
  const authoring: DomainTeachingFragmentAuthoring = {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: definition.fragmentKey,
    fragmentVersion: MODERN_CONTROL_FRAGMENT_VERSION,
    domainKeys: [domainId],
    authorityBinding: envelope.binding,
    authoritySelection,
    authoringRevision: envelope.authoringRevision,
    captureRevision: envelope.captureRevision,
    sourceDatasetHash: envelope.sourceDatasetHash,
    nodeIndexDigest: envelope.nodeIndexDigest,
    evidenceRefs: [],
    coreNodes,
    relations: [],
  };
  const fragment = buildDomainTeachingFragment(authoring, envelope);
  const coverage: ModernControlCoverageArtifact = {
    contract: MODERN_CONTROL_COVERAGE_CONTRACT,
    fragmentKey: definition.fragmentKey,
    fragmentVersion: MODERN_CONTROL_FRAGMENT_VERSION,
    fragmentId: fragment.fragmentId,
    fragmentDigest: fragment.fragmentDigest,
    sourceInventoryDigest: fragment.sourceInventoryDigest,
    domainId,
    denominatorNodeIds,
    denominatorEvidence: {},
    acceptedLocalRelationCount: 0,
    coverage: coverageForEmptyDomain(domainId, fragment),
    coverageRationale:
      'CourseCoverage 对该候选给出 DEFER 且 authority unresolved；无独立 ACT admission evidence 时不进入分母，因此当前空覆盖为 empty 且不阻断。',
    blocking: false,
  };
  return { definition, source, worklist, authoring, fragment, coverage };
}

export function modernControlDomainDefinitions(): ModernDomainDefinition[] {
  return DEFINITIONS.map((definition) => ({ ...definition }));
}

export interface ModernControlArtifactRelatives {
  source: string;
  worklist: string;
  authoring: string;
  fragment: string;
  coverage: string;
}

export function modernControlArtifactRelatives(
  domainId: ModernControlDomainId,
): ModernControlArtifactRelatives {
  const definition = resolveDefinition(domainId);
  return {
    source: `${MODERN_CONTROL_ARTIFACT_ROOT}/${definition.fragmentKey}.source.json`,
    worklist: `${MODERN_CONTROL_ARTIFACT_ROOT}/${definition.fragmentKey}.worklist.json`,
    authoring: `${MODERN_CONTROL_ARTIFACT_ROOT}/${definition.fragmentKey}.authoring.json`,
    fragment: `${MODERN_CONTROL_ARTIFACT_ROOT}/${definition.fragmentKey}.json`,
    coverage: `${MODERN_CONTROL_ARTIFACT_ROOT}/${definition.fragmentKey}.coverage.json`,
  };
}

export function serializeModernControlJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
