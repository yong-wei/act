import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1314-official-followup');
const generatorPath = 'tests/arena-official-konling-followup-1314.spec.ts';
const sourceFiles = [
  'src/features/arena/student/konling-official-followup.ts',
  'src/features/arena/submissions/arena-submission-panel.tsx',
  'src/app/api/arena/evaluate/route.ts',
  'src/features/arena/workbench/arena-workbench-submission-mount.tsx',
] as const;
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const representativeRoute = '/interactive-learning/control-workbench?arenaTask=task-third-order-block-diagram';
const screenshots: Array<Record<string, unknown>> = [];

const officialSubmission = {
  id: 'submission-followup-1',
  userId: 'student-e2e',
  taskId: 'task-third-order-block-diagram',
  studentLabel: '学生',
  artifactHash: 'hash-1',
  artifact: {
    id: 'artifact-1',
    taskId: 'task-third-order-block-diagram',
    method: 'composite-compensation',
    params: { kp: 1.2, ki: 0.1, kd: 0.05 },
    createdAt: '2026-08-16T00:00:00.000Z',
  },
  evaluation: {
    taskId: 'task-third-order-block-diagram',
    artifact: { id: 'artifact-1' },
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
  submittedAt: '2026-08-16T00:00:00.000Z',
  reusedEvaluation: false,
};

const followup = {
  id: 'advice-followup-1',
  classId: null,
  suggestion: {
    kind: 'constraint-violation',
    title: '本次正式评测存在硬约束违规',
    evidence: ['稳定性：闭环主导极点进入右半平面'],
    nextStep: '先使当前未通过的硬约束达标，再比较其他性能指标。',
    baselineSubmissionId: officialSubmission.id,
  },
};

const revisitFollowup = {
  id: null,
  suggestion: {
    title: '正式评测回访',
    revisit: '与建议触发时的正式评测相比，得分变化 +12；指标变化：调节时间 -2.1；硬约束变化：稳定性 未通过→通过；本次正式评测的硬约束均已通过。',
  },
};

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' }).trim();
}

function repositoryPath(filePath: string): string {
  return relative(process.cwd(), filePath).replaceAll('\\', '/');
}

async function installOfficialFollowupRoutes(page: Page, evaluateCount: { value: number }) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: { user: { id: 'student-e2e', email: 'demo@example.test', name: 'Demo student', role: 'STUDENT' } },
    });
  });
  await page.route('**/api/arena/submissions**', async (route) => {
    await route.fulfill({ json: { submissions: [], viewerUserId: 'student-e2e' } });
  });
  await page.route('**/api/ai/intervention/feedback', async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/arena/evaluate', async (route) => {
    evaluateCount.value += 1;
    await route.fulfill({
      json: evaluateCount.value === 1
        ? { submission: officialSubmission, konlingFollowup: followup }
        : {
          submission: {
            ...officialSubmission,
            id: 'submission-followup-2',
            evaluation: {
              ...officialSubmission.evaluation,
              valid: true,
              score: 60,
              metrics: { settlingTime: 6.3 },
              hardConstraintResults: [{ id: 'stability', label: '稳定性', passed: true }],
            },
          },
          konlingFollowup: revisitFollowup,
        },
    });
  });
}

async function capture(page: Page, name: string, assertions: string[]) {
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const file = join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const size = page.viewportSize();
  screenshots.push({
    file: repositoryPath(file),
    sha256: sha256(readFileSync(file)),
    scenario: name,
    route: representativeRoute,
    width: size?.width ?? 0,
    height: size?.height ?? 0,
    assertions,
  });
}

test('official Arena result panel shows Konling follow-up, revisit, and feedback', async ({ page }) => {
  const evaluateCount = { value: 0 };
  await installOfficialFollowupRoutes(page, evaluateCount);

  for (const viewport of [
    { name: 'desktop-1440', width: 1440, height: 1000 },
    { name: 'mobile-320', width: 320, height: 900 },
  ]) {
    evaluateCount.value = 0;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(representativeRoute, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '提交与排行榜预览' })).toBeVisible({ timeout: 20_000 });
    const submit = page.getByRole('button', { name: '提交复合校正控制器' });
    await expect(submit).toBeVisible();
    await submit.click();
    const card = page.locator('[data-konling-official-followup]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('本次正式评测存在硬约束违规');
    await card.locator('summary').click();
    await expect(card).toContainText('闭环主导极点进入右半平面');
    await expect(card).toContainText('先使当前未通过的硬约束达标');
    await expect(card.getByRole('button', { name: '有帮助' })).toBeVisible();
    await card.getByRole('button', { name: '有帮助' }).click();
    await expect(card).toContainText('已记录为有帮助。');
    await capture(page, `advice-${viewport.name}`, [
      'official result panel remains reachable',
      'follow-up card expands evidence and next step',
      'helpfulness feedback is recorded',
    ]);

    await submit.click();
    await expect(card).toContainText('得分变化 +12');
    await expect(card).toContainText('稳定性 未通过→通过');
    await capture(page, `revisit-${viewport.name}`, [
      'later official evaluation shows revisit comparison',
      'no invented superiority claim',
    ]);

    const overflow = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  }

  if (updateEvidence) {
    const sourceRevision = git(['rev-parse', 'HEAD']);
    const manifest = {
      schemaVersion: 1,
      issue: 1314,
      capturedAt: new Date().toISOString(),
      commitSha: sourceRevision,
      generator: generatorPath,
      generatorSha256: sha256(readFileSync(join(process.cwd(), generatorPath))),
      representativeRoute,
      sourceGitBlobIds: Object.fromEntries(
        [generatorPath, ...sourceFiles].map((file) => [file, git(['rev-parse', `${sourceRevision}:${file}`])]),
      ),
      sourceSha256: Object.fromEntries(
        [generatorPath, ...sourceFiles].map((file) => [file, sha256(readFileSync(join(process.cwd(), file)))]),
      ),
      screenshots,
    };
    writeFileSync(join(evidenceDir, 'evidence-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
});
