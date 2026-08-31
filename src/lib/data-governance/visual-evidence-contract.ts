import { sha256, stableStringify, type EvidenceBlockInput } from './math-document-grading-contracts';

export const VISUAL_EVIDENCE_SCHEMA_VERSION = 'grading-visual-evidence.v1' as const;

export type VisualEvidenceSourceKind = 'word-embedded-image' | 'pdf-page-image' | 'image-attachment';
export type VisualEvidenceReadiness = 'ready' | 'review-required';

export interface VisualEvidenceInput {
  id: string;
  sourceKind: VisualEvidenceSourceKind;
  sourceChecksum: string;
  imageChecksum: string;
  questionId: string | null;
  pageNumber: number | null;
  bbox: [number, number, number, number] | null;
  description: string | null;
  confidence: number | null;
  processorVersion: string;
  limitations: readonly string[];
  createdAt: string;
}

export interface VisualEvidence extends VisualEvidenceInput {
  schemaVersion: typeof VISUAL_EVIDENCE_SCHEMA_VERSION;
  readiness: VisualEvidenceReadiness;
  contentHash: string;
}

export function projectVisualEvidenceIntoDocument(input: {
  markdown: string;
  blocks: readonly EvidenceBlockInput[];
  visualEvidence: readonly VisualEvidence[];
}): { markdown: string; blocks: EvidenceBlockInput[]; limitations: string[] } {
  const ready = input.visualEvidence.filter((visual) => visual.readiness === 'ready');
  const incomplete = input.visualEvidence.some((visual) => visual.readiness !== 'ready');
  const visualBlocks = ready.map((visual, index) => ({
    id: `visual-evidence:${visual.id}`,
    blockIndex: input.blocks.length + index,
    pageNumber: visual.pageNumber,
    bbox: visual.bbox,
    text: visual.description!,
    markdown: `> 视觉证据：${visual.description!}`,
    precision: visual.bbox ? 'block' as const : 'page' as const,
    confidence: visual.confidence!,
    questionId: visual.questionId,
  }));
  return {
    markdown: [input.markdown.trim(), ...visualBlocks.map((block) => block.markdown!)].filter(Boolean).join('\n\n'),
    blocks: [...input.blocks, ...visualBlocks],
    limitations: incomplete ? ['visual-evidence-not-delivered'] : [],
  };
}

export function normalizeVisualEvidence(input: VisualEvidenceInput): VisualEvidence {
  const normalized = {
    ...input,
    id: input.id.trim(),
    sourceChecksum: input.sourceChecksum.trim(),
    imageChecksum: input.imageChecksum.trim(),
    questionId: input.questionId?.trim() || null,
    pageNumber: input.pageNumber === null ? null : Number(input.pageNumber),
    bbox: input.bbox === null ? null : [...input.bbox] as [number, number, number, number],
    description: input.description?.trim() || null,
    confidence: input.confidence === null ? null : Number(input.confidence),
    processorVersion: input.processorVersion.trim(),
    limitations: [...new Set(input.limitations.map((limitation) => limitation.trim()).filter(Boolean))].sort(),
    createdAt: new Date(input.createdAt).toISOString(),
  };
  assertIdentifier(normalized.id, 'visual-evidence-id-invalid');
  assertChecksum(normalized.sourceChecksum, 'visual-evidence-source-checksum-invalid');
  assertChecksum(normalized.imageChecksum, 'visual-evidence-image-checksum-invalid');
  if (normalized.questionId && !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u.test(normalized.questionId)) throw new Error('visual-evidence-question-id-invalid');
  if (normalized.pageNumber !== null && (!Number.isInteger(normalized.pageNumber) || normalized.pageNumber < 1)) throw new Error('visual-evidence-page-invalid');
  if (normalized.bbox !== null && normalized.bbox.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('visual-evidence-bbox-invalid');
  if (normalized.bbox !== null && (normalized.bbox[2] <= normalized.bbox[0] || normalized.bbox[3] <= normalized.bbox[1])) throw new Error('visual-evidence-bbox-invalid');
  if (normalized.confidence !== null && (!Number.isFinite(normalized.confidence) || normalized.confidence < 0 || normalized.confidence > 1)) throw new Error('visual-evidence-confidence-invalid');
  if (!normalized.processorVersion) throw new Error('visual-evidence-processor-version-missing');
  if (!Number.isFinite(Date.parse(normalized.createdAt))) throw new Error('visual-evidence-created-at-invalid');
  const readiness: VisualEvidenceReadiness = normalized.questionId && normalized.pageNumber && normalized.description && normalized.confidence !== null
    && normalized.confidence >= 0.8 && normalized.limitations.length === 0
    ? 'ready'
    : 'review-required';
  const body = { schemaVersion: VISUAL_EVIDENCE_SCHEMA_VERSION, ...normalized, readiness };
  return { ...body, contentHash: sha256(stableStringify(body)) };
}

function assertIdentifier(value: string, code: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/u.test(value)) throw new Error(code);
}

function assertChecksum(value: string, code: string): void {
  if (!/^sha256:[a-f0-9]{64}$/u.test(value)) throw new Error(code);
}
