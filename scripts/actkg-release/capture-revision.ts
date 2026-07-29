/**
 * Trusted ACT capture-revision resolution for public Bundle intake.
 *
 * Invariants:
 * - Always resolve the real current Git HEAD of `gitRoot` via process Git.
 * - Always require protected intake paths to be free of staged, unstaged, and
 *   untracked drift relative to that HEAD.
 * - Always require protected paths to be tracked in the same repository.
 * - An explicit `expectedCaptureRevision` is only an equality assertion against
 *   the resolved HEAD. It never skips cleanliness or tracking checks.
 * - There is no allowDirty switch and no caller-injected Git runner on the
 *   public resolve path. Loaders and routers must call this function only.
 */
import { spawnSync } from 'node:child_process';

export const CAPTURE_COMMIT = /^[0-9a-f]{40}$/u;

export type CaptureFail = (message: string) => never;

function realGit(
  gitRoot: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('git', args, { cwd: gitRoot, encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function readHead(gitRoot: string, fail: CaptureFail): string {
  const revision = realGit(gitRoot, ['rev-parse', '--verify', 'HEAD']);
  const value = revision.stdout.trim();
  if (revision.status !== 0 || !CAPTURE_COMMIT.test(value)) {
    fail('ACT capture Git revision is unavailable');
  }
  return value;
}

function assertTrackedInputs(
  gitRoot: string,
  trackedPaths: string[],
  fail: CaptureFail,
): void {
  if (trackedPaths.length === 0) {
    fail('ACT capture requires at least one tracked intake path');
  }
  const tracked = realGit(gitRoot, ['ls-files', '--error-unmatch', '--', ...trackedPaths]);
  if (tracked.status !== 0) {
    fail('ACT capture inputs must belong to the same Git HEAD');
  }
}

/**
 * Fail closed when any protected path has staged, unstaged, or untracked drift.
 */
function assertProtectedInputsClean(
  gitRoot: string,
  trackedPaths: string[],
  fail: CaptureFail,
): void {
  if (trackedPaths.length === 0) {
    fail('ACT capture requires at least one protected intake path');
  }
  const status = realGit(gitRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    ...trackedPaths,
  ]);
  if (status.status !== 0) {
    fail('ACT capture Git status could not be verified');
  }
  if (status.stdout.trim()) {
    fail('ACT capture requires clean protected Git inputs');
  }
}

/**
 * Resolve a trusted capture revision using real process Git only.
 *
 * Order is fixed:
 * 1. protected-input cleanliness
 * 2. protected-input tracking on the same HEAD
 * 3. real current HEAD
 * 4. optional equality assertion against expectedCaptureRevision
 */
export function resolveTrustedCaptureRevision(options: {
  gitRoot: string;
  trackedPaths: string[];
  /**
   * Optional expected revision. Compared to the real current HEAD only after
   * cleanliness and tracking succeed. Never authorizes a dirty tree.
   */
  expectedCaptureRevision?: string;
  fail: CaptureFail;
}): string {
  const { gitRoot, trackedPaths, fail } = options;

  if (
    options.expectedCaptureRevision !== undefined
    && !CAPTURE_COMMIT.test(options.expectedCaptureRevision)
  ) {
    fail('ACT capture Git revision is invalid');
  }

  assertProtectedInputsClean(gitRoot, trackedPaths, fail);
  assertTrackedInputs(gitRoot, trackedPaths, fail);
  const head = readHead(gitRoot, fail);

  if (
    options.expectedCaptureRevision !== undefined
    && options.expectedCaptureRevision !== head
  ) {
    fail('expected captureRevision must equal the current Git HEAD');
  }

  return head;
}

/** Adapter / schema paths always bound for public Bundle intake. */
export const PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS = [
  'scripts/actkg-release/public-bundle-v1.ts',
  'scripts/actkg-release/public-bundle-router.ts',
  'scripts/actkg-release/public-bundle-types.ts',
  'scripts/actkg-release/bundle-compatibility-registry.ts',
  'scripts/actkg-release/capture-revision.ts',
  'scripts/actkg-release/schemas/public-bundle',
] as const;

/** Frozen historical adapter paths bound for legacy-exact routing. */
export const LEGACY_V02_ADAPTER_CAPTURE_PATHS = [
  'scripts/actkg-release/ctkg-0-2-aggregate-release.ts',
  'scripts/actkg-release/public-bundle-router.ts',
  'scripts/actkg-release/capture-revision.ts',
  'course-content/authoring/knowledge/releases/release-set.lock.json',
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2',
] as const;
