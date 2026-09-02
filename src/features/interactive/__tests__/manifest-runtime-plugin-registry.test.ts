import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createManifestContentModuleRegistry } from '../shared/manifest-runtime/content-renderers';
import {
  composeManifestPluginRegistry,
  ManifestPluginRegistryError,
  type AnyManifestModulePlugin,
  type ManifestModulePlugin,
} from '../shared/manifest-runtime/plugins/plugin-contract';
import { controlWorkbenchPluginSet } from '../shared/manifest-runtime/plugins/control-workbench-module';
import { interactiveFigurePluginSet } from '../shared/manifest-runtime/plugins/interactive-figure-module';
import {
  staticSurface3DModulePlugin,
  staticSurface3DPanelProps,
  staticSurface3DPluginSet,
} from '../shared/manifest-runtime/plugins/static-surface-3d-module';

function stubPlugin(overrides: {
  owner?: string;
  moduleKind?: string;
  capabilityRef?: string;
  contractVersion?: string;
  category?: 'module' | 'activity' | 'layout';
}): AnyManifestModulePlugin {
  const plugin: ManifestModulePlugin<unknown> = {
    key: {
      category: overrides.category ?? 'module',
      moduleKind: overrides.moduleKind ?? 'compute.panel',
      capabilityRef: overrides.capabilityRef ?? 'test-capability',
      contractVersion: overrides.contractVersion ?? 'test.v1',
    },
    owner: overrides.owner ?? 'test-owner',
    schema: () => null,
    projectRole: (payload) => payload,
    render: () => null,
    evidence: { classification: 'view-interaction-log' },
    missingRenderer: {
      requirement: 'required',
      marker: 'manifest-plugin-missing:test',
      reason: '测试能力没有已注册的渲染插件。',
    },
  };
  return plugin as never;
}

