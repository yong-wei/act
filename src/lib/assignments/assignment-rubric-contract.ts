export const RUBRIC_SCORE_QUANTUM = 0.1;

export const STANDARD_RUBRIC_LEVELS = [
  { label: '优秀', ratio: 1 },
  { label: '良好', ratio: 0.9 },
  { label: '中等', ratio: 0.8 },
  { label: '及格', ratio: 0.7 },
  { label: '不及格', ratio: 0.6 },
] as const;

export interface AssignmentRubricLevelV2 {
  id: string;
  label: string;
  maxPoints: number;
  guideline: string;
}

export interface DerivedRubricLevelRange extends AssignmentRubricLevelV2 {
  minPoints: number;
  maxInclusivePoints: number;
  upperBoundaryInclusive: boolean;
}

export type RubricShortcutResult =
  | { status: 'applied'; levels: AssignmentRubricLevelV2[] }
  | { status: 'confirmation-required'; trailingLevels: AssignmentRubricLevelV2[] }
  | { status: 'rejected'; reason: 'no-0.1-interval-remains' };

export function hasAtMostOneDecimal(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
}

export function roundUpToOneDecimal(value: number): number {
  if (!Number.isFinite(value)) throw new Error('score-must-be-finite');
  return fromTenths(Math.ceil(value * 10 - 1e-8));
}

export function sortRubricLevels(
  levels: readonly AssignmentRubricLevelV2[],
  criterionMaxPoints: number,
): AssignmentRubricLevelV2[] {
  const ordered = levels
    .map((level) => ({ ...level }))
    .sort((left, right) => toTenths(right.maxPoints) - toTenths(left.maxPoints));
  if (ordered[0]) ordered[0].maxPoints = criterionMaxPoints;
  return ordered;
}

export function deriveRubricLevelRanges(
  levels: readonly AssignmentRubricLevelV2[],
  criterionMaxPoints: number,
): DerivedRubricLevelRange[] {
  const ordered = sortRubricLevels(levels, criterionMaxPoints);
  return ordered.map((level, index) => {
    const next = ordered[index + 1];
    const minimum = next ? next.maxPoints : 0;
    const inclusiveMaximum = index === 0
      ? criterionMaxPoints
      : fromTenths(toTenths(level.maxPoints) - 1);
    return {
      ...level,
      minPoints: minimum,
      maxInclusivePoints: inclusiveMaximum,
      upperBoundaryInclusive: index === 0,
    };
  });
}

export function validateDetailedRubricLevels(
  levels: readonly AssignmentRubricLevelV2[],
  criterionMaxPoints: number,
): string[] {
  const issues: string[] = [];
  if (levels.length === 0) return ['detailed-rubric-level-required'];
  const ordered = levels
    .map((level) => ({ ...level }))
    .sort((left, right) => toTenths(right.maxPoints) - toTenths(left.maxPoints));
  if (toTenths(ordered[0].maxPoints) !== toTenths(criterionMaxPoints)) {
    issues.push('highest-level-must-match-criterion-maximum');
  }
  const ids = new Set<string>();
  for (const [index, level] of ordered.entries()) {
    if (ids.has(level.id)) issues.push('duplicate-level-id');
    ids.add(level.id);
    if (!hasAtMostOneDecimal(level.maxPoints)) issues.push('score-must-use-0.1-quantum');
    if (level.maxPoints < RUBRIC_SCORE_QUANTUM || level.maxPoints > criterionMaxPoints) {
      issues.push('invalid-level-maximum');
    }
    if (index > 0 && toTenths(ordered[index - 1].maxPoints) <= toTenths(level.maxPoints)) {
      issues.push('level-maximums-must-descend');
    }
  }
  return [...new Set(issues)];
}

export function clampSuggestedScoreToLevel(input: {
  score: number;
  levelId: string;
  levels: readonly AssignmentRubricLevelV2[];
  criterionMaxPoints: number;
}): number {
  const range = deriveRubricLevelRanges(input.levels, input.criterionMaxPoints)
    .find((level) => level.id === input.levelId);
  if (!range) throw new Error('unknown-level');
  const rounded = roundUpToOneDecimal(input.score);
  return fromTenths(Math.min(
    toTenths(range.maxInclusivePoints),
    Math.max(toTenths(range.minPoints), toTenths(rounded)),
  ));
}

export function createInitialDetailedLevel(
  criterionId: string,
  criterionMaxPoints: number,
): AssignmentRubricLevelV2 {
  return {
    id: `${criterionId}-level-1`,
    label: STANDARD_RUBRIC_LEVELS[0].label,
    maxPoints: criterionMaxPoints,
    guideline: '达到该评分项的完整要求。',
  };
}

