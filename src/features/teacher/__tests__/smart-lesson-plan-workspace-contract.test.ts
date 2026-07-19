import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceSource = readFileSync(
  join(process.cwd(), 'src/features/teacher/smart-lesson-plan-workspace.tsx'),
  'utf8',
);
const coursewarePageSource = readFileSync(
  join(process.cwd(), 'src/app/teacher/smart-prep/courseware/[draftId]/page.tsx'),
  'utf8',
);
const coursewareEditorSource = readFileSync(
  join(process.cwd(), 'src/features/teacher/smart-courseware-editor.tsx'),
  'utf8',
);
const regenerationRouteSource = readFileSync(
  join(process.cwd(), 'src/app/api/teacher/smart-courseware/drafts/[draftId]/modules/[moduleId]/regeneration/route.ts'),
  'utf8',
);

describe('smart lesson plan workspace request contracts', () => {
  it('uses a fresh advisory-review idempotency key for each new click intent', () => {
    expect(workspaceSource).toContain('`smart-prep:${draft.id}:review:${crypto.randomUUID()}`');
    expect(workspaceSource).not.toContain('`smart-prep:${draft.id}:review:${draft.version}`');
  });

  it('does not offer recovery controls for a superseded generation job', () => {
    expect(workspaceSource).toContain("job && !job.supersededAt && ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'].includes(job.state)");
    expect(workspaceSource).toContain("job && !job.supersededAt && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state)");
  });

  it('uses the stable courseware draft and approved-plan revision URL contract', () => {
    expect(workspaceSource).toContain('/teacher/smart-prep/courseware/new?planRevisionId=');
    expect(workspaceSource).toContain('encodeURIComponent(task.revisions[0].id)');
    expect(coursewarePageSource).toContain("draftId === 'new'");
    expect(coursewarePageSource).toContain('createSmartCoursewareDraft(prisma');
    expect(coursewarePageSource).toContain('redirect(`/teacher/smart-prep/courseware/${encodeURIComponent(draft.id)}`)');
  });

  it('detects staleness against the latest approved revision for the same owner and task', () => {
    expect(coursewarePageSource).toContain('smartLessonRevision.findFirst');
    expect(coursewarePageSource).toContain("where: { ownerId: actor.id, taskId: draft.planRevision.taskId }");
    expect(coursewarePageSource).toContain("orderBy: { revisionNumber: 'desc' }");
    expect(coursewarePageSource).not.toContain('draft.planRevisionNumber !== draft.planRevision.revisionNumber');
  });

  it('keeps student projection server-owned and exposes complete step controls', () => {
    expect(coursewareEditorSource).toContain('createSmartCoursewareStudentPreviewFromService(next, payload.preview)');
    expect(coursewareEditorSource).not.toContain('projectSmartCoursewareStudentPreview');
    for (const label of ['拆分当前步骤', '编辑步骤', '步骤前移', '步骤后移', '合并并删除步骤']) {
      expect(coursewareEditorSource).toContain(label);
    }
    expect(coursewareEditorSource).toContain('renderInteractiveManifestStep');
    expect(coursewareEditorSource).toContain('createManifestStudentActivityRegistry');
    expect(coursewareEditorSource).toContain('renderStudentInteractiveActivity');
    expect(coursewareEditorSource).toContain('useManifestSubmissionController');
    expect(coursewareEditorSource).not.toContain('JSON.stringify(module.payload');
  });

  it('does not invoke the module provider synchronously from the request route', () => {
    expect(regenerationRouteSource).toContain('requestCoursewareModuleRegeneration');
    expect(regenerationRouteSource).not.toContain('generateCoursewareModuleCandidate');
  });
});
