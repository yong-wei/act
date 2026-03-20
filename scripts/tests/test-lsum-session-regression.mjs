import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const sessionRoute = read('src/app/api/session/[sessionId]/route.ts');
const stateChannel = read('src/features/interactive/session-framework/use-session-state-channel.ts');
const progressChannel = read('src/features/interactive/session-framework/use-session-progress-channel.ts');
const lsumStudentPage = read('src/features/interactive/lsum-design-feasible-domain/student-page.tsx');

assert.match(
  sessionRoute,
  /return NextResponse\.json\(\{\s*id: sessionId,[\s\S]*joinCode:[\s\S]*classId:/,
  'Redis 快路径返回的 sessionInfo 必须保留 joinCode 和 classId，否则教师端无法显示课堂码',
);

assert.match(
  stateChannel,
  /return useMemo\(\s*\(\)\s*=>\s*\(\{/,
  'useSessionStateChannel 返回值必须稳定化，避免上层 effect 因对象引用变化形成 GET\/POST 风暴',
);

assert.match(
  progressChannel,
  /return useMemo\(\s*\(\)\s*=>\s*\(\{/,
  'useSessionProgressChannel 返回值必须稳定化，避免课堂推进与轮询逻辑重复触发',
);

assert.match(
  lsumStudentPage,
  /onClick=\{\(\) => \{[\s\S]*setActiveIndex\(teacherIndex\);[\s\S]*\}\}/,
  'L-sum 学生页在不同步提示中必须真的跳转到教师当前页，而不是只打点不翻页',
);

console.log('lsum session regression test passed');
