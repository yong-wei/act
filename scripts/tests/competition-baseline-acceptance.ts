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
import {
  resolvePlatformRouteInventory,
} from '../../src/lib/platform-role-navigation';

const repoRoot = process.cwd();
const capabilityMapPath = join(repoRoot, 'docs/competition/xh-202620-capability-map.md');
const ledgerPath = join(repoRoot, 'docs/competition/xh-202620-baseline-ledger.md');
const assetsManifestPath = join(repoRoot, 'docs/competition/assets-manifest.md');
const visualEvidencePath = join(repoRoot, 'artifacts/commercial-ui/evidence.json');

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
  const assetsManifest = requireText(assetsManifestPath);
  const ledgerRows = markdownRows(ledger);
  const requiredCapabilitySections = [
    '# XH-202620 Competition Capability Map',
    '## Final Capability Map',
    '## Data Origin',
    '## Acceptance Commands',
  ];
  const requiredLedgerSections = [
    '# XH-202620 Competition Baseline Ledger',
    '## Demo Accounts',
    '## Deterministic Route Ledger',
    '## Visual Evidence Matrix',
    '## Temporary And API-Only Surfaces',
    '## Seed And Reset Contract',
    '## Acceptance Procedure',
  ];
  const requiredAssetsSections = [
    '# Competition Assets Manifest',
    '## Demo Accounts',
    '## Route Order',
    '## Screenshot Ledger',
    '## Visual Theme Exceptions',
    '## Three-Minute Demo Script',
    '## Model And Provider Note',
    '## Privacy Note',
    '## Fallback Steps',
    '## Submission Checklist',
  ];
  const requiredAssetsRoutes = [
    '/',
    '/teacher/grading-workbench?demo=1',
    '/assessment/document-feedback?demo=1',
    '/profile/evidence',
    '/profile/growth',
    '/assessment/adaptive-practice?goal=control-correction',
    '/teacher/prep-packs',
    '/teacher/classes/demo-ita-class/analytics-v2',
    '/teacher/classes/demo-ita-class/students/demo-ita-student-beta',
    '/api/teacher/classes/demo-ita-class/assistant-effect-report?export=true',
    '/data-center',
    '/admin/data-governance',
    '/arena',
    '/arena/challenges/task-second-order-lead-pid',
    '/interactive-learning/control-workbench',
  ];

  return [
    ...requiredCapabilitySections.map((section) => (
      capabilityMap.includes(section) ? null : `capability map missing section: ${section}`
    )),
    ...requiredLedgerSections.map((section) => (
      ledger.includes(section) ? null : `baseline ledger missing section: ${section}`
    )),
    ...requiredAssetsSections.map((section) => (
      assetsManifest.includes(section) ? null : `assets manifest missing section: ${section}`
    )),
    ...requiredAssetsRoutes.map((route) => (
      assetsManifest.includes(route) ? null : `assets manifest missing route: ${route}`
    )),
    capabilityMap.includes('diagnosis-to-path') ? null : 'capability map missing diagnosis-to-path capability',
    capabilityMap.includes('effect-report') ? null : 'capability map missing effect-report capability',
    capabilityMap.includes('| effect-report |') && capabilityMap.includes('| implemented |')
      ? null
      : 'capability map must mark effect-report implemented for final competition package',
    ledger.includes('/profile/evidence') ? null : 'baseline ledger must route students through /profile/evidence',
    ledger.includes('/arena/challenges/task-second-order-lead-pid') ? null : 'baseline ledger missing Arena challenge surface',
    ledger.includes('/interactive-learning/control-workbench') ? null : 'baseline ledger missing simulation workbench surface',
    ledger.includes('/teacher/prep-packs') ? null : 'baseline ledger missing teacher prep-pack surface',
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
    assetsManifest.includes('OpenAI-compatible') ? null : 'assets manifest missing OpenAI-compatible provider note',
    /Anthropic/i.test(assetsManifest)
      ? 'assets manifest must not claim unsupported Anthropic runtime support'
      : null,
    /learning gain/i.test(assetsManifest) ? 'assets manifest must not claim learning gain without source evidence' : null,
    assetsManifest.includes('synthetic-demo') && assetsManifest.includes('privacy review reference')
      ? null
      : 'assets manifest missing synthetic/real privacy boundary',
    assetsManifest.includes('artifacts/commercial-ui/evidence.json')
      ? null
      : 'assets manifest missing visual evidence manifest reference',
  ].filter((error): error is string => Boolean(error));
}

