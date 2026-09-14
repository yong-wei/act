/** Tunable weights for knowledge-path assembly. Locked against the live teaching projection. */
export interface KnowledgePathPolicy {
  maxSteps: number;
  heuristicTimeoutMs: number;
  masterySkipThreshold: number;
  styleKindBonus: number;
  preferredTypeBonus: number;
  timeSliceBonus: number;
  rhythmBonus: number;
  courseEarlyRatio: number;
  courseEarlyPenalty: number;
  courseCapstoneRatio: number;
  courseCapstoneBonus: number;
  courseUnmetPenalty: number;
  wideCourseMinBindings: number;
  pathCoverageWeight: number;
  pathPortraitWeight: number;
  pathStyleWeight: number;
  pathTimeWeight: number;
  pathCoursePlacementWeight: number;
}

const MIN_HEURISTIC_TIMEOUT_MS = 50;
const MAX_HEURISTIC_TIMEOUT_MS = 10_000;
/** 部署后按生产成功启发式 P95 再调。环境变量 `KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS` 可覆盖。 */
export const DEFAULT_HEURISTIC_TIMEOUT_MS = 250;

export function readHeuristicTimeoutMs(
  raw = process.env.KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS,
): number {
  if (raw == null || raw.trim() === '') return DEFAULT_HEURISTIC_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_HEURISTIC_TIMEOUT_MS;
  return Math.min(MAX_HEURISTIC_TIMEOUT_MS, Math.max(MIN_HEURISTIC_TIMEOUT_MS, Math.round(parsed)));
}

export const DEFAULT_KNOWLEDGE_PATH_POLICY: KnowledgePathPolicy = {
  maxSteps: 12,
  heuristicTimeoutMs: DEFAULT_HEURISTIC_TIMEOUT_MS,
  masterySkipThreshold: 0.65,
  styleKindBonus: 7,
  preferredTypeBonus: 5,
  timeSliceBonus: 2,
  rhythmBonus: 1,
  courseEarlyRatio: 0.55,
  courseEarlyPenalty: 8,
  courseCapstoneRatio: 0.7,
  courseCapstoneBonus: 5,
  courseUnmetPenalty: 2.5,
  wideCourseMinBindings: 3,
  pathCoverageWeight: 3,
  pathPortraitWeight: 2,
  pathStyleWeight: 3,
  pathTimeWeight: 1,
  pathCoursePlacementWeight: 1,
};

export function resolveKnowledgePathPolicy(
  overrides: Partial<KnowledgePathPolicy> = {},
): KnowledgePathPolicy {
  return {
    ...DEFAULT_KNOWLEDGE_PATH_POLICY,
    heuristicTimeoutMs: readHeuristicTimeoutMs(),
    ...overrides,
  };
}

export const KNOWLEDGE_PATH_MAX_STEPS = DEFAULT_KNOWLEDGE_PATH_POLICY.maxSteps;
export const KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS = DEFAULT_KNOWLEDGE_PATH_POLICY.heuristicTimeoutMs;
export const KNOWLEDGE_MASTERY_SKIP_THRESHOLD = DEFAULT_KNOWLEDGE_PATH_POLICY.masterySkipThreshold;
export const KNOWLEDGE_MASTERY_MIN_CONFIDENCE = 0.6;
export const KNOWLEDGE_MASTERY_MIN_EVIDENCE_COUNT = 1;

export const STYLE_KIND_BONUS = DEFAULT_KNOWLEDGE_PATH_POLICY.styleKindBonus;
export const PREFERRED_TYPE_BONUS = DEFAULT_KNOWLEDGE_PATH_POLICY.preferredTypeBonus;
export const TIME_SLICE_BONUS = DEFAULT_KNOWLEDGE_PATH_POLICY.timeSliceBonus;
export const RHYTHM_BONUS = DEFAULT_KNOWLEDGE_PATH_POLICY.rhythmBonus;

export const COURSE_EARLY_RATIO = DEFAULT_KNOWLEDGE_PATH_POLICY.courseEarlyRatio;
export const COURSE_EARLY_PENALTY = DEFAULT_KNOWLEDGE_PATH_POLICY.courseEarlyPenalty;
export const COURSE_CAPSTONE_RATIO = DEFAULT_KNOWLEDGE_PATH_POLICY.courseCapstoneRatio;
export const COURSE_CAPSTONE_BONUS = DEFAULT_KNOWLEDGE_PATH_POLICY.courseCapstoneBonus;
export const COURSE_UNMET_PENALTY = DEFAULT_KNOWLEDGE_PATH_POLICY.courseUnmetPenalty;
export const WIDE_COURSE_MIN_BINDINGS = DEFAULT_KNOWLEDGE_PATH_POLICY.wideCourseMinBindings;

export const PATH_COVERAGE_WEIGHT = DEFAULT_KNOWLEDGE_PATH_POLICY.pathCoverageWeight;
export const PATH_PORTRAIT_WEIGHT = DEFAULT_KNOWLEDGE_PATH_POLICY.pathPortraitWeight;
export const PATH_STYLE_WEIGHT = DEFAULT_KNOWLEDGE_PATH_POLICY.pathStyleWeight;
export const PATH_TIME_WEIGHT = DEFAULT_KNOWLEDGE_PATH_POLICY.pathTimeWeight;
export const PATH_COURSE_PLACEMENT_WEIGHT = DEFAULT_KNOWLEDGE_PATH_POLICY.pathCoursePlacementWeight;
