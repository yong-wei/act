import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildEvidenceTimelineBrowserUrl } from '@/features/data-governance/evidence-timeline-browser';

const repoRoot = process.cwd();

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('evidence browser entry points', () => {
  it('links the student growth page to the full student evidence browser', () => {
    const source = readSource('src/app/(main)/profile/growth/page.tsx');

    expect(source).toContain('href="/profile/evidence"');
    expect(source).toContain('查看全部证据');
  });

  it('links the class-scoped teacher student detail page to full evidence browsing', () => {
    const source = readSource('src/app/teacher/classes/[classId]/students/[studentId]/page.tsx');

    expect(source).toContain('href={`/teacher/classes/${classId}/students/${studentId}/evidence`}');
    expect(source).toContain('查看完整证据');
  });

  it('redirects the legacy teacher diagnosis page to the class-scoped diagnosis surface', () => {
    const source = readSource('src/app/(main)/teacher/students/[studentId]/diagnosis/page.tsx');

    expect(source).toContain('redirect(`/teacher/classes/${encodeURIComponent(studentProfile.classId)}/students/${encodeURIComponent(studentId)}`)');
    expect(source).not.toContain('/api/student/competency-snapshot');
    expect(source).not.toContain('studentAnswer');
  });

  it('redirects the legacy teacher evidence page to the class-scoped evidence browser', () => {
    const source = readSource('src/app/(main)/teacher/students/[studentId]/evidence/page.tsx');

    expect(source).toContain('redirect(`/teacher/classes/${encodeURIComponent(studentProfile.classId)}/students/${encodeURIComponent(studentId)}/evidence${suffix}`)');
    expect(source).toContain("query.set('returnTo', resolveTeacherReturnTo(searchParams?.returnTo, '/teacher/classes'))");
    expect(source).toContain("appendSearchParam(query, 'gradingRunId', searchParams?.gradingRunId)");
    expect(source).toContain("appendSearchParam(query, 'reportId', searchParams?.reportId)");
    expect(source).toContain("appendSearchParam(query, 'source', searchParams?.source)");
    expect(source).toContain('学生 ${studentId} 不存在，或不在当前教师可见范围。');
    expect(source).not.toContain('EvidenceTimelineBrowser');
    expect(source).not.toContain('/teacher/students/${params.studentId}/diagnosis');
  });

  it('defines browser pages for student, class-scoped teacher, and legacy teacher entry points', () => {
    expect(existsSync(join(repoRoot, 'src/app/(main)/profile/evidence/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx'))).toBe(true);
    expect(existsSync(join(repoRoot, 'src/app/(main)/teacher/students/[studentId]/evidence/page.tsx'))).toBe(true);
  });

  it('preserves teacher grading context on class-scoped evidence pages', () => {
    const source = readSource('src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx');
    const browserSource = readSource('src/features/data-governance/evidence-timeline-browser.tsx');

    expect(source).toContain('contextBadges={contextParts}');
    expect(source).toContain('mergeTeacherEvidenceContext');
    expect(source).toContain('ActionStatusPanel');
    expect(source).toContain('data-teacher-evidence-remediation="context-status"');
    expect(source).toContain('data-teacher-evidence-next-steps');
    expect(source).toContain('data-teacher-evidence-remediation-task={interventionAction.status}');
    expect(source).toContain("data-teacher-evidence-report-handoff={hasCompleteReportContext ? 'available' : undefined}");
    expect(source).toContain("data-teacher-evidence-browse-return={hasCompleteReportContext ? undefined : 'available'}");
    expect(source).toContain('data-teacher-evidence-mobile-actions="fixed"');
    expect(source).toContain("data-teacher-evidence-mobile-report-handoff={hasCompleteReportContext ? 'available' : undefined}");
    expect(source).toContain("data-teacher-evidence-mobile-browse-return={hasCompleteReportContext ? undefined : 'available'}");
    expect(source).toContain('emptyBackHref={hasCompleteReportContext ? undefined : studentDetailHref}');
    expect(source).toContain("url.searchParams.set('gradingRunId', context.gradingRunId)");
    expect(source).toContain("url.searchParams.set('reportId', context.reportId)");
    expect(source).toContain("url.searchParams.set('source', context.source)");
    expect(browserSource).toContain('contextBadges?: string[]');
    expect(browserSource).toContain('contextBadges.map');
  });

  it('keeps plain teacher evidence browsing out of blocked report context state', () => {
    const source = readSource('src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx');

    expect(source).toContain('const hasReportContext = providedReportContext.length > 0;');
    expect(source).toContain('const hasCompleteReportContext = hasReportContext && missingContext.length === 0;');
    expect(source).toContain("].filter((item): item is string => Boolean(item)) : [];");
    expect(source).toContain('证据页以普通浏览模式打开');
    expect(source).toContain('const studentDetailHref = `/teacher/classes/${params.classId}/students/${params.studentId}`;');
    expect(source).toContain(': studentDetailHref;');
    expect(source).toContain("const primaryActionLabel = hasCompleteReportContext ? '回到报告交付' : '返回学生详情';");
    expect(source).toContain('nextAction: hasCompleteReportContext');
  });

  it('guards evidence browser state updates from stale filter requests', () => {
    const source = readSource('src/features/data-governance/evidence-timeline-browser.tsx');

    expect(source).toContain('requestSequenceRef');
    expect(source).toContain('requestId !== requestSequenceRef.current');
    expect(source).toContain('emptyBackHref?: string;');
    expect(source).toContain('href={emptyBackHref ?? backHref}');
  });

  it('initializes the student evidence browser from lessonId query parameters', () => {
    const pageSource = readSource('src/app/(main)/profile/evidence/page.tsx');
    const browserSource = readSource('src/features/data-governance/evidence-timeline-browser.tsx');

    expect(pageSource).toContain('searchParams');
    expect(pageSource).toContain('initialLessonId={initialLessonId}');
    expect(browserSource).toContain('initialLessonId?: string');
    expect(browserSource).toContain("useState(initialLessonId ?? '')");
    expect(browserSource).toContain("setLessonId(initialLessonId ?? '')");
  });

  it('passes sessionId filters through to the student evidence API URL', () => {
    const pageSource = readSource('src/app/(main)/profile/evidence/page.tsx');

    expect(pageSource).toContain('initialSessionId={initialSessionId}');
    expect(buildEvidenceTimelineBrowserUrl('/api/student/evidence', {
      lessonId: 'unit-4-1',
      sessionId: 'session-123',
      cursor: 'cursor-1',
    })).toBe('/api/student/evidence?limit=20&lessonId=unit-4-1&sessionId=session-123&cursor=cursor-1');
  });

  it('clears stale first-page evidence before refetching while preserving loaded pages on pagination failures', () => {
    const source = readSource('src/features/data-governance/evidence-timeline-browser.tsx');

    expect(source).toContain('if (!cursor) {');
    expect(source).toContain('setItems([]);');
    expect(source).toContain('setNextCursor(null);');
    expect(source).toContain('setItems((previous) => cursor ? [...previous, ...payload.items] : payload.items);');
  });
});
