'use client';

import { useMemo } from 'react';

import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_1_4ManifestStepFromManifest,
  type UNIT_1_4StepDefinition,
} from '@/lib/unit-1-4-course';

type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  revealLocked?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void | Promise<void>;
  showFrequencyReadings?: boolean;
};
type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };

function hasComputeOwnedInteractiveFigureResponse(
  stepManifest: ReturnType<typeof getUNIT_1_4ManifestStepFromManifest>,
) {
  const hasComputeResponseContract = stepManifest.modules.some((module) =>
    module.kind === 'compute.panel'
    && typeof module.payload.responseContractId === 'string'
    && module.payload.responseContractId.trim().length > 0);
  const hasSeparateActivitySurface = stepManifest.modules.some((module) =>
    module.kind === 'activity.panel' || module.kind === 'activity.workspace');
  return stepManifest.interactionSpec.interactionKind === 'interactive_figure_submit'
    && hasComputeResponseContract
    && !hasSeparateActivitySurface;
}

function requireUnit14Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) throw new Error('1-4 runtime manifest is required for page rendering.');
  return manifest;
}

export function UNIT_1_4StepContentPanel({
  step,
  manifest,
  revealProgress = 0,
  allowInlineReveal = false,
  revealLocked = false,
  onInlineReveal,
  onPanelSubmit,
  showFrequencyReadings = true,
}: {
  step: UNIT_1_4StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  revealLocked?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void | Promise<void>;
  showFrequencyReadings?: boolean;
}) {
  const activeManifest = requireUnit14Manifest(manifest);
  const stepManifest = getUNIT_1_4ManifestStepFromManifest(activeManifest, step.id);
  const contentRegistry = useMemo<InteractiveModuleRegistry<ContentRegistryExtra>>(
    () => createManifestContentModuleRegistry({
      revealProgress,
      allowInlineReveal,
      revealLocked,
      onInlineReveal,
      onPanelSubmit,
      showFrequencyReadings,
    }),
    [allowInlineReveal, onInlineReveal, onPanelSubmit, revealLocked, revealProgress, showFrequencyReadings],
  );

  return renderInteractiveManifestStep({
    manifest: activeManifest,
    step: stepManifest,
    moduleRegistry: contentRegistry,
    extra: { revealProgress, allowInlineReveal, revealLocked, onInlineReveal, onPanelSubmit, showFrequencyReadings },
  });
}

export function UNIT_1_4StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  readOnly = false,
}: {
  step: UNIT_1_4StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const activeManifest = requireUnit14Manifest(manifest);
  const stepManifest = getUNIT_1_4ManifestStepFromManifest(activeManifest, step.id);
  if (hasComputeOwnedInteractiveFigureResponse(stepManifest)) return null;
  return renderStudentInteractiveActivity({
    registry: createManifestStudentActivityRegistry<UNIT_1_4StepDefinition>(),
    step,
    stepManifest,
    savedResponse,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onSubmit,
    readOnly,
  });
}

export function UNIT_1_4TeacherActivitySummary({
  step,
  manifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  step: UNIT_1_4StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  responses: TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const activeManifest = requireUnit14Manifest(manifest);
  const stepManifest = getUNIT_1_4ManifestStepFromManifest(activeManifest, step.id);
  return renderTeacherInteractiveActivity({
    registry: createManifestTeacherActivityRegistry<UNIT_1_4StepDefinition>(),
    step,
    stepManifest,
    responses,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onToggleRelease,
    onToggleBrowse,
    onToggleAnswerVisible,
    onAdvanceReveal,
    onResetReveal,
  });
}
