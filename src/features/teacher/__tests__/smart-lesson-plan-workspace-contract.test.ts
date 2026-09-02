// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { SmartLessonPlanWorkspace } from '../smart-lesson-plan-workspace';

vi.mock('@/components/ai/konling-entry-point-button', () => ({
  KonlingEntryPointButton: ({ label }: { label: string }) => createElement('button', null, label),
}));

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
  it('keeps structured suggestions inside the shared conversation and refreshes the affected stage', () => {
    expect(workspaceSource).toContain("window.addEventListener('konling:smart-task-confirmed'");
    expect(workspaceSource).toContain('data-konling-highlighted-stage');
    expect(workspaceSource).toContain('label="与控灵共创"');
    expect(workspaceSource).not.toContain('查看孔灵建议');
    expect(workspaceSource).not.toContain('待确认的孔灵建议');
    expect(workspaceSource).not.toContain('/konling-suggestions`, { cache:');
  });

  it('keeps advisory review disabled until hydration completes without relaxing draft readiness', async () => {
    const initialTasks = [{
      id: 'task-1',
      courseBasisId: 'basis-1',
      revision: 1,
      topic: '闭环控制',
      audience: '本科生',
      durationMinutes: 45,
      sources: [],
      knowledgePoints: [],
      goals: [],
      drafts: [{
        id: 'draft-1',
        state: 'READY',
        version: 1,
        content: { title: '闭环控制教案' },
        contentHash: 'content-hash',
        jobs: [],
        reviews: [],
      }],
      revisions: [],
      workspace: {
        currentStage: 'lesson-generation',
        statusLabel: '教案已就绪',
        resumable: true,
        unsupportedPayload: false,
        stages: [
          'course-basis',
          'topic-goals',
          'class-attainment',
          'lesson-generation',
          'courseware-generation',
        ].map((id) => ({
          id,
          title: id,
          state: 'READY',
          statusLabel: '已就绪',
          complete: true,
        })),
      },
    }];
    const props = {
      courseBases: [],
      classDiagnosisOptions: [],
      textbookCatalog: [],
      initialTasks,
      initialSelectedTaskId: 'task-1',
    };
    const serverHtml = renderToStaticMarkup(createElement(SmartLessonPlanWorkspace, props));
    expect(serverHtml).toMatch(/<button[^>]*disabled=""[^>]*>AI 建议<\/button>/);

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(SmartLessonPlanWorkspace, props)));
    const advisoryButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === 'AI 建议');
    expect(advisoryButton?.disabled).toBe(false);

    act(() => root.unmount());
    container.remove();
    expect(workspaceSource).toContain(
      "disabled={!hydrationReady || !draft?.content || draft.state !== 'READY'}",
    );
  });

  it('uses a fresh advisory-review idempotency key for each new click intent', () => {
    expect(workspaceSource).toContain('`smart-prep:${draft.id}:review:${crypto.randomUUID()}`');
    expect(workspaceSource).not.toContain('`smart-prep:${draft.id}:review:${draft.version}`');
  });

  it('enables textbook-only task creation after the teacher confirms the range', async () => {
    const props = {
      courseBases: [{ id: 'basis-1', title: '自动控制原理', documents: [] }],
      classDiagnosisOptions: [],
      textbookCatalog: [{
        bookId: 'book-1',
        title: '自动控制原理',
        edition: '8',
        ranges: [{
          level: 'SECTION' as const,
          unitId: 'section-1',
          title: '稳定性判据',
          naturalNumber: '1.1',
          structuralPath: ['chapter-1', 'section-1'],
        }],
      }],
      initialTasks: [],
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(SmartLessonPlanWorkspace, props)));

    const submit = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('确认并创建单课任务'));
    const textbookConfirmation = container.querySelector<HTMLInputElement>(
      'input[name="confirmTextbookRange"]',
    );
    expect(submit?.disabled).toBe(true);

    await act(async () => {
      textbookConfirmation?.click();
    });
    expect(submit?.disabled).toBe(false);

    act(() => root.unmount());
    container.remove();
  });

  it('drops an out-of-order poll response so an older projection cannot overwrite a newer one', async () => {
    const runningTask = {
      id: 'task-race',
      courseBasisId: 'basis-1',
      revision: 4,
      topic: '竞态任务',
      audience: '本科生',
      durationMinutes: 45,
      drafts: [{
        id: 'draft-race',
        state: 'GENERATING',
        version: 2,
        jobs: [{ id: 'job-race', state: 'RUNNING', stages: [] }],
        reviews: [],
      }],
      revisions: [],
      workspace: {
        currentStage: 'lesson-generation',
        statusLabel: '正在生成',
        resumable: false,
        unsupportedPayload: false,
        stages: ['course-basis', 'topic-goals', 'class-attainment', 'lesson-generation', 'courseware-generation'].map((id) => ({
          id,
          title: id,
          state: 'current',
          statusLabel: '进行中',
          complete: false,
        })),
      },
    };
    const completedTask = {
      ...runningTask,
      workspace: { ...runningTask.workspace, statusLabel: '生成完成' },
      drafts: [{
        ...runningTask.drafts[0],
        state: 'READY',
        jobs: [{ id: 'job-race', state: 'COMPLETED', stages: [] }],
      }],
    };
    let resolveFirst: (value: Response) => void = () => {};
    const firstFetch = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstFetch)
      .mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify({ task: completedTask }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);
      await act(async () => root.render(createElement(SmartLessonPlanWorkspace, {
        courseBases: [],
        classDiagnosisOptions: [],
        textbookCatalog: [],
        initialTasks: [runningTask],
        initialSelectedTaskId: 'task-race',
      })));
      const refresh = [...container.querySelectorAll('button')]
        .find((button) => button.textContent === '刷新进度');
      // 两次重叠刷新：第二次（COMPLETED，同 revision）先返回并被应用。
      await act(async () => { refresh?.click(); });
      await act(async () => { refresh?.click(); });
      await act(async () => {});
      // 第一次（较早发出的 RUNNING 投影）最后返回，必须被丢弃。
      await act(async () => {
        resolveFirst(new Response(JSON.stringify({ task: runningTask }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));
        await firstFetch;
      });
      await act(async () => {});
      expect(container.textContent).toContain('生成完成');
      expect(container.textContent).not.toContain('正在生成');
      act(() => root.unmount());
      container.remove();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('drops an out-of-order failed poll before it can overwrite the terminal status message', async () => {
    const runningTask = {
      id: 'task-race-2',
      courseBasisId: 'basis-1',
      revision: 4,
      topic: '竞态失败提示',
      audience: '本科生',
      durationMinutes: 45,
      drafts: [{
        id: 'draft-race-2',
        state: 'GENERATING',
        version: 2,
        jobs: [{ id: 'job-race-2', state: 'RUNNING', stages: [] }],
        reviews: [],
      }],
      revisions: [],
      workspace: {
        currentStage: 'lesson-generation',
        statusLabel: '正在生成',
        resumable: false,
        unsupportedPayload: false,
        stages: ['course-basis', 'topic-goals', 'class-attainment', 'lesson-generation', 'courseware-generation'].map((id) => ({
          id,
          title: id,
          state: 'current',
          statusLabel: '进行中',
          complete: false,
        })),
      },
    };
    const completedTask = {
      ...runningTask,
      workspace: { ...runningTask.workspace, statusLabel: '生成完成' },
      drafts: [{ ...runningTask.drafts[0], state: 'READY', jobs: [{ id: 'job-race-2', state: 'COMPLETED', stages: [] }] }],
    };
    let rejectFirst: (reason?: unknown) => void = () => {};
    const firstFetch = new Promise<Response>((_, reject) => { rejectFirst = reject; });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstFetch)
      .mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify({ task: completedTask }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);
      await act(async () => root.render(createElement(SmartLessonPlanWorkspace, {
        courseBases: [],
        classDiagnosisOptions: [],
        textbookCatalog: [],
        initialTasks: [runningTask],
        initialSelectedTaskId: 'task-race-2',
      })));
      const refresh = [...container.querySelectorAll('button')]
        .find((button) => button.textContent === '刷新进度');
      await act(async () => { refresh?.click(); });
      await act(async () => { refresh?.click(); });
      await act(async () => {});
      await act(async () => {
        rejectFirst(new TypeError('network dropped'));
        await firstFetch.catch(() => undefined);
      });
      await act(async () => {});
      expect(container.textContent).toContain('生成完成');
      expect(container.textContent).not.toContain('任务刷新失败');
      act(() => root.unmount());
      container.remove();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not offer recovery controls for a superseded generation job', () => {
    expect(workspaceSource).not.toContain("['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'].includes(job.state)");
    expect(workspaceSource).not.toContain("['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state)");
    expect(workspaceSource).toContain('SMART_JOB_RECOVERY_STATES.includes(job.state');
    expect(workspaceSource).toContain('SMART_JOB_EDIT_BLOCKING_STATES.includes(job.state');
    const libSource = readFileSync(
      join(process.cwd(), 'src/lib/smart-lesson-plan/workspace.ts'),
      'utf8',
    );
    expect(libSource).toContain("export const SMART_JOB_RECOVERY_STATES = ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'] as const;");
    expect(libSource).toContain("export const SMART_JOB_EDIT_BLOCKING_STATES = ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'] as const;");
  });

  it('uses the stable courseware draft and approved-plan revision URL contract', () => {
    expect(workspaceSource).toContain("new URLSearchParams({ planRevisionId, creationIntentId: crypto.randomUUID() })");
    expect(workspaceSource).toContain('coursewareCreationInFlight.current');
    expect(workspaceSource).toContain('/teacher/smart-prep/courseware/new?${query.toString()}');
    expect(coursewarePageSource).toContain("draftId === 'new'");
    expect(coursewarePageSource).toContain('creationIntentId');
    expect(coursewarePageSource).toContain('buildSmartCoursewareDraftCreationKey(planRevisionId, creationIntentId)');
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
    expect(coursewarePageSource).toContain('resolveSmartCoursewareOrderingSecret()');
    expect(coursewarePageSource).toContain('orderingPermutationSecret:');
    expect(coursewarePageSource).not.toContain('NEXT_PUBLIC_');
    expect(coursewareEditorSource).not.toContain('orderingPermutationSecret');
    expect(coursewareEditorSource).not.toContain('SMART_COURSEWARE_ORDERING_SECRET');
    expect(coursewareEditorSource).toContain('createSmartCoursewareStudentPreviewFromService(next, payload.preview)');
    expect(coursewareEditorSource).not.toContain('projectSmartCoursewareStudentPreview');
    for (const label of ['拆分当前步骤', '所选内容可视编辑', '步骤前移', '步骤后移', '合并并删除步骤']) {
      expect(coursewareEditorSource).toContain(label);
    }
    expect(coursewareEditorSource).not.toContain('window.prompt');
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
