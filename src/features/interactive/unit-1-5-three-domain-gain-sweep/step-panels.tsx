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
import type { ManifestResponseHistoryEntry } from '@/features/interactive/shared/manifest-runtime/response-prefill';
import {
  renderInteractiveManifestStep,
  type InteractiveModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_1_5ManifestStepFromManifest,
  type UNIT_1_5StepDefinition,
} from '@/lib/unit-1-5-course';

type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  revealLocked?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void | Promise<void>;
  analyticsSummary?: string[];
};
type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };

function requireUnit15Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) throw new Error('1-5 runtime manifest is required for page rendering.');
  return manifest;
}

export function UNIT_1_5StepContentPanel({
  step,
  manifest,
  revealProgress = 0,
  allowInlineReveal = false,
  revealLocked = false,
  onInlineReveal,
  onPanelSubmit,
  analyticsSummary,
}: {
  step: UNIT_1_5StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  revealProgress?: number;
  allowInlineReveal?: boolean;
  revealLocked?: boolean;
  onInlineReveal?: () => void;
  onPanelSubmit?: (response: ManifestStepResponse) => void | Promise<void>;
  analyticsSummary?: string[];
}) {
  const activeManifest = requireUnit15Manifest(manifest);
  const stepManifest = getUNIT_1_5ManifestStepFromManifest(activeManifest, step.id);
  const contentRegistry = useMemo<InteractiveModuleRegistry<ContentRegistryExtra>>(
    () => createManifestContentModuleRegistry({
      revealProgress,
      allowInlineReveal,
      revealLocked,
      onInlineReveal,
      onPanelSubmit,
      analyticsSummary,
    }),
    [allowInlineReveal, analyticsSummary, onInlineReveal, onPanelSubmit, revealLocked, revealProgress],
  );

  return renderInteractiveManifestStep({
    manifest: activeManifest,
    step: stepManifest,
    moduleRegistry: contentRegistry,
    extra: { revealProgress, allowInlineReveal, revealLocked, onInlineReveal, onPanelSubmit, analyticsSummary },
  });
}

export function UNIT_1_5StudentActivityForm({
  step,
  manifest,
  savedResponse,
  responseHistory,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
  readOnly = false,
}: {
  step: UNIT_1_5StepDefinition;
  manifest: InteractiveRuntimeManifest | null | undefined;
  savedResponse?: ManifestStepResponse;
  responseHistory?: Record<string, ManifestResponseHistoryEntry>;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
  readOnly?: boolean;
}) {
  const activeManifest = requireUnit15Manifest(manifest);
  const stepManifest = getUNIT_1_5ManifestStepFromManifest(activeManifest, step.id);
  return renderStudentInteractiveActivity({
    registry: createManifestStudentActivityRegistry<UNIT_1_5StepDefinition>(),
    step,
    stepManifest,
    savedResponse,
    responseHistory,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onSubmit,
    readOnly,
  });
}

export function UNIT_1_5TeacherActivitySummary({
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
  step: UNIT_1_5StepDefinition;
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
  const activeManifest = requireUnit15Manifest(manifest);
  const stepManifest = getUNIT_1_5ManifestStepFromManifest(activeManifest, step.id);
  return renderTeacherInteractiveActivity({
    registry: createManifestTeacherActivityRegistry<UNIT_1_5StepDefinition>(),
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
