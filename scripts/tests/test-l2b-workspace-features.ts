import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const teacherPage = read('src/features/interactive/l2b-root-locus/teacher-page.tsx');
const studentPage = read('src/features/interactive/l2b-root-locus/student-page.tsx');
const stepPanels = read('src/features/interactive/l2b-root-locus/step-panels.tsx');
const workspace = read('src/features/interactive/l2b-root-locus/workspace.tsx');

assert.equal(
  teacherPage.includes("itemId: 'teacher:course-sync'") &&
    teacherPage.includes('workspace:') &&
    teacherPage.includes('studentUnlocked'),
  true,
  'L-2b 教师端应广播工作区状态与学生解锁状态',
);

assert.equal(
  studentPage.includes('scope=student-view') &&
    studentPage.includes("record.itemId !== 'teacher:course-sync'") &&
    studentPage.includes('teacherSyncRecord'),
  true,
  'L-2b 学生端应读取教师广播状态并据此更新只读/自主模式',
);

assert.equal(
  stepPanels.includes('mediaSrc') &&
    stepPanels.includes('Image src={mediaSrc}') &&
    stepPanels.includes('复制提示词') &&
    stepPanels.includes('AI 给出的 K'),
  true,
  'L-2b 内容面板应渲染运行时媒体，并保留 AI 对比区',
);

assert.equal(
  workspace.includes('打开 45°射线') &&
    workspace.includes('切换到学生自主模式') &&
    workspace.includes('增益滑块 K') &&
    workspace.includes('轨迹选点信息') &&
    workspace.includes('记录：K =') &&
    workspace.includes('45° 射线几何定位'),
  true,
  'L-2b 工作区应支持 45°射线、广播控制、轨迹选点信息卡与 step-14 记录表',
);

assert.equal(
  workspace.includes('开环增益（旋钮）') &&
    workspace.includes('闭环极点（结果）') &&
    workspace.includes('根轨迹 = 旋钮从 0 拧到 ∞'),
  true,
  'L-2b step-06 应提供符合设计稿的反馈框图认知卡与开环/闭环标注',
);

console.log('l2b workspace features test passed');
