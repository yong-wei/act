import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const outputDir = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const baseUrl = process.env.ADAPTIVE_PATH_EVIDENCE_BASE_URL ?? 'http://127.0.0.1:3003';
const route = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&pathId=adaptive-path%3Acmma7hfvd0061g9q2jqfd291i%3Acontrol-correction&nodeId=registry%3Alesson13-cruise-bridge';
const sourceFiles = [
  'src/features/adaptive/adaptive-path-journey-contracts.ts',
  'src/lib/__tests__/adaptive-path-journey-contracts.test.ts',
  'artifacts/commercial-ui/issue-1357-path-return/capture-evidence.mjs',
];

function git(...args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

async function captureSourceSnapshot(phase) {
  const sourceRevision = git('rev-parse', 'HEAD');
  const trackedChanges = git('status', '--porcelain', '--', ...sourceFiles);
  if (trackedChanges) {
    throw new Error(`${phase}: evidence source files must be clean before capture\n${trackedChanges}`);
  }

  const files = await Promise.all(sourceFiles.map(async (file) => ({
    file,
    gitBlobId: git('rev-parse', `${sourceRevision}:${file}`),
    sha256: createHash('sha256').update(await readFile(`${repositoryRoot}/${file}`)).digest('hex'),
  })));
  return { sourceRevision, files };
}

function assertSameSourceSnapshot(start, end, phase) {
  if (end.sourceRevision !== start.sourceRevision) {
    throw new Error(`${phase}: HEAD changed during evidence capture`);
  }
  if (JSON.stringify(end.files) !== JSON.stringify(start.files)) {
    throw new Error(`${phase}: evidence source files changed during capture`);
  }
}

const sourceSnapshot = await captureSourceSnapshot('capture start');

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const returnLink = page.getByRole('link', { name: '返回学习路径', exact: true });
    const count = await returnLink.count();
    const href = await returnLink.getAttribute('href');
    const expectedHref = '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=adaptive-path%3Acmma7hfvd0061g9q2jqfd291i%3Acontrol-correction';
    if (count !== 1 || href !== expectedHref) {
      throw new Error(`unexpected return action at ${width}px: count=${count}, href=${href}`);
    }
    await returnLink.click();
    await page.waitForURL(`${baseUrl}${expectedHref}`, { timeout: 10000 });
    await page.waitForTimeout(1000);
    const landingIntent = await page.locator('[data-adaptive-path-workspace-intent]').getAttribute('data-adaptive-path-workspace-intent');
    const scroll = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    if (landingIntent !== 'execution' || scroll.horizontalOverflow) throw new Error(`overview assertion failed at ${width}px`);
    const screenshot = `path-overview-${width}.png`;
    const bytes = await page.screenshot({ path: `${outputDir}/${screenshot}`, fullPage: true });
    results.push({ width, route, returnActionCount: count, returnHref: href, landingUrl: page.url(), landingIntent, screenshot, screenshotSha256: createHash('sha256').update(bytes).digest('hex'), scroll });
    await page.close();
  }
} finally {
  await browser.close();
}

const finalSourceSnapshot = await captureSourceSnapshot('capture end');
assertSameSourceSnapshot(sourceSnapshot, finalSourceSnapshot, 'capture end');
await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/evidence-manifest.json`, `${JSON.stringify({
  schemaVersion: 'commercial-ui-evidence.v1',
  status: 'passed',
  capturedAt: new Date().toISOString(),
  sourceRevision: sourceSnapshot.sourceRevision,
  sourceFiles: sourceSnapshot.files,
  baseUrl,
  route,
  provenance: 'local-only Playwright projection and routing evidence; no remote or production mutation; capture fails closed when HEAD or tracked evidence sources change',
  assertions: { oneReturnAction: true, returnToCurrentPathOverview: true, nodeIdRemovedAfterClick: true, pathContextPreserved: true, responsiveNoHorizontalOverflow: true },
  results,
}, null, 2)}\n`);
