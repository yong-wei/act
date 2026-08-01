import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildTeacherDiagnosisReportHistoryEvidenceContext,
  TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS,
  teacherDiagnosisReportHistoryEvidenceProblems,
  type TeacherDiagnosisReportHistoryEvidenceManifest,
} from '../../../scripts/tests/teacher-diagnosis-report-history-evidence';

const SHA_40 = 'a'.repeat(40);
const SHA_64 = 'b'.repeat(64);
const temporaryRepositories: string[] = [];

afterEach(() => {
  for (const repository of temporaryRepositories.splice(0)) {
    rmSync(repository, { recursive: true, force: true });
  }
});

function manifest(): TeacherDiagnosisReportHistoryEvidenceManifest {
  return {
    schemaVersion: 'teacher-diagnosis-report-history-evidence.v1',
    captureRevision: {
      commitSha: SHA_40,
      treeSha: 'c'.repeat(40),
      capturedAt: '2026-08-01T08:00:00.000Z',
    },
    generator: {
      path: 'tests/teacher-diagnosis-report-history-evidence.spec.ts',
      sha256: SHA_64,
    },
    fixture: {
      path: 'tests/fixtures/teacher-diagnosis-report-history.ts',
      sha256: SHA_64,
      authorization: 'teacher-owned class and current class member',
    },
    sourceSha256: Object.fromEntries(
      TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS.map((file) => [file, SHA_64]),
    ),
    assertions: {
      authorizedClassScope: true,
      authorizedStudentScope: true,
      unauthorizedAccessFailsClosed: true,
      loading: true,
      empty: true,
      failure: true,
      degraded: true,
      multipleHistorySelection: true,
      serverPreparationLink: true,
      rawEvidenceIdentifiersHidden: true,
    },
    captures: [
      {
        name: 'class-history-1440-light',
        routePath: '/teacher/classes/class-evidence',
        viewport: { width: 1440, height: 1100 },
        screenshot: 'artifacts/commercial-ui/teacher-diagnosis-report-history-1177/playwright/class-history-1440-light.png',
        screenshotSha256: SHA_64,
        consoleErrors: 0,
        pageErrors: 0,
        horizontalOverflow: false,
      },
      {
        name: 'student-history-320-dark',
        routePath: '/teacher/classes/class-evidence/students/student-evidence',
        viewport: { width: 320, height: 844 },
        screenshot: 'artifacts/commercial-ui/teacher-diagnosis-report-history-1177/playwright/student-history-320-dark.png',
        screenshotSha256: SHA_64,
        consoleErrors: 0,
        pageErrors: 0,
        horizontalOverflow: false,
      },
    ],
  };
}

function context() {
  return {
    headCommitSha: SHA_40,
    captureCommitExists: true,
    captureIsHeadAncestor: true,
    captureTreeSha: 'c'.repeat(40),
    changedSourcePathsSinceCapture: [] as string[],
    dirtySourcePaths: [] as string[],
    fileSha256: {
      'tests/teacher-diagnosis-report-history-evidence.spec.ts': SHA_64,
      'tests/fixtures/teacher-diagnosis-report-history.ts': SHA_64,
      ...Object.fromEntries(TEACHER_DIAGNOSIS_REPORT_HISTORY_SOURCE_PATHS.map((file) => [file, SHA_64])),
      'artifacts/commercial-ui/teacher-diagnosis-report-history-1177/playwright/class-history-1440-light.png': SHA_64,
      'artifacts/commercial-ui/teacher-diagnosis-report-history-1177/playwright/student-history-320-dark.png': SHA_64,
    },
  };
}

