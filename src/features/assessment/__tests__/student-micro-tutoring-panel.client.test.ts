// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, getByText, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentMicroTutoringPanel } from '../student-micro-tutoring-panel';

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const AVAILABLE = {
  id: 'result-1',
  status: 'AVAILABLE',
  task: {
    goal: '辨析相位裕度不足',
    estimatedMinutes: 5,
    resources: [{
      id: 'resource-1', title: '相位裕度案例', estimatedMinutes: 3, actionPath: '/interactive-learning/resources/resource-1',
    }],
  },
};

const STARTED = {
  id: 'intervention-1', status: 'STARTED', startedAt: '2026-08-10T00:00:00.000Z',
  progress: { resourceUseCount: 0, hintCount: 0, completedAt: null, durationSeconds: null },
  validation: null, recommendation: null,
};

describe('StudentMicroTutoringPanel', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  const onRequestHint = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    onRequestHint.mockClear();
    window.open = vi.fn(() => ({ opener: null, location: { replace: vi.fn() }, close: vi.fn() })) as unknown as typeof window.open;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('runs the available tutoring journey without exposing attribution or answer metadata', async () => {
    fetchMock
      .mockResolvedValueOnce(json(AVAILABLE))
      .mockResolvedValueOnce(json(STARTED))
      .mockResolvedValueOnce(json({ ...STARTED, progress: { ...STARTED.progress, resourceUseCount: 1 } }))
      .mockResolvedValueOnce(json({ ...STARTED, progress: { ...STARTED.progress, resourceUseCount: 1, hintCount: 1 } }))
      .mockResolvedValueOnce(json({
        ...STARTED,
        status: 'COMPLETED',
        progress: { resourceUseCount: 1, hintCount: 1, completedAt: '2026-08-10T00:01:00.000Z', durationSeconds: 60 },
      }))
      .mockResolvedValueOnce(json({
        id: 'validation-1', prompt: '应优先检查哪一项？', options: [{ label: 'A', text: '相位裕度' }, { label: 'B', text: '题库答案' }],
      }))
      .mockResolvedValueOnce(json({
        ...STARTED,
        status: 'VALIDATED',
        progress: { resourceUseCount: 1, hintCount: 1, completedAt: '2026-08-10T00:01:00.000Z', durationSeconds: 60 },
        validation: { isCorrect: true, submittedAt: '2026-08-10T00:02:00.000Z' },
        recommendation: { kind: 'TRANSFER_PRACTICE_UNAVAILABLE', basisSummary: '建议巩固后继续练习。', actions: [] },
      }));

    await act(async () => root.render(createElement(StudentMicroTutoringPanel, { answerId: 'answer-1', onRequestHint })));
    fireEvent.click(getByRole(container, 'button', { name: '开始微辅导' }));
    await flush();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ answerId: 'answer-1' });

    fireEvent.click(getByRole(container, 'button', { name: '开始本次辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: /相位裕度案例/ }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '请求提示' }));
    await flush();
    expect(onRequestHint).toHaveBeenCalledOnce();

    fireEvent.click(getByRole(container, 'button', { name: '完成学习，进入验证' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '获取验证题' }));
    await flush();
    fireEvent.click(getByRole(container, 'radio', { name: /相位裕度/ }));
    fireEvent.click(getByRole(container, 'button', { name: '提交验证' }));
    await flush();

    expect(getByText(container, '验证通过')).toBeTruthy();
    expect(container.textContent).not.toContain('attribution');
    expect(container.textContent).not.toContain('isCorrect');
  });

  it('shows a controlled unavailable state instead of offering a stale task', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' }, 409))
      .mockResolvedValueOnce(json(AVAILABLE));

    await act(async () => root.render(createElement(StudentMicroTutoringPanel, { answerId: 'answer-1', onRequestHint })));
    fireEvent.click(getByRole(container, 'button', { name: '开始微辅导' }));
    await flush();

    expect(getByText(container, '任务内容已更新，请返回练习后重新开始。')).toBeTruthy();
    expect(container.querySelector('[name="micro-tutoring-validation"]')).toBeNull();

    fireEvent.click(getByRole(container, 'button', { name: '重新尝试微辅导' }));
    await flush();

    expect(getByText(container, '目标：辨析相位裕度不足')).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(expect.objectContaining({
      answerId: 'answer-1',
      refreshKey: expect.any(String),
    }));
  });

  it('does not offer a fresh orchestration retry for a non-drift unavailable result', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'UNAVAILABLE', unavailableReason: 'ACCESS_REVOKED' }, 409));

    await act(async () => root.render(createElement(StudentMicroTutoringPanel, { answerId: 'answer-1', onRequestHint })));
    fireEvent.click(getByRole(container, 'button', { name: '开始微辅导' }));
    await flush();

    expect(getByText(container, '当前任务的访问条件已变化，无法继续本次微辅导。')).toBeTruthy();
    expect(queryByRole(container, 'button', { name: '重新尝试微辅导' })).toBeNull();
  });

  it.each([401, 403])('does not offer a same-request retry after a %i authorization failure', async (status) => {
    fetchMock
      .mockResolvedValueOnce(json(AVAILABLE))
      .mockResolvedValueOnce(json({ error: status === 401 ? 'UNAUTHENTICATED' : 'LEARNER_REQUIRED' }, status));

    await act(async () => root.render(createElement(StudentMicroTutoringPanel, { answerId: 'answer-1', onRequestHint })));
    fireEvent.click(getByRole(container, 'button', { name: '开始微辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '开始本次辅导' }));
    await flush();

    expect(getByRole(container, 'alert').textContent).toContain('登录状态或学生权限已经变化');
    expect(queryByRole(container, 'button', { name: '重试' })).toBeNull();
  });

  it('retries a network-failed event with the same event identity', async () => {
    fetchMock
      .mockResolvedValueOnce(json(AVAILABLE))
      .mockResolvedValueOnce(json(STARTED))
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(json({ ...STARTED, progress: { ...STARTED.progress, resourceUseCount: 1 } }));

    await act(async () => root.render(createElement(StudentMicroTutoringPanel, { answerId: 'answer-1', onRequestHint })));
    fireEvent.click(getByRole(container, 'button', { name: '开始微辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '开始本次辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: /相位裕度案例/ }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '重试' }));
    await flush();

    const initialEvent = JSON.parse(fetchMock.mock.calls[2][1].body);
    const retriedEvent = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(retriedEvent.eventKey).toBe(initialEvent.eventKey);
    expect(container.textContent).toContain('已使用 1 项资源');
  });

  it('synchronizes an already-recorded validation instead of retrying an idempotency conflict', async () => {
    const completed = {
      ...STARTED,
      status: 'COMPLETED',
      progress: { resourceUseCount: 0, hintCount: 0, completedAt: '2026-08-10T00:01:00.000Z', durationSeconds: 60 },
    };
    const validated = {
      ...completed,
      status: 'VALIDATED',
      validation: { isCorrect: true, submittedAt: '2026-08-10T00:02:00.000Z' },
      recommendation: { kind: 'TRANSFER_PRACTICE_UNAVAILABLE', basisSummary: '验证已经记录。', actions: [] },
    };
    fetchMock
      .mockResolvedValueOnce(json(AVAILABLE))
      .mockResolvedValueOnce(json(STARTED))
      .mockResolvedValueOnce(json(completed))
      .mockResolvedValueOnce(json({ id: 'validation-1', prompt: '应优先检查哪一项？', options: [{ label: 'A', text: '相位裕度' }] }))
      .mockResolvedValueOnce(json({ error: 'IDEMPOTENCY_CONFLICT' }, 409))
      .mockResolvedValueOnce(json(validated));

    await act(async () => root.render(createElement(StudentMicroTutoringPanel, { answerId: 'answer-1', onRequestHint })));
    fireEvent.click(getByRole(container, 'button', { name: '开始微辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '开始本次辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '完成学习，进入验证' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '获取验证题' }));
    await flush();
    fireEvent.click(getByRole(container, 'radio', { name: /相位裕度/ }));
    fireEvent.click(getByRole(container, 'button', { name: '提交验证' }));
    await flush();

    expect(getByText(container, '验证通过')).toBeTruthy();
    expect(getByRole(container, 'alert').textContent).toContain('已在服务端处理');
    expect(queryByRole(container, 'button', { name: '重试' })).toBeNull();
    expect(fetchMock.mock.calls[5][0]).toContain('/api/assessment/remediation/interventions?interventionId=intervention-1');
  });

  it('retries a failed hint delivery without recording a second learner event', async () => {
    const hint = vi.fn()
      .mockRejectedValueOnce(new Error('assistant unavailable'))
      .mockResolvedValueOnce(undefined);
    fetchMock
      .mockResolvedValueOnce(json(AVAILABLE))
      .mockResolvedValueOnce(json(STARTED))
      .mockResolvedValueOnce(json({ ...STARTED, progress: { ...STARTED.progress, hintCount: 1 } }));

    await act(async () => root.render(createElement(StudentMicroTutoringPanel, { answerId: 'answer-1', onRequestHint: hint })));
    fireEvent.click(getByRole(container, 'button', { name: '开始微辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '开始本次辅导' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '请求提示' }));
    await flush();
    fireEvent.click(getByRole(container, 'button', { name: '重试' }));
    await flush();

    expect(hint).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(expect.objectContaining({ eventType: 'HINT_REQUESTED' }));
  });
});
