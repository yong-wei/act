import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sanitizeRelationMetadata,
  selectRelationsForDb,
  validateRuntimeNodes,
} from '../db/seed-all-knowledge.mjs';

assert.throws(
  () => validateRuntimeNodes([]),
  /runtime knowledge nodes is empty/,
  'seed:knowledge 默认应拒绝空 runtime graph，避免误失活所有 runtime-owned 节点',
);
const sanitized = sanitizeRelationMetadata({
  rationale: 'r'.repeat(900),
  sourceDocument: 'document',
  sourceMetadata: { title: 'title', secret: 'no' },
  source_chapter: 2,
  secret: 'no',
  token: 'no',
});
assert.equal(sanitized.rationale.length, 500);
assert.deepEqual(sanitized.sourceMetadata, { title: 'title' });
assert.equal('secret' in sanitized, false);
assert.equal('token' in sanitized, false);

assert.doesNotThrow(
  () => validateRuntimeNodes([], { allowEmptyRuntimeGraph: true }),
  '显式允许时才可同步空 runtime graph',
);

assert.throws(
  () => validateRuntimeNodes({}),
  /must be an array/,
  'runtime nodes 必须是数组',
);

const selected = selectRelationsForDb([
  { id: 'r-1', source_id: 'A', target_id: 'B', relation_type: 'leads_to', strength: 0.5, rationale: 'first' },
  { id: 'r-2', source_id: 'A', target_id: 'B', relation_type: 'applies_to', strength: 0.9, source_chapter: 2 },
  { id: 'r-3', source_id: 'A', target_id: 'B', relation_type: 'related', strength: 0.9 },
  { id: 'r-4', source_id: 'A', target_id: 'C', relation_type: 'related', strength: 1 },
], new Set(['A', 'B', 'C']));

assert.equal(selected.selectedRelations.size, 4, '同端点多语义关系必须全部保留');
assert.deepEqual(
  selected.selectedRelations.get('r-2'),
  {
    id: 'r-2', sourceId: 'A', targetId: 'B', relation: 'applies_to', strength: 0.9,
    metadata: {
      runtimeSource: 'course-content/runtime/knowledge/graph/relations.jsonl',
      source_chapter: 2,
    },
  },
  'seed contract 应按 relation id 保留完整 provenance',
);
assert.throws(
  () => selectRelationsForDb([
    { id: 'unknown-endpoint', source_id: 'missing', target_id: 'C', relation_type: 'related' },
  ], new Set(['A', 'B', 'C'])),
  /Unknown relation endpoint/,
);
assert.throws(
  () => selectRelationsForDb([
    { id: 'duplicate', source_id: 'A', target_id: 'B', relation_type: 'related' },
    { id: 'duplicate', source_id: 'A', target_id: 'C', relation_type: 'supports' },
  ], new Set(['A', 'B', 'C'])),
  /Duplicate runtime relation id/,
);

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const migration = fs.readFileSync(
  'prisma/migrations/20260714150000_preserve_knowledge_link_relations/migration.sql',
  'utf8',
);
assert.equal(schema.includes('@@unique([sourceId, targetId])'), false);
assert.equal(schema.includes('strength Float @default(1)'), true);
assert.equal(schema.includes('metadata Json  @default("{}")'), true);
assert.equal(schema.includes('@@index([sourceId])'), true);
assert.equal(schema.includes('@@index([targetId])'), true);
assert.equal(migration.includes('DROP INDEX IF EXISTS "KnowledgeLink_sourceId_targetId_key"'), true);
assert.equal(migration.includes('CREATE INDEX "KnowledgeLink_sourceId_idx"'), true);
assert.equal(migration.includes('CREATE INDEX "KnowledgeLink_targetId_idx"'), true);
assert.equal(migration.includes('UPDATE "KnowledgeLink"'), false);
assert.equal(migration.includes('runtimeSource'), false);

console.log('seed-all-knowledge runtime safety test passed');
