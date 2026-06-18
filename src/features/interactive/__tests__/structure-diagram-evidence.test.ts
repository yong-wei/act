import { describe, expect, it } from 'vitest';

import {
  STRUCTURE_DIAGRAM_DIAGNOSTIC_POLICY,
  STRUCTURE_DIAGRAM_EVIDENCE_SCHEMA_VERSION,
  buildStructureDiagramClientEvidenceDraft,
  buildStructureDiagramEvidenceSample,
  buildStructureDiagramTeacherDiagnostics,
  canViewStructureDiagramTeacherDiagnostics,
  materializeStructureDiagramEvidenceSample,
  type StructureDiagramEvidenceClassification,
} from '@/features/interactive/shared/manifest-runtime/structure-diagram-evidence';

describe('structure diagram evidence contract', () => {
  it('builds graph submission evidence with trusted source log and teaching labels', () => {
    const sample = buildStructureDiagramEvidenceSample({
      eventType: 'graph_submit',
      clientEventId: 'client-structure-1',
      attemptKey: 'step-04:student-a:attempt-1',
      sourceLogId: 'trusted-structure-log-1',
      lessonKey: 'structure-diagram-fixture',
      stepId: 'step-04',
      moduleId: 'signal-flow-graph',
      componentKind: 'visual.signalFlowGraph',
      componentId: 'closed-loop-signal-flow',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'dark',
      viewport: 'desktop',
      graphId: 'closed-loop-signal-flow',
      activeRevealState: 'loop-reveal',
      selectedNodeIds: ['theta'],
      selectedPathIds: ['forward-path-1'],
      selectedLoopIds: ['feedback-loop-1'],
      constructedPositions: [
        { nodeId: 'theta', x: 0.42, y: 0.5 },
      ],
      constructedConnections: [
        { from: 'output', to: 'theta', branchId: 'h-feedback', gainLabel: '-H(s)' },
      ],
      connectionDifferences: [
        { kind: 'missing', from: 'input', to: 'theta', label: '漏连前向支路' },
      ],
      teachingLabels: {
        theta: '中间变量 θ',
        'forward-path-1': '前向路径 P1',
        'feedback-loop-1': '反馈环路 L1',
        'h-feedback': '反馈支路 -H(s)',
      },
      feedback: {
        misconceptionTagIds: ['missed-forward-branch'],
        studentFeedbackMode: 'hint',
        teacherNextPrompt: '请学生先标出前向路径，再判断反馈环。',
        reviewAction: 'retry',
      },
      classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
      serverRecordedAt: '2026-06-18T00:00:01.000Z',
    });

    expect(sample).toMatchObject({
      eventType: 'graph_submit',
      sourceLogId: 'trusted-structure-log-1',
      lessonKey: 'structure-diagram-fixture',
      stepId: 'step-04',
      moduleId: 'signal-flow-graph',
      componentKind: 'visual.signalFlowGraph',
      componentId: 'closed-loop-signal-flow',
      schemaVersion: STRUCTURE_DIAGRAM_EVIDENCE_SCHEMA_VERSION,
      serverRecordedAt: '2026-06-18T00:00:01.000Z',
      classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
      affectsTeacherDiagnostics: true,
      affectsAbilitySnapshots: true,
      affectsRecommendationInputs: true,
      payload: {
        graphId: 'closed-loop-signal-flow',
        activeRevealState: 'loop-reveal',
        selectedNodeIds: ['theta'],
        selectedPathIds: ['forward-path-1'],
        selectedLoopIds: ['feedback-loop-1'],
        classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
    });
    expect(sample.payload.teachingLabels.theta).toBe('中间变量 θ');
    expect(sample.payload.connectionDifferences[0]).toMatchObject({
      kind: 'missing',
      label: '漏连前向支路',
    });
  });

  it('keeps trusted source log and server timestamp server-side', () => {
    const draft = buildStructureDiagramClientEvidenceDraft({
      eventType: 'graph_select',
      clientEventId: 'client-structure-2',
      attemptKey: 'step-04:student-a:attempt-1',
      lessonKey: 'structure-diagram-fixture',
      stepId: 'step-04',
      moduleId: 'block-diagram',
      componentKind: 'visual.blockDiagram',
      componentId: 'closed-loop-block-diagram',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'mobile',
      graphId: 'closed-loop-block-diagram',
      activeRevealState: 'feedback-loop',
      selectedNodeIds: ['sum'],
      selectedPathIds: [],
      selectedLoopIds: ['feedback-loop'],
      constructedPositions: [],
      constructedConnections: [],
      connectionDifferences: [],
      teachingLabels: {
        sum: '求和点',
        'feedback-loop': '反馈回路',
      },
    });

    expect('sourceLogId' in draft).toBe(false);
    expect(draft.payload.serverRecordedAt).toBeNull();

    const materialized = materializeStructureDiagramEvidenceSample({
      draft,
      trustedSourceLogId: 'trusted-structure-log-2',
      serverRecordedAt: '2026-06-18T00:00:02.000Z',
    });

    expect(materialized.sourceLogId).toBe('trusted-structure-log-2');
    expect(materialized.payload.serverRecordedAt).toBe('2026-06-18T00:00:02.000Z');
  });

  it('defaults graph submissions to StudentStepResponse instead of passive evidence', () => {
    const draft = buildStructureDiagramClientEvidenceDraft({
      eventType: 'graph_submit',
      clientEventId: 'client-structure-submit-default',
      attemptKey: 'step-04:student-a:attempt-2',
      lessonKey: 'structure-diagram-fixture',
      stepId: 'step-04',
      moduleId: 'signal-flow-graph',
      componentKind: 'visual.signalFlowGraph',
      componentId: 'closed-loop-signal-flow',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'desktop',
      graphId: 'closed-loop-signal-flow',
      activeRevealState: 'loop-reveal',
      selectedNodeIds: ['theta'],
      selectedPathIds: ['forward-path-1'],
      selectedLoopIds: ['feedback-loop-1'],
      constructedPositions: [],
      constructedConnections: [],
      connectionDifferences: [],
      teachingLabels: {
        theta: '中间变量 θ',
      },
    });

    expect(draft.payload.classification).toEqual(['InteractionLog', 'StudentStepResponse']);
    expect(draft.classification).toEqual(['InteractionLog', 'StudentStepResponse']);
    expect(draft.affectsTeacherDiagnostics).toBe(true);
    expect(draft.affectsAbilitySnapshots).toBe(false);
  });

  it('keeps diagnostic policy and access helpers aligned with governance artifacts', () => {
    expect(STRUCTURE_DIAGRAM_DIAGNOSTIC_POLICY).toMatchObject({
      denominator: 'latest-attempt-per-student',
      dedupeKey: 'actorId:lessonKey:stepId:moduleId:attemptKey',
      attemptPolicy: 'latest-visible-graph-state-with-resubmission-history',
      resubmissionDisplay: 'latest-with-history-count',
      unreleasedStudentInclusion: 'include-as-unreleased-unvisited',
      freeTextRedaction: 'redact-by-default',
      access: 'teacher-admin-only',
      labelsUseTeachingSemantics: true,
    });
    expect(canViewStructureDiagramTeacherDiagnostics('teacher')).toBe(true);
    expect(canViewStructureDiagramTeacherDiagnostics('admin')).toBe(true);
    expect(canViewStructureDiagramTeacherDiagnostics('student')).toBe(false);
    expect(canViewStructureDiagramTeacherDiagnostics('guest')).toBe(false);
  });

  it('rejects graph submissions that omit StudentStepResponse classification', () => {
    expect(() => buildStructureDiagramEvidenceSample({
      ...structureEvidenceBase(),
      eventType: 'graph_submit',
      classification: ['InteractionLog'] as StructureDiagramEvidenceClassification[],
    })).toThrow('graph_submit evidence must include StudentStepResponse classification');
  });

  it('rejects mastery classification for passive view, select, and teacher reveal events', () => {
    const passiveBase = {
      ...structureEvidenceBase(),
      classification: ['InteractionLog', 'LearningFact'] as StructureDiagramEvidenceClassification[],
    };

    expect(() => buildStructureDiagramEvidenceSample({
      ...passiveBase,
      eventType: 'graph_view',
    })).toThrow('graph_view evidence cannot be classified as LearningFact');
    expect(() => buildStructureDiagramEvidenceSample({
      ...passiveBase,
      eventType: 'graph_select',
    })).toThrow('graph_select evidence cannot be classified as LearningFact');
    expect(() => buildStructureDiagramEvidenceSample({
      ...passiveBase,
      actorRole: 'teacher',
      eventType: 'teacher_reveal',
    })).toThrow('teacher_reveal evidence cannot be classified as LearningFact');
  });

  it('summarizes diagnostics with teaching labels, construction deltas, and reveal coverage', () => {
    const diagnostics = buildStructureDiagramTeacherDiagnostics([
      {
        actorId: 'student-a',
        actorRole: 'student',
        lessonKey: 'structure-diagram-fixture',
        stepId: 'step-04',
        moduleId: 'signal-flow-graph',
        graphId: 'closed-loop-signal-flow',
        viewed: true,
        submitted: false,
        activeRevealState: 'path-reveal',
        selectedNodeIds: ['theta'],
        selectedPathIds: ['forward-path-1'],
        selectedLoopIds: [],
        connectionDifferences: [],
        teachingLabels: {
          theta: '中间变量 θ',
          'forward-path-1': '前向路径 P1',
        },
        misconceptionTagIds: [],
        attemptKey: 'student-a:1',
        clientEventId: 'event-a',
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
      {
        actorId: 'student-b',
        actorRole: 'student',
        lessonKey: 'structure-diagram-fixture',
        stepId: 'step-04',
        moduleId: 'signal-flow-graph',
        graphId: 'closed-loop-signal-flow',
        viewed: true,
        submitted: true,
        activeRevealState: 'loop-reveal',
        selectedNodeIds: ['theta'],
        selectedPathIds: ['forward-path-1'],
        selectedLoopIds: ['feedback-loop-1'],
        connectionDifferences: [
          { kind: 'extra', from: 'output', to: 'input', label: '多连输出回输入' },
        ],
        teachingLabels: {
          theta: '中间变量 θ',
          'feedback-loop-1': '反馈环路 L1',
        },
        misconceptionTagIds: ['extra-return-edge'],
        attemptKey: 'student-b:1',
        clientEventId: 'event-b',
        serverRecordedAt: '2026-06-18T00:00:02.000Z',
      },
    ], ['path-reveal', 'loop-reveal']);

    expect(diagnostics).toEqual({
      policy: STRUCTURE_DIAGRAM_DIAGNOSTIC_POLICY,
      viewedCount: 2,
      submittedCount: 1,
      revealStateDistribution: [
        { revealState: 'loop-reveal', label: 'loop-reveal', count: 1 },
        { revealState: 'path-reveal', label: 'path-reveal', count: 1 },
      ],
      unvisitedRevealStateCount: 0,
      selectedNodeDistribution: [
        { nodeId: 'theta', label: '中间变量 θ', count: 2 },
      ],
      selectedPathDistribution: [
        { pathId: 'forward-path-1', label: '前向路径 P1', count: 2 },
      ],
      selectedLoopDistribution: [
        { loopId: 'feedback-loop-1', label: '反馈环路 L1', count: 1 },
      ],
      connectionDifferenceDistribution: [
        { kind: 'extra', label: '多连输出回输入', count: 1 },
      ],
      misconceptionDistribution: [
        { misconceptionTagId: 'extra-return-edge', count: 1 },
      ],
      latestAttemptKeys: ['student-a:1', 'student-b:1'],
    });
  });

  it('deduplicates diagnostics by declared actor lesson step module attempt key', () => {
    const diagnostics = buildStructureDiagramTeacherDiagnostics([
      {
        ...diagnosticEventBase(),
        actorId: 'student-a',
        moduleId: 'block-diagram',
        attemptKey: 'student-a:block:1',
        selectedNodeIds: ['sum'],
        teachingLabels: { sum: '求和点' },
        clientEventId: 'event-a-block',
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
      {
        ...diagnosticEventBase(),
        actorId: 'student-a',
        moduleId: 'signal-flow-graph',
        attemptKey: 'student-a:signal:1',
        selectedNodeIds: ['theta'],
        selectedPathIds: ['forward-path-1'],
        teachingLabels: {
          theta: '中间变量 θ',
          'forward-path-1': '前向路径 P1',
        },
        clientEventId: 'event-a-signal',
        serverRecordedAt: '2026-06-18T00:00:02.000Z',
      },
    ], ['path-reveal']);

    expect(diagnostics.viewedCount).toBe(2);
    expect(diagnostics.latestAttemptKeys).toEqual(['student-a:block:1', 'student-a:signal:1']);
    expect(diagnostics.selectedNodeDistribution).toEqual([
      { nodeId: 'sum', label: '求和点', count: 1 },
      { nodeId: 'theta', label: '中间变量 θ', count: 1 },
    ]);
    expect(diagnostics.selectedPathDistribution).toEqual([
      { pathId: 'forward-path-1', label: '前向路径 P1', count: 1 },
    ]);
  });
});

function structureEvidenceBase() {
  return {
    clientEventId: 'client-structure-base',
    attemptKey: 'step-04:student-a:attempt-base',
    sourceLogId: 'trusted-structure-log-base',
    lessonKey: 'structure-diagram-fixture',
    stepId: 'step-04',
    moduleId: 'signal-flow-graph',
    componentKind: 'visual.signalFlowGraph' as const,
    componentId: 'closed-loop-signal-flow',
    actorRole: 'student' as const,
    clientEventAt: '2026-06-18T00:00:00.000Z',
    theme: 'light' as const,
    viewport: 'desktop' as const,
    graphId: 'closed-loop-signal-flow',
    activeRevealState: 'loop-reveal',
    selectedNodeIds: ['theta'],
    selectedPathIds: ['forward-path-1'],
    selectedLoopIds: ['feedback-loop-1'],
    constructedPositions: [],
    constructedConnections: [],
    connectionDifferences: [],
    teachingLabels: {
      theta: '中间变量 θ',
    },
  };
}

function diagnosticEventBase() {
  return {
    actorId: 'student-a',
    actorRole: 'student' as const,
    lessonKey: 'structure-diagram-fixture',
    stepId: 'step-04',
    moduleId: 'signal-flow-graph',
    graphId: 'closed-loop-signal-flow',
    viewed: true,
    submitted: false,
    activeRevealState: 'path-reveal',
    selectedNodeIds: [],
    selectedPathIds: [],
    selectedLoopIds: [],
    connectionDifferences: [],
    teachingLabels: {},
    misconceptionTagIds: [],
    attemptKey: 'student-a:1',
    clientEventId: 'event-base',
  };
}
