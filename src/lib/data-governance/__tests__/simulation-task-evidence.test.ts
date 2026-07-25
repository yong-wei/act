import { describe, expect, it } from 'vitest';

import {
  GENERIC_CONTROL_WORKBENCH_TASK_KEY,
  GENERIC_VIRTUAL_SIMULATION_TASK_KEY,
  getSimulationTaskCatalog,
  getSimulationTaskByKey,
  resolveArenaTaskKey,
  resolveOdysseyTaskKey,
  resolveVirtualSimulationTaskKey,
} from '../simulation-task-catalog';
import {
  buildArtifactKey,
  buildGovernedTaskEvidence,
  buildSemanticFingerprint,
  hashSemanticFingerprintValue,
  higherTier,
  isDistinctRun,
  isGovernedTaskEvidence,
  isTaskEvidenceEligibleEvent,
  isTaskEvidenceIneligibleEvent,
  selectHighestTierEvidence,
  tierAtLeast,
} from '../simulation-task-evidence';
import {
  countDistinctValidRuns,
  deduplicateByArtifactKey,
  evaluateTaskCompletion,
  hasDistinctRuns,
  isNovelRun,
} from '../simulation-task-completion';
import {
  materializeArenaTaskEvidence,
  materializeControlWorkbenchTaskEvidence,
  materializeOdysseyTaskEvidence,
  materializeVirtualSimulationTaskEvidence,
} from '../simulation-task-materialization';
import { runHistoricalTaskEvidenceDryRun } from '../simulation-task-historical-dryrun';
import type { GovernedTaskEvidenceContext } from '../simulation-task-evidence';
import {
  buildSimulationTaskLearningFact,
  persistSimulationTaskEvidence,
} from '../simulation-task-learning-fact';

// ─── Task Catalog Tests ──────────────────────────────────────────────────────

describe('simulation-task-catalog', () => {
  it('returns a non-empty frozen catalog', () => {
    const catalog = getSimulationTaskCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(Object.isFrozen(catalog)).toBe(true);
  });

  it('includes every published odyssey level, including dynamically unlocked levels', () => {
    const catalog = getSimulationTaskCatalog();
    const odysseyEntries = catalog.filter((e) => e.source === 'odyssey');
    expect(odysseyEntries).toHaveLength(15);
    expect(odysseyEntries.some((entry) => entry.taskKey === 'odyssey:level-15')).toBe(true);
    for (const entry of odysseyEntries) {
      expect(entry.taskKey).toMatch(/^odyssey:level-/);
      expect(entry.completionRule.kind).toBe('odyssey-persistent-clear');
      expect(entry.published).toBe(true);
    }
  });

  it('includes arena challenges with completion predicates', () => {
    const catalog = getSimulationTaskCatalog();
    const arenaEntries = catalog.filter((e) => e.source === 'arena');
    expect(arenaEntries.length).toBeGreaterThanOrEqual(2);
    for (const entry of arenaEntries) {
      expect(entry.taskKey).toMatch(/^arena:task-/);
      expect(entry.completionRule.kind).toBe('arena-accepted-submission');
    }
  });

  it('includes generic virtual simulation and control workbench tasks', () => {
    const catalog = getSimulationTaskCatalog();
    const genericSim = catalog.find((e) => e.taskKey === GENERIC_VIRTUAL_SIMULATION_TASK_KEY);
    const genericWorkbench = catalog.find((e) => e.taskKey === GENERIC_CONTROL_WORKBENCH_TASK_KEY);
    expect(genericSim).toBeDefined();
    expect(genericWorkbench).toBeDefined();
    expect(genericSim!.completionRule.kind).toBe('distinct-valid-runs');
    expect(genericWorkbench!.completionRule.kind).toBe('distinct-valid-runs');
  });

  it('does not include draft or teacher-preview items', () => {
    const catalog = getSimulationTaskCatalog();
    for (const entry of catalog) {
      expect(entry.published).toBe(true);
    }
  });

  it('does not duplicate Arena workbenches as virtual-simulation tasks', () => {
    const virtualTaskIds = getSimulationTaskCatalog()
      .filter((entry) => entry.source === 'virtual-simulation')
      .map((entry) => entry.sourceTaskId);
    expect(virtualTaskIds).not.toContain('arena-challenge-workbench');
    expect(virtualTaskIds).not.toContain('arena-cruise-blackbox-workbench');
  });

  it('resolves arena task key only for tasks with predicates', () => {
    expect(resolveArenaTaskKey('task-second-order-lead-pid')).toBe('arena:task-second-order-lead-pid');
    expect(resolveArenaTaskKey('nonexistent-task')).toBeNull();
  });

  it('resolves odyssey task key with arena assignment priority', () => {
    // level-1 is Arena-assigned
    const arenaKey = resolveOdysseyTaskKey('level-1', true);
    expect(arenaKey).toBe('arena:task-odyssey-level-one-growth');

    // non-assigned returns odyssey key
    const odysseyKey = resolveOdysseyTaskKey('level-1', false);
    expect(odysseyKey).toBe('odyssey:level-1');
  });

  it('uses generic virtual task only when no named identity exists', () => {
    expect(resolveVirtualSimulationTaskKey(null)).toBe(GENERIC_VIRTUAL_SIMULATION_TASK_KEY);
    expect(resolveVirtualSimulationTaskKey('unknown-task')).toBeNull();
  });

  it('looks up task by key', () => {
    const entry = getSimulationTaskByKey('odyssey:level-1');
    expect(entry).toBeDefined();
    expect(entry!.source).toBe('odyssey');
    expect(getSimulationTaskByKey('nonexistent:key')).toBeUndefined();
  });
});

