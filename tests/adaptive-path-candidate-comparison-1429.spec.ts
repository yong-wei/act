import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const goalId = 'control-correction';
const pathId = 'candidate-comparison-path-1429';
const batchId = 'candidate-comparison-batch-1429';
const pathUpdatedAt = '2026-08-16T10:00:00.000Z';

function candidateOption(optionId: string, styleId: string, label: string, minutes: number) {
  const nodeId = `${optionId}-node`;
  return {
    optionId,
    styleId,
    label,
    nodeIds: [nodeId],
    activeNodeIds: [nodeId],
    nodeSummaries: [{
      nodeId,
      title: `${label}学习节点`,
      pathNodeType: 'checkpoint',
      estimatedTimeMinutes: minutes,
      status: 'ready',
    }],
    lockedNodeIds: [],
    readinessSummary: [{ nodeId, state: 'ready', message: '可开始' }],
    targetDeficits: [],
    evidenceBasis: ['candidate comparison evidence'],
    resourceMix: { knowledge_card: 1 },
    effort: { estimatedMinutes: minutes, relative: 'medium' },
    terminalValidationNodeIds: [`${optionId}-terminal`],
    terminalValidationStrategy: { summary: '完成终点验证' },
    limitations: [],
  };
}

const options = [
  candidateOption('option-a', 'style-a', '方案 A', 30),
  candidateOption('option-b', 'style-b', '方案 B', 30),
  candidateOption('option-c', 'style-c', '方案 C', 45),
];

const candidateBatch = {
  id: batchId,
  userId: 'demo-student',
  goalId,
  classId: 'demo-class',
  generationRequestId: 'candidate-comparison-generation-1429',
  sourcePathId: pathId,
  plannerVersion: 'candidate-comparison-1429',
  status: 'succeeded',
  createdAt: '2026-08-16T10:00:01.000Z',
  candidates: options.map((snapshot, ordinal) => ({
    id: `candidate-${ordinal + 1}`,
    ordinal,
    styleId: snapshot.styleId,
    policyFamily: snapshot.styleId,
    label: snapshot.label,
    snapshot,
  })),
};

const activePath = {
  path: {
    id: pathId,
    userId: 'demo-student',
    title: '候选比较路径',
    goalId,
    plannerVersion: 'candidate-comparison-1429',
    pathStatus: 'active',
    currentNodeId: options[0]!.nodeIds[0],
    pathPayload: {
      status: 'ready',
      planNodes: [],
      mainPathNodeIds: options[0]!.nodeIds,
      pathOptions: options,
      feedbackEvents: [],
      selectionHistory: [],
      activity: [],
      visualization: {},
      score: { total: 0.8, objectives: {} },
      confidence: { level: 'medium', score: 0.8, sourceCoverage: 0.8 },
    },
    explanationPayload: {},
    alternativePayload: [],
    terminalValidation: {},
    lastExecutionMetadata: { adopted: true, completedNodeIds: [] },
    createdAt: pathUpdatedAt,
    updatedAt: pathUpdatedAt,
    executions: [],
    deviations: [],
    interventions: [],
  },
};

const learnerState = {
  userId: 'demo-student',
  payloadVersion: 'adaptive-learner-state.v1',
  generatedAt: pathUpdatedAt,
  authority: 'server-owned',
  roleScope: { role: 'student', classId: 'demo-class', privacyScopes: ['student-visible'] },
  clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
  primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
  secondaryDimensions: {},
  knowledgeMastery: { coverage: 'missing', tags: {} },
  pathContext: {
    activePathCount: 1,
    bookmarkedPathCount: 0,
    recentPathIds: [pathId],
    activeControlCorrectionPath: {
      state: 'active',
      pathId,
      status: 'active',
      currentNodeId: options[0]!.nodeIds[0],
      terminalValidationState: null,
      lowConfidenceMarkers: [],
    },
    statusMarkers: ['available'],
  },
  assessmentState: { latestAbilityEstimate: null },
  evidence: {
    readState: 'ready',
    evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
    sourceCounts: {},
    sourceCoverage: {},
    confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
    statusMarkers: [],
  },
  missingEvidence: [],
};

function comparisonResult(requestBody: Record<string, unknown>) {
  const left = options.find((option) => option.optionId === requestBody.selectedOptionId)!;
  const right = options.find((option) => option.optionId === requestBody.compareWithOptionId)!;
  return {
    operation: 'explain',
    agentSessionId: 'candidate-comparison-agent-session',
    result: {
      studentSafeRationale: ['已生成候选差异说明。'],
      comparison: {
        status: 'ready',
        pathId,
        comparisonKey: requestBody.comparisonKey,
        options: [left, right].map((option) => ({
          optionId: option.optionId,
          styleId: option.styleId,
          label: option.label,
          metrics: {
            estimatedMinutes: option.effort.estimatedMinutes,
            nodeCount: option.nodeIds.length,
            resourceMix: option.resourceMix,
            readiness: { ready: 1 },
            readinessSummary: option.readinessSummary,
            checkpointCount: 1,
            checkpointNodeIds: option.nodeIds,
            lockedNodeCount: 0,
            lockedNodeIds: [],
            terminalValidationCount: option.terminalValidationNodeIds.length,
            terminalValidationNodeIds: option.terminalValidationNodeIds,
          },
        })),
        commonNodes: [],
        optionOnlyNodes: [left, right].map((option) => ({ optionId: option.optionId, nodes: [] })),
        orderDifferences: [],
        tradeoffs: [`${left.label} 与 ${right.label} 的事实差异`],
        limitations: [],
      },
    },
  };
}

