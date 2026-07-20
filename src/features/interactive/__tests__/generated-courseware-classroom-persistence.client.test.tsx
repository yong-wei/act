// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GeneratedCoursewareResource } from '@/features/lesson-engine/generated-courseware-resource';
import { projectCoursewareForStudent } from '@/lib/smart-courseware/domain';
import { validCoursewareManifest } from '@/lib/smart-courseware/__tests__/fixtures';

const studentProjection = projectCoursewareForStudent({
  draftId: 'draft-persistence',
  version: 1,
  runtimeManifest: validCoursewareManifest(),
  orderingPermutationSecret: 'generated-courseware-classroom-persistence-secret',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('generated courseware public classroom persistence', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('does not expose submission controls while saved classroom state is still loading', async () => {
    const pendingState = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).endsWith('/state?scope=self')) return pendingState.promise;
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(renderClassroomResource()));

    expect(container.querySelector('[data-courseware-student-activity-hydration="loading"]')).not.toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('提交'))).toBe(false);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/state') && init?.method === 'POST')).toBe(false);
  });

  it('fails closed when saved classroom state cannot be loaded', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).endsWith('/state?scope=self')) {
        return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(renderClassroomResource()));
    await act(async () => Promise.resolve());

    expect(container.querySelector('[data-courseware-student-activity-hydration="error"]')?.textContent)
      .toContain('请刷新页面');
    expect(container.querySelector('input')).toBeNull();
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('提交'))).toBe(false);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/state') && init?.method === 'POST')).toBe(false);
  });

  it('restores a saved answer and writes both classroom state and durable submission evidence', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/state?scope=self')) {
        return jsonResponse({
          states: [],
          courseStates: [{
            itemId: 'lesson-item-3',
            data: {
              retainedSiblingState: 'keep',
              generatedCoursewareResponses: {
                'publication-v1': {
                  'step-3': { stepId: 'step-3', submittedAt: 10, answers: { 'module-3': 'a' } },
                },
              },
            },
          }],
          teacherStates: [],
          summary: { totalStudents: 1, latestUpdate: null },
        });
      }
      if (url.endsWith('/state') && init?.method === 'POST') return jsonResponse({ id: 'state-1' });
      if (url === '/api/interactive/events') return jsonResponse({ success: true });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(renderClassroomResource()));
    await act(async () => Promise.resolve());

    expect(container.querySelector<HTMLInputElement>('input[value="a"]')?.checked).toBe(true);

    const optionB = container.querySelector<HTMLInputElement>('input[value="b"]')!;
    await act(async () => optionB.click());
    const submit = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('提交'))!;
    await act(async () => submit.click());
    await act(async () => Promise.resolve());

    const stateCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith('/state') && init?.method === 'POST');
    expect(stateCall).toBeDefined();
    const stateBody = JSON.parse(String(stateCall?.[1]?.body));
    expect(stateBody).toMatchObject({
      itemId: 'lesson-item-3',
      lessonKey: 'publication-v1',
      data: {
        retainedSiblingState: 'keep',
        generatedCoursewareResponses: {
          'publication-v1': {
            'step-3': { stepId: 'step-3', answers: { 'module-3': 'b' } },
          },
        },
      },
    });

    const evidenceCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/interactive/events');
    expect(evidenceCall).toBeDefined();
    const evidenceBody = JSON.parse(String(evidenceCall?.[1]?.body));
    expect(evidenceBody.events[0]).toMatchObject({
      type: 'submit',
      sessionId: 'session-public',
      resourceKey: 'generated-courseware:publication-v1',
      stepId: 'step-3',
      actorRole: 'student',
      data: {
        eventType: 'lesson_resubmit',
        publicationRevisionId: 'publication-v1',
        manifestHash: 'manifest-v1',
        lessonItemId: 'lesson-item-3',
      },
    });
  });

  it('serializes different card submissions and preserves both answers in the later state write', async () => {
    const firstStateWrite = deferred<Response>();
    const stateBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/state?scope=self')) {
        return jsonResponse({ states: [], courseStates: [], teacherStates: [], summary: { totalStudents: 0, latestUpdate: null } });
      }
      if (url.endsWith('/state') && init?.method === 'POST') {
        stateBodies.push(JSON.parse(String(init.body)));
        return stateBodies.length === 1 ? firstStateWrite.promise : jsonResponse({ id: 'state-2' });
      }
      if (url === '/api/interactive/events') return jsonResponse({ success: true });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const runtimeManifest = structuredClone(studentProjection.runtimeManifest);
    const step = runtimeManifest.steps.find((candidate) => candidate.id === 'step-3')!;
    const activityCards = step.interactionSpec.activityCards;
    const submitFields = step.interactionSpec.submitFields;
    if (!activityCards || !submitFields) throw new Error('Expected activity cards fixture');
    const firstCard = activityCards[0]!;
    activityCards.push({ ...firstCard, id: 'module-3b', prompt: 'Prompt module-3b' });
    submitFields.push('responses.module-3b');

    await act(async () => root.render(renderClassroomResource({ runtimeManifest })));
    await act(async () => Promise.resolve());

    const cardButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .filter((button) => button.textContent?.includes('提交答案'));
    const cards = cardButtons.map((button) => button.closest('.premium-lesson-panel')!);
    expect(cards).toHaveLength(2);
    await act(async () => cards[0]!.querySelector<HTMLInputElement>('input[value="a"]')!.click());
    await act(async () => cards[1]!.querySelector<HTMLInputElement>('input[value="b"]')!.click());
    act(() => cardButtons[0]!.click());
    act(() => cardButtons[1]!.click());
    await act(async () => Promise.resolve());

    expect(stateBodies).toHaveLength(1);
    firstStateWrite.resolve(jsonResponse({ id: 'state-1' }));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    expect(stateBodies).toHaveLength(2);
    expect(stateBodies[1]).toMatchObject({
      data: {
        generatedCoursewareResponses: {
          'publication-v1': {
            'step-3': { answers: { 'module-3': 'a', 'module-3b': 'b' } },
          },
        },
      },
    });
  });

  it('keeps teacher previews local even when a real classroom session id is present', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(renderClassroomResource({ runtimeMode: 'preview' })));
    expect(container.textContent).toContain('演示模式');
    const option = container.querySelector<HTMLInputElement>('input[value="a"]')!;
    await act(async () => option.click());
    const submit = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('提交'))!;
    await act(async () => submit.click());
    await act(async () => Promise.resolve());

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderClassroomResource({
  runtimeManifest = studentProjection.runtimeManifest,
  runtimeMode = 'student',
}: {
  runtimeManifest?: typeof studentProjection.runtimeManifest;
  runtimeMode?: 'student' | 'preview';
} = {}) {
  return (
    <GeneratedCoursewareResource
      config={{
        kind: 'generated-courseware-student-runtime-v1',
        publicationRevisionId: 'publication-v1',
        manifestHash: 'manifest-v1',
        stepId: 'step-3',
        runtimeManifest,
      }}
      sessionId="session-public"
      lessonItemId="lesson-item-3"
      resourceId="resource-v1"
      runtimeMode={runtimeMode}
    />
  );
}
