import { expect, test } from '@playwright/test';

const studentEntryLabels = [
  '虚拟仿真',
  '知识资源',
  '竞技场',
  '控制工作台',
  '自适应学习',
  '互动学习',
] as const;

test('homepage exposes the shared student entry drawer at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');

  await page.getByRole('button', { name: '打开平台入口菜单' }).click();
  const mobileNav = page.getByRole('navigation', { name: '移动平台入口菜单' });
  await expect(mobileNav).toBeVisible();

  for (const label of studentEntryLabels) {
    await expect(mobileNav.getByRole('link', { name: label })).toBeVisible();
  }

  await mobileNav.getByRole('link', { name: '自适应学习' }).click();
  await expect(page).toHaveURL(/\/assessment\/adaptive-practice/);
  const center = page.locator('[data-control-correction-center="adaptive-practice"]');
  await expect(center).toBeVisible();
  await expect(center).toHaveAttribute('data-control-correction-goal', 'control-correction');
});

test('login page keeps the shared credential form on desktop and 320px callback routes', async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/login?callbackUrl=%2Fprofile');

    await expect(page.locator('[data-commercial-student-entry-route="/login"]')).toBeVisible();
    await expect(page.locator('[data-auth-callback-target="/profile"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
    await expect(page.getByPlaceholder('学号/工号')).toBeVisible();
    await expect(page.getByPlaceholder('密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  }
});

test('profile unauthenticated state links back to login with profile callback at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/profile');

  await expect(page.getByText('请先登录')).toBeVisible();
  await expect(page.getByRole('link', { name: '前往登录' })).toHaveAttribute(
    'href',
    '/login?callbackUrl=%2Fprofile',
  );
});

test('adaptive practice preserves control-correction goal and intent context', async ({ page }) => {
  await page.goto('/assessment/adaptive-practice?goal=control-correction&intent=practice');

  const center = page.locator('[data-control-correction-center="adaptive-practice"]');
  await expect(center).toBeVisible();
  await expect(center).toHaveAttribute('data-control-correction-goal', 'control-correction');
  await expect(center).toHaveAttribute('data-control-correction-intent', 'practice');
  await expect(center.locator('[data-control-correction-state="low-evidence"]')).toBeVisible();
  await expect(center.locator('[data-control-correction-state="no-path"]')).toBeVisible();
});

test('adaptive practice renders ready control-correction path context when APIs return path data', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'student-1', role: 'STUDENT' },
        expires: '2099-01-01T00:00:00.000Z',
      }),
    });
  });
  await page.route('**/api/adaptive/learner-state?goal=control-correction', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'student-1',
        payloadVersion: 'adaptive-learner-state.v1',
        generatedAt: '2026-05-28T06:00:00.000Z',
        authority: 'server-owned',
        roleScope: { role: 'student', classId: 'class-1', privacyScopes: ['student-visible'] },
        featureFlag: { name: 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED', enabled: true, fallback: 'none' },
        clientHints: { received: false, authoritative: false, reason: 'server-owned' },
        primaryCompetencies: { source: 'latest-snapshot', vector: {} },
        secondaryDimensions: {},
        knowledgeMastery: { coverage: 'complete', tags: {} },
        resourcePreference: { preferredModalities: ['simulation'], sourceCounts: {}, confidence: 'medium' },
        mediaAbsorption: { mediaFactCount: 0, averageCompletion: 0, confidence: 'unknown' },
        pathContext: {
          activePathCount: 1,
          bookmarkedPathCount: 0,
          recentPathIds: ['path-1'],
          activeControlCorrectionPath: {
            state: 'active',
            pathId: 'path-1',
            status: 'active',
            currentNodeId: 'node-1',
            terminalValidationState: null,
            lowConfidenceMarkers: [],
          },
          statusMarkers: ['available'],
        },
        risks: { riskLevel: 'low', activeFlags: [] },
        assessmentState: {
          latestAbilityEstimate: {
            theta: 0.5,
            confidenceInterval: [0.3, 0.7],
            algorithmVersion: 'test',
            estimatedAt: '2026-05-28T06:00:00.000Z',
          },
        },
        evidence: {
          readState: 'ready',
          evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 7 },
          sourceCounts: { LearningFact: 5 },
          sourceCoverage: { primaryCompetencies: 'available', knowledgeMastery: 'available' },
          confidence: { level: 'medium', score: 0.72, evidenceCount: 5, sourceCompleteness: 1 },
          statusMarkers: [],
        },
        prerequisiteFeatureGroups: { simulationArena: { available: true }, pathExecution: null },
        fieldContracts: {},
        missingEvidence: [],
      }),
    });
  });
  await page.route('**/api/learning-paths/path-1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        path: {
          id: 'path-1',
          userId: 'student-1',
          title: '控制校正路径',
          goalId: 'control-correction',
          plannerVersion: 'stage-1-rules-graph',
          pathStatus: 'active',
          currentNodeId: 'node-1',
          pathPayload: {
            policyFamily: 'rules-plus-graph-search',
            confidence: { level: 'medium', score: 0.72, sourceCoverage: 0.8 },
            score: { total: 0.8, objectives: {} },
            planNodes: [{
              nodeId: 'node-1',
              title: '控制校正知识卡',
              type: 'knowledge_card',
              sourceKind: 'resource_node',
              sourceRef: 'control-correction-card',
              target: 'course-content/runtime/knowledge/cards/nodes/时域指标到目标极点区域_3_36001.md',
              estimatedTimeMinutes: 10,
              prerequisiteNodeIds: [],
              knowledgeCoverage: ['control-correction:time-domain-targets'],
              teacherPolicy: 'allowed',
              privacyLevel: 'student-visible',
              terminalConstraints: [],
              score: 0.8,
              reasonCodes: ['low-mastery-target'],
              status: 'current',
            }],
            alternatives: [],
            explanations: { selectedReasons: ['low-mastery-target'], rejectedAlternatives: [], fallbackReasons: [] },
            executionStatus: { adopted: true, completedNodeIds: [], activeNodeId: 'node-1', updatedAt: '2026-05-28T06:00:00.000Z' },
            deviations: [],
            corrections: [],
            feedbackEvents: [],
            visualization: {
              map: { mainPathNodeIds: ['node-1'], branchPaths: [], currentNodeId: 'node-1', completedNodeIds: [], riskNodeIds: [], blockedNodes: [], alternatives: [] },
              timeline: { generatedAt: '2026-05-28T06:00:00.000Z', windows: [{ days: 7, nodeIds: ['node-1'], estimatedMinutes: 10 }] },
              evidence: { evidenceBasis: 'adaptive-learner-state', confidence: { level: 'medium', score: 0.72, sourceCoverage: 0.8 }, sourceCoverage: { learnerState: 'available' }, learnerStateDeficits: [], prerequisiteReasons: [], teacherPolicy: [], alternatives: [] },
            },
          },
          explanationPayload: { selectedReasons: ['low-mastery-target'], rejectedAlternatives: [], fallbackReasons: [] },
          alternativePayload: [],
        },
      }),
    });
  });
  await page.route('**/api/assessment/diagnostic', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        knowledgeDimensions: { computational: 80, crossDomain: 70, design: 60 },
        weakAreas: ['phase-margin'],
        recommendedFocus: ['控制校正知识卡'],
      }),
    });
  });
  await page.route('**/api/assessment/next-question', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        estimatedAbility: 0.6,
        confidenceInterval: [0.4, 0.8],
        question: {
          id: 'q1',
          stem: '控制校正路径测试题',
          domains: ['frequency'],
          type: 'test',
          difficulty: 0.5,
          knowledgeTags: ['phase-margin'],
          options: [
            { label: 'A', text: '正确', explanation: 'ok' },
            { label: 'B', text: '错误', explanation: 'no' },
          ],
        },
      }),
    });
  });

  await page.goto('/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=node-1');

  const center = page.locator('[data-control-correction-center="adaptive-practice"]');
  await expect(center).toHaveAttribute('data-control-correction-ready', 'true');
  await expect(center.getByRole('link', { name: '控制校正知识卡' })).toHaveAttribute(
    'href',
    '/course-runtime/knowledge/cards/nodes/时域指标到目标极点区域_3_36001.md?pathId=path-1&nodeId=node-1&goal=control-correction&intent=path-execution',
  );
});

test('simulations hub remains reachable without opening 3D runtimes', async ({ page }) => {
  await page.goto('/simulations', { waitUntil: 'networkidle' });

  await expect(page.locator('[data-simulation-entry-map="scenario-fleet"]')).toBeVisible();
  await expect(page.locator('[data-simulation-scenario-card]')).toHaveCount(7);
  await expect(page.locator('[data-simulation-scenario-fit]')).toHaveCount(7);
  await expect(page.locator('[data-simulation-task-status]')).toHaveCount(7);
  await expect(page.getByRole('heading', { name: '虚拟仿真实验室' })).toBeVisible();
  await expect(page.getByText('7 个仿真场景')).toBeVisible();
  await expect(page.getByRole('heading', { name: '052D驱逐舰' })).toBeVisible();
});
