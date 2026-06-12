import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  type AssistantDemoActorRole,
  INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE,
  buildIntelligentTeachingAssistantDemoAcceptanceReport,
} from '../../src/lib/data-governance/intelligent-teaching-assistant-demo-package';

const repoRoot = process.cwd();
const docsPath = join(repoRoot, 'docs/intelligent-teaching-assistant-demo-package.md');
const docs = readFileSync(docsPath, 'utf8');
const requiredSections = [
  '## Demo Storyline',
  '## Setup And Reset',
  '## Route Checks',
  '## API Examples',
  '## Metric Methodology',
  '## Provider Configuration',
  '## Privacy And Citation Controls',
  '## Deployment And Rollback',
  '## Release Readiness',
];

function readRoleCookie(actorRole: AssistantDemoActorRole): string {
  const specific = actorRole === 'teacher'
    ? process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE?.trim()
    : process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE?.trim();
  return specific || process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_COOKIE?.trim() || '';
}

function buildHttpHeaders(method: 'GET' | 'POST', actorRole: AssistantDemoActorRole): HeadersInit {
  const headers: Record<string, string> = {};
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  const cookie = readRoleCookie(actorRole);
  if (cookie) headers.Cookie = cookie;
  return headers;
}

function hasAuthCredentials(actorRole: AssistantDemoActorRole): boolean {
  return Boolean(readRoleCookie(actorRole));
}

function requiredRoleCredentialErrors(): string[] {
  const teacherCookie = process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE?.trim();
  const studentCookie = process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE?.trim();
  return [
    teacherCookie ? null : 'INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE is required for authenticated teacher HTTP acceptance',
    studentCookie ? null : 'INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE is required for authenticated student HTTP acceptance',
  ].filter((error): error is string => Boolean(error));
}

function unsupportedAuthErrors(): string[] {
  return process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_BEARER?.trim()
    ? ['INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_BEARER is not supported; use role-specific NextAuth cookies']
    : [];
}

function demoFixturesInstalled(): boolean {
  return process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED?.trim() === 'true';
}

export function acceptsIntelligentTeachingAssistantDemoAuthBoundary(input: {
  status: number;
  authenticated: boolean;
  requireProductSurface: boolean;
  redirectedToLogin?: boolean;
}): boolean {
  return !input.requireProductSurface
    && !input.authenticated
    && (input.status === 401 || input.status === 403 || input.redirectedToLogin === true);
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

export function validateIntelligentTeachingAssistantDemoHttpTarget(
  baseUrl: string,
  allowedOrigin = process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_ALLOWED_ORIGIN?.trim(),
): { url: URL | null; errors: string[] } {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { url: null, errors: ['INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL is not a valid URL'] };
  }

  const loopback = isLoopbackHost(url.hostname);
  const explicitlyAllowed = Boolean(allowedOrigin && url.origin === allowedOrigin);
  const errors = [
    loopback || explicitlyAllowed ? null : 'HTTP acceptance target must be loopback or match INTELLIGENT_TEACHING_ASSISTANT_DEMO_ALLOWED_ORIGIN before credentials are sent',
    !explicitlyAllowed || url.protocol === 'https:' ? null : 'non-loopback allowed HTTP acceptance targets must use HTTPS',
  ].filter((error): error is string => Boolean(error));

  return { url, errors };
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => readObject(current)[key], value);
}

const citationSignalKeys = new Set([
  'citation',
  'citations',
  'citationId',
  'citationIds',
  'source',
  'sources',
  'sourceFamily',
  'source_family',
  'sourceId',
  'source_id',
  'evidenceSource',
  'evidenceSources',
  'evidenceSourceEventId',
  'evidenceSourceEventIds',
]);

function hasCitationSignal(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasCitationSignal(item));
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => (
    citationSignalKeys.has(key) && (
      Array.isArray(entry) ? entry.length > 0 : Boolean(entry)
    )
  ) || hasCitationSignal(entry));
}

function parseSseJsonPayloads(body: string): unknown[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter((line) => line && line !== '[DONE]')
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return null;
      }
    })
    .filter((payload): payload is unknown => payload !== null);
}

