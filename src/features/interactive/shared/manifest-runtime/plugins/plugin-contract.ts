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
 * manifest boundary and resolves the exact key (category + module kind +
 * capability ref + contract version).
 */

export type ManifestPluginCategory = 'module' | 'activity' | 'layout';

export type ManifestPluginRole = 'student' | 'teacher';

export interface ManifestPluginKey {
  category: ManifestPluginCategory;
  /** Canonical `module.kind` (module plugins) or activity/layout kind the plugin serves. */
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
 * Activity plugins additionally declare the canonical response kind backing
 * their durable evidence when they submit structured output.
 */
export interface ManifestActivityPlugin<TPayload = unknown> extends ManifestModulePlugin<TPayload> {
  evidence: ManifestEvidenceBehavior & { classification: 'activity-response'; responseKind: string };
}

/**
 * Layout/template plugins declare region/template rendering and never receive
 * answer-bearing payloads unless their contract projects a role-safe view.
 */
export interface ManifestLayoutPlugin<TPayload = unknown> extends ManifestModulePlugin<TPayload> {
  templateId: string;
}

/**
 * Type-erased plugin entry for heterogeneous registry composition. The schema
 * and render generics are erased at the registry boundary; lookup consumers
 * receive the erased plugin and go through schema/projectRole.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyManifestModulePlugin = ManifestModulePlugin<any>;

export interface ManifestDeclaredModuleCapability {
  moduleKind: string;
  capabilityRef: string;
  /** Missing-renderer policy applied when this declared capability has no plugin. */
  missingRenderer: ManifestMissingRendererContract;
}

export interface ManifestPluginSet {
  owner: string;
  plugins: ReadonlyArray<AnyManifestModulePlugin>;
  /**
   * Capability domain this set claims, each with its missing-renderer policy.
   * A declared capability whose plugin is absent from the composed registry is
   * an explicit missing renderer; capabilities outside every declared domain
   * stay on the central kind registry path (unclaimed) until their owner
   * migrates them.
   */
  declaredModuleCapabilities?: ReadonlyArray<ManifestDeclaredModuleCapability>;
}

export class ManifestPluginRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestPluginRegistryError';
  }
}

export type ManifestPluginLookup =
  | { status: 'rendered'; plugin: ManifestModulePlugin<unknown> }
  | {
    status: 'missing';
    contract: ManifestMissingRendererContract;
    key: { moduleKind: string; capabilityRef: string; contractVersion?: string };
  }
  | { status: 'unclaimed' };

