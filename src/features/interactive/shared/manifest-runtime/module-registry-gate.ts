import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS,
  INTERACTIVE_MODULE_CANONICAL_CLASSES,
  INTERACTIVE_MODULE_COMPUTE_CAPABILITY_DEFINITIONS,
  INTERACTIVE_MODULE_DEFINITIONS,
  LEGACY_INTERACTIVE_MODULE_KIND_ALIASES,
  isControlWorkbenchComputeCapabilityRef,
  type InteractiveModuleCanonicalClass,
  type LegacyInteractiveModuleKindAlias,
} from './module-taxonomy';
import { resolveInteractiveModuleVisualStandard } from './module-visual-standards';
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
  | 'code-like-content-outside-code-module'
  | 'code-module-missing-source'
  | 'compute-missing-capability-ref'
  | 'compute-generic-control-analysis-carrier'
  | 'compute-control-migration-exception-invalid'
  | 'compute-static-surface-payload-invalid'
  | 'compute-unregistered-capability-ref'
  | 'course-private-control-panel-duplicate'
  | 'course-private-control-panel-exception-invalid'
  | 'course-local-module-chrome'
  | 'invalid-runtime-manifest'
  | 'lesson-missing-from-standard-module-inventory'
  | 'non-interactive-status-module';

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
  standardModuleLessonIds?: readonly string[];
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

const NON_INTERACTIVE_STATUS_PATTERNS = [
  /本页互动状态/,
  /互动状态模块/,
  /page interaction status/i,
  /interaction status module/i,
];

