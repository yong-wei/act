import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  INTERACTIVE_MODULE_CANONICAL_CLASSES,
  INTERACTIVE_MODULE_COMPUTE_CAPABILITY_DEFINITIONS,
  INTERACTIVE_MODULE_DEFINITIONS,
  LEGACY_INTERACTIVE_MODULE_KIND_ALIASES,
  type InteractiveModuleCanonicalClass,
  type LegacyInteractiveModuleKindAlias,
} from './module-taxonomy';
import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeActivityCardManifest,
  type InteractiveRuntimeManifest,
  type InteractiveRuntimeModuleManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  isCanonicalInteractiveResponseKind,
  type InteractiveResponseKind,
} from '@/lib/interactive-response-contracts';

export type InteractiveModuleRegistryGateViolationCode =
  | 'unregistered-module-kind'
  | 'legacy-alias-in-migrated-lesson'
  | 'activity-missing-response-contract'
  | 'activity-unregistered-response-kind'
  | 'compute-missing-capability-ref'
  | 'compute-unregistered-capability-ref'
  | 'invalid-runtime-manifest'
  | 'lesson-missing-from-migrated-inventory';

export interface InteractiveModuleRegistryGateViolation {
  lessonId: string;
  stepId: string;
  moduleId: string;
  kind: string;
  code: InteractiveModuleRegistryGateViolationCode;
  message: string;
  canonicalClass?: InteractiveModuleCanonicalClass;
  responseKind?: string;
  capabilityRef?: string;
  manifestPath?: string;
}

export interface InteractiveModuleRegistryGateManifestInput {
  lessonId: string;
  manifest: InteractiveRuntimeManifest;
  manifestPath?: string;
}

export interface InteractiveModuleRegistryGateInput {
  manifests: InteractiveModuleRegistryGateManifestInput[];
  migratedLessonIds?: readonly string[];
}

export interface InteractiveModuleRegistryGateResult {
  passed: boolean;
  scannedModules: number;
  violations: InteractiveModuleRegistryGateViolation[];
}

type InteractiveModuleRegistryGateScanItem =
  | InteractiveModuleRegistryGateManifestInput
  | {
    lessonId: string;
    manifestPath: string;
    violation: InteractiveModuleRegistryGateViolation;
  };

type ModuleKindResolution =
  | {
    source: 'canonical';
    canonicalClass: InteractiveModuleCanonicalClass;
    alias?: never;
  }
  | {
    source: 'legacy-alias';
    canonicalClass: InteractiveModuleCanonicalClass;
    alias: LegacyInteractiveModuleKindAlias;
  }
  | {
    source: 'unknown';
  };

const CANONICAL_CLASSES = new Set<string>(INTERACTIVE_MODULE_CANONICAL_CLASSES);
const STEP_INTERACTION_RESPONSE_KIND_ALIASES: Record<string, InteractiveResponseKind> = {
  interactive_figure_submit: 'parameter.set',
  parameter_slider: 'parameter.set',
  rust_heading_rl_training_panel: 'parameter.set',
  rust_toy_training_panel: 'parameter.set',
};

const STEP_INTERACTIONS_ALLOWING_EMPTY_ACTIVITY_CARDS = new Set([
  'display',
  'none',
  'step_reveal',
  'summary',
  'teacher_reveal_only',
]);

export const STANDARD_MODULE_MIGRATED_LESSON_IDS = [
  '2-1',
  '2-2',
  '2-3',
  '2-4',
  '3-1',
  '3-2',
  '3-3',
  '3-4',
  '3-5',
  '3-6',
  '3-7',
  '3-8',
  '3-9',
  '4-1',
  '4-2',
  '4-3',
  '4-4',
  '4-5',
  '4-6',
  '4-7',
  '5-1',
  '5-2',
  '5-3',
  '5-4',
  '5-5',
  '5-6',
  'cruise-comfort-boppps',
] as const;

