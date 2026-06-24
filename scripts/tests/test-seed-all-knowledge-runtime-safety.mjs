import assert from 'node:assert/strict';
import {
  selectRelationsForDb,
  validateRuntimeNodes,
} from '../db/seed-all-knowledge.mjs';

assert.throws(
  () => validateRuntimeNodes([]),
  /runtime knowledge nodes is empty/,
  'seed:knowledge 默认应拒绝空 runtime graph，避免误失活所有 runtime-owned 节点',
);

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
  { source_id: 'A', target_id: 'B', relation_type: 'leads_to', strength: 0.5 },
  { source_id: 'A', target_id: 'B', relation_type: 'applies_to', strength: 0.9 },
  { source_id: 'A', target_id: 'B', relation_type: 'related', strength: 0.9 },
  { source_id: 'A', target_id: 'C', relation_type: 'related', strength: 1 },
  { source_id: 'missing', target_id: 'C', relation_type: 'related', strength: 1 },
], new Set(['A', 'B', 'C']));

assert.equal(selected.skipped, 1, '缺端点关系应跳过');
assert.equal(selected.collapsed, 1, '同一 source/target 的多类型关系应显式计入折叠');
assert.equal(selected.selectedRelations.size, 2, '当前 DB 唯一键只允许每个端点对保留一个代表关系');
assert.deepEqual(
  selected.selectedRelations.get('A::B'),
  { sourceId: 'A', targetId: 'B', relation: 'applies_to', strength: 0.9 },
  '代表关系应按最高 strength，平手按 relation 字典序稳定选择',
);

console.log('seed-all-knowledge runtime safety test passed');
