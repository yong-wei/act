import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

const evidenceDir = 'artifacts/commercial-ui/standalone-copilot-entry-1815';
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;

const MARITIME_CANARIES = [
  '请获取当前的仿真状态',
  '指导 PID',
  '诺莫托',
  'CCS 规范',
  '航迹误差',
  '海况',
  '船舶控制',
  '查看和分析仿真器状态',
];

function chatStream(text: string) {
  return [
    'data: {"type":"start","messageId":"assistant-1815"}',
    'data: {"type":"text-start","id":"text-1815"}',
    `data: ${JSON.stringify({ type: 'text-delta', id: 'text-1815', delta: text })}`,
    'data: {"type":"text-end","id":"text-1815"}',
    'data: {"type":"finish","finishReason":"stop"}',
    'data: [DONE]',
    '',
  ].join('\n\n');
}

function conversationFixture(id = 'conversation-entry-1815') {
  return {
    id,
    userId: 'demo-student',
    courseId: 'ai-assistant',
    pageId: '/ai/copilot',
    title: '入口投影',
    titleIsManual: false,
    pinned: false,
    pinnedAt: null,
    lastActivityAt: '2026-09-02T00:00:00.000Z',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    expiresAt: null,
    messages: [],
    assistantBinding: null,
  };
}

const EVIDENCE_FIXTURES = {
  available: {
    limitations: ['已加载服务端核对的学习证据，建议仅作参考。'],
    confidenceLevel: 'medium' as const,
    freshness: 'current' as const,
    nextAction: { href: '/profile/evidence', label: '查看学习记录并复核证据' },
  },
  missing: {
    limitations: ['当前没有可核验的学习证据。'],
    confidenceLevel: 'none' as const,
    freshness: 'missing' as const,
    nextAction: { href: '/assessment/adaptive-practice?intent=practice', label: '去做一次自适应练习，补充学习证据' },
  },
  stale: {
    limitations: ['部分学习证据已经过期。'],
    confidenceLevel: 'medium' as const,
    freshness: 'stale' as const,
    nextAction: { href: '/profile/evidence', label: '查看学习记录并复核证据' },
  },
} as const;

function evidenceProjection(status: keyof typeof EVIDENCE_FIXTURES) {
  const fixture = EVIDENCE_FIXTURES[status];
  return {
    version: 'evidence-copilot-context.v1',
    status,
    limitations: [...fixture.limitations],
    sourceCoverage: {},
    confidenceLevel: fixture.confidenceLevel,
    freshness: fixture.freshness,
    preferredModalities: [],
    weakTargets: [],
    nextAction: fixture.nextAction,
    navigationHint: { source: null, assignment: null, intent: null },
  };
}

async function installStandaloneCopilotRoutes(page: Page, options?: {
  evidenceStatus?: 'available' | 'missing' | 'stale';
  evidenceFail?: boolean;
}) {
  const chatBodies: unknown[] = [];
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: {
    user: { id: 'demo-student', email: 'demo@example.test', name: 'Demo student', role: 'STUDENT' },
    expires: '2026-09-30T00:00:00.000Z',
  } }));
  await page.route('**/api/ai/sessions', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { conversations: [] } });
    }
    return route.fulfill({ status: 201, json: conversationFixture() });
  });
  await page.route('**/api/ai/sessions/**', (route) => route.fulfill({ json: conversationFixture() }));
  await page.route('**/api/ai/copilot-profile', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/api/ai/evidence-copilot**', (route) => {
    if (options?.evidenceFail) return route.fulfill({ status: 503, json: { error: 'unavailable' } });
    return route.fulfill({ json: evidenceProjection(options?.evidenceStatus ?? 'available') });
  });
  await page.route('**/api/ai/chat', async (route) => {
    chatBodies.push(await route.request().postDataJSON());
    await route.fulfill({
      headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
      body: chatStream('已按当前学习上下文回答。'),
    });
  });
  return { chatBodies };
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

function assertNoMaritime(text: string) {
  for (const canary of MARITIME_CANARIES) {
    expect(text).not.toContain(canary);
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(evidenceDir, { recursive: true });
});

