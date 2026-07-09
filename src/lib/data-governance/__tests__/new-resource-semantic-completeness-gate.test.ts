import { describe, expect, it } from 'vitest';

import type { RegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import type { RuntimeResourceProjectionInput } from '@/lib/resource-node-registry';
import {
  parseAddedRuntimeProjectionChanges,
  parseAddedRuntimeProjectionRows,
  parseChangedRegisteredResourceIds,
  validateChangedRegisteredResources,
  validateChangedRuntimeResourceProjections,
} from '@/lib/data-governance/new-resource-semantic-completeness-gate';

describe('new resource semantic completeness gate', () => {
  it('detects modified registered resource records from diff hunks', () => {
    const source = [
      'const registeredResourceMetadata = {',
      "    'existing-resource': {",
      "        id: 'existing-resource',",
      "        label: 'Existing',",
      '    },',
      "    'new-resource': {",
      "        id: 'new-resource',",
      "        label: 'New',",
      '    },',
      '};',
    ].join('\n');
    const diff = [
      '@@ -7,0 +8,1 @@',
      '+        planningOverride: {},',
    ].join('\n');

    expect(parseChangedRegisteredResourceIds(source, diff)).toEqual(['new-resource']);
  });

  it('ignores deletion-only hunks when mapping current registered resource ranges', () => {
    const source = [
      'const registeredResourceMetadata = {',
      "    'historical-neighbor': {",
      "        id: 'historical-neighbor',",
      "        label: 'Historical neighbor',",
      '    },',
      '};',
    ].join('\n');
    const diff = [
      '@@ -2,4 +2,0 @@',
      "-    'deleted-resource': {",
      "-        id: 'deleted-resource',",
      "-        label: 'Deleted resource',",
      '-    },',
    ].join('\n');

    expect(parseChangedRegisteredResourceIds(source, diff)).toEqual([]);
  });

  it('detects registered resource ids changed through progression metadata arrays', () => {
    const source = [
      'const registeredResourceMetadata = {',
      "    'lesson01-feedback-bridge-v1': {",
      "        id: 'lesson01-feedback-bridge-v1',",
      "        label: 'Bridge',",
      '    },',
      '};',
      'function buildRegisteredResourceProgressionMetadata() {',
      "    const ids = ['lesson01-feedback-bridge-v1'];",
      '}',
    ].join('\n');
    const diff = [
      '@@ -8,1 +8,1 @@',
      "-    const ids = ['old-resource'];",
      "+    const ids = ['lesson01-feedback-bridge-v1'];",
    ].join('\n');

    expect(parseChangedRegisteredResourceIds(source, diff)).toEqual(['lesson01-feedback-bridge-v1']);
  });

  it('detects semantic patch field edits when the diff omits the resource id', () => {
    const source = [
      'const registeredResourceMetadata = {',
      "    'lesson01-feedback-bridge-v1': {",
      "        id: 'lesson01-feedback-bridge-v1',",
      "        label: 'Bridge',",
      '    },',
      '};',
      'const registeredResourceSemanticMetadata: Record<string, Partial<RegisteredResourceMetadata>> = {',
      "    'lesson01-feedback-bridge-v1': {",
      "        knowledgeNodeIds: ['反馈控制系统_1_98dc667a'],",
      '        planningOverride: {',
      '            abilityImpact: { controlModeling: 0.12 },',
      "            privacyLevel: 'student-visible',",
      '        }',
      '    },',
      '};',
    ].join('\n');
    const diff = [
      '@@ -11,1 +11,1 @@',
      '-            abilityImpact: { controlModeling: 0.12 },',
      '+            abilityImpact: {},',
    ].join('\n');

    expect(parseChangedRegisteredResourceIds(source, diff)).toEqual(['lesson01-feedback-bridge-v1']);
  });

  it('fails closed to progression resources when shared readiness helpers change without resource ids', () => {
    const source = [
      'const registeredResourceMetadata = {',
      "    'lesson-a': { id: 'lesson-a', label: 'Lesson A' },",
      "    'lesson-b': { id: 'lesson-b', label: 'Lesson B' },",
      '};',
      'function buildRegisteredResourceProgressionMetadata(): Record<string, RegisteredResourceMetadataPatch> {',
      '    const progressions: Array<{ ids: string[] }> = [',
      '        {',
      '            ids: [',
      "                'lesson-a',",
      "                'lesson-b',",
      '            ],',
      '        },',
      '    ];',
      '    return {};',
      '}',
      'function resourceReadiness(): RegisteredResourceMetadataPatch {',
      '    return {',
      '        planningOverride: {',
      '            readiness: {',
      '                minimumEvidenceCount: 1,',
      '            },',
      '        },',
      '    };',
      '}',
      'function readyImmediately(): NonNullable<ResourceNodePlanningOverride[\'readiness\']> {',
      '    return { minimumEvidenceCount: 0 };',
      '}',
      'function buildUnlockMessage(): string {',
      "    return 'ready';",
      '}',
    ].join('\n');
    const diff = [
      '@@ -20,1 +20,1 @@',
      '-                minimumEvidenceCount: 1,',
      '+                minimumEvidenceCount: 2,',
    ].join('\n');

    expect(parseChangedRegisteredResourceIds(source, diff)).toEqual(['lesson-a', 'lesson-b']);
  });

  it('maps operational helper edits back to resources that use the helper', () => {
    const source = [
      'const registeredResourceMetadata = {',
      "    'sim-a': { id: 'sim-a', label: 'Sim A' },",
      "    'ready-a': { id: 'ready-a', label: 'Ready A' },",
      '};',
      'const registeredResourceOperationalMetadata: Record<string, RegisteredResourceMetadataPatch> = {',
      "    'sim-a': simulationReadiness('registry:lesson-a', 'Unlock sim.'),",
      "    'ready-a': readyResource(),",
      '};',
      'function simulationReadiness(): RegisteredResourceMetadataPatch {',
      '    return {',
      '        planningOverride: {',
      '            readiness: {',
      '                minimumEvidenceCount: 1,',
      '            },',
      '        },',
      '    };',
      '}',
      'function readyResource(): RegisteredResourceMetadataPatch {',
      '    return {',
      '        planningOverride: {',
      '            readiness: readyImmediately(),',
      '        },',
      '    };',
      '}',
      'function readyImmediately(): NonNullable<ResourceNodePlanningOverride[\'readiness\']> {',
      '    return {',
      '        minimumEvidenceCount: 0,',
      '    };',
      '}',
    ].join('\n');
    const simulationLine = source.split('\n').findIndex((line) => line.includes('minimumEvidenceCount: 1')) + 1;
    const readyLine = source.split('\n').findIndex((line) => line.includes('readiness: readyImmediately()')) + 1;
    const readyImmediatelyLine = source.split('\n').findIndex((line) => line.includes('minimumEvidenceCount: 0')) + 1;

    expect(parseChangedRegisteredResourceIds(source, [
      `@@ -${simulationLine},1 +${simulationLine},1 @@`,
      '-                minimumEvidenceCount: 1,',
      '+                minimumEvidenceCount: 0,',
    ].join('\n'))).toEqual(['sim-a']);
    expect(parseChangedRegisteredResourceIds(source, [
      `@@ -${readyLine},1 +${readyLine},1 @@`,
      '-            readiness: readyImmediately(),',
      '+            readiness: undefined,',
    ].join('\n'))).toEqual(['ready-a']);
    expect(parseChangedRegisteredResourceIds(source, [
      `@@ -${readyImmediatelyLine},1 +${readyImmediatelyLine},1 @@`,
      '-        minimumEvidenceCount: 0,',
      '+        minimumEvidenceCount: 1,',
    ].join('\n'))).toEqual(['ready-a']);
  });

  it('fails incomplete new registered resources', () => {
    const result = validateChangedRegisteredResources([{
      id: 'new-incomplete',
      label: 'New incomplete resource',
      type: 'INTERACTIVE_COMP',
      renderTarget: '/interactive-learning/resources/new-incomplete',
    }]);

    expect(result.passed).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      'missing-path-disposition',
      'missing-planning-override',
    ]));
  });

  it('passes complete path-plannable registered resources', () => {
    const result = validateChangedRegisteredResources([
      completeRegisteredResource({
        id: 'new-path-ready',
        planningKind: 'path-plannable',
      }),
    ]);

    expect(result).toMatchObject({
      passed: true,
      checked: 1,
      issues: [],
    });
  });

  it('rejects path-plannable registered resources without citation metadata', () => {
    const resource = completeRegisteredResource({
      id: 'new-path-missing-citation',
      planningKind: 'path-plannable',
    });
    resource.planningOverride!.pathDisposition!.sourceVersionRef = null;
    const result = validateChangedRegisteredResources([resource]);

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'new-path-missing-citation',
        code: 'missing-citation-metadata',
      }),
    ]));
  });

  it('passes reviewed non-path registered resources with rationale', () => {
    const result = validateChangedRegisteredResources([
      completeRegisteredResource({
        id: 'new-supporting-citation',
        planningKind: 'supporting-citation',
      }),
      completeRegisteredResource({
        id: 'new-excluded-resource',
        planningKind: 'excluded-with-rationale',
      }),
    ]);

    expect(result).toMatchObject({
      passed: true,
      checked: 2,
      issues: [],
    });
  });

  it('rejects generated provisional metadata and placeholder reviewers', () => {
    const result = validateChangedRegisteredResources([
      completeRegisteredResource({
        id: 'generated-resource',
        planningKind: 'supporting-citation',
        reviewStatus: 'generated-provisional',
        reviewerId: 'placeholder-reviewer',
      }),
    ]);

    expect(result.passed).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      'missing-human-review',
      'missing-reviewer-id',
    ]));
  });

  it('rejects template and system-governed reviewer identities', () => {
    const result = validateChangedRegisteredResources([
      completeRegisteredResource({
        id: 'template-reviewed-resource',
        planningKind: 'supporting-citation',
        reviewerId: 'system-governed-template',
      }),
    ]);

    expect(result.passed).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain('missing-reviewer-id');
  });

  it('parses and validates newly added runtime projection rows', () => {
    const complete = completeRuntimeProjection({ id: 'projection-complete' });
    const incomplete = {
      ...completeRuntimeProjection({ id: 'projection-incomplete' }),
      reviewAudit: {
        ...complete.reviewAudit,
        status: 'generated-provisional' as const,
        reviewerId: null,
      },
    };
    const diff = [
      `+${JSON.stringify(complete)}`,
      `+${JSON.stringify(incomplete)}`,
    ].join('\n');
    const rows = parseAddedRuntimeProjectionRows(diff);
    const result = validateChangedRuntimeResourceProjections(rows);

    expect(rows.map((row) => row.id)).toEqual(['projection-complete', 'projection-incomplete']);
    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-incomplete',
        code: 'missing-human-review',
      }),
      expect.objectContaining({
        resourceId: 'projection-incomplete',
        code: 'missing-reviewer-id',
      }),
    ]));
    expect(result.issues.some((item) => item.resourceId === 'projection-complete')).toBe(false);
  });

  it('rejects stale runtime projection review evidence', () => {
    const projection = completeRuntimeProjection({ id: 'projection-stale' });
    const reviewAudit = projection.reviewAudit;
    expect(reviewAudit).toBeTruthy();
    const result = validateChangedRuntimeResourceProjections([{
      ...projection,
      sourceHash: 'sha-current',
      sourceVersionRef: 'interactive-manifest.v3',
      reviewAudit: {
        ...reviewAudit!,
        reviewedSourceHash: 'sha-previous',
        reviewedVersionRef: 'interactive-manifest.v2',
      },
    }]);

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-stale',
        code: 'stale-review-evidence',
      }),
    ]));
  });

  it('accepts prompt-scoped runtime projection review hashes', () => {
    const projection = completeRuntimeProjection({ id: 'projection-prompt-scoped' });
    const result = validateChangedRuntimeResourceProjections([{
      ...projection,
      sourceHash: 'sha-manifest-source',
      reviewAudit: {
        ...projection.reviewAudit!,
        reviewedSourceHash: 'sha-manifest-plus-overlay',
        promptOrManifestHash: 'sha-manifest-plus-overlay',
      },
    }]);

    expect(result).toMatchObject({
      passed: true,
      checked: 1,
      issues: [],
    });
  });

  it('rejects path-capable runtime projections without capability bindings', () => {
    const projection = completeRuntimeProjection({ id: 'projection-no-capability' });
    const result = validateChangedRuntimeResourceProjections([{
      ...projection,
      graphNodeRefs: {
        ...projection.graphNodeRefs,
        capability: [],
      },
    }]);

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-no-capability',
        code: 'missing-capability-mapping',
      }),
    ]));
  });

  it('rejects runtime projections missing citation and review evidence metadata', () => {
    const projection = completeRuntimeProjection({ id: 'projection-missing-review-evidence' });
    const result = validateChangedRuntimeResourceProjections([{
      ...projection,
      citationTargets: [],
      reviewAudit: {
        ...projection.reviewAudit!,
        reviewerVisibleRationale: null,
        independentEvidenceRef: null,
      },
    }]);

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-missing-review-evidence',
        code: 'missing-citation-target',
      }),
      expect.objectContaining({
        resourceId: 'projection-missing-review-evidence',
        code: 'missing-review-rationale',
      }),
      expect.objectContaining({
        resourceId: 'projection-missing-review-evidence',
        code: 'missing-independent-review-evidence',
      }),
    ]));
  });

  it('does not trust self-reported complete evidence contracts when required fields are false', () => {
    const projection = completeRuntimeProjection({ id: 'projection-incomplete-evidence-contract' });
    const result = validateChangedRuntimeResourceProjections([{
      ...projection,
      evidenceContract: {
        ...projection.evidenceContract!,
        eventSource: false,
        eventType: false,
        clientEventIdPolicy: false,
        attemptKey: false,
        sourceLogId: false,
        dedupeKey: false,
        timestamps: false,
        learningFactPolicy: false,
        learningFactMaterializationPolicy: 'missing',
        confidencePolicy: false,
        privacyScope: false,
        complete: true,
        missingFields: [],
      },
    }]);

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-incomplete-evidence-contract',
        code: 'missing-evidence-contract',
      }),
    ]));
  });

  it('passes reviewed non-path runtime projections without learning evidence contracts', () => {
    const projection = completeRuntimeProjection({ id: 'projection-supporting-citation' });
    const result = validateChangedRuntimeResourceProjections([{
      ...projection,
      projectionLevel: 'ResourceSegment',
      routeTarget: null,
      renderTarget: null,
      evidenceInstrumentation: [],
      evidenceContract: null,
      graphNodeRefs: {
        knowledge: ['kn-bode'],
        capability: [],
        quality: [],
      },
    }]);

    expect(result).toMatchObject({
      passed: true,
      checked: 1,
      issues: [],
    });
  });

  it('reports malformed added runtime projection JSONL rows', () => {
    const diff = [
      `+${JSON.stringify(completeRuntimeProjection({ id: 'projection-complete' }))}`,
      '+{"id":"projection-broken",',
    ].join('\n');
    const parsed = parseAddedRuntimeProjectionChanges(diff);

    expect(parsed.rows.map((row) => row.id)).toEqual(['projection-complete']);
    expect(parsed.result.passed).toBe(false);
    expect(parsed.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'added-line-2',
        code: 'malformed-runtime-projection-json',
      }),
    ]));
  });

  it('rejects runtime projection rows missing required schema fields before validation', () => {
    const diff = [
      '+{"id":"projection-schema-missing"}',
    ].join('\n');
    const parsed = parseAddedRuntimeProjectionChanges(diff);

    expect(parsed.rows).toEqual([]);
    expect(parsed.result.passed).toBe(false);
    expect(parsed.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-schema-missing',
        code: 'missing-runtime-projection-title',
      }),
      expect.objectContaining({
        resourceId: 'projection-schema-missing',
        code: 'missing-runtime-projection-source-ref',
      }),
      expect.objectContaining({
        resourceId: 'projection-schema-missing',
        code: 'missing-runtime-projection-resource-type',
      }),
      expect.objectContaining({
        resourceId: 'projection-schema-missing',
        code: 'missing-runtime-projection-source-kind',
      }),
      expect.objectContaining({
        resourceId: 'projection-schema-missing',
        code: 'missing-runtime-projection-projection-level',
      }),
    ]));
  });

  it('rejects runtime projection rows with unsupported schema enum fields', () => {
    const invalid = {
      ...completeRuntimeProjection({ id: 'projection-invalid-schema' }),
      resourceType: 'unsupported_resource',
      sourceKind: 'unsupported_source',
      projectionLevel: 'UnsupportedLevel',
    };
    const parsed = parseAddedRuntimeProjectionChanges(`+${JSON.stringify(invalid)}`);

    expect(parsed.rows).toEqual([]);
    expect(parsed.result.passed).toBe(false);
    expect(parsed.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-invalid-schema',
        code: 'invalid-runtime-projection-resource-type',
      }),
      expect.objectContaining({
        resourceId: 'projection-invalid-schema',
        code: 'invalid-runtime-projection-source-kind',
      }),
      expect.objectContaining({
        resourceId: 'projection-invalid-schema',
        code: 'invalid-runtime-projection-projection-level',
      }),
    ]));
  });

  it('rejects runtime projection graph refs that are not arrays of strings', () => {
    const invalid = {
      ...completeRuntimeProjection({ id: 'projection-invalid-graph-refs' }),
      graphNodeRefs: {
        knowledge: ['kn-bode'],
        capability: 'rootLocusSketch',
        quality: [42],
      },
    };
    const parsed = parseAddedRuntimeProjectionChanges(`+${JSON.stringify(invalid)}`);

    expect(parsed.rows).toEqual([]);
    expect(parsed.result.passed).toBe(false);
    expect(parsed.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'projection-invalid-graph-refs',
        code: 'invalid-runtime-projection-graph-capability',
      }),
      expect.objectContaining({
        resourceId: 'projection-invalid-graph-refs',
        code: 'invalid-runtime-projection-graph-quality',
      }),
    ]));
  });
});