function pluginFullKey(key: ManifestPluginKey) {
  return `${key.category}::${key.moduleKind}::${key.capabilityRef}::${key.contractVersion}`;
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set(['module', 'activity', 'layout']);

type VersionedCapabilityIndex = Map<string, Map<string, ManifestModulePlugin<unknown>>>;

function indexCapability(index: VersionedCapabilityIndex, key: ManifestPluginKey, plugin: ManifestModulePlugin<unknown>) {
  const capabilityKey = `${key.moduleKind}::${key.capabilityRef}`;
  const versions = index.get(capabilityKey) ?? new Map<string, ManifestModulePlugin<unknown>>();
  versions.set(key.contractVersion, plugin);
  index.set(capabilityKey, versions);
}

function lookupVersioned(
  index: VersionedCapabilityIndex,
  declared: Map<string, ManifestMissingRendererContract>,
  input: {
    moduleKind: string;
    capabilityRef?: string | null;
    contractVersion?: string | null;
  },
): ManifestPluginLookup {
  const capabilityRef = typeof input.capabilityRef === 'string' ? input.capabilityRef.trim() : '';
  if (!capabilityRef) return { status: 'unclaimed' };
  const capabilityKey = `${input.moduleKind}::${capabilityRef}`;
  const versions = index.get(capabilityKey);
  if (versions && versions.size > 0) {
    if (input.contractVersion) {
      const plugin = versions.get(input.contractVersion);
      if (plugin) return { status: 'rendered', plugin };
      // The capability is registered under other versions only: an explicit
      // unregistered version must fail closed instead of falling back to the
      // central kind path (which would render an incompatible implementation).
      return {
        status: 'missing',
        key: { moduleKind: input.moduleKind, capabilityRef, contractVersion: input.contractVersion },
        contract: {
          requirement: 'required',
          marker: `manifest-plugin-version-missing:${input.moduleKind}:${capabilityRef}:${input.contractVersion}`,
          reason: `能力 ${capabilityRef} 已注册，但清单请求的合同版本 ${input.contractVersion} 未注册。`,
        },
      };
    } else if (versions.size === 1) {
      return { status: 'rendered', plugin: Array.from(versions.values())[0] };
    } else {
      // Multiple registered versions without an explicit request cannot be
      // resolved to one exact composite identity; fail explicitly instead of
      // choosing by set order.
      return {
        status: 'missing',
        key: { moduleKind: input.moduleKind, capabilityRef },
        contract: {
          requirement: 'required',
          marker: `manifest-plugin-ambiguous:${input.moduleKind}:${capabilityRef}`,
          reason: `能力 ${capabilityRef} 注册了多个合同版本，清单未声明版本，无法精确选择。`,
        },
      };
    }
  }
  const declaredContract = declared.get(capabilityKey);
  if (declaredContract) {
    return {
      status: 'missing',
      key: {
        moduleKind: input.moduleKind,
        capabilityRef,
        ...(input.contractVersion ? { contractVersion: input.contractVersion } : {}),
      },
      contract: declaredContract,
    };
  }
  return { status: 'unclaimed' };
}

/**
 * Compose a plugin registry from owned plugin sets. Duplicate composite keys,
 * unknown categories, empty capability references, missing contract versions,
 * and activity plugins without a response kind fail composition with both
 * owners named; two capabilities (or two versions) under one module kind
 * remain distinct entries.
 */
export function composeManifestPluginRegistry(sets: ReadonlyArray<ManifestPluginSet>) {
  const allPlugins = new Map<string, ManifestModulePlugin<unknown>>();
  const moduleIndex: VersionedCapabilityIndex = new Map();
  const activityIndex: VersionedCapabilityIndex = new Map();
  const layoutIndex: VersionedCapabilityIndex = new Map();
  const declaredModuleCapabilities = new Map<string, ManifestMissingRendererContract>();
  for (const set of sets) {
    if (!set.owner || typeof set.owner !== 'string') {
      throw new ManifestPluginRegistryError('Manifest plugin set requires an explicit owner.');
    }
    for (const declared of set.declaredModuleCapabilities ?? []) {
      if (declared.moduleKind && declared.capabilityRef?.trim() && declared.missingRenderer) {
        declaredModuleCapabilities.set(
          `${declared.moduleKind}::${declared.capabilityRef.trim()}`,
          declared.missingRenderer,
        );
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
      if (key.category === 'activity'
        && plugin.evidence.classification === 'activity-response'
        && !plugin.evidence.responseKind) {
        throw new ManifestPluginRegistryError(
          `Activity plugin from "${set.owner}" with activity-response evidence must declare its canonical response kind.`,
        );
      }
      if (key.category === 'layout' && !(plugin as ManifestLayoutPlugin).templateId) {
        throw new ManifestPluginRegistryError(
          `Layout plugin from "${set.owner}" must declare its template id.`,
        );
      }
      const fullKey = pluginFullKey(key);
      const existing = allPlugins.get(fullKey);
      if (existing) {
        throw new ManifestPluginRegistryError(
          `Duplicate manifest plugin identity ${fullKey}: claimed by "${existing.owner}" and "${plugin.owner ?? set.owner}".`,
        );
      }
      const owned: ManifestModulePlugin<unknown> = { ...plugin, owner: plugin.owner ?? set.owner };
      allPlugins.set(fullKey, owned);
      if (key.category === 'module') indexCapability(moduleIndex, key, owned);
      if (key.category === 'activity') indexCapability(activityIndex, key, owned);
      if (key.category === 'layout') indexCapability(layoutIndex, key, owned);
    }
  }
  return {
    entries: () => Array.from(allPlugins.values()),
    lookupModule(input: {
      moduleKind: string;
      capabilityRef?: string | null;
      contractVersion?: string | null;
    }): ManifestPluginLookup {
      return lookupVersioned(moduleIndex, declaredModuleCapabilities, input);
    },
    lookupActivity(input: {
      moduleKind: string;
      capabilityRef?: string | null;
      contractVersion?: string | null;
    }): ManifestPluginLookup {
      return lookupVersioned(activityIndex, new Map(), input);
    },
    lookupLayout(input: {
      moduleKind: string;
      capabilityRef?: string | null;
      contractVersion?: string | null;
    }): ManifestPluginLookup {
      return lookupVersioned(layoutIndex, new Map(), input);
    },
  };
}

export type ManifestPluginRegistry = ReturnType<typeof composeManifestPluginRegistry>;
