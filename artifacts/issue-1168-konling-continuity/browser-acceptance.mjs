import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/issue-1168-konling-continuity');
const baseUrl = process.env.KONLING_CONTINUITY_BASE_URL ?? 'http://localhost:3000';
const codeCommit = process.env.CODE_COMMIT ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const student = { account: 'demo', password: 'DemoStudent@Just2026!' };
const sourceFiles = [
  'src/components/ai/global-ai-sidebar.tsx',
  'src/components/ai/konling-continuity-card.tsx',
  'src/lib/konling-learning-continuity.ts',
  'src/lib/konling-continuity-assessment.ts',
  'src/features/assessment/adaptive-persistence.ts',
  'artifacts/issue-1168-konling-continuity/browser-acceptance.mjs',
];

const unfinished = {
  snapshotId: 'continuity:evidence:unfinished',
  state: 'unfinished_task',
  evidenceAsOf: '2026-08-01T10:00:00.000Z',
  unfinishedTask: {
    pathId: 'path-evidence',
    nodeId: 'node-evidence',
    title: '控制系统校正设计',
    href: '/assessment/adaptive-practice?pathId=path-evidence&nodeId=node-evidence',
  },
};
const recent = {
  snapshotId: 'continuity:evidence:recent',
  state: 'recent_mistake',
  evidenceAsOf: '2026-08-01T10:05:00.000Z',
  recentMistake: {
    answerId: 'answer-evidence',
    knowledgeId: 'root-locus',
    knowledgeLabel: '根轨迹稳定性判断',
    structuredCauseId: 'cause-evidence',
    structuredCauseLabel: '遗漏闭环极点跨越虚轴条件',
  },
};
const cold = {
  snapshotId: 'continuity:evidence:cold',
  state: 'cold_start',
  evidenceAsOf: null,
};
const refreshed = {
  ...recent,
  snapshotId: 'continuity:evidence:refreshed',
  evidenceAsOf: '2026-08-01T10:10:00.000Z',
  feedback: {
    message: '本次检查题已经正确；累计状态仍需继续观察。',
    nextAction: '再做一道根轨迹稳定性陪伴练习',
  },
};

const state = {
  snapshot: unfinished,
  nextQuestion: 'question',
  nextQuestionDelayMs: 0,
};
const screenshots = [];
const assertions = [];

