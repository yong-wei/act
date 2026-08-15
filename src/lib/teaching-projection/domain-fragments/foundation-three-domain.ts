/**
 * Reviewed three-domain teaching increment (#1371).
 *
 * This module owns only ACT teaching source decisions.  Authority nodes are
 * resolved from the caller-provided complete envelope and are never copied
 * from the engineering graph into the authoring record.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '../hash';
import {
  buildDomainTeachingFragment,
  deriveDomainTeachingEdgeId,
} from './builder';
import { composeDomainTeachingProjection } from './compose';
import {
  buildDomainCoverageReport,
} from './coverage';
import {
  assertDomainTeachingAuthorityEnvelope,
  authoritySelectionFromEnvelope,
} from './validate';
import { liveAuthorityEnvelopeForFirstFragment } from './translate';
import type {
  AuthorityNodeIndexEntry,
  PrerequisiteStrength,
} from '../contracts';
import type {
  DomainFragmentCoreNodeAuthoring,
  DomainFragmentRelationAuthoring,
  DomainTeachingFragment,
  DomainTeachingFragmentAuthoring,
  DomainTeachingCompositionGateFinding,
  DomainCoverageReportEntry,
  DomainFragmentAuthorityBindingComplete,
  DomainTeachingAuthorityEnvelope,
} from './contracts';

export const FOUNDATION_THREE_DOMAIN_SOURCE_CONTRACT =
  'act-foundation-three-domain-source/v1' as const;
export const FOUNDATION_THREE_DOMAIN_WORKLIST_CONTRACT =
  'act-foundation-three-domain-worklist/v1' as const;
export const FOUNDATION_THREE_DOMAIN_COVERAGE_CONTRACT =
  'act-foundation-three-domain-coverage/v1' as const;
export const FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY =
  'foundation-three-domain-v1' as const;
export const FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION = '1' as const;
export const FOUNDATION_THREE_DOMAIN_AUTHORITY_RELATIVE =
  'course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7/engineering.json' as const;
export const FOUNDATION_THREE_DOMAIN_RETAINED_FIRST_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.authoring.json' as const;
const FOUNDATION_THREE_DOMAIN_ARTIFACT_ROOT =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments' as const;

export const FOUNDATION_THREE_DOMAIN_NODE_IDS = [
  'ctc:modeling-00d2998755974a1329049aac',
  'ctkg:v3e-canonical-312d1dfa7e96b9cc6f46e253',
  'ctkg:v3e-canonical-ec8dceb901656a3a0a32d12b',
  'ctc:v11g-1c9f955b68fd25e1f4ad86f6',
] as const;

/** Explicit aliases keep the authoring source readable at call sites. */
export const FOUNDATION_THREE_DOMAIN_CORE_NODE_IDS = FOUNDATION_THREE_DOMAIN_NODE_IDS;
export const FOUNDATION_THREE_DOMAIN_GAIN_ID = FOUNDATION_THREE_DOMAIN_NODE_IDS[0];
export const FOUNDATION_THREE_DOMAIN_UNIT_STEP_ID = FOUNDATION_THREE_DOMAIN_NODE_IDS[1];
export const FOUNDATION_THREE_DOMAIN_STABILITY_ID = FOUNDATION_THREE_DOMAIN_NODE_IDS[2];
export const FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID = FOUNDATION_THREE_DOMAIN_NODE_IDS[3];

export type FoundationThreeDomainNodeId =
  (typeof FOUNDATION_THREE_DOMAIN_NODE_IDS)[number];

