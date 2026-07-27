import { describe, expect, it, vi } from 'vitest';

import {
  assembleAssignmentAnswerEvidence,
  assignmentAttachmentRoute,
  readBoundedAssignmentText,
} from '../assignment-attachment-understanding';
import { convertProtectedSubmission } from '../math-document-conversion';
import {
  sha256,
  type ExternalProcessingPolicy,
} from '../math-document-grading-contracts';

describe('assignment attachment understanding', () => {
  it.each([
    ['application/pdf', 'answer.pdf', 'binary-mathpix'],
    ['application/msword', 'answer.doc', 'binary-mathpix'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'answer.docx', 'binary-mathpix'],
    ['application/vnd.ms-powerpoint', 'answer.ppt', 'binary-mathpix'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'answer.pptx', 'binary-mathpix'],
    ['image/png', 'answer.png', 'binary-mathpix'],
    ['image/jpeg', 'answer.jpg', 'binary-mathpix'],
    ['text/markdown', 'answer.md', 'direct-text'],
    ['text/plain', 'answer.txt', 'direct-text'],
  ])('routes %s through %s', (mimeType, fileName, expected) => {
    expect(assignmentAttachmentRoute(mimeType, fileName)).toBe(expected);
  });

  it('reads direct text without calling Mathpix or a local binary converter', async () => {
    const bytes = new TextEncoder().encode('first\n\nsecond');
    const checksum = sha256(bytes);
    const mathpix = { convert: vi.fn() };
    const local = { convert: vi.fn() };
    const result = await convertProtectedSubmission({
      source: source({ mimeType: 'text/markdown', originalName: 'answer.md', sizeBytes: bytes.byteLength, checksum }),
      store: store(bytes, checksum, 'text/markdown'),
      assignmentResponse: true,
      mathpix,
      local,
    });
    expect(result).toMatchObject({
      adapter: 'assignment-direct-text',
      state: 'succeeded',
      markdown: 'first\n\nsecond',
    });
    expect(mathpix.convert).not.toHaveBeenCalled();
    expect(local.convert).not.toHaveBeenCalled();
    expect(readBoundedAssignmentText(bytes).blocks).toHaveLength(2);
  });

  it('never falls back to local binary semantics when Mathpix is unavailable', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const checksum = sha256(bytes);
    const local = { convert: vi.fn().mockResolvedValue({
      markdown: 'forbidden local output',
      blocks: [{ text: 'forbidden local output' }],
    }) };
    const result = await convertProtectedSubmission({
      source: source({ sizeBytes: bytes.byteLength, checksum }),
      store: store(bytes, checksum, 'application/pdf'),
      assignmentResponse: true,
      policy: null,
      mathpix: { convert: vi.fn() },
      local,
    });
    expect(result).toMatchObject({
      adapter: 'assignment-mathpix-only',
      state: 'blocked',
      markdown: '',
    });
    expect(result.limitations).toContain('understanding-unavailable-policy');
    expect(local.convert).not.toHaveBeenCalled();
  });

  it('uses Mathpix as the only semantic route for an allowed binary attachment', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const checksum = sha256(bytes);
    const mathpix = { convert: vi.fn().mockResolvedValue({
      requestId: 'request-1',
      markdown: 'Mathpix evidence',
      lines: [{ text: 'Mathpix evidence', page: 1 }],
    }) };
    const result = await convertProtectedSubmission({
      source: source({ sizeBytes: bytes.byteLength, checksum }),
      store: store(bytes, checksum, 'application/pdf'),
      assignmentResponse: true,
      policy: policy(),
      mathpix,
      local: { convert: vi.fn() },
    });
    expect(result).toMatchObject({
      adapter: 'mathpix',
      state: 'succeeded',
      markdown: 'Mathpix evidence',
    });
    expect(mathpix.convert).toHaveBeenCalledOnce();
  });

  it('marks binary understanding unavailable only after bounded Mathpix retries', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const checksum = sha256(bytes);
    const mathpix = { convert: vi.fn().mockRejectedValue(new Error('provider-down')) };
    const result = await convertProtectedSubmission({
      source: source({ sizeBytes: bytes.byteLength, checksum }),
      store: store(bytes, checksum, 'application/pdf'),
      assignmentResponse: true,
      policy: policy(),
      mathpix,
      local: { convert: vi.fn() },
    });
    expect(mathpix.convert).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      state: 'blocked',
      adapter: 'assignment-mathpix-only',
      limitations: ['understanding-failed'],
    });
  });

  it('assembles embedded and independent evidence in frozen response order', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-1',
      answerVersion: 3,
      textSnapshot: '正文\n\n![图](stable "asset:md:image1")',
      attachments: [
        {
          assetId: 'attachment-2',
          displayName: 'second.pdf',
          mimeType: 'application/pdf',
          checksum: 'sha256:second',
          role: 'ATTACHMENT',
          orderIndex: 2,
          route: 'binary-mathpix',
          state: 'UNDERSTANDING_FAILED',
          limitations: ['understanding-failed:provider-down'],
        },
        {
          assetId: 'image-1',
          displayName: 'plot.png',
          mimeType: 'image/png',
          checksum: 'sha256:image',
          role: 'EMBEDDED_IMAGE',
          orderIndex: 0,
          embeddedPosition: 'md:image1',
          route: 'binary-mathpix',
          state: 'READY',
          canonicalMarkdown: '图中峰值为 2',
          blocks: [{ id: 'image-block', blockIndex: 0, text: '图中峰值为 2' }],
        },
        {
          assetId: 'attachment-1',
          displayName: 'first.txt',
          mimeType: 'text/plain',
          checksum: 'sha256:first',
          role: 'ATTACHMENT',
          orderIndex: 1,
          route: 'direct-text',
          state: 'READY',
          canonicalMarkdown: '第一份附件',
          blocks: [{ id: 'text-block', blockIndex: 0, text: '第一份附件' }],
        },
      ],
    });
    expect(assembled.manifest.state).toBe('EVIDENCE_INCOMPLETE');
    expect(assembled.manifest.sources.map((source) => source.assetId))
      .toEqual([null, 'image-1', 'attachment-1', 'attachment-2']);
    expect(assembled.evidence.canonicalMarkdown.indexOf('图中峰值为 2'))
      .toBeLessThan(assembled.evidence.canonicalMarkdown.indexOf('第一份附件'));
    expect(assembled.evidence.canonicalMarkdown)
      .toContain('## 附件：second.pdf\n\n[附件无法自动理解]');
    expect(assembled.omittedAssetIds).toEqual(['attachment-2']);
    expect(assembled.evidence.limitations.join(' '))
      .not.toContain('provider-down');
  });

  it('replaces direct asset URLs and title anchors at their original positions', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-embedded-order',
      answerVersion: 1,
      textSnapshot: [
        'before',
        '![first](asset:md:figure-1)',
        'middle',
        '![second](stable "asset:md:figure-2")',
        'after',
      ].join('\n'),
      attachments: [
        {
          assetId: 'asset-2',
          displayName: 'second.png',
          mimeType: 'image/png',
          checksum: 'sha256:second',
          role: 'EMBEDDED_IMAGE',
          orderIndex: 1,
          embeddedPosition: 'md:figure-2',
          route: 'binary-mathpix',
          state: 'UNDERSTANDING_FAILED',
        },
        {
          assetId: 'asset-1',
          displayName: 'first.png',
          mimeType: 'image/png',
          checksum: 'sha256:first',
          role: 'EMBEDDED_IMAGE',
          orderIndex: 0,
          embeddedPosition: 'md:figure-1',
          route: 'binary-mathpix',
          state: 'READY',
          canonicalMarkdown: 'FIRST-IMAGE-CONTENT',
          blocks: [{
            id: 'first-image',
            blockIndex: 0,
            text: 'FIRST-IMAGE-CONTENT',
          }],
        },
      ],
    });

    const markdown = assembled.evidence.canonicalMarkdown;
    expect(markdown).not.toContain('asset:md:figure-1');
    expect(markdown).not.toContain('asset:md:figure-2');
    const positions = [
      markdown.indexOf('before'),
      markdown.indexOf('FIRST-IMAGE-CONTENT'),
      markdown.indexOf('middle'),
      markdown.indexOf('[正文图片无法自动理解：second.png]'),
      markdown.indexOf('after'),
    ];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
    const blockText = assembled.evidence.blocks.map((block) => block.text);
    expect(blockText.findIndex((text) => text.includes('before')))
      .toBeLessThan(blockText.indexOf('FIRST-IMAGE-CONTENT'));
    expect(blockText.indexOf('FIRST-IMAGE-CONTENT'))
      .toBeLessThan(blockText.findIndex((text) => text.includes('middle')));
    expect(blockText.findIndex((text) => text.includes('middle')))
      .toBeLessThan(blockText.indexOf('[正文图片无法自动理解：second.png]'));
    expect(blockText.indexOf('[正文图片无法自动理解：second.png]'))
      .toBeLessThan(blockText.findIndex((text) => text.includes('after')));
  });

  it('blocks AI grading when every source lacks gradable evidence', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-empty',
      answerVersion: 1,
      textSnapshot: '',
      attachments: [{
        assetId: 'asset-empty',
        displayName: 'answer.pdf',
        mimeType: 'application/pdf',
        checksum: 'sha256:empty',
        role: 'ATTACHMENT',
        orderIndex: 0,
        route: 'binary-mathpix',
        state: 'UNDERSTANDING_UNAVAILABLE_POLICY',
      }],
    });
    expect(assembled.manifest.state).toBe('NO_GRADABLE_EVIDENCE');
    expect(assembled.evidence.readiness).toBe('blocked');
  });
});

