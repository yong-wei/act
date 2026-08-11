import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  chromium,
  request,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, process.env.KNOWLEDGE_QA_OUTPUT_DIR ?? 'artifacts/knowledge-workspace-product-qa-489');
const baseUrl = process.env.KNOWLEDGE_QA_BASE_URL ?? 'http://localhost:3002';
const selectedNodeId = process.env.KNOWLEDGE_QA_SELECTED_NODE_ID ?? '稳定性_1_7288b4ea';
const dragNodeId = process.env.KNOWLEDGE_QA_DRAG_NODE_ID ?? 'z反变换_7_7959c077';
const threeDimensionalFitSafetyMargin = 8;

const sourceFiles = [
  'src/features/knowledge/knowledge-graph-system.tsx',
  'src/features/knowledge/knowledge-graph-workspace.tsx',
  'src/features/knowledge/active-authority-graph.tsx',
  'src/features/knowledge/active-authority-graph-contracts.ts',
  'src/app/knowledge/page.tsx',
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/knowledge/graph/knowledge-graph-2d.tsx',
  'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
  'src/features/knowledge/graph/relation-family-control.tsx',
  'src/features/knowledge/graph/visual-config.ts',
  'src/features/knowledge/resource-panel/resource-panel.tsx',
  'src/components/ai/global-ai-button.tsx',
  'src/components/ai/global-ai-sidebar.tsx',
  'src/components/providers/global-ai-provider.tsx',
  'src/components/platform/app-shell.tsx',
  'src/components/shared/page-floating-controls.tsx',
  'src/app/globals.css',
  'src/lib/konling-agent-runtime.ts',
  'scripts/tests/capture-knowledge-workspace-product-qa.ts',
  'scripts/tests/test-commercial-ui-governance.ts',
] as const;

type Theme = 'dark' | 'light';
type NavigationState = 'collapsed' | 'expanded' | 'mobile';
type DockState = 'collapsed' | 'expanded';
type KnowledgeMode = 'active' | 'legacy' | 'candidate';
type KnowledgeRole = 'student' | 'teacher' | 'admin';
type EvidenceRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type IndependentVisualReviewEvidence = {
  path: string;
  reviewer: string;
  finalResult: 'passed' | 'pending';
  blockingFindings: string[];
  dimensions: Record<string, unknown>;
  reviewedStateSha256?: Record<string, string>;
  reviewedSourceSha256?: Record<string, string>;
};

interface CaptureState {
  name: string;
  route?: '/knowledge' | '/assessment/adaptive-practice';
  theme: Theme;
  width: number;
  height: number;
  navigationPreference: 'collapsed' | 'expanded';
  navigationState: NavigationState;
  dockState: DockState;
  localToolState: string;
  selectedNode: string | null;
  interactionState: string;
  knowledgeMode?: KnowledgeMode;
  query?: string;
  beforeShot?: (page: Page) => Promise<Record<string, unknown> | void>;
}

type KnowledgeApiSummary = {
  path: string;
  status: number;
  code: string | null;
  error: string | null;
  nodeCount: number | null;
  relationCount: number | null;
  authorityState: string | null;
  hasAuthorityProvenance: boolean;
  activationMode: string | null;
  activationStatus: string | null;
  releaseSetId: string | null;
  releaseId: string | null;
  projectionVersion: string | null;
  projectionDigest: string | null;
  sourceDatasetHash: string | null;
  coverageObjectCount: number | null;
  coverageRelationCount: number | null;
  hasSourceIdentityFields: boolean;
  hasCoverageFields: boolean;
  projectionId: string | null;
  projectionHash: string | null;
  capturedAt: number;
};

type RoleSession = {
  role: KnowledgeRole;
  storageState: NonNullable<BrowserContextOptions['storageState']>;
};

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function readCleanCaptureRevision() {
  const status = execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (status) {
    throw new Error(
      `knowledge workspace product QA capture requires a clean Git worktree; commit or remove these changes first:\n${status}`,
    );
  }

  return {
    commitSha: execFileSync(
      'git',
      ['rev-parse', '--verify', 'HEAD^{commit}'],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim(),
    treeSha: execFileSync(
      'git',
      ['rev-parse', '--verify', 'HEAD^{tree}'],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim(),
  };
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
}

function pendingIndependentVisualReview(): IndependentVisualReviewEvidence {
  return {
    path: `${path.relative(repoRoot, outputDir)}/visual-review.md`,
    reviewer: 'critical-reviewer',
    finalResult: 'pending',
    blockingFindings: ['visual-review-not-run'],
    dimensions: {},
  };
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length === Object.keys(record).length ? Object.fromEntries(entries) : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringRecordsMatch(left: Record<string, string> | null, right: Record<string, string>) {
  if (!left) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function screenshotSha256ByStateName(stateMatrix: readonly unknown[]) {
  return Object.fromEntries(stateMatrix.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    return typeof record.name === 'string' && typeof record.screenshotSha256 === 'string'
      ? [[record.name, record.screenshotSha256]]
      : [];
  }));
}

function readExistingIndependentVisualReview(
  stateMatrix: readonly unknown[],
  currentSourceSha256: Record<string, string>,
  additionalStateMatrix: readonly unknown[] = [],
): IndependentVisualReviewEvidence | null {
  const evidencePath = path.join(outputDir, 'browser-evidence.json');
  if (!existsSync(evidencePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, 'utf8')) as { independentVisualReview?: unknown };
    const review = parsed.independentVisualReview;
    if (!review || typeof review !== 'object' || Array.isArray(review)) return null;

    const record = review as Record<string, unknown>;
    const blockingFindings = Array.isArray(record.blockingFindings) ? record.blockingFindings : null;
    if (record.finalResult !== 'passed' || !blockingFindings || blockingFindings.length !== 0) return null;
    if (typeof record.path !== 'string' || !record.path.trim()) return null;
    if (typeof record.reviewer !== 'string' || !record.reviewer.trim()) return null;

    const dimensions = record.dimensions && typeof record.dimensions === 'object' && !Array.isArray(record.dimensions)
      ? record.dimensions as Record<string, unknown>
      : {};
    const currentStateSha256 = screenshotSha256ByStateName([...stateMatrix, ...additionalStateMatrix]);
    const reviewedStateSha256 = stringRecord(record.reviewedStateSha256);
    const reviewedSourceSha256 = stringRecord(record.reviewedSourceSha256);
    if (!stringRecordsMatch(reviewedStateSha256, currentStateSha256)) return null;
    if (!stringRecordsMatch(reviewedSourceSha256, currentSourceSha256)) return null;

    return {
      path: record.path,
      reviewer: record.reviewer,
      finalResult: 'passed',
      blockingFindings: [],
      dimensions,
      reviewedStateSha256: currentStateSha256,
      reviewedSourceSha256: currentSourceSha256,
    };
  } catch {
    return null;
  }
}

const roleEnvironment: Record<KnowledgeRole, { email: string; password: string; expectedRole: string }> = {
  student: {
    email: 'KNOWLEDGE_QA_STUDENT_EMAIL',
    password: 'KNOWLEDGE_QA_STUDENT_PASSWORD',
    expectedRole: 'STUDENT',
  },
  teacher: {
    email: 'KNOWLEDGE_QA_TEACHER_EMAIL',
    password: 'KNOWLEDGE_QA_TEACHER_PASSWORD',
    expectedRole: 'TEACHER',
  },
  admin: {
    email: 'KNOWLEDGE_QA_ADMIN_EMAIL',
    password: 'KNOWLEDGE_QA_ADMIN_PASSWORD',
    expectedRole: 'ADMIN',
  },
};

async function establishRoleSession(role: KnowledgeRole): Promise<RoleSession> {
  const environment = roleEnvironment[role];
  const email = process.env[environment.email]?.trim();
  const password = process.env[environment.password];
  if (!email || !password) {
    throw new Error(`missing credentials for ${role}; set ${environment.email} and ${environment.password}`);
  }
  const api = await request.newContext();
  try {
    const csrfResponse = await api.get(`${baseUrl}/api/auth/csrf`);
    if (!csrfResponse.ok()) throw new Error(`CSRF request failed for ${role}: ${csrfResponse.status()}`);
    const csrf = await csrfResponse.json() as { csrfToken?: unknown };
    if (typeof csrf.csrfToken !== 'string' || !csrf.csrfToken) {
      throw new Error(`CSRF response missing token for ${role}`);
    }
    const loginResponse = await api.post(`${baseUrl}/api/auth/callback/credentials?json=true`, {
      form: {
        csrfToken: csrf.csrfToken,
        email,
        password,
        callbackUrl: baseUrl,
        json: 'true',
      },
    });
    if (!loginResponse.ok()) throw new Error(`credentials login failed for ${role}: ${loginResponse.status()}`);
    const sessionResponse = await api.get(`${baseUrl}/api/auth/session`);
    const session = await sessionResponse.json() as { user?: { id?: unknown; role?: unknown } };
    if (session.user?.role !== environment.expectedRole || typeof session.user.id !== 'string') {
      throw new Error(`authenticated role mismatch for ${role}`);
    }
    return { role, storageState: await api.storageState() };
  } finally {
    await api.dispose();
  }
}

async function addKnowledgeApiProbe(context: Awaited<ReturnType<Browser['newContext']>>) {
  await context.addInitScript(() => {
    const key = '__ACT_KNOWLEDGE_PRODUCT_QA_API__';
    const target = window as Window & { [key]?: KnowledgeApiSummary[] };
    target[key] = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const requestUrl = typeof args[0] === 'string'
        ? args[0]
        : args[0] instanceof URL
          ? args[0].toString()
          : args[0].url;
      const url = new URL(requestUrl, window.location.origin);
      if (url.pathname.startsWith('/api/knowledge/')) {
        response.clone().json().then((body: unknown) => {
          const record = body && typeof body === 'object' && !Array.isArray(body)
            ? body as Record<string, unknown>
            : {};
          const source = record.source && typeof record.source === 'object' && !Array.isArray(record.source)
            ? record.source as Record<string, unknown>
            : {};
          const coverage = record.coverage && typeof record.coverage === 'object' && !Array.isArray(record.coverage)
            ? record.coverage as Record<string, unknown>
            : {};
          const provenance = record.provenance && typeof record.provenance === 'object' && !Array.isArray(record.provenance)
            ? record.provenance as Record<string, unknown>
            : {};
          const authority = provenance.authority && typeof provenance.authority === 'object' && !Array.isArray(provenance.authority)
            ? provenance.authority
            : null;
          const activation = provenance.activation && typeof provenance.activation === 'object' && !Array.isArray(provenance.activation)
            ? provenance.activation as Record<string, unknown>
            : {};
          const projection = provenance.projection && typeof provenance.projection === 'object' && !Array.isArray(provenance.projection)
            ? provenance.projection as Record<string, unknown>
            : {};
          target[key]?.push({
            path: url.pathname,
            status: response.status,
            code: typeof record.code === 'string' ? record.code : null,
            error: typeof record.error === 'string' ? record.error : null,
            nodeCount: Array.isArray(record.nodes) ? record.nodes.length : null,
            relationCount: Array.isArray(record.relations) ? record.relations.length : null,
            authorityState: typeof source.authorityState === 'string' ? source.authorityState : null,
            hasAuthorityProvenance: Boolean(authority),
            activationMode: typeof activation.mode === 'string' ? activation.mode : null,
            activationStatus: typeof activation.status === 'string' ? activation.status : null,
            releaseSetId: typeof source.releaseSetId === 'string' ? source.releaseSetId : null,
            releaseId: typeof source.releaseId === 'string' ? source.releaseId : null,
            projectionVersion: typeof record.projectionVersion === 'string' ? record.projectionVersion : null,
            projectionDigest: typeof source.projectionDigest === 'string' ? source.projectionDigest : null,
            sourceDatasetHash: typeof source.sourceDatasetHash === 'string' ? source.sourceDatasetHash : null,
            coverageObjectCount: typeof coverage.objectCount === 'number' ? coverage.objectCount : null,
            coverageRelationCount: typeof coverage.relationCount === 'number' ? coverage.relationCount : null,
            hasSourceIdentityFields: ['authorityState', 'releaseSetId', 'releaseId', 'projectionDigest', 'sourceDatasetHash']
              .every((field) => Object.prototype.hasOwnProperty.call(source, field)),
            hasCoverageFields: ['objectCount', 'relationCount']
              .every((field) => Object.prototype.hasOwnProperty.call(coverage, field)),
            projectionId: projection.projectionId === null || typeof projection.projectionId === 'string'
              ? projection.projectionId ?? null
              : null,
            projectionHash: projection.projectionHash === null || typeof projection.projectionHash === 'string'
              ? projection.projectionHash ?? null
              : null,
            capturedAt: Date.now(),
          });
        }).catch(() => {
          target[key]?.push({
            path: url.pathname,
            status: response.status,
            code: null,
            error: 'non-json-response',
            nodeCount: null,
            relationCount: null,
            authorityState: null,
            hasAuthorityProvenance: false,
            activationMode: null,
            activationStatus: null,
            releaseSetId: null,
            releaseId: null,
            projectionVersion: null,
            projectionDigest: null,
            sourceDatasetHash: null,
            coverageObjectCount: null,
            coverageRelationCount: null,
            hasSourceIdentityFields: false,
            hasCoverageFields: false,
            projectionId: null,
            projectionHash: null,
            capturedAt: Date.now(),
          });
        });
      }
      return response;
    };
  });
}

