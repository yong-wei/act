import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

import {
  CAPTURE_REVISION_SOURCE_FILES,
  ADAPTIVE_PATH_QA_PRODUCT_OUTPUT_ROOT,
  REVISION_PROBE_PATH,
  computeCaptureRevisionProof,
  type CaptureRevisionProof,
} from '../../src/lib/commercial-ui-capture-revision';

const repoRoot = path.resolve(__dirname, '../..');
const DEFAULT_DOCK_READY_TIMEOUT_MS = 30_000;
const DEFAULT_DOCK_POLL_INTERVAL_MS = 50;
export const DOCK_SELECTOR = '[data-platform-floating-dock]';
export const PRIMARY_KONLING_SELECTOR =
  '[data-platform-floating-dock] button[data-platform-floating-dock-primary="konling"]';
export const DOCK_REGISTRATION_SELECTOR = '[data-platform-floating-dock-registration="true"]';
export const CAPTURE_SOURCE_FILES = CAPTURE_REVISION_SOURCE_FILES;

type Theme = 'light' | 'dark';
type CaptureState = {
  name: string;
  theme: Theme;
  width: number;
  height: number;
  query: string;
  qaMode?: 'knowledge-product';
  selector?: string;
  beforeScreenshot?: (page: Page) => Promise<void>;
};

export type ExpandedDockState = {
  appShellNavigationState: string | null;
  appShellNavigationPreference: string | null;
  appShellNavigationExpanded: boolean;
  appShellNavigationToggleExpanded: boolean;
  konlingDockState: 'collapsed' | 'expanded' | 'hidden';
  konlingDockTriggerPresent: boolean;
  konlingDockTriggerVisible: boolean;
  konlingDockTriggerDisabled: boolean | null;
  konlingSidebarState: string | null;
  konlingSidebarVisible: boolean;
  konlingSidebarPresentationMode: string | null;
};

export type CaptureRevision = CaptureRevisionProof & {
  sourceFiles: Record<string, string>;
};

export const PRODUCT_OUTPUT_ROOT = ADAPTIVE_PATH_QA_PRODUCT_OUTPUT_ROOT;

const REVISION_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SOURCE_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/u;
const REVISION_PROOF_KEYS = ['clean', 'commitSha', 'sourceFingerprint', 'treeSha'] as const;

type RevisionProbeFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, 'status' | 'json'>>;

export function createRevisionProbeUrl(baseUrl: string) {
  return new URL(REVISION_PROBE_PATH, `${baseUrl}/`).toString();
}

export function parseCaptureRevisionProof(payload: unknown): CaptureRevisionProof {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Revision probe returned a malformed proof.');
  }

  const record = payload as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...REVISION_PROOF_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('Revision probe returned a proof with unexpected fields.');
  }
  if (
    typeof record.commitSha !== 'string'
    || !REVISION_SHA_PATTERN.test(record.commitSha)
    || typeof record.treeSha !== 'string'
    || !REVISION_SHA_PATTERN.test(record.treeSha)
    || typeof record.sourceFingerprint !== 'string'
    || !SOURCE_FINGERPRINT_PATTERN.test(record.sourceFingerprint)
    || typeof record.clean !== 'boolean'
  ) {
    throw new Error('Revision probe returned a proof with invalid fields.');
  }

  return {
    commitSha: record.commitSha,
    treeSha: record.treeSha,
    sourceFingerprint: record.sourceFingerprint,
    clean: record.clean,
  };
}

