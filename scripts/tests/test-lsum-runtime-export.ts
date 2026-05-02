import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const lessonJsonPath = 'course-content/runtime/lessons/legacy/L-sum/lesson.json';
const graphOverlayPath = 'course-content/runtime/lessons/legacy/L-sum/graph-overlay.json';
const handoutPath = 'course-content/runtime/lessons/legacy/L-sum/L-sum-handout.md';
const mediaPaths = [
  'course-content/runtime/lessons/legacy/L-sum/media/sh-01-feasible-region-mp.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/sh-02-feasible-region-ts.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/sh-03-feasible-region-full.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/h-04-root-locus-feasible-arc.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/h-05-time-domain-envelope.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/h-06-bode-feasible-band.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/h-07-example1-root-locus.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/h-08-feasible-region-comparison.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/ic-09-posttest-complex-plane.svg',
  'course-content/runtime/lessons/legacy/L-sum/media/cd-01-feasible-domain-overview.svg',
];

assert.equal(fs.existsSync(path.join(root, lessonJsonPath)), true, '应导出 L-sum lesson.json');
assert.equal(fs.existsSync(path.join(root, graphOverlayPath)), true, '应导出 L-sum graph-overlay.json');
assert.equal(fs.existsSync(path.join(root, handoutPath)), true, '应导出 L-sum handout.md');

for (const mediaPath of mediaPaths) {
  assert.equal(fs.existsSync(path.join(root, mediaPath)), true, `${path.basename(mediaPath)} 应生成到 runtime 媒体目录`);
}

const lessonJson = JSON.parse(fs.readFileSync(path.join(root, lessonJsonPath), 'utf8'));
assert.equal(lessonJson.lesson_id, 'L-∑', 'lesson.json 应保留课程设计中的课次标识');
assert.equal(lessonJson.handout_path, '/course-runtime/lessons/legacy/L-sum/L-sum-handout.md', 'handout_path 应走 course-runtime');
assert.equal(lessonJson.media_base_path, '/course-runtime/lessons/legacy/L-sum/media', 'media_base_path 应走 course-runtime');

const graphOverlay = JSON.parse(fs.readFileSync(path.join(root, graphOverlayPath), 'utf8'));
assert.equal(graphOverlay.lesson_id, 'L-sum', 'graph-overlay 应标记 runtime 目录课次');
assert.equal(Array.isArray(graphOverlay.nodes), true, 'graph-overlay 应包含局部节点');
assert.equal(Array.isArray(graphOverlay.links), true, 'graph-overlay 应包含局部关系');

const handout = fs.readFileSync(path.join(root, handoutPath), 'utf8');
assert.equal(
  handout.includes('/course-runtime/lessons/legacy/L-sum/media/sh-03-feasible-region-full.svg'),
  true,
  '讲义中的复平面可行域图应改写到 runtime 路径',
);
assert.equal(
  handout.includes('/course-runtime/lessons/legacy/L-sum/media/h-07-example1-root-locus.svg'),
  true,
  '讲义中的例题根轨迹图应改写到 runtime 路径',
);

console.log('test-lsum-runtime-export passed');
