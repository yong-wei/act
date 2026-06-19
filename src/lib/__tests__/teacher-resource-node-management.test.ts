import { describe, expect, it } from 'vitest';

import { buildResourceNodeRegistry } from '../resource-node-registry';
import {
  applyTeacherResourceNodePatch,
  applyTeacherResourceNodeBulkPatch,
  buildTeacherResourceNodeOperationsReadiness,
  buildTeacherResourceNodeManagementSummary,
  createTeacherResourceNodeView,
  filterTeacherResourceNodes,
  type TeacherResourceNodePatch,
  type TeacherResourceNodeScope,
} from '../teacher-resource-node-management';

function registry() {
  return buildResourceNodeRegistry({
    teachingResources: [
      {
        id: 'owned-quiz',
        title: 'Bode 后测',
        type: 'INTERACTIVE_COMP',
        registryId: 'lesson12-bode-post-quiz',
        category: 'FREQUENCY_DOMAIN',
        knowledgeNodeIds: ['kn-bode'],
        config: {
          resourceNodePlanning: {
            estimatedTimeMinutes: 18,
            teacherPolicy: 'teacher-assigned',
          },
        },
      },
      {
        id: 'owned-broken',
        title: '未映射资源',
        type: 'STATIC_TEXT',
        category: 'SYSTEM_MODELING',
        knowledgeNodeIds: [],
      },
      {
        id: 'foreign-project',
        title: '外部项目',
        type: 'INTERACTIVE_COMP',
        registryId: 'external-project',
        knowledgeNodeIds: ['kn-project'],
      },
    ],
    knowledgeNodes: [
      { id: 'kn-bode', name: '伯德图', tags: ['FREQUENCY_DOMAIN'] },
      { id: 'kn-project', name: '项目实践' },
    ],
  });
}

const teacherScope: TeacherResourceNodeScope = {
  role: 'TEACHER',
  teacherId: 'teacher-1',
  editableSourceRefs: new Set(['owned-quiz', 'owned-broken']),
  readableSourceRefs: new Set(['owned-quiz', 'owned-broken', 'kn-bode']),
};

