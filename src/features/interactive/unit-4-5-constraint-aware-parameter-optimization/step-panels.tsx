'use client';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type StudentInteractiveActivityRegistry,
  type TeacherInteractiveActivityRegistry,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  renderInteractiveManifestStep,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_4_5ManifestStepFromManifest,
  UNIT_4_5_RUNTIME_MANIFEST,
  type UNIT_4_5StepDefinition,
  type UNIT_4_5StepResponse,
} from '@/lib/unit-4-5-course';

type TeacherResponseItem = { studentName: string; response: UNIT_4_5StepResponse };

const UNIT_4_5_SHARED_STUDENT_ACTIVITY_REGISTRY = createManifestStudentActivityRegistry<UNIT_4_5StepDefinition>() as unknown as StudentInteractiveActivityRegistry<
  UNIT_4_5StepDefinition,
  UNIT_4_5StepResponse
>;

const UNIT_4_5_SHARED_TEACHER_ACTIVITY_REGISTRY = createManifestTeacherActivityRegistry<UNIT_4_5StepDefinition>() as unknown as TeacherInteractiveActivityRegistry<
  UNIT_4_5StepDefinition,
  TeacherResponseItem
>;

export function UNIT_4_5StepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
}: {
  step: UNIT_4_5StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const activeManifest = manifest ?? UNIT_4_5_RUNTIME_MANIFEST;
  const stepManifest = getUNIT_4_5ManifestStepFromManifest(activeManifest, step.id);
  const moduleRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
  });

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: activeManifest,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal },
      })}
    </section>
  );
}

export function UNIT_4_5StudentActivityForm({
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
  step: UNIT_4_5StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: UNIT_4_5StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_5StepResponse) => void;
  readOnly?: boolean;
}) {

  const stepManifest = getUNIT_4_5ManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: UNIT_4_5_SHARED_STUDENT_ACTIVITY_REGISTRY,
        step,
        stepManifest,
        savedResponse,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        readOnly,
        onSubmit,
      })}
    </>
  );
}

export function UNIT_4_5TeacherActivitySummary({
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
  step: UNIT_4_5StepDefinition;
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
  const stepManifest = getUNIT_4_5ManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: UNIT_4_5_SHARED_TEACHER_ACTIVITY_REGISTRY,
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
