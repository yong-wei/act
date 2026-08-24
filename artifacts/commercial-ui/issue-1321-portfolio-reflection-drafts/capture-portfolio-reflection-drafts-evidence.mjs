import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');
const outputDirectory = scriptDirectory;
const outputRelativePaths = new Set([
  'artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/browser-evidence.json',
  'artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/portfolio-reflection-draft-1440.png',
  'artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/portfolio-reflection-draft-320.png',
]);
const boundInputs = [
  'artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/capture-portfolio-reflection-drafts-evidence.mjs',
  'tests/portfolio-reflection-drafts-1321.spec.ts',
  'src/app/(main)/profile/portfolio/page.tsx',
  'src/app/api/profile/portfolio-reflection-drafts/route.ts',
  'src/app/api/profile/portfolio-reflection-drafts/[draftId]/route.ts',
  'src/lib/ai-task-boundary-contracts.ts',
];

function git(args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

function statusPaths() {
  const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  return output.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
}

async function sourceHashes() {
  return Object.fromEntries(await Promise.all(boundInputs.map(async (input) => {
    const bytes = await readFile(join(repositoryRoot, input));
    return [input, createHash('sha256').update(bytes).digest('hex')];
  })));
}

async function sha256(relativePath) {
  const bytes = await readFile(join(repositoryRoot, relativePath));
  return createHash('sha256').update(bytes).digest('hex');
}

async function pngDimensions(relativePath) {
  const bytes = await readFile(join(repositoryRoot, relativePath));
  assert.equal(bytes.readUInt32BE(0), 0x89504e47, `${relativePath} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const captureRevision = git(['rev-parse', 'HEAD']);
const initialStatus = statusPaths();
assert.deepEqual(initialStatus, [], 'Commercial UI capture must start from a clean worktree');
const initialSourceHashes = await sourceHashes();

await mkdir(outputDirectory, { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(npx, ['playwright', 'test', 'tests/portfolio-reflection-drafts-1321.spec.ts', '--workers=1'], {
  cwd: repositoryRoot,
  shell: true,
  env: {
    ...process.env,
    PLAYWRIGHT_PORT: '3200',
    PORTFOLIO_REFLECTION_DRAFT_EVIDENCE_DIR: outputDirectory,
  },
  stdio: 'inherit',
});

assert.equal(git(['rev-parse', 'HEAD']), captureRevision, 'Capture changed Git HEAD');
assert.deepEqual(await sourceHashes(), initialSourceHashes, 'Capture changed a bound source file');

const screenshots = [
  'artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/portfolio-reflection-draft-1440.png',
  'artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/portfolio-reflection-draft-320.png',
];
const screenshotEvidence = await Promise.all(screenshots.map(async (screenshot, index) => ({
  screenshot,
  viewport: index === 0 ? { width: 1440, height: 1000 } : { width: 320, height: 900 },
  sha256: await sha256(screenshot),
  dimensions: await pngDimensions(screenshot),
})));

await writeFile(join(outputDirectory, 'browser-evidence.json'), JSON.stringify({
  change: 'persist-portfolio-reflection-drafts',
  capturedAt: new Date().toISOString(),
  captureRevision,
  generator: 'artifacts/commercial-ui/issue-1321-portfolio-reflection-drafts/capture-portfolio-reflection-drafts-evidence.mjs',
  sourceHashes: initialSourceHashes,
  route: '/profile/portfolio?category=reflection&intent=create&source=portfolio&taskIntent=create-portfolio-reflection',
  screenshots: screenshotEvidence,
  assertions: [
    'desktop save, edit, and reopen state captured',
    '320px reopened draft captured and discard asserted by the Playwright test',
    'keyboard focus and no horizontal overflow asserted by the Playwright test',
  ],
  drift: {
    cleanCaptureStart: true,
    headUnchanged: true,
    boundSourcesUnchanged: true,
    allowedOutputPaths: [...outputRelativePaths].sort(),
  },
}, null, 2));

const unexpectedPaths = statusPaths().filter((path) => !outputRelativePaths.has(path));
assert.deepEqual(unexpectedPaths, [], `Capture created unexpected changed paths: ${unexpectedPaths.join(', ')}`);
assert.equal(await stat(join(outputDirectory, 'browser-evidence.json')).then(() => true), true);
console.log(`Portfolio reflection draft evidence captured at ${captureRevision}`);
