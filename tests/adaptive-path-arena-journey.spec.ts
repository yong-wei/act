import { expect, test, type Page } from '@playwright/test';

const taskId = 'task-second-order-lead-pid';
const pathId = 'path-arena-e2e';
const nodeId = `arena-task:${taskId}`;
const nextNodeId = 'knowledge-card:arena-review';
const publicationContext = {
  publicationId: 'publication-path-e2e',
  classId: 'class-path-e2e',
  seasonId: 'season-path-e2e',
};
const returnHref = `/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=${pathId}&nodeId=${encodeURIComponent(nodeId)}`;
const nextReturnHref = `/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=${pathId}&nodeId=${encodeURIComponent(nextNodeId)}`;

function nextNodeHref() {
  return `/knowledge?${new URLSearchParams({
    ...publicationContext,
    source: 'adaptive-path-center',
    goal: 'control-correction',
    goalId: 'control-correction',
    pathId,
    nodeId: nextNodeId,
    intent: 'path-execution',
    returnHref: nextReturnHref,
    resourceType: 'knowledge_card',
  }).toString()}`;
}

function journey(state: 'pending-result' | 'ready' | 'next-surface') {
  if (state === 'next-surface') {
    return {
      path: { id: pathId, title: 'Arena 连续学习路径' },
      goal: { id: 'control-correction' },
      context: { pathId, goalId: 'control-correction', requestedNodeId: nextNodeId },
      current: { nodeId: nextNodeId, title: '复盘 Arena 评测证据', type: 'knowledge_card' },
      progress: { completed: 1, total: 2 },
      return: { label: '返回学习路径', href: nextReturnHref },
      pathStatus: 'active',
      nextAction: {
        state: 'pending-result' as const,
        nodeId: nextNodeId,
        title: '复盘 Arena 评测证据',
        type: 'knowledge_card',
        href: null,
        reason: '完成证据复盘后结束路径。',
        recovery: { label: '刷新结果状态', href: nextReturnHref },
      },
    };
  }
  return {
    path: { id: pathId, title: 'Arena 连续学习路径' },
    goal: { id: 'control-correction' },
    context: { pathId, goalId: 'control-correction', requestedNodeId: nodeId },
    current: { nodeId, title: '二阶系统校正挑战', type: 'arena_task' },
    progress: { completed: state === 'ready' ? 1 : 0, total: 2 },
    return: { label: '返回学习路径', href: returnHref },
    pathStatus: 'active',
    nextAction: state === 'ready'
      ? {
          state: 'ready',
          nodeId: nextNodeId,
          title: '复盘 Arena 评测证据',
          type: 'knowledge_card',
          href: nextNodeHref(),
          reason: null,
          recovery: null,
        }
      : {
          state: 'pending-result',
          nodeId,
          title: '二阶系统校正挑战',
          type: 'arena_task',
          href: null,
          reason: '完成工作台官方评测后继续。',
          recovery: { label: '刷新结果状态', href: returnHref },
        },
  };
}

const submission = {
  id: 'submission-arena-e2e',
  taskId,
  userId: 'student-e2e',
  studentLabel: '路径验收学生',
  artifactHash: 'artifact-arena-e2e',
  artifact: {
    id: 'artifact-arena-e2e',
    taskId,
    method: 'pid',
    params: { kp: 2.4, ki: 0.8, kd: 0.35 },
    createdAt: '2026-07-11T00:00:00.000Z',
  },
  evaluation: {
    taskId,
    artifact: {
      id: 'artifact-arena-e2e',
      taskId,
      method: 'pid',
      params: { kp: 2.4, ki: 0.8, kd: 0.35 },
      createdAt: '2026-07-11T00:00:00.000Z',
    },
    valid: true,
    score: 82,
    metrics: { settlingTime: 3.2, overshoot: 4.1, steadyStateError: 0.01, controlEnergy: 8 },
    satisfaction: {},
    hardConstraintResults: [],
    penalties: [],
    explanation: [],
  },
  submittedAt: '2026-07-11T00:01:00.000Z',
  reusedEvaluation: false,
};

async function installArenaFixture(page: Page) {
  let currentJourney = journey('pending-result');
  let startRequests = 0;
  let executeRequests = 0;
  await page.route('**/api/learning-paths/**/journey?**', async (route) => {
    const requestedNodeId = new URL(route.request().url()).searchParams.get('nodeId');
    await route.fulfill({
      json: { journey: requestedNodeId === nextNodeId ? journey('next-surface') : currentJourney },
    });
  });
  await page.route('**/api/arena/submissions?**', async (route) => {
    await route.fulfill({ json: { submissions: [], viewerUserId: 'student-e2e' } });
  });
  await page.route('**/api/arena/evaluate', async (route) => {
    await route.fulfill({ json: { submission } });
  });
  await page.route('**/api/learning-paths/**/execute', async (route) => {
    const body = route.request().postDataJSON();
    if (body.status === 'started') {
      startRequests += 1;
      expect(body).toMatchObject({ nodeId, resourceType: 'arena_task', status: 'started' });
      await route.fulfill({ json: { journey: currentJourney } });
      return;
    }
    executeRequests += 1;
    expect(body).toMatchObject({
      nodeId,
      resourceType: 'arena_task',
      status: 'completed',
      arenaRef: { id: submission.id },
    });
    currentJourney = journey('ready');
    await route.fulfill({ json: { journey: currentJourney } });
  });
  await page.route('**/api/interactive/events', async (route) => {
    await route.fulfill({ json: { accepted: true } });
  });
  return {
    startRequests: () => startRequests,
    executeRequests: () => executeRequests,
  };
}

