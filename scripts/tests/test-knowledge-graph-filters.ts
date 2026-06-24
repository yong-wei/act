import assert from 'node:assert/strict';

import {
  CHAPTER_DISPLAY_ORDER,
  buildDefaultSelectedRelationTypes,
  buildRelationTypeStats,
  resolveChapterName,
} from '../../src/features/knowledge/graph/filter-utils';

assert.equal(CHAPTER_DISPLAY_ORDER.length, 9, 'chapter order should contain 9 sections');
assert.equal(resolveChapterName(1), '基本概念', 'chapter 1 should map to 基本概念');
assert.equal(resolveChapterName(10), '状态空间', 'chapter 10 should merge into 状态空间');

const defaultRelationSelection = buildDefaultSelectedRelationTypes([
  'prerequisite',
  'related',
  'follows',
  'provides_foundation',
]);
assert.deepEqual(
  defaultRelationSelection.sort(),
  ['prerequisite', 'provides_foundation', 'follows'].sort(),
  'default relation selection should prioritize high-signal structural relations'
);

const relationStats = buildRelationTypeStats(
  [
    { sourceId: 'n1', targetId: 'n2', relationType: 'prerequisite', relation: 'prerequisite' },
    { sourceId: 'n1', targetId: 'n3', relationType: 'follows', relation: 'follows' },
    { sourceId: 'n3', targetId: 'n4', relationType: 'related', relation: 'related' },
  ],
  new Set(['n1', 'n2', 'n3'])
);

assert.deepEqual(
  relationStats.sort((a, b) => a.type.localeCompare(b.type)),
  [
    { type: 'follows', count: 1 },
    { type: 'prerequisite', count: 1 },
  ],
  'relation stats should only count links within filtered/search matched nodes'
);

console.log('knowledge graph filter test passed');
