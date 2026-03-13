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
  stepPanels.includes("from '@/components/ui/dialog'") &&
    stepPanels.includes('InteractiveAIPanel') &&
    stepPanels.includes('useInteractiveAI') &&
    stepPanels.includes('open={assistantOpen}') &&
    !stepPanels.includes("window.open('/ai'"),
  true,
  'L-2b 的 AI 助手应在当前页面以对话框形式打开，而不是跳转到独立 AI 页面',
);

assert.equal(
  teacherPage.includes('showStudentList') &&
    teacherPage.includes('joinedStudents.length') &&
    teacherPage.includes('在线 {joinedStudents.length} 人') &&
    teacherPage.includes('展开名单'),
  true,
  'L-2b 教师端在线学生清单应默认折叠，仅展示人数摘要并允许展开',
);

assert.equal(
  stepPanels.includes('showAnswerKey') &&
    stepPanels.includes('显示答案') &&
    stepPanels.includes('正确答案') &&
    stepPanels.includes('词云') &&
    stepPanels.includes('showTextResponses') &&
    stepPanels.includes('按提交时间排序'),
  true,
  'L-2b 教师端汇总应支持选择题统计与答案揭示，并为文本题提供词云和默认折叠的回复列表',
);

assert.equal(
  !workspace.includes('localState.showRay45 || showRayPanel') &&
    workspace.includes('{localState.showRay45 ? \'关闭 45°射线\' : \'打开 45°射线\'}'),
  true,
  'L-2b 第14页的 45°射线显示应由开关状态控制，而不是被步骤强制常显',
);

assert.equal(
  workspace.includes('localState.studentUnlocked ?') &&
    workspace.includes('切回教师演示模式') &&
    workspace.includes('已切换到学生自主模式'),
  true,
  'L-2b 教师端自主模式按钮应在切换后给出明确状态反馈',
);

assert.equal(
  studentPage.includes('void syncStates();') &&
    studentPage.includes('setInterval(() => {') &&
    studentPage.includes('const readOnlyWorkspace = step.id === \'pole-drag-demo\'') &&
    studentPage.includes('teacherSyncRecord?.workspace.studentUnlocked'),
  true,
  'L-2b 学生端应持续拉取教师广播状态，并在教师放开自主模式后解除只读拖动限制',
);

console.log('l2b interaction principles test passed');
