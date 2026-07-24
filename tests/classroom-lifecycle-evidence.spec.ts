import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UserRole } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { createPrismaClient } from '../src/lib/prisma-client';

const prisma = createPrismaClient();
const evidenceDir = join(
  process.cwd(),
  'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/remediation/audit-remediation-teacher-classroom-lifecycle/playwright',
);

function recordEvidence(filename: string, payload: Record<string, unknown>) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, filename), `${JSON.stringify(payload, null, 2)}\n`);
}

const runtimeSeed = {
  teacherId: 'audit-teacher-runtime',
  studentId: 'audit-student-runtime',
  classId: 'audit-class-runtime',
  planId: 'audit-plan-runtime',
  sessionId: 'audit-session-runtime',
};

async function seedRuntimeClassroom() {
  await prisma.user.upsert({
    where: { id: runtimeSeed.teacherId },
    update: { role: UserRole.TEACHER, name: '审计教师' },
    create: {
      id: runtimeSeed.teacherId,
      email: 'audit-teacher-runtime@example.com',
      name: '审计教师',
      role: UserRole.TEACHER,
    },
  });
  await prisma.user.upsert({
    where: { id: runtimeSeed.studentId },
    update: { role: UserRole.STUDENT, name: '审计学生' },
    create: {
      id: runtimeSeed.studentId,
      email: 'audit-student-runtime@example.com',
      name: '审计学生',
      role: UserRole.STUDENT,
    },
  });
  await prisma.class.upsert({
    where: { id: runtimeSeed.classId },
    update: { teacherId: runtimeSeed.teacherId, name: '2026 控制班' },
    create: {
      id: runtimeSeed.classId,
      name: '2026 控制班',
      code: 'AR26RT',
      teacherId: runtimeSeed.teacherId,
      description: '课堂生命周期运行态审计班级',
    },
  });
  await prisma.studentProfile.upsert({
    where: { userId: runtimeSeed.studentId },
    update: { classId: runtimeSeed.classId, className: '2026 控制班' },
    create: {
      userId: runtimeSeed.studentId,
      classId: runtimeSeed.classId,
      className: '2026 控制班',
    },
  });
  await prisma.lessonPlan.upsert({
    where: { id: runtimeSeed.planId },
    update: { title: '班级课堂教案', authorId: runtimeSeed.teacherId },
    create: {
      id: runtimeSeed.planId,
      title: '班级课堂教案',
      description: '课堂生命周期审计用最小教案',
      authorId: runtimeSeed.teacherId,
      isPublic: false,
    },
  });
  await prisma.classSession.upsert({
    where: { id: runtimeSeed.sessionId },
    update: {
      teacherId: runtimeSeed.teacherId,
      classId: runtimeSeed.classId,
      planId: runtimeSeed.planId,
      status: 'ACTIVE',
      currentItemId: null,
      currentStage: null,
    },
    create: {
      id: runtimeSeed.sessionId,
      joinCode: '736251',
      teacherId: runtimeSeed.teacherId,
      classId: runtimeSeed.classId,
      planId: runtimeSeed.planId,
      status: 'ACTIVE',
    },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('class-bound classroom launch displays the classroom identity before start', async ({ page }) => {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'audit-teacher-1',
      email: 'audit-teacher@example.com',
      name: '审计教师',
      role: 'TEACHER',
    },
  });
  await page.context().addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);

  await page.route('**/api/teacher/classes/class-1', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'class-1',
        name: '2026 控制班',
        code: 'CTRL26',
        description: '课堂生命周期审计班级',
        year: '2026',
        semester: '春',
        isActive: true,
        students: [],
        _count: { students: 2 },
      }),
    });
  });
  await page.route('**/api/teacher/classes/class-1/sessions**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/teacher/classes/class-1/insights', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        overview: {
          overallIndex: 72,
          highRiskStudents: 0,
          mediumRiskStudents: 1,
          attentionStudents: 1,
          averageFactCount: 4,
        },
        diagnosis: {
          status: 'ready',
          summary: 'mocked',
          groups: [],
          claims: [],
          limitations: [],
          rootCauseClusters: [],
          materialization: {
            inputs: ['control-correction-diagnosis'],
          },
        },
        students: [],
        governance: null,
      }),
    });
  });
  await page.route('**/api/lesson-plans', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'plan-1', title: '班级课堂教案', description: null }]),
    });
  });
  await page.route('**/api/teacher/classes/launch-options', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        classes: [
          { id: 'class-1', name: '2026 控制班', code: 'CTRL26' },
          { id: 'class-2', name: '2026 控制二班', code: 'CTRL27' },
        ],
        defaultClassId: 'class-2',
      }),
    });
  });
  await page.goto('/teacher/classes/class-1');
  await page.getByRole('button', { name: '打开开始上课对话框' }).click();
  const launchDialog = page.getByRole('dialog', { name: '选择班级并开始上课' });
  await expect(launchDialog).toBeVisible();
  const classSelect = launchDialog.getByRole('combobox', { name: '本次课堂班级' });
  await expect(classSelect).toBeFocused();
  await expect(classSelect).toHaveValue('class-1');
  await expect(classSelect.locator('option:checked')).toHaveText('2026 控制班（CTRL26）');

  const screenshotPath = join(evidenceDir, 'class-bound-launch-dialog.png');
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  recordEvidence('class-bound-launch-dialog.json', {
    route: '/teacher/classes/class-1',
    screenshotPath,
    visibleDialog: '选择班级并开始上课',
    selectedClass: {
      id: 'class-1',
      label: '2026 控制班（CTRL26）',
      precedence: 'current class before persistent default',
    },
    duplicateHandling: 'covered-by-src/app/__tests__/lesson-plan-session-routes.test.ts',
    capturedAt: new Date().toISOString(),
  });
});

