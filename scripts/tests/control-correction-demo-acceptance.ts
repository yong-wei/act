import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CONTROL_CORRECTION_DEMO_PACKAGE,
  buildControlCorrectionDemoAcceptanceReport,
  buildControlCorrectionDemoPlanPostBody,
  buildControlCorrectionDemoRollbackReport,
} from '../../src/lib/data-governance/control-correction-demo-package';

const repoRoot = process.cwd();
const docsPath = join(repoRoot, 'docs/control-correction-evaluation-demo-package.md');
const docs = readFileSync(docsPath, 'utf8');
const requiredSections = [
  '## Demo Storyline',
  '## Setup And Reset',
  '## Route Checks',
  '## API Examples',
  '## Metric Methodology',
  '## Provider Configuration',
  '## Privacy And Audit Controls',
  '## Deployment And Rollback',
  '## Release Readiness',
];

function buildHttpHeaders(method: 'GET' | 'POST'): HeadersInit {
  const headers: Record<string, string> = {};
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  const cookie = process.env.CONTROL_CORRECTION_DEMO_AUTH_COOKIE?.trim();
  if (cookie) {
    headers.Cookie = cookie;
  }
  return headers;
}

function hasAuthCredentials(): boolean {
  return Boolean(process.env.CONTROL_CORRECTION_DEMO_AUTH_COOKIE?.trim());
}

function unsupportedAuthErrors(): string[] {
  return process.env.CONTROL_CORRECTION_DEMO_AUTH_BEARER?.trim()
    ? ['CONTROL_CORRECTION_DEMO_AUTH_BEARER is not supported because checked routes use NextAuth session cookies; use CONTROL_CORRECTION_DEMO_AUTH_COOKIE']
    : [];
}

function demoFixturesInstalled(): boolean {
  return process.env.CONTROL_CORRECTION_DEMO_FIXTURES_INSTALLED?.trim() === 'true';
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => getObject(current)[key], value);
}

function stringArrayIncludes(value: unknown, expected: string): boolean {
  return Array.isArray(value) && value.some((item) => item === expected);
}

function stringArrayContainsText(value: unknown, expected: string): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.includes(expected));
}

function tableRowsOmitField(value: unknown, field: string): boolean {
  return Array.isArray(value) && value.every((row) => !Object.hasOwn(getObject(row), field));
}

function validateApiPayload(path: string, body: string): string[] {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return [`${path} response is not valid JSON`];
  }

  if (path.startsWith('/api/adaptive/learner-state')) {
    const goalSlice = readPath(payload, ['goalSlices', 'controlCorrection']);
    return [
      readPath(goalSlice, ['goalId']) === 'control-correction' ? null : 'learner-state goal slice is missing control-correction goalId',
      typeof readPath(goalSlice, ['pathContext', 'activePathId']) === 'string' || readPath(goalSlice, ['pathContext', 'noActivePath']) === true
        ? null
        : 'learner-state path context is missing activePathId/noActivePath state',
    ].filter((error): error is string => Boolean(error));
  }

  if (path === '/api/learning-paths/plan') {
    const planBody = buildControlCorrectionDemoPlanPostBody(CONTROL_CORRECTION_DEMO_PACKAGE);
    return [
      readPath(payload, ['path', 'id']) === planBody.plan.id ? null : 'learning-path plan response is missing persisted path id',
      readPath(payload, ['path', 'goalId']) === 'control-correction' ? null : 'learning-path plan response is missing control-correction goalId',
      stringArrayIncludes(readPath(payload, ['path', 'nodeIds']), 'arena-task:task-second-order-lead-pid')
        ? null
        : 'learning-path plan response is missing Arena terminal node id',
    ].filter((error): error is string => Boolean(error));
  }

  if (path.startsWith('/api/teacher/classes/') && path.includes('/control-correction-report')) {
    return [
      readPath(payload, ['report', 'goalId']) === 'control-correction' ? null : 'teacher report response is missing control-correction goalId',
      path.includes('export=true') && !stringArrayContainsText(readPath(payload, ['export', 'redactionPolicyNotes']), 'omit raw answer bodies')
        ? 'teacher report export is missing redaction policy notes'
        : null,
      path.includes('export=true') && !Array.isArray(readPath(payload, ['export', 'tables', 'metrics']))
        ? 'teacher report export is missing metrics table'
        : null,
      path.includes('export=true') && !tableRowsOmitField(readPath(payload, ['export', 'tables', 'students']), 'email')
        ? 'teacher report export includes direct student email fields'
        : null,
      typeof readPath(payload, ['report', 'metrics', 'pathAdoption', 'methodology']) === 'string'
        ? null
        : 'teacher report response is missing metrics methodology',
    ].filter((error): error is string => Boolean(error));
  }

  return [];
}