describe('teacher diagnosis report history evidence', () => {
  it('accepts production-route evidence bound to its capture revision and source bytes', () => {
    expect(teacherDiagnosisReportHistoryEvidenceProblems(manifest(), context())).toEqual([]);
  });

  it('fails closed for review routes, missing states, or incomplete responsive coverage', () => {
    const evidence = manifest();
    evidence.captures[0]!.routePath = '/review/diagnosis-report-history-1177';
    evidence.captures[1]!.viewport.width = 390;
    evidence.assertions.failure = false;

    expect(teacherDiagnosisReportHistoryEvidenceProblems(evidence, context())).toEqual(expect.arrayContaining([
      'capture:class-history-1440-light:route-not-production',
      'capture:student-history-320-dark:missing-320-width',
      'assertion:failure:not-verified',
    ]));
  });

  it('fails closed when revision, source, fixture, screenshot, or worktree bytes drift', () => {
    const current = context();
    current.captureIsHeadAncestor = false;
    current.changedSourcePathsSinceCapture = ['src/features/teacher/teacher-diagnosis-report-history.tsx'];
    current.dirtySourcePaths = ['src/app/teacher/classes/[classId]/page.tsx'];
    current.fileSha256['tests/fixtures/teacher-diagnosis-report-history.ts'] = 'd'.repeat(64);
    current.fileSha256['artifacts/commercial-ui/teacher-diagnosis-report-history-1177/playwright/class-history-1440-light.png'] = 'e'.repeat(64);

    expect(teacherDiagnosisReportHistoryEvidenceProblems(manifest(), current)).toEqual(expect.arrayContaining([
      'capture-revision:not-head-ancestor',
      'capture-revision:source-changed:src/features/teacher/teacher-diagnosis-report-history.tsx',
      'working-tree:source-dirty:src/app/teacher/classes/[classId]/page.tsx',
      'fixture:sha256-mismatch',
      'capture:class-history-1440-light:screenshot:sha256-mismatch',
    ]));
  });

  it('builds revision and dirty-worktree context from the repository', () => {
    const repository = mkdtempSync(join(tmpdir(), 'diagnosis-report-evidence-'));
    temporaryRepositories.push(repository);
    execFileSync('git', ['init'], { cwd: repository, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Evidence Test'], { cwd: repository });
    execFileSync('git', ['config', 'user.email', 'evidence@example.invalid'], { cwd: repository });
    const evidence = manifest();
    const boundPaths = [
      evidence.generator.path,
      evidence.fixture.path,
      ...Object.keys(evidence.sourceSha256),
      ...evidence.captures.map((capture) => capture.screenshot),
    ];
    for (const [index, file] of boundPaths.entries()) {
      const absolutePath = join(repository, file);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, `evidence-file-${index}\n`);
    }
    execFileSync('git', ['add', '.'], { cwd: repository });
    execFileSync('git', ['commit', '-m', 'capture evidence source'], { cwd: repository, stdio: 'ignore' });
    evidence.captureRevision.commitSha = git(repository, ['rev-parse', 'HEAD']);
    evidence.captureRevision.treeSha = git(repository, ['rev-parse', 'HEAD^{tree}']);
    evidence.generator.sha256 = sha256(join(repository, evidence.generator.path));
    evidence.fixture.sha256 = sha256(join(repository, evidence.fixture.path));
    for (const file of Object.keys(evidence.sourceSha256)) {
      evidence.sourceSha256[file] = sha256(join(repository, file));
    }
    for (const capture of evidence.captures) {
      capture.screenshotSha256 = sha256(join(repository, capture.screenshot));
    }

    const cleanContext = buildTeacherDiagnosisReportHistoryEvidenceContext(repository, evidence);
    expect(teacherDiagnosisReportHistoryEvidenceProblems(evidence, cleanContext)).toEqual([]);

    const changedSource = 'src/features/teacher/teacher-diagnosis-report-history.tsx';
    writeFileSync(join(repository, changedSource), 'dirty source\n');
    const dirtyContext = buildTeacherDiagnosisReportHistoryEvidenceContext(repository, evidence);
    expect(teacherDiagnosisReportHistoryEvidenceProblems(evidence, dirtyContext)).toEqual(expect.arrayContaining([
      `working-tree:source-dirty:${changedSource}`,
      `source:${changedSource}:sha256-mismatch`,
    ]));
  });
});

function git(repository: string, args: string[]) {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
}

function sha256(file: string) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
