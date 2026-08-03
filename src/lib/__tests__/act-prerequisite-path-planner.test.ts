/**
 * ACT REQUIRED prerequisite path planner (#1275).
 */

import { describe, expect, it } from 'vitest';

import {
  ACT_PATH_RESOURCE_PRIORITY,
  ACT_PREREQUISITE_PATH_PLANNER_VERSION,
  planActPrerequisitePath,
  selectAccessibleProjectedResources,
  type ActPathPlannerInput,
  type ActPathProjectedResourceCandidate,
} from '@/lib/act-prerequisite-path-planner';

const AUTHORITY = 'ctr:release:eng-fixture-v1';
const PROJECTION = 'ctr:projection:teaching-core-v1';
const SCOPE = 'act-control-theory-core';

function projection(
  overrides: Partial<NonNullable<ActPathPlannerInput['projection']>> = {},
) {
  return {
    authorityReleaseId: AUTHORITY,
    projectionId: PROJECTION,
    projectionHash: 'proj-hash-1',
    scopeId: SCOPE,
    prerequisitePublicationId: 'prereq-pub-1',
    prerequisiteGraphIdentity: 'act-teaching-prerequisite-edges/v1',
    ...overrides,
  };
}

function core(
  canonicalId: string,
  overrides: Partial<{
    pathEligible: boolean;
    cardPolicy: string;
    projectionStatus: string;
  }> = {},
) {
  return {
    canonicalId,
    pathEligible: overrides.pathEligible ?? true,
    cardPolicy: overrides.cardPolicy ?? 'optional',
    moduleId: 'module-1',
    scopeId: SCOPE,
    projectionStatus: overrides.projectionStatus ?? 'PROJECTED',
    rationale: `core ${canonicalId}`,
  };
}

function requiredEdge(
  source: string,
  target: string,
  evidenceRef = `evidence/${source}-to-${target}.md`,
) {
  return {
    edgeId: `edge:${source}->${target}:REQUIRED`,
    sourceNodeId: source,
    targetNodeId: target,
    strength: 'REQUIRED' as const,
    layer: 'ACT_TEACHING',
    relationType: 'PREREQUISITE',
    evidenceRefs: [evidenceRef],
    scopeId: SCOPE,
  };
}

function recommendedEdge(source: string, target: string) {
  return {
    edgeId: `edge:${source}->${target}:RECOMMENDED`,
    sourceNodeId: source,
    targetNodeId: target,
    strength: 'RECOMMENDED' as const,
    layer: 'ACT_TEACHING',
    relationType: 'PREREQUISITE',
    evidenceRefs: [`advice/${source}-to-${target}.md`],
    scopeId: SCOPE,
  };
}

function resource(
  resourceId: string,
  resourceType: string,
  overrides: Partial<ActPathProjectedResourceCandidate> = {},
): ActPathProjectedResourceCandidate {
  return {
    resourceId,
    resourceType,
    resourceNodeId: `rn:${resourceId}`,
    registryId: resourceId,
    launchTarget: `/learn/${resourceId}`,
    accessible: true,
    projectionStatus: 'BOUND',
    bindingStatus: 'BOUND',
    primary: false,
    ...overrides,
  };
}

function binding(resourceId: string, canonicalId: string, primary = true) {
  return {
    bindingId: `bind:${resourceId}:${canonicalId}`,
    resourceId,
    canonicalId,
    role: 'COVERS',
    scopeId: SCOPE,
    primary,
    sourcePath: `authoring/${resourceId}`,
    rationale: 'primary covers',
  };
}

function baseInput(
  overrides: Partial<ActPathPlannerInput> = {},
): ActPathPlannerInput {
  return {
    goalCanonicalId: 'node.transfer-function',
    projection: projection(),
    prerequisites: [
      requiredEdge('node.laplace-transform', 'node.transfer-function'),
    ],
    coreNodes: [
      core('node.laplace-transform'),
      core('node.transfer-function'),
    ],
    resources: [
      resource('lesson:laplace', 'lesson'),
      resource('lesson:tf', 'lesson'),
    ],
    bindings: [
      binding('lesson:laplace', 'node.laplace-transform'),
      binding('lesson:tf', 'node.transfer-function'),
    ],
    masteredCanonicalIds: [],
    ...overrides,
  };
}

