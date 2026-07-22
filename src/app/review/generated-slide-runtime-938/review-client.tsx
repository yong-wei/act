'use client';

import { useEffect, useState } from 'react';
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

type ReviewManifestState =
  | { kind: 'checking' }
  | { kind: 'fixture'; manifest: GeneratedSlideManifest }
  | { kind: 'loaded'; manifest: GeneratedSlideManifest; manifestHash: string }
  | { kind: 'error' };

export function GeneratedSlideRuntime938Review({ projection }: { projection: GeneratedSlideProjection }) {
  const [state, setState] = useState<ReviewManifestState>({ kind: 'checking' });
  useEffect(() => {
    const sourceRevisionId = new URLSearchParams(window.location.search).get('sourceRevisionId');
    if (!sourceRevisionId) {
      setState({ kind: 'fixture', manifest: GENERATED_SLIDE_BROWSER_FIXTURE });
      return;
    }
    const controller = new AbortController();
    fetch(`/api/internal/smart-courseware/publication-review?sourceRevisionId=${encodeURIComponent(sourceRevisionId)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('publication-review-manifest-unavailable');
      return response.json() as Promise<{ manifest: GeneratedSlideManifest; manifestHash: string }>;
    }).then((payload) => setState({ kind: 'loaded', ...payload })).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setState({ kind: 'error' });
    });
    return () => controller.abort();
  }, []);

  if (state.kind === 'checking') {
    return <main data-generated-slide-review-route="938" data-publication-review="loading" style={{ fontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY }} />;
  }
  if (state.kind === 'error') {
    return <main data-generated-slide-review-route="938" data-publication-review="error" style={{ fontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY }}>课件版本加载失败</main>;
  }
  const { manifest } = state;
  const manifestHash = state.kind === 'loaded' ? state.manifestHash : undefined;
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
