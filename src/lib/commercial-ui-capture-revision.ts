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
  'src/app/globals.css',
  'src/app/api/ai/konling-continuity/route.ts',
  'src/app/api/assessment/next-question/route.ts',
  'src/app/api/assessment/submit-answer/route.ts',
  'src/components/ai/global-ai-sidebar.tsx',
  'src/components/ai/konling-continuity-card.tsx',
  'src/components/platform/app-shell.tsx',
  'src/components/providers/global-ai-provider.tsx',
  'src/components/shared/page-floating-controls.tsx',
  'src/features/assessment/adaptive-persistence.ts',
  'src/lib/konling-continuity-assessment.ts',
  'src/lib/konling-learning-continuity.ts',
  'scripts/tests/capture-adaptive-path-product-qa.ts',
  'artifacts/issue-1168-konling-continuity/browser-acceptance.mjs',
  'artifacts/issue-1168-konling-continuity/browser-evidence-provenance.mjs',
  'src/lib/commercial-ui-capture-revision.ts',
  'src/app/api/internal/local-qa/revision/route.ts',
] as const;

/**
 * This list defines the runtime bytes that are allowed to back the #1440
 * evidence capture. It deliberately excludes the evidence output directory:
 * the runner verifies a clean worktree before it publishes new screenshots.
 */
export const DIAGNOSIS_REPORT_DELIVERY_CAPTURE_SOURCE_FILES = [
  'prisma/schema.prisma',
  'src/app/api/diagnosis-reports/[reportId]/student-safe/route.ts',
  'src/app/api/diagnosis-reports/[reportId]/student-safe/pdf/route.ts',
  'src/app/api/teacher/classes/[classId]/diagnosis-reports/[reportId]/route.ts',
  'src/app/api/teacher/classes/[classId]/diagnosis-reports/[reportId]/pdf/route.ts',
  'src/app/api/teacher/classes/[classId]/diagnosis-reports/[reportId]/dispositions/route.ts',
  'src/app/diagnosis-reports/[reportId]/page.tsx',
  'src/app/teacher/classes/[classId]/diagnosis-reports/[reportId]/page.tsx',
  'src/features/teacher/diagnosis-report-delivery-view.tsx',
  'src/lib/diagnosis-report-delivery-projection.ts',
  'src/lib/diagnosis-report-delivery.ts',
  'src/lib/diagnosis-report-pdf.ts',
  'src/lib/diagnosis-report-delivery-evidence.ts',
  'playwright.config.ts',
  'tests/diagnosis-report-delivery-evidence.spec.ts',
  'src/lib/commercial-ui-capture-revision.ts',
  'src/lib/commercial-ui-capture-revision-runtime.ts',
  'src/app/api/internal/local-qa/revision/route.ts',
] as const;

export type CaptureRevisionProfile = 'adaptive-path' | 'diagnosis-report-delivery';

export type CaptureRevisionProof = {
  commitSha: string;
  treeSha: string;
  sourceFingerprint: string;
  clean: boolean;
};

export function captureRevisionSourceFiles(
  profile = process.env.ACT_LOCAL_QA_CAPTURE_PROFILE,
): readonly string[] {
  if (!profile || profile === 'adaptive-path') return CAPTURE_REVISION_SOURCE_FILES;
  if (profile === 'diagnosis-report-delivery') return DIAGNOSIS_REPORT_DELIVERY_CAPTURE_SOURCE_FILES;
  throw new Error(`Unsupported commercial UI capture profile: ${profile}`);
}

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
  sourceFiles: readonly string[] = captureRevisionSourceFiles(),
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