async function runHttpChecks(baseUrl: string): Promise<string[]> {
  const errors: string[] = [];
  const authenticated = hasAuthCredentials();
  if (authenticated && !demoFixturesInstalled()) {
    return [
      'authenticated HTTP acceptance requires CONTROL_CORRECTION_DEMO_FIXTURES_INSTALLED=true after installing the demo fixtures in the target environment',
    ];
  }
  for (const check of CONTROL_CORRECTION_DEMO_PACKAGE.routeChecks) {
    const response = await fetch(new URL(check.route, baseUrl), {
      headers: buildHttpHeaders('GET'),
    }).catch((error) => {
      errors.push(`route check failed: ${check.route}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (!response) continue;
    const body = await response.text();
    const authBoundaryOk = !authenticated && check.route.startsWith('/api/') && (response.status === 401 || response.status === 403);
    const ok = authBoundaryOk || (response.status < 500 && body.includes(check.expectedMarker));
    console.log(`${ok ? 'ok' : 'fail'} http-route:${check.route} status=${response.status}`);
    if (!ok) {
      errors.push(`route check failed: ${check.route}`);
    }
  }
  for (const example of CONTROL_CORRECTION_DEMO_PACKAGE.apiExamples) {
    const response = await fetch(new URL(example.path, baseUrl), {
      method: example.method,
      headers: buildHttpHeaders(example.method),
      body: example.method === 'POST'
        ? JSON.stringify(buildControlCorrectionDemoPlanPostBody(CONTROL_CORRECTION_DEMO_PACKAGE))
        : undefined,
    }).catch((error) => {
      errors.push(`API check failed: ${example.method} ${example.path}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (!response) continue;
    const body = await response.text();
    const authBoundaryOk = !authenticated && (response.status === 401 || response.status === 403);
    const payloadErrors = authBoundaryOk ? [] : validateApiPayload(example.path, body);
    const ok = authBoundaryOk || (response.status < 500 && payloadErrors.length === 0);
    console.log(`${ok ? 'ok' : 'fail'} http-api:${example.method} ${example.path} status=${response.status}`);
    if (!ok) {
      errors.push(`API check failed: ${example.method} ${example.path}${payloadErrors.length ? ` (${payloadErrors.join('; ')})` : ''}`);
    }
  }
  return errors;
}

async function main() {
  const report = buildControlCorrectionDemoAcceptanceReport(CONTROL_CORRECTION_DEMO_PACKAGE);
  const documentationErrors = requiredSections
    .filter((section) => !docs.includes(section))
    .map((section) => `documentation missing section: ${section}`);
  const rollbackCheckRequested = process.argv.includes('--rollback-check');
  const rollbackReport = rollbackCheckRequested ? buildControlCorrectionDemoRollbackReport() : null;
  const httpRequired = process.argv.includes('--require-http');
  const rollbackErrors = rollbackCheckRequested && CONTROL_CORRECTION_DEMO_PACKAGE.rollback.expectedChecks.length === 0
    ? ['rollback check requested but expected checks are empty']
    : [];
  const baseUrl = process.env.CONTROL_CORRECTION_DEMO_BASE_URL?.trim();
  const httpErrors = baseUrl ? await runHttpChecks(baseUrl) : [];
  const requiredHttpErrors = httpRequired && !baseUrl
    ? ['HTTP acceptance requested but CONTROL_CORRECTION_DEMO_BASE_URL is not set']
    : [];

  const errors = [
    ...report.errors,
    ...documentationErrors,
    ...rollbackErrors,
    ...unsupportedAuthErrors(),
    ...(rollbackReport?.errors ?? []),
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
    for (const check of rollbackReport?.checks ?? []) {
      console.log(`${check.ok ? 'ok' : 'fail'} ${check.id}: ${check.detail}`);
    }
    console.log(`${rollbackReport?.ok ? 'ok' : 'fail'} rollback:${CONTROL_CORRECTION_DEMO_PACKAGE.rollback.command}`);
  }
  if (!baseUrl) {
    console.log(`${httpRequired ? 'fail' : 'skip'} http: CONTROL_CORRECTION_DEMO_BASE_URL not set; offline fixture acceptance only`);
  }

  if (errors.length > 0) {
    console.error('control-correction demo acceptance failed');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('control-correction demo acceptance passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
