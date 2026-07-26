// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import { PreparationDocumentEditorShell } from '../preparation-document-editor/editor-shell';
import { CourseBasisDocumentEditor } from '../preparation-document-editor/course-basis-document-editor';
import { LessonDocumentEditor } from '../preparation-document-editor/lesson-document-editor';

describe('preparation document editor interactions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('protects dirty exits, exposes explicit save, and supports keyboard-dismissible drawers', async () => {
    const onSave = vi.fn(async () => undefined);
    const onExit = vi.fn();
    const onAccept = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await act(async () => root.render(
      <PreparationDocumentEditorShell
        title="教案"
        sections={[{ id: 'bridgeIn', title: '导入', complete: false }]}
        suggestions={[{ id: 'suggestion-1', message: '补充例题', replacement: '补充例题', status: 'open' }]}
        saveState="dirty"
        onSave={onSave}
        onExit={onExit}
        onAcceptSuggestion={onAccept}
        onIgnoreSuggestion={vi.fn()}
      >
        <p>正文</p>
      </PreparationDocumentEditorShell>,
    ));

    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    const button = (name: string) => [...container.querySelectorAll('button')]
      .find((candidate) => candidate.textContent === name || candidate.getAttribute('aria-label') === name)!;
    await act(async () => button('保存').click());
    expect(onSave).toHaveBeenCalledOnce();
    await act(async () => button('返回备课任务').click());
    expect(onExit).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await act(async () => button('返回备课任务').click());
    expect(onExit).toHaveBeenCalledOnce();

    await act(async () => button('打开 AI 建议').click());
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('AI 建议');
    expect(container.querySelector('[role="dialog"]')?.parentElement?.className).toContain('xl:hidden');
    await act(async () => button('接受').click());
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({ id: 'suggestion-1' }));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('retains a recovered lesson edit and reports an autosave revision conflict', async () => {
    vi.useFakeTimers();
    const plan = validPlanFixture();
    window.localStorage.setItem('preparation-editor:draft:draft-1', JSON.stringify({
      content: { ...plan, topic: '本地恢复主题' },
      baseRevision: 1,
      savedAt: '2026-07-25T00:00:00.000Z',
    }));
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            draft: { id: 'draft-1', version: 2, content: plan, reviews: [] },
            task: { id: 'task-1', topic: '稳定性', durationMinutes: plan.durationMinutes },
          }),
        } as Response;
      }
      return {
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'draft-version-conflict' } }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetch);

    await act(async () => {
      root.render(createElement(LessonDocumentEditor, { kind: 'draft', documentId: 'draft-1' }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('已恢复上次未完成的本地修改');
    expect(container.textContent).not.toContain('本地恢复主题');
    expect([...container.querySelectorAll('input')]
      .some((input) => input.parentElement?.textContent?.startsWith('主题'))).toBe(false);
    const stepTitle = [...container.querySelectorAll('input')]
      .find((input) => input.parentElement?.textContent?.startsWith('步骤标题'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(stepTitle, '冲突中的本地步骤');
      stepTitle.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true);
    expect(container.textContent).toContain('服务器已有较新修订');
    expect(container.textContent).toContain('存在版本冲突');
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!).content.boppps.bridgeIn.steps[0].title).toBe('冲突中的本地步骤');
  });

  it('does not mark a newer lesson edit saved when an older request finishes', async () => {
    vi.useFakeTimers();
    const plan = validPlanFixture();
    let finishPatch!: (response: Response) => void;
    const pendingPatch = new Promise<Response>((resolve) => {
      finishPatch = resolve;
    });
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            draft: { id: 'draft-1', version: 2, content: plan, reviews: [] },
            task: { id: 'task-1', topic: '稳定性', durationMinutes: plan.durationMinutes },
          }),
        } as Response;
      }
      return pendingPatch;
    });
    vi.stubGlobal('fetch', fetch);
    await act(async () => {
      root.render(createElement(LessonDocumentEditor, { kind: 'draft', documentId: 'draft-1' }));
      await Promise.resolve();
    });
    const stepTitle = [...container.querySelectorAll('input')]
      .find((input) => input.parentElement?.textContent?.startsWith('步骤标题'))!;
    const setStepTitle = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(stepTitle, value);
        stepTitle.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    await setStepTitle('先提交的修改');
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === '保存')!;
    await act(async () => save.click());
    await setStepTitle('请求期间的新修改');
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
    await act(async () => {
      finishPatch({
        ok: true,
        status: 200,
        json: async () => ({ draft: { version: 3 } }),
      } as Response);
      await pendingPatch;
      await Promise.resolve();
    });

    expect(container.textContent).toContain('较早修改已保存');
    expect(container.textContent).toContain('尚未保存');
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!).content.boppps.bridgeIn.steps[0].title).toBe('请求期间的新修改');
  });

  it('keeps both lesson versions available during reload-and-compare', async () => {
    vi.useFakeTimers();
    const plan = validPlanFixture();
    const serverPlan = structuredClone(plan);
    serverPlan.boppps.bridgeIn.steps[0].title = '服务器步骤';
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          draft: { id: 'draft-1', version: 2, content: plan, reviews: [] },
          task: { id: 'task-1', topic: '稳定性', durationMinutes: plan.durationMinutes },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: 'draft-version-conflict' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          draft: { id: 'draft-1', version: 3, content: serverPlan, reviews: [] },
          task: { id: 'task-1', topic: '稳定性', durationMinutes: plan.durationMinutes },
        }),
      } as Response);
    vi.stubGlobal('fetch', fetch);
    await act(async () => {
      root.render(createElement(LessonDocumentEditor, { kind: 'draft', documentId: 'draft-1' }));
      await Promise.resolve();
    });
    const stepTitle = [...container.querySelectorAll('input')]
      .find((input) => input.parentElement?.textContent?.startsWith('步骤标题'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(stepTitle, '本地步骤');
      stepTitle.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const button = (name: string) => [...container.querySelectorAll('button')]
      .find((candidate) => candidate.textContent === name)!;
    await act(async () => button('保存').click());
    await act(async () => {
      button('重新加载服务器修订').click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('本地步骤');
    expect(container.textContent).toContain('服务器步骤');
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!).content.boppps.bridgeIn.steps[0].title).toBe('本地步骤');
    await act(async () => button('保留本地内容并使用服务器基线').click());
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!).baseRevision).toBe(3);
  });

  it('preserves a course-basis draft while comparing a newer server version', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem('preparation-editor:course-basis:version-1', JSON.stringify({
      markdown: '# 本地课程依据',
      baseContentHash: 'a'.repeat(64),
      savedAt: '2026-07-25T00:00:00.000Z',
    }));
    const document = {
      id: 'version-1',
      documentId: 'document-1',
      documentTitle: '课程标准',
      courseBasisId: 'basis-1',
      versionNumber: 1,
      sourceName: '课程依据',
      contentHash: 'a'.repeat(64),
      markdown: '# 原服务器版本',
      frozen: false,
    };
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ document }) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: { code: 'version-edit-conflict' } }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ document: { ...document, contentHash: 'b'.repeat(64), markdown: '# 新服务器版本' } }),
      } as Response);
    vi.stubGlobal('fetch', fetch);
    await act(async () => {
      root.render(createElement(CourseBasisDocumentEditor, { versionId: 'version-1' }));
      await Promise.resolve();
    });
    const button = (name: string) => [...container.querySelectorAll('button')]
      .find((candidate) => candidate.textContent === name)!;
    await act(async () => button('保存').click());
    await act(async () => {
      button('重新加载服务器版本').click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('# 本地课程依据');
    expect(container.textContent).toContain('# 新服务器版本');
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:course-basis:version-1')!).markdown).toBe('# 本地课程依据');
    await act(async () => button('保留本地内容并使用服务器基线').click());
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:course-basis:version-1')!).baseContentHash).toBe('b'.repeat(64));
  });

  it('keeps a lesson draft retryable when the save request throws', async () => {
    const plan = validPlanFixture();
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') throw new TypeError('network unavailable');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          draft: { id: 'draft-1', version: 2, content: plan, reviews: [] },
          task: { id: 'task-1', topic: '稳定性', durationMinutes: plan.durationMinutes },
        }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    await act(async () => {
      root.render(createElement(LessonDocumentEditor, { kind: 'draft', documentId: 'draft-1' }));
      await Promise.resolve();
    });
    const stepTitle = [...container.querySelectorAll('input')]
      .find((input) => input.parentElement?.textContent?.startsWith('步骤标题'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(stepTitle, '断网时保留的步骤');
      stepTitle.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === '保存')!;
    await act(async () => save.click());

    expect(container.textContent).toContain('保存请求失败，本地修改仍保留，请重试');
    expect(container.textContent).toContain('保存失败');
    expect(save.disabled).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!).content.boppps.bridgeIn.steps[0].title).toBe('断网时保留的步骤');
  });

  it('retains local lesson and course-basis drafts when initial loading throws', async () => {
    window.localStorage.setItem('preparation-editor:draft:draft-1', JSON.stringify({
      content: validPlanFixture(),
      baseRevision: 1,
      savedAt: '2026-07-25T00:00:00.000Z',
    }));
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network unavailable');
    }));
    await act(async () => {
      root.render(createElement(LessonDocumentEditor, { kind: 'draft', documentId: 'draft-1' }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('文档加载失败，本地修改仍保留，请重试');
    expect(container.textContent).toContain('重试加载');
    expect(window.localStorage.getItem('preparation-editor:draft:draft-1')).not.toBeNull();

    await act(async () => root.unmount());
    container.replaceChildren();
    root = createRoot(container);
    window.localStorage.setItem('preparation-editor:course-basis:version-1', JSON.stringify({
      markdown: '# 本地课程依据',
      baseContentHash: 'hash-1',
      savedAt: '2026-07-25T00:00:00.000Z',
    }));
    await act(async () => {
      root.render(createElement(CourseBasisDocumentEditor, { versionId: 'version-1' }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('文档加载失败，本地修改仍保留，请重试');
    expect(container.textContent).toContain('重试加载');
    expect(window.localStorage.getItem('preparation-editor:course-basis:version-1')).not.toBeNull();
  });

  it('retains per-revision AI accept and ignore states without invoking approval', async () => {
    const plan = validPlanFixture();
    const fetch = vi.fn(async (_url?: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        draft: {
          id: 'draft-1',
          version: 2,
          contentHash: 'revision-hash',
          content: plan,
          reviews: [{
            contentHash: 'revision-hash',
            report: {
              findings: [{
                path: 'boppps.bridgeIn.steps.0.teacherActivity',
                message: '补充导入案例',
                proposedReplacement: '展示真实航向偏差案例',
              }, {
                path: 'boppps.bridgeIn.steps.0.sourceBindings.0.contentHash',
                message: '替换来源摘要',
                proposedReplacement: 'unsafe-replacement',
              }],
              suggestions: ['补充总结问题'],
            },
          }],
        },
        task: { id: 'task-1', topic: '稳定性', durationMinutes: plan.durationMinutes },
      }),
    } as Response));
    vi.stubGlobal('fetch', fetch);
    await act(async () => {
      root.render(createElement(LessonDocumentEditor, { kind: 'draft', documentId: 'draft-1' }));
      await Promise.resolve();
    });

    const acceptButtons = [...container.querySelectorAll('button')].filter((button) => button.textContent === '接受');
    expect(acceptButtons).toHaveLength(1);
    const accept = acceptButtons[0];
    const genericSuggestion = [...container.querySelectorAll('article')]
      .find((article) => article.textContent?.includes('补充总结问题'))!;
    expect(genericSuggestion.textContent).toContain('该建议未包含可应用的修改');
    const ignore = [...genericSuggestion.querySelectorAll('button')].find((button) => button.textContent === '忽略')!;
    await act(async () => accept.click());
    await act(async () => ignore.click());

    const documentDraft = JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!);
    expect(documentDraft.content.boppps.bridgeIn.steps[0].teacherActivity).toBe('展示真实航向偏差案例');
    expect(documentDraft.content.boppps.bridgeIn.teacherActivity).toBe('展示真实航向偏差案例');
    expect(documentDraft.content.boppps.bridgeIn.steps[0].sourceBindings).toEqual(plan.boppps.bridgeIn.steps[0].sourceBindings);
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1:suggestions')!)).toEqual({
      'revision-hash:finding:0': 'accepted',
      'revision-hash:suggestion:0': 'ignored',
    });
    expect(fetch.mock.calls.every(([, init]) => !String((init as RequestInit | undefined)?.method).includes('approve'))).toBe(true);
  });
});