const CODE_LIKE_CONTENT_PATTERN = /\b(tf|step|rlocus|bode|margin|feedback|isstable|figure|grid|legend)\s*\(|(^|\n)\s*%|;\s*%/i;
const CONTROL_ANALYSIS_CARRIER_PATTERN = /\b(control|bode|nyquist|root[\s_-]?locus|phase[\s_-]?plane|frequency|rust|wasm|pid|rl|training|parameter|response|ship|pole|radius|gain|risk|prediction|route|harmonic|relay|nonlinear|inverse|mpc|compare)\b/i;
const COURSE_PRIVATE_CONTROL_PANEL_SOURCE_PATTERN = /\b(ControlFigureWorkspace|CONTROL_ANALYSIS_PANELS|TimeDomainPanel|BodePanel|NyquistPanel|RootLocusPanel|StepResponsePanel|ControlPerformanceBar|useControlEngine|ControlAnalysisRequest|fallbackResult|Rust\/WASM|WASM|wasm|root[\s_-]?locus|Nyquist|Bode|time[\s_-]?domain|frequency[\s_-]?domain|performance metric)\b/i;
const COURSE_LOCAL_CHROME_KEYS = [
  'className',
  'class_name',
  'chromeClassName',
  'chrome_class_name',
  'moduleChrome',
  'module_chrome',
  'localChrome',
  'local_chrome',
  'visualChrome',
  'visual_chrome',
  'wrapperClassName',
  'wrapper_class_name',
];

export const STANDARD_MODULE_ENFORCED_LESSON_IDS = [
  '1-1',
  '1-2',
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

export const STANDARD_MODULE_MIGRATED_LESSON_IDS = STANDARD_MODULE_ENFORCED_LESSON_IDS;

type ControlWorkbenchMigrationException = {
  issueId: string;
  owner: string;
  removalCondition: string;
  expiresOn: string;
};

type InteractiveCoursePrivateControlPanelSourceInput = {
  path: string;
  source: string;
};

const CONTROL_ANALYSIS_INTERACTIVE_FIGURE_MIGRATION_EXCEPTIONS: Record<string, ControlWorkbenchMigrationException> = {
  '1-2/step-10/drag-pole-panel': migrationException('560', 'interactive-course-visual-components', 'replace with control-root-locus-design-map or a shared non-control visual panel'),
  '1-2/step-11/ship-simulation': migrationException('560', 'interactive-course-visual-components', 'replace with control-linked-comparison or a shared response-comparison panel'),
  '3-8/step-18/compare-2x2-figure': migrationException('560', 'interactive-course-visual-components', 'replace with control-linked-comparison'),
  '4-1/step-04/ship-quad-figure': migrationException('560', 'interactive-course-visual-components', 'replace with control-linked-comparison'),
  '4-2/step-14/example-5-4-panel': migrationException('560', 'interactive-course-visual-components', 'replace with control-frequency-reading-workbench'),
  '4-2/step-17/ship-compare-panel': migrationException('560', 'interactive-course-visual-components', 'replace with control-linked-comparison'),
  '5-2/step-06/phase-rust-tabs': migrationException('560', 'interactive-course-visual-components', 'replace with nonlinear-analysis-workbench'),
  '5-2/step-07/harmonic-rust-panel': migrationException('560', 'interactive-course-visual-components', 'replace with nonlinear-analysis-workbench'),
  '5-2/step-08/memoryless-rust-panel': migrationException('560', 'interactive-course-visual-components', 'replace with nonlinear-analysis-workbench'),
  '5-2/step-09/relay-rust-panel': migrationException('560', 'interactive-course-visual-components', 'replace with nonlinear-analysis-workbench'),
  '5-2/step-12/negative-inverse-rust-panel': migrationException('560', 'interactive-course-visual-components', 'replace with nonlinear-analysis-workbench'),
  '5-3/step-11/turning-rust-panel': migrationException('560', 'interactive-course-visual-components', 'replace with nonlinear-analysis-workbench'),
  '5-4/step-06/prediction-panel': migrationException('560', 'interactive-course-visual-components', 'replace with control-linked-comparison'),
  '5-4/step-14/route-compare-panel': migrationException('560', 'interactive-course-visual-components', 'replace with control-linked-comparison'),
  '5-5/step-08/toy-training-panel': migrationException('560', 'interactive-course-visual-components', 'replace with training-workbench'),
  '5-5/step-15/heading-rl-training-panel': migrationException('560', 'interactive-course-visual-components', 'replace with training-workbench'),
  '5-6/step-11/route-panel': migrationException('560', 'interactive-course-visual-components', 'replace with control-linked-comparison'),
};

const COURSE_PRIVATE_CONTROL_PANEL_SOURCE_MIGRATION_EXCEPTIONS: Record<string, ControlWorkbenchMigrationException> = {
  'src/features/interactive/unit-1-1-see-the-full-picture/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local control visuals with shared workbench capability modules'),
  'src/features/interactive/unit-2-3-frequency-response/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local frequency visuals with control-frequency-reading-workbench'),
  'src/features/interactive/unit-2-4-nyquist-margin-entry/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local Nyquist visuals with control-frequency-reading-workbench'),
  'src/features/interactive/unit-2-4-nyquist-margin-entry/workspace.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local Nyquist workspace with control-frequency-reading-workbench'),
  'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/interactive-exploration-panel.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local pole exploration with control-root-locus-design-map'),
  'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local pole panels with control-root-locus-design-map'),
  'src/features/interactive/unit-3-2-routh-stability-boundary/analysis-workspace.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local stability workspace with shared control workbench capability modules'),
  'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local stability panels with shared control workbench capability modules'),
  'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local root-locus panels with control-root-locus-design-map'),
  'src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local root-locus reading panels with control-root-locus-design-map'),
  'src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local root-locus reading workspace with control-root-locus-design-map'),
  'src/features/interactive/unit-3-5-zero-dynamic-improvement/root-locus-workspace.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local root-locus workspace with control-root-locus-design-map'),
  'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local zero-design panels with control-root-locus-design-map'),
  'src/features/interactive/unit-3-5-zero-dynamic-improvement/workspace.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local zero-design workspace with control-root-locus-design-map'),
  'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local zero-design panels with control-root-locus-design-map'),
  'src/features/interactive/unit-3-6-zero-design-workshop/submission-telemetry.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local telemetry payload with shared workbench evidence contract'),
  'src/features/interactive/unit-3-6-zero-design-workshop/workspace.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local zero-design workspace with control-root-locus-design-map'),
  'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local steady-error panels with shared control workbench capability modules'),
  'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local steady-error workspace with shared control workbench capability modules'),
  'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local frequency panels with control-frequency-reading-workbench'),
  'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/workspace.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local frequency workspace with control-frequency-reading-workbench'),
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local mapping panels with control-linked-comparison'),
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/workspace.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local mapping workspace with control-linked-comparison'),
  'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local design-task panels with control-linked-comparison'),
  'src/features/interactive/unit-4-2-controller-selection-first-start/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local controller-selection panels with control-frequency-reading-workbench'),
  'src/features/interactive/unit-4-3-initial-scheme-practice-first-validation/step-panels.tsx': migrationException('560', 'interactive-course-visual-components', 'replace course-local scheme-validation panels with shared control workbench capability modules'),
  'src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts': migrationException('560', 'interactive-course-visual-components', 'replace course-local training runtime with training-workbench'),
};

