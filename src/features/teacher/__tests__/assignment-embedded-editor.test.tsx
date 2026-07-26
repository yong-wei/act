// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AssignmentEmbeddedConflictError,
  AssignmentEmbeddedEditor,
  StudentAssignmentContentEditorExample,
  TeacherAssignmentContentEditorExample,
} from '../preparation-document-editor/assignment-embedded-editor';

describe('assignment embedded editor', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders confirmed Markdown with formulas and images without full-screen preparation regions', async () => {
    await act(async () => root.render(
      <AssignmentEmbeddedEditor
        hostRole="teacher"
        field="reference-answer"
        ariaLabel="参考答案"
        value="本地草稿"
        savedValue={'公式 $G(s)$\n\n![图](/api/assets/asset-1)'}
        saveState="saved"
        onChange={vi.fn()}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        uploadImage={vi.fn()}
        resolveAssetHref={(href) => href}
      />,
    ));

    expect(container.querySelector('[data-assignment-editor-mode="assignment-embedded"]')).not.toBeNull();
    expect(container.querySelector('[data-assignment-saved-render]')?.innerHTML).toContain('katex');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/api/assets/asset-1');
    expect(container.querySelector('[data-preparation-editor-shell]')).toBeNull();
    expect(container.textContent).not.toContain('AI 建议');
    expect(container.textContent).not.toContain('BOPPPS');
  });

  it.each([
    ['teacher', TeacherAssignmentContentEditorExample, '作业题目内容'],
    ['student', StudentAssignmentContentEditorExample, '作业正文'],
  ] as const)('provides an accessible bounded %s host example', async (role, Example, ariaLabel) => {
    await act(async () => root.render(
      <Example
        initialValue="已保存内容"
        uploadImage={vi.fn()}
        resolveAssetHref={(href) => href}
        persist={vi.fn(async () => undefined)}
      />,
    ));
    expect(container.querySelector(`[data-assignment-editor-role="${role}"]`)).not.toBeNull();
    expect(container.querySelector('button')?.textContent).toContain('编辑');

    await act(async () => container.querySelector('button')?.click());
    expect(container.querySelector(`[aria-label="${ariaLabel}"]`)).not.toBeNull();
  });

  it.each([
    ['failure', new Error('failed'), '保存失败'],
    ['conflict', new AssignmentEmbeddedConflictError(), '服务器已有较新修订'],
  ])('retains the local value after save %s', async (_case, error, message) => {
    await act(async () => root.render(
      <TeacherAssignmentContentEditorExample
        initialValue="本地内容"
        uploadImage={vi.fn()}
        resolveAssetHref={(href) => href}
        persist={vi.fn(async () => { throw error; })}
      />,
    ));
    await act(async () => container.querySelector('button')?.click());
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === '保存')!;
    await act(async () => save.click());

    expect(container.textContent).toContain(message);
    expect(container.querySelector('[aria-label="作业题目内容"]')?.textContent).toContain('本地内容');
    expect(container.querySelector('[data-assignment-saved-render]')).toBeNull();
  });

  it('routes selected, dropped, and pasted images through the same protected uploader', async () => {
    const uploadImage = vi.fn(async (file: File) => ({
      assetId: `asset-${file.name}`,
      href: `/api/assignment-assets/asset-${file.name}`,
    }));
    await act(async () => root.render(
      <AssignmentEmbeddedEditor
        hostRole="student"
        field="student-response"
        ariaLabel="作业正文"
        value=""
        savedValue=""
        saveState="editing"
        onChange={vi.fn()}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        uploadImage={uploadImage}
        resolveAssetHref={(href) => href}
      />,
    ));

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const selected = new File(['selected'], 'selected.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [selected] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const editor = container.querySelector('.ProseMirror')!;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => editor,
    });
    const dropped = new File(['dropped'], 'dropped.png', { type: 'image/png' });
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [dropped], getData: () => '', effectAllowed: 'all', dropEffect: 'none' },
    });
    const pasted = new File(['pasted'], 'pasted.png', { type: 'image/png' });
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { files: [pasted], getData: () => '', items: [] },
    });
    await act(async () => {
      editor.dispatchEvent(drop);
      editor.dispatchEvent(paste);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadImage.mock.calls.map(([file]) => file.name)).toEqual([
      'selected.png',
      'dropped.png',
      'pasted.png',
    ]);
    expect(drop.defaultPrevented).toBe(true);
    expect(paste.defaultPrevented).toBe(true);
  });
});
