import { readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  acceptsIntelligentTeachingAssistantDemoAuthBoundary,
  isIntelligentTeachingAssistantDemoSuccessfulHttpStatus,
  runIntelligentTeachingAssistantDemoAcceptance,
  validateIntelligentTeachingAssistantDemoApiPayload,
  validateIntelligentTeachingAssistantDemoHttpTarget,
} from '../../../../scripts/tests/intelligent-teaching-assistant-demo-acceptance';
import {
  INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
  buildIntelligentTeachingAssistantDemoAcceptanceReport,
  buildIntelligentTeachingAssistantDemoRollbackReport,
  buildIntelligentTeachingAssistantEffectReportExport,
  installIntelligentTeachingAssistantDemoFixtures,
  validateIntelligentTeachingAssistantDemoPackage,
} from '../intelligent-teaching-assistant-demo-package';

const DEMO_ACCEPTANCE_ENV_KEYS = [
  'INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL',
  'INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_COOKIE',
  'INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE',
  'INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE',
  'INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED',
] as const;

function snapshotDemoAcceptanceEnv(): Record<typeof DEMO_ACCEPTANCE_ENV_KEYS[number], string | undefined> {
  return Object.fromEntries(DEMO_ACCEPTANCE_ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
    typeof DEMO_ACCEPTANCE_ENV_KEYS[number],
    string | undefined
  >;
}

function restoreDemoAcceptanceEnv(snapshot: Record<typeof DEMO_ACCEPTANCE_ENV_KEYS[number], string | undefined>) {
  for (const key of DEMO_ACCEPTANCE_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function writeSuccessfulDemoAcceptanceResponse(url: string, response: ServerResponse): boolean {
  if (url.startsWith('/assessment/adaptive-practice')) {
    response.setHeader('Content-Type', 'text/html');
    response.end('<main data-control-correction-center></main>');
    return true;
  }
  if (url.startsWith('/teacher/grading-workbench')) {
    response.setHeader('Content-Type', 'text/html');
    response.end('<main data-intelligent-teaching-assistant-demo-surface="document-grading-workbench">报告评分工作台</main>');
    return true;
  }
  if (url.startsWith('/assessment/document-feedback')) {
    response.setHeader('Content-Type', 'text/html');
    response.end('<main data-intelligent-teaching-assistant-demo-surface="document-feedback">报告反馈</main>');
    return true;
  }
  if (!url.startsWith('/api/') && url.includes('/analytics-v2')) {
    response.setHeader('Content-Type', 'text/html');
    response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics" data-operations-status-semantics="ready"><h1>班级学情总览</h1></main>');
    return true;
  }
  if (!url.startsWith('/api/') && url.includes('/students/demo-ita-student-beta')) {
    response.setHeader('Content-Type', 'text/html');
    response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-student-insights" data-operations-status-semantics="ready"><h2>证据摘要</h2></main>');
    return true;
  }

  response.setHeader('Content-Type', 'application/json');
  if (url.startsWith('/api/adaptive/learner-state')) {
    response.end(JSON.stringify({
      goalSlices: {
        controlCorrection: {
          goalId: 'control-correction',
          dimensions: [{ id: 'parameterDesign', score: 0.72 }],
          pathContext: { activePathId: 'path-alpha-main', noActivePath: false },
        },
      },
    }));
    return true;
  }
  if (url === '/api/learning-paths/plan') {
    response.end(JSON.stringify({ path: { id: 'demo-path-demo-ita-student-alpha-control-correction', goalId: 'control-correction' } }));
    return true;
  }
  if (url === '/api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute') {
    response.end(JSON.stringify({ execution: { nodeId: 'simulation:control-correction-step-response-lab' }, cacheRefresh: { ok: true } }));
    return true;
  }
  if (url === '/api/teacher/document-grading/approve') {
    response.end(JSON.stringify({ status: 'approved', gradingRunId: 'grading-alpha-draft', createdFacts: 1, evidenceSourceEventIds: ['event-1'] }));
    return true;
  }
  if (url === '/api/ai/chat') {
    response.setHeader('Content-Type', 'text/event-stream');
    response.end('data: {"type":"text-delta","textDelta":"cited synthetic answer","citations":[{"id":"cit-diagnosis-alpha","sourceFamily":"role-based-learning-diagnosis"}]}\n\n');
    return true;
  }
  if (url.startsWith('/api/teacher/classes/demo-ita-class/control-correction-report')) {
    response.end(JSON.stringify({ report: { goalId: 'control-correction' }, export: { redacted: true } }));
    return true;
  }
  if (url.startsWith('/api/teacher/classes/demo-ita-class/assistant-effect-report')) {
    response.end(JSON.stringify({ effectReport: buildIntelligentTeachingAssistantEffectReportExport() }));
    return true;
  }
  if (url === '/api/teacher/classes/demo-ita-class/insights') {
    response.end(JSON.stringify({
      classInfo: { id: 'demo-ita-class' },
      students: [{ id: 'demo-ita-student-beta' }],
      spotlightStudents: [{ id: 'demo-ita-student-beta' }],
      governance: { coveredStudents: 3 },
    }));
    return true;
  }
  if (url === '/api/teacher/classes/demo-ita-class/heatmap') {
    response.end(JSON.stringify({
      students: [{ id: 'demo-ita-student-beta' }],
      dimensions: ['parameterDesign'],
      matrix: [{ studentId: 'demo-ita-student-beta', dimension: 'parameterDesign', score: 72 }],
    }));
    return true;
  }
  if (url === '/api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights') {
    response.end(JSON.stringify({
      student: { id: 'demo-ita-student-beta' },
      overview: { overallScore: 72 },
      evidenceSummary: [{ dimension: 'parameterDesign' }],
    }));
    return true;
  }
  return false;
}

describe('intelligent teaching assistant demo package', () => {
  it('defines resettable synthetic fixtures for the full teaching assistant story', () => {
    const pkg = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE;

    expect(pkg.fixtureScope.syntheticOnly).toBe(true);
    expect(pkg.fixtureScope.cleanupSelectors).toEqual(expect.arrayContaining([
      'tenantId=demo-intelligent-teaching-assistant-tenant AND classId=demo-ita-class AND demoPackage=intelligent-teaching-assistant',
      'tenantId=demo-intelligent-teaching-assistant-tenant AND syntheticOnly=true AND demoPackage=intelligent-teaching-assistant',
    ]));
    expect(pkg.fixtureScope.cleanupSelectors.every((selector) => (
      selector.includes('demoPackage=intelligent-teaching-assistant')
    ))).toBe(true);
    expect(pkg.students.every((student) => student.synthetic)).toBe(true);
    expect(pkg.class.studentIds.every((studentId) => (
      pkg.students.some((student) => student.id === studentId)
    ))).toBe(true);
    expect(pkg.routeChecks.map((check) => check.route)).toEqual(expect.arrayContaining([
      '/assessment/adaptive-practice?goal=control-correction',
      '/teacher/grading-workbench?demo=1',
      '/assessment/document-feedback?demo=1',
      '/teacher/classes/demo-ita-class/analytics-v2',
      '/teacher/classes/demo-ita-class/students/demo-ita-student-beta',
    ]));
    expect(pkg.routeChecks.map((check) => check.route)).not.toContain('/teacher/classes/demo-ita-class');
    expect(pkg.routeChecks.map((check) => check.readyText)).not.toContain('class');
    expect(pkg.routeChecks.map((check) => check.readyText)).toEqual(expect.arrayContaining([
      'data-control-correction-center',
      '报告评分工作台',
      '报告反馈',
      '班级学情总览',
      '证据摘要',
    ]));
    expect(pkg.routeChecks.filter((check) => check.route.includes('demo-ita-class')).every((check) => (
      check.requiredStatusSemantics === 'ready'
      && Array.isArray(check.forbiddenTexts)
      && check.forbiddenTexts.length > 0
    ))).toBe(true);
    expect(pkg.routeChecks.map((check) => check.actorRole)).toEqual(expect.arrayContaining(['student', 'teacher']));
    expect(pkg.apiExamples.map((example) => example.actorRole)).toEqual(expect.arrayContaining(['student', 'teacher', 'mode']));
    expect(pkg.apiExamples.find((example) => example.path === '/api/learning-paths/plan')?.actorRole).toBe('teacher');
    expect(pkg.apiExamples.map((example) => example.path)).toContain(
      '/api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute',
    );
    expect(validateIntelligentTeachingAssistantDemoPackage(pkg)).toEqual([]);
  });

  it('installs deterministic records and safely resets existing demo state', () => {
    const firstInstall = installIntelligentTeachingAssistantDemoFixtures();
    const secondInstall = installIntelligentTeachingAssistantDemoFixtures(firstInstall.state);

    expect(firstInstall.upsertedIds).toContain('demo-ita-class');
    expect(firstInstall.upsertedIds).toContain('path-alpha-main');
    expect(firstInstall.upsertedIds).toContain('grading-alpha-draft');
    expect(firstInstall.upsertedIds).toContain('prep-pack-demo-ita');
    expect(firstInstall.state.records.map((record) => record.type)).toEqual(expect.arrayContaining([
      'goal',
      'learner-state-slice',
      'assignment',
      'document-submission',
      'citation',
      'student-feedback',
      'konling-session',
      'teacher-report',
    ]));
    expect(new Set(firstInstall.upsertedIds).size).toBe(firstInstall.upsertedIds.length);
    expect(secondInstall.resetDeletedIds.sort()).toEqual(firstInstall.upsertedIds.slice().sort());
    expect(secondInstall.state.records).toEqual(firstInstall.state.records);
  });

  it('seeds the upgraded closed-loop records required by the final demo package', () => {
    const install = installIntelligentTeachingAssistantDemoFixtures();
    const recordTypes = new Set(install.state.records.map((record) => record.type));

    expect([...recordTypes]).toEqual(expect.arrayContaining([
      'document-submission',
      'document-conversion',
      'grading-run',
      'teacher-approval',
      'writeback-preview',
      'diagnosis-snapshot',
      'path-option',
      'konling-citation',
      'prep-pack-overlay',
      'effect-report-export',
      'effect-report-metric',
    ]));
    expect(INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.prepPackOverlays).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourcePrepPackId: 'prep-pack-demo-ita',
        status: 'active',
        activatedByTeacherId: 'demo-teacher-ita',
        baseManifestMutated: false,
      }),
    ]));
    const effectExportRecord = install.state.records.find((record) => record.type === 'effect-report-export');
    expect(effectExportRecord).toMatchObject({
      id: 'effect-report-demo-ita-export',
      payload: { id: 'effect-report-demo-ita-export', redacted: true },
    });
    expect(validateIntelligentTeachingAssistantDemoPackage()).toEqual([]);
  });

  it('builds a source-backed effect report export with synthetic caveats for every metric', () => {
    const effectReport = buildIntelligentTeachingAssistantEffectReportExport();

    expect(effectReport.syntheticOnly).toBe(true);
    expect(effectReport.goalId).toBe('control-correction');
    expect(effectReport.export.route).toBe('/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true');
    expect(effectReport.metrics.map((metric) => metric.id)).toEqual([
      'gradingTimeSaved',
      'teacherEditRate',
      'pathAdoption',
      'secondAttemptImprovement',
      'userFeedbackQuality',
    ]);
    for (const metric of effectReport.metrics) {
      expect(metric.definition).toBeTruthy();
      expect(metric.numerator).toBeTruthy();
      expect(metric.denominator).toBeTruthy();
      expect(metric.sourceWindow).toMatch(/2026-06-05T00:00:00.000Z/);
      expect(metric.sourceReferences.length).toBeGreaterThan(0);
      expect(metric.exclusions.length).toBeGreaterThan(0);
      expect(metric.caveats).toEqual(expect.arrayContaining([
        'Synthetic fixture metric for demo readiness; not a measured learning-gain claim.',
      ]));
    }
  });

  it('requires privacy-reviewed metadata before real evidence can be imported into effect reports', () => {
    const broken = structuredClone(INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE);
    broken.realEvidenceImports = [{
      id: 'real-import-without-review',
      status: 'available',
      sourceFamily: 'classroom-feedback',
      consentOrAuthorizationRef: '',
      privacyReviewRef: '',
      separatedFromSyntheticFixtures: false,
      importedAt: '2026-06-05T12:00:00.000Z',
    }];
    broken.effectReports[0].metrics[0].sourceReferences = [];

    expect(validateIntelligentTeachingAssistantDemoPackage(broken)).toEqual(expect.arrayContaining([
      'real evidence imports require privacy review, authorization, and synthetic separation metadata',
      'effect report metrics require definitions, source windows, source references, exclusions, caveats, and synthetic labels',
    ]));
  });

  it('preserves same-tenant records that are not owned by the demo package', () => {
    const firstInstall = installIntelligentTeachingAssistantDemoFixtures();
    const nonDemoRecord = {
      type: 'class',
      id: 'same-tenant-non-demo-record',
      scope: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.fixtureScope.tenantId,
      payload: { classId: 'non-demo-class', syntheticOnly: false },
    };
    const secondInstall = installIntelligentTeachingAssistantDemoFixtures({
      records: [...firstInstall.state.records, nonDemoRecord],
    });

    expect(secondInstall.resetDeletedIds).not.toContain(nonDemoRecord.id);
    expect(secondInstall.state.records).toEqual(expect.arrayContaining([nonDemoRecord]));
  });

  it('rejects same-scope non-demo record collisions before installing fixtures', () => {
    expect(() => installIntelligentTeachingAssistantDemoFixtures({
      records: [{
        type: 'class',
        id: 'demo-ita-class',
        scope: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.fixtureScope.tenantId,
        payload: { classId: 'demo-ita-class', syntheticOnly: false },
      }],
    })).toThrow('Cannot install intelligent teaching assistant demo fixtures over non-demo record class:demo-ita-class');
  });

  it('covers diagnosis, paths, grading, reports, prep packs, citations, and all Konling modes', () => {
    const pkg = INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE;
    const modes = pkg.konlingSessions.map((session) => session.modeId);

    expect(pkg.diagnosisViews.map((view) => view.role)).toEqual(expect.arrayContaining([
      'student',
      'teacher-class',
      'teacher-student',
    ]));
    expect(pkg.pathPlans.some((path) => path.alternatives.length > 0)).toBe(true);
    expect(pkg.goals.some((goal) => goal.id === 'control-correction' && goal.registered)).toBe(true);
    expect(pkg.learnerStateSlices.every((slice) => (
      pkg.pathPlans.some((path) => path.id === slice.activePathId)
    ))).toBe(true);
    expect(pkg.assignments.every((assignment) => assignment.synthetic && assignment.documentIds.length > 0)).toBe(true);
    expect(pkg.citationRecords.length).toBeGreaterThanOrEqual(7);
    expect(pkg.resourceExecutions.every((execution) => execution.konlingMode === 'resource-coach')).toBe(true);
    expect(pkg.gradingRuns.every((run) => run.feedbackVisible && run.redactedExport)).toBe(true);
    expect(pkg.teacherReports[0].export.omits).toEqual(expect.arrayContaining([
      'raw answer bodies',
      'private memory',
      'hidden Arena internals',
      'raw traces',
      'plaintext secrets',
    ]));
    expect(pkg.prepPacks.every((pack) => pack.serverContextSigned)).toBe(true);
    expect(modes).toEqual(expect.arrayContaining([
      'generic-chat',
      'diagnosis-explainer',
      'path-advisor',
      'resource-coach',
      'grading-assistant',
      'feedback-explainer',
      'class-summarizer',
      'prep-coauthor',
    ]));
    expect(pkg.konlingSessions.every((session) => (
      session.citations.length > 0 && session.unavailableStateCovered
    ))).toBe(true);
  });

  it('rejects private data, raw payloads, missing citations, and plaintext provider secrets', () => {
    const broken = structuredClone(INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE);
    broken.konlingSessions[0].citations = [];
    broken.providerExamples[0].secretRef = 'sk-demo-plaintext';
    (broken.gradingRuns[0] as unknown as { redactedExport: boolean }).redactedExport = false;
    (broken.teacherReports[0].export as unknown as { rawAnswerBodies: string; privateMemory: string; token: string }).rawAnswerBodies = 'student raw answer body';
    (broken.teacherReports[0].export as unknown as { rawAnswerBodies: string; privateMemory: string; token: string }).privateMemory = 'private Konling memory';
    (broken.teacherReports[0].export as unknown as { rawAnswerBodies: string; privateMemory: string; token: string }).token = 'sk-demo-export-secret';
    (broken as unknown as { originalAnswer: string }).originalAnswer = 'student raw answer body';
    (broken as unknown as { privateMemory: string }).privateMemory = 'private Konling memory';
    (broken as unknown as { evaluatorInternals: string }).evaluatorInternals = 'hidden Arena evaluator internals';

    expect(validateIntelligentTeachingAssistantDemoPackage(broken)).toEqual(expect.arrayContaining([
      'Konling sessions require citations and unavailable-state coverage',
      'grading runs require visible feedback, citations, and redacted exports',
      'provider examples must use env secret refs and declare tool, streaming, and citation support',
      expect.stringContaining('forbidden private or secret pattern'),
    ]));
  });

  it('fails when metrics, routes, mode coverage, or rollback prerequisites drift', () => {
    const broken = structuredClone(INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE);
    broken.teacherReports[0].metrics[0].value = 0.1;
    broken.routeChecks[0].route = '/not-a-demo-route';
    broken.apiExamples[0].path = '/api/not-real';
    broken.konlingSessions = broken.konlingSessions.filter((session) => session.modeId !== 'prep-coauthor');
    (broken.prepPacks[0] as unknown as { serverContextSigned: boolean }).serverContextSigned = false;

    expect(validateIntelligentTeachingAssistantDemoPackage(broken)).toEqual(expect.arrayContaining([
      'teacher report metrics require methodology and recomputable values',
      'route checks must cover known demo product surfaces',
      'API examples must cover known demo API contracts',
      'Konling sessions must cover all required teaching assistant modes',
      'prep packs require signed server context, review items, and citations',
    ]));

    const duplicateRoute = structuredClone(INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE);
    duplicateRoute.routeChecks[1] = { ...duplicateRoute.routeChecks[0] };
    duplicateRoute.apiExamples[1] = { ...duplicateRoute.apiExamples[0] };
    expect(validateIntelligentTeachingAssistantDemoPackage(duplicateRoute)).toEqual(expect.arrayContaining([
      'route checks must cover known demo product surfaces',
      'API examples must cover known demo API contracts',
    ]));
  });

  it('produces an acceptance report covering fixtures, product surfaces, modes, privacy, and rollback', () => {
    const report = buildIntelligentTeachingAssistantDemoAcceptanceReport();

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.checks.map((check) => check.id)).toEqual([
      'fixtures.synthetic-resettable',
      'student-path-diagnosis',
      'teacher-grading-report-prep',
      'konling-modes',
      'privacy-provider-rollback',
    ]);
    expect(report.checks.every((check) => check.ok)).toBe(true);
  });

  it('verifies rollback behavior through runtime configuration helpers', () => {
    const report = buildIntelligentTeachingAssistantDemoRollbackReport();

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual([
      'rollback.ai-provider-disabled',
      'rollback.mode-context-secret-removed',
      'rollback.demo-tenant-cleanup-selector',
    ]);
  });

  it('documents storyline, setup, checks, privacy, provider setup, rollback, and limitations', () => {
    const docs = readFileSync(
      join(process.cwd(), 'docs/intelligent-teaching-assistant-demo-package.md'),
      'utf8',
    );

    for (const section of [
      '## Demo Storyline',
      '## Setup And Reset',
      '## Route Checks',
      '## API Examples',
      '## Metric Methodology',
      '## Provider Configuration',
      '## Privacy And Citation Controls',
      '## Deployment And Rollback',
      '## Release Readiness',
    ]) {
      expect(docs).toContain(section);
    }
    expect(docs).toContain('rtk npm run test:intelligent-teaching-assistant-demo');
  });

  it('does not define duplicate npm script keys for the demo command', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    const duplicateScriptKeys = duplicateKeysInObject(packageJson, 'scripts');

    expect(duplicateScriptKeys).not.toContain('test:intelligent-teaching-assistant-demo');
  });

  it('does not accept auth-boundary responses when require-http demands visible product surfaces', () => {
    expect(acceptsIntelligentTeachingAssistantDemoAuthBoundary({
      status: 401,
      authenticated: false,
      requireProductSurface: true,
    })).toBe(false);
    expect(acceptsIntelligentTeachingAssistantDemoAuthBoundary({
      status: 403,
      authenticated: false,
      requireProductSurface: true,
    })).toBe(false);
    expect(acceptsIntelligentTeachingAssistantDemoAuthBoundary({
      status: 401,
      authenticated: false,
      requireProductSurface: false,
    })).toBe(true);
    expect(isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(200)).toBe(true);
    expect(isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(299)).toBe(true);
    expect(isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(302)).toBe(false);
    expect(isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(401)).toBe(false);
    expect(isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(403)).toBe(false);
  });

  it('rejects credentialed HTTP acceptance targets outside loopback or explicit HTTPS allowlist', () => {
    expect(validateIntelligentTeachingAssistantDemoHttpTarget('https://attacker.example').errors).toContain(
      'HTTP acceptance target must be loopback or match INTELLIGENT_TEACHING_ASSISTANT_DEMO_ALLOWED_ORIGIN before credentials are sent',
    );
    expect(validateIntelligentTeachingAssistantDemoHttpTarget('http://staging.example', 'http://staging.example').errors).toContain(
      'non-loopback allowed HTTP acceptance targets must use HTTPS',
    );
    expect(validateIntelligentTeachingAssistantDemoHttpTarget('http://127.0.0.1:3001').errors).toEqual([]);
    expect(validateIntelligentTeachingAssistantDemoHttpTarget('https://staging.example', 'https://staging.example').errors).toEqual([]);
  });

  it('rejects grading approval fake success and accepts only cited AI chat SSE streams', () => {
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/teacher/document-grading/approve',
      JSON.stringify({
        status: 'returned',
        gradingRunId: 'grading-alpha-draft',
        createdFacts: 0,
        evidenceSourceEventIds: [],
      }),
    )).toEqual(expect.arrayContaining([
      'document grading approval response must confirm approved status',
      'document grading approval response must create evidence facts',
      'document grading approval response must include evidenceSourceEventIds',
    ]));
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/ai/chat',
      'data: {"type":"text-delta","textDelta":"cited synthetic answer","citations":[{"id":"cit-diagnosis-alpha","sourceFamily":"role-based-learning-diagnosis"}]}\n\n',
      'text/event-stream',
    )).toEqual([]);
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/ai/chat',
      'data: {"type":"text-delta","textDelta":"generic answer without sources"}\n\n',
      'text/event-stream',
    )).toEqual(['AI chat response is missing citation or evidence signal']);
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/ai/chat',
      'data: {"type":"text-delta","textDelta":"I cannot provide evidence for this answer."}\n\n',
      'text/event-stream',
    )).toEqual(['AI chat response is missing citation or evidence signal']);
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/ai/chat',
      JSON.stringify({
        id: 'chatcmpl-demo',
        messages: [{ role: 'assistant', content: 'I cannot provide evidence for this answer.' }],
      }),
      'application/json',
    )).toEqual(['AI chat response is missing citation or evidence signal']);
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/ai/chat',
      JSON.stringify({
        id: 'chatcmpl-demo',
        messages: [{ role: 'assistant', content: 'cited answer' }],
        citations: [{ id: 'cit-diagnosis-alpha', sourceFamily: 'role-based-learning-diagnosis' }],
      }),
      'application/json',
    )).toEqual([]);
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
      JSON.stringify({ report: { goalId: 'control-correction' }, export: { redacted: true } }),
    )).toEqual(expect.arrayContaining([
      'assistant effect report response is missing effectReport payload',
    ]));
    expect(validateIntelligentTeachingAssistantDemoApiPayload(
      '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
      JSON.stringify({ effectReport: buildIntelligentTeachingAssistantEffectReportExport() }),
    )).toEqual([]);
  });

  it('restores demo acceptance environment variables without leaving undefined strings', () => {
    const previous = snapshotDemoAcceptanceEnv();
    try {
      for (const key of DEMO_ACCEPTANCE_ENV_KEYS) delete process.env[key];
      const snapshot = snapshotDemoAcceptanceEnv();
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = 'http://127.0.0.1:3001';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_COOKIE = 'next-auth.session-token=demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE = 'next-auth.session-token=teacher-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE = 'next-auth.session-token=student-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';
      restoreDemoAcceptanceEnv(snapshot);

      for (const key of DEMO_ACCEPTANCE_ENV_KEYS) {
        expect(process.env[key]).toBeUndefined();
      }
    } finally {
      restoreDemoAcceptanceEnv(previous);
    }
  });

  it('rejects redirected route responses when HTTP product-surface checks are required', async () => {
    const server = createServer((request, response) => {
      if ((request.url ?? '/').startsWith('/login')) {
        response.setHeader('Content-Type', 'text/html');
        response.end('<main>class data-control-correction-center</main>');
        return;
      }
      response.statusCode = 302;
      response.setHeader('Location', '/login');
      response.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const previousEnv = snapshotDemoAcceptanceEnv();
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not bind to a TCP port');
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = `http://127.0.0.1:${address.port}`;
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE = 'next-auth.session-token=teacher-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE = 'next-auth.session-token=student-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';
      const errors = await runIntelligentTeachingAssistantDemoAcceptance(['test', '--require-http']);

      expect(errors).toContain('route check failed: /assessment/adaptive-practice?goal=control-correction');
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      restoreDemoAcceptanceEnv(previousEnv);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('does not send credentials when the HTTP acceptance target is rejected', async () => {
    const previousEnv = snapshotDemoAcceptanceEnv();
    const previousFetch = globalThis.fetch;
    let fetchCalls = 0;
    try {
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = 'https://attacker.example';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE = 'next-auth.session-token=teacher-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE = 'next-auth.session-token=student-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';
      globalThis.fetch = (() => {
        fetchCalls += 1;
        throw new Error('fetch should not be called for rejected targets');
      }) as typeof fetch;

      const errors = await runIntelligentTeachingAssistantDemoAcceptance(['test', '--require-http']);

      expect(errors).toContain(
        'HTTP acceptance target must be loopback or match INTELLIGENT_TEACHING_ASSISTANT_DEMO_ALLOWED_ORIGIN before credentials are sent',
      );
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = previousFetch;
      restoreDemoAcceptanceEnv(previousEnv);
    }
  });

  it('requires role-specific cookies when product-surface HTTP acceptance is required', async () => {
    const previousEnv = snapshotDemoAcceptanceEnv();
    try {
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = 'http://127.0.0.1:3001';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_COOKIE = 'next-auth.session-token=generic-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';

      const errors = await runIntelligentTeachingAssistantDemoAcceptance(['test', '--require-http']);

      expect(errors).toEqual(expect.arrayContaining([
        'INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE is required for authenticated teacher HTTP acceptance',
        'INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE is required for authenticated student HTTP acceptance',
      ]));
    } finally {
      restoreDemoAcceptanceEnv(previousEnv);
    }
  });

  it('rejects class and student insight routes without ready status semantics', async () => {
    const server = createServer((request, response) => {
      const url = request.url ?? '/';
      if (url.includes('/analytics-v2')) {
        response.setHeader('Content-Type', 'text/html');
        response.end('<main><h1>班级学情总览</h1></main>');
        return;
      }
      if (url.includes('/students/demo-ita-student-beta')) {
        response.setHeader('Content-Type', 'text/html');
        response.end('<main><h2>证据摘要</h2></main>');
        return;
      }
      if (writeSuccessfulDemoAcceptanceResponse(url, response)) return;
      response.statusCode = 404;
      response.end('{"error":"not found"}');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const previousEnv = snapshotDemoAcceptanceEnv();
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not bind to a TCP port');
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = `http://127.0.0.1:${address.port}`;
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE = 'next-auth.session-token=teacher-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE = 'next-auth.session-token=student-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';
      const errors = await runIntelligentTeachingAssistantDemoAcceptance(['test', '--require-http']);

      expect(errors).toEqual(expect.arrayContaining([
        expect.stringContaining('route check failed: /teacher/classes/demo-ita-class/analytics-v2 (ready status semantics missing)'),
        expect.stringContaining('route check failed: /teacher/classes/demo-ita-class/students/demo-ita-student-beta (ready status semantics missing)'),
      ]));
    } finally {
      restoreDemoAcceptanceEnv(previousEnv);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('fails HTTP product-surface checks when insight backing APIs are unavailable', async () => {
    const server = createServer((request, response) => {
      const url = request.url ?? '/';
      if (
        url === '/api/teacher/classes/demo-ita-class/insights' ||
        url === '/api/teacher/classes/demo-ita-class/heatmap' ||
        url === '/api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights'
      ) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json');
        response.end('{"error":"backing API unavailable"}');
        return;
      }
      if (url.includes('/analytics-v2')) {
        response.setHeader('Content-Type', 'text/html');
        response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics" data-operations-status-semantics="loading">加载班级学情总览...</main>');
        return;
      }
      if (url.includes('/students/demo-ita-student-beta')) {
        response.setHeader('Content-Type', 'text/html');
        response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-student-insights" data-operations-status-semantics="loading">加载学生学情...</main>');
        return;
      }
      response.setHeader('Content-Type', 'text/html');
      response.end('<main data-control-correction-center data-intelligent-teaching-assistant-demo-surface="document-grading-workbench">报告评分工作台</main>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const previousEnv = snapshotDemoAcceptanceEnv();
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not bind to a TCP port');
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = `http://127.0.0.1:${address.port}`;
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE = 'next-auth.session-token=teacher-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE = 'next-auth.session-token=student-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';
      const errors = await runIntelligentTeachingAssistantDemoAcceptance(['test', '--require-http']);

      expect(errors).toEqual(expect.arrayContaining([
        expect.stringContaining('API check failed: GET /api/teacher/classes/demo-ita-class/insights'),
        expect.stringContaining('API check failed: GET /api/teacher/classes/demo-ita-class/heatmap'),
        expect.stringContaining('API check failed: GET /api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights'),
      ]));
    } finally {
      restoreDemoAcceptanceEnv(previousEnv);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('rejects loading shell route responses even when insight backing APIs are healthy', async () => {
    const server = createServer((request, response) => {
      const url = request.url ?? '/';
      response.setHeader('Content-Type', 'application/json');
      if (url.startsWith('/api/adaptive/learner-state')) {
        response.end(JSON.stringify({
          goalSlices: {
            controlCorrection: {
              goalId: 'control-correction',
              dimensions: [{ id: 'parameterDesign', score: 0.72 }],
              pathContext: { activePathId: 'path-alpha-main', noActivePath: false },
            },
          },
        }));
        return;
      }
      if (url === '/api/learning-paths/plan') {
        response.end(JSON.stringify({ path: { id: 'demo-path-demo-ita-student-alpha-control-correction', goalId: 'control-correction' } }));
        return;
      }
      if (url === '/api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute') {
        response.end(JSON.stringify({ execution: { nodeId: 'simulation:control-correction-step-response-lab' }, cacheRefresh: { ok: true } }));
        return;
      }
      if (url === '/api/teacher/document-grading/approve') {
        response.end(JSON.stringify({ status: 'approved', gradingRunId: 'grading-alpha-draft', createdFacts: 1, evidenceSourceEventIds: ['event-1'] }));
        return;
      }
      if (url === '/api/ai/chat') {
        response.setHeader('Content-Type', 'text/event-stream');
        response.end('data: {"type":"text-delta","textDelta":"cited synthetic answer","citations":[{"id":"cit-diagnosis-alpha","sourceFamily":"role-based-learning-diagnosis"}]}\n\n');
        return;
      }
      if (url.startsWith('/api/teacher/classes/demo-ita-class/control-correction-report')) {
        response.end(JSON.stringify({ report: { goalId: 'control-correction' }, export: { redacted: true } }));
        return;
      }
      if (url.startsWith('/api/teacher/classes/demo-ita-class/assistant-effect-report')) {
        response.end(JSON.stringify({ effectReport: buildIntelligentTeachingAssistantEffectReportExport() }));
        return;
      }
      if (url === '/api/teacher/classes/demo-ita-class/insights') {
        response.end(JSON.stringify({
          classInfo: { id: 'demo-ita-class' },
          students: [{ id: 'demo-ita-student-beta' }],
          spotlightStudents: [{ id: 'demo-ita-student-beta' }],
          governance: { coveredStudents: 3 },
        }));
        return;
      }
      if (url === '/api/teacher/classes/demo-ita-class/heatmap') {
        response.end(JSON.stringify({
          students: [{ id: 'demo-ita-student-beta' }],
          dimensions: ['parameterDesign'],
          matrix: [{ studentId: 'demo-ita-student-beta', dimension: 'parameterDesign', score: 72 }],
        }));
        return;
      }
      if (url === '/api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights') {
        response.end(JSON.stringify({
          student: { id: 'demo-ita-student-beta' },
          overview: { overallScore: 72 },
          evidenceSummary: [{ dimension: 'parameterDesign' }],
        }));
        return;
      }
      response.setHeader('Content-Type', 'text/html');
      if (url.startsWith('/assessment/adaptive-practice')) {
        response.end('<main data-control-correction-center></main>');
        return;
      }
      if (url.startsWith('/teacher/grading-workbench')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="document-grading-workbench">报告评分工作台</main>');
        return;
      }
      if (url.startsWith('/assessment/document-feedback')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="document-feedback">报告反馈</main>');
        return;
      }
      if (url.includes('/analytics-v2')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics">加载班级学情总览...</main>');
        return;
      }
      if (url.includes('/students/demo-ita-student-beta')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-student-insights">加载学生学情...</main>');
        return;
      }
      response.statusCode = 404;
      response.end('{"error":"not found"}');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const previousEnv = snapshotDemoAcceptanceEnv();
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not bind to a TCP port');
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = `http://127.0.0.1:${address.port}`;
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE = 'next-auth.session-token=teacher-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE = 'next-auth.session-token=student-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';
      const errors = await runIntelligentTeachingAssistantDemoAcceptance(['test', '--require-http']);

      expect(errors).toEqual(expect.arrayContaining([
        expect.stringContaining('route check failed: /teacher/classes/demo-ita-class/analytics-v2 (加载班级学情总览 shell marker present; ready status semantics missing)'),
        expect.stringContaining('route check failed: /teacher/classes/demo-ita-class/students/demo-ita-student-beta (加载学生学情 shell marker present; ready status semantics missing)'),
      ]));
    } finally {
      restoreDemoAcceptanceEnv(previousEnv);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('drives the HTTP acceptance CLI through real route, API, and Konling mode contracts', async () => {
    const received: Array<{ method: string; path: string; body: unknown }> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = rawBody ? JSON.parse(rawBody) as unknown : null;
      const url = request.url ?? '/';
      received.push({ method: request.method ?? 'GET', path: url, body });
      response.setHeader('Content-Type', 'application/json');

      if (url.startsWith('/assessment/adaptive-practice')) {
        response.end('{"marker":"data-control-correction-center"}');
        return;
      }
      if (url.startsWith('/api/adaptive/learner-state')) {
        response.end(JSON.stringify({
          goalSlices: {
            controlCorrection: {
              goalId: 'control-correction',
              dimensions: [{ id: 'parameterDesign', score: 0.72 }],
              pathContext: { activePathId: 'path-alpha-main', noActivePath: false },
            },
          },
        }));
        return;
      }
      if (url === '/api/learning-paths/plan') {
        response.end(JSON.stringify({ path: { id: 'demo-path-demo-ita-student-alpha-control-correction', goalId: 'control-correction' } }));
        return;
      }
      if (url === '/api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute') {
        response.end(JSON.stringify({ execution: { nodeId: 'simulation:control-correction-step-response-lab' }, cacheRefresh: { ok: true } }));
        return;
      }
      if (url === '/api/teacher/document-grading/approve') {
        response.end(JSON.stringify({ status: 'approved', gradingRunId: 'grading-alpha-draft', createdFacts: 1, evidenceSourceEventIds: ['event-1'] }));
        return;
      }
      if (url === '/api/ai/chat') {
        response.setHeader('Content-Type', 'text/event-stream');
        response.end('data: {"type":"text-delta","textDelta":"cited synthetic answer","citations":[{"id":"cit-diagnosis-alpha","sourceFamily":"role-based-learning-diagnosis"}]}\n\n');
        return;
      }
      if (url.startsWith('/api/teacher/classes/demo-ita-class/control-correction-report')) {
        response.end(JSON.stringify({ report: { goalId: 'control-correction' }, export: { redacted: true } }));
        return;
      }
      if (url.startsWith('/api/teacher/classes/demo-ita-class/assistant-effect-report')) {
        response.end(JSON.stringify({ effectReport: buildIntelligentTeachingAssistantEffectReportExport() }));
        return;
      }
      if (url === '/api/teacher/classes/demo-ita-class/insights') {
        response.end(JSON.stringify({
          classInfo: { id: 'demo-ita-class', name: 'demo class', studentCount: 3 },
          students: [{ id: 'demo-ita-student-beta', name: 'Beta' }],
          spotlightStudents: [{ id: 'demo-ita-student-beta', name: 'Beta' }],
          governance: { totalStudents: 3, coveredStudents: 3 },
        }));
        return;
      }
      if (url === '/api/teacher/classes/demo-ita-class/heatmap') {
        response.end(JSON.stringify({
          students: [{ id: 'demo-ita-student-beta', name: 'Beta', avatar: null, studentNumber: 'B-01' }],
          dimensions: ['parameterDesign'],
          matrix: [{ studentId: 'demo-ita-student-beta', dimension: 'parameterDesign', score: 72, change: 3, riskLevel: 'low' }],
          lastUpdated: '2026-06-05T00:00:00.000Z',
        }));
        return;
      }
      if (url === '/api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights') {
        response.end(JSON.stringify({
          student: { id: 'demo-ita-student-beta', name: 'Beta', classId: 'demo-ita-class', className: 'demo class' },
          overview: { overallScore: 72, riskLevel: 'low', riskLabel: '低风险', factCount: 4 },
          evidenceSummary: [{ dimension: 'parameterDesign', label: '参数设计', items: [{ factType: 'diagnosis', outcome: 'needs-practice' }] }],
        }));
        return;
      }
      if (url.startsWith('/teacher/grading-workbench')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="document-grading-workbench">报告评分工作台</main>');
        return;
      }
      if (url.startsWith('/assessment/document-feedback')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="document-feedback">报告反馈</main>');
        return;
      }
      if (url.includes('/analytics-v2')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics" data-operations-status-semantics="ready"><h1>班级学情总览</h1></main>');
        return;
      }
      if (url.includes('/students/demo-ita-student-beta')) {
        response.end('<main data-intelligent-teaching-assistant-demo-surface="teacher-student-insights" data-operations-status-semantics="ready"><h2>证据摘要</h2></main>');
        return;
      }
      response.statusCode = 404;
      response.end('{"error":"not found"}');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const previousEnv = snapshotDemoAcceptanceEnv();
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('test server did not bind to a TCP port');
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL = `http://127.0.0.1:${address.port}`;
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE = 'next-auth.session-token=teacher-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE = 'next-auth.session-token=student-demo';
      process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED = 'true';
      const errors = await runIntelligentTeachingAssistantDemoAcceptance(['test', '--require-http']);
      expect(errors).toEqual([]);
    } finally {
      restoreDemoAcceptanceEnv(previousEnv);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    expect(received.map((entry) => entry.path)).not.toContain('/teacher/classes/demo-ita-class');
    const planBody = received.find((entry) => entry.path === '/api/learning-paths/plan')?.body as Record<string, unknown>;
    expect(planBody).toMatchObject({
      classId: 'demo-ita-class',
      plan: {
        id: 'demo-path-demo-ita-student-alpha-control-correction',
        userId: 'demo-ita-student-alpha',
        goal: { id: 'control-correction' },
      },
    });
    expect(received.find((entry) => entry.path === '/api/learning-paths/demo-path-demo-ita-student-alpha-control-correction/execute')?.body).toMatchObject({
      nodeId: 'simulation:control-correction-step-response-lab',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'ita-demo-execution-alpha',
    });
    expect(received.find((entry) => entry.path === '/api/teacher/document-grading/approve')?.body).toMatchObject({
      gradingRunId: 'grading-alpha-draft',
      syntheticOnly: true,
    });
    const aiBodies = received
      .filter((entry) => entry.path === '/api/ai/chat')
      .map((entry) => entry.body as Record<string, unknown>);
    expect(aiBodies.map((body) => body.teachingAssistantModeId)).toEqual(expect.arrayContaining(
      INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.konlingSessions.map((session) => session.modeId),
    ));
    expect(aiBodies.every((body) => Array.isArray(body.messages) && body.courseId && body.pageId)).toBe(true);
    expect(aiBodies.every((body) => {
      const hints = body.modeClientContextHints;
      return Boolean(
        hints && typeof hints === 'object' && !Array.isArray(hints)
        && (hints as Record<string, unknown>).requireCitations === true
        && Array.isArray((hints as Record<string, unknown>).expectedCitationIds),
      );
    })).toBe(true);
  });
});

function duplicateKeysInObject(jsonText: string, objectKey: string): string[] {
  const objectMatch = new RegExp(`"${objectKey}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm').exec(jsonText);
  if (!objectMatch) return [];
  const keys = [...objectMatch[1].matchAll(/^\s*"([^"]+)"\s*:/gm)].map((match) => match[1]);
  return keys.filter((key, index) => keys.indexOf(key) !== index);
}
