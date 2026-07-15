import fs from 'node:fs';
import path from 'node:path';

import { inspectRuntimeKnowledgeRelationCoverage } from '../../src/lib/knowledge-graph-relation-runtime';

const DEFAULT_RELATIONS_PATH = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'knowledge',
  'graph',
  'relations.jsonl'
);
const DEFAULT_NODES_PATH = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'knowledge',
  'graph',
  'nodes.json'
);

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a file path.`);
  }
  return path.resolve(process.cwd(), value);
}

function readNodeIds(nodesPath: string): Set<string> {
  const parsed = JSON.parse(fs.readFileSync(nodesPath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Runtime knowledge nodes must be a JSON array.');
  const nodeIds = new Set<string>();
  parsed.forEach((node, index) => {
    const id = node && typeof node === 'object' ? (node as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || !id || id.trim() !== id || id.length > 200) {
      throw new Error(`Runtime knowledge node at index ${index} has an invalid canonical id.`);
    }
    if (nodeIds.has(id)) throw new Error(`Runtime knowledge node id is duplicated: ${id}`);
    nodeIds.add(id);
  });
  return nodeIds;
}

try {
  const relationsPath = optionValue('--relations', DEFAULT_RELATIONS_PATH);
  const nodesPath = optionValue('--nodes', DEFAULT_NODES_PATH);
  const result = inspectRuntimeKnowledgeRelationCoverage(
    fs.readFileSync(relationsPath, 'utf8'),
    { nodeIds: readNodeIds(nodesPath) }
  );
  console.log(JSON.stringify(result.report, null, 2));
  if (!result.report.ok) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({
    coverage: [],
    counts: {
      inputLines: 0,
      parsedRelations: 0,
      projectedRelations: 0,
      visualEdges: 0,
    },
    diagnostics: [{
      blocking: true,
      code: 'RELATION_COVERAGE_CHECKER_FAILURE',
      message: error instanceof Error ? error.message : String(error),
      relationIds: [],
      stage: 'loading',
    }],
    ok: false,
    stageAgreement: false,
  }, null, 2));
  process.exitCode = 1;
}