export function evaluateInteractiveModuleRegistryGate({
  manifests,
}: InteractiveModuleRegistryGateInput): InteractiveModuleRegistryGateResult {
  const violations: InteractiveModuleRegistryGateViolation[] = [];
  let scannedModules = 0;

  for (const item of manifests) {
    for (const step of item.manifest.steps) {
      const hasModuleLevelResponseContract = step.modules.some((runtimeModule) => {
        const resolution = resolveInteractiveModuleKind(runtimeModule.kind);
        if (resolution.source === 'unknown') return false;
        const definition = INTERACTIVE_MODULE_DEFINITIONS[resolution.canonicalClass];
        return Boolean(definition.requiresResponseContract)
          || Boolean(resolution.alias?.responseKind);
      });

      if (!hasModuleLevelResponseContract) {
        violations.push(...evaluateStepResponseContracts({
          lessonId: item.lessonId,
          manifestPath: item.manifestPath,
          step,
        }));
      }
      violations.push(...evaluateActivityCardResponseContracts({
        lessonId: item.lessonId,
        manifestPath: item.manifestPath,
        step,
      }));

      for (const runtimeModule of step.modules) {
        scannedModules += 1;
        violations.push(
          ...evaluateRuntimeModule({
            lessonId: item.lessonId,
            manifestPath: item.manifestPath,
            step,
            module: runtimeModule,
          }),
        );
      }
    }
  }

  return {
    passed: violations.length === 0,
    scannedModules,
    violations,
  };
}

export function scanRuntimeInteractiveModuleRegistry({
  rootDir = process.cwd(),
  migratedLessonIds = STANDARD_MODULE_MIGRATED_LESSON_IDS,
}: {
  rootDir?: string;
  migratedLessonIds?: readonly string[];
} = {}): InteractiveModuleRegistryGateResult {
  const lessonRoot = join(rootDir, 'course-content/runtime/lessons');
  const manifests = collectManifestPaths(lessonRoot)
    .map((manifestPath): InteractiveModuleRegistryGateScanItem => {
      const relativeManifestPath = relative(rootDir, manifestPath);
      const fallbackLessonId = lessonIdFromManifestPath(lessonRoot, manifestPath);
      try {
        const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
        if (!hasRuntimeManifestShape(raw)) {
          return {
            lessonId: fallbackLessonId,
            manifestPath: relativeManifestPath,
            violation: invalidManifestViolation(fallbackLessonId, relativeManifestPath),
          };
        }
        const manifest = normalizeInteractiveRuntimeManifest(raw);
        const lessonId = manifest?.lessonId || fallbackLessonId;
        if (!manifest) {
          return {
            lessonId,
            manifestPath: relativeManifestPath,
            violation: invalidManifestViolation(lessonId, relativeManifestPath),
          };
        }
        return {
          lessonId,
          manifest,
          manifestPath: relativeManifestPath,
        };
      } catch {
        return {
          lessonId: fallbackLessonId,
          manifestPath: relativeManifestPath,
          violation: invalidManifestViolation(fallbackLessonId, relativeManifestPath),
        };
      }
    });

  const validManifests: InteractiveModuleRegistryGateManifestInput[] = [];
  const invalidViolations: InteractiveModuleRegistryGateViolation[] = [];
  for (const item of manifests) {
    if ('manifest' in item) {
      validManifests.push(item);
    } else {
      invalidViolations.push(item.violation);
    }
  }
  const result = evaluateInteractiveModuleRegistryGate({
    manifests: validManifests,
    migratedLessonIds,
  });
  const inventoryViolations = missingMigratedInventoryViolations(validManifests, migratedLessonIds);

  return {
    passed: result.violations.length === 0 && invalidViolations.length === 0 && inventoryViolations.length === 0,
    scannedModules: result.scannedModules,
    violations: [...invalidViolations, ...inventoryViolations, ...result.violations],
  };
}

