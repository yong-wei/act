import { describe, expect, it } from 'vitest';

import {
  VISUAL_STAGE_DIAGNOSTIC_POLICY,
  VISUAL_STAGE_EVIDENCE_SCHEMA_VERSION,
  buildVisualStageClientEvidenceDraft,
  buildVisualStageEvidenceSample,
  buildVisualStageTeacherDiagnostics,
  materializeVisualStageEvidenceSample,
} from '@/features/interactive/shared/manifest-runtime/visual-stage-evidence';

describe('visual stage evidence contract', () => {
  it('builds lifecycle evidence with trusted source log and stage payload fields', () => {
    const sample = buildVisualStageEvidenceSample({
      eventType: 'stage_reveal',
      clientEventId: 'client-stage-1',
      attemptKey: 'step-02:stage-1',
      sourceLogId: 'trusted-stage-log-1',
      lessonKey: 'visual-stage-runtime-fixture',
      stepId: 'step-02',
      moduleId: 'root-locus-stage',
      componentId: 'root-locus-stage',
      actorRole: 'teacher',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'dark',
      viewport: 'projection',
      stageId: 'root-locus-reading-stage',
      releaseState: 'revealed',
      visibleLayerIds: ['plant-diagram', 'formula-callout'],
      activeRevealState: 'answer',
      targetLayerIds: ['formula-callout'],
      previousRevealState: 'intro',
      nextRevealState: 'answer',
      activityAnchors: ['stability-observation'],
      classification: ['InteractionLog'],
      serverRecordedAt: '2026-06-18T00:00:01.000Z',
    });

    expect(sample).toMatchObject({
      eventType: 'stage_reveal',
      clientEventId: 'client-stage-1',
      attemptKey: 'step-02:stage-1',
      sourceLogId: 'trusted-stage-log-1',
      lessonKey: 'visual-stage-runtime-fixture',
      stepId: 'step-02',
      moduleId: 'root-locus-stage',
      componentKind: 'visual.stage',
      componentId: 'root-locus-stage',
      actorRole: 'teacher',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'dark',
      viewport: 'projection',
      schemaVersion: VISUAL_STAGE_EVIDENCE_SCHEMA_VERSION,
      payload: {
        theme: 'dark',
        viewport: 'projection',
        stageId: 'root-locus-reading-stage',
        releaseState: 'revealed',
        visibleLayerIds: ['plant-diagram', 'formula-callout'],
        activeRevealState: 'answer',
        targetLayerIds: ['formula-callout'],
        previousRevealState: 'intro',
        nextRevealState: 'answer',
        activityAnchors: ['stability-observation'],
        classification: ['InteractionLog'],
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
    });
  });

  it('keeps source log and server timestamp materialization server-side', () => {
    const draft = buildVisualStageClientEvidenceDraft({
      eventType: 'stage_view',
      clientEventId: 'client-stage-2',
      attemptKey: 'step-02:stage-1',
      lessonKey: 'visual-stage-runtime-fixture',
      stepId: 'step-02',
      moduleId: 'root-locus-stage',
      componentId: 'root-locus-stage',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'desktop',
      stageId: 'root-locus-reading-stage',
      releaseState: 'released',
      visibleLayerIds: ['plant-diagram'],
      activeRevealState: 'intro',
      activityAnchors: ['stability-observation'],
    });

    expect('sourceLogId' in draft).toBe(false);
    expect(draft.payload.serverRecordedAt).toBeNull();

    const materialized = materializeVisualStageEvidenceSample({
      draft,
      trustedSourceLogId: 'trusted-stage-log-2',
      serverRecordedAt: '2026-06-18T00:00:02.000Z',
    });

    expect(materialized.sourceLogId).toBe('trusted-stage-log-2');
    expect(materialized.payload.serverRecordedAt).toBe('2026-06-18T00:00:02.000Z');
  });

  it('rejects mastery classification for passive view and reveal events', () => {
    expect(() => buildVisualStageEvidenceSample({
      eventType: 'stage_view',
      clientEventId: 'client-stage-3',
      attemptKey: 'step-02:stage-1',
      sourceLogId: 'trusted-stage-log-3',
      lessonKey: 'visual-stage-runtime-fixture',
      stepId: 'step-02',
      moduleId: 'root-locus-stage',
      componentId: 'root-locus-stage',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'mobile',
      stageId: 'root-locus-reading-stage',
      releaseState: 'released',
      visibleLayerIds: ['plant-diagram'],
      classification: ['InteractionLog', 'LearningFact'],
    })).toThrow('stage_view evidence cannot be classified as LearningFact');

    expect(() => buildVisualStageEvidenceSample({
      eventType: 'stage_reveal',
      clientEventId: 'client-stage-4',
      attemptKey: 'step-02:stage-1',
      sourceLogId: 'trusted-stage-log-4',
      lessonKey: 'visual-stage-runtime-fixture',
      stepId: 'step-02',
      moduleId: 'root-locus-stage',
      componentId: 'root-locus-stage',
      actorRole: 'teacher',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'dark',
      viewport: 'projection',
      stageId: 'root-locus-reading-stage',
      releaseState: 'revealed',
      visibleLayerIds: ['plant-diagram'],
      classification: ['InteractionLog', 'LearningFact'],
    })).toThrow('stage_reveal evidence cannot be classified as LearningFact');
  });

  it('summarizes teacher diagnostics with viewed, released, reveal state, and activity anchors', () => {
    const diagnostics = buildVisualStageTeacherDiagnostics([
      {
        actorId: 'student-a',
        actorRole: 'student',
        lessonKey: 'visual-stage-runtime-fixture',
        stepId: 'step-02',
        moduleId: 'root-locus-stage',
        viewed: true,
        theme: 'light',
        viewport: 'desktop',
        releaseState: 'released',
        activeRevealState: 'intro',
        visibleLayerIds: ['plant-diagram'],
        activityAnchors: ['stability-observation'],
        attemptKey: 'student-a:1',
        clientEventId: 'event-a',
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
      {
        actorId: 'student-b',
        actorRole: 'student',
        lessonKey: 'visual-stage-runtime-fixture',
        stepId: 'step-02',
        moduleId: 'root-locus-stage',
        viewed: true,
        theme: 'dark',
        viewport: 'projection',
        releaseState: 'revealed',
        activeRevealState: 'answer',
        visibleLayerIds: ['plant-diagram', 'formula-callout'],
        activityAnchors: ['stability-observation'],
        attemptKey: 'student-b:1',
        clientEventId: 'event-b',
        serverRecordedAt: '2026-06-18T00:00:02.000Z',
      },
    ]);

    expect(diagnostics).toEqual({
      policy: VISUAL_STAGE_DIAGNOSTIC_POLICY,
      viewedCount: 2,
      releasedCount: 2,
      currentRevealState: 'answer',
      visibleLayerCoverage: [
        { layerId: 'formula-callout', count: 1 },
        { layerId: 'plant-diagram', count: 2 },
      ],
      activityAnchorCoverage: [
        { activityAnchor: 'stability-observation', count: 2 },
      ],
      latestAttemptKeys: ['student-a:1', 'student-b:1'],
    });
  });
});
