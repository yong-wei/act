import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const evidenceRoot = 'artifacts/commercial-ui/issue-1429-candidate-comparison';
const outputDir = path.join(repoRoot, evidenceRoot);
const baseUrl = process.env.ADAPTIVE_PATH_EVIDENCE_BASE_URL ?? 'http://127.0.0.1:3002';
const generator = `${evidenceRoot}/capture-evidence.mjs`;
const testFile = 'tests/adaptive-path-candidate-comparison-1429.spec.ts';
const sourceFiles = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/app/api/adaptive/path-advisor-tool/route.ts',
  'src/lib/adaptive-path-comparison.ts',
  'src/lib/konling-agent-runtime.ts',
  testFile,
  generator,
];
const screenshotDefinitions = [
  {
    file: `${evidenceRoot}/candidate-comparison-1440.png`,
    viewport: { width: 1440, height: 1000 },
  },
  {
    file: `${evidenceRoot}/candidate-comparison-320.png`,
    viewport: { width: 320, height: 900 },
  },
];
const sourceRevision = git(['rev-parse', 'HEAD']);
const initialSourceHashes = Object.fromEntries(sourceFiles.map((file) => [file, sha256FileAtRevision(file)]));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256FileAtRevision(file) {
  return sha256(execFileSync('git', ['show', `${sourceRevision}:${file}`], { cwd: repoRoot }));
}

async function assertSourceCheckpointStable(stage) {
  assert(git(['rev-parse', 'HEAD']) === sourceRevision, `${stage}: HEAD changed during capture`);
  const sourceStatus = git(['status', '--porcelain', '--', ...sourceFiles]);
  assert(sourceStatus === '', `${stage}: bound source files are not clean: ${sourceStatus}`);
}

function readPngDimensions(bytes) {
  const pngSignature = '89504e470d0a1a0a';
  assert(bytes.subarray(0, 8).toString('hex') === pngSignature, 'evidence file is not a PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

async function main() {
  await assertSourceCheckpointStable('capture start');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const playwright = spawnSync(
    npx,
    [
      'playwright',
      'test',
      testFile,
      '--workers=1',
      '--reporter=line',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: baseUrl,
        PLAYWRIGHT_SKIP_WEB_SERVER: '1',
        ISSUE_1429_WRITE_EVIDENCE: '1',
      },
    },
  );
  process.stdout.write(playwright.stdout ?? '');
  process.stderr.write(playwright.stderr ?? '');
  assert(playwright.status === 0, `Playwright evidence capture failed with status ${playwright.status}`);

  const screenshots = [];
  for (const definition of screenshotDefinitions) {
    const bytes = await readFile(path.join(repoRoot, definition.file));
    const dimensions = readPngDimensions(bytes);
    assert(
      dimensions.width === definition.viewport.width,
      `${definition.file}: expected ${definition.viewport.width}px width, received ${dimensions.width}px`,
    );
    assert(
      dimensions.height >= definition.viewport.height,
      `${definition.file}: full-page height ${dimensions.height}px is shorter than the viewport`,
    );
    screenshots.push({
      screenshot: definition.file,
      viewport: definition.viewport,
      dimensions,
      sha256: sha256(bytes),
    });
  }

  await assertSourceCheckpointStable('capture completion');
  const manifest = {
    schemaVersion: 'commercial-ui-evidence.v1',
    status: 'passed',
    capturedAt: new Date().toISOString(),
    sourceRevision,
    route: '/assessment/adaptive-practice?goal=control-correction&intent=path-selection&batch=candidate-comparison-batch-1429',
    generator,
    generatorSha256: initialSourceHashes[generator],
    sourceSha256: initialSourceHashes,
    baseUrl,
    browserEvidence: {
      authenticatedSession: 'real NextAuth credentials callback using the seeded demo student',
      candidateProjection: 'deterministic route fixtures exercised against the current-head page',
      backendAuthorizationEvidence: 'covered by targeted route and Konling runtime tests',
    },
    assertions: {
      candidateSummaryVisible: true,
      pairSelectorAndResultVisible: true,
      keyboardFocusVisible: true,
      allThreePairsVerified: true,
      staleResponseRejected: true,
      noHorizontalOverflowAt1440: true,
      noHorizontalOverflowAt320: true,
      readOnlyComparison: true,
    },
    failedAssertions: [],
    screenshots,
    drift: {
      failClosed: true,
      cleanCaptureStart: true,
      headUnchanged: true,
      boundSourcesUnchanged: true,
      sourceRevisionRequired: true,
      allowedOutputPaths: [
        `${evidenceRoot}/evidence-manifest.json`,
        ...screenshotDefinitions.map(({ file }) => file),
      ],
    },
  };
  await writeFile(
    path.join(outputDir, 'evidence-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
