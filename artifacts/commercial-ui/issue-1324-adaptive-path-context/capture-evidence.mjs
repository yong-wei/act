import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import { decode, encode } from 'next-auth/jwt';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/issue-1324-adaptive-path-context');
const baseUrl = process.env.ADAPTIVE_PATH_EVIDENCE_BASE_URL ?? 'http://localhost:3002';
const goal = 'frequency-response-foundations';
const pathId = 'issue1324-active-path';
const batchId = 'issue1324-candidate-batch';
const activeHref = `/assessment/adaptive-practice?goal=${goal}&pathId=${pathId}`;
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const generator = 'artifacts/commercial-ui/issue-1324-adaptive-path-context/capture-evidence.mjs';
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/assessment/__tests__/adaptive-practice-page.test.ts',
  'tests/adaptive-path-active-context.spec.ts',
  generator,
];
const writeEvidence = process.env.ISSUE_1324_WRITE_EVIDENCE !== '0';
config({ path: path.join(repoRoot, '.env'), quiet: true });

const sessionFixture = {
  user: {
    id: 'demo-student',
    name: 'Issue 1324 Evidence Student',
    email: 'issue1324-evidence@example.invalid',
    role: 'TEACHER',
  },
  expires: '2099-01-01T00:00:00.000Z',
};

const nodeSummary = {
  nodeId: 'issue1324-foundation',
  title: '复习频率响应基础',
  pathNodeType: 'knowledge_card',
  displayName: '知识卡',
  iconKey: 'knowledge_card',
  shapeHint: 'rounded',
  evidenceBehavior: 'instrumented',
  evidenceStatus: 'instrumented',
  estimatedTimeMinutes: 18,
  status: 'current',
};

const pathNode = {
  ...nodeSummary,
  type: 'knowledge_card',
  externalResource: null,
  checkpoint: null,
  sourceKind: 'knowledge_card',
  sourceRef: 'issue1324-foundation',
  target: '/assessment/adaptive-practice',
  prerequisiteNodeIds: [],
  knowledgeCoverage: ['frequency-response'],
  terminalConstraints: [],
  teacherPolicy: 'default',
  privacyLevel: 'learner-private',
  readiness: { state: 'ready', message: '可以开始', reasonCodes: [] },
  reasonCodes: [],
};

const pathRound = {
  id: pathId,
  userId: 'demo-student',
  title: '频率响应基础学习路径',
  goalId: goal,
  pathStatus: 'active',
  currentNodeId: pathNode.nodeId,
  pathPayload: {
    policyFamily: 'foundation-remediation',
    planNodes: [pathNode],
    alternatives: [],
    executionStatus: { adopted: true, completedNodeIds: [], activeNodeId: pathNode.nodeId, updatedAt: '2026-08-10T00:00:00.000Z' },
    score: { total: 0.8, objectives: { learningGain: 0.8, engagement: 0.7, constraintSatisfaction: 0.9, diversity: 0.2, fatigue: 0.1 } },
    confidence: { level: 'medium', score: 0.7, sourceCoverage: 0.6 },
    explanations: { selectedReasons: ['matches-goal'], rejectedAlternatives: [], fallbackReasons: [] },
    deviations: [],
    corrections: [],
    feedbackEvents: [],
    visualization: {},
  },
  explanationPayload: {},
  alternativePayload: [],
};

const learnerState = {
  userId: 'demo-student',
  payloadVersion: 'adaptive-learner-state.v1',
  generatedAt: '2026-08-10T00:00:00.000Z',
  authority: 'server-owned',
  roleScope: { role: 'student', classId: null, privacyScopes: ['student-visible'] },
  clientHints: { received: false, authoritative: false, reason: 'client-hints-non-authoritative' },
  primaryCompetencies: { authority: 'legacy-compatibility-only', source: 'fallback-empty', vector: {} },
  secondaryDimensions: {},
  pathContext: { activePathCount: 1, bookmarkedPathCount: 0, recentPathIds: [pathId], activeControlCorrectionPath: { state: 'active', pathId, status: 'active', currentNodeId: pathNode.nodeId } },
  evidence: { readState: 'ready', confidence: { level: 'low', score: 0.4, evidenceCount: 1, sourceCompleteness: 0.2 }, sourceCounts: {}, sourceCoverage: {}, evidenceWindow: {} },
  knowledgeMastery: { coverage: 'partial', tags: {} },
  resourcePreference: { preferredModalities: [], sourceCounts: {}, confidence: 'low' },
  mediaAbsorption: { mediaFactCount: 0, averageCompletion: 0, confidence: 'low' },
  risks: { riskLevel: 'low', activeFlags: [] },
  assessmentState: {},
  prerequisiteFeatureGroups: { simulationArena: { available: false }, pathExecution: null },
  fieldContracts: {},
  missingEvidence: [],
};

