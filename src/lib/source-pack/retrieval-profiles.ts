import type {
  SourcePackAccessVisibility,
  SourcePackProfile,
  SourcePackSourceKind,
  SourcePackModality,
} from './types';

export type SourcePackRetrievalProfileName = SourcePackProfile;
export type SourcePackCallerRole = 'student' | 'teacher' | 'admin' | 'service';

export interface SourcePackRetrievalBudgets {
  maxItems: number;
  maxExcerptChars: number;
  maxPerSourceKind: number;
  maxPerModality: number;
  maxPerResource: number;
  maxPerCitationTarget: number;
}

export interface SourcePackRankingWeights {
  exact: number;
  lexical: number;
  graph: number;
  authority: number;
  freshness: number;
  learnerContext: number;
  eligibility: number;
  semantic: number;
}

export interface SourcePackRetrievalProfile {
  name: SourcePackRetrievalProfileName;
  description: string;
  defaultRole: SourcePackCallerRole;
  allowedVisibility: readonly SourcePackAccessVisibility[];
  allowedSourceKinds: readonly SourcePackSourceKind[];
  allowedReviewStatuses?: readonly string[];
  requireAiUseAllowed: boolean;
  requireCitationReady: boolean;
  rejectAnswerLeakage: boolean;
  budgets: SourcePackRetrievalBudgets;
  modalityCoverage?: readonly SourcePackModality[];
  rankingWeights: SourcePackRankingWeights;
}

const AUTHORING_SOURCE_KINDS: SourcePackSourceKind[] = [
  'textbook',
  'reference',
  'runtime-lesson',
  'knowledge-card',
  'exercise',
  'simulation',
  'other',
];

const STUDENT_CITATION_SOURCE_KINDS: SourcePackSourceKind[] = [
  'textbook',
  'reference',
  'runtime-lesson',
  'knowledge-card',
  'simulation',
];

const REVIEWED_STATUSES = [
  'human-confirmed',
  'teacher-approved',
  'verified',
  'canonical',
  'teacher-authored',
  'approved',
  'current',
  'unknown',
];

const handoutAuthoring: SourcePackRetrievalProfile = {
  name: 'handout-authoring',
  description: 'Broad authoring retrieval for handouts and reviewed course evidence.',
  defaultRole: 'teacher',
  allowedVisibility: ['public', 'student', 'teacher'],
  allowedSourceKinds: AUTHORING_SOURCE_KINDS,
  allowedReviewStatuses: REVIEWED_STATUSES,
  requireAiUseAllowed: true,
  requireCitationReady: false,
  rejectAnswerLeakage: false,
  budgets: { maxItems: 8, maxExcerptChars: 360, maxPerSourceKind: 3, maxPerModality: 4, maxPerResource: 2, maxPerCitationTarget: 2 },
  modalityCoverage: ['text', 'image', 'interactive'],
  rankingWeights: { exact: 0.24, lexical: 0.18, graph: 0.2, authority: 0.16, freshness: 0.08, learnerContext: 0.04, eligibility: 0.06, semantic: 0.04 },
};

const assessmentItem: SourcePackRetrievalProfile = {
  name: 'assessment-item',
  description: 'Reviewed assessment-authoring retrieval without answer leakage.',
  defaultRole: 'teacher',
  allowedVisibility: ['public', 'student', 'teacher'],
  allowedSourceKinds: ['textbook', 'reference', 'runtime-lesson', 'knowledge-card', 'exercise'],
  allowedReviewStatuses: REVIEWED_STATUSES,
  requireAiUseAllowed: true,
  requireCitationReady: false,
  rejectAnswerLeakage: true,
  budgets: { maxItems: 6, maxExcerptChars: 260, maxPerSourceKind: 3, maxPerModality: 3, maxPerResource: 2, maxPerCitationTarget: 1 },
  modalityCoverage: ['text', 'interactive'],
  rankingWeights: { exact: 0.26, lexical: 0.2, graph: 0.18, authority: 0.18, freshness: 0.06, learnerContext: 0.02, eligibility: 0.06, semantic: 0.04 },
};