describe('composeManifestPluginRegistry', () => {
  it('rejects duplicate composite identities with both owners named', () => {
    expect(() => composeManifestPluginRegistry([
      { owner: 'owner-a', plugins: [stubPlugin({ owner: 'owner-a', capabilityRef: 'dup-cap' })] },
      { owner: 'owner-b', plugins: [stubPlugin({ owner: 'owner-b', capabilityRef: 'dup-cap' })] },
    ])).toThrow(ManifestPluginRegistryError);
    try {
      composeManifestPluginRegistry([
        { owner: 'owner-a', plugins: [stubPlugin({ owner: 'owner-a', capabilityRef: 'dup-cap' })] },
        { owner: 'owner-b', plugins: [stubPlugin({ owner: 'owner-b', capabilityRef: 'dup-cap' })] },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).toContain('owner-a');
      expect(message).toContain('owner-b');
      expect(message).toContain('dup-cap');
    }
  });

  it('accepts distinct capabilities under one module kind and selects only the exact key', () => {
    const registry = composeManifestPluginRegistry([
      {
        owner: 'compute-panel-owner',
        plugins: [
          stubPlugin({ capabilityRef: 'static-surface-3d' }),
          stubPlugin({ capabilityRef: 'control-workbench' }),
          stubPlugin({ capabilityRef: 'interactive-figure' }),
        ],
      },
    ]);
    expect(registry.entries()).toHaveLength(3);
    for (const capabilityRef of ['static-surface-3d', 'control-workbench', 'interactive-figure']) {
      const lookup = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef });
      expect(lookup.status).toBe('rendered');
      if (lookup.status === 'rendered') {
        expect(lookup.plugin.key.capabilityRef).toBe(capabilityRef);
      }
    }
  });

  it('rejects unknown categories, empty capability refs, and missing contract versions', () => {
    expect(() => composeManifestPluginRegistry([
      { owner: 'o', plugins: [stubPlugin({ category: 'mystery' as never })] },
    ])).toThrow(/unknown category/);
    expect(() => composeManifestPluginRegistry([
      { owner: 'o', plugins: [stubPlugin({ capabilityRef: '  ' })] },
    ])).toThrow(/non-empty module kind, capability reference/);
    expect(() => composeManifestPluginRegistry([
      { owner: 'o', plugins: [stubPlugin({ contractVersion: '' })] },
    ])).toThrow(/contract version/);
    expect(() => composeManifestPluginRegistry([
      { owner: '', plugins: [] },
    ])).toThrow(/explicit owner/);
  });

  it('treats a declared capability without a plugin as an explicit missing renderer', () => {
    const registry = composeManifestPluginRegistry([
      {
        owner: 'owner-a',
        plugins: [stubPlugin({ capabilityRef: 'present-cap' })],
        declaredModuleCapabilities: [
          {
            moduleKind: 'compute.panel',
            capabilityRef: 'declared-but-absent',
            missingRenderer: {
              requirement: 'required',
              marker: 'manifest-plugin-missing:compute.panel:declared-but-absent',
              reason: '声明的能力没有已注册的渲染插件。',
            },
          },
          {
            moduleKind: 'compute.panel',
            capabilityRef: 'optional-declared-absent',
            missingRenderer: {
              requirement: 'optional',
              marker: 'manifest-plugin-missing:compute.panel:optional-declared-absent',
              reason: '可选增强不可用，已软降级。',
            },
          },
        ],
      },
    ]);
    const missing = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'declared-but-absent' });
    expect(missing.status).toBe('missing');
    if (missing.status === 'missing') {
      expect(missing.contract.requirement).toBe('required');
      expect(missing.contract.marker).toBe('manifest-plugin-missing:compute.panel:declared-but-absent');
    }
  });


  it('preserves the declared optional missing policy instead of forcing required', () => {
    const registry = composeManifestPluginRegistry([
      {
        owner: 'owner-a',
        plugins: [stubPlugin({ capabilityRef: 'present-cap' })],
        declaredModuleCapabilities: [
          {
            moduleKind: 'compute.panel',
            capabilityRef: 'optional-declared-absent',
            missingRenderer: {
              requirement: 'optional',
              marker: 'manifest-plugin-missing:compute.panel:optional-declared-absent',
              reason: '可选增强不可用，已软降级。',
            },
          },
        ],
      },
    ]);
    const optional = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'optional-declared-absent' });
    expect(optional.status).toBe('missing');
    if (optional.status === 'missing') {
      expect(optional.contract.requirement).toBe('optional');
      expect(optional.contract.reason).toContain('软降级');
    }
  });

  it('selects the exact contract version and fails explicitly when versions are ambiguous', () => {
    const registry = composeManifestPluginRegistry([
      {
        owner: 'owner-a',
        plugins: [
          stubPlugin({ capabilityRef: 'versioned-cap', contractVersion: 'v1' }),
          stubPlugin({ capabilityRef: 'versioned-cap', contractVersion: 'v2' }),
        ],
      },
    ]);
    const v1 = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'versioned-cap', contractVersion: 'v1' });
    expect(v1.status).toBe('rendered');
    if (v1.status === 'rendered') expect(v1.plugin.key.contractVersion).toBe('v1');
    const v2 = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'versioned-cap', contractVersion: 'v2' });
    expect(v2.status).toBe('rendered');
    if (v2.status === 'rendered') expect(v2.plugin.key.contractVersion).toBe('v2');
    const ambiguous = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'versioned-cap' });
    expect(ambiguous.status).toBe('missing');
    if (ambiguous.status === 'missing') {
      expect(ambiguous.contract.marker).toBe('manifest-plugin-ambiguous:compute.panel:versioned-cap');
    }
    // An explicit unregistered version fails closed with the requested version
    // named instead of falling back to the central kind path.
    const unknownVersion = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'versioned-cap', contractVersion: 'v99' });
    expect(unknownVersion.status).toBe('missing');
    if (unknownVersion.status === 'missing') {
      expect(unknownVersion.contract.marker).toBe('manifest-plugin-version-missing:compute.panel:versioned-cap:v99');
      expect(unknownVersion.key.contractVersion).toBe('v99');
    }
  });

  it('resolves activity and layout plugins through their own typed lookups', () => {
    const activityPlugin = {
      ...stubPlugin({ category: 'activity' as const, moduleKind: 'choice.single', capabilityRef: 'choice-activity' }),
      evidence: { classification: 'activity-response' as const, responseKind: 'choice.single' },
    };
    const layoutPlugin = {
      ...stubPlugin({ category: 'layout' as const, moduleKind: 'layout.template', capabilityRef: 'two-column' }),
      templateId: 'two-column',
    };
    const registry = composeManifestPluginRegistry([
      { owner: 'owner-a', plugins: [activityPlugin, layoutPlugin] },
    ]);
    const activity = registry.lookupActivity({ moduleKind: 'choice.single', capabilityRef: 'choice-activity' });
    expect(activity.status).toBe('rendered');
    if (activity.status === 'rendered') {
      expect(activity.plugin.key.category).toBe('activity');
    }
    const layout = registry.lookupLayout({ moduleKind: 'layout.template', capabilityRef: 'two-column' });
    expect(layout.status).toBe('rendered');
    // Category-specific lookups do not leak across indexes.
    expect(registry.lookupModule({ moduleKind: 'choice.single', capabilityRef: 'choice-activity' }).status).toBe('unclaimed');
    expect(registry.lookupActivity({ moduleKind: 'compute.panel', capabilityRef: 'static-surface-3d' }).status).toBe('unclaimed');
  });

  it('rejects activity-response plugins without a response kind and layouts without a template id', () => {
    expect(() => composeManifestPluginRegistry([
      {
        owner: 'owner-a',
        plugins: [{
          ...stubPlugin({ category: 'activity' as const }),
          evidence: { classification: 'activity-response' as const },
        }],
      },
    ])).toThrow(/response kind/);
    expect(() => composeManifestPluginRegistry([
      { owner: 'owner-a', plugins: [stubPlugin({ category: 'layout' as const })] },
    ])).toThrow(/template id/);
  });

  it('leaves undeclared capabilities on the central kind path (unclaimed)', () => {
    const registry = composeManifestPluginRegistry([staticSurface3DPluginSet]);
    expect(registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'control-workbench' }).status)
      .toBe('unclaimed');
    expect(registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: null }).status)
      .toBe('unclaimed');
    expect(registry.lookupModule({ moduleKind: 'content.rich', capabilityRef: 'static-surface-3d' }).status)
      .toBe('unclaimed');
  });

  it('resolves the pilot plugin under its exact composite identity', () => {
    const registry = composeManifestPluginRegistry([staticSurface3DPluginSet]);
    const lookup = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'static-surface-3d' });
    expect(lookup.status).toBe('rendered');
    if (lookup.status === 'rendered') {
      expect(lookup.plugin.key).toEqual({
        category: 'module',
        moduleKind: 'compute.panel',
        capabilityRef: 'static-surface-3d',
        contractVersion: 'static-surface-3d.v1',
      });
      expect(lookup.plugin.evidence.classification).toBe('view-interaction-log');
      expect(lookup.plugin.missingRenderer.requirement).toBe('required');
    }
  });
});

