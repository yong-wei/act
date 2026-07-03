import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
  buildAdaptiveLearningPathPlan,
  buildControlCorrectionThreeStylePathBundle,
  getLearningGoal,
  isRegisteredAdaptiveLearningPathGoal,
  listLearningGoals,
  normalizeLearningPathPayloadLearningGoal,
  recordLearningPathFeedback,
  serializeLearningPathPlan,
  validateLearningGoal,
  validateLearningGoalCatalog,
  type AdaptiveLearningPathPlannerInput,
} from '../adaptive-learning-path-planner';
import { deterministicPathConstraintRepairAdapter } from '../adaptive-planning/path-constraint-repair';
import { rankResourceLearnerCandidates } from '../adaptive-planning/resource-ranker';
import { buildControlCorrectionResourceNodeRegistry } from '../control-correction-resource-seed';
import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_GRAPH_VERSION,
  AUTOCONTROL_KAQ_OBJECTIVES,
} from '../data-governance/autocontrol-kaq-graph-catalog';
import { expandLearningGoalSubgraph } from '../graphs/goal-subgraph-expansion-service';
import { buildKaqArtifactVersionRefs, GRAPH_CENTER_OVERLAY_VERSION } from '../kaq-artifact-versioning';
import { buildResourceNodeRegistry, buildResourceSemanticProjection } from '../resource-node-registry';
import { getAllRegisteredResourceMetadata } from '../resource-registry-metadata';
import { buildResourceNodeRegistryFromTeachingResources } from '../teacher-resource-node-data';
import type { SourcePackItem } from '../source-pack';

function plannerInput(overrides: Partial<AdaptiveLearningPathPlannerInput> = {}): AdaptiveLearningPathPlannerInput {
  const registry = buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'bode-card',
        label: '伯德图知识卡',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
      },
      {
        id: 'bode-sim',
        label: '伯德图仿真',
        type: 'SIMULATION_APP',
        launchTarget: '/simulations/bode',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: ['registry:bode-card'],
            requiredOutcomeRefs: [],
            unlockMessage: '完成伯德图知识卡后解锁仿真。',
            fallbackNodeIds: ['registry:bode-card'],
          },
        },
      },
      {
        id: 'hidden-admin',
        label: '管理员资源',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/admin/data-governance',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    simulations: [
      {
        id: 'cruise',
        title: '邮轮舒适度仿真',
        launchTarget: '/simulations/cruise',
        knowledgeNodeIds: ['kn-cruise'],
        planningOverride: {
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: ['registry:bode-card'],
            requiredOutcomeRefs: [],
            unlockMessage: '完成伯德图知识卡后解锁仿真。',
            fallbackNodeIds: ['registry:bode-card'],
          },
        },
      },
    ],
    arenaTasks: [
      {
        id: 'roll-control',
        title: '横摇控制 Arena',
        launchTarget: '/arena/challenges/roll-control',
        knowledgeNodeIds: ['kn-cruise'],
        prerequisiteNodeIds: ['simulation:cruise'],
        official: true,
        planningOverride: {
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: ['simulation:cruise'],
            requiredOutcomeRefs: [],
            unlockMessage: '完成邮轮舒适度仿真后解锁 Arena。',
            fallbackNodeIds: ['simulation:cruise'],
          },
        },
      },
    ],
    reflectionPrompts: [
      {
        id: 'reflection-bode',
        title: '伯德图反思',
        renderTarget: '/profile/growth?prompt=reflection-bode',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['registry:bode-card'],
      },
    ],
  });

  const adminNode = registry.nodes.find((node) => node.id === 'registry:hidden-admin');
  if (adminNode) {
    adminNode.planningMetadata.privacyLevel = 'admin-scoped';
    adminNode.eligibility = {
      pathEligible: true,
      reasons: [],
      auditIssues: [],
    };
  }

  return {
    studentId: 'student-1',
    goal: {
      id: 'goal-bode',
      title: '补齐伯德图与横摇控制',
      knowledgeTargets: ['kn-bode', 'kn-cruise'],
      competencyTargets: ['parameterDesign'],
    },
    learnerState: {
      knowledgeMastery: {
        tags: {
          'kn-bode': { posteriorMastery: 0.32, confidence: 0.7, evidenceCount: 3 },
          'kn-cruise': { posteriorMastery: 0.2, confidence: 0.5, evidenceCount: 2 },
        },
      },
      primaryCompetencies: {
        vector: {
          parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 5 },
          engineeringDecision: { score: 0.62, confidence: 0.6, evidenceCount: 4 },
        },
      },
      resourcePreference: {
        preferredModalities: ['simulation', 'video'],
      },
      evidence: {
        confidence: {
          level: 'medium',
          score: 0.72,
          evidenceCount: 8,
          sourceCompleteness: 0.7,
        },
        sourceCoverage: {
          LearningFact: 'available',
          StudentCompetencySnapshot: 'available',
          StudentProfileSummary: 'partial',
        },
      },
      risks: {
        riskLevel: 'medium',
        activeFlags: [
          { type: 'participation', severity: 'medium' },
        ],
      },
    },
    registry,
    constraints: {
      timeBudgetMinutes: 90,
      privacyScopes: ['student-visible'],
      device: 'desktop',
      timelineWindowDays: 7,
      completedNodeIds: ['registry:bode-card'],
    },
    now: new Date('2026-05-27T08:00:00.000Z'),
    ...overrides,
  };
}

function textbookRuntimeFixtureSections() {
  return [
    {
      bookId: 'dorf-modern-control-systems',
      sectionId: 'ch08-example-0801',
      title: 'Bode 图频域响应示例',
      citationHref: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md',
      knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1', '正弦稳态响应_5_b6dc1100'],
      capabilityTargetIds: ['controlModeling', 'parameterDesign'],
      estimatedTimeMinutes: 8,
    },
    {
      bookId: 'dorf-modern-control-systems',
      sectionId: 'ch10-sec01',
      title: '串联校正与频域整定',
      citationHref: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md',
      knowledgeNodeIds: ['串联校正_6_fede5751', '频域PD与超前整定_4_42011'],
      capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
      estimatedTimeMinutes: 12,
    },
  ];
}

function policyFixtureInput(overrides: Partial<AdaptiveLearningPathPlannerInput> = {}): AdaptiveLearningPathPlannerInput {
  const registry = buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'concept',
        label: '基础概念卡',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/concept',
        knowledgeNodeIds: ['kn-a'],
        planningOverride: {
          estimatedTimeMinutes: 10,
        },
      },
      {
        id: 'quiz',
        label: '短程练习',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/quiz',
        knowledgeNodeIds: ['kn-b'],
        planningOverride: {
          estimatedTimeMinutes: 12,
          abilityImpact: { skill: 0.35 },
        },
      },
      {
        id: 'assigned',
        label: '教师指定任务',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/assigned',
        knowledgeNodeIds: ['kn-b'],
        planningOverride: {
          teacherPolicy: 'teacher-assigned',
          estimatedTimeMinutes: 20,
          abilityImpact: { skill: 0.3 },
        },
      },
    ],
    simulations: [
      {
        id: 'sim',
        title: '策略仿真',
        launchTarget: '/simulations/policy',
        knowledgeNodeIds: ['kn-b'],
        planningOverride: {
          estimatedTimeMinutes: 25,
          abilityImpact: { skill: 0.3 },
        },
      },
    ],
    arenaTasks: [
      {
        id: 'arena',
        title: '策略 Arena',
        launchTarget: '/arena/challenges/policy',
        knowledgeNodeIds: ['kn-c'],
        prerequisiteNodeIds: ['simulation:sim'],
        official: true,
        planningOverride: {
          estimatedTimeMinutes: 30,
          abilityImpact: { skill: 0.4 },
        },
      },
    ],
    reflectionPrompts: [
      {
        id: 'reflect',
        title: '策略反思',
        renderTarget: '/profile/growth?prompt=policy',
        knowledgeNodeIds: ['kn-c'],
        prerequisiteNodeIds: ['simulation:sim'],
      },
    ],
  });

  return {
    studentId: 'student-policy',
    goal: {
      id: 'goal-policy',
      title: '策略路径目标',
      knowledgeTargets: ['kn-a', 'kn-b', 'kn-c'],
      competencyTargets: ['skill'],
    },
    learnerState: {
      knowledgeMastery: {
        tags: {
          'kn-a': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 2 },
          'kn-b': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 2 },
          'kn-c': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 2 },
        },
      },
      primaryCompetencies: {
        vector: {
          skill: { score: 0.3, confidence: 0.7, evidenceCount: 3 },
        },
      },
      evidence: {
        confidence: {
          level: 'high',
          score: 0.8,
          evidenceCount: 8,
          sourceCompleteness: 0.8,
        },
      },
    },
    registry,
    constraints: {
      timeBudgetMinutes: 90,
      privacyScopes: ['student-visible'],
      teacherAssignedNodeIds: ['registry:assigned'],
    },
    now: new Date('2026-05-27T08:00:00.000Z'),
    ...overrides,
  };
}