export function validateIntelligentTeachingAssistantDemoApiPayload(path: string, body: string, contentType = ''): string[] {
  if (path === '/api/ai/chat') {
    if (contentType.includes('text/event-stream')) {
      const hasStreamChunks = body.trim().length > 0 && /(?:^|\n)(?:data:|event:|[0-9]+:)/.test(body);
      const ssePayloads = parseSseJsonPayloads(body);
      return [
        hasStreamChunks ? null : 'AI chat stream response is missing SSE/UI message chunks',
        ssePayloads.some((payload) => hasCitationSignal(payload)) ? null : 'AI chat response is missing citation or evidence signal',
      ].filter((error): error is string => Boolean(error));
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return [`${path} response is not valid JSON or SSE`];
    }
    return [
      readPath(payload, ['error']) === 'KONLING_MODE_UNAVAILABLE' ? 'AI chat mode unexpectedly unavailable' : null,
      readPath(payload, ['messages']) || readPath(payload, ['id']) || readPath(payload, ['text']) || readPath(payload, ['content'])
        ? null
        : 'AI chat response is missing controlled mode or message payload',
      hasCitationSignal(payload) ? null : 'AI chat response is missing citation or evidence signal',
    ].filter((error): error is string => Boolean(error));
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return [`${path} response is not valid JSON`];
  }

  if (path.startsWith('/api/adaptive/learner-state')) {
    const goalSlice = readPath(payload, ['goalSlices', 'controlCorrection']);
    const dimensions = readPath(goalSlice, ['dimensions']);
    const pathContext = readPath(goalSlice, ['pathContext']);
    return [
      readPath(goalSlice, ['goalId']) === 'control-correction' ? null : 'learner-state response is missing control-correction goalId',
      Array.isArray(dimensions) && dimensions.length > 0 ? null : 'learner-state response is missing control-correction dimensions',
      typeof readPath(pathContext, ['noActivePath']) === 'boolean' && (
        readPath(pathContext, ['noActivePath']) === true || typeof readPath(pathContext, ['activePathId']) === 'string'
      ) ? null : 'learner-state response is missing path context',
    ].filter((error): error is string => Boolean(error));
  }

  if (path === '/api/learning-paths/plan') {
    return [
      readPath(payload, ['path', 'goalId']) === 'control-correction' ? null : 'path plan response is missing control-correction goalId',
      readPath(payload, ['path', 'id']) ? null : 'path plan response is missing path id',
    ].filter((error): error is string => Boolean(error));
  }

  if (path.includes('/api/learning-paths/') && path.endsWith('/execute')) {
    return [
      readPath(payload, ['execution', 'nodeId']) ? null : 'path execution response is missing execution node id',
      readPath(payload, ['cacheRefresh']) ? null : 'path execution response is missing cache refresh status',
    ].filter((error): error is string => Boolean(error));
  }

  if (path.includes('/control-correction-report')) {
    return [
      readPath(payload, ['report', 'goalId']) === 'control-correction' ? null : 'teacher report response is missing control-correction goalId',
      path.includes('export=true') && !readPath(payload, ['export']) ? 'teacher report export payload is missing' : null,
    ].filter((error): error is string => Boolean(error));
  }

  if (path.includes('/assistant-effect-report')) {
    const effectReport = readObject(readPath(payload, ['effectReport']));
    const metrics = readPath(effectReport, ['metrics']);
    const metricIds = Array.isArray(metrics)
      ? metrics.map((metric) => readPath(metric, ['id']))
      : [];
    return [
      Object.keys(effectReport).length > 0 ? null : 'assistant effect report response is missing effectReport payload',
      readPath(effectReport, ['goalId']) === 'control-correction' ? null : 'assistant effect report response is missing control-correction goalId',
      readPath(effectReport, ['syntheticOnly']) === true ? null : 'assistant effect report response must be syntheticOnly',
      ['gradingTimeSaved', 'teacherEditRate', 'pathAdoption', 'secondAttemptImprovement', 'userFeedbackQuality'].every((id) => metricIds.includes(id))
        ? null
        : 'assistant effect report response is missing required effect metrics',
      Array.isArray(metrics) && metrics.every((metric) => (
        readPath(metric, ['definition']) &&
        readPath(metric, ['numerator']) &&
        readPath(metric, ['denominator']) &&
        readPath(metric, ['sourceWindow']) &&
        Array.isArray(readPath(metric, ['sourceReferences'])) &&
        (readPath(metric, ['sourceReferences']) as unknown[]).length > 0 &&
        Array.isArray(readPath(metric, ['exclusions'])) &&
        Array.isArray(readPath(metric, ['caveats'])) &&
        readPath(metric, ['synthetic']) === true
      )) ? null : 'assistant effect report metrics require source-backed methodology and synthetic caveats',
    ].filter((error): error is string => Boolean(error));
  }

  if (path === '/api/teacher/classes/demo-ita-class/insights') {
    const students = readPath(payload, ['students']);
    const spotlightStudents = readPath(payload, ['spotlightStudents']);
    return [
      readPath(payload, ['classInfo', 'id']) === 'demo-ita-class' ? null : 'class insights response is missing demo class id',
      Array.isArray(students) && students.length > 0 ? null : 'class insights response is missing student roster',
      Array.isArray(spotlightStudents) ? null : 'class insights response is missing spotlight students',
      readPath(payload, ['governance']) ? null : 'class insights response is missing governance summary',
    ].filter((error): error is string => Boolean(error));
  }

  if (path === '/api/teacher/classes/demo-ita-class/heatmap') {
    const students = readPath(payload, ['students']);
    const dimensions = readPath(payload, ['dimensions']);
    const matrix = readPath(payload, ['matrix']);
    return [
      Array.isArray(students) && students.length > 0 ? null : 'heatmap response is missing students',
      Array.isArray(dimensions) && dimensions.length > 0 ? null : 'heatmap response is missing dimensions',
      Array.isArray(matrix) && matrix.length > 0 ? null : 'heatmap response is missing competency matrix',
    ].filter((error): error is string => Boolean(error));
  }

  if (path === '/api/teacher/classes/demo-ita-class/students/demo-ita-student-beta/insights') {
    const evidenceSummary = readPath(payload, ['evidenceSummary']);
    return [
      readPath(payload, ['student', 'id']) === 'demo-ita-student-beta' ? null : 'student insights response is missing demo student id',
      typeof readPath(payload, ['overview', 'overallScore']) === 'number' ? null : 'student insights response is missing overview score',
      Array.isArray(evidenceSummary) && evidenceSummary.length > 0 ? null : 'student insights response is missing evidence summary',
    ].filter((error): error is string => Boolean(error));
  }

  if (path === '/api/teacher/document-grading/approve') {
    return [
      readPath(payload, ['status']) === 'approved' ? null : 'document grading approval response must confirm approved status',
      readPath(payload, ['gradingRunId']) ? null : 'document grading approval response is missing gradingRunId',
      typeof readPath(payload, ['createdFacts']) === 'number' && Number(readPath(payload, ['createdFacts'])) > 0 ? null : 'document grading approval response must create evidence facts',
      Array.isArray(readPath(payload, ['evidenceSourceEventIds'])) && (readPath(payload, ['evidenceSourceEventIds']) as unknown[]).length > 0 ? null : 'document grading approval response must include evidenceSourceEventIds',
    ].filter((error): error is string => Boolean(error));
  }

  return [];
}

