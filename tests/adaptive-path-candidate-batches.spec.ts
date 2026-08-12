import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1327');
const manifestPath = path.join(evidenceDir, 'candidate-batch-manifest.json');
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/lib/adaptive-path-candidate-batches.ts',
  'tests/adaptive-path-candidate-batches.spec.ts',
];
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const screenshots: Array<Record<string, unknown>> = [];

type CaptureProvenanceSnapshot = {
  commitSha: string;
  sourceSha256: Record<string, string>;
  workingTreeSourceSha256: Record<string, string>;
  sourceGitBlobIds: Record<string, string>;
};

type CaptureInputState = {
  commitSha: string;
  trackedChanges: string[];
  workingTreeSourceSha256: Record<string, string>;
  committedSourceSha256: Record<string, string>;
  workingTreeGitBlobIds: Record<string, string>;
  committedGitBlobIds: Record<string, string>;
};

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtCommit(commitSha: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${commitSha}:${file}`]));
}

function workingTreeGitBlobId(file: string): string {
  return execFileSync('git', ['hash-object', `--path=${file}`, file], { encoding: 'utf8' }).trim();
}

function sourceGitBlobIdAtCommit(commitSha: string, file: string): string {
  return execFileSync('git', ['rev-parse', `${commitSha}:${file}`], { encoding: 'utf8' }).trim();
}

function currentHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function trackedChangesOutsideEvidence(): string[] {
  const evidencePrefix = `${path.relative(process.cwd(), evidenceDir).replaceAll('\\', '/')}/`;
  return execFileSync('git', ['diff', '--name-only', '-z', 'HEAD', '--'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => !file.startsWith(evidencePrefix));
}

function readCaptureInputState(): CaptureInputState {
  const commitSha = currentHead();
  return {
    commitSha,
    trackedChanges: trackedChangesOutsideEvidence(),
    workingTreeSourceSha256: Object.fromEntries(
      sourceFiles.map((file) => [file, sha256(readFileSync(path.resolve(process.cwd(), file)))]),
    ),
    committedSourceSha256: Object.fromEntries(
      sourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)]),
    ),
    workingTreeGitBlobIds: Object.fromEntries(
      sourceFiles.map((file) => [file, workingTreeGitBlobId(file)]),
    ),
    committedGitBlobIds: Object.fromEntries(
      sourceFiles.map((file) => [file, sourceGitBlobIdAtCommit(commitSha, file)]),
    ),
  };
}

function assertCaptureInputsStable(
  snapshot: CaptureProvenanceSnapshot,
  current: CaptureInputState,
  phase: string,
) {
  expect(current.commitSha, `${phase}: HEAD changed during evidence capture`).toBe(snapshot.commitSha);
  expect(current.trackedChanges, `${phase}: tracked runtime inputs drifted`).toEqual([]);
  for (const file of sourceFiles) {
    expect(
      current.workingTreeSourceSha256[file],
      `${phase}: working-tree bytes drifted for ${file}`,
    ).toBe(snapshot.workingTreeSourceSha256[file]);
    expect(
      current.committedSourceSha256[file],
      `${phase}: committed bytes drifted for ${file}`,
    ).toBe(snapshot.sourceSha256[file]);
    expect(
      current.workingTreeGitBlobIds[file],
      `${phase}: working-tree content differs from the committed Git blob for ${file}`,
    ).toBe(snapshot.sourceGitBlobIds[file]);
    expect(current.committedGitBlobIds[file]).toBe(snapshot.sourceGitBlobIds[file]);
  }
}

function createCaptureProvenanceSnapshot(): CaptureProvenanceSnapshot {
  const current = readCaptureInputState();
  const snapshot = {
    commitSha: current.commitSha,
    sourceSha256: current.committedSourceSha256,
    workingTreeSourceSha256: current.workingTreeSourceSha256,
    sourceGitBlobIds: current.committedGitBlobIds,
  };
  assertCaptureInputsStable(snapshot, current, 'capture start');
  return snapshot;
}

function verifyCaptureProvenance(snapshot: CaptureProvenanceSnapshot, phase: string) {
  assertCaptureInputsStable(snapshot, readCaptureInputState(), phase);
}

const captureProvenance = updateEvidence ? createCaptureProvenanceSnapshot() : null;

const activePathId = 'active-path-before-generation';
const candidatePathId = 'candidate-source-path';
const batchId = 'path-candidate-batch_issue1327';
const missingBatchId = 'path-candidate-batch_issue1327-missing';
const failedBatchId = 'path-candidate-batch_issue1327-failed';
const candidateIds = ['path-candidate_foundation', 'path-candidate_sprint'];

const planNode = {
  nodeId: 'node-phase-margin',
  title: 'Phase margin correction',
  type: 'knowledge_card',
  sourceKind: 'resource_node',
  sourceRef: 'phase-margin-card',
  target: 'course-content/runtime/knowledge/cards/nodes/phase-margin.md',
  estimatedTimeMinutes: 20,
  prerequisiteNodeIds: [],
  knowledgeCoverage: ['control-correction:phase-margin'],
  teacherPolicy: 'allowed',
  privacyLevel: 'student-visible',
  terminalConstraints: [],
  score: 0.8,
  reasonCodes: ['candidate-batch-e2e'],
  status: 'current',
};

function option(optionId: string, label: string, estimatedMinutes: number) {
  return {
    optionId,
    styleId: optionId,
    label,
    nodeIds: [planNode.nodeId],
    activeNodeIds: [planNode.nodeId],
    nodeSummaries: [{
      nodeId: planNode.nodeId,
      title: planNode.title,
      pathNodeType: planNode.type,
      estimatedTimeMinutes: estimatedMinutes,
      status: 'ready',
    }],
    lockedNodeIds: [],
    readinessSummary: [{ nodeId: planNode.nodeId, state: 'ready', message: 'Ready' }],
    targetDeficits: [],
    evidenceBasis: ['governed candidate batch'],
    resourceMix: { knowledge_card: 1 },
    effort: { estimatedMinutes, relative: 'medium' },
    terminalValidationNodeIds: [],
    terminalValidationStrategy: { summary: 'Complete the route' },
    expectedTargetLift: 0.2,
    limitations: [],
  };
}

const candidateBatch = {
  id: batchId,
  userId: 'demo-student',
  goalId: 'control-correction',
  classId: 'class-1327',
  generationRequestId: 'generation-request-1327',
  sourcePathId: candidatePathId,
  plannerVersion: 'candidate-batch-e2e',
  status: 'succeeded',
  createdAt: '2026-08-03T00:00:00.000Z',
  candidates: [
    { id: candidateIds[0], ordinal: 0, styleId: 'foundation', policyFamily: 'foundation', label: 'Foundation candidate', snapshot: option('foundation', 'Foundation candidate', 35) },
    { id: candidateIds[1], ordinal: 1, styleId: 'sprint', policyFamily: 'simulation', label: 'Simulation sprint', snapshot: option('sprint', 'Simulation sprint', 50) },
  ],
};

const activePath = {
  path: {
    id: activePathId,
    userId: 'demo-student',
    title: 'Existing active path',
    goalId: 'control-correction',
    plannerVersion: 'active-path-e2e',
    pathStatus: 'active',
    currentNodeId: planNode.nodeId,
    pathPayload: {
      status: 'ready',
      planNodes: [planNode],
      mainPathNodeIds: [planNode.nodeId],
      pathOptions: [option('existing', 'Existing active option', 20)],
      feedbackEvents: [],
      selectionHistory: [],
      activity: [],
      visualization: {},
      score: { total: 0.8, objectives: {} },
      confidence: { level: 'medium', score: 0.8, sourceCoverage: 0.8 },
    },
    explanationPayload: { explanations: { selectedReasons: [], fallbackReasons: [] }, selectedReasons: [], fallbackReasons: [] },
    alternativePayload: [],
    terminalValidation: {},
    lastExecutionMetadata: { adopted: true, completedNodeIds: [], activeNodeId: planNode.nodeId },
    executions: [],
    deviations: [],
    interventions: [],
  },
};

const learnerState = {
  userId: 'demo-student',
  payloadVersion: 'adaptive-learner-state.v1',
  generatedAt: '2026-08-03T00:00:00.000Z',
  authority: 'server-owned',
  roleScope: { role: 'student', classId: 'class-1140', privacyScopes: ['student-visible'] },
  clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
  primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
  secondaryDimensions: {},
  knowledgeMastery: { coverage: 'missing', tags: {} },
  pathContext: {
    activePathCount: 1,
    bookmarkedPathCount: 0,
    recentPathIds: [activePathId],
    activeControlCorrectionPath: {
      state: 'active', pathId: activePathId, status: 'active', currentNodeId: planNode.nodeId,
      terminalValidationState: null, lowConfidenceMarkers: [],
    },
    statusMarkers: ['available'],
  },
  assessmentState: { latestAbilityEstimate: null },
  evidence: {
    readState: 'ready', evidenceWindow: { firstStartedAt: null, lastStartedAt: null, daysCovered: 0 },
    sourceCounts: {}, sourceCoverage: {},
    confidence: { level: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
    statusMarkers: [],
  },
  missingEvidence: [],
};

const learnerStateWithoutActivePath = {
  ...learnerState,
  pathContext: {
    ...learnerState.pathContext,
    activePathCount: 0,
    recentPathIds: [],
    activeControlCorrectionPath: { state: 'none' },
    statusMarkers: ['missing'],
  },
};

async function installRoutes(page: Page, waitForCandidateBatch?: () => Promise<void>) {
  await page.route('**/api/adaptive/path-advisor-context**', (route) => route.fulfill({
    json: {
      goalId: 'control-correction',
      classId: 'class-issue-1349',
      courseTitle: 'Control correction',
      topic: 'Candidate path comparison',
      learningObjectives: ['Compare generated learning paths'],
      modeContextToken: 'issue-1349-mode-context-token',
      readiness: {
        status: 'ready',
        reason: 'ready',
        source: 'path-advisor',
        studentAction: 'generate',
        studentMessage: 'Ready',
      },
    },
  }));
  await page.route('**/api/adaptive/path-advisor-tool', (route) => route.fulfill({
    json: {
      agentSessionId: 'agent-session-issue-1349',
      generationRequest: { id: 'generation-request-issue-1349', status: 'succeeded' },
      result: {
        generationStatus: 'succeeded',
        candidateBatch: { id: batchId },
      },
    },
  }));
  await page.route('**/api/adaptive/learner-state**', (route) => route.fulfill({ json: learnerState }));
  await page.route('**/api/learning-paths/latest?**', (route) => route.fulfill({ json: activePath }));
  await page.route(`**/api/learning-paths/${activePathId}`, (route) => route.fulfill({ json: activePath }));
  await page.route('**/api/learning-paths/candidate-batches/latest?**', (route) => route.fulfill({ json: { batch: candidateBatch } }));
  await page.route(`**/api/learning-paths/candidate-batches/${batchId}**`, async (route) => {
    await waitForCandidateBatch?.();
    const candidateId = new URL(route.request().url()).searchParams.get('candidate');
    if (candidateId && !candidateIds.includes(candidateId)) {
      await route.fulfill({ status: 404, json: { error: 'Candidate does not belong to batch' } });
      return;
    }
    await route.fulfill({ json: { batch: candidateBatch } });
  });
  await page.route(`**/api/learning-paths/candidate-batches/${missingBatchId}**`, (route) => (
    route.fulfill({ status: 404, json: { error: 'Candidate batch not found' } })
  ));
  await page.route(`**/api/learning-paths/candidate-batches/${failedBatchId}**`, (route) => (
    route.fulfill({ status: 500, json: { error: 'Candidate batch unavailable' } })
  ));
  await page.route('**/api/learning-paths/missing-path', (route) => (
    route.fulfill({ status: 404, json: { error: 'Learning path not found' } })
  ));
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

test('keeps the comparison surface visible while a candidate batch is loading', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let releaseCandidateBatch: (() => void) | undefined;
  const candidateBatchGate = new Promise<void>((resolve) => {
    releaseCandidateBatch = resolve;
  });
  await installRoutes(page, () => candidateBatchGate);

  const query = new URLSearchParams({
    demo: '1',
    goal: 'control-correction',
    intent: 'contextual-recommendation',
    batch: batchId,
  });
  await page.goto(`/assessment/adaptive-practice?${query}`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-adaptive-path-candidate-state="loading"]')).toBeVisible();
  releaseCandidateBatch?.();
  await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toBeVisible();
  await expect(page.getByText('Foundation candidate', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Simulation sprint', { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test('hides candidate comparison when continuing without a new candidate batch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installRoutes(page);

  const query = new URLSearchParams({
    demo: '1',
    goal: 'control-correction',
    intent: 'contextual-recommendation',
  });
  await page.goto(`/assessment/adaptive-practice?${query}`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-adaptive-path-execution-surface="active-route"]')).toBeVisible();
  await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toHaveCount(0);
});

test('keeps the active path available while configuring a new path', async ({ context, page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(context);
  await installRoutes(page);

  const query = new URLSearchParams({
    goal: 'control-correction',
    intent: 'contextual-recommendation',
  });
  await page.goto(`/assessment/adaptive-practice?${query}`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-adaptive-path-continue-action="current-path"]')).toBeVisible();
  await expect(page.locator('[data-adaptive-path-execution-surface="active-route"]')).toBeVisible();
  await expect(page.locator('[data-adaptive-path-generation-panel="editable"]')).toBeVisible();
  await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toHaveCount(0);
});

test('shows candidate comparison immediately after generation adds a candidate batch', async ({ context, page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(context);
  await installRoutes(page);

  const query = new URLSearchParams({
    goal: 'control-correction',
    intent: 'contextual-recommendation',
  });
  await page.goto(`/assessment/adaptive-practice?${query}`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-adaptive-path-continue-action="current-path"]')).toBeVisible();
  await expect(page.locator('[data-adaptive-path-generation-panel="editable"]')).toBeVisible();
  await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toHaveCount(0);

  const generateAction = page.locator('[data-adaptive-path-generation-action="submit-panel-request"]');
  await expect(generateAction).toBeEnabled();
  await generateAction.click();

  await expect(page).toHaveURL(new RegExp(`batch=${batchId}`));
  await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toBeVisible();
  await expect(page.getByText('Foundation candidate', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('Simulation sprint', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('[data-adaptive-path-continue-action="current-path"]')).toBeVisible();
  await expect(page.locator('[data-adaptive-path-generation-panel="editable"]')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toBeVisible();
  await expect(page.getByText('Foundation candidate', { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

async function openGeneration(page: Page, requestedBatchId?: string, candidateId?: string, pathId?: string) {
  const query = new URLSearchParams({
    goal: 'control-correction',
    intent: 'contextual-recommendation',
  });
  if (requestedBatchId) query.set('batch', requestedBatchId);
  if (candidateId) query.set('candidate', candidateId);
  if (pathId) query.set('pathId', pathId);
  await page.goto(`/assessment/adaptive-practice?${query}`, { waitUntil: 'domcontentloaded' });
  return page.locator('[data-learning-path-options-layout="route-modules"]');
}

test.describe.configure({ mode: 'serial' });

test('candidate batch evidence remains bound to committed sources', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    capturedAt: string;
    commitSha: string;
    generator: string;
    generatorSha256: string;
    sourceSha256: Record<string, string>;
    captureWorkingTreeSourceSha256: Record<string, string>;
    sourceGitBlobIds: Record<string, string>;
    screenshots: Array<{ file: string; sha256: string; scenario: string; width: number }>;
  };
  expect(() => execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...sourceFiles], { stdio: 'ignore' })).not.toThrow();
  expect(() => execFileSync('git', ['merge-base', '--is-ancestor', manifest.commitSha, 'HEAD'])).not.toThrow();
  expect(Number.isNaN(Date.parse(manifest.capturedAt))).toBe(false);
  expect(manifest.generator).toBe('tests/adaptive-path-candidate-batches.spec.ts');
  expect(manifest.generatorSha256).toBe(manifest.sourceSha256[manifest.generator]);
  for (const file of sourceFiles) {
    expect(sourceHashAtCommit('HEAD', file)).toBe(manifest.sourceSha256[file]);
    expect(sourceHashAtCommit(manifest.commitSha, file)).toBe(manifest.sourceSha256[file]);
    expect(manifest.captureWorkingTreeSourceSha256[file]).toMatch(/^[a-f0-9]{64}$/);
    expect(workingTreeGitBlobId(file)).toBe(manifest.sourceGitBlobIds[file]);
    expect(sourceGitBlobIdAtCommit(manifest.commitSha, file)).toBe(manifest.sourceGitBlobIds[file]);
  }
  expect(new Set(manifest.screenshots.map((screenshot) => `${screenshot.scenario}:${screenshot.width}`))).toEqual(new Set([
    'no-batch:1440', 'loaded:1440', 'missing:1440', 'failed:1440',
    'no-batch:320', 'loaded:320', 'missing:320', 'failed:320',
  ]));
  for (const screenshot of manifest.screenshots) {
    expect(sha256(readFileSync(path.resolve(process.cwd(), screenshot.file)))).toBe(screenshot.sha256);
  }
});

test('candidate batch capture provenance fails closed on runtime input drift', () => {
  test.skip(updateEvidence, 'capture run exercises the live provenance guard');
  const sourceSha256 = Object.fromEntries(sourceFiles.map((file) => [file, 'stable-hash']));
  const sourceGitBlobIds = Object.fromEntries(sourceFiles.map((file) => [file, 'stable-blob']));
  const snapshot = {
    commitSha: 'stable-head',
    sourceSha256,
    workingTreeSourceSha256: sourceSha256,
    sourceGitBlobIds,
  };
  const stableState: CaptureInputState = {
    commitSha: snapshot.commitSha,
    trackedChanges: [],
    workingTreeSourceSha256: sourceSha256,
    committedSourceSha256: sourceSha256,
    workingTreeGitBlobIds: sourceGitBlobIds,
    committedGitBlobIds: sourceGitBlobIds,
  };

  expect(() => assertCaptureInputsStable(snapshot, {
    ...stableState,
    commitSha: 'changed-head',
  }, 'test')).toThrow(/HEAD changed during evidence capture/);
  expect(() => assertCaptureInputsStable(snapshot, {
    ...stableState,
    trackedChanges: ['src/app/layout.tsx'],
  }, 'test')).toThrow(/tracked runtime inputs drifted/);
  expect(() => assertCaptureInputsStable(snapshot, {
    ...stableState,
    workingTreeSourceSha256: { ...sourceSha256, [sourceFiles[0]]: 'changed-bytes' },
  }, 'test')).toThrow(/working-tree bytes drifted/);
});

async function assertNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
}

async function captureEvidence(
  page: Page,
  viewport: { name: string; width: number; height: number },
  scenario: 'no-batch' | 'loaded' | 'missing' | 'failed',
  assertions: string[],
  focusedControl?: string,
) {
  await assertNoHorizontalOverflow(page);
  if (!updateEvidence) return;
  expect(captureProvenance).not.toBeNull();
  verifyCaptureProvenance(captureProvenance!, `before ${scenario}-${viewport.name} screenshot`);
  mkdirSync(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `${scenario}-${viewport.name}.png`);
  const image = await page.screenshot({ path: file, fullPage: true });
  verifyCaptureProvenance(captureProvenance!, `after ${scenario}-${viewport.name} screenshot`);
  screenshots.push({
    file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
    sha256: sha256(image),
    scenario,
    route: new URL(page.url()).pathname + new URL(page.url()).search,
    width: viewport.width,
    height: viewport.height,
    activePathId,
    candidateSourcePathId: candidatePathId,
    batchId: scenario === 'loaded' ? batchId : scenario === 'missing' ? missingBatchId : scenario === 'failed' ? failedBatchId : null,
    assertions,
    focusedControl: focusedControl ?? null,
    noHorizontalOverflow: true,
  });
}

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} captures the generation-to-comparison recovery contract`, async ({ context, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(context);
    let releaseCandidateBatch: (() => void) | undefined;
    const candidateBatchGate = new Promise<void>((resolve) => {
      releaseCandidateBatch = resolve;
    });
    await installRoutes(page, () => candidateBatchGate);

    let comparison = await openGeneration(page);
    await expect(page.locator('[data-adaptive-path-continue-action="current-path"]')).toBeVisible();
    await expect(page.locator('[data-adaptive-path-execution-surface="active-route"]')).toBeVisible();
    await expect(page.locator('[data-adaptive-path-generation-panel="editable"]')).toBeVisible();
    await expect(comparison).toHaveCount(0);
    await captureEvidence(page, viewport, 'no-batch', [
      'active path remains reachable',
      'generation settings remain editable',
      'candidate comparison stays hidden without an explicit batch',
    ]);

    comparison = await openGeneration(page, batchId);
    await expect(page.locator('[data-adaptive-path-candidate-state="loading"]')).toBeVisible();
    await expect(page.locator('[data-adaptive-path-continue-action="current-path"]')).toBeVisible();
    releaseCandidateBatch?.();
    await expect(comparison).toBeVisible();
    await expect(comparison.getByText('Foundation candidate', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(comparison.getByText('Simulation sprint', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(comparison.getByText('Existing active option', { exact: true })).toHaveCount(0);
    const selectAction = page.getByRole('button', { name: '选择Foundation candidate' }).filter({ visible: true }).first();
    await expect(selectAction).toBeVisible();
    await expect(page.getByRole('button', { name: '请控灵调整Foundation candidate' }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '解释Foundation candidate差异' }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '暂不采用Foundation candidate' }).filter({ visible: true }).first()).toBeVisible();
    await selectAction.focus();
    await expect(selectAction).toBeFocused();
    await captureEvidence(page, viewport, 'loaded', [
      'loading state precedes candidate rendering',
      'at least two generated candidates are visible',
      'active path remains reachable before selection',
      'primary candidate actions are visible and keyboard focusable',
    ], '选择Foundation candidate');

    await page.route('**/api/adaptive/learner-state**', (route) => route.fulfill({ json: learnerStateWithoutActivePath }));
    await openGeneration(page, missingBatchId, undefined, 'missing-path');
    await expect(page.locator('[data-adaptive-path-candidate-recovery-state="missing"]')).toBeVisible();
    await expect(page.getByRole('link', { name: '重新生成路径' })).toBeVisible();
    await captureEvidence(page, viewport, 'missing', [
      'missing batch fails closed into an explicit recovery state',
      'regeneration action remains available',
    ]);

    await openGeneration(page, failedBatchId, undefined, 'missing-path');
    await expect(page.locator('[data-adaptive-path-candidate-recovery-state="failed"]')).toBeVisible();
    await expect(page.getByRole('link', { name: '重新生成路径' })).toBeVisible();
    await captureEvidence(page, viewport, 'failed', [
      'failed batch fails closed into an explicit recovery state',
      'regeneration action remains available',
    ]);
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(captureProvenance).not.toBeNull();
  expect(screenshots).toHaveLength(8);
  verifyCaptureProvenance(captureProvenance!, 'after all screenshots');
  const temporaryManifestPath = `${manifestPath}.${process.pid}.tmp`;
  const manifest = `${JSON.stringify({
    schemaVersion: 1,
    issue: 1327,
    capturedAt: new Date().toISOString(),
    commitSha: captureProvenance!.commitSha,
    generator: 'tests/adaptive-path-candidate-batches.spec.ts',
    generatorSha256: captureProvenance!.sourceSha256['tests/adaptive-path-candidate-batches.spec.ts'],
    representativeRoute: `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation&batch=${batchId}`,
    sourceSha256: captureProvenance!.sourceSha256,
    captureWorkingTreeSourceSha256: captureProvenance!.workingTreeSourceSha256,
    sourceGitBlobIds: captureProvenance!.sourceGitBlobIds,
    screenshots,
  }, null, 2)}\n`;

  verifyCaptureProvenance(captureProvenance!, 'before temporary manifest write');
  writeFileSync(temporaryManifestPath, manifest, 'utf8');
  try {
    verifyCaptureProvenance(captureProvenance!, 'before manifest replacement');
    renameSync(temporaryManifestPath, manifestPath);
    verifyCaptureProvenance(captureProvenance!, 'after manifest replacement');
  } finally {
    rmSync(temporaryManifestPath, { force: true });
  }
});