function completeRegisteredResource(input: {
  id: string;
  planningKind: 'path-plannable' | 'supporting-citation' | 'excluded-with-rationale';
  reviewStatus?: 'human-confirmed' | 'generated-provisional';
  reviewerId?: string | null;
}): RegisteredResourceMetadata {
  return {
    id: input.id,
    label: input.id,
    type: 'INTERACTIVE_COMP',
    renderTarget: `/interactive-learning/resources/${input.id}`,
    knowledgeNodeIds: ['kn-bode'],
    planningOverride: {
      abilityImpact: { controlModeling: 0.2 },
      evidenceInstrumentation: ['answer_submit'],
      privacyLevel: 'student-visible',
      readiness: {
        minimumCompetency: { controlModeling: 0.1 },
        minimumEvidenceCount: 0,
        requiredCompletedNodeIds: [],
        requiredOutcomeRefs: [],
        unlockMessage: 'Reviewed resource is ready.',
        fallbackNodeIds: [],
      },
      pathDisposition: {
        kind: input.planningKind,
        reviewStatus: input.reviewStatus ?? 'human-confirmed',
        rationale: 'Reviewed semantic completeness fixture.',
        sourceFamily: 'resource_registry',
        stableSourceRef: input.id,
        sourceVersionRef: 'resource-node-registry.v1',
        parentResourceNodeId: null,
        reviewedAt: '2026-07-09T00:00:00.000Z',
        reviewerId: input.reviewerId === undefined ? 'gate-test-reviewer' : input.reviewerId,
      },
    },
  };
}

