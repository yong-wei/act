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
  getUNIT_1_2ManifestStepFromManifest,
  type UNIT_1_2StepDefinition,
} from '@/lib/unit-1-2-course';

type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void;
};
type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };

function requireUnit12Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) throw new Error('1-2 runtime manifest is required for page rendering.');
  return manifest;
}

export function UNIT_1_2StepContentPanel({
  step,
  manifest,
  revealProgress = 0,
  allowInlineReveal = false,
  onInlineReveal,
  onPanelSubmit,
}: {
  step: UNIT_1_2StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void;
}) {
  const activeManifest = requireUnit12Manifest(manifest);
  const stepManifest = getUNIT_1_2ManifestStepFromManifest(activeManifest, step.id);
  const contentRegistry = useMemo<InteractiveModuleRegistry<ContentRegistryExtra>>(
    () => createManifestContentModuleRegistry({
      revealProgress,
      allowInlineReveal,
      onInlineReveal,
      onPanelSubmit,
    }),
    [allowInlineReveal, onInlineReveal, onPanelSubmit, revealProgress],
  );

  return renderInteractiveManifestStep({
    manifest: activeManifest,
    step: stepManifest,
    moduleRegistry: contentRegistry,
    extra: { revealProgress, allowInlineReveal, onInlineReveal, onPanelSubmit },
  });
}

export function UNIT_1_2StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_1_2StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const activeManifest = requireUnit12Manifest(manifest);
  const stepManifest = getUNIT_1_2ManifestStepFromManifest(activeManifest, step.id);
  return renderStudentInteractiveActivity({
    registry: createManifestStudentActivityRegistry<UNIT_1_2StepDefinition>(),
    step,
    stepManifest,
    savedResponse,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onSubmit,
  });
}

export function UNIT_1_2TeacherActivitySummary({
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
  step: UNIT_1_2StepDefinition;
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
  const activeManifest = requireUnit12Manifest(manifest);
  const stepManifest = getUNIT_1_2ManifestStepFromManifest(activeManifest, step.id);
  return renderTeacherInteractiveActivity({
    registry: createManifestTeacherActivityRegistry<UNIT_1_2StepDefinition>(),
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
