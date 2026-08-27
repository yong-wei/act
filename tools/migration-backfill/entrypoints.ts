import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { OneOffCommand } from './types';

export interface UngatedPackageScript {
  readonly name: string;
  readonly path: string;
}

export function findUngatedApplyPackageScripts(
  cwd: string,
  commands: readonly OneOffCommand[],
): UngatedPackageScript[] {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const gated = commands.filter((item) => item.safetyMode === 'apply-gated');
  const hits: UngatedPackageScript[] = [];
  for (const [name, body] of Object.entries(pkg.scripts ?? {})) {
    const text = String(body);
    if (text.includes('tools/migration-backfill/cli.ts')) continue;
    for (const command of gated) {
      if (text.includes(command.path) || text.includes(`./${command.path}`)) {
        hits.push({ name, path: command.path });
      }
    }
  }
  return hits;
}