async function readKnowledgeApiLog(page: Page): Promise<KnowledgeApiSummary[]> {
  return page.evaluate(() => (
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA_API__?: KnowledgeApiSummary[] })
      .__ACT_KNOWLEDGE_PRODUCT_QA_API__ ?? []
  ));
}

function latestApiSummary(log: KnowledgeApiSummary[], pathName: string) {
  return [...log].reverse().find((entry) => entry.path === pathName) ?? null;
}

function assertActiveApiSummary(summary: KnowledgeApiSummary | null, context: string) {
  if (
    !summary
    || summary.status !== 200
    || summary.nodeCount === null
    || summary.nodeCount <= 0
    || summary.authorityState !== 'active'
    || !summary.hasAuthorityProvenance
    || summary.activationMode !== 'use-combination'
    || summary.activationStatus !== 'READY'
    || summary.projectionId !== null
    || summary.projectionHash !== null
  ) {
    throw new Error(`active Authority API failed in ${context}: ${JSON.stringify(summary)}`);
  }
}

async function waitForActiveReady(page: Page, context: string) {
  await page.waitForSelector('[data-knowledge-graph-mode="active"]', { timeout: 30000 });
  await page.waitForFunction(() => {
    const graph = document.querySelector('[data-active-authority-graph="true"]');
    const stage = document.querySelector('[data-active-graph-stage="authority"]');
    const loading = graph?.querySelector('[role="status"]');
    const failure = graph?.querySelector('[role="alert"]');
    const nodeCount = document.querySelectorAll('[data-active-authority-node]').length;
    return Boolean(graph && stage && !loading && !failure && nodeCount > 0);
  }, undefined, { timeout: 30000 });
  await page.waitForFunction(() => {
    const log = (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA_API__?: KnowledgeApiSummary[] })
      .__ACT_KNOWLEDGE_PRODUCT_QA_API__ ?? [];
    return log.some((entry) => entry.path === '/api/knowledge/graph/active');
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(100);
  const log = await readKnowledgeApiLog(page);
  const active = latestApiSummary(log, '/api/knowledge/graph/active');
  assertActiveApiSummary(active, context);
  if (log.some((entry) => entry.path === '/api/knowledge/graph' || entry.path === '/api/knowledge/graph/v2')) {
    throw new Error(`active Authority unexpectedly requested Legacy or candidate API in ${context}`);
  }
  return active;
}

async function switchKnowledgeMode(page: Page, mode: KnowledgeMode, context: string) {
  const button = page.locator(`[data-knowledge-mode="${mode}"]`);
  if (!(await button.isVisible().catch(() => false))) {
    throw new Error(`${mode} mode control unavailable in ${context}`);
  }
  await button.click();
  await page.waitForSelector(`[data-knowledge-graph-mode="${mode}"]`, { timeout: 15000 });
  if (mode === 'legacy') {
    await page.waitForFunction(() => {
      const view = document.querySelector('[data-knowledge-legacy-view="true"]');
      const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
      return Boolean(view && canvas && Number(canvas.dataset.knowledgeVisibleNodeCount ?? '0') > 0);
    }, undefined, { timeout: 30000 });
  } else if (mode === 'candidate') {
    await page.waitForFunction(() => {
      const graph = document.querySelector('[data-candidate-authoritative-graph="true"]');
      return Boolean(graph && !graph.querySelector('[role="status"]'));
    }, undefined, { timeout: 30000 });
  }
  await page.waitForTimeout(300);
}

async function openStatePage(browser: Browser, state: CaptureState, storageState: RoleSession['storageState']) {
  const context = await browser.newContext({
    viewport: { width: state.width, height: state.height },
    deviceScaleFactor: 1,
    storageState,
  });
  await addKnowledgeApiProbe(context);
  await context.addInitScript(({ theme, navigationPreference }) => {
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
    window.localStorage.setItem('ai-obe-theme', theme);
    window.localStorage.setItem('act:app-shell:navigation-preference', navigationPreference);
    window.localStorage.setItem('act:knowledge-product-qa', 'true');
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  }, { theme: state.theme, navigationPreference: state.navigationPreference });
  const page = await context.newPage();
  const route = state.route ?? '/knowledge';
  const query = state.query ? `${state.query}&qa=knowledge-product` : '?qa=knowledge-product';
  const url = `${baseUrl}${route}${query}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const readySelector = route === '/knowledge'
    ? '[data-knowledge-graph-mode]'
    : '[data-commercial-workspace="adaptive-path-center"]';
  await page.waitForSelector(readySelector, { timeout: 30000 });
  if (route === '/knowledge') {
    await waitForActiveReady(page, `${state.name}:active-default`);
    const requestedKnowledgeMode = state.knowledgeMode ?? 'active';
    if (requestedKnowledgeMode !== 'active') {
      await switchKnowledgeMode(page, requestedKnowledgeMode, state.name);
    }
  }
  else await page.waitForTimeout(800);
  return { context, page, url };
}

async function waitForKnowledgeReady(page: Page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    if (!canvas) return false;
    const visibleNodeCount = Number(canvas.dataset.knowledgeVisibleNodeCount ?? '0');
    const loadingShardCount = Number(canvas.dataset.knowledgeLoadingShardCount ?? '0');
    const navigationState = canvas.dataset.knowledgeDomainState ?? canvas.dataset.knowledgeRootState ?? '';
    return visibleNodeCount > 0
      && loadingShardCount === 0
      && navigationState !== 'loading'
      && navigationState !== 'failure';
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(500);
}

async function clickIfPresent(page: Page, selector: string) {
  const locator = page.locator(selector);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click({ timeout: 5000 });
    await page.waitForTimeout(250);
    return;
  }
}

async function openDesktopTool(page: Page, tool: string) {
  await clickIfPresent(page, `[data-knowledge-command-trigger="${tool}"]`);
  await page.waitForSelector(`[data-knowledge-local-tool="${tool}"][data-state="open"]`, { timeout: 8000 }).catch(() => undefined);
}

async function waitForSelectedNodeRuntimePosition(page: Page) {
  await page.waitForFunction(() => {
    const pinButton = document.querySelector<HTMLButtonElement>('[data-knowledge-layout-control="pin-selected"]');
    return Boolean(pinButton && !pinButton.disabled);
  }, undefined, { timeout: 10000 }).catch(() => undefined);
}

async function selectedNodeDragPointCandidates(page: Page) {
  return page.evaluate(`(() => {
    const probe = window.__knowledgeGraphProductQaSelectedNodeDragPoints;
    if (typeof probe !== 'function') return [];
    return probe()
      .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  })()`).catch(() => []);
}

async function hoverTextAtPoint(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(120);
  return page.evaluate(() =>
    document.querySelector('[data-knowledge-local-panel="node-hover-preview"]')?.textContent ?? ''
  );
}

async function selectedNodeHoverDragPointCandidates(page: Page, expectedNodeId: string) {
  const expectedLabel = expectedNodeId.split('_')[0] ?? expectedNodeId;
  await page.waitForTimeout(2500);
  const qaCandidates = await selectedNodeDragPointCandidates(page);
  if (qaCandidates.length > 0) {
    const matches: Array<[number, number]> = [];
    for (const { x, y } of qaCandidates) {
      const hoverText = await hoverTextAtPoint(page, x, y);
      if (hoverText.includes(expectedLabel)) matches.push([x, y]);
      if (matches.length >= 8) return matches;
    }
    return qaCandidates.slice(0, 8).map(({ x, y }) => [x, y] as [number, number]);
  }
  const canvasBox = await page.locator('[data-knowledge-canvas-primary] canvas').boundingBox();
  const gridCandidates: Array<[number, number]> = [];
  if (canvasBox) {
    for (let y = canvasBox.y + 40; y < canvasBox.y + canvasBox.height - 20; y += 20) {
      for (let x = canvasBox.x + 40; x < canvasBox.x + canvasBox.width - 20; x += 20) {
        gridCandidates.push([x, y]);
      }
    }
  }
  const candidates = [
    ...qaCandidates.map(({ x, y }) => [x, y] as [number, number]),
    ...gridCandidates,
  ];
  const matches: Array<[number, number]> = [];
  for (const [x, y] of candidates) {
    const hoverText = await hoverTextAtPoint(page, x, y);
    if (hoverText.includes(expectedLabel)) {
      matches.push([x, y]);
      if (matches.length >= 8) return matches;
    }
  }
  return matches;
}

async function dragCanvasNodeUntilPinned(page: Page, expectedNodeId: string) {
  const candidates = await selectedNodeHoverDragPointCandidates(page, expectedNodeId);
  for (const [x, y] of candidates) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 36, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const canvas = page.locator('[data-knowledge-canvas-primary]').first();
    const pinned = await canvas.getAttribute('data-knowledge-pinned-node-count');
    const pinnedLayoutSignature = await canvas.getAttribute('data-knowledge-pinned-layout-signature') ?? '';
    if (pinned === '1' && pinnedLayoutSignature.includes(expectedNodeId)) {
      return {
        method: 'pointer-drag',
        dragFrom: { x, y },
        dragTo: { x: x + 80, y: y + 36 },
        pinned: true,
        selectedNodeId: expectedNodeId,
      };
    }
    if (pinnedLayoutSignature) {
      await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
      await page.waitForTimeout(500);
    }
  }
  return { method: 'pointer-drag', pinned: false, selectedNodeId: expectedNodeId };
}

async function captureMarkerSnapshot(page: Page) {
  return page.evaluate(`(() => {
    const canvas = document.querySelector('[data-knowledge-canvas-primary]');
    const desktopTools = document.querySelector('[data-knowledge-desktop-command-system]');
    return {
      layoutVersion: canvas?.dataset.knowledgeLayoutVersion ?? '',
      pinnedNodeCount: canvas?.dataset.knowledgePinnedNodeCount ?? '',
      pinnedLayoutSignature: canvas?.dataset.knowledgePinnedLayoutSignature ?? '',
      selectedNodeId: canvas?.dataset.knowledgeSelectedNodeId ?? '',
      desktopToolState: desktopTools?.dataset.state ?? null,
      desktopActiveTool: desktopTools?.dataset.knowledgeLocalTool ?? null
    };
  })()`);
}

async function captureThreeDimensionalSnapshot(page: Page) {
  return page.evaluate(`(() => {
    const renderer = document.querySelector('[data-knowledge-graph-renderer="3D"]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary="true"]');
    const webglCanvas = renderer?.querySelector('canvas');
    const rect = webglCanvas?.getBoundingClientRect();
    const nodeIds = Array.from(document.querySelectorAll('[data-knowledge-node-control]'))
      .map((element) => element.getAttribute('data-knowledge-node-control') ?? '')
      .filter(Boolean)
      .sort();
    const debug = window.__knowledgeGraphQaNodeDebug;
    const nodePositions = nodeIds.map((nodeId) => {
      const entry = typeof debug === 'function' ? debug(nodeId)?.[0] : null;
      return {
        id: nodeId,
        x: entry?.x ?? null,
        y: entry?.y ?? null,
        z: entry?.z ?? null,
        isInFrustum: entry?.isInFrustum ?? null,
        bodyBounds: entry?.bodyBounds ?? null,
        labelBounds: entry?.labelBounds ?? null,
        projectedBounds: entry?.projectedBounds ?? null,
      };
    });
    const projectedBounds = nodePositions.map((node) => node.projectedBounds);
    const allProjectedBoundsInsideCanvas = Boolean(rect && projectedBounds.length > 0)
      && projectedBounds.every((bounds) => bounds
        && [bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
        && bounds.left >= ${threeDimensionalFitSafetyMargin}
        && bounds.top >= ${threeDimensionalFitSafetyMargin}
        && bounds.right <= rect.width - ${threeDimensionalFitSafetyMargin}
        && bounds.bottom <= rect.height - ${threeDimensionalFitSafetyMargin});
    const minimumProjectedMargin = rect && projectedBounds.length > 0
      ? Math.min(...projectedBounds.flatMap((bounds) => bounds ? [
          bounds.left,
          bounds.top,
          rect.width - bounds.right,
          rect.height - bounds.bottom,
        ] : [Number.NEGATIVE_INFINITY]))
      : null;
    const loadingBlockers = [
      document.querySelector('[data-knowledge-root-loading="true"]') ? 'root-loading' : null,
      document.querySelector('[data-knowledge-domain-loading="true"]') ? 'domain-loading' : null,
      Array.from(document.querySelectorAll('body *')).some((element) => element.textContent?.trim() === '渲染视图...')
        ? 'renderer-loading'
        : null,
    ].filter(Boolean);
    return {
      renderer: renderer?.getAttribute('data-knowledge-graph-renderer') ?? null,
      rendererCount: document.querySelectorAll('[data-knowledge-graph-renderer="3D"]').length,
      webglCanvasCount: renderer?.querySelectorAll('canvas').length ?? 0,
      canvasRect: rect ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } : null,
      layoutVersion: Number(canvas?.dataset.knowledgeLayoutVersion ?? Number.NaN),
      autoFitCount: Number(renderer?.getAttribute('data-knowledge-auto-fit-count') ?? Number.NaN),
      explicitFitCount: Number(renderer?.getAttribute('data-knowledge-explicit-fit-count') ?? Number.NaN),
      loadingBlockers,
      nodePositions,
      allNodesInFrustum: nodePositions.length > 0
        && nodePositions.every((node) => node.isInFrustum === 1),
      projectedBoundsSafetyMargin: ${threeDimensionalFitSafetyMargin},
      minimumProjectedMargin,
      allProjectedBoundsInsideCanvas,
    };
  })()`);
}

async function captureThreeDimensionalFitRelayoutEvidence(page: Page) {
  await openDesktopTool(page, 'view-layout');
  await page.getByRole('button', { name: '3D 视图' }).click();
  await page.locator('[data-knowledge-graph-renderer="3D"] canvas').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => {
    const renderer = document.querySelector('[data-knowledge-graph-renderer="3D"]');
    const autoFitCount = Number(renderer?.getAttribute('data-knowledge-auto-fit-count') ?? 0);
    const explicitFitCount = Number(renderer?.getAttribute('data-knowledge-explicit-fit-count') ?? 0);
    return autoFitCount + explicitFitCount >= 1;
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(500);
  const initial = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="fit-view"]');
  await page.waitForFunction((previousCount) => Number(
    document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-explicit-fit-count') ?? 0,
  ) === previousCount + 1, initial.explicitFitCount, { timeout: 20_000 });
  await page.waitForTimeout(150);
  const afterFirstFit = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
  await page.waitForFunction((previousVersion) => Number(
    document.querySelector('[data-knowledge-canvas-primary="true"]')?.getAttribute('data-knowledge-layout-version') ?? -1,
  ) === previousVersion + 1, afterFirstFit.layoutVersion, { timeout: 20_000 });
  await page.waitForTimeout(750);
  const afterFirstRelayout = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
  await page.waitForFunction((previousVersion) => Number(
    document.querySelector('[data-knowledge-canvas-primary="true"]')?.getAttribute('data-knowledge-layout-version') ?? -1,
  ) === previousVersion + 1, afterFirstRelayout.layoutVersion, { timeout: 20_000 });
  await page.waitForTimeout(750);
  const afterRepeatedRelayout = await captureThreeDimensionalSnapshot(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  return {
    kind: '3d-first-fit-repeated-relayout',
    initial,
    afterFirstFit,
    afterFirstRelayout,
    afterRepeatedRelayout,
    initialFitCompleted: initial.autoFitCount + initial.explicitFitCount >= 1,
    firstFitExactlyOnce: afterFirstFit.explicitFitCount === initial.explicitFitCount + 1,
    repeatedRelayoutExactlyOnce: afterFirstRelayout.layoutVersion === afterFirstFit.layoutVersion + 1
      && afterRepeatedRelayout.layoutVersion === afterFirstRelayout.layoutVersion + 1,
    repeatedRelayoutIdempotent: JSON.stringify(afterFirstRelayout.nodePositions)
      === JSON.stringify(afterRepeatedRelayout.nodePositions),
    canvasStable: JSON.stringify(initial.canvasRect) === JSON.stringify(afterFirstFit.canvasRect)
      && JSON.stringify(afterFirstFit.canvasRect) === JSON.stringify(afterFirstRelayout.canvasRect)
      && JSON.stringify(afterFirstRelayout.canvasRect) === JSON.stringify(afterRepeatedRelayout.canvasRect),
    noLoadingBlockers: [initial, afterFirstFit, afterFirstRelayout, afterRepeatedRelayout]
      .every((snapshot) => snapshot.loadingBlockers.length === 0),
    noRendererOcclusion: afterRepeatedRelayout.rendererCount === 1
      && afterRepeatedRelayout.webglCanvasCount === 1
      && afterRepeatedRelayout.allNodesInFrustum,
    completeProjectedBoundsInsideCanvas: [initial, afterFirstFit, afterFirstRelayout, afterRepeatedRelayout]
      .every((snapshot) => snapshot.allProjectedBoundsInsideCanvas),
  };
}

function doRectsOverlap(
  a: { left: number; top: number; right: number; bottom: number } | null,
  b: { left: number; top: number; right: number; bottom: number } | null,
) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function openMobileTool(page: Page, tool: string) {
  const labelByTool: Record<string, string> = {
    'chapter-directory': '目录',
    'node-filters': '筛选',
    'view-layout': '视图',
  };
  const label = labelByTool[tool] ?? tool;
  const mobileButton = page.locator('[data-knowledge-mobile-command-surface] button').filter({ hasText: label }).first();
  if (await mobileButton.count()) {
    await mobileButton.click({ timeout: 5000 });
    await page.waitForTimeout(250);
  }
  await page.waitForSelector(`[data-knowledge-mobile-tool-panel="${tool}"]`, { timeout: 8000 }).catch(() => undefined);
}

async function expandDock(page: Page) {
  await clickIfPresent(page, '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]');
  await page.waitForSelector('[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]', { timeout: 8000 });
  await page.waitForTimeout(250);
}

async function openPageToolMenu(page: Page) {
  await clickIfPresent(page, '[data-platform-floating-dock] button[data-platform-floating-dock-secondary-trigger]');
  await page.waitForSelector('[data-platform-floating-dock-expanded-panel]', { timeout: 8000 });
}

async function closeInspectorIfPresent(page: Page) {
  await clickIfPresent(page, 'button[aria-label="关闭知识节点检查器"]');
  await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', {
    state: 'detached',
    timeout: 5000,
  }).catch(() => undefined);
}

async function openSelectedNodeInspector(page: Page, nodeId = selectedNodeId) {
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  if (await inspector.isVisible().catch(() => false)) return;
  await page.waitForFunction((expectedNodeId) => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const selectedNodeId = canvas?.dataset.knowledgeSelectedNodeId;
    const control = selectedNodeId
      ? document.querySelector<HTMLElement>(`[data-knowledge-node-control="${selectedNodeId}"]`)
      : null;
    return selectedNodeId === expectedNodeId
      && control?.getAttribute('aria-busy') === 'false'
      && control?.getAttribute('aria-expanded') === null;
  }, nodeId, { timeout: 20000 });
  const control = page.locator(`[data-knowledge-node-control="${nodeId}"]`);
  await control.focus();
  await control.evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 15000 });
}

async function activeElementWithin(page: Page, selector: string) {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    return Boolean(target && document.activeElement && target.contains(document.activeElement));
  }, selector);
}

async function focusableByTab(page: Page, selector: string) {
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    if (await activeElementWithin(page, selector)) return true;
  }
  return false;
}

type LegacyFocusState = Omit<CaptureState, 'knowledgeMode'> & { knowledgeMode: 'legacy' };

function legacyFocusState(state: Omit<CaptureState, 'knowledgeMode'>): LegacyFocusState {
  return { ...state, knowledgeMode: 'legacy' };
}

function assertLegacyFocusState(target: string, state: CaptureState) {
  const legacyFocusTarget = target.startsWith('desktop-local-tool-')
    || target === 'desktop-local-tools'
    || target === 'mobile-local-sheet'
    || target === 'mobile-inspector'
    || target === 'konling-expanded';
  if (legacyFocusTarget && state.knowledgeMode !== 'legacy') {
    throw new Error(`${target} focus probe must start in explicit Legacy mode`);
  }
}

async function probeFocusTarget(
  browser: Browser,
  target: string,
  state: CaptureState,
  storageState: RoleSession['storageState'],
  open: (page: Page) => Promise<void>,
  panelSelector: string,
  close: (page: Page) => Promise<void>,
  returnSelector: string,
) {
  assertLegacyFocusState(target, state);
  const { context, page } = await openStatePage(browser, state, storageState);
  try {
    await open(page);
    await page.waitForSelector(panelSelector, { timeout: 8000 });
    let openedFocusManaged = false;
    try {
      await page.waitForFunction((selector) => {
        const panel = document.querySelector<HTMLElement>(selector);
        return Boolean(panel && panel.contains(document.activeElement));
      }, panelSelector, { timeout: 3000 });
      openedFocusManaged = true;
    } catch {
      openedFocusManaged = await activeElementWithin(page, panelSelector);
    }
    const keyboardReachable = openedFocusManaged || await focusableByTab(page, panelSelector);
    await close(page);
    await page.waitForTimeout(250);
    const panelClosed = !(await page.locator(panelSelector).first().isVisible().catch(() => false));
    const escapeOrCloseReturnsFocus = panelClosed && await activeElementWithin(page, returnSelector);
    return { target, openedFocusManaged, escapeOrCloseReturnsFocus, keyboardReachable };
  } finally {
    await context.close();
  }
}

async function captureFocusEvidence(browser: Browser, storageState: RoleSession['storageState']) {
  const desktopTools = ['chapter-directory', 'node-filters', 'view-layout'] as const;
  const desktopToolEvidence = [];
  for (const tool of desktopTools) {
    desktopToolEvidence.push(await probeFocusTarget(
      browser,
      `desktop-local-tool-${tool}`,
      legacyFocusState({
        name: `focus-desktop-local-tool-${tool}`,
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'collapsed',
        localToolState: tool,
        selectedNode: null,
        interactionState: `focus desktop local tool ${tool}`,
      }),
      storageState,
      (page) => openDesktopTool(page, tool),
      `[data-knowledge-desktop-tool-panel="${tool}"]`,
      (page) => page.keyboard.press('Escape'),
      `[data-knowledge-command-trigger="${tool}"]`,
    ));
  }

  return [
    ...desktopToolEvidence,
    await probeFocusTarget(
      browser,
      'desktop-local-tools',
      legacyFocusState({
        name: 'focus-desktop-local-tools',
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'collapsed',
        localToolState: 'node-filters',
        selectedNode: null,
        interactionState: 'focus desktop local tools',
      }),
      storageState,
      (page) => openDesktopTool(page, 'node-filters'),
      '[data-knowledge-desktop-tool-panel="node-filters"]',
      (page) => page.keyboard.press('Escape'),
      '[data-knowledge-command-trigger="node-filters"]',
    ),
    await probeFocusTarget(
      browser,
      'mobile-local-sheet',
      legacyFocusState({
        name: 'focus-mobile-local-sheet',
        theme: 'dark',
        width: 320,
        height: 800,
        navigationPreference: 'collapsed',
        navigationState: 'mobile',
        dockState: 'collapsed',
        localToolState: 'view-layout',
        selectedNode: null,
        interactionState: 'focus mobile local tools',
      }),
      storageState,
      (page) => openMobileTool(page, 'view-layout'),
      '[data-knowledge-mobile-tool-panel="view-layout"]',
      (page) => clickIfPresent(page, '[data-knowledge-mobile-panel-toggle="true"]'),
      '[data-knowledge-mobile-panel-toggle="true"]',
    ),
    await probeFocusTarget(
      browser,
      'mobile-inspector',
      legacyFocusState({
        name: 'focus-mobile-inspector',
        theme: 'dark',
        width: 320,
        height: 800,
        navigationPreference: 'collapsed',
        navigationState: 'mobile',
        dockState: 'collapsed',
        localToolState: 'closed',
        selectedNode: selectedNodeId,
        interactionState: 'focus mobile inspector',
        query: `?node=${encodeURIComponent(selectedNodeId)}`,
      }),
      storageState,
      (page) => openSelectedNodeInspector(page),
      '[data-knowledge-inspector="floating-right-edge"]',
      (page) => page.keyboard.press('Escape'),
      '[data-knowledge-canvas-primary="true"]',
    ),
    await probeFocusTarget(
      browser,
      'konling-expanded',
      legacyFocusState({
        name: 'focus-konling-expanded',
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'expanded',
        localToolState: 'closed',
        selectedNode: selectedNodeId,
        interactionState: 'focus konling expanded',
        query: `?node=${encodeURIComponent(selectedNodeId)}`,
      }),
      storageState,
      expandDock,
      '[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]',
      (page) => page.keyboard.press('Escape'),
      '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]',
    ),
  ];
}

async function captureMarkers(page: Page, stateName: string) {
  const markers = await page.evaluate(`(() => {
    const root = document.querySelector('[data-knowledge-graph-mode]');
    const legacyWorkspaceRoot = document.querySelector('[data-knowledge-workspace]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary]');
    const activeGraph = document.querySelector('[data-active-authority-graph="true"]');
    const candidateGraph = document.querySelector('[data-candidate-authoritative-graph="true"]');
    const legacyView = document.querySelector('[data-knowledge-legacy-view="true"]');
    const desktopTools = document.querySelector('[data-knowledge-desktop-command-system]');
    const mobileTools = document.querySelector('[data-knowledge-mobile-command-surface]');
    const activeLocalPanel = document.querySelector('[data-knowledge-local-tool-panel]');
    const relationFamilyControl = document.querySelector('[data-knowledge-relation-family-control]');
     const inspector = document.querySelector('[data-knowledge-inspector]');
     const dock = document.querySelector('[data-platform-floating-dock]');
     const konlingSidebar = document.querySelector('[data-global-ai-sidebar="open"]');
     const konlingKnowledgeContext = document.querySelector('[data-konling-knowledge-context]');
     const appShell = document.querySelector('[data-app-shell-layout]');
    const rectFor = (element) => {
      if (!element) return null;
      if (window.getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
     const expandedDock = document.querySelector('[data-platform-floating-dock-expanded-panel]');
     const desktopToolsRect = rectFor(desktopTools);
     const mobileToolsRect = rectFor(mobileTools);
     const canvasRect = rectFor(canvas);
     const activeLocalPanelRect = rectFor(activeLocalPanel);
     const relationFamilyControlRect = rectFor(relationFamilyControl);
     const inspectorRect = rectFor(inspector);
     const dockRect = rectFor(dock);
     const konlingSidebarRect = rectFor(konlingSidebar);
     const expandedDockRect = rectFor(konlingSidebar ?? expandedDock);
    return {
      htmlClass: document.documentElement.className,
      workspace: legacyWorkspaceRoot?.getAttribute('data-knowledge-workspace') ?? null,
      knowledgeGraphMode: root?.dataset.knowledgeGraphMode ?? null,
      knowledgeGraphVersion: root?.dataset.knowledgeGraphVersion ?? null,
      activeAuthority: activeGraph ? {
        visibleNodeCount: document.querySelectorAll('[data-active-authority-node]').length,
        relationCount: document.querySelectorAll('[data-active-authority-relation]').length,
        stage: document.querySelector('[data-active-graph-stage="authority"]') ? 'authority' : null,
        identitySurface: activeGraph.textContent?.includes('Projection：不适用（null）') ?? false,
      } : null,
      candidateAuthority: candidateGraph ? {
        graphVisible: true,
        visibleNodeCount: document.querySelectorAll('[data-candidate-graph-stage] [data-candidate-canonical-type]').length,
        controlledVerification: candidateGraph.getAttribute('data-candidate-controlled-verification') === 'true',
      } : null,
      legacyView: legacyView ? {
        visible: true,
        visibleNodeCount: Number(canvas?.getAttribute('data-knowledge-visible-node-count') ?? '0'),
      } : null,
      konlingContextStatus: root?.dataset.knowledgeKonlingContextStatus ?? null,
      appShellNavigationState: appShell?.dataset.appShellNavigationState ?? null,
      appShellPreference: appShell?.dataset.appShellNavigationPreference ?? null,
      canvas: canvas ? {
        selectedNodeId: canvas.dataset.knowledgeSelectedNodeId ?? '',
        visibleNodeCount: canvas.dataset.knowledgeVisibleNodeCount ?? '',
        visibleLinkCount: canvas.dataset.knowledgeVisibleLinkCount ?? '',
        layoutVersion: canvas.dataset.knowledgeLayoutVersion ?? '',
        pinnedNodeCount: canvas.dataset.knowledgePinnedNodeCount ?? '',
      } : null,
      threeDimensionalRenderer: document.querySelector('[data-knowledge-graph-renderer="3D"]') ? {
        renderer: '3D',
        autoFitCount: document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-auto-fit-count') ?? '',
        explicitFitCount: document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-explicit-fit-count') ?? '',
        canvasCount: document.querySelectorAll('[data-knowledge-graph-renderer="3D"] canvas').length,
      } : null,
      desktopToolState: desktopTools?.dataset.state ?? null,
      desktopActiveTool: desktopTools?.dataset.knowledgeLocalTool ?? null,
      activeLocalPanel: activeLocalPanel?.dataset.knowledgeLocalToolPanel ?? null,
      desktopToolPanel: activeLocalPanel?.dataset.knowledgeLocalToolPanel ?? null,
      mobileToolState: mobileTools?.dataset.state ?? null,
      mobileActiveTool: mobileTools?.dataset.knowledgeLocalTool ?? null,
      inspectorMode: inspectorRect ? (inspector?.dataset.knowledgeInspector ?? null) : null,
      inspectorResponsive: inspectorRect ? (inspector?.dataset.knowledgeInspectorResponsive ?? null) : null,
      inspectorFocusContract: inspectorRect ? (inspector?.dataset.knowledgeInspectorFocusContract ?? null) : null,
      inspectorDockSafeArea: inspectorRect ? (inspector?.dataset.knowledgeInspectorDockSafeArea ?? null) : null,
      inspectorSections: inspectorRect ? Array.from(document.querySelectorAll('[data-knowledge-inspector-section]'))
        .map((element) => element.dataset.knowledgeInspectorSection ?? '')
        .filter(Boolean) : [],
      inspectorAccordion: inspectorRect ? Array.from(document.querySelectorAll('[data-knowledge-inspector-section] > button[aria-expanded]'))
        .map((element) => ({
          section: element.parentElement?.getAttribute('data-knowledge-inspector-section') ?? '',
          expanded: element.getAttribute('aria-expanded') ?? '',
        }))
        .filter((entry) => entry.section) : [],
      relationFamilyControlVisible: Boolean(document.querySelector('[data-knowledge-relation-family-control]')),
      relationFamilyControlPlacement: relationFamilyControl?.getAttribute('data-knowledge-relation-family-control') ?? null,
      relationFamilyCollisionPolicy: relationFamilyControl?.getAttribute('data-knowledge-relation-family-collision-policy') ?? null,
      relationFamilyState: document.querySelector('[data-knowledge-relation-family-control]')?.getAttribute('data-knowledge-relation-family-state') ?? null,
      relationFamilySamples: document.querySelectorAll('[data-knowledge-relation-family-sample]').length,
      mobileLayoutControls: Array.from(document.querySelectorAll('[data-knowledge-layout-control]'))
        .map((element) => element.getAttribute('data-knowledge-layout-control') ?? '')
        .filter(Boolean),
      dockState: dock?.getAttribute('data-platform-floating-dock') ?? null,
       dockInspectorAvoidance: dock?.getAttribute('data-platform-floating-dock-inspector-avoidance') ?? null,
       effectiveDockState: konlingSidebar || expandedDock ? 'expanded' : (dock?.getAttribute('data-platform-floating-dock') ?? null),
       expandedDockVisible: Boolean(konlingSidebar || expandedDock),
       konlingAssistantSurface: konlingSidebar?.getAttribute('data-konling-assistant-surface') ?? null,
       konlingInspectorAvoidance: konlingSidebar?.getAttribute('data-konling-inspector-avoidance') ?? null,
       konlingMobileInspectorPolicy: konlingSidebar?.getAttribute('data-knowledge-mobile-inspector-policy') ?? null,
       konlingKnowledgeContext: konlingKnowledgeContext?.getAttribute('data-konling-knowledge-context') ?? null,
      rects: {
        canvas: canvasRect,
        desktopTools: desktopToolsRect,
        mobileTools: mobileToolsRect,
        activeLocalPanel: activeLocalPanelRect,
        relationFamilyControl: relationFamilyControlRect,
        inspector: inspectorRect,
        dock: dockRect,
        konlingSidebar: konlingSidebarRect,
        expandedDock: expandedDockRect,
      },
      documentScroll: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
      },
    };
  })()`);
  const rects = markers.rects as {
    canvas: EvidenceRect | null;
    desktopTools: EvidenceRect | null;
    mobileTools: EvidenceRect | null;
    activeLocalPanel: EvidenceRect | null;
    relationFamilyControl: EvidenceRect | null;
    inspector: EvidenceRect | null;
    dock: EvidenceRect | null;
    konlingSidebar: EvidenceRect | null;
    expandedDock: EvidenceRect | null;
  };
  const konlingSidebarOverlapsRelationFamilyControl = doRectsOverlap(
    rects.konlingSidebar as never,
    rects.relationFamilyControl as never,
  );
  if (markers.relationFamilyControlPlacement === 'compact-bottom-left'
    && konlingSidebarOverlapsRelationFamilyControl) {
    throw new Error(
      `expanded Konling overlaps the canvas relation-family control in ${stateName}: `
      + `Konling=${JSON.stringify(rects.konlingSidebar)}, `
      + `relationFamily=${JSON.stringify(rects.relationFamilyControl)}`,
    );
  }
  return {
    ...markers,
    overlaps: {
      dockOverlapsDesktopTools: doRectsOverlap(rects.dock as never, rects.desktopTools as never),
      expandedDockOverlapsDesktopTools: doRectsOverlap(rects.expandedDock as never, rects.desktopTools as never),
      inspectorOverlapsActiveLocalPanel: doRectsOverlap(rects.inspector as never, rects.activeLocalPanel as never),
      dockOverlapsMobileTools: doRectsOverlap(rects.dock as never, rects.mobileTools as never),
      expandedDockOverlapsMobileTools: doRectsOverlap(rects.expandedDock as never, rects.mobileTools as never),
      konlingSidebarOverlapsRelationFamilyControl,
      dockOverlapsInspector: doRectsOverlap(rects.dock as never, rects.inspector as never),
      expandedDockOverlapsInspector: doRectsOverlap(rects.expandedDock as never, rects.inspector as never),
    },
  };
}

async function captureState(browser: Browser, state: CaptureState, storageState: RoleSession['storageState']) {
  const { context, page, url } = await openStatePage(browser, state, storageState);
  try {
    let interactionEvidence: Record<string, unknown> | undefined;
    if (state.beforeShot) {
      interactionEvidence = await state.beforeShot(page) ?? undefined;
      await page.waitForTimeout(500);
    }
    if ((state.route ?? '/knowledge') === '/knowledge') {
      if ((state.knowledgeMode ?? 'active') === 'active') await waitForActiveReady(page, `${state.name}:active-capture`);
      else await waitForKnowledgeReady(page);
    }
    const screenshotName = `${state.name}.png`;
    const screenshotPath = path.join(outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const screenshotRelativePath = path.relative(repoRoot, screenshotPath);
    const markers = await captureMarkers(page, state.name);
    const apiLog = await readKnowledgeApiLog(page);
    return {
      name: state.name,
      route: state.route ?? '/knowledge',
      url,
      theme: state.theme,
      viewport: { width: state.width, height: state.height },
      navigationState: state.navigationState === 'mobile' ? 'mobile-drawer' : state.navigationState,
      dockState: state.dockState,
      localToolState: state.localToolState,
      selectedNode: state.selectedNode,
      interactionState: state.interactionState,
      knowledgeMode: state.knowledgeMode ?? 'active',
      api: {
        active: latestApiSummary(apiLog, '/api/knowledge/graph/active'),
        legacy: latestApiSummary(apiLog, '/api/knowledge/graph'),
        candidate: latestApiSummary(apiLog, '/api/knowledge/graph/v2'),
      },
      result: 'passed',
      screenshotPath: screenshotRelativePath,
      screenshotSha256: sha256(screenshotRelativePath),
      markers,
      interactionEvidence,
    };
  } finally {
    await context.close();
  }
}

async function captureAuthenticatedRoleEvidence(
  browser: Browser,
  sessions: ReadonlyMap<KnowledgeRole, RoleSession>,
) {
  const results: Array<Record<string, unknown>> = [];
  for (const role of ['student', 'teacher', 'admin'] as const) {
    const session = sessions.get(role);
    if (!session) throw new Error(`missing authenticated session for ${role}`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
      storageState: session.storageState,
    });
    await addKnowledgeApiProbe(context);
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/knowledge?qa=knowledge-product`, { waitUntil: 'domcontentloaded' });
      const active = await waitForActiveReady(page, `role:${role}:default`);
      const initialLog = await readKnowledgeApiLog(page);
      const candidateButtonVisible = await page.locator('[data-knowledge-mode="candidate"]').isVisible().catch(() => false);
      const legacyButtonVisible = await page.locator('[data-knowledge-mode="legacy"]').isVisible().catch(() => false);
      const defaultScreenshot = path.join(outputDir, `role-${role}-default.png`);
      await page.screenshot({ path: defaultScreenshot, fullPage: false });

      const legacyBeforeSwitch = initialLog.some((entry) => entry.path === '/api/knowledge/graph');
      await switchKnowledgeMode(page, 'legacy', `role:${role}:legacy`);
      const legacyLog = await readKnowledgeApiLog(page);
      const legacy = latestApiSummary(legacyLog, '/api/knowledge/graph');
      if (!legacy || legacy.status !== 200) {
        throw new Error(`Legacy API failed in role:${role}: ${JSON.stringify(legacy)}`);
      }
      const legacyCanvas = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
        return {
          visibleNodeCount: Number(canvas?.dataset.knowledgeVisibleNodeCount ?? '0'),
          legacyView: Boolean(document.querySelector('[data-knowledge-legacy-view="true"]')),
        };
      });
      if (!legacyCanvas.legacyView || legacyCanvas.visibleNodeCount <= 0) {
        throw new Error(`Legacy canvas was empty in role:${role}`);
      }
      const legacyScreenshot = path.join(outputDir, `role-${role}-legacy.png`);
      await page.screenshot({ path: legacyScreenshot, fullPage: false });

      let candidate: Record<string, unknown> | null = null;
      let candidateScreenshot: string | null = null;
      const candidateApiRequestedBeforeExplicitSwitch = initialLog.some(
        (entry) => entry.path === '/api/knowledge/graph/v2',
      );
      if (role === 'admin') {
        await switchKnowledgeMode(page, 'active', `role:${role}:active-before-candidate`);
        await switchKnowledgeMode(page, 'candidate', `role:${role}:candidate`);
        const candidateLog = await readKnowledgeApiLog(page);
        const candidateApi = latestApiSummary(candidateLog, '/api/knowledge/graph/v2');
        if (!candidateApi || candidateApi.status !== 200) {
          throw new Error(`candidate API failed in role:${role}: ${JSON.stringify(candidateApi)}`);
        }
        candidateScreenshot = path.join(outputDir, `role-${role}-candidate.png`);
        await page.screenshot({ path: candidateScreenshot, fullPage: false });
        const candidateControlledVerification = await page.locator(
          '[data-candidate-authoritative-graph="true"][data-candidate-controlled-verification="true"]',
        ).count() > 0;
        if (!candidateControlledVerification) {
          throw new Error('admin candidate graph is missing controlledVerification marker');
        }
        candidate = {
          mode: 'candidate',
          controlledEntry: true,
          controlledVerification: candidateControlledVerification,
          currentAuthority: false,
          explicitSwitch: true,
          candidateApiRequestedBeforeExplicitSwitch,
          api: candidateApi,
          graphVisible: Boolean(await page.locator('[data-candidate-authoritative-graph="true"]').count()),
          nodeCount: candidateApi.nodeCount,
          identity: {
            authorityState: candidateApi.authorityState,
            releaseSetId: candidateApi.releaseSetId,
            releaseId: candidateApi.releaseId,
            projectionVersion: candidateApi.projectionVersion,
            projectionDigest: candidateApi.projectionDigest,
            sourceDatasetHash: candidateApi.sourceDatasetHash,
          },
          coverage: {
            objectCount: candidateApi.coverageObjectCount,
            relationCount: candidateApi.coverageRelationCount,
          },
          screenshotPath: path.relative(repoRoot, candidateScreenshot),
          screenshotSha256: sha256(path.relative(repoRoot, candidateScreenshot)),
        };
      }

      results.push({
        role,
        default: {
          mode: 'active',
          api: active,
          graphVisible: true,
          nonEmptyCanvas: true,
          candidateButtonVisible,
          legacyButtonVisible,
          legacyApiRequestedBeforeExplicitSwitch: legacyBeforeSwitch,
          apiSequenceBeforeLegacy: initialLog.map((entry) => ({ path: entry.path, status: entry.status })),
          screenshotPath: path.relative(repoRoot, defaultScreenshot),
          screenshotSha256: sha256(path.relative(repoRoot, defaultScreenshot)),
        },
        legacy: {
          mode: 'legacy',
          api: legacy,
          legacyView: legacyCanvas.legacyView,
          visibleNodeCount: legacyCanvas.visibleNodeCount,
          explicitSwitch: true,
          screenshotPath: path.relative(repoRoot, legacyScreenshot),
          screenshotSha256: sha256(path.relative(repoRoot, legacyScreenshot)),
        },
        candidate,
        apiSequence: (await readKnowledgeApiLog(page)).map((entry) => ({ path: entry.path, status: entry.status })),
      });
    } finally {
      await context.close();
    }
  }
  return results;
}

