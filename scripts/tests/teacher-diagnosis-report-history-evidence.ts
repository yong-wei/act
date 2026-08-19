export const TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS = [
  'scripts/tests/teacher-diagnosis-report-history-evidence.ts',
  'src/app/teacher/layout.tsx',
  'src/app/teacher/classes/[classId]/page.tsx',
  'src/app/teacher/classes/[classId]/students/[studentId]/page.tsx',
  'src/app/globals.css',
  'src/components/platform/role-workspace-shell.tsx',
  'src/features/adaptive/diagnosis-surface-panel.tsx',
  'src/features/teacher/teacher-diagnosis-report-history.tsx',
  'src/features/teacher/teacher-diagnosis-report-history-projection.ts',
  'src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts',
  'src/app/api/teacher/classes/[classId]/diagnosis-reports/preflight/route.ts',
  'src/app/api/teacher/diagnosis-generation-jobs/[jobId]/route.ts',
  'src/lib/auth.ts',
  'src/lib/diagnosis-generation.ts',
  'src/lib/diagnosis-generation-preflight.ts',
  'src/lib/diagnosis-persistence.ts',
] as const;

interface EvidenceCapture {
  name: string;
  routePath: string;
  viewport: { width: number; height: number };
  screenshot: string;
  screenshotSha256: string;
  consoleErrors: number;
  pageErrors: number;
  horizontalOverflow: boolean;
}

export interface TeacherDiagnosisReportHistoryEvidenceManifest {
  schemaVersion: 'teacher-diagnosis-report-history-evidence.v1';
  captureRevision: {
    commitSha: string;
    treeSha: string;
    capturedAt: string;
  };
  generator: { path: string; sha256: string };
  fixture: { path: string; sha256: string; authorization: string };
  sourceSha256: Record<string, string>;
  assertions: {
    authorizedClassScope: boolean;
    authorizedStudentScope: boolean;
    unauthorizedAccessFailsClosed: boolean;
    loading: boolean;
    empty: boolean;
    failure: boolean;
    degraded: boolean;
    multipleHistorySelection: boolean;
    serverPreparationLink: boolean;
    rawEvidenceIdentifiersHidden: boolean;
    generationQueued: boolean;
    generationCompleted: boolean;
    generationTimedOut: boolean;
    generationRetry: boolean;
    generationPreflight: boolean;
    forcedGenerationReason: boolean;
  };
  captures: EvidenceCapture[];
}

export interface TeacherDiagnosisReportHistoryEvidenceContext {
  headCommitSha: string;
  captureCommitExists: boolean;
  captureIsHeadAncestor: boolean;
  captureTreeSha: string;
  changedSourcePathsSinceCapture: string[];
  dirtySourcePaths: string[];
  fileSha256: Record<string, string>;
}

const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = 'artifacts/commercial-ui/teacher-diagnosis-report-history-1177/playwright/manifest.json';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;
const SHA_256 = /^[0-9a-f]{64}$/;
const REQUIRED_ASSERTIONS = [
  'authorizedClassScope',
  'authorizedStudentScope',
  'unauthorizedAccessFailsClosed',
  'loading',
  'empty',
  'failure',
  'degraded',
  'multipleHistorySelection',
  'serverPreparationLink',
  'rawEvidenceIdentifiersHidden',
  'generationQueued',
  'generationCompleted',
  'generationTimedOut',
  'generationRetry',
  'generationPreflight',
  'forcedGenerationReason',
] as const;

