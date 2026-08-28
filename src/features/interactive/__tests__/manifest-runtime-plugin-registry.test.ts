import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  composeManifestPluginRegistry,
  ManifestPluginRegistryError,
  type AnyManifestModulePlugin,
  type ManifestModulePlugin,
} from '../shared/manifest-runtime/plugins/plugin-contract';
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
    // A single registered version resolves without an explicit request.
    const single = registry.lookupModule({ moduleKind: 'compute.panel', capabilityRef: 'present-cap' });
    void single;
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

describe('central renderer shrink proof (pilot)', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/interactive/shared/manifest-runtime/content-renderers.tsx'),
    'utf8',
  );

  it('no longer imports the pilot renderer implementation', () => {
    expect(source).not.toContain("from './static-surface-3d-panel'");
    expect(source).not.toContain('StaticSurface3DPanel');
  });

  it('no longer compares capability strings for the pilot inside the center', () => {
    expect(source).not.toContain("'static-surface-3d'");
    expect(source).not.toContain('"static-surface-3d"');
  });

  it('passes the unparsed capability reference into registry lookup', () => {
    expect(source).toContain('lookupModule({');
    expect(source).toContain('capabilityRef: computeCapabilityRef(module.payload)');
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
