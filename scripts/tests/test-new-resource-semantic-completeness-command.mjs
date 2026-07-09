import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
const tsxBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'act-new-resource-gate-'));
const repo = path.join(tmp, 'repo');
fs.mkdirSync(path.join(repo, 'src/lib'), { recursive: true });
fs.mkdirSync(path.join(repo, 'src/features/teacher/preset-lessons/presets'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/resource-governance'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/lessons/1-1'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/lessons/1-1/media'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/lessons/legacy/1-1/media'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/resources/textbooks/book/chunks'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/resources/textbooks/book/sections'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/knowledge/cards/nodes'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/knowledge/infographs'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/questions/questions'), { recursive: true });
fs.cpSync(path.join(root, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
fs.cpSync(path.join(root, 'src/lib/data-governance'), path.join(repo, 'src/lib/data-governance'), { recursive: true });
fs.cpSync(path.join(root, 'src/lib/resource-node-registry.ts'), path.join(repo, 'src/lib/resource-node-registry.ts'));
fs.cpSync(path.join(root, 'src/lib/resource-registry-metadata.ts'), path.join(repo, 'src/lib/resource-registry-metadata.ts'));
fs.cpSync(path.join(root, 'src/lib/kaq-artifact-versioning.ts'), path.join(repo, 'src/lib/kaq-artifact-versioning.ts'));
fs.writeFileSync(path.join(repo, 'src/lib/resource-registry.tsx'), 'const registry = {};\n');
fs.writeFileSync(path.join(repo, 'src/features/teacher/preset-lessons/presets/example.ts'), `export const EXAMPLE_PRESET = {
  items: [],
};
`);
fs.writeFileSync(path.join(repo, 'course-content/runtime/lessons/1-1/interactive-manifest.json'), JSON.stringify({
  lesson_id: '1-1',
  steps: {},
}, null, 2));
fs.writeFileSync(path.join(repo, 'course-content/runtime/lessons/1-1/1-1-handout.md'), '# Demo handout\n');
fs.writeFileSync(path.join(repo, 'course-content/runtime/knowledge/cards/nodes/kn-demo.md'), '# Demo card\n');
fs.writeFileSync(path.join(repo, 'course-content/runtime/knowledge/infographs/manifest.json'), JSON.stringify({
  schema_version: 1,
  items: [],
}, null, 2));
fs.writeFileSync(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png'), 'baseline-infograph-image');
fs.writeFileSync(path.join(repo, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    baseUrl: '.',
    paths: {
      '@/*': ['./src/*'],
    },
    module: 'esnext',
    moduleResolution: 'bundler',
    target: 'es2022',
  },
}, null, 2));
fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
  type: 'module',
  dependencies: {},
  devDependencies: {},
}, null, 2));
run('git', ['init'], repo);
run('git', ['config', 'user.email', 'test@example.invalid'], repo);
run('git', ['config', 'user.name', 'Gate Test'], repo);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl'), '');
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/assessment-item-semantic-review-packets.jsonl'), '');
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl'), '');
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/kaq-quiz-foundation-reviewed-items.jsonl'), '');
run('git', ['add', '.'], repo);
run('git', ['commit', '-m', 'baseline'], repo);

const metadataPath = path.join(repo, 'src/lib/resource-registry-metadata.ts');
const original = fs.readFileSync(metadataPath, 'utf8');
const incomplete = original.replace(
  'const registeredResourceMetadata: Record<string, RegisteredResourceMetadata> = {',
  `const registeredResourceMetadata: Record<string, RegisteredResourceMetadata> = {
    'gate-test-resource': {
        id: 'gate-test-resource',
        label: 'Gate test resource',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/gate-test-resource'
    },`,
);
fs.writeFileSync(metadataPath, incomplete);
run('git', ['add', 'src/lib/resource-registry-metadata.ts'], repo);
const complete = incomplete.replace(
  "        renderTarget: '/interactive-learning/resources/gate-test-resource'\n    },",
  `        renderTarget: '/interactive-learning/resources/gate-test-resource',
        knowledgeNodeIds: ['kn-bode'],
        planningOverride: {
            abilityImpact: { controlModeling: 0.2 },
            evidenceInstrumentation: ['answer_submit'],
            privacyLevel: 'student-visible',
            readiness: {
                minimumCompetency: { controlModeling: 0.1 },
                minimumEvidenceCount: 0,
                requiredCompletedNodeIds: [],
                requiredOutcomeRefs: [],
                unlockMessage: 'Reviewed resource is ready.',
                fallbackNodeIds: []
            },
            pathDisposition: {
                kind: 'path-plannable',
                reviewStatus: 'human-confirmed',
                rationale: 'Reviewed staged-worktree mismatch fixture.',
                sourceFamily: 'resource_registry',
                stableSourceRef: 'gate-test-resource',
                sourceVersionRef: 'resource-node-registry.v1',
                parentResourceNodeId: null,
                reviewedAt: '2026-07-09T00:00:00.000Z',
                reviewerId: 'gate-test-reviewer'
            }
        }
    },`,
);
fs.writeFileSync(metadataPath, complete);

