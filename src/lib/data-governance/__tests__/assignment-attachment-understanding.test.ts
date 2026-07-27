import { describe, expect, it, vi } from 'vitest';

import {
  assembleAssignmentAnswerEvidence,
  assignmentAttachmentRoute,
  readBoundedAssignmentText,
} from '../assignment-attachment-understanding';
import { convertProtectedSubmission } from '../math-document-conversion';
import {
  MATH_DOCUMENT_GRADING_LIMITS,
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

  it('replaces raw embedded asset markers at their original positions', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-raw-marker',
      answerVersion: 1,
      textSnapshot: 'before\nasset:md:raw-image\nafter',
      attachments: [{
        assetId: 'asset-raw',
        displayName: 'raw.png',
        mimeType: 'image/png',
        checksum: 'sha256:raw',
        role: 'EMBEDDED_IMAGE',
        orderIndex: 0,
        embeddedPosition: 'md:raw-image',
        route: 'binary-mathpix',
        state: 'READY',
        canonicalMarkdown: 'RAW-IMAGE-CONTENT',
        blocks: [{ id: 'raw-image', blockIndex: 0, text: 'RAW-IMAGE-CONTENT' }],
      }],
    });

    const markdown = assembled.evidence.canonicalMarkdown;
    expect(markdown).not.toContain('asset:md:raw-image');
    expect(markdown.indexOf('before')).toBeLessThan(markdown.indexOf('RAW-IMAGE-CONTENT'));
    expect(markdown.indexOf('RAW-IMAGE-CONTENT')).toBeLessThan(markdown.indexOf('after'));
  });

  it('orders embedded image manifest sources by their text anchors', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-manifest-anchor-order',
      answerVersion: 1,
      textSnapshot: [
        '![first](asset:md:first)',
        'between',
        '![second](asset:md:second)',
      ].join('\n'),
      attachments: [
        {
          assetId: 'asset-second',
          displayName: 'second.png',
          mimeType: 'image/png',
          checksum: 'sha256:second',
          role: 'EMBEDDED_IMAGE',
          orderIndex: 0,
          embeddedPosition: 'md:second',
          route: 'binary-mathpix',
          state: 'READY',
          canonicalMarkdown: 'SECOND',
          blocks: [{ id: 'second', blockIndex: 0, text: 'SECOND' }],
        },
        {
          assetId: 'asset-first',
          displayName: 'first.png',
          mimeType: 'image/png',
          checksum: 'sha256:first',
          role: 'EMBEDDED_IMAGE',
          orderIndex: 1,
          embeddedPosition: 'md:first',
          route: 'binary-mathpix',
          state: 'READY',
          canonicalMarkdown: 'FIRST',
          blocks: [{ id: 'first', blockIndex: 0, text: 'FIRST' }],
        },
      ],
    });

    expect(assembled.manifest.sources.map((source) => source.assetId).filter(Boolean))
      .toEqual(['asset-first', 'asset-second']);
    expect(assembled.evidence.blocks.filter((block) => block.id.startsWith('asset:'))
      .map((block) => block.text))
      .toEqual(['FIRST', 'SECOND']);
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

  it('blocks AI grading when the text snapshot only contains a failed embedded asset marker', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-failed-embedded-only',
      answerVersion: 1,
      textSnapshot: '![student diagram](asset:md:failed-diagram)',
      attachments: [{
        assetId: 'asset-failed-embedded-only',
        displayName: 'diagram.png',
        mimeType: 'image/png',
        checksum: 'sha256:failed-embedded-only',
        role: 'EMBEDDED_IMAGE',
        orderIndex: 0,
        embeddedPosition: 'md:failed-diagram',
        route: 'binary-mathpix',
        state: 'UNDERSTANDING_FAILED',
      }],
    });

    expect(assembled.manifest.state).toBe('NO_GRADABLE_EVIDENCE');
    expect(assembled.manifest.sources).toHaveLength(1);
    expect(assembled.manifest.sources[0]?.kind).toBe('EMBEDDED_IMAGE');
    expect(assembled.evidence.readiness).toBe('blocked');
  });

  it('marks bounded direct-text truncation as incomplete grading evidence', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-truncated-text',
      answerVersion: 1,
      textSnapshot: '',
      attachments: [{
        assetId: 'asset-truncated-text',
        displayName: 'answer.txt',
        mimeType: 'text/plain',
        checksum: 'sha256:truncated',
        role: 'ATTACHMENT',
        orderIndex: 0,
        route: 'direct-text',
        state: 'READY',
        canonicalMarkdown: 'bounded answer',
        blocks: [{ id: 'text', blockIndex: 0, text: 'bounded answer' }],
        limitations: ['direct-text-truncated'],
      }],
    });

    expect(assembled.manifest.state).toBe('EVIDENCE_INCOMPLETE');
    expect(assembled.evidence.limitations).toContain('direct-text-truncated');
  });

  it('downgrades attachment-local span coordinates in aggregate evidence', () => {
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-local-span',
      answerVersion: 1,
      textSnapshot: 'student preface',
      attachments: [{
        assetId: 'asset-local-span',
        displayName: 'answer.txt',
        mimeType: 'text/plain',
        checksum: 'sha256:local-span',
        role: 'ATTACHMENT',
        orderIndex: 0,
        route: 'direct-text',
        state: 'READY',
        canonicalMarkdown: 'attachment answer',
        blocks: [{
          id: 'local-span',
          blockIndex: 0,
          text: 'attachment answer',
          markdown: 'attachment answer',
          spanStart: 0,
          spanEnd: 17,
          precision: 'span',
        }],
      }],
    });

    const attachmentBlock = assembled.evidence.blocks.find(
      (block) => block.id === 'asset:asset-local-span:local-span',
    );
    expect(attachmentBlock).toEqual(expect.objectContaining({
      precision: 'block',
      spanStart: null,
      spanEnd: null,
    }));
  });

  it('preserves safe normalization limitations for ready attachments', () => {
    const normalizationLimitations = [
      'source-snapshot-truncated',
      'blocks-truncated',
      'block-content-truncated',
      'coordinate-provenance-invalid',
    ];
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-normalized-limits',
      answerVersion: 1,
      textSnapshot: '',
      attachments: [{
        assetId: 'asset-normalized-limits',
        displayName: 'answer.pdf',
        mimeType: 'application/pdf',
        checksum: 'sha256:normalized-limits',
        role: 'ATTACHMENT',
        orderIndex: 0,
        route: 'binary-mathpix',
        state: 'READY',
        canonicalMarkdown: 'bounded mathpix answer',
        blocks: [{ id: 'page', blockIndex: 0, pageNumber: 1, text: 'bounded mathpix answer' }],
        limitations: [...normalizationLimitations, 'mathpix-failed:provider-detail'],
      }],
    });

    expect(assembled.manifest.state).toBe('EVIDENCE_INCOMPLETE');
    expect(assembled.manifest.sources[0]?.limitations).toEqual(normalizationLimitations);
    expect(assembled.evidence.limitations).toEqual(normalizationLimitations);
  });

  it('reapplies global evidence limits across ordered attachments', () => {
    const blocks = Array.from(
      { length: MATH_DOCUMENT_GRADING_LIMITS.blocks + 1 },
      (_, index) => ({
        id: `page-${index + 1}`,
        blockIndex: index,
        pageNumber: index + 1,
        text: `evidence-${index + 1}`,
      }),
    );
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-global-limits',
      answerVersion: 1,
      textSnapshot: '',
      attachments: [{
        assetId: 'asset-global-limits',
        displayName: 'large.pdf',
        mimeType: 'application/pdf',
        checksum: 'sha256:global-limits',
        role: 'ATTACHMENT',
        orderIndex: 0,
        route: 'binary-mathpix',
        state: 'READY',
        canonicalMarkdown: 'large answer',
        blocks,
      }],
    });

    expect(assembled.evidence.blocks).toHaveLength(MATH_DOCUMENT_GRADING_LIMITS.blocks);
    expect(assembled.evidence.limitations).toContain('blocks-truncated');
    expect(assembled.manifest.state).toBe('EVIDENCE_INCOMPLETE');
  });

  it('caps total evaluator block characters across aggregate evidence', () => {
    const perBlockCharacters = Math.floor(
      MATH_DOCUMENT_GRADING_LIMITS.markdownCharacters / 4,
    );
    const blocks = Array.from({ length: 8 }, (_, index) => ({
      id: `large-${index}`,
      blockIndex: index,
      text: String(index).repeat(perBlockCharacters),
      markdown: String(index).repeat(perBlockCharacters),
    }));
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-global-characters',
      answerVersion: 1,
      textSnapshot: '',
      attachments: [{
        assetId: 'asset-global-characters',
        displayName: 'large.pdf',
        mimeType: 'application/pdf',
        checksum: 'sha256:global-characters',
        role: 'ATTACHMENT',
        orderIndex: 0,
        route: 'binary-mathpix',
        state: 'READY',
        canonicalMarkdown: 'large answer',
        blocks,
      }],
    });

    const totalBlockCharacters = assembled.evidence.blocks.reduce(
      (total, block) => total + block.text.length + (block.markdown?.length ?? 0),
      0,
    );
    expect(totalBlockCharacters)
      .toBeLessThanOrEqual(MATH_DOCUMENT_GRADING_LIMITS.markdownCharacters);
    expect(assembled.evidence.blocks.length).toBeLessThan(blocks.length);
    expect(assembled.evidence.limitations).toEqual(expect.arrayContaining([
      'blocks-truncated',
      'block-content-truncated',
    ]));
    expect(assembled.manifest.state).toBe('EVIDENCE_INCOMPLETE');
  });

  it('binds evidence identity to the normalized anchor map', () => {
    const assemble = (pageNumber: number) => assembleAssignmentAnswerEvidence({
      attemptId: 'attempt-anchor-identity',
      answerVersion: 1,
      textSnapshot: '',
      attachments: [{
        assetId: 'asset-anchor-identity',
        displayName: 'answer.pdf',
        mimeType: 'application/pdf',
        checksum: 'sha256:anchor-identity',
        role: 'ATTACHMENT',
        orderIndex: 0,
        route: 'binary-mathpix',
        state: 'READY',
        canonicalMarkdown: 'same markdown',
        blocks: [{ id: 'anchor', blockIndex: 0, pageNumber, text: 'same markdown' }],
      }],
    });

    expect(assemble(1).evidence.sourceHash).not.toBe(assemble(2).evidence.sourceHash);
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
