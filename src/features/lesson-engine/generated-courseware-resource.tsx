'use client';

import { useMemo, useState } from 'react';
import type { Prisma } from '@prisma/client';

import {
  createManifestStudentActivityRegistry,
  renderStudentInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import type { WidgetResult, WidgetState } from '@/resources/widgets/widget-props';

export const GENERATED_COURSEWARE_RESOURCE_KIND = 'generated-courseware-student-runtime-v1' as const;

export type GeneratedCoursewareResourceConfig = {
  kind: typeof GENERATED_COURSEWARE_RESOURCE_KIND;
  publicationRevisionId: string;
  manifestHash: string;
  stepId: string;
  runtimeManifest: InteractiveRuntimeManifest;
};

export function resolveGeneratedCoursewareResourceConfig(
  value: Prisma.JsonValue | null | undefined,
): GeneratedCoursewareResourceConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  if (config.kind !== GENERATED_COURSEWARE_RESOURCE_KIND
    || typeof config.publicationRevisionId !== 'string'
    || typeof config.manifestHash !== 'string'
    || typeof config.stepId !== 'string'
    || !config.runtimeManifest
    || typeof config.runtimeManifest !== 'object'
    || Array.isArray(config.runtimeManifest)) return null;
  const runtimeManifest = config.runtimeManifest as unknown as InteractiveRuntimeManifest;
  if (!Array.isArray(runtimeManifest.steps)
    || !runtimeManifest.steps.some((step) => step.id === config.stepId)) return null;
  return {
    kind: GENERATED_COURSEWARE_RESOURCE_KIND,
    publicationRevisionId: config.publicationRevisionId,
    manifestHash: config.manifestHash,
    stepId: config.stepId,
    runtimeManifest,
  };
}

export function GeneratedCoursewareResource({
  config,
  onComplete,
  onStateChange,
}: {
  config: GeneratedCoursewareResourceConfig;
  onComplete?: (result?: WidgetResult) => void;
  onStateChange?: (state: WidgetState) => void;
}) {
  const step = config.runtimeManifest.steps.find((candidate) => candidate.id === config.stepId);
  const [response, setResponse] = useState<ManifestStepResponse>();
  const moduleRegistry = useMemo(
    () => createManifestContentModuleRegistry({ revealProgress: 0, allowInlineReveal: false }),
    [],
  );
  const activityRegistry = useMemo(
    () => createManifestStudentActivityRegistry<{ id: string; title: string }>(),
    [],
  );
  if (!step) return null;

  return (
    <section
      className="h-full overflow-auto p-4"
      data-generated-courseware-resource={config.publicationRevisionId}
      data-generated-courseware-manifest-hash={config.manifestHash}
      data-generated-courseware-step={step.id}
    >
      {renderInteractiveManifestStep({
        manifest: config.runtimeManifest,
        step,
        moduleRegistry,
        extra: { revealProgress: 0, allowInlineReveal: false },
      })}
      <div data-courseware-student-activity={step.id}>
        {renderStudentInteractiveActivity({
          registry: activityRegistry,
          step: { id: step.id, title: step.title },
          stepManifest: step,
          savedResponse: response,
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onSubmit: (submitted) => {
            setResponse(submitted);
            onStateChange?.({
              phase: 'submitted',
              progress: 100,
              data: { stepId: step.id, response: submitted },
              timestamp: Date.now(),
            });
            onComplete?.({ success: true, data: { stepId: step.id, response: submitted } });
          },
        })}
      </div>
    </section>
  );
}
