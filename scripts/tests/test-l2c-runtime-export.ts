import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const lessonJsonPath = 'course-content/runtime/lessons/L-2c/lesson.json';
const graphOverlayPath = 'course-content/runtime/lessons/L-2c/graph-overlay.json';
const handoutPath = 'course-content/runtime/lessons/L-2c/handout.md';
const mediaPaths = [
  'course-content/runtime/lessons/L-2c/media/h-01-bode-magnitude-regions.svg',
  'course-content/runtime/lessons/L-2c/media/h-02-phase-margin-diagram.svg',
  'course-content/runtime/lessons/L-2c/media/h-03-bode-example-annotated.svg',
  'course-content/runtime/lessons/L-2c/media/sh-04-phase-margin-vs-overshoot.svg',
  'course-content/runtime/lessons/L-2c/media/sh-05-three-domain-coupling.svg',
  'course-content/runtime/lessons/L-2c/media/sh-00-equalizer-analogy.png',
];

assert.equal(fs.existsSync(path.join(root, lessonJsonPath)), true, '应导出 L-2c lesson.json');
assert.equal(fs.existsSync(path.join(root, graphOverlayPath)), true, '应导出 L-2c graph-overlay.json');
assert.equal(fs.existsSync(path.join(root, handoutPath)), true, '应导出 L-2c handout.md');

for (const mediaPath of mediaPaths) {
  assert.equal(fs.existsSync(path.join(root, mediaPath)), true, `${path.basename(mediaPath)} 应生成到 runtime 媒体目录`);
}

const lessonJson = JSON.parse(fs.readFileSync(path.join(root, lessonJsonPath), 'utf8'));
assert.equal(lessonJson.lesson_id, 'L-2c', 'lesson.json 应标记当前课次');
assert.equal(lessonJson.handout_path, '/course-runtime/lessons/L-2c/handout.md', 'handout_path 应走 course-runtime');
assert.equal(lessonJson.media_base_path, '/course-runtime/lessons/L-2c/media', 'media_base_path 应走 course-runtime');

const graphOverlay = JSON.parse(fs.readFileSync(path.join(root, graphOverlayPath), 'utf8'));
assert.equal(graphOverlay.lesson_id, 'L-2c', 'graph-overlay 应标记当前课次');
assert.equal(Array.isArray(graphOverlay.nodes), true, 'graph-overlay 应包含局部节点');
assert.equal(Array.isArray(graphOverlay.links), true, 'graph-overlay 应包含局部关系');

const handout = fs.readFileSync(path.join(root, handoutPath), 'utf8');
assert.equal(
  handout.includes('/course-runtime/lessons/L-2c/media/h-01-bode-magnitude-regions.svg'),
  true,
  '讲义中的 SVG 引用应改写到 runtime 路径',
);
assert.equal(
  handout.includes('/course-runtime/lessons/L-2c/media/sh-05-three-domain-coupling.svg'),
  true,
  '讲义中的三域联动图应改写到 runtime 路径',
);

console.log('test-l2c-runtime-export passed');