function evidenceHrefForRoute(route: string): string | null {
  if (route.startsWith('/api/')) return null;
  if (route === '/teacher/classes/demo-ita-class/analytics-v2') return '/teacher/classes/[classId]/analytics-v2';
  if (route === '/teacher/classes/demo-ita-class/students/demo-ita-student-beta') return '/teacher/classes/[classId]/students/[studentId]';
  if (route === '/arena/challenges/task-second-order-lead-pid') return '/arena/challenges/[taskId]';
  return route.split('?')[0] || '/';
}

function validateCompetitionVisualEvidence(): string[] {
  let evidence: {
    routes?: Array<{
      href?: string;
      viewports?: Array<{ width?: number; theme?: string; authState?: string }>;
    }>;
  };
  try {
    evidence = JSON.parse(requireText(visualEvidencePath)) as typeof evidence;
  } catch {
    return ['commercial UI visual evidence manifest is missing or invalid'];
  }
  const evidenceByHref = new Map((evidence.routes ?? []).map((route) => [route.href, route]));
  const errors: string[] = [];
  const validAuthStates = new Set(['public', 'auth-entry', 'authenticated', 'unauth-redirect-fallback']);
  const requiredRoutes = [...new Set(XH_202620_COMPETITION_BASELINE.routeLedger
    .map((step) => evidenceHrefForRoute(step.route))
    .filter((href): href is string => Boolean(href)))];

  for (const href of requiredRoutes) {
    const routeEvidence = evidenceByHref.get(href);
    const widths = new Set((routeEvidence?.viewports ?? []).map((viewport) => viewport.width));
    const themes = new Set((routeEvidence?.viewports ?? []).map((viewport) => viewport.theme).filter(Boolean));
    const invalidAuthState = (routeEvidence?.viewports ?? []).find((viewport) => (
      viewport.authState && !validAuthStates.has(viewport.authState)
    ));
    if (!routeEvidence || !widths.has(1440) || !widths.has(320)) {
      errors.push(`visual evidence missing 1440px and 320px coverage for ${href}`);
    }
    if (invalidAuthState) {
      errors.push(`visual evidence uses invalid authState for ${href}: ${invalidAuthState.authState}`);
    }
    if (themes.size === 0) {
      errors.push(`visual evidence missing theme metadata for ${href}`);
    }
    const requiredThemes = resolvePlatformRouteInventory(href)?.themeSupport ?? ['light', 'dark'];
    for (const requiredTheme of requiredThemes) {
      if (!themes.has(requiredTheme)) {
        errors.push(`visual evidence missing ${requiredTheme} theme coverage for ${href}`);
      }
    }
  }
  return errors;
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
  if (step.route === '/') return 'competition-entry';
  if (step.route === '/profile/evidence') return 'learner-record';
  if (step.route === '/profile/growth') return 'diagnosis-alpha';
  if (step.route.includes('/adaptive-practice')) return 'path-alpha-main';
  if (step.route.includes('/document-feedback')) return 'feedback-grading-beta-approved';
  if (step.route.includes('/grading-workbench')) return 'grading-alpha-draft';
  if (step.route === '/teacher/prep-packs') return 'prep-pack-demo-ita';
  if (step.route.includes('/analytics-v2')) return 'teacher-class-analytics';
  if (step.route.includes('/students/demo-ita-student-beta')) return 'teacher-student-insights';
  if (step.route === '/data-center') return 'synthetic-demo';
  if (step.route === '/admin/data-governance') return 'admin-data-governance';
  if (step.route === '/arena') return 'arena-workspace';
  if (step.route.includes('/arena/challenges/')) return 'task-second-order-lead-pid';
  if (step.route === '/interactive-learning/control-workbench') return 'control-workbench';
  return step.expectedEvidence.split(' ')[0];
}

