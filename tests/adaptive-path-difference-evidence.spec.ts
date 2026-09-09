import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

import { verifiedAuthForm } from './verified-test-credentials';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3003';
const pathId = 'path-difference-evidence-1160';
const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1160-adaptive-path-difference');
const manifestPath = path.join(evidenceDir, 'manifest.json');
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/app/assessment/adaptive-practice/layout.tsx',
  'src/app/api/adaptive/path-advisor-tool/route.ts',
  'src/features/personalization/experience/path-advisor-entrypoint-bridge.tsx',
  'src/lib/konling-agent-runtime.ts',
  'tests/adaptive-path-difference-evidence.spec.ts',
];
const expectedScreenshotFiles = [
  'desktop-1440-ready.png',
  'mobile-320-ready.png',
].map((filename) => path.posix.join('artifacts/commercial-ui/issue-1160-adaptive-path-difference', filename));
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const screenshots: Array<Record<string, unknown>> = [];
const assertions: Array<Record<string, unknown>> = [];

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtCommit(commitSha: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${commitSha}:${file}`]));
}

function hasWorkingTreeSourceDrift(): boolean {
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...sourceFiles]);
    return false;
  } catch {
    return true;
  }
}

async function login(context: BrowserContext) {
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const response = await context.request.post(`${baseURL}/api/auth/callback/credentials?json=true`, {
    form: {
      csrfToken: csrf.csrfToken!,
      ...verifiedAuthForm('student'),
      callbackUrl: baseURL,
      json: 'true',
    },
  });
  expect(response.ok() || (response.status() >= 300 && response.status() < 400), await response.text()).toBe(true);
}

const learnerStateFixture = JSON.stringify({
  userId: 'demo-student',
  payloadVersion: 'adaptive-learner-state.v1',
  generatedAt: '2026-07-31T00:00:00.000Z',
  authority: 'server-owned',
  roleScope: { role: 'student', classId: null, privacyScopes: ['student-visible'] },
  featureFlag: {
    name: 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED',
    enabled: true,
    fallback: 'legacy-profile-summary-and-recommendation-consumers',
  },
  clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
  primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
  secondaryDimensions: {},
  knowledgeMastery: { coverage: 'missing', tags: {} },
  pathContext: {
    activePathCount: 0,
    bookmarkedPathCount: 0,
    recentPathIds: [],
    activeControlCorrectionPath: {
      state: 'none',
      pathId: null,
      status: null,
      currentNodeId: null,
      terminalValidationState: null,
      lowConfidenceMarkers: [],
    },
    statusMarkers: ['missing'],
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
});

const pathAdvisorContextFixture = JSON.stringify({
  goalId: 'control-correction',
  classId: 'fixture-class-1160',
  modeContextToken: 'fixture-mode-context-token-1160',
  readiness: {
    status: 'ready',
    reason: 'ready',
    studentAction: 'continue-practice',
    staffAction: 'none',
    studentMessage: '路径生成条件已就绪。',
    staffMessage: '路径顾问上下文已由受控夹具提供。',
    evidence: {
      source: 'path-advisor',
      diagnosticCode: 'ready',
      safeLabel: 'fixture-ready',
    },
  },
  courseTitle: '控制校正',
  topic: '控制校正学习路径',
  learningObjectives: ['比较候选路径的学习取舍'],
});

function option(optionId: string, label: string, nodeIds: string[]) {
  return {
    optionId,
    styleId: optionId,
    label,
    nodeIds,
    nodeSummaries: nodeIds.map((nodeId, index) => ({
      nodeId,
      title: `${label}节点${index + 1}`,
      pathNodeType: 'knowledge_card',
      estimatedTimeMinutes: 20,
      status: index === 0 ? 'current' : 'pending',
    })),
    lockedNodeIds: [],
    readinessSummary: nodeIds.map((nodeId) => ({ nodeId, state: 'ready', message: '可以开始学习' })),
    targetDeficits: [],
    evidenceBasis: ['adaptive-learner-state'],
    resourceMix: { knowledge_card: nodeIds.length },
    effort: { estimatedMinutes: nodeIds.length * 20, relative: 'moderate' },
    terminalValidationNodeIds: [],
    terminalValidationStrategy: { summary: '完成后复核目标掌握情况' },
    limitations: [],
  };
}

function pathRound(revised = false) {
  const first = revised
    ? option('foundation-revised', '基础巩固路径', ['node-a', 'node-revised'])
    : option('foundation', '基础补救路径', ['node-a', 'node-b']);
  const second = revised
    ? option('simulation-revised', '仿真验证路径', ['node-a', 'node-c'])
    : option('simulation', '仿真验证路径', ['node-a', 'node-c']);
  return {
    path: {
      id: pathId,
      userId: 'demo-student',
      title: '控制校正学习路径',
      goalId: 'control-correction',
      pathStatus: 'active',
      currentNodeId: null,
      pathPayload: {
        policyFamily: 'rules-plus-graph-search',
        policyBundle: { status: 'ready', paths: [first, second] },
        planNodes: [],
        explanations: { selectedReasons: [], rejectedAlternatives: [], fallbackReasons: [] },
        executionStatus: { adopted: false, completedNodeIds: [], activeNodeId: null, updatedAt: '2026-07-31T00:00:00.000Z' },
        deviations: [],
        corrections: [],
        feedbackEvents: [],
        confidence: { level: 'medium', score: 0.8, sourceCoverage: 0.8 },
        score: { total: 0.8, objectives: {} },
      },
      explanationPayload: { selectedReasons: [], rejectedAlternatives: [], fallbackReasons: [] },
      alternativePayload: [],
    },
  };
}

function comparison(status: 'ready' | 'no-material-difference' | 'insufficient-data') {
  return {
    status,
    pathId,
    options: [
      {
        optionId: 'path-option-1',
        styleId: 'foundation',
        label: '基础补救路径',
        metrics: {
          estimatedMinutes: 40,
          nodeCount: 2,
          resourceMix: { knowledge_card: 2 },
          readiness: { ready: 2 },
          readinessSummary: [
            { nodeId: 'node-a', state: 'ready', message: '可以开始学习' },
            { nodeId: 'node-b', state: 'ready', message: '可以开始学习' },
          ],
          checkpointCount: 1,
          checkpointNodeIds: ['node-b'],
          lockedNodeCount: 0,
          lockedNodeIds: [],
          terminalValidationCount: 0,
          terminalValidationNodeIds: [],
        },
      },
      {
        optionId: 'path-option-2',
        styleId: 'simulation',
        label: '仿真验证路径',
        metrics: {
          estimatedMinutes: 40,
          nodeCount: 2,
          resourceMix: { knowledge_card: 2 },
          readiness: { ready: 1, locked: 1 },
          readinessSummary: [
            { nodeId: 'node-a', state: 'ready', message: '可以开始学习' },
            { nodeId: 'node-c', state: 'locked', message: '完成共同节点后解锁' },
          ],
          checkpointCount: 0,
          checkpointNodeIds: [],
          lockedNodeCount: 1,
          lockedNodeIds: ['node-c'],
          terminalValidationCount: 1,
          terminalValidationNodeIds: ['node-c'],
        },
      },
    ],
    commonNodes: [{ nodeId: 'node-a', title: '共同节点', resourceType: 'knowledge_card', positions: [0, 0] }],
    optionOnlyNodes: [
      { optionId: 'path-option-1', nodes: [{ nodeId: 'node-b', title: '基础节点', resourceType: 'knowledge_card', position: 1 }] },
      { optionId: 'path-option-2', nodes: [{ nodeId: 'node-c', title: '仿真节点', resourceType: 'knowledge_card', position: 1 }] },
    ],
    orderDifferences: [],
    tradeoffs: ['基础路径先补齐概念，仿真路径增加验证环节。'],
    limitations: status === 'insufficient-data' ? ['候选路径缺少完整节点信息。'] : [],
  };
}

async function capture(page: Page, viewport: { name: string; width: number; height: number }) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${viewport.name} must not overflow horizontally`).toBe(geometry.clientWidth);
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const filename = `${viewport.name}-ready.png`;
  const file = path.join(evidenceDir, filename);
  const image = await page.screenshot({ path: file, fullPage: true });
  screenshots.push({
    name: filename,
    width: viewport.width,
    height: viewport.height,
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    state: 'ready',
    noHorizontalOverflow: true,
  });
}