describe('teacher ResourceNode management contracts', () => {
  it('filters browse results by type, knowledge mapping, policy, privacy, and path eligibility', () => {
    const result = filterTeacherResourceNodes(registry().nodes, {
      query: 'Bode',
      nodeType: 'quiz',
      courseModule: 'FREQUENCY_DOMAIN',
      knowledgeMapping: 'mapped',
      teacherPolicy: 'teacher-assigned',
      privacyLevel: 'student-visible',
      pathEligibility: 'eligible',
    });

    expect(result.map((node) => node.id)).toEqual(['teaching-resource:owned-quiz']);
    expect(buildTeacherResourceNodeManagementSummary(result)).toMatchObject({
      totalNodes: 1,
      pathEligibleNodes: 1,
      warningNodes: 0,
      mappedNodes: 1,
      unmappedNodes: 0,
      capabilityMappedNodes: 1,
      citationReadyNodes: 1,
      evidenceCapabilityNodes: 1,
      blockedNodes: 0,
    });
  });

  it('creates teacher-facing views with audit warnings and path exclusion reasons', () => {
    const broken = registry().nodes.find((node) => node.id === 'teaching-resource:owned-broken');
    expect(broken).toBeDefined();

    const view = createTeacherResourceNodeView(broken!, teacherScope);

    expect(view).toMatchObject({
      id: 'teaching-resource:owned-broken',
      courseModule: 'SYSTEM_MODELING',
      editable: true,
      pathEligible: false,
    });
    expect(view.pathExclusionReasons).toEqual(expect.arrayContaining([
      'missing-render-or-launch-target',
      'missing-knowledge-mapping',
    ]));
    expect(view.audit).toMatchObject({
      knowledgeCoveragePresent: false,
      capabilityMappingPresent: true,
      citationTargetReady: false,
      evidenceCapabilityConfigured: true,
      pathEligible: false,
      sourceOwnership: {
        content: 'TeachingResource',
        catalogMetadata: 'TeachingResource',
        planningMetadata: 'ResourceNode',
      },
    });
    expect(view.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'missing-render-or-launch-target',
      'missing-knowledge-mapping',
    ]));
    expect(JSON.stringify(view)).not.toContain('abilityImpact');
    expect(JSON.stringify(view)).not.toContain('terminalConstraints');
    expect(JSON.stringify(view)).not.toContain('hiddenEvaluationInternals');
  });

  it('surfaces capability and evidence gaps as high-confidence path blockers', () => {
    const node = registry().nodes.find((candidate) => candidate.id === 'teaching-resource:owned-quiz')!;
    const auditBlockedNode = {
      ...node,
      planningMetadata: {
        ...node.planningMetadata,
        abilityImpact: {},
        evidenceInstrumentation: [],
      },
    };
    const view = createTeacherResourceNodeView(auditBlockedNode, teacherScope);

    expect(view.audit).toMatchObject({
      knowledgeCoveragePresent: true,
      capabilityMappingPresent: false,
      citationTargetReady: true,
      evidenceCapabilityConfigured: false,
      pathEligible: false,
    });
    expect(view.pathEligible).toBe(true);
    expect(view.pathExclusionReasons).toEqual([]);
    expect(view.audit.exclusionReasons).toEqual(expect.arrayContaining([
      'missing-capability-mapping',
      'missing-evidence-instrumentation',
    ]));
    expect(view.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-capability-mapping', severity: 'blocking' }),
      expect.objectContaining({ code: 'missing-evidence-instrumentation', severity: 'blocking' }),
    ]));
    expect(filterTeacherResourceNodes([auditBlockedNode], { pathEligibility: 'eligible' })).toEqual([]);
    expect(filterTeacherResourceNodes([auditBlockedNode], { pathEligibility: 'excluded' })).toEqual([auditBlockedNode]);
    expect(buildTeacherResourceNodeManagementSummary([auditBlockedNode])).toMatchObject({
      totalNodes: 1,
      pathEligibleNodes: 0,
      warningNodes: 1,
      excludedNodes: 1,
      mappedNodes: 1,
      capabilityMappedNodes: 0,
      evidenceCapabilityNodes: 0,
      blockedNodes: 1,
    });
  });

  it('does not persist audit-only high-confidence blockers as teacher policy changes', () => {
    const node = registry().nodes.find((candidate) => candidate.id === 'teaching-resource:owned-quiz')!;
    const result = applyTeacherResourceNodePatch({
      node: {
        ...node,
        planningMetadata: {
          ...node.planningMetadata,
          abilityImpact: {},
          evidenceInstrumentation: [],
        },
      },
      scope: teacherScope,
      patch: {
        displayName: '只改显示名称',
        description: '不应因为 audit 缺口改写教师策略。',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.persistablePatch).toEqual({
      displayName: '只改显示名称',
      description: '不应因为 audit 缺口改写教师策略。',
      resourceNodePlanning: {},
    });
  });

  it('keeps related knowledge cards readable for teacher-owned knowledge mappings', () => {
    const card = registry().nodes.find((node) => node.id === 'knowledge-card:kn-bode');
    expect(card).toBeDefined();

    const scope: TeacherResourceNodeScope = {
      ...teacherScope,
      readableSourceRefs: new Set(['kn-bode', 'kn-bode:card']),
    };

    expect(createTeacherResourceNodeView(card!, scope)).toMatchObject({
      id: 'knowledge-card:kn-bode',
      type: 'knowledge_card',
      courseModule: 'FREQUENCY_DOMAIN',
      editable: false,
    });
  });

  it('filters by explicit course or module metadata instead of accidental title matches', () => {
    const result = filterTeacherResourceNodes(registry().nodes, {
      courseModule: 'SYSTEM_MODELING',
    });

    expect(result.map((node) => node.id)).toEqual(['teaching-resource:owned-broken']);
  });

  it('accepts only permitted planning and display metadata for scoped single-node edits', () => {
    const patch: TeacherResourceNodePatch = {
      displayName: '课堂使用的 Bode 后测',
      description: '用于频域单元的后测资源。',
      planningMetadata: {
        prerequisites: ['knowledge-node:kn-bode'],
        knowledgeCoverage: ['kn-bode', 'kn-frequency-response'],
        estimatedTimeMinutes: 20,
        cognitiveLoad: 'medium',
        availability: 'available',
        teacherPolicy: 'teacher-assigned',
        privacyLevel: 'teacher-scoped',
        readiness: {
          minimumCompetency: {
            'control.correction': 1.2,
            'control.modeling': 0.55,
          },
          minimumEvidenceCount: 2,
          requiredCompletedNodeIds: ['simulation:step-lab', 'simulation:step-lab'],
          requiredOutcomeRefs: ['arena:lead-lag', 'sim:step-response'],
          unlockMessage: '先完成准备任务。',
          fallbackNodeIds: ['knowledge-card:kn-bode'],
        },
        pathEligible: false,
      },
    };

    const result = applyTeacherResourceNodePatch({
      node: registry().nodes.find((node) => node.id === 'teaching-resource:owned-quiz')!,
      scope: teacherScope,
      patch,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.persistablePatch).toEqual({
      displayName: '课堂使用的 Bode 后测',
      description: '用于频域单元的后测资源。',
      resourceNodePlanning: {
        prerequisites: ['knowledge-node:kn-bode'],
        knowledgeCoverage: ['kn-bode', 'kn-frequency-response'],
        estimatedTimeMinutes: 20,
        cognitiveLoad: 'medium',
        availability: 'available',
        teacherPolicy: 'blocked',
        privacyLevel: 'teacher-scoped',
        readiness: {
          minimumCompetency: {
            'control.correction': 1,
            'control.modeling': 0.55,
          },
          minimumEvidenceCount: 2,
          requiredCompletedNodeIds: ['simulation:step-lab'],
          requiredOutcomeRefs: ['arena:lead-lag', 'sim:step-response'],
          unlockMessage: '先完成准备任务。',
          fallbackNodeIds: ['knowledge-card:kn-bode'],
        },
      },
    });
  });

  it('exposes readiness metadata in teacher views without leaking immutable planning internals', () => {
    const node = registry().nodes.find((candidate) => candidate.id === 'teaching-resource:owned-quiz')!;
    const view = createTeacherResourceNodeView({
      ...node,
      planningMetadata: {
        ...node.planningMetadata,
        readiness: {
          minimumCompetency: { 'control.correction': 0.6 },
          minimumEvidenceCount: 1,
          requiredCompletedNodeIds: ['knowledge-card:kn-bode'],
          requiredOutcomeRefs: ['sim:step-response'],
          unlockMessage: '完成预备练习后解锁。',
          fallbackNodeIds: ['knowledge-card:kn-bode'],
        },
      },
    }, teacherScope);

    expect(view.readiness).toEqual({
      minimumCompetency: { 'control.correction': 0.6 },
      minimumEvidenceCount: 1,
      requiredCompletedNodeIds: ['knowledge-card:kn-bode'],
      requiredOutcomeRefs: ['sim:step-response'],
      unlockMessage: '完成预备练习后解锁。',
      fallbackNodeIds: ['knowledge-card:kn-bode'],
    });
    expect(JSON.stringify(view)).not.toContain('abilityImpact');
    expect(JSON.stringify(view)).not.toContain('terminalConstraints');
  });

  it('normalizes malformed readiness patch values instead of throwing', () => {
    const result = applyTeacherResourceNodePatch({
      node: registry().nodes.find((node) => node.id === 'teaching-resource:owned-quiz')!,
      scope: teacherScope,
      patch: {
        planningMetadata: {
          readiness: {
            minimumCompetency: ['not-a-record'],
            minimumEvidenceCount: 'many',
            requiredCompletedNodeIds: 'teaching-resource:owned-prerequisite',
            requiredOutcomeRefs: [12, 'sim:step-response'],
            fallbackNodeIds: null,
            unlockMessage: 42,
          },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.persistablePatch.resourceNodePlanning.readiness).toEqual({
      minimumCompetency: {},
      minimumEvidenceCount: 0,
      requiredCompletedNodeIds: [],
      requiredOutcomeRefs: ['sim:step-response'],
      unlockMessage: '完成准备节点后会自动解锁。',
      fallbackNodeIds: [],
    });
  });

  it('treats malformed planning metadata patches as safe no-ops', () => {
    const result = applyTeacherResourceNodePatch({
      node: registry().nodes.find((node) => node.id === 'teaching-resource:owned-quiz')!,
      scope: teacherScope,
      patch: {
        planningMetadata: 'not-an-object',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.persistablePatch.resourceNodePlanning).toEqual({});
  });

  it('treats teacher policy blocking as path exclusion in management views and filters', () => {
    const updated = registry().nodes.find((node) => node.id === 'teaching-resource:owned-quiz')!;
    const blockedNode = {
      ...updated,
      planningMetadata: {
        ...updated.planningMetadata,
        teacherPolicy: 'blocked' as const,
      },
      eligibility: {
        pathEligible: false,
        reasons: ['teacher-policy-blocked'],
        auditIssues: [
          {
            code: 'teacher-policy-blocked' as const,
            message: 'ResourceNode is excluded by teacher policy.',
            severity: 'blocking' as const,
          },
        ],
      },
    };

    const view = createTeacherResourceNodeView(blockedNode, teacherScope);
    const excluded = filterTeacherResourceNodes([blockedNode], { pathEligibility: 'excluded' });

    expect(view).toMatchObject({
      pathEligible: false,
      pathExclusionReasons: ['teacher-policy-blocked'],
    });
    expect(excluded.map((node) => node.id)).toEqual(['teaching-resource:owned-quiz']);
  });

  it('rejects immutable system fields and private internals without producing a partial patch', () => {
    const result = applyTeacherResourceNodePatch({
      node: registry().nodes.find((node) => node.id === 'teaching-resource:owned-quiz')!,
      scope: teacherScope,
      patch: {
        sourceRef: 'different-source',
        protocolVersion: 3,
        hiddenEvaluationInternals: { rubric: 'private' },
        privateLearnerEvidence: [{ userId: 'student-1' }],
        konlingMemory: { private: true },
        planningMetadata: {
          evidenceInstrumentation: ['private-event'],
        },
      } as never,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    if (result.ok) throw new Error('expected immutable field rejection');
    expect(result.code).toBe('IMMUTABLE_RESOURCE_NODE_FIELDS');
    expect(result.persistablePatch).toBeUndefined();
  });

  it('rejects unauthorized edits without revealing private resource details', () => {
    const result = applyTeacherResourceNodePatch({
      node: registry().nodes.find((node) => node.id === 'teaching-resource:foreign-project')!,
      scope: teacherScope,
      patch: {
        planningMetadata: {
          teacherPolicy: 'blocked',
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: 'RESOURCE_NODE_FORBIDDEN',
      error: '资源不存在或无权管理。',
    });
  });

  it('applies bulk mapping only to authorized resource nodes and records per-node failures', () => {
    const result = applyTeacherResourceNodeBulkPatch({
      nodes: registry().nodes,
      scope: teacherScope,
      nodeIds: [
        'teaching-resource:owned-broken',
        'teaching-resource:foreign-project',
        'missing-node',
      ],
      reason: 'stage-2-bulk-mapping',
      patch: {
        planningMetadata: {
          knowledgeCoverage: ['kn-bode'],
          pathEligible: true,
        },
      },
    });

    expect(result).toMatchObject({
      requestedCount: 3,
      updatedCount: 1,
      rejectedCount: 2,
      reason: 'stage-2-bulk-mapping',
    });
    expect(result.results).toEqual([
      expect.objectContaining({
        nodeId: 'missing-node',
        ok: false,
        status: 404,
      }),
      expect.objectContaining({
        nodeId: 'teaching-resource:foreign-project',
        ok: false,
        status: 403,
      }),
      expect.objectContaining({
        nodeId: 'teaching-resource:owned-broken',
        ok: true,
        status: 200,
        persistablePatch: {
          resourceNodePlanning: {
            knowledgeCoverage: ['kn-bode'],
            teacherPolicy: 'allowed',
          },
        },
      }),
    ]);
  });

  it('reports coverage dashboards, policy review counts, and system-owned issue triage markers', () => {
    const baseNode = registry().nodes.find((node) => node.id === 'teaching-resource:owned-quiz')!;
    const auditOnlyBlockedNode = {
      ...baseNode,
      id: 'teaching-resource:audit-only-blocked',
      planningMetadata: {
        ...baseNode.planningMetadata,
        abilityImpact: {},
        evidenceInstrumentation: [],
      },
    };
    const warningOnlyNode = {
      ...baseNode,
      eligibility: {
        pathEligible: true,
        reasons: [],
        auditIssues: [
          {
            code: 'missing-evidence-instrumentation' as const,
            message: 'ResourceNode lacks evidence instrumentation.',
            severity: 'warning' as const,
          },
        ],
      },
    };
    const readiness = buildTeacherResourceNodeOperationsReadiness([auditOnlyBlockedNode, warningOnlyNode], {
      bulkMappingEnabled: true,
    });

    expect(readiness.bulkMappingEnabled).toBe(true);
    expect(readiness.coverage).toMatchObject({
      totalNodes: 2,
      mappedNodes: 2,
      pathEligibleNodes: 1,
    });
    expect(readiness.coverage.coverageRatio).toBeGreaterThan(0);
    expect(readiness.policyReviewRequiredCount).toBeGreaterThan(0);
    expect(readiness.systemIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing-capability-mapping'),
        expect.stringContaining('missing-evidence-instrumentation'),
      ]),
    );
  });
});
