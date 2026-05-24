'use client';

import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getCruiseManifestStepFromManifest,
  type CruiseStandardLessonStep,
} from '@/lib/cruise-course';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };

export function CruiseStepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
}: {
  step: CruiseStandardLessonStep;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  if (!manifest) {
    throw new Error('Cruise comfort runtime manifest is required for page rendering.');
  }
  const stepManifest = getCruiseManifestStepFromManifest(manifest, step.id);
  const moduleRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
  });

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal },
      })}
    </section>
  );
}

export function CruiseStudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: CruiseStandardLessonStep;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  if (!manifest) {
    throw new Error('Cruise comfort runtime manifest is required for student activity rendering.');
  }
  const stepManifest = getCruiseManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: createManifestStudentActivityRegistry<CruiseStandardLessonStep>(),
        step,
        stepManifest,
        savedResponse,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onSubmit,
      })}
    </>
  );
}

export function CruiseTeacherActivitySummary({
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
  step: CruiseStandardLessonStep;
  manifest?: InteractiveRuntimeManifest | null;
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
  if (!manifest) {
    throw new Error('Cruise comfort runtime manifest is required for teacher activity rendering.');
  }
  const stepManifest = getCruiseManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: createManifestTeacherActivityRegistry<CruiseStandardLessonStep>(),
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
      })}
    </>
  );
}
