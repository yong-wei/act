import type { AdaptiveAssessmentCatalogSnapshot } from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import type { CompanionPracticeMetadata } from './adaptive-engine';
import type {
  AbilityReport,
  AdaptiveQuestionScope,
  DiagnosticResult,
  PublicQuestion,
} from './adaptive-engine';
import type { DurableSubmitAnswerResult } from './adaptive-persistence';
import type { PathIdentityPort } from './path-assessment-identity';
import type { AdaptiveAttemptContext } from './adaptive-attempt-context';

export interface AssessmentCatalogReadPort {
  findSnapshot(questionId: string): AdaptiveAssessmentCatalogSnapshot | null;
}

export interface AssessmentAttemptRepository {
  selectNextQuestion(params: {
    userId: string;
    sessionId: string;
    goalId?: string | null;
    questionScope?: AdaptiveQuestionScope;
    continuity?: CompanionPracticeMetadata;
  }): Promise<{
    question: PublicQuestion;
    estimatedAbility: number;
    confidenceInterval: [number, number];
  }>;
  submitAnswer(params: {
    userId: string;
    sessionId: string;
    questionId: string;
    selectedOption: string;
    timeSpent: number;
    continuity?: CompanionPracticeMetadata;
    pathContext?: {
      pathId: string;
      nodeId: string;
      goalId?: string | null;
      routeIntent?: string | null;
      questionScope?: AdaptiveQuestionScope;
    };
  }): Promise<DurableSubmitAnswerResult>;
  readAbilityReport(userId: string): Promise<AbilityReport>;
  readDiagnostic(userId: string): Promise<DiagnosticResult>;
}

export interface AssessmentAttemptContextPort {
  readAttemptContext(input: {
    authenticatedUserId: string;
    answerId: string;
  }): Promise<AdaptiveAttemptContext | null>;
}

export interface CompanionPracticePort {
  verifyMetadata(input: { userId: string; continuity: unknown }): Promise<CompanionPracticeMetadata | undefined>;
  verifySubmissionMetadata(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    continuity: unknown;
  }): Promise<CompanionPracticeMetadata | undefined>;
}

export interface AssessmentRuntime {
  pathIdentity: PathIdentityPort;
  catalog: AssessmentCatalogReadPort;
  attempts: AssessmentAttemptRepository;
  attemptContext: AssessmentAttemptContextPort;
  companion: CompanionPracticePort;
}
