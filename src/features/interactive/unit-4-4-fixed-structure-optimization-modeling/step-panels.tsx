'use client';

import { useState } from 'react';

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
  type InteractiveModuleRegistry,
  renderInteractiveManifestStep,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  getUNIT_4_4ManifestStepFromManifest,
  UNIT_4_4_RUNTIME_MANIFEST,
  type UNIT_4_4StepDefinition,
  type UNIT_4_4StepResponse,
} from '@/lib/unit-4-4-course';
import {
  UNIT_4_4_PARETO_DEFAULT_POINT_ID,
} from './figure-data';
import {
  GradientDescentNativeFigure,
  ParetoFrontNativeFigure,
  ParetoPointStatsPanel,
} from './native-figures';

type TeacherResponseItem = { studentName: string; response: UNIT_4_4StepResponse };

const UNIT_4_4_SHARED_STUDENT_ACTIVITY_REGISTRY = createManifestStudentActivityRegistry<UNIT_4_4StepDefinition>() as unknown as StudentInteractiveActivityRegistry<
  UNIT_4_4StepDefinition,
  UNIT_4_4StepResponse
>;

const UNIT_4_4_SHARED_TEACHER_ACTIVITY_REGISTRY = createManifestTeacherActivityRegistry<UNIT_4_4StepDefinition>() as unknown as TeacherInteractiveActivityRegistry<
  UNIT_4_4StepDefinition,
  TeacherResponseItem
>;

export function UNIT_4_4StepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
}: {
  step: UNIT_4_4StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress: number;
  allowInlineReveal: boolean;
}) {
  const activeManifest = manifest ?? UNIT_4_4_RUNTIME_MANIFEST;
  const stepManifest = getUNIT_4_4ManifestStepFromManifest(activeManifest, step.id);
  const [selectedParetoPointId, setSelectedParetoPointId] = useState(UNIT_4_4_PARETO_DEFAULT_POINT_ID);
  const sharedRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
  });
  const moduleExtra = { revealProgress, allowInlineReveal };
  const moduleLegacyKind = (module: { payload: Record<string, unknown> }) =>
    typeof module.payload.legacyKind === 'string' ? module.payload.legacyKind : '';
  const renderNativeFigure: InteractiveModuleRegistry<typeof moduleExtra>[string] = ({ step: manifestStep, module }) => {
    const block = manifestStep.contentBlocks[module.id.replace(/-/g, '_')];
    const source = block && typeof block === 'object' && !Array.isArray(block)
      ? (block as Record<string, unknown>).source
      : undefined;

    if (source === 'native_gradient_descent_figure') {
      const visiblePointCount = Math.max(1, Math.min(5, revealProgress + 1));
      return (
        <GradientDescentNativeFigure
          visiblePointCount={visiblePointCount}
          visibleSegmentCount={Math.max(0, visiblePointCount - 1)}
          activePointIndex={visiblePointCount - 1}
        />
      );
    }

    if (source === 'native_pareto_front_figure') {
      return (
        <ParetoFrontNativeFigure
          selectedPointId={selectedParetoPointId}
          onSelectPoint={setSelectedParetoPointId}
        />
      );
    }

    return sharedRegistry['native-figure']?.({ manifest: activeManifest, step: manifestStep, module, extra: moduleExtra }) ?? null;
  };
  const renderStatPanel: InteractiveModuleRegistry<typeof moduleExtra>[string] = ({ step: manifestStep, module }) => {
    if (manifestStep.id === 'step-10' && module.id === 'pareto-reading') {
      return <ParetoPointStatsPanel pointId={selectedParetoPointId} />;
    }

    return sharedRegistry['stat-panel']?.({ manifest: activeManifest, step: manifestStep, module, extra: moduleExtra }) ?? null;
  };
  const moduleRegistry: InteractiveModuleRegistry<{ revealProgress: number; allowInlineReveal: boolean }> = {
    ...sharedRegistry,
    'content.figure': (props) => {
      if (moduleLegacyKind(props.module) === 'native-figure') {
        return renderNativeFigure(props);
      }
      return sharedRegistry['content.figure']?.(props) ?? null;
    },
    'content.formula': (props) => {
      if (moduleLegacyKind(props.module) === 'equation-card-row') {
        return sharedRegistry['equation-card-row']?.(props) ?? null;
      }
      return sharedRegistry['content.formula']?.(props) ?? null;
    },
    'analytics.summary': (props) => {
      if (moduleLegacyKind(props.module) === 'stat-panel') {
        return renderStatPanel(props);
      }
      return sharedRegistry['analytics.summary']?.(props) ?? null;
    },
  };

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: activeManifest,
        step: stepManifest,
        moduleRegistry,
        extra: moduleExtra,
      })}
    </section>
  );
}

export function UNIT_4_4StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_4_4StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: UNIT_4_4StepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: UNIT_4_4StepResponse) => void;
}) {
  const stepManifest = getUNIT_4_4ManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: UNIT_4_4_SHARED_STUDENT_ACTIVITY_REGISTRY,
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

export function UNIT_4_4TeacherActivitySummary({
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
  step: UNIT_4_4StepDefinition;
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
  const stepManifest = getUNIT_4_4ManifestStepFromManifest(manifest, step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: UNIT_4_4_SHARED_TEACHER_ACTIVITY_REGISTRY,
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
