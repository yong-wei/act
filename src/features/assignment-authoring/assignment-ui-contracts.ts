import type { AssignmentDraftInput } from '@/lib/assignments/assignment-domain';

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
  sourceFamily: string;
  questionType: 'subjective-text' | 'subjective-file' | 'choice' | 'unknown';
  stemPreview: string;
  knowledgeTags: string[];
  difficulty: number | null;
  reviewState: string;
  rubricReadiness: 'ready' | 'needs-authoring';
  sourceVersion: string;
  contentHash: string;
}

export const EMPTY_ASSIGNMENT_DRAFT: AssignmentDraftInput = {
  title: '未命名作业',
  instructions: '',
  totalPoints: 10,
  questions: [],
  latePolicy: { version: 1, mode: 'CLOSED' },
  responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] },
  resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true },
  solutionReleasePolicy: { version: 1, mode: 'PRIVATE' },
};

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
