import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const lessonDir = 'course-content/runtime/lessons/1-2';
const reviewDir = `${lessonDir}/review`;

const requiredFiles = [
  `${lessonDir}/lesson.json`,
  `${lessonDir}/graph-overlay.json`,
  `${lessonDir}/handout.md`,
  `${reviewDir}/boppps.md`,
  `${reviewDir}/review-report.md`,
  `${reviewDir}/knowledge-card-check.json`,
  `${reviewDir}/multimedia-check.json`,
  `${reviewDir}/source-manifest.json`,
  `${lessonDir}/media/sh-01-block-diagram-elements.svg`,
  `${lessonDir}/media/sh-02-ship-heading-control.svg`,
  `${lessonDir}/media/sh-03-equivalent-transform-rules.svg`,
  `${lessonDir}/media/sh-04-signal-flow-graph.svg`,
  'course-content/runtime/knowledge/cards/nodes/系统结构图_2_5d3751f8.md',
  'course-content/runtime/knowledge/cards/nodes/结构图等效变换_2_12001.md',
  'course-content/runtime/knowledge/cards/nodes/梅森增益公式_2_419eab0c.md',
];

for (const file of requiredFiles) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} 应存在`);
}

const lessonJson = readJson(`${lessonDir}/lesson.json`);
assert.equal(lessonJson.lesson_id, '1-2', 'lesson.json 应标记 1-2');
assert.equal(lessonJson.handout_path, '/course-runtime/lessons/1-2/handout.md', '讲义路径应走 runtime');
assert.equal(
  lessonJson.review?.report_path,
  '/course-runtime/lessons/1-2/review/review-report.md',
  'lesson.json 应暴露 review 报告路径',
);
assert.equal(
  lessonJson.review?.boppps_path,
  '/course-runtime/lessons/1-2/review/boppps.md',
  'lesson.json 应暴露审查后 boppps 路径',
);

const handout = readText(`${lessonDir}/handout.md`);
assert.equal(
  handout.includes('/course-runtime/lessons/1-2/media/sh-01-block-diagram-elements.svg'),
  true,
  '1-2 handout 应改写结构图元素示意图到 runtime 媒体路径',
);
assert.equal(
  handout.includes('/course-runtime/lessons/1-2/media/sh-03-equivalent-transform-rules.svg'),
  true,
  '1-2 handout 应改写等效变换图到 runtime 媒体路径',
);

const report = readText(`${reviewDir}/review-report.md`);
assert.equal(
  report.includes('design/handout.md') &&
    report.includes('design/boppps.md') &&
    report.includes('knowledge-card-check') &&
    report.includes('multimedia-check'),
  true,
  'review-report 应记录 handout、boppps、知识卡片与多媒体审查结果',
);

const knowledgeCheck = readJson(`${reviewDir}/knowledge-card-check.json`);
assert.equal(knowledgeCheck.lesson_id, '1-2', '知识卡片检查结果应标记 1-2');
assert.deepEqual(knowledgeCheck.missing_cards, [], '1-2 审查后不应再缺少知识卡片');

const multimediaCheck = readJson(`${reviewDir}/multimedia-check.json`);
assert.equal(multimediaCheck.lesson_id, '1-2', '多媒体检查结果应标记 1-2');
assert.equal(multimediaCheck.generated_assets.length >= 4, true, '1-2 应生成 4 个代码直出图');
assert.equal(multimediaCheck.missing_assets.length, 0, '1-2 审查后不应再缺少代码直出图');

console.log('test-1-2-review-runtime-export passed');
