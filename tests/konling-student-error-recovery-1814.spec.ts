import { expect, test, type Page } from '@playwright/test';

const evidenceDir = 'artifacts/commercial-ui/konling-student-error-recovery-1814';
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;

const CANARY = 'INTERNAL-STACK-CANARY-1814';

type ChatFailure = { status: number; body: unknown } | { network: true };

const providerUnavailable: Extract<ChatFailure, { status: number }> = {
  status: 503,
  body: {
    error: 'AI_SERVICE_UNAVAILABLE',
    message: '智能助手暂时无法连接外部模型，请稍后再试。',
    trace: `${CANARY} SiliconFlow`,
  },
};

function conversationFixture() {
  return {
    id: 'conversation-error-recovery-1814',
    userId: 'demo-student',
    courseId: 'ai-copilot',
    pageId: 'copilot',
    title: '错误恢复',
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

async function installCommonRoutes(page: Page, chatFailure: ChatFailure) {
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
  await page.route('**/api/ai/chat', (route) => {
    if ('network' in chatFailure) return route.abort('failed');
    return route.fulfill({
      status: chatFailure.status,
      contentType: 'application/json',
      body: JSON.stringify(chatFailure.body),
    });
  });
}

const batchId = 'path-candidate-batch_issue1814_error';
const pathId = 'candidate-source-path-1814';
const candidateId = 'path-candidate_error_recovery';

const candidateBatch = {
  id: batchId, userId: 'demo-student', goalId: 'control-correction', classId: 'class-1814',
  generationRequestId: 'generation-request-1814', sourcePathId: pathId,
  plannerVersion: 'error-recovery', status: 'succeeded', createdAt: '2026-09-02T00:00:00.000Z',
  candidates: [{
    id: candidateId, ordinal: 0, styleId: 'sprint', policyFamily: 'simulation', label: 'Error recovery sprint',
    snapshot: {
      optionId: 'sprint', styleId: 'sprint', label: 'Error recovery sprint', nodeIds: ['node-1814'], activeNodeIds: ['node-1814'],
      nodeSummaries: [{ nodeId: 'node-1814', title: 'Phase margin', pathNodeType: 'knowledge_card', estimatedTimeMinutes: 20, status: 'ready' }],
      lockedNodeIds: [], readinessSummary: [{ nodeId: 'node-1814', state: 'ready', message: 'Ready' }],
      targetDeficits: [], evidenceBasis: ['error recovery fixture'], resourceMix: { knowledge_card: 1 },
      effort: { estimatedMinutes: 20, relative: 'medium' }, terminalValidationNodeIds: [],
      terminalValidationStrategy: { summary: 'Complete the route' }, expectedTargetLift: 0.2, limitations: [],
    },
  }],
};

async function installAdaptiveHostRoutes(page: Page, chatFailure: ChatFailure) {
  await installCommonRoutes(page, chatFailure);
  await page.route('**/api/adaptive/path-advisor-context**', (route) => route.fulfill({ json: {
    goalId: 'control-correction', classId: 'class-1814', courseTitle: 'Control correction', topic: 'Phase margin',
    learningObjectives: ['选择一条受治理路径'],
    modeContextToken: 'error-recovery-mode-token',
    readiness: { status: 'ready', reason: 'ready', source: 'path-advisor', studentAction: 'select', studentMessage: 'Ready' },
  } }));
  await page.route('**/api/adaptive/learner-state**', (route) => route.fulfill({ json: {
    userId: 'demo-student', payloadVersion: 'adaptive-learner-state.v1', generatedAt: '2026-09-02T00:00:00.000Z',
    authority: 'server-owned',
    roleScope: { role: 'student', classId: 'class-1814', privacyScopes: ['student-visible'] },
    clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
    primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
    secondaryDimensions: {},
    knowledgeMastery: { coverage: 'missing', tags: {} },
    pathContext: {
      activePathCount: 0, bookmarkedPathCount: 0, recentPathIds: [],
      activeControlCorrectionPath: {
        state: 'none', pathId: null, status: null, currentNodeId: null,
        terminalValidationState: null, lowConfidenceMarkers: [],
      },
      statusMarkers: ['available'],
    },
    assessmentState: { latestAbilityEstimate: null },
    evidence: {
      readState: 'ready',
      evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
      sourceCounts: {}, sourceCoverage: {},
      confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
      statusMarkers: [],
    },
    missingEvidence: [],
  } }));
  await page.route('**/api/learning-paths/latest?**', (route) => route.fulfill({ json: { path: null } }));
  await page.route('**/api/learning-paths/candidate-batches/latest?**', (route) => route.fulfill({ json: { batch: candidateBatch } }));
  await page.route(`**/api/learning-paths/candidate-batches/${batchId}**`, (route) => route.fulfill({ json: { batch: candidateBatch } }));
}

const adaptiveHostUrl = `/assessment/adaptive-practice?demo=1&qa=knowledge-product&goal=control-correction&intent=path-selection&batch=${batchId}&candidate=${candidateId}`;

async function openGlobalSidebar(page: import('@playwright/test').Page) {
  const openKonling = page.getByRole('button', { name: '打开控灵', exact: true });
  await expect(openKonling).toBeEnabled({ timeout: 30_000 });
  await openKonling.click();
  const sidebar = page.locator('[data-konling-assistant-surface="global-sidebar"]');
  await expect(sidebar).toBeVisible();
  return sidebar;
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

async function assertNoCanary(page: Page, alertText: string) {
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(CANARY);
  expect(bodyText).not.toContain('AI_SERVICE_UNAVAILABLE');
  expect(bodyText).not.toContain('SiliconFlow');
  expect(bodyText).not.toContain('Failed to fetch');
  expect(bodyText).not.toContain('Conversation not found');
  expect(bodyText).not.toContain('出错了');
  expect(alertText).toContain('智能');
}

for (const viewport of viewports) {
  test(`standalone copilot renders student-safe 503 recovery at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installCommonRoutes(page, providerUnavailable);
    await page.goto('/ai/copilot', { waitUntil: 'domcontentloaded' });

    const input = page.getByLabel('请输入您的问题，例如：帮我解释一个控制概念');
    await input.fill('这道题怎么做？');
    await input.press('Enter');

    const alert = page.locator('[role="alert"]').filter({ hasText: '智能助手暂时无法完成请求' });
    await expect(alert).toBeVisible();
    const alertText = await alert.innerText();
    await assertNoCanary(page, alertText);

    const retry = alert.getByRole('button', { name: '稍后重试' });
    await expect(retry).toBeVisible();
    await retry.focus();
    await expect(retry).toBeFocused();
    await expect(input).toHaveValue('这道题怎么做？');

    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: `${evidenceDir}/copilot-503-${viewport.name}.png` });
  });

  test(`global sidebar renders student-safe 503 recovery at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      window.localStorage.setItem('act:knowledge-product-qa', 'true');
      (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
    });
    await installAdaptiveHostRoutes(page, providerUnavailable);
    await page.goto(adaptiveHostUrl, { waitUntil: 'domcontentloaded' });

    const sidebar = await openGlobalSidebar(page);

    const input = sidebar.getByLabel('全局 AI 问题输入框');
    await input.fill('帮我看看这次练习');
    await sidebar.getByRole('button', { name: '发送 AI 问题', exact: true }).click();

    const alert = sidebar.locator('[role="alert"]').filter({ hasText: '智能助手暂时无法完成请求' });
    await expect(alert).toBeVisible();
    const alertText = await alert.innerText();
    await assertNoCanary(page, alertText);

    const retry = alert.getByRole('button', { name: '稍后重试' });
    await expect(retry).toBeVisible();
    await retry.focus();
    await expect(retry).toBeFocused();
    await expect(input).toHaveValue('帮我看看这次练习');

    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: `${evidenceDir}/global-sidebar-503-${viewport.name}.png` });
  });
}