export const FOUNDATION_THREE_DOMAIN_EVIDENCE = {
  lesson15: 'course-content/authoring/lessons/1-5/design/1-5-boppps.md',
  lesson22: 'course-content/authoring/lessons/2-2/design/2-2-boppps.md',
  gain: ['course-content/authoring/lessons/1-5/design/1-5-boppps.md'],
  stepResponse: ['course-content/authoring/lessons/2-2/design/2-2-boppps.md'],
  stability: ['course-content/authoring/lessons/1-5/design/1-5-boppps.md'],
  settlingTime: ['course-content/authoring/lessons/2-2/design/2-2-boppps.md'],
  stepResponseToSettlingTime: [
    'course-content/authoring/lessons/2-2/design/2-2-boppps.md',
  ],
  gainToStability: [
    'course-content/authoring/lessons/1-5/design/1-5-boppps.md',
  ],
  stabilityToSettlingTime: [
    'course-content/authoring/lessons/1-5/design/1-5-boppps.md',
    'course-content/authoring/lessons/2-2/design/2-2-boppps.md',
  ],
} as const;

/**
 * The retained #1370 first fragment is authoritative for the shared node's
 * composed provenance.  #1371's 1-5 evidence remains selection evidence in
 * the increment-specific worklist and coverage artifact below.
 */
const FOUNDATION_THREE_DOMAIN_SHARED_STABILITY_PROVENANCE = {
  moduleId: 'module-2-stability',
  rationale: '当前 3-1 蓝图将稳定性作为极点、模态与双域近似的先行概念。',
  sourceKind: 'PREREQUISITE_ENDPOINT',
  sourceEvidence: [
    'course-content/authoring/lessons/3-1/design/3-1-boppps.md',
  ],
} as const;

export const FOUNDATION_THREE_DOMAIN_DENOMINATOR_EVIDENCE: Readonly<
  Record<FoundationThreeDomainNodeId, readonly string[]>
> = {
  [FOUNDATION_THREE_DOMAIN_GAIN_ID]: FOUNDATION_THREE_DOMAIN_EVIDENCE.gain,
  [FOUNDATION_THREE_DOMAIN_UNIT_STEP_ID]: FOUNDATION_THREE_DOMAIN_EVIDENCE.stepResponse,
  [FOUNDATION_THREE_DOMAIN_STABILITY_ID]: FOUNDATION_THREE_DOMAIN_EVIDENCE.stability,
  [FOUNDATION_THREE_DOMAIN_SETTLING_TIME_ID]: FOUNDATION_THREE_DOMAIN_EVIDENCE.settlingTime,
};

type FoundationCandidateStatus = 'published' | 'unresolved';
type FoundationDirectness = 'direct' | 'transitive' | 'not-direct';

export interface FoundationThreeDomainCoreWorklistEntry
  extends DomainFragmentCoreNodeAuthoring {
  status: 'selected-core';
  /** Evidence for #1371 denominator selection, separate from node provenance. */
  selectionEvidence: string[];
  denominatorReason: string;
}

export interface FoundationThreeDomainCandidate {
  candidateId: string;
  sourceNodeId: FoundationThreeDomainNodeId;
  targetNodeId: FoundationThreeDomainNodeId;
  relationType: 'PREREQUISITE';
  strength: PrerequisiteStrength;
  evidencePath: string;
  evidenceRefs: string[];
  directness: FoundationDirectness;
  isDirect: boolean;
  isTransitive: boolean;
  status: FoundationCandidateStatus;
  unpublishedReason: string | null;
}

export interface FoundationThreeDomainWorklist {
  contract: typeof FOUNDATION_THREE_DOMAIN_WORKLIST_CONTRACT;
  fragmentKey: typeof FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY;
  fragmentVersion: typeof FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION;
  authorityBinding: DomainFragmentAuthorityBindingComplete;
  authoritySelection: ReturnType<typeof authoritySelectionFromEnvelope>;
  authorityNodeIds: string[];
  denominatorNodeIds: FoundationThreeDomainNodeId[];
  coreNodes: FoundationThreeDomainCoreWorklistEntry[];
  relationCandidates: FoundationThreeDomainCandidate[];
  candidates: FoundationThreeDomainCandidate[];
  candidateCount: number;
  inputDigest: string;
}