describe('adaptive learning path planner', () => {
  it('uses explicit policy families to produce different path emphasis', () => {
    const base = plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    });

    const foundation = buildAdaptiveLearningPathPlan(plannerInput({
      ...base,
      policyFamily: 'foundation-remediation',
    }));
    const simulation = buildAdaptiveLearningPathPlan(plannerInput({
      ...base,
      policyFamily: 'simulation-driven',
    }));
    const sprint = buildAdaptiveLearningPathPlan(plannerInput({
      ...base,
      policyFamily: 'sprint-correction',
      constraints: {
        ...base.constraints,
        timeBudgetMinutes: 50,
      },
    }));

    expect(foundation.policyFamily).toBe('foundation-remediation');
    expect(foundation.policyMetadata.scoringIntent).toContain('prerequisite');
    expect(foundation.explanations.selectedReasons).toContain('policy-foundation-remediation');
    expect(foundation.mainPath.map((node) => node.nodeId)).toContain('registry:bode-card');

    expect(simulation.policyFamily).toBe('simulation-driven');
    expect(simulation.explanations.selectedReasons).toContain('policy-simulation-driven');
    expect(simulation.mainPath.map((node) => node.type)).toEqual(
      expect.arrayContaining(['simulation', 'arena_task']),
    );

    expect(sprint.policyFamily).toBe('sprint-correction');
    expect(sprint.explanations.selectedReasons).toContain('policy-sprint-correction');
    expect(sprint.policyMetadata.constraints).toContain('time-budget-first');
  });

  it('excludes audit-only resource mapping blockers from high-confidence paths', () => {
    const input = plannerInput();
    const blockedResource = input.registry.nodes.find((node) => node.id === 'registry:bode-card');
    expect(blockedResource).toBeDefined();
    blockedResource!.planningMetadata = {
      ...blockedResource!.planningMetadata,
      abilityImpact: {},
      evidenceInstrumentation: [],
    };

    const plan = buildAdaptiveLearningPathPlan(input);

    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('registry:bode-card');
    expect(plan.alternatives).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'registry:bode-card',
        blocked: true,
        reasonCodes: expect.arrayContaining([
          'missing-capability-mapping',
          'missing-evidence-instrumentation',
        ]),
      }),
    ]));
  });

  it('generates path nodes from PlanningUnit projections instead of retrieval chunks', () => {
    const input = plannerInput();
    const sourceNode = input.registry.nodes.find((node) => node.id === 'registry:bode-card');
    expect(sourceNode).toBeDefined();
    const projection = buildResourceSemanticProjection(sourceNode!);

    const plan = buildAdaptiveLearningPathPlan(input);
    const serialized = serializeLearningPathPlan(plan);
    const pathNode = plan.mainPath.find((node) => node.nodeId === 'registry:bode-card');

    expect(projection.planningUnit).toBeDefined();
    expect(pathNode).toMatchObject({
      nodeId: 'registry:bode-card',
      planningUnitId: projection.planningUnit!.id,
      resourceId: projection.planningUnit!.resourceId,
      resourceNodeId: projection.planningUnit!.resourceNodeId,
      knowledgeCoverage: ['kn-bode'],
      capabilityTargets: ['controlModeling'],
      cognitiveLoad: 'medium',
      effort: 'medium',
      launchBinding: {
        kind: 'resource-node',
        target: '/teacher/resources',
        sourceRef: { kind: 'resource_registry', ref: 'bode-card' },
      },
      evidenceBehavior: projection.planningUnit!.pathSemantics.evidenceBehavior,
    });
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain(projection.retrievalChunks[0].id);
    expect(pathNode?.resourceRanker).toMatchObject({
      score: expect.any(Number),
      matchedGraphRefs: {
        knowledge: ['kn-bode'],
        capability: [],
        quality: [],
      },
      evidencePotential: expect.any(Number),
      limitations: expect.arrayContaining(projection.planningUnit!.citationReadiness.limitations),
      tieBreakReason: expect.stringContaining('scene:path'),
    });
    expect(pathNode?.resourceRanker?.featureContributions.map((contribution) => contribution.feature)).toEqual([
      'graph-coverage',
      'selected-graph-focus',
      'capability-contribution',
      'evidence-potential',
      'learner-fit',
      'accessibility',
      'freshness',
      'time-cost',
      'cognitive-load',
      'readiness',
      'governance',
    ]);
    expect(pathNode?.reasonCodes).toEqual(expect.arrayContaining([
      'ranker:graph-coverage',
      'ranker:learner-fit',
      'ranker:time-cost',
    ]));
    expect(serialized.payload.planNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'registry:bode-card',
        planningUnitId: projection.planningUnit!.id,
        capabilityTargets: ['controlModeling'],
        evidenceBehavior: projection.planningUnit!.pathSemantics.evidenceBehavior,
      }),
    ]));
  });

  it('uses path-planning Source Packs as evidence without promoting citation-only items', () => {
    const citationOnlyItem: SourcePackItem = {
      id: 'source-pack:citation-only:bode-reference',
      title: 'Bode reference citation',
      sourceKind: 'textbook',
      modality: 'text',
      excerpt: 'Bode plots support frequency-domain correction decisions.',
      inclusionRationale: 'Supports the target knowledge node but has no ResourceNode or PlanningUnit audit.',
      retrievalChunkId: 'retrieval-chunk:bode-reference',
      citationTargetId: 'citation-target:bode-reference',
      scores: {
        relevance: 0.9,
        graphAlignment: 0.8,
        authority: 0.9,
        eligibility: 0.2,
        freshness: 0.8,
        final: 0.74,
      },
      access: {
        visibility: 'student',
        aiUseAllowed: true,
      },
      citation: {
        citationTargetId: 'citation-target:bode-reference',
        sourceId: 'textbook:bode-reference',
        displayTitle: 'Bode reference citation',
        href: '/course-runtime/resources/textbooks/bode-reference.md#chunk-1',
        resolver: 'course-runtime',
        verified: true,
      },
      metadata: {
        reviewStatus: 'human-confirmed',
        knowledgeNodeRefs: ['kn-bode'],
        capabilityTargetRefs: ['parameterDesign'],
      },
    };

    const input = plannerInput();
    const plan = buildAdaptiveLearningPathPlan({
      ...input,
      goal: {
        ...input.goal,
        capabilityTargets: [{
          id: 'capability:nyquist-stability',
          knowledgeNodeRef: 'kn-bode',
          competencyDimensions: ['parameterDesign'],
          capabilityLevel: 'analyze',
          behaviorVerb: '判别',
          successCriteria: ['能够依据频域曲线判断稳定裕度'],
          observableEvidenceType: 'question',
        }],
      },
      sourcePackCandidates: [citationOnlyItem],
      sourcePackLimitations: [{
        code: 'citation-target-raw-ref',
        severity: 'warning',
        message: 'Textbook adapter preserved a raw citation target limitation.',
        source: 'corpus-adapters',
        recoverable: true,
      }],
    });

    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain(citationOnlyItem.id);
    expect(plan.visualization.evidence.sourcePackEvidence).toMatchObject({
      profile: 'path-planning',
      queryText: expect.stringContaining('capability:nyquist-stability 判别'),
      capabilityTargetRefs: expect.arrayContaining(['parameterDesign', 'capability:nyquist-stability']),
      itemRefs: [citationOnlyItem.id],
      citationOnlyItemRefs: [citationOnlyItem.id],
      pathEligibleItemRefs: [],
      citationTargetIds: ['citation-target:bode-reference'],
      retrievalChunkIds: ['retrieval-chunk:bode-reference'],
      limitationCodes: expect.arrayContaining(['upstream-limitations-redacted', 'path-planning-citation-only-evidence']),
    });
  });

  it('uses SAR candidates only after ResourceNode and PlanningUnit mapping gates', () => {
    const input = plannerInput();
    const teacherOnlyNode = input.registry.nodes.find((node) => node.id === 'reflection_prompt:reflection-bode');
    expect(teacherOnlyNode).toBeDefined();
    teacherOnlyNode!.planningMetadata.teacherPolicy = 'teacher-only';
    const plan = buildAdaptiveLearningPathPlan({
      ...input,
      sarCandidateContext: {
        enabled: true,
        traceId: 'sar-trace:path-bode',
        seedEntityRefs: ['LearningGoal:goal-bode', 'GraphNode:kn-bode'],
        candidates: [
          {
            ref: 'sar-candidate:bode-card',
            kind: 'resourceNode',
            resourceNodeId: 'registry:bode-card',
          },
          {
            ref: 'registry:bode-card',
            kind: 'retrievalChunk',
          },
          {
            ref: 'registry:bode-card',
            kind: 'retrievalChunk',
            resourceNodeId: 'missing-resource-node',
          },
          {
            ref: 'retrieval-chunk:bode-reference',
            kind: 'retrievalChunk',
            retrievalChunkId: 'retrieval-chunk:bode-reference',
          },
          {
            ref: 'retrieval-chunk:cruise-simulation',
            kind: 'retrievalChunk',
            resourceNodeId: 'simulation:cruise',
            retrievalChunkId: 'retrieval-chunk:cruise-simulation',
          },
          {
            ref: 'registry:hidden-admin',
            kind: 'retrievalChunk',
            resourceNodeId: 'registry:hidden-admin',
            retrievalChunkId: 'retrieval-chunk:teacher-private',
          },
          {
            ref: 'citation-target:bode-reference',
            kind: 'citationTarget',
            citationTargetId: 'citation-target:bode-reference',
          },
          {
            ref: 'sar-candidate:hidden-admin',
            kind: 'resourceNode',
            resourceNodeId: 'registry:hidden-admin',
          },
          {
            ref: 'sar-candidate:teacher-only-reflection',
            kind: 'resourceNode',
            resourceNodeId: 'reflection_prompt:reflection-bode',
          },
        ],
      },
    });

    const sarBasis = plan.explanations.associativeRetrieval;

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('registry:bode-card');
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('retrieval-chunk:bode-reference');
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('citation-target:bode-reference');
    expect(sarBasis).toMatchObject({
      traceId: 'sar-trace:path-bode',
      seedEntityRefs: ['LearningGoal:goal-bode', 'GraphNode:kn-bode'],
      candidateResourceNodeIds: ['registry:bode-card', 'simulation:cruise'],
      selectedCandidateNodeIds: ['registry:bode-card', 'simulation:cruise'],
    });
    expect(sarBasis?.rejectedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ref: 'retrieval-chunk:bode-reference',
        reasonCodes: ['missing-resource-node-mapping'],
      }),
      expect.objectContaining({
        ref: 'registry:bode-card',
        reasonCodes: ['missing-resource-node-mapping'],
      }),
      expect.objectContaining({
        ref: 'citation-target:bode-reference',
        reasonCodes: ['missing-resource-node-mapping'],
      }),
      expect.objectContaining({
        ref: expect.stringMatching(/^restricted:/),
        reasonCodes: expect.arrayContaining(['privacy-scope-blocked', 'path-ineligible']),
      }),
      expect.objectContaining({
        ref: expect.stringMatching(/^restricted:/),
        reasonCodes: expect.arrayContaining(['teacher-policy-teacher-only']),
      }),
    ]));
    expect(JSON.stringify(sarBasis)).not.toContain('registry:hidden-admin');
    expect(JSON.stringify(sarBasis)).not.toContain('reflection_prompt:reflection-bode');
    expect(plan.visualization.evidence.associativeRetrieval).toEqual(sarBasis);
  });

  it('rejects SAR candidates that fail readiness or terminal validation gates', () => {
    const input = plannerInput({
      constraints: {
        ...plannerInput().constraints,
        completedNodeIds: [],
      },
      sarCandidateContext: {
        enabled: true,
        traceId: 'sar-trace:path-locked',
        seedEntityRefs: ['LearningGoal:goal-bode'],
        candidates: [
          {
            ref: 'sar-candidate:cruise',
            kind: 'resourceNode',
            resourceNodeId: 'simulation:cruise',
          },
          {
            ref: 'sar-candidate:bode-card-terminal',
            kind: 'resourceNode',
            resourceNodeId: 'registry:bode-card',
            requiredUse: 'terminal-validation',
          },
        ],
      },
    });

    const plan = buildAdaptiveLearningPathPlan(input);

    expect(plan.explanations.associativeRetrieval?.rejectedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceNodeId: 'simulation:cruise',
        reasonCodes: expect.arrayContaining(['readiness-required-completion']),
      }),
      expect.objectContaining({
        resourceNodeId: 'registry:bode-card',
        reasonCodes: expect.arrayContaining(['terminal-validation-insufficient']),
      }),
    ]));
    expect(plan.explanations.associativeRetrieval?.selectedCandidateNodeIds).not.toContain('simulation:cruise');
  });

  it('keeps planner output stable when SAR candidates are disabled', () => {
    const input = plannerInput();
    const baseline = buildAdaptiveLearningPathPlan(input);
    const disabled = buildAdaptiveLearningPathPlan({
      ...input,
      sarCandidateContext: {
        enabled: false,
        traceId: 'sar-trace:disabled',
        seedEntityRefs: ['LearningGoal:goal-bode'],
        candidates: [{
          ref: 'sar-candidate:bode-card',
          kind: 'resourceNode',
          resourceNodeId: 'registry:bode-card',
        }],
      },
    });

    expect(disabled.mainPath).toEqual(baseline.mainPath);
    expect(disabled.alternatives).toEqual(baseline.alternatives);
    expect(disabled.explanations.associativeRetrieval).toBeUndefined();
    expect(disabled.visualization.evidence.associativeRetrieval).toBeUndefined();
  });

  it('filters teacher-scoped Source Pack evidence from student-visible path payloads', () => {
    const teacherOnlyItem: SourcePackItem = {
      id: 'source-pack:teacher-only:private-planning-note',
      title: 'Teacher-only planning note',
      sourceKind: 'reference',
      modality: 'text',
      excerpt: 'Teacher-only planning rationale.',
      inclusionRationale: 'Teacher-only citation evidence must not persist into student paths.',
      retrievalChunkId: 'retrieval-chunk:teacher-private-note',
      citationTargetId: 'citation-target:teacher-private-note',
      scores: {
        relevance: 0.95,
        graphAlignment: 0.85,
        authority: 0.9,
        eligibility: 0.1,
        freshness: 0.8,
        final: 0.75,
      },
      access: {
        visibility: 'teacher',
        aiUseAllowed: true,
      },
      citation: {
        citationTargetId: 'citation-target:teacher-private-note',
        sourceId: 'teacher-note:private-planning-note',
        displayTitle: 'Teacher-only planning note',
        resolver: 'course-runtime',
        verified: true,
      },
      metadata: {
        reviewStatus: 'teacher-approved',
        knowledgeNodeRefs: ['kn-bode'],
        capabilityTargetRefs: ['parameterDesign'],
      },
    };

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      sourcePackRole: 'student',
      sourcePackCandidates: [teacherOnlyItem],
    }));

    expect(plan.visualization.evidence.sourcePackEvidence).toMatchObject({
      profile: 'path-planning',
      itemRefs: [],
      pathEligibleItemRefs: [],
      citationOnlyItemRefs: [],
      limitationCodes: expect.arrayContaining(['profile-filtered-visibility', 'source-pack-no-eligible-candidates']),
    });
    expect(JSON.stringify(plan.visualization.evidence.sourcePackEvidence)).not.toContain('teacher-private-note');
  });

  it('uses resource ranker scores when selecting the primary path candidate', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'legacy-high-score',
          label: '旧评分较高的长资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/legacy-high-score',
          knowledgeNodeIds: ['kn-ranker-target'],
          planningOverride: {
            estimatedTimeMinutes: 9,
            cognitiveLoad: 'high',
            evidenceInstrumentation: ['legacy_complete'],
            abilityImpact: { controlModeling: 0.9 },
            readiness: {
              minimumCompetency: {},
              minimumEvidenceCount: 1,
              requiredCompletedNodeIds: [],
              requiredOutcomeRefs: ['outcome:legacy-high-score'],
              unlockMessage: '需要先完成一次基础练习。',
              fallbackNodeIds: [],
            },
          },
        },
        {
          id: 'ranker-best-fit',
          label: 'Ranker 更匹配的短资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/ranker-best-fit',
          knowledgeNodeIds: ['kn-ranker-target'],
          planningOverride: {
            estimatedTimeMinutes: 4,
            cognitiveLoad: 'low',
            evidenceInstrumentation: ['best_fit_complete'],
            abilityImpact: { controlModeling: 0.1 },
            terminalConstraints: ['terminal-node'],
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'temporary-ranker-goal',
        title: 'Ranker 选择目标',
        knowledgeTargets: ['kn-ranker-target'],
        competencyTargets: ['controlModeling'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-ranker-target': { posteriorMastery: 0.35, confidence: 0.7, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.25, confidence: 0.7, evidenceCount: 1 },
          },
        },
        resourcePreference: {
          preferredModalities: ['interactive_lesson'],
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.65,
            evidenceCount: 2,
            sourceCompleteness: 0.6,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 9,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(['registry:ranker-best-fit']);
    expect(plan.mainPath[0]?.resourceRanker?.score).toBeGreaterThan(
      plan.alternatives.find((node) => node.nodeId === 'registry:legacy-high-score')?.resourceRanker?.score ?? 0,
    );
  });

  it('ranks ResourceNode candidates with learner-fit explanations and rejects retrieval-only inputs', () => {
    const input = plannerInput();
    const candidateNodes = input.registry.nodes.filter((node) => [
      'registry:bode-card',
      'simulation:cruise',
      'arena-task:roll-control',
    ].includes(node.id));
    const candidates = candidateNodes.map((node) => ({
      node,
      planningUnit: buildResourceSemanticProjection(node).planningUnit,
    }));

    const pathRanking = rankResourceLearnerCandidates({
      candidates,
      scene: 'path',
      targetGraphNodeIds: ['kn-cruise', 'parameterDesign'],
      learnerState: input.learnerState,
      preferredResourceTypes: ['simulation'],
      timeBudgetMinutes: 90,
      registry: input.registry,
    });
    const repeatedPathRanking = rankResourceLearnerCandidates({
      candidates,
      scene: 'path',
      targetGraphNodeIds: ['kn-cruise', 'parameterDesign'],
      learnerState: input.learnerState,
      preferredResourceTypes: ['simulation'],
      timeBudgetMinutes: 90,
      registry: input.registry,
    });
    const konlingRanking = rankResourceLearnerCandidates({
      candidates,
      scene: 'konling',
      targetGraphNodeIds: ['kn-cruise', 'parameterDesign'],
      learnerState: input.learnerState,
      preferredResourceTypes: ['simulation'],
      timeBudgetMinutes: 90,
      registry: input.registry,
    });

    expect(pathRanking.ranked.map((entry) => entry.node.id)).toEqual(repeatedPathRanking.ranked.map((entry) => entry.node.id));
    expect(pathRanking.sceneWeights['time-cost']).toBeGreaterThan(konlingRanking.sceneWeights['time-cost']);
    expect(konlingRanking.sceneWeights.freshness).toBeGreaterThan(pathRanking.sceneWeights.freshness);
    pathRanking.sceneWeights.freshness = 99;
    expect(repeatedPathRanking.sceneWeights.freshness).toBeLessThan(1);
    expect(pathRanking.ranked[0]).toMatchObject({
      score: expect.any(Number),
      reasonCodes: expect.arrayContaining([
        'ranker:graph-coverage',
        'ranker:evidence-potential',
      ]),
      explanation: {
        featureContributions: expect.arrayContaining([
          expect.objectContaining({ feature: 'graph-coverage' }),
          expect.objectContaining({ feature: 'learner-fit' }),
          expect.objectContaining({ feature: 'governance' }),
        ]),
        tieBreakReason: expect.stringContaining('scene:path'),
      },
    });

    const retrievalOnlyNode = candidateNodes.find((node) => node.id === 'registry:bode-card');
    expect(retrievalOnlyNode).toBeDefined();
    const retrievalOnlyRanking = rankResourceLearnerCandidates({
      candidates: [{
        node: retrievalOnlyNode!,
        planningUnit: null,
        rejectionReasons: ['resource-node-planning-audit-required'],
      }],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: input.learnerState,
      timeBudgetMinutes: 15,
      registry: input.registry,
    });

    expect(retrievalOnlyRanking.ranked).toEqual([]);
    expect(retrievalOnlyRanking.rejected).toEqual([
      expect.objectContaining({
        node: expect.objectContaining({ id: 'registry:bode-card' }),
        rejectionReasons: expect.arrayContaining([
          'resource-node-planning-audit-required',
          'missing-planning-unit-projection',
        ]),
      }),
    ]);
    const missingPlanningUnitRanking = rankResourceLearnerCandidates({
      candidates: [{
        node: retrievalOnlyNode!,
        planningUnit: null,
      }],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: input.learnerState,
      timeBudgetMinutes: 15,
      registry: input.registry,
    });

    expect(missingPlanningUnitRanking.rejected[0].rejectionReasons).toEqual(['missing-planning-unit-projection']);
  });

  it('ranks multiple reviewed core resource types without hard-coded goal names', () => {
    const teachingResources = [{
      id: 'core-lesson-resource',
      title: 'Core lesson resource',
      type: 'INTERACTIVE_COMP',
      registryId: 'core-lesson',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        resources: [],
        tags: ['correction'],
      }],
    }, {
      id: 'core-simulation-resource',
      title: 'Core simulation resource',
      type: 'SIMULATION_APP',
      registryId: 'core-simulation',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        resources: [],
        tags: ['correction'],
      }],
    }];
    const registry = buildResourceNodeRegistryFromTeachingResources(teachingResources, [{
      id: 'core-lesson',
      label: 'Core lesson',
      type: 'INTERACTIVE_COMP',
      renderTarget: '/resources/core-lesson',
      knowledgeNodeIds: ['kn-controller'],
      planningOverride: {
        abilityImpact: { controlModeling: 0.25 },
        evidenceInstrumentation: ['lesson_step_view'],
        privacyLevel: 'student-visible',
      },
    }, {
      id: 'core-simulation',
      label: 'Core simulation',
      type: 'SIMULATION_APP',
      launchTarget: '/resources/core-simulation',
      knowledgeNodeIds: ['kn-controller'],
      planningOverride: {
        abilityImpact: { controlModeling: 0.3 },
        evidenceInstrumentation: ['simulation_run'],
        privacyLevel: 'student-visible',
      },
    }]);
    const candidates = registry.nodes
      .map((node) => ({
        node,
        planningUnit: buildResourceSemanticProjection(node).planningUnit,
      }))
      .filter((candidate) => candidate.planningUnit);
    const ranking = rankResourceLearnerCandidates({
      candidates,
      scene: 'path',
      targetGraphNodeIds: ['kn-controller'],
      learnerState: null,
      timeBudgetMinutes: 30,
      registry,
    });

    expect(new Set(ranking.ranked.map((candidate) => candidate.node.type))).toEqual(new Set([
      'lesson_step',
      'simulation',
    ]));
    expect(ranking.rejected).toHaveLength(0);
  });

  it('uses stable tie-breaks for same-score resource candidates', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [
        {
          id: 'beta',
          title: 'B 卡',
          sourceRef: 'kn-bode:beta',
          renderTarget: '/knowledge/cards/beta',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: { estimatedTimeMinutes: 10 },
        },
        {
          id: 'alpha',
          title: 'A 卡',
          sourceRef: 'kn-bode:alpha',
          renderTarget: '/knowledge/cards/alpha',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: { estimatedTimeMinutes: 10 },
        },
      ],
    });
    const ranking = rankResourceLearnerCandidates({
      candidates: registry.nodes.map((node) => ({
        node,
        planningUnit: buildResourceSemanticProjection(node).planningUnit,
      })),
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 30,
      registry,
    });

    expect(ranking.ranked.map((entry) => entry.node.id)).toEqual([
      'knowledge-card:alpha',
      'knowledge-card:beta',
    ]);
    expect(ranking.ranked[0].score).toBe(ranking.ranked[1].score);
  });

  it('does not treat ordinary source slugs containing v as versioned refs', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [
        {
          id: 'overview',
          title: 'Overview 卡',
          sourceRef: 'overview',
          renderTarget: '/knowledge/cards/overview',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: { estimatedTimeMinutes: 10 },
        },
        {
          id: 'versioned',
          title: 'Versioned 卡',
          sourceRef: 'resource:v2',
          renderTarget: '/knowledge/cards/versioned',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: { estimatedTimeMinutes: 10 },
        },
      ],
    });
    const ranking = rankResourceLearnerCandidates({
      candidates: registry.nodes.map((node) => ({
        node,
        planningUnit: buildResourceSemanticProjection(node).planningUnit,
      })),
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 30,
      registry,
    });
    const freshnessById = new Map(ranking.ranked.map((entry) => [
      entry.node.id,
      entry.explanation.featureContributions.find((contribution) => contribution.feature === 'freshness')?.value ?? 0,
    ]));

    expect(freshnessById.get('knowledge-card:overview')).toBe(0.15);
    expect(freshnessById.get('knowledge-card:versioned')).toBe(0.5);
  });

  it('scores readiness by satisfied learner and constraint state', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'readiness-prep',
          label: '准备资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/readiness-prep',
          knowledgeNodeIds: ['kn-bode'],
        },
        {
          id: 'readiness-gated',
          label: '已解锁资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/readiness-gated',
          knowledgeNodeIds: ['kn-bode'],
          planningOverride: {
            estimatedTimeMinutes: 10,
            abilityImpact: { controlModeling: 0.2 },
            readiness: {
              minimumCompetency: { controlModeling: 0.3 },
              minimumEvidenceCount: 2,
              requiredCompletedNodeIds: ['registry:readiness-prep'],
              requiredOutcomeRefs: ['outcome:readiness-prep'],
              unlockMessage: '完成准备资源后解锁。',
              fallbackNodeIds: ['registry:readiness-prep'],
            },
          },
        },
      ],
    });
    const gatedNode = registry.nodes.find((node) => node.id === 'registry:readiness-gated');
    expect(gatedNode).toBeDefined();
    const candidate = {
      node: gatedNode!,
      planningUnit: buildResourceSemanticProjection(gatedNode!).planningUnit,
    };
    const blockedRanking = rankResourceLearnerCandidates({
      candidates: [candidate],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 30,
      registry,
    });
    const readyRanking = rankResourceLearnerCandidates({
      candidates: [candidate],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: {
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.35, confidence: 0.7, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            score: 0.7,
            evidenceCount: 2,
            sourceCompleteness: 0.6,
          },
        },
      },
      timeBudgetMinutes: 30,
      completedNodeIds: ['registry:readiness-prep'],
      availableOutcomeRefs: ['outcome:readiness-prep'],
      registry,
    });
    const blockedReadiness = blockedRanking.ranked[0].explanation.featureContributions
      .find((contribution) => contribution.feature === 'readiness');
    const readyReadiness = readyRanking.ranked[0].explanation.featureContributions
      .find((contribution) => contribution.feature === 'readiness');

    expect(blockedReadiness).toMatchObject({
      value: 0.55,
      reason: 'readiness prerequisites remain',
    });
    expect(readyReadiness).toMatchObject({
      value: 1,
      reason: 'readiness prerequisites satisfied',
    });
  });

  it('passes planner readiness constraints into resource ranker selection', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'planner-readiness-prep',
          label: 'Planner 准备资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/planner-readiness-prep',
          knowledgeNodeIds: ['kn-prep'],
        },
        {
          id: 'planner-readiness-gated',
          label: 'Planner 已解锁资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/planner-readiness-gated',
          knowledgeNodeIds: ['kn-planner-readiness'],
          planningOverride: {
            estimatedTimeMinutes: 8,
            cognitiveLoad: 'low',
            evidenceInstrumentation: ['gated_complete'],
            abilityImpact: { controlModeling: 0.4 },
            readiness: {
              minimumCompetency: { controlModeling: 0.3 },
              minimumEvidenceCount: 2,
              requiredCompletedNodeIds: ['registry:planner-readiness-prep'],
              requiredOutcomeRefs: ['outcome:planner-readiness-prep'],
              unlockMessage: '完成准备资源后解锁。',
              fallbackNodeIds: ['registry:planner-readiness-prep'],
            },
          },
        },
        {
          id: 'planner-readiness-fallback',
          label: 'Planner 无前置低匹配资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/planner-readiness-fallback',
          knowledgeNodeIds: ['kn-planner-readiness'],
          planningOverride: {
            estimatedTimeMinutes: 8,
            cognitiveLoad: 'low',
            evidenceInstrumentation: ['fallback_complete'],
            abilityImpact: { controlModeling: 0.1 },
          },
        },
      ],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'temporary-planner-readiness-goal',
        title: 'Planner readiness 目标',
        knowledgeTargets: ['kn-planner-readiness'],
        competencyTargets: ['controlModeling'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-planner-readiness': { posteriorMastery: 0.35, confidence: 0.7, evidenceCount: 2 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.35, confidence: 0.7, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 2,
            sourceCompleteness: 0.6,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 8,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['registry:planner-readiness-prep'],
        availableOutcomeRefs: ['outcome:planner-readiness-prep'],
      },
    }));
    const selectedNode = plan.mainPath[0];
    const readinessContribution = selectedNode?.resourceRanker?.featureContributions
      .find((contribution) => contribution.feature === 'readiness');

    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(['registry:planner-readiness-gated']);
    expect(readinessContribution).toMatchObject({
      value: 1,
      reason: 'readiness prerequisites satisfied',
    });
  });

  it('preserves learner modality preference when registry metadata is omitted', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [{
        id: 'preference-sim',
        title: '偏好仿真',
        launchTarget: '/simulations/preference',
        knowledgeNodeIds: ['kn-bode'],
      }],
    });
    const node = registry.nodes.find((entry) => entry.id === 'simulation:preference-sim');
    expect(node).toBeDefined();
    const ranking = rankResourceLearnerCandidates({
      candidates: [{
        node: node!,
        planningUnit: buildResourceSemanticProjection(node!).planningUnit,
      }],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: {
        resourcePreference: {
          preferredModalities: ['simulation'],
        },
      },
      timeBudgetMinutes: 30,
    });
    const learnerFit = ranking.ranked[0].explanation.featureContributions.find((contribution) =>
      contribution.feature === 'learner-fit'
    );

    expect(learnerFit?.value).toBeGreaterThanOrEqual(0.35);
  });

  it('keeps Konling citation suitability separate from path PlanningUnit eligibility', () => {
    const registry = buildResourceNodeRegistry({
      externalResources: [{
        id: 'bode-reference',
        title: 'Bode Reference',
        source: 'Example Library',
        url: 'https://example.edu/bode-reference',
        estimatedTimeMinutes: 8,
        knowledgeNodeIds: ['kn-bode'],
        applicableGoalId: 'goal-bode',
        evidenceUseStatus: 'reference-only',
        privacyPolicy: 'student-visible',
        planningOverride: {
          abilityImpact: { controlModeling: 0.2 },
        },
      }],
    });
    const node = registry.nodes.find((entry) => entry.id === 'external-resource:bode-reference');
    expect(node).toBeDefined();
    const projection = buildResourceSemanticProjection(node!);
    expect(projection.planningUnit).toBeNull();
    expect(projection.resource.graphProfile.sceneAvailability.konling.allowed).toBe(true);

    const konlingRanking = rankResourceLearnerCandidates({
      candidates: [{
        node: node!,
        planningUnit: projection.planningUnit,
      }],
      scene: 'konling',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 20,
      registry,
    });

    expect(konlingRanking.rejected).toEqual([]);
    expect(konlingRanking.ranked).toEqual([
      expect.objectContaining({
        node: expect.objectContaining({ id: 'external-resource:bode-reference' }),
        planningUnit: null,
        explanation: expect.objectContaining({
          matchedGraphRefs: {
            knowledge: ['kn-bode'],
            capability: [],
            quality: [],
          },
          limitations: expect.arrayContaining([
            'citation-target-not-verified',
            'external-resource-reference-only',
          ]),
          tieBreakReason: expect.stringContaining('scene:konling'),
        }),
      }),
    ]);

    const pathRanking = rankResourceLearnerCandidates({
      candidates: [{
        node: node!,
        planningUnit: projection.planningUnit,
      }],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 20,
      registry,
    });

    expect(pathRanking.ranked).toEqual([]);
    expect(pathRanking.rejected[0].rejectionReasons).toEqual(['missing-planning-unit-projection']);
  });

  it('rejects non-path scene resources blocked by governance audit', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'archived-konling-card',
        title: '已归档知识卡',
        sourceRef: 'kn-bode:archived',
        renderTarget: '/knowledge/cards/archived',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          availability: 'archived',
        },
      }, {
        id: 'blocked-konling-card',
        title: '教师禁用知识卡',
        sourceRef: 'kn-bode:blocked',
        renderTarget: '/knowledge/cards/blocked',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          teacherPolicy: 'blocked',
        },
      }, {
        id: 'teacher-only-konling-card',
        title: '教师专用知识卡',
        sourceRef: 'kn-bode:teacher-only',
        renderTarget: '/knowledge/cards/teacher-only',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          teacherPolicy: 'teacher-only',
        },
      }, {
        id: 'teacher-assigned-konling-card',
        title: '未分配教师指派知识卡',
        sourceRef: 'kn-bode:teacher-assigned',
        renderTarget: '/knowledge/cards/teacher-assigned',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          teacherPolicy: 'teacher-assigned',
        },
      }],
      externalResources: [{
        id: 'no-privacy-konling-reference',
        title: '缺少隐私策略外部资料',
        source: 'Example Library',
        url: 'https://example.edu/no-privacy',
        estimatedTimeMinutes: 6,
        knowledgeNodeIds: ['kn-bode'],
        applicableGoalId: 'goal-bode',
        evidenceUseStatus: 'explicit-access-required',
        planningOverride: {
          abilityImpact: { controlModeling: 0.2 },
        },
      }],
    });
    const ranking = rankResourceLearnerCandidates({
      candidates: registry.nodes.map((node) => ({
        node,
        planningUnit: buildResourceSemanticProjection(node).planningUnit,
      })),
      scene: 'konling',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 20,
      registry,
    });

    expect(ranking.ranked).toEqual([]);
    expect(ranking.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({
        node: expect.objectContaining({ id: 'knowledge-card:archived-konling-card' }),
        rejectionReasons: expect.arrayContaining(['unavailable-resource']),
      }),
      expect.objectContaining({
        node: expect.objectContaining({ id: 'knowledge-card:blocked-konling-card' }),
        rejectionReasons: expect.arrayContaining(['teacher-policy-blocked']),
      }),
      expect.objectContaining({
        node: expect.objectContaining({ id: 'external-resource:no-privacy-konling-reference' }),
        rejectionReasons: expect.arrayContaining(['missing-external-privacy-policy']),
      }),
      expect.objectContaining({
        node: expect.objectContaining({ id: 'knowledge-card:teacher-only-konling-card' }),
        rejectionReasons: expect.arrayContaining(['teacher-policy-teacher-only']),
      }),
      expect.objectContaining({
        node: expect.objectContaining({ id: 'knowledge-card:teacher-assigned-konling-card' }),
        rejectionReasons: expect.arrayContaining(['teacher-assignment-required']),
      }),
    ]));
  });

  it('only applies teacher assignment authorization to path ranking', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'assigned-path-card',
        title: '教师已指派知识卡',
        sourceRef: 'kn-bode:assigned-path',
        renderTarget: '/knowledge/cards/assigned-path',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          teacherPolicy: 'teacher-assigned',
        },
      }],
    });
    const assignedNode = registry.nodes.find((node) => node.id === 'knowledge-card:assigned-path-card');
    expect(assignedNode).toBeDefined();
    const candidate = {
      node: assignedNode!,
      planningUnit: buildResourceSemanticProjection(assignedNode!).planningUnit,
    };
    const unauthorizedPathRanking = rankResourceLearnerCandidates({
      candidates: [candidate],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 20,
      registry,
    });
    const authorizedPathRanking = rankResourceLearnerCandidates({
      candidates: [candidate],
      scene: 'path',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 20,
      teacherAssignedNodeIds: ['knowledge-card:assigned-path-card'],
      registry,
    });
    const konlingRanking = rankResourceLearnerCandidates({
      candidates: [candidate],
      scene: 'konling',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 20,
      teacherAssignedNodeIds: ['knowledge-card:assigned-path-card'],
      registry,
    });
    const diagnosisRanking = rankResourceLearnerCandidates({
      candidates: [candidate],
      scene: 'diagnosis',
      targetGraphNodeIds: ['kn-bode'],
      learnerState: null,
      timeBudgetMinutes: 20,
      teacherAssignedNodeIds: ['knowledge-card:assigned-path-card'],
      registry,
    });

    expect(unauthorizedPathRanking.ranked).toEqual([]);
    expect(unauthorizedPathRanking.rejected[0].rejectionReasons).toContain('teacher-assignment-required');
    expect(authorizedPathRanking.ranked[0].node.id).toBe('knowledge-card:assigned-path-card');
    expect(konlingRanking.ranked).toEqual([]);
    expect(konlingRanking.rejected[0].rejectionReasons).toContain('teacher-assignment-required');
    expect(diagnosisRanking.ranked).toEqual([]);
    expect(diagnosisRanking.rejected[0].rejectionReasons).toContain('teacher-assignment-required');
  });

  it('can select textbook sections as foundation-remediation path resources', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'kn-bode-card',
        title: '伯德图知识卡',
        sourceRef: 'kn-bode:card',
        renderTarget: '/knowledge/cards/kn-bode',
        knowledgeNodeIds: ['kn-bode'],
      }],
      textbookSections: [{
        bookId: 'dorf-modern-control-systems',
        sectionId: 'ch10-sec01',
        title: 'Modern Control Systems 根轨迹校正节',
        citationHref: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md',
        knowledgeNodeIds: ['kn-bode'],
        capabilityTargetIds: ['controlModeling'],
        estimatedTimeMinutes: 9,
      }],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      registry,
      policyFamily: 'foundation-remediation',
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.18, confidence: 0.7, evidenceCount: 2 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.25, confidence: 0.6, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.6,
            evidenceCount: 3,
            sourceCompleteness: 0.6,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.mainPath).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: 'textbook-section:dorf-modern-control-systems:ch10-sec01',
        type: 'textbook_section',
        pathNodeType: 'textbook_section',
        evidenceBehavior: 'explicit_access',
        target: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md',
      }),
    ]));
    expect(JSON.stringify(plan)).not.toContain('retrieval-chunk:');
  });

  it('uses server time instead of client requestedAt for authoritative path timestamps', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      requestedAt: '2035-01-01T00:00:00.000Z',
      now: new Date('2026-05-27T08:00:00.000Z'),
    }));

    expect(plan.executionStatus.updatedAt).toBe('2026-05-27T08:00:00.000Z');
    expect(plan.visualization.timeline.generatedAt).toBe('2026-05-27T08:00:00.000Z');
    expect(JSON.stringify(plan)).not.toContain('2035-01-01T00:00:00.000Z');
  });

  it('registers path-ready LearningGoals with governed K/A/Q graph bindings', () => {
    expect(validateLearningGoalCatalog()).toEqual([]);
    const objectiveIds = new Set(AUTOCONTROL_KAQ_OBJECTIVES.map((objective) => objective.id));
    const graphNodeIds = new Set(AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.map((node) => node.id));
    const learningGoals = listLearningGoals();
    const pathReadyLearningGoals = learningGoals.filter((learningGoal) => learningGoal.status === 'path-ready');

    expect(pathReadyLearningGoals.length).toBeGreaterThanOrEqual(8);
    expect(pathReadyLearningGoals.map((learningGoal) => learningGoal.intentType)).toEqual(expect.arrayContaining([
      'concept-understanding',
      'modeling',
      'analysis',
      'controller-design',
      'simulation-validation',
      'transfer-application',
    ]));
    for (const learningGoal of pathReadyLearningGoals) {
      expect(learningGoal.knowledgeObjectiveIds.every((id) => id.startsWith('knowledge:') && objectiveIds.has(id))).toBe(true);
      expect(learningGoal.capabilityObjectiveIds.every((id) => id.startsWith('capability:') && objectiveIds.has(id))).toBe(true);
      expect(learningGoal.qualityObjectiveIds.every((id) => id.startsWith('quality:') && objectiveIds.has(id))).toBe(true);
      expect(learningGoal.targetGraphNodeIds.every((id) => graphNodeIds.has(id))).toBe(true);
      expect(learningGoal.goalSliceId).toBe('control-correction');
      expect(learningGoal.resourceMix.required.length).toBeGreaterThan(0);
      expect(learningGoal.resourceMix.preferred.length).toBeGreaterThan(0);
      expect(learningGoal.evidencePolicy.requiredEvidenceTypes.length).toBeGreaterThan(0);
      expect(learningGoal.terminalValidationPolicy.acceptedEvidenceTypes.length).toBeGreaterThan(0);
      if (!learningGoal.evidencePolicy.qualityEvidenceGoverned) {
        expect([
          ...learningGoal.evidencePolicy.limitations,
          ...learningGoal.limitations,
        ]).toContain('quality-rubric-evidence-not-fully-governed');
      }
    }
  });

  it('preserves registered goal path calls while exposing LearningGoal metadata', () => {
    const legacyControlCorrectionGoal = {
      id: 'control-correction',
      title: '控制系统校正设计',
      knowledgeTargets: [
        'control-correction:time-domain-targets',
        'control-correction:root-locus-design',
        'control-correction:simulation-validation',
        'control-correction:arena-transfer',
      ],
      competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
    };
    const controlCorrectionPlan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildControlCorrectionResourceNodeRegistry(),
      goal: legacyControlCorrectionGoal,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
    }));
    const frequencyResponsePlan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
    }));

    expect(controlCorrectionPlan.goal.learningGoal).toMatchObject({
      id: 'control-correction',
      qualityObjectiveIds: expect.arrayContaining(['quality:autocontrol:evidence-integrity']),
      targetGraphNodeIds: expect.arrayContaining(['cap:autocontrol:validate-with-simulation-evidence']),
    });
    expect(controlCorrectionPlan.goal).not.toHaveProperty('learningGoalPackage');
    const serializedControlCorrectionPlan = serializeLearningPathPlan(controlCorrectionPlan);
    expect(serializedControlCorrectionPlan.payload.learningGoal?.id).toBe('control-correction');
    expect(serializedControlCorrectionPlan.payload).not.toHaveProperty('learningGoalPackage');
    expect(serializedControlCorrectionPlan.payload.artifactVersioning).toMatchObject({
      artifactKind: 'path-artifact',
      artifactId: controlCorrectionPlan.id,
      versionRefs: {
        learningGoalPackageVersion: controlCorrectionPlan.goal.learningGoal?.version,
        graphCatalogVersion: 'autocontrol-kaq-graph.v1',
        resourceProjectionVersion: 'resource-semantic-projection.v1',
        plannerVersion: 'adaptive-learning-path-planner.v1',
      },
      limitations: [],
    });
    const serializedRegisteredGoalPlan = serializeLearningPathPlan({
      ...controlCorrectionPlan,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: ['control-correction:root-locus-design'],
        competencyTargets: ['parameterDesign'],
      },
    });
    expect(serializedRegisteredGoalPlan.payload.learningGoal?.version).toBe(controlCorrectionPlan.goal.learningGoal?.version);
    expect(serializedRegisteredGoalPlan.payload).not.toHaveProperty('learningGoalPackage');
    expect(serializedRegisteredGoalPlan.payload.artifactVersioning).toMatchObject({
      versionRefs: {
        learningGoalPackageVersion: controlCorrectionPlan.goal.learningGoal?.version,
      },
      limitations: [],
    });
    expect(frequencyResponsePlan.goal.learningGoal).toMatchObject({
      id: 'frequency-response-foundations',
      knowledgeObjectiveIds: ['knowledge:autocontrol:frequency-response'],
    });

    expect(normalizeLearningPathPayloadLearningGoal({
      ...serializedControlCorrectionPlan.payload,
      learningGoal: undefined,
      learningGoalPackage: controlCorrectionPlan.goal.learningGoal,
    }, 'control-correction')?.id).toBe('control-correction');
  });

  it('consumes graph-driven LearningGoal context and records overlay limitations', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const expandedSubgraph = expandLearningGoalSubgraph(learningGoal.id);
    const graphTargetId = learningGoal.targetGraphNodeIds[0];
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'graph-frequency-card',
        title: '频域图谱知识卡',
        sourceRef: 'frequency-response:graph-card',
        renderTarget: '/knowledge/cards/frequency-response',
        knowledgeNodeIds: ['legacy-frequency-response-target'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.3,
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-frequency-response-target'],
      },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph,
        resourceCoverage: {
          [graphTargetId]: {
            domain: 'knowledge',
            nodeId: graphTargetId,
            linkedResourceCount: 1,
            pathEligibleResourceCount: 1,
            ragIndexedCount: 0,
            citationReadyCount: 0,
            verifiedCitationCount: 0,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'partial',
            missingCoverageTypes: ['rag-indexed-resource', 'citation-ready-resource'],
            linkedResourceIds: ['resource:graph-frequency-card'],
            pathEligibleResourceIds: ['knowledge-card:graph-frequency-card'],
          },
        },
        learnerOverlay: {
          status: 'low-confidence',
          learnerId: 'student-1',
          classId: 'class-1',
          generatedAt: '2026-06-22T00:00:00.000Z',
          items: {},
          limitations: [{ code: 'learner-overlay-low-confidence', message: 'overlay confidence is low' }],
        },
        classOverlay: null,
        versionRefs: buildKaqArtifactVersionRefs({
          learningGoalPackageVersion: 'forged-learning-goal-version',
          graphCatalogVersion: 'forged-graph-version',
          overlayVersion: GRAPH_CENTER_OVERLAY_VERSION,
        }),
      },
    }));
    const serialized = serializeLearningPathPlan(plan);

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('knowledge-card:graph-frequency-card');
    const graphMappedNode = plan.mainPath.find((node) => node.nodeId === 'knowledge-card:graph-frequency-card');
    expect(graphMappedNode?.resourceRanker?.matchedGraphRefs.knowledge).toContain(graphTargetId);
    expect(graphMappedNode?.reasonCodes).toContain('ranker:graph-coverage');
    expect(plan.graphContext).toMatchObject({
      learningGoalId: learningGoal.id,
      learningGoalVersion: learningGoal.version,
      targetGraphNodeIds: expect.arrayContaining([graphTargetId]),
      overlayStatus: {
        learner: 'low-confidence',
        class: 'missing',
      },
    });
    expect(plan.graphContext?.limitations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'resource-coverage-partial',
      'learner-overlay-low-confidence',
      'class-overlay-missing',
    ]));
    expect(plan.explanations.fallbackReasons).toContain('graph-target-coverage-partial');
    expect(serialized.payload.artifactVersioning.versionRefs).toMatchObject({
      learningGoalPackageVersion: learningGoal.version,
      graphCatalogVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
      overlayVersion: GRAPH_CENTER_OVERLAY_VERSION,
    });
    expect(serialized.payload.graphContext?.versionRefs).toMatchObject({
      learningGoalPackageVersion: learningGoal.version,
      graphCatalogVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
      overlayVersion: GRAPH_CENTER_OVERLAY_VERSION,
    });
    expect(serialized.payload.graphContext).not.toHaveProperty('resourceCoveragePathEligibleResourceIds');
    expect(JSON.stringify(serialized.payload.graphContext)).not.toContain('knowledge-card:graph-frequency-card');
  });

  it('blocks graph-driven paths when LearningGoal baseline coverage is incomplete', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const expandedSubgraph = expandLearningGoalSubgraph(learningGoal.id);
    const graphTargetId = learningGoal.targetGraphNodeIds[0];
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'baseline-frequency-card',
        title: '频域基线知识卡',
        sourceRef: 'frequency-response:baseline-card',
        renderTarget: '/knowledge/cards/frequency-response-baseline',
        knowledgeNodeIds: ['legacy-frequency-response-baseline'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.3,
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-frequency-response-baseline'],
      },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph,
        resourceCoverage: {
          [graphTargetId]: {
            domain: 'knowledge',
            nodeId: graphTargetId,
            linkedResourceCount: 1,
            pathEligibleResourceCount: 1,
            ragIndexedCount: 1,
            citationReadyCount: 1,
            verifiedCitationCount: 1,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'sufficient',
            missingCoverageTypes: [],
            linkedResourceIds: ['knowledge-card:baseline-frequency-card'],
            pathEligibleResourceIds: ['knowledge-card:baseline-frequency-card'],
            pathEligibleResourceRouteIds: ['knowledge-card:baseline-frequency-card'],
            filterKnowledgeRefs: [graphTargetId],
          },
        },
        learningGoalBaseline: {
          coverageState: 'limited',
          missingBaselineCategories: ['checkpoint', 'remediation'],
          reviewedBindingCount: 4,
          limitationReason: 'missing-baseline-categories:checkpoint,remediation',
          sourceWindow: { from: null, to: '2026-06-24T00:00:00.000Z' },
        },
      },
    }));

    expect(plan.graphContext?.limitations).toContainEqual(expect.objectContaining({
      code: 'learning-goal-baseline-incomplete',
      severity: 'blocking',
    }));
    expect(plan.explanations.fallbackReasons).toContain('learning-goal-baseline-incomplete');
    expect(plan.mainPath).toEqual([]);
  });

  it('keeps graph partial fallback to a minimal starter when full target coverage is unavailable', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const expandedSubgraph = expandLearningGoalSubgraph(learningGoal.id);
    const [firstTarget, secondTarget, missingTarget] = learningGoal.targetGraphNodeIds;
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'graph-frequency-card-a',
        title: '频域图谱知识卡 A',
        sourceRef: 'frequency-response:graph-card-a',
        renderTarget: '/knowledge/cards/frequency-response-a',
        knowledgeNodeIds: ['legacy-frequency-response-a'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.3,
          },
        },
      }, {
        id: 'graph-frequency-card-b',
        title: '频域图谱知识卡 B',
        sourceRef: 'frequency-response:graph-card-b',
        renderTarget: '/knowledge/cards/frequency-response-b',
        knowledgeNodeIds: ['legacy-frequency-response-b'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.25,
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-frequency-response-a', 'legacy-frequency-response-b'],
      },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph,
        selectedGraphNodeIds: [secondTarget],
        resourceCoverage: {
          [firstTarget]: {
            domain: 'knowledge',
            nodeId: firstTarget,
            linkedResourceCount: 1,
            pathEligibleResourceCount: 1,
            ragIndexedCount: 0,
            citationReadyCount: 0,
            verifiedCitationCount: 0,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'partial',
            missingCoverageTypes: ['rag-indexed-resource'],
            linkedResourceIds: ['resource:graph-frequency-card-a'],
            pathEligibleResourceIds: ['knowledge-card:graph-frequency-card-a'],
          },
          [secondTarget]: {
            domain: 'knowledge',
            nodeId: secondTarget,
            linkedResourceCount: 1,
            pathEligibleResourceCount: 1,
            ragIndexedCount: 0,
            citationReadyCount: 0,
            verifiedCitationCount: 0,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'partial',
            missingCoverageTypes: ['rag-indexed-resource'],
            linkedResourceIds: ['resource:graph-frequency-card-b'],
            pathEligibleResourceIds: ['knowledge-card:graph-frequency-card-b'],
          },
          [missingTarget]: {
            domain: 'knowledge',
            nodeId: missingTarget,
            linkedResourceCount: 0,
            pathEligibleResourceCount: 0,
            ragIndexedCount: 0,
            citationReadyCount: 0,
            verifiedCitationCount: 0,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'missing',
            missingCoverageTypes: ['path-eligible-resource'],
            linkedResourceIds: [],
            pathEligibleResourceIds: [],
          },
        },
        learnerOverlay: null,
        classOverlay: null,
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.explanations.fallbackReasons).toContain('graph-target-coverage-partial');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(['knowledge-card:graph-frequency-card-b']);
    expect(plan.mainPath[0]?.resourceRanker?.featureContributions).toContainEqual(expect.objectContaining({
      feature: 'selected-graph-focus',
      value: 1,
    }));
    expect(plan.mainPath[0]?.reasonCodes).toContain('ranker:selected-graph-focus');
  });

  it('blocks non-final terminal repair violations even for graph partial starters', () => {
    const originalRepair = deterministicPathConstraintRepairAdapter.repair;
    deterministicPathConstraintRepairAdapter.repair = (repairInput) => {
      const repairedNodeId = repairInput.candidates.find((candidate) => candidate.nodeId === 'knowledge-card:graph-frequency-card-b')?.nodeId
        ?? repairInput.candidates[0]?.nodeId
        ?? 'knowledge-card:graph-frequency-card-b';
      return {
        status: 'infeasible',
        draftNodeIds: repairInput.draftNodeIds,
        repairedNodeIds: [repairedNodeId],
        insertedNodeIds: [],
        removedNodeIds: [],
        checkpointNodeIds: [],
        terminalValidationNodeIds: [],
        repairedConstraints: [],
        tradeoffs: [],
        limitations: [],
        infeasibleReasons: [{
          code: 'terminal-validation-not-final',
          nodeIds: [repairedNodeId],
          message: `Terminal validation ${repairedNodeId} must be the final node in the repaired path.`,
        }],
        versionRefs: Object.fromEntries(
          Object.entries(repairInput.versionRefs).map(([key, value]) => [key, value ?? null])
        ),
      };
    };

    try {
      const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
      const expandedSubgraph = expandLearningGoalSubgraph(learningGoal.id);
      const [firstTarget, secondTarget, missingTarget] = learningGoal.targetGraphNodeIds;
      const registry = buildResourceNodeRegistry({
        knowledgeCards: [{
          id: 'graph-frequency-card-a',
          title: '频域图谱知识卡 A',
          sourceRef: 'frequency-response:graph-card-a',
          renderTarget: '/knowledge/cards/frequency-response-a',
          knowledgeNodeIds: ['legacy-frequency-response-a'],
          planningOverride: {
            abilityImpact: {
              frequencyResponseInterpretation: 0.3,
            },
          },
        }, {
          id: 'graph-frequency-card-b',
          title: '频域图谱知识卡 B',
          sourceRef: 'frequency-response:graph-card-b',
          renderTarget: '/knowledge/cards/frequency-response-b',
          knowledgeNodeIds: ['legacy-frequency-response-b'],
          planningOverride: {
            abilityImpact: {
              frequencyResponseInterpretation: 0.25,
            },
          },
        }],
      });

      const plan = buildAdaptiveLearningPathPlan(plannerInput({
        goal: {
          id: learningGoal.id,
          title: learningGoal.title,
          knowledgeTargets: ['legacy-frequency-response-a', 'legacy-frequency-response-b'],
        },
        learnerState: null,
        registry,
        constraints: {
          timeBudgetMinutes: 30,
          privacyScopes: ['student-visible'],
        },
        graphContext: {
          learningGoalId: learningGoal.id,
          learningGoalVersion: learningGoal.version,
          objectiveBoundary: {
            knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
            capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
            qualityObjectiveIds: learningGoal.qualityObjectiveIds,
          },
          expandedSubgraph,
          selectedGraphNodeIds: [secondTarget],
          resourceCoverage: {
            [firstTarget]: {
              domain: 'knowledge',
              nodeId: firstTarget,
              linkedResourceCount: 1,
              pathEligibleResourceCount: 1,
              ragIndexedCount: 0,
              citationReadyCount: 0,
              verifiedCitationCount: 0,
              assessmentResourceCount: 0,
              simulationResourceCount: 0,
              arenaPreviewResourceCount: 0,
              arenaOfficialResourceCount: 0,
              terminalValidationCapableResourceCount: 0,
              coverageState: 'partial',
              missingCoverageTypes: ['rag-indexed-resource'],
              linkedResourceIds: ['resource:graph-frequency-card-a'],
              pathEligibleResourceIds: ['knowledge-card:graph-frequency-card-a'],
            },
            [secondTarget]: {
              domain: 'knowledge',
              nodeId: secondTarget,
              linkedResourceCount: 1,
              pathEligibleResourceCount: 1,
              ragIndexedCount: 0,
              citationReadyCount: 0,
              verifiedCitationCount: 0,
              assessmentResourceCount: 0,
              simulationResourceCount: 0,
              arenaPreviewResourceCount: 0,
              arenaOfficialResourceCount: 0,
              terminalValidationCapableResourceCount: 0,
              coverageState: 'partial',
              missingCoverageTypes: ['rag-indexed-resource'],
              linkedResourceIds: ['resource:graph-frequency-card-b'],
              pathEligibleResourceIds: ['knowledge-card:graph-frequency-card-b'],
            },
            [missingTarget]: {
              domain: 'knowledge',
              nodeId: missingTarget,
              linkedResourceCount: 0,
              pathEligibleResourceCount: 0,
              ragIndexedCount: 0,
              citationReadyCount: 0,
              verifiedCitationCount: 0,
              assessmentResourceCount: 0,
              simulationResourceCount: 0,
              arenaPreviewResourceCount: 0,
              arenaOfficialResourceCount: 0,
              terminalValidationCapableResourceCount: 0,
              coverageState: 'missing',
              missingCoverageTypes: ['path-eligible-resource'],
              linkedResourceIds: [],
              pathEligibleResourceIds: [],
            },
          },
          learnerOverlay: null,
          classOverlay: null,
        },
      }));

      expect(plan.status).toBe('fallback');
      expect(plan.explanations.fallbackReasons).toContain('graph-target-coverage-partial');
      expect(plan.explanations.fallbackReasons).toContain('terminal-validation-not-final');
      expect(plan.mainPath).toEqual([]);
    } finally {
      deterministicPathConstraintRepairAdapter.repair = originalRepair;
    }
  });

  it('matches ResourceNodes bound to required graph prerequisites', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const expandedSubgraph = expandLearningGoalSubgraph(learningGoal.id);
    const graphTargetId = learningGoal.targetGraphNodeIds[0];
    const prerequisiteNodeId = 'kn:autocontrol:required-frequency-prerequisite';
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'graph-prerequisite-card',
        title: '频域先修图谱知识卡',
        sourceRef: 'frequency-response:graph-prerequisite',
        renderTarget: '/knowledge/cards/frequency-response-prerequisite',
        knowledgeNodeIds: ['legacy-frequency-prerequisite'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.2,
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-frequency-prerequisite'],
      },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph: {
          ...expandedSubgraph,
          prerequisitePolicy: [{
            edgeId: 'edge-required-frequency-prerequisite',
            sourceNodeId: prerequisiteNodeId,
            targetNodeId: graphTargetId,
            domain: 'knowledge',
            relation: 'requires',
            strength: 'strong',
            semantics: 'hard_prerequisite',
            direction: 'incoming',
            required: true,
            rationale: 'Required prerequisite fixture for planner graph matching.',
          }],
        },
        resourceCoverage: {
          [prerequisiteNodeId]: {
            domain: 'knowledge',
            nodeId: prerequisiteNodeId,
            linkedResourceCount: 1,
            pathEligibleResourceCount: 1,
            ragIndexedCount: 0,
            citationReadyCount: 0,
            verifiedCitationCount: 0,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'partial',
            missingCoverageTypes: ['rag-indexed-resource'],
            linkedResourceIds: ['resource:graph-prerequisite-card'],
            pathEligibleResourceIds: ['knowledge-card:graph-prerequisite-card'],
          },
        },
        learnerOverlay: null,
        classOverlay: null,
      },
    }));

    expect(plan.graphContext?.targetGraphNodeIds).toContain(prerequisiteNodeId);
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(['knowledge-card:graph-prerequisite-card']);
    expect(plan.explanations.fallbackReasons).toContain('graph-target-coverage-partial');
  });

  it('does not let graph context linked chunks bypass audited ResourceNodes', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const graphTargetId = learningGoal.targetGraphNodeIds[0];
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: [],
      },
      learnerState: null,
      registry: buildResourceNodeRegistry({ registeredResources: [] }),
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph: expandLearningGoalSubgraph(learningGoal.id),
        resourceCoverage: {
          [graphTargetId]: {
            domain: 'knowledge',
            nodeId: graphTargetId,
            linkedResourceCount: 1,
            pathEligibleResourceCount: 0,
            ragIndexedCount: 1,
            citationReadyCount: 1,
            verifiedCitationCount: 1,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'missing',
            missingCoverageTypes: ['path-eligible-resource'],
            linkedResourceIds: [
              'resource-segment:frequency-response-segment',
              'retrieval-chunk:frequency-response-chunk',
              'citation-target:frequency-response-citation',
            ],
            pathEligibleResourceIds: [],
          },
        },
        learnerOverlay: null,
        classOverlay: null,
      },
    }));

    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('resource-mapping-insufficient');
    expect(plan.graphContext?.limitations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'resource-coverage-missing-path-eligible',
      'learner-overlay-missing',
      'class-overlay-missing',
    ]));
    expect(JSON.stringify(serializeLearningPathPlan(plan))).not.toContain('retrieval-chunk:frequency-response-chunk');
    expect(JSON.stringify(serializeLearningPathPlan(plan))).not.toContain('citation-target:frequency-response-citation');
  });

  it('ignores graph context when its LearningGoal differs from the planner goal', () => {
    const frequencyGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
      learnerState: null,
      registry: buildControlCorrectionResourceNodeRegistry(),
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: frequencyGoal.id,
        learningGoalVersion: frequencyGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: frequencyGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: frequencyGoal.capabilityObjectiveIds,
          qualityObjectiveIds: frequencyGoal.qualityObjectiveIds,
        },
        expandedSubgraph: expandLearningGoalSubgraph(frequencyGoal.id),
        learnerOverlay: null,
        classOverlay: null,
      },
    }));
    const serialized = serializeLearningPathPlan(plan);

    expect(plan.goal.id).toBe('control-correction');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(expect.arrayContaining([
      'registry:lesson09-correction-precheck',
      'arena-task:task-second-order-lead-pid',
    ]));
    expect(plan.graphContext).toBeUndefined();
    expect(serialized.payload.graphContext).toBeUndefined();
  });

  it('ignores graph context when the expanded subgraph belongs to another LearningGoal', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'legacy-frequency-card',
        title: '频域旧目标知识卡',
        sourceRef: 'frequency-response:legacy-card',
        renderTarget: '/knowledge/cards/frequency-response-legacy',
        knowledgeNodeIds: ['legacy-frequency-response-target'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.3,
          },
        },
      }],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-frequency-response-target'],
      },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph: expandLearningGoalSubgraph('control-correction'),
        learnerOverlay: null,
        classOverlay: null,
      },
    }));
    const serialized = serializeLearningPathPlan(plan);

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('knowledge-card:legacy-frequency-card');
    expect(plan.graphContext).toBeUndefined();
    expect(serialized.payload.graphContext).toBeUndefined();
  });

  it('ignores graph context when the expanded subgraph version is stale', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'legacy-frequency-card',
        title: '频域旧目标知识卡',
        sourceRef: 'frequency-response:legacy-card',
        renderTarget: '/knowledge/cards/frequency-response-legacy',
        knowledgeNodeIds: ['legacy-frequency-response-target'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.3,
          },
        },
      }],
    });
    const expandedSubgraph = {
      ...expandLearningGoalSubgraph(learningGoal.id),
      learningGoalVersion: 'stale-learning-goal-version',
    };
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-frequency-response-target'],
      },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph,
        learnerOverlay: null,
        classOverlay: null,
      },
    }));
    const serialized = serializeLearningPathPlan(plan);

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('knowledge-card:legacy-frequency-card');
    expect(plan.graphContext).toBeUndefined();
    expect(serialized.payload.graphContext).toBeUndefined();
  });

  it('ignores graph context when its LearningGoal version is no longer canonical', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].learningGoal!;
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'legacy-frequency-card',
        title: '频域旧目标知识卡',
        sourceRef: 'frequency-response:legacy-card',
        renderTarget: '/knowledge/cards/frequency-response-legacy',
        knowledgeNodeIds: ['legacy-frequency-response-target'],
        planningOverride: {
          abilityImpact: {
            frequencyResponseInterpretation: 0.3,
          },
        },
      }],
    });
    const expandedSubgraph = {
      ...expandLearningGoalSubgraph(learningGoal.id),
      learningGoalVersion: 'stale-learning-goal-version',
    };
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-frequency-response-target'],
      },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: 'stale-learning-goal-version',
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph,
        learnerOverlay: null,
        classOverlay: null,
      },
    }));
    const serialized = serializeLearningPathPlan(plan);

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('knowledge-card:legacy-frequency-card');
    expect(plan.graphContext).toBeUndefined();
    expect(serialized.payload.graphContext).toBeUndefined();
  });

  it('keeps unknown LearningGoal ids on the existing registered-goal rejection path', () => {
    const canonicalLearningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].learningGoal!;
    const forgedPlan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        ...ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
        learningGoal: {
          ...canonicalLearningGoal,
          id: 'unknown-learning-goal',
          knowledgeObjectiveIds: ['knowledge:fake'],
          capabilityObjectiveIds: ['capability:fake'],
          qualityObjectiveIds: ['quality:fake'],
          targetGraphNodeIds: ['kn:fake'],
        },
      },
      registry: buildControlCorrectionResourceNodeRegistry(),
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
    }));

    expect(getLearningGoal('unknown-learning-goal')).toBeNull();
    expect(isRegisteredAdaptiveLearningPathGoal('unknown-learning-goal')).toBe(false);
    expect(listLearningGoals().some((learningGoal) =>
      learningGoal.id === 'unknown-learning-goal'
    )).toBe(false);
    expect(forgedPlan.goal.learningGoal?.id).toBe('control-correction');
    expect(forgedPlan.goal.learningGoal?.knowledgeObjectiveIds).not.toContain('knowledge:fake');
    expect(serializeLearningPathPlan(forgedPlan).payload.learningGoal?.id).toBe('control-correction');
    expect(validateLearningGoal({
      ...canonicalLearningGoal,
      knowledgeObjectiveIds: ['capability:autocontrol:synthesize-controller-correction'],
    }).map((issue) => issue.code)).toContain('objective-domain-mismatch');
    expect(validateLearningGoal({
      ...canonicalLearningGoal,
      goalSliceId: 'unknown-learning-goal-slice',
    }).map((issue) => issue.code)).toContain('unknown-goal-slice-id');
  });

  it('applies requested resource, difficulty, and checkpoint preferences to path scoring', () => {
    const preferredSimulation = buildAdaptiveLearningPathPlan(plannerInput({
      resourcePreferences: ['simulation', 'arena_task'],
      difficultyRhythm: 'challenge',
    }));
    const denseCheckpoint = buildAdaptiveLearningPathPlan({
      studentId: 'student-1',
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
      learnerState: null,
      registry: buildControlCorrectionResourceNodeRegistry(),
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible'],
        completedNodeIds: [],
      },
      checkpointPreference: 'dense',
      now: new Date('2026-05-27T08:00:00.000Z'),
    });

    expect(preferredSimulation.explanations.selectedReasons).toContain('matches-resource-preference');
    expect(preferredSimulation.explanations.selectedReasons).toContain('matches-challenge-rhythm');
    expect(preferredSimulation.mainPath.some((node) =>
      (node.type === 'simulation' || node.type === 'arena_task') &&
      node.reasonCodes.includes('matches-resource-preference')
    )).toBe(true);
    expect(denseCheckpoint.explanations.selectedReasons).toContain('matches-dense-checkpoint-preference');
    expect(denseCheckpoint.mainPath.some((node) =>
      node.terminalConstraints.includes('terminal-validation') &&
      node.reasonCodes.includes('matches-dense-checkpoint-preference')
    )).toBe(true);
  });

  it('prioritizes teacher-assigned resources only when teacher policy allows them', () => {
    const input = plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        teacherAssignedNodeIds: [
          'registry:bode-card',
          'registry:bode-sim',
          'simulation:cruise',
          'arena-task:roll-control',
        ],
      },
      policyFamily: 'teacher-assigned',
    });
    for (const node of input.registry.nodes) {
      if (input.constraints.teacherAssignedNodeIds?.includes(node.id)) {
        node.planningMetadata.teacherPolicy = 'teacher-assigned';
      }
    }

    const plan = buildAdaptiveLearningPathPlan(input);

    expect(plan.status).toBe('ready');
    expect(plan.policyFamily).toBe('teacher-assigned');
    expect(plan.explanations.selectedReasons).toContain('policy-teacher-assigned');
    const assignedPathNode = plan.mainPath.find((node) => node.nodeId === 'registry:bode-card');
    expect(assignedPathNode?.teacherPolicy).toBe('teacher-assigned');
    expect(assignedPathNode?.resourceRanker).toEqual(expect.objectContaining({
      score: expect.any(Number),
      matchedGraphRefs: expect.any(Object),
    }));
  });

  it('blocks teacher-assigned resources that are not explicitly assigned', () => {
    const input = plannerInput({
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'assigned-card',
            label: '教师指定基础卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/teacher/resources/assigned-card',
            knowledgeNodeIds: ['kn-bode', 'kn-cruise'],
            planningOverride: {
              teacherPolicy: 'teacher-assigned',
            },
          },
        ],
      }),
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyFamily: 'teacher-assigned',
    });

    const plan = buildAdaptiveLearningPathPlan(input);

    expect(plan.status).toBe('fallback');
    expect(plan.explanations.fallbackReasons).toContain('teacher-assignment-resource-missing');
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('registry:assigned-card');
    expect(plan.explanations.rejectedAlternatives).toContainEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['teacher-assignment-required'],
      }),
    );
  });

  it('does not pull unassigned prerequisites into teacher-assigned paths', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'base-card',
            label: '未指定先修卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/teacher/resources/base-card',
            knowledgeNodeIds: ['kn-bode'],
          },
          {
            id: 'assigned-sim',
            label: '教师指定仿真',
            type: 'SIMULATION_APP',
            launchTarget: '/simulations/assigned',
            knowledgeNodeIds: ['kn-bode', 'kn-cruise'],
            prerequisiteNodeIds: ['registry:base-card'],
            planningOverride: {
              teacherPolicy: 'teacher-assigned',
            },
          },
        ],
      }),
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        teacherAssignedNodeIds: ['registry:assigned-sim'],
      },
      policyFamily: 'teacher-assigned',
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('registry:base-card');
    expect(plan.explanations.fallbackReasons).toContain('teacher-assignment-resource-missing');
  });

  it('reports policy bundle diversity metrics for displayed path families', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyBundle: {
        families: ['foundation-remediation', 'simulation-driven', 'sprint-correction'],
        overlapThreshold: 0.9,
      },
    }));

    expect(plan.policyBundle?.families).toEqual([
      'rules-plus-graph-search',
      'foundation-remediation',
      'simulation-driven',
      'sprint-correction',
    ]);
    expect(plan.policyBundle?.paths).toHaveLength(4);
    expect(plan.policyBundle?.paths.map((path) => [path.policyFamily, path.styleId])).toEqual([
      ['rules-plus-graph-search', 'rules-graph-search-route'],
      ['foundation-remediation', 'foundation-remediation'],
      ['simulation-driven', 'arena-simulation-sprint'],
      ['sprint-correction', 'sprint-correction-route'],
    ]);
    expect(plan.policyBundle?.diversity.maxResourceOverlap).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.modalityMixByPolicy['simulation-driven'].simulation).toBeGreaterThan(0);
    expect(plan.policyBundle?.diversity.estimatedEffortByPolicy['foundation-remediation']).toBeGreaterThan(0);
    expect(plan.policyBundle?.diversity.terminalValidationDifference).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.minModalityDistance).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.minEstimatedEffortDifference).toBeGreaterThanOrEqual(0);
    expect(plan.policyBundle?.diversity.pairwiseResourceOverlap).toHaveLength(6);
    expect(plan.policyBundle?.diversity.pairwiseResourceOverlap[0]).toEqual(
      expect.objectContaining({
        left: 'rules-plus-graph-search',
        right: 'foundation-remediation',
      }),
    );
    expect(plan.policyBundle?.diversity.pairwiseModalityDistance).toHaveLength(6);
    expect(plan.policyBundle?.diversity.pairwiseEstimatedEffortDifference).toHaveLength(6);
    expect(plan.policyBundle?.diversity.pairwiseTerminalValidationDifference).toHaveLength(6);
  });

  it('compares bundle policies against an explicit primary policy family', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      policyFamily: 'foundation-remediation',
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyBundle: {
        families: ['sprint-correction'],
        overlapThreshold: 0.9,
      },
    }));

    expect(plan.policyBundle?.families).toEqual(['foundation-remediation', 'sprint-correction']);
    expect(plan.policyBundle?.paths.map((path) => path.policyFamily)).toEqual([
      'foundation-remediation',
      'sprint-correction',
    ]);
    expect(plan.policyBundle?.diversity.pairwiseResourceOverlap).toEqual([
      expect.objectContaining({
        left: 'foundation-remediation',
        right: 'sprint-correction',
      }),
    ]);
  });

  it('returns an explicit low-resource fallback when policy paths cannot be distinct', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildResourceNodeRegistry({
        registeredResources: [
          {
            id: 'single-card',
            label: '单一知识卡',
            type: 'INTERACTIVE_COMP',
            renderTarget: '/teacher/resources/single-card',
            knowledgeNodeIds: ['kn-bode', 'kn-cruise'],
          },
        ],
      }),
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      policyBundle: {
        families: ['foundation-remediation', 'simulation-driven', 'sprint-correction'],
        overlapThreshold: 0.25,
      },
    }));

    expect(plan.policyBundle?.status).toBe('low-resource-fallback');
    expect(plan.policyBundle?.fallbackReasons).toContain('path-diversity-insufficient');
    expect(plan.policyBundle?.diversity.terminalValidationDifference).toBe(0);
    expect(plan.policyBundle?.fallbackReasons).not.toContain('terminal-validation-diversity-insufficient');
    expect(plan.policyBundle?.fallbackReasons).toContain('path-modality-diversity-insufficient');
    expect(plan.policyBundle?.fallbackReasons).toContain('path-effort-diversity-insufficient');
  });

  it('builds a control-correction three-style bundle with explainable option contracts', () => {
    const controlRegistry = buildControlCorrectionResourceNodeRegistry();
    const externalRegistry = buildResourceNodeRegistry({
      externalResources: [{
        id: 'control-ocw',
        title: '外部校正资料',
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/correction',
        estimatedTimeMinutes: 12,
        knowledgeNodeIds: ['control-correction:root-locus-design'],
        applicableGoalId: 'control-correction',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
    });
    const input = plannerInput({
      registry: {
        ...controlRegistry,
        nodes: [...controlRegistry.nodes, ...externalRegistry.nodes],
      },
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        resourcePreference: {
          preferredModalities: ['external_resource', 'video', 'ai_intervention', 'simulation'],
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 100,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    });

    expect(ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal.capabilityTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        knowledgeNodeRef: 'control-correction:simulation-validation',
        capabilityLevel: 'evaluate',
        behaviorVerb: 'validate',
        observableEvidenceType: 'simulation-run',
        goalSliceId: 'control-correction',
        competencyDimensions: expect.arrayContaining(['parameterDesign']),
        learnerStateFeatureGroups: expect.arrayContaining(['simulationArena']),
      }),
      expect.objectContaining({
        knowledgeNodeRef: 'control-correction:arena-transfer',
        capabilityLevel: 'create',
        observableEvidenceType: 'arena-official-evaluation',
        prerequisiteKnowledgeRefs: ['control-correction:simulation-validation'],
      }),
    ]));
    const plan = buildAdaptiveLearningPathPlan(input);
    expect(plan.visualization.evidence.capabilityEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: expect.objectContaining({
          knowledgeNodeRef: 'control-correction:arena-transfer',
          capabilityLevel: 'create',
        }),
        observedEvidence: expect.objectContaining({
          state: 'missing',
          directEvidenceCount: 0,
          supportingEvidenceCount: 3,
          source: 'adaptive-learner-state',
          recommendationBias: 'starter-or-evidence-gathering',
        }),
      }),
    ]));
    expect(plan.visualization.evidence.capabilityEvidence.find((item) =>
      item.target.knowledgeNodeRef === 'control-correction:arena-transfer'
    )?.observedEvidence.knowledgeMastery).toBe(0.1);
    const arenaTransferTarget = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal.capabilityTargets?.find((target) =>
      target.id === 'control-correction:arena-transfer:create'
    );
    if (!arenaTransferTarget) throw new Error('expected arena transfer capability target');
    const goalSliceEvidencePlan = buildAdaptiveLearningPathPlan(plannerInput({
      ...input,
      learnerState: {
        ...input.learnerState!,
        goalSlices: {
          'control-correction': {
            capabilityTargets: [{
              target: arenaTransferTarget,
              observedEvidence: {
                state: 'observed',
                knowledgeMastery: null,
                competencyScore: 35,
                confidence: 0.7,
                directEvidenceCount: 1,
                supportingEvidenceCount: 3,
                source: 'adaptive-learner-state',
                recommendationBias: 'targeted-practice',
              },
            }],
          },
        },
      },
    }));
    expect(goalSliceEvidencePlan.visualization.evidence.capabilityEvidence.find((item) =>
      item.target.knowledgeNodeRef === 'control-correction:arena-transfer'
    )?.observedEvidence).toEqual(expect.objectContaining({
      state: 'observed',
      knowledgeMastery: null,
      confidence: 0.7,
      directEvidenceCount: 1,
      recommendationBias: 'targeted-practice',
    }));
    const lowConfidencePlan = buildAdaptiveLearningPathPlan(plannerInput({
      ...input,
      learnerState: {
        ...input.learnerState!,
        knowledgeMastery: {
          tags: {
            ...input.learnerState!.knowledgeMastery!.tags,
            'control-correction:arena-transfer': { posteriorMastery: 0.24, confidence: 0.42, evidenceCount: 1 },
          },
        },
      },
    }));
    expect(lowConfidencePlan.visualization.evidence.capabilityEvidence.find((item) =>
      item.target.knowledgeNodeRef === 'control-correction:arena-transfer'
    )?.observedEvidence).toEqual(expect.objectContaining({
      state: 'low-confidence',
      directEvidenceCount: 1,
      recommendationBias: 'starter-or-evidence-gathering',
    }));

    const bundle = buildControlCorrectionThreeStylePathBundle(input);

    expect(bundle.status).toBe('ready');
    expect(bundle.paths.map((path) => path.styleId)).toEqual([
      'foundation-remediation',
      'arena-simulation-sprint',
      'preference-matched-route',
    ]);
    expect(bundle.paths).toEqual(expect.arrayContaining([
      expect.objectContaining({
        styleId: 'foundation-remediation',
        policyFamily: 'foundation-remediation',
        targetDeficits: expect.arrayContaining([
          expect.objectContaining({ targetId: 'control-correction:time-domain-targets' }),
        ]),
        evidenceBasis: expect.arrayContaining(['adaptive-learner-state', 'LearningFact']),
        resourceMix: expect.any(Object),
        terminalValidationStrategy: expect.objectContaining({
          nodeIds: expect.arrayContaining(['arena-task:task-second-order-lead-pid']),
        }),
      }),
      expect.objectContaining({
        styleId: 'preference-matched-route',
        policyFamily: 'preference-matched',
        effort: expect.objectContaining({ estimatedMinutes: expect.any(Number) }),
        limitations: expect.any(Array),
      }),
    ]));
    expect(bundle.diversity.pairwiseResourceOverlap.length).toBe(3);
    expect(JSON.stringify(bundle.paths)).not.toContain('external-resource:control-ocw');
  });

  it('does not expose ineligible support nodes in control-correction path options', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const restrictedRegistry = {
      ...registry,
      nodes: registry.nodes.map((node) => node.id === 'knowledge-card:control-correction-time-domain-targets'
        ? {
            ...node,
            planningMetadata: {
              ...node.planningMetadata,
              privacyLevel: 'teacher-scoped' as const,
            },
          }
        : node),
    };
    const bundle = buildControlCorrectionThreeStylePathBundle(plannerInput({
      registry: restrictedRegistry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        resourcePreference: {
          preferredModalities: ['video', 'ai_intervention', 'simulation'],
        },
        evidence: {
          confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
          sourceCoverage: { LearningFact: 'available' },
        },
      },
      constraints: {
        timeBudgetMinutes: 100,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    }));

    expect(bundle.paths.flatMap((path) => path.nodeIds)).not.toContain(
      'knowledge-card:control-correction-time-domain-targets',
    );
  });

  it('does not reinsert excluded nodes as control-correction policy support', () => {
    const bundle = buildControlCorrectionThreeStylePathBundle(plannerInput({
      registry: buildControlCorrectionResourceNodeRegistry(),
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        resourcePreference: {
          preferredModalities: ['knowledge_card', 'ai_intervention', 'simulation'],
        },
        evidence: {
          confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
          sourceCoverage: { LearningFact: 'available' },
        },
      },
      constraints: {
        timeBudgetMinutes: 100,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      excludedNodeIds: ['knowledge-card:control-correction-time-domain-targets'],
    }));

    expect(bundle.paths.flatMap((path) => path.nodeIds)).not.toContain(
      'knowledge-card:control-correction-time-domain-targets',
    );
  });

  it('keeps persisted current node after skipped nodes during revision planning', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['registry:bode-card'],
        currentNodeId: 'simulation:cruise',
      },
    }));

    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(expect.arrayContaining([
      'registry:bode-card',
      'simulation:cruise',
    ]));
    expect(plan.currentNodeId).toBe('simulation:cruise');
    expect(plan.mainPath.find((node) => node.nodeId === 'simulation:cruise')?.status).toBe('current');
    expect(plan.mainPath.find((node) => node.nodeId === 'registry:bode-card')?.status).toBe('completed');
  });

  it('does not expose external resources as preference support nodes when the policy disallows them', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const externalSupportNode = buildResourceNodeRegistry({
      externalResources: [{
        id: 'external-control-correction-guide',
        title: '外部控制校正资料',
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/correction',
        estimatedTimeMinutes: 1,
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        applicableGoalId: 'control-correction',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
    }).nodes.find((node) => node.id === 'external-resource:external-control-correction-guide');
    if (!externalSupportNode) {
      throw new Error('expected external support node fixture');
    }
    const bundle = buildControlCorrectionThreeStylePathBundle(plannerInput({
      registry: {
        ...registry,
        nodes: [...registry.nodes, externalSupportNode],
      },
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        resourcePreference: {
          preferredModalities: ['external_resource'],
        },
        evidence: {
          confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
          sourceCoverage: { LearningFact: 'available' },
        },
      },
      constraints: {
        timeBudgetMinutes: 180,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    }));

    expect(bundle.paths.flatMap((path) => path.nodeIds)).not.toContain(
      'external-resource:external-control-correction-guide',
    );
  });

  it('generates a feasible 90-minute control-correction path from audited seed nodes', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildControlCorrectionResourceNodeRegistry({ includeInvalidFixture: true }),
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    const mainIds = plan.mainPath.map((node) => node.nodeId);
    const estimatedTime = plan.mainPath.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
    expect(plan.status).toBe('ready');
    expect(estimatedTime).toBeLessThanOrEqual(90);
    expect(mainIds).toContain('simulation:control-correction-step-response-lab');
    expect(mainIds.at(-1)).toBe('arena-task:task-second-order-lead-pid');
    expect(plan.mainPath.at(-1)?.terminalConstraints).toContain('terminal-validation');
    expect(mainIds).not.toContain('registry:control-correction-invalid-quiz');
  });

  it('records bounded constraint repair coverage in path artifacts', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry: buildControlCorrectionResourceNodeRegistry({ includeInvalidFixture: true }),
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));
    const serialized = serializeLearningPathPlan(plan);

    expect(plan.constraintRepair).toMatchObject({
      status: 'satisfied',
      checkpointNodeIds: expect.any(Array),
      terminalValidationNodeIds: ['arena-task:task-second-order-lead-pid'],
      versionRefs: expect.objectContaining({
        plannerVersion: 'adaptive-learning-path-planner.v1',
        repairVersion: 'path-constraint-repair.v1',
      }),
    });
    expect(plan.constraintRepair?.terminalValidationNodeIds).toEqual([
      plan.mainPath.at(-1)?.nodeId,
    ]);
    expect(serialized.payload.constraintRepair).toEqual(plan.constraintRepair);
  });

  it('generates a control-correction terminal validation path from central registered resources', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: getAllRegisteredResourceMetadata(),
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    expect(plan.explanations.fallbackReasons).not.toContain('terminal-validation-resource-missing');
    const terminalNode = plan.mainPath.at(-1);
    expect(terminalNode).toMatchObject({
      type: 'arena_task',
      target: '/arena/challenges/task-second-order-lead-pid',
      terminalConstraints: expect.arrayContaining(['terminal-validation']),
    });
    expect(terminalNode?.readiness).toMatchObject({
      state: 'locked',
      reasonCodes: expect.arrayContaining(['readiness-required-completion', 'readiness-required-outcome']),
      missingCompletedNodeIds: ['registry:lesson09-summary-card'],
      missingOutcomeRefs: ['simulation_run:lesson09-time-domain-synthesis'],
    });
    expect(plan.mainPath.at(-1)?.target).not.toBe('/interactive-learning/resources/arena-challenge-workbench');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(expect.arrayContaining([
      'registry:lesson09-correction-precheck',
      'registry:lesson09-summary-card',
      'registry:arena-challenge-workbench',
    ]));
    expect(plan.mainPath[0]?.nodeId).toBe('registry:lesson09-correction-precheck');
    expect(plan.mainPath.length).toBeGreaterThanOrEqual(3);
    expect(plan.mainPath.slice(0, -1).some((node) =>
      node.nodeId.startsWith('registry:lesson09-') &&
      node.terminalConstraints.length === 0
    )).toBe(true);
    expect(plan.mainPath.find((node) => node.nodeId === 'registry:lesson09-summary-card')).toMatchObject({
      pathNodeType: 'knowledge_card',
    });
    expect(terminalNode).toMatchObject({
      knowledgeCoverage: ['control-correction:arena-transfer'],
    });

    const unlockedPlan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        completedNodeIds: [
          'registry:lesson09-correction-precheck',
          'registry:lesson09-time-domain-synthesis',
          'registry:lesson09-summary-card',
        ],
        availableOutcomeRefs: ['simulation_run:lesson09-time-domain-synthesis'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.6, confidence: 0.7, evidenceCount: 4 },
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));
    expect(unlockedPlan.mainPath.find((node) => node.nodeId === 'registry:lesson09-time-domain-synthesis')).toMatchObject({
      type: 'lesson_step',
      readiness: { state: 'ready' },
    });
    expect(unlockedPlan.mainPath.at(-1)).toMatchObject({
      nodeId: 'registry:arena-challenge-workbench',
      readiness: {
        state: 'ready',
        missingOutcomeRefs: [],
      },
    });
  });

  it('keeps central control-correction policy options scoped to control-correction resources', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: getAllRegisteredResourceMetadata(),
      textbookSections: [{
        bookId: 'dorf-modern-control-systems',
        sectionId: 'ch01-example-0103',
        title: '跨章能力匹配示例',
        citationHref: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch01-example-0103.md',
        knowledgeNodeIds: ['control-design:examples'],
        capabilityTargetIds: ['engineeringDecision'],
        estimatedTimeMinutes: 8,
      }],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.18, confidence: 0.7, evidenceCount: 1 },
            'control-correction:root-locus-design': { posteriorMastery: 0.18, confidence: 0.65, evidenceCount: 1 },
            'control-correction:simulation-validation': { posteriorMastery: 0.16, confidence: 0.6, evidenceCount: 0 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.25, confidence: 0.7, evidenceCount: 1 },
            engineeringDecision: { score: 0.22, confidence: 0.6, evidenceCount: 1 },
            crossDomainTransfer: { score: 0.18, confidence: 0.5, evidenceCount: 0 },
          },
        },
        evidence: {
          confidence: {
            level: 'low',
            score: 0.4,
            evidenceCount: 1,
            sourceCompleteness: 0.4,
          },
        },
      },
    }));

    const policyNodeIds = plan.policyBundle?.paths.flatMap((path) => path.nodeIds) ?? [];
    const allowedControlCorrectionKnowledge = new Set([
      ...ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal.knowledgeTargets,
      ...Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].knowledgeTargetAliases ?? {}).flat(),
    ]);
    expect(policyNodeIds.length).toBeGreaterThan(0);
    expect(policyNodeIds).not.toContain('registry:lesson14-three-band-studio');
    expect(policyNodeIds).not.toContain('textbook-section:dorf-modern-control-systems:ch01-example-0103');
    for (const nodeId of policyNodeIds) {
      const node = registry.nodes.find((item) => item.id === nodeId);
      expect(node?.planningMetadata.knowledgeCoverage.some((target) =>
        allowedControlCorrectionKnowledge.has(target)
      )).toBe(true);
    }
  });

  it('registers runtime textbook sections with control-correction knowledge aliases', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: getAllRegisteredResourceMetadata(),
      textbooks: [{
        bookId: 'dorf-modern-control-systems',
        title: 'Modern Control Systems',
      }],
      textbookSections: textbookRuntimeFixtureSections(),
    });

    const controlCorrectionAliases = new Set(
      Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].knowledgeTargetAliases ?? {}).flat()
    );
    const visibleTextbookSection = registry.nodes.find((node) =>
      node.type === 'textbook_section' &&
      node.id.startsWith('textbook-section:dorf-modern-control-systems:') &&
      node.planningMetadata.knowledgeCoverage.some((target) => controlCorrectionAliases.has(target))
    );
    expect(visibleTextbookSection).toMatchObject({
      id: expect.stringMatching(/^textbook-section:dorf-modern-control-systems:/),
      type: 'textbook_section',
    });
    expect(visibleTextbookSection?.planningMetadata.knowledgeCoverage.some((target) =>
      target.startsWith('control-correction:')
    )).toBe(false);
    expect(Object.keys(visibleTextbookSection?.planningMetadata.abilityImpact ?? {})).not.toHaveLength(0);
  });

  it('counts runtime textbook sections as covering frequency-response registered goal aliases', () => {
    const registry = buildResourceNodeRegistry({
      textbooks: [{
        bookId: 'dorf-modern-control-systems',
        title: 'Modern Control Systems',
      }],
      textbookSections: textbookRuntimeFixtureSections(),
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      policyFamily: 'foundation-remediation',
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.16, confidence: 0.7, evidenceCount: 1 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.62,
            evidenceCount: 2,
            sourceCompleteness: 0.6,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
    }));

    const selectedTextbookSection = plan.mainPath.find((node) => node.type === 'textbook_section');
    const frequencyAliases = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].knowledgeTargetAliases?.['kn-bode'] ?? [];
    expect(selectedTextbookSection).toMatchObject({
      nodeId: expect.stringMatching(/^textbook-section:dorf-modern-control-systems:/),
      pathNodeType: 'textbook_section',
      evidenceBehavior: 'explicit_access',
      target: expect.stringContaining('/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/'),
    });
    expect(selectedTextbookSection?.knowledgeCoverage).not.toContain('kn-bode');
    expect(selectedTextbookSection?.knowledgeCoverage.some((target) =>
      frequencyAliases.includes(target)
    )).toBe(true);
    expect(selectedTextbookSection?.resourceRanker?.matchedGraphRefs.knowledge.some((target) =>
      frequencyAliases.includes(target)
    )).toBe(true);
    expect(selectedTextbookSection?.reasonCodes).toContain('ranker:graph-coverage');
    expect(plan.status).toBe('fallback');
    expect(plan.explanations.fallbackReasons).toContain('checkpoint-resource-missing');
  });

  it('uses registered checkpoint resource types in constraint repair artifacts', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'policy-checkpoint-card',
        title: '策略允许的检查知识卡',
        sourceRef: 'frequency-response:policy-checkpoint-card',
        renderTarget: '/knowledge/cards/policy-checkpoint-card',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
          estimatedTimeMinutes: 8,
          evidenceInstrumentation: ['knowledge_card_viewed'],
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      policyFamily: 'foundation-remediation',
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.18, confidence: 0.7, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.65,
            evidenceCount: 3,
            sourceCompleteness: 0.65,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(['knowledge-card:policy-checkpoint-card']);
    expect(plan.constraintRepair).toMatchObject({
      status: 'satisfied',
      checkpointNodeIds: ['knowledge-card:policy-checkpoint-card'],
      infeasibleReasons: [],
    });
  });

  it('removes extra registered checkpoint resources to satisfy the time budget', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'repair-intro-card',
        title: '路径修复导入卡',
        sourceRef: 'repair-budget:intro',
        renderTarget: '/knowledge/cards/repair-intro',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        planningOverride: {
          estimatedTimeMinutes: 5,
          evidenceInstrumentation: ['knowledge_card_viewed'],
        },
      }],
      simulations: [{
        id: 'repair-extra-simulation',
        title: '路径修复额外仿真',
        launchTarget: '/simulations/repair-extra-simulation',
        knowledgeNodeIds: ['control-correction:simulation-validation'],
        planningOverride: {
          estimatedTimeMinutes: 12,
          abilityImpact: { engineeringDecision: 1 },
          evidenceInstrumentation: ['simulation_run'],
        },
      }, {
        id: 'repair-terminal-simulation',
        title: '路径修复终端验证仿真',
        launchTarget: '/simulations/repair-terminal-simulation',
        knowledgeNodeIds: ['control-correction:simulation-validation'],
        planningOverride: {
          estimatedTimeMinutes: 15,
          abilityImpact: { engineeringDecision: 0.01 },
          evidenceInstrumentation: ['simulation_run'],
          terminalConstraints: ['terminal-validation'],
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            fallbackNodeIds: [],
            unlockMessage: '可以完成终端验证。',
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:simulation-validation',
        ],
        competencyTargets: ['engineeringDecision'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.25, confidence: 0.7, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            engineeringDecision: { score: 0.3, confidence: 0.65, evidenceCount: 3 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.65,
            evidenceCount: 3,
            sourceCompleteness: 0.65,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 20,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'knowledge-card:repair-intro-card',
      'simulation:repair-terminal-simulation',
    ]);
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('simulation:repair-extra-simulation');
    expect(plan.constraintRepair).toMatchObject({
      status: 'repaired',
      removedNodeIds: ['simulation:repair-extra-simulation'],
      checkpointNodeIds: ['simulation:repair-terminal-simulation'],
      terminalValidationNodeIds: ['simulation:repair-terminal-simulation'],
      repairedConstraints: expect.arrayContaining(['time-budget']),
      infeasibleReasons: [],
    });
  });

  it('does not remove the only node covering a required target during time budget repair', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'coverage-intro-card',
        title: '覆盖保护导入卡',
        sourceRef: 'repair-budget:coverage-intro',
        renderTarget: '/knowledge/cards/coverage-intro',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        planningOverride: {
          estimatedTimeMinutes: 5,
          evidenceInstrumentation: ['knowledge_card_viewed'],
        },
      }],
      simulations: [{
        id: 'coverage-only-simulation',
        title: '唯一覆盖仿真目标的仿真',
        launchTarget: '/simulations/coverage-only-simulation',
        knowledgeNodeIds: ['control-correction:simulation-validation'],
        planningOverride: {
          estimatedTimeMinutes: 12,
          abilityImpact: { engineeringDecision: 1 },
          evidenceInstrumentation: ['simulation_run'],
        },
      }, {
        id: 'coverage-terminal-simulation',
        title: '覆盖保护终端验证仿真',
        launchTarget: '/simulations/coverage-terminal-simulation',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        planningOverride: {
          estimatedTimeMinutes: 15,
          abilityImpact: { engineeringDecision: 0.01 },
          evidenceInstrumentation: ['simulation_run'],
          terminalConstraints: ['terminal-validation'],
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            fallbackNodeIds: [],
            unlockMessage: '可以完成终端验证。',
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:simulation-validation',
        ],
        competencyTargets: ['engineeringDecision'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.25, confidence: 0.7, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            engineeringDecision: { score: 0.3, confidence: 0.65, evidenceCount: 3 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.65,
            evidenceCount: 3,
            sourceCompleteness: 0.65,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 20,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('time-budget-insufficient');
    expect(plan.constraintRepair).toMatchObject({
      status: 'infeasible',
      repairedNodeIds: expect.arrayContaining([
        'simulation:coverage-only-simulation',
        'simulation:coverage-terminal-simulation',
      ]),
      infeasibleReasons: expect.arrayContaining([
        expect.objectContaining({ code: 'time-budget-insufficient' }),
      ]),
    });
    expect(plan.constraintRepair?.removedNodeIds).not.toContain('simulation:coverage-only-simulation');
  });

  it('protects legacy goal coverage when graph context has no covered path candidates', () => {
    const learningGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].learningGoal!;
    const expandedSubgraph = expandLearningGoalSubgraph(learningGoal.id);
    const graphTargetId = learningGoal.targetGraphNodeIds[0];
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'legacy-a-card',
        title: 'Legacy A 知识卡',
        sourceRef: 'repair-budget:legacy-a',
        renderTarget: '/knowledge/cards/legacy-a',
        knowledgeNodeIds: ['legacy-a'],
        planningOverride: {
          estimatedTimeMinutes: 5,
          evidenceInstrumentation: ['knowledge_card_viewed'],
        },
      }],
      simulations: [{
        id: 'legacy-b-simulation',
        title: 'Legacy B 唯一仿真',
        launchTarget: '/simulations/legacy-b',
        knowledgeNodeIds: ['legacy-b'],
        planningOverride: {
          estimatedTimeMinutes: 12,
          abilityImpact: { engineeringDecision: 1 },
          evidenceInstrumentation: ['simulation_run'],
        },
      }, {
        id: 'legacy-terminal-simulation',
        title: 'Legacy 终端验证仿真',
        launchTarget: '/simulations/legacy-terminal',
        knowledgeNodeIds: ['legacy-a'],
        planningOverride: {
          estimatedTimeMinutes: 15,
          abilityImpact: { engineeringDecision: 0.01 },
          evidenceInstrumentation: ['simulation_run'],
          terminalConstraints: ['terminal-validation'],
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            fallbackNodeIds: [],
            unlockMessage: '可以完成终端验证。',
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: learningGoal.id,
        title: learningGoal.title,
        knowledgeTargets: ['legacy-a', 'legacy-b'],
        competencyTargets: ['engineeringDecision'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'legacy-a': { posteriorMastery: 0.25, confidence: 0.7, evidenceCount: 2 },
            'legacy-b': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            engineeringDecision: { score: 0.3, confidence: 0.65, evidenceCount: 3 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.65,
            evidenceCount: 3,
            sourceCompleteness: 0.65,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 20,
        privacyScopes: ['student-visible'],
      },
      graphContext: {
        learningGoalId: learningGoal.id,
        learningGoalVersion: learningGoal.version,
        objectiveBoundary: {
          knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
          capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
          qualityObjectiveIds: learningGoal.qualityObjectiveIds,
        },
        expandedSubgraph,
        resourceCoverage: {
          [graphTargetId]: {
            domain: 'knowledge',
            nodeId: graphTargetId,
            linkedResourceCount: 0,
            pathEligibleResourceCount: 0,
            ragIndexedCount: 0,
            citationReadyCount: 0,
            verifiedCitationCount: 0,
            assessmentResourceCount: 0,
            simulationResourceCount: 0,
            arenaPreviewResourceCount: 0,
            arenaOfficialResourceCount: 0,
            terminalValidationCapableResourceCount: 0,
            coverageState: 'missing',
            missingCoverageTypes: ['linked-resource'],
            linkedResourceIds: [],
            pathEligibleResourceIds: [],
            pathEligibleResourceRouteIds: [],
            filterKnowledgeRefs: [],
          },
        },
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('time-budget-insufficient');
    expect(plan.constraintRepair).toMatchObject({
      status: 'infeasible',
      repairedNodeIds: expect.arrayContaining([
        'simulation:legacy-b-simulation',
        'simulation:legacy-terminal-simulation',
      ]),
      infeasibleReasons: expect.arrayContaining([
        expect.objectContaining({ code: 'time-budget-insufficient' }),
      ]),
    });
    expect(plan.constraintRepair?.removedNodeIds).not.toContain('simulation:legacy-b-simulation');
  });

  it('does not force ordinary tail nodes to satisfy checkpoint policy', () => {
    const registry = buildResourceNodeRegistry({
      textbooks: [{
        bookId: 'dorf-modern-control-systems',
        title: 'Modern Control Systems',
      }],
      textbookSections: [textbookRuntimeFixtureSections()[0]],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      policyFamily: 'foundation-remediation',
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.18, confidence: 0.7, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.65,
            evidenceCount: 3,
            sourceCompleteness: 0.65,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.mainPath.map((node) => node.type)).toEqual(['textbook_section']);
    expect(plan.constraintRepair).toMatchObject({
      status: 'infeasible',
      checkpointNodeIds: [],
      infeasibleReasons: expect.arrayContaining([
        expect.objectContaining({ code: 'checkpoint-resource-missing' }),
      ]),
    });
    expect(plan.explanations.fallbackReasons).toContain('checkpoint-resource-missing');
  });

  it('includes eligible unscored readiness fallbacks in constraint repair candidates', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'low-risk-prep-card',
        title: '低风险准备知识卡',
        sourceRef: 'control-correction:low-risk-prep-card',
        renderTarget: '/knowledge/cards/low-risk-prep-card',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        planningOverride: {
          estimatedTimeMinutes: 8,
          evidenceInstrumentation: ['knowledge_card_viewed'],
        },
      }],
      simulations: [{
        id: 'locked-validation-lab',
        title: '锁定验证实验',
        launchTarget: '/simulations/locked-validation-lab',
        knowledgeNodeIds: ['kn-locked-validation'],
        planningOverride: {
          estimatedTimeMinutes: 25,
          cognitiveLoad: 'high',
          evidenceInstrumentation: ['simulation_run'],
          terminalConstraints: ['terminal-validation'],
          readiness: {
            minimumCompetency: { parameterDesign: 0.7 },
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            fallbackNodeIds: ['knowledge-card:low-risk-prep-card'],
            unlockMessage: '先完成准备知识卡。',
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'temporary-locked-lab-goal',
        title: '锁定实验目标',
        knowledgeTargets: ['kn-locked-validation'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'kn-locked-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.6,
            evidenceCount: 1,
            sourceCompleteness: 0.5,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('simulation:locked-validation-lab');
    expect(plan.constraintRepair).toMatchObject({
      status: 'repaired',
      insertedNodeIds: ['knowledge-card:low-risk-prep-card'],
      repairedConstraints: expect.arrayContaining(['locked-node-fallback']),
      infeasibleReasons: [],
    });
    expect(plan.constraintRepair?.repairedNodeIds).toEqual([
      'knowledge-card:low-risk-prep-card',
      'simulation:locked-validation-lab',
    ]);
  });

  it('keeps repaired path nodes when only non-blocking checkpoint infeasibility remains', () => {
    const registry = buildResourceNodeRegistry({
      textbookSections: [{
        bookId: 'repair-nonblocking',
        sectionId: 'prep',
        title: '准备教材段',
        citationHref: '/course-runtime/resources/textbooks/repair-nonblocking/sections/prep.md',
        knowledgeNodeIds: ['prep-only'],
        estimatedTimeMinutes: 5,
        planningOverride: {
          evidenceInstrumentation: ['textbook_section_viewed'],
        },
      }, {
        bookId: 'repair-nonblocking',
        sectionId: 'locked',
        title: '锁定教材段',
        citationHref: '/course-runtime/resources/textbooks/repair-nonblocking/sections/locked.md',
        knowledgeNodeIds: ['kn-bode'],
        estimatedTimeMinutes: 10,
        planningOverride: {
          evidenceInstrumentation: ['textbook_section_viewed'],
          readiness: {
            minimumCompetency: { parameterDesign: 0.8 },
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            fallbackNodeIds: ['textbook-section:repair-nonblocking:prep'],
            unlockMessage: '先完成准备教材段。',
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.2, confidence: 0.7, evidenceCount: 1 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.6,
            evidenceCount: 1,
            sourceCompleteness: 0.6,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 20,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'textbook-section:repair-nonblocking:prep',
      'textbook-section:repair-nonblocking:locked',
    ]);
    expect(plan.currentNodeId).toBe('textbook-section:repair-nonblocking:prep');
    expect(plan.explanations.fallbackReasons).toContain('checkpoint-resource-missing');
    expect(plan.constraintRepair).toMatchObject({
      status: 'infeasible',
      draftNodeIds: ['textbook-section:repair-nonblocking:locked'],
      repairedNodeIds: [
        'textbook-section:repair-nonblocking:prep',
        'textbook-section:repair-nonblocking:locked',
      ],
      insertedNodeIds: ['textbook-section:repair-nonblocking:prep'],
      repairedConstraints: expect.arrayContaining(['locked-node-fallback']),
      infeasibleReasons: expect.arrayContaining([
        expect.objectContaining({ code: 'checkpoint-resource-missing' }),
      ]),
    });
  });

  it('blocks repaired paths that still violate hard prerequisite order', () => {
    const originalRepair = deterministicPathConstraintRepairAdapter.repair;
    deterministicPathConstraintRepairAdapter.repair = (repairInput) => {
      const repairedNodeId = repairInput.candidates.find((candidate) => candidate.nodeId === 'registry:bode-card')?.nodeId
        ?? repairInput.candidates[0]?.nodeId
        ?? 'registry:bode-card';
      return {
        status: 'infeasible',
        draftNodeIds: repairInput.draftNodeIds,
        repairedNodeIds: [repairedNodeId],
        insertedNodeIds: [],
        removedNodeIds: [],
        checkpointNodeIds: [],
        terminalValidationNodeIds: [],
        repairedConstraints: [],
        tradeoffs: [],
        limitations: [],
        infeasibleReasons: [{
          code: 'hard-prerequisite-missing',
          nodeIds: [repairedNodeId, 'simulation:cruise'],
          message: `Node ${repairedNodeId} requires prerequisite simulation:cruise before it in the repaired path.`,
        }],
        versionRefs: Object.fromEntries(
          Object.entries(repairInput.versionRefs).map(([key, value]) => [key, value ?? null])
        ),
      };
    };

    try {
      const plan = buildAdaptiveLearningPathPlan(plannerInput());

      expect(plan.status).toBe('fallback');
      expect(plan.mainPath).toEqual([]);
      expect(plan.explanations.fallbackReasons).toContain('hard-prerequisite-missing');
      expect(plan.constraintRepair?.repairedNodeIds.length).toBeGreaterThan(0);
      expect(plan.constraintRepair?.infeasibleReasons).toContainEqual(expect.objectContaining({
        code: 'hard-prerequisite-missing',
      }));
    } finally {
      deterministicPathConstraintRepairAdapter.repair = originalRepair;
    }
  });

  it('does not publish a ready path when time budget cannot include locked fallback support', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'low-risk-prep-card',
        title: '低风险准备知识卡',
        sourceRef: 'control-correction:low-risk-prep-card',
        renderTarget: '/knowledge/cards/low-risk-prep-card',
        knowledgeNodeIds: ['control-correction:time-domain-targets'],
        planningOverride: {
          estimatedTimeMinutes: 8,
          evidenceInstrumentation: ['knowledge_card_viewed'],
        },
      }],
      simulations: [{
        id: 'locked-validation-lab',
        title: '锁定验证实验',
        launchTarget: '/simulations/locked-validation-lab',
        knowledgeNodeIds: ['kn-locked-validation'],
        planningOverride: {
          estimatedTimeMinutes: 25,
          cognitiveLoad: 'high',
          evidenceInstrumentation: ['simulation_run'],
          terminalConstraints: ['terminal-validation'],
          readiness: {
            minimumCompetency: { parameterDesign: 0.7 },
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            fallbackNodeIds: ['knowledge-card:low-risk-prep-card'],
            unlockMessage: '先完成准备知识卡。',
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'temporary-locked-lab-goal',
        title: '锁定实验目标',
        knowledgeTargets: ['kn-locked-validation'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-locked-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.6,
            evidenceCount: 1,
            sourceCompleteness: 0.5,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 25,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.currentNodeId).toBeNull();
    expect(plan.explanations.fallbackReasons).toContain('time-budget-insufficient');
    expect(plan.constraintRepair).toMatchObject({
      status: 'infeasible',
      repairedNodeIds: ['knowledge-card:low-risk-prep-card', 'simulation:locked-validation-lab'],
      removedNodeIds: [],
      infeasibleReasons: expect.arrayContaining([
        expect.objectContaining({ code: 'time-budget-insufficient' }),
      ]),
    });
  });

  it('does not publish a path when a locked readiness node has no fallback', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [{
        id: 'locked-validation-lab',
        title: '锁定验证实验',
        launchTarget: '/simulations/locked-validation-lab',
        knowledgeNodeIds: ['kn-locked-validation'],
        planningOverride: {
          estimatedTimeMinutes: 25,
          cognitiveLoad: 'high',
          evidenceInstrumentation: ['simulation_run'],
          readiness: {
            minimumCompetency: { parameterDesign: 0.7 },
            minimumEvidenceCount: 0,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            fallbackNodeIds: [],
            unlockMessage: '需要先完成准备资源。',
          },
        },
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'temporary-locked-lab-goal',
        title: '锁定实验目标',
        knowledgeTargets: ['kn-locked-validation'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-locked-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.2, confidence: 0.6, evidenceCount: 1 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.6,
            evidenceCount: 1,
            sourceCompleteness: 0.5,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.currentNodeId).toBeNull();
    expect(plan.explanations.fallbackReasons).toContain('locked-node-without-fallback');
    expect(plan.constraintRepair).toMatchObject({
      status: 'infeasible',
      infeasibleReasons: expect.arrayContaining([
        expect.objectContaining({ code: 'locked-node-without-fallback' }),
      ]),
    });
  });

  it('does not admit unrelated resources by competency when a knowledge target is declared', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'target-lesson-card',
          label: '目标知识资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/target-lesson-card',
          knowledgeNodeIds: ['kn-target'],
          planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['card_complete'],
            abilityImpact: { controlModeling: 0.2 },
          },
        },
        {
          id: 'unrelated-same-ability',
          label: '同能力无关资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/unrelated-same-ability',
          knowledgeNodeIds: ['kn-unrelated'],
          planningOverride: {
            estimatedTimeMinutes: 8,
            evidenceInstrumentation: ['card_complete'],
            abilityImpact: { controlModeling: 0.8 },
          },
        },
      ],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'temporary-knowledge-goal',
        title: '临时知识目标',
        knowledgeTargets: ['kn-target'],
        competencyTargets: ['controlModeling'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-target': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 1 },
          },
        },
        primaryCompetencies: {
          vector: {
            controlModeling: { score: 0.25, confidence: 0.7, evidenceCount: 1 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 2,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('registry:target-lesson-card');
    expect(plan.mainPath.map((node) => node.nodeId)).not.toContain('registry:unrelated-same-ability');
  });

  it('falls back when a control-correction path lacks terminal validation evidence', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'control-correction-all-targets-no-terminal-validation',
          label: '控制校正全目标练习',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/control-correction-all-targets-no-terminal-validation',
          knowledgeNodeIds: [
            'control-correction:time-domain-targets',
            'control-correction:root-locus-design',
            'control-correction:simulation-validation',
            'control-correction:arena-transfer',
          ],
          planningOverride: {
            estimatedTimeMinutes: 35,
            evidenceInstrumentation: ['answer_submit'],
            abilityImpact: {
              parameterDesign: 0.4,
              engineeringDecision: 0.35,
              crossDomainTransfer: 0.25,
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('terminal-validation-resource-missing');
  });

  it('does not accept non-validation resource types as control-correction terminal validation', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'control-correction-quiz-with-terminal-label',
          label: '误标终端验证的控制校正测验',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
          knowledgeNodeIds: [
            'control-correction:time-domain-targets',
            'control-correction:root-locus-design',
            'control-correction:simulation-validation',
            'control-correction:arena-transfer',
          ],
          planningOverride: {
            estimatedTimeMinutes: 35,
            terminalConstraints: ['terminal-validation'],
            evidenceInstrumentation: ['answer_submit'],
            abilityImpact: {
              parameterDesign: 0.4,
              engineeringDecision: 0.35,
              crossDomainTransfer: 0.25,
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('terminal-validation-resource-missing');
  });

  it('requires control-correction terminal validation to be the path endpoint', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'control-correction-mid-path-validation',
          title: '控制校正中途验证仿真',
          launchTarget: '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
          knowledgeNodeIds: [
            'control-correction:time-domain-targets',
            'control-correction:root-locus-design',
            'control-correction:simulation-validation',
          ],
          planningOverride: {
            estimatedTimeMinutes: 20,
            terminalConstraints: ['terminal-validation'],
            evidenceInstrumentation: ['simulation_run'],
            abilityImpact: {
              parameterDesign: 0.4,
              engineeringDecision: 0.3,
            },
          },
        },
      ],
      registeredResources: [
        {
          id: 'control-correction-transfer-quiz-after-validation',
          label: '验证后补齐迁移目标的测验',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
          knowledgeNodeIds: ['control-correction:arena-transfer'],
          prerequisiteNodeIds: ['simulation:control-correction-mid-path-validation'],
          planningOverride: {
            estimatedTimeMinutes: 12,
            evidenceInstrumentation: ['answer_submit'],
            abilityImpact: {
              crossDomainTransfer: 0.25,
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制系统校正设计',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.3, confidence: 0.7, evidenceCount: 2 },
            'control-correction:root-locus-design': { posteriorMastery: 0.25, confidence: 0.65, evidenceCount: 2 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        primaryCompetencies: {
          vector: {
            parameterDesign: { score: 0.35, confidence: 0.7, evidenceCount: 4 },
            engineeringDecision: { score: 0.42, confidence: 0.6, evidenceCount: 3 },
            crossDomainTransfer: { score: 0.28, confidence: 0.5, evidenceCount: 2 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
          sourceCoverage: {
            LearningFact: 'available',
            ArenaSubmission: 'partial',
          },
        },
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('terminal-validation-resource-missing');
  });

  it('generates a constrained explainable Stage 1 path without bandit or RL', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());

    expect(plan.stage).toBe('stage-1-rules-graph');
    expect(plan.policyFamily).toBe('rules-plus-graph-search');
    expect(plan.excludedPolicyFamilies).toEqual(['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid']);
    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toContain('simulation:cruise');
    expect(plan.mainPath.map((node) => node.nodeId)).toContain('arena-task:roll-control');
    expect(plan.mainPath.find((node) => node.nodeId === 'arena-task:roll-control')?.prerequisiteNodeIds)
      .toEqual(['simulation:cruise']);
    expect(plan.score.objectives.learningGain).toBeGreaterThan(0);
    expect(plan.explanations.selectedReasons.length).toBeGreaterThan(0);
    expect(plan.explanations.rejectedAlternatives.some((item) => item.reasonCodes.includes('privacy-scope-blocked'))).toBe(true);
    expect(plan.mainPath.find((node) => node.nodeId === 'registry:bode-card')?.status).toBe('completed');
    expect(plan.mainPath.find((node) => node.nodeId === plan.currentNodeId)?.status).toBe('current');
  });

  it.each([
    'foundation-remediation',
    'simulation-driven',
    'sprint-correction',
    'teacher-assigned',
  ] as const)('preserves privacy and teacher constraints for policy family %s', (policyFamily) => {
    const registry = buildResourceNodeRegistry({
      aiInterventions: [
        {
          id: 'teacher-only-policy',
          title: '教师专用策略资源',
          renderTarget: '/ai/teacher-only-policy',
          knowledgeNodeIds: ['kn-policy-private'],
          teacherOnly: true,
        },
      ],
      registeredResources: [
        {
          id: 'assigned-private',
          label: '受限教师指定资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/admin/data-governance',
          knowledgeNodeIds: ['kn-policy-private'],
          planningOverride: {
            teacherPolicy: 'teacher-assigned',
            privacyLevel: 'admin-scoped',
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(policyFixtureInput({
      registry,
      goal: {
        id: 'goal-policy-privacy',
        title: '策略隐私约束',
        knowledgeTargets: ['kn-policy-private'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        teacherAssignedNodeIds: ['registry:assigned-private'],
      },
      policyFamily,
    }));

    expect(plan.status).toBe('fallback');
    expect(JSON.stringify(plan)).not.toContain('teacher-only-policy');
    expect(JSON.stringify(plan)).not.toContain('受限教师指定资源');
    expect(plan.visualization.map.blockedNodes.length).toBeGreaterThan(0);
  });

  it('keeps blocked resources out of graph edges while exposing map, timeline, and evidence payloads', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const mainIds = plan.mainPath.map((node) => node.nodeId);

    expect(plan.visualization.map.mainPathNodeIds).toEqual(mainIds);
    expect(plan.visualization.map.completedNodeIds).toEqual(['registry:bode-card']);
    expect(plan.visualization.map.riskNodeIds).toContain(plan.currentNodeId);
    expect(plan.visualization.map.blockedNodes).toContainEqual(
      expect.objectContaining({
        nodeId: 'restricted:1',
        title: '受限资源',
        reasonCodes: ['privacy-scope-blocked'],
      }),
    );
    expect(JSON.stringify(plan.visualization)).not.toContain('registry:hidden-admin');
    expect(JSON.stringify(plan.visualization)).not.toContain('管理员资源');
    expect(plan.visualization.timeline.windows.map((window) => window.days)).toEqual([3, 7, 14]);
    expect(plan.visualization.timeline.windows[1].nodeIds).toEqual(mainIds.slice(0, 7));
    expect(plan.visualization.evidence.learnerStateDeficits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetId: 'kn-bode' }),
        expect.objectContaining({ targetId: 'kn-cruise' }),
      ]),
    );
    expect(plan.visualization.evidence.sourceCoverage.StudentCompetencySnapshot).toBe('available');
  });

  it('does not persist completed node ids for blocked or unknown resources', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        completedNodeIds: ['registry:hidden-admin'],
      },
    }));

    expect(plan.executionStatus.completedNodeIds).not.toContain('registry:hidden-admin');
    expect(plan.visualization.map.completedNodeIds).not.toContain('registry:hidden-admin');
    expect(JSON.stringify(serializeLearningPathPlan(plan))).not.toContain('registry:hidden-admin');

    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-hidden-completion',
      type: 'completion',
      nodeId: 'registry:hidden-admin',
      createdAt: '2026-05-27T10:00:00.000Z',
    });

    expect(updated.executionStatus.completedNodeIds).not.toContain('registry:hidden-admin');
    expect(updated.feedbackEvents.at(-1)?.nodeId).toBeNull();
    expect(JSON.stringify(serializeLearningPathPlan(updated))).not.toContain('registry:hidden-admin');
  });

  it('returns a fallback plan when learner evidence or resource mappings are insufficient', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeNodes: [
        { id: 'kn-bode', name: '伯德图' },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 20,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.confidence.level).toBe('low');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toEqual(
      expect.arrayContaining(['learner-state-missing', 'resource-mapping-insufficient']),
    );
  });

  it('returns executable starter options with checkpoints for cold-start registered goals', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
      now: new Date('2026-06-14T08:00:00.000Z'),
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.confidence.level).toBe('low');
    expect(plan.mainPath.length).toBeGreaterThan(0);
    expect(plan.currentNodeId).toBe(plan.mainPath[0]?.nodeId);
    expect(plan.explanations.fallbackReasons).toContain('learner-state-missing');
    const executableOptions = plan.policyBundle?.paths.filter((path) => path.nodeIds.length > 0) ?? [];
    expect(executableOptions.length).toBeGreaterThanOrEqual(2);
    expect(executableOptions.every((path) => path.checkpointNodeIds.length > 0)).toBe(true);
    expect(executableOptions.every((path) => path.estimatedMinutes <= 45)).toBe(true);
    expect(executableOptions.every((path) =>
      path.nodeSummaries.length === path.nodeIds.length &&
      path.nodeSummaries.every((node) => node.pathNodeType && node.iconKey && node.shapeHint && node.evidenceBehavior)
    )).toBe(true);
    expect(JSON.stringify(plan.mainPath)).not.toContain('learner-state-missing');
    expect(JSON.stringify(plan.mainPath)).not.toContain('learner-evidence-low-confidence');
  });

  it('keeps external resources out of paths unless external resources are explicitly allowed', () => {
    const registry = buildResourceNodeRegistry({
      externalResources: [{
        id: 'ocw-bode',
        title: '外部伯德图资料',
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/bode',
        estimatedTimeMinutes: 15,
        knowledgeNodeIds: ['kn-bode'],
        applicableGoalId: 'frequency-response-foundations',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
      checkpoints: [{
        id: 'bode-after-external',
        title: '外部资料后检查点',
        assessmentPurpose: '确认学生能解释外部资料中的伯德图概念',
        criteria: ['解释幅频曲线斜率'],
        requiredEvidenceRefs: ['external_resource.accessed'],
        remediationBehavior: 'retry-prerequisite-node',
        reviewState: 'pending',
        launchTarget: '/assessment/checkpoints/bode-after-external',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['external-resource:ocw-bode'],
      }],
    });
    const baseInput = plannerInput({
      registry,
      goal: {
        id: 'frequency-response-foundations',
        title: '频率响应基础',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 3 },
          },
        },
        evidence: {
          confidence: {
            level: 'high',
            score: 0.8,
            evidenceCount: 6,
            sourceCompleteness: 0.8,
          },
        },
      },
    });

    const blocked = buildAdaptiveLearningPathPlan(baseInput);
    const allowed = buildAdaptiveLearningPathPlan({
      ...baseInput,
      allowExternalResources: true,
    });

    expect(blocked.mainPath.map((node) => node.nodeId)).not.toContain('external-resource:ocw-bode');
    expect(blocked.mainPath.map((node) => node.nodeId)).not.toContain('checkpoint:bode-after-external');
    expect(allowed.mainPath.map((node) => node.nodeId)).toEqual(
      expect.arrayContaining(['external-resource:ocw-bode', 'checkpoint:bode-after-external']),
    );
  });

  it('keeps low-confidence usable path nodes while recording confidence internally', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: {
        evidence: {
          confidence: {
            level: 'low',
            score: 0.2,
            evidenceCount: 1,
            sourceCompleteness: 0.2,
          },
          sourceCoverage: {
            LearningFact: 'partial',
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath.length).toBeGreaterThan(0);
    expect(plan.currentNodeId).not.toBeNull();
    expect(plan.visualization.evidence.evidenceBasis).toBe('adaptive-learner-state');
    expect(plan.explanations.fallbackReasons).toContain('learner-evidence-low-confidence');
  });

  it('captures deviations and generates correction path records without losing evidence chain', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-1',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T09:00:00.000Z',
      context: {
        action: 'skip',
        reason: 'too-hard',
      },
    });

    expect(updated.feedbackEvents).toHaveLength(1);
    expect(updated.deviations).toEqual([
      expect.objectContaining({
        nodeId: plan.currentNodeId,
        correctionPathId: `${plan.id}:correction:1`,
      }),
    ]);
    expect(updated.corrections[0]).toMatchObject({
      priorEvidencePlanId: plan.id,
      reasonCodes: ['student-deviation', 'preserve-evidence-chain'],
    });
  });

  it('advances active node, statuses, and map payload after completion feedback', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const completedNodeId = plan.currentNodeId;
    expect(completedNodeId).not.toBeNull();

    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-completion-1',
      type: 'completion',
      nodeId: completedNodeId,
      createdAt: '2026-05-27T09:15:00.000Z',
    });

    expect(updated.executionStatus.completedNodeIds).toContain(completedNodeId);
    expect(updated.executionStatus.activeNodeId).toBe(updated.currentNodeId);
    expect(updated.currentNodeId).not.toBe(completedNodeId);
    expect(updated.mainPath.find((node) => node.nodeId === completedNodeId)?.status).toBe('completed');
    if (updated.currentNodeId) {
      expect(updated.mainPath.find((node) => node.nodeId === updated.currentNodeId)?.status).toBe('current');
    }
    expect(updated.visualization.map.currentNodeId).toBe(updated.currentNodeId);
    expect(updated.visualization.map.completedNodeIds).toContain(completedNodeId);
    const record = serializeLearningPathPlan(updated);
    expect(record.payload.visualization.timeline.windows[2].estimatedMinutes).toBe(record.estimatedTime);
  });

  it('serializes a persistence payload for plan nodes, alternatives, explanations, status, and feedback', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());
    const withFeedback = recordLearningPathFeedback(plan, {
      id: 'feedback-2',
      type: 'helpfulness',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T09:30:00.000Z',
      helpful: true,
    });

    const record = serializeLearningPathPlan(withFeedback);

    expect(record.userId).toBe('student-1');
    expect(record.nodeIds).toEqual(withFeedback.mainPath.map((node) => node.nodeId));
    expect(record.payload.status).toBe(withFeedback.status);
    expect(record.payload.policyFamily).toBe(withFeedback.policyFamily);
    expect(record.payload.policyMetadata).toEqual(withFeedback.policyMetadata);
    expect(record.payload.policyBundle).toEqual(withFeedback.policyBundle);
    expect(record.payload.currentNodeId).toBe(withFeedback.currentNodeId);
    expect(record.payload.score).toEqual(withFeedback.score);
    expect(record.payload.confidence).toEqual(withFeedback.confidence);
    expect(record.payload.planNodes).toEqual(withFeedback.mainPath);
    expect(record.payload.alternatives).toEqual(withFeedback.alternatives);
    expect(record.payload.explanations).toEqual(withFeedback.explanations);
    expect(record.payload.executionStatus).toEqual(withFeedback.executionStatus);
    expect(record.payload.feedbackEvents).toEqual(withFeedback.feedbackEvents);
  });

  it('keeps internal fallback and policy strings out of student-facing serialized text', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'].goal,
      learnerState: null,
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
        device: 'desktop',
      },
    }));

    const record = serializeLearningPathPlan(plan);
    const studentFacing = JSON.stringify({
      description: record.description,
      studentFacing: record.payload.studentFacing,
    });

    expect(studentFacing).toContain('先从入门路径开始');
    expect(studentFacing).not.toContain('learner-state-missing');
    expect(studentFacing).not.toContain('learner-evidence-low-confidence');
    expect(studentFacing).not.toContain('resource-mapping-insufficient');
    expect(studentFacing).not.toContain('stage-1-rules-graph');
    expect(studentFacing).not.toContain('rules-plus-graph-search');
  });

  it('does not add blocked prerequisite nodes to the main path', () => {
    const registry = buildResourceNodeRegistry({
      aiInterventions: [
        {
          id: 'private-hint',
          title: '教师私有提示',
          renderTarget: '/ai/private-hint',
          knowledgeNodeIds: ['kn-pre'],
          teacherOnly: true,
        },
      ],
      projects: [
        {
          id: 'public-project',
          title: '公开项目',
          launchTarget: '/missions?project=public',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['ai_intervention:private-hint'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-private-prereq',
        title: '测试私有前置',
        knowledgeTargets: ['kn-goal'],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('feasible-goal-path-missing');
    expect(plan.alternatives.find((item) => item.nodeId === 'project:public-project')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['infeasible-prerequisite-chain'],
      }),
    );
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-private-prereq-deviation',
      type: 'deviation',
      nodeId: null,
      createdAt: '2026-05-27T10:30:00.000Z',
    });
    expect(updated.corrections[0].nodeIds).not.toContain('project:public-project');
    expect(JSON.stringify(plan)).not.toContain('private-hint');
    expect(JSON.stringify(plan)).not.toContain('教师私有提示');
  });

  it('blocks teacher-only resources even when teacher-scoped resources are allowed', () => {
    const registry = buildResourceNodeRegistry({
      aiInterventions: [
        {
          id: 'teacher-only-hint',
          title: '教师专用提示',
          renderTarget: '/ai/teacher-only-hint',
          knowledgeNodeIds: ['kn-teacher-only'],
          teacherOnly: true,
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-teacher-only',
        title: '测试教师专用资源',
        knowledgeTargets: ['kn-teacher-only'],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible', 'teacher-scoped'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.visualization.map.blockedNodes).toContainEqual(
      expect.objectContaining({
        nodeId: 'restricted:1',
        title: '受限资源',
        reasonCodes: expect.arrayContaining(['teacher-policy-teacher-only']),
      }),
    );
    expect(JSON.stringify(plan)).not.toContain('teacher-only-hint');
    expect(JSON.stringify(plan)).not.toContain('教师专用提示');
  });

  it('falls back when the budget cannot include the prerequisite chain and target node', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'pre',
          title: '前置仿真',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'goal',
          title: '目标项目',
          launchTarget: '/missions?project=goal',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
          planningOverride: {
            readiness: {
              minimumCompetency: {},
              minimumEvidenceCount: 0,
              requiredCompletedNodeIds: ['simulation:pre'],
              requiredOutcomeRefs: [],
              unlockMessage: '完成前置仿真后解锁项目。',
              fallbackNodeIds: ['simulation:pre'],
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-budget',
        title: '预算不足目标',
        knowledgeTargets: ['kn-goal'],
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('time-budget-insufficient');
    expect(plan.alternatives.find((item) => item.nodeId === 'project:goal')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['time-budget-insufficient'],
      }),
    );
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-budget-deviation',
      type: 'deviation',
      nodeId: null,
      createdAt: '2026-05-27T10:45:00.000Z',
    });
    expect(updated.corrections[0].nodeIds).not.toContain('project:goal');
  });

  it('uses completed prerequisites outside the main path when evaluating alternatives', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'main-card',
          label: '主路径知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/main-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      simulations: [
        {
          id: 'pre',
          title: '替代路径前置',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'alt',
          title: '替代项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-alternative-completed-prereq',
        title: '替代路径已完成前置',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['simulation:pre'],
      },
    }));

    const alternative = plan.alternatives.find((item) => item.nodeId === 'project:alt');
    expect(alternative).toEqual(
      expect.objectContaining({
        blocked: false,
        nodeIds: ['project:alt'],
      }),
    );
  });

  it('includes the feasible alternative prerequisite chain in correction paths', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'main-card',
          label: '主路径知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/main-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      simulations: [
        {
          id: 'pre',
          title: '替代路径前置',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'alt',
          title: '替代项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-alternative-chain',
        title: '替代路径链',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-alternative-chain',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:00:00.000Z',
    });

    expect(plan.alternatives.find((item) => item.nodeId === 'project:alt')).toEqual(
      expect.objectContaining({
        blocked: false,
        nodeIds: ['simulation:pre', 'project:alt'],
      }),
    );
    expect(updated.corrections[0].nodeIds).toEqual(
      expect.arrayContaining(['simulation:pre', 'project:alt']),
    );
  });

  it('preserves feedback node ids for visible alternative prerequisite chains', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'main-card',
          label: '主路径知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/main-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      simulations: [
        {
          id: 'pre',
          title: '替代路径前置',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'alt',
          title: '替代项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-alternative-feedback',
        title: '替代路径反馈',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));
    expect(plan.alternatives.find((item) => item.nodeId === 'project:alt')?.nodeIds)
      .toEqual(['simulation:pre', 'project:alt']);

    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-alternative-prereq',
      type: 'helpfulness',
      nodeId: 'simulation:pre',
      createdAt: '2026-05-27T11:05:00.000Z',
      helpful: true,
    });

    expect(updated.feedbackEvents.at(-1)?.nodeId).toBe('simulation:pre');
  });

  it('keeps correction as one executable alternative path instead of merging alternatives', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'main-card',
          label: '主路径知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/main-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      simulations: [
        {
          id: 'pre-a',
          title: '替代路径前置 A',
          launchTarget: '/simulations/pre-a',
          knowledgeNodeIds: ['kn-pre-a'],
        },
        {
          id: 'pre-b',
          title: '替代路径前置 B',
          launchTarget: '/simulations/pre-b',
          knowledgeNodeIds: ['kn-pre-b'],
        },
      ],
      projects: [
        {
          id: 'alt-a',
          title: '替代项目 A',
          launchTarget: '/missions?project=alt-a',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre-a'],
        },
        {
          id: 'alt-b',
          title: '替代项目 B',
          launchTarget: '/missions?project=alt-b',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre-b'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-two-alternatives',
        title: '两个替代路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 85,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-two-alternatives',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:10:00.000Z',
    });

    const executableAlternatives = plan.alternatives.filter((item) => !item.blocked);
    expect(executableAlternatives.length).toBeGreaterThanOrEqual(2);
    expect(updated.corrections[0].nodeIds).toEqual(executableAlternatives[0].nodeIds);
    expect(updated.corrections[0].nodeIds).not.toEqual(
      expect.arrayContaining(executableAlternatives[1].nodeIds),
    );
  });

  it('falls back instead of chaining multiple terminal project nodes in the main path', () => {
    const registry = buildResourceNodeRegistry({
      projects: [
        {
          id: 'terminal-a',
          title: '终端项目 A',
          launchTarget: '/missions?project=a',
          knowledgeNodeIds: ['kn-a'],
        },
        {
          id: 'terminal-b',
          title: '终端项目 B',
          launchTarget: '/missions?project=b',
          knowledgeNodeIds: ['kn-b'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-two-terminals',
        title: '两个终端目标',
        knowledgeTargets: ['kn-a', 'kn-b'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 180,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath.filter((node) => node.terminalConstraints.includes('terminal-node'))).toHaveLength(0);
    expect(plan.explanations.fallbackReasons).toContain('resource-mapping-insufficient');
  });

  it('blocks alternatives whose prerequisite chain contains terminal nodes before the target', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'main-card',
          label: '主路径知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/main-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      projects: [
        {
          id: 'pre-project',
          title: '前置终端项目',
          launchTarget: '/missions?project=pre',
          knowledgeNodeIds: ['kn-pre'],
        },
        {
          id: 'alt-project',
          title: '替代终端项目',
          launchTarget: '/missions?project=alt',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['project:pre-project'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-terminal-prereq',
        title: '终端前置替代路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 180,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-terminal-prereq',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:20:00.000Z',
    });

    expect(plan.alternatives.find((item) => item.nodeId === 'project:alt-project')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['terminal-constraint-blocked'],
      }),
    );
    expect(updated.corrections[0].nodeIds).not.toContain('project:pre-project');
    expect(updated.corrections[0].nodeIds).not.toContain('project:alt-project');
  });

  it('falls back when prerequisite chains contain cycles', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'a',
          title: '循环仿真 A',
          launchTarget: '/simulations/a',
          knowledgeNodeIds: ['kn-a'],
          prerequisiteNodeIds: ['simulation:b'],
        },
        {
          id: 'b',
          title: '循环仿真 B',
          launchTarget: '/simulations/b',
          knowledgeNodeIds: ['kn-b'],
          prerequisiteNodeIds: ['simulation:a'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-cycle',
        title: '循环前置目标',
        knowledgeTargets: ['kn-a'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('feasible-goal-path-missing');
  });

  it('blocks cyclic alternatives and keeps them out of correction paths', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'main-card',
          label: '主路径知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/main-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      simulations: [
        {
          id: 'a',
          title: '循环仿真 A',
          launchTarget: '/simulations/a',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:b'],
        },
        {
          id: 'b',
          title: '循环仿真 B',
          launchTarget: '/simulations/b',
          knowledgeNodeIds: ['kn-b'],
          prerequisiteNodeIds: ['simulation:a'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-cyclic-alternative',
        title: '循环替代路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible'],
      },
    }));
    const updated = recordLearningPathFeedback(plan, {
      id: 'feedback-cyclic-alternative',
      type: 'deviation',
      nodeId: plan.currentNodeId,
      createdAt: '2026-05-27T11:30:00.000Z',
    });

    expect(plan.alternatives.find((item) => item.nodeId === 'simulation:a')).toEqual(
      expect.objectContaining({
        blocked: true,
        reasonCodes: ['infeasible-prerequisite-chain'],
      }),
    );
    expect(updated.corrections[0].nodeIds).not.toContain('simulation:a');
    expect(updated.corrections[0].nodeIds).not.toContain('simulation:b');
  });

  it('does not count completed prerequisites against the remaining time budget', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'pre',
          title: '前置仿真',
          launchTarget: '/simulations/pre',
          knowledgeNodeIds: ['kn-pre'],
        },
      ],
      projects: [
        {
          id: 'goal',
          title: '目标项目',
          launchTarget: '/missions?project=goal',
          knowledgeNodeIds: ['kn-goal'],
          prerequisiteNodeIds: ['simulation:pre'],
          planningOverride: {
            readiness: {
              minimumCompetency: {},
              minimumEvidenceCount: 0,
              requiredCompletedNodeIds: ['simulation:pre'],
              requiredOutcomeRefs: [],
              unlockMessage: '完成前置仿真后解锁项目。',
              fallbackNodeIds: ['simulation:pre'],
            },
          },
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-budget-after-completion',
        title: '已完成前置后的预算',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['simulation:pre'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.find((node) => node.nodeId === 'simulation:pre')?.status).toBe('completed');
    expect(plan.mainPath.find((node) => node.nodeId === 'project:goal')?.status).toBe('current');
    expect(plan.score.objectives.constraintSatisfaction).toBe(1);
    expect(serializeLearningPathPlan(plan).estimatedTime).toBe(60);
    expect(plan.visualization.timeline.windows[2].estimatedMinutes).toBe(60);
  });

  it('falls back when only part of a multi-target goal has resource coverage', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'public-card',
          label: '公开知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/public-card',
          knowledgeNodeIds: ['kn-public'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-partial-coverage',
        title: '部分覆盖目标',
        knowledgeTargets: ['kn-public', 'kn-missing'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
        completedNodeIds: ['registry:public-card'],
      },
    }));

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.executionStatus.completedNodeIds).toEqual([]);
    expect(plan.visualization.map.completedNodeIds).toEqual([]);
    expect(plan.alternatives.find((item) => item.nodeId === 'registry:public-card')).toBeUndefined();
    expect(plan.visualization.map.branchPaths).not.toContainEqual(
      expect.objectContaining({ nodeIds: [] }),
    );
    expect(plan.explanations.fallbackReasons).toContain('resource-mapping-insufficient');
    const record = serializeLearningPathPlan(plan);
    expect(record.payload.status).toBe('fallback');
    expect(record.payload.currentNodeId).toBeNull();
    expect(record.payload.visualization.evidence.evidenceBasis).toBe('fallback');
  });

  it('skips repeated target coverage so a feasible multi-target path can fit the budget', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'alpha-card-a',
          label: '目标 A 知识卡 A',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/alpha-a',
          knowledgeNodeIds: ['kn-alpha'],
        },
        {
          id: 'alpha-card-b',
          label: '目标 A 知识卡 B',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/alpha-b',
          knowledgeNodeIds: ['kn-alpha'],
        },
        {
          id: 'beta-card',
          label: '目标 B 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/beta',
          knowledgeNodeIds: ['kn-beta'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-budgeted-multi-target',
        title: '预算刚好覆盖两个目标',
        knowledgeTargets: ['kn-alpha', 'kn-beta'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-alpha': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 4 },
            'kn-beta': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'registry:alpha-card-a',
      'registry:beta-card',
    ]);
    expect(plan.mainPath.map((node) => node.knowledgeCoverage)).toEqual([
      ['kn-alpha'],
      ['kn-beta'],
    ]);
  });

  it('skips a high-scoring chain that would block another required target', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'alpha-sim',
          label: '目标 A 高成本仿真',
          type: 'SIMULATION_APP',
          launchTarget: '/simulations/alpha',
          knowledgeNodeIds: ['kn-alpha', 'kn-extra'],
        },
        {
          id: 'alpha-card',
          label: '目标 A 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/alpha',
          knowledgeNodeIds: ['kn-alpha'],
        },
        {
          id: 'beta-card',
          label: '目标 B 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/beta',
          knowledgeNodeIds: ['kn-beta'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-lookahead-budget',
        title: '前瞻预算覆盖两个目标',
        knowledgeTargets: ['kn-alpha', 'kn-beta'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-alpha': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 4 },
            'kn-beta': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
          },
        },
        resourcePreference: {
          preferredModalities: ['simulation'],
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 30,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'registry:alpha-card',
      'registry:beta-card',
    ]);
    expect(plan.mainPath).not.toContainEqual(
      expect.objectContaining({ nodeId: 'registry:alpha-sim' }),
    );
  });

  it('includes required risk intervention in the feasibility lookahead', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'all-targets-sim',
          label: '全目标高分仿真',
          type: 'SIMULATION_APP',
          launchTarget: '/simulations/all-targets',
          knowledgeNodeIds: ['kn-alpha', 'kn-beta'],
        },
        {
          id: 'beta-card',
          label: '目标 B 知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/beta',
          knowledgeNodeIds: ['kn-beta'],
        },
      ],
      reflectionPrompts: [
        {
          id: 'alpha-risk-reflection',
          title: '目标 A 风险反思',
          renderTarget: '/profile/growth?prompt=alpha-risk-reflection',
          knowledgeNodeIds: ['kn-alpha'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-risk-lookahead',
        title: '风险干预前瞻路径',
        knowledgeTargets: ['kn-alpha', 'kn-beta'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-alpha': { posteriorMastery: 0.1, confidence: 0.8, evidenceCount: 4 },
            'kn-beta': { posteriorMastery: 0.4, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 27,
        privacyScopes: ['student-visible'],
        requireRiskIntervention: true,
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'reflection_prompt:alpha-risk-reflection',
      'registry:beta-card',
    ]);
    expect(plan.mainPath).not.toContainEqual(
      expect.objectContaining({ nodeId: 'registry:all-targets-sim' }),
    );
    expect(plan.explanations.fallbackReasons).not.toContain('risk-intervention-resource-missing');
  });

  it('admits standalone risk interventions when risk support is required', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'goal-card',
          label: '目标知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/goal-card',
          knowledgeNodeIds: ['kn-goal'],
        },
      ],
      reflectionPrompts: [
        {
          id: 'participation-risk',
          title: '参与风险反思',
          renderTarget: '/profile/growth?prompt=participation-risk',
          knowledgeNodeIds: ['kn-risk-support'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-standalone-risk',
        title: '通用风险干预路径',
        knowledgeTargets: ['kn-goal'],
        competencyTargets: [],
      },
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-goal': { posteriorMastery: 0.2, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'medium',
            score: 0.7,
            evidenceCount: 8,
            sourceCompleteness: 0.7,
          },
        },
      },
      constraints: {
        timeBudgetMinutes: 27,
        privacyScopes: ['student-visible'],
        requireRiskIntervention: true,
      },
    }));

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.nodeId)).toEqual(
      expect.arrayContaining(['registry:goal-card', 'reflection_prompt:participation-risk']),
    );
    expect(plan.explanations.fallbackReasons).not.toContain('risk-intervention-resource-missing');
  });

  it('only emits competency deficit reasons for requested competency targets', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      goal: {
        id: 'goal-knowledge-only',
        title: '只补知识点',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
    }));

    expect(plan.explanations.selectedReasons).not.toContain('matches-competency-deficit');
  });

  it('carries governed path semantics through generation, serialization, and feedback history', () => {
    const registry = buildResourceNodeRegistry({
      externalResources: [{
        id: 'ocw-bode',
        title: '外部伯德图资料',
        source: 'MIT OCW',
        url: 'https://ocw.mit.edu/control/bode',
        estimatedTimeMinutes: 15,
        knowledgeNodeIds: ['kn-bode'],
        applicableGoalId: 'goal-bode-external',
        evidenceUseStatus: 'explicit-access-required',
        privacyPolicy: 'student-visible',
      }],
      checkpoints: [{
        id: 'bode-checkpoint',
        title: '伯德图阶段检查',
        assessmentPurpose: '确认学生能根据外部资料解释幅频特性',
        criteria: ['解释幅频曲线斜率', '说明穿越频率含义'],
        requiredEvidenceRefs: ['external_resource.accessed'],
        remediationBehavior: 'retry-prerequisite-node',
        reviewState: 'pending',
        launchTarget: '/assessment/adaptive-practice?checkpoint=bode',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['external-resource:ocw-bode'],
      }],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-bode-external',
        title: '伯德图外部资料路径',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 45,
        privacyScopes: ['student-visible'],
      },
      allowExternalResources: true,
      learnerState: {
        knowledgeMastery: {
          tags: {
            'kn-bode': { posteriorMastery: 0.15, confidence: 0.8, evidenceCount: 4 },
          },
        },
        evidence: {
          confidence: {
            level: 'high',
            score: 0.8,
            evidenceCount: 6,
            sourceCompleteness: 0.8,
          },
        },
      },
    }));
    const afterCompletion = recordLearningPathFeedback(plan, {
      id: 'feedback-1',
      type: 'completion',
      nodeId: 'external-resource:ocw-bode',
      createdAt: '2026-06-14T09:00:00.000Z',
      context: {
        evidenceRefs: [{ kind: 'external_resource_access', id: 'access-1' }],
      },
    });
    const serialized = serializeLearningPathPlan(afterCompletion);

    expect(plan.mainPath.map((node) => node.nodeId)).toEqual([
      'external-resource:ocw-bode',
      'checkpoint:bode-checkpoint',
    ]);
    expect(plan.mainPath.map((node) => ({
      nodeId: node.nodeId,
      pathNodeType: node.pathNodeType,
      iconKey: node.iconKey,
      shapeHint: node.shapeHint,
      evidenceBehavior: node.evidenceBehavior,
    }))).toEqual([
      {
        nodeId: 'external-resource:ocw-bode',
        pathNodeType: 'external_resource',
        iconKey: 'external-link',
        shapeHint: 'link',
        evidenceBehavior: 'explicit_access',
      },
      {
        nodeId: 'checkpoint:bode-checkpoint',
        pathNodeType: 'checkpoint',
        iconKey: 'checkpoint',
        shapeHint: 'gate',
        evidenceBehavior: 'assessment_gate',
      },
    ]);
    expect(serialized.payload.planNodes.map((node) => [node.nodeId, node.pathNodeType, node.iconKey]))
      .toEqual([
        ['external-resource:ocw-bode', 'external_resource', 'external-link'],
        ['checkpoint:bode-checkpoint', 'checkpoint', 'checkpoint'],
      ]);
    expect(serialized.payload.feedbackEvents[0]).toMatchObject({
      type: 'completion',
      nodeId: 'external-resource:ocw-bode',
    });
  });

  it('keeps currentNodeId and node status aligned after completed prerequisites', () => {
    const plan = buildAdaptiveLearningPathPlan(plannerInput());

    expect(plan.currentNodeId).not.toBeNull();
    expect(plan.mainPath.find((node) => node.nodeId === 'registry:bode-card')?.status).toBe('completed');
    expect(plan.mainPath.find((node) => node.nodeId === plan.currentNodeId)?.status).toBe('current');
    expect(plan.mainPath.filter((node) => node.status === 'current')).toHaveLength(1);
  });

  it('clears the active node when all main path nodes are completed', () => {
    const initial = buildAdaptiveLearningPathPlan(plannerInput());
    const completedNodeIds = initial.mainPath.map((node) => node.nodeId);
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      constraints: {
        timeBudgetMinutes: 90,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        completedNodeIds,
      },
    }));

    expect(plan.currentNodeId).toBeNull();
    expect(plan.executionStatus.activeNodeId).toBeNull();
    expect(plan.mainPath.every((node) => node.status === 'completed')).toBe(true);
  });

  it('keeps high-load nodes without readiness metadata as locked future milestones', () => {
    const registry = buildResourceNodeRegistry({
      simulations: [
        {
          id: 'ungated-sim',
          title: '缺 readiness 的高负载仿真',
          launchTarget: '/simulations/ungated',
          knowledgeNodeIds: ['kn-ungated-sim'],
        },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-ungated-sim',
        title: '缺 readiness 仿真目标',
        knowledgeTargets: ['kn-ungated-sim'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
      },
      policyBundle: {
        families: ['simulation-driven'],
        overlapThreshold: 0.6,
      },
    }));

    expect(plan.currentNodeId).toBeNull();
    expect(plan.executionStatus.activeNodeId).toBeNull();
    expect(plan.mainPath).toContainEqual(expect.objectContaining({
      nodeId: 'simulation:ungated-sim',
      status: 'locked',
      readiness: expect.objectContaining({
        state: 'locked',
        reasonCodes: ['readiness-metadata-missing'],
      }),
    }));
    const option = plan.policyBundle?.paths.find((path) => path.nodeIds.includes('simulation:ungated-sim'));
    expect(option?.activeNodeIds).not.toContain('simulation:ungated-sim');
    expect(option?.lockedNodeIds).toContain('simulation:ungated-sim');
  });

  it('evaluates readiness for policy support nodes before marking them active', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'foundation-card',
          label: '基础知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/foundation-card',
          knowledgeNodeIds: ['kn-foundation'],
        },
      ],
      simulations: [
        {
          id: 'support-sim',
          title: '缺 readiness 的偏好仿真',
          launchTarget: '/simulations/support',
          knowledgeNodeIds: ['kn-foundation', 'kn-support'],
        },
      ],
      knowledgeNodes: [
        { id: 'kn-foundation', name: '基础知识' },
        { id: 'kn-support', name: '支持仿真' },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'control-correction',
        title: '控制校正',
        knowledgeTargets: ['kn-foundation'],
        competencyTargets: ['parameterDesign'],
      },
      learnerState: {
        ...plannerInput().learnerState!,
        resourcePreference: {
          preferredModalities: ['simulation'],
        },
      },
      constraints: {
        timeBudgetMinutes: 80,
        privacyScopes: ['student-visible'],
      },
      policyBundle: {
        families: ['preference-matched'],
        overlapThreshold: 0.6,
      },
    }));

    const preferenceOption = plan.policyBundle?.paths.find((path) => path.policyFamily === 'preference-matched');

    expect(preferenceOption?.nodeIds).toContain('simulation:support-sim');
    expect(preferenceOption?.activeNodeIds).not.toContain('simulation:support-sim');
    expect(preferenceOption?.lockedNodeIds).toContain('simulation:support-sim');
    expect(preferenceOption?.readinessSummary).toContainEqual(expect.objectContaining({
      nodeId: 'simulation:support-sim',
      state: 'locked',
    }));
  });

  it('stops policy active node collection at locked readiness gates', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'prep',
          label: '准备资源',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/prep',
          knowledgeNodeIds: ['kn-prep'],
        },
      ],
      simulations: [
        {
          id: 'locked-sim',
          title: '缺 readiness 的锁定仿真',
          launchTarget: '/simulations/locked',
          knowledgeNodeIds: ['kn-sim'],
          prerequisiteNodeIds: ['registry:prep'],
        },
      ],
      reflectionPrompts: [
        {
          id: 'reflect',
          title: '后续反思',
          renderTarget: '/profile/growth?prompt=reflect',
          knowledgeNodeIds: ['kn-reflect'],
          prerequisiteNodeIds: ['simulation:locked-sim'],
        },
      ],
      knowledgeNodes: [
        { id: 'kn-prep', name: '准备资源' },
        { id: 'kn-sim', name: '锁定仿真' },
        { id: 'kn-reflect', name: '后续反思' },
      ],
    });

    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-locked-gate-active-policy',
        title: '锁定门后的 active 状态',
        knowledgeTargets: ['kn-sim', 'kn-reflect'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible'],
      },
      policyBundle: {
        families: ['rules-plus-graph-search'],
        overlapThreshold: 0.6,
      },
    }));
    const option = plan.policyBundle?.paths.find((path) => path.policyFamily === 'rules-plus-graph-search');

    expect(plan.mainPath.map((node) => [node.nodeId, node.status])).toEqual([
      ['registry:prep', 'current'],
      ['simulation:locked-sim', 'locked'],
      ['reflection_prompt:reflect', 'next'],
    ]);
    expect(option?.activeNodeIds).toEqual(['registry:prep']);
    expect(option?.activeNodeIds).not.toContain('reflection_prompt:reflect');
    expect(option?.lockedNodeIds).toContain('simulation:locked-sim');
  });

  it('does not unlock readiness-metadata-missing nodes after prerequisite feedback', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'prep-card',
          label: '准备知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/prep-card',
          knowledgeNodeIds: ['kn-prep'],
        },
      ],
      simulations: [
        {
          id: 'ungated-with-prereq',
          title: '缺 readiness 的前置仿真',
          launchTarget: '/simulations/ungated-with-prereq',
          knowledgeNodeIds: ['kn-ungated-sim'],
          prerequisiteNodeIds: ['registry:prep-card'],
        },
      ],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-ungated-prereq-sim',
        title: '缺 readiness 前置仿真目标',
        knowledgeTargets: ['kn-ungated-sim'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
      },
      policyBundle: {
        families: ['simulation-driven'],
        overlapThreshold: 0.6,
      },
    }));

    expect(plan.currentNodeId).toBe('registry:prep-card');

    const updated = recordLearningPathFeedback(plan, {
      id: 'complete-prep-card',
      type: 'completion',
      nodeId: 'registry:prep-card',
      createdAt: '2026-06-17T10:20:00.000Z',
    });

    expect(updated.currentNodeId).toBeNull();
    expect(updated.executionStatus.activeNodeId).toBeNull();
    expect(updated.mainPath).toContainEqual(expect.objectContaining({
      nodeId: 'simulation:ungated-with-prereq',
      status: 'locked',
      readiness: expect.objectContaining({
        state: 'locked',
        reasonCodes: ['readiness-metadata-missing'],
      }),
    }));
    const option = updated.policyBundle?.paths.find((path) => path.nodeIds.includes('simulation:ungated-with-prereq'));
    expect(option?.activeNodeIds).toEqual([]);
    expect(option?.activeNodeIds).not.toContain('simulation:ungated-with-prereq');
    expect(option?.activeNodeIds).not.toContain('registry:prep-card');
    expect(option?.lockedNodeIds).toContain('simulation:ungated-with-prereq');
    expect(option?.readinessSummary).toContainEqual(expect.objectContaining({
      nodeId: 'simulation:ungated-with-prereq',
      state: 'locked',
    }));
  });

  it('deducts evidence readiness gaps after completion feedback supplies evidence delta', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'prep-card',
          label: '准备知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/prep-card',
          knowledgeNodeIds: ['kn-prep'],
        },
      ],
      simulations: [
        {
          id: 'evidence-gated-sim',
          title: '证据门槛仿真',
          launchTarget: '/simulations/evidence-gated',
          knowledgeNodeIds: ['kn-evidence-sim'],
          prerequisiteNodeIds: ['registry:prep-card'],
          planningOverride: {
            readiness: {
              minimumCompetency: {},
              minimumEvidenceCount: 1,
              requiredCompletedNodeIds: ['registry:prep-card'],
              requiredOutcomeRefs: [],
              unlockMessage: '完成准备证据后解锁。',
              fallbackNodeIds: ['registry:prep-card'],
            },
          },
        },
      ],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-evidence-gated-sim',
        title: '证据门槛仿真目标',
        knowledgeTargets: ['kn-evidence-sim'],
        competencyTargets: [],
      },
      learnerState: {
        ...plannerInput().learnerState!,
        evidence: {
          confidence: { evidenceCount: 0 },
        },
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
      },
    }));

    expect(plan.currentNodeId).toBe('registry:prep-card');
    expect(plan.mainPath.find((node) => node.nodeId === 'simulation:evidence-gated-sim')?.readiness)
      .toEqual(expect.objectContaining({
        state: 'locked',
        missingEvidenceCount: 1,
        missingCompletedNodeIds: ['registry:prep-card'],
      }));

    const updated = recordLearningPathFeedback(plan, {
      id: 'complete-prep-with-evidence',
      type: 'completion',
      nodeId: 'registry:prep-card',
      createdAt: '2026-06-17T11:40:00.000Z',
      context: {
        evidenceReadinessDelta: 1,
      },
    });

    expect(updated.currentNodeId).toBe('simulation:evidence-gated-sim');
    expect(updated.mainPath.find((node) => node.nodeId === 'simulation:evidence-gated-sim')).toEqual(expect.objectContaining({
      status: 'current',
      readiness: expect.objectContaining({
        state: 'ready',
        missingEvidenceCount: 0,
      }),
    }));
  });

  it('keeps feedback evidence delta from clearing unsatisfied outcome gates', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'prep-card',
          label: '准备知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/prep-card',
          knowledgeNodeIds: ['kn-prep'],
        },
      ],
      simulations: [
        {
          id: 'outcome-and-evidence-gated-sim',
          title: '证据与结果门槛仿真',
          launchTarget: '/simulations/outcome-evidence-gated',
          knowledgeNodeIds: ['kn-outcome-sim'],
          prerequisiteNodeIds: ['registry:prep-card'],
          planningOverride: {
            readiness: {
              minimumCompetency: {},
              minimumEvidenceCount: 1,
              requiredCompletedNodeIds: ['registry:prep-card'],
              requiredOutcomeRefs: ['simulation_run:prep-card'],
              unlockMessage: '完成准备证据与结果后解锁。',
              fallbackNodeIds: ['registry:prep-card'],
            },
          },
        },
      ],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-outcome-evidence-gated-sim',
        title: '证据与结果门槛仿真目标',
        knowledgeTargets: ['kn-outcome-sim'],
        competencyTargets: [],
      },
      learnerState: {
        ...plannerInput().learnerState!,
        evidence: {
          confidence: { evidenceCount: 0 },
        },
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
      },
    }));

    const updated = recordLearningPathFeedback(plan, {
      id: 'complete-prep-with-evidence-but-no-outcome',
      type: 'completion',
      nodeId: 'registry:prep-card',
      createdAt: '2026-06-17T11:45:00.000Z',
      context: {
        evidenceReadinessDelta: 1,
      },
    });
    const gatedNode = updated.mainPath.find((node) => node.nodeId === 'simulation:outcome-and-evidence-gated-sim');

    expect(updated.currentNodeId).toBeNull();
    expect(gatedNode).toEqual(expect.objectContaining({
      status: 'locked',
      readiness: expect.objectContaining({
        state: 'locked',
        missingEvidenceCount: 0,
        missingOutcomeRefs: ['simulation_run:prep-card'],
      }),
    }));
  });

  it('preserves non-overlapping policy option node states after feedback refresh', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'prep-card',
          label: '准备知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/prep-card',
          knowledgeNodeIds: ['kn-prep'],
        },
      ],
      simulations: [
        {
          id: 'ungated-with-prereq',
          title: '缺 readiness 的前置仿真',
          launchTarget: '/simulations/ungated-with-prereq',
          knowledgeNodeIds: ['kn-ungated-sim'],
          prerequisiteNodeIds: ['registry:prep-card'],
        },
      ],
    });
    const plan = buildAdaptiveLearningPathPlan(plannerInput({
      registry,
      goal: {
        id: 'goal-partial-overlap-policy',
        title: '部分重叠策略路径',
        knowledgeTargets: ['kn-ungated-sim'],
        competencyTargets: [],
      },
      constraints: {
        timeBudgetMinutes: 60,
        privacyScopes: ['student-visible'],
      },
      policyBundle: {
        families: ['simulation-driven'],
        overlapThreshold: 0.6,
      },
    }));
    const baseOption = plan.policyBundle?.paths[0];
    expect(baseOption).toBeDefined();
    const planWithPartialOption = {
      ...plan,
      policyBundle: {
        ...plan.policyBundle!,
        paths: [
          ...plan.policyBundle!.paths,
          {
            ...baseOption!,
            styleId: 'preference-matched-route' as const,
            policyFamily: 'preference-matched' as const,
            label: '部分重叠备选路径',
            nodeIds: ['registry:prep-card', 'external-resource:non-overlap', 'simulation:non-overlap-locked'],
            activeNodeIds: ['registry:prep-card', 'external-resource:non-overlap'],
            lockedNodeIds: ['simulation:non-overlap-locked'],
            readinessSummary: [
              {
                nodeId: 'simulation:non-overlap-locked',
                state: 'locked' as const,
                message: '备选路径仍有锁定节点。',
              },
            ],
            unlockMessages: [
              {
                nodeId: 'simulation:non-overlap-locked',
                message: '备选路径仍有锁定节点。',
              },
            ],
          },
        ],
      },
    };

    const updated = recordLearningPathFeedback(planWithPartialOption, {
      id: 'complete-prep-card-partial-policy',
      type: 'completion',
      nodeId: 'registry:prep-card',
      createdAt: '2026-06-17T10:30:00.000Z',
    });
    const partialOption = updated.policyBundle?.paths.find((path) => path.label === '部分重叠备选路径');

    expect(partialOption?.activeNodeIds).toEqual(['external-resource:non-overlap']);
    expect(partialOption?.lockedNodeIds).toEqual(['simulation:non-overlap-locked']);
    expect(partialOption?.readinessSummary).toEqual([
      {
        nodeId: 'simulation:non-overlap-locked',
        state: 'locked',
        message: '备选路径仍有锁定节点。',
      },
    ]);
    expect(partialOption?.unlockMessages).toEqual([
      {
        nodeId: 'simulation:non-overlap-locked',
        message: '备选路径仍有锁定节点。',
      },
    ]);
  });
});
