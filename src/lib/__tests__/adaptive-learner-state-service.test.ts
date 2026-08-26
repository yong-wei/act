import { describe, expect, it, vi } from 'vitest';

import { getArenaEvaluationProtocolVersion } from '@/features/arena/evaluation/protocol';
import {
  CONTROL_CORRECTION_GOAL_ID,
  readAdaptiveLearnerState,
  type MasteryEvidenceSourceType,
} from '@/lib/data-governance/adaptive-learner-state-service';
import type { CompetencyVector } from '@/lib/data-governance/competency-model';
import type { StudentPathEvidenceSourceReference } from '@/lib/data-governance/student-evidence-feature-cache';

const now = new Date('2026-06-19T06:00:00.000Z');

describe('readAdaptiveLearnerState mastery evidence writeback', () => {
  it('materializes governed evidence refs and rejects raw narrative-only AI evidence', async () => {
    const db = createEvidenceDb();

    const state = await readAdaptiveLearnerState(db as any, {
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });

    const rootLocusKnowledge = state.knowledgeMastery.tags['control-correction:root-locus-design'];
    expect(rootLocusKnowledge.supportingEvidenceRefs).toEqual([
      expect.objectContaining({
        sourceType: 'AdaptiveMasteryUpdate',
        sourceId: 'mastery-root-locus',
        confidence: 'high',
      }),
    ]);

    const capabilityRefs = state.masteryTraceability?.capabilityTargets['control-correction:root-locus-design:analyze']
      .supportingEvidenceRefs ?? [];
    expect(sourceTypes(capabilityRefs)).toEqual(expect.arrayContaining([
      'LearningFact',
      'AgentToolRun',
    ]));
    expect(capabilityRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: 'AgentToolRun',
        sourceId: 'tool-approved-structured',
        privacyLevel: 'teacher-scoped',
      }),
      expect.objectContaining({
        sourceType: 'AgentToolRun',
        sourceId: 'tool-production-capability-ref',
        privacyLevel: 'teacher-scoped',
      }),
    ]));
    expect(JSON.stringify(capabilityRefs)).not.toContain('tool-unapproved-raw');
    expect(JSON.stringify(capabilityRefs)).not.toContain('tool-not-required-raw');
    expect(JSON.stringify(capabilityRefs)).not.toContain('tool-not-required-deterministic');
    expect(JSON.stringify(capabilityRefs)).not.toContain('tool-input-forged-governance');
    expect(JSON.stringify(capabilityRefs)).not.toContain('tool-input-forged-target');
    expect(JSON.stringify(capabilityRefs)).not.toContain('tool-approved-no-summary');
    expect(JSON.stringify(capabilityRefs)).not.toContain('runid-only-ai-fact');
    expect(JSON.stringify(capabilityRefs)).not.toContain('agent-outcome-only-ai-fact');
    expect(JSON.stringify(capabilityRefs)).not.toContain('raw-chat-fact');
    expect(JSON.stringify(capabilityRefs)).not.toContain('student has mastered root locus');

    const simulationRefs = state.masteryTraceability?.capabilityTargets['control-correction:simulation-validation:evaluate']
      .supportingEvidenceRefs ?? [];
    expect(sourceTypes(simulationRefs)).toEqual(expect.arrayContaining([
      'LearningFact',
      'StudentEvidenceFeatureCache',
    ]));

    const arenaRefs = state.masteryTraceability?.capabilityTargets['control-correction:arena-transfer:create']
      .supportingEvidenceRefs ?? [];
    expect(sourceTypes(arenaRefs)).toEqual(expect.arrayContaining([
      'ArenaSubmission',
    ]));

    const goalSlice = state.goalSlices?.controlCorrection;
    expect(goalSlice?.pathContext.activePathId).toBe('path-active-control');
    const rootLocusObserved = goalSlice?.capabilityTargets.find((entry) => (
      entry.target.id === 'control-correction:root-locus-design:analyze'
    ))?.observedEvidence;
    expect(rootLocusObserved?.supportingEvidenceRefs).toEqual(capabilityRefs);
    expect(rootLocusObserved?.limitations).not.toContain('missing-governed-evidence');

    const aiDimension = goalSlice?.dimensions.find((dimension) => dimension.id === 'ai-collaboration');
    expect(aiDimension?.sourceCoverage.aiCollaboration).toBe('available');
    expect(aiDimension?.evidenceCount).toBeGreaterThan(0);
    expect(db.agentToolRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        courseId: { in: expect.arrayContaining([CONTROL_CORRECTION_GOAL_ID]) },
      }),
    }));
  });

  it('hides teacher-scoped mastery evidence references from student responses', async () => {
    const state = await readAdaptiveLearnerState(createEvidenceDb() as any, {
      userId: 'student-1',
      role: 'student',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });

    const capability = state.masteryTraceability?.capabilityTargets['control-correction:root-locus-design:analyze'];
    expect(capability?.supportingEvidenceRefs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'AgentToolRun' }),
    ]));
    expect(capability?.sourceCoverage.AgentToolRun).toBe('missing');
    expect(capability?.limitations).toContain('restricted-evidence-hidden');

    const goalSlice = state.goalSlices?.controlCorrection;
    const rootLocusObserved = goalSlice?.capabilityTargets.find((entry) => (
      entry.target.id === 'control-correction:root-locus-design:analyze'
    ))?.observedEvidence;
    expect(rootLocusObserved?.supportingEvidenceRefs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'AgentToolRun' }),
    ]));
  });

  it('does not leak hidden AgentToolRun evidence through student confidence or AI coverage', async () => {
    const db = createEvidenceDb();
    db.learningFact.findMany.mockResolvedValue([]);
    db.adaptiveMasteryUpdate.findMany.mockResolvedValue([]);

    const state = await readAdaptiveLearnerState(db as any, {
      userId: 'student-1',
      role: 'student',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });

    const rootLocusCapability = state.masteryTraceability?.capabilityTargets['control-correction:root-locus-design:analyze'];
    expect(rootLocusCapability).toMatchObject({
      masteryLevel: null,
      confidence: 0,
      sourceCoverage: expect.objectContaining({ AgentToolRun: 'missing' }),
      freshness: 'missing',
    });
    expect(rootLocusCapability?.supportingEvidenceRefs).toEqual([]);
    expect(rootLocusCapability?.limitations).toEqual(expect.arrayContaining([
      'restricted-evidence-hidden',
      'missing-governed-evidence',
    ]));

    const aiDimension = state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'ai-collaboration');
    expect(aiDimension).toMatchObject({
      evidenceCount: 0,
      freshness: 'missing',
      sourceCoverage: expect.objectContaining({ aiCollaboration: 'missing' }),
      evidenceProvenance: expect.objectContaining({ aiCollaboration: 'missing' }),
    });
  });

  it('counts visible governed AgentToolRun refs as direct capability evidence', async () => {
    const db = createEvidenceDb();
    db.learningFact.findMany.mockResolvedValue([]);
    db.adaptiveMasteryUpdate.findMany.mockResolvedValue([]);
    db.studentEvidenceFeatureCache.findUnique.mockResolvedValue({
      ...featureCache(competencyVector()),
      features: {
        ...featureCache(competencyVector()).features,
        pathExecution: {
          allTime: {
            sourceReferences: [],
          },
        },
      },
    });

    const state = await readAdaptiveLearnerState(db as any, {
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });

    const rootLocusObserved = state.goalSlices?.controlCorrection?.capabilityTargets.find((entry) => (
      entry.target.id === 'control-correction:root-locus-design:analyze'
    ))?.observedEvidence;
    expect(rootLocusObserved).toMatchObject({
      state: 'observed',
      directEvidenceCount: 2,
      recommendationBias: 'targeted-practice',
      sourceCoverage: expect.objectContaining({ AgentToolRun: 'available' }),
    });
    expect(rootLocusObserved?.supportingEvidenceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'AgentToolRun', sourceId: 'tool-approved-structured' }),
      expect.objectContaining({ sourceType: 'AgentToolRun', sourceId: 'tool-production-capability-ref' }),
    ]));
  });

  it('does not leak hidden low-confidence refs through student limitations', async () => {
    const db = createEvidenceDb();
    const cache = featureCache(competencyVector());
    cache.features.pathExecution.allTime.sourceReferences = [
      {
        sourceType: 'LearningPathExecution',
        sourceId: 'path-exec-hidden-low',
        pathId: 'path-active-control',
        nodeId: 'node-quiz',
        occurredAt: '2026-06-18T06:00:00.000Z',
        privacyLevel: 'teacher-scoped',
        status: 'completed',
        resourceType: 'quiz',
        confidence: 'low',
      },
    ];
    db.studentEvidenceFeatureCache.findUnique.mockResolvedValue(cache);
    db.adaptiveMasteryUpdate.findMany.mockResolvedValue([]);

    const state = await readAdaptiveLearnerState(db as any, {
      userId: 'student-1',
      role: 'student',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });

    const rootLocusCapability = state.masteryTraceability?.capabilityTargets['control-correction:root-locus-design:analyze'];
    expect(rootLocusCapability?.supportingEvidenceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: 'LearningFact',
        confidence: 'high',
      }),
    ]));
    expect(rootLocusCapability?.supportingEvidenceRefs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'StudentEvidenceFeatureCache' }),
    ]));
    expect(rootLocusCapability?.limitations).toContain('restricted-evidence-hidden');
    expect(rootLocusCapability?.limitations).not.toContain('low-confidence-source');
    expect(rootLocusCapability?.freshness).toBe('current');
    expect(rootLocusCapability?.confidence).toBeGreaterThan(0);
  });

  it('keeps teacher-scoped path intervention references for teacher responses', async () => {
    const cache = featureCache(competencyVector());
    cache.features.pathExecution.allTime.sourceReferences.push({
      sourceType: 'LearningPathIntervention',
      sourceId: 'intervention-teacher-1',
      pathId: 'path-active-control',
      goalId: CONTROL_CORRECTION_GOAL_ID,
      nodeId: 'intervention-teacher-node',
      occurredAt: '2026-06-18T07:00:00.000Z',
      privacyLevel: 'teacher-scoped',
      interventionKind: 'hint',
      studentOutcome: 'accepted',
    });

    const teacherDb = createEvidenceDb();
    teacherDb.studentEvidenceFeatureCache.findUnique.mockResolvedValue(cache);
    const teacherState = await readAdaptiveLearnerState(teacherDb as any, {
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });
    expect(JSON.stringify(teacherState.prerequisiteFeatureGroups.pathExecution)).toContain('intervention-teacher-1');

    const studentDb = createEvidenceDb();
    studentDb.studentEvidenceFeatureCache.findUnique.mockResolvedValue(cache);
    const studentState = await readAdaptiveLearnerState(studentDb as any, {
      userId: 'student-1',
      role: 'student',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });
    expect(JSON.stringify(studentState.prerequisiteFeatureGroups.pathExecution)).not.toContain('intervention-teacher-1');
  });

  it('does not treat non-official valid Arena submissions as official mastery evidence refs', async () => {
    const db = createEvidenceDb();
    db.arenaSubmission.findMany.mockResolvedValueOnce([
      {
        id: 'arena-preview-valid',
        valid: true,
        taskId: 'task-second-order-lead-pid',
        method: 'pid',
        submittedAt: new Date('2026-06-17T09:00:00.000Z'),
        evaluationRun: {
          protocolVersion: 'legacy-preview-protocol',
        },
        controllerArtifact: { payload: { method: 'pid' } },
      },
    ]);

    const state = await readAdaptiveLearnerState(db as any, {
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      goal: CONTROL_CORRECTION_GOAL_ID,
      now,
    });

    const arenaCapability = state.masteryTraceability?.capabilityTargets['control-correction:arena-transfer:create'];
    expect(arenaCapability?.supportingEvidenceRefs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'ArenaSubmission' }),
    ]));
    expect(arenaCapability?.sourceCoverage.ArenaSubmission).toBe('missing');
    expect(arenaCapability?.limitations).toContain('non-official-or-preview-only-evidence');
  });
});