export function isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function buildApiBody(path: string, modeId?: string): string | undefined {
  if (path === '/api/learning-paths/plan') {
    const planId = 'demo-path-demo-ita-student-alpha-control-correction';
    return JSON.stringify({
      classId: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.class.id,
      learnerStateRef: 'learner-state-alpha',
      inputSnapshot: { fixtureScope: INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.fixtureScope.tenantId, syntheticOnly: true },
      demoPackage: 'intelligent-teaching-assistant',
      syntheticOnly: true,
      plan: {
        id: planId,
        userId: 'demo-ita-student-alpha',
        goal: { id: 'control-correction', title: 'Control correction' },
        mainPath: [
          { nodeId: 'simulation:control-correction-step-response-lab', type: 'simulation', status: 'next' },
        ],
      },
    });
  }
  if (path.includes('/api/learning-paths/') && path.endsWith('/execute')) {
    return JSON.stringify({
      nodeId: 'simulation:control-correction-step-response-lab',
      resourceType: 'simulation',
      status: 'completed',
      idempotencyKey: 'ita-demo-execution-alpha',
      evidenceRefs: ['execution-alpha-resource'],
    });
  }
  if (path === '/api/teacher/document-grading/approve') {
    return JSON.stringify({
      gradingRunId: 'grading-alpha-draft',
      demoPackage: 'intelligent-teaching-assistant',
      syntheticOnly: true,
    });
  }
  if (path === '/api/ai/chat') {
    return JSON.stringify({
      messages: [
        { role: 'user', content: 'Explain this demo mode using only cited synthetic context.' },
      ],
      courseId: 'demo-control-correction-course',
      pageId: 'intelligent-teaching-assistant-demo',
      pageContext: {
        courseId: 'demo-control-correction-course',
        stepId: 'intelligent-teaching-assistant-demo',
      },
      teachingAssistantModeId: modeId ?? 'generic-chat',
      modeClientContextHints: {
        demoPackage: 'intelligent-teaching-assistant',
        syntheticOnly: true,
        requireCitations: true,
        expectedCitationIds: ['cit-diagnosis-alpha', 'cit-path-alpha', 'cit-resource-alpha', 'cit-grading-alpha', 'cit-feedback-alpha', 'cit-report-class', 'cit-prep-pack'],
        studentId: 'demo-ita-student-alpha',
        classId: 'demo-ita-class',
        resourceId: 'simulation:control-correction-step-response-lab',
        gradingRunId: 'grading-alpha-draft',
        modeContextToken: 'demo-synthetic-mode-context-token',
      },
    });
  }
  return undefined;
}

