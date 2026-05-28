import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  INTERACTIVE_MODULE_CANONICAL_CLASSES,
  INTERACTIVE_MODULE_INTERACTION_KINDS,
  INTERACTIVE_MODULE_PRESENTATION_LAYOUTS,
  INTERACTIVE_MODULE_RESPONSE_KINDS,
  INTERACTIVE_MODULE_SEMANTIC_ROLES,
  LEGACY_INTERACTIVE_MODULE_KIND_ALIASES,
  OBSERVED_LEGACY_INTERACTIVE_MODULE_KINDS,
} from '@/features/interactive/shared/manifest-runtime/module-taxonomy';

const repoRoot = process.cwd();

describe('interactive module taxonomy', () => {
  it('defines the finite canonical class set and orthogonal field vocabularies', () => {
    expect(INTERACTIVE_MODULE_CANONICAL_CLASSES).toEqual([
      'content.rich',
      'content.cardSet',
      'content.formula',
      'content.table',
      'content.figure',
      'content.reveal',
      'content.stageMap',
      'activity.panel',
      'activity.workspace',
      'compute.panel',
      'analytics.summary',
      'layout.support',
      'legacy.adapter',
    ]);
    expect(INTERACTIVE_MODULE_PRESENTATION_LAYOUTS).toEqual(expect.arrayContaining(['single', 'row', 'grid', 'strip', 'tabs']));
    expect(INTERACTIVE_MODULE_SEMANTIC_ROLES).toEqual(expect.arrayContaining(['goal', 'risk', 'teacherHint', 'referenceAnswer']));
    expect(INTERACTIVE_MODULE_INTERACTION_KINDS).toEqual(expect.arrayContaining(['display', 'single-choice', 'structured-submit']));
    expect(INTERACTIVE_MODULE_RESPONSE_KINDS).toEqual(expect.arrayContaining(['singleChoice', 'multiSelect', 'structured']));
  });

  it('keeps every observed legacy manifest kind in the migration alias table', () => {
    const observedKinds = collectRuntimeManifestModuleKinds();
    const observedLegacyKinds = observedKinds.filter((kind) => !isCanonicalModuleClass(kind));
    const aliasKinds = Object.keys(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES).sort();
    const unsupportedKinds = observedKinds.filter(
      (kind) => !isCanonicalModuleClass(kind) && !Object.hasOwn(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES, kind),
    );

    expect(OBSERVED_LEGACY_INTERACTIVE_MODULE_KINDS).toHaveLength(151);
    expect(observedLegacyKinds).toEqual(
      OBSERVED_LEGACY_INTERACTIVE_MODULE_KINDS.filter((kind) => observedLegacyKinds.includes(kind)).slice().sort(),
    );
    expect(aliasKinds).toEqual(OBSERVED_LEGACY_INTERACTIVE_MODULE_KINDS.slice().sort());
    expect(unsupportedKinds).toEqual([]);
  });

  it('maps historical layout, semantic, response, and compute names to orthogonal fields', () => {
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['goal-card-row']).toMatchObject({
      canonicalClass: 'content.cardSet',
      presentation: 'row',
      semanticRole: 'goal',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['formula-strip']).toMatchObject({
      canonicalClass: 'content.formula',
      presentation: 'strip',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['choice-check']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'quiz',
      responseKind: 'singleChoice',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['single-choice']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'single-choice',
      responseKind: 'singleChoice',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['single-choice-card']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'single-choice',
      responseKind: 'singleChoice',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['frequency-band-labeling']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'hotspot-labeling',
      responseKind: 'hotspotLabeling',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['structured-compare']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'structured-compare',
      responseKind: 'structured',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['interactive-figure-panel']).toMatchObject({
      canonicalClass: 'compute.panel',
      capabilityRef: 'interactive-figure',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['parametric-risk-panel']).toMatchObject({
      canonicalClass: 'compute.panel',
      capabilityRef: 'parametric-risk',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['learning-stat-panel']).toMatchObject({
      canonicalClass: 'analytics.summary',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['problem-statement']).toMatchObject({
      canonicalClass: 'content.rich',
      semanticRole: 'problem',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['table-builder']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'table-builder',
      responseKind: 'table',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['multi-select-matrix']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'multi-select',
      responseKind: 'multiSelect',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['scenario-sort-matrix']).toMatchObject({
      canonicalClass: 'activity.panel',
      interactionKind: 'card-sort',
      responseKind: 'sorting',
      migrationOnly: true,
    });
    expect(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES['stage-map']).toMatchObject({
      canonicalClass: 'content.stageMap',
      migrationOnly: true,
    });
  });

  it('marks legacy aliases as migration-only canonical mappings', () => {
    for (const alias of Object.values(LEGACY_INTERACTIVE_MODULE_KIND_ALIASES)) {
      expect(INTERACTIVE_MODULE_CANONICAL_CLASSES).toContain(alias.canonicalClass);
      expect(alias.migrationOnly).toBe(true);
      if (alias.capabilityRef) {
        expect(alias.canonicalClass).toBe('compute.panel');
      }
      if (alias.responseKind) {
        expect(['activity.panel', 'activity.workspace', 'compute.panel']).toContain(alias.canonicalClass);
      }
    }
  });
});

function collectRuntimeManifestModuleKinds(): string[] {
  const manifests = collectManifestPaths(join(repoRoot, 'course-content/runtime/lessons'));
  const kinds = new Set<string>();

  for (const manifestPath of manifests) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { steps?: unknown };
    for (const step of manifestSteps(manifest.steps)) {
      for (const runtimeModule of manifestModules(step)) {
        if (typeof runtimeModule.kind === 'string' && runtimeModule.kind.trim()) {
          kinds.add(runtimeModule.kind);
        }
      }
    }
  }

  return Array.from(kinds).sort();
}

function collectManifestPaths(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectManifestPaths(fullPath));
    } else if (entry.name === 'interactive-manifest.json') {
      result.push(fullPath);
    }
  }
  return result.sort();
}

function manifestSteps(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return Object.values(value).filter(isRecord);
  return [];
}

function manifestModules(step: Record<string, unknown>): Array<{ kind?: unknown }> {
  const modules = step.modules;
  if (!Array.isArray(modules)) return [];
  return modules.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCanonicalModuleClass(kind: string): boolean {
  return (INTERACTIVE_MODULE_CANONICAL_CLASSES as readonly string[]).includes(kind);
}
