import type { AssignmentDraftInput } from '@/lib/assignments/public-api';

export type AssignmentLifecycleState = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';

export interface TeacherAssignmentListItem {
  id: string;
  state: AssignmentLifecycleState;
  updatedAt: string;
  latestRevision: {
    id: string;
    revisionNumber: number;
    version: number;
    title: string;
    state: 'DRAFT' | 'PUBLISHED';
    audiences: Array<{ classId: string; className: string; availableAt: string; dueAt: string }>;
  } | null;
}

export interface AssignmentEditorDocument {
  assignmentId?: string;
  revisionId?: string;
  contentDigest?: string;
  version: number;
  draft: AssignmentDraftInput;
}

export interface GovernedQuestionSummary {
  catalogItemId: string;
  sourceId: string;
  sourceFamily:
    | 'acq-static-question'
    | 'checkpoint-authored-question'
    | 'icourse-objective-bank'
    | 'preset-adaptive-question';
  questionType: 'subjective-text' | 'subjective-file' | 'choice' | 'unknown';
  stemPreview: string;
  knowledgeTags: string[];
  difficulty: number | null;
  reviewState: 'path-eligible' | 'reviewed' | 'approved';
  rubricReadiness: 'ready' | 'needs-authoring';
  sourceVersion: string;
  contentHash: string;
}

export const EMPTY_ASSIGNMENT_DRAFT: AssignmentDraftInput = {
  title: '',
  instructions: '',
  totalPoints: 10,
  questions: [],
  latePolicy: { version: 1, mode: 'CLOSED' },
  responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
  resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
  solutionReleasePolicy: { version: 1, mode: 'TEACHER_CONFIRMED_RESULT' },
};

const QUESTION_SOURCE_LABELS = {
  'acq-static-question': '自适应评估题库',
  'checkpoint-authored-question': '学习检查点题库',
  'icourse-objective-bank': '爱课程客观题库',
  'preset-adaptive-question': '预设自适应题库',
} as const;

const QUESTION_TYPE_LABELS = {
  'subjective-text': '主观题',
  'subjective-file': '附件作答题',
  choice: '选择题',
  unknown: '待确认题型',
} as const;

const REVIEW_STATE_LABELS = {
  'path-eligible': '已通过路径审核',
  reviewed: '已审核',
  approved: '已批准',
} as const;

const RUBRIC_READINESS_LABELS = {
  ready: '评分已就绪',
  'needs-authoring': '评分待补全',
} as const;

export type GovernedQuestionMetadataKind =
  | 'source'
  | 'questionType'
  | 'reviewState'
  | 'rubricReadiness'
  | 'version';

export function governedQuestionMetadataLabel(
  kind: GovernedQuestionMetadataKind,
  value: string,
): string {
  if (kind === 'version') {
    if (!value.trim() || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value)) {
      throw new Error(`unmapped-governed-question-metadata:${kind}:${value}`);
    }
    return `版本 ${value}`;
  }
  const labels = {
    source: QUESTION_SOURCE_LABELS,
    questionType: QUESTION_TYPE_LABELS,
    reviewState: REVIEW_STATE_LABELS,
    rubricReadiness: RUBRIC_READINESS_LABELS,
  } as const;
  const label = (labels[kind] as Record<string, string>)[value];
  if (!label) {
    throw new Error(`unmapped-governed-question-metadata:${kind}:${value}`);
  }
  return label;
}

export function deriveAssignmentTotal(
  questions: AssignmentDraftInput['questions'],
): number {
  return Math.round(
    questions.reduce((total, question) => total + question.points, 0) * 10,
  ) / 10;
}

export function synchronizeAssignmentTotal(
  draft: AssignmentDraftInput,
): AssignmentDraftInput {
  if (draft.questions.length === 0) return draft;
  return { ...draft, totalPoints: deriveAssignmentTotal(draft.questions) };
}

export function assignmentNextAction(item: TeacherAssignmentListItem): string {
  if (item.state === 'DRAFT') return '继续编辑';
  if (item.state === 'SCHEDULED') return '查看发布计划';
  if (item.state === 'PUBLISHED') return '查看完成情况';
  return '查看历史版本';
}

export function applyGeneratedRubricGuidelines(
  question: AssignmentDraftInput['questions'][number],
  scoringItemId: string,
  generatedLevels: Array<{ levelId: string; guideline: string }>,
): AssignmentDraftInput['questions'][number] | null {
  if (question.rubric.schemaVersion !== 'assignment-scoring-rubric.v2') {
    return null;
  }
  const criterion = question.rubric.criteria.find(
    (item) => item.id === scoringItemId,
  );
  if (!criterion) return null;
  const currentIds = criterion.levels.map((level) => level.id);
  const generatedIds = generatedLevels.map((level) => level.levelId);
  if (generatedIds.length !== currentIds.length
    || new Set(generatedIds).size !== generatedIds.length
    || generatedLevels.some((level) => !currentIds.includes(level.levelId)
      || !level.guideline.trim()
      || level.guideline.length > 2_000)) {
    return null;
  }
  const guidelineById = new Map(
    generatedLevels.map((level) => [level.levelId, level.guideline.trim()]),
  );
  return {
    ...question,
    rubric: {
      ...question.rubric,
      criteria: question.rubric.criteria.map((item) =>
        item.id === scoringItemId
          ? {
              ...item,
              levels: item.levels.map((level) => ({
                ...level,
                guideline: guidelineById.get(level.id)!,
              })),
            }
          : item,
      ),
    },
  };
}
