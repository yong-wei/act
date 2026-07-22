'use client';

import '@fontsource-variable/noto-sans-sc';

import {
  GENERATED_SLIDE_BROWSER_FIXTURE,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-browser-fixture';
import {
  createGeneratedSlideMarkedContentRegistry,
  GeneratedSlideMarkedActivityPanel,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-marked-renderers';
import {
  renderGeneratedSlideManifestStep,
  type GeneratedSlideActivityRenderer,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  GENERATED_SLIDE_BROWSER_FONT_FAMILY,
  type GeneratedSlideProjection,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-browser-validation';
import type { GeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';

const rendererExtra = { revealProgress: 8, allowInlineReveal: true };

const activityRenderer: GeneratedSlideActivityRenderer<typeof rendererExtra> = ({ module, projection }) => (
  <GeneratedSlideMarkedActivityPanel
    moduleId={module.id}
    responseKind={module.payload.responseKind}
    payload={module.payload}
    projection={projection}
  />
);

export function GeneratedSlideRuntime938Review({
  projection,
  review,
}: {
  projection: GeneratedSlideProjection;
  review?: { manifest: GeneratedSlideManifest; manifestHash: string };
}) {
  const manifest = review?.manifest ?? GENERATED_SLIDE_BROWSER_FIXTURE;
  const manifestHash = review?.manifestHash;
  const moduleRegistry = createGeneratedSlideMarkedContentRegistry(manifest);
  const steps = manifest.stages.flatMap((stage) => stage.steps);
  return (
    <main
      data-generated-slide-review-route="938"
      data-publication-review="ready"
      data-projection={projection}
      data-publication-manifest-hash={manifestHash}
      style={{ fontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY }}
    >
      {steps.map((step) => (
        <section key={step.id} data-generated-slide-review-step={step.id}>
          {renderGeneratedSlideManifestStep({
            generatedManifest: manifest,
            generatedStep: step,
            projection,
            moduleRegistry,
            activityRenderer,
            extra: rendererExtra,
          })}
        </section>
      ))}
      <div data-after-generated-slide>后续页面内容</div>
    </main>
  );
}