const konlingAnswer: SourcePackRetrievalProfile = {
  name: 'konling-answer',
  description: 'Concise role-authorized answer grounding with citation-ready evidence.',
  defaultRole: 'student',
  allowedVisibility: ['public', 'student', 'teacher'],
  allowedSourceKinds: STUDENT_CITATION_SOURCE_KINDS,
  allowedReviewStatuses: REVIEWED_STATUSES,
  requireAiUseAllowed: true,
  requireCitationReady: true,
  rejectAnswerLeakage: true,
  budgets: { maxItems: 4, maxExcerptChars: 220, maxPerSourceKind: 2, maxPerModality: 2, maxPerResource: 1, maxPerCitationTarget: 1 },
  modalityCoverage: ['text'],
  rankingWeights: { exact: 0.24, lexical: 0.22, graph: 0.18, authority: 0.16, freshness: 0.06, learnerContext: 0.06, eligibility: 0.04, semantic: 0.04 },
};

const pathPlanning: SourcePackRetrievalProfile = {
  name: 'path-planning',
  description: 'Goal-aligned resource retrieval that preserves path eligibility boundaries.',
  defaultRole: 'teacher',
  allowedVisibility: ['public', 'student', 'teacher'],
  allowedSourceKinds: ['runtime-lesson', 'knowledge-card', 'simulation', 'exercise', 'textbook'],
  allowedReviewStatuses: REVIEWED_STATUSES,
  requireAiUseAllowed: true,
  requireCitationReady: false,
  rejectAnswerLeakage: true,
  budgets: { maxItems: 7, maxExcerptChars: 300, maxPerSourceKind: 3, maxPerModality: 3, maxPerResource: 2, maxPerCitationTarget: 2 },
  modalityCoverage: ['interactive', 'text'],
  rankingWeights: { exact: 0.16, lexical: 0.14, graph: 0.28, authority: 0.1, freshness: 0.06, learnerContext: 0.08, eligibility: 0.14, semantic: 0.04 },
};

const lessonDesign: SourcePackRetrievalProfile = {
  name: 'lesson-design',
  description: 'Teacher lesson design retrieval with broader evidence coverage than answer grounding.',
  defaultRole: 'teacher',
  allowedVisibility: ['public', 'student', 'teacher'],
  allowedSourceKinds: AUTHORING_SOURCE_KINDS,
  allowedReviewStatuses: REVIEWED_STATUSES,
  requireAiUseAllowed: true,
  requireCitationReady: false,
  rejectAnswerLeakage: false,
  budgets: { maxItems: 8, maxExcerptChars: 340, maxPerSourceKind: 3, maxPerModality: 4, maxPerResource: 2, maxPerCitationTarget: 2 },
  modalityCoverage: ['text', 'image', 'interactive'],
  rankingWeights: { exact: 0.22, lexical: 0.18, graph: 0.22, authority: 0.14, freshness: 0.06, learnerContext: 0.04, eligibility: 0.1, semantic: 0.04 },
};

const profiles: Record<SourcePackRetrievalProfileName, SourcePackRetrievalProfile> = {
  'handout-authoring': handoutAuthoring,
  'assessment-item': assessmentItem,
  'konling-answer': konlingAnswer,
  'path-planning': pathPlanning,
  'lesson-design': lessonDesign,
  'lesson-authoring': { ...lessonDesign, name: 'lesson-authoring' },
  'homework-authoring': { ...assessmentItem, name: 'homework-authoring' },
  konling: { ...konlingAnswer, name: 'konling' },
  generic: {
    ...lessonDesign,
    name: 'generic',
    description: 'Conservative generic retrieval profile for callers that have not selected a specialized policy.',
  },
};

export function getSourcePackRetrievalProfile(profile: SourcePackRetrievalProfileName): SourcePackRetrievalProfile {
  return profiles[profile];
}

export function listSourcePackRetrievalProfiles(): SourcePackRetrievalProfile[] {
  return Object.values(profiles);
}
