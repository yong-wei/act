import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const outputDir = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const baseUrl = process.env.ADAPTIVE_PATH_EVIDENCE_BASE_URL ?? 'http://localhost:3002';
const pathId = 'adaptive-path:cmma7hfvd0061g9q2jqfd291i:control-correction:candidate_0c39810885f0a7c9f8de713f';
const nodeId = 'registry:lesson13-cruise-bridge';
const executionReturnHref = `/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=${encodeURIComponent(pathId)}&nodeId=${encodeURIComponent(nodeId)}`;
const expectedReturnHref = '/assessment/adaptive-practice?goal=control-correction';
const resourceRoute = `/interactive-learning/resources/lesson13-cruise-bridge?${new URLSearchParams({
  demo: '1',
  source: 'adaptive-path-center',
  goal: 'control-correction',
  goalId: 'control-correction',
  pathId,
  nodeId,
  intent: 'path-execution',
  returnHref: executionReturnHref,
  resourceType: 'knowledge_card',
}).toString()}`;
const revisionProbePath = '/api/internal/local-qa/revision';
const sourceFiles = [
  'src/features/adaptive/adaptive-path-journey-control.tsx',
  'src/features/interactive/__tests__/adaptive-path-journey-control.client.test.tsx',
  'src/lib/__tests__/adaptive-path-journey-control.test.ts',
  'openspec/changes/fix-path-resource-return-center/specs/adaptive-learning-center-ui/spec.md',
  'src/lib/commercial-ui-capture-revision.ts',
  'src/app/api/internal/local-qa/revision/route.ts',
  'artifacts/commercial-ui/pr-1387-return-center/capture-evidence.mjs',
];