export async function fetchCaptureRevisionProof(
  baseUrl: string,
  fetcher: RevisionProbeFetcher = fetch,
) {
  const probeUrl = createRevisionProbeUrl(baseUrl);
  let response: Pick<Response, 'status' | 'json'>;
  try {
    response = await fetcher(probeUrl, {
      cache: 'no-store',
      redirect: 'manual',
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Adaptive-path QA revision probe is unreachable: ${probeUrl} (${detail})`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Adaptive-path QA revision probe failed: ${probeUrl} HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Adaptive-path QA revision probe returned invalid JSON: ${probeUrl}`);
  }
  const proof = parseCaptureRevisionProof(payload);
  if (!proof.clean) {
    throw new Error(`Adaptive-path QA revision probe reported a dirty service: ${probeUrl}`);
  }
  return proof;
}

export function assertCaptureRevisionProofMatches(
  expected: CaptureRevisionProof,
  actual: CaptureRevisionProof,
  label = 'capture revision proof',
) {
  if (!actual.clean) {
    throw new Error(`${label} is dirty; refusing to accept capture evidence.`);
  }
  for (const field of ['commitSha', 'treeSha', 'sourceFingerprint'] as const) {
    if (actual[field] !== expected[field]) {
      throw new Error(`${label} mismatch: ${field} expected=${expected[field]} actual=${actual[field]}`);
    }
  }
}

export function assertCaptureRevisionProofUnchanged(
  initial: CaptureRevisionProof,
  current: CaptureRevisionProof,
) {
  assertCaptureRevisionProofMatches(initial, current, 'capture service revision proof');
}

export type DockReadinessSnapshot = {
  targetUrl: string;
  actualUrl: string;
  dockPresent: boolean;
  dockVisible: boolean;
  dockState: string | null;
  registrationPresent: boolean;
  registrationBehavior: string | null;
  registeredControls: string | null;
  primaryPresent: boolean;
  primaryVisible: boolean;
  primaryDisabled: boolean;
  primaryLabel: string | null;
  missingSelectors: string[];
};

type DockReadinessWaitOptions = {
  targetUrl: string;
  actualUrl: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

function gitOutput(repositoryRoot: string, args: string[]) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitBlob(repositoryRoot: string, revision: string, relativePath: string) {
  return execFileSync('git', ['show', `${revision}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: null,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function pathIsWithin(candidate: string, parent: string) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function untrackedOrModifiedPaths(repositoryRoot: string, ignoredPaths: readonly string[]) {
  const status = gitOutput(repositoryRoot, ['status', '--porcelain', '--untracked-files=all']);
  return status
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const statusPath = line.slice(3).trim().replace(/^"|"$/gu, '');
      const absolutePath = path.resolve(repositoryRoot, statusPath);
      return !ignoredPaths.some((ignoredPath) => pathIsWithin(absolutePath, ignoredPath));
    });
}

export function resolveTargetBaseUrl(rawValue = process.env.ADAPTIVE_PATH_QA_BASE_URL) {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(
      'ADAPTIVE_PATH_QA_BASE_URL is required; refusing to fall back to an implicit local service.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid adaptive-path QA target URL: ${value}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Adaptive-path QA target URL must use http or https: ${value}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Adaptive-path QA target URL must not contain credentials, query, or hash.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error(`Adaptive-path QA target URL must use a local loopback host: ${value}`);
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/u, '');
  return parsed.toString().replace(/\/$/u, '');
}

export function resolveOutputDirectory(
  rawValue = process.env.ADAPTIVE_PATH_QA_OUTPUT_DIR,
  repositoryRoot = repoRoot,
) {
  const value = rawValue?.trim();
  if (!value) {
    return path.join(os.tmpdir(), `act-adaptive-path-product-qa-${process.pid}`);
  }
  if (path.isAbsolute(value)) {
    throw new Error(
      `ADAPTIVE_PATH_QA_OUTPUT_DIR must be a relative subpath below ${PRODUCT_OUTPUT_ROOT}.`,
    );
  }

  const productRoot = path.resolve(repositoryRoot, PRODUCT_OUTPUT_ROOT);
  const outputDirectory = path.resolve(productRoot, value);
  if (!pathIsWithin(outputDirectory, productRoot)) {
    throw new Error(
      `ADAPTIVE_PATH_QA_OUTPUT_DIR must remain below ${PRODUCT_OUTPUT_ROOT}: ${value}`,
    );
  }
  return outputDirectory;
}

export function assertSourcePathsExcludeOutput(
  sourceFiles: readonly string[],
  outputDirectory: string,
  repositoryRoot = repoRoot,
) {
  const outputAbsolutePath = path.resolve(outputDirectory);
  for (const sourceFile of sourceFiles) {
    const sourceAbsolutePath = path.resolve(repositoryRoot, sourceFile);
    if (pathIsWithin(sourceAbsolutePath, outputAbsolutePath)) {
      throw new Error(`Capture source list must not include output artifacts: ${sourceFile}`);
    }
  }
}

export function readCaptureRevision(
  repositoryRoot = repoRoot,
  sourceFiles: readonly string[] = CAPTURE_SOURCE_FILES,
  ignoredPaths: readonly string[] = [],
): CaptureRevision {
  const dirtyPaths = untrackedOrModifiedPaths(repositoryRoot, ignoredPaths);
  if (dirtyPaths.length > 0) {
    throw new Error(`Capture requires a clean source tree:\n${dirtyPaths.join('\n')}`);
  }

  const proof = computeCaptureRevisionProof(repositoryRoot, sourceFiles, ignoredPaths);
  if (!proof.clean) {
    throw new Error('Capture requires a clean source tree.');
  }
  const sourceHashes: Record<string, string> = {};
  for (const sourceFile of sourceFiles) {
    gitOutput(repositoryRoot, ['ls-files', '--error-unmatch', '--', sourceFile]);
    const sourcePath = path.join(repositoryRoot, sourceFile);
    if (!existsSync(sourcePath)) throw new Error(`Capture source file is missing: ${sourceFile}`);

    const workingTreeSha = createHash('sha256').update(readFileSync(sourcePath)).digest('hex');
    const committedSha = createHash('sha256').update(gitBlob(repositoryRoot, 'HEAD', sourceFile)).digest('hex');
    if (workingTreeSha !== committedSha) {
      throw new Error(`Capture source file drifted from HEAD: ${sourceFile}`);
    }
    sourceHashes[sourceFile] = workingTreeSha;
  }

  return { ...proof, sourceFiles: sourceHashes };
}

export function assertCaptureRevisionUnchanged(
  initialRevision: CaptureRevision,
  currentRevision: CaptureRevision,
) {
  if (currentRevision.commitSha !== initialRevision.commitSha) {
    throw new Error(`Capture HEAD drifted: ${initialRevision.commitSha}->${currentRevision.commitSha}`);
  }
  if (currentRevision.treeSha !== initialRevision.treeSha) {
    throw new Error(`Capture tree drifted: ${initialRevision.treeSha}->${currentRevision.treeSha}`);
  }
  if (currentRevision.sourceFingerprint !== initialRevision.sourceFingerprint) {
    throw new Error(
      `Capture source fingerprint drifted: ${initialRevision.sourceFingerprint}->${currentRevision.sourceFingerprint}`,
    );
  }
  if (!currentRevision.clean) {
    throw new Error('Capture source tree became dirty during capture.');
  }
  for (const [sourceFile, sourceSha] of Object.entries(initialRevision.sourceFiles)) {
    if (currentRevision.sourceFiles[sourceFile] !== sourceSha) {
      throw new Error(`Capture source file drifted during capture: ${sourceFile}`);
    }
  }
}

export function createCaptureUrl(baseUrl: string, query: string) {
  const url = new URL('/assessment/adaptive-practice', `${baseUrl}/`);
  url.search = query.startsWith('?') ? query.slice(1) : query;
  return url.toString();
}

export function assertCapturePageUrl(expectedUrl: string, actualUrl: string) {
  const expected = new URL(expectedUrl);
  const actual = new URL(actualUrl);
  if (
    actual.origin !== expected.origin
    || actual.pathname !== expected.pathname
    || actual.search !== expected.search
  ) {
    throw new Error(`Capture navigated away from declared target: expected=${expectedUrl} actual=${actualUrl}`);
  }
}

export async function assertTargetServiceReachable(
  targetUrl: string,
  fetcher: (input: string, init?: RequestInit) => Promise<{ status: number }> = fetch,
) {
  try {
    const response = await fetcher(targetUrl, { redirect: 'manual' });
    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Adaptive-path QA target is unreachable: ${targetUrl} (${detail})`);
  }
}

export function dockReadinessSatisfied(snapshot: DockReadinessSnapshot) {
  return snapshot.dockPresent
    && snapshot.dockVisible
    && snapshot.registrationPresent
    && snapshot.primaryPresent
    && snapshot.primaryVisible
    && snapshot.primaryDisabled;
}

export function createDockReadinessTimeoutMessage(snapshot: DockReadinessSnapshot, timeoutMs: number) {
  return [
    `Shared Konling Dock readiness timed out after ${timeoutMs}ms.`,
    `targetUrl=${snapshot.targetUrl}`,
    `actualUrl=${snapshot.actualUrl}`,
    `observedDock=${JSON.stringify({
      dockPresent: snapshot.dockPresent,
      dockVisible: snapshot.dockVisible,
      dockState: snapshot.dockState,
      registrationPresent: snapshot.registrationPresent,
      registrationBehavior: snapshot.registrationBehavior,
      registeredControls: snapshot.registeredControls,
      primaryPresent: snapshot.primaryPresent,
      primaryVisible: snapshot.primaryVisible,
      primaryDisabled: snapshot.primaryDisabled,
      primaryLabel: snapshot.primaryLabel,
    })}`,
    `missingSelectors=${snapshot.missingSelectors.join(',') || 'none'}`,
  ].join(' ');
}

export async function waitForDockReadiness(
  readSnapshot: () => Promise<DockReadinessSnapshot>,
  options: DockReadinessWaitOptions,
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_DOCK_READY_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_DOCK_POLL_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = now() + timeoutMs;
  let snapshot = await readSnapshot();

  while (!dockReadinessSatisfied(snapshot)) {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new Error(createDockReadinessTimeoutMessage(snapshot, timeoutMs));
    }
    await sleep(Math.min(pollIntervalMs, remainingMs));
    snapshot = await readSnapshot();
  }

  return snapshot;
}

export function dockInteractionReadinessSatisfied(snapshot: DockReadinessSnapshot) {
  return snapshot.dockPresent
    && snapshot.dockVisible
    && snapshot.registrationPresent
    && snapshot.primaryPresent
    && snapshot.primaryVisible
    && !snapshot.primaryDisabled;
}

export function createDockInteractionReadinessTimeoutMessage(snapshot: DockReadinessSnapshot, timeoutMs: number) {
  return createDockReadinessTimeoutMessage(snapshot, timeoutMs)
    .replace('Shared Konling Dock readiness', 'Shared Konling Dock interaction readiness');
}

export async function waitForDockInteractionReadiness(
  readSnapshot: () => Promise<DockReadinessSnapshot>,
  options: DockReadinessWaitOptions,
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_DOCK_READY_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_DOCK_POLL_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = now() + timeoutMs;
  let snapshot = await readSnapshot();

  while (!dockInteractionReadinessSatisfied(snapshot)) {
    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      throw new Error(createDockInteractionReadinessTimeoutMessage(snapshot, timeoutMs));
    }
    await sleep(Math.min(pollIntervalMs, remainingMs));
    snapshot = await readSnapshot();
  }

  return snapshot;
}

