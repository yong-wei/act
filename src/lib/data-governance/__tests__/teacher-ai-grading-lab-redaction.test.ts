import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  completeTeacherAiGradingDeletionItem,
  confirmTeacherAiGradingRedaction,
  createTeacherAiGradingDeletionChecklist,
  createTeacherAiGradingRedactedDocument,
  createTeacherAiGradingRedactionReview,
  projectTeacherAiGradingModelSubmission,
  projectTeacherAiGradingSafeError,
  projectTeacherAiGradingSafeEvent,
  recordTeacherAiGradingRetentionDecision,
  rejectTeacherAiGradingRedaction,
  TeacherAiGradingRedactionError,
} from '../teacher-ai-grading-lab-redaction';

const ownerTeacherUserId = `c${'a'.repeat(24)}`;
const sampleId = 'sample-abcd';
const identityTerms = [
  { kind: 'student-name' as const, value: '张三' },
  { kind: 'student-number' as const, value: '20231234' },
  { kind: 'email' as const, value: 'zhangsan@example.test' },
];

describe('teacher AI grading DOCX redaction', () => {
  it('redacts file name, properties, split-run body text, headers, footers, and comments', async () => {
    const sourceBytes = await buildIdentityBearingDocx();
    const original = Buffer.from(sourceBytes);
    const result = await createTeacherAiGradingRedactedDocument({
      sampleId,
      questionId: 'T1-4',
      sourceFileName: '张三_20231234.docx',
      sourceBytes,
      identityTerms,
    });

    expect(sourceBytes).toEqual(original);
    expect(result).toMatchObject({
      sampleId,
      questionId: 'T1-4',
      outputFileName: 'T1-4.docx',
      unresolvedFindingCount: 0,
      sourceChecksum: sha256(sourceBytes),
      redactedChecksum: sha256(result.bytes),
    });
    expect(new Set(result.findings.map((finding) => finding.scope))).toEqual(new Set([
      'file-name',
      'document-properties',
      'body',
      'header',
      'footer',
      'comments',
    ]));

    const redactedText = await readInspectableXml(result.bytes);
    for (const secret of ['张三', '20231234', 'zhangsan@example.test']) {
      expect(redactedText).not.toContain(secret);
    }
    expect(redactedText).not.toContain('w:author="张三"');
    expect(redactedText).not.toContain('w15:authorId="person-20231234"');
    expect(redactedText).toContain('█');
  });

  it('fails closed for invalid DOCX and legacy DOC before controlled conversion exists', async () => {
    await expect(createTeacherAiGradingRedactedDocument({
      sampleId,
      questionId: 'T1-4',
      sourceFileName: 'answer.docx',
      sourceBytes: Buffer.from('not-a-docx'),
      identityTerms,
    })).rejects.toMatchObject({ code: 'LAB_REDACTION_DOCX_INVALID' });

    await expect(createTeacherAiGradingRedactedDocument({
      sampleId,
      questionId: 'T1-4',
      sourceFileName: 'answer.doc',
      sourceBytes: Buffer.from('legacy-doc'),
      identityTerms,
    })).rejects.toMatchObject({ code: 'LAB_REDACTION_LEGACY_DOC_REQUIRES_CONVERSION' });
  });
});