function git(...args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function captureSourceSnapshot(phase) {
  const status = git('status', '--porcelain', '--untracked-files=all');
  if (status) throw new Error(`${phase}: repository must be clean before capture\n${status}`);

  const sourceRevision = git('rev-parse', '--verify', 'HEAD^{commit}');
  const treeSha = git('rev-parse', '--verify', 'HEAD^{tree}');
  const files = await Promise.all(sourceFiles.map(async (file) => ({
    file,
    gitBlobId: git('rev-parse', `${sourceRevision}:${file}`),
    sha256: sha256(await readFile(path.join(repositoryRoot, file))),
  })));
  return { sourceRevision, treeSha, files };
}

function assertSameSourceSnapshot(start, end) {
  if (JSON.stringify(start) !== JSON.stringify(end)) {
    throw new Error('evidence source changed during capture');
  }
}

async function fetchRevisionProof() {
  const response = await fetch(new URL(revisionProbePath, `${baseUrl}/`), {
    cache: 'no-store',
    redirect: 'manual',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`revision probe failed: HTTP ${response.status}`);
  return response.json();
}

function assertRevisionProof(snapshot, proof, phase) {
  if (!proof || proof.clean !== true) throw new Error(`${phase}: target service reported a dirty revision`);
  if (proof.commitSha !== snapshot.sourceRevision || proof.treeSha !== snapshot.treeSha) {
    throw new Error(`${phase}: target service revision does not match the capture checkout`);
  }
}

function blockedJourney() {
  return {
    journey: {
      path: { id: pathId, title: '控制系统校正路径' },
      goal: { id: 'control-correction' },
      context: { pathId, goalId: 'control-correction', requestedNodeId: nodeId },
      current: { nodeId, title: '巡航控制桥接', type: 'knowledge_card' },
      progress: { completed: 1, total: 3 },
      return: { label: '返回学习路径', href: executionReturnHref },
      pathStatus: 'active',
      nextAction: {
        state: 'blocked',
        nodeId,
        title: '当前结果未通过路径验证',
        type: 'knowledge_card',
        href: null,
        reason: '当前结果未通过路径验证',
        recovery: { label: '恢复学习路径', href: executionReturnHref },
      },
    },
  };
}

const sourceSnapshot = await captureSourceSnapshot('capture start');
const initialServiceProof = await fetchRevisionProof();
assertRevisionProof(sourceSnapshot, initialServiceProof, 'capture start');

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1100 },
    { name: 'mobile-320', width: 320, height: 1200 },
  ]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const responseFailures = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        responseFailures.push({ status: response.status(), url: response.url() });
      }
    });
    await page.route('**/api/learning-paths/**/journey?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(blockedJourney()),
      });
    });
    await page.route('**/api/resources/lesson13-cruise-bridge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'lesson13-cruise-bridge',
          title: '巡航控制桥接',
          displayName: '巡航控制桥接',
          description: '学习路径返回控制验收资源',
          type: 'STATIC_TEXT',
          content: '# 巡航控制桥接\n\n此页面用于验证学习路径返回控制。',
          registryId: null,
          config: null,
          aiHints: null,
        }),
      });
    });
    await page.route('**/api/ai/sessions', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });

    await page.goto(`${baseUrl}${resourceRoute}`, { waitUntil: 'domcontentloaded' });
    const returnLink = page.getByRole('link', { name: '返回学习路径', exact: true });
    await returnLink.waitFor({ state: 'visible' });
    const returnActionCount = await returnLink.count();
    const returnHref = await returnLink.getAttribute('href');
    const recoveryActionCount = await page.getByRole('link', { name: '恢复学习路径', exact: true }).count();
    if (returnActionCount !== 1 || returnHref !== expectedReturnHref || recoveryActionCount !== 0) {
      throw new Error(`unexpected journey actions at ${viewport.width}px: return=${returnActionCount}, href=${returnHref}, recovery=${recoveryActionCount}`);
    }

    const resourceScreenshot = `resource-${viewport.name}.png`;
    const resourceBytes = await page.screenshot({ fullPage: true });
    await returnLink.click();
    await page.waitForURL(`${baseUrl}${expectedReturnHref}`, { timeout: 10000 });
    await page.waitForTimeout(500);
    const returnedUrl = page.url();
    const returned = new URL(returnedUrl);
    if (returned.searchParams.has('pathId') || returned.searchParams.has('nodeId') || returned.searchParams.has('intent') || returned.searchParams.has('batch')) {
      throw new Error(`execution or candidate parameters survived return at ${viewport.width}px`);
    }
    const centerScreenshot = `center-after-return-${viewport.name}.png`;
    const centerBytes = await page.screenshot({ fullPage: true });
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (horizontalOverflow) throw new Error(`horizontal overflow at ${viewport.width}px`);

    results.push({
      viewport,
      resourceUrl: `${baseUrl}${resourceRoute}`,
      returnActionCount,
      returnHref,
      recoveryActionCount,
      returnedUrl,
      horizontalOverflow,
      consoleErrors,
      responseFailures,
      resourceScreenshot,
      resourceScreenshotSha256: sha256(resourceBytes),
      resourceScreenshotBytes: resourceBytes.toString('base64'),
      centerScreenshot,
      centerScreenshotSha256: sha256(centerBytes),
      centerScreenshotBytes: centerBytes.toString('base64'),
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const finalSourceSnapshot = await captureSourceSnapshot('capture end');
assertSameSourceSnapshot(sourceSnapshot, finalSourceSnapshot);
const finalServiceProof = await fetchRevisionProof();
assertRevisionProof(finalSourceSnapshot, finalServiceProof, 'capture end');

await mkdir(outputDir, { recursive: true });
for (const result of results) {
  await writeFile(path.join(outputDir, result.resourceScreenshot), Buffer.from(result.resourceScreenshotBytes, 'base64'));
  await writeFile(path.join(outputDir, result.centerScreenshot), Buffer.from(result.centerScreenshotBytes, 'base64'));
  delete result.resourceScreenshotBytes;
  delete result.centerScreenshotBytes;
}
await writeFile(path.join(outputDir, 'return-flow-evidence.json'), `${JSON.stringify({
  schemaVersion: 'commercial-ui-evidence.v1',
  status: 'passed',
  capturedAt: new Date().toISOString(),
  sourceRevision: sourceSnapshot.sourceRevision,
  treeSha: sourceSnapshot.treeSha,
  serviceRevisionProof: finalServiceProof,
  sourceFiles: sourceSnapshot.files,
  baseUrl,
  flow: 'path execution -> blocked journey resource -> deduplicated return -> path center',
  fixtureBoundary: 'The resource body, blocked journey payload, and unauthenticated AI conversation list are deterministic browser fixtures; the journey-control rendering, return href, click navigation, and path-center landing are production code from the bound source revision.',
  assertions: {
    oneVisibleReturnAction: true,
    duplicateRecoverySuppressed: true,
    goalOnlyReturnHref: true,
    executionAndCandidateParametersCleared: true,
    responsiveNoHorizontalOverflow: true,
  },
  results,
}, null, 2)}\n`);
