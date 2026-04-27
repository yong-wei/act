'use client';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  getUNIT_4_7ManifestStep,
  UNIT_4_7_RUNTIME_MANIFEST,
  type UNIT_4_7StepDefinition,
} from '@/lib/unit-4-7-course';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };

export function UNIT_4_7StepContentPanel({
  step,
  revealProgress,
  allowInlineReveal,
}: {
  step: UNIT_4_7StepDefinition;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const stepManifest = getUNIT_4_7ManifestStep(step.id);
  const moduleRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
  });

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: UNIT_4_7_RUNTIME_MANIFEST,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal },
      })}
    </section>
  );
}

export function UNIT_4_7StudentActivityForm({
  step,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_4_7StepDefinition;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const stepManifest = getUNIT_4_7ManifestStep(step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: createManifestStudentActivityRegistry<UNIT_4_7StepDefinition>(),
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

export function UNIT_4_7TeacherActivitySummary({
  step,
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
  step: UNIT_4_7StepDefinition;
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
  const stepManifest = getUNIT_4_7ManifestStep(step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: createManifestTeacherActivityRegistry<UNIT_4_7StepDefinition>(),
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
