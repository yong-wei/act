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
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, readlink, readdir } from 'node:fs/promises';
import path from 'node:path';

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

interface GitTreeBlob {
  mode: string;
  object: string;
}

interface WorkingTreeBlob {
  mode: string;
  bytes: Buffer;
}

function gitBlobSha1(bytes: Buffer): string {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.byteLength}\u0000`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function gitTreeForDirectory(
  gitRoot: string,
  revision: string,
  relativeDirectory: string,
  fail: CaptureFail,
): Map<string, GitTreeBlob> {
  const result = spawnSync(
    'git',
    ['ls-tree', '-r', '-z', '--full-tree', revision, '--', relativeDirectory],
    { cwd: gitRoot, encoding: 'buffer' },
  );
  if (result.status !== 0) {
    fail(`ACT capture Git tree could not be read for ${relativeDirectory}`);
  }
  const output = Buffer.isBuffer(result.stdout)
    ? result.stdout
    : Buffer.from(result.stdout ?? '');
  const entries = new Map<string, GitTreeBlob>();
  for (const record of output.toString('utf8').split('\u0000')) {
    if (!record) continue;
    const separator = record.indexOf('\t');
    if (separator < 0) fail(`ACT capture Git tree entry is malformed for ${relativeDirectory}`);
    const [mode, type, object] = record.slice(0, separator).split(' ');
    const relativePath = record.slice(separator + 1).replaceAll('\\', '/');
    if (type !== 'blob' || !mode || !object || !relativePath) {
      fail(`ACT capture Git tree entry is not a regular file for ${relativePath || relativeDirectory}`);
    }
    entries.set(relativePath, { mode, object });
  }
  if (entries.size === 0) fail(`ACT capture Git tree has no files for ${relativeDirectory}`);
  return entries;
}

function workingTreeMode(fileMode: number, symbolicLink: boolean, relativePath: string): string {
  if (symbolicLink) return '120000';
  if ((fileMode & 0o170000) !== 0o100000) {
    throw new Error(`ACT capture directory contains unsupported file type: ${relativePath}`);
  }
  return (fileMode & 0o111) !== 0 ? '100755' : '100644';
}

async function collectWorkingTreeBlobs(
  absoluteDirectory: string,
  relativeDirectory: string,
  fail: CaptureFail,
): Promise<Map<string, WorkingTreeBlob>> {
  let directoryStat;
  try {
    directoryStat = await lstat(absoluteDirectory);
  } catch {
    fail(`ACT capture directory is missing: ${relativeDirectory}`);
  }
  if (!directoryStat!.isDirectory()) fail(`ACT capture path is not a directory: ${relativeDirectory}`);

  const entries = new Map<string, WorkingTreeBlob>();
  async function visit(absolutePath: string, relativePath: string): Promise<void> {
    const fileStat = await lstat(absolutePath);
    if (fileStat.isDirectory()) {
      const children = await readdir(absolutePath);
      for (const child of children) {
        await visit(path.join(absolutePath, child), path.posix.join(relativePath, child));
      }
      return;
    }
    if (!fileStat.isFile() && !fileStat.isSymbolicLink()) {
      fail(`ACT capture directory contains unsupported file type: ${relativePath}`);
    }
    const bytes = fileStat.isSymbolicLink()
      ? Buffer.from(await readlink(absolutePath), 'utf8')
      : await readFile(absolutePath);
    entries.set(relativePath, {
      mode: workingTreeMode(fileStat.mode, fileStat.isSymbolicLink(), relativePath),
      bytes,
    });
  }
  await visit(absoluteDirectory, relativeDirectory);
  return entries;
}

/**
 * Compare every file in a captured Git directory with the current filesystem,
 * including ignored and untracked files which `git status` intentionally omits.
 * This is an explicit closure assertion for callers that execute directory
 * consumers such as Prisma migrations; the general capture resolver above
 * retains its existing tracked-path semantics.
 */
export async function assertGitDirectoryMatchesWorkingTree(options: {
  gitRoot: string;
  revision: string;
  relativeDirectory: string;
  fail: CaptureFail;
}): Promise<void> {
  const relativeDirectory = options.relativeDirectory.replaceAll('\\', '/');
  if (
    path.posix.isAbsolute(relativeDirectory)
    || relativeDirectory === '..'
    || relativeDirectory.startsWith('../')
    || relativeDirectory.includes('\u0000')
  ) {
    options.fail(`ACT capture directory is not repository-relative: ${options.relativeDirectory}`);
  }
  const gitEntries = gitTreeForDirectory(
    options.gitRoot,
    options.revision,
    relativeDirectory,
    options.fail,
  );
  const workingEntries = await collectWorkingTreeBlobs(
    path.join(options.gitRoot, relativeDirectory),
    relativeDirectory,
    options.fail,
  );
  for (const [relativePath, expected] of gitEntries) {
    const actual = workingEntries.get(relativePath);
    if (!actual) options.fail(`ACT capture directory file is missing: ${relativePath}`);
    if (actual.mode !== expected.mode) {
      options.fail(`ACT capture directory mode drift: ${relativePath}`);
    }
    if (gitBlobSha1(actual.bytes) !== expected.object) {
      options.fail(`ACT capture directory content drift: ${relativePath}`);
    }
  }
  for (const relativePath of workingEntries.keys()) {
    if (!gitEntries.has(relativePath)) {
      options.fail(`ACT capture directory contains undeclared file: ${relativePath}`);
    }
  }
}

/** Adapter / schema paths always bound for public Bundle intake. */
export const PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS = [
  'scripts/actkg-release/public-bundle-v1.ts',
  'scripts/actkg-release/public-bundle-router.ts',
  'scripts/actkg-release/public-bundle-types.ts',
  'scripts/actkg-release/bundle-compatibility-registry.ts',
  // Shared digest primitives imported by public-bundle-v1 (canonicalJson/sha256).
  'scripts/actkg-release/authoritative-release.ts',
  'scripts/actkg-release/capture-revision.ts',
  'scripts/actkg-release/actkg-canonical-digests.ts',
  'scripts/actkg-release/schemas/public-bundle',
] as const;

/** Independent adapter / schema paths bound only for public Bundle v2 intake. */
export const PUBLIC_BUNDLE_V2_ADAPTER_CAPTURE_PATHS = [
  ...PUBLIC_BUNDLE_ADAPTER_CAPTURE_PATHS,
  'scripts/actkg-release/public-bundle-v2.ts',
  'scripts/actkg-release/public-bundle-v2-admission.ts',
  'scripts/actkg-release/bundle-compatibility-registry-v2.ts',
  'scripts/actkg-release/schemas/public-bundle-v2',
] as const;

/** Frozen historical adapter paths bound for legacy-exact routing. */
export const LEGACY_V02_ADAPTER_CAPTURE_PATHS = [
  'scripts/actkg-release/ctkg-0-2-aggregate-release.ts',
  'scripts/actkg-release/public-bundle-router.ts',
  'scripts/actkg-release/capture-revision.ts',
  'course-content/authoring/knowledge/releases/release-set.lock.json',
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.2',
] as const;
