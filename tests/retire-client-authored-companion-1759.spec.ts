import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/issue-1759-retire-client-authored-companion');
const manifestPath = join(evidenceDir, 'evidence-manifest.json');
const generatorPath = 'tests/retire-client-authored-companion-1759.spec.ts';
const sourceFiles = [
  'src/features/control-workbench/shell/control-workbench-shell.tsx',
  'src/app/api/ai/intervention/generate/route.ts',
  'src/lib/konling-agent-runtime.ts',
  'src/features/arena/student/konling-official-followup.ts',
  'src/features/ai/companion/arena-companion-context.ts',
] as const;
const evidenceSourceFiles = [generatorPath, ...sourceFiles] as const;
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
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

function sourceHash(file: string): string {
  return sha256(readFileSync(join(process.cwd(), file)));
}

function sourceHashAtCommit(commitSha: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${commitSha}:${file}`], { cwd: process.cwd() }));
}

function assertCleanWorkingTree(phase: string) {
  expect(
    git(['status', '--porcelain', '--untracked-files=all']),
    `${phase}: working tree must be clean before binding evidence to HEAD`,
  ).toBe('');
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

async function capture(page: Page, name: string, assertions: string[]) {
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const file = join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
  const size = page.viewportSize();
  screenshots.push({
    file: `artifacts/commercial-ui/issue-1759-retire-client-authored-companion/${name}.png`,
    sha256: sha256(readFileSync(file)),
    scenario: name,
    route: representativeRoute,
    width: size?.width ?? 0,
    height: size?.height ?? 0,
    assertions,
  });
}

test('Arena workbench keeps official companion and rejects the old hand-entered panel', async ({ page }) => {
  if (updateEvidence) {
    assertCleanWorkingTree('before capture');
  }
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
    await capture(page, `official-${viewport.name}`, [
      'old hand-entered companion panel is absent',
      'official follow-up card remains reachable',
      'no horizontal overflow',
    ]);
  }

  if (!updateEvidence) return;

  assertCleanWorkingTree('before writing evidence manifest');
  const sourceRevision = git(['rev-parse', 'HEAD']);
  for (const file of evidenceSourceFiles) {
    expect(git(['hash-object', file]), `${file} working tree must match ${sourceRevision}`).toBe(
      git(['rev-parse', `${sourceRevision}:${file}`]),
    );
  }
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    issue: 1759,
    capturedAt: new Date().toISOString(),
    commitSha: sourceRevision,
    generator: generatorPath,
    generatorSha256: sourceHash(generatorPath),
    representativeRoute,
    sourceSha256: Object.fromEntries(
      evidenceSourceFiles.map((file) => [file, sourceHash(file)]),
    ),
    sourceGitBlobIds: Object.fromEntries(
      evidenceSourceFiles.map((file) => [file, git(['hash-object', file])]),
    ),
    screenshots,
  }, null, 2)}\n`);
});

test('evidence manifest stays bound to a reachable capture revision', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    sourceSha256?: Record<string, string>;
    sourceGitBlobIds?: Record<string, string>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(git(['cat-file', '-t', manifest.commitSha!])).toBe('commit');
  for (const file of evidenceSourceFiles) {
    const expectedHash = manifest.sourceSha256?.[file];
    expect(expectedHash, `${file} source hash missing or stale`).toBe(sourceHashAtCommit('HEAD', file));
    expect(sourceHash(file)).toBe(expectedHash);
    expect(manifest.sourceGitBlobIds?.[file]).toBe(git(['rev-parse', `HEAD:${file}`]));
  }
});
