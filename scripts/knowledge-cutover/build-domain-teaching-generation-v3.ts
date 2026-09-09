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
    'dce056fdeeb93658013fcdaad47ec0afa16bffc27b150210d99e85d0f80e5b75',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/first-fragment.json':
    'de5b44399770173957d7528f6044f76e3690def50ce11b54ec7dfd201a37dc0a',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/composed-manifest.json':
    '7873c467e47ff23698d5eeb21c690f0c440c92a50d5d0d139b7e39bd5662cb24',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.authoring.json':
    '40affd88d60f96ab43f3b3b0e2a4d44d61a60b9e1e436f58501a20dafa71e832',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.json':
    'e1b94bab31bfeb2ce50fe0cc85d1097822ae33be27a2cc796e132e1ec8177f36',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.source.json':
    '9e694b9b5b9290298b98723088ba869d34d03069546a204122070ac866ed5388',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.worklist.json':
    '2b3b0e422b410eb7a49e74190523b3646a529eea5e866921ca76526fa1233f02',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/foundation-three-domain-v1.coverage.json':
    '5b560cb256a6e0f4f3a05f71bd8f49b24a9a419d8334c2c73276af8ec875640b',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/authority-source.json':
    '540e63403dcd9e512ef6ab60cba0e21129b3cb8ae1e5ee5564f2f94c259a1593',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.authoring.json':
    '6d82231aa6d4e7dd09844e3c9fb6ce92d002fcdceb5e33073b8cec3a8f3aa218',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-fragment.json':
    'ffe87368dd1eea58fd69a9122914de6a15e3ccd773262714c6b3c66dceba3482',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.authoring.json':
    '628efdd29fb865e0f285109ace7ffc743653845e90e393d8ad1a0135c3403535',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/foundation-three-domain-fragment.json':
    'f8f06a27476b47521f2ef6d3d6b56ceabbdce2f8d9fab588c4639474a5e86d5c',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.authoring.json':
    'addda53ecd5a46ce786727c54403d2cbb3da88233dbbc8e5e53bd7ef6c1496c4',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-fragment.json':
    '95cd497c84545a34cdaa887ae57afe753c349a2e893efbf2934879bf874f9e9b',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/classical-worklist.json':
    '67debc20a29898795aaa7e5f623debf63818d406a59498a6c266b7cf2dc8aba4',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2/composed-manifest.json':
    '4c09b8ba7982b00ca910260e4a1b4795e2dbd72b7c2da9bdffc2bc64cc9dedac',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.authoring.json':
    '8fdc7b64bc8c89192e013d2456d3cd47967189cddce9592667264731fa783dbb',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.json':
    '342df07771b826f4c56c9024641d8a402ce5a1e432566e6c48ded7fa50c81d38',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.source.json':
    '4b88364d4fac7ea6c30ea552a1c55563f43090bc8311214ac063ed5d13c6c32e',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.worklist.json':
    'ce5a6708a868b3695a70586cf8bb346578accfed574f6c7fa38844936295aac3',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-discrete-time-v1.coverage.json':
    'e5b2f9cf0dc94e8d8ba884441006547275f8ecb8d32cc78fc1873d962ead4ac8',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.authoring.json':
    '7ec3880cb21c4ce15a446f6c9bc1bd0378d22be5225185e116598846d07b0bbe',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.json':
    'c978c1058fa5ff6ba603fe7e86689584d7f0ad89491a440e9a9f6683cb99030a',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.source.json':
    '813a11d99dc7b5b75f7473a043b9bcc532d3becb64e7c17222715154254c5493',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.worklist.json':
    '73dc3f0f53214aa3ab55e248018737b97626fa1618a31a830c131f41befbb0da',
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/modern-state-space-v1.coverage.json':
    'a6de17c5f68b15fc25bf811dced8e2ac2f524a296f8e6fdc2364104014518ef9',
  [PINNED_AUTHORITY_ENGINEERING_RELATIVE]:
    '7b87974cdf9cfd88e15b5f0886dafd03df0cb33948210e930db13c53fe9cdd80',
  [PINNED_AUTHORITY_MANIFEST_RELATIVE]:
    'ef1cf9d73e7bd9fda41e2843d4b72b1ccc073adfef15bcf5ee19e85443362b8f',
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
