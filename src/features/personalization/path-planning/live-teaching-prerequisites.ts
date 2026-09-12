import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';

export interface TeachingPrerequisiteEdge {
  id: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  strength: 'REQUIRED' | 'RECOMMENDED';
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function loadLiveTeachingPrerequisiteEdges(
  repoRoot = process.cwd(),
): TeachingPrerequisiteEdge[] {
  const root = resolveConfiguredTeachingProjectionRoot(repoRoot);
  const current = readJson<{ projectionId?: string }>(join(root, 'current.json'));
  const projectionId = current?.projectionId?.trim();
  if (!projectionId) return [];
  const file = join(root, 'releases', projectionId, 'prerequisites.jsonl');
  if (!existsSync(file)) return [];
  const edges: TeachingPrerequisiteEdge[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as {
        prerequisiteId?: string;
        sourceCanonicalId?: string;
        targetCanonicalId?: string;
        strength?: string;
      };
      if (
        (row.strength !== 'REQUIRED' && row.strength !== 'RECOMMENDED')
        || !row.sourceCanonicalId
        || !row.targetCanonicalId
      ) {
        continue;
      }
      edges.push({
        id: row.prerequisiteId ?? `${row.sourceCanonicalId}->${row.targetCanonicalId}`,
        sourceCanonicalId: row.sourceCanonicalId,
        targetCanonicalId: row.targetCanonicalId,
        strength: row.strength,
      });
    } catch {
      // skip malformed lines
    }
  }
  return edges;
}
