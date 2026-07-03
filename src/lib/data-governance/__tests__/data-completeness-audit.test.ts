import { describe, expect, it } from 'vitest';

import { buildResourceNodeRegistry } from '@/lib/resource-node-registry';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import {
  buildDataCompletenessAuditReport,
  renderDataCompletenessAuditMarkdown,
} from '../data-completeness-audit';

describe('data completeness audit', () => {
  it('reports graph, resource, citation, path, lineage, and learner readiness separately', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'sim-controller',
        label: 'Controller tuning simulation',
        type: 'SIMULATION_APP',
        launchTarget: '/sim/controller',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          evidenceInstrumentation: ['InteractionLog:simulation_finish'],
          privacyLevel: 'student-visible',
          readiness: {
            minimumCompetency: {},
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            unlockMessage: 'Ready for controlled simulation.',
            fallbackNodeIds: [],
          },
        },
      }],
    });

    const report = buildDataCompletenessAuditReport({
      generatedAt: '2026-07-02T00:00:00.000Z',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'controller correction',
        description: 'Controller correction concept.',
        tags: ['correction'],
        resources: ['resource:sim-controller'],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      teachingResources: [{
        id: 'resource-1',
        title: 'Controller resource',
        registryId: 'sim-controller',
        knowledgeNodeIds: ['kn-controller'],
      }],
      resourceRegistry: registry,
      evidenceCorpus: [],
      interactionLogs: [],
      eventDictionaryTypes: [],
      learningEventBatches: [],
      learningFacts: [],
      learnerCandidates: [],
    });

    expect(report.layers.map((layer) => layer.id)).toEqual([
      'graphCore',
      'resourceBinding',
      'citationReadiness',
      'pathReadiness',
      'evidenceLineage',
      'learnerFixtureReadiness',
    ]);
    expect(report.layers.find((layer) => layer.id === 'citationReadiness')?.totals).toMatchObject({
      citationTargets: 1,
      resolvableCitationTargets: 1,
    });
    expect(report.layers.find((layer) => layer.id === 'pathReadiness')?.totals).toMatchObject({
      resourceNodes: 1,
      planningUnits: 1,
    });
    expect(report).not.toHaveProperty('score');
  });

  it('reports declared TeachingResource registryIds that are not registered', () => {
    const teachingResources = [{
      id: 'resource-typo',
      title: 'Typo resource',
      type: 'INTERACTIVE_COMP',
      registryId: 'sim-controller-typo',
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        resources: [],
        tags: ['correction'],
      }],
    }];
    const registry = buildResourceNodeRegistryFromTeachingResources(teachingResources, [{
      id: 'sim-controller',
      label: 'Controller tuning simulation',
      type: 'SIMULATION_APP',
      launchTarget: '/sim/controller',
      knowledgeNodeIds: ['kn-controller'],
    }]);
    const report = buildDataCompletenessAuditReport({
      teachingResources,
      resourceRegistry: registry,
    });

    const resourceBinding = report.layers.find((layer) => layer.id === 'resourceBinding');
    expect(resourceBinding?.severity).toBe('blocked');
    expect(resourceBinding?.totals.teachingResourcesUnregisteredRegistry).toBe(1);
    expect(resourceBinding?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'teaching-resource-registry-unregistered',
        stableRef: 'TeachingResource:resource-typo',
      }),
    ]));
  });

  it('does not treat non-path registry nodes as path readiness blockers', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'Controller correction',
        tags: ['correction'],
      }],
    });
    const report = buildDataCompletenessAuditReport({
      resourceRegistry: registry,
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    const pathReadiness = report.layers.find((layer) => layer.id === 'pathReadiness');
    expect(pathReadiness?.severity).toBe('advisory');
    expect(pathReadiness?.totals).toMatchObject({
      resourceNodes: 0,
      blockedPathNodes: 0,
    });
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
    expect(report.learnerFixture.blockers).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^pathReadiness:/),
      expect.stringMatching(/^resourceBinding:/),
    ]));
  });

  it('audits evidence lineage without exposing raw event payloads', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'log-1',
        userId: 'student-1',
        eventType: 'unknown_event',
        clientEventId: 'event-1',
        attemptKey: null,
        clientEventAt: null,
        createdAt: null,
      }, {
        id: 'log-2',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'event-1',
        attemptKey: 'attempt-1',
        createdAt: '2026-07-02T00:00:00.000Z',
      }, {
        id: 'log-3',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'event-3',
        attemptKey: 'attempt-3',
        createdAt: '2026-07-02T00:00:01.000Z',
      }, {
        id: 'log-4',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'event-4',
        attemptKey: 'attempt-4',
        createdAt: '2026-07-02T00:00:02.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningEventBatches: [{
        id: 'batch-1',
        eventCount: 2,
        processedAt: null,
      }],
      learningFacts: [{
        id: 'fact-1',
        userId: 'student-1',
        factType: 'simulation',
        sourceEventId: null,
        sourceLogId: null,
      }, {
        id: 'fact-2',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'missing-client-event',
        sourceLogId: 'missing-log',
      }, {
        id: 'fact-3',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'interaction-log:log-3',
        sourceLogId: 'log-3',
      }, {
        id: 'fact-4',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'historical:InteractionLog:log-4:lesson_submit',
        sourceLogId: 'log-4',
      }, {
        id: 'fact-5',
        userId: 'student-1',
        factType: 'design',
        sourceEventId: 'arena-official:publication-1:task-1:submission-1:user-1:artifact-1:terminal-validation',
        sourceLogId: 'submission-1',
      }, {
        id: 'fact-6',
        userId: 'student-1',
        factType: 'control_correction_path.selection_recorded',
        sourceEventId: 'control-correction-path:choice:path-1:event-1',
        sourceLogId: 'event-1',
      }, {
        id: 'fact-7',
        userId: 'student-1',
        factType: 'simulation',
        sourceEventId: 'simulation-agent-evidence:simulation_run:run-1:simulation-run-v1',
        sourceLogId: 'run-1',
      }, {
        id: 'fact-8',
        userId: 'student-1',
        factType: 'adaptive_assessment',
        sourceEventId: 'adaptive-assessment:answer-1',
        sourceLogId: 'adaptive-assessment:answer-1',
      }, {
        id: 'fact-9',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'historical:StudentStepResponse:response-1:lesson_submit',
        sourceLogId: 'response-1',
      }, {
        id: 'fact-10',
        userId: 'student-1',
        factType: 'arena_preview',
        sourceEventId: 'arena_simulation_run:run-1',
        sourceLogId: 'arena-preview-log',
        contextJson: { arena: { evaluationMode: 'preview' } },
      }],
      studentCompetencySnapshots: [],
      studentProfileSummaries: [],
      studentEvidenceFeatureCaches: [],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.severity).toBe('blocked');
    expect(lineage?.totals).toMatchObject({
      interactionLogsMissingClientEventId: 0,
      interactionLogsMissingAttemptKey: 1,
      interactionLogsMissingTimestamp: 1,
      duplicateClientEventIds: 1,
      eventDictionaryMappingMissing: 1,
      unprocessedLearningEventBatches: 1,
      unattributedLearningFacts: 1,
      danglingLearningFactSourceLogs: 1,
      danglingLearningFactSourceEvents: 1,
      usersMissingCompetencySnapshots: 1,
      usersMissingFeatureCaches: 1,
    });
    expect(JSON.stringify(report)).not.toContain('raw answer');
    expect(JSON.stringify(report)).not.toContain('eventData');
  });

  it('treats partial or missing feature cache source coverage as incomplete', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [{
        id: 'fact-partial-cache',
        userId: 'student-partial-cache',
        factType: 'question',
        sourceEventId: 'interaction-log:log-1',
        sourceLogId: 'log-1',
      }],
      studentCompetencySnapshots: [{ userId: 'student-partial-cache' }],
      studentProfileSummaries: [{ userId: 'student-partial-cache' }],
      studentEvidenceFeatureCaches: [{
        userId: 'student-partial-cache',
        sourceFactCount: 1,
        sourceCoverage: {
          LearningFact: 'partial',
          StudentStepResponse: 'missing',
        },
      }, {
        userId: 'student-mixed-cache',
        sourceFactCount: 2,
        sourceCoverage: {
          LearningFact: 'available',
          StudentCompetencySnapshot: 'missing',
        },
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.featureCachesMissingSourceCoverage).toBe(2);
    expect(lineage?.findings.filter((finding) =>
      finding.id === 'student-evidence-feature-cache-source-coverage-missing'
    )).toHaveLength(2);
  });

  it('matches bare clientEventId lineage by user instead of globally', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'log-student-1',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'shared-client-event',
        attemptKey: 'attempt-1',
        createdAt: '2026-07-02T00:00:00.000Z',
      }, {
        id: 'log-student-2',
        userId: 'student-2',
        eventType: 'lesson_submit',
        clientEventId: 'shared-client-event',
        attemptKey: 'attempt-2',
        createdAt: '2026-07-02T00:00:01.000Z',
      }, {
        id: 'log-student-1-duplicate',
        userId: 'student-1',
        eventType: 'lesson_submit',
        clientEventId: 'shared-client-event',
        attemptKey: 'attempt-3',
        createdAt: '2026-07-02T00:00:02.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningFacts: [{
        id: 'fact-same-user',
        userId: 'student-1',
        factType: 'question',
        sourceEventId: 'shared-client-event',
        sourceLogId: null,
      }, {
        id: 'fact-cross-user',
        userId: 'student-3',
        factType: 'question',
        sourceEventId: 'shared-client-event',
        sourceLogId: null,
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.duplicateClientEventIds).toBe(1);
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(1);
    expect(lineage?.findings.filter((finding) =>
      finding.id === 'interaction-log-client-event-id-duplicate'
    )).toHaveLength(1);
    const duplicateFinding = lineage?.findings.find((finding) =>
      finding.id === 'interaction-log-client-event-id-duplicate'
    );
    expect(duplicateFinding?.stableRef).toMatch(/^clientEventId:sha256:/);
    expect(duplicateFinding?.message).toContain('learner-scoped clientEventId');
    expect(lineage?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-cross-user',
      }),
    ]));
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learning-fact-source-event-dangling',
        stableRef: 'LearningFact:fact-same-user',
      }),
    ]));
    expect(JSON.stringify(report)).not.toContain('student-1:shared-client-event');
    expect(JSON.stringify(report)).not.toContain('student-2:shared-client-event');
  });

  it('treats governed historical materialization sources as valid external lineage', () => {
    const report = buildDataCompletenessAuditReport({
      learningFacts: [
        {
          id: 'fact-historical-simulation',
          userId: 'student-1',
          factType: 'simulation',
          sourceEventId: 'historical:SimulationLog:simulation-1:completed',
          sourceLogId: 'historical:SimulationLog:simulation-1',
        },
        {
          id: 'fact-historical-answer',
          userId: 'student-1',
          factType: 'answer',
          sourceEventId: 'historical:UserAnswer:answer-1:graded',
          sourceLogId: 'historical:UserAnswer:answer-1',
        },
        {
          id: 'fact-historical-ability',
          userId: 'student-1',
          factType: 'ability_assessment',
          sourceEventId: 'historical:AbilityAssessment:assessment-1:score',
          sourceLogId: 'historical:AbilityAssessment:assessment-1',
        },
        {
          id: 'fact-historical-prompt',
          userId: 'student-1',
          factType: 'prompt_assessment',
          sourceEventId: 'historical:PromptAssessment:prompt-1:rubric',
          sourceLogId: 'historical:PromptAssessment:prompt-1',
        },
        {
          id: 'fact-historical-design',
          userId: 'student-1',
          factType: 'design_session',
          sourceEventId: 'historical:DesignSession:design-1:checkpoint',
          sourceLogId: 'historical:DesignSession:design-1',
        },
        {
          id: 'fact-historical-arena',
          userId: 'student-1',
          factType: 'arena_submission',
          sourceEventId: 'historical:ArenaSubmission:submission-1:official',
          sourceLogId: 'historical:ArenaSubmission:submission-1',
        },
        {
          id: 'fact-historical-arena-evaluation',
          userId: 'student-1',
          factType: 'arena_evaluation',
          sourceEventId: 'historical:ArenaEvaluationRun:evaluation-1:official',
          sourceLogId: 'historical:ArenaEvaluationRun:evaluation-1',
        },
        {
          id: 'fact-legacy-migrated-simulation',
          userId: 'student-1',
          factType: 'simulation',
          sourceEventId: null,
          sourceLogId: 'simulation-log-legacy-1',
        },
        {
          id: 'fact-legacy-migrated-answer',
          userId: 'student-1',
          factType: 'question',
          sourceEventId: null,
          sourceLogId: 'user-answer-legacy-1',
        },
        {
          id: 'fact-legacy-migrated-ai-intervention',
          userId: 'student-1',
          factType: 'ai_intervention',
          sourceEventId: null,
          sourceLogId: 'ai-intervention-legacy-1',
        },
        {
          id: 'fact-legacy-migrated-prompt',
          userId: 'student-1',
          factType: 'prompt_design',
          sourceEventId: null,
          sourceLogId: 'prompt-assessment-legacy-1',
        },
      ],
      historicalSourceLogIds: [
        'simulation-log-legacy-1',
        'user-answer-legacy-1',
        'ai-intervention-legacy-1',
        'prompt-assessment-legacy-1',
      ],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.totals.danglingLearningFactSourceEvents).toBe(0);
    expect(lineage?.totals.danglingLearningFactSourceLogs).toBe(0);
    expect(lineage?.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'learning-fact-source-event-dangling' }),
      expect.objectContaining({ id: 'learning-fact-source-log-dangling' }),
    ]));
  });

  it('masks Yang Fan fixture identifiers and reports duplicates as diagnostics only', () => {
    const report = buildDataCompletenessAuditReport({
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [
        {
          userId: 'user-canonical',
          name: 'Yang Fan',
          email: 'yangfan@example.edu',
          studentNumber: '20230010102605',
          learningFactCount: 3,
          knowledgeProgressCount: 2,
          pathExecutionCount: 1,
          pathExecutionEvidenceRefCount: 1,
          competencySnapshotCount: 1,
          profileSummaryCount: 1,
          adaptiveAssessmentStateCount: 2,
          featureCache: {
            sourceFactCount: 3,
            sourceCoverage: { LearningFact: 'available' },
          },
        },
        {
          userId: 'user-duplicate',
          name: '杨帆',
          email: null,
          studentNumber: null,
        },
      ],
    });

    const serialized = JSON.stringify(report);
    expect(report.learnerFixture.canonical?.maskedUserId).toMatch(/^Learner:sha256:/);
    expect(report.learnerFixture.displayLabel).toBe('canonical-fixture-account');
    expect(report.learnerFixture.displayNameHash).toMatch(/^sha256:/);
    expect(report.learnerFixture.canonical?.adaptiveAssessmentStateCount).toBe(2);
    expect(report.learnerFixture.duplicates).toHaveLength(1);
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
    expect(serialized).not.toContain('Yang Fan');
    expect(serialized).not.toContain('yangfan@example.edu');
    expect(serialized).not.toContain('20230010102605');
    expect(serialized).not.toContain('user-canonical');
    expect(serialized).not.toContain('杨帆');
  });

  it('reports learner fixture state gaps beyond facts, cache, and path evidence', () => {
    const report = buildDataCompletenessAuditReport({
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 3,
        knowledgeProgressCount: 0,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 0,
        profileSummaryCount: 0,
        featureCache: {
          sourceFactCount: 3,
          sourceCoverage: { LearningFact: 'available' },
        },
        adaptiveAssessmentStateCount: 0,
      }],
    });

    const layer = report.layers.find((entry) => entry.id === 'learnerFixtureReadiness');
    expect(layer?.severity).toBe('partial');
    expect(layer?.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'fixture-knowledge-progress-missing',
      'fixture-competency-snapshot-missing',
      'fixture-profile-summary-missing',
      'fixture-adaptive-assessment-state-missing',
    ]));
    expect(report.followupBuckets).toEqual(expect.arrayContaining([
      'refresh-competency-snapshots',
      'refresh-profile-summaries',
      'materialize-fixture-adaptive-assessment-state',
    ]));
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
  });

  it('blocks fixture generation when resource prerequisites remain blocked', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'blocked-controller',
        label: 'Blocked controller resource',
        type: 'SIMULATION_APP',
        knowledgeNodeIds: ['kn-controller'],
      }],
    });
    const report = buildDataCompletenessAuditReport({
      knowledgeNodes: [{
        id: 'kn-controller',
        name: 'controller correction',
        description: 'Controller correction concept.',
        tags: ['correction'],
        resources: ['resource:blocked-controller'],
        isActive: true,
        sourceLinkCount: 1,
        targetLinkCount: 1,
      }],
      teachingResources: [{
        id: 'resource-blocked',
        title: 'Blocked controller resource',
        registryId: 'blocked-controller',
        knowledgeNodeIds: ['kn-controller'],
      }],
      resourceRegistry: registry,
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 3,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 3,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.blockers).toEqual(expect.arrayContaining([
      expect.stringMatching(/^resourceBinding:/),
      expect.stringMatching(/^pathReadiness:/),
    ]));
  });

  it('blocks fixture generation when canonical evidence lineage is blocked', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'canonical-log',
        userId: 'user-canonical',
        eventType: 'lesson_submit',
        clientEventId: 'canonical-client-event',
        attemptKey: 'attempt-1',
        clientEventAt: null,
        createdAt: null,
      }],
      learningFacts: [{
        id: 'canonical-dangling-fact',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: 'missing-client-event',
        sourceLogId: null,
      }, {
        id: 'canonical-dangling-log-fact',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: null,
        sourceLogId: 'missing-log',
      }],
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:learning-fact-source-event-dangling');
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:learning-fact-source-log-dangling');
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:interaction-log-timestamp-missing');
  });

  it('blocks fixture generation when global evidence batches remain unprocessed', () => {
    const report = buildDataCompletenessAuditReport({
      learningEventBatches: [{
        id: 'batch-unprocessed',
        eventCount: 2,
        processedAt: null,
      }],
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.blockers).toContain('evidenceLineage:learning-event-batch-unprocessed');
  });

  it('does not block canonical fixture generation for unrelated learner lineage blockers', () => {
    const report = buildDataCompletenessAuditReport({
      interactionLogs: [{
        id: 'canonical-log',
        userId: 'user-canonical',
        eventType: 'lesson_submit',
        clientEventId: 'canonical-client-event',
        attemptKey: 'attempt-1',
        createdAt: '2026-07-02T00:00:00.000Z',
      }],
      eventDictionaryTypes: ['lesson_submit'],
      learningFacts: [{
        id: 'canonical-fact',
        userId: 'user-canonical',
        factType: 'question',
        sourceEventId: 'canonical-client-event',
        sourceLogId: null,
      }, {
        id: 'other-dangling-fact',
        userId: 'user-other',
        factType: 'question',
        sourceEventId: 'missing-client-event',
        sourceLogId: null,
      }],
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [{
        userId: 'user-canonical',
        name: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
        learningFactCount: 1,
        knowledgeProgressCount: 1,
        pathExecutionCount: 1,
        pathExecutionEvidenceRefCount: 1,
        competencySnapshotCount: 1,
        profileSummaryCount: 1,
        adaptiveAssessmentStateCount: 1,
        featureCache: {
          sourceFactCount: 1,
          sourceCoverage: { LearningFact: 'available' },
        },
      }],
    });

    const lineage = report.layers.find((layer) => layer.id === 'evidenceLineage');
    expect(lineage?.severity).toBe('blocked');
    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(false);
    expect(report.learnerFixture.blockers).not.toContain('evidenceLineage:learning-fact-source-event-dangling');
  });

  it('does not leak canonical fixture display fields when the account is missing', () => {
    const report = buildDataCompletenessAuditReport({
      canonicalLearner: {
        displayName: 'Yang Fan',
        email: 'yangfan@example.edu',
        studentNumber: '20230010102605',
      },
      learnerCandidates: [],
    });
    const serialized = JSON.stringify(report);
    const markdown = renderDataCompletenessAuditMarkdown(report);

    expect(report.learnerFixture.fixtureGenerationBlocked).toBe(true);
    expect(report.learnerFixture.displayNameHash).toMatch(/^sha256:/);
    expect(serialized).not.toContain('Yang Fan');
    expect(serialized).not.toContain('yangfan@example.edu');
    expect(serialized).not.toContain('20230010102605');
    expect(markdown).not.toContain('Yang Fan');
    expect(markdown).not.toContain('yangfan@example.edu');
    expect(markdown).not.toContain('20230010102605');
  });

  it('renders a compact Markdown summary for reviewers', () => {
    const report = buildDataCompletenessAuditReport({
      generatedAt: '2026-07-02T00:00:00.000Z',
      knowledgeNodes: [],
    });

    const markdown = renderDataCompletenessAuditMarkdown(report);
    expect(markdown).toContain('# Data Completeness Audit');
    expect(markdown).toContain('## Graph core');
    expect(markdown).toContain('## Learner Fixture');
  });
});
