import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const l2bCourse = read('src/lib/l2b-course.ts');
const runtimeRoute = read('src/app/course-runtime/[...assetPath]/route.ts');

assert.equal(
  l2bCourse.includes("/course-runtime/lessons/L-2b/media/sh-01-pole-migration-locus.svg") &&
    l2bCourse.includes("/course-runtime/lessons/L-2b/media/h-05-example2-root-locus-crossing.svg"),
  true,
  'L-2b 媒体 URL 应通过 course-runtime 路由读取 runtime 产物',
);

assert.equal(
  runtimeRoute.includes("join(process.cwd(), 'course-content', 'runtime'") &&
    runtimeRoute.includes('await readFile') &&
    runtimeRoute.includes('NextResponse'),
  true,
  'course-runtime 路由应从 course-content/runtime 安全读取文件并返回响应',
);

console.log('l2b runtime route test passed');
