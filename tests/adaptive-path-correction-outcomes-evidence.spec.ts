import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';
import 'dotenv/config';
import { encode } from 'next-auth/jwt';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1284-p3');
const manifestPath = path.join(evidenceDir, 'manifest.json');
const generatorFile = 'tests/adaptive-path-correction-outcomes-evidence.spec.ts';
const productionSourceFiles = [
  'src/features/personalization/experience/adaptive-path-correction-outcomes.ts',
  'src/features/personalization/experience/adaptive-path-journey-contracts.ts',
  'src/features/personalization/experience/adaptive-path-journey-control.tsx',
  'src/app/teacher/classes/[classId]/analytics-v2/page.tsx',
  'src/features/teacher/control-correction-teacher-report.ts',
];
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1100 },
  { name: 'mobile-320', width: 320, height: 1100 },
] as const;
const captureEnabled = process.env.ADAPTIVE_PATH_CORRECTION_OUTCOMES_EVIDENCE_CAPTURE === '1';
const screenshots: Array<Record<string, unknown>> = [];
const assertions: Array<Record<string, unknown>> = [];

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtCommit(commitSha: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${commitSha}:${file}`]));
}

function hasWorkingTreeSourceDrift(): boolean {
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', generatorFile, ...productionSourceFiles]);
    return false;
  } catch {
    return true;
  }
}

function fulfill(route: Route, json: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(json),
  });
}

function studentJourney() {
  const outcome = (state: string, limitation: string | null, index: number) => ({
    candidateFingerprint: `correction-p3-${state}`,
    decision: 'confirmed',
    createdAt: `2026-08-06T0${index}:00:00.000Z`,
    applied: true,
    outcome: {
      state,
      limitation,
      decisionCreatedAt: `2026-08-06T0${index}:00:00.000Z`,
      associatedNodeCount: 2,
      evidenceCount: state === 'pending-verification' ? 1 : 2,
    },
  });
  return {
    path: { id: 'path-p3', title: '控制系统纠偏学习路径' },
    goal: { id: 'control-correction' },
    context: { pathId: 'path-p3', goalId: 'control-correction', requestedNodeId: 'node-1' },
    current: { nodeId: 'node-1', title: '后续验证节点', type: 'knowledge_card' },
    progress: { completed: 1, total: 3 },
    return: {
      label: '返回学习路径',
      href: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-p3&nodeId=node-1',
    },
    pathStatus: 'active',
    nextAction: {
      state: 'ready',
      nodeId: 'node-1',
      title: '后续验证节点',
      type: 'knowledge_card',
      href: '/knowledge/card-p3',
      reason: null,
      recovery: null,
    },
    correction: {
      proposal: null,
      unavailableReason: null,
      candidateFingerprint: null,
      pathUpdatedAt: '2026-08-06T08:00:00.000Z',
      decision: null,
      history: [
        outcome('improved', null, 1),
        outcome('needs-review', null, 2),
        outcome('pending-verification', 'insufficient-confidence', 3),
        outcome('indeterminate', 'conflicting-follow-up-evidence', 4),
      ],
    },
  };
}

async function installStudentFixture(page: Page) {
  await page.route('**/api/learning-paths/path-p3/journey*', async (route) => {
    await fulfill(route, { journey: studentJourney() });
  });
}

function teacherInsights() {
  return {
    scope: 'cumulative',
    scopeLabel: '累计能力达成',
    availability: { state: 'available', reason: 'available' },
    classInfo: {
      id: 'class-p3', name: '控制系统实验班', code: 'P3', description: null, semester: '暑期', year: '2026', studentCount: 3,
    },
    governance: {
      tone: 'healthy', label: '治理结果可用', detail: '3 名学生的聚合证据可用。', coveredStudents: 3, totalStudents: 3,
      pendingStudents: 0, coverageRatio: 1, lastUpdatedLabel: '刚刚更新', classSnapshotAt: '2026-08-06T08:00:00.000Z', latestStudentSnapshotAt: '2026-08-06T08:00:00.000Z',
    },
    overview: { overallIndex: 82, highRiskStudents: 0, mediumRiskStudents: 0, attentionStudents: 0, averageFactCount: 4 },
    ability: {
      state: 'ready',
      dimensions: [{ dimension: 'control_design', label: '控制设计', mean: 82, meanConfidence: 0.9, includedCount: 3, missingCount: 0 }],
      taskAttainment: null,
      levelDistribution: { excellent: 1, good: 2, fair: 0, weak: 0 },
    },
    trendDistribution: { up: 1, stable: 2, down: 0, 'not-comparable': 0 },
    riskDistribution: { bySeverity: { high: 0, medium: 0, low: 3 } },
    diagnosis: null,
    arena: null,
    spotlightStudents: [],
    students: [],
  };
}

function correctionReport(kind: 'mixed' | 'empty') {
  const zero = { count: 0, rate: 0 };
  const states = kind === 'mixed'
    ? {
        improved: { count: 1, rate: 0.25 },
        'needs-review': { count: 1, rate: 0.25 },
        'pending-verification': { count: 1, rate: 0.25 },
        indeterminate: { count: 1, rate: 0.25 },
      }
    : { improved: zero, 'needs-review': zero, 'pending-verification': zero, indeterminate: zero };
  return { correctionOutcomeSummary: { total: kind === 'mixed' ? 4 : 0, states } };
}

async function installTeacherFixture(page: Page, kind: 'mixed' | 'empty') {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    maxAge: 60 * 60,
    token: {
      id: 'teacher-p3',
      sub: 'teacher-p3',
      name: '教师证据账号',
      email: 'teacher-p3@example.invalid',
      role: 'TEACHER',
    },
  });
  await page.context().addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  await page.route('**/api/auth/session', async (route) => fulfill(route, {
    user: { id: 'teacher-p3', name: '教师证据账号', role: 'TEACHER' },
    expires: '2099-01-01T00:00:00.000Z',
  }));
  await page.route('**/api/teacher/classes/class-p3/insights', async (route) => fulfill(route, teacherInsights()));
  await page.route('**/api/teacher/classes/class-p3/heatmap', async (route) => fulfill(route, {
    students: [], dimensions: [], matrix: [],
  }));
  await page.route('**/api/teacher/classes/class-p3/control-correction-report', async (route) => fulfill(route, {
    report: correctionReport(kind),
  }));
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  return dimensions;
}

async function assertPrivacy(page: Page) {
  const correctionSurface = page.locator('[data-teacher-correction-outcome-summary="aggregate-only"]');
  const html = await correctionSurface.count() > 0
    ? await correctionSurface.innerHTML()
    : await page.content();
  expect(html).not.toContain('userId');
  expect(html).not.toContain('evidenceRefs');
  expect(html).not.toContain('teacher-p3');
}

async function capturePage(page: Page, id: string, viewport: typeof viewports[number], route: string, checks: string[]) {
  const dimensions = await assertNoHorizontalOverflow(page);
  await assertPrivacy(page);
  mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `${id}-${viewport.name}.png`);
  const image = await page.screenshot({ path: file, fullPage: true });
  screenshots.push({
    id,
    route,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    noHorizontalOverflow: true,
    keyboardFocus: true,
    privacySafe: true,
    checks,
    geometry: dimensions,
  });
  assertions.push({ id, viewport: viewport.name, route, passed: true, checks });
}

test('Commercial UI evidence manifest is bound to the reviewed source checkpoint', () => {
  test.skip(captureEnabled, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    sourceRevision?: string;
    generator?: { file?: string; sha256?: string };
    productionSourceSha256?: Record<string, string>;
    assertions?: Array<{ passed?: boolean }>;
    screenshots?: Array<{ file?: string; sha256?: string; noHorizontalOverflow?: boolean }>;
  };
  expect(manifest.sourceRevision).toMatch(/^[0-9a-f]{40}$/);
  expect(hasWorkingTreeSourceDrift()).toBe(false);
  expect(manifest.generator?.file).toBe(generatorFile);
  expect(manifest.generator?.sha256).toBe(sourceHashAtCommit(manifest.sourceRevision!, generatorFile));
  expect(sourceHashAtCommit('HEAD', generatorFile)).toBe(manifest.generator?.sha256);
  for (const file of productionSourceFiles) {
    expect(manifest.productionSourceSha256?.[file]).toBe(sourceHashAtCommit('HEAD', file));
  }
  expect(manifest.assertions?.every((assertion) => assertion.passed)).toBe(true);
  for (const screenshot of manifest.screenshots ?? []) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file!);
    expect(existsSync(screenshotPath)).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
    expect(screenshot.noHorizontalOverflow).toBe(true);
  }
});

test.describe('captured student and teacher outcome surfaces', () => {
  test.skip(!captureEnabled, 'set ADAPTIVE_PATH_CORRECTION_OUTCOMES_EVIDENCE_CAPTURE=1 to capture');
  test.describe.configure({ mode: 'serial' });

  test('student journey exposes all four bounded outcome states at desktop and mobile widths', async ({ page }) => {
    const route = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&pathId=path-p3&nodeId=node-1&correctionFixture=outcomes';
    await installStudentFixture(page);
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route, { waitUntil: 'networkidle' });
      const journeyControl = page.locator('[data-adaptive-path-journey-control]').first();
      await expect(journeyControl).toBeVisible();
      const history = journeyControl.locator('details').last();
      const summary = history.locator('summary');
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(journeyControl.locator('[data-adaptive-path-correction-outcome="improved"]')).toHaveCount(1);
      await expect(journeyControl.locator('[data-adaptive-path-correction-outcome="needs-review"]')).toHaveCount(1);
      await expect(journeyControl.locator('[data-adaptive-path-correction-outcome="pending-verification"]')).toHaveCount(1);
      await expect(journeyControl.locator('[data-adaptive-path-correction-outcome="indeterminate"]')).toHaveCount(1);
      await capturePage(page, 'student-outcomes', viewport, route, [
        'four controlled student outcome states visible',
        'keyboard focus reaches decision history',
        'no horizontal overflow',
        'raw evidence and user identifiers absent',
      ]);
    }
  });

  test('teacher aggregate view exposes mixed and empty samples without student drilldown', async ({ page }) => {
    const route = '/teacher/classes/class-p3/analytics-v2';
    for (const [kind, viewport] of [
      ['mixed', viewports[0]],
      ['empty', viewports[1]],
    ] as const) {
      await installTeacherFixture(page, kind);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route, { waitUntil: 'networkidle' });
      const summary = page.locator('[data-teacher-correction-outcome-summary="aggregate-only"]');
      await expect(summary).toBeVisible();
      await expect(summary.locator('[data-correction-outcome-state="improved"]')).toHaveCount(1);
      await expect(summary.locator('[data-correction-outcome-state="needs-review"]')).toHaveCount(1);
      await expect(summary.locator('[data-correction-outcome-state="pending-verification"]')).toHaveCount(1);
      await expect(summary.locator('[data-correction-outcome-state="indeterminate"]')).toHaveCount(1);
      const refresh = page.locator('header button').first();
      await refresh.focus();
      await expect(refresh).toBeFocused();
      await capturePage(page, `teacher-outcomes-${kind}`, viewport, route, [
        kind === 'mixed' ? 'mixed aggregate counts for four states' : 'empty aggregate sample returns zero counts',
        'keyboard focus reaches refresh control',
        'no horizontal overflow',
        'student identifiers and raw evidence references absent',
      ]);
    }
  });
});

test.afterAll(() => {
  if (!captureEnabled || assertions.length !== 4 || screenshots.length !== 4) return;
  mkdirSync(evidenceDir, { recursive: true });
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    capturedAt: new Date().toISOString(),
    sourceRevision,
    generator: { file: generatorFile, sha256: sourceHashAtCommit(sourceRevision, generatorFile) },
    productionSourceSha256: Object.fromEntries(productionSourceFiles.map((file) => [file, sourceHashAtCommit(sourceRevision, file)])),
    routes: [
      '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&pathId=path-p3&nodeId=node-1&correctionFixture=outcomes',
      '/teacher/classes/class-p3/analytics-v2',
    ],
    assertions,
    screenshots,
    privacy: { rawEvidenceReferencesVisible: false, userIdentifiersVisible: false },
  }, null, 2)}\n`, 'utf8');
});
