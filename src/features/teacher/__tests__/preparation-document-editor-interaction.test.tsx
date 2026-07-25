// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import { PreparationDocumentEditorShell } from '../preparation-document-editor/editor-shell';
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
        suggestions={[{ id: 'suggestion-1', message: '补充例题', status: 'open' }]}
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
    const topic = [...container.querySelectorAll('input')]
      .find((input) => input.parentElement?.textContent?.startsWith('主题'))!;
    expect(topic.value).toBe('本地恢复主题');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(topic, '冲突中的本地主题');
      topic.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true);
    expect(container.textContent).toContain('服务器已有较新修订');
    expect(container.textContent).toContain('存在版本冲突');
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!).content.topic).toBe('冲突中的本地主题');
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
    const topic = [...container.querySelectorAll('input')]
      .find((input) => input.parentElement?.textContent?.startsWith('主题'))!;
    const setTopic = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(topic, value);
        topic.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    await setTopic('先提交的修改');
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === '保存')!;
    await act(async () => save.click());
    await setTopic('请求期间的新修改');
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
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!).content.topic).toBe('请求期间的新修改');
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
              findings: [{ path: 'boppps.bridgeIn', message: '补充导入案例' }],
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

    const accept = [...container.querySelectorAll('button')].find((button) => button.textContent === '接受')!;
    const ignore = [...container.querySelectorAll('button')].filter((button) => button.textContent === '忽略')[1]!;
    await act(async () => accept.click());
    await act(async () => ignore.click());

    const documentDraft = JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1')!);
    expect(documentDraft.content.limitations).toContain('补充导入案例');
    expect(JSON.parse(window.localStorage.getItem('preparation-editor:draft:draft-1:suggestions')!)).toEqual({
      'revision-hash:finding:0': 'accepted',
      'revision-hash:suggestion:0': 'ignored',
    });
    expect(fetch.mock.calls.every(([, init]) => !String((init as RequestInit | undefined)?.method).includes('approve'))).toBe(true);
  });
});
