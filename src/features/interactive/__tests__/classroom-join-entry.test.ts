import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('classroom join entry', () => {
  it('keeps session join and adds class join on the same page', () => {
    const source = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');

    expect(source).toContain('/api/session/join');
    expect(source).toContain('/api/classes/join');
    expect(source).toContain("type JoinMode = 'session' | 'class'");
  });

  it('allows alphanumeric class codes instead of digit-only input', () => {
    const source = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');

    expect(source).toContain("value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)");
    expect(source).toContain("inputMode={isClassMode ? 'text' : 'numeric'}");
    expect(source).toContain("searchParams.get('mode') === 'class' ? 'class' : 'session'");
    expect(source).not.toContain('/[a-zA-Z]/.test(rawCodeFromUrl)');
  });

  it('updates the student dashboard entry copy for classroom and class codes', () => {
    const source = readFileSync(join(repoRoot, 'src/app/(main)/dashboard/page.tsx'), 'utf8');

    expect(source).toContain('加入课堂 / 班级');
    expect(source).toContain('输入课堂码或班级加入码');
  });

  it('makes classroom join errors recoverable and announces the evidence writeback path', () => {
    const pageSource = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');
    const routeSource = readFileSync(join(repoRoot, 'src/app/api/session/join/route.ts'), 'utf8');

    expect(pageSource).toContain('role="alert"');
    expect(pageSource).toContain('data-classroom-join-state="recoverable-error"');
    expect(pageSource).toContain('sessionInfo.joinState?.evidenceWriteback');
    expect(routeSource).toContain('type ClassroomJoinState');
    expect(routeSource).toContain("buildJoinState('finished'");
    expect(routeSource).toContain("reviewHref: '/profile/evidence'");
    expect(routeSource).toContain('应用层串行去重');
    expect(routeSource).toContain('数据库级并发幂等仍未关闭');
  });

  it('connects classroom finished and teacher end states to evidence and review routes', () => {
    const studentSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/student-player.tsx'), 'utf8');
    const teacherSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/teacher-player.tsx'), 'utf8');

    expect(studentSource).toContain('data-classroom-student-state="finished-review"');
    expect(studentSource).toContain('/profile/evidence?sessionId=');
    expect(studentSource).toContain('查看课堂证据');
    expect(teacherSource).toContain('data-classroom-state-flow="join-release-submit-summary-end-review"');
    expect(teacherSource).toContain('data-classroom-end-state={status}');
    expect(teacherSource).toContain("router.push(reviewHref)");
    expect(teacherSource).not.toContain("confirm('确定要结束课堂吗？");
    expect(teacherSource).not.toContain('alert(error instanceof Error');
  });
});
