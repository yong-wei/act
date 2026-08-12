import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const outputDir = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const baseUrl = process.env.ADAPTIVE_PATH_EVIDENCE_BASE_URL ?? 'http://127.0.0.1:3003';
const route = '/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-execution&pathId=adaptive-path%3Acmma7hfvd0061g9q2jqfd291i%3Acontrol-correction&nodeId=registry%3Alesson13-cruise-bridge';
const revisionSourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/components/platform/app-shell.tsx',
  'src/components/shared/page-floating-controls.tsx',
  'scripts/tests/capture-adaptive-path-product-qa.ts',
  'src/lib/commercial-ui-capture-revision.ts',
  'src/app/api/internal/local-qa/revision/route.ts',
];
const sourceFiles = [
  ...revisionSourceFiles,
  'src/features/adaptive/adaptive-path-journey-contracts.ts',
  'src/features/adaptive/adaptive-path-journey-control.tsx',
  'src/lib/__tests__/adaptive-path-journey-contracts.test.ts',
  'src/lib/__tests__/adaptive-path-journey-control.test.ts',
  'artifacts/commercial-ui/issue-1357-path-return/capture-evidence.mjs',
];
const revisionProbePath = '/api/internal/local-qa/revision';

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

function sourceFingerprint(filePaths) {
  const hash = createHash('sha256');
  for (const file of [...filePaths].sort()) {
    hash.update(file);
    hash.update('\0');
    hash.update(readFileSync(`${repositoryRoot}/${file}`));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function localRevisionProof(snapshot) {
  return {
    commitSha: snapshot.sourceRevision,
    treeSha: git('rev-parse', 'HEAD^{tree}'),
    sourceFingerprint: sourceFingerprint(revisionSourceFiles),
    clean: git('status', '--porcelain', '--untracked-files=all', '--', ...sourceFiles) === '',
  };
}

function sourceFingerprintAtRevision(revision) {
  const hash = createHash('sha256');
  for (const file of [...revisionSourceFiles].sort()) {
    hash.update(file);
    hash.update('\0');
    hash.update(execFileSync('git', ['show', `${revision}:${file}`], { cwd: repositoryRoot }));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function assertRevisionProofMatches(expected, actual, phase) {
  if (!actual || actual.clean !== true) throw new Error(`${phase}: target service reported a dirty revision`);
  for (const field of ['commitSha', 'treeSha', 'sourceFingerprint']) {
    if (actual[field] !== expected[field]) {
      throw new Error(`${phase}: service ${field} mismatch; expected=${expected[field]} actual=${actual[field]}`);
    }
  }
}

async function fetchRevisionProof() {
  const response = await fetch(new URL(revisionProbePath, `${baseUrl}/`), {
    cache: 'no-store',
    redirect: 'manual',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`revision probe failed: HTTP ${response.status}`);
  const proof = await response.json();
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) throw new Error('revision probe returned malformed JSON');
  return proof;
}

const sourceSnapshot = await captureSourceSnapshot('capture start');
const localProof = localRevisionProof(sourceSnapshot);
if (localProof.sourceFingerprint !== sourceFingerprintAtRevision(sourceSnapshot.sourceRevision)) {
  throw new Error('capture start: local runtime source fingerprint differs from committed revision');
}
const initialServiceProof = await fetchRevisionProof();
assertRevisionProofMatches(localProof, initialServiceProof, 'capture start');

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
    const bytes = await page.screenshot({ fullPage: true });
    results.push({ width, route, returnActionCount: count, returnHref: href, landingUrl: page.url(), landingIntent, screenshot, screenshotSha256: createHash('sha256').update(bytes).digest('hex'), screenshotBytes: bytes.toString('base64'), scroll });
    await page.close();
  }
} finally {
  await browser.close();
}

const finalSourceSnapshot = await captureSourceSnapshot('capture end');
assertSameSourceSnapshot(sourceSnapshot, finalSourceSnapshot, 'capture end');
const finalLocalProof = localRevisionProof(finalSourceSnapshot);
const finalServiceProof = await fetchRevisionProof();
assertRevisionProofMatches(finalLocalProof, finalServiceProof, 'capture end');
await mkdir(outputDir, { recursive: true });
for (const result of results) {
  await writeFile(`${outputDir}/${result.screenshot}`, Buffer.from(result.screenshotBytes, 'base64'));
  delete result.screenshotBytes;
}
await writeFile(`${outputDir}/evidence-manifest.json`, `${JSON.stringify({
  schemaVersion: 'commercial-ui-evidence.v1',
  status: 'passed',
  capturedAt: new Date().toISOString(),
  sourceRevision: sourceSnapshot.sourceRevision,
  treeSha: localProof.treeSha,
  sourceFingerprint: localProof.sourceFingerprint,
  serviceRevisionProof: finalServiceProof,
  sourceFiles: sourceSnapshot.files,
  baseUrl,
  route,
  provenance: 'local-only Playwright projection and routing evidence; no remote or production mutation; capture fails closed when HEAD or tracked evidence sources change',
  assertions: { oneReturnAction: true, returnToCurrentPathOverview: true, nodeIdRemovedAfterClick: true, pathContextPreserved: true, responsiveNoHorizontalOverflow: true },
  results,
}, null, 2)}\n`);
