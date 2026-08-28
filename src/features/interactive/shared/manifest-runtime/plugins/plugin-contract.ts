import type { ReactNode } from 'react';

import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from '../layout-renderer';

/**
 * Typed manifest runtime plugin contract. Plugins own payload validation, role
 * projection, rendering, evidence behavior, and missing-renderer semantics for
 * one stable composite identity; the central runtime only validates the
 * manifest boundary and resolves the exact key.
 */

export type ManifestPluginCategory = 'module' | 'activity' | 'layout';

export type ManifestPluginRole = 'student' | 'teacher';

export interface ManifestPluginKey {
  category: ManifestPluginCategory;
  /** Canonical `module.kind` the plugin serves (e.g. `compute.panel`). */
  moduleKind: string;
  /** Non-empty stable capability reference (e.g. `static-surface-3d`). */
  capabilityRef: string;
  /** Explicit contract version; two versions of one capability are distinct plugins. */
  contractVersion: string;
}

export interface ManifestMissingRendererContract {
  requirement: 'required' | 'optional';
  /** Machine-readable marker emitted when the plugin is absent. */
  marker: string;
  /** Human-facing reason shape for diagnostics; never fabricated content. */
  reason: string;
}

export interface ManifestModuleRendererInput {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  role: ManifestPluginRole;
}

export interface ManifestEvidenceBehavior {
  /**
   * Evidence classification for the shared submission path. Rendering stays
   * side-effect free; only activity plugins with a registered response
   * contract may produce `StudentStepResponse` / LearningFact input.
   */
  classification: 'view-interaction-log' | 'activity-response';
  responseKind?: string;
}

export interface ManifestModulePlugin<TPayload = unknown> {
  key: ManifestPluginKey;
  owner: string;
  /** Normalizes a raw manifest payload into the plugin's trusted input. */
  schema: (input: ManifestModuleRendererInput) => TPayload;
  /**
   * Projects a role-safe view before rendering. Student projection MUST
   * exclude reference answers and teacher-only diagnostics/controls.
   */
  projectRole: (payload: TPayload, role: ManifestPluginRole) => TPayload;
  render: (input: ManifestModuleRendererInput & { payload: TPayload }) => ReactNode;
  evidence: ManifestEvidenceBehavior;
  missingRenderer: ManifestMissingRendererContract;
}

/**
 * Type-erased plugin entry for heterogeneous registry composition. The schema
 * and render generics are erased at the registry boundary; lookup consumers
 * receive `ManifestModulePlugin<unknown>` and go through schema/projectRole.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyManifestModulePlugin = ManifestModulePlugin<any>;

export interface ManifestPluginSet {
  owner: string;
  plugins: ReadonlyArray<AnyManifestModulePlugin>;
  /**
   * Capability domain this set claims. A declared capability whose plugin is
   * absent from the composed registry is an explicit missing renderer;
   * capabilities outside every declared domain stay on the central kind
   * registry path (unclaimed) until their owner migrates them.
   */
  declaredModuleCapabilities?: ReadonlyArray<{ moduleKind: string; capabilityRef: string }>;
}

export class ManifestPluginRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestPluginRegistryError';
  }
}

export type ManifestModulePluginLookup =
  | { status: 'rendered'; plugin: ManifestModulePlugin<unknown> }
  | {
    status: 'missing';
    contract: ManifestMissingRendererContract;
    key: { moduleKind: string; capabilityRef: string };
  }
  | { status: 'unclaimed' };

function pluginFullKey(key: ManifestPluginKey) {
  return `${key.category}::${key.moduleKind}::${key.capabilityRef}::${key.contractVersion}`;
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set(['module', 'activity', 'layout']);

/**
 * Compose a plugin registry from owned plugin sets. Duplicate composite keys,
 * unknown categories, empty capability references, and missing contract
 * versions fail composition with both owners named; two capabilities under one
 * `module.kind` remain distinct entries.
 */
export function composeManifestPluginRegistry(sets: ReadonlyArray<ManifestPluginSet>) {
  const modulePlugins = new Map<string, ManifestModulePlugin<unknown>>();
  const moduleKeysByCapability = new Map<string, ManifestModulePlugin<unknown>>();
  const declaredModuleCapabilities = new Set<string>();
  for (const set of sets) {
    if (!set.owner || typeof set.owner !== 'string') {
      throw new ManifestPluginRegistryError('Manifest plugin set requires an explicit owner.');
    }
    for (const declared of set.declaredModuleCapabilities ?? []) {
      if (declared.moduleKind && declared.capabilityRef?.trim()) {
        declaredModuleCapabilities.add(`${declared.moduleKind}::${declared.capabilityRef.trim()}`);
      }
    }
    for (const plugin of set.plugins) {
      const key = plugin.key;
      if (!key || !VALID_CATEGORIES.has(key.category)) {
        throw new ManifestPluginRegistryError(
          `Manifest plugin from "${set.owner}" declares an unknown category.`,
        );
      }
      if (!key.moduleKind || !key.capabilityRef?.trim() || !key.contractVersion) {
        throw new ManifestPluginRegistryError(
          `Manifest plugin from "${set.owner}" must declare a non-empty module kind, capability reference, and contract version.`,
        );
      }
      const fullKey = pluginFullKey(key);
      const existing = modulePlugins.get(fullKey);
      if (existing) {
        throw new ManifestPluginRegistryError(
          `Duplicate manifest plugin identity ${fullKey}: claimed by "${existing.owner}" and "${plugin.owner ?? set.owner}".`,
        );
      }
      const owned: ManifestModulePlugin<unknown> = { ...plugin, owner: plugin.owner ?? set.owner };
      modulePlugins.set(fullKey, owned);
      if (key.category === 'module') {
        moduleKeysByCapability.set(`${key.moduleKind}::${key.capabilityRef}`, owned);
      }
    }
  }
  return {
    entries: () => Array.from(modulePlugins.values()),
    lookupModule(input: {
      moduleKind: string;
      capabilityRef?: string | null;
    }): ManifestModulePluginLookup {
      const capabilityRef = typeof input.capabilityRef === 'string' ? input.capabilityRef.trim() : '';
      if (!capabilityRef) return { status: 'unclaimed' };
      const plugin = moduleKeysByCapability.get(`${input.moduleKind}::${capabilityRef}`);
      if (plugin) return { status: 'rendered', plugin };
      // A capability declared by an owned plugin set but without a plugin in
      // this composition is an explicit missing renderer, never a generic-card
      // fallback; undeclared capabilities stay on the central kind path.
      if (declaredModuleCapabilities.has(`${input.moduleKind}::${capabilityRef}`)) {
        return {
          status: 'missing',
          key: { moduleKind: input.moduleKind, capabilityRef },
          contract: {
            requirement: 'required',
            marker: `manifest-plugin-missing:${input.moduleKind}:${capabilityRef}`,
            reason: `能力 ${capabilityRef} 已声明但没有已注册的渲染插件。`,
          },
        };
      }
      return { status: 'unclaimed' };
    },
  };
}

export type ManifestPluginRegistry = ReturnType<typeof composeManifestPluginRegistry>;
