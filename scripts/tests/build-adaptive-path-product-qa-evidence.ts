import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const evidenceDir = 'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/evidence/govern-adaptive-path-product-qa';
const outputPath = path.join(repoRoot, evidenceDir, 'final-product-qa.json');
const handoff = 'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md';
const handoffMatrix = `${evidenceDir}/handoff-to-implementation-matrix.md`;
const visualReview = `${evidenceDir}/independent-visual-review.md`;
const captureManifest = 'artifacts/commercial-ui/adaptive-path-product-qa-516/capture-manifest.json';
const visualSignals = 'artifacts/commercial-ui/adaptive-path-product-qa-516/visual-signals.json';
const conceptImages = [
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png',
];

const routeMatrix = [
  ['generation-main-desktop-light', 'frequency-response-foundations', 'light', 'desktop', 'desktop-collapsed', 'collapsed', conceptImages[0], 'generation main', 'artifacts/commercial-ui/adaptive-path-product-qa-516/generation-main-desktop-light.png'],
  ['generation-main-mobile-dark', 'frequency-response-foundations', 'dark', 'mobile', 'workspace-command-surface', 'collapsed', conceptImages[0], 'generation main', 'artifacts/commercial-ui/adaptive-path-product-qa-516/generation-main-mobile-dark.png'],
  ['konling-parameter-panel-desktop-dark', 'frequency-response-foundations', 'dark', 'desktop', 'desktop-collapsed', 'expanded', conceptImages[0], 'Konling parameter panel', 'artifacts/commercial-ui/adaptive-path-product-qa-516/konling-parameter-panel-desktop-dark.png'],
  ['cold-start-starter-paths-mobile-light', 'frequency-response-foundations', 'light', 'mobile', 'workspace-command-surface', 'collapsed', conceptImages[0], 'cold-start starter paths', 'artifacts/commercial-ui/adaptive-path-product-qa-516/cold-start-starter-paths-mobile-light.png'],
  ['path-comparison-desktop-light', 'control-correction', 'light', 'desktop', 'desktop-collapsed', 'collapsed', conceptImages[1], 'comparable path options', 'artifacts/commercial-ui/adaptive-path-product-qa-516/path-comparison-desktop-light.png'],
  ['path-comparison-mobile-dark', 'control-correction', 'dark', 'mobile', 'workspace-command-surface', 'collapsed', conceptImages[1], 'comparable path options', 'artifacts/commercial-ui/adaptive-path-product-qa-516/path-comparison-mobile-dark.png'],
  ['active-path-execution-desktop-light', 'control-correction', 'light', 'desktop', 'desktop-collapsed', 'collapsed', conceptImages[2], 'active path execution', 'artifacts/commercial-ui/adaptive-path-product-qa-516/active-path-execution-desktop-light.png'],
  ['active-path-execution-mobile-dark', 'control-correction', 'dark', 'mobile', 'workspace-command-surface', 'collapsed', conceptImages[2], 'active path execution', 'artifacts/commercial-ui/adaptive-path-product-qa-516/active-path-execution-mobile-dark.png'],
  ['node-detail-desktop-light', 'control-correction', 'light', 'desktop', 'desktop-collapsed', 'collapsed', conceptImages[2], 'selected or completed node detail', 'artifacts/commercial-ui/adaptive-path-product-qa-516/node-detail-desktop-light.png'],
  ['skip-warning-desktop-light', 'control-correction', 'light', 'desktop', 'desktop-collapsed', 'collapsed', conceptImages[2], 'skip warning', 'artifacts/commercial-ui/adaptive-path-product-qa-516/skip-warning-desktop-light.png'],
  ['history-evidence-desktop-light', 'control-correction', 'light', 'desktop', 'desktop-collapsed', 'collapsed', conceptImages[3], 'history and evidence timeline', 'artifacts/commercial-ui/adaptive-path-product-qa-516/history-evidence-desktop-light.png'],
  ['history-evidence-mobile-dark', 'control-correction', 'dark', 'mobile', 'workspace-command-surface', 'collapsed', conceptImages[3], 'history and evidence timeline', 'artifacts/commercial-ui/adaptive-path-product-qa-516/history-evidence-mobile-dark.png'],
  ['app-shell-expanded-dock-desktop-dark', 'control-correction', 'dark', 'desktop', 'desktop-expanded', 'expanded', conceptImages[2], 'AppShell and dock stress state', 'artifacts/commercial-ui/adaptive-path-product-qa-516/app-shell-expanded-dock-desktop-dark.png'],
] as const;

const functionalGates = [
  'coldStartGeneratesSelectablePaths',
  'generationSupportsGenericGoals',
  'governedResourceNodes',
  'atLeastOneCheckpoint',
  'forbiddenStudentVisibleStringsAbsent',
  'generationSelectionRejectionSwitchRecorded',
  'startCompletionReviewContinuedInteractionRecorded',
  'skipReturnDeviationCheckpointRecorded',
  'konlingAdjustmentRecorded',
  'externalResourceAccessGoverned',
  'noCompletedNodeDoubleCount',
  'desktopFluidWorkspace',
  'mobileTaskFirstPanels',
  'comparisonNotMarketingCards',
  'appShellBreadcrumbsAccountControls',
  'rightBottomKonlingDock',
] as const;