export interface FoundationThreeDomainSource {
  contract: typeof FOUNDATION_THREE_DOMAIN_SOURCE_CONTRACT;
  fragmentKey: typeof FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY;
  fragmentVersion: typeof FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION;
  authorityBinding: DomainFragmentAuthorityBindingComplete;
  authoritySelection: ReturnType<typeof authoritySelectionFromEnvelope>;
  authorityNodeIds: string[];
  denominatorNodeIds: FoundationThreeDomainNodeId[];
  coreNodes: DomainFragmentCoreNodeAuthoring[];
  candidates: FoundationThreeDomainCandidate[];
  sourceDigest: string;
}

export interface FoundationThreeDomainCoverageArtifact {
  contract: typeof FOUNDATION_THREE_DOMAIN_COVERAGE_CONTRACT;
  fragmentKey: typeof FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY;
  fragmentVersion: typeof FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION;
  fragmentId: string;
  fragmentDigest: string;
  sourceInventoryDigest: string;
  denominatorNodeIds: FoundationThreeDomainNodeId[];
  /** #1371 curation evidence for each fixed-denominator member. */
  denominatorEvidence: Record<FoundationThreeDomainNodeId, string[]>;
  coverage: DomainCoverageReportEntry[];
  blocking: false;
}

export interface FoundationThreeDomainArtifacts {
  source: FoundationThreeDomainSource;
  worklist: FoundationThreeDomainWorklist;
  authoring: DomainTeachingFragmentAuthoring;
  fragment: DomainTeachingFragment;
  coverage: FoundationThreeDomainCoverageArtifact;
}

const CORE_NODES: readonly DomainFragmentCoreNodeAuthoring[] = [
  {
    canonicalId: FOUNDATION_THREE_DOMAIN_NODE_IDS[0],
    domainKeys: ['system-modeling'],
    pathEligible: true,
    cardPolicy: 'REQUIRED',
    moduleId: 'module-1-modeling',
    rationale: '1-5 课程目标要求学生调节增益并以同一对象读取闭环行为。',
    sourceKind: 'OBJECTIVE',
    sourceEvidence: [...FOUNDATION_THREE_DOMAIN_EVIDENCE.gain],
  },
  {
    canonicalId: FOUNDATION_THREE_DOMAIN_NODE_IDS[1],
    domainKeys: ['time-domain-analysis'],
    pathEligible: true,
    cardPolicy: 'REQUIRED',
    moduleId: 'module-3-time',
    rationale: '2-2 教学主线从单位阶跃响应开始建立时域指标语言。',
    sourceKind: 'OBJECTIVE',
    sourceEvidence: [...FOUNDATION_THREE_DOMAIN_EVIDENCE.stepResponse],
  },
  {
    canonicalId: FOUNDATION_THREE_DOMAIN_NODE_IDS[2],
    domainKeys: ['stability-analysis'],
    pathEligible: true,
    cardPolicy: 'OPTIONAL',
    ...FOUNDATION_THREE_DOMAIN_SHARED_STABILITY_PROVENANCE,
  },
  {
    canonicalId: FOUNDATION_THREE_DOMAIN_NODE_IDS[3],
    domainKeys: ['stability-analysis', 'time-domain-analysis'],
    pathEligible: true,
    cardPolicy: 'REQUIRED',
    moduleId: 'module-3-time',
    rationale: '2-2 将调节时间定义为单位阶跃响应的动态性能指标。',
    sourceKind: 'PRIMARY_COVERS',
    sourceEvidence: [...FOUNDATION_THREE_DOMAIN_EVIDENCE.settlingTime],
  },
];

function candidate(
  input: Omit<FoundationThreeDomainCandidate, 'candidateId' | 'evidencePath'> & {
    candidateId: string;
    evidencePath?: string;
  },
): FoundationThreeDomainCandidate {
  return {
    ...input,
    evidencePath: input.evidencePath ?? input.evidenceRefs[0]!,
    evidenceRefs: [...new Set(input.evidenceRefs)].sort(compareCodePoint),
  };
}

