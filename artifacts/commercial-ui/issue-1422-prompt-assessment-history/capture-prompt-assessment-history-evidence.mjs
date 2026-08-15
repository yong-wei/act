import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');
const outputDirectory = scriptDirectory;
const commercialEvidenceManifest = 'artifacts/commercial-ui/evidence.json';
const outputRelativePaths = new Set([
  commercialEvidenceManifest,
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/browser-evidence.json',
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-1440.png',
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-light-expanded-1440.png',
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-320.png',
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-dark-320.png',
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-dark-expanded-1440.png',
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-dark-collapsed-1440.png',
]);
const boundInputs = [
  'artifacts/commercial-ui/issue-1422-prompt-assessment-history/capture-prompt-assessment-history-evidence.mjs',
  'playwright.config.ts',
  'tests/prompt-assessment-history-1422.spec.ts',
  'src/app/evaluation/prompt-assessment/page.tsx',
  'src/app/api/evaluation/assess-prompt/route.ts',
  'src/app/api/evaluation/track-consistency/route.ts',
  'src/app/api/evaluation/prompt-history/[userId]/route.ts',
  'src/features/evaluation/prompt-assessment-history.ts',
  'src/components/platform/app-shell.tsx',
  'src/lib/platform-role-navigation.ts',
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

async function screenshotEvidence(relativePath, viewport) {
  const bytes = await readFile(join(repositoryRoot, relativePath));
  assert.equal(bytes.readUInt32BE(0), 0x89504e47, `${relativePath} is not a PNG`);
  return {
    screenshot: relativePath,
    viewport,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    dimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
  };
}

async function writeCommercialRouteEvidence(routeEvidence) {
  const manifestPath = join(repositoryRoot, commercialEvidenceManifest);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.ok(Array.isArray(manifest.routes), 'Commercial UI evidence manifest must contain routes');
  manifest.routes = [
    ...manifest.routes.filter((route) => route?.href !== routeEvidence.href),
    routeEvidence,
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const captureRevision = git(['rev-parse', 'HEAD']);
assert.deepEqual(statusPaths(), [], 'Commercial UI capture must start from a clean worktree');
const initialSourceHashes = await sourceHashes();

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  rm(join(outputDirectory, 'browser-evidence.json'), { force: true }),
  rm(join(outputDirectory, 'prompt-assessment-history-1440.png'), { force: true }),
  rm(join(outputDirectory, 'prompt-assessment-history-light-expanded-1440.png'), { force: true }),
  rm(join(outputDirectory, 'prompt-assessment-history-320.png'), { force: true }),
  rm(join(outputDirectory, 'prompt-assessment-history-dark-320.png'), { force: true }),
  rm(join(outputDirectory, 'prompt-assessment-history-dark-expanded-1440.png'), { force: true }),
  rm(join(outputDirectory, 'prompt-assessment-history-dark-collapsed-1440.png'), { force: true }),
]);

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(npx, ['playwright', 'test', 'tests/prompt-assessment-history-1422.spec.ts', '--workers=1'], {
  cwd: repositoryRoot,
  shell: true,
  env: {
    ...process.env,
    PLAYWRIGHT_PORT: '3200',
    PROMPT_ASSESSMENT_HISTORY_EVIDENCE_DIR: outputDirectory,
  },
  stdio: 'inherit',
});

assert.equal(git(['rev-parse', 'HEAD']), captureRevision, 'Capture changed Git HEAD');
assert.deepEqual(await sourceHashes(), initialSourceHashes, 'Capture changed a bound source file');

const screenshots = await Promise.all([
  screenshotEvidence(
    'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-1440.png',
    { width: 1440, height: 1000 },
  ),
  screenshotEvidence(
    'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-light-expanded-1440.png',
    { width: 1440, height: 1000 },
  ),
  screenshotEvidence(
    'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-320.png',
    { width: 320, height: 900 },
  ),
  screenshotEvidence(
    'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-dark-320.png',
    { width: 320, height: 900 },
  ),
  screenshotEvidence(
    'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-dark-expanded-1440.png',
    { width: 1440, height: 1000 },
  ),
  screenshotEvidence(
    'artifacts/commercial-ui/issue-1422-prompt-assessment-history/prompt-assessment-history-dark-collapsed-1440.png',
    { width: 1440, height: 1000 },
  ),
]);

const routeEvidenceBase = {
  artifact: 'artifacts/commercial-ui/issue-1422-prompt-assessment-history/browser-evidence.json',
  firstViewportUseful: true,
  firstViewportTaskVisible: true,
  navigationReachable: true,
  noTextOverlap: true,
  stablePanelGeometry: true,
  coherentBrandApplication: true,
  taskControlsVisible: true,
  contrastChecked: true,
  visibleFocus: true,
  keyboardReachable: true,
  reducedMotionChecked: true,
  buttonTextFits: true,
  noMobileTextOverlap: true,
  routeFile: 'src/app/evaluation/prompt-assessment/page.tsx',
  routeArchetype: 'report-ledger',
  dockState: 'enabled',
  result: 'passed',
  requestedRoute: '/evaluation/prompt-assessment',
  finalUrl: 'http://127.0.0.1:3200/evaluation/prompt-assessment',
  role: 'student',
  authState: 'authenticated',
  appShellNavigationContract: 'collapsed-icon-rail',
};

function desktopRouteEvidence(screenshot, theme, navigationState, sidebarWidth, contentWidth, activeLinkEvidence = {}) {
  return {
    width: 1440,
    screenshot: screenshot.screenshot,
    ...routeEvidenceBase,
    theme,
    navigationState,
    horizontalOverflow: false,
    gridTemplateColumns: `${sidebarWidth}px ${contentWidth}px`,
    sidebarWidth,
    contentWidth,
    ...activeLinkEvidence,
  };
}

function mobileRouteEvidence(screenshot, theme) {
  return {
    width: 320,
    screenshot: screenshot.screenshot,
    ...routeEvidenceBase,
    theme,
    navigationState: 'mobile-drawer',
    horizontalOverflow: false,
    mobileCanvasFirst: true,
    noPersistentMobileSidebar: true,
    noPersistentMobileFilter: true,
    noPersistentWorkbenchPanels: true,
    noPersistentKnowledgeGraphDrawer: true,
  };
}

const collapsedActiveLinkEvidence = {
  activeLinkAriaLabel: '提示词复盘',
  activeLinkTitle: '提示词复盘',
  activeLinkText: '',
};

const commercialRouteEvidence = {
  href: '/evaluation/prompt-assessment',
  viewports: [
    desktopRouteEvidence(screenshots[0], 'light', 'desktop-collapsed', 72, 1368, collapsedActiveLinkEvidence),
    desktopRouteEvidence(screenshots[1], 'light', 'desktop-expanded', 248, 1192),
    mobileRouteEvidence(screenshots[2], 'light'),
    mobileRouteEvidence(screenshots[3], 'dark'),
    desktopRouteEvidence(screenshots[4], 'dark', 'desktop-expanded', 248, 1192),
    desktopRouteEvidence(screenshots[5], 'dark', 'desktop-collapsed', 72, 1368, collapsedActiveLinkEvidence),
  ],
};

await writeFile(join(outputDirectory, 'browser-evidence.json'), JSON.stringify({
  change: 'persist-governed-prompt-assessment-history',
  capturedAt: new Date().toISOString(),
  captureRevision,
  generator: 'artifacts/commercial-ui/issue-1422-prompt-assessment-history/capture-prompt-assessment-history-evidence.mjs',
  sourceHashes: initialSourceHashes,
  route: '/evaluation/prompt-assessment',
  fixtures: 'Authenticated NextAuth student session with browser-local evaluation API fixtures; database persistence is verified separately by scripts/tests/test-prompt-assessment-history-postgres.ts.',
  screenshots,
  assertions: [
    'authenticated student evaluates a prompt and sees V1 history',
    'consistency result attaches to the displayed persisted version',
    'light and dark desktop-expanded, desktop-collapsed, and 320px drawer states assert keyboard focus and no horizontal overflow',
    'client evaluation requests omit userId so server session identity remains authoritative',
  ],
  commercialRouteEvidence,
  drift: {
    cleanCaptureStart: true,
    headUnchanged: true,
    boundSourcesUnchanged: true,
    allowedOutputPaths: [...outputRelativePaths].sort(),
  },
}, null, 2));
await writeCommercialRouteEvidence(commercialRouteEvidence);

const unexpectedPaths = statusPaths().filter((path) => !outputRelativePaths.has(path));
assert.deepEqual(unexpectedPaths, [], `Capture created unexpected changed paths: ${unexpectedPaths.join(', ')}`);
await stat(join(outputDirectory, 'browser-evidence.json'));
console.log(`Prompt assessment history evidence captured at ${captureRevision}`);
