import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentPage = read('src/features/interactive/l2a-time-domain/student-page.tsx');
const stepPanels = read('src/features/interactive/l2a-time-domain/step-panels.tsx');
const workspace = read('src/features/interactive/l2a-time-domain/workspace.tsx');

assert.equal(
  studentPage.includes('premium-lesson-shell'),
  true,
  'L-2a 学生端页面应复用统一课程外层浅色样式',
);

assert.equal(
  studentPage.includes('max-w-[1080px]') && studentPage.includes('px-3 py-3 sm:px-4 sm:py-4'),
  true,
  'L-2a 学生端主区应针对移动端采用更紧凑的宽度和间距',
);

assert.equal(
  stepPanels.includes('premium-lesson-panel') &&
    stepPanels.includes('premium-lesson-accent-panel') &&
    stepPanels.includes('premium-lesson-input'),
  true,
  'L-2a 内容面板、互动区和输入控件应复用统一课程样式',
);

assert.equal(
  workspace.includes('premium-lesson-panel') &&
    workspace.includes('premium-lesson-panel-soft') &&
    workspace.includes('premium-lesson-chip'),
  true,
  'L-2a 工作区应复用统一课程面板与指标胶囊样式',
);

console.log('l2a student light mobile test passed');