export function teacherDiagnosisReportHistoryEvidenceProblems(
  manifest: TeacherDiagnosisReportHistoryEvidenceManifest,
  context: TeacherDiagnosisReportHistoryEvidenceContext,
): string[] {
  const problems: string[] = [];
  const revision = manifest.captureRevision;

  if (manifest.schemaVersion !== 'teacher-diagnosis-report-history-evidence.v1') {
    problems.push('manifest:schema-version-invalid');
  }
  if (!FULL_GIT_SHA.test(revision.commitSha)) problems.push('capture-revision:commit-not-full-sha');
  if (!FULL_GIT_SHA.test(revision.treeSha)) problems.push('capture-revision:tree-not-full-sha');
  if (!Number.isFinite(Date.parse(revision.capturedAt))) problems.push('capture-revision:captured-at-invalid');
  if (!context.captureCommitExists) problems.push('capture-revision:commit-missing');
  if (context.captureTreeSha !== revision.treeSha) problems.push('capture-revision:tree-mismatch');
  if (!context.captureIsHeadAncestor) problems.push('capture-revision:not-head-ancestor');

  for (const sourcePath of context.changedSourcePathsSinceCapture) {
    problems.push(`capture-revision:source-changed:${sourcePath}`);
  }
  for (const sourcePath of context.dirtySourcePaths) {
    problems.push(`working-tree:source-dirty:${sourcePath}`);
  }

  verifyFileHash(problems, 'generator', manifest.generator.path, manifest.generator.sha256, context);
  verifyFileHash(problems, 'fixture', manifest.fixture.path, manifest.fixture.sha256, context);
  if (!manifest.fixture.authorization.trim()) problems.push('fixture:authorization-missing');

  for (const sourcePath of TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS) {
    const recordedHash = manifest.sourceSha256[sourcePath];
    if (!recordedHash) {
      problems.push(`source:${sourcePath}:sha256-missing`);
      continue;
    }
    verifyFileHash(problems, `source:${sourcePath}`, sourcePath, recordedHash, context);
  }

  for (const assertion of REQUIRED_ASSERTIONS) {
    if (manifest.assertions[assertion] !== true) problems.push(`assertion:${assertion}:not-verified`);
  }

  const classCapture = manifest.captures.find((capture) => capture.name === 'class-history-1440-light');
  const studentCapture = manifest.captures.find((capture) => capture.name === 'student-history-320-dark');
  verifyCapture(problems, classCapture, context, {
    name: 'class-history-1440-light',
    route: /^\/teacher\/classes\/[^/]+$/,
    width: 1440,
  });
  verifyCapture(problems, studentCapture, context, {
    name: 'student-history-320-dark',
    route: /^\/teacher\/classes\/[^/]+\/students\/[^/]+$/,
    width: 320,
  });
  verifyCapture(problems, manifest.captures.find((capture) => capture.name === 'class-generation-queued-1440-light'), context, {
    name: 'class-generation-queued-1440-light', route: /^\/teacher\/classes\/[^/]+$/, width: 1440,
  });
  verifyCapture(problems, manifest.captures.find((capture) => capture.name === 'class-generation-completed-1440-light'), context, {
    name: 'class-generation-completed-1440-light', route: /^\/teacher\/classes\/[^/]+$/, width: 1440,
  });
  verifyCapture(problems, manifest.captures.find((capture) => capture.name === 'class-generation-preflight-no-change-1440-light'), context, {
    name: 'class-generation-preflight-no-change-1440-light', route: /^\/teacher\/classes\/[^/]+$/, width: 1440,
  });
  verifyCapture(problems, manifest.captures.find((capture) => capture.name === 'student-generation-timeout-320-dark'), context, {
    name: 'student-generation-timeout-320-dark', route: /^\/teacher\/classes\/[^/]+\/students\/[^/]+$/, width: 320,
  });
  verifyCapture(problems, manifest.captures.find((capture) => capture.name === 'student-generation-retry-320-dark'), context, {
    name: 'student-generation-retry-320-dark', route: /^\/teacher\/classes\/[^/]+\/students\/[^/]+$/, width: 320,
  });

  return problems;
}

