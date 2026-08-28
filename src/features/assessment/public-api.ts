import { createPrismaAssessmentRuntime } from './adapters/prisma-runtime';
import {
  readAbilityReport as readAbilityReportUseCase,
  readAttemptContext as readAttemptContextUseCase,
  readDiagnostic as readDiagnosticUseCase,
  selectNextPathQuestion as selectNextPathQuestionUseCase,
  submitPathAnswer as submitPathAnswerUseCase,
} from './application/attempts';
import type {
  SelectNextPathQuestionInput,
  SelectNextPathQuestionResult,
  SubmitPathAnswerInput,
  SubmitPathAnswerResult,
} from './application/attempts';
import type { AbilityReport, DiagnosticResult } from './adaptive-engine';
import type { AdaptiveAttemptContext } from './adaptive-attempt-context';

export type {
  SelectNextPathQuestionInput,
  SelectNextPathQuestionResult,
  SubmitPathAnswerInput,
  SubmitPathAnswerResult,
};

function runtime() {
  return createPrismaAssessmentRuntime();
}

export async function selectNextPathQuestion(
  input: SelectNextPathQuestionInput,
): Promise<SelectNextPathQuestionResult> {
  return selectNextPathQuestionUseCase(runtime(), input);
}

export async function submitPathAnswer(
  input: SubmitPathAnswerInput,
): Promise<SubmitPathAnswerResult> {
  return submitPathAnswerUseCase(runtime(), input);
}

export async function readAttemptContext(input: {
  authenticatedUserId: string;
  answerId: string;
}): Promise<AdaptiveAttemptContext | null> {
  return readAttemptContextUseCase(runtime(), input);
}

export async function readAbilityReport(userId: string): Promise<AbilityReport> {
  return readAbilityReportUseCase(runtime(), userId);
}

export async function readDiagnostic(userId: string): Promise<DiagnosticResult> {
  return readDiagnosticUseCase(runtime(), userId);
}
