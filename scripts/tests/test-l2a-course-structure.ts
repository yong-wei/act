import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  L2A_COURSE_TITLE,
  L2A_PRESET_KEY,
  L2A_LESSON_STEPS,
} from '../../src/lib/l2a-course';

const root = process.cwd();

const requiredFiles = [
  'src/app/interactive-learning/courses/l2a-time-domain-fasttrack/page.tsx',
  'src/app/interactive-learning/courses/l2a-time-domain-fasttrack/teacher/[sessionId]/page.tsx',
  'src/app/interactive-learning/courses/l2a-time-domain-fasttrack/student/[sessionId]/page.tsx',
  'src/features/interactive/l2a-time-domain/entry-page.tsx',
];

for (const file of requiredFiles) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `${file} 应存在`);
}

assert.equal(L2A_COURSE_TITLE.includes('时域直觉速通'), true, '课程标题应体现 L-2a 主题');
assert.equal(L2A_PRESET_KEY.length > 0, true, '课程应定义预置教案键');
assert.equal(L2A_LESSON_STEPS.length, 18, 'L-2a 课程应包含 18 个步骤');

console.log('l2a course structure test passed');