function createEvidenceDb() {
  const vector = competencyVector();
  const facts = [
    fact('assessment-root-locus', 'assessment', 0.92),
    fact('simulation-evaluation', 'simulation', 0.86),
    fact('reflection-interactive', 'reflection', 0.74),
    fact('agent-materialized', 'ai_intervention', 0.8, {
      interventionOutcome: { approved: true },
      evidenceSummary: { materialized: true },
    }),
    fact('runid-only-ai-fact', 'ai', 1, {
      agentToolRunId: 'tool-run-only',
      rawNarrative: 'student has mastered root locus',
    }),
    fact('agent-outcome-only-ai-fact', 'ai', 1, {
      agentTool: { interventionOutcome: 0.91 },
      rawNarrative: 'student has mastered root locus',
    }),
    fact('raw-chat-fact', 'ai', 1, {
      rawNarrative: 'student has mastered root locus',
    }),
  ];

  return {
    studentEvidenceFeatureCache: {
      findUnique: vi.fn().mockResolvedValue(featureCache(vector)),
    },
    studentCompetencySnapshot: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'snapshot-1',
        competencyVector: vector,
      }),
    },
    studentProfileSummary: {
      findUnique: vi.fn().mockResolvedValue({ riskLevel: 'low' }),
    },
    learningFact: {
      findMany: vi.fn().mockResolvedValue(facts),
    },
    adaptiveMasteryUpdate: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'mastery-root-locus',
          knowledgeTag: 'control-correction:root-locus-design',
          posteriorMastery: 0.78,
          confidence: 0.82,
          algorithmVersion: 'adaptive-assessment-bkt-v1',
          createdAt: new Date('2026-06-18T04:00:00.000Z'),
        },
      ]),
    },
    adaptiveAssessmentAbilityEstimate: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    studentRiskFlag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    learningPath: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'path-active-control',
          goalId: CONTROL_CORRECTION_GOAL_ID,
          pathStatus: 'active',
          currentNodeId: 'node-simulation',
          terminalValidation: { state: 'pending' },
          lastExecutionMetadata: { lowConfidenceMarkers: [] },
          isBookmarked: false,
        },
      ]),
    },
    arenaSubmission: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'arena-official-1',
          valid: true,
          taskId: 'task-second-order-lead-pid',
          method: 'pid',
          submittedAt: new Date('2026-06-17T09:00:00.000Z'),
          evidenceWriteback: {
            status: 'accepted',
            terminalValidationAccepted: true,
          },
          evaluationRun: {
            protocolVersion: getArenaEvaluationProtocolVersion({
              taskId: 'task-second-order-lead-pid',
              method: 'pid' as any,
            }),
          },
          controllerArtifact: { payload: { method: 'pid' } },
        },
      ]),
    },
    agentToolRun: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'tool-approved-structured',
          targetUserId: 'student-1',
          courseId: '3-6',
          status: 'completed',
          approvalState: 'approved',
          completedAt: new Date('2026-06-18T08:00:00.000Z'),
          outputSummary: {
            evidenceSummary: {
              materialized: true,
              capabilityTargetIds: ['control-correction:root-locus-design:analyze'],
            },
          },
        },
        {
          id: 'tool-production-capability-ref',
          targetUserId: 'student-1',
          courseId: CONTROL_CORRECTION_GOAL_ID,
          status: 'completed',
          approvalState: 'approved',
          completedAt: new Date('2026-06-18T08:30:00.000Z'),
          outputSummary: {
            evidenceSummary: {
              materialized: true,
              capabilityTargetRefs: ['capability:root-locus-design'],
            },
          },
        },
        {
          id: 'tool-unapproved-raw',
          targetUserId: 'student-1',
          courseId: '3-6',
          status: 'completed',
          approvalState: 'required',
          completedAt: new Date('2026-06-18T09:00:00.000Z'),
          outputSummary: {
            narrative: 'student has mastered root locus',
            capabilityTargetIds: ['control-correction:root-locus-design:analyze'],
          },
        },
        {
          id: 'tool-not-required-raw',
          targetUserId: 'student-1',
          courseId: '3-6',
          status: 'completed',
          approvalState: 'not_required',
          completedAt: new Date('2026-06-18T10:00:00.000Z'),
          outputSummary: {
            narrative: 'student has mastered root locus',
            capabilityTargetIds: ['control-correction:root-locus-design:analyze'],
          },
        },
        {
          id: 'tool-not-required-deterministic',
          targetUserId: 'student-1',
          courseId: '3-6',
          status: 'completed',
          approvalState: 'not_required',
          completedAt: new Date('2026-06-18T10:30:00.000Z'),
          outputSummary: {
            deterministicMetrics: true,
            capabilityTargetIds: ['control-correction:root-locus-design:analyze'],
          },
        },
        {
          id: 'tool-input-forged-governance',
          targetUserId: 'student-1',
          courseId: '3-6',
          status: 'completed',
          approvalState: 'not_required',
          completedAt: new Date('2026-06-18T10:45:00.000Z'),
          inputSummary: {
            materializedEvidence: true,
            verifiedCitationSummary: true,
            capabilityTargetIds: ['control-correction:root-locus-design:analyze'],
          },
          outputSummary: null,
        },
        {
          id: 'tool-input-forged-target',
          targetUserId: 'student-1',
          courseId: '3-6',
          status: 'completed',
          approvalState: 'not_required',
          completedAt: new Date('2026-06-18T10:50:00.000Z'),
          inputSummary: {
            capabilityTargetIds: ['control-correction:root-locus-design:analyze'],
          },
          outputSummary: {
            evidenceSummary: { materialized: true },
          },
        },
        {
          id: 'tool-approved-no-summary',
          targetUserId: 'student-1',
          courseId: '3-6',
          status: 'completed',
          approvalState: 'approved',
          completedAt: new Date('2026-06-18T11:00:00.000Z'),
          inputSummary: {
            capabilityTargetIds: ['control-correction:root-locus-design:analyze'],
          },
          outputSummary: null,
        },
      ]),
    },
  };
}