describe('teacher AI grading redaction confirmation and safe projection', () => {
  it('requires an owner confirmation and exact redacted checksum before model projection', async () => {
    const redactedDocument = await createTeacherAiGradingRedactedDocument({
      sampleId,
      questionId: 'T1-4',
      sourceFileName: '张三.docx',
      sourceBytes: await buildIdentityBearingDocx(),
      identityTerms,
    });
    const review = createTeacherAiGradingRedactionReview(redactedDocument);

    expect(() => projectTeacherAiGradingModelSubmission({ review, redactedDocument, ownerTeacherUserId }))
      .toThrowError(expect.objectContaining({ code: 'LAB_REDACTION_UNRESOLVED' }));
    expect(() => confirmTeacherAiGradingRedaction({
      review,
      redactedDocument,
      actorUserId: `c${'b'.repeat(24)}`,
      ownerTeacherUserId,
    })).toThrowError(expect.objectContaining({ code: 'LAB_REDACTION_OWNER_REQUIRED' }));
    expect(() => confirmTeacherAiGradingRedaction({
      review: { ...review, unresolvedFindingCount: 1 },
      redactedDocument: { ...redactedDocument, unresolvedFindingCount: 1 },
      actorUserId: ownerTeacherUserId,
      ownerTeacherUserId,
    })).toThrowError(expect.objectContaining({ code: 'LAB_REDACTION_UNRESOLVED' }));

    const confirmed = confirmTeacherAiGradingRedaction({
      review,
      redactedDocument,
      actorUserId: ownerTeacherUserId,
      ownerTeacherUserId,
      confirmedAt: new Date('2026-07-27T00:00:00.000Z'),
    });
    expect(confirmed).toMatchObject({
      status: 'CONFIRMED',
      confirmedBy: ownerTeacherUserId,
      confirmedAt: '2026-07-27T00:00:00.000Z',
    });

    const projection = projectTeacherAiGradingModelSubmission({ review: confirmed, redactedDocument, ownerTeacherUserId });
    expect(projection).toMatchObject({ sampleId, questionId: 'T1-4', fileName: 'T1-4.docx' });
    expect(projection.documentBytes).not.toBe(redactedDocument.bytes);
    const safeProjection = JSON.stringify({ sampleId: projection.sampleId, fileName: projection.fileName });
    expect(safeProjection).not.toContain('张三');
    expect(safeProjection).not.toContain('20231234');
    expect(safeProjection).not.toContain('E:\\');

    expect(() => projectTeacherAiGradingModelSubmission({
      review: confirmed,
      redactedDocument: { ...redactedDocument, bytes: Buffer.from('tampered') },
      ownerTeacherUserId,
    })).toThrowError(expect.objectContaining({ code: 'LAB_REDACTION_CHECKSUM_MISMATCH' }));
  });

  it('does not allow rejected or already confirmed reviews to be transitioned again', async () => {
    const redactedDocument = await createTeacherAiGradingRedactedDocument({
      sampleId,
      questionId: 'T1-4',
      sourceFileName: 'answer.docx',
      sourceBytes: await buildIdentityBearingDocx(),
      identityTerms,
    });
    const review = createTeacherAiGradingRedactionReview(redactedDocument);
    expect(rejectTeacherAiGradingRedaction(review).status).toBe('REJECTED');
    const confirmed = confirmTeacherAiGradingRedaction({ review, redactedDocument, actorUserId: ownerTeacherUserId, ownerTeacherUserId });
    expect(() => confirmTeacherAiGradingRedaction({
      review: confirmed,
      redactedDocument,
      actorUserId: ownerTeacherUserId,
      ownerTeacherUserId,
    })).toThrowError(expect.objectContaining({ code: 'LAB_REDACTION_STATE_INVALID' }));
  });

  it('projects logs and errors without messages, paths, credentials, or raw identifiers', () => {
    const event = projectTeacherAiGradingSafeEvent({
      sampleId,
      code: 'LAB_REDACTION_UNRESOLVED',
      stage: 'redaction-review',
      status: 'blocked',
    });
    const unsafeEvent = projectTeacherAiGradingSafeEvent({
      sampleId,
      code: 'C:\\private\\grading-lab\\secret',
      stage: 'C:\\private\\grading-lab',
      status: 'token=secret',
    });
    const error = projectTeacherAiGradingSafeError({
      code: 'C:\\private\\grading-lab\\张三.docx',
      message: 'token=secret zhangsan@example.test',
    }, sampleId);
    const serialized = JSON.stringify({ event, error });
    expect(error).toEqual({ code: 'LAB_OPERATION_FAILED', sampleId });
    expect(unsafeEvent).toEqual({ sampleId, code: 'LAB_OPERATION_FAILED', stage: 'unknown', status: 'unknown' });
    expect(serialized).not.toContain('private');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('zhangsan');
  });
});

