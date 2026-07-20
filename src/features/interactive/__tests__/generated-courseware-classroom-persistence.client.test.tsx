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
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderClassroomResource() {
  return (
    <GeneratedCoursewareResource
      config={{
        kind: 'generated-courseware-student-runtime-v1',
        publicationRevisionId: 'publication-v1',
        manifestHash: 'manifest-v1',
        stepId: 'step-3',
        runtimeManifest: studentProjection.runtimeManifest,
      }}
      sessionId="session-public"
      lessonItemId="lesson-item-3"
      resourceId="resource-v1"
    />
  );
}
