import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1759-retire-client-authored-companion');
const generatorPath = 'tests/retire-client-authored-companion-1759.spec.ts';
const sourceFiles = [
  'src/features/control-workbench/shell/control-workbench-shell.tsx',
  'src/app/api/ai/intervention/generate/route.ts',
  'src/lib/konling-agent-runtime.ts',
  'src/features/arena/student/konling-official-followup.ts',
] as const;
const representativeRoute = '/interactive-learning/control-workbench?arenaTask=task-third-order-block-diagram';
const screenshots: Array<Record<string, unknown>> = [];

const officialSubmission = {
  id: 'submission-1759-1',
  userId: 'student-e2e',
  taskId: 'task-third-order-block-diagram',
  studentLabel: '学生',
  artifactHash: 'hash-1759',
  artifact: {
    id: 'artifact-1759',
    taskId: 'task-third-order-block-diagram',
    method: 'composite-compensation',
    params: { kp: 1.2, ki: 0.1, kd: 0.05 },
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  evaluation: {
    taskId: 'task-third-order-block-diagram',
    artifact: { id: 'artifact-1759' },
    valid: false,
    score: 48,
    metrics: { settlingTime: 8.4 },
    satisfaction: {},
    hardConstraintResults: [
      { id: 'stability', label: '稳定性', passed: false, reason: '闭环主导极点进入右半平面' },
    ],
    penalties: [],
    explanation: [],
  },
  submittedAt: '2026-09-01T00:00:00.000Z',
  reusedEvaluation: false,
};

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' }).trim();
}

async function installOfficialFollowupRoutes(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: { user: { id: 'student-e2e', email: 'demo@example.test', name: 'Demo student', role: 'STUDENT' } },
    });
  });
  await page.route('**/api/arena/submissions**', async (route) => {
    await route.fulfill({ json: { submissions: [], viewerUserId: 'student-e2e' } });
  });
  await page.route('**/api/ai/intervention/generate', async (route) => {
    await route.fulfill({
      status: 400,
      json: { error: '竞技场受治理陪伴只能由正式评测提交创建' },
    });
  });
  await page.route('**/api/ai/intervention/feedback', async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/arena/evaluate', async (route) => {
    await route.fulfill({
      json: {
        submission: officialSubmission,
        konlingFollowup: {
          id: 'advice-1759-1',
          classId: null,
          suggestion: {
            kind: 'constraint-violation',
            title: '本次正式评测存在硬约束违规',
            evidence: ['稳定性：闭环主导极点进入右半平面'],
            nextStep: '先使当前未通过的硬约束达标，再比较其他性能指标。',
            baselineSubmissionId: officialSubmission.id,
          },
        },
      },
    });
  });
}

function assertNoOverflow(page: Page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  })).then((overflow) => {
    expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  });
}

test('Arena workbench keeps official companion and rejects the old hand-entered panel', async ({ page }) => {
  await installOfficialFollowupRoutes(page);

  for (const viewport of [
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'mobile-320', width: 320, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(representativeRoute, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '提交与排行榜预览' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[aria-label="AI伴随探究"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '记录练习' })).toHaveCount(0);
    const submit = page.getByRole('button', { name: '提交复合校正控制器' });
    await expect(submit).toBeVisible();
    await submit.focus();
    await expect(submit).toBeFocused();
    await submit.click();
    const card = page.locator('[data-konling-official-followup]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('本次正式评测存在硬约束违规');
    await card.locator('summary').click();
    await expect(card).toContainText('先使当前未通过的硬约束达标');
    await assertNoOverflow(page);

    mkdirSync(evidenceDir, { recursive: true });
    const file = join(evidenceDir, `official-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
    screenshots.push({
      file: `artifacts/commercial-ui/issue-1759-retire-client-authored-companion/official-${viewport.name}.png`,
      sha256: sha256(readFileSync(file)),
      scenario: `official-${viewport.name}`,
      route: representativeRoute,
      width: viewport.width,
      height: viewport.height,
      assertions: [
        'old hand-entered companion panel is absent',
        'official follow-up card remains reachable',
        'no horizontal overflow',
      ],
    });
  }

  const sourceRevision = git(['rev-parse', 'HEAD']);
  const files = [generatorPath, ...sourceFiles];
  expect(git(['status', '--porcelain', '--', generatorPath, ...sourceFiles]), 'evidence source files must be clean at capture HEAD').toBe('');
  for (const file of files) {
    expect(git(['hash-object', file]), `${file} working tree must match ${sourceRevision}`).toBe(
      git(['rev-parse', `${sourceRevision}:${file}`]),
    );
  }
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'evidence-manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    issue: 1759,
    capturedAt: new Date().toISOString(),
    commitSha: sourceRevision,
    generator: generatorPath,
    generatorSha256: sha256(readFileSync(join(process.cwd(), generatorPath))),
    representativeRoute,
    sourceSha256: Object.fromEntries(
      files.map((file) => [file, sha256(readFileSync(join(process.cwd(), file)))]),
    ),
    sourceGitBlobIds: Object.fromEntries(
      files.map((file) => [file, git(['hash-object', file])]),
    ),
    screenshots,
  }, null, 2)}\n`);
});
