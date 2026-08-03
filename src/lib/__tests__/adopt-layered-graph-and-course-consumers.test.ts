/**
 * Layered graph payload, scope resolver, workspace, and course drawer (#1273).
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  activateEngineeringAuthority,
  resolveAuthorityStorePaths,
  stageAuthoritySnapshot,
  type AuthoritativeKnowledgeSnapshot,
  type AuthorityStorePaths,
} from '../authoritative-knowledge';
import type { RuntimeLessonEntryBundle } from '../course-runtime';
import {
  assertNoLayerIdentityMixing,
  buildCoursePackageLayeredScope,
  buildLayeredGraphPayload,
  buildLayeredGraphWorkspaceFilterState,
  buildLayeredInspectorEvidenceGroups,
  buildLayeredNodeInspectorSections,
  buildLessonRuntimeLayeredPayload,
  buildTeachingResourceLaunchMaps,
  extractStepKnowledgeRefsFromLessonRuntime,
  filterProjectionToScope,
  layeredStatusLabel,
  resolveClassroomStepDrawer,
  resolveCourseLayeredGraph,
  resolveCoursePageLayeredDrawerEntries,
  resolveCoursePageLayeredGraphContext,
  resolveCourseScopeResources,
  resolveEngineeringOnlyLayeredGraph,
  resolveLayeredGraphAuthorityInput,
  resolveStepDrawerContent,
  resolveTeachingProjectionForScope,
  selectLayeredGraphView,
  teachingResourceTypeLabel,
  type LayeredGraphAuthorityInput,
  type LayeredGraphProjectionInput,
} from '../layered-graph';
import {
  activateTeachingProjection,
  buildTeachingProjection,
  resolveTeachingProjectionStorePaths,
  stageTeachingProjection,
  type TeachingProjectionAuthoringInput,
  type TeachingProjectionStorePaths,
} from '../teaching-projection';

const hash = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const releaseId = 'ctr:release:control-theory-engineering-v0.12';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempAuthorityRoot(): AuthorityStorePaths {
  const root = mkdtempSync(path.join(tmpdir(), 'layered-auth-'));
  tempRoots.push(root);
  return resolveAuthorityStorePaths(root);
}

function tempProjectionRoot(): TeachingProjectionStorePaths {
  const root = mkdtempSync(path.join(tmpdir(), 'layered-proj-'));
  tempRoots.push(root);
  return resolveTeachingProjectionStorePaths(root);
}

function baseSnapshot(
  overrides: Partial<AuthoritativeKnowledgeSnapshot> = {},
): AuthoritativeKnowledgeSnapshot {
  return {
    authorityState: 'candidate',
    productionAuthoritative: false,
    historical: false,
    releaseSet: {
      id: 'set-eng-1',
      controlledPath: 'course-content/authoring/knowledge/releases/lock.json',
      lockVersion: 'actkg-release-set-lock/v1',
      candidateState: 'ACCEPTED_CANDIDATE',
    },
    release: {
      id: releaseId,
      releaseSetId: 'set-eng-1',
      releaseVersion: 'v0.12',
      releaseStatus: 'RELEASED',
      protocol: 'actkg-public-bundle/1',
      authority: 'ActKG',
      scope: 'engineering',
      contractHash: hash,
      releaseHash: hash,
      schemaRawHash: hash,
      releaseRawHash: hash,
      notesRawHash: hash,
      captureRevision: commit,
      lockRawHash: hash,
      schemaVersion: '0.2.0',
      projectionId: 'proj-runtime-1',
      projectionDigest: 'c'.repeat(64),
      sourceDatasetHash: 'd'.repeat(64),
    },
    receipt: {
      id: 'receipt:eng-1',
      releaseSetId: 'set-eng-1',
      releaseId,
      sourceRun: null,
      sourceImplementationCommit: null,
      captureRevision: commit,
      lockRawHash: hash,
      ctkgDatasetAvailability: 'UNAVAILABLE',
      ctkgDatasetHash: null,
      ctkgDatasetPublicationIdentity: null,
      ctkgDatasetResolvableLocation: null,
      revisionRegistryAvailability: 'UNAVAILABLE',
      revisionRegistryVersion: null,
      revisionRegistryHash: null,
      objectCount: 3,
      sourceMappingCount: 0,
      goldRelationCount: 1,
      silverRelationCount: 0,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      candidateState: 'ACCEPTED_CANDIDATE',
      importedAt: new Date('2026-08-03T00:00:00.000Z'),
    },
    objects: [
      {
        releaseId,
        canonicalId: 'node-a',
        ordinal: 0,
        canonicalType: 'DomainConcept',
        semanticName: '稳定性',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: 'active',
        payload: {},
      },
      {
        releaseId,
        canonicalId: 'node-b',
        ordinal: 1,
        canonicalType: 'DomainConcept',
        semanticName: '时域响应',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: 'active',
        payload: {},
      },
      {
        releaseId,
        canonicalId: 'node-unrelated',
        ordinal: 2,
        canonicalType: 'Formula',
        semanticName: '未投影节点',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        lifecycleStatus: 'active',
        payload: {},
      },
    ],
    relations: [
      {
        releaseId,
        relationId: 'rel-1',
        ordinal: 0,
        qualityTier: 'GOLD',
        sourceId: 'node-a',
        targetId: 'node-b',
        relationType: 'part_of',
        reviewStatus: 'approved',
        publicationStatus: 'published',
        direct: true,
        payload: {},
      },
    ],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    releaseEntries: [
      {
        releaseId,
        entityId: 'node-a',
        ordinal: 0,
        releaseTier: 'core',
        entityRole: 'concept',
        inclusionReason: 'aggregate-membership',
        payload: {},
      },
    ],
    upstreamRagReferences: [
      {
        releaseId,
        ordinal: 0,
        publishedEntityId: 'node-a',
        retrievalChunkId: 'chunk-a',
        citationTargetId: 'cite-a',
      },
    ],
    releaseComponents: [
      {
        releaseId,
        ordinal: 0,
        componentReleaseId: 'ctr:component:core-v0.12',
        releaseVersion: 'v0.12',
        protocol: 'actkg-component/1',
        controlledPath: 'components/core',
        releaseHash: hash,
        releaseRawSha256: hash,
        sha256sumsSha256: hash,
        referenceKind: 'aggregate-member',
        componentRole: 'core',
        componentBundleId: 'bundle-core',
        componentBundleDigest: hash,
        componentManifestSha256: hash,
        payload: {},
      },
    ],
    projectionIdentities: [
      {
        releaseId,
        projectionId: 'proj-runtime-1',
        ordinal: 0,
        profile: 'runtime',
        projectionProfile: 'runtime',
        versionDigest: 'c'.repeat(64),
        sourceRelease: releaseId,
        sourceReleaseHash: hash,
        sourceDatasetHash: 'd'.repeat(64),
        nodeCount: 3,
        linkCount: 1,
        artifactPath: 'projections/runtime.jsonl',
        artifactSha256: hash,
        isRuntime: true,
        bundleReceiptId: null,
      },
    ],
    linkMetadata: [
      {
        releaseId,
        relationId: 'rel-1',
        ordinal: 0,
        releaseTier: 'core',
        sourceRelease: releaseId,
        sourceReleaseHash: hash,
        evidenceRefs: [],
        sourceComponentRelease: 'ctr:component:core-v0.12',
        targetComponentRelease: 'ctr:component:core-v0.12',
        relationComponentRelease: 'ctr:component:core-v0.12',
        profiles: ['runtime'],
        payload: {},
        bundleReceiptId: null,
      },
    ],
    ...overrides,
  };
}

function activateAuthority(paths: AuthorityStorePaths) {
  const staged = stageAuthoritySnapshot(paths, {
    snapshot: baseSnapshot(),
    deltaReceiptIds: ['delta:1'],
  });
  const activation = activateEngineeringAuthority(paths, {
    snapshotId: staged.snapshotId,
  });
  expect(activation.status).toBe('activated');
  return staged;
}

function boundAuthoring(
  overrides: Partial<TeachingProjectionAuthoringInput> = {},
): TeachingProjectionAuthoringInput {
  return {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: 'course-unit-1',
    authoringRevision: commit,
    authorityReleaseId: releaseId,
    authorityReleaseSetId: 'set-eng-1',
    authoritySnapshotHash: hash,
    resources: [
      {
        resourceType: 'step',
        lessonKey: 'lesson-02',
        stepId: 'practice-1',
        projectionMode: 'REQUIRED',
        scopeId: 'course-unit-1',
        title: '练习步骤',
        sourcePath: 'authoring/lessons/lesson-02/steps/practice-1.json',
      },
      {
        resourceType: 'handout',
        lessonKey: 'lesson-02',
        projectionMode: 'OPTIONAL',
        scopeId: 'course-unit-1',
        title: '讲义',
      },
      {
        resourceType: 'card',
        cardId: 'card-a',
        projectionMode: 'OPTIONAL',
        scopeId: 'course-unit-1',
        title: '稳定性卡片',
      },
    ],
    bindings: [
      {
        resourceId: 'act:step:lesson-02:practice-1',
        canonicalId: 'node-a',
        role: 'PRACTICES',
        scopeId: 'course-unit-1',
        primary: true,
      },
      {
        resourceId: 'act:handout:lesson-02',
        canonicalId: 'node-a',
        role: 'EXPLAINS',
        scopeId: 'course-unit-1',
        primary: false,
      },
      {
        resourceId: 'act:card:card-a',
        canonicalId: 'node-a',
        role: 'COVERS',
        scopeId: 'course-unit-1',
        primary: false,
      },
    ],
    prerequisites: [
      {
        sourceCanonicalId: 'node-b',
        targetCanonicalId: 'node-a',
        strength: 'REQUIRED',
        scopeId: 'course-unit-1',
      },
    ],
    coreNodes: [
      {
        canonicalId: 'node-a',
        pathEligible: true,
        cardPolicy: 'optional',
        scopeId: 'course-unit-1',
      },
    ],
    cards: [
      {
        cardId: 'card-a',
        canonicalId: 'node-a',
        active: true,
        required: false,
        title: '稳定性卡片',
      },
    ],
    authorityNodes: [
      { canonicalId: 'node-a', lifecycleStatus: 'active' },
      { canonicalId: 'node-b', lifecycleStatus: 'active' },
      { canonicalId: 'node-unrelated', lifecycleStatus: 'active' },
    ],
    ...overrides,
  };
}

function activateProjection(
  paths: TeachingProjectionStorePaths,
  authoring: TeachingProjectionAuthoringInput = boundAuthoring(),
) {
  const staged = stageTeachingProjection(paths, authoring);
  const activation = activateTeachingProjection(paths, {
    projectionId: staged.projectionId,
  });
  expect(activation.status).toBe('activated');
  return staged;
}

function emptyProjectionInput(
  overrides: Partial<LayeredGraphProjectionInput> = {},
): LayeredGraphProjectionInput {
  return {
    status: 'absent',
    source: 'none',
    projectionId: null,
    projectionHash: null,
    authorityReleaseId: null,
    scopeId: null,
    resources: [],
    bindings: [],
    prerequisites: [],
    coreNodes: [],
    cards: [],
    notProjectedCanonicalIds: [],
    reasons: ['test-empty'],
    fallback: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Layered payload + resolver
// ---------------------------------------------------------------------------

describe('Layered graph payload schemas (#1273)', () => {
  it('loads engineering when Teaching Projection is absent', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();

    const payload = resolveEngineeringOnlyLayeredGraph({
      authorityPaths,
      projectionPaths,
    });

    expect(payload.contract).toBe('act-layered-graph-payload/v1');
    expect(payload.engineering.identity.status).toBe('ready');
    expect(payload.engineering.nodes.length).toBeGreaterThan(0);
    expect(payload.engineering.relations[0]?.relationType).toBe('part_of');
    expect(payload.engineering.predicates).toContain('part_of');
    expect(payload.teachingPrerequisites.identity.status).toBe('absent');
    expect(payload.teachingResources.identity.status).toBe('absent');
    expect(payload.teachingPrerequisites.edges).toEqual([]);
    expect(payload.teachingResources.bindings).toEqual([]);
  });

  it('includes scoped teaching layers without rewriting engineering relations', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(projectionPaths);

    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: { scopeId: 'course-unit-1', lessonKey: 'lesson-02' },
    });

    expect(payload.engineering.identity.status).toBe('ready');
    expect(payload.teachingPrerequisites.identity.status).toBe('ready');
    expect(payload.teachingResources.identity.status).toBe('ready');
    expect(payload.teachingPrerequisites.edges).toHaveLength(1);
    expect(payload.teachingPrerequisites.edges[0]?.strength).toBe('REQUIRED');
    expect(payload.teachingResources.bindings.some((b) => b.role === 'PRACTICES')).toBe(
      true,
    );
    // Engineering predicates remain exact ActKG types — not teaching strengths.
    expect(payload.engineering.predicates).toEqual(['part_of']);
    expect(
      payload.teachingPrerequisites.edges.every((e) =>
        ['REQUIRED', 'RECOMMENDED'].includes(e.strength),
      ),
    ).toBe(true);
    expect(assertNoLayerIdentityMixing(payload).ok).toBe(true);
  });

  it('reports NOT_PROJECTED for scopes missing from the active projection', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(projectionPaths);

    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: { scopeId: 'other-course' },
    });

    expect(payload.engineering.identity.status).toBe('ready');
    expect(payload.teachingResources.identity.status).toBe('NOT_PROJECTED');
    expect(payload.teachingPrerequisites.identity.status).toBe('NOT_PROJECTED');
    expect(payload.teachingResources.bindings).toEqual([]);
  });

  it('fails closed on authority/projection identity drift for teaching only', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(
      projectionPaths,
      boundAuthoring({ authorityReleaseId: 'ctr:release:other' }),
    );

    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: { scopeId: 'course-unit-1' },
    });

    expect(payload.engineering.identity.status).toBe('ready');
    expect(payload.teachingResources.identity.status).toBe('identity-drift');
    expect(payload.teachingResources.bindings).toEqual([]);
    expect(payload.teachingResources.identity.reasons.join(' ')).toMatch(
      /mismatch/i,
    );
  });

  it('does not mix candidate resources with Legacy fallback data', () => {
    const projectionPaths = tempProjectionRoot();
    // No active projection; provide legacy only.
    const legacyArtifacts = buildTeachingProjection(boundAuthoring());
    const projection = resolveTeachingProjectionForScope({
      projectionPaths,
      request: {
        scope: { scopeId: 'course-unit-1' },
        includeTeaching: true,
        candidateProjectionId: 'missing-candidate',
        allowLegacyFallback: true,
      },
      legacyProjection: {
        projectionId: 'legacy-proj',
        projectionHash: 'legacy-hash',
        authorityReleaseId: releaseId,
        scopeId: 'course-unit-1',
        resources: legacyArtifacts.resources,
        bindings: legacyArtifacts.bindings,
        prerequisites: legacyArtifacts.prerequisites,
        coreNodes: legacyArtifacts.coreNodes,
        cards: legacyArtifacts.cardsIndex.cards,
      },
    });

    expect(projection.status).toBe('fallback');
    expect(projection.source).toBe('legacy');
    expect(projection.fallback?.kind).toBe('legacy');
    expect(projection.fallback?.adapterId).toBe('legacy-runtime-projection');
    expect(projection.projectionId).toBe('legacy-proj');
    // Single identity only — not a union with a phantom candidate.
    expect(projection.reasons).toContain('using-explicit-legacy-fallback');
    expect(projection.reasons.some((r) => r.includes('candidate'))).toBe(true);
  });

  it('keeps unprojected Authority nodes as diagnostics, not missing nodes', () => {
    const projectionPaths = tempProjectionRoot();
    activateProjection(projectionPaths);
    const projection = resolveTeachingProjectionForScope({
      projectionPaths,
      request: {
        scope: { scopeId: 'course-unit-1' },
        includeTeaching: true,
      },
    });
    expect(projection.notProjectedCanonicalIds).toContain('node-unrelated');
    expect(projection.bindings.every((b) => b.canonicalId !== 'node-unrelated')).toBe(
      true,
    );
  });
});

describe('Scope-aware Teaching Projection resolver (#1273)', () => {
  it('filters resources and bindings to the requested lesson/step scope', () => {
    const artifacts = buildTeachingProjection(boundAuthoring());
    const scoped = filterProjectionToScope({
      resources: artifacts.resources,
      bindings: artifacts.bindings,
      prerequisites: artifacts.prerequisites,
      coreNodes: artifacts.coreNodes,
      cards: artifacts.cardsIndex.cards,
      notProjectedCanonicalIds: artifacts.gate.notProjectedCanonicalIds,
      scope: {
        scopeId: 'course-unit-1',
        lessonKey: 'lesson-02',
        stepId: 'practice-1',
      },
    });

    expect(scoped.resources.some((r) => r.resourceId.includes('practice-1'))).toBe(
      true,
    );
    expect(scoped.bindings.some((b) => b.canonicalId === 'node-a')).toBe(true);
    expect(scoped.prerequisites).toHaveLength(1);
  });

  it('uses pinned previous when active projection is missing', () => {
    const projectionPaths = tempProjectionRoot();
    const staged = stageTeachingProjection(projectionPaths, boundAuthoring());
    // Do not activate — pin explicitly.
    const projection = resolveTeachingProjectionForScope({
      projectionPaths,
      request: {
        scope: { scopeId: 'course-unit-1' },
        includeTeaching: true,
        pinnedProjectionId: staged.projectionId,
        pinnedProjectionHash: staged.projectionHash,
      },
    });

    expect(projection.status).toBe('fallback');
    expect(projection.source).toBe('pinned');
    expect(projection.fallback?.kind).toBe('pinned-previous');
    expect(projection.projectionId).toBe(staged.projectionId);
    expect(projection.bindings.length).toBeGreaterThan(0);
  });

  it('loads pinned projection when candidateProjectionId is missing', () => {
    const projectionPaths = tempProjectionRoot();
    const staged = stageTeachingProjection(projectionPaths, boundAuthoring());

    const projection = resolveTeachingProjectionForScope({
      projectionPaths,
      request: {
        scope: { scopeId: 'course-unit-1' },
        includeTeaching: true,
        candidateProjectionId: 'missing-candidate-projection',
        pinnedProjectionId: staged.projectionId,
        pinnedProjectionHash: staged.projectionHash,
        requiredAuthorityReleaseId: releaseId,
      },
    });

    expect(projection.status).toBe('fallback');
    expect(projection.source).toBe('pinned');
    expect(projection.projectionId).toBe(staged.projectionId);
    expect(projection.bindings.length).toBeGreaterThan(0);
    expect(projection.fallback?.kind).toBe('pinned-previous');
  });

  it('fails closed when pinned projection Authority or scope drifts', () => {
    const projectionPaths = tempProjectionRoot();
    const wrongAuthority = stageTeachingProjection(
      projectionPaths,
      boundAuthoring({ authorityReleaseId: 'ctr:release:other-authority' }),
    );
    const wrongScope = stageTeachingProjection(
      projectionPaths,
      boundAuthoring({ scopeId: 'other-course-scope' }),
    );

    const authorityDrift = resolveTeachingProjectionForScope({
      projectionPaths,
      request: {
        scope: { scopeId: 'course-unit-1' },
        includeTeaching: true,
        pinnedProjectionId: wrongAuthority.projectionId,
        pinnedProjectionHash: wrongAuthority.projectionHash,
        requiredAuthorityReleaseId: releaseId,
      },
    });
    expect(authorityDrift.status).toBe('identity-drift');
    expect(authorityDrift.bindings).toEqual([]);
    expect(authorityDrift.reasons.join(' ')).toMatch(/pinned-authority-release-mismatch/);

    const scopeDrift = resolveTeachingProjectionForScope({
      projectionPaths,
      request: {
        scope: { scopeId: 'course-unit-1' },
        includeTeaching: true,
        pinnedProjectionId: wrongScope.projectionId,
        pinnedProjectionHash: wrongScope.projectionHash,
        requiredAuthorityReleaseId: releaseId,
      },
    });
    expect(scopeDrift.status).toBe('NOT_PROJECTED');
    expect(scopeDrift.bindings).toEqual([]);
    expect(scopeDrift.reasons.join(' ')).toMatch(/pinned-scope-mismatch/);
  });
});

// ---------------------------------------------------------------------------
// 2. Workspace filters / inspector
// ---------------------------------------------------------------------------

describe('Layered graph workspace filters and inspector (#1273)', () => {
  function readyPayload() {
    const authority: LayeredGraphAuthorityInput = {
      status: 'ready',
      releaseId,
      releaseSetId: 'set-eng-1',
      snapshotId: 'snap-1',
      snapshotHash: hash,
      engineering: {
        objects: [
          {
            canonicalId: 'node-a',
            ordinal: 0,
            canonicalType: 'DomainConcept',
            semanticName: '稳定性',
            reviewStatus: 'accepted',
            publicationStatus: 'published',
            lifecycleStatus: 'active',
            payload: {},
          },
        ],
        relations: [
          {
            relationId: 'rel-1',
            ordinal: 0,
            qualityTier: 'core',
            sourceId: 'node-a',
            targetId: 'node-b',
            relationType: 'part_of',
            reviewStatus: 'accepted',
            publicationStatus: 'published',
            direct: true,
            payload: {},
          },
        ],
      },
    };
    const artifacts = buildTeachingProjection(boundAuthoring());
    const projection: LayeredGraphProjectionInput = {
      status: 'ready',
      source: 'active',
      projectionId: artifacts.manifest.projectionId,
      projectionHash: artifacts.manifest.projectionHash,
      authorityReleaseId: releaseId,
      scopeId: 'course-unit-1',
      resources: artifacts.resources,
      bindings: artifacts.bindings,
      prerequisites: artifacts.prerequisites,
      coreNodes: artifacts.coreNodes,
      cards: artifacts.cardsIndex.cards,
      notProjectedCanonicalIds: artifacts.gate.notProjectedCanonicalIds,
      reasons: ['active-projection-ready'],
      fallback: null,
    };
    return buildLayeredGraphPayload({
      authority,
      projection,
      request: { scope: { scopeId: 'course-unit-1' }, includeTeaching: true },
    });
  }

  it('supports engineering-only filter without dropping predicate vocabulary', () => {
    const payload = readyPayload();
    const filter = buildLayeredGraphWorkspaceFilterState('engineering-only');
    const view = selectLayeredGraphView({ payload, filter });

    expect(view.engineeringRelations).toHaveLength(1);
    expect(view.teachingEdges).toEqual([]);
    expect(view.resourceBindings).toEqual([]);
    expect(view.engineeringPredicates).toEqual(['part_of']);
  });

  it('supports teaching-only and mixed filters', () => {
    const payload = readyPayload();
    const teaching = selectLayeredGraphView({
      payload,
      filter: buildLayeredGraphWorkspaceFilterState('teaching-only'),
    });
    expect(teaching.engineeringRelations).toEqual([]);
    expect(teaching.teachingEdges.length).toBeGreaterThan(0);

    const mixed = selectLayeredGraphView({
      payload,
      filter: buildLayeredGraphWorkspaceFilterState('mixed'),
    });
    expect(mixed.engineeringRelations.length).toBeGreaterThan(0);
    expect(mixed.teachingEdges.length).toBeGreaterThan(0);
    expect(mixed.resourceBindings.length).toBeGreaterThan(0);
  });

  it('inspector shows resource roles, prerequisite strength, card status, and fallback', () => {
    const payload = readyPayload();
    const sections = buildLayeredNodeInspectorSections({
      payload,
      canonicalId: 'node-a',
    });
    expect(sections.engineering.present).toBe(true);
    expect(sections.engineering.relations[0]?.relationType).toBe('part_of');
    expect(sections.teachingPrerequisites.incoming[0]?.strength).toBe('REQUIRED');
    expect(sections.teachingResources.bindings.some((b) => b.role === 'EXPLAINS')).toBe(
      true,
    );
    expect(sections.teachingResources.optionalCardStatus).toBe('active');

    const groups = buildLayeredInspectorEvidenceGroups({
      payload,
      canonicalId: 'node-a',
    });
    expect(groups.groups.map((g) => g.id)).toEqual(
      expect.arrayContaining([
        'engineering-relations',
        'teaching-prerequisites',
        'teaching-resources',
        'projection-identity',
      ]),
    );
  });

  it('marks Authority-only nodes as NOT_PROJECTED in the current course scope', () => {
    const payload = readyPayload();
    const sections = buildLayeredNodeInspectorSections({
      payload,
      canonicalId: 'node-unrelated',
    });
    // node-unrelated is not in engineering fixture of readyPayload — inject via empty
    // teaching with engineering present.
    const authority: LayeredGraphAuthorityInput = {
      status: 'ready',
      releaseId,
      releaseSetId: 'set-eng-1',
      snapshotId: 'snap-1',
      snapshotHash: hash,
      engineering: {
        objects: [
          {
            canonicalId: 'node-unrelated',
            ordinal: 0,
            canonicalType: 'Formula',
            semanticName: '未投影',
            reviewStatus: 'accepted',
            publicationStatus: 'published',
            lifecycleStatus: 'active',
            payload: {},
          },
        ],
        relations: [],
      },
    };
    const projection = emptyProjectionInput({
      status: 'ready',
      source: 'active',
      projectionId: 'proj-x',
      projectionHash: hash,
      authorityReleaseId: releaseId,
      scopeId: 'course-unit-1',
      reasons: ['ready'],
      notProjectedCanonicalIds: ['node-unrelated'],
    });
    const layered = buildLayeredGraphPayload({
      authority,
      projection,
      request: { scope: { scopeId: 'course-unit-1' }, includeTeaching: true },
    });
    const inspector = buildLayeredNodeInspectorSections({
      payload: layered,
      canonicalId: 'node-unrelated',
    });
    expect(inspector.engineering.present).toBe(true);
    expect(inspector.teachingResources.status).toBe('NOT_PROJECTED');
    expect(sections).toBeTruthy();
  });

  it('surfaces unavailable projection status in workspace view', () => {
    const authority: LayeredGraphAuthorityInput = {
      status: 'ready',
      releaseId,
      releaseSetId: 'set-eng-1',
      snapshotId: 'snap-1',
      snapshotHash: hash,
      engineering: { objects: [], relations: [] },
    };
    const projection = emptyProjectionInput({
      status: 'unavailable',
      reasons: ['candidate-projection-unavailable'],
    });
    const payload = buildLayeredGraphPayload({ authority, projection });
    const view = selectLayeredGraphView({
      payload,
      filter: buildLayeredGraphWorkspaceFilterState('all'),
    });
    expect(view.layerStatuses.teachingResources).toBe('unavailable');
    expect(layeredStatusLabel('unavailable')).toBe('暂不可用');
    expect(layeredStatusLabel('NOT_PROJECTED')).toBe('未投影到当前课程');
  });
});

// ---------------------------------------------------------------------------
// 3. Course / classroom drawer consumers
// ---------------------------------------------------------------------------

describe('Course and classroom layered consumers (#1273)', () => {
  it('wires course lesson/step scope to Teaching Projection resource resolution', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(projectionPaths);

    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: {
        scopeId: 'course-unit-1',
        lessonKey: 'lesson-02',
        stepId: 'practice-1',
        knowledgeRefs: ['node-a'],
      },
    });
    const scoped = resolveCourseScopeResources({
      payload,
      lessonKey: 'lesson-02',
      stepId: 'practice-1',
    });

    expect(scoped.status).toBe('ready');
    expect(scoped.projectionId).toBeTruthy();
    expect(scoped.bindings.some((b) => b.canonicalId === 'node-a')).toBe(true);
    expect(
      scoped.resources.some((r) => r.resourceId === 'act:step:lesson-02:practice-1'),
    ).toBe(true);
  });

  it('resolves step → canonicalId → optional card without node-not-found on card absence', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(
      projectionPaths,
      boundAuthoring({
        cards: [
          {
            cardId: 'card-a',
            canonicalId: 'node-a',
            active: false,
            required: false,
            title: 'inactive',
          },
        ],
      }),
    );

    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: {
        scopeId: 'course-unit-1',
        knowledgeRefs: ['node-a'],
      },
    });

    const drawer = resolveStepDrawerContent({
      payload,
      stepId: 'practice-1',
      knowledgeRefs: ['node-a'],
      resourceLaunchTargets: {
        'act:handout:lesson-02': '/interactive-learning/courses/lesson-02',
        'act:step:lesson-02:practice-1':
          '/interactive-learning/courses/unit-1-2/steps/practice-1',
      },
      resourceRegistryIds: {
        'act:step:lesson-02:practice-1': 'unit-1-2-practice-1',
      },
    });

    expect(drawer).not.toBeNull();
    expect(drawer!.nodeNotFound).toBe(false);
    expect(drawer!.cardStatus).toMatch(/card-absent|inactive-card/);
    expect(drawer!.summary.presentInEngineering).toBe(true);
    expect(drawer!.summary.title).toBeTruthy();
    expect(drawer!.linkedResources.length).toBeGreaterThan(0);
    expect(drawer!.studentMessage).not.toMatch(/node-not-found|未找到节点/i);
  });

  it('launches resources through provided registry/routes and keeps student messages clean', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(projectionPaths);

    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: { scopeId: 'course-unit-1', knowledgeRefs: ['node-a'] },
    });

    const drawer = resolveClassroomStepDrawer({
      payload,
      stepId: 'practice-1',
      knowledgeRefs: ['node-a'],
      resourceLaunchTargets: {
        'act:handout:lesson-02': '/courses/lesson-02/handout',
      },
      resourceRegistryIds: {
        'act:handout:lesson-02': 'handout-lesson-02',
      },
    });

    expect(drawer).not.toBeNull();
    expect(drawer!.cardStatus).toBe('active-card');
    const handout = drawer!.linkedResources.find(
      (r) => r.resourceId === 'act:handout:lesson-02',
    );
    expect(handout?.launch.href).toBe('/courses/lesson-02/handout');
    expect(handout?.launch.registryId).toBe('handout-lesson-02');
    expect(handout?.launch.source).toBe('authoritative');
    // No student-facing implementation leakage.
    expect(drawer!.studentMessage).not.toMatch(/Rust|WASM|AuthoritySnapshot|projectionHash/i);
    expect(teachingResourceTypeLabel('handout')).toBe('讲义');
  });

  it('does not invent launch routes from ActKG node IDs', () => {
    const authority: LayeredGraphAuthorityInput = {
      status: 'ready',
      releaseId,
      releaseSetId: 'set-eng-1',
      snapshotId: 'snap-1',
      snapshotHash: hash,
      engineering: {
        objects: [
          {
            canonicalId: 'node-a',
            ordinal: 0,
            canonicalType: 'DomainConcept',
            semanticName: '稳定性',
            reviewStatus: 'accepted',
            publicationStatus: 'published',
            lifecycleStatus: 'active',
            payload: {},
          },
        ],
        relations: [],
      },
    };
    const artifacts = buildTeachingProjection(boundAuthoring());
    const payload = buildLayeredGraphPayload({
      authority,
      projection: {
        status: 'ready',
        source: 'active',
        projectionId: artifacts.manifest.projectionId,
        projectionHash: artifacts.manifest.projectionHash,
        authorityReleaseId: releaseId,
        scopeId: 'course-unit-1',
        resources: artifacts.resources,
        bindings: artifacts.bindings,
        prerequisites: artifacts.prerequisites,
        coreNodes: artifacts.coreNodes,
        cards: artifacts.cardsIndex.cards,
        notProjectedCanonicalIds: [],
        reasons: ['ready'],
        fallback: null,
      },
      request: { scope: { scopeId: 'course-unit-1' }, includeTeaching: true },
    });

    const drawer = resolveStepDrawerContent({
      payload,
      knowledgeRefs: ['node-a'],
      // No launch targets provided — must not invent from node-a.
      resourceLaunchTargets: {},
    });

    expect(drawer).not.toBeNull();
    for (const resource of drawer!.linkedResources) {
      expect(resource.launch.href).toBeNull();
      expect(resource.launch.href).not.toBe(`/knowledge/${drawer!.canonicalId}`);
      expect(resource.launch.href).not.toBe(`node-a`);
    }
  });
});

describe('Authority input adapter (#1273)', () => {
  it('reports unavailable authority without throwing', () => {
    const authorityPaths = tempAuthorityRoot();
    const input = resolveLayeredGraphAuthorityInput(authorityPaths);
    expect(input.status).toBe('unavailable');
    expect(input.engineering).toBeNull();
  });
});

describe('assertNoLayerIdentityMixing covers fallback layers (#1273 P1)', () => {
  it('flags Authority release mixing on fallback teaching layers', () => {
    const payload = buildLayeredGraphPayload({
      authority: {
        status: 'ready',
        releaseId,
        releaseSetId: 'set-eng-1',
        snapshotId: 'snap-1',
        snapshotHash: hash,
        engineering: { objects: [], relations: [] },
      },
      projection: {
        status: 'fallback',
        source: 'pinned',
        projectionId: 'pin-proj',
        projectionHash: hash,
        authorityReleaseId: 'ctr:release:other',
        scopeId: 'course-unit-1',
        resources: [],
        bindings: [],
        prerequisites: [],
        coreNodes: [],
        cards: [],
        notProjectedCanonicalIds: [],
        reasons: ['pinned-previous-projection'],
        fallback: {
          kind: 'pinned-previous',
          adapterId: 'pinned-previous-projection',
          authorityReleaseId: 'ctr:release:other',
          projectionId: 'pin-proj',
          projectionHash: hash,
          scopeId: 'course-unit-1',
          reasons: ['using-pinned-previous-projection'],
        },
      },
      request: {
        scope: { scopeId: 'course-unit-1' },
        includeTeaching: true,
        requiredAuthorityReleaseId: releaseId,
      },
    });

    const result = assertNoLayerIdentityMixing(payload);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes('engineering-teaching-release-mismatch'))).toBe(
      true,
    );
  });
});

describe('Course page layered drawer entry (#1273 P1)', () => {
  function minimalLessonRuntime(): RuntimeLessonEntryBundle {
    return {
      lesson: {
        lesson_id: '1-1',
        title: '看见控制全貌',
        card_order: ['反馈_1_1'],
      },
      graphOverlay: {
        lesson_id: '1-1',
        focus_node_ids: ['反馈_1_1'],
        card_order: ['反馈_1_1'],
        groups: [
          {
            group_name: '反馈',
            step_ids: ['step-09'],
            node_ids: ['反馈_1_1', '闭环控制_1_1'],
          },
        ],
        nodes: [
          {
            id: '反馈_1_1',
            name: '反馈',
            nodeType: 'THEORY',
            description: '反馈思想',
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            resources: [],
            frontContent: '反馈思想',
          },
          {
            id: '闭环控制_1_1',
            name: '闭环控制',
            nodeType: 'THEORY',
            description: '闭环',
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            resources: [],
            frontContent: '闭环',
          },
        ],
        links: [],
      },
      handoutPath: '',
      handoutSourcePath: '',
      handoutPdfPath: null,
      handoutPreview: '',
      handoutSummary: '',
      mediaResources: [],
      interactiveManifest: null,
    };
  }

  it('extracts step knowledgeRefs and resolves layered drawer entries for page path', () => {
    const lessonRuntime = minimalLessonRuntime();
    const orderedStepIds = ['step-09'];
    const refs = extractStepKnowledgeRefsFromLessonRuntime(
      lessonRuntime,
      'step-09',
      orderedStepIds,
    );
    expect(refs).toEqual(['反馈_1_1', '闭环控制_1_1']);

    const entries = resolveCoursePageLayeredDrawerEntries({
      lessonRuntime,
      currentStepId: 'step-09',
      orderedStepIds,
      scope: {
        scopeId: 'course:1-1',
        lessonKey: '1-1',
        stepId: 'step-09',
      },
    });

    expect(entries.length).toBe(2);
    expect(entries.every((entry) => entry.nodeNotFound === false)).toBe(true);
    expect(entries[0]?.summary.title).toBe('反馈');
    expect(entries[0]?.fallback?.adapterId).toBe('legacy-lesson-runtime-graph-overlay');
    expect(buildLessonRuntimeLayeredPayload({
      lessonRuntime,
      scope: { scopeId: 'course:1-1', lessonKey: '1-1' },
    }).teachingResources.identity.status).toBe('fallback');
  });

  it('uses Teaching Projection payload when provided to the course page helper', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(projectionPaths);

    const payload = resolveCourseLayeredGraph({
      authorityPaths,
      projectionPaths,
      scope: {
        scopeId: 'course-unit-1',
        knowledgeRefs: ['node-a'],
      },
    });

    const lessonRuntime = minimalLessonRuntime();
    // Override overlay refs to teaching projection canonical ids.
    lessonRuntime.graphOverlay.groups = [
      {
        group_name: 'practice',
        step_ids: ['step-09'],
        node_ids: ['node-a'],
      },
    ];
    lessonRuntime.graphOverlay.nodes = [
      {
        id: 'node-a',
        name: '稳定性',
        nodeType: 'THEORY',
        description: 'from overlay',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        resources: [],
        frontContent: 'from overlay',
      },
    ];

    const entries = resolveCoursePageLayeredDrawerEntries({
      lessonRuntime,
      currentStepId: 'step-09',
      orderedStepIds: ['step-09'],
      scope: { scopeId: 'course-unit-1', stepId: 'step-09' },
      payload,
      resourceLaunchTargets: {
        'act:handout:lesson-02': '/courses/lesson-02/handout',
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.canonicalId).toBe('node-a');
    expect(entries[0]?.cardStatus).toBe('active-card');
    expect(entries[0]?.nodeNotFound).toBe(false);
  });

  it('ships unit-1-1 student and teacher pages through layered drawer entries', () => {
    const repoRoot = process.cwd();
    const student = readFileSync(
      path.join(repoRoot, 'src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx'),
      'utf8',
    );
    const teacher = readFileSync(
      path.join(repoRoot, 'src/features/interactive/unit-1-1-see-the-full-picture/teacher-page.tsx'),
      'utf8',
    );
    const studentRoute = readFileSync(
      path.join(
        repoRoot,
        'src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]/page.tsx',
      ),
      'utf8',
    );
    const teacherRoute = readFileSync(
      path.join(
        repoRoot,
        'src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]/page.tsx',
      ),
      'utf8',
    );

    for (const source of [student, teacher]) {
      expect(source).toContain('resolveCoursePageLayeredDrawerEntries');
      expect(source).toContain('layeredDrawerEntries={layeredDrawerEntries}');
      expect(source).toContain('StepKnowledgeDrawer');
      expect(source).toContain('payload: layeredGraphPayload');
      expect(source).toContain('resourceLaunchTargets: layeredResourceLaunchTargets');
      expect(source).toContain('resourceRegistryIds: layeredResourceRegistryIds');
      expect(source).toContain('buildCoursePackageLayeredScope');
    }
    // Shipped App Router entries resolve Teaching Projection server-side.
    for (const route of [studentRoute, teacherRoute]) {
      expect(route).toContain('resolveCoursePageLayeredGraphContext');
      expect(route).toContain('layeredGraphPayload={layeredGraphContext.payload}');
      expect(route).toContain('layeredResourceLaunchTargets=');
      expect(route).toContain('layeredResourceRegistryIds=');
    }
    expect(studentRoute).toContain('UNIT_1_1StudentPage');
    expect(studentRoute).toContain("loadLessonRuntimeEntry('1-1')");
    expect(teacherRoute).toContain('UNIT_1_1TeacherPage');
  });

  it('server page context resolves non-empty active Teaching Projection payload with launch targets', () => {
    const authorityPaths = tempAuthorityRoot();
    activateAuthority(authorityPaths);
    const projectionPaths = tempProjectionRoot();
    activateProjection(
      projectionPaths,
      boundAuthoring({
        scopeId: 'course-package:1-1',
        resources: [
          {
            resourceType: 'step',
            lessonKey: '1-1',
            stepId: 'step-09',
            projectionMode: 'REQUIRED',
            scopeId: 'course-package:1-1',
            title: '反馈练习',
          },
          {
            resourceType: 'handout',
            lessonKey: '1-1',
            projectionMode: 'OPTIONAL',
            scopeId: 'course-package:1-1',
            title: '1-1 讲义',
          },
          {
            resourceType: 'card',
            cardId: 'card-feedback',
            projectionMode: 'OPTIONAL',
            scopeId: 'course-package:1-1',
            title: '反馈卡片',
          },
        ],
        bindings: [
          {
            resourceId: 'act:step:1-1:step-09',
            canonicalId: 'node-a',
            role: 'PRACTICES',
            scopeId: 'course-package:1-1',
            primary: true,
          },
          {
            resourceId: 'act:handout:1-1',
            canonicalId: 'node-a',
            role: 'EXPLAINS',
            scopeId: 'course-package:1-1',
            primary: false,
          },
          {
            resourceId: 'act:card:card-feedback',
            canonicalId: 'node-a',
            role: 'COVERS',
            scopeId: 'course-package:1-1',
            primary: false,
          },
        ],
        coreNodes: [
          {
            canonicalId: 'node-a',
            pathEligible: true,
            cardPolicy: 'optional',
            scopeId: 'course-package:1-1',
          },
        ],
        cards: [
          {
            cardId: 'card-feedback',
            canonicalId: 'node-a',
            active: true,
            required: false,
            title: '反馈卡片',
          },
        ],
      }),
    );

    const scope = buildCoursePackageLayeredScope({
      packageCanonicalId: '1-1',
      lessonKey: '1-1',
      stepId: 'step-09',
      knowledgeRefs: ['node-a'],
    });

    const context = resolveCoursePageLayeredGraphContext({
      scope,
      authorityPaths,
      projectionPaths,
      allowLegacyFallback: false,
    });

    expect(context.hasTeachingProjection).toBe(true);
    expect(context.payload.teachingResources.identity.status).toBe('ready');
    expect(context.payload.teachingResources.resources.length).toBeGreaterThan(0);
    expect(context.payload.teachingResources.bindings.length).toBeGreaterThan(0);
    expect(context.payload.teachingResources.cards.length).toBeGreaterThan(0);
    expect(context.payload.engineering.identity.status).toBe('ready');
    // Not the empty lesson-runtime Legacy adapter.
    expect(context.payload.fallback).toBeNull();
    expect(context.payload.teachingResources.identity.projectionId).not.toMatch(
      /^legacy-runtime-graph-overlay:/,
    );

    expect(context.resourceLaunchTargets['act:handout:1-1']).toBe(
      '/interactive-learning/lessons/1-1/handout-print',
    );
    expect(context.resourceLaunchTargets['act:step:1-1:step-09']).toContain(
      '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo?step=step-09',
    );
    expect(context.resourceRegistryIds['act:step:1-1:step-09']).toBe(
      'unit-1-1-see-the-full-picture:step-09',
    );

    const lessonRuntime = minimalLessonRuntime();
    lessonRuntime.graphOverlay.groups = [
      {
        group_name: 'practice',
        step_ids: ['step-09'],
        node_ids: ['node-a'],
      },
    ];
    lessonRuntime.graphOverlay.nodes = [
      {
        id: 'node-a',
        name: '稳定性',
        nodeType: 'THEORY',
        description: 'from overlay',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        resources: [],
        frontContent: 'from overlay',
      },
    ];

    const entries = resolveCoursePageLayeredDrawerEntries({
      lessonRuntime,
      currentStepId: 'step-09',
      orderedStepIds: ['step-09'],
      scope,
      payload: context.payload,
      resourceLaunchTargets: context.resourceLaunchTargets,
      resourceRegistryIds: context.resourceRegistryIds,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.cardStatus).toBe('active-card');
    expect(entries[0]?.fallback).toBeNull();
    expect(entries[0]?.linkedResources.length).toBeGreaterThan(0);
    const handout = entries[0]?.linkedResources.find(
      (resource) => resource.resourceId === 'act:handout:1-1',
    );
    expect(handout?.launch.href).toBe('/interactive-learning/lessons/1-1/handout-print');
    expect(handout?.launch.registryId).toBe('handout:1-1');
  });

  it('buildTeachingResourceLaunchMaps uses registry routes and never Canonical node IDs', () => {
    const maps = buildTeachingResourceLaunchMaps([
      {
        resourceId: 'act:lesson:1-1',
        resourceType: 'lesson',
        projectionMode: 'OPTIONAL',
        scopeId: 'course-package:1-1',
        title: '1-1',
        sourcePath: null,
        legacyCrosswalkRef: null,
        bindingCount: 0,
        bindingStatus: 'BOUND',
        projectionStatus: 'BOUND',
        bindingDigest: null,
      },
      {
        resourceId: 'act:step:1-1:step-01',
        resourceType: 'step',
        projectionMode: 'OPTIONAL',
        scopeId: 'course-package:1-1',
        title: 'step',
        sourcePath: null,
        legacyCrosswalkRef: null,
        bindingCount: 0,
        bindingStatus: 'BOUND',
        projectionStatus: 'BOUND',
        bindingDigest: null,
      },
    ]);

    expect(maps.resourceLaunchTargets['act:lesson:1-1']).toBe(
      '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    );
    expect(maps.resourceLaunchTargets['act:step:1-1:step-01']).not.toBe('node-a');
    expect(maps.resourceLaunchTargets['act:step:1-1:step-01']).not.toMatch(
      /^\/knowledge\//,
    );
  });
});
