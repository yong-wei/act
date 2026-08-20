#!/usr/bin/env tsx

import { pathToFileURL } from 'node:url';

import { createV022MapPointerBackend } from '../../src/lib/teaching-projection/publish/v022-production-cutover-backend';
import {
  createPreparedJournal,
  executeV022ProductionCutover,
  exerciseV022RollbackPath,
  pointerIdentityFromBytes,
  V022_CUTOVER_COMPONENTS,
  V022_CUTOVER_POINTER_PATHS,
  type V022CutoverComponent,
} from '../../src/lib/teaching-projection/publish/v022-production-cutover';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function loadLive(repoRoot: string) {
  return Object.fromEntries(V022_CUTOVER_COMPONENTS.map((component) => {
    const relative = V022_CUTOVER_POINTER_PATHS[component as V022CutoverComponent];
    const bytes = readFileSync(path.join(repoRoot, relative));
    return [component, pointerIdentityFromBytes(component, bytes)];
  }));
}

export function prepareActKgV022ProductionCutover(argv: readonly string[] = process.argv.slice(2)) {
  const repoRoot = option(argv, '--repo-root') ?? process.cwd();
  const livePointers = loadLive(repoRoot);
  const live = createV022MapPointerBackend(
    Object.fromEntries(V022_CUTOVER_COMPONENTS.map((component) => [
      component,
      livePointers[component].bytes,
    ])),
  );
  const rehearsal = createV022MapPointerBackend();
  const rollback = exerciseV022RollbackPath({
    live,
    rehearsal,
    persistJournal: (journal) => journal,
    transactionId: 'v022-cutover-rehearsal',
  });
  const result = {
    rollbackRestored: rollback.restored,
    currentAuthority: livePointers.authority.id,
    productionCutoverAuthorized: false,
    note: 'live host switch remains a separate operator execution after runtime deploy',
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    prepareActKgV022ProductionCutover();
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
