// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../preparation-document-editor/rich-markdown-editor', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../preparation-document-editor/rich-markdown-editor')
  >();
  return {
    ...actual,
    RichMarkdownEditor: ({
      onChange,
      readOnly,
    }: {
      onChange: (value: string) => void;
      readOnly?: boolean;
    }) => (
      <>
        <span data-testid="editor-read-only">{String(Boolean(readOnly))}</span>
        <button
          type="button"
          onClick={() =>
            onChange('![外部图](https://example.com/image.png "asset:foreign")')
          }
        >
          输入外部图片
        </button>
        <button type="button" onClick={() => onChange('文本与公式 $G(s)$')}>
          输入安全正文
        </button>
      </>
    ),
  };
});

import { AssignmentEmbeddedEditor } from '../preparation-document-editor/assignment-embedded-editor';

describe('assignment embedded editor continuous validation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('keeps foreign images out of the host draft and autosave payload', async () => {
    const onChange = vi.fn();
    await act(async () =>
      root.render(
        <AssignmentEmbeddedEditor
          hostRole="teacher"
          field="question-prompt"
          ariaLabel="题面"
          value="原正文"
          savedValue="原正文"
          saveState="editing"
          continuousEditing
          showSaveAction={false}
          onChange={onChange}
          onEdit={() => undefined}
          onSave={() => undefined}
          resolveAssetHref={(href) => href}
        />,
      ),
    );

    await act(async () => {
      (
        [...container.querySelectorAll('button')].find(
          (button) => button.textContent === '输入外部图片',
        ) as HTMLButtonElement
      ).click();
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('未写入当前草稿');

    await act(async () => {
      (
        [...container.querySelectorAll('button')].find(
          (button) => button.textContent === '输入安全正文',
        ) as HTMLButtonElement
      ).click();
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('文本与公式 $G(s)$');
  });

  it('keeps continuous editing writable during a slow autosave', async () => {
    const props = {
      hostRole: 'teacher' as const,
      field: 'question-prompt' as const,
      ariaLabel: '题面',
      value: '继续编辑',
      savedValue: '旧正文',
      saveState: 'saving' as const,
      showSaveAction: false,
      onChange: vi.fn(),
      onEdit: () => undefined,
      onSave: () => undefined,
      resolveAssetHref: (href: string) => href,
    };
    await act(async () => {
      root.render(<AssignmentEmbeddedEditor {...props} continuousEditing />);
    });
    expect(container.querySelector('[data-testid="editor-read-only"]')?.textContent)
      .toBe('false');

    await act(async () => {
      root.render(<AssignmentEmbeddedEditor {...props} continuousEditing={false} />);
    });
    expect(container.querySelector('[data-testid="editor-read-only"]')?.textContent)
      .toBe('true');
  });
});
