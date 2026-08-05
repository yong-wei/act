import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page, type Route } from '@playwright/test';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1140-pr-c');
const manifestPath = path.join(evidenceDir, 'konling-selection-manifest.json');
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const sourceFiles = [
  'src/components/ai/global-ai-sidebar.tsx',
  'src/lib/konling-agent-runtime.ts',
  'src/lib/ai-prompt-builder.ts',
  'tests/adaptive-path-konling-selection-evidence.spec.ts',
];
const screenshots: Array<Record<string, unknown>> = [];
const observations: Array<Record<string, unknown>> = [];

const batchId = 'path-candidate-batch_issue1140_c';
const pathId = 'candidate-source-path-c';
const candidateId = 'path-candidate_sprint_c';
const optionId = 'sprint';

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtCommit(commitSha: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${commitSha}:${file}`]));
}

const planNode = {
  nodeId: 'node-phase-margin-c', title: 'Phase margin correction', type: 'knowledge_card',
  sourceKind: 'resource_node', sourceRef: 'phase-margin-card',
  target: 'course-content/runtime/knowledge/cards/nodes/phase-margin.md', estimatedTimeMinutes: 20,
  prerequisiteNodeIds: [], knowledgeCoverage: ['control-correction:phase-margin'], teacherPolicy: 'allowed',
  privacyLevel: 'student-visible', terminalConstraints: [], score: 0.8,
  reasonCodes: ['candidate-selection-evidence'], status: 'current',
};

function option(id: string, label: string, minutes: number) {
  return {
    optionId: id, styleId: id, label, nodeIds: [planNode.nodeId], activeNodeIds: [planNode.nodeId],
    nodeSummaries: [{ nodeId: planNode.nodeId, title: planNode.title, pathNodeType: planNode.type, estimatedTimeMinutes: minutes, status: 'ready' }],
    lockedNodeIds: [], readinessSummary: [{ nodeId: planNode.nodeId, state: 'ready', message: 'Ready' }],
    targetDeficits: [], evidenceBasis: ['governed candidate batch'], resourceMix: { knowledge_card: 1 },
    effort: { estimatedMinutes: minutes, relative: 'medium' }, terminalValidationNodeIds: [],
    terminalValidationStrategy: { summary: 'Complete the route' }, expectedTargetLift: 0.2, limitations: [],
  };
}

const candidateBatch = {
  id: batchId, userId: 'demo-student', goalId: 'control-correction', classId: 'class-1140',
  generationRequestId: 'generation-request-1140-c', sourcePathId: pathId,
  plannerVersion: 'candidate-selection-evidence', status: 'succeeded', createdAt: '2026-08-05T00:00:00.000Z',
  candidates: [
    { id: 'path-candidate_foundation_c', ordinal: 0, styleId: 'foundation', policyFamily: 'foundation', label: 'Foundation candidate', snapshot: option('foundation', 'Foundation candidate', 35) },
    { id: candidateId, ordinal: 1, styleId: optionId, policyFamily: 'simulation', label: 'Simulation sprint', snapshot: option(optionId, 'Simulation sprint', 50) },
  ],
};

const learnerState = {
  userId: 'demo-student', payloadVersion: 'adaptive-learner-state.v1', generatedAt: '2026-08-05T00:00:00.000Z', authority: 'server-owned',
  roleScope: { role: 'student', classId: 'class-1140', privacyScopes: ['student-visible'] },
  clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
  primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} }, secondaryDimensions: {},
  knowledgeMastery: { coverage: 'missing', tags: {} },
  pathContext: { activePathCount: 0, bookmarkedPathCount: 0, recentPathIds: [], activeControlCorrectionPath: { state: 'none', pathId: null, status: null, currentNodeId: null, terminalValidationState: null, lowConfidenceMarkers: [] }, statusMarkers: ['available'] },
  assessmentState: { latestAbilityEstimate: null },
  evidence: { readState: 'ready', evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 }, sourceCounts: {}, sourceCoverage: {}, confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 }, statusMarkers: [] },
  missingEvidence: [],
};

function chatStream(parts: Array<Record<string, unknown>>) {
  return [
    { type: 'start', messageId: `assistant-${Date.now()}` },
    ...parts,
    { type: 'finish', finishReason: 'stop' },
  ].map((part) => `data: ${JSON.stringify(part)}`).concat('data: [DONE]', '').join('\n\n');
}

function pendingSelectionParts() {
  const toolCallId = 'selection-tool-call-c';
  const input = { batchId, candidateId, pathId, goalId: 'control-correction', idempotencyKey: 'selection-c-idempotency' };
  const output = {
    status: 'pending_commit', toolRunId: 'selection-tool-run-c', batchId, candidateId, pathId,
    goalId: 'control-correction', selectedOptionId: optionId, selectedStyleId: optionId,
    idempotencyKey: 'selection-c-idempotency', autoStart: false,
    studentSafeRationale: 'The governed candidate is ready to commit.',
  };
  return [
    { type: 'tool-input-start', toolCallId, toolName: 'select_learning_path' },
    { type: 'tool-input-available', toolCallId, toolName: 'select_learning_path', input },
    { type: 'tool-output-available', toolCallId, output },
  ];
}

async function installRoutes(page: Page) {
  let chatCalls = 0;
  let choiceCalls = 0;
  const conversation = {
    id: 'conversation-selection-c', userId: 'demo-student', courseId: 'control-correction',
    pageId: 'adaptive-practice', title: 'Candidate selection', titleIsManual: false, pinned: false,
    pinnedAt: null, lastActivityAt: '2026-08-05T00:00:00.000Z', createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z', expiresAt: '2026-08-06T00:00:00.000Z', messages: [],
    assistantBinding: { teachingAssistantModeId: 'path-advisor', modeClientContextHints: { candidateBatchId: batchId } },
  };
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: {
    user: { id: 'demo-student', email: 'demo@example.test', name: 'Demo student', role: 'STUDENT' },
    expires: '2026-08-06T00:00:00.000Z',
  } }));
  await page.route('**/api/ai/sessions', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { conversations: [conversation] } });
    return route.fulfill({ json: conversation });
  });
  await page.route('**/api/ai/sessions/conversation-selection-c', (route) => route.fulfill({ json: conversation }));
  await page.route('**/api/adaptive/path-advisor-context**', (route) => route.fulfill({ json: {
    goalId: 'control-correction', classId: 'class-1140', courseTitle: 'Control correction', topic: 'Phase margin',
    learningObjectives: ['Choose one governed candidate'], modeContextToken: 'candidate-selection-mode-token',
    readiness: { status: 'ready', reason: 'ready', source: 'path-advisor', studentAction: 'select', studentMessage: 'Ready' },
  } }));
  await page.route('**/api/adaptive/learner-state**', (route) => route.fulfill({ json: learnerState }));
  await page.route('**/api/learning-paths/latest?**', (route) => route.fulfill({ json: { path: null } }));
  await page.route('**/api/learning-paths/candidate-batches/latest?**', (route) => route.fulfill({ json: { batch: candidateBatch } }));
  await page.route(`**/api/learning-paths/candidate-batches/${batchId}**`, (route) => route.fulfill({ json: { batch: candidateBatch } }));
  await page.route(`**/api/learning-paths/${pathId}/choices`, async (route: Route) => {
    choiceCalls += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).toMatchObject({ action: 'selection', batchId, candidateId, selectedOptionId: optionId, selectedStyleId: optionId, toolRunId: 'selection-tool-run-c' });
    if (choiceCalls === 1) return route.abort('connectionreset');
    return route.fulfill({ json: { choice: { action: 'selection', batchId, candidateId }, selectedCandidateId: candidateId } });
  });
  await page.route('**/api/ai/chat', async (route) => {
    chatCalls += 1;
    const parts = chatCalls === 1
      ? [
          { type: 'text-start', id: 'clarification-c' },
          { type: 'text-delta', id: 'clarification-c', delta: '请在 Foundation candidate 和 Simulation sprint 中确认一个。' },
          { type: 'text-end', id: 'clarification-c' },
        ]
      : pendingSelectionParts();
    await route.fulfill({ headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }, body: chatStream(parts) });
  });
  return { chatCalls: () => chatCalls, choiceCalls: () => choiceCalls };
}

async function sendPrompt(page: Page, prompt: string) {
  const input = page.getByLabel('全局 AI 问题输入框');
  await input.fill(prompt);
  await page.getByRole('button', { name: '发送 AI 问题' }).click();
}

async function capture(page: Page, viewport: { name: string; width: number; height: number }) {
  if (!updateEvidence) return;
  mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `konling-selection-${viewport.name}.png`);
  const image = await page.screenshot({ path: file, fullPage: true });
  screenshots.push({
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'), sha256: sha256(image),
    width: viewport.width, height: viewport.height, noHorizontalOverflow: true,
    states: ['ambiguity-clarified', 'failed-sync', 'idempotent-retry-succeeded', 'same-batch-focused', 'execution-idle'],
  });
}

test.describe.configure({ mode: 'serial' });

test('candidate selection evidence remains bound to committed sources', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { commitSha: string; sourceSha256: Record<string, string>; screenshots: Array<{ file: string; sha256: string }> };
  expect(() => execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...sourceFiles], { stdio: 'ignore' })).not.toThrow();
  for (const file of sourceFiles) {
    expect(sourceHashAtCommit('HEAD', file)).toBe(manifest.sourceSha256[file]);
    expect(sourceHashAtCommit(manifest.commitSha, file)).toBe(manifest.sourceSha256[file]);
  }
  for (const screenshot of manifest.screenshots) expect(sha256(readFileSync(path.resolve(process.cwd(), screenshot.file)))).toBe(screenshot.sha256);
});

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} clarifies and commits one candidate without auto-start`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const calls = await installRoutes(page);
    await page.goto(`/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-selection&batch=${batchId}&candidate=${candidateId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`batch=${batchId}.*candidate=${candidateId}`));
    await expect(page.getByText('Simulation sprint', { exact: true }).filter({ visible: true }).first()).toBeVisible();

    const openKonling = page.locator('button:not([disabled])', { hasText: '打开控灵' }).first();
    await expect(openKonling).toBeEnabled();
    await openKonling.click();
    const sidebar = page.locator('[data-konling-assistant-surface="global-sidebar"]');
    await expect(sidebar).toBeVisible();
    await sendPrompt(page, '选那个路径');
    await expect(sidebar.getByText(/请在 Foundation candidate 和 Simulation sprint/)).toBeVisible();

    await sendPrompt(page, '选择 Simulation sprint');
    await expect(sidebar.getByText('路径选择未能同步，请重试。', { exact: true })).toBeVisible();
    expect(calls.choiceCalls()).toBe(1);
    await sendPrompt(page, '重试同一选择');
    await expect(sidebar.getByText('路径选择已同步，等待你开始学习。', { exact: true })).toBeVisible();
    expect(calls.choiceCalls()).toBe(2);
    expect(calls.chatCalls()).toBe(3);

    const input = page.getByLabel('全局 AI 问题输入框');
    await input.focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('发送 AI 问题');
    const geometry = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    expect(await page.locator('[data-learning-path-execution-state="running"]').count()).toBe(0);
    await capture(page, viewport);
    observations.push({ viewport: viewport.name, ...geometry, ambiguityClarified: true, failedSyncVisible: true, sameIdentityRetrySucceeded: true, deepLinkCandidateId: candidateId, keyboardFocusReachedSend: true, autoStart: false });
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(screenshots).toHaveLength(2);
  expect(observations).toHaveLength(2);
  mkdirSync(evidenceDir, { recursive: true });
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    capturedAt: new Date().toISOString(), commitSha,
    route: `/assessment/adaptive-practice?goal=control-correction&intent=path-selection&batch=${batchId}&candidate=${candidateId}`,
    fixtureAuthority: 'Authenticated demo learner with owner-, goal-, path-, batch-, and candidate-scoped route fixtures',
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)])),
    observations, screenshots,
  }, null, 2)}\n`, 'utf8');
});
