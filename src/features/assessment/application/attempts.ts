import type { AdaptiveQuestionScope, AbilityReport, DiagnosticResult, PublicQuestion } from '../adaptive-engine';
import {
  projectStudentMicroTutoringEligibility,
  studentMicroTutoringCatalogReviewFromSnapshot,
  type StudentMicroTutoringEligibility,
} from '../student-micro-tutoring-eligibility';
import { resolvePathAssessmentIdentity } from '../path-assessment-identity';
import type { PathAssessmentIdentity } from '../path-assessment-identity';
import type { AssessmentRuntime } from '../ports';
import type { DurableSubmitAnswerResult } from '../adaptive-persistence';
import type { AdaptiveAttemptContext } from '../adaptive-attempt-context';

export interface SelectNextPathQuestionInput {
  actorUserId: string;
  sessionId?: string;
  goalId?: string | null;
  routeIntent?: string | null;
  pathId?: string | null;
  nodeId?: string | null;
  continuity?: unknown;
}

export interface SelectNextPathQuestionResult {
  question: PublicQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
  assessmentStage: AdaptiveQuestionScope;
}

export interface SubmitPathAnswerInput {
  actorUserId: string;
  sessionId?: string;
  questionId: string;
  selectedOption: string;
  timeSpent: number;
  goalId?: string | null;
  routeIntent?: string | null;
  pathId?: string | null;
  nodeId?: string | null;
  continuity?: unknown;
}

export interface SubmitPathAnswerResult extends DurableSubmitAnswerResult {
  microTutoring: StudentMicroTutoringEligibility;
}

function trimOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function assertCompanionSession(
  sessionId: string,
  continuity: { snapshotId: string } | undefined,
  pathIdentity: PathAssessmentIdentity | null,
) {
  if (sessionId.startsWith('konling-continuity:') && !continuity) {
    throw new Error('Companion-practice metadata is required for the reserved session.');
  }
  if (continuity && sessionId !== `konling-continuity:${continuity.snapshotId}`) {
    throw new Error('Companion-practice session does not match the continuity snapshot.');
  }
  if (continuity && pathIdentity) {
    throw new Error('Companion practice cannot use learning-path execution context.');
  }
}

export async function selectNextPathQuestion(
  runtime: AssessmentRuntime,
  input: SelectNextPathQuestionInput,
): Promise<SelectNextPathQuestionResult> {
  const sessionId = input.sessionId ?? `adaptive-${input.actorUserId}`;
  const continuity = await runtime.companion.verifyMetadata({
    userId: input.actorUserId,
    continuity: input.continuity,
  });
  const pathIdentity = await resolvePathAssessmentIdentity({
    port: runtime.pathIdentity,
    actorUserId: input.actorUserId,
    sessionId,
    pathId: input.pathId,
    nodeId: input.nodeId,
    routeIntent: input.routeIntent,
    clientGoalId: input.goalId,
    kind: 'question',
  });
  assertCompanionSession(sessionId, continuity, pathIdentity);
  const goalId = continuity?.targetKnowledgeId ?? pathIdentity?.goalId ?? trimOrNull(input.goalId);
  const questionScope: AdaptiveQuestionScope = continuity
    ? 'practice'
    : pathIdentity?.questionScope ?? 'practice';
  const result = await runtime.attempts.selectNextQuestion({
    userId: input.actorUserId,
    sessionId,
    goalId,
    questionScope,
    ...(continuity ? { continuity } : {}),
  });
  return {
    ...result,
    assessmentStage: questionScope,
  };
}

export async function submitPathAnswer(
  runtime: AssessmentRuntime,
  input: SubmitPathAnswerInput,
): Promise<SubmitPathAnswerResult> {
  const sessionId = input.sessionId ?? `adaptive-${input.actorUserId}`;
  const continuity = await runtime.companion.verifySubmissionMetadata({
    userId: input.actorUserId,
    sessionId,
    questionId: input.questionId,
    continuity: input.continuity,
  });
  if (sessionId.startsWith('konling-continuity:') && !continuity) {
    throw new Error('Companion-practice metadata is required for the reserved session.');
  }
  if (continuity && sessionId !== `konling-continuity:${continuity.snapshotId}`) {
    throw new Error('Companion-practice session does not match the continuity snapshot.');
  }
  const pathIdentity = await resolvePathAssessmentIdentity({
    port: runtime.pathIdentity,
    actorUserId: input.actorUserId,
    sessionId,
    pathId: input.pathId,
    nodeId: input.nodeId,
    routeIntent: input.routeIntent,
    clientGoalId: input.goalId,
    kind: 'answer',
  });
  if (continuity && pathIdentity) {
    throw new Error('Companion practice cannot use learning-path execution context.');
  }
  const result = await runtime.attempts.submitAnswer({
    userId: input.actorUserId,
    sessionId,
    questionId: input.questionId,
    selectedOption: input.selectedOption,
    timeSpent: input.timeSpent,
    continuity,
    pathContext: pathIdentity ?? undefined,
  });
  const catalogSnapshot = runtime.catalog.findSnapshot(input.questionId);
  const catalogReview = studentMicroTutoringCatalogReviewFromSnapshot(catalogSnapshot);
  return {
    ...result,
    microTutoring: projectStudentMicroTutoringEligibility({
      isCorrect: result.isCorrect,
      selectedOptionKey: input.selectedOption,
      correctOptionKey: result.correctOption,
      assessmentStage: pathIdentity?.questionScope ?? 'practice',
      catalogItemId: result.adaptiveAssessmentRef?.catalogItemId ?? catalogReview?.catalogItemId,
      contentHash: result.adaptiveAssessmentRef?.contentHash ?? catalogReview?.contentHash,
      catalogReview,
    }),
  };
}

export async function readAttemptContext(
  runtime: AssessmentRuntime,
  input: { authenticatedUserId: string; answerId: string },
): Promise<AdaptiveAttemptContext | null> {
  return runtime.attemptContext.readAttemptContext(input);
}

export async function readAbilityReport(
  runtime: AssessmentRuntime,
  userId: string,
): Promise<AbilityReport> {
  return runtime.attempts.readAbilityReport(userId);
}

export async function readDiagnostic(
  runtime: AssessmentRuntime,
  userId: string,
): Promise<DiagnosticResult> {
  return runtime.attempts.readDiagnostic(userId);
}
