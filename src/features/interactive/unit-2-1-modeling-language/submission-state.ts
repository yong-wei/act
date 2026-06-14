import type {
  UNIT_2_1StepResponse,
  UNIT_2_1StudentCourseState,
} from '@/lib/unit-2-1-course';

export interface UNIT_2_1ManifestSubmissionInput {
  response: UNIT_2_1StepResponse;
  isResubmit: boolean;
  dataOverrides: {
    stepId: string;
    summary: Record<string, unknown> | null;
  };
}

export function createUNIT_2_1ManifestSubmissionInput({
  stepId,
  response,
  savedResponse,
}: {
  stepId: string;
  response: UNIT_2_1StepResponse;
  savedResponse?: UNIT_2_1StepResponse;
}): UNIT_2_1ManifestSubmissionInput {
  return {
    response,
    isResubmit: Boolean(savedResponse),
    dataOverrides: {
      stepId,
      summary: response.summary ?? null,
    },
  };
}

function applyUNIT_2_1StudentSubmission({
  previousState,
  currentStudentName,
  stepId,
  response,
  now = Date.now(),
}: {
  previousState: UNIT_2_1StudentCourseState;
  currentStudentName: string;
  stepId: string;
  response: UNIT_2_1StepResponse;
  now?: number;
}): UNIT_2_1StudentCourseState {
  return {
    ...previousState,
    studentName: currentStudentName,
    updatedAt: now,
    responses: {
      ...previousState.responses,
      [stepId]: response,
    },
  };
}

export function commitUNIT_2_1StudentSubmission({
  previousState,
  currentStudentName,
  stepId,
  response,
  savedResponse,
  submitManifestResponse,
  now,
}: {
  previousState: UNIT_2_1StudentCourseState;
  currentStudentName: string;
  stepId: string;
  response: UNIT_2_1StepResponse;
  savedResponse?: UNIT_2_1StepResponse;
  submitManifestResponse: (input: UNIT_2_1ManifestSubmissionInput) => void;
  now?: number;
}): UNIT_2_1StudentCourseState {
  const manifestInput = createUNIT_2_1ManifestSubmissionInput({ stepId, response, savedResponse });
  const nextState = applyUNIT_2_1StudentSubmission({
    previousState,
    currentStudentName,
    stepId,
    response,
    now,
  });

  submitManifestResponse(manifestInput);
  return nextState;
}