function sha256File(absolutePath: string) {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

export function resolveManifestOutputRoot(
  outputDirectory: string,
  repositoryRoot = repoRoot,
) {
  const productRoot = path.resolve(repositoryRoot, PRODUCT_OUTPUT_ROOT);
  const resolvedOutput = path.resolve(outputDirectory);
  if (!pathIsWithin(resolvedOutput, productRoot)) return PRODUCT_OUTPUT_ROOT;
  const relativeOutput = path.relative(productRoot, resolvedOutput);
  return relativeOutput
    ? path.posix.join(PRODUCT_OUTPUT_ROOT, relativeOutput.split(path.sep).join('/'))
    : PRODUCT_OUTPUT_ROOT;
}

export function manifestFilePath(
  absolutePath: string,
  stagingDirectory: string,
  outputDirectory = path.resolve(repoRoot, PRODUCT_OUTPUT_ROOT),
  repositoryRoot = repoRoot,
) {
  const relative = path.relative(stagingDirectory, absolutePath);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Capture artifact escaped staging directory: ${absolutePath}`);
  }
  return path.posix.join(
    resolveManifestOutputRoot(outputDirectory, repositoryRoot),
    relative.split(path.sep).join('/'),
  );
}

function pathExists(absolutePath: string) {
  try {
    lstatSync(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function assertNoSymlinkPath(absolutePath: string, boundary: string) {
  const resolvedPath = path.resolve(absolutePath);
  const resolvedBoundary = path.resolve(boundary);
  if (!pathIsWithin(resolvedPath, resolvedBoundary)) {
    throw new Error(`Capture publish path escaped its boundary: ${absolutePath}`);
  }
  if (pathExists(resolvedBoundary) && lstatSync(resolvedBoundary).isSymbolicLink()) {
    throw new Error(`Capture publish path contains a symbolic link: ${resolvedBoundary}`);
  }
  if (pathExists(resolvedPath) && lstatSync(resolvedPath).isSymbolicLink()) {
    throw new Error(`Capture publish path contains a symbolic link: ${resolvedPath}`);
  }

  const relative = path.relative(resolvedBoundary, resolvedPath);
  const segments = relative ? relative.split(path.sep) : [];
  let cursor = resolvedBoundary;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    if (pathExists(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`Capture publish path contains a symbolic link: ${cursor}`);
    }
  }
}

function listRegularFiles(root: string, current = root): string[] {
  const entries = readdirSync(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Capture staging contains a symbolic link: ${absolutePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...listRegularFiles(root, absolutePath));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolutePath));
    } else {
      throw new Error(`Capture staging contains an unsupported entry: ${absolutePath}`);
    }
  }
  return files.sort();
}

function hashDirectoryFiles(root: string) {
  return new Map(listRegularFiles(root).map((relativePath) => [
    relativePath,
    sha256File(path.join(root, relativePath)),
  ]));
}

function assertDirectoryHashesMatch(root: string, expected: Map<string, string>) {
  const actual = hashDirectoryFiles(root);
  if (actual.size !== expected.size) {
    throw new Error(`Published capture file count changed: expected=${expected.size} actual=${actual.size}`);
  }
  for (const [relativePath, expectedSha] of expected) {
    if (actual.get(relativePath) !== expectedSha) {
      throw new Error(`Published capture file changed: ${relativePath}`);
    }
  }
}

/**
 * Publish a fully verified temp capture as one directory replacement. The
 * target is never touched until all capture proofs have passed and every
 * staged file has a recorded hash.
 */
export function publishStagedCapture(
  stagingDirectory: string,
  outputDirectory: string,
  repositoryRoot = repoRoot,
) {
  const stagingRoot = path.resolve(stagingDirectory);
  const target = path.resolve(outputDirectory);
  const productRoot = path.resolve(repositoryRoot, PRODUCT_OUTPUT_ROOT);
  if (!pathExists(stagingRoot) || !lstatSync(stagingRoot).isDirectory()) {
    throw new Error(`Capture staging directory is missing: ${stagingDirectory}`);
  }
  if (pathIsWithin(target, productRoot)) {
    assertNoSymlinkPath(productRoot, path.resolve(repositoryRoot));
    assertNoSymlinkPath(target, productRoot);
  } else {
    assertNoSymlinkPath(target, os.tmpdir());
  }

  const expectedHashes = hashDirectoryFiles(stagingRoot);
  if (expectedHashes.size === 0) {
    throw new Error('Capture staging directory is empty.');
  }

  const parent = path.dirname(target);
  mkdirSync(parent, { recursive: true });
  const sibling = path.join(parent, `.${path.basename(target)}.staging-${process.pid}-${randomUUID()}`);
  const backup = path.join(parent, `.${path.basename(target)}.backup-${process.pid}-${randomUUID()}`);
  let targetMovedToBackup = false;
  let targetInstalled = false;

  try {
    cpSync(stagingRoot, sibling, { recursive: true, force: false, errorOnExist: true });
    assertDirectoryHashesMatch(sibling, expectedHashes);

    if (pathExists(target)) {
      if (lstatSync(target).isSymbolicLink()) {
        throw new Error(`Capture publish target is a symbolic link: ${target}`);
      }
      renameSync(target, backup);
      targetMovedToBackup = true;
    }
    renameSync(sibling, target);
    targetInstalled = true;
    assertDirectoryHashesMatch(target, expectedHashes);
    if (targetMovedToBackup) rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (targetInstalled && pathExists(target)) rmSync(target, { recursive: true, force: true });
    if (targetMovedToBackup && pathExists(backup)) renameSync(backup, target);
    throw error;
  } finally {
    if (pathExists(sibling)) rmSync(sibling, { recursive: true, force: true });
  }
}

async function setTheme(page: Page, theme: Theme, qaMode?: CaptureState['qaMode']) {
  await page.addInitScript(({ nextTheme, qaMode }) => {
    window.localStorage.setItem('ai-obe-theme', nextTheme);
    window.localStorage.setItem('act:app-shell-navigation-preference', 'collapsed');
    if (qaMode === 'knowledge-product') {
      window.localStorage.setItem('act:knowledge-product-qa', 'true');
      (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
    } else {
      window.localStorage.removeItem('act:knowledge-product-qa');
      delete (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__;
    }
  }, { nextTheme: theme, qaMode });
}

async function readDockReadiness(page: Page, targetUrl: string): Promise<DockReadinessSnapshot> {
  return page.evaluate(({ targetUrl, actualUrl, dockSelector, primarySelector, registrationSelector }) => {
    const dock = document.querySelector(dockSelector);
    const registration = document.querySelector(registrationSelector);
    const primary = document.querySelector(primarySelector);
    const primaryButton = primary instanceof HTMLButtonElement ? primary : null;
    const dockPresent = Boolean(dock);
    const dockRect = dock?.getBoundingClientRect();
    const dockStyle = dock ? window.getComputedStyle(dock) : null;
    const dockVisible = Boolean(
      dockRect
      && dockStyle
      && dockRect.width > 0
      && dockRect.height > 0
      && dockStyle.display !== 'none'
      && dockStyle.visibility !== 'hidden',
    );
    const registrationPresent = Boolean(registration);
    const primaryPresent = Boolean(primaryButton);
    const primaryRect = primaryButton?.getBoundingClientRect();
    const primaryStyle = primaryButton ? window.getComputedStyle(primaryButton) : null;
    const primaryVisible = Boolean(
      primaryRect
      && primaryStyle
      && primaryRect.width > 0
      && primaryRect.height > 0
      && primaryStyle.display !== 'none'
      && primaryStyle.visibility !== 'hidden',
    );
    const primaryDisabled = primaryButton?.disabled === true;
    const missingSelectors = [
      !dockPresent || !dockVisible ? dockSelector : null,
      !registrationPresent ? registrationSelector : null,
      !primaryPresent || !primaryVisible ? primarySelector : null,
      primaryPresent && primaryVisible && !primaryDisabled ? `${primarySelector}[disabled]` : null,
    ].filter((selector): selector is string => Boolean(selector));

    return {
      targetUrl,
      actualUrl,
      dockPresent,
      dockVisible,
      dockState: dock?.getAttribute('data-platform-floating-dock') ?? null,
      registrationPresent,
      registrationBehavior: registration?.getAttribute('data-platform-floating-dock-behavior') ?? null,
      registeredControls: registration?.getAttribute('data-platform-floating-dock-controls') ?? null,
      primaryPresent,
      primaryVisible,
      primaryDisabled,
      primaryLabel: primary?.getAttribute('data-platform-floating-dock-trigger-label') ?? null,
      missingSelectors,
    };
  }, {
    targetUrl,
    actualUrl: page.url(),
    dockSelector: DOCK_SELECTOR,
    primarySelector: PRIMARY_KONLING_SELECTOR,
    registrationSelector: DOCK_REGISTRATION_SELECTOR,
  });
}

export async function readExpandedDockState(page: Page): Promise<ExpandedDockState> {
  return page.evaluate(({ dockSelector, primarySelector }) => {
    const appShell = document.querySelector<HTMLElement>('[data-app-shell-layout="collapsible"]');
    const navigationToggle = appShell?.querySelector<HTMLButtonElement>('button[aria-label="收起平台导航"]');
    const dock = document.querySelector<HTMLElement>(dockSelector);
    const dockPrimary = document.querySelector<HTMLButtonElement>(primarySelector);
    const sidebar = document.querySelector<HTMLElement>('[data-global-ai-sidebar]');
    const sidebarState = sidebar?.getAttribute('data-global-ai-sidebar') ?? null;
    const dockRect = dock?.getBoundingClientRect();
    const dockStyle = dock ? window.getComputedStyle(dock) : null;
    const dockVisible = Boolean(dockRect && dockStyle
      && dockRect.width > 0
      && dockRect.height > 0
      && dockStyle.display !== 'none'
      && dockStyle.visibility !== 'hidden');
    const dockPrimaryRect = dockPrimary?.getBoundingClientRect();
    const dockPrimaryStyle = dockPrimary ? window.getComputedStyle(dockPrimary) : null;
    const dockPrimaryVisible = Boolean(dockPrimaryRect && dockPrimaryStyle
      && dockPrimaryRect.width > 0
      && dockPrimaryRect.height > 0
      && dockPrimaryStyle.display !== 'none'
      && dockPrimaryStyle.visibility !== 'hidden');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : null;
    const sidebarVisible = sidebarState === 'open' && Boolean(sidebarRect && sidebarStyle
      && sidebarRect.width > 0
      && sidebarRect.height > 0
      && sidebarStyle.display !== 'none'
      && sidebarStyle.visibility !== 'hidden');

    return {
      appShellNavigationState: appShell?.getAttribute('data-app-shell-navigation-state') ?? null,
      appShellNavigationPreference: appShell?.getAttribute('data-app-shell-navigation-preference') ?? null,
      appShellNavigationExpanded: appShell?.getAttribute('data-app-shell-navigation-state') === 'expanded',
      appShellNavigationToggleExpanded: navigationToggle?.getAttribute('aria-expanded') === 'true',
      konlingDockState: sidebarVisible
        ? 'expanded'
        : dock && dockVisible
          ? 'collapsed'
          : 'hidden',
      konlingDockTriggerPresent: Boolean(dockPrimary),
      konlingDockTriggerVisible: dockPrimaryVisible,
      konlingDockTriggerDisabled: dockPrimary?.disabled ?? null,
      konlingSidebarState: sidebarState,
      konlingSidebarVisible: sidebarVisible,
      konlingSidebarPresentationMode: sidebar?.getAttribute('data-konling-presentation-mode') ?? null,
    };
  }, {
    dockSelector: DOCK_SELECTOR,
    primarySelector: PRIMARY_KONLING_SELECTOR,
  });
}

export function assertExpandedDockState(state: ExpandedDockState) {
  const issues = [
    state.appShellNavigationState === 'expanded' ? null : `appShellNavigationState=${state.appShellNavigationState ?? 'missing'}`,
    state.appShellNavigationPreference === 'expanded' ? null : `appShellNavigationPreference=${state.appShellNavigationPreference ?? 'missing'}`,
    state.appShellNavigationExpanded ? null : 'appShellNavigationExpanded=false',
    state.appShellNavigationToggleExpanded ? null : 'appShellNavigationToggleExpanded=false',
    state.konlingDockState === 'expanded' ? null : `konlingDockState=${state.konlingDockState}`,
    state.konlingSidebarState === 'open' ? null : `konlingSidebarState=${state.konlingSidebarState ?? 'missing'}`,
    state.konlingSidebarVisible ? null : 'konlingSidebarVisible=false',
    state.konlingSidebarPresentationMode === 'side'
      ? null
      : `konlingSidebarPresentationMode=${state.konlingSidebarPresentationMode ?? 'missing'}`,
  ].filter((issue): issue is string => Boolean(issue));
  if (issues.length > 0) {
    throw new Error(`Expanded AppShell and Konling dock state failed validation: ${issues.join(', ')}\n${JSON.stringify(state)}`);
  }
}

export async function openExpandedAppShellAndDock(page: Page) {
  const shell = page.locator('[data-app-shell-layout="collapsible"]');
  await shell.waitFor({ state: 'attached', timeout: 10_000 });
  const expandNavigationButton = shell.getByRole('button', { name: '展开平台导航', exact: true });
  if (await expandNavigationButton.count()) {
    await expandNavigationButton.click();
  }
  await page.waitForFunction(() => {
    const appShell = document.querySelector<HTMLElement>('[data-app-shell-layout="collapsible"]');
    const navigationToggle = appShell?.querySelector<HTMLButtonElement>('button[aria-label="收起平台导航"]');
    return appShell?.getAttribute('data-app-shell-navigation-state') === 'expanded'
      && appShell.getAttribute('data-app-shell-navigation-preference') === 'expanded'
      && navigationToggle?.getAttribute('aria-expanded') === 'true';
  }, undefined, { timeout: 10_000, polling: 'raf' });

  const targetUrl = page.url();
  await waitForDockInteractionReadiness(
    () => readDockReadiness(page, targetUrl),
    { targetUrl, actualUrl: page.url() },
  );
  await page.locator(PRIMARY_KONLING_SELECTOR).click();
  await page.waitForFunction(() => {
    const sidebar = document.querySelector<HTMLElement>('[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]');
    if (!sidebar) return false;
    const rect = sidebar.getBoundingClientRect();
    const style = window.getComputedStyle(sidebar);
    return rect.width > 0
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && sidebar.getAttribute('data-konling-presentation-mode') === 'side';
  }, undefined, { timeout: 10_000, polling: 'raf' });

  const state = await readExpandedDockState(page);
  assertExpandedDockState(state);
}

async function assertDisabledDock(page: Page) {
  const targetUrl = page.url();
  await waitForDockReadiness(
    () => readDockReadiness(page, targetUrl),
    { targetUrl, actualUrl: page.url() },
  );
}

async function openPathModule(page: Page, moduleId: string) {
  const modulePanel = page.locator(`[data-adaptive-path-module="${moduleId}"]`).first();
  if (!await modulePanel.count()) return;
  if (await modulePanel.getAttribute('data-adaptive-path-module-state') === 'expanded') return;
  await modulePanel.getByRole('button').first().click();
  await page.waitForFunction((id) => {
    return document.querySelector(`[data-adaptive-path-module="${id}"]`)?.getAttribute('data-adaptive-path-module-state') === 'expanded';
  }, moduleId, { timeout: 10_000, polling: 'raf' });
}

async function openPathSelectionModule(page: Page) {
  await openPathModule(page, 'path-selection');
}

async function openCurrentPathModule(page: Page) {
  await openPathModule(page, 'current-path');
}

async function openLearningRecordModule(page: Page) {
  await openPathModule(page, 'learning-record');
}

async function selectCompletedNode(page: Page) {
  await openCurrentPathModule(page);
  const completed = page.locator('[data-adaptive-path-node-state="completed"]').first();
  if (await completed.count()) {
    await completed.click();
    await page.waitForSelector('[data-adaptive-path-node-detail="inline"]', { timeout: 10_000 });
  }
}

async function openSkipWarning(page: Page) {
  await openCurrentPathModule(page);
  const current = page.locator('[data-adaptive-path-node-state="current"]').first();
  if (await current.count()) {
    await current.click();
    await page.waitForSelector('[data-adaptive-path-node-detail="inline"]', { timeout: 10_000 });
  }
  const skipButton = page
    .locator('[data-adaptive-path-node-detail="inline"]')
    .getByRole('button', { name: '跳过', exact: true })
    .first();
  if (await skipButton.count()) {
    await skipButton.click();
    await page.waitForSelector('[data-adaptive-path-skip-warning="visible"]', { timeout: 10_000 });
  }
}

const states: CaptureState[] = [
  {
    name: 'generation-main-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'generation-main-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'konling-parameter-panel-desktop-dark',
    theme: 'dark',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
    beforeScreenshot: assertDisabledDock,
    selector: '[data-platform-floating-dock]',
  },
  {
    name: 'cold-start-starter-paths-mobile-light',
    theme: 'light',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'path-comparison-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-selection',
    beforeScreenshot: openPathSelectionModule,
    selector: '[data-learning-path-product-surface]',
  },
  {
    name: 'path-comparison-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-selection',
    beforeScreenshot: openPathSelectionModule,
    selector: '[data-learning-path-product-surface]',
  },
  {
    name: 'active-path-execution-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: openCurrentPathModule,
    selector: '[data-adaptive-path-execution-surface="active-route"]',
  },
  {
    name: 'active-path-execution-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: openCurrentPathModule,
    selector: '[data-adaptive-path-execution-surface="active-route"]',
  },
  {
    name: 'node-detail-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: selectCompletedNode,
    selector: '[data-adaptive-path-node-detail="inline"]',
  },
  {
    name: 'skip-warning-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: openSkipWarning,
    selector: '[data-adaptive-path-skip-warning="visible"]',
  },
  {
    name: 'history-evidence-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=evidence-review',
    beforeScreenshot: openLearningRecordModule,
    selector: '[data-adaptive-path-history-surface]',
  },
  {
    name: 'history-evidence-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=evidence-review',
    beforeScreenshot: openLearningRecordModule,
    selector: '[data-adaptive-path-history-surface]',
  },
  {
    name: 'app-shell-expanded-dock-desktop-dark',
    theme: 'dark',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution&qa=knowledge-product',
    qaMode: 'knowledge-product',
    beforeScreenshot: openExpandedAppShellAndDock,
  },
];

async function collectSignals(page: Page, state: CaptureState, screenshotPath: string) {
  return page.evaluate(({ name, theme, width, screenshotPath }) => {
    const routeMap = document.querySelector('[data-adaptive-path-route-map="complete"]');
    const question = document.querySelector('[data-adaptive-practice-question="active"]');
    const questionSummary = document.querySelector('[data-adaptive-practice-question="summary"]');
    const dock = document.querySelector('[data-page-floating-controls], [data-platform-floating-dock]');
    const appShell = document.querySelector('[data-app-shell-layout="collapsible"]');
    const navigationToggle = appShell?.querySelector<HTMLButtonElement>('button[aria-label="收起平台导航"]');
    const dockPrimary = document.querySelector<HTMLButtonElement>('[data-platform-floating-dock] button[data-platform-floating-dock-primary="konling"]');
    const konlingSidebar = document.querySelector<HTMLElement>('[data-global-ai-sidebar]');
    const isVisible = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden';
    };
    const konlingSidebarState = konlingSidebar?.getAttribute('data-global-ai-sidebar') ?? null;
    const konlingSidebarVisible = konlingSidebarState === 'open' && isVisible(konlingSidebar);
    const routeFlow = document.querySelector('[data-adaptive-path-route-flow="connected"]');
    const comparison = document.querySelector('[data-learning-path-options-layout="route-modules"]');
    const routeModules = Array.from(document.querySelectorAll('[data-learning-path-option-module="route"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
    const attachedActionGroups = routeModules
      .map((module) => module.querySelector('[data-learning-path-option-actions="attached"]'))
      .filter((element): element is Element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
    const forbiddenPatterns = [
      'Readiness Gate',
      'missing-rules-graph-path-payload',
      'missing-konling-context',
      'terminal-validation-unavailable',
      'policyFamily',
      'stage',
      'no-path',
      'low-evidence',
    ];
    const text = document.body.innerText;
    const missingRaw = Array.from(text.matchAll(/\bmissing-[a-z0-9-]+/gi)).map((match) => match[0]);
    return {
      name,
      theme,
      width,
      screenshotPath,
      title: document.querySelector('h1')?.textContent?.trim() ?? '',
      htmlClass: document.documentElement.className,
      colorScheme: document.documentElement.style.colorScheme,
      storedTheme: window.localStorage.getItem('ai-obe-theme'),
      routeMapPresent: Boolean(routeMap),
      routeFlowConnected: routeFlow?.getAttribute('data-adaptive-path-route-flow') === 'connected',
      routeNodeCount: document.querySelectorAll('[data-adaptive-path-node]').length,
      questionActive: Boolean(question),
      questionSummary: Boolean(questionSummary),
      comparisonLayout: comparison?.getAttribute('data-learning-path-options-layout') ?? '',
      routeModuleCount: routeModules.length,
      attachedActionGroupCount: attachedActionGroups.length,
      routeModulesAttached: routeModules.length > 0 && routeModules.length === attachedActionGroups.length,
      dockPresent: Boolean(dock),
      dockRect: dock ? (() => {
        const rect = dock.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })() : null,
      bodyWidth: document.body.getBoundingClientRect().width,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      appShellNavigationState: appShell?.getAttribute('data-app-shell-navigation-state') ?? null,
      appShellNavigationPreference: appShell?.getAttribute('data-app-shell-navigation-preference') ?? null,
      appShellNavigationExpanded: appShell?.getAttribute('data-app-shell-navigation-state') === 'expanded',
      appShellNavigationToggleExpanded: navigationToggle?.getAttribute('aria-expanded') === 'true',
      konlingDockState: konlingSidebarVisible
        ? 'expanded'
        : dock && isVisible(dock)
          ? 'collapsed'
          : 'hidden',
      konlingDockTriggerPresent: Boolean(dockPrimary),
      konlingDockTriggerVisible: isVisible(dockPrimary),
      konlingDockTriggerDisabled: dockPrimary?.disabled ?? null,
      konlingSidebarState,
      konlingSidebarVisible,
      konlingSidebarPresentationMode: konlingSidebar?.getAttribute('data-konling-presentation-mode') ?? null,
      forbidden: [
        ...forbiddenPatterns.filter((pattern) => text.includes(pattern)),
        ...missingRaw,
      ],
    };
    }, { name: state.name, theme: state.theme, width: state.width, screenshotPath });
}

type CaptureSignal = Awaited<ReturnType<typeof collectSignals>>;

function assertPathComparisonSignals(signals: CaptureSignal[]) {
  const requiredStates = ['path-comparison-desktop-light', 'path-comparison-mobile-dark'];
  const failures: Array<{ name: string; issues: string[]; signal?: CaptureSignal }> = [];

  for (const stateName of requiredStates) {
    const signal = signals.find((entry) => entry.name === stateName);
    if (!signal) {
      failures.push({ name: stateName, issues: ['missing-signal'] });
      continue;
    }

    const issues: string[] = [];
    if (signal.comparisonLayout !== 'route-modules') {
      issues.push(`comparisonLayout=${signal.comparisonLayout || 'missing'}`);
    }
    if (signal.routeModuleCount < 1) {
      issues.push(`routeModuleCount=${signal.routeModuleCount}`);
    }
    if (signal.attachedActionGroupCount !== signal.routeModuleCount) {
      issues.push(`attachedActionGroupCount=${signal.attachedActionGroupCount}`);
    }
    if (!signal.routeModulesAttached) {
      issues.push('routeModulesAttached=false');
    }

    if (issues.length > 0) {
      failures.push({ name: stateName, issues, signal });
    }
  }

  if (failures.length > 0) {
    throw new Error(`Adaptive path comparison route modules failed validation:\n${JSON.stringify(failures, null, 2)}`);
  }
}

async function main() {
  const targetBaseUrl = resolveTargetBaseUrl();
  const outputDir = resolveOutputDirectory();
  assertSourcePathsExcludeOutput(CAPTURE_SOURCE_FILES, outputDir);
  await assertTargetServiceReachable(targetBaseUrl);
  const initialRevision = readCaptureRevision(repoRoot, CAPTURE_SOURCE_FILES);
  const initialServiceProof = await fetchCaptureRevisionProof(targetBaseUrl);
  assertCaptureRevisionProofMatches(initialRevision, initialServiceProof, 'initial target service revision proof');
  const stagingDir = mkdtempSync(path.join(os.tmpdir(), `act-adaptive-path-product-qa-${process.pid}-`));
  try {
    const browser = await chromium.launch({ headless: true });
    const captures = [];
    const signals: CaptureSignal[] = [];
    try {
      for (const state of states) {
        const page = await browser.newPage({ viewport: { width: state.width, height: state.height } });
        await setTheme(page, state.theme);
        const targetUrl = createCaptureUrl(targetBaseUrl, state.query);
        const response = await page.goto(targetUrl, { waitUntil: 'networkidle' });
        if (!response || response.status() >= 400) {
          throw new Error(
            `Adaptive-path QA navigation failed: targetUrl=${targetUrl} actualUrl=${page.url()} status=${response?.status() ?? 'no-response'}`,
          );
        }
        assertCapturePageUrl(targetUrl, page.url());
        await page.waitForSelector('[data-adaptive-path-center="generation-selection"]', { timeout: 30000 });
        if (state.beforeScreenshot) await state.beforeScreenshot(page);
        const absolutePath = path.join(stagingDir, `${state.name}.png`);
        const manifestPath = manifestFilePath(absolutePath, stagingDir, outputDir);
        if (state.selector) {
          await page.locator(state.selector).first().screenshot({ path: absolutePath });
        } else {
          await page.screenshot({ path: absolutePath, fullPage: true });
        }
        const sha256 = sha256File(absolutePath);
        const signal = await collectSignals(page, state, manifestPath);
        if (state.name === 'app-shell-expanded-dock-desktop-dark') {
          assertExpandedDockState(signal as ExpandedDockState);
        }
        captures.push({
          name: state.name,
          theme: state.theme,
          width: state.width,
          height: state.height,
          url: page.url(),
          targetUrl,
          selector: state.selector,
          file: manifestPath,
          sha256,
          assertions: {
            appShellNavigationState: signal.appShellNavigationState,
            appShellNavigationPreference: signal.appShellNavigationPreference,
            appShellNavigationExpanded: signal.appShellNavigationExpanded,
            appShellNavigationToggleExpanded: signal.appShellNavigationToggleExpanded,
            konlingDockState: signal.konlingDockState,
            konlingDockTriggerPresent: signal.konlingDockTriggerPresent,
            konlingDockTriggerVisible: signal.konlingDockTriggerVisible,
            konlingDockTriggerDisabled: signal.konlingDockTriggerDisabled,
            konlingSidebarState: signal.konlingSidebarState,
            konlingSidebarVisible: signal.konlingSidebarVisible,
            konlingSidebarPresentationMode: signal.konlingSidebarPresentationMode,
          },
        });
        signals.push(signal);
        await page.close();
      }
    } finally {
      await browser.close();
    }

    assertPathComparisonSignals(signals);

    const finalRevision = readCaptureRevision(
      repoRoot,
      CAPTURE_SOURCE_FILES,
    );
    const finalServiceProof = await fetchCaptureRevisionProof(targetBaseUrl);
    assertCaptureRevisionProofMatches(finalRevision, finalServiceProof, 'final target service revision proof');
    assertCaptureRevisionProofUnchanged(initialServiceProof, finalServiceProof);
    const postProbeRevision = readCaptureRevision(
      repoRoot,
      CAPTURE_SOURCE_FILES,
    );
    assertCaptureRevisionUnchanged(initialRevision, postProbeRevision);
    assertCaptureRevisionProofMatches(postProbeRevision, finalServiceProof, 'post-probe local revision proof');

    writeFileSync(path.join(stagingDir, 'capture-manifest.json'), `${JSON.stringify({
      schemaVersion: 'adaptive-path-product-qa-capture.v2',
      capturedAt: new Date().toISOString(),
      baseUrl: targetBaseUrl,
      targetBaseUrl,
      workspaceClean: postProbeRevision.clean,
      captureRevision: finalServiceProof.commitSha,
      captureTreeSha: finalServiceProof.treeSha,
      captureSourceFingerprint: finalServiceProof.sourceFingerprint,
      captureRevisionProof: finalServiceProof,
      captureSourceFiles: [...CAPTURE_SOURCE_FILES],
      sourceFiles: [...CAPTURE_SOURCE_FILES],
      outputDirectory: resolveManifestOutputRoot(outputDir),
      captureStateAssertions: captures.map((capture) => ({ name: capture.name, ...capture.assertions })),
      captures,
    }, null, 2)}\n`);
    writeFileSync(path.join(stagingDir, 'visual-signals.json'), `${JSON.stringify(signals, null, 2)}\n`);
    publishStagedCapture(stagingDir, outputDir);
    console.log(`Captured ${captures.length} adaptive path QA states in ${manifestFilePath(path.join(outputDir, 'capture-manifest.json'), outputDir, outputDir)}`);
  } finally {
    if (pathExists(stagingDir)) rmSync(stagingDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
