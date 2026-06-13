import { readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { join } from 'node:path';

import {
  type CompetitionBaselineActorRole,
  type CompetitionBaselineRouteStep,
  XH_202620_COMPETITION_BASELINE,
  buildCompetitionBaselineAcceptanceReport,
  buildIntelligentTeachingAssistantEffectReportExport,
  installIntelligentTeachingAssistantDemoFixtures,
} from '../../src/lib/data-governance/intelligent-teaching-assistant-demo-package';
import {
  isIntelligentTeachingAssistantDemoSuccessfulHttpStatus,
  validateIntelligentTeachingAssistantDemoApiPayload,
  validateIntelligentTeachingAssistantDemoHttpTarget,
} from './intelligent-teaching-assistant-demo-acceptance';

const repoRoot = process.cwd();
const capabilityMapPath = join(repoRoot, 'docs/competition/xh-202620-capability-map.md');
const ledgerPath = join(repoRoot, 'docs/competition/xh-202620-baseline-ledger.md');

function requireText(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function normalizeMarkdownCell(value: string): string {
  return value.trim().replace(/^`|`$/g, '').trim();
}

function markdownRows(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|') && line.includes('|'))
    .map((line) => line.split('|').slice(1, -1).map(normalizeMarkdownCell))
    .filter((cells) => cells.length > 1 && !cells.every((cell) => /^-+$/.test(cell.replace(/\s/g, ''))));
}

function validateCompetitionDocs(): string[] {
  const capabilityMap = requireText(capabilityMapPath);
  const ledger = requireText(ledgerPath);
  const ledgerRows = markdownRows(ledger);
  const requiredCapabilitySections = [
    '# XH-202620 Competition Capability Map',
    '## Implemented',
    '## Partial',
    '## Planned',
    '## Acceptance Commands',
  ];
  const requiredLedgerSections = [
    '# XH-202620 Competition Baseline Ledger',
    '## Demo Accounts',
    '## Deterministic Route Ledger',
    '## Temporary And API-Only Surfaces',
    '## Seed And Reset Contract',
    '## Acceptance Procedure',
  ];

  return [
    ...requiredCapabilitySections.map((section) => (
      capabilityMap.includes(section) ? null : `capability map missing section: ${section}`
    )),
    ...requiredLedgerSections.map((section) => (
      ledger.includes(section) ? null : `baseline ledger missing section: ${section}`
    )),
    capabilityMap.includes('diagnosis-to-path') ? null : 'capability map missing diagnosis-to-path capability',
    capabilityMap.includes('effect-report') ? null : 'capability map missing effect-report capability',
    ledger.includes('/profile/evidence') ? null : 'baseline ledger must route students through /profile/evidence',
    ledgerRows.some((cells) => cells[0] === 'student' && cells[1] === '/data-center')
      ? 'baseline ledger must not route students through /data-center'
      : null,
    ledger.includes('synthetic-demo') ? null : 'baseline ledger missing synthetic-demo data origin marker',
    capabilityMap.includes('rtk openspec validate competition-demo-baseline --strict')
      && ledger.includes('rtk openspec validate competition-demo-baseline --strict')
      ? null
      : 'competition docs must reference archived spec validation command',
    capabilityMap.includes('freeze-competition-baseline') || ledger.includes('freeze-competition-baseline')
      ? 'competition docs must not reference archived change validation command'
      : null,
  ].filter((error): error is string => Boolean(error));
}

function validateFixtureIdempotency(): string[] {
  const first = installIntelligentTeachingAssistantDemoFixtures();
  const second = installIntelligentTeachingAssistantDemoFixtures(first.state);
  return [
    JSON.stringify(first.state.records) === JSON.stringify(second.state.records)
      ? null
      : 'competition fixture install/reset is not idempotent',
    new Set(first.upsertedIds).size === first.upsertedIds.length
      ? null
      : 'competition fixture install created duplicate ids',
  ].filter((error): error is string => Boolean(error));
}

function roleCookie(role: CompetitionBaselineActorRole, mock: boolean): string {
  if (mock) return `competition-baseline-role=${role}`;
  if (role === 'teacher') {
    return process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE?.trim() ?? '';
  }
  if (role === 'student') {
    return process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE?.trim() ?? '';
  }
  return process.env.COMPETITION_BASELINE_ADMIN_AUTH_COOKIE?.trim()
    || process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_COOKIE?.trim()
    || '';
}

function headersFor(role: CompetitionBaselineActorRole, mock: boolean): HeadersInit {
  const cookie = roleCookie(role, mock);
  return cookie ? { Cookie: cookie } : {};
}

function routeMarker(step: CompetitionBaselineRouteStep): string {
  if (step.route === '/profile/evidence') return 'learner-record';
  if (step.route.includes('/adaptive-practice')) return 'path-alpha-main';
  if (step.route.includes('/document-feedback')) return 'feedback-grading-beta-approved';
  if (step.route.includes('/grading-workbench')) return 'grading-alpha-draft';
  if (step.route === '/teacher/classes/demo-ita-class') return 'prep-pack-demo-ita';
  if (step.route === '/data-center') return 'synthetic-demo';
  return step.expectedEvidence.split(' ')[0];
}

function liveRouteMarker(step: CompetitionBaselineRouteStep): string {
  if (step.route === '/profile/evidence') return 'data-learner-record-surface';
  if (step.route.includes('/adaptive-practice')) return 'data-control-correction-center';
  if (step.route.includes('/document-feedback')) return 'data-intelligent-teaching-assistant-demo-surface="document-feedback"';
  if (step.route.includes('/grading-workbench')) return 'data-intelligent-teaching-assistant-demo-surface="document-grading-workbench"';
  if (step.route === '/data-center') return 'data-data-map-semantics';
  return '';
}

function requiredBodyMarker(step: CompetitionBaselineRouteStep, mock: boolean): string {
  if (step.route.startsWith('/api/')) return '';
  if (mock) return routeMarker(step);
  if (step.surfaceStatus !== 'implemented') return '';
  return liveRouteMarker(step);
}

function writeMockResponse(url: string, role: string, response: ServerResponse): boolean {
  const deny = () => {
    response.statusCode = 403;
    response.end('forbidden');
  };
  const html = (body: string) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<main data-origin="synthetic-demo">${body}</main>`);
  };

  if (url === '/data-center' && role !== 'administrator') {
    deny();
    return true;
  }
  if (url === '/data-center') {
    html('synthetic-demo provenance source quality');
    return true;
  }
  if (url.startsWith('/profile/evidence') && role === 'student') {
    html('learner-record snapshot-diagnosis-alpha synthetic-demo');
    return true;
  }
  if (url.startsWith('/assessment/adaptive-practice') && role === 'student') {
    html('path-alpha-main synthetic-demo');
    return true;
  }
  if (url.startsWith('/assessment/document-feedback') && role === 'student') {
    html('feedback-grading-beta-approved synthetic-demo');
    return true;
  }
  if (url.startsWith('/teacher/grading-workbench') && role === 'teacher') {
    html('grading-alpha-draft synthetic-demo');
    return true;
  }
  if (url === '/teacher/classes/demo-ita-class' && role === 'teacher') {
    html('prep-pack-demo-ita synthetic-demo');
    return true;
  }
  if (url.startsWith('/api/teacher/classes/demo-ita-class/assistant-effect-report') && role === 'teacher') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ effectReport: buildIntelligentTeachingAssistantEffectReportExport() }));
    return true;
  }
  if (url.startsWith('/api/') || url.startsWith('/teacher/') || url.startsWith('/assessment/') || url.startsWith('/profile/')) {
    deny();
    return true;
  }
  return false;
}

async function withMockBaselineServer<T>(callback: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer((request, response) => {
    const role = /competition-baseline-role=([^;]+)/.exec(request.headers.cookie ?? '')?.[1] ?? '';
    if (writeMockResponse(request.url ?? '/', role, response)) return;
    response.statusCode = 404;
    response.end('not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('competition baseline mock server did not bind');
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function requiredExternalCredentialErrors(): string[] {
  return [
    roleCookie('teacher', false) ? null : 'INTELLIGENT_TEACHING_ASSISTANT_DEMO_TEACHER_AUTH_COOKIE is required for competition baseline HTTP acceptance',
    roleCookie('student', false) ? null : 'INTELLIGENT_TEACHING_ASSISTANT_DEMO_STUDENT_AUTH_COOKIE is required for competition baseline HTTP acceptance',
    roleCookie('administrator', false) ? null : 'COMPETITION_BASELINE_ADMIN_AUTH_COOKIE or INTELLIGENT_TEACHING_ASSISTANT_DEMO_AUTH_COOKIE is required for competition baseline administrator HTTP acceptance',
  ].filter((error): error is string => Boolean(error));
}

async function validateHttpBaseline(baseUrl: string, mock: boolean): Promise<string[]> {
  const target = validateIntelligentTeachingAssistantDemoHttpTarget(baseUrl);
  if (target.errors.length > 0 || !target.url) return target.errors;
  const credentialErrors = mock ? [] : requiredExternalCredentialErrors();
  if (credentialErrors.length > 0) return credentialErrors;

  const errors: string[] = [];
  for (const step of XH_202620_COMPETITION_BASELINE.routeLedger) {
    const response = await fetch(new URL(step.route, target.url), {
      headers: headersFor(step.actorRole, mock),
      redirect: 'manual',
    }).catch((error) => {
      errors.push(`competition route failed: ${step.route}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (!response) continue;
    const body = await response.text();
    const payloadErrors = step.route.includes('/assistant-effect-report')
      ? validateIntelligentTeachingAssistantDemoApiPayload(step.route, body, response.headers.get('content-type') ?? '')
      : [];
    const marker = requiredBodyMarker(step, mock);
    const ok = isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(response.status)
      && (payloadErrors.length === 0)
      && (!marker || body.includes(marker));
    if (!ok) {
      errors.push(`competition route failed: ${step.route}${payloadErrors.length ? ` (${payloadErrors.join('; ')})` : ''}`);
    }
  }

  const studentDataCenter = await fetch(new URL('/data-center', target.url), {
    headers: headersFor('student', mock),
    redirect: 'manual',
  }).catch((error) => {
    errors.push(`student Data Center boundary check failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  if (studentDataCenter && isIntelligentTeachingAssistantDemoSuccessfulHttpStatus(studentDataCenter.status)) {
    errors.push('student role must not reach /data-center during competition baseline acceptance');
  }

  return errors;
}

async function runHttpAcceptance(): Promise<string[]> {
  const externalBaseUrl = process.env.INTELLIGENT_TEACHING_ASSISTANT_DEMO_BASE_URL?.trim();
  if (externalBaseUrl) {
    return validateHttpBaseline(externalBaseUrl, false);
  }
  return withMockBaselineServer((baseUrl) => validateHttpBaseline(baseUrl, true));
}

export async function runCompetitionBaselineAcceptance(): Promise<string[]> {
  const report = buildCompetitionBaselineAcceptanceReport(XH_202620_COMPETITION_BASELINE);
  return [
    ...report.errors,
    ...validateCompetitionDocs(),
    ...validateFixtureIdempotency(),
    ...await runHttpAcceptance(),
  ];
}

if (process.argv[1]?.endsWith('competition-baseline-acceptance.ts')) {
  runCompetitionBaselineAcceptance()
    .then((errors) => {
      if (errors.length > 0) {
        for (const error of errors) {
          console.error(error);
        }
        process.exit(1);
      }
      console.log('competition baseline acceptance passed');
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
