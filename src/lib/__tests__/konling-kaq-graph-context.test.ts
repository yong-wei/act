import { describe, expect, it } from 'vitest';

import {
  buildKonlingGraphGroundingDegradedReasons,
  buildKonlingKaqGraphContext,
  projectKonlingGraphContextForRole,
} from '../konling-kaq-graph-context';
import type { KonlingCitationContext, KonlingPlanContext } from '../konling-agent-runtime';

function citationContext(): KonlingCitationContext {
  return {
    required: true,
    contentCitations: [{
      id: 'content:control-correction',
      sourceType: 'content',
      owner: 'answer',
      displayTitle: 'Root locus guidance',
      href: '/course-runtime/root-locus',
      confidence: 'high',
      evidenceBasis: 'server citation',
    }],
    evidenceCitations: [{
      id: 'LearningPathExecution:exec-1',
      sourceType: 'path-execution',
      owner: 'recommendation',
      displayTitle: 'Path execution',
      href: '/learning-paths/path-1',
      confidence: 'high',
      evidenceBasis: 'path execution record',
    }],
    missingCitationClasses: [],
    lowConfidenceReasons: [],
    responseProtocol: {
      requiredOwners: ['answer', 'recommendation'],
      minimum: {
        content: 1,
        evidenceWhenAvailable: 1,
      },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}

function planContext(): KonlingPlanContext {
  return {
    currentPathId: 'path-1',
    activeNodeId: 'node-1',
    nextNodeIds: ['node-2'],
    recentPathIds: ['path-0'],
    completedNodeIds: ['node-0'],
    pathOptions: [{
      styleId: 'guided',
      policyFamily: 'guided-remediation',
      label: 'Guided path',
      nodeIds: ['node-1', 'node-2'],
      targetDeficits: ['root locus'],
      evidenceBasis: ['LearningPathExecution:exec-1'],
      lockedNodeIds: [],
      readinessSummary: [],
      resourceMix: { lesson: 1 },
      effort: { estimatedMinutes: 20, relative: 'short' },
      terminalValidationNodeIds: ['node-2'],
      limitations: [],
    }],
    selectionHistory: [],
    status: 'available',
  };
}

function learnerOverlay() {
  return {
    status: 'available',
    learnerId: 'student-1',
    generatedAt: '2026-06-21T00:00:00.000Z',
    items: {
      'cap:autocontrol:synthesize-controller-correction': {
        domain: 'capability',
        nodeId: 'cap:autocontrol:synthesize-controller-correction',
        learnerId: 'student-1',
        state: 'developing',
        score: 0.62,
        confidence: 0.8,
        evidenceCount: 1,
        lastEvidenceAt: '2026-06-21T00:00:00.000Z',
        evidenceRefs: [{
          sourceType: 'LearningPathExecution',
          sourceId: 'exec-1',
          evidenceAt: '2026-06-21T00:00:00.000Z',
          confidence: 'verified',
          privacyLevel: 'student-visible',
        }],
        reasonCode: 'targeted-practice',
        evidenceWindow: { from: null, to: null, freshness: 'fresh' },
        sourceCoverage: null,
        verifiedCitationRefs: ['LearningPathExecution:exec-1'],
        recommendation: {
          label: 'Practice controller correction',
          reasonCode: 'targeted-practice',
          rationale: {
            targetRequirement: 'controller correction',
            observedMastery: 'developing',
            resourceCoverage: 'available',
            pathContext: 'current path',
          },
          sourceCoverage: null,
          evidenceWindow: { from: null, to: null, freshness: 'fresh' },
          confidence: 0.8,
          verifiedCitationRefs: ['LearningPathExecution:exec-1'],
          limitations: [],
        },
        limitations: [],
      },
    },
    limitations: [],
  } as const;
}

function lowConfidenceLearnerOverlay() {
  const overlay = learnerOverlay();
  return {
    ...overlay,
    status: 'low-confidence',
    items: Object.fromEntries(Object.entries(overlay.items).map(([nodeId, item]) => [
      nodeId,
      {
        ...item,
        confidence: 0.2,
        limitations: [],
      },
    ])),
    limitations: [{
      code: 'learner-overlay-low-confidence',
      message: '当前学习者图谱 overlay 证据不足，仅可作为补证提示。',
    }],
  } as const;
}

describe('Konling K/A/Q graph context', () => {
  it('assembles complete server-owned graph context from canonical LearningGoal sources', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      selectedGraphNodeIds: ['cap:autocontrol:synthesize-controller-correction'],
      learnerOverlay: learnerOverlay() as never,
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(context.status).toBe('complete');
    expect(context.learningGoal).toMatchObject({
      id: 'control-correction',
      version: expect.any(String),
    });
    expect(context.expandedSubgraph?.learningGoalId).toBe('control-correction');
    expect(context.selectedGraphNodeIds).toEqual(['cap:autocontrol:synthesize-controller-correction']);
    expect(context.resourceCoverage['cap:autocontrol:synthesize-controller-correction']).toBeDefined();
    expect(context.citationRefs).toEqual(expect.arrayContaining([
      'content:control-correction',
      'LearningPathExecution:exec-1',
    ]));
    expect(context.evidenceRefs).toEqual(expect.arrayContaining([
      'LearningPathExecution:exec-1',
    ]));
    expect(context.missingGrounding).toEqual([]);
    expect(context.advisoryOnly).toBe(true);
  });

  it('returns missing-grounding limitations instead of treating generic advice as graph-grounded', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'unknown-course',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      planContext: { ...planContext(), status: 'missing', currentPathId: null },
      citationContext: { ...citationContext(), contentCitations: [], evidenceCitations: [] },
    });

    expect(context.status).toBe('missing');
    expect(context.missingGrounding.map((item) => item.class)).toEqual(expect.arrayContaining([
      'learning-goal',
      'graph',
      'overlay',
      'resource',
      'path',
      'citation',
      'version',
    ]));
    expect(buildKonlingGraphGroundingDegradedReasons(context)).toEqual(expect.arrayContaining([
      'missing-graph-grounding:learning-goal',
      'missing-graph-grounding:graph',
    ]));
  });

  it('marks citation grounding missing when required citation classes are absent', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      learnerOverlay: learnerOverlay() as never,
      planContext: planContext(),
      citationContext: {
        ...citationContext(),
        missingCitationClasses: ['path-execution'],
      },
    });

    expect(context.citationRefs).toContain('content:control-correction');
    expect(context.missingGrounding).toEqual(expect.arrayContaining([
      expect.objectContaining({
        class: 'citation',
        reason: 'citation-refs-missing',
      }),
    ]));
  });

  it('preserves low-confidence learner overlay degradation', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      selectedGraphNodeIds: ['cap:autocontrol:synthesize-controller-correction'],
      learnerOverlay: lowConfidenceLearnerOverlay() as never,
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(context.learnerOverlay?.status).toBe('low-confidence');
    expect(context.status).toBe('degraded');
    expect(context.confidence).toBe('medium');
    expect(context.missingGrounding).toEqual(expect.arrayContaining([
      expect.objectContaining({
        class: 'overlay',
        reason: 'learner-or-class-overlay-missing',
      }),
    ]));
  });

  it('does not let client hints expand graph node or resource scope', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      selectedGraphNodeIds: [
        'cap:autocontrol:synthesize-controller-correction',
        'kn:autocontrol:forged-node',
      ],
      clientHints: {
        selectedGraphNodeIds: ['kn:autocontrol:forged-node'],
        resourceIds: ['resource-forged'],
      },
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(context.selectedGraphNodeIds).toEqual(['cap:autocontrol:synthesize-controller-correction']);
    expect(context.resourceCoverage).not.toHaveProperty('kn:autocontrol:forged-node');
    expect(context.clientHintsAccepted).toEqual([]);
    expect(context.clientHintsRejected).toEqual(['selectedGraphNodeIds', 'resourceIds']);
  });

  it('accepts a signed path-advisor graph node hint only when it belongs to the learning goal subgraph', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      clientHints: {
        graphNodeId: 'kn:autocontrol:controller-correction',
      },
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(context.selectedGraphNodeIds).toEqual(['kn:autocontrol:controller-correction']);
    expect(context.clientHintsAccepted).toEqual(['graphNodeId']);
    expect(context.clientHintsRejected).toEqual([]);

    const outsideGoalContext = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'student',
        targetUserId: 'student-1',
        classId: null,
      },
      clientHints: {
        graphNodeId: 'kn:autocontrol:forged-node',
      },
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(outsideGoalContext.selectedGraphNodeIds).toEqual([]);
    expect(outsideGoalContext.clientHintsAccepted).toEqual([]);
    expect(outsideGoalContext.clientHintsRejected).toEqual(['graphNodeId']);
  });

  it('projects class overlay out of student-visible graph context', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'teacher',
        targetUserId: 'student-1',
        classId: 'class-1',
      },
      learnerOverlay: learnerOverlay() as never,
      classOverlay: {
        status: 'available',
        classId: 'class-1',
        items: {
          'cap:autocontrol:synthesize-controller-correction': {
            domain: 'capability',
            nodeId: 'cap:autocontrol:synthesize-controller-correction',
            classId: 'class-1',
            distribution: {
              mastered: 1,
              developing: 2,
              weak: 1,
              'not-started': 0,
              'evidence-needed': 0,
            },
            averageScore: 0.68,
            confidence: 0.7,
            commonIssueCodes: ['targeted-practice'],
            denominator: 4,
            includedPopulation: 4,
            excludedPopulation: 0,
            suppressionReason: 'none',
            roundingPolicy: { minimumDenominator: 3, increment: 1 },
          },
        },
        limitations: [],
      } as never,
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(context.classOverlay?.status).toBe('available');
    const studentProjection = projectKonlingGraphContextForRole(context, 'student');
    expect(studentProjection.classOverlay).toMatchObject({
      status: 'unauthorized',
      classId: null,
      items: {},
    });
    expect(studentProjection.status).toBe('complete');
    expect(studentProjection.confidence).toBe('high');
    expect(studentProjection.missingGrounding).toEqual([]);
  });

  it('degrades student projection when class overlay was the only usable overlay', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'teacher',
        targetUserId: 'teacher-1',
        classId: 'class-1',
      },
      classOverlay: {
        status: 'available',
        classId: 'class-1',
        items: {
          'cap:autocontrol:synthesize-controller-correction': {
            domain: 'capability',
            nodeId: 'cap:autocontrol:synthesize-controller-correction',
            classId: 'class-1',
            distribution: {
              mastered: 1,
              developing: 2,
              weak: 1,
              'not-started': 0,
              'evidence-needed': 0,
            },
            averageScore: 0.68,
            confidence: 0.7,
            commonIssueCodes: ['targeted-practice'],
            denominator: 4,
            includedPopulation: 4,
            excludedPopulation: 0,
            suppressionReason: 'none',
            roundingPolicy: { minimumDenominator: 3, increment: 1 },
          },
        },
        limitations: [],
      } as never,
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(context.status).toBe('complete');
    const studentProjection = projectKonlingGraphContextForRole(context, 'student');
    expect(studentProjection.classOverlay).toMatchObject({
      status: 'unauthorized',
      classId: null,
      items: {},
    });
    expect(studentProjection.status).toBe('degraded');
    expect(studentProjection.confidence).toBe('medium');
    expect(studentProjection.missingGrounding).toEqual(expect.arrayContaining([
      expect.objectContaining({
        class: 'overlay',
        reason: 'class-overlay-removed-from-student-projection',
      }),
    ]));
  });

  it('does not mark class overlay available when filtered target items are suppressed', () => {
    const context = buildKonlingKaqGraphContext({
      scope: {
        courseId: 'control-correction',
        role: 'teacher',
        targetUserId: 'teacher-1',
        classId: 'class-1',
      },
      classOverlay: {
        status: 'available',
        classId: 'class-1',
        items: {
          'cap:autocontrol:synthesize-controller-correction': {
            domain: 'capability',
            nodeId: 'cap:autocontrol:synthesize-controller-correction',
            classId: 'class-1',
            distribution: {
              mastered: 0,
              developing: 1,
              weak: 0,
              'not-started': 0,
              'evidence-needed': 0,
            },
            averageScore: null,
            confidence: 0,
            commonIssueCodes: [],
            denominator: 1,
            includedPopulation: 1,
            excludedPopulation: 0,
            suppressionReason: 'low-denominator',
            roundingPolicy: { minimumDenominator: 3, increment: 1 },
          },
        },
        limitations: [],
      } as never,
      planContext: planContext(),
      citationContext: citationContext(),
    });

    expect(context.classOverlay?.status).toBe('suppressed');
    expect(context.missingGrounding).toEqual(expect.arrayContaining([
      expect.objectContaining({
        class: 'overlay',
        reason: 'learner-or-class-overlay-missing',
      }),
    ]));
  });
});