describe('central renderer shrink proof', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
    'utf8',
  );

  it('no longer imports the migrated renderer implementations', () => {
    expect(source).not.toContain("from './static-surface-3d-panel'");
    expect(source).not.toContain('StaticSurface3DPanel');
    expect(source).not.toContain('SharedControlWorkbenchComputePanel');
    expect(source).not.toContain('InteractiveFigureComputePanel');
  });

  it('no longer compares capability strings for migrated compute panels inside the center', () => {
    const computePanelStart = source.indexOf("'compute.panel'");
    const computePanelEnd = source.indexOf("'analytics.summary'");
    const computePanel = source.slice(computePanelStart, computePanelEnd);
    expect(computePanel).not.toContain("'static-surface-3d'");
    expect(computePanel).not.toContain('"static-surface-3d"');
    expect(computePanel).not.toContain("'interactive-figure'");
    expect(computePanel).not.toContain('"interactive-figure"');
    expect(computePanel).not.toContain('isControlWorkbenchComputeCapabilityRef');
  });

  it('passes the unparsed capability reference into registry lookup', () => {
    expect(source).toContain('lookupModule({');
    expect(source).toContain('capabilityRef: computeCapabilityRef(module.payload)');
  });

  it('composes the three owned plugin sets as the only production registry', () => {
    expect(source).toContain('composeManifestPluginRegistry([staticSurface3DPluginSet, controlWorkbenchPluginSet, interactiveFigurePluginSet])');
    expect(source).not.toContain("from '@/lib/resource-registry");
    expect(source).not.toContain("'interactive-figure':");
  });
});

