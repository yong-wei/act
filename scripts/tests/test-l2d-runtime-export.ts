import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const lessonJsonPath = 'course-content/runtime/lessons/L-2d/lesson.json';
const graphOverlayPath = 'course-content/runtime/lessons/L-2d/graph-overlay.json';
const handoutPath = 'course-content/runtime/lessons/L-2d/handout.md';

assert.equal(fs.existsSync(path.join(root, lessonJsonPath)), true, '应导出 L-2d lesson.json');
assert.equal(fs.existsSync(path.join(root, graphOverlayPath)), true, '应导出 L-2d graph-overlay.json');
assert.equal(fs.existsSync(path.join(root, handoutPath)), true, '应导出 L-2d handout.md');

const lessonJson = JSON.parse(fs.readFileSync(path.join(root, lessonJsonPath), 'utf8'));
assert.equal(lessonJson.lesson_id, 'L-2d', 'lesson.json 应标记当前课次');
assert.equal(lessonJson.handout_path, '/course-runtime/lessons/L-2d/handout.md', 'handout_path 应走 course-runtime');
assert.equal(lessonJson.media_base_path, '/course-runtime/lessons/L-2d/media', 'media_base_path 应走 course-runtime');

const graphOverlay = JSON.parse(fs.readFileSync(path.join(root, graphOverlayPath), 'utf8'));
assert.equal(graphOverlay.lesson_id, 'L-2d', 'graph-overlay 应标记当前课次');
assert.equal(Array.isArray(graphOverlay.nodes), true, 'graph-overlay 应包含局部节点');
assert.equal(Array.isArray(graphOverlay.links), true, 'graph-overlay 应包含局部关系');

const handout = fs.readFileSync(path.join(root, handoutPath), 'utf8');
assert.equal(
  handout.includes('# 实践任务书 | 单元 L-2d：三域联动探索——平台操作初体验'),
  true,
  'L-2d runtime handout 应来自 practice-guide.md',
);
assert.equal(
  handout.includes('## 任务一：找到"刚好失稳"的边界（20 分钟）'),
  true,
  'L-2d runtime handout 应保留实践任务书正文',
);

console.log('test-l2d-runtime-export passed');