export function addDetailedRubricLevel(input: {
  criterionId: string;
  criterionMaxPoints: number;
  levels: readonly AssignmentRubricLevelV2[];
}): RubricShortcutResult {
  if (input.levels.length === 0) {
    return {
      status: 'applied',
      levels: [createInitialDetailedLevel(input.criterionId, input.criterionMaxPoints)],
    };
  }
  const ordered = sortRubricLevels(input.levels, input.criterionMaxPoints);
  const index = ordered.length;
  let nextMaximum: number;
  if (index < STANDARD_RUBRIC_LEVELS.length) {
    nextMaximum = roundUpToOneDecimal(
      input.criterionMaxPoints * STANDARD_RUBRIC_LEVELS[index].ratio,
    );
  } else {
    const previous = ordered[index - 2].maxPoints;
    const last = ordered[index - 1].maxPoints;
    nextMaximum = roundUpToOneDecimal(last * (last / previous));
    if (toTenths(nextMaximum) >= toTenths(last)) {
      nextMaximum = fromTenths(toTenths(last) - 1);
    }
  }
  if (toTenths(nextMaximum) < 1 || toTenths(nextMaximum) >= toTenths(ordered[index - 1].maxPoints)) {
    return { status: 'rejected', reason: 'no-0.1-interval-remains' };
  }
  const standard = STANDARD_RUBRIC_LEVELS[index];
  return {
    status: 'applied',
    levels: [...ordered, {
      id: `${input.criterionId}-level-${index + 1}`,
      label: standard?.label ?? '自定义',
      maxPoints: nextMaximum,
      guideline: standard ? `${standard.label}级别的评分准则。` : '自定义级别的评分准则。',
    }],
  };
}

export function applyRubricLevelShortcut(input: {
  criterionId: string;
  criterionMaxPoints: number;
  levels: readonly AssignmentRubricLevelV2[];
  targetCount: 2 | 5;
  editedLevelIds?: ReadonlySet<string>;
  confirmTrailingDeletion?: boolean;
}): RubricShortcutResult {
  const ordered = sortRubricLevels(input.levels, input.criterionMaxPoints);
  if (ordered.length > input.targetCount && !input.confirmTrailingDeletion) {
    return {
      status: 'confirmation-required',
      trailingLevels: ordered.slice(input.targetCount).map((level) => ({ ...level })),
    };
  }
  let levels = ordered.slice(0, input.targetCount).map((level) => ({ ...level }));
  while (levels.length < input.targetCount) {
    const next = input.editedLevelIds?.size && levels.length >= 2
      ? addRatioExtendedLevel({
          criterionId: input.criterionId,
          criterionMaxPoints: input.criterionMaxPoints,
          levels,
        })
      : addDetailedRubricLevel({
          criterionId: input.criterionId,
          criterionMaxPoints: input.criterionMaxPoints,
          levels,
        });
    if (next.status !== 'applied') return next;
    levels = next.levels;
  }
  levels = levels.map((level, index) => {
    if (input.editedLevelIds?.size) return level;
    const standard = input.targetCount === 2
      ? [{ label: '通过', ratio: 1 }, { label: '不通过', ratio: 0.6 }][index]
      : STANDARD_RUBRIC_LEVELS[index];
    return {
      ...level,
      label: standard.label,
      maxPoints: roundUpToOneDecimal(input.criterionMaxPoints * standard.ratio),
      guideline: `${standard.label}级别的评分准则。`,
    };
  });
  return { status: 'applied', levels: sortRubricLevels(levels, input.criterionMaxPoints) };
}

function addRatioExtendedLevel(input: {
  criterionId: string;
  criterionMaxPoints: number;
  levels: readonly AssignmentRubricLevelV2[];
}): RubricShortcutResult {
  const ordered = sortRubricLevels(input.levels, input.criterionMaxPoints);
  const previous = ordered[ordered.length - 2].maxPoints;
  const last = ordered[ordered.length - 1].maxPoints;
  let nextMaximum = roundUpToOneDecimal(last * (last / previous));
  if (toTenths(nextMaximum) >= toTenths(last)) {
    nextMaximum = fromTenths(toTenths(last) - 1);
  }
  if (toTenths(nextMaximum) < 1 || toTenths(nextMaximum) >= toTenths(last)) {
    return { status: 'rejected', reason: 'no-0.1-interval-remains' };
  }
  return {
    status: 'applied',
    levels: [...ordered, {
      id: `${input.criterionId}-level-${ordered.length + 1}`,
      label: '自定义',
      maxPoints: nextMaximum,
      guideline: '自定义级别的评分准则。',
    }],
  };
}

export function teacherScoreIsValid(score: number, criterionMaxPoints: number): boolean {
  return hasAtMostOneDecimal(score) && score >= 0 && score <= criterionMaxPoints;
}

function toTenths(value: number): number {
  return Math.round(value * 10);
}

function fromTenths(value: number): number {
  return value / 10;
}
