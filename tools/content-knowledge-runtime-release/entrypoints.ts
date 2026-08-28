import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ReleaseCommand } from './types';

export interface UngatedPackageScript {
  readonly name: string;
  readonly path: string;
}

export function findUngatedPublicationPackageScripts(
  cwd: string,
  commands: readonly ReleaseCommand[],
): UngatedPackageScript[] {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const gated = commands.filter((item) => (
    item.safetyMode === 'apply-gated' && item.role !== 'operator-adapter'
  ));
  const hits: UngatedPackageScript[] = [];
  for (const [name, body] of Object.entries(pkg.scripts ?? {})) {
    const text = String(body);
    if (text.includes('tools/content-knowledge-runtime-release/cli.ts')) continue;
    if (text.includes('tools/teaching-projection-publishing/cli.ts')) continue;
    for (const command of gated) {
      if (text.includes(command.path) || text.includes(`./${command.path}`)) {
        hits.push({ name, path: command.path });
      }
    }
  }
  return hits;
}
