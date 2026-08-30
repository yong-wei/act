/**
 * Build the third immutable Domain Teaching Projection generation (#1374).
 *
 * Reseals foundation, classical and modern shards against the same complete
 * pinned Authority envelope and adds an empty reviewed cross-domain fragment.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildDomainTeachingFragment,
  composeDomainTeachingProjection,
  projectionDigest,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingFragmentAuthoring,
} from '../../src/lib/teaching-projection';
import {
  assertExplicitIdentityEquivalence,
  assertPinnedFileBytes,
  buildCrossDomainArtifacts,
  CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS,
  CROSS_DOMAIN_BOUNDARY_WORKLISTS,
  CROSS_DOMAIN_CONVERSION_CONTRACT,
  CROSS_DOMAIN_PIN_CONTRACT,
  Generation3EquivalenceError,
  GENERATION_3_ALLOWED_IDENTITY_PATHS,
  GENERATION_3_CLASSICAL_FRAGMENT_KEY,
  GENERATION_3_FOUNDATION_FRAGMENT_KEY,
  GENERATION_3_FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
  GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY,
  GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY,
  publishedIdentityDigest,
  rebindFragmentAuthoring,
  reviewerWorklistSemanticPayload,
  teachingSemanticPayload,
  type Generation3UpstreamPin,
} from '../../src/lib/teaching-projection/domain-fragments/cross-domain';
import {
  buildModernControlDomainArtifacts,
  MODERN_DISCRETE_DOMAIN,
  MODERN_STATE_SPACE_DOMAIN,
  type ModernControlDomainArtifacts,
} from '../../src/lib/teaching-projection/domain-fragments/modern-control-domain';
import {
  buildDomainTeachingGenerationV2,
  PINNED_AUTHORITY_ENGINEERING_RELATIVE,
  PINNED_AUTHORITY_MANIFEST_RELATIVE,
  type BuildDomainTeachingGenerationV2Input,
} from './build-domain-teaching-generation-v2';

export const DOMAIN_TEACHING_GENERATION_V3_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-3';

export const PINNED_PUBLISHED_BYTE_DIGESTS = {
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.authoring.json':
    'c1fec14e9791e3c7453eb75bf71966d99468fb63d60912510b9d30a1de0df909',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json':
    '173c0974f0d7cdc01df7a4aa41403f74d0402d86ff33af2cee782a3b733e8dfb',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/composed-manifest.json':
    '2d003bb4106cd6b6547722cf5f58a88b6a07f2c224a191f222b2c9554c086188',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.authoring.json':
    'fbce25dba51d94764f8ac569039bb10b34ebe137c5cd63e8ac27b79d3ed131e3',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.json':
    'b790e540480a3b478db03b648d4ed38a7fcce9b52f67d346cd644e09d272e653',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.source.json':
    'f55cab541a6c9add1a4eae0a3aa18e4e6ec8c0575de6eb0d0e5de74d0e1d36fd',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.worklist.json':
    '47b87d1e208a2bc78fca6cb1ffd9fd6d47a9cd664e62809a5c6e34ab99e74970',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.coverage.json':
    'db55bb4e6c083659f9b166c728d7efbee12ec098bdcaae49b6b2f066cba14add',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/authority-source.json':
    '98c39c9fc234c2b3cf20f3ea9e073cc4bf775fb31c07b7a04df67b47c01e4312',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.authoring.json':
    '9618b21f21113fa5d04ddd4416d9af21605844c87c047377832599666840f134',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.json':
    '20831faed7ab0a18dd0225930540440383ad5a37f88beaf9a64ecc3791069791',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.authoring.json':
    '087510458a1f4a737985f25f14473dd7c927ffcc75de9c93731e4cbd814f5df9',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.json':
    '74297a098e940a0575a4010e64b047848ec39cc1b02f06d7957705b2403a1908',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.authoring.json':
    'f8948d8c8ebc9f7bef127da6d3ca5be22bc2cb7e49c32a78d1155f23d23dcd6c',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.json':
    '0316f2377cbe84007e4ffd625ec3cb72974d0eb2f0af0af9fd6df3357a86893e',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-worklist.json':
    '67debc20a29898795aaa7e5f623debf63818d406a59498a6c266b7cf2dc8aba4',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/composed-manifest.json':
    'e1e10b128779e8bfca86fe70b068ffe991e51bc002f52d894afe7eee54003ae5',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.authoring.json':
    '352c506dbc610c33ecb08e66512b8bcf2cb3487d3cee903ea1213decfc054517',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.json':
    'ea1e446905b9e353890216588113045e141b9e4d3645b8525236c3990becee03',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.source.json':
    'c4f9256635385925e6040227a03418a341e201707b068d6a1307dc60ccb824e1',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.worklist.json':
    '046e9acee15767a4ac84f7b7a78c21382884db95a8794615e988796ab6cb4372',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.coverage.json':
    '0b4c0d04c970ebc80cc79a78c96643ad261449098fb6a2f732a30d3fc00579d5',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.authoring.json':
    '3be780f86023ef917eadec26409dddf925bdaf31a2fcaf75b506bf227116db16',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.json':
    '2961ae6a6136f5cf3178571a796bb24c2b77faf8004b00a400a7ded2f5ab0549',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.source.json':
    'c09148e5ce2ba27c96c73a93ac8cafee5f65dcc579ed3f6cb07c66944e0cc768',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.worklist.json':
    '21ce5ac8dafb07a93dfe09bd6824db669a6dcb0e4159b221df25c5abe1c8f93d',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.coverage.json':
    '96acd0c4bed254fededcaca8a3b1fc306b4256bc89f4977c9921b9f10d1f1569',
  [PINNED_AUTHORITY_ENGINEERING_RELATIVE]:
    '7046b105b2e1f8660b5cb168be2300680e90813db805bd0477a801f4da6ed657',
  [PINNED_AUTHORITY_MANIFEST_RELATIVE]:
    '7c2f2792797c1ba607e2f408c6d3ace12147e344cf2191703f2cd8929baa2f76',
} as const;

export const PINNED_REVIEWER_WORKLIST_SEMANTIC_DIGESTS = {
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.worklist.json':
    '9b456cb8cff4d281e10966270e184e1f277a7a442321ee7818d4130772c7ec5c',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-worklist.json':
    'b7a72ad1376fa667cdccc47ee1c03f2887b8813e8c88c3a66a643aaeb96b60a5',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.worklist.json':
    '0a1d40a844a01af3720fe7fcb44f62309b73ceaaa9f3ecc12fdc9160b81d3b94',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.worklist.json':
    '27337c4b24fe815e2d650247bb2b6472c4f4f9af3c4ffab17e9d4b88651fb8b7',
} as const;

const RESEAL_UPSTREAMS = [
  {
    role: 'foundation-authoring',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.authoring.json',
    fragmentKey: GENERATION_3_FOUNDATION_FRAGMENT_KEY,
  },
  {
    role: 'foundation-fragment',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.json',
    fragmentKey: GENERATION_3_FOUNDATION_FRAGMENT_KEY,
  },
  {
    role: 'foundation-three-domain-authoring',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.authoring.json',
    fragmentKey: GENERATION_3_FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
  },
  {
    role: 'foundation-three-domain-fragment',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.json',
    fragmentKey: GENERATION_3_FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
  },
  {
    role: 'classical-authoring',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.authoring.json',
    fragmentKey: GENERATION_3_CLASSICAL_FRAGMENT_KEY,
  },
  {
    role: 'classical-fragment',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.json',
    fragmentKey: GENERATION_3_CLASSICAL_FRAGMENT_KEY,
  },
  {
    role: 'modern-discrete-authoring',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.authoring.json',
    fragmentKey: GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY,
  },
  {
    role: 'modern-discrete-fragment',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.json',
    fragmentKey: GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY,
  },
  {
    role: 'modern-discrete-source',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.source.json',
    fragmentKey: GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY,
  },
  {
    role: 'modern-discrete-worklist',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.worklist.json',
    fragmentKey: GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY,
  },
  {
    role: 'modern-discrete-coverage',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.coverage.json',
    fragmentKey: GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY,
  },
  {
    role: 'modern-state-space-authoring',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.authoring.json',
    fragmentKey: GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY,
  },
  {
    role: 'modern-state-space-fragment',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.json',
    fragmentKey: GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY,
  },
  {
    role: 'modern-state-space-source',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.source.json',
    fragmentKey: GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY,
  },
  {
    role: 'modern-state-space-worklist',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.worklist.json',
    fragmentKey: GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY,
  },
  {
    role: 'modern-state-space-coverage',
    path: 'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.coverage.json',
    fragmentKey: GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY,
  },
] as const;

function readJson<T>(repoRoot: string, relativePath: string): T {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8')) as T;
}

function pinnedPublishedByteDigest(relativePath: string): string {
  const expected = (PINNED_PUBLISHED_BYTE_DIGESTS as Record<string, string>)[relativePath];
  if (!expected) {
    throw new Error(`missing published byte pin for ${relativePath}`);
  }
  return expected;
}

function pinnedReviewerWorklistSemanticDigest(relativePath: string): string {
  const expected = (
    PINNED_REVIEWER_WORKLIST_SEMANTIC_DIGESTS as Record<string, string>
  )[relativePath];
  if (!expected) {
    throw new Error(`missing reviewer worklist semantic pin for ${relativePath}`);
  }
  return expected;
}

export function assertPinnedReviewerWorklistSemantics(
  relativePath: string,
  original: unknown,
): string {
  const expected = pinnedReviewerWorklistSemanticDigest(relativePath);
  const actual = projectionDigest(reviewerWorklistSemanticPayload(original));
  if (actual !== expected) {
    throw new Generation3EquivalenceError(
      `reviewer worklist semantic drift for ${relativePath}: expected ${expected}, got ${actual}`,
    );
  }
  return actual;
}

export function assertPinnedBoundaryWorklistBytes(repoRoot = process.cwd()): void {
  for (const spec of CROSS_DOMAIN_BOUNDARY_WORKLISTS) {
    assertPinnedFileBytes(repoRoot, spec.path, pinnedPublishedByteDigest(spec.path));
  }
}

export function assertPinnedPublishedBytes(repoRoot = process.cwd()): void {
  assertPinnedBoundaryWorklistBytes(repoRoot);
  for (const [relativePath, expected] of Object.entries(PINNED_PUBLISHED_BYTE_DIGESTS)) {
    assertPinnedFileBytes(repoRoot, relativePath, expected);
  }
}

function pinArtifact(input: {
  role: string;
  path: string;
  original: unknown;
  resealed: unknown;
  originalBytesDigest: string;
  snapshotBinding: Generation3UpstreamPin['snapshotBinding'];
}): Generation3UpstreamPin {
  assertExplicitIdentityEquivalence(input.original, input.resealed, input.role);
  return {
    role: input.role,
    path: input.path,
    originalBytesDigest: input.originalBytesDigest,
    originalPublishedDigest: publishedIdentityDigest(input.original),
    originalSemanticDigest: projectionDigest(teachingSemanticPayload(input.original)),
    resealedDigest: publishedIdentityDigest(input.resealed),
    snapshotBinding: input.snapshotBinding,
    conversionProtocol: CROSS_DOMAIN_CONVERSION_CONTRACT,
  };
}

function pinSharedReviewerWorklist(input: {
  role: string;
  path: string;
  original: unknown;
  resultingWorklist: unknown;
  originalBytesDigest: string;
  snapshotBinding: Generation3UpstreamPin['snapshotBinding'];
}): Generation3UpstreamPin {
  return {
    role: input.role,
    path: input.path,
    originalBytesDigest: input.originalBytesDigest,
    originalPublishedDigest: publishedIdentityDigest(input.original),
    originalSemanticDigest: assertPinnedReviewerWorklistSemantics(
      input.path,
      input.original,
    ),
    resealedDigest: publishedIdentityDigest(input.resultingWorklist),
    snapshotBinding: input.snapshotBinding,
    conversionProtocol: CROSS_DOMAIN_CONVERSION_CONTRACT,
    auditOutput: 'multi-source-cross-domain-worklist',
    auditOutputSources: [...CROSS_DOMAIN_BOUNDARY_WORKLIST_PATHS],
  };
}

function resealModern(
  built: ModernControlDomainArtifacts,
  fragmentKey: string,
  authority: DomainTeachingAuthorityEnvelope,
): ModernControlDomainArtifacts {
  const authoring = rebindFragmentAuthoring(
    built.authoring,
    fragmentKey,
    authority.nodeIndexDigest,
  );
  const fragment = buildDomainTeachingFragment(authoring, authority);
  const source = {
    ...built.source,
    fragmentKey: fragmentKey as typeof built.source.fragmentKey,
    sourceDigest: projectionDigest({
      contract: built.source.contract,
      fragmentKey,
      fragmentVersion: built.source.fragmentVersion,
      domainId: built.source.domainId,
      authoritySelection: built.source.authoritySelection,
      authorityNodeIds: built.source.authorityNodeIds,
      denominatorNodeIds: built.source.denominatorNodeIds,
      coreNodes: built.source.coreNodes,
      acceptedLocalRelationCount: built.source.acceptedLocalRelationCount,
      unresolvedCoreCandidates: built.source.unresolvedCoreCandidates,
      deferredBoundaries: built.source.deferredBoundaries,
      excludedScopes: built.source.excludedScopes,
    }),
  };
  const worklist = {
    ...built.worklist,
    fragmentKey: fragmentKey as typeof built.worklist.fragmentKey,
    inputDigest: projectionDigest({
      contract: built.worklist.contract,
      sourceDigest: source.sourceDigest,
      denominatorNodeIds: built.worklist.denominatorNodeIds,
      acceptedLocalRelationCount: built.worklist.acceptedLocalRelationCount,
      unresolvedCoreCandidates: built.worklist.unresolvedCoreCandidates,
      deferredBoundaries: built.worklist.deferredBoundaries,
      excludedScopes: built.worklist.excludedScopes,
    }),
  };
  const coverage = {
    ...built.coverage,
    fragmentKey: fragmentKey as typeof built.coverage.fragmentKey,
    fragmentId: fragment.fragmentId,
    fragmentDigest: fragment.fragmentDigest,
    sourceInventoryDigest: fragment.sourceInventoryDigest,
  };
  return {
    definition: built.definition,
    source,
    worklist,
    authoring,
    fragment,
    coverage,
  };
}

export function buildDomainTeachingGenerationV3(
  input: BuildDomainTeachingGenerationV2Input = {},
) {
  const repoRoot = input.repoRoot ?? process.cwd();
  assertPinnedPublishedBytes(repoRoot);
  const generation2 = buildDomainTeachingGenerationV2(input);
  const authority = generation2.authority;
  const foundationAuthoring = rebindFragmentAuthoring(
    generation2.foundationAuthoring,
    GENERATION_3_FOUNDATION_FRAGMENT_KEY,
    authority.nodeIndexDigest,
  );
  const foundationThreeDomainAuthoring = rebindFragmentAuthoring(
    generation2.foundationThreeDomainAuthoring,
    GENERATION_3_FOUNDATION_THREE_DOMAIN_FRAGMENT_KEY,
    authority.nodeIndexDigest,
  );
  const classicalAuthoring = rebindFragmentAuthoring(
    generation2.classicalAuthoring,
    GENERATION_3_CLASSICAL_FRAGMENT_KEY,
    authority.nodeIndexDigest,
  );
  const foundationFragment = buildDomainTeachingFragment(
    foundationAuthoring,
    authority,
  );
  const foundationThreeDomainFragment = buildDomainTeachingFragment(
    foundationThreeDomainAuthoring,
    authority,
  );
  const classicalFragment = buildDomainTeachingFragment(
    classicalAuthoring,
    authority,
  );
  const modernDiscrete = resealModern(
    buildModernControlDomainArtifacts(
      MODERN_DISCRETE_DOMAIN,
      authority,
      repoRoot,
    ),
    GENERATION_3_MODERN_DISCRETE_FRAGMENT_KEY,
    authority,
  );
  const modernStateSpace = resealModern(
    buildModernControlDomainArtifacts(
      MODERN_STATE_SPACE_DOMAIN,
      authority,
      repoRoot,
    ),
    GENERATION_3_MODERN_STATE_SPACE_FRAGMENT_KEY,
    authority,
  );
  const crossDomain = buildCrossDomainArtifacts(authority, repoRoot);
  const resealedByRole: Record<string, unknown> = {
    'foundation-authoring': foundationAuthoring,
    'foundation-fragment': foundationFragment,
    'foundation-three-domain-authoring': foundationThreeDomainAuthoring,
    'foundation-three-domain-fragment': foundationThreeDomainFragment,
    'classical-authoring': classicalAuthoring,
    'classical-fragment': classicalFragment,
    'modern-discrete-authoring': modernDiscrete.authoring,
    'modern-discrete-fragment': modernDiscrete.fragment,
    'modern-discrete-source': modernDiscrete.source,
    'modern-discrete-worklist': modernDiscrete.worklist,
    'modern-discrete-coverage': modernDiscrete.coverage,
    'modern-state-space-authoring': modernStateSpace.authoring,
    'modern-state-space-fragment': modernStateSpace.fragment,
    'modern-state-space-source': modernStateSpace.source,
    'modern-state-space-worklist': modernStateSpace.worklist,
    'modern-state-space-coverage': modernStateSpace.coverage,
  };
  const resealPins = RESEAL_UPSTREAMS.map((spec) => {
    const original = readJson(repoRoot, spec.path);
    return pinArtifact({
      role: spec.role,
      path: spec.path,
      original,
      resealed: resealedByRole[spec.role],
      originalBytesDigest: PINNED_PUBLISHED_BYTE_DIGESTS[spec.path],
      snapshotBinding: authority.binding,
    });
  });
  const reviewerPins = CROSS_DOMAIN_BOUNDARY_WORKLISTS.map((spec) => {
    const originalBytesDigest = pinnedPublishedByteDigest(spec.path);
    assertPinnedFileBytes(repoRoot, spec.path, originalBytesDigest);
    return pinSharedReviewerWorklist({
      role: spec.role,
      path: spec.path,
      original: readJson(repoRoot, spec.path),
      resultingWorklist: crossDomain.worklist,
      originalBytesDigest,
      snapshotBinding: authority.binding,
    });
  });
  const reviewerPathSet = new Set(reviewerPins.map((pin) => pin.path));
  if (
    reviewerPathSet.size !== CROSS_DOMAIN_BOUNDARY_WORKLISTS.length
    || CROSS_DOMAIN_BOUNDARY_WORKLISTS.some((spec) => !reviewerPathSet.has(spec.path))
  ) {
    throw new Error(
      'generation-3 pin ledger does not exactly cover collected boundary worklists',
    );
  }
  const upstreamPins = [...resealPins, ...reviewerPins];
  const conversionProtocol = {
    contract: CROSS_DOMAIN_CONVERSION_CONTRACT,
    snapshotBinding: authority.binding,
    sourceDatasetHash: authority.sourceDatasetHash,
    captureRevision: authority.captureRevision,
    nodeIndexDigest: authority.nodeIndexDigest,
    allowedIdentityPaths: [...GENERATION_3_ALLOWED_IDENTITY_PATHS],
    forbidden: [
      'recursive-field-deletion',
      'engineering-derived-edges',
      'visual-portal-edges',
      'transfer-relation-edges',
      'promoting-modern-DEFER-or-empty-denominator',
    ],
  };
  const composed = composeDomainTeachingProjection({
    fragments: [
      foundationFragment,
      foundationThreeDomainFragment,
      classicalFragment,
      modernDiscrete.fragment,
      modernStateSpace.fragment,
      crossDomain.fragment,
    ],
    authoringRevision: authority.authoringRevision,
    authority,
    authoritySelection: generation2.authoritySource
      ? {
          authorityBinding: authority.binding,
          sourceDatasetHash: authority.sourceDatasetHash,
          captureRevision: authority.captureRevision,
          nodeIndexDigest: authority.nodeIndexDigest,
        }
      : undefined,
  });
  if (!composed.manifest.gatePassed) {
    throw new Error('generation-3 composition failed the unrelaxed gate');
  }

  return {
    authority,
    authoritySource: {
      ...generation2.authoritySource,
      generation: 'generation-3',
    },
    conversionProtocol,
    pinLedger: {
      contract: CROSS_DOMAIN_PIN_CONTRACT,
      snapshotBinding: authority.binding,
      sourceDatasetHash: authority.sourceDatasetHash,
      captureRevision: authority.captureRevision,
      nodeIndexDigest: authority.nodeIndexDigest,
      artifacts: upstreamPins,
    },
    foundationAuthoring,
    foundationFragment,
    foundationThreeDomainAuthoring,
    foundationThreeDomainFragment,
    classicalAuthoring,
    classicalFragment,
    modernDiscrete,
    modernStateSpace,
    crossDomain,
    composed,
  };
}

export function generation3ArtifactRelatives() {
  const root = DOMAIN_TEACHING_GENERATION_V3_RELATIVE;
  return {
    authoritySource: `${root}/authority-source.json`,
    conversionProtocol: `${root}/conversion-protocol.json`,
    upstreamPins: `${root}/upstream-pins.json`,
    foundationAuthoring: `${root}/foundation-fragment.authoring.json`,
    foundationFragment: `${root}/foundation-fragment.json`,
    foundationThreeDomainAuthoring: `${root}/foundation-three-domain-fragment.authoring.json`,
    foundationThreeDomainFragment: `${root}/foundation-three-domain-fragment.json`,
    classicalAuthoring: `${root}/classical-fragment.authoring.json`,
    classicalFragment: `${root}/classical-fragment.json`,
    modernDiscreteSource: `${root}/modern-discrete-time.source.json`,
    modernDiscreteWorklist: `${root}/modern-discrete-time.worklist.json`,
    modernDiscreteAuthoring: `${root}/modern-discrete-time.authoring.json`,
    modernDiscreteFragment: `${root}/modern-discrete-time.json`,
    modernDiscreteCoverage: `${root}/modern-discrete-time.coverage.json`,
    modernStateSpaceSource: `${root}/modern-state-space.source.json`,
    modernStateSpaceWorklist: `${root}/modern-state-space.worklist.json`,
    modernStateSpaceAuthoring: `${root}/modern-state-space.authoring.json`,
    modernStateSpaceFragment: `${root}/modern-state-space.json`,
    modernStateSpaceCoverage: `${root}/modern-state-space.coverage.json`,
    crossDomainSource: `${root}/cross-domain.source.json`,
    crossDomainWorklist: `${root}/cross-domain.worklist.json`,
    crossDomainAuthoring: `${root}/cross-domain.authoring.json`,
    crossDomainFragment: `${root}/cross-domain.json`,
    crossDomainCoverage: `${root}/cross-domain.coverage.json`,
    composedManifest: `${root}/composed-manifest.json`,
  } as const;
}

export function serializeGeneration3Json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export type DomainTeachingGenerationV3Result = ReturnType<
  typeof buildDomainTeachingGenerationV3
>;

export type { DomainTeachingFragmentAuthoring };