function migrationException(
  issueId: string,
  owner: string,
  removalCondition: string,
): ControlWorkbenchMigrationException {
  return {
    issueId,
    owner,
    removalCondition,
    expiresOn: '2026-12-31',
  };
}

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
      violations.push(...evaluateNoInteractionStatusModules({
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
  standardModuleLessonIds,
  migratedLessonIds,
}: {
  rootDir?: string;
  standardModuleLessonIds?: readonly string[];
  migratedLessonIds?: readonly string[];
} = {}): InteractiveModuleRegistryGateResult {
  const enforcedLessonIds = standardModuleLessonIds ?? migratedLessonIds ?? STANDARD_MODULE_ENFORCED_LESSON_IDS;
  const lessonRoot = join(rootDir, 'course-content/runtime/lessons');
  const rawLocalChromeViolations: InteractiveModuleRegistryGateViolation[] = [];
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
        rawLocalChromeViolations.push(
          ...rawCourseLocalChromeViolations(raw, fallbackLessonId, relativeManifestPath),
        );
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
    standardModuleLessonIds: enforcedLessonIds,
  });
  const inventoryViolations = missingStandardModuleInventoryViolations(validManifests, enforcedLessonIds);
  const sourceViolations = evaluateInteractiveCoursePrivateControlPanelSourceGate(
    collectCoursePrivateControlPanelSourceFiles(join(rootDir, 'src/features/interactive'), rootDir),
  );

  return {
    passed: result.violations.length === 0
      && invalidViolations.length === 0
      && inventoryViolations.length === 0
      && rawLocalChromeViolations.length === 0
      && sourceViolations.length === 0,
    scannedModules: result.scannedModules,
    violations: [
      ...invalidViolations,
      ...rawLocalChromeViolations,
      ...inventoryViolations,
      ...sourceViolations,
      ...result.violations,
    ],
  };
}