test('Arena path node keeps context through challenge, workbench, submission, and next step', async ({ page }) => {
  const fixture = await installArenaFixture(page);
  await page.goto(
    `/assessment/adaptive-practice?demo=1&arenaJourneyFixture=1&goal=control-correction&intent=path-execution&pathId=${pathId}&nodeId=${encodeURIComponent(nodeId)}`,
    { waitUntil: 'domcontentloaded' },
  );

  const pathNode = page.locator(`[data-adaptive-path-node="${nodeId}"]`);
  await expect(pathNode).toHaveAttribute('data-adaptive-path-node-state', 'current');
  await expect(pathNode.locator('[data-adaptive-path-node-detail="inline"]')).toContainText('完成二阶系统校正 Arena 挑战');
  await pathNode.getByRole('button', { name: '开始学习' }).click();
  await expect(page).toHaveURL(new RegExp(`/arena/challenges/${taskId}`));
  expect(fixture.startRequests()).toBe(1);
  const challengeUrl = new URL(page.url());
  expect(Object.fromEntries(challengeUrl.searchParams)).toMatchObject({
    pathId,
    nodeId,
    returnHref,
  });
  for (const key of ['publicationId', 'classId', 'seasonId']) {
    expect(challengeUrl.searchParams.get(key)).toBe(publicationContext[key as keyof typeof publicationContext]);
    expect(challengeUrl.searchParams.getAll(key)).toHaveLength(2);
    expect(challengeUrl.searchParams.getAll(key)[1]).toContain('forged');
  }

  await expect(page.locator('[data-commercial-workspace="arena-challenge-detail"]')).toBeVisible();
  await expect(page.locator('[data-adaptive-path-journey-control="pending-result"]')).toContainText('完成工作台官方评测后继续');
  expect(fixture.executeRequests()).toBe(0);

  const workbenchLink = page.getByRole('link', { name: /进入控制工作台/ }).first();
  const workbenchHref = await workbenchLink.getAttribute('href');
  expect(workbenchHref).toBeTruthy();
  const propagated = new URL(workbenchHref!, 'http://act.local');
  expect(Object.fromEntries(propagated.searchParams)).toMatchObject({
    ...publicationContext,
    arenaTask: taskId,
    pathId,
    nodeId,
    returnHref,
    resourceType: 'arena_task',
  });
  for (const key of ['publicationId', 'classId', 'seasonId']) {
    expect(propagated.searchParams.getAll(key)).toEqual([publicationContext[key as keyof typeof publicationContext]]);
  }

  await workbenchLink.click();
  await expect(page).toHaveURL(/\/interactive-learning\/control-workbench/);
  const workbenchUrl = new URL(page.url());
  expect(Object.fromEntries(workbenchUrl.searchParams)).toMatchObject({
    ...publicationContext,
    pathId,
    nodeId,
    returnHref,
  });
  await expect(page.locator('[data-commercial-workspace="control-workbench"]')).toBeVisible();
  await expect(page.locator('[data-adaptive-path-journey-control="pending-result"]')).toBeVisible();

  await page.getByRole('button', { name: '提交官方评测' }).click();
  await expect(page.getByText(/官方评测完成/).first()).toBeVisible();
  await expect(page.locator('[data-adaptive-path-journey-control="ready"]')).toContainText('复盘 Arena 评测证据');
  expect(fixture.executeRequests()).toBe(1);
  const nextLink = page.getByRole('link', { name: '复盘 Arena 评测证据' });
  await expect(nextLink).toHaveAttribute('href', new RegExp(`/knowledge\\?`));
  await nextLink.click();
  await expect(page).toHaveURL(/\/knowledge\?/);
  const nextUrl = new URL(page.url());
  expect(Object.fromEntries(nextUrl.searchParams)).toMatchObject({
    ...publicationContext,
    pathId,
    nodeId: nextNodeId,
    returnHref: nextReturnHref,
    resourceType: 'knowledge_card',
  });
  await expect(page.locator('[data-adaptive-path-journey-control="pending-result"]')).toContainText('复盘 Arena 评测证据');
  await expect(page.getByRole('main')).toContainText('知识');
});