describe('registration retirement', () => {
  const extra = { revealProgress: 0, allowInlineReveal: false };

  function computePanelHtml(payload: Record<string, unknown>) {
    const registry = createManifestContentModuleRegistry(extra);
    const step = {
      id: 'step-01',
      title: 'Step 01',
      contentBlocks: {},
    } as never;
    const runtimeModule = {
      id: 'compute-module',
      kind: 'compute.panel',
      region: 'main',
      mustBeVisible: true,
      title: '计算面板',
      payload,
    } as never;
    const manifest = {
      lessonId: 'fixture',
      steps: [step],
    } as never;
    return renderToStaticMarkup(registry['compute.panel']({
      manifest,
      step,
      module: runtimeModule,
      extra,
    }) as ReactElement);
  }

  it('fail-closes a declared plugin with an unregistered contract version instead of the central kind path', () => {
    const html = computePanelHtml({
      capabilityRef: 'static-surface-3d',
      contractVersion: 'v99',
    });
    expect(html).toContain('data-manifest-plugin-missing="manifest-plugin-version-missing:compute.panel:static-surface-3d:v99"');
    expect(html).not.toContain('data-static-surface-3d-panel');
  });

  it('leaves undeclared compute panels on the central unclaimed path', () => {
    const html = computePanelHtml({ text: '未声明能力走中心卡片' });
    expect(html).not.toContain('data-manifest-plugin-missing');
    expect(html).toContain('未声明能力走中心卡片');
  });

  it('keeps the image helper for course-owned figure intercepts and drops the unused plugin-kind alias', () => {
    const registry = createManifestContentModuleRegistry(extra);
    expect(registry['interactive-figure']).toBeUndefined();
    expect(registry['interactive-figure-panel']).toBeTypeOf('function');
  });

  it('deletes zero-caller compatibility re-exports', () => {
    const shared = join(process.cwd(), 'src/features/interactive/shared');
    expect(existsSync(join(shared, 'manifest-content-renderers.tsx'))).toBe(false);
    expect(existsSync(join(shared, 'manifest-activity-renderers.tsx'))).toBe(false);
    expect(existsSync(join(shared, 'interactive-manifest-renderer.tsx'))).toBe(false);
  });

  it('keeps course-local registries from composing a second plugin registry', () => {
    const root = join(process.cwd(), 'src/features/interactive');
    const offenders: string[] = [];
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      if (!dir) break;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'shared') stack.push(path);
          continue;
        }
        if (entry.name !== 'step-panels.tsx') continue;
        const source = readFileSync(path, 'utf8');
        if (source.includes('composeManifestPluginRegistry')) offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('resolves the production plugin identities through one composed registry', () => {
    const registry = composeManifestPluginRegistry([
      staticSurface3DPluginSet,
      controlWorkbenchPluginSet,
      interactiveFigurePluginSet,
    ]);
    for (const capabilityRef of ['static-surface-3d', 'control-workbench', 'interactive-figure']) {
      expect(registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef }).status).toBe('rendered');
    }
    expect(registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'rust-analysis' }).status).toBe('unclaimed');
  });
});

describe('static-surface-3d plugin behavior', () => {
  const rendererInput = {
    role: 'student' as const,
    manifest: {
      lessonId: '1-2',
      steps: {},
    } as never,
    step: {
      id: 'step-9',
      contentBlocks: {},
    } as never,
    module: {
      id: 'surface-module',
      kind: 'compute.panel',
      region: 'main',
      mustBeVisible: true,
      title: '三维幅值曲面',
      payload: {
        capabilityRef: 'static-surface-3d',
        caption: '闭环增益幅值曲面',
        data: {
          regularGrid: {
            x: [-3, -2, -1],
            y: [0, 1],
            values: [[1, 2], [3, 4], [5, 6]],
          },
        },
        markers: [{ label: '主导极点', position: [-1, 0.5, 2] }],
      },
    } as never,
  };

  it('normalizes the payload schema with defaults matching the characterization', () => {
    const props = staticSurface3DPanelProps(rendererInput);
    expect(props).toMatchObject({
      moduleId: 'surface-module',
      title: '三维幅值曲面',
      caption: '闭环增益幅值曲面',
      colorScale: { label: '幅值' },
      defaultCamera: {
        position: [3, 3, 2],
        target: [0, 0, 0],
        zoom: 1,
      },
      axes: {
        x: { label: '实部 σ' },
        y: { label: '虚部 jω' },
        z: { label: '幅值' },
      },
    });
    expect(props.dataset?.regularGrid?.x).toEqual([-3, -2, -1]);
    expect(props.markers).toEqual([{ label: '主导极点', position: [-1, 0.5, 2] }]);
  });

  it('projects an identical role-safe view for student and teacher (no reference answers)', () => {
    const payload = staticSurface3DPanelProps(rendererInput);
    const student = staticSurface3DModulePlugin.projectRole(payload, 'student');
    const teacher = staticSurface3DModulePlugin.projectRole(payload, 'teacher');
    expect(student).toEqual(payload);
    expect(teacher).toEqual(payload);
    expect(JSON.stringify(student)).not.toMatch(/reference|answer|teacherOnly/i);
  });

  it('keeps rendering evidence-free (view interaction log only)', () => {
    expect(staticSurface3DModulePlugin.evidence).toEqual({ classification: 'view-interaction-log' });
  });
});