function evaluateRuntimeModule({
  lessonId,
  manifestPath,
  step,
  module,
}: {
  lessonId: string;
  manifestPath?: string;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
}): InteractiveModuleRegistryGateViolation[] {
  const violations: InteractiveModuleRegistryGateViolation[] = [];
  const resolution = resolveInteractiveModuleKind(module.kind);

  if (resolution.source === 'unknown') {
    return [
      violation({
        lessonId,
        manifestPath,
        step,
        module,
        code: 'unregistered-module-kind',
        message: `${lessonId} ${step.id} ${module.id} uses unregistered module kind ${module.kind}.`,
      }),
    ];
  }

  const definition = INTERACTIVE_MODULE_DEFINITIONS[resolution.canonicalClass];

  if (resolution.source === 'legacy-alias') {
    return [violation({
      lessonId,
      manifestPath,
      step,
      module,
      code: 'legacy-alias-in-migrated-lesson',
      canonicalClass: resolution.canonicalClass,
      message: `${lessonId} ${step.id} ${module.id} still uses legacy alias ${module.kind}; replace with ${resolution.canonicalClass}.`,
    })];
  }

  if (resolution.source === 'canonical' && (definition.migrationOnly || !definition.allowedInNewAuthoring)) {
    violations.push(violation({
      lessonId,
      manifestPath,
      step,
      module,
      code: 'legacy-alias-in-migrated-lesson',
      canonicalClass: resolution.canonicalClass,
      message: `${lessonId} ${step.id} ${module.id} still uses migration-only module class ${resolution.canonicalClass}.`,
    }));
  }

  const requiresResponseContract = Boolean(definition.requiresResponseContract);

  if (requiresResponseContract) {
    const responseKindChecks = collectResponseKindChecks(step, module);
    if (responseKindChecks.length === 0) {
      violations.push(violation({
        lessonId,
        manifestPath,
        step,
        module,
        code: 'activity-missing-response-contract',
        canonicalClass: resolution.canonicalClass,
        message: `${lessonId} ${step.id} ${module.id} is an activity module without a registered response contract.`,
      }));
    } else {
      for (const responseKindCheck of responseKindChecks) {
        if (
          responseKindCheck.source === 'module'
          && !responseKindCheck.normalized
        ) {
          violations.push(violation({
            lessonId,
            manifestPath,
            step,
            module,
            code: 'activity-unregistered-response-kind',
            canonicalClass: resolution.canonicalClass,
            responseKind: responseKindCheck.raw,
            message: `${lessonId} ${step.id} ${module.id} uses unregistered response kind ${responseKindCheck.raw}.`,
          }));
        }
      }
    }
  }

  if (definition.requiresCapabilityRef) {
    const capabilityRef = capabilityRefForModule(module);
    if (!capabilityRef) {
      violations.push(violation({
        lessonId,
        manifestPath,
        step,
        module,
        code: 'compute-missing-capability-ref',
        canonicalClass: resolution.canonicalClass,
        message: `${lessonId} ${step.id} ${module.id} is compute.panel without a capability reference.`,
      }));
    } else if (!INTERACTIVE_MODULE_COMPUTE_CAPABILITY_DEFINITIONS[capabilityRef]) {
      violations.push(violation({
        lessonId,
        manifestPath,
        step,
        module,
        code: 'compute-unregistered-capability-ref',
        canonicalClass: resolution.canonicalClass,
        capabilityRef,
        message: `${lessonId} ${step.id} ${module.id} uses unregistered compute capability ${capabilityRef}.`,
      }));
    }
  }

  return violations;
}

function evaluateStepResponseContracts({
  lessonId,
  manifestPath,
  step,
}: {
  lessonId: string;
  manifestPath?: string;
  step: InteractiveRuntimeStepManifest;
}): InteractiveModuleRegistryGateViolation[] {
  if (step.interactionSpec.activityCards?.length) {
    return [];
  }
  const rawResponseKinds = responseKindsFromActivityCards(step.interactionSpec.activityCards);
  if (rawResponseKinds.length === 0) {
    const stepResponseKind = STEP_INTERACTION_RESPONSE_KIND_ALIASES[step.interactionSpec.interactionKind];
    if (stepResponseKind && isCanonicalInteractiveResponseKind(stepResponseKind)) {
      return [];
    }
    if ((step.interactionSpec.submitFields ?? []).length > 0) {
      return [{
        lessonId,
        stepId: step.id,
        moduleId: '(step)',
        kind: step.interactionSpec.interactionKind,
        code: 'activity-missing-response-contract',
        message: `${lessonId} ${step.id} has submit fields without a registered response contract.`,
        ...(manifestPath ? { manifestPath } : {}),
      }];
    }
    if (!STEP_INTERACTIONS_ALLOWING_EMPTY_ACTIVITY_CARDS.has(step.interactionSpec.interactionKind)) {
      return [{
        lessonId,
        stepId: step.id,
        moduleId: '(step)',
        kind: step.interactionSpec.interactionKind,
        code: 'activity-missing-response-contract',
        message: `${lessonId} ${step.id} has response-producing interaction ${step.interactionSpec.interactionKind} without activity card response contracts.`,
        ...(manifestPath ? { manifestPath } : {}),
      }];
    }
    return [];
  }

  return rawResponseKinds
    .map((rawResponseKind) => ({
      raw: rawResponseKind,
      normalized: normalizeResponseKind(rawResponseKind),
    }))
    .filter((responseKindCheck) => !responseKindCheck.normalized)
    .map((responseKindCheck) => ({
      lessonId,
      stepId: step.id,
      moduleId: '(step)',
      kind: step.interactionSpec.interactionKind,
      code: 'activity-unregistered-response-kind' as const,
      message: `${lessonId} ${step.id} has unregistered response kind ${responseKindCheck.raw}.`,
      responseKind: responseKindCheck.raw,
      ...(manifestPath ? { manifestPath } : {}),
    }));
}

