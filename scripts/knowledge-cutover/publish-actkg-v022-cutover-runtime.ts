#!/usr/bin/env tsx

import { pathToFileURL } from 'node:url';

import { publishActKgV022CutoverRuntime } from '../../src/lib/teaching-projection/publish/v022-runtime-release';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function prepareActKgV022RuntimeRelease(argv: readonly string[] = process.argv.slice(2)) {
  const repoRoot = option(argv, '--repo-root') ?? process.cwd();
  const result = publishActKgV022CutoverRuntime({
    repoRoot,
    outputRoot: option(argv, '--output-root'),
    boundEnvelopeName: option(argv, '--bound-envelope') ?? 'control-theory-engineering-v0.9',
    frozenApplicationRevision: option(argv, '--frozen-revision'),
    hostShadowRequired: !argv.includes('--skip-host-shadow'),
    hostVerificationReport: option(argv, '--host-shadow-report'),
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
