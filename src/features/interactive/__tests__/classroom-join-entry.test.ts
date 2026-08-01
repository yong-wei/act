import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function collectTeacherRuntimePages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return collectTeacherRuntimePages(fullPath);
    return entry === 'teacher-page.tsx' ? [fullPath] : [];
  });
}

describe('classroom join entry', () => {
  it('keeps session join and adds class join on the same page', () => {
    const source = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');

    expect(source).toContain('/api/session/join');
    expect(source).toContain('/api/classes/join');
    expect(source).toContain("type JoinMode = 'session' | 'class'");
  });

  it('allows alphanumeric class codes instead of digit-only input', () => {
    const source = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');

    expect(source).toContain(".replace(/[^a-zA-Z0-9]/g, '')");
    expect(source).toContain('.toUpperCase()');
    expect(source).toContain("inputMode={isClassMode ? 'text' : 'numeric'}");
    expect(source).toContain("searchParams.get('mode') === 'class' ? 'class' : 'session'");
    expect(source).not.toContain('/[a-zA-Z]/.test(rawCodeFromUrl)');
  });

  it('keeps the personal center classroom join entry for classroom and class codes', () => {
    const source = readFileSync(join(repoRoot, 'src/app/(main)/profile/page.tsx'), 'utf8');

    expect(source).toContain('href="/classroom/join"');
    expect(source).toContain('加入课堂 / 班级');
    expect(source).toContain('加入课堂或班级后会补齐课堂记录');
  });

  it('makes classroom join errors recoverable and announces the evidence writeback path', () => {
    const pageSource = readFileSync(join(repoRoot, 'src/app/classroom/join/page.tsx'), 'utf8');
    const routeSource = readFileSync(join(repoRoot, 'src/app/api/session/join/route.ts'), 'utf8');
    const actionStatusPanelSource = readFileSync(join(repoRoot, 'src/components/platform/action-status.tsx'), 'utf8');

    expect(pageSource).toContain('<ActionStatusPanel');
    expect(pageSource).toContain("kind: 'classroom-code-error'");
    expect(pageSource).toContain('data-classroom-join-state="recoverable-error"');
    expect(pageSource).toContain('data-classroom-join-recovery-link="review-evidence"');
    expect(actionStatusPanelSource).toContain("role={isErrorLike ? 'alert' : 'status'}");
    expect(pageSource).toContain('setRecoveryLink(reviewHref ?');
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
    const dashboardSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/data-dashboard.tsx'), 'utf8');

    expect(studentSource).toContain('data-classroom-student-state="finished-review"');
    expect(studentSource).toContain('/profile/evidence?sessionId=');
    expect(studentSource).toContain('查看课堂证据');
    expect(teacherSource).toContain('data-classroom-state-flow="join-release-submit-summary-end-review"');
    expect(teacherSource).toContain('data-classroom-end-state={status}');
    expect(teacherSource).toContain('data-classroom-teacher-state="finished-review"');
    expect(teacherSource).toContain('role="status" aria-live="polite"');
    expect(dashboardSource).toContain('data-classroom-online-roster');
    expect(dashboardSource).toContain('data-classroom-delivery-state');
    expect(teacherSource).toContain("router.push(reviewHref)");
    expect(teacherSource).not.toContain("confirm('确定要结束课堂吗？");
    expect(teacherSource).not.toContain('alert(error instanceof Error');
  });

  it('guards direct classroom runtime pages with server-side session access checks', () => {
    const teacherPageSource = readFileSync(join(repoRoot, 'src/app/classroom/teacher/[sessionId]/page.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(repoRoot, 'src/app/classroom/student/[sessionId]/page.tsx'), 'utf8');

    expect(teacherPageSource).toContain('getServerSession(authOptions)');
    expect(teacherPageSource).toContain('canManageClassroomSession(session, userSession.user)');
    expect(studentPageSource).toContain('getServerSession(authOptions)');
    expect(studentPageSource).toContain('canAccessClassroomSession(session, userSession.user)');
  });

  it('marks class-bound and temporary launch contexts explicitly', () => {
    const classPageSource = readFileSync(join(repoRoot, 'src/app/teacher/classes/[classId]/page.tsx'), 'utf8');
    const teacherLauncherSource = readFileSync(
      join(repoRoot, 'src/features/teacher/teacher-classroom-launcher.tsx'),
      'utf8',
    );
    const lessonListSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/lesson-plan-list.tsx'), 'utf8');
    const courseEntrySource = readFileSync(join(repoRoot, 'src/features/interactive/shared/course-entry-shell.tsx'), 'utf8');
    const premiumEntrySource = readFileSync(join(repoRoot, 'src/features/interactive/shared/premium-lesson-entry-page.tsx'), 'utf8');
    const studentSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/student-player.tsx'), 'utf8');

    expect(classPageSource).toContain('useTeacherClassroomLauncher');
    expect(classPageSource).toContain('currentClassId: classId');
    expect(teacherLauncherSource).toContain("fetch('/api/session'");
    expect(teacherLauncherSource).toContain('classId: selectedClassId');
    expect(teacherLauncherSource).toContain("launchContext: 'class-bound'");
    expect(teacherLauncherSource).toContain('...(duplicateAction ? { duplicateAction } : {})');
    expect(lessonListSource).toContain("launchContext: 'temporary'");
    expect(lessonListSource).toContain("duplicateAction: 'new-session'");
    expect(courseEntrySource).toContain('useTeacherClassroomLauncher');
    expect(courseEntrySource).toContain('preparePlanId: async () =>');
    expect(courseEntrySource).toContain('sourcePresetKey: config.presetKey');
    expect(courseEntrySource).toContain("duplicateAction: 'new-session'");
    expect(premiumEntrySource).toContain('useTeacherClassroomLauncher');
    expect(premiumEntrySource).toContain('preparePlanId: async () =>');
    expect(premiumEntrySource).toContain('sourcePresetKey: config.presetKey');
    expect(premiumEntrySource).toContain("duplicateAction: 'new-session'");
    expect(teacherLauncherSource.indexOf("const preflightResponse = await fetch('/api/session'")).toBeLessThan(
      teacherLauncherSource.indexOf('planId = await request.preparePlanId()'),
    );
    expect(studentSource).toContain('data-classroom-identity-kind={classroomIdentity.kind}');
    expect(studentSource).not.toContain('session id');
  });

  it('uses product-owned lifecycle dialogs instead of native classroom confirms', () => {
    const lifecycleDialogSource = readFileSync(join(repoRoot, 'src/features/classroom/classroom-lifecycle-dialog.ts'), 'utf8');
    const classPageSource = readFileSync(join(repoRoot, 'src/app/teacher/classes/[classId]/page.tsx'), 'utf8');
    const lessonListSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/lesson-plan-list.tsx'), 'utf8');
    const courseEntrySource = readFileSync(join(repoRoot, 'src/features/interactive/shared/course-entry-shell.tsx'), 'utf8');
    const premiumEntrySource = readFileSync(join(repoRoot, 'src/features/interactive/shared/premium-lesson-entry-page.tsx'), 'utf8');
    const teacherRuntimeSources = collectTeacherRuntimePages(join(repoRoot, 'src/features/interactive'))
      .map((filePath) => readFileSync(filePath, 'utf8'));
    const lifecycleSources = [
      classPageSource,
      lessonListSource,
      courseEntrySource,
      premiumEntrySource,
      ...teacherRuntimeSources,
    ].join('\n');

    expect(lifecycleDialogSource).toContain('data-classroom-lifecycle-dialog');
    expect(lifecycleDialogSource).toContain("role', 'dialog'");
    expect(lifecycleDialogSource).toContain("aria-modal', 'true'");
    expect(lifecycleDialogSource).toContain("event.key === 'Escape'");
    expect(lifecycleDialogSource).toContain("event.key !== 'Tab'");
    expect(lifecycleDialogSource).toContain('opener.focus()');
    expect(lifecycleDialogSource).toContain('overlay.remove()');
    expect(lifecycleDialogSource).toContain('requestClassroomConflictChoice');
    expect(lifecycleDialogSource).toContain('requestClassroomEndConfirmation');
    expect(classPageSource).toContain('requestClassroomActionConfirmation');
    expect(classPageSource).toContain('requestClassroomEndConfirmation');
    expect(lessonListSource).toContain('requestClassroomConflictChoice');
    expect(courseEntrySource).toContain('requestClassroomConflictChoice');
    expect(premiumEntrySource).toContain('requestClassroomConflictChoice');
    expect(teacherRuntimeSources.every((source) => source.includes('requestClassroomEndConfirmation'))).toBe(true);
    expect(lifecycleSources).not.toMatch(/window\.confirm|(?<!requestClassroomAction)confirm\(/);
    expect([
      lessonListSource,
      classPageSource,
    ].join('\n')).not.toMatch(/window\.alert|\balert\(/);
  });

  it('records teacher control lifecycle events through the state endpoint', () => {
    const teacherSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/teacher-player.tsx'), 'utf8');
    const dashboardSource = readFileSync(join(repoRoot, 'src/features/lesson-engine/data-dashboard.tsx'), 'utf8');

    expect(teacherSource).toContain('recordControlEvidence');
    expect(teacherSource).toContain("recordControlEvidence('start-class'");
    expect(teacherSource).toContain("recordControlEvidence('copy-code'");
    expect(teacherSource).toContain("recordControlEvidence('online-panel'");
    expect(teacherSource).toContain("recordControlEvidence('release-interaction'");
    expect(teacherSource).toContain("stateKey: 'teacher-sync'");
    expect(dashboardSource).toContain('roster.filter((student) => student.online).length');
  });
});
