import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const REVISION_PROBE_PATH = '/api/internal/local-qa/revision';

/**
 * Product evidence is published only below this versioned, repository-relative
 * root. The capture runner accepts a relative subpath below the root; it never
 * accepts an arbitrary repository or filesystem destination.
 */
export const ADAPTIVE_PATH_QA_PRODUCT_OUTPUT_ROOT =
  'artifacts/commercial-ui/adaptive-path-product-qa-516';

/**
 * Keep this list versioned with the capture contract. Both the local runner
 * and the development service probe use it without accepting caller input.
 */
export const CAPTURE_REVISION_SOURCE_FILES = [
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/components/platform/app-shell.tsx',
  'src/components/shared/page-floating-controls.tsx',
  'scripts/tests/capture-adaptive-path-product-qa.ts',
  'src/lib/commercial-ui-capture-revision.ts',
  'src/app/api/internal/local-qa/revision/route.ts',
] as const;

export type CaptureRevisionProof = {
  commitSha: string;
  treeSha: string;
  sourceFingerprint: string;
  clean: boolean;
};

function gitOutput(repositoryRoot: string, args: string[]) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function pathIsWithin(candidate: string, parent: string) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function dirtyStatusPaths(repositoryRoot: string, ignoredPaths: readonly string[]) {
  return gitOutput(repositoryRoot, ['status', '--porcelain', '--untracked-files=all'])
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const statusPath = line.slice(3).trim().replace(/^"|"$/gu, '');
      const absolutePath = path.resolve(repositoryRoot, statusPath);
      return !ignoredPaths.some((ignoredPath) => (
        pathIsWithin(absolutePath, path.resolve(repositoryRoot, ignoredPath))
      ));
    });
}

function sourceFingerprint(repositoryRoot: string, sourceFiles: readonly string[]) {
  const hash = createHash('sha256');
  for (const sourceFile of [...sourceFiles].sort()) {
    const sourcePath = path.join(repositoryRoot, sourceFile);
    if (!existsSync(sourcePath)) {
      throw new Error(`Capture revision source file is missing: ${sourceFile}`);
    }
    hash.update(sourceFile);
    hash.update('\0');
    hash.update(readFileSync(sourcePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function computeCaptureRevisionProof(
  repositoryRoot = process.cwd(),
  sourceFiles: readonly string[] = CAPTURE_REVISION_SOURCE_FILES,
  ignoredPaths: readonly string[] = [],
): CaptureRevisionProof {
  const status = dirtyStatusPaths(repositoryRoot, ignoredPaths);
  const commitSha = gitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
  const treeSha = gitOutput(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{tree}']);
  if (!/^[0-9a-f]{40}$/u.test(commitSha) || !/^[0-9a-f]{40}$/u.test(treeSha)) {
    throw new Error('Capture revision proof is missing a valid commit or tree SHA.');
  }

  return {
    commitSha,
    treeSha,
    sourceFingerprint: sourceFingerprint(repositoryRoot, sourceFiles),
    clean: status.length === 0,
  };
}
