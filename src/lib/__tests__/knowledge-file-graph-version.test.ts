import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  loadKnowledgeGraphData,
  resetKnowledgeGraphSourceCacheForTests,
} from '@/lib/knowledge-graph-source';

const originalRuntimeRoot = process.env.KNOWLEDGE_RUNTIME_ROOT;
const temporaryRoots: string[] = [];

afterEach(async () => {
  resetKnowledgeGraphSourceCacheForTests();
  if (originalRuntimeRoot === undefined) delete process.env.KNOWLEDGE_RUNTIME_ROOT;
  else process.env.KNOWLEDGE_RUNTIME_ROOT = originalRuntimeRoot;
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('file knowledge graph version', () => {
  it('is stable across checkout mtimes when source bytes are identical', async () => {
    const root = await mkdtemp(join(tmpdir(), 'knowledge-file-version-'));
    temporaryRoots.push(root);
    const graphRoot = join(root, 'graph');
    await mkdir(graphRoot, { recursive: true });
    const nodesPath = join(graphRoot, 'nodes.json');
    const relationsPath = join(graphRoot, 'relations.jsonl');
    await writeFile(nodesPath, `${JSON.stringify([{
      id: 'node-a',
      name: '节点 A',
      nodeType: 'THEORY',
      description: 'fixture',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      chapter: 1,
      chapterName: '第一章',
    }], null, 2)}\n`);
    await writeFile(relationsPath, `${JSON.stringify({
      id: 'self-related',
      source_id: 'node-a',
      target_id: 'node-a',
      relation_type: 'related',
    })}\n`);
    process.env.KNOWLEDGE_RUNTIME_ROOT = root;

    const before = await loadKnowledgeGraphData();
    const changedMtime = new Date(Date.now() + 60_000);
    await utimes(nodesPath, changedMtime, changedMtime);
    await utimes(relationsPath, changedMtime, changedMtime);
    const after = await loadKnowledgeGraphData();

    expect(after.versionDigest).toBe(before.versionDigest);
  });
});
