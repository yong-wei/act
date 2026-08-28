import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { createManifestContentModuleRegistry } from '../shared/manifest-runtime/content-renderers';
import { renderInteractiveManifestStep } from '../shared/manifest-runtime/layout-renderer';
import { composeManifestPluginRegistry } from '../shared/manifest-runtime/plugins/plugin-contract';
import { staticSurface3DPluginSet } from '../shared/manifest-runtime/plugins/static-surface-3d-module';

/**
 * Issue #1575 acceptance against the REAL 1-2 runtime manifest: the pilot
 * `compute.panel` / `static-surface-3d` module renders through the owned
 * plugin (registry composition → exact-key lookup → plugin render), not a
 * central branch.
 */
describe('real 1-2 manifest static-surface-3d plugin pipeline', () => {
  const raw = JSON.parse(readFileSync(
    join(process.cwd(), 'course-content/runtime/lessons/1-2/interactive-manifest.json'),
    'utf8',
  ));
  const manifest = normalizeInteractiveRuntimeManifest(raw);
  expect(manifest).not.toBeNull();

  const step = manifest
    ? Object.values(manifest.steps).find((candidate) =>
      candidate.modules.some((module) => module.payload.capabilityRef === 'static-surface-3d'),
    )
    : undefined;
  const module = step?.modules.find((candidate) => candidate.payload.capabilityRef === 'static-surface-3d');

  it('step-09 declares the pilot module', () => {
    expect(step?.id).toBe('step-09');
    expect(module?.kind).toBe('compute.panel');
  });

  it('renders the pilot through the owned plugin with characterization markers', () => {
    expect(step).toBeDefined();
    expect(manifest).toBeDefined();
    const extra = { revealProgress: 0, allowInlineReveal: false };
    const html = renderToStaticMarkup(
      renderInteractiveManifestStep({
        manifest: manifest!,
        step: step!,
        moduleRegistry: createManifestContentModuleRegistry(extra),
        extra,
      }),
    );
    expect(html).toContain('data-static-surface-3d-panel="magnitude-surface"');
    expect(html).toContain('data-static-surface-viewport');
    expect(html).not.toContain('manifest-plugin-missing:compute.panel:static-surface-3d');
  });

  it('projects identical role-safe views with no reference-answer leakage', () => {
    expect(manifest && step && module).toBeTruthy();
    const registry = composeManifestPluginRegistry([staticSurface3DPluginSet]);
    const lookup = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'static-surface-3d' });
    expect(lookup.status).toBe('rendered');
    if (lookup.status !== 'rendered' || !manifest || !step || !module) return;
    const plugin = lookup.plugin;
    const project = (role: 'student' | 'teacher') =>
      plugin.projectRole(plugin.schema({ manifest, step, module, role }), role);
    const studentView = project('student');
    const teacherView = project('teacher');
    expect(studentView).toEqual(teacherView);
    expect(JSON.stringify(studentView)).not.toMatch(/referenceAnswer|teacherOnly|diagnostic/i);
  });

  it('keeps unmigrated compute.panel capabilities on the central path', () => {
    const registry = composeManifestPluginRegistry([staticSurface3DPluginSet]);
    expect(registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'control-workbench' }).status)
      .toBe('unclaimed');
    expect(registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'interactive-figure' }).status)
      .toBe('unclaimed');
    expect(registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'static-surface-3d' }).status)
      .toBe('rendered');
  });
});
