import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';

import { createMeasurementReceipt } from './receipts';
import type { MeasurementReceipt } from './types';

export interface MeasuredCommandInput {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly recordedCommand: string;
  readonly scope: string;
  readonly cacheMode: string;
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly parse: (result: { status: number | null; stdout: string; stderr: string }) => {
    aggregate: Record<string, number | string>;
    fingerprints: string[];
  };
}

function toRepoPath(repoRoot: string, value: string): string {
  const normalized = value.replaceAll('\\', '/');
  const root = repoRoot.replaceAll('\\', '/').replace(/\/$/u, '');
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  if (isAbsolute(normalized)) return relative(repoRoot, normalized).replaceAll('\\', '/');
  return normalized;
}

function toolVersions(): Record<string, string> {
  const versions: Record<string, string> = { node: process.version };
  try {
    versions.npm = spawnSync('npm', ['--version'], { encoding: 'utf8' }).stdout.trim();
  } catch {
    versions.npm = 'unknown';
  }
  return versions;
}

export function captureMeasuredCommand(input: MeasuredCommandInput): MeasurementReceipt {
  const started = new Date().toISOString();
  const startedMs = Date.now();
  const result = spawnSync(input.command, [...input.args], {
    cwd: input.cwd,
    encoding: 'utf8',
    env: input.env ?? process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedMs;
  const parsed = input.parse({
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  });
  return createMeasurementReceipt({
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    command: input.recordedCommand,
    scope: input.scope,
    platform: `${process.platform}-${process.arch}`,
    toolVersions: toolVersions(),
    cacheMode: input.cacheMode,
    capturedAt: started,
    exitStatus: result.status ?? 1,
    aggregate: { durationMs, ...parsed.aggregate },
    fingerprints: parsed.fingerprints.slice(0, 50),
  });
}

export function captureTypecheckReceipt(repoRoot: string, sourceCommit: string, sourceTree: string): MeasurementReceipt {
  return captureMeasuredCommand({
    sourceCommit,
    sourceTree,
    command: 'npx',
    args: ['tsc', '--noEmit', '--incremental', 'false', '--pretty', 'false'],
    recordedCommand: 'npx tsc --noEmit --incremental false --pretty false',
    scope: 'tsconfig.json',
    cacheMode: 'cold',
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=${process.env.NODE_MAX_OLD_SPACE_SIZE ?? '8192'}`.trim(),
    },
    parse: ({ status, stdout, stderr }) => {
      const output = `${stdout}\n${stderr}`;
      const errors = [...output.matchAll(/error TS\d+/gu)].length;
      return {
        aggregate: {
          errorCount: errors,
        },
        fingerprints: status === 0 ? ['tsc:ok'] : [`tsc:exit:${status}`, `tsc:errors:${errors}`],
      };
    },
  });
}

export function captureVitestReceipt(repoRoot: string, sourceCommit: string, sourceTree: string): MeasurementReceipt {
  const dir = mkdtempSync(join(tmpdir(), 'architecture-census-'));
  const outputFile = join(dir, 'vitest.json');
  const sidecarFile = join(dir, 'unhandled.json');
  try {
    return captureMeasuredCommand({
      sourceCommit,
      sourceTree,
      command: 'npx',
      args: [
        'vitest',
        'run',
        '--reporter=json',
        `--outputFile=${outputFile}`,
        '--reporter=./src/lib/architecture-census/vitest-unhandled-reporter.ts',
      ],
      recordedCommand: 'npx vitest run --reporter=json --outputFile=<tmpdir>/vitest.json --reporter=./src/lib/architecture-census/vitest-unhandled-reporter.ts',
      scope: 'vitest unit',
      cacheMode: 'cold',
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --disable-warning=DEP0205`.trim(),
        ARCHITECTURE_CENSUS_VITEST_SIDECAR: sidecarFile,
      },
      parse: ({ status }) => {
        let passed = 0;
        let failed = 0;
        let unhandledErrors: number | string = 'unparsed';
        const failing: string[] = [];
        const failedFiles = new Set<string>();
        try {
          const report = JSON.parse(readFileSync(outputFile, 'utf8')) as {
            numPassedTests?: number;
            numFailedTests?: number;
            testResults?: Array<{
              name?: string;
              status?: string;
              assertionResults?: Array<{ status?: string; fullName?: string; title?: string }>;
            }>;
          };
          passed = report.numPassedTests ?? 0;
          failed = report.numFailedTests ?? 0;
          for (const file of report.testResults ?? []) {
            const filePath = toRepoPath(repoRoot, file.name ?? 'file');
            for (const assertion of file.assertionResults ?? []) {
              if (assertion.status === 'failed') {
                failedFiles.add(filePath);
                failing.push(`${filePath}::${assertion.fullName ?? assertion.title ?? 'test'}`);
              }
            }
            if (file.status === 'failed') failedFiles.add(filePath);
          }
        } catch {
          failing.push('vitest-json-unparsed');
        }
        try {
          const sidecar = JSON.parse(readFileSync(sidecarFile, 'utf8')) as { unhandledErrorCount?: number };
          if (typeof sidecar.unhandledErrorCount === 'number') {
            unhandledErrors = sidecar.unhandledErrorCount;
          }
        } catch {
          failing.push('vitest-unhandled-unparsed');
        }
        failing.sort();
        return {
          aggregate: {
            passed,
            failed,
            filesFailed: failedFiles.size,
            unhandledErrors,
          },
          fingerprints: status === 0 && failed === 0 && unhandledErrors === 0
            ? ['vitest:ok']
            : [`vitest:exit:${status}`, `vitest:failed:${failed}`, `vitest:unhandled:${unhandledErrors}`, ...failing],
        };
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function writeReceipt(path: string, receipt: MeasurementReceipt): void {
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
}