const CANDIDATES: readonly FoundationThreeDomainCandidate[] = [
  candidate({
    candidateId: 'foundation-step-response-to-settling-time',
    sourceNodeId: FOUNDATION_THREE_DOMAIN_NODE_IDS[1],
    targetNodeId: FOUNDATION_THREE_DOMAIN_NODE_IDS[3],
    relationType: 'PREREQUISITE',
    strength: 'REQUIRED',
    evidenceRefs: [...FOUNDATION_THREE_DOMAIN_EVIDENCE.stepResponseToSettlingTime],
    directness: 'direct',
    isDirect: true,
    isTransitive: false,
    status: 'published',
    unpublishedReason: null,
  }),
  candidate({
    candidateId: 'foundation-gain-to-stability',
    sourceNodeId: FOUNDATION_THREE_DOMAIN_NODE_IDS[0],
    targetNodeId: FOUNDATION_THREE_DOMAIN_NODE_IDS[2],
    relationType: 'PREREQUISITE',
    strength: 'RECOMMENDED',
    evidenceRefs: [...FOUNDATION_THREE_DOMAIN_EVIDENCE.gainToStability],
    directness: 'not-direct',
    isDirect: false,
    isTransitive: false,
    status: 'unresolved',
    unpublishedReason:
      '证据仅为同课共现，未形成直接教学顺序，故不得发布 ACT_TEACHING。',
  }),
  candidate({
    candidateId: 'foundation-stability-to-settling-time',
    sourceNodeId: FOUNDATION_THREE_DOMAIN_NODE_IDS[2],
    targetNodeId: FOUNDATION_THREE_DOMAIN_NODE_IDS[3],
    relationType: 'PREREQUISITE',
    strength: 'RECOMMENDED',
    evidenceRefs: [...FOUNDATION_THREE_DOMAIN_EVIDENCE.stabilityToSettlingTime],
    directness: 'not-direct',
    isDirect: false,
    isTransitive: false,
    status: 'unresolved',
    unpublishedReason:
      '证据只形成三域链条，不能将其转写为直接先修，故不得发布 ACT_TEACHING。',
  }),
];

function compareCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCodePoint);
}

function cloneCoreNodes(): DomainFragmentCoreNodeAuthoring[] {
  return CORE_NODES.map((node) => ({
    ...node,
    domainKeys: [...node.domainKeys],
    sourceEvidence: [...node.sourceEvidence],
  }));
}

function cloneCandidates(): FoundationThreeDomainCandidate[] {
  return CANDIDATES.map((item) => ({
    ...item,
    evidenceRefs: [...item.evidenceRefs],
  }));
}

function resolveSelectedAuthorityNodes(
  envelope: DomainTeachingAuthorityEnvelope,
): AuthorityNodeIndexEntry[] {
  const byId = new Map(envelope.nodes.map((node) => [node.canonicalId, node]));
  return FOUNDATION_THREE_DOMAIN_NODE_IDS.map((canonicalId) => {
    const node = byId.get(canonicalId);
    if (!node) {
      throw new Error(
        `foundation Authority envelope is missing selected live node ${canonicalId}`,
      );
    }
    const lifecycle = String(node.lifecycleStatus ?? '').toLowerCase();
    if (lifecycle !== '' && lifecycle !== 'active') {
      throw new Error(
        `foundation Authority endpoint ${canonicalId} is not live: ${node.lifecycleStatus}`,
      );
    }
    return node;
  });
}

function buildRelationAuthoring(): DomainFragmentRelationAuthoring[] {
  const accepted = CANDIDATES.find((item) => item.status === 'published')!;
  return [
    {
      edgeId: deriveDomainTeachingEdgeId({
        sourceNodeId: accepted.sourceNodeId,
        targetNodeId: accepted.targetNodeId,
        relationType: accepted.relationType,
        strength: accepted.strength,
      }),
      sourceNodeId: accepted.sourceNodeId,
      targetNodeId: accepted.targetNodeId,
      relationType: accepted.relationType,
      strength: accepted.strength,
      domainKeys: ['time-domain-analysis', 'stability-analysis'],
      evidenceRefs: [...accepted.evidenceRefs],
      curatorId: 'act.foundation.domain-review',
      curatorRationale:
        '2-2 以单位阶跃响应为入口，随后定义调节时间等动态性能指标，属于同一教学主线中的直接依赖。',
      authorDecisionId: 'foundation-1371-step-response-settling-time',
    },
  ];
}

