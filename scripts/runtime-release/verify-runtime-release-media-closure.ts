import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildRuntimeReleaseMediaClosure, serializeRuntimeReleaseMediaClosure } from '@/lib/runtime-release-media-closure';
import { readRuntimeReleaseManifest } from '@/lib/runtime-release';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string) {
  const value = argument(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

async function main() {
  const runtimeRoot = required('--runtime-root');
  const manifestPath = required('--manifest');
  const output = required('--output');
  const closure = await buildRuntimeReleaseMediaClosure({
    runtimeRoot,
    manifest: await readRuntimeReleaseManifest(manifestPath),
  });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, serializeRuntimeReleaseMediaClosure(closure), 'utf8');
  process.stdout.write(`${JSON.stringify({ output, publishedEntries: closure.publishedEntries, pendingEntries: closure.pendingEntries, failures: closure.failures, ready: closure.ready })}\n`);
  if (!closure.ready) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
