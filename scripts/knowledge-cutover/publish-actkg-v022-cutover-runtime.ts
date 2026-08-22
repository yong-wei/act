#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  executeV022ReleaseGates,
  publishActKgV022CutoverRuntime,
} from '../../src/lib/teaching-projection/publish/v022-runtime-release';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function prepareActKgV022RuntimeRelease(argv: readonly string[] = process.argv.slice(2)) {
  const repoRoot = option(argv, '--repo-root') ?? process.cwd();
  const frozen = option(argv, '--frozen-revision')
    ?? execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const releaseGates = executeV022ReleaseGates({
    repoRoot,
    runBuild: argv.includes('--run-build'),
  });
  const result = publishActKgV022CutoverRuntime({
    repoRoot,
    outputRoot: option(argv, '--output-root'),
    boundEnvelopeName: option(argv, '--bound-envelope') ?? 'control-theory-engineering-v0.9',
    frozenApplicationRevision: frozen,
    hostShadowRequired: !argv.includes('--skip-host-shadow'),
    hostVerificationReport: option(argv, '--host-shadow-report'),
    releaseGates,
    requireReleaseGates: true,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    prepareActKgV022RuntimeRelease();
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