const result = runGate(['--staged']);
assert.notEqual(result.status, 0, 'gate must fail closed when staged and worktree gated files differ');
assert.match(
  `${result.stdout}\n${result.stderr}`,
  /cannot run with unstaged changes in gated resource files/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const unrelatedPresetPath = path.join(repo, 'src/features/teacher/preset-lessons/presets/example.ts');
const unrelatedOriginalPreset = fs.readFileSync(unrelatedPresetPath, 'utf8');
fs.writeFileSync(unrelatedPresetPath, unrelatedOriginalPreset.replace(
  'items: [],',
  `items: [
    {
      registryId: 'unstaged-wip-resource',
      title: 'Unstaged WIP resource',
    },
  ],`,
));
fs.writeFileSync(path.join(repo, 'README.md'), 'Unrelated staged documentation change.\n');
run('git', ['add', 'README.md'], repo);
const unrelatedStagedResult = runGate(['--staged']);
assert.equal(unrelatedStagedResult.status, 0, 'gate must not block unrelated staged changes because a gated resource file has unstaged WIP');
assert.match(
  `${unrelatedStagedResult.stdout}\n${unrelatedStagedResult.stderr}`,
  /new-resource semantic completeness passed \(0 changed resources checked\)/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const mismatch = original.replace(
  'const registeredResourceMetadata: Record<string, RegisteredResourceMetadata> = {',
  `const registeredResourceMetadata: Record<string, RegisteredResourceMetadata> = {
    'gate-key-resource': {
        id: 'gate-internal-resource',
        label: 'Gate mismatched resource',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/gate-key-resource'
    },`,
);
fs.writeFileSync(metadataPath, mismatch);
run('git', ['add', 'src/lib/resource-registry-metadata.ts'], repo);
const mismatchResult = runGate(['--staged']);
assert.notEqual(mismatchResult.status, 0, 'gate must fail when changed registry object key cannot be loaded as materialized metadata');
assert.match(
  `${mismatchResult.stdout}\n${mismatchResult.stderr}`,
  /missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const seedPath = path.join(repo, 'scripts/db/seed-interactive-resources.ts');
const originalSeed = fs.readFileSync(seedPath, 'utf8');
fs.writeFileSync(seedPath, originalSeed.replace(
  'const INTERACTIVE_RESOURCES = [',
  `const INTERACTIVE_RESOURCES = [
  {
    registryId: 'teaching-resource-without-metadata',
    title: 'Teaching resource without metadata',
    displayName: 'Teaching resource without metadata',
    description: 'TeachingResource seed should not bypass metadata gate',
    type: ResourceType.INTERACTIVE_COMP,
    category: InteractiveCategory.SYSTEM_MODELING,
    displayOrder: 0,
  },`,
));
run('git', ['add', 'scripts/db/seed-interactive-resources.ts'], repo);
const teachingResourceResult = runGate(['--staged']);
assert.notEqual(teachingResourceResult.status, 0, 'gate must fail when a changed TeachingResource registryId has no registered metadata');
assert.match(
  `${teachingResourceResult.stdout}\n${teachingResourceResult.stderr}`,
  /teaching-resource-without-metadata missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const repairPath = path.join(repo, 'scripts/db/repair-resource-identity-bindings.ts');
const originalRepair = fs.readFileSync(repairPath, 'utf8');
fs.writeFileSync(repairPath, originalRepair.replace(
  'const RESOURCE_REGISTRY_REPAIRS: Record<string, string> = {',
  `const RESOURCE_REGISTRY_REPAIRS: Record<string, string> = {
  cmjreviewresource: 'repair-resource-without-metadata',`,
));
run('git', ['add', 'scripts/db/repair-resource-identity-bindings.ts'], repo);
const repairResult = runGate(['--staged']);
assert.notEqual(repairResult.status, 0, 'gate must fail when a TeachingResource repair registryId has no registered metadata');
assert.match(
  `${repairResult.stdout}\n${repairResult.stderr}`,
  /repair-resource-without-metadata missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const presetPath = path.join(repo, 'src/features/teacher/preset-lessons/presets/example.ts');
const originalPreset = fs.readFileSync(presetPath, 'utf8');
fs.writeFileSync(presetPath, originalPreset.replace(
  'items: [],',
  `items: [
    {
      registryId:
        step.kind === 'summary'
          ? 'classroom-ai-report'
          : 'preset-resource-without-metadata',
      title: 'Preset resource without metadata',
    },
  ],`,
));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
const presetResult = runGate(['--staged']);
assert.notEqual(presetResult.status, 0, 'gate must fail when a changed preset lesson registryId has no registered metadata');
assert.match(
  `${presetResult.stdout}\n${presetResult.stderr}`,
  /preset-resource-without-metadata missing-registered-resource-metadata/,
);
assert.doesNotMatch(
  `${presetResult.stdout}\n${presetResult.stderr}`,
  /summary missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(presetPath, originalPreset.replace(
  'items: [],',
  `items: [
    {
      registryId: 'modified-item-without-metadata',
      title: 'Original title',
      duration: 5,
    },
  ],`,
));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
run('git', ['commit', '--no-verify', '-m', 'add incomplete preset item'], repo);
fs.writeFileSync(presetPath, fs.readFileSync(presetPath, 'utf8').replace('Original title', 'Changed title'));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
const modifiedPresetItemResult = runGate(['--staged']);
assert.notEqual(modifiedPresetItemResult.status, 0, 'gate must fail when a changed preset item field belongs to a registryId without metadata');
assert.match(
  `${modifiedPresetItemResult.stdout}\n${modifiedPresetItemResult.stderr}`,
  /modified-item-without-metadata missing-registered-resource-metadata/,
);
assert.doesNotMatch(
  `${modifiedPresetItemResult.stdout}\n${modifiedPresetItemResult.stderr}`,
  /Changed title missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(presetPath, originalPreset.replace(
  'items: [],',
  `items: STEPS.map((step, index) => ({
    registryId: step.interactive ? 'map-item-without-metadata' : 'classroom-ai-report',
    title: 'Map original title',
    order: index + 1,
  })),`,
));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
run('git', ['commit', '--no-verify', '-m', 'add incomplete map preset item'], repo);
fs.writeFileSync(presetPath, fs.readFileSync(presetPath, 'utf8').replace('Map original title', 'Map changed title'));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
const modifiedMapPresetItemResult = runGate(['--staged']);
assert.notEqual(modifiedMapPresetItemResult.status, 0, 'gate must fail when a changed map-generated preset item field belongs to a registryId without metadata');
assert.match(
  `${modifiedMapPresetItemResult.stdout}\n${modifiedMapPresetItemResult.stderr}`,
  /map-item-without-metadata missing-registered-resource-metadata/,
);
assert.doesNotMatch(
  `${modifiedMapPresetItemResult.stdout}\n${modifiedMapPresetItemResult.stderr}`,
  /Map changed title missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(presetPath, originalPreset.replace(
  'items: [],',
  `items: [
    {
      registryId: step.kind === 'summary' ? 'classroom-ai-report' : 'same-line-preset-without-metadata',
      title: 'Same-line preset resource without metadata',
    },
  ],`,
));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
const sameLinePresetResult = runGate(['--staged']);
assert.notEqual(sameLinePresetResult.status, 0, 'gate must fail when a same-line ternary preset registryId branch has no registered metadata');
assert.match(
  `${sameLinePresetResult.stdout}\n${sameLinePresetResult.stderr}`,
  /same-line-preset-without-metadata missing-registered-resource-metadata/,
);
assert.doesNotMatch(
  `${sameLinePresetResult.stdout}\n${sameLinePresetResult.stderr}`,
  /summary missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(presetPath, originalPreset.replace(
  'items: [],',
  `items: [
    {
      registryId: step.kind === 'summary' ? 'classroom-ai-report'
        : 'partial-line-preset-without-metadata',
      title: 'Partial-line preset resource without metadata',
    },
  ],`,
));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
const partialLinePresetResult = runGate(['--staged']);
assert.notEqual(partialLinePresetResult.status, 0, 'gate must fail when a partial-line ternary preset registryId branch has no registered metadata');
assert.match(
  `${partialLinePresetResult.stdout}\n${partialLinePresetResult.stderr}`,
  /partial-line-preset-without-metadata missing-registered-resource-metadata/,
);
assert.doesNotMatch(
  `${partialLinePresetResult.stdout}\n${partialLinePresetResult.stderr}`,
  /summary missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(presetPath, originalPreset.replace(
  '};',
  `};

export const DECORATIVE_TITLE = step.kind === 'summary' ? 'Decorative title' : 'Fallback title';`,
));
run('git', ['add', 'src/features/teacher/preset-lessons/presets/example.ts'], repo);
const nonRegistryTernaryResult = runGate(['--staged']);
assert.equal(nonRegistryTernaryResult.status, 0, 'gate must ignore non-registryId ternary strings in preset changes');
assert.doesNotMatch(
  `${nonRegistryTernaryResult.stdout}\n${nonRegistryTernaryResult.stderr}`,
  /Decorative title missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const stagedOnlyPresetPath = path.join(repo, 'src/features/teacher/preset-lessons/presets/staged-only.ts');
fs.writeFileSync(stagedOnlyPresetPath, `export const STAGED_ONLY_PRESET = {
  items: [
    { registryId: 'staged-only-preset-resource' },
  ],
};
`);
run('git', ['add', 'src/features/teacher/preset-lessons/presets/staged-only.ts'], repo);
fs.rmSync(stagedOnlyPresetPath);
const stagedOnlyPresetResult = runGate(['--staged']);
assert.notEqual(stagedOnlyPresetResult.status, 0, 'gate must fail closed when a staged preset file is missing from the worktree');
assert.match(
  `${stagedOnlyPresetResult.stdout}\n${stagedOnlyPresetResult.stderr}`,
  /cannot run with unstaged changes in gated resource files/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const componentRegistryPath = path.join(repo, 'src/lib/resource-registry.tsx');
const originalComponentRegistry = fs.readFileSync(componentRegistryPath, 'utf8');
fs.writeFileSync(componentRegistryPath, originalComponentRegistry.replace(
  'const registry = {};',
  `const registry = {
  'component-resource-without-metadata': {
    id: 'component-resource-without-metadata',
    label: 'Component resource without metadata',
  },
};`,
));
run('git', ['add', 'src/lib/resource-registry.tsx'], repo);
const componentRegistryResult = runGate(['--staged']);
assert.notEqual(componentRegistryResult.status, 0, 'gate must fail when a changed resource component registry id has no registered metadata');
assert.match(
  `${componentRegistryResult.stdout}\n${componentRegistryResult.stderr}`,
  /component-resource-without-metadata missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(componentRegistryPath, originalComponentRegistry.replace(
  'const registry = {};',
  `const registry = {
  'modified-component-resource-without-metadata': {
    id: 'modified-component-resource-without-metadata',
    label: 'Original component label',
  },
};`,
));
run('git', ['add', 'src/lib/resource-registry.tsx'], repo);
run('git', ['commit', '--no-verify', '-m', 'add incomplete component registry entry'], repo);
fs.writeFileSync(componentRegistryPath, fs.readFileSync(componentRegistryPath, 'utf8').replace('Original component label', 'Changed component label'));
run('git', ['add', 'src/lib/resource-registry.tsx'], repo);
const modifiedComponentRegistryResult = runGate(['--staged']);
assert.notEqual(modifiedComponentRegistryResult.status, 0, 'gate must fail when a changed resource component registry entry field belongs to an id without metadata');
assert.match(
  `${modifiedComponentRegistryResult.stdout}\n${modifiedComponentRegistryResult.stderr}`,
  /modified-component-resource-without-metadata missing-registered-resource-metadata/,
);
assert.doesNotMatch(
  `${modifiedComponentRegistryResult.stdout}\n${modifiedComponentRegistryResult.stderr}`,
  /Changed component label missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(componentRegistryPath, originalComponentRegistry.replace(
  'const registry = {};',
  `const registry = {
  'deleted-component-resource-without-metadata': {
    id: 'deleted-component-resource-without-metadata',
    label: 'Deleted component resource without metadata',
  },
  'historical-component-resource-without-metadata': {
    id: 'historical-component-resource-without-metadata',
    label: 'Historical component resource without metadata',
  },
};`,
));
run('git', ['add', 'src/lib/resource-registry.tsx'], repo);
run('git', ['commit', '--no-verify', '-m', 'add historical incomplete component registry entries'], repo);
fs.writeFileSync(componentRegistryPath, fs.readFileSync(componentRegistryPath, 'utf8').replace(
  `  'deleted-component-resource-without-metadata': {
    id: 'deleted-component-resource-without-metadata',
    label: 'Deleted component resource without metadata',
  },
`,
  '',
));
run('git', ['add', 'src/lib/resource-registry.tsx'], repo);
const deleteOnlyComponentRegistryResult = runGate(['--staged']);
assert.equal(deleteOnlyComponentRegistryResult.status, 0, 'gate must not treat a deletion-only component registry hunk as a change to the adjacent historical entry');
assert.doesNotMatch(
  `${deleteOnlyComponentRegistryResult.stdout}\n${deleteOnlyComponentRegistryResult.stderr}`,
  /historical-component-resource-without-metadata missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(componentRegistryPath, originalComponentRegistry.replace(
  'const registry = {};',
  `const registry = {
  'component-resource-without-metadata': {
    id: 'component-resource-without-metadata',
    label: 'Component resource without metadata',
  },
};`,
));
run('git', ['add', 'src/lib/resource-registry.tsx'], repo);
run('git', ['commit', '--no-verify', '-m', 'add incomplete component registry'], repo);
const componentRegistryBaseResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(componentRegistryBaseResult.status, 0, 'gate must fail for changed resource component registry ids in base mode');
assert.match(
  `${componentRegistryBaseResult.stdout}\n${componentRegistryBaseResult.stderr}`,
  /component-resource-without-metadata missing-registered-resource-metadata/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const lessonManifestPath = path.join(repo, 'course-content/runtime/lessons/1-1/interactive-manifest.json');
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {
    'step-01': {
      title: 'New runtime lesson step',
    },
  },
}, null, 2));
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
const missingLessonProjectionResult = runGate(['--staged']);
assert.notEqual(missingLessonProjectionResult.status, 0, 'gate must fail when a runtime lesson manifest changes without runtime projection rows');
assert.match(
  `${missingLessonProjectionResult.stdout}\n${missingLessonProjectionResult.stderr}`,
  /missing-runtime-lesson-runtime-projection-row/,
);

fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {},
}, null, 2));
const staleLessonSourceResult = runGate(['--staged']);
assert.notEqual(staleLessonSourceResult.status, 0, 'gate must fail closed when staged runtime lesson source differs from the worktree source');
assert.match(
  `${staleLessonSourceResult.stdout}\n${staleLessonSourceResult.stderr}`,
  /cannot run with unstaged changes in gated resource files/,
);
run('git', ['checkout', '--', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);

fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-step:1-1:step-01',
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1#step-01',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedLessonProjectionResult = runGate(['--staged']);
assert.equal(syncedLessonProjectionResult.status, 0, 'gate must pass when a runtime lesson source change has a matching valid projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {
    'step-01': {
      title: 'Wrong-source projection should not satisfy this source',
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-step:2-1:step-01',
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '2-1#step-01',
    sourcePathOrUrl: 'course-content/runtime/lessons/2-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const mismatchedLessonProjectionResult = runGate(['--staged']);
assert.notEqual(mismatchedLessonProjectionResult.status, 0, 'gate must reject a same-family projection row for a different runtime source path');
assert.match(
  `${mismatchedLessonProjectionResult.stdout}\n${mismatchedLessonProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/interactive-manifest\.json/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {
    'step-01': {
      title: 'First changed runtime lesson step',
    },
    'step-02': {
      title: 'Second changed runtime lesson step',
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-step:1-1:step-01',
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1#step-01',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const partialLessonProjectionResult = runGate(['--staged']);
assert.notEqual(partialLessonProjectionResult.status, 0, 'gate must fail when a lesson manifest changes multiple steps but only one has a projection row');
assert.match(
  `${partialLessonProjectionResult.stdout}\n${partialLessonProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/interactive-manifest\.json#step-02/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {
    'step-01': {
      title: 'New runtime lesson step with module',
      modules: [
        {
          id: 'module-a',
          title: 'Runtime lesson module A',
        },
      ],
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-module:1-1:step-01:module-a',
    family: 'runtime-lesson-module',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1:step-01:module-a',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const moduleOnlyLessonProjectionResult = runGate(['--staged']);
assert.notEqual(moduleOnlyLessonProjectionResult.status, 0, 'gate must fail when a new lesson step with modules only has module projection rows');
assert.match(
  `${moduleOnlyLessonProjectionResult.stdout}\n${moduleOnlyLessonProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/interactive-manifest\.json#step-01/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {
    'step-01': {
      title: 'Runtime lesson step with layout regions',
      modules: [
        {
          id: 'module-a',
          title: 'Runtime lesson module A',
        },
      ],
      layout: {
        regions: [
          {
            id: 'chart',
            width: 6,
          },
          {
            id: 'questions',
            width: 6,
          },
        ],
      },
    },
  },
}, null, 2));
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
run('git', ['commit', '--no-verify', '-m', 'add baseline lesson layout regions'], repo);
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {
    'step-01': {
      title: 'Runtime lesson step with layout regions',
      modules: [
        {
          id: 'module-a',
          title: 'Runtime lesson module A',
        },
      ],
      layout: {
        regions: [
          {
            id: 'chart',
            width: 5,
          },
          {
            id: 'questions',
            width: 7,
          },
        ],
      },
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-step:1-1:step-01',
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1#step-01',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const layoutRegionLessonProjectionResult = runGate(['--staged']);
assert.equal(layoutRegionLessonProjectionResult.status, 0, 'gate must not treat lesson layout region ids as runtime module projection records');
assert.doesNotMatch(
  `${layoutRegionLessonProjectionResult.stdout}\n${layoutRegionLessonProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/interactive-manifest\.json#1-1:step-01:chart/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const lessonMediaPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/new-runtime-figure.png');
fs.writeFileSync(lessonMediaPath, 'runtime figure fixture\n');
run('git', ['add', 'course-content/runtime/lessons/1-1/media/new-runtime-figure.png'], repo);
const missingLessonMediaProjectionResult = runGate(['--staged']);
assert.notEqual(missingLessonMediaProjectionResult.status, 0, 'gate must fail when a runtime lesson media file changes without a runtime projection row');
assert.match(
  `${missingLessonMediaProjectionResult.stdout}\n${missingLessonMediaProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/media\/new-runtime-figure\.png/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-media:1-1:new-runtime-figure.png',
    family: 'runtime-lesson-media',
    resourceType: 'image',
    sourceKind: 'runtime_lesson_media',
    sourceRef: '1-1:new-runtime-figure.png',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/media/new-runtime-figure.png',
    sourceVersionRef: 'runtime-lesson-media.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedLessonMediaProjectionResult = runGate(['--staged']);
assert.equal(syncedLessonMediaProjectionResult.status, 0, 'gate must pass when a runtime lesson media source has a matching projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
const generatedLessonMediaPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/generated-data/1-1-analysis-data.txt');
fs.mkdirSync(path.dirname(generatedLessonMediaPath), { recursive: true });
fs.writeFileSync(generatedLessonMediaPath, 'generated runtime data fixture\n');
run('git', ['add', 'course-content/runtime/lessons/1-1/media/generated-data/1-1-analysis-data.txt'], repo);
const missingGeneratedLessonMediaProjectionResult = runGate(['--staged']);
assert.notEqual(missingGeneratedLessonMediaProjectionResult.status, 0, 'gate must fail when nested generated runtime lesson media changes without a projection row');
assert.match(
  `${missingGeneratedLessonMediaProjectionResult.stdout}\n${missingGeneratedLessonMediaProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/media\/generated-data\/1-1-analysis-data\.txt/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-media:1-1:generated-data/1-1-analysis-data.txt',
    family: 'runtime-lesson-media',
    resourceType: 'handout',
    sourceKind: 'runtime_lesson_media',
    sourceRef: '1-1:generated-data/1-1-analysis-data.txt',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/media/generated-data/1-1-analysis-data.txt',
    sourceVersionRef: 'runtime-lesson-media.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedGeneratedLessonMediaProjectionResult = runGate(['--staged']);
assert.equal(syncedGeneratedLessonMediaProjectionResult.status, 0, 'gate must pass when nested generated runtime lesson media has a matching projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
const lessonHandoutPath = path.join(repo, 'course-content/runtime/lessons/1-1/1-1-handout.md');
fs.writeFileSync(lessonHandoutPath, '# Runtime handout fixture\n');
run('git', ['add', 'course-content/runtime/lessons/1-1/1-1-handout.md'], repo);
const missingLessonHandoutProjectionResult = runGate(['--staged']);
assert.notEqual(missingLessonHandoutProjectionResult.status, 0, 'gate must fail when a runtime handout changes without a runtime projection row');
assert.match(
  `${missingLessonHandoutProjectionResult.stdout}\n${missingLessonHandoutProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/1-1-handout\.md/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-handout:1-1:handout',
    family: 'runtime-handout',
    resourceType: 'handout',
    sourceKind: 'runtime_handout',
    sourceRef: '1-1:handout',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/1-1-handout.md',
    sourceVersionRef: 'runtime-handout.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedLessonHandoutProjectionResult = runGate(['--staged']);
assert.equal(syncedLessonHandoutProjectionResult.status, 0, 'gate must pass when a runtime handout source has a matching projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
const legacyLessonMediaPath = path.join(repo, 'course-content/runtime/lessons/legacy/1-1/media/h-01-spring-mass-damper.svg');
fs.mkdirSync(path.dirname(legacyLessonMediaPath), { recursive: true });
fs.writeFileSync(legacyLessonMediaPath, '<svg role="img"></svg>\n');
run('git', ['add', 'course-content/runtime/lessons/legacy/1-1/media/h-01-spring-mass-damper.svg'], repo);
const missingLegacyLessonMediaProjectionResult = runGate(['--staged']);
assert.notEqual(missingLegacyLessonMediaProjectionResult.status, 0, 'gate must fail when a legacy runtime lesson media file changes without a projection row');
assert.match(
  `${missingLegacyLessonMediaProjectionResult.stdout}\n${missingLegacyLessonMediaProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/legacy\/1-1\/media\/h-01-spring-mass-damper\.svg/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-media:legacy:1-1:h-01-spring-mass-damper.svg',
    family: 'runtime-lesson-media',
    resourceType: 'image',
    sourceKind: 'runtime_lesson_media',
    sourceRef: 'legacy:1-1:h-01-spring-mass-damper.svg',
    sourcePathOrUrl: 'course-content/runtime/lessons/legacy/1-1/media/h-01-spring-mass-damper.svg',
    sourceVersionRef: 'runtime-lesson-media.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedLegacyLessonMediaProjectionResult = runGate(['--staged']);
assert.equal(syncedLegacyLessonMediaProjectionResult.status, 0, 'gate must pass when a legacy runtime lesson media source has a matching projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
const legacyLessonHandoutPath = path.join(repo, 'course-content/runtime/lessons/legacy/1-1/1-1-handout.md');
fs.mkdirSync(path.dirname(legacyLessonHandoutPath), { recursive: true });
fs.writeFileSync(legacyLessonHandoutPath, '# Legacy runtime handout fixture\n');
run('git', ['add', 'course-content/runtime/lessons/legacy/1-1/1-1-handout.md'], repo);
const missingLegacyLessonHandoutProjectionResult = runGate(['--staged']);
assert.notEqual(missingLegacyLessonHandoutProjectionResult.status, 0, 'gate must fail when a legacy runtime handout changes without a runtime projection row');
assert.match(
  `${missingLegacyLessonHandoutProjectionResult.stdout}\n${missingLegacyLessonHandoutProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/legacy\/1-1\/1-1-handout\.md/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-handout:legacy:1-1:handout',
    family: 'runtime-handout',
    resourceType: 'handout',
    sourceKind: 'runtime_handout',
    sourceRef: 'legacy:1-1:handout',
    sourcePathOrUrl: 'course-content/runtime/lessons/legacy/1-1/1-1-handout.md',
    sourceVersionRef: 'runtime-handout.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedLegacyLessonHandoutProjectionResult = runGate(['--staged']);
assert.equal(syncedLegacyLessonHandoutProjectionResult.status, 0, 'gate must pass when a legacy runtime handout source has a matching projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
const textbookChunkPath = path.join(repo, 'course-content/runtime/resources/textbooks/book/chunks/ch01__chunk-001.md');
fs.mkdirSync(path.dirname(textbookChunkPath), { recursive: true });
fs.writeFileSync(textbookChunkPath, '# Textbook chunk fixture\n');
run('git', ['add', 'course-content/runtime/resources/textbooks/book/chunks/ch01__chunk-001.md'], repo);
const missingTextbookChunkProjectionResult = runGate(['--staged']);
assert.notEqual(missingTextbookChunkProjectionResult.status, 0, 'gate must fail when a runtime textbook chunk changes without a runtime projection row');
assert.match(
  `${missingTextbookChunkProjectionResult.stdout}\n${missingTextbookChunkProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/resources\/textbooks\/book\/chunks\/ch01__chunk-001\.md/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'textbook-section:book:ch01__chunk-001',
    family: 'textbook-section',
    resourceType: 'textbook_section',
    sourceKind: 'textbook_section',
    sourceRef: 'book:ch01__chunk-001',
    sourcePathOrUrl: 'course-content/runtime/resources/textbooks/book/chunks/ch01__chunk-001.md',
    sourceVersionRef: 'runtime-textbook-chunk.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedTextbookChunkProjectionResult = runGate(['--staged']);
assert.equal(syncedTextbookChunkProjectionResult.status, 0, 'gate must pass when a runtime textbook chunk has a matching projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
const textbookSectionPath = path.join(repo, 'course-content/runtime/resources/textbooks/book/sections/ch01-sec01.md');
fs.mkdirSync(path.dirname(textbookSectionPath), { recursive: true });
fs.writeFileSync(textbookSectionPath, '# Textbook section fixture\n');
run('git', ['add', 'course-content/runtime/resources/textbooks/book/sections/ch01-sec01.md'], repo);
const missingTextbookSectionProjectionResult = runGate(['--staged']);
assert.notEqual(missingTextbookSectionProjectionResult.status, 0, 'gate must fail when a runtime textbook section changes without a runtime projection row');
assert.match(
  `${missingTextbookSectionProjectionResult.stdout}\n${missingTextbookSectionProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/resources\/textbooks\/book\/sections\/ch01-sec01\.md/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'textbook-section:book:ch01-sec01',
    family: 'textbook-section',
    resourceType: 'textbook_section',
    sourceKind: 'textbook_section',
    sourceRef: 'book:ch01-sec01',
    sourcePathOrUrl: 'course-content/runtime/resources/textbooks/book/sections/ch01-sec01.md',
    sourceVersionRef: 'runtime-textbook-section.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedTextbookSectionProjectionResult = runGate(['--staged']);
assert.equal(syncedTextbookSectionProjectionResult.status, 0, 'gate must pass when a runtime textbook section has a matching projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
const questionJsonPath = path.join(repo, 'course-content/questions/questions/AC-Q-9999.json');
const questionMarkdownPath = path.join(repo, 'course-content/questions/questions/AC-Q-9999.md');
fs.writeFileSync(questionJsonPath, JSON.stringify({
  id: 'AC-Q-9999',
  stem: 'Gate fixture question',
}, null, 2));
fs.writeFileSync(questionMarkdownPath, '# Gate fixture question\n');
run('git', ['add', 'course-content/questions/questions/AC-Q-9999.json', 'course-content/questions/questions/AC-Q-9999.md'], repo);
const missingQuestionProjectionResult = runGate(['--staged']);
assert.notEqual(missingQuestionProjectionResult.status, 0, 'gate must fail when quiz/exercise question sources change without runtime projection rows');
assert.match(
  `${missingQuestionProjectionResult.stdout}\n${missingQuestionProjectionResult.stderr}`,
  /missing-assessment-item-runtime-projection-row/,
);
assert.match(
  `${missingQuestionProjectionResult.stdout}\n${missingQuestionProjectionResult.stderr}`,
  /runtime-source:course-content\/questions\/questions\/AC-Q-9999\.json#AC-Q-9999/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'quiz:AC-Q-9999-json',
    family: 'quiz',
    resourceType: 'quiz',
    sourceKind: 'resource_registry',
    sourceRef: 'AC-Q-9999',
    sourcePathOrUrl: 'course-content/questions/questions/AC-Q-9999.json',
    sourceVersionRef: 'question-bank.v1',
  }))}\n${JSON.stringify(runtimeProjectionRow({
    id: 'quiz:AC-Q-9999-md',
    family: 'quiz',
    resourceType: 'quiz',
    sourceKind: 'resource_registry',
    sourceRef: 'AC-Q-9999',
    sourcePathOrUrl: 'course-content/questions/questions/AC-Q-9999.md',
    sourceVersionRef: 'question-bank.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedQuestionProjectionResult = runGate(['--staged']);
assert.equal(syncedQuestionProjectionResult.status, 0, 'gate must pass when quiz/exercise question sources have matching projection rows');

run('git', ['reset', '--hard', 'HEAD'], repo);
const assessmentCatalogPath = path.join(repo, 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl');
fs.writeFileSync(assessmentCatalogPath, `${JSON.stringify({
  id: 'adaptive-assessment-item:AC-Q-9998',
  sourcePath: 'course-content/questions/questions/AC-Q-9998.json',
})}\n`);
run('git', ['add', 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl'], repo);
const missingAssessmentCatalogProjectionResult = runGate(['--staged']);
assert.notEqual(missingAssessmentCatalogProjectionResult.status, 0, 'gate must fail when assessment catalog rows change without runtime projection rows');
assert.match(
  `${missingAssessmentCatalogProjectionResult.stdout}\n${missingAssessmentCatalogProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/resource-governance\/adaptive-assessment-item-catalog-items\.jsonl/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'adaptive-assessment-item:UNRELATED',
    family: 'adaptive-assessment-item',
    resourceType: 'adaptive_quiz',
    sourceKind: 'resource_registry',
    sourceRef: 'adaptive-assessment-item:UNRELATED',
    sourcePathOrUrl: 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
    sourceVersionRef: 'adaptive-assessment-item-catalog.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const unrelatedAssessmentCatalogProjectionResult = runGate(['--staged']);
assert.notEqual(unrelatedAssessmentCatalogProjectionResult.status, 0, 'gate must fail when assessment catalog projection row targets a different item in the same file');
assert.match(
  `${unrelatedAssessmentCatalogProjectionResult.stdout}\n${unrelatedAssessmentCatalogProjectionResult.stderr}`,
  /adaptive-assessment-item:AC-Q-9998/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'adaptive-assessment-item:AC-Q-9998',
    family: 'adaptive-assessment-item',
    resourceType: 'adaptive_quiz',
    sourceKind: 'resource_registry',
    sourceRef: 'adaptive-assessment-item:AC-Q-9998',
    sourcePathOrUrl: 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
    sourceHash: 'sha256:stale-assessment-catalog',
    sourceVersionRef: 'adaptive-assessment-item-catalog.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const staleAssessmentCatalogProjectionResult = runGate(['--staged']);
assert.notEqual(staleAssessmentCatalogProjectionResult.status, 0, 'gate must fail when assessment catalog projection row carries a stale source hash');
assert.match(
  `${staleAssessmentCatalogProjectionResult.stdout}\n${staleAssessmentCatalogProjectionResult.stderr}`,
  /adaptive-assessment-item:AC-Q-9998/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'adaptive-assessment-item:AC-Q-9998',
    family: 'adaptive-assessment-item',
    resourceType: 'adaptive_quiz',
    sourceKind: 'resource_registry',
    sourceRef: 'adaptive-assessment-item:AC-Q-9998',
    sourcePathOrUrl: 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
    sourceVersionRef: 'adaptive-assessment-item-catalog.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedAssessmentCatalogProjectionResult = runGate(['--staged']);
assert.equal(syncedAssessmentCatalogProjectionResult.status, 0, 'gate must pass when assessment catalog rows have matching projection rows');

run('git', ['reset', '--hard', 'HEAD'], repo);
const infographManifestPath = path.join(repo, 'course-content/runtime/knowledge/infographs/manifest.json');
fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      type: 'infograph',
      nodeId: 'kn-demo',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
run('git', ['add', 'course-content/runtime/knowledge/infographs/manifest.json'], repo);
const missingInfographProjectionResult = runGate(['--staged']);
assert.notEqual(missingInfographProjectionResult.status, 0, 'gate must fail when an infograph manifest changes without runtime projection rows');
assert.match(
  `${missingInfographProjectionResult.stdout}\n${missingInfographProjectionResult.stderr}`,
  /missing-knowledge-infograph-runtime-projection-row/,
);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [],
}, null, 2));
const staleInfographSourceResult = runGate(['--staged']);
assert.notEqual(staleInfographSourceResult.status, 0, 'gate must fail closed when staged infograph manifest differs from the worktree manifest');
assert.match(
  `${staleInfographSourceResult.stdout}\n${staleInfographSourceResult.stderr}`,
  /cannot run with unstaged changes in gated resource files/,
);
run('git', ['checkout', '--', 'course-content/runtime/knowledge/infographs/manifest.json'], repo);

fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-demo',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const staleInfographManifestHashResult = runGate(['--staged']);
assert.notEqual(staleInfographManifestHashResult.status, 0, 'gate must fail when an infograph manifest projection row carries a stale manifest hash');
assert.match(
  `${staleInfographManifestHashResult.stdout}\n${staleInfographManifestHashResult.stderr}`,
  /runtime-source:course-content\/runtime\/knowledge\/infographs\/manifest\.json#kn-demo/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-demo',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    sourceHash: sha256File(infographManifestPath),
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedInfographProjectionResult = runGate(['--staged']);
assert.equal(syncedInfographProjectionResult.status, 0, 'gate must pass when an infograph manifest change has a matching valid projection row');

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      type: 'infograph',
      nodeId: 'kn-a',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-a.png',
    },
    {
      type: 'infograph',
      nodeId: 'kn-b',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-b.png',
    },
  ],
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-a',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-a',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-a.png',
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-a',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/knowledge/infographs/manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const partialInfographProjectionResult = runGate(['--staged']);
assert.notEqual(partialInfographProjectionResult.status, 0, 'gate must fail when an infograph manifest changes multiple items but only one has a projection row');
assert.match(
  `${partialInfographProjectionResult.stdout}\n${partialInfographProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/knowledge\/infographs\/manifest\.json#kn-b/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const infographImagePath = path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png');
fs.writeFileSync(infographImagePath, 'updated-infograph-image');
run('git', ['add', 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png'], repo);
const missingInfographImageProjectionResult = runGate(['--staged']);
assert.notEqual(missingInfographImageProjectionResult.status, 0, 'gate must fail when an infograph image changes without a matching projection row');
assert.match(
  `${missingInfographImageProjectionResult.stdout}\n${missingInfographImageProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/knowledge\/infographs\/nodes\/kn-demo\.png/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-demo',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    sourceHash: 'sha256:stale-infograph-image',
    sourceVersionRef: 'knowledge-infograph-image.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const staleInfographImageHashResult = runGate(['--staged']);
assert.notEqual(staleInfographImageHashResult.status, 0, 'gate must fail when an infograph image projection row carries a stale source hash');
assert.match(
  `${staleInfographImageHashResult.stdout}\n${staleInfographImageHashResult.stderr}`,
  /runtime-source:course-content\/runtime\/knowledge\/infographs\/nodes\/kn-demo\.png/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-demo',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    sourceHash: sha256File(infographImagePath),
    sourceVersionRef: 'knowledge-infograph-image.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedInfographImageProjectionResult = runGate(['--staged']);
assert.equal(syncedInfographImageProjectionResult.status, 0, 'gate must pass when an infograph image change has a matching projection row and source hash');

run('git', ['reset', '--hard', 'HEAD'], repo);
const metadataWithoutSemanticFields = original.replace(
  `        knowledgeNodeIds: ['反馈控制系统_1_98dc667a', '自动控制系统_1_9678f418'],
        planningOverride: {
            estimatedTimeMinutes: 6,
            evidenceInstrumentation: ['lesson_bridge_view', 'interaction_complete'],
            abilityImpact: { controlModeling: 0.12, inquiryReflection: 0.08 }
        }
`,
  '',
);
fs.writeFileSync(metadataPath, metadataWithoutSemanticFields);
run('git', ['add', 'src/lib/resource-registry-metadata.ts'], repo);
const deletionOnlyMetadataResult = runGate(['--staged']);
assert.notEqual(deletionOnlyMetadataResult.status, 0, 'gate must fail when deletion-only hunks remove registered resource semantic fields');
assert.match(
  `${deletionOnlyMetadataResult.stdout}\n${deletionOnlyMetadataResult.stderr}`,
  /lesson01-feedback-bridge-v1 missing-path-disposition/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const cardPath = path.join(repo, 'course-content/runtime/knowledge/cards/nodes/kn-demo.md');
const secondCardPath = path.join(repo, 'course-content/runtime/knowledge/cards/nodes/kn-extra.md');
fs.writeFileSync(cardPath, '# Demo card\n\nUpdated card body.\n');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceHash: 'sha256:stale-knowledge-card',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const staleCardProjectionResult = runGate(['--staged']);
assert.notEqual(staleCardProjectionResult.status, 0, 'gate must fail when a knowledge card projection row carries a stale source hash');
assert.match(
  `${staleCardProjectionResult.stdout}\n${staleCardProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/knowledge\/cards\/nodes\/kn-demo\.md/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(cardPath, '# Demo card\n\nUpdated card body.\n');
fs.writeFileSync(secondCardPath, '# Extra card\n');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md', 'course-content/runtime/knowledge/cards/nodes/kn-extra.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const partialCardProjectionResult = runGate(['--staged']);
assert.notEqual(partialCardProjectionResult.status, 0, 'gate must fail when multiple runtime sources change but only one has a projection row');
assert.match(
  `${partialCardProjectionResult.stdout}\n${partialCardProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/knowledge\/cards\/nodes\/kn-extra\.md/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(cardPath, '# Demo card\n\nUpdated card body.\n');
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md'], repo);
run('git', ['commit', '--no-verify', '-m', 'update runtime card without projection'], repo);
const missingCardProjectionBaseResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(missingCardProjectionBaseResult.status, 0, 'gate must fail in base mode when a knowledge card changes without runtime projection rows');
assert.match(
  `${missingCardProjectionBaseResult.stdout}\n${missingCardProjectionBaseResult.stderr}`,
  /missing-knowledge-card-runtime-projection-row/,
);

fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add baseline runtime card projection'], repo);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceHash: 'sha256:stale-projection-only-card',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const staleProjectionOnlySourceHashResult = runGate(['--staged']);
assert.notEqual(staleProjectionOnlySourceHashResult.status, 0, 'gate must fail when only a runtime projection row changes with a stale source hash');
assert.match(
  `${staleProjectionOnlySourceHashResult.stdout}\n${staleProjectionOnlySourceHashResult.stderr}`,
  /stale-runtime-projection-source-hash/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:missing-card',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'missing-card',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/missing-card.md',
    sourceHash: 'sha256:missing-card',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const missingProjectionOnlySourceResult = runGate(['--staged']);
assert.notEqual(missingProjectionOnlySourceResult.status, 0, 'gate must fail when only a runtime projection row points to a missing local source');
assert.match(
  `${missingProjectionOnlySourceResult.stdout}\n${missingProjectionOnlySourceResult.stderr}`,
  /missing-runtime-projection-source-file/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:missing-source-path',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'missing-source-path',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const missingProjectionOnlySourcePathResult = runGate(['--staged']);
assert.notEqual(missingProjectionOnlySourcePathResult.status, 0, 'gate must fail when only a runtime projection row omits sourcePathOrUrl');
assert.match(
  `${missingProjectionOnlySourcePathResult.stdout}\n${missingProjectionOnlySourcePathResult.stderr}`,
  /missing-runtime-projection-source-path/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const routeHandoutPath = path.join(repo, 'course-content/runtime/lessons/1-1/1-1-handout.md');
const baselineCardProjection = JSON.stringify(runtimeProjectionRow({
  id: 'knowledge-card:kn-demo',
  family: 'knowledge-card',
  resourceType: 'knowledge_card',
  sourceKind: 'knowledge_graph',
  sourceRef: 'kn-demo',
  sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
  sourceVersionRef: 'runtime-knowledge-card.v1',
}));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${baselineCardProjection}\n${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-handout:1-1',
    family: 'runtime-handout',
    resourceType: 'handout',
    sourceKind: 'runtime_handout',
    sourceRef: '1-1',
    sourcePathOrUrl: '/course-runtime/lessons/1-1/1-1-handout.md',
    sourceHash: sha256File(routeHandoutPath),
    sourceVersionRef: 'runtime-handout.v1',
    independentEvidenceRef: '/course-runtime/lessons/1-1/1-1-handout.md#1-1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const routedHandoutProjectionResult = runGate(['--staged']);
assert.equal(routedHandoutProjectionResult.status, 0, 'gate must map /course-runtime/lessons paths to course-content runtime files');

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${baselineCardProjection}\n${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-handout:1-1',
    family: 'runtime-handout',
    resourceType: 'handout',
    sourceKind: 'runtime_handout',
    sourceRef: '1-1',
    sourcePathOrUrl: '/course-runtime/lessons/1-1/1-1-handout.md',
    sourceHash: 'sha256:stale-routed-handout',
    sourceVersionRef: 'runtime-handout.v1',
    independentEvidenceRef: '/course-runtime/lessons/1-1/1-1-handout.md#1-1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const staleRoutedHandoutProjectionResult = runGate(['--staged']);
assert.notEqual(staleRoutedHandoutProjectionResult.status, 0, 'gate must fail when routed source paths carry stale hashes');
assert.match(
  `${staleRoutedHandoutProjectionResult.stdout}\n${staleRoutedHandoutProjectionResult.stderr}`,
  /stale-runtime-projection-source-hash/,
);

fs.appendFileSync(cardPath, '\nReviewed update.\n');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const replacedCardProjectionResult = runGate(['--staged']);
assert.equal(replacedCardProjectionResult.status, 0, 'gate must pass when a runtime projection row is replaced by an updated row for the same id');
run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedProjectionOnlyResult = runGate(['--staged']);
assert.notEqual(deletedProjectionOnlyResult.status, 0, 'gate must fail when a runtime projection row is deleted while the source still exists');
assert.match(
  `${deletedProjectionOnlyResult.stdout}\n${deletedProjectionOnlyResult.stderr}`,
  /deleted-runtime-projection-row/,
);
run('git', ['reset', '--hard', 'HEAD'], repo);
fs.rmSync(cardPath);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedCardProjectionResult = runGate(['--staged']);
assert.equal(deletedCardProjectionResult.status, 0, 'gate must not require added projection rows for deletion-only runtime sources');

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${baselineCardProjection}\n${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-handout:1-1',
    family: 'runtime-handout',
    resourceType: 'handout',
    sourceKind: 'runtime_handout',
    sourceRef: '1-1',
    sourcePathOrUrl: '/course-runtime/lessons/1-1/1-1-handout.md',
    sourceHash: sha256File(routeHandoutPath),
    sourceVersionRef: 'runtime-handout.v1',
    independentEvidenceRef: '/course-runtime/lessons/1-1/1-1-handout.md#1-1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add routed handout projection baseline'], repo);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), `${baselineCardProjection}\n`);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedRoutedProjectionOnlyResult = runGate(['--staged']);
assert.notEqual(deletedRoutedProjectionOnlyResult.status, 0, 'gate must fail without fatal pathspec errors when a routed projection row is deleted while the source still exists');
assert.match(
  `${deletedRoutedProjectionOnlyResult.stdout}\n${deletedRoutedProjectionOnlyResult.stderr}`,
  /deleted-runtime-projection-row/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.rmSync(routeHandoutPath);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), `${baselineCardProjection}\n`);
run('git', ['add', 'course-content/runtime/lessons/1-1/1-1-handout.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedRoutedProjectionWithSourceResult = runGate(['--staged']);
assert.equal(deletedRoutedProjectionWithSourceResult.status, 0, 'gate must pass when a routed projection row and its mapped runtime source file are deleted together');

console.log('new resource semantic completeness command contract passed');

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'pipe' });
}

function runGate(args) {
  return spawnSync(tsxBin, ['./scripts/data-governance/check-new-resource-semantic-completeness.ts', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
}

function runtimeProjectionRow(overrides) {
  const sourceHash = overrides.sourceHash ?? sourceHashForRuntimeProjectionRow(overrides);
  return {
    artifactVersion: 'runtime-resource-projections.v1',
    id: overrides.id,
    resourceNodeId: null,
    title: 'Runtime projection test row',
    family: overrides.family,
    resourceType: overrides.resourceType,
    sourceKind: overrides.sourceKind,
    sourceRef: overrides.sourceRef,
    sourcePathOrUrl: overrides.sourcePathOrUrl,
    sourceHash,
    sourceVersionRef: overrides.sourceVersionRef,
    projectionLevel: 'ResourceSegment',
    routeTarget: null,
    renderTarget: null,
    graphNodeRefs: {
      knowledge: ['kn-demo'],
      capability: [],
      quality: [],
    },
    estimatedTimeMinutes: null,
    evidenceInstrumentation: [],
    privacyScope: 'student-visible',
    teacherPolicy: 'allowed',
    evidenceContract: {
      complete: false,
      missingFields: ['eventType'],
      eventSource: true,
      eventType: false,
      clientEventIdPolicy: false,
      attemptKey: false,
      sourceLogId: false,
      dedupeKey: true,
      timestamps: false,
      learningFactPolicy: false,
      learningFactMaterializationPolicy: 'missing',
      confidencePolicy: true,
      privacyScope: true,
    },
    reviewAudit: {
      status: 'human-confirmed',
      reviewerId: 'runtime-source-projection-test-reviewer',
      reviewerRole: 'data-governance',
      reviewedAt: '2026-07-09T00:00:00.000Z',
      reviewBatchId: 'runtime-source-projection-test',
      reviewedSourceHash: sourceHash,
      reviewedVersionRef: overrides.sourceVersionRef,
      generationToolOrModel: 'test-fixture',
      promptOrManifestHash: null,
      reviewerVisibleRationale: 'Reviewed runtime source projection test fixture.',
      independentEvidenceRef: overrides.independentEvidenceRef ?? `${overrides.sourcePathOrUrl}#test`,
      confidence: 0.9,
      staleInvalidationRule: 'stale when source hash or version changes',
    },
    citationTargets: [overrides.sourcePathOrUrl],
  };
}

function sha256File(filePath) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function sourceHashForRuntimeProjectionRow(overrides) {
  if (!overrides.sourcePathOrUrl) return 'sha256:runtime-source';
  const sourcePath = path.join(repo, overrides.sourcePathOrUrl);
  return fs.existsSync(sourcePath) ? sha256File(sourcePath) : 'sha256:runtime-source';
}