async function runHttpChecks(baseUrl: string, options: { requireProductSurface: boolean }): Promise<string[]> {
  const errors: string[] = [];
  const target = validateIntelligentTeachingAssistantDemoHttpTarget(baseUrl);
  if (target.errors.length > 0 || !target.url) return target.errors;
  console.log(`http target accepted: ${target.url.origin}`);

  if (options.requireProductSurface) {
    const credentialErrors = requiredRoleCredentialErrors();
    if (credentialErrors.length > 0) return credentialErrors;
  }

  const authenticated = hasAuthCredentials('teacher') || hasAuthCredentials('student');
  if (authenticated && !demoFixturesInstalled()) {
    return [
      'authenticated HTTP acceptance requires INTELLIGENT_TEACHING_ASSISTANT_DEMO_FIXTURES_INSTALLED=true after installing demo fixtures',
    ];
  }

  for (const check of INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.routeChecks) {
    const response = await fetch(new URL(check.route, target.url), {
      headers: buildHttpHeaders('GET', check.actorRole),
      redirect: 'manual',
    }).catch((error) => {
      errors.push(`route check failed: ${check.route}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (!response) continue;
    const body = await response.text();
    const roleAuthenticated = hasAuthCredentials(check.actorRole);
    const location = response.headers.get('location') ?? '';
    const authBoundaryOk = acceptsIntelligentTeachingAssistantDemoAuthBoundary({
      status: response.status,
      authenticated: roleAuthenticated,
      requireProductSurface: options.requireProductSurface,
      redirectedToLogin: response.url.includes('/login') || location.includes('/login'),
    });
    const forbiddenText = (check.forbiddenTexts ?? []).find((text) => body.includes(text));
    const statusSemanticsOk = !check.requiredStatusSemantics
      || body.includes(`data-operations-status-semantics="${check.requiredStatusSemantics}"`);
    const ok = authBoundaryOk || (
      isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(response.status) &&
      body.includes(check.readyText) &&
      statusSemanticsOk &&
      !forbiddenText
    );
    console.log(`${ok ? 'ok' : 'fail'} http-route:${check.route} status=${response.status}`);
    if (!ok) {
      const details = [
        forbiddenText ? `${forbiddenText} shell marker present` : null,
        !statusSemanticsOk ? `${check.requiredStatusSemantics} status semantics missing` : null,
      ].filter((detail): detail is string => Boolean(detail));
      errors.push(`route check failed: ${check.route}${details.length ? ` (${details.join('; ')})` : ''}`);
    }
  }

  for (const example of INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.apiExamples) {
    const modeIds = example.path === '/api/ai/chat'
      ? INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.konlingSessions.map((session) => session.modeId)
      : [undefined];
    for (const modeId of modeIds) {
      const actorRole = example.actorRole === 'mode'
        ? INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.konlingSessions.find((session) => session.modeId === modeId)?.actorRole ?? 'student'
        : example.actorRole;
      const response = await fetch(new URL(example.path, target.url), {
        method: example.method,
        headers: buildHttpHeaders(example.method, actorRole),
        body: example.method === 'POST' ? buildApiBody(example.path, modeId) : undefined,
        redirect: 'manual',
      }).catch((error) => {
        errors.push(`API check failed: ${example.method} ${example.path}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
      if (!response) continue;
      const body = await response.text();
      const roleAuthenticated = hasAuthCredentials(actorRole);
      const location = response.headers.get('location') ?? '';
      const authBoundaryOk = acceptsIntelligentTeachingAssistantDemoAuthBoundary({
        status: response.status,
        authenticated: roleAuthenticated,
        requireProductSurface: options.requireProductSurface,
        redirectedToLogin: response.url.includes('/login') || location.includes('/login'),
      });
      const payloadErrors = authBoundaryOk ? [] : validateIntelligentTeachingAssistantDemoApiPayload(example.path, body, response.headers.get('content-type') ?? '');
      const ok = authBoundaryOk || (isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(response.status) && payloadErrors.length === 0);
      const suffix = modeId ? ` mode=${modeId}` : '';
      console.log(`${ok ? 'ok' : 'fail'} http-api:${example.method} ${example.path}${suffix} status=${response.status}`);
      if (!ok) errors.push(`API check failed: ${example.method} ${example.path}${suffix}${payloadErrors.length ? ` (${payloadErrors.join('; ')})` : ''}`);
    }
  }

  return errors;
}

export async function runIntelligentTeachingAssistantDemoAcceptance(argv: string[] = process.argv): Promise<string[]> {
  const report = buildIntelligentTeachingAssistantDemoAcceptanceReport(INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE);
  const documentationErrors = requiredSections
    .filter((section) => !docs.includes(section))
    .map((section) => `documentation missing section: ${section}`);
  const rollbackCheckRequested = argv.includes('--rollback-check');
  const rollbackErrors = rollbackCheckRequested && INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.rollback.expectedChecks.length === 0
    ? ['rollback check requested but expected checks are empty']
    : [];
  const baseUrl = process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL?.trim();
  const httpRequired = argv.includes('--require-http');
  const httpErrors = baseUrl ? await runHttpChecks(baseUrl, { requireProductSurface: httpRequired }) : [];
  const requiredHttpErrors = httpRequired && !baseUrl
    ? ['HTTP acceptance requested but INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL is not set']
    : [];

  const errors = [
    ...report.errors,
    ...documentationErrors,
    ...rollbackErrors,
    ...unsupportedAuthErrors(),
    ...httpErrors,
    ...requiredHttpErrors,
  ];

  for (const check of report.checks) {
    console.log(`${check.ok ? 'ok' : 'fail'} ${check.id}: ${check.detail}`);
  }
  for (const section of requiredSections) {
    console.log(`${docs.includes(section) ? 'ok' : 'fail'} docs:${section}`);
  }
  if (rollbackCheckRequested) {
    for (const check of INTELLIGENT_TEACHING_ASSISTANT_DEMO_PACKAGE.rollback.expectedChecks) {
      console.log(`ok rollback:${check}`);
    }
  }
  if (!baseUrl) {
    console.log(`${httpRequired ? 'fail' : 'skip'} http: INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL not set; offline fixture acceptance only`);
  }

  if (errors.length > 0) {
    console.error('intelligent teaching assistant demo acceptance failed');
    for (const error of errors) console.error(`- ${error}`);
    return errors;
  }

  console.log('intelligent teaching assistant demo acceptance passed');
  return [];
}

async function main() {
  const errors = await runIntelligentTeachingAssistantDemoAcceptance(process.argv);
  if (errors.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