function liveRouteMarker(step: CompetitionBaselineRouteStep): string {
  if (step.route === '/') return 'data-commercial-entry-intent';
  if (step.route === '/profile/evidence') return 'data-learner-record-surface';
  if (step.route === '/profile/growth') return 'data-learner-record-surface';
  if (step.route.includes('/adaptive-practice')) return 'data-control-correction-center';
  if (step.route.includes('/document-feedback')) return 'data-intelligent-teaching-assistant-demo-surface="document-feedback"';
  if (step.route.includes('/grading-workbench')) return 'data-intelligent-teaching-assistant-demo-surface="document-grading-workbench"';
  if (step.route === '/teacher/prep-packs') return 'data-report-ledger-surface="teacher-prep-pack-review"';
  if (step.route.includes('/analytics-v2')) return 'data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics"';
  if (step.route.includes('/students/demo-ita-student-beta')) return 'data-intelligent-teaching-assistant-demo-surface="teacher-student-insights"';
  if (step.route === '/data-center') return 'data-data-map-semantics';
  if (step.route === '/admin/data-governance') return 'data-commercial-operations-workspace="admin-operations"';
  if (step.route === '/arena') return 'data-arena-workspace-shell';
  if (step.route.includes('/arena/challenges/')) return 'task-second-order-lead-pid';
  if (step.route === '/interactive-learning/control-workbench') return 'data-commercial-workspace="control-workbench"';
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
  if (url === '/' && (role === 'student' || role === 'teacher')) {
    html('competition-entry synthetic-demo');
    return true;
  }
  if (url === '/data-center') {
    html('synthetic-demo provenance source quality');
    return true;
  }
  if (url === '/admin/data-governance' && role === 'administrator') {
    html('admin-data-governance synthetic-demo');
    return true;
  }
  if (url.startsWith('/profile/evidence') && role === 'student') {
    html('learner-record snapshot-diagnosis-alpha synthetic-demo');
    return true;
  }
  if (url.startsWith('/profile/growth') && role === 'student') {
    html('diagnosis-alpha learner-growth synthetic-demo');
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
  if (url === '/teacher/prep-packs' && role === 'teacher') {
    html('prep-pack-demo-ita synthetic-demo');
    return true;
  }
  if (url === '/teacher/classes/demo-ita-class/analytics-v2' && role === 'teacher') {
    html('teacher-class-analytics demo-ita-class synthetic-demo');
    return true;
  }
  if (url === '/teacher/classes/demo-ita-class/students/demo-ita-student-beta' && role === 'teacher') {
    html('teacher-student-insights demo-ita-student-beta synthetic-demo');
    return true;
  }
  if (url === '/arena' && role === 'student') {
    html('arena-workspace synthetic-demo');
    return true;
  }
  if (url === '/arena/challenges/task-second-order-lead-pid' && role === 'student') {
    html('task-second-order-lead-pid synthetic-demo');
    return true;
  }
  if (url === '/interactive-learning/control-workbench' && role === 'student') {
    html('control-workbench synthetic-demo');
    return true;
  }
  if (url.startsWith('/api/teacher/classes/demo-ita-class/assistant-effect-report') && role === 'teacher') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ effectReport: buildIntelligentTeachingAssistantEffectReportExport() }));
    return true;
  }
  if (url.startsWith('/api/') || url.startsWith('/teacher/') || url.startsWith('/assessment/') || url.startsWith('/profile/') || url.startsWith('/admin/') || url.startsWith('/arena') || url.startsWith('/interactive-learning/')) {
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
    ...validateCompetitionVisualEvidence(),
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
