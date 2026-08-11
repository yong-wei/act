import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const generatorFile = 'tests/client-server-build-boundaries-commercial-ui.spec.ts';
const productionSourceFiles = [
  'src/features/assignments/student-assignment-workspace.tsx',
  'src/features/graph-center/graph-center-client.tsx',
  'src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx',
  'src/features/interactive/unit-1-1-see-the-full-picture/teacher-page.tsx',
  'src/lib/assignments/assignment-domain.ts',
  'src/lib/assignments/submission-domain.ts',
  'src/lib/layered-graph/bindings.ts',
  'src/lib/layered-graph/course-page-drawer.ts',
  'src/lib/layered-graph/scope.ts',
];
const trackedSourceFiles = [generatorFile, ...productionSourceFiles];
const evidenceDir = path.resolve(
  process.cwd(),
  'openspec/changes/fix-client-server-build-boundaries/evidence/commercial-ui',
);
const manifestPath = path.join(evidenceDir, 'manifest.json');
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;
type EvidenceRoute = {
  name: string;
  href: string;
  ready: string;
  focus: string;
  focusRole?: 'button' | 'tab' | 'assignment-nav';
  role?: 'STUDENT' | 'TEACHER';
};

const routes: readonly EvidenceRoute[] = [
  {
    name: 'interactive-student',
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo',
    ready: '学生学习台',
    focus: '下一页',
  },
  {
    name: 'interactive-teacher',
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/demo',
    ready: '教师投影',
    focus: '下一页',
    role: 'TEACHER',
  },
  {
    name: 'graph-center',
    href: '/graph-center',
    ready: '图谱中心',
    focus: '知识',
    focusRole: 'tab',
  },
  {
    name: 'student-assignment',
    href: '/missions/assignments/assignment-1338?revisionId=revision-1338',
    ready: '闭环系统稳态误差分析',
    focus: '第 1 题',
    focusRole: 'assignment-nav',
    role: 'STUDENT',
  },
] as const;
const expectedScreenshotFiles = viewports.flatMap((viewport) => routes.map((route) => path.posix.join(
  'openspec/changes/fix-client-server-build-boundaries/evidence/commercial-ui',
  `${route.name}-${viewport.name}.png`,
)));
const screenshots: Array<Record<string, unknown>> = [];
const assertions: Array<Record<string, unknown>> = [];

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtRevision(revision: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${revision}:${file}`]));
}

function currentHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function hasWorkingTreeSourceDrift(): boolean {
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...trackedSourceFiles]);
    return false;
  } catch {
    return true;
  }
}

function isAncestor(ancestor: string, descendant: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

async function addSession(context: BrowserContext, role: 'STUDENT' | 'TEACHER') {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: `evidence-${role.toLowerCase()}-1338`,
      email: `evidence-${role.toLowerCase()}-1338@example.test`,
      name: role === 'TEACHER' ? '界面核验教师' : '界面核验学生',
      role,
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

function assignmentFixture() {
  return {
    id: 'assignment-1338',
    revisionId: 'revision-1338',
    title: '闭环系统稳态误差分析',
    instructions: '逐题完成分析，并独立保存每题草稿。',
    availableAt: '2026-08-11T00:00:00.000Z',
    dueAt: '2026-08-18T10:00:00.000Z',
    state: 'IN_PROGRESS',
    nextAction: 'continue-answering',
    submittedRequiredCount: 0,
    requiredQuestionCount: 1,
    contextStatus: 'CURRENT',
    historicalOnly: false,
    canMutate: true,
    questions: [{
      id: 'question-1338',
      stableQuestionId: 'stable-question-1338',
      orderIndex: 0,
      promptText: '说明系统型别与阶跃输入稳态误差的关系。',
      responseType: 'SUBJECTIVE_TEXT',
      points: 10,
      required: true,
      state: 'DRAFT',
      version: 1,
      currentAttemptNumber: null,
      textDraft: '已有草稿。',
    }],
  };
}

async function installAssignmentRoute(page: Page) {
  await page.route('**/api/student/assignments/assignment-1338?revisionId=revision-1338', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignment: assignmentFixture() }) }));
}

async function assertNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test('commercial UI evidence remains bound to unchanged implementation sources', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    schemaVersion?: string;
    capturedAt?: string;
    sourceRevision?: string;
    generator?: { file?: string; sha256?: string };
    productionSourceSha256?: Record<string, string>;
    assertions?: Array<{ passed?: boolean; focusReachable?: boolean; noHorizontalOverflow?: boolean }>;
    screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }>;
  };
  const head = currentHead();
  expect(manifest.schemaVersion).toBe('commercial-ui-evidence.v1');
  expect(manifest.capturedAt && Number.isFinite(Date.parse(manifest.capturedAt))).toBe(true);
  expect(manifest.sourceRevision).toMatch(/^[0-9a-f]{40}$/);
  expect(isAncestor(manifest.sourceRevision!, head)).toBe(true);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  expect(manifest.generator).toEqual({
    file: generatorFile,
    sha256: sourceHashAtRevision(manifest.sourceRevision!, generatorFile),
  });
  expect(sourceHashAtRevision(head, generatorFile)).toBe(manifest.generator?.sha256);
  for (const file of productionSourceFiles) {
    const expected = manifest.productionSourceSha256?.[file];
    expect(expected, `${file} source hash missing`).toBe(sourceHashAtRevision(manifest.sourceRevision!, file));
    expect(sourceHashAtRevision(head, file), `${file} changed after evidence capture`).toBe(expected);
  }
  expect(manifest.assertions).toHaveLength(viewports.length * routes.length);
  expect(manifest.assertions?.every((item) => item.passed && item.focusReachable && item.noHorizontalOverflow)).toBe(true);
  expect(manifest.screenshots?.map((item) => item.file).sort()).toEqual([...expectedScreenshotFiles].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const file = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(file), screenshot.file).toBe(true);
    expect(sha256(readFileSync(file))).toBe(screenshot.sha256);
    expect(screenshot.noHorizontalOverflow).toBe(true);
  }
});

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route.name} remains usable at ${viewport.name}`, async ({ page, context }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      if (route.role) await addSession(context, route.role);
      if (route.name === 'student-assignment') await installAssignmentRoute(page);
      await page.goto(route.href, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(route.ready, { exact: true }).first()).toBeVisible();
      const focusTarget = route.focusRole === 'tab'
        ? page.getByRole('tab').first()
        : route.focusRole === 'assignment-nav'
          ? page.getByRole('navigation', { name: '作业题目' }).getByRole('button').first()
          : page.getByRole('button', { name: route.focus, exact: true }).first();
      await expect(focusTarget).toBeVisible();
      await focusTarget.focus();
      await expect(focusTarget).toBeFocused();
      await assertNoHorizontalOverflow(page);
      const file = path.join(evidenceDir, `${route.name}-${viewport.name}.png`);
      const image = await page.screenshot({
        path: updateEvidence ? file : undefined,
        fullPage: false,
        animations: 'disabled',
      });
      assertions.push({
        route: route.href,
        viewport: `${viewport.width}x${viewport.height}`,
        passed: true,
        focusReachable: true,
        noHorizontalOverflow: true,
        checks: ['primary workspace visible', 'navigation and primary control reachable', 'keyboard focus reaches control', 'no horizontal overflow'],
      });
      if (updateEvidence) {
        screenshots.push({
          route: route.href,
          viewport: viewport.name,
          width: viewport.width,
          height: viewport.height,
          file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
          sha256: sha256(image),
          noHorizontalOverflow: true,
        });
      }
    });
  }
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(assertions).toHaveLength(viewports.length * routes.length);
  expect(screenshots).toHaveLength(viewports.length * routes.length);
  mkdirSync(evidenceDir, { recursive: true });
  const sourceRevision = currentHead();
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    capturedAt: new Date().toISOString(),
    sourceRevision,
    generator: { file: generatorFile, sha256: sourceHashAtRevision(sourceRevision, generatorFile) },
    productionSourceSha256: Object.fromEntries(
      productionSourceFiles.map((file) => [file, sourceHashAtRevision(sourceRevision, file)]),
    ),
    routes: routes.map((route) => route.href),
    assertions,
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
