'use client';

import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  GENERATED_SLIDE_BROWSER_FIXTURE,
  GENERATED_SLIDE_BROWSER_FIXTURE_STEPS,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-browser-fixture';
import {
  renderGeneratedSlideManifestStep,
  type GeneratedSlideActivityRenderer,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import type { GeneratedSlideProjection } from '@/features/interactive/shared/manifest-runtime/generated-slide-browser-validation';

const rendererExtra = { revealProgress: 8, allowInlineReveal: true };

const activityRenderer: GeneratedSlideActivityRenderer<typeof rendererExtra> = ({ module, projection }) => (
  <section data-generated-slide-production-activity={module.id}>
    <p>{String(module.payload.prompt ?? '')}</p>
    <button type="button">{projection}: 稳定</button>
  </section>
);

export function GeneratedSlideRuntime938Review({ projection }: { projection: GeneratedSlideProjection }) {
  const moduleRegistry = createManifestContentModuleRegistry(rendererExtra);
  return (
    <main data-generated-slide-review-route="938" data-projection={projection}>
      {GENERATED_SLIDE_BROWSER_FIXTURE_STEPS.map((step) => (
        <section key={step.id} data-generated-slide-review-step={step.id}>
          {renderGeneratedSlideManifestStep({
            generatedManifest: GENERATED_SLIDE_BROWSER_FIXTURE,
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
