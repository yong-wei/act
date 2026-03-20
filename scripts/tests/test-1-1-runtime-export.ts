import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const lessonJsonPath = 'course-content/runtime/lessons/1-1/lesson.json';
const graphOverlayPath = 'course-content/runtime/lessons/1-1/graph-overlay.json';
const handoutPath = 'course-content/runtime/lessons/1-1/handout.md';
const mediaPaths = [
  'course-content/runtime/lessons/1-1/media/h-01-spring-mass-damper.svg',
  'course-content/runtime/lessons/1-1/media/h-02-laplace-transform-flow.svg',
  'course-content/runtime/lessons/1-1/media/h-03-pole-response-family.svg',
  'course-content/runtime/lessons/1-1/media/h-04-typical-elements.svg',
  'course-content/runtime/lessons/1-1/media/h-05-rc-circuit.svg',
  'course-content/runtime/lessons/1-1/media/sh-01-mason-portrait.png',
];

assert.equal(fs.existsSync(path.join(root, lessonJsonPath)), true, '应导出 1-1 lesson.json');
assert.equal(fs.existsSync(path.join(root, graphOverlayPath)), true, '应导出 1-1 graph-overlay.json');
assert.equal(fs.existsSync(path.join(root, handoutPath)), true, '应导出 1-1 handout.md');

for (const mediaPath of mediaPaths) {
  assert.equal(fs.existsSync(path.join(root, mediaPath)), true, `${path.basename(mediaPath)} 应生成到 runtime 媒体目录`);
}

const lessonJson = JSON.parse(fs.readFileSync(path.join(root, lessonJsonPath), 'utf8'));
assert.equal(lessonJson.lesson_id, '1-1', 'lesson.json 应标记当前课次');
assert.equal(lessonJson.handout_path, '/course-runtime/lessons/1-1/handout.md', 'handout_path 应走 course-runtime');
assert.equal(lessonJson.media_base_path, '/course-runtime/lessons/1-1/media', 'media_base_path 应走 course-runtime');

const graphOverlay = JSON.parse(fs.readFileSync(path.join(root, graphOverlayPath), 'utf8'));
assert.equal(graphOverlay.lesson_id, '1-1', 'graph-overlay 应标记 runtime 目录课次');
assert.equal(Array.isArray(graphOverlay.nodes), true, 'graph-overlay 应包含局部节点');
assert.equal(Array.isArray(graphOverlay.links), true, 'graph-overlay 应包含局部关系');

const handout = fs.readFileSync(path.join(root, handoutPath), 'utf8');
assert.equal(
  handout.includes('/course-runtime/lessons/1-1/media/h-02-laplace-transform-flow.svg'),
  true,
  '讲义中的拉氏变换流程图应改写到 runtime 路径',
);
assert.equal(
  handout.includes('/course-runtime/lessons/1-1/media/h-04-typical-elements.svg'),
  true,
  '讲义中的典型环节图应改写到 runtime 路径',
);

console.log('test-1-1-runtime-export passed');