test.describe.configure({ mode: 'serial' });

test('evidence manifest fails closed when tracked source changes', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { commitSha?: string; sourceSha256?: Record<string, string>; screenshots?: Array<{ file: string; sha256: string; noHorizontalOverflow?: boolean }> };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(hasWorkingTreeSourceDrift(), 'tracked evidence sources must match HEAD').toBe(false);
  for (const file of sourceFiles) {
    const expectedHash = manifest.sourceSha256?.[file];
    expect(expectedHash, `${file} source hash missing or stale`).toBe(sourceHashAtCommit(manifest.commitSha!, file));
    expect(sourceHashAtCommit('HEAD', file), `${file} changed after the evidence checkpoint`).toBe(expectedHash);
  }
  expect(manifest.screenshots?.map((screenshot) => screenshot.file).sort()).toEqual([...expectedScreenshotFiles].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const screenshotPath = path.resolve(process.cwd(), screenshot.file);
    expect(existsSync(screenshotPath), screenshot.file).toBe(true);
    expect(sha256(readFileSync(screenshotPath))).toBe(screenshot.sha256);
    expect(screenshot.noHorizontalOverflow).toBe(true);
  }
});

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} verifies path difference states and invalidation`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(context);
    let revised = false;
    let explainCalls = 0;
    let staleExplanationStarted = false;
    const staleExplanation = { release: null as (() => void) | null };
    let pathAdvisorContextCalls = 0;
    let pathRoundCalls = 0;
    const toolRequests: Array<{
      operation?: string;
      selectedOptionId?: string;
      compareWithOptionId?: string;
      modeContextToken?: string;
    }> = [];
    // Real page interactions consume deterministic, auditable service fixtures without
    // mutating shared learner or class data.
    await context.route('**/api/adaptive/learner-state**', (route: Route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: learnerStateFixture,
    }));
    await context.route(/\/api\/adaptive\/path-advisor-context(?:\?.*)?$/, (route: Route) => {
      pathAdvisorContextCalls += 1;
      return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: pathAdvisorContextFixture,
      });
    });
    await context.route(new RegExp(`/api/learning-paths/${pathId}$`), (route: Route) => {
      pathRoundCalls += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pathRound(revised)) });
    });
    await context.route('**/api/adaptive/path-advisor-tool', async (route: Route) => {
      const request = route.request().postDataJSON() as {
        operation?: string;
        selectedOptionId?: string;
        compareWithOptionId?: string;
        modeContextToken?: string;
      };
      toolRequests.push(request);
      if (request.operation === 'explain') {
        const callIndex = explainCalls++;
        if (callIndex === 3) {
          staleExplanationStarted = true;
          await new Promise<void>((resolve) => {
            staleExplanation.release = resolve;
          });
        }
        const status = (['ready', 'no-material-difference', 'insufficient-data'] as const)[Math.min(callIndex, 2)] ?? 'ready';
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { comparison: comparison(status), studentSafeRationale: ['已生成路径差异说明。'] } }) });
        return;
      }
      revised = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { pathId } }) });
    });

    await page.goto(`/assessment/adaptive-practice?goal=control-correction&intent=path-selection&pathId=${pathId}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => pathAdvisorContextCalls, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(() => pathRoundCalls, { timeout: 10_000 }).toBeGreaterThan(0);
    const optionCard = page.locator('[data-learning-path-option="path-option-1"]:visible');
    await expect(optionCard).toHaveCount(1);
    await expect(page.locator('[data-adaptive-path-generation-action="open-in-page-path-advisor"]'))
      .toHaveAttribute('data-adaptive-generation-readiness-status', 'ready');
    const explain = optionCard.getByRole('button', { name: /解释.*差异/ });
    const differenceExplanations = page.locator(`[data-learning-path-difference-explanation="${pathId}"]`);
    const differenceExplanation = differenceExplanations.first();
    await expect(explain).toBeEnabled();
    await explain.click();
    await expect(differenceExplanations).toHaveCount(2);
    await expect(differenceExplanation).toContainText('正在比较');
    await expect(differenceExplanation).toContainText('共同节点');
    await expect.poll(() => toolRequests[0]).toMatchObject({ operation: 'explain' });
    expect(toolRequests[0]?.modeContextToken).toMatch(/\S+/);
    expect(toolRequests[0]?.selectedOptionId).toMatch(/\S+/);
    expect(toolRequests[0]?.compareWithOptionId).toMatch(/\S+/);
    expect(toolRequests[0]?.selectedOptionId).not.toBe(toolRequests[0]?.compareWithOptionId);
    await capture(page, viewport);

    await explain.click();
    await expect(differenceExplanation).toContainText('没有实质差异');
    await explain.click();
    await expect(differenceExplanation).toContainText('缺少完整节点信息');

    await explain.click();
    await expect.poll(() => staleExplanationStarted).toBe(true);
    revised = true;
    const pathRoundCallsBeforeCandidateChange = pathRoundCalls;
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('konling:adaptive-path-updated'));
    });
    await expect.poll(() => pathRoundCalls).toBeGreaterThan(pathRoundCallsBeforeCandidateChange);
    const revisedOptionCard = page.locator('[data-learning-path-option="path-option-1"]:visible');
    await expect(revisedOptionCard).toContainText('基础巩固路径');
    await expect(differenceExplanations).toHaveCount(0);
    staleExplanation.release?.();
    await expect(revisedOptionCard.getByRole('button', { name: /解释.*差异/ })).toBeEnabled();
    await expect(differenceExplanations).toHaveCount(0);

    await revisedOptionCard.getByRole('button', { name: /调整/ }).click();
    await expect.poll(() => toolRequests.some((request) => request.operation === 'revise')).toBe(true);
    assertions.push({ viewport: viewport.name, scenario: 'ready-identical-insufficient-and-invalidation', passed: true, checks: ['ready comparison', 'no material difference', 'insufficient data', 'advisor route request contract', 'candidate group invalidates stale explanation', 'in-flight stale response discarded', 'no horizontal overflow'] });
  });
}

test.afterAll(() => {
  return (async () => {
    if (!updateEvidence) return;
    expect(assertions).toHaveLength(2);
    expect(screenshots).toHaveLength(2);
    mkdirSync(evidenceDir, { recursive: true });
    const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    writeFileSync(manifestPath, `${JSON.stringify({
      capturedAt: new Date().toISOString(),
      commitSha,
      route: `/assessment/adaptive-practice?goal=control-correction&intent=path-selection&pathId=${pathId}`,
      sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)])),
      assertions,
      screenshots,
    }, null, 2)}\n`, 'utf8');
  })();
});
