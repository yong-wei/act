import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONTROL_CORRECTION_DEMO_PACKAGE,
  buildControlCorrectionDemoAcceptanceReport,
  buildControlCorrectionDemoPlanPostBody,
  buildControlCorrectionDemoRollbackReport,
  installControlCorrectionDemoFixtures,
  validateControlCorrectionDemoPackage,
} from '../control-correction-demo-package';
import { validateControlCorrectionPathPlanForPersistence } from '@/features/personalization/path-planning/control-correction-path-rounds';

describe('control-correction evaluation demo package', () => {
  it('defines resettable synthetic fixtures for the full control-correction loop', () => {
    const pkg = CONTROL_CORRECTION_DEMO_PACKAGE;

    expect(pkg.fixtureScope.syntheticOnly).toBe(true);
    expect(pkg.fixtureScope.cleanupSelectors).toEqual(expect.arrayContaining([
      'tenantId=demo-control-correction-tenant AND classId=demo-control-correction-class',
      'tenantId=demo-control-correction-tenant AND goalId=control-correction',
      'tenantId=demo-control-correction-tenant AND syntheticOnly=true',
    ]));
    expect(pkg.fixtureScope.cleanupSelectors.every((selector) => (
      selector.includes('tenantId=demo-control-correction-tenant')
    ))).toBe(true);
    expect(pkg.students.every((student) => student.synthetic)).toBe(true);
    expect(pkg.resourceNodes.map((node) => node.kind)).toEqual(expect.arrayContaining([
      'knowledge-card',
      'simulation',
      'arena-task',
    ]));
    expect(pkg.resourceNodes.map((node) => node.id)).toEqual([
      'knowledge-card:control-correction-time-domain-targets',
      'simulation:control-correction-step-response-lab',
      'arena-task:task-second-order-lead-pid',
    ]);
    expect(pkg.class.studentIds.every((studentId) => (
      pkg.learnerStateSlices.some((slice) => slice.studentId === studentId) &&
      pkg.pathRounds.some((round) => round.studentId === studentId)
    ))).toBe(true);
    expect(pkg.pathRounds.some((round) => (
      round.executions.some((execution) => execution.status === 'fallback')
    ))).toBe(true);
    expect(pkg.pathRounds.every((round) => (
      round.nodeIds.every((nodeId) => round.executions.some((execution) => execution.nodeId === nodeId))
    ))).toBe(true);
    expect(pkg.simulationArenaOutcomes.every((outcome) => (
      outcome.arenaEvidence.kind === 'ArenaSubmission' &&
      outcome.arenaEvidence.official &&
      outcome.arenaEvidence.hiddenEvaluatorInternalsRedacted
    ))).toBe(true);
    expect(pkg.konlingInterventions.every((intervention) => intervention.citations.length > 0)).toBe(true);
    expect(pkg.konlingInterventions.flatMap((intervention) => intervention.citations.map((citation) => citation.href))).toEqual(expect.arrayContaining([
      '/interactive-learning/resources/lesson09-correction-precheck',
      '/arena/challenges/task-second-order-lead-pid',
    ]));
    expect(pkg.teacherReport.export.redacted).toBe(true);
    expect(validateControlCorrectionDemoPackage(pkg)).toEqual([]);
  });

  it('installs deterministic resettable fixture records without duplicate demo state', () => {
    const firstInstall = installControlCorrectionDemoFixtures();
    const secondInstall = installControlCorrectionDemoFixtures(firstInstall.state);

    expect(firstInstall.upsertedIds).toContain('demo-control-correction-class');
    expect(firstInstall.upsertedIds).toContain('path-alpha');
    expect(firstInstall.upsertedIds).toContain('citationCoverage');
    expect(new Set(firstInstall.upsertedIds).size).toBe(firstInstall.upsertedIds.length);
    expect(secondInstall.resetDeletedIds.sort()).toEqual(firstInstall.upsertedIds.slice().sort());
    expect(secondInstall.state.records).toEqual(firstInstall.state.records);
  });

  it('fails acceptance when required citations, low-confidence markers, or privacy controls are missing', () => {
    const broken = structuredClone(CONTROL_CORRECTION_DEMO_PACKAGE);
    broken.konlingInterventions[0].citations = [];
    broken.pathRounds[1].terminalValidation.lowConfidenceMarked = false;
    broken.providerExamples[0].secretRef = 'sk-demo-plaintext';
    (broken as unknown as { originalAnswer: string }).originalAnswer = 'student raw answer';
    (broken as unknown as { privateMemory: string }).privateMemory = 'private Konling memory';
    (broken as unknown as { evaluatorInternals: string }).evaluatorInternals = 'hidden Arena evaluator internals';
    (broken as unknown as { trace: string }).trace = 'raw high-frequency traces';

    expect(validateControlCorrectionDemoPackage(broken)).toEqual(expect.arrayContaining([
      'Konling interventions require citations',
      'low-confidence terminal validation must be marked',
      'provider examples must use env secret references',
      expect.stringContaining('forbidden private or secret pattern'),
    ]));
  });

  it('fails acceptance when cleanup selectors, runtime flags, or citation routes are not reviewable', () => {
    const broken = structuredClone(CONTROL_CORRECTION_DEMO_PACKAGE);
    broken.fixtureScope.cleanupSelectors[0] = 'goalId=control-correction';
    broken.featureFlags[1].key = 'KONLING_CITATION_GUARD_ENABLED';
    broken.konlingInterventions[0].citations[0].href = '/teacher/arena/publications/demo';

    expect(validateControlCorrectionDemoPackage(broken)).toEqual(expect.arrayContaining([
      'cleanup selectors must be demo-tenant-scoped conjunctions',
      'feature flags and rollback values must reference known runtime flags',
      'Konling citations must point to reviewable demo routes',
    ]));
  });

  it('fails acceptance when route/API contracts, roster coverage, metric confidence, or Arena evidence are incomplete', () => {
    const broken = structuredClone(CONTROL_CORRECTION_DEMO_PACKAGE);
    broken.routeChecks[0].route = '/not-a-real-control-correction-route';
    broken.apiExamples[0].path = '/api/not-real';
    broken.learnerStateSlices = broken.learnerStateSlices.filter((slice) => slice.studentId !== 'demo-student-gamma');
    broken.teacherReport.metrics[0].methodology.confidence = undefined as never;
    broken.simulationArenaOutcomes[0].arenaEvidence.kind = 'LearningFact' as never;
    broken.pathRounds[0].executions = broken.pathRounds[0].executions.filter((execution) => execution.nodeId !== 'arena-task:task-second-order-lead-pid');

    expect(validateControlCorrectionDemoPackage(broken)).toEqual(expect.arrayContaining([
      'route checks must use known control-correction routes',
      'API examples must use known control-correction API paths',
      'every roster student must have a learner-state slice',
      'teacher metrics require numerator, denominator, window, confidence, and source family',
      'Arena outcomes must reference official redacted ArenaSubmission evidence',
      'path round executions must cover every node id',
      'Arena outcomes must be attributed to the matching Arena node execution',
    ]));
  });

  it('fails acceptance when teacher metrics cannot be recomputed from fixture evidence', () => {
    const broken = structuredClone(CONTROL_CORRECTION_DEMO_PACKAGE);
    broken.teacherReport.metrics[0].value = 1;

    expect(validateControlCorrectionDemoPackage(broken)).toContain(
      'teacher metric values must match recomputed fixture evidence',
    );
  });

  it('produces an acceptance report covering fixtures, loop checks, privacy, provider, flags, and rollback', () => {
    const report = buildControlCorrectionDemoAcceptanceReport();

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.checks.map((check) => check.id)).toEqual([
      'fixtures.synthetic-resettable',
      'loop.learner-state-path-execution',
      'loop.konling-citations',
      'loop.teacher-report-export',
      'provider-flags-rollback',
      'privacy',
    ]);
    expect(report.checks.every((check) => check.ok)).toBe(true);
  });

  it('builds a learning-path POST body accepted by the persistence validator', () => {
    const body = buildControlCorrectionDemoPlanPostBody();

    expect(body.classId).toBe('demo-control-correction-class');
    expect(body.learnerStateRef).toBe('learner-state-alpha');
    expect(body.plan.id).toContain(body.plan.userId);
    expect(body.plan.stage).toBe('stage-1-rules-graph');
    expect(body.plan.policyFamily).toBe('rules-plus-graph-search');
    expect(body.plan.mainPath.at(-1)?.terminalConstraints).toContain('terminal-validation');
    expect(() => validateControlCorrectionPathPlanForPersistence(body.plan)).not.toThrow();
  });

  it('verifies rollback behavior against runtime flag helpers', () => {
    const report = buildControlCorrectionDemoRollbackReport();

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual([
      'rollback.path-rounds-disabled',
      'rollback.learner-state-disabled',
      'rollback.ai-provider-env-fallback-disabled',
    ]);
    expect(report.checks.every((check) => check.ok)).toBe(true);
  });

  it('documents demo storyline, route checks, API examples, methodology, privacy, provider, and rollback', () => {
    const docs = readFileSync(
      join(process.cwd(), 'docs/control-correction-evaluation-demo-package.md'),
      'utf8',
    );

    for (const section of [
      '## Demo Storyline',
      '## Setup And Reset',
      '## Route Checks',
      '## API Examples',
      '## Metric Methodology',
      '## Provider Configuration',
      '## Privacy And Audit Controls',
      '## Deployment And Rollback',
      '## Release Readiness',
    ]) {
      expect(docs).toContain(section);
    }
    expect(docs).toContain('rtk npm run test:control-correction-demo');
  });
});
