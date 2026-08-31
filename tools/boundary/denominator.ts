import { createHash } from 'node:crypto';

import { classifyPath } from './classify';
import { captureSourceIdentity, listTrackedFiles } from './git-source';
import type {
  ClassifiedEntry,
  FamilyDenominator,
  GeneratedInputRecord,
  SourceDenominator,
  SourceFamilyId,
} from './types';
import { SOURCE_FAMILIES, TOOLCHAIN_BOUNDARY_SCHEMA_VERSION } from './types';

export function digestPaths(paths: readonly string[]): string {
  return createHash('sha256').update(`${paths.join('\n')}\n`).digest('hex');
}

export function buildSourceDenominator(
  cwd: string,
  generatedInputs: readonly GeneratedInputRecord[] = [],
): {
  denominator: SourceDenominator;
  entries: ClassifiedEntry[];
  unresolved: string[];
} {
  const identity = captureSourceIdentity(cwd);
  const families: FamilyDenominator[] = [];
  const entries: ClassifiedEntry[] = [];
  const unresolved: string[] = [];

  for (const family of SOURCE_FAMILIES) {
    const paths = listTrackedFiles(cwd, family.path).filter((path) => (
      !path.includes('__pycache__/') && !path.endsWith('.pyc')
    ));
    families.push({
      id: family.id,
      path: family.path,
      count: paths.length,
      digest: digestPaths(paths),
    });
    for (const path of paths) {
      const classified = classifyPath(path, family.id as SourceFamilyId);
      if ('unresolved' in classified) {
        unresolved.push(path);
        continue;
      }
      entries.push(classified);
    }
  }

  const denominator: SourceDenominator = {
    schemaVersion: TOOLCHAIN_BOUNDARY_SCHEMA_VERSION,
    sourceRevision: identity.sourceRevision,
    sourceTree: identity.sourceTree,
    families,
    totalCount: families.reduce((sum, family) => sum + family.count, 0),
    digest: digestPaths(families.flatMap((family) => [`${family.id}:${family.count}:${family.digest}`])),
    generatedInputs,
  };

  return { denominator, entries, unresolved };
}
