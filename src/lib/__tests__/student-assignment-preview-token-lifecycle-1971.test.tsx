// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { id: 'student-1' } } }),
}));
vi.mock('@/components/platform/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/shared/runtime-markdown', () => ({
  RuntimeMarkdownContent: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));
vi.mock(
  '@/features/teacher/preparation-document-editor/assignment-embedded-editor',
  () => ({
    AssignmentEmbeddedEditor: (props: {
      ariaLabel: string;
      value: string;
      onEdit: () => void;
      resolveAssetHref: (href: string) => string;
    }) => (
      <div>
        <textarea aria-label={props.ariaLabel} value={props.value} readOnly />
        <button type="button" onClick={props.onEdit}>编辑</button>
        <span data-testid="resolved-href">{props.resolveAssetHref('/stable/read-path')}</span>
      </div>
    ),
  }),
);

import { StudentAssignmentWorkspace } from '@/features/assignments/student-assignment-workspace';

const markdownWithImage = '![证据](/preview/1?token=t1) asset:md:abc';

function assignmentPayload() {
  return {
    assignment: {
      id: 'assignment-1',
      title: '阶跃响应分析',
      instructions: '',
      state: 'DRAFT',
      dueAt: null,
      requiredQuestionCount: 1,
      submittedRequiredCount: 0,
      canMutate: true,
      historicalOnly: false,
      contextStatus: 'ACTIVE',
      questions: [
        {
          id: 'question-1',
          stableQuestionId: 'stable-1',
          orderIndex: 0,
          promptText: '说明控制方案。',
          responseType: 'SUBJECTIVE_TEXT',
          points: 10,
          state: 'DRAFT',
          version: 3,
          textDraft: markdownWithImage,
          assets: [
            {
              id: 'asset-1',
              displayName: '证据.png',
              role: 'EMBEDDED_IMAGE',
              orderIndex: 0,
              embeddedPosition: 'md:abc',
              mimeType: 'image/png',
            },
          ],
        },
      ],
    },
  };
}

describe('issue #1971 preview token lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  const readAuthorizations: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/assets/asset-1/read')) {
      readAuthorizations.push(url);
      return new Response(
        JSON.stringify({ access: { url: `${location.origin}/preview/${readAuthorizations.length}?token=t${readAuthorizations.length}` } }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(assignmentPayload()), { status: 200 });
  });

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal('fetch', fetchMock);
    readAuthorizations.length = 0;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renews one-shot preview tokens before entering the edit state', async () => {
    await act(async () => {
      root.render(<StudentAssignmentWorkspace assignmentId="assignment-1" />);
    });
    // 首次只读渲染：对草稿引用的资产授权一次
    await act(async () => { await Promise.resolve(); });
    expect(readAuthorizations).toHaveLength(1);

    await act(async () => {
      const editButton = [...container.querySelectorAll('button')]
        .find((button) => button.textContent === '编辑');
      if (!editButton) throw new Error('编辑按钮未渲染');
      editButton.click();
    });
    await act(async () => { await Promise.resolve(); });
    // 进入编辑态前对当前引用续签一次性令牌（而非仅切换题目的续签）
    expect(readAuthorizations).toHaveLength(2);
  });
});
