export const MICRO_TUTORING_LEARNING_ACTION_VERSION = 'micro-tutoring-learning-action.v1';

export const MICRO_TUTORING_LEARNING_ACTION_TYPES = [
  'reading-explanation',
  'contrast-discrimination',
  'model-operation',
  'self-explanation',
  'retrieval-practice',
] as const;

export type MicroTutoringLearningActionType = (typeof MICRO_TUTORING_LEARNING_ACTION_TYPES)[number];

export interface MicroTutoringLearningAction {
  id: string;
  version: string;
  type: MicroTutoringLearningActionType;
  learningObjective: string;
  studentInstruction: string;
  completionCondition: string;
  estimatedMinutes: number;
}

export type MicroTutoringLearningActionIssueCode =
  | 'ACTION_MALFORMED'
  | 'ACTION_TYPE_INVALID'
  | 'ACTION_DURATION_INVALID'
  | 'ACTION_PASSIVE_ONLY';

export interface MicroTutoringLearningActionIssue {
  code: MicroTutoringLearningActionIssueCode;
  ref: string;
}

const ACTION_TYPES = new Set<string>(MICRO_TUTORING_LEARNING_ACTION_TYPES);
const PASSIVE_COMPLETION = /仅(?:打开|浏览|滚动|播放)|只(?:打开|浏览)|占位/u;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isMicroTutoringLearningActionType(
  value: unknown,
): value is MicroTutoringLearningActionType {
  return typeof value === 'string' && ACTION_TYPES.has(value);
}

export function parseMicroTutoringLearningAction(
  value: unknown,
  ref = 'action',
): { action: MicroTutoringLearningAction | null; issues: MicroTutoringLearningActionIssue[] } {
  const raw = record(value);
  if (
    !raw ||
    !nonEmptyString(raw.id) ||
    !nonEmptyString(raw.version) ||
    !nonEmptyString(raw.learningObjective) ||
    !nonEmptyString(raw.studentInstruction) ||
    !nonEmptyString(raw.completionCondition)
  ) {
    return { action: null, issues: [{ code: 'ACTION_MALFORMED', ref }] };
  }
  const issues: MicroTutoringLearningActionIssue[] = [];
  if (raw.version !== MICRO_TUTORING_LEARNING_ACTION_VERSION) {
    issues.push({ code: 'ACTION_MALFORMED', ref: `${ref}:version` });
  }
  if (!isMicroTutoringLearningActionType(raw.type)) {
    issues.push({ code: 'ACTION_TYPE_INVALID', ref });
  }
  if (
    typeof raw.estimatedMinutes !== 'number' ||
    !Number.isInteger(raw.estimatedMinutes) ||
    raw.estimatedMinutes < 1 ||
    raw.estimatedMinutes > 8
  ) {
    issues.push({ code: 'ACTION_DURATION_INVALID', ref });
  }
  if (
    PASSIVE_COMPLETION.test(raw.completionCondition) ||
    PASSIVE_COMPLETION.test(raw.studentInstruction)
  ) {
    issues.push({ code: 'ACTION_PASSIVE_ONLY', ref });
  }
  if (issues.length > 0 || !isMicroTutoringLearningActionType(raw.type) || typeof raw.estimatedMinutes !== 'number') {
    return { action: null, issues };
  }
  return {
    action: {
      id: raw.id.trim(),
      version: MICRO_TUTORING_LEARNING_ACTION_VERSION,
      type: raw.type,
      learningObjective: raw.learningObjective.trim(),
      studentInstruction: raw.studentInstruction.trim(),
      completionCondition: raw.completionCondition.trim(),
      estimatedMinutes: raw.estimatedMinutes,
    },
    issues: [],
  };
}