// ─── Evidence Contract Tests ─────────────────────────────────────────────────

describe('simulation-task-evidence', () => {
  it('builds a stable opaque artifact key with student namespace', () => {
    const key = buildArtifactKey({
      studentUserId: 'student-a',
      sourceFamily: 'arena',
      taskKey: 'arena:task-second-order-lead-pid',
      normalizedSourceArtifactId: 'sub-123',
    });
    expect(key).toMatch(/^simulation-task-artifact:v1:[a-f0-9]{64}$/);
    expect(key).not.toContain('student-a');
    expect(key).toBe(buildArtifactKey({
      studentUserId: 'student-a',
      sourceFamily: 'arena',
      taskKey: 'arena:task-second-order-lead-pid',
      normalizedSourceArtifactId: 'sub-123',
    }));
  });

  it('different students with same content do not share artifact key', () => {
    const keyA = buildArtifactKey({
      studentUserId: 'student-a',
      sourceFamily: 'arena',
      taskKey: 'arena:task-x',
      normalizedSourceArtifactId: 'same-hash',
    });
    const keyB = buildArtifactKey({
      studentUserId: 'student-b',
      sourceFamily: 'arena',
      taskKey: 'arena:task-x',
      normalizedSourceArtifactId: 'same-hash',
    });
    expect(keyA).not.toBe(keyB);
  });

  it('builds semantic fingerprint and detects distinct runs', () => {
    const fpA = { plantRef: 'plant-1', controllerConfigHash: 'cfg-a' };
    const fpB = { plantRef: 'plant-1', controllerConfigHash: 'cfg-b' };
    const fpC = { plantRef: 'plant-1', controllerConfigHash: 'cfg-a' };

    expect(isDistinctRun(fpA, fpB)).toBe(true);
    expect(isDistinctRun(fpA, fpC)).toBe(false);
    expect(buildSemanticFingerprint(fpA)).toBe('plant-1||cfg-a|');
  });

  it('hashes semantically identical object values independent of key order', () => {
    expect(hashSemanticFingerprintValue({ b: 2, a: { d: 4, c: 3 } })).toBe(
      hashSemanticFingerprintValue({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it('selects higher tier evidence', () => {
    expect(higherTier('run', 'submission')).toBe('submission');
    expect(higherTier('clear', 'run')).toBe('clear');
    expect(tierAtLeast('submission', 'run')).toBe(true);
    expect(tierAtLeast('process', 'evaluation')).toBe(false);
  });

  it('selectHighestTierEvidence keeps existing when incoming is lower', () => {
    const existing = buildGovernedTaskEvidence({
      studentUserId: 's1',
      taskKey: 'arena:task-x',
      source: 'arena',
      tier: 'submission',
      occurredAt: '2026-01-01T00:00:00Z',
      normalizedSourceArtifactId: 'a1',
      semanticFingerprint: {},
      summary: { sourceRef: 'a1', qualityBand: 'full' },
    });
    const incoming = buildGovernedTaskEvidence({
      studentUserId: 's1',
      taskKey: 'arena:task-x',
      source: 'arena',
      tier: 'run',
      occurredAt: '2026-01-02T00:00:00Z',
      normalizedSourceArtifactId: 'a1',
      semanticFingerprint: {},
      summary: { sourceRef: 'a1', qualityBand: 'partial' },
    });
    const result = selectHighestTierEvidence(existing, incoming);
    expect(result).toBe(existing);
  });

  it('identifies governed task evidence context', () => {
    const evidence = buildGovernedTaskEvidence({
      studentUserId: 's1',
      taskKey: 'odyssey:level-1',
      source: 'odyssey',
      tier: 'clear',
      occurredAt: '2026-01-01T00:00:00Z',
      normalizedSourceArtifactId: 'run-1',
      semanticFingerprint: { plantRef: 'p1' },
      summary: { sourceRef: 'run-1', qualityBand: 'full' },
    });
    expect(isGovernedTaskEvidence(evidence)).toBe(true);
    expect(isGovernedTaskEvidence({})).toBe(false);
    expect(isGovernedTaskEvidence(null)).toBe(false);
    expect(evidence.portraitWeight).toBe(0);
    expect(evidence.portraitDimensionMapping).toBe('simulationValidationEvidence');
  });

  it('classifies eligible and ineligible events', () => {
    expect(isTaskEvidenceEligibleEvent('simulation_finish')).toBe(true);
    expect(isTaskEvidenceEligibleEvent('arena_submit')).toBe(true);
    expect(isTaskEvidenceEligibleEvent('page_view')).toBe(false);
    expect(isTaskEvidenceIneligibleEvent('page_view')).toBe(true);
    expect(isTaskEvidenceIneligibleEvent('arena_result_view')).toBe(true);
    expect(isTaskEvidenceIneligibleEvent('simulation_finish')).toBe(false);
  });
});

describe('simulation-task-learning-fact', () => {
  const evidence = buildGovernedTaskEvidence({
    studentUserId: 'student-1',
    taskKey: 'odyssey:level-1',
    source: 'odyssey',
    tier: 'clear',
    occurredAt: '2026-01-01T00:00:00.000Z',
    normalizedSourceArtifactId: 'run-1',
    semanticFingerprint: { modelRef: 'level-1' },
    summary: { sourceRef: 'run-1', qualityBand: 'full' },
  });

  it('builds an immutable zero-contribution learning fact', () => {
    const fact = buildSimulationTaskLearningFact({
      userId: 'student-1',
      evidence,
      sourceLogId: 'simulation-log:run-1',
    });
    expect(fact.factType).toBe('simulation_task_evidence');
    expect(fact.competencyContribution).toEqual({});
    expect(fact.sourceEventId).toMatch(/^simulation-task-evidence:[a-f0-9]{64}$/);
    expect(fact.contextJson).toEqual({ simulationTaskEvidence: evidence });
  });

  it('uses skipDuplicates for idempotent persistence', async () => {
    let capturedSkipDuplicates = false;
    const result = await persistSimulationTaskEvidence({
      learningFact: {
        async createMany(args) {
          capturedSkipDuplicates = args.skipDuplicates === true;
          return { count: 0 };
        },
      },
    }, {
      userId: 'student-1',
      evidence,
      sourceLogId: 'simulation-log:run-1',
    });
    expect(capturedSkipDuplicates).toBe(true);
    expect(result).toEqual({ created: 0, skipped: true });
  });
});

// ─── Materialization Tests ───────────────────────────────────────────────────

describe('simulation-task-materialization', () => {
  const studentActor = { userId: 'student-1', role: 'student' as const };
  const teacherActor = { userId: 'teacher-1', role: 'teacher' as const };

  it('rejects teacher preview', () => {
    const result = materializeVirtualSimulationTaskEvidence({
      actor: teacherActor,
      eventType: 'simulation_finish',
      sourceArtifactId: 'log-1',
      occurredAt: '2026-01-01T00:00:00Z',
      tier: 'run',
      fingerprint: {},
      summary: { sourceRef: 'log-1', qualityBand: 'full' },
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toContain('not-student');
  });

  it('rejects ineligible events', () => {
    const result = materializeVirtualSimulationTaskEvidence({
      actor: studentActor,
      eventType: 'page_view',
      sourceArtifactId: 'log-1',
      occurredAt: '2026-01-01T00:00:00Z',
      tier: 'run',
      fingerprint: {},
      summary: { sourceRef: 'log-1', qualityBand: 'full' },
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toContain('ineligible-event');
  });

  it('accepts valid virtual simulation run', () => {
    const result = materializeVirtualSimulationTaskEvidence({
      actor: studentActor,
      eventType: 'simulation_finish',
      sourceArtifactId: 'log-1',
      occurredAt: '2026-01-01T00:00:00Z',
      tier: 'run',
      fingerprint: { plantRef: 'ship-roll' },
      summary: { sourceRef: 'log-1', qualityBand: 'full' },
    });
    expect(result.status).toBe('accepted');
    expect(result.evidence!.taskKey).toBe(GENERIC_VIRTUAL_SIMULATION_TASK_KEY);
    expect(result.evidence!.portraitWeight).toBe(0);
  });

  it('rejects arena submission that is not accepted', () => {
    const result = materializeArenaTaskEvidence({
      actor: studentActor,
      eventType: 'arena_submit',
      taskId: 'task-second-order-lead-pid',
      submissionId: 'sub-1',
      occurredAt: '2026-01-01T00:00:00Z',
      accepted: false,
      evaluationValid: true,
      fingerprint: {},
      summary: { sourceRef: 'sub-1', qualityBand: 'full' },
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('submission-not-accepted');
  });

  it('accepts valid arena accepted submission', () => {
    const result = materializeArenaTaskEvidence({
      actor: studentActor,
      eventType: 'arena_submit',
      taskId: 'task-second-order-lead-pid',
      submissionId: 'sub-1',
      occurredAt: '2026-01-01T00:00:00Z',
      accepted: true,
      evaluationValid: true,
      fingerprint: { controllerConfigHash: 'pid-1' },
      summary: { sourceRef: 'sub-1', qualityBand: 'full' },
    });
    expect(result.status).toBe('accepted');
    expect(result.evidence!.taskKey).toBe('arena:task-second-order-lead-pid');
    expect(result.evidence!.tier).toBe('submission');
  });

  it('rejects odyssey without persistent clear', () => {
    const result = materializeOdysseyTaskEvidence({
      actor: studentActor,
      eventType: 'odyssey_level_clear',
      levelId: 'level-2',
      isArenaAssigned: false,
      sourceArtifactId: 'run-1',
      occurredAt: '2026-01-01T00:00:00Z',
      persistentClear: false,
      fingerprint: {},
      summary: { sourceRef: 'run-1', qualityBand: 'partial' },
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('not-persistent-clear');
  });

  it('routes arena-assigned odyssey to arena task', () => {
    const result = materializeOdysseyTaskEvidence({
      actor: studentActor,
      eventType: 'odyssey_persistent_clear',
      levelId: 'level-1',
      isArenaAssigned: true,
      arenaTaskId: 'task-odyssey-level-one-growth',
      sourceArtifactId: 'run-1',
      occurredAt: '2026-01-01T00:00:00Z',
      persistentClear: true,
      fingerprint: {},
      summary: { sourceRef: 'run-1', qualityBand: 'full' },
    });
    expect(result.status).toBe('accepted');
    expect(result.evidence!.taskKey).toBe('arena:task-odyssey-level-one-growth');
    expect(result.evidence!.source).toBe('arena');
  });

  it('rejects an Arena-assigned Odyssey run whose persisted task id does not match', () => {
    const result = materializeOdysseyTaskEvidence({
      actor: studentActor,
      eventType: 'odyssey_persistent_clear',
      levelId: 'level-1',
      isArenaAssigned: true,
      arenaTaskId: 'task-second-order-lead-pid',
      sourceArtifactId: 'run-1',
      occurredAt: '2026-01-01T00:00:00Z',
      persistentClear: true,
      fingerprint: {},
      summary: { sourceRef: 'run-1', qualityBand: 'full' },
    });
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'arena-assignment-task-mismatch',
    });
  });

  it('rejects control workbench without persisted design', () => {
    const result = materializeControlWorkbenchTaskEvidence({
      actor: studentActor,
      eventType: 'design_session_complete',
      sourceArtifactId: 'ds-1',
      occurredAt: '2026-01-01T00:00:00Z',
      tier: 'run',
      fingerprint: {},
      summary: { sourceRef: 'ds-1', qualityBand: 'partial' },
      hasPersistedDesign: false,
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('missing-persisted-design');
  });

  it('deduplicates same artifact with lower tier', () => {
    const existing = buildGovernedTaskEvidence({
      studentUserId: 'student-1',
      taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY,
      source: 'virtual-simulation',
      tier: 'evaluation',
      occurredAt: '2026-01-01T00:00:00Z',
      normalizedSourceArtifactId: 'log-1',
      semanticFingerprint: {},
      summary: { sourceRef: 'log-1', qualityBand: 'full' },
    });
    const result = materializeVirtualSimulationTaskEvidence({
      actor: studentActor,
      eventType: 'simulation_finish',
      namedTaskId: null,
      sourceArtifactId: 'log-1',
      occurredAt: '2026-01-02T00:00:00Z',
      tier: 'run',
      fingerprint: {},
      summary: { sourceRef: 'log-1', qualityBand: 'partial' },
    }, existing);
    expect(result.status).toBe('deduplicated');
  });
});

// ─── Completion Rule Tests ───────────────────────────────────────────────────

describe('simulation-task-completion', () => {
  function makeEvidence(overrides: Partial<GovernedTaskEvidenceContext> & { taskKey: string; tier: string }): GovernedTaskEvidenceContext {
    return {
      schemaVersion: 'simulation-task-evidence.v1',
      artifactKey: `s1:virtual-simulation:${overrides.taskKey}:${Math.random()}`,
      source: 'virtual-simulation',
      occurredAt: '2026-01-01T00:00:00Z',
      semanticFingerprint: `fp-${Math.random()}`,
      summary: { sourceRef: 'x', qualityBand: 'full' },
      sourceValidity: 'valid',
      portraitWeight: 0,
      portraitDimensionMapping: 'simulationValidationEvidence',
      capabilityMappingTags: [],
      ...overrides,
    } as GovernedTaskEvidenceContext;
  }

  it('counts distinct valid runs by fingerprint', () => {
    const evidence = [
      makeEvidence({ taskKey: 'virtual-simulation:generic', tier: 'run', semanticFingerprint: 'a|||' }),
      makeEvidence({ taskKey: 'virtual-simulation:generic', tier: 'run', semanticFingerprint: 'b|||' }),
      makeEvidence({ taskKey: 'virtual-simulation:generic', tier: 'run', semanticFingerprint: 'a|||' }),
    ];
    expect(countDistinctValidRuns(evidence)).toBe(2);
  });

  it('does not count degraded or unresolved runs toward completion', () => {
    const evidence = [
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'a|||', sourceValidity: 'valid' }),
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'b|||', sourceValidity: 'degraded' }),
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'c|||', sourceValidity: 'unresolved' }),
    ];
    expect(countDistinctValidRuns(evidence)).toBe(1);
    expect(evaluateTaskCompletion(GENERIC_VIRTUAL_SIMULATION_TASK_KEY, evidence).attained).toBe(false);
  });

  it('evaluates distinct-valid-runs task as attained at 3 distinct', () => {
    const evidence = [
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'a|||' }),
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'b|||' }),
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'c|||' }),
    ];
    const result = evaluateTaskCompletion(GENERIC_VIRTUAL_SIMULATION_TASK_KEY, evidence);
    expect(result.attained).toBe(true);
  });

  it('evaluates distinct-valid-runs task as not attained below 3', () => {
    const evidence = [
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'a|||' }),
      makeEvidence({ taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY, tier: 'run', semanticFingerprint: 'b|||' }),
    ];
    const result = evaluateTaskCompletion(GENERIC_VIRTUAL_SIMULATION_TASK_KEY, evidence);
    expect(result.attained).toBe(false);
  });

  it('evaluates arena task as attained with submission tier', () => {
    const evidence = [
      makeEvidence({ taskKey: 'arena:task-second-order-lead-pid', tier: 'submission', source: 'arena' }),
    ];
    const result = evaluateTaskCompletion('arena:task-second-order-lead-pid', evidence);
    expect(result.attained).toBe(true);
  });

  it('evaluates odyssey task as attained with clear tier', () => {
    const evidence = [
      makeEvidence({ taskKey: 'odyssey:level-1', tier: 'clear', source: 'odyssey' }),
    ];
    const result = evaluateTaskCompletion('odyssey:level-1', evidence);
    expect(result.attained).toBe(true);
  });

  it('deduplicates by artifact key keeping highest tier', () => {
    const e1 = makeEvidence({ taskKey: 'x', tier: 'run', artifactKey: 's1:arena:x:a1' });
    const e2 = makeEvidence({ taskKey: 'x', tier: 'submission', artifactKey: 's1:arena:x:a1' });
    const e3 = makeEvidence({ taskKey: 'x', tier: 'run', artifactKey: 's1:arena:x:a2' });
    const result = deduplicateByArtifactKey([e1, e2, e3]);
    expect(result.length).toBe(2);
    const a1 = result.find((e) => e.artifactKey === 's1:arena:x:a1');
    expect(a1!.tier).toBe('submission');
  });

  it('hasDistinctRuns detects novel fingerprints', () => {
    const fps = [
      { plantRef: 'a' },
      { plantRef: 'b' },
      { plantRef: 'c' },
    ];
    expect(hasDistinctRuns(fps, 3)).toBe(true);
    expect(hasDistinctRuns(fps.slice(0, 2), 3)).toBe(false);
  });

  it('isNovelRun checks against existing fingerprints', () => {
    expect(isNovelRun(['a|||'], { plantRef: 'b' })).toBe(true);
    expect(isNovelRun(['b|||'], { plantRef: 'b' })).toBe(false);
  });
});