function ensureBindingMatchesSelection(
  envelope: DomainTeachingAuthorityEnvelope,
): void {
  const selected = resolveSelectedAuthorityNodes(envelope);
  if (selected.length !== FOUNDATION_THREE_DOMAIN_NODE_IDS.length) {
    throw new Error('foundation selected Authority node count drifted');
  }
}

/**
 * Build all #1371 source and published artifacts from one complete envelope.
 * The envelope may also carry retained #1370 nodes for a validation-only
 * composed fixture; those nodes do not enter this increment's denominator.
 */
export function buildFoundationThreeDomainArtifacts(
  authority: DomainTeachingAuthorityEnvelope,
): FoundationThreeDomainArtifacts {
  const envelope = assertDomainTeachingAuthorityEnvelope(
    authority,
    'foundation.authority',
  );
  ensureBindingMatchesSelection(envelope);

  const authoritySelection = authoritySelectionFromEnvelope(envelope);
  const authorityNodeIds = sortedUnique(envelope.nodes.map((node) => node.canonicalId));
  const denominatorNodeIds = [...FOUNDATION_THREE_DOMAIN_NODE_IDS];
  const coreNodes = cloneCoreNodes();
  const candidates = cloneCandidates();
  const worklistCoreNodes: FoundationThreeDomainCoreWorklistEntry[] = coreNodes.map(
    (node) => ({
      ...node,
      domainKeys: [...node.domainKeys],
      sourceEvidence: [...node.sourceEvidence],
      status: 'selected-core',
      selectionEvidence: [
        ...FOUNDATION_THREE_DOMAIN_DENOMINATOR_EVIDENCE[
          node.canonicalId as FoundationThreeDomainNodeId
        ],
      ],
      denominatorReason:
        `由本增量明确选定的四个 live Authority 核心节点（证据：${FOUNDATION_THREE_DOMAIN_DENOMINATOR_EVIDENCE[
          node.canonicalId as FoundationThreeDomainNodeId
        ].join('、')}）；未选 Authority 对象不进入分母。`,
    }),
  );
  const sourceDigest = projectionDigest({
    contract: FOUNDATION_THREE_DOMAIN_SOURCE_CONTRACT,
    fragmentKey: FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION,
    authoritySelection,
    authorityNodeIds,
    denominatorNodeIds,
    coreNodes,
    candidates,
  });
  const source: FoundationThreeDomainSource = {
    contract: FOUNDATION_THREE_DOMAIN_SOURCE_CONTRACT,
    fragmentKey: FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION,
    authorityBinding: envelope.binding,
    authoritySelection,
    authorityNodeIds,
    denominatorNodeIds,
    coreNodes,
    candidates,
    sourceDigest,
  };
  const inputDigest = projectionDigest({
    contract: FOUNDATION_THREE_DOMAIN_WORKLIST_CONTRACT,
    sourceDigest,
    denominatorNodeIds,
    candidates,
  });
  const worklist: FoundationThreeDomainWorklist = {
    contract: FOUNDATION_THREE_DOMAIN_WORKLIST_CONTRACT,
    fragmentKey: FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION,
    authorityBinding: envelope.binding,
    authoritySelection,
    authorityNodeIds,
    denominatorNodeIds,
    coreNodes: worklistCoreNodes,
    relationCandidates: candidates,
    candidates,
    candidateCount: candidates.length,
    inputDigest,
  };

  const relations = buildRelationAuthoring();
  const authoring: DomainTeachingFragmentAuthoring = {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION,
    domainKeys: [
      'stability-analysis',
      'system-modeling',
      'time-domain-analysis',
    ],
    authorityBinding: envelope.binding,
    authoritySelection,
    authoringRevision: envelope.authoringRevision,
    captureRevision: envelope.captureRevision,
    sourceDatasetHash: envelope.sourceDatasetHash,
    nodeIndexDigest: envelope.nodeIndexDigest,
    evidenceRefs: sortedUnique(
      candidates.flatMap((item) => item.evidenceRefs),
    ),
    coreNodes,
    relations,
  };
  const fragment = buildDomainTeachingFragment(authoring, envelope);
  const coverage: FoundationThreeDomainCoverageArtifact = {
    contract: FOUNDATION_THREE_DOMAIN_COVERAGE_CONTRACT,
    fragmentKey: FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
    fragmentVersion: FOUNDATION_THREE_DOMAIN_FRAGMENT_VERSION,
    fragmentId: fragment.fragmentId,
    fragmentDigest: fragment.fragmentDigest,
    sourceInventoryDigest: fragment.sourceInventoryDigest,
    denominatorNodeIds,
    denominatorEvidence: Object.fromEntries(
      denominatorNodeIds.map((canonicalId) => [
        canonicalId,
        [...FOUNDATION_THREE_DOMAIN_DENOMINATOR_EVIDENCE[canonicalId]],
      ]),
    ) as Record<FoundationThreeDomainNodeId, string[]>,
    blocking: false,
    coverage: buildDomainCoverageReport({
      declaredDomainKeys: authoring.domainKeys,
      coreNodes: fragment.coreNodes,
      relations: fragment.relations,
    }),
  };

  return { source, worklist, authoring, fragment, coverage };
}