export function evaluateInteractiveCoursePrivateControlPanelSourceGate(
  files: readonly InteractiveCoursePrivateControlPanelSourceInput[],
): InteractiveModuleRegistryGateViolation[] {
  return files.flatMap((file): InteractiveModuleRegistryGateViolation[] => {
    if (!isCoursePrivateInteractiveSourcePath(file.path)) return [];
    if (!COURSE_PRIVATE_CONTROL_PANEL_SOURCE_PATTERN.test(file.source)) return [];
    const registeredException = sourceMigrationExceptionForPath(file.path);
    if (hasCompleteMigrationException(registeredException)) return [];
    if (sourceHasValidMigrationException(file.source)) return [];
    return [{
      lessonId: lessonIdFromInteractiveSourcePath(file.path),
      stepId: '',
      moduleId: '',
      kind: '',
      code: sourceHasMigrationExceptionMarker(file.source)
        ? 'course-private-control-panel-exception-invalid'
        : 'course-private-control-panel-duplicate',
      message: `${file.path} duplicates shared control workbench panel behavior; use ${CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS.join(', ')} or document a migration exception with issue id, owner, removal condition, and expiry.`,
      manifestPath: file.path,
    }];
  });
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
  const visualStandard = resolveInteractiveModuleVisualStandard(module.kind);

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

  if (!visualStandard) {
    violations.push(violation({
      lessonId,
      manifestPath,
      step,
      module,
      code: 'unregistered-module-kind',
      canonicalClass: resolution.canonicalClass,
      message: `${lessonId} ${step.id} ${module.id} has no registered visual standard for ${module.kind}.`,
    }));
  } else if (
    !visualStandard.projectionSafe
    || visualStandard.projectionTypography !== 'projection-readable'
    || visualStandard.geometry !== 'stable-panel'
  ) {
    violations.push(violation({
      lessonId,
      manifestPath,
      step,
      module,
      code: 'course-local-module-chrome',
      canonicalClass: resolution.canonicalClass,
      message: `${lessonId} ${step.id} ${module.id} has a visual standard that is not projection-safe.`,
    }));
  }

  const localChromeKey = localChromeOverrideKey(module);
  if (localChromeKey) {
    violations.push(violation({
      lessonId,
      manifestPath,
      step,
      module,
      code: 'course-local-module-chrome',
      canonicalClass: resolution.canonicalClass,
      message: `${lessonId} ${step.id} ${module.id} uses course-local module chrome field ${localChromeKey}; register shared chrome instead.`,
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
    } else if (capabilityRef === 'interactive-figure' && isGenericControlAnalysisCarrier(lessonId, step, module)) {
      const exception = controlAnalysisCarrierMigrationException(lessonId, step, module);
      if (!hasCompleteMigrationException(exception)) {
        violations.push(violation({
          lessonId,
          manifestPath,
          step,
          module,
          code: exception
            ? 'compute-control-migration-exception-invalid'
            : 'compute-generic-control-analysis-carrier',
          canonicalClass: resolution.canonicalClass,
          capabilityRef,
          message: `${lessonId} ${step.id} ${module.id} uses interactive-figure as a generic control-analysis carrier; use a registered shared capability such as ${CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS.join(', ')} or add a complete migration exception.`,
        }));
      }
    } else if (isControlWorkbenchComputeCapabilityRef(capabilityRef)) {
      const missingFields = missingControlWorkbenchPayloadFields(module.payload);
      if (missingFields.length) {
        violations.push(violation({
          lessonId,
          manifestPath,
          step,
          module,
          code: 'compute-control-migration-exception-invalid',
          canonicalClass: resolution.canonicalClass,
          capabilityRef,
          message: `${lessonId} ${step.id} ${module.id} shared control workbench payload is missing ${missingFields.join(', ')}.`,
        }));
      }
    } else if (capabilityRef === 'static-surface-3d') {
      const missingFields = missingStaticSurfacePayloadFields(module.payload);
      if (missingFields.length) {
        violations.push(violation({
          lessonId,
          manifestPath,
          step,
          module,
          code: 'compute-static-surface-payload-invalid',
          canonicalClass: resolution.canonicalClass,
          capabilityRef,
          message: `${lessonId} ${step.id} ${module.id} static-surface-3d payload is missing ${missingFields.join(', ')}.`,
        }));
      }
    }
  }

  if (resolution.canonicalClass === 'content.code') {
    const source = codeSourceForModule(step, module);
    if (!source.code) {
      violations.push(violation({
        lessonId,
        manifestPath,
        step,
        module,
        code: 'code-module-missing-source',
        canonicalClass: resolution.canonicalClass,
        message: `${lessonId} ${step.id} ${module.id} is content.code without code text.`,
      }));
    }
  } else if (
    ['content.rich', 'content.formula', 'content.reveal'].includes(resolution.canonicalClass)
    && hasCodeLikeVisibleContent(step, module)
  ) {
    violations.push(violation({
      lessonId,
      manifestPath,
      step,
      module,
      code: 'code-like-content-outside-code-module',
      canonicalClass: resolution.canonicalClass,
      message: `${lessonId} ${step.id} ${module.id} carries code-like visible content outside content.code.`,
    }));
  }

  return violations;
}

function isGenericControlAnalysisCarrier(
  lessonId: string,
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
): boolean {
  const candidateText = [
    lessonId,
    step.id,
    step.title,
    module.id,
    module.title ?? '',
    visibleTextFromUnknown(module.payload),
  ].join('\n');
  return CONTROL_ANALYSIS_CARRIER_PATTERN.test(candidateText);
}

function controlAnalysisCarrierMigrationException(
  lessonId: string,
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
): ControlWorkbenchMigrationException | undefined {
  const payloadException = recordValue(module.payload.migrationException ?? module.payload.migration_exception);
  const key = `${lessonId}/${step.id}/${module.id}`;
  const registeredException = CONTROL_ANALYSIS_INTERACTIVE_FIGURE_MIGRATION_EXCEPTIONS[key];
  if (Object.keys(payloadException).length === 0) return registeredException;
  return {
    issueId: stringValue(payloadException.issueId ?? payloadException.issue_id ?? payloadException.issue),
    owner: stringValue(payloadException.owner),
    removalCondition: stringValue(payloadException.removalCondition ?? payloadException.removal_condition),
    expiresOn: stringValue(payloadException.expiresOn ?? payloadException.expires_on ?? payloadException.expiry),
  } as ControlWorkbenchMigrationException;
}

function hasCompleteMigrationException(exception: ControlWorkbenchMigrationException | undefined): boolean {
  if (!exception) return false;
  const { issueId, owner, removalCondition, expiresOn } = exception;
  return Boolean(
    typeof issueId === 'string'
      && /^#?\d+$/.test(issueId)
      && typeof owner === 'string'
      && owner.trim()
      && typeof removalCondition === 'string'
      && removalCondition.trim()
      && typeof expiresOn === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(expiresOn),
  );
}

function missingControlWorkbenchPayloadFields(payload: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (!Array.isArray(payload.visiblePanelIds) && !Array.isArray(payload.visible_panel_ids) && !Array.isArray(payload.panels)) {
    missing.push('visiblePanelIds');
  }
  if (!stringValue(payload.responseContractId ?? payload.response_contract_id ?? payload.responseKind ?? payload.response_kind)) {
    missing.push('responseContractId');
  }
  if (!objectValue(payload.request ?? payload.analysisRequest ?? payload.analysis_request)) {
    missing.push('request');
  }
  return missing;
}

function sourceMigrationExceptionForPath(path: string): ControlWorkbenchMigrationException | undefined {
  return COURSE_PRIVATE_CONTROL_PANEL_SOURCE_MIGRATION_EXCEPTIONS[path.replace(/^\.\//, '')];
}

function collectCoursePrivateControlPanelSourceFiles(
  root: string,
  baseDir = process.cwd(),
): InteractiveCoursePrivateControlPanelSourceInput[] {
  if (!existsSync(root)) return [];
  const result: InteractiveCoursePrivateControlPanelSourceInput[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectCoursePrivateControlPanelSourceFiles(fullPath, baseDir));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      result.push({
        path: relative(baseDir, fullPath),
        source: readFileSync(fullPath, 'utf8'),
      });
    }
  }
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function evaluateNoInteractionStatusModules({
  lessonId,
  manifestPath,
  step,
}: {
  lessonId: string;
  manifestPath?: string;
  step: InteractiveRuntimeStepManifest;
}): InteractiveModuleRegistryGateViolation[] {
  if (!isNonInteractiveStep(step)) return [];

  return step.modules
    .filter((module) => NON_INTERACTIVE_STATUS_PATTERNS.some((pattern) => pattern.test(moduleVisibleText(module))))
    .map((module) => ({
      lessonId,
      stepId: step.id,
      moduleId: module.id,
      kind: module.kind,
      code: 'non-interactive-status-module' as const,
      message: `${lessonId} ${step.id} ${module.id} exposes a generic interaction status module on a non-interactive page.`,
      ...(manifestPath ? { manifestPath } : {}),
    }));
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

function missingStaticSurfacePayloadFields(payload: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const data = objectValue(payload.data) ?? objectValue(payload.dataSource) ?? objectValue(payload.surfaceData);
  const axes = objectValue(payload.axes);
  const colorScale = objectValue(payload.colorScale) ?? objectValue(payload.color_scale);
  const defaultCamera = objectValue(payload.defaultCamera) ?? objectValue(payload.default_camera);
  const fallback = objectValue(payload.fallback);

  if (!data || !hasStaticSurfaceData(data)) {
    missing.push('data');
  }
  if (!axes || !axisHasLabel(axes.x) || !axisHasLabel(axes.y) || !axisHasLabel(axes.z)) {
    missing.push('axes.x/y/z.label');
  }
  if (!colorScale || !stringValue(colorScale.label)) {
    missing.push('colorScale.label');
  }
  if (!defaultCamera || !Array.isArray(defaultCamera.position) || !Array.isArray(defaultCamera.target)) {
    missing.push('defaultCamera.position/target');
  }
  if (!fallback || !stringValue(fallback.image) || !stringValue(fallback.alt)) {
    missing.push('fallback.image/alt');
  }
  return missing;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function axisHasLabel(value: unknown): boolean {
  const axis = objectValue(value);
  return Boolean(axis && stringValue(axis.label));
}

function hasStaticSurfaceData(data: Record<string, unknown>): boolean {
  return Boolean(
    stringValue(data.url)
      || stringValue(data.src)
      || stringValue(data.path)
      || hasStaticSurfaceRegularGrid(objectValue(data.regularGrid))
      || hasStaticSurfaceMesh(data),
  );
}

function isCoursePrivateInteractiveSourcePath(path: string): boolean {
  return /(^|\/)src\/features\/interactive\/unit-[^/]+\/.+\.(ts|tsx)$/.test(path)
    && !/(^|\/)__tests__\//.test(path);
}

function lessonIdFromInteractiveSourcePath(path: string): string {
  const match = path.match(/src\/features\/interactive\/(unit-[^/]+)/);
  return match?.[1] ?? '(unknown-lesson)';
}

function sourceHasMigrationExceptionMarker(source: string): boolean {
  return /controlWorkbenchMigrationException|control-workbench-migration-exception/i.test(source);
}

function sourceHasValidMigrationException(source: string): boolean {
  if (!sourceHasMigrationExceptionMarker(source)) return false;
  return /issue(?:Id)?\s*[:=]\s*['"]#?\d+['"]/i.test(source)
    && /owner\s*[:=]\s*['"][^'"]+['"]/i.test(source)
    && /removalCondition\s*[:=]\s*['"][^'"]+['"]/i.test(source)
    && /(expiresOn|expiry)\s*[:=]\s*['"]\d{4}-\d{2}-\d{2}['"]/i.test(source);
}

function hasStaticSurfaceRegularGrid(grid: Record<string, unknown> | null): boolean {
  if (!grid) return false;
  const x = numericArray(grid.x);
  const y = numericArray(grid.y);
  if (x.length < 2 || y.length < 2) return false;
  if (!Array.isArray(grid.values) || grid.values.length !== y.length) return false;
  return grid.values.every((row) => numericArray(row).length === x.length);
}

function hasStaticSurfaceMesh(data: Record<string, unknown>): boolean {
  if (!Array.isArray(data.vertices) || data.vertices.length < 3) return false;
  if (!data.vertices.every((vertex) => numericTuple3(vertex))) return false;
  if (!Array.isArray(data.indices) || !data.indices.length) return false;
  if (Array.isArray(data.indices[0])) {
    return data.indices.every((triangle) => numericTuple3(triangle));
  }
  return data.indices.every((index) => Number.isInteger(index)) && data.indices.length % 3 === 0;
}

function numericArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function numericTuple3(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === 3
    && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function isNonInteractiveStep(step: InteractiveRuntimeStepManifest) {
  return STEP_INTERACTIONS_ALLOWING_EMPTY_ACTIVITY_CARDS.has(step.interactionSpec.interactionKind)
    && !(step.interactionSpec.activityCards?.length)
    && !(step.interactionSpec.submitFields?.length);
}

function moduleVisibleText(module: InteractiveRuntimeModuleManifest) {
  return [
    module.id,
    module.kind,
    module.title ?? '',
    visibleTextFromUnknown(module.payload),
  ].join('\n');
}

function localChromeOverrideKey(module: InteractiveRuntimeModuleManifest): string | undefined {
  const moduleRecord = module as unknown as Record<string, unknown>;
  return localChromeOverrideKeyFromRecord(moduleRecord)
    ?? localChromeOverrideKeyFromRecord(recordValue(module.payload));
}

function localChromeOverrideKeyFromRecord(record: Record<string, unknown>): string | undefined {
  return COURSE_LOCAL_CHROME_KEYS.find((key) => hasCourseLocalChromeValue(record[key]));
}

function hasCourseLocalChromeValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function rawCourseLocalChromeViolations(
  raw: { steps: Record<string, unknown> },
  fallbackLessonId: string,
  manifestPath: string,
): InteractiveModuleRegistryGateViolation[] {
  const rawLessonId = stringValue((raw as { lesson_id?: unknown; lessonId?: unknown }).lesson_id)
    ?? stringValue((raw as { lessonId?: unknown }).lessonId)
    ?? fallbackLessonId;
  return Object.entries(raw.steps).flatMap(([stepId, rawStep]) => {
    const stepRecord = recordValue(rawStep);
    const modules = Array.isArray(stepRecord.modules) ? stepRecord.modules : [];
    return modules.flatMap((rawModule, index): InteractiveModuleRegistryGateViolation[] => {
      const moduleRecord = recordValue(rawModule);
      const localChromeKey = localChromeOverrideKeyFromRecord(moduleRecord);
      if (!localChromeKey) return [];
      const kind = stringValue(moduleRecord.kind) ?? '';
      const resolution = resolveInteractiveModuleKind(kind);
      if (resolution.source === 'unknown') return [];
      const moduleId = stringValue(moduleRecord.id) ?? `(module-${index + 1})`;
      return [{
        lessonId: rawLessonId,
        stepId,
        moduleId,
        kind,
        code: 'course-local-module-chrome',
        canonicalClass: resolution.canonicalClass,
        message: `${rawLessonId} ${stepId} ${moduleId} uses course-local module chrome field ${localChromeKey}; register shared chrome instead.`,
        manifestPath,
      }];
    });
  });
}

function visibleTextFromUnknown(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(visibleTextFromUnknown).join('\n');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(visibleTextFromUnknown).join('\n');
  }
  return '';
}

function hasCodeLikeVisibleContent(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  const block = contentBlockForModule(step, module);
  const visibleText = [
    visibleTextFromUnknown(module.payload),
    visibleTextFromUnknown(block),
  ].join('\n');
  return CODE_LIKE_CONTENT_PATTERN.test(visibleText);
}

function codeSourceForModule(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  const block = recordValue(contentBlockForModule(step, module));
  const code = stringValue(module.payload.code)
    ?? stringValue(module.payload.text)
    ?? stringValue(module.payload.formula)
    ?? stringValue(block.code)
    ?? stringValue(block.text)
    ?? stringValue(block.formula)
    ?? '';

  return { code };
}

function contentBlockForModule(
  step: InteractiveRuntimeStepManifest,
  module: InteractiveRuntimeModuleManifest,
) {
  const key = stringValue(module.payload.block_key)
    ?? stringValue(module.payload.blockKey)
    ?? stringValue(module.payload.formula_key)
    ?? stringValue(module.payload.formulaKey)
    ?? stringValue(module.payload.image_key)
    ?? stringValue(module.payload.imageKey);
  return key ? step.contentBlocks[key] : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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

function missingStandardModuleInventoryViolations(
  manifests: InteractiveModuleRegistryGateManifestInput[],
  standardModuleLessonIds: readonly string[],
): InteractiveModuleRegistryGateViolation[] {
  const enforcedLessons = new Set(standardModuleLessonIds);
  const seen = new Set<string>();
  const violations: InteractiveModuleRegistryGateViolation[] = [];
  for (const item of manifests) {
    if (enforcedLessons.has(item.lessonId) || seen.has(item.lessonId)) continue;
    seen.add(item.lessonId);
    violations.push({
      lessonId: item.lessonId,
      stepId: '',
      moduleId: '(lesson)',
      kind: '',
      code: 'lesson-missing-from-standard-module-inventory',
      message: `${item.lessonId} has a runtime interactive manifest but is missing from the standard module lesson inventory.`,
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