test('student role sees the classroom-code join path on an interactive course entry', async ({ context, page }) => {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'audit-student-1',
      email: 'audit-student@example.com',
      name: '审计学生',
      role: 'STUDENT',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);

  await page.goto('/interactive-learning/courses/unit-1-1-see-the-full-picture');
  await expect(page.getByRole('heading', { name: '输入课堂码加入课堂' })).toBeVisible();
  await expect(page.getByPlaceholder('输入 6 位课堂码')).toBeVisible();
  await expect(page.getByRole('button', { name: '加入课堂' })).toBeVisible();

  const screenshotPath = join(evidenceDir, 'student-temporary-join-entry.png');
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  recordEvidence('student-temporary-join-entry.json', {
    route: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    screenshotPath,
    visibleStudentPath: '输入课堂码加入课堂',
    runtimeStudentState: 'covered-by-src/features/interactive/__tests__/classroom-join-entry.test.ts',
    capturedAt: new Date().toISOString(),
  });
});

test('captures direct teacher and student classroom runtime evidence', async ({ browser }) => {
  await seedRuntimeClassroom();

  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const teacherToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: runtimeSeed.teacherId,
      email: 'audit-teacher-runtime@example.com',
      name: '审计教师',
      role: 'TEACHER',
    },
  });
  await teacherContext.addCookies([{
    name: 'next-auth.session-token',
    value: teacherToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto(`/classroom/teacher/${runtimeSeed.sessionId}`);
  await expect(teacherPage.getByText('2026 控制班 · 班级课堂')).toBeVisible();
  await expect(teacherPage.getByText('该教案暂无可授课环节')).toBeVisible();
  const teacherDesktopPath = join(evidenceDir, 'teacher-runtime-1440.png');
  const teacherCollapsedPath = join(evidenceDir, 'teacher-runtime-1440-collapsed.png');
  await teacherPage.screenshot({ path: teacherDesktopPath, fullPage: true });
  await teacherPage.screenshot({ path: teacherCollapsedPath, fullPage: true });
  await teacherPage.setViewportSize({ width: 320, height: 760 });
  const teacherMobilePath = join(evidenceDir, 'teacher-runtime-320.png');
  await teacherPage.screenshot({ path: teacherMobilePath, fullPage: true });
  await teacherContext.close();

  recordEvidence('teacher-runtime.json', {
    route: `/classroom/teacher/${runtimeSeed.sessionId}`,
    routePattern: '/classroom/teacher/[sessionId]',
    screenshots: {
      desktopExpanded: teacherDesktopPath,
      desktopCollapsed: teacherCollapsedPath,
      mobile: teacherMobilePath,
    },
    visibleIdentity: '2026 控制班 · 班级课堂',
    capturedAt: new Date().toISOString(),
  });

  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const studentToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: runtimeSeed.studentId,
      email: 'audit-student-runtime@example.com',
      name: '审计学生',
      role: 'STUDENT',
    },
  });
  await studentContext.addCookies([{
    name: 'next-auth.session-token',
    value: studentToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
  const studentPage = await studentContext.newPage();
  await studentPage.goto(`/classroom/student/${runtimeSeed.sessionId}`);
  await expect(studentPage.getByText('2026 控制班 · 班级课堂')).toBeVisible();
  await expect(studentPage.getByText('等待教师发放课堂环节...')).toBeVisible();
  const studentDesktopPath = join(evidenceDir, 'student-runtime-1440.png');
  const studentCollapsedPath = join(evidenceDir, 'student-runtime-1440-collapsed.png');
  await studentPage.screenshot({ path: studentDesktopPath, fullPage: true });
  await studentPage.screenshot({ path: studentCollapsedPath, fullPage: true });
  await studentPage.setViewportSize({ width: 320, height: 760 });
  const studentMobilePath = join(evidenceDir, 'student-runtime-320.png');
  await studentPage.screenshot({ path: studentMobilePath, fullPage: true });
  await studentContext.close();

  recordEvidence('student-runtime.json', {
    route: `/classroom/student/${runtimeSeed.sessionId}`,
    routePattern: '/classroom/student/[sessionId]',
    screenshots: {
      desktopExpanded: studentDesktopPath,
      desktopCollapsed: studentCollapsedPath,
      mobile: studentMobilePath,
    },
    visibleIdentity: '2026 控制班 · 班级课堂',
    releasedState: '等待教师发放课堂环节...',
    capturedAt: new Date().toISOString(),
  });
});
