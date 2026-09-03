import { isAbsolute, relative } from 'node:path';

export interface VitestExecutionSummary {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: readonly string[];
  readonly unhandledErrors: number;
  readonly failures: readonly VitestFailureRecord[];
}

export interface VitestFailureRecord {
  readonly testIdentity: string;
  readonly failureStage: string;
  readonly errorClass: string;
  readonly errorSummary: string;
}

interface VitestJsonReport {
  readonly numPassedTests?: number;
  readonly numFailedTests?: number;
  readonly testResults?: ReadonlyArray<{
    readonly name?: string;
    readonly status?: string;
    readonly assertionResults?: ReadonlyArray<{
      readonly status?: string;
      readonly fullName?: string;
      readonly title?: string;
      readonly failureMessages?: readonly string[];
    }>;
  }>;
}

export function parseVitestJson(text: string, repoRoot = process.cwd()): VitestExecutionSummary {
  const report = JSON.parse(text) as VitestJsonReport;
  const skipped: string[] = [];
  const failures: VitestFailureRecord[] = [];
  let failed = report.numFailedTests ?? 0;
  for (const file of report.testResults ?? []) {
    const filePath = toRepoPath(repoRoot, file.name ?? 'file');
    for (const assertion of file.assertionResults ?? []) {
      const identity = `${filePath}::${assertion.fullName ?? assertion.title ?? 'test'}`;
      if (assertion.status === 'skipped' || assertion.status === 'pending' || assertion.status === 'todo') {
        skipped.push(identity);
      }
      if (assertion.status === 'failed') {
        if ((report.numFailedTests ?? 0) === 0) failed += 1;
        failures.push({
          testIdentity: identity,
          failureStage: 'assertion',
          errorClass: 'assertion-failure',
          errorSummary: boundedSummary(assertion.failureMessages?.[0] ?? 'assertion failed'),
        });
      }
    }
  }
  return {
    passed: report.numPassedTests ?? 0,
    failed,
    skipped: [...new Set(skipped)].sort(),
    unhandledErrors: 0,
    failures: failures.sort((left, right) => left.testIdentity.localeCompare(right.testIdentity)),
  };
}

function boundedSummary(value: string): string {
  return value.replace(/\s+/gu, ' ').replace(/(?:\/Users\/|\/home\/|\/private\/|\/var\/folders\/)[^\s]+/gu, '<path>').trim().slice(0, 200);
}

export function parseUnhandledSidecar(text: string): number {
  const sidecar = JSON.parse(text) as { unhandledErrorCount?: number };
  return typeof sidecar.unhandledErrorCount === 'number' ? sidecar.unhandledErrorCount : 0;
}

function toRepoPath(repoRoot: string, value: string): string {
  const normalized = value.replaceAll('\\', '/');
  const root = repoRoot.replaceAll('\\', '/').replace(/\/$/u, '');
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  if (isAbsolute(normalized)) return relative(repoRoot, normalized).replaceAll('\\', '/');
  return normalized;
}
