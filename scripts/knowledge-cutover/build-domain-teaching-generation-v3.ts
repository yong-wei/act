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
    'b38ee2a36c39004d78d0bfb3d769b6ca15b2d8d1437d3f97617c687d0c548582',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json':
    'a09bd4109efc017674d6334e85eab86e07fe2ce96fc0c7207ffbc7bb1ca22daf',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/composed-manifest.json':
    '08bbf9d1e8b07de21bb2bf2f939c642f7bfcc8ad0f463c2ae13fa416a9d511ff',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.authoring.json':
    'd82699acf1b4d0dd3aa74e927bf6d968eaa61c3a55b5dca5ef7f1fd113f5edf1',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.json':
    '61b50e0f196da843db3e07ed63dedf3c7c0bb84f71c85dfa015d278b9b7318ee',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.source.json':
    'c88b54385ece52c9fd959070fa6bded1ef0aa114246f8ecabb2c9e791f4cba9f',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.worklist.json':
    '5787d0a21bf491b826775aad4d7bc244b0cdb49bbb7a3ca813ca28255e201e96',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.coverage.json':
    '2f742be9006e883b880421ff6ff8aaa125dae3e7281b2493e56a9df9d50e2fe9',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/authority-source.json':
    '466512935215480f25479f7b7d167e677b2ab082d336cef7264a7661d5eb6f17',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.authoring.json':
    'c7fa6b97a0775622c065a6d71e4530b439ba1501f239be466aac8eb927e7e344',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.json':
    '57fe7ce15a8b49fd0c581a8b39e35166fc8023b4304f8216f4ea5a09fe67bb77',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.authoring.json':
    '74840d444d202d10d97486e2f57846d13e4390c536c02513f6aaeb5638ac04fb',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.json':
    '60c81c5747956b52f3d0d9ee52502b4f4d7554cf6ae6942d6a9fe5e2876ed9ed',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.authoring.json':
    '9b837d224adf0d50210e9c6b3d7d27f16084cc688dcaebea2b4e7f1164900a55',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.json':
    'e17f142c8a87455ad9f4c31773a7406bf03e47b7be365c78a800c0252a0b559a',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-worklist.json':
    '67debc20a29898795aaa7e5f623debf63818d406a59498a6c266b7cf2dc8aba4',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/composed-manifest.json':
    '2900ae58fa4d4f7dd1975296ae0682bef002c9a4badb700e2a9196f05b4938a5',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.authoring.json':
    '3b97490284c934e6ebe058ca8207e89ecf8a053a0c4c5d1a40dce1c1175a541e',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.json':
    'a995fd09d08b5a814c95751988094b3d1d2ef48424bbab13c394740422e4972e',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.source.json':
    '974c7e9184c15f9d4d0c3a6766cdcf85d536029d986a7ecff8c0ee92a715a61d',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.worklist.json':
    '4372e18470ebb9dd47427d4b38113bde3b7673667744c41249fee6d4dd32e06f',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.coverage.json':
    'c8edebcb809afe5e0fd4520c731a9e5c58cc4a88ece50f5cc3bdc574cc7d51d6',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.authoring.json':
    'a09af7291b9c93056fc8272aecc3e52b320af23ae9b648f23a6336c66946196a',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.json':
    '8dc92ed1351142533042e835410fcb9685756cb50b02cbf868e7c620776b7e93',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.source.json':
    '25bfdedd6ba27eedb931cd45c07273d797da716755409c4b5281a897b55f70f4',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.worklist.json':
    '376a06b7dbb2f531b99cf65dc6e8a59f9a68288d3b7a6e51e773cb1c74093f8b',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.coverage.json':
    '50608294d8b1950b77f0cf2941844135b3a3e65d98df2feecf9b0486a04e5030',
  [PINNED_AUTHORITY_ENGINEERING_RELATIVE]:
    'bf25630617d97ffd1b3353b23c51f0e8e7227546d346818f7f1abc6019e4ea57',
  [PINNED_AUTHORITY_MANIFEST_RELATIVE]:
    'f4d745a0b65130b6deecc58eb8a7d1cf5dbbea331e2b77e7846f7a5e9ee06420',
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