function evaluateActivityCardResponseContracts({
  lessonId,
  manifestPath,
  step,
}: {
  lessonId: string;
  manifestPath?: string;
  step: InteractiveRuntimeStepManifest;
}): InteractiveModuleRegistryGateViolation[] {
  return (step.interactionSpec.activityCards ?? []).flatMap((card, index): InteractiveModuleRegistryGateViolation[] => {
    const rawResponseKind = stringValue(card.responseKind);
    const legacyResponseKind = stringValue(card.legacyResponseKind);
    const moduleId = card.id || `(activity-card-${index + 1})`;
    if (legacyResponseKind) {
      return [{
        lessonId,
        stepId: step.id,
        moduleId,
        kind: step.interactionSpec.interactionKind,
        code: 'activity-unregistered-response-kind' as const,
        responseKind: legacyResponseKind,
        message: `${lessonId} ${step.id} ${moduleId} uses legacy response kind ${legacyResponseKind}; replace with ${card.responseKind}.`,
        ...(manifestPath ? { manifestPath } : {}),
      }];
    }
    if (!rawResponseKind) {
      return [{
        lessonId,
        stepId: step.id,
        moduleId,
        kind: step.interactionSpec.interactionKind,
        code: 'activity-missing-response-contract' as const,
        message: `${lessonId} ${step.id} ${moduleId} is an activity card without a registered response contract.`,
        ...(manifestPath ? { manifestPath } : {}),
      }];
    }
    const normalized = normalizeResponseKind(rawResponseKind);
    if (!normalized) {
      return [{
        lessonId,
        stepId: step.id,
        moduleId,
        kind: step.interactionSpec.interactionKind,
        code: 'activity-unregistered-response-kind' as const,
        responseKind: rawResponseKind,
        message: `${lessonId} ${step.id} ${moduleId} uses unregistered response kind ${rawResponseKind}.`,
        ...(manifestPath ? { manifestPath } : {}),
      }];
    }
    return [];
  });
}

function resolveInteractiveModuleKind(kind: string): ModuleKindResolution {
  if (CANONICAL_CLASSES.has(kind)) {
    return {
      source: 'canonical',
      canonicalClass: kind as InteractiveModuleCanonicalClass,
    };
  }
  const alias = LEGACY_INTERACTIVE_MODULE_KIND_ALIASES[kind as keyof typeof LEGACY_INTERACTIVE_MODULE_KIND_ALIASES];
  if (alias) {
    return {
      source: 'legacy-alias',
      canonicalClass: alias.canonicalClass,
      alias,
    };
  }
  return { source: 'unknown' };
}

function collectResponseKindChecks(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
): Array<{ raw: string; normalized: InteractiveResponseKind | null; source: 'module' | 'activity-card' | 'step' }> {
  const stepResponseKind = STEP_INTERACTION_RESPONSE_KIND_ALIASES[step.interactionSpec.interactionKind];
  const rawKinds = [
    ...[
      stringValue(module.payload.responseKind),
      stringValue(module.payload.response_kind),
    ]
      .filter((kind): kind is string => Boolean(kind))
      .map((raw) => ({ raw, source: 'module' as const })),
    ...responseKindsFromActivityCards(step.interactionSpec.activityCards)
      .map((raw) => ({ raw, source: 'activity-card' as const })),
    ...(stepResponseKind ? [{ raw: stepResponseKind, source: 'step' as const }] : []),
  ];
  return uniqueResponseKindChecks(rawKinds).map(({ raw, source }) => ({
    raw,
    source,
    normalized: normalizeResponseKind(raw),
  }));
}

