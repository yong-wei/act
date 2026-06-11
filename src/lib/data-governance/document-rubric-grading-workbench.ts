import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  COMPETENCY_DIMENSIONS,
  type CompetencyDimension,
} from './competency-model';
import type { KonlingTeachingAssistantEntryPoint } from '@/lib/konling-agent-runtime';
import type { LearningEvidenceCitationChipPayload } from './learning-evidence-rag-corpus';

const execFileAsync = promisify(execFile);

export type DocumentSubmissionFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'markdown' | 'unknown';
export type ConversionStatus = 'pending' | 'converted' | 'failed' | 'fallback';
export type GradingRunStatus = 'draft' | 'teacher-edited' | 'approved' | 'returned' | 'rejected';
export type DocumentReferencePrecision = 'page' | 'block' | 'span';

export const DOCUMENT_RUBRIC_GOAL_DIMENSION_MAP: Record<string, CompetencyDimension> = {
  controlModeling: 'controlModeling',
  'control-modeling': 'controlModeling',
  modeling: 'controlModeling',
  parameterDesign: 'parameterDesign',
  'parameter-design': 'parameterDesign',
  'simulation-validation': 'parameterDesign',
  validation: 'parameterDesign',
  crossDomainTransfer: 'crossDomainTransfer',
  'cross-domain-transfer': 'crossDomainTransfer',
  engineeringDecision: 'engineeringDecision',
  'engineering-decision': 'engineeringDecision',
  inquiryReflection: 'inquiryReflection',
  'inquiry-reflection': 'inquiryReflection',
  selfDirectedLearning: 'selfDirectedLearning',
  'self-directed-learning': 'selfDirectedLearning',
};

export interface DocumentSubmissionAsset {
  id: string;
  studentId: string;
  classId: string;
  assignmentId: string;
  fileName: string;
  mimeType: string;
  format: DocumentSubmissionFormat;
  bytes: string;
  contentEncoding: 'utf8' | 'base64';
  checksum: string;
  uploadedAt: string;
}

export interface ConvertedDocumentBlock {
  id: string;
  pageNumber: number | null;
  text: string;
  markdown: string;
  confidence: number;
  bbox?: [number, number, number, number];
  spanStart?: number;
  spanEnd?: number;
}

export interface ConvertedDocument {
  id: string;
  assetId: string;
  adapter: 'markitdown' | 'fallback';
  status: ConversionStatus;
  markdown: string;
  blocks: ConvertedDocumentBlock[];
  checksum: string;
  confidence: number;
  referencePrecision: DocumentReferencePrecision;
  warnings: string[];
  convertedAt: string;
}

export interface ConversionAdapter {
  id: 'markitdown' | 'fallback';
  convert(asset: DocumentSubmissionAsset): Promise<ConvertedDocument>;
}

export interface MarkItDownRunnerResult {
  markdown: string;
  blocks: Array<{
    text: string;
    markdown?: string;
    pageNumber?: number | null;
    confidence?: number;
    bbox?: [number, number, number, number];
    spanStart?: number;
    spanEnd?: number;
  }>;
  referencePrecision?: DocumentReferencePrecision;
  warnings?: string[];
}

export type MarkItDownRunner = (asset: DocumentSubmissionAsset) => Promise<MarkItDownRunnerResult>;

export interface RubricCriterionLevel {
  id: string;
  label: string;
  score: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  weight: number;
  evidenceRequirement: string;
  goalDimension: string;
  levels: RubricCriterionLevel[];
}

export interface RubricDefinition {
  id: string;
  title: string;
  version: string;
  maxScore: number;
  criteria: RubricCriterion[];
}

export interface GradingEvidenceReference {
  convertedDocumentId: string;
  blockId: string;
  pageNumber: number | null;
  precision: DocumentReferencePrecision;
  excerpt: string;
  checksum: string;
  citationChip: LearningEvidenceCitationChipPayload;
}

export interface CriterionDraftGrade {
  criterionId: string;
  levelId: string;
  score: number;
  comment: string;
  confidence: number;
  evidenceRefs: GradingEvidenceReference[];
  profileWritebackCandidate: {
    goalDimension: string;
    contribution: number;
    confidence: number;
  };
}

export interface GradingAnnotation {
  id: string;
  criterionId: string;
  reference: GradingEvidenceReference;
  comment: string;
  authorRole: 'ai-draft' | 'teacher';
}

