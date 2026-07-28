import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  QuestionEditor,
  type PendingUpload,
} from '@/features/assignments/student-assignment-workspace';
import type { StudentAssignmentQuestion } from '@/features/assignments/student-assignment-types';
import {
  embeddedAssetReferences,
  independentAssets,
  localizedStudentSubmissionError,
  moveIndependentAssetIds,
  preflightAssignmentFiles,
} from '@/features/assignments/student-response-editor-contracts';

function question(
  input: Partial<StudentAssignmentQuestion> = {},
): StudentAssignmentQuestion {
  return {
    id: 'question-1',
    stableQuestionId: 'stable-1',
    orderIndex: 0,
    promptText: '说明控制方案及证据。',
    responseType: 'SUBJECTIVE_TEXT',
    points: 10,
    state: 'DRAFT',
    version: 3,
    textDraft: '',
    assets: [],
    ...input,
  };
}

function renderQuestion(input?: {
  question?: StudentAssignmentQuestion;
  draft?: string;
  pendingUploads?: PendingUpload[];
}) {
  return renderToStaticMarkup(
    <QuestionEditor
      question={input?.question ?? question()}
      index={0}
      draft={input?.draft ?? ''}
      onDraftChange={vi.fn()}
      bodySaveState="editing"
      onEditBody={vi.fn()}
      onSave={vi.fn()}
      uploadImage={vi.fn()}
      validateAssetReference={() => true}
      resolveAssetHref={(href) => href}
      canonicalizeAssetHref={(href) => href}
      onUploadFiles={vi.fn()}
      onRetryUpload={vi.fn()}
      onDiscardUpload={vi.fn()}
      onRemove={vi.fn()}
      onReorder={vi.fn()}
      onSubmit={vi.fn()}
      onHistory={vi.fn()}
      busyAction={null}
      readOnly={false}
      headingRef={{ current: null }}
      pendingUploads={input?.pendingUploads ?? []}
      uploadStatusRef={{ current: null }}
    />,
  );
}

describe('student unified response editor', () => {
  it('preflights format, size, and combined-count failures in Chinese', () => {
    const result = preflightAssignmentFiles([
      { name: 'wrong.exe', type: 'application/octet-stream', size: 10 },
      { name: 'large.pdf', type: 'application/pdf', size: 26 * 1024 * 1024 },
      { name: 'valid.pdf', type: 'application/pdf', size: 1024 },
    ], 10);
    expect(result.accepted).toHaveLength(0);
    expect(result.errors.map((item) => item.message).join('\n')).toContain('格式不受支持');
    expect(result.errors.map((item) => item.message).join('\n')).toContain('25 MB');
    expect(result.errors.map((item) => item.message).join('\n')).toContain('合计最多 10 个');
  });

  it('keeps embedded references and independent attachment order in one server contract', () => {
    const assets = [
      {
        id: 'embedded-1',
        displayName: '图.png',
        role: 'EMBEDDED_IMAGE',
        embeddedPosition: 'md:position_1',
      },
      {
        id: 'attachment-b',
        displayName: '证据 B.pdf',
        role: 'ATTACHMENT',
        orderIndex: 1,
      },
      {
        id: 'attachment-a',
        displayName: '证据 A.pdf',
        role: 'ATTACHMENT',
        orderIndex: 0,
      },
    ];
    expect(embeddedAssetReferences(
      '![图](/api/student/asset "asset:md:position_1")',
      assets,
    )).toEqual([{ assetId: 'embedded-1', positionRef: 'md:position_1' }]);
    expect(independentAssets(assets).map((asset) => asset.id)).toEqual([
      'attachment-a',
      'attachment-b',
    ]);
    expect(moveIndependentAssetIds(
      ['attachment-a', 'attachment-b'],
      'attachment-b',
      0,
    )).toEqual(['attachment-b', 'attachment-a']);
  });

  it('never exposes structured server codes as visible fallback text', () => {
    expect(localizedStudentSubmissionError(
      { error: 'answer-version-conflict' },
      '失败',
    )).toBe('答案已在其他位置更新，已恢复服务器中的最新内容，请重试。');
    expect(localizedStudentSubmissionError(
      { error: 'invalid-payload' },
      '附件上传失败，请重试。',
    )).toBe('附件上传失败，请重试。');
    expect(localizedStudentSubmissionError({
      error: 'invalid-payload',
      metadata: { fields: [{ field: 'sizeBytes', code: 'too_big' }] },
    }, '无法准备附件上传，请重试。')).toBe('附件超过单文件 25 MB 限制。');
    expect(localizedStudentSubmissionError({
      error: 'assignment-forbidden',
    }, '本题提交失败，请重试。')).toBe('当前作业权限已变化，请返回任务中心刷新。');
  });

  it('renders text-only, attachment-only, and mixed responses as submit-ready', () => {
    expect(renderQuestion({ draft: '正文证据' })).toContain('可提交');
    const attachmentOnly = question({
      assets: [{
        id: 'asset-1',
        displayName: '证据.pdf',
        role: 'ATTACHMENT',
        orderIndex: 0,
      }],
    });
    const attachmentMarkup = renderQuestion({ question: attachmentOnly });
    expect(attachmentMarkup).toContain('可提交');
    expect(attachmentMarkup).toContain('>1</span>');
    const mixedMarkup = renderQuestion({
      question: question({
        assets: [
          {
            id: 'image-1',
            displayName: '图.png',
            role: 'EMBEDDED_IMAGE',
            embeddedPosition: 'md:image_1',
          },
          ...attachmentOnly.assets!,
        ],
      }),
      draft: '混合作答',
    });
    expect(mixedMarkup).toContain('正文图片 1 个，独立附件 1 个，合计 2 / 10');
  });

  it('renders recoverable upload failure and all keyboard sorting controls', () => {
    const failed: PendingUpload = {
      clientId: 'upload-1',
      fileName: '证据.pdf',
      file: { name: '证据.pdf' } as File,
      role: 'ATTACHMENT',
      status: 'FAILED',
      message: '网络中断。',
    };
    const markup = renderQuestion({
      question: question({
        assets: [
          {
            id: 'asset-1',
            displayName: '一.pdf',
            role: 'ATTACHMENT',
            orderIndex: 0,
          },
          {
            id: 'asset-2',
            displayName: '二.pdf',
            role: 'ATTACHMENT',
            orderIndex: 1,
          },
        ],
      }),
      pendingUploads: [failed],
    });
    expect(markup).toContain('存在上传失败');
    expect(markup).toContain('重试');
    expect(markup).toContain('移除失败项');
    expect(markup).toContain('aria-label="上移附件 2"');
    expect(markup).toContain('aria-label="下移附件 1"');
    expect(markup).toContain('aria-live="polite"');
  });

  it('keeps mobile controls reachable without fixed horizontal layout', () => {
    const markup = renderQuestion();
    expect(markup).toContain('min-w-0');
    expect(markup).toContain('min-h-11');
    expect(markup).toContain('multiple=""');
    expect(markup).not.toContain('min-w-[640px]');
  });
});