function fact(id: string, factType: string, score: number, context: Record<string, unknown> = {}) {
  return {
    id,
    userId: 'student-1',
    factType,
    score,
    outcome: 'success',
    startedAt: new Date('2026-06-18T03:00:00.000Z'),
    courseId: '3-6',
    contextJson: {
      goalId: CONTROL_CORRECTION_GOAL_ID,
      evidenceGovernance: {
        profileWeight: 1,
        skipProfileContribution: false,
        policyReason: 'unit-test-complete-governance',
      },
      ...context,
    },
  };
}

function featureCache(vector: CompetencyVector) {
  const pathSourceReferences: StudentPathEvidenceSourceReference[] = [
    {
      sourceType: 'LearningPathExecution',
      sourceId: 'path-exec-1',
      pathId: 'path-active-control',
      goalId: CONTROL_CORRECTION_GOAL_ID,
      nodeId: 'node-simulation',
      occurredAt: '2026-06-18T06:00:00.000Z',
      privacyLevel: 'student-visible',
      status: 'completed',
      resourceType: 'simulation',
      confidence: 'high',
    },
  ];

  return {
    id: 'feature-cache-1',
    userId: 'student-1',
    payloadVersion: 'student-evidence-features.v4',
    refreshedAt: now,
    evidenceWindow: {
      firstStartedAt: '2026-06-01T00:00:00.000Z',
      lastStartedAt: '2026-06-18T09:00:00.000Z',
      daysCovered: 18,
    },
    sourceCounts: {
      LearningFact: 5,
      StudentCompetencySnapshot: 1,
      StudentProfileSummary: 1,
      byFactType: {},
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'available',
      StudentProfileSummary: 'available',
    },
    confidenceMarkers: {
      level: 'high',
      score: 0.86,
      evidenceCount: 5,
      sourceCompleteness: 0.9,
    },
    statusMarkers: [],
    features: {
      approvedAggregates: {
        latestSnapshot: {
          snapshotAt: '2026-06-18T02:00:00.000Z',
          factCount: 5,
          calculationVersion: 'test',
          competencyVector: vector,
        },
      },
      simulationArena: {
        allTime: {
          sourceCoverage: {
            simulation: 'available',
            arena: 'available',
          },
          qualityMarkers: [],
        },
      },
      pathExecution: {
        allTime: {
          sourceReferences: pathSourceReferences,
        },
      },
    },
  };
}

function competencyVector(): CompetencyVector {
  const score = {
    score: 78,
    trend: 'stable' as const,
    confidence: 0.82,
    evidenceCount: 4,
    lastUpdated: '2026-06-18T02:00:00.000Z',
  };
  return {
    controlModeling: score,
    parameterDesign: score,
    crossDomainTransfer: score,
    engineeringDecision: score,
    inquiryReflection: score,
    selfDirectedLearning: score,
  };
}

function sourceTypes(refs: Array<{ sourceType: MasteryEvidenceSourceType }>): MasteryEvidenceSourceType[] {
  return refs.map((ref) => ref.sourceType);
}