const candidateBatch = {
  id: batchId,
  userId: 'demo-student',
  goalId: goal,
  classId: null,
  generationRequestId: 'issue1324-generation-request',
  sourcePathId: pathId,
  plannerVersion: 'fixture',
  status: 'succeeded',
  createdAt: '2026-08-10T00:00:00.000Z',
  candidates: [{
    id: 'issue1324-candidate',
    ordinal: 0,
    styleId: 'foundation-remediation',
    policyFamily: 'foundation-remediation',
    label: '基础补强候选',
    snapshot: {
      optionId: 'issue1324-option',
      styleId: 'foundation-remediation',
      label: '基础补强候选',
      nodeIds: [pathNode.nodeId],
      activeNodeIds: [pathNode.nodeId],
      nodeSummaries: [nodeSummary],
      lockedNodeIds: [],
      readinessSummary: [],
      targetDeficits: [],
      evidenceBasis: ['当前学习目标'],
      resourceMix: { knowledge_card: 1 },
      effort: { estimatedMinutes: 18, relative: 'short' },
      terminalValidationNodeIds: [],
      terminalValidationStrategy: { summary: '完成检查点后更新路径' },
      expectedTargetLift: 0.5,
      limitations: [],
    },
  }],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256(filePath) {
  const response = await import('node:fs/promises');
  const bytes = await response.readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

async function captureScreenshot(page, relativePath) {
  const image = await page.screenshot({
    ...(writeEvidence ? { path: path.join(repoRoot, relativePath) } : {}),
    fullPage: true,
  });
  return createHash('sha256').update(image).digest('hex');
}

async function addLocalSession(context) {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  assert(secret, 'NEXTAUTH_SECRET or AUTH_SECRET is required for local evidence capture');
  const token = await encode({
    secret,
    maxAge: 60 * 60,
    token: {
      id: sessionFixture.user.id,
      sub: sessionFixture.user.id,
      name: sessionFixture.user.name,
      email: sessionFixture.user.email,
      role: sessionFixture.user.role,
    },
  });
  assert(await decode({ token, secret }), 'locally encoded session token could not be decoded');
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    url: baseUrl,
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}

async function geometry(page) {
  return page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    actionLinks: Array.from(document.querySelectorAll('[data-adaptive-path-action-bar="active"] a')).map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent?.trim(), width: rect.width, height: rect.height, right: rect.right };
    }),
  }));
}