async function installRoutes(page: Page, releaseFirstExplain: Promise<void>) {
  let explainCount = 0;
  await page.route('**/api/adaptive/path-advisor-context**', (route) => route.fulfill({
    json: {
      goalId,
      classId: 'demo-class',
      courseTitle: '自动控制原理',
      topic: '候选路径比较',
      learningObjectives: ['比较候选路径'],
      modeContextToken: 'candidate-comparison-mode-token',
      readiness: { status: 'ready', reason: 'ready', source: 'path-advisor', studentAction: 'generate' },
    },
  }));
  await page.route('**/api/adaptive/learner-state**', (route) => route.fulfill({ json: learnerState }));
  await page.route('**/api/learning-paths/latest?**', (route) => route.fulfill({ json: activePath }));
  await page.route(`**/api/learning-paths/${pathId}`, (route) => route.fulfill({ json: activePath }));
  await page.route('**/api/learning-paths/candidate-batches/latest?**', (route) => route.fulfill({ json: { batch: candidateBatch } }));
  await page.route(`**/api/learning-paths/candidate-batches/${batchId}**`, (route) => route.fulfill({ json: { batch: candidateBatch } }));
  await page.route('**/api/adaptive/path-advisor-tool', async (route: Route) => {
    const requestBody = route.request().postDataJSON() as Record<string, unknown>;
    if (requestBody.operation !== 'explain') {
      await route.fulfill({ status: 400, json: { error: 'Unexpected operation' } });
      return;
    }
    explainCount += 1;
    if (explainCount === 1) await releaseFirstExplain;
    await route.fulfill({ json: comparisonResult(requestBody) });
  });
}

async function login(context: BrowserContext) {
  const csrfResponse = await context.request.get('/api/auth/csrf');
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const response = await context.request.post('/api/auth/callback/credentials?json=true', {
    form: {
      csrfToken: csrf.csrfToken!,
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: '/',
      json: 'true',
    },
  });
  expect(response.ok() || (response.status() >= 300 && response.status() < 400), await response.text()).toBe(true);
}

async function choosePair(page: Page, left: string, right: string, keyboard = false) {
  await page.getByLabel('方案一').selectOption(left);
  await page.getByLabel('方案二').selectOption(right);
  const confirm = page.getByRole('button', { name: '比较这两条路径' });
  await expect(confirm).toBeEnabled();
  if (keyboard) {
    await confirm.focus();
    await expect(confirm).toBeFocused();
    await confirm.press('Enter');
  } else {
    await confirm.click();
  }
}

async function captureCandidateComparisonEvidence(page: Page, viewportName: 'desktop' | 'mobile-320') {
  if (process.env.ISSUE_1429_WRITE_EVIDENCE !== '1') return;
  const outputDir = path.join(
    process.cwd(),
    'artifacts/commercial-ui/issue-1429-candidate-comparison',
  );
  await mkdir(outputDir, { recursive: true });
  const fileName = viewportName === 'desktop'
    ? 'candidate-comparison-1440.png'
    : 'candidate-comparison-320.png';
  await page.screenshot({
    path: path.join(outputDir, fileName),
    fullPage: true,
    animations: 'disabled',
  });
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} verifies authenticated explicit candidate comparison`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(context);
    let releaseFirst!: () => void;
    const firstExplainGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    await installRoutes(page, firstExplainGate);
    await page.goto(`/assessment/adaptive-practice?goal=${goalId}&intent=path-selection&batch=${batchId}`, {
      waitUntil: 'domcontentloaded',
    });

    const workspace = page.locator('[data-learning-path-candidate-comparison]');
    await expect(workspace).toBeVisible();
    await expect(workspace.getByRole('heading', { name: '方案 A', exact: true })).toBeVisible();
    await expect(workspace.getByRole('heading', { name: '方案 B', exact: true })).toBeVisible();
    await expect(workspace.getByRole('heading', { name: '方案 C', exact: true })).toBeVisible();
    await expect(workspace.getByText('终点验证：', { exact: true }).first()).toBeVisible();
    await expect(workspace.getByText('候选在当前维度无差异', { exact: false }).first()).toBeVisible();

    await choosePair(page, 'option-a', 'option-b', true);
    await page.getByLabel('方案二').selectOption('option-c');
    releaseFirst();
    await expect(page.getByText('正在比较：方案 A ↔ 方案 B')).toHaveCount(0);

    await expect(page.getByRole('button', { name: '比较这两条路径' })).toBeEnabled();
    await page.getByRole('button', { name: '比较这两条路径' }).click();
    await expect(page.getByText('正在比较：方案 A ↔ 方案 C')).toBeVisible();

    await choosePair(page, 'option-b', 'option-c');
    await expect(page.getByText('正在比较：方案 B ↔ 方案 C')).toBeVisible();

    await choosePair(page, 'option-b', 'option-a');
    await expect(page.getByText('正在比较：方案 A ↔ 方案 B')).toBeVisible();
    await expect(page).toHaveURL(/compareLeft=option-a/);
    await expect(page).toHaveURL(/compareRight=option-b/);
    await expect(page).toHaveURL(/compareVersion=/);

    const confirm = page.getByRole('button', { name: '比较这两条路径' });
    await confirm.focus();
    await expect(confirm).toBeFocused();

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    await captureCandidateComparisonEvidence(page, viewport.name);
  });
}