function policy(): ExternalProcessingPolicy {
  return {
    provider: 'mathpix',
    version: 'mathpix.v1',
    model: null,
    endpoint: 'https://api.mathpix.com/v3/pdf',
    purpose: 'answer-conversion',
    dataCategories: ['student-answer'],
    minimizedScope: ['selected-question', 'answer-evidence'],
    institutionScope: null,
    classScope: ['class-1'],
    processingRegion: 'CN',
    agreementVersion: 'agreement.v1',
    noTraining: true,
    providerRetentionSeconds: 0,
    deletionCapability: true,
    rateLimitPerMinute: 10,
    enabled: true,
    disabledAt: null,
    credentialRef: 'env:MATHPIX_APP_KEY',
  };
}

function source(overrides: Record<string, unknown> = {}) {
  return {
    assetId: 'asset-1',
    attemptId: 'attempt-1',
    answerId: 'answer-1',
    ownerId: 'student-1',
    objectKey: 'submission/asset-1',
    originalName: 'answer.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 3,
    checksum: sha256(new Uint8Array([1, 2, 3])),
    classId: 'class-1',
    ...overrides,
  } as any;
}

function store(bytes: Uint8Array, checksum: string, mimeType: string) {
  return {
    head: vi.fn().mockResolvedValue({
      key: 'submission/asset-1',
      ownerId: 'student-1',
      answerId: 'answer-1',
      sizeBytes: bytes.byteLength,
      mimeType,
      checksum,
      scanState: 'CLEAN',
    }),
    readObject: vi.fn().mockResolvedValue(bytes),
  } as any;
}