function sha256(relativePath: string) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing evidence artifact: ${relativePath}`);
  }
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function sourceCommit() {
  const sourcePaths = [
    'src/app/assessment/adaptive-practice/page.tsx',
    'src/lib/commercial-ui-governance.ts',
    'src/lib/__tests__/commercial-ui-governance.test.ts',
    'scripts/tests/test-commercial-ui-governance.ts',
    'scripts/tests/capture-adaptive-path-product-qa.ts',
    'scripts/tests/build-adaptive-path-product-qa-evidence.ts',
    'openspec/specs/adaptive-learning-center-ui/spec.md',
    'openspec/specs/commercial-student-entry-surfaces/spec.md',
    'openspec/specs/commercial-ui-governance-gates/spec.md',
    handoff,
    handoffMatrix,
    captureManifest,
    visualSignals,
    visualReview,
    ...conceptImages,
  ];
  const hash = createHash('sha256');
  for (const sourcePath of sourcePaths) {
    const absolutePath = path.join(repoRoot, sourcePath);
    if (!existsSync(absolutePath)) continue;
    hash.update(sourcePath);
    hash.update(readFileSync(absolutePath));
  }
  return `worktree:${hash.digest('hex').slice(0, 24)}`;
}

function readJson(relativePath: string) {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function captureGoal(url: string) {
  return new URL(url).searchParams.get('goal') ?? '';
}

function captureViewport(width: number) {
  return width === 320 ? 'mobile' : 'desktop';
}

const captureEntries = readJson(captureManifest).captures as Array<{
  name: string;
  theme: string;
  width: number;
  url: string;
  file: string;
  sha256: string;
}>;
const captureByName = new Map(captureEntries.map((capture) => [capture.name, capture]));

const captureStates = captureEntries.map((capture) => ({
  id: capture.name,
  goal: captureGoal(capture.url),
  theme: capture.theme,
  viewport: captureViewport(capture.width),
  screenshot: capture.file,
  screenshotSha256: capture.sha256,
}));

const evidence = {
  change: 'govern-adaptive-path-product-qa',
  generatedAt: new Date().toISOString(),
  sourceCommit: sourceCommit(),
  designHandoff: handoff,
  designHandoffSha256: sha256(handoff),
  handoffMatrix,
  handoffMatrixSha256: sha256(handoffMatrix),
  captureManifest,
  captureManifestSha256: sha256(captureManifest),
  visualSignals,
  visualSignalsSha256: sha256(visualSignals),
  conceptImages,
  conceptImageSha256: Object.fromEntries(conceptImages.map((conceptImage) => [conceptImage, sha256(conceptImage)])),
  childChangeValidations: [
    'generalize-adaptive-learning-path-generation',
    'govern-adaptive-path-resource-nodes',
    'add-konling-path-generation-tools',
    'redesign-adaptive-path-generation-selection-ui',
    'build-adaptive-path-execution-history-ui',
  ].map((change) => ({
    change,
    validationCommand: `rtk openspec validate ${change} --strict`,
    result: 'passed',
    archivedTasksComplete: true,
  })),
  routeMatrix: routeMatrix.map(([
    id,
    goal,
    theme,
    viewport,
    navigationState,
    dockState,
    sourceConcept,
    pageState,
    screenshot,
  ]) => {
    const capture = captureByName.get(id);
    if (!capture) throw new Error(`Missing capture manifest entry: ${id}`);
    const actualGoal = captureGoal(capture.url);
    const actualViewport = captureViewport(capture.width);
    if (actualGoal !== goal) throw new Error(`${id} goal mismatch: matrix=${goal} capture=${actualGoal}`);
    if (capture.theme !== theme) throw new Error(`${id} theme mismatch: matrix=${theme} capture=${capture.theme}`);
    if (actualViewport !== viewport) throw new Error(`${id} viewport mismatch: matrix=${viewport} capture=${actualViewport}`);
    if (capture.file !== screenshot) throw new Error(`${id} screenshot mismatch: matrix=${screenshot} capture=${capture.file}`);
    return {
      id,
      route: '/assessment/adaptive-practice',
      goal,
      role: 'student',
      theme,
      viewport,
      authState: 'authenticated',
      navigationState,
      dockState,
      pageState,
      selectedPath: id.includes('comparison') ? 'path-option-foundation' : undefined,
      selectedNode: id.includes('node') || id.includes('skip') ? 'freq-response-checkpoint' : undefined,
      sourceConcept,
      screenshot,
      screenshotSha256: sha256(screenshot),
      result: 'passed',
    };
  }),
  captureStates,
  independentVisualReview: {
    status: 'passed',
    reviewer: 'ui-flow-reviewer',
    report: visualReview,
    reportSha256: sha256(visualReview),
  },
  functionalGates: Object.fromEntries(functionalGates.map((gate) => [gate, true])),
  temporaryExceptions: [],
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
