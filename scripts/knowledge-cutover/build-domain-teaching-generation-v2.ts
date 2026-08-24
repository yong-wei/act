/**
 * Build the second immutable Domain Teaching Projection generation (#1372).
 *
 * The first generation sealed only the foundation endpoints.  This builder
 * reseals a new generation against the complete canonical index from the
 * already pinned Authority snapshot; it never derives teaching relations from
 * Authority graph relations.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildDomainTeachingFragment,
  composeDomainTeachingProjection,
  createDomainTeachingAuthorityEnvelope,
  type AuthorityNodeIndexEntry,
  type DomainTeachingFragmentAuthoring,
} from '../../src/lib/teaching-projection';
import {
  buildFoundationThreeDomainArtifacts,
} from '../../src/lib/teaching-projection/domain-fragments/foundation-three-domain';
import {
  verifyMaterializedSnapshot,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
} from '../../src/lib/authoritative-knowledge/authority-snapshot';

export const DOMAIN_TEACHING_GENERATION_V2_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments/generation-2';

export const PINNED_AUTHORITY_ENGINEERING_RELATIVE =
  'course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7/engineering.json';

export const PINNED_AUTHORITY_MANIFEST_RELATIVE =
  'course-content/authoring/knowledge/authority/releases/snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7/manifest.json';

interface AuthorityObject {
  canonicalId: string;
  lifecycleStatus?: string | null;
  payload?: unknown;
}

interface AuthorityEngineeringSnapshot {
  objects: AuthorityObject[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
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

export function authorityNodesFromPinnedSnapshot(
  snapshot: AuthorityEngineeringSnapshot,
): AuthorityNodeIndexEntry[] {
  return snapshot.objects
    .map((object) => ({
      canonicalId: object.canonicalId,
      lifecycleStatus: object.lifecycleStatus ?? 'active',
      successorCanonicalId: successorCanonicalId(object.payload),
    }))
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
}

function rebindFoundationAuthoring(input: {
  authoring: DomainTeachingFragmentAuthoring;
  nodeIndexDigest: string;
}): DomainTeachingFragmentAuthoring {
  return {
    ...input.authoring,
    fragmentKey: 'foundation-published-v2',
    nodeIndexDigest: input.nodeIndexDigest,
  };
}

function rebindFoundationThreeDomainAuthoring(input: {
  authoring: DomainTeachingFragmentAuthoring;
  nodeIndexDigest: string;
}): DomainTeachingFragmentAuthoring {
  return {
    ...input.authoring,
    fragmentKey: 'foundation-three-domain-published-v2',
    nodeIndexDigest: input.nodeIndexDigest,
  };
}

function classicalAuthoring(input: {
  authorityBinding: DomainTeachingFragmentAuthoring['authorityBinding'];
  authoringRevision: string;
  captureRevision: string;
  sourceDatasetHash: string;
  nodeIndexDigest: string;
}): DomainTeachingFragmentAuthoring {
  const evidenceRefs = [
    'course-content/authoring/lessons/4-7/design/4-7-boppps.md',
    'course-content/authoring/lessons/4-7/design/4-7-handout.md',
    'course-content/authoring/lessons/4-7/design/4-7-teacher-handout.md',
  ];
  return {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: 'classical-control-published-v1',
    fragmentVersion: '1',
    domainKeys: [
      'classical-control-design',
      'frequency-domain-analysis',
      'root-locus',
    ],
    authorityBinding: input.authorityBinding,
    authoringRevision: input.authoringRevision,
    captureRevision: input.captureRevision,
    sourceDatasetHash: input.sourceDatasetHash,
    nodeIndexDigest: input.nodeIndexDigest,
    evidenceRefs,
    coreNodes: [
      {
        canonicalId: 'ctkg:v3e-canonical-504581e399675b9792ab8502',
        domainKeys: ['frequency-domain-analysis'],
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-4-frequency',
        rationale: '4-7 课案以 Bode 幅相读图解释中频相位不足，并作为传统结构定型的直接课堂证据。',
        sourceKind: 'PRIMARY_COVERS',
        sourceEvidence: [
          'course-content/authoring/lessons/4-7/design/4-7-boppps.md',
          'course-content/authoring/lessons/4-7/design/4-7-handout.md',
        ],
      },
      {
        canonicalId: 'ctkg:v3e-object-003aff0599f6e3790bfdb93a',
        domainKeys: ['root-locus'],
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-5-root-locus',
        rationale: '4-7 课案要求学生从根轨迹读出可用闭环极点受慢极点牵制，再解释传统结构选择。',
        sourceKind: 'PRIMARY_COVERS',
        sourceEvidence: [
          'course-content/authoring/lessons/4-7/design/4-7-boppps.md',
          'course-content/authoring/lessons/4-7/design/4-7-teacher-handout.md',
        ],
      },
      {
        canonicalId: 'ctc:v11g-e85c0145d63244c46853c9cf',
        domainKeys: ['classical-control-design'],
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-6-classical-design',
        rationale: '4-7 讲义将中频相位不足对应到超前支路的职责，并要求据此解释 PI 加超前的传统设计。',
        sourceKind: 'PRIMARY_COVERS',
        sourceEvidence: [
          'course-content/authoring/lessons/4-7/design/4-7-boppps.md',
          'course-content/authoring/lessons/4-7/design/4-7-handout.md',
        ],
      },
    ],
    relations: [
      {
        sourceNodeId: 'ctkg:v3e-canonical-504581e399675b9792ab8502',
        targetNodeId: 'ctc:v11g-e85c0145d63244c46853c9cf',
        relationType: 'PREREQUISITE',
        strength: 'RECOMMENDED',
        domainKeys: ['classical-control-design', 'frequency-domain-analysis'],
        evidenceRefs: [
          'course-content/authoring/lessons/4-7/design/4-7-boppps.md',
          'course-content/authoring/lessons/4-7/design/4-7-handout.md',
        ],
        curatorId: 'act.classical-control.4-7',
        curatorRationale: 'Bode 幅相读图用于解释相位不足为何需要超前支路；它是传统结构定型的直接但非唯一学习入口。',
        authorDecisionId: 'classical-4-7-bode-to-lead',
      },
      {
        sourceNodeId: 'ctkg:v3e-object-003aff0599f6e3790bfdb93a',
        targetNodeId: 'ctc:v11g-e85c0145d63244c46853c9cf',
        relationType: 'PREREQUISITE',
        strength: 'RECOMMENDED',
        domainKeys: ['classical-control-design', 'root-locus'],
        evidenceRefs: [
          'course-content/authoring/lessons/4-7/design/4-7-boppps.md',
          'course-content/authoring/lessons/4-7/design/4-7-teacher-handout.md',
        ],
        curatorId: 'act.classical-control.4-7',
        curatorRationale: '根轨迹读图用于解释可用闭环极点的约束，并与频域证据共同支撑超前支路选择；该关系保留为建议性学习依赖。',
        authorDecisionId: 'classical-4-7-root-locus-to-lead',
      },
    ],
  };
}

function assertFoundationMatchesPinnedSnapshot(input: {
  authoring: DomainTeachingFragmentAuthoring;
  manifest: AuthoritySnapshotManifest;
}): void {
  const { authoring, manifest } = input;
  if (
    authoring.authorityBinding.releaseId !== manifest.releaseId
    || authoring.authorityBinding.releaseSetId !== manifest.releaseSetId
    || authoring.authorityBinding.snapshotId !== manifest.snapshotId
    || authoring.authorityBinding.snapshotHash !== manifest.snapshotHash
    || authoring.sourceDatasetHash !== manifest.sourceDatasetHash
    || authoring.captureRevision !== manifest.captureRevision
    || authoring.authoringRevision !== manifest.captureRevision
  ) {
    throw new Error(
      'generation-2 foundation authoring does not match the pinned Authority snapshot',
    );
  }
}

export interface BuildDomainTeachingGenerationV2Input {
  repoRoot?: string;
  authoritySnapshot?: {
    manifest: AuthoritySnapshotManifest;
    engineering: AuthorityEngineeringBody;
  };
}

export function buildDomainTeachingGenerationV2(
  input: BuildDomainTeachingGenerationV2Input = {},
) {
  const repoRoot = input.repoRoot ?? process.cwd();
  const baseDirectory = path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/domain-fragments',
  );
  const foundation = readJson<DomainTeachingFragmentAuthoring>(
    path.join(baseDirectory, 'first-fragment.authoring.json'),
  );
  const snapshot = input.authoritySnapshot ?? {
    manifest: readJson<AuthoritySnapshotManifest>(
      path.join(repoRoot, PINNED_AUTHORITY_MANIFEST_RELATIVE),
    ),
    engineering: readJson<AuthorityEngineeringBody>(
      path.join(repoRoot, PINNED_AUTHORITY_ENGINEERING_RELATIVE),
    ),
  };
  verifyMaterializedSnapshot(snapshot);
  assertFoundationMatchesPinnedSnapshot({
    authoring: foundation,
    manifest: snapshot.manifest,
  });
  const authority = createDomainTeachingAuthorityEnvelope({
    binding: foundation.authorityBinding,
    sourceDatasetHash: foundation.sourceDatasetHash!,
    captureRevision: foundation.captureRevision!,
    authoringRevision: foundation.authoringRevision,
    nodes: authorityNodesFromPinnedSnapshot(snapshot.engineering),
  });
  const reboundFoundation = rebindFoundationAuthoring({
    authoring: foundation,
    nodeIndexDigest: authority.nodeIndexDigest,
  });
  const foundationThreeDomain = rebindFoundationThreeDomainAuthoring({
    authoring: buildFoundationThreeDomainArtifacts(authority).authoring,
    nodeIndexDigest: authority.nodeIndexDigest,
  });
  const classical = classicalAuthoring({
    authorityBinding: authority.binding,
    authoringRevision: authority.authoringRevision,
    captureRevision: authority.captureRevision,
    sourceDatasetHash: authority.sourceDatasetHash,
    nodeIndexDigest: authority.nodeIndexDigest,
  });
  const foundationFragment = buildDomainTeachingFragment(
    reboundFoundation,
    authority,
  );
  const foundationThreeDomainFragment = buildDomainTeachingFragment(
    foundationThreeDomain,
    authority,
  );
  const classicalFragment = buildDomainTeachingFragment(classical, authority);
  const composed = composeDomainTeachingProjection({
    fragments: [
      foundationFragment,
      foundationThreeDomainFragment,
      classicalFragment,
    ],
    authoringRevision: authority.authoringRevision,
  });

  return {
    authority,
    authoritySource: {
      contract: 'act-domain-teaching-authority-source/v1',
      sourcePath: PINNED_AUTHORITY_ENGINEERING_RELATIVE,
      extraction: 'objects[].canonicalId,lifecycleStatus||active,payload successorCanonicalId',
      nodeCount: authority.nodes.length,
      authorityBinding: authority.binding,
      sourceDatasetHash: authority.sourceDatasetHash,
      captureRevision: authority.captureRevision,
      authoringRevision: authority.authoringRevision,
      nodeIndexDigest: authority.nodeIndexDigest,
      authorityDigest: authority.authorityDigest,
    },
    foundationAuthoring: reboundFoundation,
    foundationFragment,
    foundationThreeDomainAuthoring: foundationThreeDomain,
    foundationThreeDomainFragment,
    classicalAuthoring: classical,
    classicalFragment,
    composed,
  };
}