test('neutral Copilot entry has no maritime default and does not request simulation state', async ({ page }) => {
  test.setTimeout(90_000);
  const { chatBodies } = await installStandaloneCopilotRoutes(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ai/copilot', { waitUntil: 'domcontentloaded' });

  const entry = page.locator('[data-copilot-entry-kind="neutral"]');
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('当前没有绑定具体课程步骤、仿真状态或个人证据');
  assertNoMaritime(await entry.innerText());
  await expect(page.getByRole('link', { name: '进入互动课' })).toBeVisible();

  await page.getByRole('button', { name: '解释概念' }).click();
  await expect.poll(() => chatBodies.length).toBe(1);
  const payload = chatBodies[0] as {
    pageContext?: { courseId?: string; topic?: string };
    auditTaskContext?: unknown;
    tools?: unknown;
    messages?: Array<{ content?: string }>;
  };
  expect(payload.pageContext?.courseId).toBe('ai-assistant');
  expect(payload.pageContext?.topic).toBe('通用学习辅助');
  expect(payload.auditTaskContext).toBeFalsy();
  expect(payload.tools).toBeUndefined();
  const asked = JSON.stringify(payload);
  expect(asked).not.toContain('仿真状态');
  expect(asked).not.toContain('get_simulation');

  const input = page.getByLabel('请输入您的问题，例如：帮我解释一个控制概念');
  await input.focus();
  await expect(input).toBeFocused();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceDir}/neutral-desktop-1440.png` });
});

test('unsupported context falls back to neutral and does not echo the URL text', async ({ page }) => {
  test.setTimeout(90_000);
  await installStandaloneCopilotRoutes(page);
  await page.goto('/ai/copilot?context=ship-pid-ccs', { waitUntil: 'domcontentloaded' });
  const entry = page.locator('[data-copilot-entry-kind="neutral"]');
  await expect(entry).toBeVisible();
  await expect(entry).not.toContainText('ship-pid-ccs');
  assertNoMaritime(await entry.innerText());
});

test('portfolio-reflection entry keeps draft questions and explicit save action', async ({ page }) => {
  test.setTimeout(90_000);
  const { chatBodies } = await installStandaloneCopilotRoutes(page);
  await page.goto('/ai/copilot?context=portfolio-reflection&source=learning-journal&intent=create', {
    waitUntil: 'domcontentloaded',
  });
  const entry = page.locator('[data-copilot-entry-kind="portfolio-reflection"]');
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('不会自动保存为正式学习记录');
  await expect(page.getByRole('link', { name: '打开作品集候选预览' }).first()).toBeVisible();
  await page.getByRole('button', { name: '整理目标' }).click();
  await expect.poll(() => chatBodies.length).toBe(1);
  const payload = chatBodies[0] as { auditTaskContext?: { taskType?: string } };
  expect(payload.auditTaskContext?.taskType).toBe('portfolio-reflection');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${evidenceDir}/reflection-desktop-1440.png` });
});

test('evidence available and missing states keep authorized actions', async ({ page }) => {
  test.setTimeout(120_000);
  const available = await installStandaloneCopilotRoutes(page, { evidenceStatus: 'available' });
  await page.goto('/ai/copilot?context=evidence', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-copilot-entry-kind="evidence-available"]')).toBeVisible();
  await expect(page.getByRole('link', { name: '查看学习记录并复核证据' }).first()).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${evidenceDir}/evidence-available-desktop-1440.png` });
  await page.getByRole('button', { name: '证据来源' }).click();
  await expect.poll(() => available.chatBodies.length).toBe(1);
  expect((available.chatBodies[0] as { auditTaskContext?: { taskType?: string } }).auditTaskContext?.taskType)
    .toBe('evidence-copilot');

  const missing = await installStandaloneCopilotRoutes(page, { evidenceStatus: 'missing' });
  await page.goto('/ai/copilot?context=evidence', { waitUntil: 'domcontentloaded' });
  const missingEntry = page.locator('[data-copilot-entry-kind="evidence-missing"]');
  await expect(missingEntry).toBeVisible();
  await expect(missingEntry).toContainText('当前没有可核验的学习证据');
  await expect(page.getByRole('link', { name: '去做一次自适应练习，补充学习证据' }).first()).toBeVisible();
  expect(missing.chatBodies).toHaveLength(0);

  await installStandaloneCopilotRoutes(page, { evidenceStatus: 'stale' });
  await page.goto('/ai/copilot?context=evidence', { waitUntil: 'domcontentloaded' });
  const limitedEntry = page.locator('[data-copilot-entry-kind="evidence-limited"]');
  await expect(limitedEntry).toBeVisible();
  await expect(limitedEntry).toContainText('学习证据已过期');
  await expect(limitedEntry).not.toContainText('薄弱点');
});

test('neutral and evidence-limited entries fit 320px without overflow', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 900 });
  await installStandaloneCopilotRoutes(page);
  await page.goto('/ai/copilot', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-copilot-entry-kind="neutral"]')).toBeVisible();
  const input = page.getByLabel('请输入您的问题，例如：帮我解释一个控制概念');
  await input.focus();
  await expect(input).toBeFocused();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceDir}/neutral-mobile-320.png` });

  await installStandaloneCopilotRoutes(page, { evidenceFail: true });
  await page.goto('/ai/copilot?context=evidence', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-copilot-entry-kind="evidence-unavailable"]')).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: `${evidenceDir}/evidence-unavailable-mobile-320.png` });
});
