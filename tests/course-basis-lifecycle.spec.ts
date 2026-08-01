import 'dotenv/config';

import { expect, test, type BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

import { adoptCourseBasisVersion } from '../src/lib/course-basis/service';
import { prisma } from '../src/lib/prisma';

const suffix = `${Date.now()}-${process.pid}`;
const teacherId = `course-basis-lifecycle-teacher-${suffix}`;
const teacherEmail = `course-basis-lifecycle-${suffix}@example.com`;
let courseBasisId = '';
let documentId = '';
let versionId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: teacherId,
      email: teacherEmail,
      name: '课程依据生命周期验收教师',
      role: 'TEACHER',
    },
  });
});

test.afterAll(async () => {
  if (versionId) {
    await prisma.courseBasisReferenceLink.deleteMany({ where: { versionId } });
    await prisma.courseBasisProjection.deleteMany({ where: { versionId } });
    await prisma.courseBasisSegment.deleteMany({ where: { versionId } });
    await prisma.courseBasisDocumentVersion.deleteMany({ where: { id: versionId } });
  }
  if (documentId) await prisma.courseBasisDocument.deleteMany({ where: { id: documentId } });
  if (courseBasisId) await prisma.courseBasis.deleteMany({ where: { id: courseBasisId } });
  await prisma.user.deleteMany({ where: { id: teacherId } });
  await prisma.$disconnect();
});

async function addTeacherSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: teacherId,
      email: teacherEmail,
      name: '课程依据生命周期验收教师',
      role: 'TEACHER',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
  }]);
}

test('shows editable, frozen, and disabled document states without freezing a preview', async ({ page, context }) => {
  await addTeacherSession(context);
  await page.goto('/teacher/smart-prep?view=basis');
  const created = await page.evaluate(async ({ uniqueSuffix }) => {
    async function api(path: string, body: Record<string, unknown>) {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`${path}:${response.status}:${JSON.stringify(payload)}`);
      return payload;
    }
    const basis = await api('/api/teacher/course-bases', {
      courseIdentity: `LIFECYCLE-${uniqueSuffix}`,
      title: '自动控制原理课程依据',
    });
    const document = await api(`/api/teacher/course-bases/${basis.courseBasis.id}/documents`, {
      title: '根轨迹课程标准',
      kind: 'STANDARD',
    });
    const version = await api(`/api/teacher/course-bases/documents/${document.document.id}/versions`, {
      sourceType: 'MARKDOWN',
      sourceName: '根轨迹课程标准.md',
      mimeType: 'text/markdown',
      content: [
        '# 根轨迹课程标准',
        '',
        '## 教学目标',
        '',
        '- 判断闭环极点随增益变化的规律。',
        '',
        '| 内容 | 要求 |',
        '| --- | --- |',
        '| 相角条件 | 能够判定根轨迹上的点 |',
        '',
        '$$1 + K G(s)H(s)=0$$',
        '',
        '```text',
        '稳定锚点用于引用',
        '```',
      ].join('\n'),
    });
    const previewResponse = await fetch(`/api/teacher/course-bases/versions/${version.version.id}`);
    const preview = await previewResponse.json();
    if (!previewResponse.ok) throw new Error(JSON.stringify(preview));
    return {
      courseBasisId: basis.courseBasis.id as string,
      documentId: document.document.id as string,
      versionId: version.version.id as string,
      anchors: preview.preview.segments.map((segment: { stableAnchor: string; contentHash: string }) => ({
        stableAnchor: segment.stableAnchor,
        contentHash: segment.contentHash,
      })),
    };
  }, { uniqueSuffix: suffix });
  courseBasisId = created.courseBasisId;
  documentId = created.documentId;
  versionId = created.versionId;

  await page.goto(`/teacher/smart-prep?view=basis&courseBasisId=${encodeURIComponent(courseBasisId)}`);
  const workspace = page.locator('[data-course-basis-workspace]');
  await expect(workspace.getByText('根轨迹课程标准.md')).toBeVisible();
  await expect(workspace.getByText('可编辑', { exact: true })).toBeVisible();
  await expect(workspace.getByRole('button', { name: '确认' })).toHaveCount(0);

  await workspace.getByRole('button', { name: '预览备课依据' }).click();
  await expect(workspace.getByRole('status')).toContainText('备课 Source Pack 已生成');
  await expect.poll(async () => (
    await prisma.courseBasisDocumentVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: { reviewState: true },
    })
  ).reviewState).toBe('PENDING');

  await workspace.getByRole('link', { name: '打开文档' }).click();
  await expect(page.getByText('根轨迹课程标准.md · v1 · 可编辑')).toBeVisible();
  await expect(page.locator('[data-preparation-rich-editor] .tiptap')).toContainText('判断闭环极点随增益变化的规律');
  await expect(page.getByRole('button', { name: '教学目标' })).toBeVisible();

  await adoptCourseBasisVersion(prisma, {
    actor: { id: teacherId, role: 'TEACHER' },
    versionId,
    adopter: { referenceType: 'RESOURCE_PACK', referenceId: `browser-pack-${suffix}` },
    anchors: created.anchors,
  });
  await page.goto(`/teacher/smart-prep?view=basis&courseBasisId=${encodeURIComponent(courseBasisId)}`);
  await expect(page.locator('[data-course-basis-workspace]').getByText('已冻结', { exact: true })).toBeVisible();

  const retired = await page.request.patch(`/api/teacher/course-bases/versions/${versionId}`, {
    data: { action: 'retire' },
  });
  expect(retired.status()).toBe(200);
  await page.reload();
  await expect(page.locator('[data-course-basis-workspace]').getByText('已停用', { exact: true })).toBeVisible();
  await page.evaluate(() => window.localStorage.clear());
  await page.getByRole('link', { name: '查看历史内容' }).click();
  await expect(page.getByText('根轨迹课程标准.md · v1 · 已停用')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '内容仍可核查' })).toBeVisible();
});