export function buildTeacherDiagnosisReportHistoryEvidenceContext(
  repositoryRoot: string,
  manifest: TeacherDiagnosisReportHistoryEvidenceManifest,
): TeacherDiagnosisReportHistoryEvidenceContext {
  const captureCommitSha = manifest.captureRevision.commitSha;
  const captureCommitExists = gitSucceeds(repositoryRoot, ['cat-file', '-e', `${captureCommitSha}^{commit}`]);
  const headCommitSha = git(repositoryRoot, ['rev-parse', 'HEAD']);
  const captureIsHeadAncestor = captureCommitExists
    && gitSucceeds(repositoryRoot, ['merge-base', '--is-ancestor', captureCommitSha, headCommitSha]);
  const captureTreeSha = captureCommitExists
    ? git(repositoryRoot, ['rev-parse', `${captureCommitSha}^{tree}`])
    : '';
  const changedSourcePathsSinceCapture = captureIsHeadAncestor
    ? lines(git(repositoryRoot, [
      'diff',
      '--name-only',
      `${captureCommitSha}..${headCommitSha}`,
      '--',
      ...TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS,
    ]))
    : [];
  const dirtySourcePaths = gitRaw(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    ...TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS,
  ]).split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
  const boundFiles = new Set([
    manifest.generator.path,
    manifest.fixture.path,
    ...TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS,
    ...manifest.captures.map((capture) => capture.screenshot),
  ]);
  const fileSha256 = Object.fromEntries([...boundFiles].flatMap((file) => {
    const absolutePath = path.join(repositoryRoot, file);
    return existsSync(absolutePath) ? [[file, sha256EvidenceFile(absolutePath)]] : [];
  }));

  return {
    headCommitSha,
    captureCommitExists,
    captureIsHeadAncestor,
    captureTreeSha,
    changedSourcePathsSinceCapture,
    dirtySourcePaths,
    fileSha256,
  };
}

export function runTeacherDiagnosisReportHistoryEvidenceGate(repositoryRoot = REPOSITORY_ROOT) {
  const manifest = (
    JSON.parse(readFileSync(path.join(repositoryRoot, MANIFEST_PATH), 'utf8'))
  ) as unknown as TeacherDiagnosisReportHistoryEvidenceManifest;
  const context = buildTeacherDiagnosisReportHistoryEvidenceContext(repositoryRoot, manifest);
  const problems = teacherDiagnosisReportHistoryEvidenceProblems(manifest, context);
  assert.deepEqual(problems, [], `teacher diagnosis report history evidence failed:\n${problems.join('\n')}`);
}

function verifyCapture(
  problems: string[],
  capture: EvidenceCapture | undefined,
  context: TeacherDiagnosisReportHistoryEvidenceContext,
  expected: { name: string; route: RegExp; width: number },
) {
  if (!capture) {
    problems.push(`capture:${expected.name}:missing`);
    return;
  }
  if (!expected.route.test(capture.routePath)) problems.push(`capture:${expected.name}:route-not-production`);
  if (capture.viewport.width !== expected.width) {
    problems.push(`capture:${expected.name}:missing-${expected.width}-width`);
  }
  if (capture.consoleErrors !== 0) problems.push(`capture:${expected.name}:console-errors`);
  if (capture.pageErrors !== 0) problems.push(`capture:${expected.name}:page-errors`);
  if (capture.horizontalOverflow) problems.push(`capture:${expected.name}:horizontal-overflow`);
  verifyFileHash(problems, `capture:${expected.name}:screenshot`, capture.screenshot, capture.screenshotSha256, context);
}

function verifyFileHash(
  problems: string[],
  label: string,
  file: string,
  expectedHash: string,
  context: TeacherDiagnosisReportHistoryEvidenceContext,
) {
  if (!SHA_256.test(expectedHash)) {
    problems.push(`${label}:sha256-invalid`);
    return;
  }
  const actualHash = context.fileSha256[file];
  if (!actualHash) problems.push(`${label}:file-missing`);
  else if (actualHash !== expectedHash) problems.push(`${label}:sha256-mismatch`);
}

function git(repositoryRoot: string, args: string[]) {
  return gitRaw(repositoryRoot, args).trim();
}

function gitRaw(repositoryRoot: string, args: string[]) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitSucceeds(repositoryRoot: string, args: string[]) {
  try {
    execFileSync('git', args, { cwd: repositoryRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function sha256EvidenceFile(file: string) {
  const bytes = readFileSync(file);
  const content = path.extname(file).toLowerCase() === '.png'
    ? bytes
    : Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
  return createHash('sha256').update(content).digest('hex');
}

if (require.main === module) {
  runTeacherDiagnosisReportHistoryEvidenceGate();
}
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
