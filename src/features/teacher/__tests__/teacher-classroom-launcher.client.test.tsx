// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TeacherClassroomLaunchDialog,
  chooseTeacherLaunchClassId,
  isTeacherLaunchDuplicateConflict,
  shouldRefreshTeacherLaunchOptions,
  useTeacherClassroomLauncher,
} from '@/features/teacher/teacher-classroom-launcher';

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function LauncherHarness() {
  const launcher = useTeacherClassroomLauncher();

  return (
    <>
      <input aria-label="此前聚焦输入框" />
      <button
        type="button"
        onClick={(event) => launcher.launch(
          {
            planId: 'plan-1',
            onSessionReady: vi.fn(),
          },
          event.currentTarget,
        )}
      >
        打开课堂启动器
      </button>
      {launcher.dialog}
    </>
  );
}

describe('teacher classroom launcher', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('uses current class before default and preserves an available explicit selection', () => {
    const classes = [
      { id: 'class-current', name: '当前班', code: '100001' },
      { id: 'class-default', name: '默认班', code: '100002' },
    ];

    expect(chooseTeacherLaunchClassId({
      classes,
      currentClassId: 'class-current',
      defaultClassId: 'class-default',
    })).toBe('class-current');
    expect(chooseTeacherLaunchClassId({
      classes,
      currentClassId: 'class-current',
      defaultClassId: 'class-default',
      previousClassId: 'class-default',
    })).toBe('class-default');
  });

  it('distinguishes duplicate recovery from stale-option refresh', () => {
    const duplicate = {
      existingSessionId: 'session-existing',
      requiresExplicitChoice: true,
    };

    expect(isTeacherLaunchDuplicateConflict(409, duplicate)).toBe(true);
    expect(shouldRefreshTeacherLaunchOptions(409, duplicate)).toBe(false);
    expect(shouldRefreshTeacherLaunchOptions(409, { error: '班级未启用' })).toBe(true);
  });

  it('loads active classes and always submits the selected class id', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        classes: [
          { id: 'class-current', name: '当前班', code: '100001' },
          { id: 'class-default', name: '默认班', code: '100002' },
        ],
        defaultClassId: 'class-default',
      }))
      .mockResolvedValueOnce(jsonResponse({ id: 'session-created' }));
    const onSessionReady = vi.fn();

    await act(async () => {
      root.render(
        <TeacherClassroomLaunchDialog
          request={{
            planId: 'plan-1',
            currentClassId: 'class-current',
            onSessionReady,
          }}
          onClose={vi.fn()}
        />,
      );
    });
    await flush();

    const classSelect = document.querySelector('select') as HTMLSelectElement;
    expect(classSelect.value).toBe('class-current');
    const submit = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('开始上课'));
    await act(async () => submit?.click());
    await flush();

    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      planId: 'plan-1',
      classId: 'class-current',
      launchContext: 'class-bound',
    });
    expect(onSessionReady).toHaveBeenCalledWith('session-created');
  });

  it('provides a stable accessible name, deterministic focus, and Escape dismissal', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      classes: [{ id: 'class-default', name: '默认班', code: '100001' }],
      defaultClassId: 'class-default',
    }));
    await act(async () => root.render(<LauncherHarness />));
    const trigger = getByRole(document.body, 'button', { name: '打开课堂启动器' });
    const previousInput = getByRole(document.body, 'textbox', { name: '此前聚焦输入框' });

    previousInput.focus();
    expect(previousInput).toBe(document.activeElement);
    await act(async () => trigger.click());
    await flush();

    expect(getByRole(document.body, 'dialog', { name: '选择班级并开始上课' })).not.toBeNull();
    expect(getByRole(document.body, 'combobox', { name: '本次课堂班级' })).toBe(document.activeElement);

    await act(async () => fireEvent.keyDown(document, { key: 'Escape' }));
    await flush();
    expect(document.querySelector('[data-teacher-classroom-launch-dialog]')).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });

  it('restores focus to the launch control after cancellation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      classes: [{ id: 'class-default', name: '默认班', code: '100001' }],
      defaultClassId: 'class-default',
    }));
    await act(async () => root.render(<LauncherHarness />));
    const trigger = getByRole(document.body, 'button', { name: '打开课堂启动器' });
    await act(async () => trigger.click());
    await flush();
    expect(getByRole(document.body, 'combobox', { name: '本次课堂班级' })).toBe(document.activeElement);

    await act(async () => getByRole(document.body, 'button', { name: '取消' }).click());
    await flush();
    expect(document.querySelector('[data-teacher-classroom-launch-dialog]')).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });

  it('announces a session-only class selection without changing the persistent default', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        classes: [
          { id: 'class-default', name: '默认班', code: '100001' },
          { id: 'class-other', name: '临时选择班', code: '100002' },
        ],
        defaultClassId: 'class-default',
      }))
      .mockResolvedValueOnce(jsonResponse({ id: 'session-created' }));
    await act(async () => {
      root.render(
        <TeacherClassroomLaunchDialog
          request={{ planId: 'plan-1', onSessionReady: vi.fn() }}
          onClose={vi.fn()}
        />,
      );
    });
    await flush();

    const classSelect = getByRole(document.body, 'combobox', {
      name: '本次课堂班级',
    }) as HTMLSelectElement;
    expect(classSelect.value).toBe('class-default');

    await act(async () => fireEvent.change(classSelect, { target: { value: 'class-other' } }));
    expect(getByRole(document.body, 'status').textContent).toContain('已更新本次课堂班级。');

    await act(async () => getByRole(document.body, 'button', { name: '开始上课' }).click());
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/teacher/classes/launch-options',
      '/api/session',
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toMatchObject({
      classId: 'class-other',
      launchContext: 'class-bound',
    });
  });

  it('shows class-management recovery when no active class exists', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      classes: [],
      defaultClassId: null,
    }));

    await act(async () => {
      root.render(
        <TeacherClassroomLaunchDialog
          request={{ planId: 'plan-1', onSessionReady: vi.fn() }}
          onClose={vi.fn()}
        />,
      );
    });
    await flush();

    const recovery = document.querySelector('a[href="/teacher/classes"]');
    expect(recovery?.textContent).toContain('前往班级管理');
    const submit = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('开始上课')) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('keeps the dialog open and refreshes selection after a stale class conflict', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        classes: [{ id: 'class-stale', name: '旧班级', code: '100001' }],
        defaultClassId: 'class-stale',
      }))
      .mockResolvedValueOnce(jsonResponse({ error: '班级未启用，请刷新后重新选择。' }, 409))
      .mockResolvedValueOnce(jsonResponse({
        classes: [{ id: 'class-active', name: '活动班级', code: '100002' }],
        defaultClassId: 'class-active',
      }));

    await act(async () => {
      root.render(
        <TeacherClassroomLaunchDialog
          request={{ planId: 'plan-1', onSessionReady: vi.fn() }}
          onClose={vi.fn()}
        />,
      );
    });
    await flush();

    const submit = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('开始上课'));
    await act(async () => submit?.click());
    await flush();

    expect(document.querySelector('[data-teacher-classroom-launch-dialog]')).not.toBeNull();
    expect((document.querySelector('select') as HTMLSelectElement).value).toBe('class-active');
    expect(document.body.textContent).toContain('班级未启用，请刷新后重新选择。');
  });

  it('preflights a preset classroom before cloning and offers duplicate recovery', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        classes: [{ id: 'class-1', name: '控制班', code: '100001' }],
        defaultClassId: 'class-1',
      }))
      .mockResolvedValueOnce(jsonResponse({
        error: '该班级已有进行中的预置互动课堂，请选择进入已有课堂或确认新开课堂。',
        existingSessionId: 'existing-session',
        requiresExplicitChoice: true,
      }, 409));
    const onSessionReady = vi.fn();
    const preparePlanId = vi.fn().mockResolvedValue('cloned-plan');

    await act(async () => {
      root.render(
        <TeacherClassroomLaunchDialog
          request={{
            sourcePresetKey: 'unit-test-preset-v1',
            preparePlanId,
            onSessionReady,
          }}
          onClose={vi.fn()}
        />,
      );
    });
    await flush();

    const submit = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('开始上课'));
    await act(async () => submit?.click());
    await flush();

    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toMatchObject({
      classId: 'class-1',
      sourcePresetKey: 'unit-test-preset-v1',
    });
    expect(preparePlanId).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('进入已有课堂');

    const reuse = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('进入已有课堂'));
    await act(async () => reuse?.click());
    expect(onSessionReady).toHaveBeenCalledWith('existing-session');
  });
});