function check(name, condition, detail) {
  assertions.push({ name, passed: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}: ${detail}`);
}

async function hashFile(relativePath) {
  return createHash('sha256').update(await readFile(path.join(repoRoot, relativePath))).digest('hex');
}

async function capture(page, name, viewport, stateName) {
  const relativePath = `artifacts/issue-1168-konling-continuity/${name}.png`;
  await page.screenshot({ path: path.join(repoRoot, relativePath), fullPage: false });
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  check(`${name}: no horizontal overflow`, geometry.scrollWidth <= geometry.clientWidth, JSON.stringify(geometry));
  screenshots.push({
    name,
    state: stateName,
    viewport,
    file: relativePath,
    sha256: await hashFile(relativePath),
    noHorizontalOverflow: true,
  });
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.locator('input[name="account"]').fill(student.account);
    await page.locator('input[name="password"]').fill(student.password);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), null, { timeout: 20000 }).catch(() => undefined);
    if (!new URL(page.url()).pathname.startsWith('/login')) return;
  }
  const diagnostic = (await page.locator('main').innerText()).slice(0, 1200);
  throw new Error(`Student login remained at ${page.url()}: ${diagnostic}`);
}

async function openSidebar(page) {
  const trigger = page.locator('button[data-platform-floating-dock-primary="konling"]:visible');
  await trigger.waitFor({ state: 'visible', timeout: 20000 });
  check('single visible Konling trigger', await trigger.count() === 1, `count=${await trigger.count()}`);
  await page.waitForFunction(() => {
    const button = document.querySelector('button[data-platform-floating-dock-primary="konling"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: 30000 });
  await trigger.click();
  await page.locator('[data-global-ai-sidebar="open"]').waitFor({ state: 'visible', timeout: 20000 });
}

async function closeSidebar(page) {
  await page.keyboard.press('Escape');
  await page.locator('[data-global-ai-sidebar="closed"]').waitFor({ state: 'attached', timeout: 10000 });
}

async function setSnapshotAndOpen(page, snapshot) {
  state.snapshot = snapshot;
  await openSidebar(page);
  const card = page.locator(`[data-konling-continuity-card="${snapshot.state}"]`);
  await card.waitFor({ state: 'visible', timeout: 10000 });
  return card;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const apiRequests = [];
  await page.addInitScript(() => {
    window.localStorage.setItem('act:knowledge-product-qa', 'true');
    window.__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
  });

  await page.route('**/api/ai/konling-continuity', async (route) => {
    apiRequests.push({ api: 'continuity', snapshotId: state.snapshot.snapshotId });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.snapshot) });
  });
  await page.route('**/api/assessment/next-question', async (route) => {
    apiRequests.push({ api: 'next-question', body: route.request().postDataJSON() });
    if (state.nextQuestionDelayMs) await new Promise((resolve) => setTimeout(resolve, state.nextQuestionDelayMs));
    if (state.nextQuestion === 'failure') {
      await route.abort('failed');
      return;
    }
    if (state.nextQuestion === 'unavailable') {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No eligible question' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        question: {
          id: 'question-evidence',
          text: '闭环极点跨越虚轴时，稳定性如何变化？',
          options: [
            { label: 'A', text: '由稳定变为不稳定' },
            { label: 'B', text: '保持稳定' },
          ],
        },
      }),
    });
  });
  await page.route('**/api/assessment/submit-answer', async (route) => {
    apiRequests.push({ api: 'submit-answer', body: route.request().postDataJSON() });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isCorrect: true, recommendedFocus: ['根轨迹稳定性判断'] }),
    });
  });
  await page.route('**/api/ai/sessions**', async (route) => {
    const request = route.request();
    apiRequests.push({ api: 'conversation-session', method: request.method(), url: request.url() });
    const now = '2026-08-01T10:12:00.000Z';
    const conversation = {
      id: 'conversation-evidence',
      userId: 'student-evidence',
      courseId: 'knowledge',
      pageId: '/knowledge',
      title: '证据会话',
      titleIsManual: false,
      pinned: false,
      pinnedAt: null,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      expiresAt: '2026-08-08T10:12:00.000Z',
      messages: [],
      assistantBinding: null,
    };
    if (request.method() === 'POST' || /\/api\/ai\/sessions\/[^?]+/.test(request.url())) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(conversation) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversations: [] }) });
  });
  await page.route('**/api/ai/chat', async (route) => {
    apiRequests.push({ api: 'chat', body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: 'data: [DONE]\n\n' });
  });

  try {
    await login(page);
    await page.goto(`${baseUrl}/assessment/adaptive-practice?qa=knowledge-product`, { waitUntil: 'domcontentloaded' });

    const unfinishedCard = await setSnapshotAndOpen(page, unfinished);
    check('unfinished state rendered', await unfinishedCard.count() === 1, 'unfinished card missing');
    const continueLink = unfinishedCard.getByRole('link', { name: '继续学习' });
    check('continue action preserves authorized href',
      await continueLink.getAttribute('href') === unfinished.unfinishedTask.href,
      String(await continueLink.getAttribute('href')),
    );
    await capture(page, 'desktop-1440-unfinished', { width: 1440, height: 1000 }, 'unfinished_task');

    const skipButton = unfinishedCard.getByRole('button', { name: '暂时跳过' });
    await skipButton.press('Space');
    await unfinishedCard.waitFor({ state: 'detached', timeout: 10000 });
    check('Space activates temporary skip', await unfinishedCard.count() === 0, 'card remained visible');
    await closeSidebar(page);
    await openSidebar(page);
    await page.waitForTimeout(300);
    check('close and reopen same-snapshot dedup', await page.locator('[data-konling-continuity-card]').count() === 0, 'same snapshot repeated after reopen');

    const knowledgeLink = page.locator('a[href="/knowledge"]:visible');
    await knowledgeLink.first().click({ force: true });
    await page.waitForURL((url) => url.pathname === '/knowledge', { timeout: 20000 });
    await page.waitForTimeout(500);
    check('sidebar remains open across page navigation', await page.locator('[data-global-ai-sidebar="open"]').count() === 1, 'sidebar closed during navigation');
    check('cross-page same-snapshot dedup', await page.locator('[data-konling-continuity-card]').count() === 0, 'same snapshot repeated');
    await capture(page, 'desktop-1440-cross-page-dedup', { width: 1440, height: 1000 }, 'deduplicated');
    await closeSidebar(page);
    await page.goto(`${baseUrl}/assessment/adaptive-practice?qa=knowledge-product`, { waitUntil: 'domcontentloaded' });

    await page.setViewportSize({ width: 320, height: 900 });
    const recentCard = await setSnapshotAndOpen(page, recent);
    await capture(page, 'mobile-320-recent-mistake', { width: 320, height: 900 }, 'recent_mistake');
    check('structured cause rendered', (await recentCard.textContent()).includes(recent.recentMistake.structuredCauseLabel), 'cause missing');

    state.nextQuestionDelayMs = 1200;
    const reviewButton = recentCard.getByRole('button', { name: '做一道检查题' });
    await reviewButton.click();
    await recentCard.getByRole('button', { name: '正在获取…' }).waitFor({ state: 'visible', timeout: 5000 });
    await capture(page, 'mobile-320-question-loading', { width: 320, height: 900 }, 'loading');
    const optionA = recentCard.getByRole('button', { name: 'A. 由稳定变为不稳定' });
    await optionA.waitFor({ state: 'visible', timeout: 10000 });
    state.nextQuestionDelayMs = 0;
    await optionA.press('Enter');
    await recentCard.getByRole('status').waitFor({ state: 'visible', timeout: 10000 });
    check('Enter submits governed answer', apiRequests.filter((item) => item.api === 'submit-answer').length === 1, JSON.stringify(apiRequests));
    await capture(page, 'mobile-320-submit-feedback', { width: 320, height: 900 }, 'submitted-feedback');
    await closeSidebar(page);

    state.nextQuestion = 'unavailable';
    const unavailableSnapshot = { ...recent, snapshotId: 'continuity:evidence:unavailable' };
    const unavailableCard = await setSnapshotAndOpen(page, unavailableSnapshot);
    await unavailableCard.getByRole('button', { name: '做一道检查题' }).press('Enter');
    await unavailableCard.getByRole('alert').waitFor({ state: 'visible', timeout: 10000 });
    await capture(page, 'mobile-320-question-unavailable', { width: 320, height: 900 }, 'unavailable');
    await closeSidebar(page);

    state.nextQuestion = 'failure';
    const failedSnapshot = { ...recent, snapshotId: 'continuity:evidence:failed' };
    const failedCard = await setSnapshotAndOpen(page, failedSnapshot);
    await failedCard.getByRole('button', { name: '做一道检查题' }).press('Enter');
    await failedCard.getByRole('alert').waitFor({ state: 'visible', timeout: 10000 });
    check('network failure leaves retryable state', await failedCard.getByRole('button', { name: '重新获取检查题' }).count() === 1, 'retry action missing');
    await capture(page, 'mobile-320-question-failed', { width: 320, height: 900 }, 'failed');
    state.nextQuestion = 'question';
    await failedCard.getByRole('button', { name: '重新获取检查题' }).press('Enter');
    await failedCard.getByRole('button', { name: 'A. 由稳定变为不稳定' }).waitFor({ state: 'visible', timeout: 10000 });
    check('failed question request can retry', true, 'retry did not load a question');
    await closeSidebar(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    const refreshedCard = await setSnapshotAndOpen(page, refreshed);
    check('new evidence presents refreshed snapshot', await refreshedCard.locator('[data-konling-continuity-feedback]').count() === 1, 'feedback missing');
    await capture(page, 'desktop-1440-new-evidence', { width: 1440, height: 1000 }, 'new-evidence');
    await refreshedCard.getByRole('button', { name: '重新讲解' }).press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-konling-continuity-card]') === null);
    await page.waitForTimeout(200);
    const reExplainRequest = apiRequests.find((item) => item.api === 'chat');
    check('re-explain enters governed Konling conversation',
      reExplainRequest?.body?.messages?.some((message) =>
        message.parts?.some((part) => part.type === 'text' && part.text === `请讲解知识点：${recent.recentMistake.knowledgeLabel}`),
      ),
      JSON.stringify(reExplainRequest),
    );
    await closeSidebar(page);

    const coldCard = await setSnapshotAndOpen(page, cold);
    const goalButton = coldCard.getByRole('button', { name: '输入学习目标' });
    await goalButton.press('Enter');
    const inputFocused = await page.locator('input[name="global-ai-sidebar-input"]').evaluate((element) => element === document.activeElement);
    check('Enter focuses cold-start goal input', inputFocused, 'goal input was not focused');
    await capture(page, 'desktop-1440-cold-start', { width: 1440, height: 1000 }, 'cold_start');
    await page.keyboard.press('Escape');
    await page.locator('[data-global-ai-sidebar="closed"]').waitFor({ state: 'attached', timeout: 10000 });
    check('Escape closes sidebar', await page.locator('[data-global-ai-sidebar="open"]').count() === 0, 'sidebar remained open');

    const requestedSnapshots = apiRequests.filter((item) => item.api === 'continuity').map((item) => item.snapshotId);
    check('unchanged snapshot fetched but presented once', requestedSnapshots.filter((id) => id === unfinished.snapshotId).length >= 2, JSON.stringify(requestedSnapshots));
    const companionQuestionRequests = apiRequests.filter((item) =>
      item.api === 'next-question' && item.body?.sessionId?.startsWith('konling-continuity:'),
    );
    check('one governed question request per snapshot action', companionQuestionRequests.length === 4, JSON.stringify(apiRequests));

    const sourceSha256 = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, await hashFile(file)])));
    const manifest = {
      issue: 1168,
      generatedAt: new Date().toISOString(),
      codeCommit,
      baseUrl,
      route: '/assessment/adaptive-practice',
      authenticatedRole: 'student',
      sourceSha256,
      assertions,
      screenshots,
      apiRequests,
      passed: assertions.every((assertion) => assertion.passed),
    };
    await writeFile(path.join(outputDir, 'browser-evidence.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (!manifest.passed) process.exitCode = 1;
    process.stdout.write(`Captured ${screenshots.length} Issue 1168 browser states for ${codeCommit}\n`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
