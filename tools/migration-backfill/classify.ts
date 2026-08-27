import { execFileSync } from 'node:child_process';

import type { OneOffClass, OneOffCommand, SafetyMode } from './types';

function startsWithPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function listTracked(cwd: string, path: string): string[] {
  const output = execFileSync('git', ['ls-files', '-z', '--', path], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean).sort((left, right) => left.localeCompare(right));
}

const READ_ONLY_DB_FILES = new Set([
  'backfill-unit-4-1-growth-options.ts',
  'course-evidence-backfill-options.ts',
  'recompute-interactive-evidence-scoring-options.ts',
  'session-data-quality-report-options.ts',
  'runtime-lesson-catalog.ts',
  'runtime-lesson-semantic-evidence.ts',
  'runtime-semantic-freshness.ts',
  'verified-test-accounts.mjs',
]);

export function classifyOneOffPath(path: string): OneOffCommand {
  if (startsWithPath(path, 'scripts/migrations')) {
    return command(path, 'migration-repair', 'learning-record', 'apply-gated');
  }
  if (startsWithPath(path, 'evaluate') || /competition-baseline/.test(path)) {
    return command(path, 'competition-material', 'arena', 'dry-run-default');
  }
  const name = path.split('/').pop() ?? path;
  const readOnly = READ_ONLY_DB_FILES.has(name)
    || /^(?:dry-run|report|verify|compute)-/.test(name);
  return command(
    path,
    'historical-backfill',
    'learning-record',
    readOnly ? 'dry-run-default' : 'apply-gated',
  );
}

function command(path: string, oneOffClass: OneOffClass, owner: string, safetyMode: SafetyMode): OneOffCommand {
  return {
    path,
    commandId: `oneoff:${oneOffClass}:${path}`,
    owner,
    oneOffClass,
    safetyMode,
    retirementCondition: 'callers-use-isolated-cli-then-archive-or-delete',
  };
}

export function inventoryOneOffCommands(cwd: string): OneOffCommand[] {
  const paths = [
    ...listTracked(cwd, 'scripts/migrations'),
    ...listTracked(cwd, 'scripts/db'),
    ...listTracked(cwd, 'evaluate'),
    ...listTracked(cwd, 'scripts/tests').filter((path) => path.includes('competition-baseline')),
  ];
  return paths.map(classifyOneOffPath);
}