export interface DocumentRubricGradingRun {
  id: string;
  assetId: string;
  convertedDocumentId: string;
  rubricId: string;
  rubricVersion: string;
  status: GradingRunStatus;
  draftGrades: CriterionDraftGrade[];
  approvedGrades: CriterionDraftGrade[];
  annotations: GradingAnnotation[];
  teacherReview: {
    reviewerId: string | null;
    reviewedAt: string | null;
    decision: 'pending' | 'approved' | 'returned' | 'rejected';
    notes: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRubricEvidenceWriteback {
  status: 'blocked-unapproved' | 'written';
  created: number;
  facts: Array<{
    userId: string;
    factType: 'document_rubric_grading';
    outcome: 'success' | 'partial';
    score: number;
    startedAt: Date;
    finishedAt: Date;
    competencyContribution: Record<string, number>;
    sourceEventId: string;
    contextJson: {
      gradingRunId: string;
      rubricId: string;
      rubricVersion: string;
      criterionId: string;
      competencyDimension: CompetencyDimension;
      classId: string;
      assignmentId: string;
      goalId: string;
      goal: string;
      targetGoal: string;
      learningGoal: string;
      evidenceRefs: GradingEvidenceReference[];
      confidence: number;
    };
  }>;
}

export interface DocumentRubricGradingEvidenceDb {
  learningFact: {
    createMany(input: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }): Promise<{ count: number }>;
  };
  studentEvidenceFeatureCache?: {
    deleteMany(input: { where: { userId: string } }): Promise<unknown>;
  };
}

export interface DocumentRubricGoalContext {
  classId: string;
  assignmentId: string;
  goalId: string;
  targetGoal: string;
  learningGoal?: string;
}

export interface PersistedDocumentRubricGradingDraft {
  id: string;
  ownerUserId: string;
  dedupeKey: string;
  classId: string | null;
  sourceRefs: unknown;
  evidenceRefs: unknown;
  summary: unknown;
}

export interface ParsedDocumentRubricGradingDraft {
  asset: DocumentSubmissionAsset;
  convertedDocument: ConvertedDocument;
  rubric: RubricDefinition;
  run: DocumentRubricGradingRun;
  goalContext: DocumentRubricGoalContext;
}

export interface DocumentRubricGradingDraftInvariantResult {
  valid: boolean;
  reasons: string[];
}

export interface TeacherGradingWorkbenchView {
  gradingRunId: string | null;
  asset: Pick<DocumentSubmissionAsset, 'id' | 'studentId' | 'fileName' | 'checksum' | 'uploadedAt'>;
  conversion: Pick<ConvertedDocument, 'status' | 'adapter' | 'confidence' | 'referencePrecision' | 'warnings'>;
  preview: {
    markdown: string;
    blocks: ConvertedDocumentBlock[];
  };
  rubricTree: Array<{
    criterionId: string;
    label: string;
    weight: number;
    selectedLevelId: string | null;
    editableScore: number | null;
    evidenceCount: number;
  }>;
  draftSummary: {
    status: GradingRunStatus;
    averageConfidence: number;
    requiresTeacherApproval: boolean;
  };
  actions: Array<'edit-criterion' | 'add-annotation' | 'approve' | 'return-feedback' | 'retry-conversion'>;
  konlingEntryPoint: KonlingTeachingAssistantEntryPoint & { mode: 'grading-assistant' };
}

export interface StudentGradingFeedbackView {
  studentId: string;
  assignmentId: string;
  status: 'hidden-unapproved' | 'visible';
  document: {
    fileName: string;
    referencePrecision: DocumentReferencePrecision;
    markdown: string;
  } | null;
  rubricBreakdown: Array<{
    criterionId: string;
    label: string;
    score: number;
    comment: string;
    evidenceRefs: GradingEvidenceReference[];
  }>;
  evidenceCapsules: Array<{
    title: string;
    detail: string;
    confidence: number;
  }>;
  profileImpactSummary: Array<{
    goalDimension: string;
    contribution: number;
    confidence: number;
  }>;
  konlingEntryPoint: (KonlingTeachingAssistantEntryPoint & { mode: 'feedback-explainer' }) | null;
}

export function createHiddenStudentGradingFeedbackView(input: {
  studentId: string;
  assignmentId?: string;
}): StudentGradingFeedbackView {
  return {
    studentId: input.studentId,
    assignmentId: input.assignmentId ?? 'document-assignment',
    status: 'hidden-unapproved',
    document: null,
    rubricBreakdown: [],
    evidenceCapsules: [],
    profileImpactSummary: [],
    konlingEntryPoint: null,
  };
}

export function createSubmissionAsset(input: {
  id: string;
  studentId: string;
  classId: string;
  assignmentId: string;
  fileName: string;
  mimeType: string;
  bytes: string;
  contentEncoding?: 'utf8' | 'base64';
  uploadedAt: string;
}): DocumentSubmissionAsset {
  const contentEncoding = input.contentEncoding ?? 'utf8';
  return {
    ...input,
    contentEncoding,
    format: inferSubmissionFormat(input.fileName, input.mimeType),
    checksum: checksum(decodeSubmissionBytes(input.bytes, contentEncoding)),
  };
}

export function createMarkItDownConversionAdapter(input: {
  now?: Date;
  fail?: boolean;
  preserveSpanMapping?: boolean;
  runner?: MarkItDownRunner;
} = {}): ConversionAdapter {
  return {
    id: 'markitdown',
    async convert(asset) {
      if (input.fail) {
        throw new Error('markitdown-conversion-failed');
      }
      const result = input.runner
        ? await input.runner(asset)
        : await markItDownCliRunner(asset);
      const blocks = result.blocks.map((block, index) => {
        const spanStart = block.spanStart ?? (input.preserveSpanMapping ? asset.bytes.indexOf(block.text) : undefined);
        return {
          id: `block-${index + 1}`,
          pageNumber: block.pageNumber ?? index + 1,
          text: block.text,
          markdown: block.markdown ?? `- ${block.text}`,
          confidence: block.confidence ?? (input.preserveSpanMapping ? 0.92 : 0.72),
          bbox: block.bbox,
          spanStart,
          spanEnd: block.spanEnd ?? (typeof spanStart === 'number' ? spanStart + block.text.length : undefined),
        };
      });
      const referencePrecision = result.referencePrecision ??
        (blocks.every((block) => typeof block.spanStart === 'number' && typeof block.spanEnd === 'number') ? 'span' : 'block');
      return {
        id: `converted:${asset.id}`,
        assetId: asset.id,
        adapter: 'markitdown',
        status: referencePrecision === 'span' ? 'converted' : 'fallback',
        markdown: result.markdown || blocks.map((block) => block.markdown).join('\n'),
        blocks,
        checksum: asset.checksum,
        confidence: average(blocks.map((block) => block.confidence)),
        referencePrecision,
        warnings: result.warnings ?? (referencePrecision === 'span' ? [] : ['layout-span-mapping-unavailable']),
        convertedAt: (input.now ?? new Date()).toISOString(),
      };
    },
  };
}

export async function convertSubmissionDocument(input: {
  asset: DocumentSubmissionAsset;
  adapter?: ConversionAdapter;
  retryOf?: ConvertedDocument | null;
  now?: Date;
}): Promise<ConvertedDocument> {
  const adapter = input.adapter ?? createMarkItDownConversionAdapter({ now: input.now });
  try {
    return await adapter.convert(input.asset);
  } catch (error) {
    return buildFallbackConvertedDocument(input.asset, input.now, [
      error instanceof Error ? error.message : 'conversion-failed',
      input.retryOf ? 'retry-fallback' : 'initial-fallback',
    ]);
  }
}

export function createDraftRubricGrading(input: {
  convertedDocument: ConvertedDocument;
  rubric: RubricDefinition;
  now?: Date;
}): DocumentRubricGradingRun {
  const draftGrades = input.rubric.criteria.map((criterion) => {
    const evidenceBlock = findEvidenceBlock(input.convertedDocument, criterion.evidenceRequirement);
    const level = criterion.levels[Math.max(0, Math.floor((criterion.levels.length - 1) / 2))];
    const confidence = round(Math.min(input.convertedDocument.confidence, evidenceBlock.confidence));
    return {
      criterionId: criterion.id,
      levelId: level.id,
      score: level.score,
      comment: `AI draft: ${criterion.label} cites ${evidenceBlock.id}.`,
      confidence,
      evidenceRefs: [toEvidenceReference(input.convertedDocument, evidenceBlock)],
      profileWritebackCandidate: {
        goalDimension: criterion.goalDimension,
        contribution: round((level.score / input.rubric.maxScore) * criterion.weight),
        confidence,
      },
    };
  });
  const now = (input.now ?? new Date()).toISOString();
  return {
    id: `grading:${input.convertedDocument.assetId}:${input.rubric.id}:${input.rubric.version}`,
    assetId: input.convertedDocument.assetId,
    convertedDocumentId: input.convertedDocument.id,
    rubricId: input.rubric.id,
    rubricVersion: input.rubric.version,
    status: 'draft',
    draftGrades,
    approvedGrades: [],
    annotations: draftGrades.flatMap((grade, index) => grade.evidenceRefs.map((reference) => ({
      id: `annotation:${grade.criterionId}:${index + 1}`,
      criterionId: grade.criterionId,
      reference,
      comment: grade.comment,
      authorRole: 'ai-draft' as const,
    }))),
    teacherReview: { reviewerId: null, reviewedAt: null, decision: 'pending', notes: null },
    createdAt: now,
    updatedAt: now,
  };
}

export function editCriterionGrade(
  run: DocumentRubricGradingRun,
  edit: {
    criterionId: string;
    levelId: string;
    score: number;
    comment: string;
    reviewerId: string;
    now?: Date;
  },
): DocumentRubricGradingRun {
  const edited = run.draftGrades.map((grade) => grade.criterionId === edit.criterionId
    ? {
        ...grade,
        levelId: edit.levelId,
        score: edit.score,
        comment: edit.comment,
        confidence: 1,
        profileWritebackCandidate: {
          ...grade.profileWritebackCandidate,
          confidence: 1,
        },
      }
    : grade);
  return {
    ...run,
    status: 'teacher-edited',
    draftGrades: edited,
    annotations: [
      ...run.annotations,
      ...edited
        .filter((grade) => grade.criterionId === edit.criterionId)
        .flatMap((grade) => grade.evidenceRefs.map((reference) => ({
          id: `annotation:${grade.criterionId}:teacher`,
          criterionId: grade.criterionId,
          reference,
          comment: edit.comment,
          authorRole: 'teacher' as const,
        }))),
    ],
    teacherReview: {
      reviewerId: edit.reviewerId,
      reviewedAt: (edit.now ?? new Date()).toISOString(),
      decision: 'pending',
      notes: 'criterion-edited',
    },
    updatedAt: (edit.now ?? new Date()).toISOString(),
  };
}

export function approveGradingRun(
  run: DocumentRubricGradingRun,
  input: { reviewerId: string; decision?: 'approved' | 'returned' | 'rejected'; notes?: string; now?: Date },
): DocumentRubricGradingRun {
  const decision = input.decision ?? 'approved';
  const status: GradingRunStatus = decision === 'approved' ? 'approved' : decision;
  const approvedGrades = decision === 'rejected'
    ? []
    : decision === 'returned' && run.status !== 'teacher-edited' && run.status !== 'approved'
      ? []
      : run.draftGrades;
  return {
    ...run,
    status,
    approvedGrades,
    teacherReview: {
      reviewerId: input.reviewerId,
      reviewedAt: (input.now ?? new Date()).toISOString(),
      decision,
      notes: input.notes ?? null,
    },
    updatedAt: (input.now ?? new Date()).toISOString(),
  };
}

export async function writeApprovedGradingEvidence(input: {
  db: DocumentRubricGradingEvidenceDb;
  run: DocumentRubricGradingRun;
  rubric: RubricDefinition;
  studentId: string;
  goalContext: DocumentRubricGoalContext;
  now?: Date;
}): Promise<DocumentRubricEvidenceWriteback> {
  if (input.run.status !== 'approved') {
    return { status: 'blocked-unapproved', created: 0, facts: [] };
  }
  const now = input.now ?? new Date();
  const facts = input.run.approvedGrades.map((grade) => {
    const competencyDimension = normalizeDocumentRubricGoalDimension(
      grade.profileWritebackCandidate.goalDimension,
    );
    return {
      userId: input.studentId,
      factType: 'document_rubric_grading' as const,
      outcome: grade.score >= input.rubric.maxScore * 0.6 ? 'success' as const : 'partial' as const,
      score: grade.score,
      startedAt: new Date(input.run.createdAt),
      finishedAt: now,
      competencyContribution: {
        [competencyDimension]: grade.profileWritebackCandidate.contribution,
      },
      sourceEventId: `${input.run.id}:${grade.criterionId}:${input.run.rubricVersion}`,
      contextJson: {
        gradingRunId: input.run.id,
        rubricId: input.rubric.id,
        rubricVersion: input.rubric.version,
        criterionId: grade.criterionId,
        competencyDimension,
        classId: input.goalContext.classId,
        assignmentId: input.goalContext.assignmentId,
        goalId: input.goalContext.goalId,
        goal: input.goalContext.goalId,
        targetGoal: input.goalContext.targetGoal,
        learningGoal: input.goalContext.learningGoal ?? input.goalContext.targetGoal,
        evidenceRefs: grade.evidenceRefs,
        confidence: Math.min(grade.profileWritebackCandidate.confidence, 0.92),
      },
    };
  });
  const result = await input.db.learningFact.createMany({ data: facts, skipDuplicates: true });
  await input.db.studentEvidenceFeatureCache?.deleteMany({ where: { userId: input.studentId } });
  return {
    status: 'written',
    created: result.count,
    facts,
  };
}

export function buildTeacherGradingWorkbenchView(input: {
  asset: DocumentSubmissionAsset;
  convertedDocument: ConvertedDocument;
  rubric: RubricDefinition;
  run: DocumentRubricGradingRun;
}): TeacherGradingWorkbenchView {
  return {
    gradingRunId: input.run.id,
    asset: {
      id: input.asset.id,
      studentId: input.asset.studentId,
      fileName: input.asset.fileName,
      checksum: input.asset.checksum,
      uploadedAt: input.asset.uploadedAt,
    },
    conversion: {
      status: input.convertedDocument.status,
      adapter: input.convertedDocument.adapter,
      confidence: input.convertedDocument.confidence,
      referencePrecision: input.convertedDocument.referencePrecision,
      warnings: input.convertedDocument.warnings,
    },
    preview: {
      markdown: input.convertedDocument.markdown,
      blocks: input.convertedDocument.blocks,
    },
    rubricTree: input.rubric.criteria.map((criterion) => {
      const grade = input.run.draftGrades.find((item) => item.criterionId === criterion.id);
      return {
        criterionId: criterion.id,
        label: criterion.label,
        weight: criterion.weight,
        selectedLevelId: grade?.levelId ?? null,
        editableScore: grade?.score ?? null,
        evidenceCount: grade?.evidenceRefs.length ?? 0,
      };
    }),
    draftSummary: {
      status: input.run.status,
      averageConfidence: average(input.run.draftGrades.map((grade) => grade.confidence)),
      requiresTeacherApproval: input.run.status !== 'approved',
    },
    actions: ['edit-criterion', 'add-annotation', 'approve', 'return-feedback', 'retry-conversion'],
    konlingEntryPoint: {
      mode: 'grading-assistant',
      promptContext: `rubric:${input.rubric.id}@${input.rubric.version};asset:${input.asset.id}`,
      serverContext: {
        gradingRunId: input.run.id,
        assetId: input.asset.id,
        rubricId: input.rubric.id,
      },
    },
  };
}

export function normalizeDocumentRubricGoalDimension(value: string): CompetencyDimension {
  const mapped = DOCUMENT_RUBRIC_GOAL_DIMENSION_MAP[value];
  if (mapped && COMPETENCY_DIMENSIONS.includes(mapped)) {
    return mapped;
  }
  throw new Error(`unsupported-document-rubric-goal-dimension:${value}`);
}

export function parsePersistedDocumentRubricGradingDraft(
  draft: PersistedDocumentRubricGradingDraft,
): ParsedDocumentRubricGradingDraft | null {
  const summary = asRecord(draft.summary);
  const sourceRefs = asRecord(draft.sourceRefs);
  const evidenceRefs = asRecord(draft.evidenceRefs);
  const run = summary ? asDocumentRubricGradingRun(summary.run) : null;
  const rubric = summary ? asRubricDefinition(summary.rubric) : null;
  const asset = sourceRefs ? asDocumentSubmissionAsset(sourceRefs.asset) : null;
  const convertedDocument = evidenceRefs ? asConvertedDocument(evidenceRefs.convertedDocument) : null;
  if (!run || !rubric || !asset || !convertedDocument) {
    return null;
  }
  return {
    asset,
    convertedDocument,
    rubric,
    run,
    goalContext: {
      classId: stringFrom(sourceRefs?.classId) ?? draft.classId ?? asset.classId,
      assignmentId: stringFrom(sourceRefs?.assignmentId) ?? asset.assignmentId,
      goalId: stringFrom(sourceRefs?.goalId) ?? 'document-rubric-grading',
      targetGoal: stringFrom(sourceRefs?.targetGoal) ?? 'document-rubric-grading',
      learningGoal: stringFrom(sourceRefs?.learningGoal) ?? stringFrom(sourceRefs?.targetGoal) ?? 'document-rubric-grading',
    },
  };
}

export function validateDocumentRubricGradingDraftInvariants(input: {
  draft: PersistedDocumentRubricGradingDraft;
  parsed: ParsedDocumentRubricGradingDraft;
}): DocumentRubricGradingDraftInvariantResult {
  const reasons: string[] = [];
  if (input.draft.id !== input.parsed.run.id) {
    reasons.push('draft-run-id-mismatch');
  }
  if (input.draft.dedupeKey !== buildDocumentRubricDraftDedupeKey(input.parsed.asset, input.parsed.run)) {
    reasons.push('draft-dedupe-key-mismatch');
  }
  if (input.draft.ownerUserId !== input.parsed.asset.studentId) {
    reasons.push('draft-owner-user-mismatch');
  }
  if (input.draft.classId !== input.parsed.asset.classId) {
    reasons.push('draft-class-asset-class-mismatch');
  }
  if (input.parsed.goalContext.classId !== input.parsed.asset.classId) {
    reasons.push('goal-context-class-asset-class-mismatch');
  }
  if (input.parsed.goalContext.assignmentId !== input.parsed.asset.assignmentId) {
    reasons.push('goal-context-assignment-asset-assignment-mismatch');
  }
  if (input.parsed.run.assetId !== input.parsed.asset.id) {
    reasons.push('run-asset-mismatch');
  }
  if (input.parsed.convertedDocument.assetId !== input.parsed.asset.id) {
    reasons.push('converted-asset-mismatch');
  }
  if (input.parsed.convertedDocument.checksum !== input.parsed.asset.checksum) {
    reasons.push('converted-asset-checksum-mismatch');
  }
  if (checksum(decodeSubmissionBytes(input.parsed.asset.bytes, input.parsed.asset.contentEncoding)) !== input.parsed.asset.checksum) {
    reasons.push('asset-checksum-mismatch');
  }
  if (input.parsed.run.convertedDocumentId !== input.parsed.convertedDocument.id) {
    reasons.push('run-converted-document-mismatch');
  }
  if (input.parsed.run.rubricId !== input.parsed.rubric.id ||
    input.parsed.run.rubricVersion !== input.parsed.rubric.version) {
    reasons.push('run-rubric-mismatch');
  }
  const convertedBlocks = new Map(input.parsed.convertedDocument.blocks.map((block) => [block.id, block]));
  const assetText = decodedSubmissionText(input.parsed.asset);
  if (normalizeEvidenceText(input.parsed.convertedDocument.markdown) !==
    normalizeEvidenceText(input.parsed.convertedDocument.blocks.map((block) => block.markdown).join('\n'))) {
    reasons.push('converted-markdown-blocks-mismatch');
  }
  for (const block of input.parsed.convertedDocument.blocks) {
    if (assetText && !normalizeEvidenceText(assetText).includes(normalizeEvidenceText(block.text))) {
      reasons.push('converted-block-source-mismatch');
    }
  }
  const rubricCriteria = new Map(input.parsed.rubric.criteria.map((criterion) => [criterion.id, criterion]));
  const grades = [
    ...input.parsed.run.draftGrades,
    ...input.parsed.run.approvedGrades,
  ];
  for (const grade of grades) {
    const criterion = rubricCriteria.get(grade.criterionId);
    if (!criterion) {
      reasons.push('grade-criterion-mismatch');
      continue;
    }
    if (!criterion.levels.some((level) => level.id === grade.levelId)) {
      reasons.push('grade-level-mismatch');
    }
    if (grade.score < 0 || grade.score > input.parsed.rubric.maxScore) {
      reasons.push('grade-score-out-of-range');
    }
    if (grade.profileWritebackCandidate.goalDimension !== criterion.goalDimension) {
      reasons.push('grade-goal-dimension-mismatch');
    }
    if (grade.profileWritebackCandidate.contribution < 0 ||
      grade.profileWritebackCandidate.contribution > criterion.weight) {
      reasons.push('grade-contribution-out-of-range');
    }
    if (grade.profileWritebackCandidate.confidence < 0 ||
      grade.profileWritebackCandidate.confidence > 1) {
      reasons.push('grade-confidence-out-of-range');
    }
    for (const ref of grade.evidenceRefs) {
      if (ref.convertedDocumentId !== input.parsed.convertedDocument.id) {
        reasons.push('evidence-converted-document-mismatch');
      }
      if (ref.checksum !== input.parsed.convertedDocument.checksum) {
        reasons.push('evidence-checksum-mismatch');
      }
      const block = convertedBlocks.get(ref.blockId);
      if (!block) {
        reasons.push('evidence-block-mismatch');
        continue;
      }
      if (ref.pageNumber !== block.pageNumber) {
        reasons.push('evidence-page-mismatch');
      }
      if (!evidenceExcerptMatchesBlock(ref.excerpt, block)) {
        reasons.push('evidence-excerpt-mismatch');
      }
      if (!isReferencePrecisionSupported(input.parsed.convertedDocument.referencePrecision, ref.precision, block)) {
        reasons.push('evidence-precision-mismatch');
      }
    }
  }
  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export async function textFixtureMarkItDownRunner(
  asset: DocumentSubmissionAsset,
  preserveSpanMapping?: boolean,
): Promise<MarkItDownRunnerResult> {
  const lines = asset.bytes.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    markdown: lines.map((line) => `- ${line}`).join('\n'),
    referencePrecision: preserveSpanMapping ? 'span' : 'block',
    warnings: preserveSpanMapping ? [] : ['layout-span-mapping-unavailable'],
    blocks: (lines.length > 0 ? lines : [asset.fileName]).map((text, index) => ({
      text,
      markdown: `- ${text}`,
      pageNumber: index + 1,
      confidence: preserveSpanMapping ? 0.92 : 0.72,
      spanStart: preserveSpanMapping ? asset.bytes.indexOf(text) : undefined,
      spanEnd: preserveSpanMapping ? asset.bytes.indexOf(text) + text.length : undefined,
    })),
  };
}

export function buildDocumentRubricDraftDedupeKey(
  asset: Pick<DocumentSubmissionAsset, 'id' | 'assignmentId'>,
  run: Pick<DocumentRubricGradingRun, 'id'>,
): string {
  return `document-rubric:${asset.id}:${asset.assignmentId}:${run.id}`;
}

export function buildStudentGradingFeedbackView(input: {
  asset: DocumentSubmissionAsset;
  convertedDocument: ConvertedDocument;
  rubric: RubricDefinition;
  run: DocumentRubricGradingRun;
  viewerStudentId: string;
}): StudentGradingFeedbackView {
  const visible = input.viewerStudentId === input.asset.studentId &&
    ((input.run.status === 'approved' || input.run.status === 'returned') && input.run.approvedGrades.length > 0);
  if (!visible) {
    return {
      studentId: input.viewerStudentId,
      assignmentId: input.asset.assignmentId,
      status: 'hidden-unapproved',
      document: null,
      rubricBreakdown: [],
      evidenceCapsules: [],
      profileImpactSummary: [],
      konlingEntryPoint: null,
    };
  }
  const grades = input.run.approvedGrades;
  return {
    studentId: input.asset.studentId,
    assignmentId: input.asset.assignmentId,
    status: 'visible',
    document: {
      fileName: input.asset.fileName,
      referencePrecision: input.convertedDocument.referencePrecision,
      markdown: input.convertedDocument.markdown,
    },
    rubricBreakdown: grades.map((grade) => ({
      criterionId: grade.criterionId,
      label: input.rubric.criteria.find((criterion) => criterion.id === grade.criterionId)?.label ?? grade.criterionId,
      score: grade.score,
      comment: grade.comment,
      evidenceRefs: grade.evidenceRefs,
    })),
    evidenceCapsules: grades.map((grade) => ({
      title: grade.criterionId,
      detail: grade.evidenceRefs.map((ref) => ref.excerpt).join(' / '),
      confidence: grade.confidence,
    })),
    profileImpactSummary: grades.map((grade) => grade.profileWritebackCandidate),
    konlingEntryPoint: {
      mode: 'feedback-explainer',
      promptContext: `grading:${input.run.id};assignment:${input.asset.assignmentId}`,
      serverContext: {
        gradingRunId: input.run.id,
        assignmentId: input.asset.assignmentId,
      },
    },
  };
}

function buildFallbackConvertedDocument(
  asset: DocumentSubmissionAsset,
  now: Date | undefined,
  warnings: string[],
): ConvertedDocument {
  return {
    id: `converted:${asset.id}:fallback`,
    assetId: asset.id,
    adapter: 'fallback',
    status: 'failed',
    markdown: '',
    blocks: [],
    checksum: asset.checksum,
    confidence: 0,
    referencePrecision: 'page',
    warnings,
    convertedAt: (now ?? new Date()).toISOString(),
  };
}

function findEvidenceBlock(document: ConvertedDocument, query: string): ConvertedDocumentBlock {
  return document.blocks.find((block) => block.text.toLowerCase().includes(query.toLowerCase())) ??
    document.blocks[0] ?? {
      id: 'missing-block',
      pageNumber: null,
      text: 'No reliable converted evidence block was available.',
      markdown: '',
      confidence: 0,
    };
}

async function markItDownCliRunner(asset: DocumentSubmissionAsset): Promise<MarkItDownRunnerResult> {
  const workdir = await mkdtemp(join(tmpdir(), 'act-markitdown-'));
  const inputPath = join(workdir, sanitizeFileName(asset.fileName));
  try {
    await writeFile(inputPath, decodeSubmissionBytes(asset.bytes, asset.contentEncoding));
    const command = process.env.MARKITDOWN_COMMAND ?? 'uvx';
    const args = process.env.MARKITDOWN_COMMAND
      ? [inputPath]
      : ['markitdown', inputPath];
    const { stdout } = await execFileAsync(command, args, {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const markdown = stdout.trim();
    const blocks = markdown
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => ({
        text: block.replace(/[#*_`>-]/g, '').trim() || block,
        markdown: block,
        pageNumber: null,
        confidence: 0.72,
      }));
    return {
      markdown,
      blocks: blocks.length > 0 ? blocks : [{ text: asset.fileName, markdown: '', pageNumber: null, confidence: 0.4 }],
      referencePrecision: 'block',
      warnings: ['layout-span-mapping-unavailable'],
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'submission.bin';
}

function toEvidenceReference(document: ConvertedDocument, block: ConvertedDocumentBlock): GradingEvidenceReference {
  const excerpt = block.text.slice(0, 180);
  return {
    convertedDocumentId: document.id,
    blockId: block.id,
    pageNumber: block.pageNumber,
    precision: document.referencePrecision,
    excerpt,
    checksum: document.checksum,
    citationChip: {
      chunkId: `grading:${document.id}:${block.id}`,
      displayTitle: block.pageNumber ? `文档评分证据 P${block.pageNumber}` : '文档评分证据',
      displayHref: null,
      sourceType: 'grading-artifact',
      authorityLevel: 'teacher-authored',
      confidence: block.confidence >= 0.85 ? 'high' : block.confidence >= 0.6 ? 'medium' : 'low',
      freshnessBucket: 'current',
      privacyVisibility: 'redacted',
      limitationState: null,
    },
  };
}

function inferSubmissionFormat(fileName: string, mimeType: string): DocumentSubmissionFormat {
  const lower = `${fileName} ${mimeType}`.toLowerCase();
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('.docx') || lower.includes('word')) return 'docx';
  if (lower.includes('.pptx') || lower.includes('presentation')) return 'pptx';
  if (lower.includes('.xlsx') || lower.includes('spreadsheet')) return 'xlsx';
  if (lower.includes('.md') || lower.includes('markdown')) return 'markdown';
  return 'unknown';
}

function checksum(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function decodeSubmissionBytes(value: string, encoding: DocumentSubmissionAsset['contentEncoding']): Buffer | string {
  if (encoding === 'base64') {
    return Buffer.from(value.replace(/^data:[^;]+;base64,/, ''), 'base64');
  }
  return value;
}

function decodedSubmissionText(asset: DocumentSubmissionAsset): string | null {
  const decoded = decodeSubmissionBytes(asset.bytes, asset.contentEncoding);
  if (typeof decoded === 'string') {
    return decoded;
  }
  const text = decoded.toString('utf8');
  return text.includes('\uFFFD') ? null : text;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function evidenceExcerptMatchesBlock(excerpt: string, block: ConvertedDocumentBlock): boolean {
  const normalizedExcerpt = normalizeEvidenceText(excerpt);
  if (normalizedExcerpt.length === 0) {
    return false;
  }
  return normalizeEvidenceText(block.text).includes(normalizedExcerpt) ||
    normalizeEvidenceText(block.markdown).includes(normalizedExcerpt);
}

function isReferencePrecisionSupported(
  documentPrecision: DocumentReferencePrecision,
  refPrecision: DocumentReferencePrecision,
  block: ConvertedDocumentBlock,
): boolean {
  if (refPrecision === 'span') {
    return documentPrecision === 'span' &&
      typeof block.spanStart === 'number' &&
      typeof block.spanEnd === 'number';
  }
  if (refPrecision === 'block') {
    return documentPrecision === 'span' || documentPrecision === 'block';
  }
  return true;
}

function normalizeEvidenceText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringFrom(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberFrom(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asDocumentSubmissionAsset(value: unknown): DocumentSubmissionAsset | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = stringFrom(record.id);
  const studentId = stringFrom(record.studentId);
  const classId = stringFrom(record.classId);
  const assignmentId = stringFrom(record.assignmentId);
  const fileName = stringFrom(record.fileName);
  const mimeType = stringFrom(record.mimeType);
  const bytes = stringFrom(record.bytes);
  const checksumValue = stringFrom(record.checksum);
  const uploadedAt = stringFrom(record.uploadedAt);
  if (!id || !studentId || !classId || !assignmentId || !fileName || !mimeType || !bytes || !checksumValue || !uploadedAt) {
    return null;
  }
  return {
    id,
    studentId,
    classId,
    assignmentId,
    fileName,
    mimeType,
    format: isSubmissionFormat(record.format) ? record.format : inferSubmissionFormat(fileName, mimeType),
    bytes,
    contentEncoding: record.contentEncoding === 'base64' ? 'base64' : 'utf8',
    checksum: checksumValue,
    uploadedAt,
  };
}

function asConvertedDocument(value: unknown): ConvertedDocument | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = stringFrom(record.id);
  const assetId = stringFrom(record.assetId);
  const markdown = stringFrom(record.markdown);
  const checksumValue = stringFrom(record.checksum);
  const convertedAt = stringFrom(record.convertedAt);
  const confidence = numberFrom(record.confidence);
  const blocks = Array.isArray(record.blocks)
    ? record.blocks.map(asConvertedDocumentBlock).filter((block): block is ConvertedDocumentBlock => Boolean(block))
    : null;
  if (!id || !assetId || markdown === null || !checksumValue || !convertedAt || confidence === null || !blocks) {
    return null;
  }
  return {
    id,
    assetId,
    adapter: record.adapter === 'fallback' ? 'fallback' : 'markitdown',
    status: isConversionStatus(record.status) ? record.status : 'fallback',
    markdown,
    blocks,
    checksum: checksumValue,
    confidence,
    referencePrecision: isReferencePrecision(record.referencePrecision) ? record.referencePrecision : 'block',
    warnings: Array.isArray(record.warnings) ? record.warnings.filter((item): item is string => typeof item === 'string') : [],
    convertedAt,
  };
}

function asConvertedDocumentBlock(value: unknown): ConvertedDocumentBlock | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = stringFrom(record.id);
  const text = stringFrom(record.text);
  const markdown = stringFrom(record.markdown);
  const confidence = numberFrom(record.confidence);
  if (!id || text === null || markdown === null || confidence === null) {
    return null;
  }
  return {
    id,
    pageNumber: typeof record.pageNumber === 'number' ? record.pageNumber : null,
    text,
    markdown,
    confidence,
    spanStart: typeof record.spanStart === 'number' ? record.spanStart : undefined,
    spanEnd: typeof record.spanEnd === 'number' ? record.spanEnd : undefined,
  };
}

function asRubricDefinition(value: unknown): RubricDefinition | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = stringFrom(record.id);
  const title = stringFrom(record.title);
  const version = stringFrom(record.version);
  const maxScore = numberFrom(record.maxScore);
  const criteria = Array.isArray(record.criteria)
    ? record.criteria.map(asRubricCriterion).filter((criterion): criterion is RubricCriterion => Boolean(criterion))
    : null;
  if (!id || !title || !version || maxScore === null || !criteria) {
    return null;
  }
  return { id, title, version, maxScore, criteria };
}

function asRubricCriterion(value: unknown): RubricCriterion | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = stringFrom(record.id);
  const label = stringFrom(record.label);
  const weight = numberFrom(record.weight);
  const evidenceRequirement = stringFrom(record.evidenceRequirement);
  const goalDimension = stringFrom(record.goalDimension);
  const levels = Array.isArray(record.levels)
    ? record.levels.map(asRubricCriterionLevel).filter((level): level is RubricCriterionLevel => Boolean(level))
    : null;
  if (!id || !label || weight === null || !evidenceRequirement || !goalDimension || !levels) {
    return null;
  }
  return { id, label, weight, evidenceRequirement, goalDimension, levels };
}

function asRubricCriterionLevel(value: unknown): RubricCriterionLevel | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = stringFrom(record.id);
  const label = stringFrom(record.label);
  const score = numberFrom(record.score);
  const description = stringFrom(record.description);
  if (!id || !label || score === null || !description) {
    return null;
  }
  return { id, label, score, description };
}

function asDocumentRubricGradingRun(value: unknown): DocumentRubricGradingRun | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = stringFrom(record.id);
  const assetId = stringFrom(record.assetId);
  const convertedDocumentId = stringFrom(record.convertedDocumentId);
  const rubricId = stringFrom(record.rubricId);
  const rubricVersion = stringFrom(record.rubricVersion);
  const createdAt = stringFrom(record.createdAt);
  const updatedAt = stringFrom(record.updatedAt);
  const draftGrades = Array.isArray(record.draftGrades)
    ? record.draftGrades.map(asCriterionDraftGrade).filter((grade): grade is CriterionDraftGrade => Boolean(grade))
    : null;
  const approvedGrades = Array.isArray(record.approvedGrades)
    ? record.approvedGrades.map(asCriterionDraftGrade).filter((grade): grade is CriterionDraftGrade => Boolean(grade))
    : null;
  const teacherReview = asRecord(record.teacherReview);
  if (!id || !assetId || !convertedDocumentId || !rubricId || !rubricVersion || !createdAt || !updatedAt || !draftGrades || !approvedGrades || !teacherReview) {
    return null;
  }
  return {
    id,
    assetId,
    convertedDocumentId,
    rubricId,
    rubricVersion,
    status: isGradingRunStatus(record.status) ? record.status : 'draft',
    draftGrades,
    approvedGrades,
    annotations: [],
    teacherReview: {
      reviewerId: stringFrom(teacherReview.reviewerId),
      reviewedAt: stringFrom(teacherReview.reviewedAt),
      decision: isReviewDecision(teacherReview.decision) ? teacherReview.decision : 'pending',
      notes: stringFrom(teacherReview.notes),
    },
    createdAt,
    updatedAt,
  };
}

function asCriterionDraftGrade(value: unknown): CriterionDraftGrade | null {
  const record = asRecord(value);
  if (!record) return null;
  const criterionId = stringFrom(record.criterionId);
  const levelId = stringFrom(record.levelId);
  const score = numberFrom(record.score);
  const comment = stringFrom(record.comment);
  const confidence = numberFrom(record.confidence);
  const profileWritebackCandidate = asRecord(record.profileWritebackCandidate);
  const goalDimension = profileWritebackCandidate ? stringFrom(profileWritebackCandidate.goalDimension) : null;
  const contribution = profileWritebackCandidate ? numberFrom(profileWritebackCandidate.contribution) : null;
  const writebackConfidence = profileWritebackCandidate ? numberFrom(profileWritebackCandidate.confidence) : null;
  const evidenceRefs = Array.isArray(record.evidenceRefs)
    ? record.evidenceRefs.map(asEvidenceReference).filter((ref): ref is GradingEvidenceReference => Boolean(ref))
    : null;
  if (!criterionId || !levelId || score === null || comment === null || confidence === null || !goalDimension || contribution === null || writebackConfidence === null || !evidenceRefs) {
    return null;
  }
  return {
    criterionId,
    levelId,
    score,
    comment,
    confidence,
    evidenceRefs,
    profileWritebackCandidate: {
      goalDimension,
      contribution,
      confidence: writebackConfidence,
    },
  };
}

function asEvidenceReference(value: unknown): GradingEvidenceReference | null {
  const record = asRecord(value);
  if (!record) return null;
  const convertedDocumentId = stringFrom(record.convertedDocumentId);
  const blockId = stringFrom(record.blockId);
  const excerpt = stringFrom(record.excerpt);
  const checksumValue = stringFrom(record.checksum);
  if (!convertedDocumentId || !blockId || excerpt === null || !checksumValue) {
    return null;
  }
  return {
    convertedDocumentId,
    blockId,
    pageNumber: typeof record.pageNumber === 'number' ? record.pageNumber : null,
    precision: isReferencePrecision(record.precision) ? record.precision : 'block',
    excerpt,
    checksum: checksumValue,
    citationChip: asCitationChip(record.citationChip, {
      chunkId: `grading:${convertedDocumentId}:${blockId}`,
      displayTitle: '文档评分证据',
      displayHref: null,
      sourceType: 'grading-artifact',
      authorityLevel: 'teacher-authored',
      confidence: 'medium',
      freshnessBucket: 'current',
      privacyVisibility: 'redacted',
      limitationState: null,
    }),
  };
}

function asCitationChip(value: unknown, fallback: LearningEvidenceCitationChipPayload): LearningEvidenceCitationChipPayload {
  const record = asRecord(value);
  if (!record) return fallback;
  return {
    chunkId: stringFrom(record.chunkId) ?? fallback.chunkId,
    displayTitle: stringFrom(record.displayTitle) ?? fallback.displayTitle,
    displayHref: stringFrom(record.displayHref),
    sourceType: record.sourceType === 'grading-artifact' ? 'grading-artifact' : fallback.sourceType,
    authorityLevel: record.authorityLevel === 'teacher-authored' ? 'teacher-authored' : fallback.authorityLevel,
    confidence: isLearningEvidenceConfidence(record.confidence) ? record.confidence : fallback.confidence,
    freshnessBucket: record.freshnessBucket === 'current' || record.freshnessBucket === 'recent' || record.freshnessBucket === 'stale' || record.freshnessBucket === 'expired'
      ? record.freshnessBucket
      : fallback.freshnessBucket,
    privacyVisibility: record.privacyVisibility === 'public' || record.privacyVisibility === 'redacted' || record.privacyVisibility === 'privileged'
      ? record.privacyVisibility
      : fallback.privacyVisibility,
    limitationState: typeof record.limitationState === 'string' ? record.limitationState as LearningEvidenceCitationChipPayload['limitationState'] : null,
  };
}

function isLearningEvidenceConfidence(value: unknown): value is LearningEvidenceCitationChipPayload['confidence'] {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high';
}

function isConversionStatus(value: unknown): value is ConversionStatus {
  return value === 'pending' || value === 'converted' || value === 'failed' || value === 'fallback';
}

function isSubmissionFormat(value: unknown): value is DocumentSubmissionFormat {
  return value === 'pdf' || value === 'docx' || value === 'pptx' ||
    value === 'xlsx' || value === 'markdown' || value === 'unknown';
}

function isReferencePrecision(value: unknown): value is DocumentReferencePrecision {
  return value === 'page' || value === 'block' || value === 'span';
}

function isGradingRunStatus(value: unknown): value is GradingRunStatus {
  return value === 'draft' || value === 'teacher-edited' || value === 'approved' || value === 'returned' || value === 'rejected';
}

function isReviewDecision(value: unknown): value is DocumentRubricGradingRun['teacherReview']['decision'] {
  return value === 'pending' || value === 'approved' || value === 'returned' || value === 'rejected';
}
