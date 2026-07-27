import { extname } from 'node:path';

import {
  MATH_DOCUMENT_GRADING_LIMITS,
  sha256,
  type EvidenceBlockInput,
  type NormalizedAnswerEvidence,
} from './math-document-grading-contracts';

export const ASSIGNMENT_ATTACHMENT_MANIFEST_VERSION =
  'assignment-answer-evidence.v2';

export type AssignmentAttachmentRoute = 'binary-mathpix' | 'direct-text';

export type AssignmentAttachmentSource = {
  assetId: string;
  displayName: string;
  mimeType: string;
  checksum: string;
  role: 'EMBEDDED_IMAGE' | 'ATTACHMENT';
  orderIndex: number;
  embeddedPosition?: string | null;
};

export type AssignmentAttachmentUnderstanding = AssignmentAttachmentSource & {
  route: AssignmentAttachmentRoute;
  state: 'READY' | 'UNDERSTANDING_UNAVAILABLE_POLICY' | 'UNDERSTANDING_FAILED';
  canonicalMarkdown?: string | null;
  blocks?: EvidenceBlockInput[];
  limitations?: string[];
};

export type AssignmentEvidenceManifest = {
  version: typeof ASSIGNMENT_ATTACHMENT_MANIFEST_VERSION;
  attemptId: string;
  answerVersion: number;
  state: 'COMPLETE' | 'EVIDENCE_INCOMPLETE' | 'NO_GRADABLE_EVIDENCE';
  sources: Array<{
    kind: 'STUDENT_TEXT' | 'EMBEDDED_IMAGE' | 'ATTACHMENT';
    assetId: string | null;
    displayName: string | null;
    route: 'text-native' | AssignmentAttachmentRoute;
    orderIndex: number;
    embeddedPosition: string | null;
    state: 'READY' | 'UNDERSTANDING_UNAVAILABLE_POLICY' | 'UNDERSTANDING_FAILED';
    contentHash: string | null;
    limitations: string[];
  }>;
};

const BINARY_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
]);

const DIRECT_TEXT_MIME_TYPES = new Set([
  'text/markdown',
  'text/plain',
]);

const BINARY_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
]);

const DIRECT_TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

export function assignmentAttachmentRoute(
  mimeType: string,
  fileName: string,
): AssignmentAttachmentRoute {
  const normalizedMime = mimeType.trim().toLowerCase();
  const extension = extname(fileName ?? '').toLowerCase();
  if (DIRECT_TEXT_MIME_TYPES.has(normalizedMime)
    || DIRECT_TEXT_EXTENSIONS.has(extension)) return 'direct-text';
  if (BINARY_MIME_TYPES.has(normalizedMime)
    || BINARY_EXTENSIONS.has(extension)) return 'binary-mathpix';
  throw new Error('assignment-attachment-format-unsupported');
}

export function readBoundedAssignmentText(
  bytes: Uint8Array,
): {
  markdown: string;
  blocks: EvidenceBlockInput[];
  limitations: string[];
} {
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const truncated = decoded.length > MATH_DOCUMENT_GRADING_LIMITS.textCharacters;
  const markdown = decoded.slice(0, MATH_DOCUMENT_GRADING_LIMITS.textCharacters);
  const chunks = markdown
    .split(/\n{2,}/)
    .filter((chunk) => chunk.trim())
    .slice(0, MATH_DOCUMENT_GRADING_LIMITS.blocks);
  return {
    markdown,
    blocks: chunks.map((text, index) => ({
      id: `direct-text-${index + 1}`,
      blockIndex: index,
      pageNumber: null,
      text,
      markdown: text,
      spanStart: markdown.indexOf(text),
      spanEnd: markdown.indexOf(text) + text.length,
      precision: 'span',
      confidence: 1,
    })),
    limitations: [
      ...(truncated ? ['direct-text-truncated'] : []),
      ...(chunks.length >= MATH_DOCUMENT_GRADING_LIMITS.blocks
        ? ['direct-text-blocks-truncated']
        : []),
    ],
  };
}

