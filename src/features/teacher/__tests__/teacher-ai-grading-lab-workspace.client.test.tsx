// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TeacherAiGradingLabWorkspace } from '../teacher-ai-grading-lab-workspace';

const overview = {
  datasets: [], configurations: [],
  batches: [{ evaluationRunId: 'batch-1', configurationVersion: 'config-1', state: 'PARTIAL', totalExecutions: 3, completedCount: 1, failedCount: 1, retryableCount: 1, hiddenAcceptanceState: null, updatedAt: '2026-08-27T00:00:00.000Z' }],
  metrics: { completedRate: 1 / 3, meanAbsoluteScoreDifference: 1.5, exactScoreRate: 0.5, threeRunExactStabilityRate: 1 },
  metricsByRun: [{ evaluationRunId: 'batch-1', configurationVersion: 'config-1', splitId: 'split-1', partition: 'TUNING', visibility: 'VISIBLE', configurationContentHash: null, completedRate: 1 / 3, meanAbsoluteScoreDifference: 1.5, exactScoreRate: 0.5, threeRunExactStabilityRate: 1 }],
  executions: [], pdfVerifications: [], annotationJudgments: [], pendingBlindAnnotations: [], pendingBlindVisualEvidence: [],
};

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('teacher AI grading lab workspace interactions', () => {
  it('shows metrics and resumes an eligible batch through the owner-only operation route', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(overview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ operation: 'resume-evaluation', result: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(overview), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);

    await act(async () => { root.render(<TeacherAiGradingLabWorkspace />); });
    await act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain('实验指标');
    expect(container.textContent).toContain('33.3%');
    expect(container.querySelector('[aria-label="评测摘要"]')).toBeTruthy();
    const button = Array.from(container.querySelectorAll('button')).find((element) => element.textContent === '恢复并重试');
    expect(button).toBeTruthy();
    await act(async () => { button?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledWith('/api/teacher/ai-grading-lab/operations', expect.objectContaining({ method: 'POST', body: JSON.stringify({ operation: 'resume-evaluation', input: { run: { evaluationRunId: 'batch-1' } } }) }));
    root.unmount();
  });

  it('recovers from an initial load failure through the accessible retry action', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify(overview), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);

    await act(async () => { root.render(<TeacherAiGradingLabWorkspace />); });
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('评测状态暂时无法读取');
    const retry = Array.from(container.querySelectorAll('button')).find((element) => element.textContent === '重试');
    expect(retry).toBeTruthy();
    await act(async () => { retry?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toContain('实验指标');
    expect(fetch).toHaveBeenCalledTimes(2);
    root.unmount();
  });

  it('keeps a failed resume retryable until the operation succeeds', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(overview), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ operation: 'resume-evaluation', result: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(overview), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);

    await act(async () => { root.render(<TeacherAiGradingLabWorkspace />); });
    await act(async () => { await Promise.resolve(); });
    const resume = () => Array.from(container.querySelectorAll('button')).find((element) => element.textContent === '恢复并重试');
    await act(async () => { resume()?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('恢复失败');
    await act(async () => { resume()?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
    root.unmount();
  });
});
