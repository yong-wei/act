'use client';

import { useCallback } from 'react';

import { COURSE_EVENT_TYPES, type CourseEventType } from '@/lib/classroom-analytics/event-taxonomy';
import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import { buildManifestSubmissionTelemetry } from './submission-telemetry';

interface ManifestSubmissionResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

interface ManifestSubmissionControllerInput {
  trackCourseEvent: (
    eventType: CourseEventType,
    payload: {
      stepId: string;
      attemptKey: string;
      clientEventAt: number;
      data: Record<string, unknown>;
    },
  ) => void;
}

interface SubmitManifestStepResponseInput {
  stepId: string;
  isResubmit: boolean;
  response: ManifestSubmissionResponse;
  stepManifest: InteractiveRuntimeStepManifest | null | undefined;
  extraEvidence?: Record<string, unknown>;
  dataOverrides?: Record<string, unknown>;
}

export function findManifestStepForSubmission(
  manifest: InteractiveRuntimeManifest | null | undefined,
  stepId: string,
) {
  return manifest?.steps.find((step) => step.id === stepId);
}

export function normalizeManifestSubmissionAnswers(
  answers: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [
      key,
      value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  );
}

export function buildManifestSubmissionEventPayload({
  stepId,
  response,
  stepManifest,
  submittedAt,
  attemptKey,
  extraEvidence,
  dataOverrides,
}: {
  stepId: string;
  response: ManifestSubmissionResponse;
  stepManifest: InteractiveRuntimeStepManifest | null | undefined;
  submittedAt: number;
  attemptKey: string;
  extraEvidence?: Record<string, unknown>;
  dataOverrides?: Record<string, unknown>;
}) {
  return {
    stepId,
    attemptKey,
    clientEventAt: submittedAt,
    data: {
      ...buildManifestSubmissionTelemetry(
        {
          ...response,
          stepId,
          submittedAt,
        },
        stepManifest,
        { extraEvidence },
      ),
      ...(dataOverrides ?? {}),
    },
  };
}

export function useManifestSubmissionController({ trackCourseEvent }: ManifestSubmissionControllerInput) {
  const submitManifestStepResponse = useCallback(
    ({ stepId, isResubmit, response, stepManifest, extraEvidence, dataOverrides }: SubmitManifestStepResponseInput) => {
      const submittedAt = Date.now();
      const attemptKey = `${stepId}:response:${submittedAt}`;
      trackCourseEvent(
        isResubmit ? COURSE_EVENT_TYPES.LESSON_RESUBMIT : COURSE_EVENT_TYPES.LESSON_SUBMIT,
        buildManifestSubmissionEventPayload({
          stepId,
          response,
          stepManifest,
          submittedAt,
          attemptKey,
          extraEvidence,
          dataOverrides,
        }),
      );
      return submittedAt;
    },
    [trackCourseEvent],
  );

  return { submitManifestStepResponse };
}
