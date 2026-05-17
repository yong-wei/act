import { buildControllerArtifactFromParams } from '@/features/arena/submissions/controller-artifact-builder';
import type { ChallengeTask, ControllerArtifact } from '@/features/arena/types';

export interface CompositeControlDraft {
  prefilterGain: string;
  forwardGain: string;
  localFeedbackGain: string;
  disturbanceCompensation: string;
  controlLimit: string;
}

export const DEFAULT_COMPOSITE_CONTROL_DRAFT: CompositeControlDraft = {
  prefilterGain: '0.90',
  forwardGain: '2.20',
  localFeedbackGain: '0.70',
  disturbanceCompensation: '0.40',
  controlLimit: '4.50',
};

export function compositeControlDraftToValues(draft: CompositeControlDraft): Record<string, string> {
  return {
    prefilterGain: draft.prefilterGain,
    forwardGain: draft.forwardGain,
    localFeedbackGain: draft.localFeedbackGain,
    disturbanceCompensation: draft.disturbanceCompensation,
    controlLimit: draft.controlLimit,
  };
}

export function buildCompositeCompensationArtifactFromDraft({
  task,
  draft,
  now,
}: {
  task: ChallengeTask;
  draft: CompositeControlDraft;
  now?: string;
}): ControllerArtifact {
  return buildControllerArtifactFromParams({
    task,
    method: 'composite-compensation',
    values: compositeControlDraftToValues(draft),
    now,
  });
}
