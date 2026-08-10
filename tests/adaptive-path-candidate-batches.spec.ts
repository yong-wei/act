import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/commercial-ui/issue-1140-pr-b');
const manifestPath = path.join(evidenceDir, 'candidate-batch-manifest.json');
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/lib/adaptive-path-candidate-batches.ts',
  'tests/adaptive-path-candidate-batches.spec.ts',
];
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const screenshots: Array<Record<string, unknown>> = [];

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashAtCommit(commitSha: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${commitSha}:${file}`]));
}

const activePathId = 'active-path-before-generation';
const candidatePathId = 'candidate-source-path';
const batchId = 'path-candidate-batch_issue1140';
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
  classId: 'class-1140',
  generationRequestId: 'generation-request-1140-b',
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

async function installRoutes(page: Page, waitForCandidateBatch?: () => Promise<void>) {
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
    intent: 'path-selection',
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

  const query = new URLSearchParams({
    demo: '1',
    goal: 'control-correction',
    intent: 'path-selection',
  });
  await page.goto(`/assessment/adaptive-practice?${query}`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-adaptive-path-execution-surface="active-route"]')).toBeVisible();
  await expect(page.locator('[data-learning-path-options-layout="route-modules"]')).toHaveCount(0);
});

async function openSelection(page: Page, candidateId?: string) {
  const query = new URLSearchParams({
    demo: '1',
    goal: 'control-correction',
    intent: 'path-selection',
    batch: batchId,
  });
  if (candidateId) query.set('candidate', candidateId);
  await page.goto(`/assessment/adaptive-practice?${query}`, { waitUntil: 'domcontentloaded' });
  const comparison = page.locator('[data-learning-path-options-layout="route-modules"]');
  await expect(comparison).toBeVisible();
  return comparison;
}

test.describe.configure({ mode: 'serial' });

test('candidate batch evidence remains bound to committed sources', () => {
  test.skip(updateEvidence, 'capture run regenerates the manifest');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha: string;
    sourceSha256: Record<string, string>;
    screenshots: Array<{ file: string; sha256: string }>;
  };
  expect(() => execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...sourceFiles], { stdio: 'ignore' })).not.toThrow();
  for (const file of sourceFiles) {
    expect(sourceHashAtCommit('HEAD', file)).toBe(manifest.sourceSha256[file]);
    expect(sourceHashAtCommit(manifest.commitSha, file)).toBe(manifest.sourceSha256[file]);
  }
  for (const screenshot of manifest.screenshots) {
    expect(sha256(readFileSync(path.resolve(process.cwd(), screenshot.file)))).toBe(screenshot.sha256);
  }
});

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const) {
  test(`${viewport.name} preserves the active path while browsing one candidate batch`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installRoutes(page);

    let comparison = await openSelection(page);
    await expect(comparison.getByText('Foundation candidate', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(comparison.getByText('Simulation sprint', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(comparison.getByText('Existing active option', { exact: true })).toHaveCount(0);

    comparison = await openSelection(page, candidateIds[1]);
    await expect(comparison.getByText('Simulation sprint', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(comparison.getByText('Foundation candidate', { exact: true })).toHaveCount(0);
    const compareAll = page.locator('[data-learning-path-compare-all]');
    await expect(compareAll).toBeVisible();
    await compareAll.click();
    await expect(page).not.toHaveURL(/candidate=/);
    await expect(page.getByText('Foundation candidate', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Simulation sprint', { exact: true }).filter({ visible: true }).first()).toBeVisible();

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);

    if (updateEvidence) {
      mkdirSync(evidenceDir, { recursive: true });
      const file = path.join(evidenceDir, `candidate-batch-${viewport.name}.png`);
      const image = await page.screenshot({ path: file, fullPage: true });
      screenshots.push({
        file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
        sha256: sha256(image),
        width: viewport.width,
        height: viewport.height,
        activePathId,
        candidateSourcePathId: candidatePathId,
        batchId,
        noHorizontalOverflow: true,
      });
    }
  });
}

test.afterAll(() => {
  if (!updateEvidence) return;
  expect(screenshots).toHaveLength(2);
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(manifestPath, `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    commitSha,
    route: `/assessment/adaptive-practice?goal=control-correction&intent=path-selection&batch=${batchId}`,
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sourceHashAtCommit(commitSha, file)])),
    screenshots,
  }, null, 2)}\n`, 'utf8');
});
