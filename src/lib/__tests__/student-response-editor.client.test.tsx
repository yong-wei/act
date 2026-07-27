// @vitest-environment jsdom

import { fireEvent, getByRole } from '@testing-library/dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(
  '@/features/teacher/preparation-document-editor/assignment-embedded-editor',
  () => ({
    AssignmentEmbeddedEditor: (props: {
      ariaLabel: string;
      value: string;
      onChange: (value: string) => void;
      onSave: () => void;
    }) => (
      <div>
        <textarea
          aria-label={props.ariaLabel}
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
        <button type="button" onClick={props.onSave}>保存</button>
      </div>
    ),
  }),
);

import {
  QuestionEditor,
  type PendingUpload,
} from '@/features/assignments/student-assignment-workspace';

describe('student response editor interactions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('keeps save, retry, keyboard reorder, and submit actions independently reachable', async () => {
    const onSave = vi.fn();
    const onRetryUpload = vi.fn();
    const onReorder = vi.fn();
    const onSubmit = vi.fn();
    const failed: PendingUpload = {
      clientId: 'failed-1',
      fileName: '失败.pdf',
      file: { name: '失败.pdf' } as File,
      role: 'ATTACHMENT',
      status: 'FAILED',
      message: '网络中断。',
    };
    const terminalFailure: PendingUpload = {
      ...failed,
      clientId: 'terminal-1',
      fileName: '不安全.pdf',
      retryable: false,
      message: '附件未通过安全扫描，请更换文件。',
    };
    await act(async () => {
      root.render(
        <QuestionEditor
          question={{
            id: 'question-1',
            stableQuestionId: 'stable-1',
            orderIndex: 0,
            promptText: '说明证据。',
            responseType: 'SUBJECTIVE_FILE',
            points: 10,
            state: 'DRAFT',
            version: 2,
            textDraft: '',
            assets: [
              {
                id: 'asset-a',
                displayName: 'A.pdf',
                role: 'ATTACHMENT',
                orderIndex: 0,
              },
              {
                id: 'asset-b',
                displayName: 'B.pdf',
                role: 'ATTACHMENT',
                orderIndex: 1,
              },
            ],
          }}
          index={0}
          draft=""
          onDraftChange={vi.fn()}
          bodySaveState="editing"
          onEditBody={vi.fn()}
          onSave={onSave}
          uploadImage={vi.fn()}
          validateAssetReference={() => true}
          resolveAssetHref={(href) => href}
          canonicalizeAssetHref={(href) => href}
          onUploadFiles={vi.fn()}
          onRetryUpload={onRetryUpload}
          onDiscardUpload={vi.fn()}
          onRemove={vi.fn()}
          onReorder={onReorder}
          onSubmit={onSubmit}
          onHistory={vi.fn()}
          busyAction={null}
          readOnly={false}
          headingRef={{ current: null }}
          pendingUploads={[failed, terminalFailure]}
          uploadStatusRef={{ current: null }}
        />,
      );
    });

    expect(container.querySelector('#answer-question-1')?.getAttribute('tabindex'))
      .toBe('-1');
    expect(container.querySelector('#upload-terminal-1')?.textContent)
      .not.toContain('重试');
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: '保存' }));
      fireEvent.click(getByRole(container, 'button', { name: '重试' }));
      fireEvent.click(getByRole(container, 'button', { name: '上移附件 2' }));
      fireEvent.click(getByRole(container, 'button', { name: '提交本题' }));
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onRetryUpload).toHaveBeenCalledWith(failed);
    expect(onReorder).toHaveBeenCalledWith('asset-b', 0);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