describe('ACT prerequisite path planner contract (#1275)', () => {
  it('extends planner input with Authority/Projection/scope and graph identity', () => {
    const result = planActPrerequisitePath(baseInput());
    expect(result.schemaVersion).toBe(ACT_PREREQUISITE_PATH_PLANNER_VERSION);
    expect(result.status).toBe('ready');
    expect(result.projection).toEqual(
      expect.objectContaining({
        authorityReleaseId: AUTHORITY,
        projectionId: PROJECTION,
        scopeId: SCOPE,
        prerequisiteGraphIdentity: 'act-teaching-prerequisite-edges/v1',
      }),
    );
  });

  it('blocks formal paths without projection identity', () => {
    const result = planActPrerequisitePath(
      baseInput({ projection: null }),
    );
    expect(result.status).toBe('blocked');
    expect(result.nodes).toEqual([]);
    expect(result.blocked.map((b) => b.code)).toContain(
      'missing-projection-identity',
    );
  });

  it('returns explicit compatibility fallback when allowed without projection', () => {
    const result = planActPrerequisitePath(
      baseInput({ projection: null, allowCompatibilityFallback: true }),
    );
    expect(result.status).toBe('compatibility-fallback');
    expect(result.nodes).toEqual([]);
    expect(result.blocked[0]?.code).toBe('compatibility-fallback');
  });
});

describe('REQUIRED reverse traversal and ordering (#1275)', () => {
  it('reverse-traverses unmet REQUIRED nodes and returns deterministic topo path', () => {
    const result = planActPrerequisitePath(
      baseInput({
        goalCanonicalId: 'node.block-diagram',
        prerequisites: [
          requiredEdge('node.laplace-transform', 'node.transfer-function'),
          requiredEdge('node.transfer-function', 'node.block-diagram'),
          recommendedEdge('node.stability-concept', 'node.block-diagram'),
        ],
        coreNodes: [
          core('node.laplace-transform'),
          core('node.transfer-function'),
          core('node.block-diagram'),
          core('node.stability-concept'),
        ],
        resources: [
          resource('lesson:laplace', 'lesson'),
          resource('lesson:tf', 'lesson'),
          resource('lesson:block', 'lesson'),
          resource('card:stability', 'card', { cardActive: true }),
        ],
        bindings: [
          binding('lesson:laplace', 'node.laplace-transform'),
          binding('lesson:tf', 'node.transfer-function'),
          binding('lesson:block', 'node.block-diagram'),
          binding('card:stability', 'node.stability-concept'),
        ],
      }),
    );

    expect(result.status).toBe('ready');
    expect(result.nodes.map((n) => n.canonicalId)).toEqual([
      'node.laplace-transform',
      'node.transfer-function',
      'node.block-diagram',
    ]);
    expect(result.nodes.every((n) => n.pathEligible === true)).toBe(true);
    expect(result.nodes.every((n) => n.selectedResource.resourceId)).toBe(true);
    expect(result.recommendedAnnotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strength: 'RECOMMENDED',
          sourceCanonicalId: 'node.stability-concept',
          targetCanonicalId: 'node.block-diagram',
        }),
      ]),
    );
    // RECOMMENDED does not become a hard path node.
    expect(result.nodes.map((n) => n.canonicalId)).not.toContain(
      'node.stability-concept',
    );
  });

  it('excludes mastered nodes from the executable path', () => {
    const result = planActPrerequisitePath(
      baseInput({
        masteredCanonicalIds: ['node.laplace-transform'],
      }),
    );
    expect(result.status).toBe('ready');
    expect(result.nodes.map((n) => n.canonicalId)).toEqual([
      'node.transfer-function',
    ]);
    expect(result.diagnostics.masteredExcludedCount).toBe(1);
  });

  it('uses Canonical-ID tie-breaks for deterministic order among siblings', () => {
    const result = planActPrerequisitePath(
      baseInput({
        goalCanonicalId: 'node.goal',
        prerequisites: [
          requiredEdge('node.b-second', 'node.goal'),
          requiredEdge('node.a-first', 'node.goal'),
        ],
        coreNodes: [
          core('node.a-first'),
          core('node.b-second'),
          core('node.goal'),
        ],
        resources: [
          resource('lesson:a', 'lesson'),
          resource('lesson:b', 'lesson'),
          resource('lesson:g', 'lesson'),
        ],
        bindings: [
          binding('lesson:a', 'node.a-first'),
          binding('lesson:b', 'node.b-second'),
          binding('lesson:g', 'node.goal'),
        ],
      }),
    );
    expect(result.nodes.map((n) => n.canonicalId)).toEqual([
      'node.a-first',
      'node.b-second',
      'node.goal',
    ]);
  });

  it('does not promote engineering relations to hard prerequisites', () => {
    const result = planActPrerequisitePath(
      baseInput({
        goalCanonicalId: 'node.engineering-only',
        prerequisites: [],
        coreNodes: [core('node.transfer-function')],
        resources: [resource('lesson:tf', 'lesson')],
        bindings: [binding('lesson:tf', 'node.transfer-function')],
        engineeringRelations: [
          {
            id: 'eng:assoc-1',
            predicate: 'association',
            sourceId: 'node.transfer-function',
            targetId: 'node.engineering-only',
          },
        ],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.nodes).toEqual([]);
    expect(result.blocked.map((b) => b.code)).toContain(
      'engineering-only-relation',
    );
    expect(result.engineeringContext).toHaveLength(1);
  });
});

