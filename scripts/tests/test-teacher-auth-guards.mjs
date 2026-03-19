import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertTeacherGuard(relativePath) {
  const content = read(relativePath);

  assert.match(
    content,
    /if\s*\(!session\?\.user\)\s*\{\s*redirect\('\/login'\);/s,
    `${relativePath} 必须在服务端处理未登录重定向`
  );

  assert.match(
    content,
    /if\s*\(session\.user\.role\s*!==\s*UserRole\.TEACHER\)\s*\{/,
    `${relativePath} 必须在服务端处理非教师角色`
  );
}

assertTeacherGuard('src/app/teacher/page.tsx');
assertTeacherGuard('src/app/teacher/resources/page.tsx');

console.log('teacher auth guard test passed');