// ─── Historical Dry Run Tests ────────────────────────────────────────────────

describe('simulation-task-historical-dryrun', () => {
  it('produces candidates for valid records', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'rec-1',
        userId: 'student-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'arena',
        eventType: 'arena_submit',
        arenaTaskId: 'task-second-order-lead-pid',
        sourceArtifactId: 'sub-1',
        tier: 'submission',
        accepted: true,
        evaluationValid: true,
      },
    ]);
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].taskKey).toBe('arena:task-second-order-lead-pid');
    expect(result.skips.length).toBe(0);
    expect(result.affectedStudents).toBe(1);
  });

  it('skips records missing student', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'rec-2',
        userId: null,
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'virtual-simulation',
        eventType: 'simulation_finish',
        sourceArtifactId: 'log-1',
      },
    ]);
    expect(result.candidates.length).toBe(0);
    expect(result.skips.length).toBe(1);
    expect(result.skips[0].reason).toBe('missing-student');
  });

  it('falls back to generic virtual simulation for missing named task', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'rec-3',
        userId: 'student-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'virtual-simulation',
        eventType: 'simulation_finish',
        namedTaskId: null,
        sourceArtifactId: 'log-2',
        tier: 'run',
      },
    ]);
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].taskKey).toBe(GENERIC_VIRTUAL_SIMULATION_TASK_KEY);
  });

  it('skips param-change-only records', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'rec-4',
        userId: 'student-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'virtual-simulation',
        eventType: 'simulation_finish',
        sourceArtifactId: 'log-3',
        isParamChangeOnly: true,
      },
    ]);
    expect(result.candidates.length).toBe(0);
    expect(result.skips[0].reason).toBe('param-change-only');
  });

  it('skips teacher/admin actions', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'rec-5',
        userId: 'teacher-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'arena',
        eventType: 'arena_submit',
        arenaTaskId: 'task-second-order-lead-pid',
        sourceArtifactId: 'sub-2',
        actorRole: 'teacher',
      },
    ]);
    expect(result.candidates.length).toBe(0);
    expect(result.skips[0].reason).toBe('teacher-or-admin-action');
  });

  it('deduplicates same artifact key', () => {
    const records = [
      {
        id: 'rec-6a',
        userId: 'student-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'arena' as const,
        eventType: 'arena_submit',
        arenaTaskId: 'task-second-order-lead-pid',
        sourceArtifactId: 'sub-same',
        tier: 'submission' as const,
        accepted: true,
        evaluationValid: true,
      },
      {
        id: 'rec-6b',
        userId: 'student-1',
        occurredAt: '2026-01-02T00:00:00Z',
        source: 'arena' as const,
        eventType: 'arena_submit',
        arenaTaskId: 'task-second-order-lead-pid',
        sourceArtifactId: 'sub-same',
        tier: 'submission' as const,
        accepted: true,
        evaluationValid: true,
      },
    ];
    const result = runHistoricalTaskEvidenceDryRun(records);
    expect(result.candidates.length).toBe(1);
    expect(result.skips.length).toBe(1);
    expect(result.skips[0].reason).toBe('duplicate-artifact');
  });

  it('keeps the highest historical evidence tier regardless of input order', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'control-run-low',
        userId: 'student-1',
        occurredAt: '2026-06-18T00:00:00.000Z',
        source: 'control-workbench',
        eventType: 'design_session_complete',
        sourceArtifactId: 'shared-control-artifact',
        tier: 'run',
        hasPersistedDesign: true,
      },
      {
        id: 'control-run-high',
        userId: 'student-1',
        occurredAt: '2026-06-18T00:01:00.000Z',
        source: 'control-workbench',
        eventType: 'workspace_submission',
        sourceArtifactId: 'shared-control-artifact',
        tier: 'submission',
        hasPersistedDesign: true,
      },
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      recordId: 'control-run-high',
      tier: 'submission',
    });
    expect(result.skips).toEqual([
      expect.objectContaining({
        recordId: 'control-run-low',
        reason: 'duplicate-artifact',
      }),
    ]);
  });

  it('skips unresolvable arena task', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'rec-7',
        userId: 'student-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'arena',
        eventType: 'arena_submit',
        arenaTaskId: 'retired-task-xyz',
        sourceArtifactId: 'sub-3',
        accepted: true,
        evaluationValid: true,
      },
    ]);
    expect(result.candidates.length).toBe(0);
    expect(result.skips[0].reason).toBe('task-no-longer-published');
  });

  it('does not promote an unbound Arena evaluation to task evidence', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'rec-evaluation-only',
        userId: 'student-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'arena',
        eventType: 'arena_evaluation_complete',
        arenaTaskId: 'task-second-order-lead-pid',
        sourceArtifactId: 'evaluation-1',
        evaluationValid: true,
      },
    ]);
    expect(result.candidates).toHaveLength(0);
    expect(result.skips[0]).toMatchObject({
      reason: 'insufficient-context',
      detail: 'arena-evaluation-without-accepted-submission',
    });
  });

  it('does not promote an Arena-assigned Odyssey clear without an accepted submission', () => {
    const result = runHistoricalTaskEvidenceDryRun([
      {
        id: 'arena-assigned-odyssey-clear',
        userId: 'student-1',
        occurredAt: '2026-01-01T00:00:00Z',
        source: 'odyssey',
        eventType: 'odyssey_persistent_clear',
        odysseyLevelId: 'level-1',
        isArenaAssigned: true,
        arenaTaskId: 'task-odyssey-level-one-growth',
        sourceArtifactId: 'odyssey-run-1',
        persistentClear: true,
      },
    ]);

    expect(result.candidates).toHaveLength(0);
    expect(result.skips[0]).toMatchObject({
      reason: 'insufficient-context',
      detail: 'arena-assigned-requires-accepted-submission',
    });
  });
});