describe('readiness and resource selection (#1275)', () => {
  it('requires pathEligible and accessible projected resources on every node', () => {
    const result = planActPrerequisitePath(
      baseInput({
        coreNodes: [
          core('node.laplace-transform', { pathEligible: false }),
          core('node.transfer-function'),
        ],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.nodes).toEqual([]);
    expect(result.blocked.map((b) => b.code)).toContain(
      'node-not-path-eligible',
    );
  });

  it('reports exact readiness blocker when no accessible resource exists', () => {
    const result = planActPrerequisitePath(
      baseInput({
        resources: [
          resource('lesson:laplace', 'lesson', { accessible: false }),
          resource('lesson:tf', 'lesson'),
        ],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.nodes).toEqual([]);
    expect(result.blocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'no-accessible-resource',
          canonicalId: 'node.laplace-transform',
        }),
      ]),
    );
  });

  it('keeps node path-eligible when optional card is missing', () => {
    const result = planActPrerequisitePath(
      baseInput({
        coreNodes: [
          core('node.laplace-transform', { cardPolicy: 'optional' }),
          core('node.transfer-function', { cardPolicy: 'optional' }),
        ],
        resources: [
          resource('handout:laplace', 'handout'),
          resource('lesson:tf', 'lesson'),
        ],
        bindings: [
          binding('handout:laplace', 'node.laplace-transform'),
          binding('lesson:tf', 'node.transfer-function'),
        ],
        cards: [],
      }),
    );
    expect(result.status).toBe('ready');
    const laplace = result.nodes.find(
      (n) => n.canonicalId === 'node.laplace-transform',
    );
    expect(laplace?.selectedResource.resourceType).toBe('handout');
    expect(laplace?.annotations.missingOptionalCard).toBe(true);
  });

  it('selects resources in defined priority order and preserves ResourceNode role/provenance', () => {
    const selection = selectAccessibleProjectedResources({
      canonicalId: 'node.tf',
      projection: projection(),
      cardPolicy: 'optional',
      candidates: [
        resource('card:tf', 'card', {
          cardActive: true,
          role: 'EXPLAINS',
        }),
        resource('textbook:tf-section', 'textbook-section', {
          role: 'COVERS',
        }),
        resource('lesson:tf', 'lesson', {
          role: 'COVERS',
          primary: true,
          provenance: {
            bindingId: 'bind:lesson:tf',
            evidenceRef: 'authoring/lesson-tf.md',
            rationale: 'primary lesson',
          },
        }),
        resource('step:tf-practice', 'step', { role: 'PRACTICES' }),
        resource('handout:tf', 'handout', { role: 'COVERS' }),
      ],
    });

    expect(selection.selected?.resourceType).toBe('lesson');
    expect(selection.selected?.resourceNodeId).toBe('rn:lesson:tf');
    expect(selection.selected?.provenance).toEqual(
      expect.objectContaining({
        authorityReleaseId: AUTHORITY,
        projectionId: PROJECTION,
        bindingId: 'bind:lesson:tf',
        evidenceRef: 'authoring/lesson-tf.md',
      }),
    );
    expect(selection.alternates.map((r) => r.resourceType)).toEqual([
      'handout',
      'step',
      'card',
      'textbook-section',
    ]);
    expect(ACT_PATH_RESOURCE_PRIORITY[0]).toBe('lesson');
  });

  it('never emits an empty executable node when resources are missing', () => {
    const result = planActPrerequisitePath(
      baseInput({
        resources: [],
        bindings: [],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.nodes).toEqual([]);
    expect(result.blocked.length).toBeGreaterThan(0);
  });

  it('reports required-binding-unresolved for unbound projected resources', () => {
    const result = planActPrerequisitePath(
      baseInput({
        resources: [
          resource('lesson:laplace', 'lesson', {
            accessible: false,
            bindingStatus: 'UNBOUND',
            projectionStatus: 'UNBOUND',
          }),
          resource('lesson:tf', 'lesson'),
        ],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.blocked.map((b) => b.code)).toContain(
      'required-binding-unresolved',
    );
  });

  it('blocks dangling REQUIRED endpoints outside the core denominator', () => {
    const result = planActPrerequisitePath(
      baseInput({
        prerequisites: [
          requiredEdge('node.unknown-upstream', 'node.transfer-function'),
        ],
        coreNodes: [core('node.transfer-function')],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.blocked.map((b) => b.code)).toContain(
      'dangling-prerequisite',
    );
  });

  it('blocks REQUIRED cycles in the planner subgraph', () => {
    const result = planActPrerequisitePath(
      baseInput({
        prerequisites: [
          requiredEdge('node.laplace-transform', 'node.transfer-function'),
          requiredEdge('node.transfer-function', 'node.laplace-transform'),
        ],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.blocked.map((b) => b.code)).toContain('required-cycle');
    expect(result.nodes).toEqual([]);
  });

  it('ignores non-PUBLISHED and stale-capture REQUIRED edges from full publication artifacts', () => {
    const published = {
      ...requiredEdge('node.laplace-transform', 'node.transfer-function'),
      status: 'PUBLISHED' as const,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'prereq-pub-1',
      edgeDigest: 'digest-published',
      authoringRevision: 'rev-1',
      curatorId: null,
      curatorRationale: null,
      authorDecisionId: null,
      candidateOrigin: null,
    };
    const candidate = {
      ...requiredEdge('node.extra-candidate', 'node.transfer-function'),
      edgeId: 'edge:candidate',
      status: 'CANDIDATE' as const,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'prereq-pub-1',
      edgeDigest: 'digest-candidate',
      authoringRevision: 'rev-1',
      curatorId: null,
      curatorRationale: null,
      authorDecisionId: null,
      candidateOrigin: 'AUTHOR',
    };
    const staleCapture = {
      ...requiredEdge('node.stale-upstream', 'node.transfer-function'),
      edgeId: 'edge:stale-capture',
      status: 'PUBLISHED' as const,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: 'prereq-pub-OLD',
      edgeDigest: 'digest-stale',
      authoringRevision: 'rev-0',
      curatorId: null,
      curatorRationale: null,
      authorDecisionId: null,
      candidateOrigin: null,
    };

    const result = planActPrerequisitePath(
      baseInput({
        prerequisites: [published, candidate, staleCapture],
        coreNodes: [
          core('node.laplace-transform'),
          core('node.transfer-function'),
          core('node.extra-candidate'),
          core('node.stale-upstream'),
        ],
        resources: [
          resource('lesson:laplace', 'lesson'),
          resource('lesson:tf', 'lesson'),
          resource('lesson:extra', 'lesson'),
          resource('lesson:stale', 'lesson'),
        ],
        bindings: [
          binding('lesson:laplace', 'node.laplace-transform'),
          binding('lesson:tf', 'node.transfer-function'),
          binding('lesson:extra', 'node.extra-candidate'),
          binding('lesson:stale', 'node.stale-upstream'),
        ],
      }),
    );

    expect(result.status).toBe('ready');
    expect(result.nodes.map((n) => n.canonicalId)).toEqual([
      'node.laplace-transform',
      'node.transfer-function',
    ]);
    expect(result.nodes.map((n) => n.canonicalId)).not.toContain(
      'node.extra-candidate',
    );
    expect(result.nodes.map((n) => n.canonicalId)).not.toContain(
      'node.stale-upstream',
    );
    expect(result.diagnostics.requiredEdgeCount).toBe(1);
  });

  it('does not borrow another node\'s canonical-tagged resources when current node has none', () => {
    const result = planActPrerequisitePath(
      baseInput({
        resources: [
          // Only goal has a tagged resource; prerequisite has none.
          resource('lesson:tf', 'lesson', {
            canonicalId: 'node.transfer-function',
          }),
        ],
        bindings: [],
        cards: [],
      }),
    );
    expect(result.status).toBe('blocked');
    expect(result.nodes).toEqual([]);
    expect(result.blocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'no-accessible-resource',
          canonicalId: 'node.laplace-transform',
        }),
      ]),
    );
  });

  it('rejects published edges whose capture id is null when projection has a publication id', () => {
    const unboundCapturePublished = {
      ...requiredEdge('node.laplace-transform', 'node.transfer-function'),
      status: 'PUBLISHED' as const,
      authorityReleaseId: AUTHORITY,
      projectionCaptureId: null,
      edgeDigest: 'digest-null-capture',
      authoringRevision: 'rev-1',
      curatorId: null,
      curatorRationale: null,
      authorDecisionId: null,
      candidateOrigin: null,
    };
    const result = planActPrerequisitePath(
      baseInput({
        prerequisites: [unboundCapturePublished],
      }),
    );
    // Goal alone may still plan if it has resources, but the unbound published
    // REQUIRED edge must not pull in the upstream prerequisite node.
    expect(result.diagnostics.requiredEdgeCount).toBe(0);
    if (result.status === 'ready') {
      expect(result.nodes.map((n) => n.canonicalId)).toEqual([
        'node.transfer-function',
      ]);
    }
  });
});