async function main() {
  if (writeEvidence) await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await addLocalSession(context);
    const sessionProbe = await context.request.get(`${baseUrl}/api/auth/session`);
    const sessionPayload = await sessionProbe.json();
    assert(sessionProbe.ok() && sessionPayload?.user?.id === sessionFixture.user.id, 'local evidence session was not accepted');
    console.log(`evidence: session ${sessionProbe.status()} role=${sessionPayload.user.role}`);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', (error) => console.error(`evidence: page error ${error.stack ?? error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`evidence: console error ${message.text()}`);
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/')) console.log(`evidence: api ${response.status()} ${response.url()}`);
    });
    const pathRequests = [];
    let generationRequest = null;
    await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessionFixture) }));
    await page.route('**/api/assessment/diagnostic', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.route('**/api/assessment/next-question', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.route('**/api/ai/sessions', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversations: [] }) });
      }
      return route.fallback();
    });
    await page.route('**/api/adaptive/learner-state?goal=frequency-response-foundations', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(learnerState) }));
    await page.route('**/api/adaptive/path-advisor-context?goal=frequency-response-foundations', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ goalId: goal, classId: null, modeContextToken: 'issue1324-context-token', courseTitle: '频率响应基础', topic: '频率响应基础学习路径', learningObjectives: ['建立频率响应基础'], quickPrompts: [] }) }));
    await page.route(`**/api/learning-paths/${pathId}*`, (route) => { pathRequests.push(pathId); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ path: pathRound }) }); });
    await page.route(`**/api/learning-paths/candidate-batches/${batchId}*`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ batch: candidateBatch }) }));
    await page.route('**/api/learning-paths/candidate-batches/latest?goal=frequency-response-foundations', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ batch: candidateBatch }) }));
    await page.route('**/api/adaptive/path-advisor-tool', async (route) => {
      generationRequest = await route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agentSessionId: 'issue1324-agent-session', result: { generationStatus: 'succeeded', candidateBatch: { id: batchId } } }) });
    });

  console.log('evidence: starting responsive scenarios');
  const results = [];
  for (const width of [1440, 320]) {
    console.log(`evidence: active path ${width}`);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${baseUrl}${activeHref}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    console.log(`evidence: route ${page.url()} body ${(await page.locator('body').innerText()).slice(0, 600)}`);
    await page.locator('[data-adaptive-path-action-bar="active"]').waitFor({ state: 'visible', timeout: 10000 });
    const newPath = page.getByRole('link', { name: '新建学习路径', exact: true });
    const continuePath = page.getByRole('link', { name: '继续当前路径', exact: true });
    const newPathUrl = new URL(await newPath.getAttribute('href'), baseUrl);
    await newPath.focus();
    const activeFocus = await page.evaluate((element) => document.activeElement === element, await newPath.elementHandle());
    const surface = await geometry(page);
    const screenshot = `artifacts/commercial-ui/issue-1324-adaptive-path-context/active-path-${width}.png`;
    results.push({ name: `active-path-${width}`, viewport: { width, height: 1000 }, screenshot, screenshotSha256: await captureScreenshot(page, screenshot), url: page.url(), pathContext: { goal: newPathUrl.searchParams.get('goal'), intent: newPathUrl.searchParams.get('intent'), pathId: newPathUrl.searchParams.get('pathId'), continueHref: await continuePath.getAttribute('href') }, keyboardFocus: activeFocus, geometry: surface });

    await newPath.click();
    console.log(`evidence: generation route ${width}`);
    await page.locator('[data-adaptive-path-generation-panel="editable"]').waitFor({ state: 'visible', timeout: 30000 });
    const selectedGoal = await page.locator('select').first().inputValue();
    assert(selectedGoal === goal, `generation panel goal mismatch at ${width}px: ${selectedGoal}`);
    assert(new URL(page.url()).searchParams.get('pathId') === pathId, `generation route lost pathId at ${width}px`);
    if (width === 1440) {
      const submit = page.locator('[data-adaptive-path-generation-action="submit-panel-request"]');
      await submit.waitFor({ state: 'visible', timeout: 30000 });
      await submit.click();
      await page.waitForTimeout(700);
      console.log('evidence: generation response checked');
      assert(generationRequest?.goalId === goal, 'generation request lost non-default goal');
      assert(generationRequest?.pathId === undefined, 'generate request attempted to replace current path');
      assert(new URL(page.url()).searchParams.get('pathId') === pathId, 'generation changed current path URL');
      assert(pathRequests.length >= 2 && pathRequests.every((item) => item === pathId), 'generation refresh did not preserve current path');
    }
    const generationScreenshot = `artifacts/commercial-ui/issue-1324-adaptive-path-context/generation-${width}.png`;
    results.push({ name: `generation-${width}`, viewport: { width, height: 1000 }, screenshot: generationScreenshot, screenshotSha256: await captureScreenshot(page, generationScreenshot), url: page.url(), selectedGoal, pathId: new URL(page.url()).searchParams.get('pathId'), geometry: await geometry(page) });
  }
    const expectedContinueHref = `/assessment/adaptive-practice?goal=${goal}&intent=path-execution&pathId=${pathId}&nodeId=${pathNode.nodeId}`;
    const assertions = {
      nonDefaultGoalPreserved: generationRequest?.goalId === goal,
      sourcePathPreserved: generationRequest?.pathId === undefined && pathRequests.length >= 2 && pathRequests.every((item) => item === pathId),
      continueActionPreservesPathAndNode: results.filter((result) => result.pathContext).every((result) => result.pathContext.continueHref === expectedContinueHref),
      activePathAndGenerationRoutesReachable: results.length === 4,
      responsiveAndKeyboardChecksPassed: results.every((result) => !result.geometry.horizontalOverflow) && results.filter((result) => result.pathContext).every((result) => result.keyboardFocus),
    };
    const failedAssertions = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);
    const sourceSha256 = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, await sha256(path.join(repoRoot, file))])));
    const manifest = {
      schemaVersion: 'commercial-ui-evidence.v1',
      status: failedAssertions.length === 0 ? 'passed' : 'blocked',
      capturedAt: new Date().toISOString(),
      sourceRevision,
      generator,
      generatorSha256: sourceSha256[generator],
      sourceSha256,
      baseUrl,
      backendE2EStatus: 'blocked-by-local-schema-drift',
      projectionFixtureEvidence: {
        status: 'ui-projection-only',
        note: 'Playwright route fulfillment exercises the real current-head page and routing state. The local StudentProfile schema drift blocks student-session enrichment, so this is not backend, authorization, or production E2E evidence.',
      },
      environmentOperations: {
        scope: 'local-only',
        routeFulfillment: true,
        authFixtureRole: sessionFixture.user.role,
        authFixtureReason: 'Avoid the unrelated StudentProfile enrichment failure while exercising the student-facing page projection.',
        remoteOrProductionMutation: false,
      },
      assertions,
      failedAssertions,
      results,
    };
    if (writeEvidence) {
      await writeFile(path.join(outputDir, 'evidence-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    }
    if (manifest.status !== 'passed') throw new Error(`Issue #1324 evidence failed closed: ${failedAssertions.join(', ')}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 2; });