export function assembleAssignmentAnswerEvidence(input: {
  attemptId: string;
  answerVersion: number;
  textSnapshot: string;
  attachments: AssignmentAttachmentUnderstanding[];
}): {
  evidence: NormalizedAnswerEvidence;
  manifest: AssignmentEvidenceManifest;
  omittedAssetIds: string[];
  omittedDisplayNames: string[];
} {
  const sources: AssignmentEvidenceManifest['sources'] = [];
  const limitations: string[] = [];
  const blocks: EvidenceBlockInput[] = [];
  let markdown = input.textSnapshot;
  let hasGradableEvidence = Boolean(input.textSnapshot.trim());
  if (input.textSnapshot.trim()) {
    blocks.push({
      id: 'student-text',
      blockIndex: 0,
      pageNumber: null,
      text: input.textSnapshot,
      markdown: input.textSnapshot,
      spanStart: 0,
      spanEnd: input.textSnapshot.length,
      precision: 'span',
      confidence: 1,
    });
    sources.push({
      kind: 'STUDENT_TEXT',
      assetId: null,
      displayName: null,
      route: 'text-native',
      orderIndex: -1,
      embeddedPosition: null,
      state: 'READY',
      contentHash: sha256(input.textSnapshot),
      limitations: [],
    });
  }

  const ordered = [...input.attachments].sort((left, right) => {
    if (left.role !== right.role) return left.role === 'EMBEDDED_IMAGE' ? -1 : 1;
    return left.orderIndex - right.orderIndex || left.assetId.localeCompare(right.assetId);
  });
  for (const attachment of ordered) {
    const ready = attachment.state === 'READY'
      && Boolean(attachment.canonicalMarkdown?.trim());
    const safeName = safeAttachmentName(attachment.displayName);
    const attachmentLimitations = ready
      ? [...new Set((attachment.limitations ?? []).filter((limitation) =>
          ['direct-text-truncated', 'direct-text-blocks-truncated']
            .includes(limitation)))]
      : [attachment.state === 'UNDERSTANDING_UNAVAILABLE_POLICY'
          ? 'understanding-unavailable-policy'
          : 'understanding-failed'];
    sources.push({
      kind: attachment.role,
      assetId: attachment.assetId,
      displayName: safeName,
      route: attachment.route,
      orderIndex: attachment.orderIndex,
      embeddedPosition: attachment.embeddedPosition ?? null,
      state: attachment.state,
      contentHash: ready ? sha256(attachment.canonicalMarkdown!) : null,
      limitations: attachmentLimitations,
    });
    if (!ready) {
      const missing = `attachment-understanding-missing:${attachment.assetId}:${safeName}`;
      limitations.push(missing, ...attachmentLimitations);
      if (attachment.role === 'EMBEDDED_IMAGE' && attachment.embeddedPosition) {
        markdown = replaceEmbeddedAsset(
          markdown,
          attachment.embeddedPosition,
          `\n\n[正文图片无法自动理解：${safeName}]\n\n`,
        );
      } else {
        markdown = `${markdown.trim()}\n\n## 附件：${safeName}\n\n[附件无法自动理解]`.trim();
      }
      continue;
    }
    hasGradableEvidence = true;
    const content = attachment.canonicalMarkdown!.trim();
    if (attachment.role === 'EMBEDDED_IMAGE' && attachment.embeddedPosition) {
      markdown = replaceEmbeddedAsset(
        markdown,
        attachment.embeddedPosition,
        `\n\n${content}\n\n`,
      );
    } else {
      markdown = `${markdown.trim()}\n\n## 附件：${safeName}\n\n${content}`.trim();
    }
    for (const block of attachment.blocks ?? []) {
      blocks.push({
        ...block,
        id: `asset:${attachment.assetId}:${block.id ?? blocks.length + 1}`,
        blockIndex: blocks.length,
      });
    }
  }

  const omitted = sources.filter((source) =>
    source.assetId && source.state !== 'READY');
  const state = !hasGradableEvidence
    ? 'NO_GRADABLE_EVIDENCE'
    : omitted.length > 0
      ? 'EVIDENCE_INCOMPLETE'
      : 'COMPLETE';
  const manifest: AssignmentEvidenceManifest = {
    version: ASSIGNMENT_ATTACHMENT_MANIFEST_VERSION,
    attemptId: input.attemptId,
    answerVersion: input.answerVersion,
    state,
    sources,
  };
  const canonicalMarkdown = markdown.trim();
  return {
    evidence: {
      sourceKind: sources.some((source) => source.assetId)
        ? 'document'
        : 'text-native',
      sourceHash: sha256(JSON.stringify(manifest)),
      canonicalMarkdown,
      anchorVersion: ASSIGNMENT_ATTACHMENT_MANIFEST_VERSION,
      precision: blocks.some((block) => block.precision === 'page')
        ? 'page'
        : blocks.some((block) => block.precision === 'block')
          ? 'block'
          : 'span',
      readiness: hasGradableEvidence ? 'ready' : 'blocked',
      limitationState: state === 'COMPLETE'
        ? 'none'
        : state.toLowerCase().replaceAll('_', '-'),
      limitations: [...new Set(limitations)],
      blocks: blocks.map((block, index) => ({
        ...block,
        id: block.id ?? `block-${index + 1}`,
        blockIndex: index,
      })),
    },
    manifest,
    omittedAssetIds: omitted.map((source) => source.assetId!),
    omittedDisplayNames: omitted.map((source) => source.displayName!),
  };
}

function replaceEmbeddedAsset(
  markdown: string,
  embeddedPosition: string,
  replacement: string,
) {
  const escaped = embeddedPosition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directAssetPattern = new RegExp(
    `!\\[[^\\]]*\\]\\(\\s*<?asset:${escaped}>?(?:\\s+["'][^"']*["'])?\\s*\\)`,
  );
  if (directAssetPattern.test(markdown)) {
    return markdown.replace(directAssetPattern, replacement);
  }
  const titleAssetPattern = new RegExp(
    `!\\[[^\\]]*\\]\\([^\\n)]*?\\s+["']asset:${escaped}["']\\)`,
  );
  return titleAssetPattern.test(markdown)
    ? markdown.replace(titleAssetPattern, replacement)
    : `${markdown.trim()}${replacement}`;
}

function safeAttachmentName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 160) || '未命名附件';
}