export function foundationThreeDomainPublishedCandidateIds(): string[] {
  return CANDIDATES
    .filter((item) => item.status === 'published')
    .map((item) => item.candidateId);
}

export function foundationThreeDomainUnresolvedCandidates(): FoundationThreeDomainCandidate[] {
  return cloneCandidates().filter((item) => item.status === 'unresolved');
}

export function foundationThreeDomainFindingIsEngineeringConversion(
  finding: DomainTeachingCompositionGateFinding,
): boolean {
  return /engineering|predicate|derived_from|applies_to|association|is_a/iu.test(
    `${finding.code} ${finding.message}`,
  );
}

export interface FoundationThreeDomainArtifactRelatives {
  source: string;
  worklist: string;
  authoring: string;
  fragment: string;
  coverage: string;
  twoFragmentManifest: string;
}

export function foundationThreeDomainArtifactRelatives(): FoundationThreeDomainArtifactRelatives {
  return {
    source: `${FOUNDATION_THREE_DOMAIN_ARTIFACT_ROOT}/foundation-three-domain-v1.source.json`,
    worklist: `${FOUNDATION_THREE_DOMAIN_ARTIFACT_ROOT}/foundation-three-domain-v1.worklist.json`,
    authoring: `${FOUNDATION_THREE_DOMAIN_ARTIFACT_ROOT}/foundation-three-domain-v1.authoring.json`,
    fragment: `${FOUNDATION_THREE_DOMAIN_ARTIFACT_ROOT}/foundation-three-domain-v1.json`,
    coverage: `${FOUNDATION_THREE_DOMAIN_ARTIFACT_ROOT}/foundation-three-domain-v1.coverage.json`,
    twoFragmentManifest:
      `${FOUNDATION_THREE_DOMAIN_ARTIFACT_ROOT}/fixtures/foundation-three-domain-two-fragment-manifest.json`,
  };
}

/** Stable human-auditable JSON serialization used by the generator and tests. */
export function serializeFoundationThreeDomainJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

interface FoundationEngineeringObject {
  canonicalId?: string;
  reviewStatus?: string | null;
  publicationStatus?: string | null;
  lifecycleStatus?: string | null;
}

interface FoundationEngineeringDocument {
  objects?: FoundationEngineeringObject[];
}

interface RetainedFirstAuthoringIds {
  coreNodes?: Array<{ canonicalId?: string }>;
  relations?: Array<{ sourceNodeId?: string; targetNodeId?: string }>;
}

