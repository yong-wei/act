import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const studentPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2c-frequency-bode/student-page.tsx'),
  'utf8',
);

assert.equal(
  studentPage.includes('const initialPresenceSyncedRef = useRef(false);'),
  true,
  'L-2c 学生页应记录首次在线状态是否已同步，避免重复上报空状态',
);

assert.equal(
  studentPage.includes('void persistState(createEmptyL2CStudentState(currentStudentName));'),
  true,
  'L-2c 学生页应在首次进入真实课堂时立即上报一份空学生状态，让教师端能统计在线人数',
);

assert.equal(
  studentPage.includes('if (selfState) {\n      initialPresenceSyncedRef.current = true;'),
  true,
  'L-2c 学生页在收到已有学生状态时，应停止首次空状态补发逻辑',
);

console.log('test-l2c-student-initial-state passed');