const copilotRecoveryCases = [
  {
    name: 'auth-expiry-to-login',
    failure: { status: 401, body: { error: '未授权' } } as ChatFailure,
    copy: '登录状态已失效',
    buttons: ['重新登录'],
    forbidden: ['未授权'],
  },
  {
    name: 'missing-conversation-to-session-repair',
    failure: { status: 404, body: { error: 'Conversation not found' } } as ChatFailure,
    copy: '当前会话已不存在',
    buttons: ['刷新会话', '开启新对话'],
    forbidden: ['Conversation not found'],
  },
  {
    name: 'turn-conflict-to-state-refresh',
    failure: { status: 409, body: { error: 'KonlingConversationTurnConflictError' } } as ChatFailure,
    copy: '当前会话状态已变化',
    buttons: ['刷新任务状态'],
    forbidden: [],
  },
  {
    name: 'network-failure-to-retry-later',
    failure: { network: true } as ChatFailure,
    copy: '网络连接不可用',
    buttons: ['稍后重试'],
    forbidden: ['Failed to fetch'],
  },
] as const;

for (const testCase of copilotRecoveryCases) {
  test(`standalone copilot maps ${testCase.name} to matched recovery`, async ({ page }) => {
    test.setTimeout(90_000);
    await installCommonRoutes(page, testCase.failure);
    await page.goto('/ai/copilot', { waitUntil: 'domcontentloaded' });

    const input = page.getByLabel('请输入您的问题，例如：帮我解释一个控制概念');
    await input.fill('这个问题需要恢复路径');
    await input.press('Enter');

    const alert = page.locator('[role="alert"]').filter({ hasText: testCase.copy });
    await expect(alert).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    for (const forbidden of testCase.forbidden) {
      expect(bodyText).not.toContain(forbidden);
    }
    for (const label of testCase.buttons) {
      await expect(alert.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(input).toHaveValue('这个问题需要恢复路径');
  });
}

test('global sidebar maps auth expiry and session loss to matched recovery', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.localStorage.setItem('act:knowledge-product-qa', 'true');
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
  });

  await installAdaptiveHostRoutes(page, { status: 401, body: { error: '未授权' } });
  await page.goto(adaptiveHostUrl, { waitUntil: 'domcontentloaded' });
  const sidebar = await openGlobalSidebar(page);
  const input = sidebar.getByLabel('全局 AI 问题输入框');
  await input.fill('第一个问题');
  await sidebar.getByRole('button', { name: '发送 AI 问题', exact: true }).click();
  const authAlert = sidebar.locator('[role="alert"]').filter({ hasText: '登录状态已失效' });
  await expect(authAlert).toBeVisible();
  await expect(authAlert.getByRole('button', { name: '重新登录' })).toBeVisible();
});

test('global sidebar shows network-unavailable copy and keeps the pending input', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.localStorage.setItem('act:knowledge-product-qa', 'true');
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
  });

  await installAdaptiveHostRoutes(page, { network: true });
  await page.goto(adaptiveHostUrl, { waitUntil: 'domcontentloaded' });
  const sidebar = await openGlobalSidebar(page);
  const input = sidebar.getByLabel('全局 AI 问题输入框');
  await input.fill('断网时的问题');
  await sidebar.getByRole('button', { name: '发送 AI 问题', exact: true }).click();
  const alert = sidebar.locator('[role="alert"]').filter({ hasText: '网络连接不可用' });
  await expect(alert).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('Failed to fetch');
  await expect(input).toHaveValue('断网时的问题');
});