function foundationRepoPath(repoRoot: string, relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function foundationReadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Build the exact eight-node union used only for #1371 and validation-local
 * reconstruction of #1370.  The selected four remain the sole denominator.
 */
export function liveAuthorityEnvelopeForFoundationThreeDomain(
  repoRoot = process.cwd(),
): DomainTeachingAuthorityEnvelope {
  const engineering = foundationReadJson<FoundationEngineeringDocument>(
    foundationRepoPath(repoRoot, FOUNDATION_THREE_DOMAIN_AUTHORITY_RELATIVE),
  );
  const byId = new Map(
    (engineering.objects ?? [])
      .filter((object): object is FoundationEngineeringObject & { canonicalId: string } =>
        typeof object.canonicalId === 'string',
      )
      .map((object) => [object.canonicalId, object]),
  );
  const retained = foundationReadJson<RetainedFirstAuthoringIds>(
    foundationRepoPath(
      repoRoot,
      FOUNDATION_THREE_DOMAIN_RETAINED_FIRST_AUTHORING_RELATIVE,
    ),
  );
  const retainedIds = [
    ...(retained.coreNodes ?? []).map((node) => node.canonicalId),
    ...(retained.relations ?? []).flatMap((relation) => [
      relation.sourceNodeId,
      relation.targetNodeId,
    ]),
  ].filter((value): value is string => typeof value === 'string');
  const unionIds = [...new Set([...retainedIds, ...FOUNDATION_THREE_DOMAIN_NODE_IDS])]
    .sort(compareStrings);
  if (unionIds.length !== 8) {
    throw new Error(
      `foundation Authority union must contain exactly eight unique nodes, got ${unionIds.length}`,
    );
  }
  const nodes: AuthorityNodeIndexEntry[] = unionIds.map((canonicalId) => {
    const object = byId.get(canonicalId);
    if (!object) {
      throw new Error(`pinned Authority engineering.json is missing ${canonicalId}`);
    }
    if (object.reviewStatus !== 'approved' || object.publicationStatus !== 'published') {
      throw new Error(`Authority object ${canonicalId} is not approved and published`);
    }
    if (
      object.lifecycleStatus !== null
      && object.lifecycleStatus !== undefined
      && object.lifecycleStatus !== 'active'
    ) {
      throw new Error(`Authority object ${canonicalId} is not live`);
    }
    return { canonicalId, lifecycleStatus: 'active' };
  });
  // The existing helper fixes the live binding, source dataset and revisions;
  // only the canonical node index is supplied by this generator.
  return liveAuthorityEnvelopeForFirstFragment(nodes);
}

/** Remove caller-claimed node-index identity before rebuilding from an envelope. */
export function stripClaimedAuthorityNodeIndex(
  authoring: DomainTeachingFragmentAuthoring,
): DomainTeachingFragmentAuthoring {
  const { authoritySelection: _selection, nodeIndexDigest: _digest, ...rest } = authoring;
  return rest;
}

export interface TranslateFoundationThreeDomainInput {
  authority: DomainTeachingAuthorityEnvelope;
  repoRoot?: string;
}

/** Translate the reviewed source and build the immutable #1371 fragment. */
export function translateAndBuildFoundationThreeDomainFragment(
  input: TranslateFoundationThreeDomainInput,
): FoundationThreeDomainArtifacts {
  // repoRoot is accepted so callers can pin the same source-root contract as
  // the generator; all semantic endpoints still come from input.authority.
  void input.repoRoot;
  return buildFoundationThreeDomainArtifacts(input.authority);
}

export function composeFoundationThreeDomainWithFirstFragment(input: {
  firstFragment: DomainTeachingFragment;
  foundationFragment: DomainTeachingFragment;
  authoringRevision: string;
}): ReturnType<typeof composeDomainTeachingProjection> {
  return composeDomainTeachingProjection({
    fragments: [input.firstFragment, input.foundationFragment],
    authoringRevision: input.authoringRevision,
  });
}