function uniqueResponseKindChecks(
  checks: Array<{ raw: string; source: 'module' | 'activity-card' | 'step' }>,
): Array<{ raw: string; source: 'module' | 'activity-card' | 'step' }> {
  const seen = new Set<string>();
  return checks.filter((check) => {
    const key = `${check.source}:${check.raw}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function responseKindsFromActivityCards(
  activityCards: InteractiveRuntimeActivityCardManifest[] | undefined,
): string[] {
  if (!activityCards?.length) return [];
  return activityCards.map((card) => card.responseKind).filter(Boolean);
}

function normalizeResponseKind(kind: string | null | undefined): InteractiveResponseKind | null {
  if (!kind) return null;
  return isCanonicalInteractiveResponseKind(kind) ? kind : null;
}

function capabilityRefForModule(
  module: InteractiveRuntimeModuleManifest,
) {
  return stringValue(module.payload.capabilityRef)
    ?? stringValue(module.payload.capability_ref)
    ?? stringValue(module.payload.capability);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function hasRuntimeManifestShape(raw: unknown): raw is { steps: Record<string, unknown> } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const steps = (raw as { steps?: unknown }).steps;
  return Boolean(steps)
    && steps !== null
    && typeof steps === 'object'
    && !Array.isArray(steps)
    && Object.keys(steps).length > 0;
}

function violation({
  lessonId,
  manifestPath,
  step,
  module,
  code,
  message,
  canonicalClass,
  responseKind,
  capabilityRef,
}: {
  lessonId: string;
  manifestPath?: string;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  code: InteractiveModuleRegistryGateViolationCode;
  message: string;
  canonicalClass?: InteractiveModuleCanonicalClass;
  responseKind?: string;
  capabilityRef?: string;
}): InteractiveModuleRegistryGateViolation {
  return {
    lessonId,
    stepId: step.id,
    moduleId: module.id,
    kind: module.kind,
    code,
    message,
    ...(canonicalClass ? { canonicalClass } : {}),
    ...(responseKind ? { responseKind } : {}),
    ...(capabilityRef ? { capabilityRef } : {}),
    ...(manifestPath ? { manifestPath } : {}),
  };
}

function invalidManifestViolation(
  lessonId: string,
  manifestPath: string,
): InteractiveModuleRegistryGateViolation {
  return {
    lessonId,
    stepId: '',
    moduleId: '',
    kind: '',
    code: 'invalid-runtime-manifest',
    message: `${manifestPath} is not a valid runtime interactive manifest.`,
    manifestPath,
  };
}

function missingMigratedInventoryViolations(
  manifests: InteractiveModuleRegistryGateManifestInput[],
  migratedLessonIds: readonly string[],
): InteractiveModuleRegistryGateViolation[] {
  const migratedLessons = new Set(migratedLessonIds);
  const seen = new Set<string>();
  const violations: InteractiveModuleRegistryGateViolation[] = [];
  for (const item of manifests) {
    if (migratedLessons.has(item.lessonId) || seen.has(item.lessonId)) continue;
    seen.add(item.lessonId);
    violations.push({
      lessonId: item.lessonId,
      stepId: '',
      moduleId: '(lesson)',
      kind: '',
      code: 'lesson-missing-from-migrated-inventory',
      message: `${item.lessonId} has a runtime interactive manifest but is missing from the standard module migrated lesson inventory.`,
      ...(item.manifestPath ? { manifestPath: item.manifestPath } : {}),
    });
  }
  return violations;
}

function collectManifestPaths(root: string): string[] {
  if (!existsSync(root)) return [];
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

function lessonIdFromManifestPath(lessonRoot: string, manifestPath: string) {
  return relative(lessonRoot, manifestPath).split('/')[0] ?? '';
}
