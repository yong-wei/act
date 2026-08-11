import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildRuntimeMediaInventory, serializeRuntimeMediaInventory } from '@/lib/runtime-media-inventory';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const runtimeRoot = argument('--runtime-root');
  const authoringLessonsRoot = argument('--authoring-lessons-root');
  const sourceRevision = argument('--source-revision');
  const output = argument('--output');
  if (!runtimeRoot || !authoringLessonsRoot || !sourceRevision || !output) {
    throw new Error('Usage: runtime-media-inventory --runtime-root <path> --authoring-lessons-root <path> --source-revision <sha> --output <path>');
  }
  const inventory = await buildRuntimeMediaInventory({ runtimeRoot, authoringLessonsRoot, sourceRevision });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, serializeRuntimeMediaInventory(inventory), 'utf8');
  process.stdout.write(`${JSON.stringify({ output, digest: inventory.digest, declaredMediaEntries: inventory.declaredMediaEntries, unresolved: inventory.unresolved })}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