function completeRuntimeProjection(input: { id: string }): RuntimeResourceProjectionInput {
  return {
    id: input.id,
    resourceNodeId: input.id,
    title: input.id,
    resourceType: 'knowledge_card',
    sourceKind: 'runtime_lesson_step',
    sourceRef: `${input.id}:source`,
    sourcePathOrUrl: 'course-content/runtime/lessons/example.json',
    sourceRecord: `${input.id}:record`,
    sourceHash: `sha-${input.id}`,
    sourceVersionRef: 'interactive-manifest.v2',
    projectionLevel: 'ResourceNode',
    routeTarget: `/interactive-learning/resources/${input.id}`,
    renderTarget: null,
    graphNodeRefs: {
      knowledge: ['kn-bode'],
      capability: ['controlModeling'],
      quality: [],
    },
    estimatedTimeMinutes: 6,
    evidenceInstrumentation: ['answer_submit'],
    privacyScope: 'student-visible',
    teacherPolicy: 'allowed',
    evidenceContract: {
      eventSource: true,
      eventType: true,
      clientEventIdPolicy: true,
      attemptKey: true,
      sourceLogId: true,
      dedupeKey: true,
      timestamps: true,
      learningFactPolicy: true,
      learningFactMaterializationPolicy: 'materialized-learning-fact',
      confidencePolicy: true,
      privacyScope: true,
      complete: true,
      missingFields: [],
    },
    reviewAudit: {
      status: 'human-confirmed',
      reviewerId: 'gate-test-reviewer',
      reviewerRole: 'implementing-agent',
      reviewedAt: '2026-07-09T00:00:00.000Z',
      reviewBatchId: 'new-resource-gate-test',
      reviewedSourceHash: `sha-${input.id}`,
      reviewedVersionRef: 'interactive-manifest.v2',
      generationToolOrModel: null,
      promptOrManifestHash: null,
      reviewerVisibleRationale: 'Reviewer confirmed graph, citation, path, and evidence completeness.',
      independentEvidenceRef: `review-packet:${input.id}`,
      confidence: 0.95,
      staleInvalidationRule: 'source-hash-or-version-change',
    },
    citationTargets: [`citation:${input.id}`],
    readiness: {
      minimumCompetency: { controlModeling: 0.1 },
      minimumEvidenceCount: 0,
      requiredCompletedNodeIds: [],
      requiredOutcomeRefs: [],
      unlockMessage: 'Reviewed projection is ready.',
      fallbackNodeIds: [],
    },
  };
}