describe('teacher AI grading data lifecycle records', () => {
  it('tracks owner-completed deletion items without storing local paths', () => {
    const checklist = createTeacherAiGradingDeletionChecklist('synthetic-t1', 'v1');
    expect(() => completeTeacherAiGradingDeletionItem({
      checklist,
      itemId: 'identity-mapping',
      actorUserId: `c${'b'.repeat(24)}`,
      ownerTeacherUserId,
    })).toThrowError(expect.objectContaining({ code: 'LAB_REDACTION_OWNER_REQUIRED' }));

    const completed = completeTeacherAiGradingDeletionItem({
      checklist,
      itemId: 'identity-mapping',
      actorUserId: ownerTeacherUserId,
      ownerTeacherUserId,
      completedAt: new Date('2026-07-27T01:00:00.000Z'),
    });
    expect(completed.items.find((item) => item.id === 'identity-mapping')).toMatchObject({
      completed: true,
      completedBy: ownerTeacherUserId,
      completedAt: '2026-07-27T01:00:00.000Z',
    });
    expect(JSON.stringify(completed)).not.toContain('E:\\');
  });

  it('allows retention only after identity and re-identification gates are closed', () => {
    const base = {
      artifactKind: 'redacted-sample' as const,
      artifactId: 'sample-abcd',
      retain: true,
      containsIdentity: false,
      containsRawSource: false,
      irreversibleRedactionConfirmed: true,
      identityMappingDeleted: true,
      reidentificationRiskReviewed: true,
      decidedBy: ownerTeacherUserId,
      decidedAt: '2026-07-27T02:00:00.000Z',
    };
    expect(recordTeacherAiGradingRetentionDecision(base, ownerTeacherUserId)).toEqual(base);
    expect(() => recordTeacherAiGradingRetentionDecision({
      ...base,
      identityMappingDeleted: false,
    }, ownerTeacherUserId)).toThrowError(expect.objectContaining({ code: 'LAB_RETENTION_NOT_ALLOWED' }));
    expect(() => recordTeacherAiGradingRetentionDecision({
      ...base,
      containsRawSource: true,
    }, ownerTeacherUserId)).toThrowError(TeacherAiGradingRedactionError);
  });
});

async function buildIdentityBearingDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('docProps/core.xml', [
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"',
    ' xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<dc:creator>张三</dc:creator>',
    '<cp:lastModifiedBy>张三</cp:lastModifiedBy>',
    '<dc:title>学号：20231234</dc:title>',
    '</cp:coreProperties>',
  ].join(''));
  zip.file('docProps/custom.xml', [
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"',
    ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    '<property name="zhangsan@example.test"><vt:lpwstr>zhangsan@example.test</vt:lpwstr></property>',
    '</Properties>',
  ].join(''));
  zip.file('word/document.xml', wordPart([
    '<w:p><w:r><w:t>姓名：张</w:t></w:r><w:r><w:t>三</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>学号：20231234</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>邮箱 zhangsan@example.test</w:t></w:r></w:p>',
    '<w:p><w:ins w:author="张三" w:date="2026-07-27T00:00:00Z"><w:r><w:t>答案：系统稳定。</w:t></w:r></w:ins></w:p>',
  ].join('')));
  zip.file('word/header1.xml', wordPart('<w:p><w:r><w:t>张三的作业</w:t></w:r></w:p>', 'w:hdr'));
  zip.file('word/footer1.xml', wordPart('<w:p><w:r><w:t>20231234</w:t></w:r></w:p>', 'w:ftr'));
  zip.file('word/comments.xml', [
    '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:comment w:id="0" w:author="张三" w:initials="ZS" w:date="2026-07-27T00:00:00Z">',
    '<w:p><w:r><w:t>联系 zhangsan@example.test</w:t></w:r></w:p>',
    '</w:comment></w:comments>',
  ].join(''));
  zip.file('word/people.xml', [
    '<w15:people xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml">',
    '<w15:person w15:author="张三" w15:authorId="person-20231234"/>',
    '</w15:people>',
  ].join(''));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function wordPart(content: string, root = 'w:document'): string {
  return `<${root} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${content}</${root}>`;
}

async function readInspectableXml(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const paths = ['docProps/core.xml', 'docProps/custom.xml', 'word/document.xml', 'word/header1.xml', 'word/footer1.xml', 'word/comments.xml', 'word/people.xml'];
  return (await Promise.all(paths.map(async (path) => zip.file(path)?.async('string') ?? ''))).join('\n');
}

function sha256(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