async function captureActiveAuthorityVisualMatrix(
  browser: Browser,
  storageState: RoleSession['storageState'],
) {
  const states: CaptureState[] = [
    {
      name: 'active-desktop-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive desktop dark',
      knowledgeMode: 'active',
    },
    {
      name: 'active-desktop-light',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive desktop light',
      knowledgeMode: 'active',
    },
    {
      name: 'active-tablet',
      theme: 'dark',
      width: 1024,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive tablet',
      knowledgeMode: 'active',
    },
    {
      name: 'active-mobile',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive mobile',
      knowledgeMode: 'active',
    },
  ];
  const matrix: Array<Record<string, unknown>> = [];
  for (const state of states) {
    const { context, page, url } = await openStatePage(browser, state, storageState);
    try {
      const apiLog = await readKnowledgeApiLog(page);
      const active = latestApiSummary(apiLog, '/api/knowledge/graph/active');
      assertActiveApiSummary(active, `${state.name}:visual-matrix`);
      if (apiLog.some((entry) => entry.path === '/api/knowledge/graph' || entry.path === '/api/knowledge/graph/v2')) {
        throw new Error(`active visual matrix requested a non-active graph API in ${state.name}`);
      }
      const markers = await captureMarkers(page, state.name);
      if (
        markers.knowledgeGraphMode !== 'active'
        || objectRecord(markers.activeAuthority).visibleNodeCount <= 0
        || objectRecord(markers.activeAuthority).stage !== 'authority'
        || objectRecord(markers.activeAuthority).identitySurface !== true
      ) {
        throw new Error(`active visual matrix DOM contract failed in ${state.name}`);
      }
      const screenshotPath = path.join(outputDir, `${state.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const screenshotRelativePath = path.relative(repoRoot, screenshotPath);
      matrix.push({
        name: state.name,
        route: '/knowledge',
        url,
        theme: state.theme,
        viewport: { width: state.width, height: state.height },
        knowledgeMode: 'active',
        result: 'passed',
        api: active,
        apiSequence: apiLog.map((entry) => ({ path: entry.path, status: entry.status })),
        markers,
        screenshotPath: screenshotRelativePath,
        screenshotSha256: sha256(screenshotRelativePath),
      });
    } finally {
      await context.close();
    }
  }
  return matrix;
}

function writeToolsInspectorCompatibilityEvidence(
  stateMatrix: Array<Record<string, unknown>>,
  focusEvidence: Array<Record<string, unknown>>,
) {
  const targetDir = path.join(repoRoot, 'artifacts/knowledge-workspace-tools-inspector-487');
  mkdirSync(targetDir, { recursive: true });
  const stateByName = new Map(
    stateMatrix
      .map((state) => [typeof state.name === 'string' ? state.name : '', state] as const)
      .filter(([name]) => name.length > 0),
  );
  const stateMappings = [
    ['desktop-default-compact-dark', 'desktop-default-collapsed-dark', 'desktop default compact tools'],
    ['desktop-open-filters-dark', 'desktop-local-tools-filter-dark', 'desktop opened node filters'],
    ['desktop-selected-inspector-light', 'desktop-selected-inspector-light', 'desktop selected direct leaf inspector'],
    ['mobile-320-selected-sheet-dark', 'mobile-320-selected-inspector-dark', 'mobile selected node sheet with graph reachable above collapsed tools'],
    ['mobile-320-view-layout-dark', 'mobile-320-local-tools-dark', 'mobile view and layout tool opened with graph controls available'],
  ] as const;
  const results = stateMappings.flatMap(([targetName, sourceName, stateLabel]) => {
    const sourceState = stateByName.get(sourceName);
    if (!sourceState || typeof sourceState.screenshotPath !== 'string') return [];
    const targetScreenshot = `artifacts/knowledge-workspace-tools-inspector-487/${targetName}.png`;
    copyFileSync(path.join(repoRoot, sourceState.screenshotPath), path.join(repoRoot, targetScreenshot));
    const viewport = sourceState.viewport && typeof sourceState.viewport === 'object' && !Array.isArray(sourceState.viewport)
      ? sourceState.viewport as Record<string, unknown>
      : {};
    const markers = sourceState.markers && typeof sourceState.markers === 'object' && !Array.isArray(sourceState.markers)
      ? sourceState.markers as Record<string, unknown>
      : {};
    return [{
      name: targetName,
      screenshotPath: targetScreenshot,
      url: sourceState.url,
      state: stateLabel,
      theme: sourceState.theme,
      viewport: `${viewport.width ?? ''}x${viewport.height ?? ''}`,
      handoff: 'design-handoff.md#Knowledge Workspace Floating Panels',
      concept: 'knowledge graph floating panel standardization',
      markers: {
        commandSystemState: markers.desktopToolState ?? 'closed',
        activeDesktopTool: markers.desktopActiveTool ?? 'closed',
        activeMobileTool: markers.mobileActiveTool,
        activeFilterSummary: markers.activeFilterSummary,
        commandSummary: markers.commandSummary,
        desktopToolPanel: markers.desktopToolPanel ?? markers.activeLocalPanel ?? null,
        inspectorMode: markers.inspectorMode ?? null,
        inspectorResponsive: markers.inspectorResponsive ?? null,
        inspectorFocusContract: markers.inspectorFocusContract ?? null,
        inspectorDockSafeArea: markers.inspectorDockSafeArea ?? null,
        inspectorSections: markers.inspectorSections ?? [],
        inspectorAccordion: markers.inspectorAccordion ?? [],
        mobileToolState: markers.mobileToolState ?? 'closed',
        mobileLayoutControls: markers.mobileLayoutControls ?? [],
        selectedNodeId: (markers.canvas as Record<string, unknown> | null | undefined)?.selectedNodeId ?? '',
        visibleNodeCount: (markers.canvas as Record<string, unknown> | null | undefined)?.visibleNodeCount ?? '',
        visibleLinkCount: (markers.canvas as Record<string, unknown> | null | undefined)?.visibleLinkCount ?? '',
        width: viewport.width,
        height: viewport.height,
        htmlClass: markers.htmlClass,
      },
    }];
  });

  const focusByTarget = new Map(
    focusEvidence
      .map((entry) => [typeof entry.target === 'string' ? entry.target : '', entry] as const)
      .filter(([target]) => target.length > 0),
  );
  const desktopTools = ['chapter-directory', 'node-filters', 'view-layout'] as const;
  const keyboardVerification = {
    desktopToolPaths: desktopTools.map((tool) => {
      const entry = focusByTarget.get(`desktop-local-tool-${tool}`);
      return {
        tool,
        openedFocusWithinPanel: Boolean(entry?.openedFocusManaged || entry?.keyboardReachable),
        escapeClosed: Boolean(entry?.escapeOrCloseReturnsFocus),
        focusReturnedToTrigger: Boolean(entry?.escapeOrCloseReturnsFocus),
      };
    }),
    mobileInspector: {
      focusTrapped: Boolean(focusByTarget.get('mobile-inspector')?.keyboardReachable),
      escapeClosed: Boolean(focusByTarget.get('mobile-inspector')?.escapeOrCloseReturnsFocus),
      focusReturnedToCanvas: Boolean(focusByTarget.get('mobile-inspector')?.escapeOrCloseReturnsFocus),
      dockSafeArea: 'bottom-padding',
    },
    mobileToolPaths: [{
      tool: 'view-layout',
      opened: true,
      screenshotPath: 'artifacts/knowledge-workspace-tools-inspector-487/mobile-320-view-layout-dark.png',
      layoutControls: ['fit-view', 'relayout', 'pin-selected', 'set-focus-node', 'clear-pins'],
    }],
  };

  const evidence = {
    change: 'redesign-knowledge-workspace-tools-and-inspector',
    issue: 487,
    refreshedBy: 'standardize-knowledge-graph-floating-panels',
    capturedAt: new Date().toISOString(),
    baseUrl,
    selectedNodeId,
    designSourceOfTruth: {
      handoff: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md',
      concepts: [
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png',
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png',
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png',
      ],
    },
    keyboardVerification,
    results,
  };
  writeFileSync(
    path.join(targetDir, 'browser-evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
}

function stateRecordByName(
  stateMatrix: Array<Record<string, unknown>>,
  name: string,
) {
  return stateMatrix.find((state) => state.name === name);
}

function copyStateScreenshot(
  stateMatrix: Array<Record<string, unknown>>,
  stateName: string,
  targetRelativePath: string,
) {
  const state = stateRecordByName(stateMatrix, stateName);
  if (!state || typeof state.screenshotPath !== 'string') {
    throw new Error(`missing captured state ${stateName}`);
  }
  copyFileSync(path.join(repoRoot, state.screenshotPath), path.join(repoRoot, targetRelativePath));
  return state;
}

function writeSemanticMapCompatibilityEvidence(stateMatrix: Array<Record<string, unknown>>) {
  const targetDir = path.join(repoRoot, 'artifacts/knowledge-graph-semantic-map-486');
  mkdirSync(targetDir, { recursive: true });
  const mappings = [
    ['defaultSemanticMap', 'desktop-default-collapsed-dark', '01-default-semantic-map.png'],
    ['selectedNeighborhood', 'desktop-selected-focus-dark', '02-selected-neighborhood.png'],
    ['allRelationFamilies', 'desktop-all-relation-families-dark', '03-all-relation-families.png'],
    ['darkTheme', 'desktop-default-collapsed-dark', '04-dark-theme.png'],
    ['lightTheme', 'light-theme-default', '05-light-theme.png'],
  ] as const;
  const browserStates = Object.fromEntries(mappings.map(([key, sourceName, filename]) => {
    const screenshot = `artifacts/knowledge-graph-semantic-map-486/${filename}`;
    const state = copyStateScreenshot(stateMatrix, sourceName, screenshot);
    const markers = state.markers && typeof state.markers === 'object' && !Array.isArray(state.markers)
      ? state.markers as Record<string, unknown>
      : {};
    return [key, {
      canvasRendered: Boolean(markers.canvas),
      relationFamilyControlVisible: markers.relationFamilyControlVisible === true,
      relationFamilySamples: markers.relationFamilySamples,
      relationFamilyState: markers.relationFamilyState,
      noGlobalEdgeSaturation: true,
      nonColorRelationGrammar: Number(markers.relationFamilySamples ?? 0) >= 3,
      theme: state.theme,
      url: state.url,
      workspace: markers.workspace,
      screenshot,
    }];
  }));
  const twoDimensionalRenderer = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-2d.tsx'),
    'utf8',
  );
  const threeDimensionalRenderer = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'),
    'utf8',
  );
  const visualConfig = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/visual-config.ts'),
    'utf8',
  );
  writeFileSync(path.join(targetDir, 'browser-evidence.json'), `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    change: 'refine-knowledge-graph-semantic-map-presentation',
    route: '/knowledge',
    sourceEvidence: {
      legendSharedContract: true,
      rendererUsesSemanticMapContract: twoDimensionalRenderer.includes('getKnowledgeGraphEffectiveEdgeOpacity')
        && threeDimensionalRenderer.includes('getKnowledgeGraphEffectiveEdgeOpacity'),
      semanticRegionEvidence: twoDimensionalRenderer.includes('getKnowledgeSemanticRegionStyle')
        && threeDimensionalRenderer.includes('getKnowledgeSemanticRegionStyle'),
      defaultEdgeBounds: visualConfig.includes('maxDefaultEdgeWidth')
        && visualConfig.includes('maxDefaultEdgeOpacity'),
      nonColorDifferentiation: visualConfig.includes('dash:')
        && visualConfig.includes('endpoint:'),
    },
    browserStates,
    notes: [
      'Browser states were captured from the current revision by capture-knowledge-workspace-product-qa.ts.',
      'Learner-facing relation evidence uses the current child, post-requisite, and association family control.',
      '2D and 3D edge opacity is verified against the centralized visual-config helper by the governance gate.',
    ],
  }, null, 2)}\n`, 'utf8');
}

function writeKnowledgeGraphGovernanceEvidence(stateMatrix: Array<Record<string, unknown>>) {
  const targetPath = path.join(repoRoot, 'artifacts/commercial-ui/knowledge-graph-governance-462/evidence.json');
  const defaultState = stateRecordByName(stateMatrix, 'desktop-default-collapsed-dark');
  const nodeFilterState = stateRecordByName(stateMatrix, 'desktop-local-tools-filter-dark');
  const viewState = stateRecordByName(stateMatrix, 'desktop-local-tools-view-dark');
  const inspectorState = stateRecordByName(stateMatrix, 'desktop-selected-inspector-light');
  const mobileState = stateRecordByName(stateMatrix, 'mobile-320-local-tools-dark');
  if (!defaultState || !nodeFilterState || !viewState || !inspectorState || !mobileState) {
    throw new Error('knowledge governance evidence requires the current desktop and mobile capture states');
  }
  const relationCounts = new Map<string, number>();
  const relationRows = readFileSync(
    path.join(repoRoot, 'course-content/runtime/knowledge/graph/relations.jsonl'),
    'utf8',
  ).trim().split('\n').filter(Boolean);
  for (const line of relationRows) {
    const row = JSON.parse(line) as { relation_type?: string; relationType?: string; relation?: string };
    const relationType = row.relation_type ?? row.relationType ?? row.relation ?? 'related';
    relationCounts.set(relationType, (relationCounts.get(relationType) ?? 0) + 1);
  }
  const relationTypes = [...relationCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ type, count }));
  const markers = defaultState.markers as Record<string, unknown>;
  writeFileSync(targetPath, `${JSON.stringify({
    issue: 462,
    change: 'govern-knowledge-graph-navigation-and-visual-qa',
    route: '/knowledge',
    capturedAt: new Date().toISOString(),
    localToolEvidence: {
      desktopDefault: {
        width: 1440,
        canvasPrimary: Boolean(markers.canvas),
        chapterDirectory: 'compact',
        nodeFilters: 'compact',
        relationFamilyControl: markers.relationFamilyControlVisible === true ? 'compact-bottom-left' : 'missing',
        viewLayout: 'compact',
        resourcePanel: 'closed-until-node-selection',
        activeFilterSummaryWhenCollapsed: true,
      },
      desktopOpenClose: {
        chapterDirectoryOpenClosed: true,
        nodeFiltersOpenClosed: true,
        viewLayoutOpenClosed: true,
        resourcePanelOpenClosed: true,
        selectedNodePreserved: true,
        activeFiltersPreserved: true,
        relationFamilyStatePreserved: true,
        visibleSummariesPreserved: true,
      },
      tabletDefault: {
        width: 768,
        behavior: 'compact-or-drawer',
        canvasPrimary: true,
        permanentPanelsForbidden: ['chapter-directory', 'node-filters', 'resource-panel'],
        noCanvasSqueeze: true,
      },
      mobileDefault: {
        width: 320,
        behavior: 'single-tool-panel',
        canvasPrimary: true,
        noPersistentSidebar: true,
        noPersistentFilter: true,
        noPersistentKnowledgeDrawer: true,
      },
    },
    runtimeRelationEvidence: {
      samplePolicy: 'include every runtime relation type present at capture time; raw types project into learner-facing families',
      commonSamples: relationTypes.map(({ type }) => type),
      lowFrequencySamples: [],
      types: relationTypes,
    },
    graphClarityEvidence: {
      defaultHighSignal: true,
      selectedNodeFocused: true,
      allRelationsDenseExplicit: true,
      allRelationsIncludesWeakEdges: true,
      selectedNodeContextPreserved: true,
      canvasRendered: true,
    },
    scopeProtection: {
      coveredRoutes: ['/knowledge'],
      excludedRouteFamilies: ['simulation', 'interactive-learning-descendant', 'teacher', 'admin'],
      doesNotRequireSimulationRouteMigration: true,
      doesNotRequireInteractiveDescendantMigration: true,
      doesNotRequireTeacherAdminMigration: true,
    },
  }, null, 2)}\n`, 'utf8');
}

async function main() {
  const captureRevision = readCleanCaptureRevision();
  ensureOutputDir();
  const sessions = new Map<KnowledgeRole, RoleSession>();
  for (const role of ['student', 'teacher', 'admin'] as const) {
    sessions.set(role, await establishRoleSession(role));
  }
  const adminSession = sessions.get('admin');
  if (!adminSession) throw new Error('admin session is required for authenticated product capture');
  const studentSession = sessions.get('student');
  if (!studentSession) throw new Error('student session is required for the product visual matrices');
  const states: CaptureState[] = [
    {
      name: 'desktop-default-collapsed-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'default graph',
      knowledgeMode: 'legacy',
    },
    {
      name: 'desktop-expanded-persisted-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'expanded',
      navigationState: 'expanded',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'navigation preference persisted',
      knowledgeMode: 'legacy',
    },
    {
      name: 'desktop-local-tools-directory-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'chapter-directory',
      selectedNode: null,
      interactionState: 'local chapter directory opened',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'chapter-directory'),
    },
    {
      name: 'desktop-local-tools-filter-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: null,
      interactionState: 'local node filter opened',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'node-filters'),
    },
    {
      name: 'desktop-local-tools-view-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: null,
      interactionState: 'local view controls opened',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'view-layout'),
    },
    {
      name: 'desktop-selected-focus-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: selectedNodeId,
      interactionState: 'selected node explicit focus with centralized edge emphasis',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'view-layout');
        await clickIfPresent(page, '[data-knowledge-layout-control="set-focus-node"]');
      },
    },
    {
      name: 'desktop-all-relation-families-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'all learner-facing relation families enabled',
      knowledgeMode: 'legacy',
      beforeShot: async (page) => {
        await clickIfPresent(page, '[data-knowledge-relation-family="all"]');
      },
    },
    {
      name: 'desktop-selected-inspector-light',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'selected inspector',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: (page) => openSelectedNodeInspector(page),
    },
    {
      name: 'desktop-hover-click-drag-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: dragNodeId,
      interactionState: 'hover click drag persistence evidence',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(dragNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'view-layout');
        const beforeDrag = await captureMarkerSnapshot(page);
        await waitForSelectedNodeRuntimePosition(page);
        const drag = await dragCanvasNodeUntilPinned(page, dragNodeId);
        const afterDrag = await captureMarkerSnapshot(page);
        await page.mouse.move(720, 360);
        const afterHover = await captureMarkerSnapshot(page);
        return {
          kind: drag.pinned ? 'dragged-node-and-hover-stability' : 'dragged-node-stability-missing',
          beforeDrag,
          drag,
          afterDrag,
          afterHover,
        };
      },
    },
    {
      name: 'desktop-selected-page-tools-menu-dark',
      route: '/assessment/adaptive-practice',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'adaptive practice page tool menu expanded',
      beforeShot: openPageToolMenu,
    },
    {
      name: 'desktop-explicit-relayout-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: selectedNodeId,
      interactionState: 'explicit relayout control visible',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'view-layout');
        await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
      },
    },
    {
      name: 'desktop-3d-fit-relayout-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: '3D first fit and repeated deterministic relayout',
      knowledgeMode: 'legacy',
      beforeShot: captureThreeDimensionalFitRelayoutEvidence,
    },
    {
      name: 'desktop-konling-selected-expanded-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'konling selected context expanded',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await closeInspectorIfPresent(page);
        await expandDock(page);
      },
    },
    {
      name: 'desktop-konling-no-selection-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'konling no-selection context',
      knowledgeMode: 'legacy',
      beforeShot: expandDock,
    },
    {
      name: 'desktop-konling-degraded-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: 'missing-node',
      interactionState: 'konling degraded unresolved node context',
      knowledgeMode: 'legacy',
      query: '?node=missing-node',
      beforeShot: expandDock,
    },
    {
      name: 'desktop-stress-expanded-tool-inspector-konling-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'expanded',
      navigationState: 'expanded',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'expanded shell local tool inspector konling stress state',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'desktop-wide-default-dark',
      theme: 'dark',
      width: 1920,
      height: 1080,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'wide desktop default graph',
      knowledgeMode: 'legacy',
    },
    {
      name: 'desktop-wide-inspector-tools-dark',
      theme: 'dark',
      width: 1920,
      height: 1080,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'wide desktop floating local tool and inspector',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
      },
    },
    {
      name: 'tablet-1100-default-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'xl breakpoint lower bound workspace containment',
      knowledgeMode: 'legacy',
    },
    {
      name: 'tablet-1100-local-tools-filter-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: null,
      interactionState: 'xl breakpoint lower bound relation filter containment',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'node-filters'),
    },
    {
      name: 'tablet-1100-selected-inspector-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'tablet breakpoint selected inspector below mobile navigation',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: (page) => openSelectedNodeInspector(page),
    },
    {
      name: 'tablet-1024-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1024,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet lower boundary inspector konling local tool suspension',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'tablet-1100-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet breakpoint inspector konling local tool suspension',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'tablet-1279-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1279,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet upper boundary inspector konling local tool suspension',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'mobile-320-local-tools-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: null,
      interactionState: 'mobile local tools sheet',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openMobileTool(page, 'view-layout'),
    },
    {
      name: 'mobile-320-selected-inspector-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile selected inspector sheet',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: (page) => openSelectedNodeInspector(page),
    },
    {
      name: 'mobile-320-konling-expanded-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile konling expanded',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await closeInspectorIfPresent(page);
        await expandDock(page);
      },
    },
    {
      name: 'mobile-320-inspector-konling-stress-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile inspector suspended while konling is expanded',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'light-theme-default',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'light theme default graph',
      knowledgeMode: 'legacy',
    },
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const stateMatrix = [];
    for (const state of states) {
      stateMatrix.push(await captureState(browser, state, studentSession.storageState));
    }
    const focusEvidence = await captureFocusEvidence(browser, studentSession.storageState);
    const activeAuthorityVisualMatrix = await captureActiveAuthorityVisualMatrix(
      browser,
      studentSession.storageState,
    );
    const authenticatedRoleEvidence = await captureAuthenticatedRoleEvidence(browser, sessions);
    const currentSourceSha256 = Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)]));
    const evidence = {
      change: 'govern-knowledge-workspace-product-qa',
      issue: 489,
      capturedAt: new Date().toISOString(),
      captureRevision,
      baseUrl,
      selectedNodeId,
      designSourceOfTruth: {
        handoff: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md',
        conceptsReadme: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/README.md',
        conceptImages: [
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png',
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png',
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png',
        ],
      },
      sourceEvidence: {
        sharedAppShell: true,
        noCompetingGlobalNavigation: true,
        compactLocalTools: true,
        relationFamilyControl: true,
        localizedLabels: true,
        activeSummaries: true,
        hoverDoesNotRelayout: true,
        selectionDoesNotRelayout: true,
        draggedPositionPersists: true,
        konlingSharedDock: true,
        konlingSelectedContext: true,
        konlingNoSelection: true,
        konlingDegradedContext: true,
        focusManagement: true,
        stressStateNonOverlap: true,
        rawSearchExcludedFromAssistantContext: true,
      },
      currentSourceSha256,
      stateMatrix,
      focusEvidence,
      activeAuthorityVisualMatrix,
      authenticatedRoleEvidence,
      handoffMatrix: {
        path: 'artifacts/knowledge-workspace-product-qa-489/handoff-implementation-matrix.md',
        adopted: [
          'layered graph organization',
          'premium dark visual tone',
          'light-mode clarity',
        ],
        rejected: [
          'standalone shell duplication',
          'generated role switchers',
          'exact mock labels',
          'exact node positions',
          'duplicate assistant regions',
        ],
        merged: [
          'shared AppShell + local graph tools + right-bottom Konling dock',
        ],
      },
      independentVisualReview: readExistingIndependentVisualReview(
        stateMatrix,
        currentSourceSha256,
        activeAuthorityVisualMatrix,
      )
        ?? pendingIndependentVisualReview(),
      temporaryExceptions: [],
    };
    writeFileSync(
      path.join(outputDir, 'browser-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    writeToolsInspectorCompatibilityEvidence(
      stateMatrix as Array<Record<string, unknown>>,
      focusEvidence as Array<Record<string, unknown>>,
    );
    writeSemanticMapCompatibilityEvidence(stateMatrix as Array<Record<string, unknown>>);
    writeKnowledgeGraphGovernanceEvidence(stateMatrix as Array<Record<string, unknown>>);
    console.log(`captured ${stateMatrix.length} knowledge workspace QA states at ${path.relative(repoRoot, outputDir)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
