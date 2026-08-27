#!/usr/bin/env tsx

/**
 * Qualify the inactive v0.18 Authority + Teaching Projection compound
 * candidate without changing production selectors (#1410).
 */

import { pathToFileURL } from 'node:url';

import {
  qualifyActKgV018CutoverCandidate,
} from '../../tools/teaching-projection-publishing/qualify/v018-qualify';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function prepareActKgV018CutoverQualification(
  argv: readonly string[] = process.argv.slice(2),
): Promise<{
  status: 'READY' | 'BLOCKED';
  reportPath: string;
  blockers: string[];
  receiptDigest: string;
}> {
  const repoRoot = option(argv, '--repo-root') ?? process.cwd();
  const outputRoot = option(argv, '--output-root');
  const result = await qualifyActKgV018CutoverCandidate({ repoRoot, outputRoot });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  prepareActKgV018CutoverQualification().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
