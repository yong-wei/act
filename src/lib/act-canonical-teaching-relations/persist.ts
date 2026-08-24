import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ActTeachingProjectionArtifacts } from './contracts';
import { DEFAULT_ACT_TEACHING_RELATION_AUTHORING_RELATIVE } from './contracts';
import { projectionCanonicalJson } from '@/lib/teaching-projection/hash';

export function persistActTeachingProjectionArtifacts(
  artifacts: ActTeachingProjectionArtifacts,
  repoRoot = process.cwd(),
): string {
  const dir = join(
    repoRoot,
    DEFAULT_ACT_TEACHING_RELATION_AUTHORING_RELATIVE,
    artifacts.receipt.authority.releaseId.replace(/[^a-z0-9.-]+/gi, '-'),
  );
  mkdirSync(dir, { recursive: true });
  const write = (name: string, value: unknown) => {
    writeFileSync(join(dir, name), `${projectionCanonicalJson(value)}\n`);
  };
  write('receipt.json', artifacts.receipt);
  write('scope.json', {
    contract: artifacts.scope.contract,
    courseId: artifacts.scope.courseId,
    authority: artifacts.scope.authority,
    catalog: artifacts.scope.catalog,
    memberCount: artifacts.scope.memberIds.length,
    memberIds: artifacts.scope.memberIds,
    scopeHash: artifacts.scope.scopeHash,
  });
  write('qualification.json', artifacts.qualification);
  write('review-pack.json', artifacts.reviewPack);
  write('family-counts.json', artifacts.receipt.familyCounts);
  write('edges.json', artifacts.edges);
  return dir;
}
