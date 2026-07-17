import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
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
const testBaselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();

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
    sourceRef: '1-1:step-01',
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
    sourceRef: '2-1:step-01',
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
    sourceRef: '1-1:step-01',
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
    'same-id': {
      title: 'Step and module share an id',
      modules: [
        {
          id: 'same-id',
          title: 'Same-id module',
        },
      ],
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-module:1-1:same-id:same-id',
    family: 'runtime-lesson-module',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1:same-id:same-id',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const sameIdLessonProjectionResult = runGate(['--staged']);
assert.notEqual(sameIdLessonProjectionResult.status, 0, 'a module projection must not satisfy a same-named runtime lesson step requirement');
assert.match(
  `${sameIdLessonProjectionResult.stdout}\n${sameIdLessonProjectionResult.stderr}`,
  /interactive-manifest\.json#same-id/,
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
    sourceRef: '1-1:step-01',
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

const lessonFieldDeletionTestParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: 'field-delete',
  steps: {
    'step-fields': {
      title: 'Delete this step title',
      modules: [
        {
          id: 'module-fields',
          title: 'Delete this module title',
          payload: { prompt: 'Keep this payload' },
          evidence: ['keep-this-evidence'],
        },
      ],
    },
  },
}, null, 2));
const baselineFieldStepProjection = runtimeLessonStepProjectionRow('field-delete', 'step-fields');
const baselineFieldModuleProjection = runtimeLessonModuleProjectionRow('field-delete', 'step-fields', 'module-fields');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${baselineFieldStepProjection}\n${baselineFieldModuleProjection}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add lesson field deletion baseline'], repo);

fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: 'field-delete',
  steps: {
    'step-fields': {
      modules: [
        {
          id: 'module-fields',
          title: 'Delete this module title',
          payload: { prompt: 'Keep this payload' },
          evidence: ['keep-this-evidence'],
        },
      ],
    },
  },
}, null, 2));
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
const missingStepFieldProjectionUpdateResult = runGate(['--staged']);
assert.notEqual(missingStepFieldProjectionUpdateResult.status, 0, 'deleting only a step field must require the surviving step projection to be updated');
assert.match(
  `${missingStepFieldProjectionUpdateResult.stdout}\n${missingStepFieldProjectionUpdateResult.stderr}`,
  /field-delete:step-fields/,
);

const stepFieldDeletedProjection = runtimeLessonStepProjectionRow('field-delete', 'step-fields');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${stepFieldDeletedProjection}\n${baselineFieldModuleProjection}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedStepFieldProjectionUpdateResult = runGate(['--staged']);
assert.equal(syncedStepFieldProjectionUpdateResult.status, 0, 'step field deletion must pass after updating the surviving step projection hash');
run('git', ['commit', '--no-verify', '-m', 'delete step field and update projection'], repo);
const baseSyncedStepFieldProjectionUpdateResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedStepFieldProjectionUpdateResult.status, 0, 'base mode must map deleted step fields back to the surviving step identity');

fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: 'field-delete',
  steps: {
    'step-fields': {
      modules: [
        {
          id: 'module-fields',
          payload: { prompt: 'Keep this payload' },
          evidence: ['keep-this-evidence'],
        },
      ],
    },
  },
}, null, 2));
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
const missingModuleFieldProjectionUpdateResult = runGate(['--staged']);
assert.notEqual(missingModuleFieldProjectionUpdateResult.status, 0, 'deleting only a module field must require its surviving lesson projections to be updated');
assert.match(
  `${missingModuleFieldProjectionUpdateResult.stdout}\n${missingModuleFieldProjectionUpdateResult.stderr}`,
  /field-delete:step-fields:module-fields/,
);

fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  runtimeLessonProjectionRows('field-delete', 'step-fields', 'module-fields'),
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedModuleFieldProjectionUpdateResult = runGate(['--staged']);
assert.equal(syncedModuleFieldProjectionUpdateResult.status, 0, 'module field deletion must pass after updating the surviving step and module projection hashes');
run('git', ['commit', '--no-verify', '-m', 'delete module field and update projections'], repo);
const baseSyncedModuleFieldProjectionUpdateResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedModuleFieldProjectionUpdateResult.status, 0, 'base mode must map deleted module fields back to the surviving module identity');
run('git', ['reset', '--hard', lessonFieldDeletionTestParent], repo);

const lessonDeletionTestParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {
    'step-delete': {
      title: 'Runtime lesson step to delete',
      modules: [
        {
          id: 'module-delete',
          title: 'Runtime lesson module to delete',
        },
      ],
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-step:1-1:step-delete',
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1:step-delete',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-module:1-1:step-delete:module-delete',
    family: 'runtime-lesson-module',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1:step-delete:module-delete',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add deletable lesson projection baseline'], repo);

fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: '1-1',
  steps: {},
}, null, 2));
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
const missingDeletedLessonProjectionResult = runGate(['--staged']);
assert.notEqual(missingDeletedLessonProjectionResult.status, 0, 'gate must fail when deleted lesson step and module records retain their projection rows');
assert.match(
  `${missingDeletedLessonProjectionResult.stdout}\n${missingDeletedLessonProjectionResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
assert.match(
  `${missingDeletedLessonProjectionResult.stdout}\n${missingDeletedLessonProjectionResult.stderr}`,
  /interactive-manifest\.json#step-delete/,
);
assert.match(
  `${missingDeletedLessonProjectionResult.stdout}\n${missingDeletedLessonProjectionResult.stderr}`,
  /interactive-manifest\.json#1-1:step-delete:module-delete/,
);

fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-step:1-1:step-delete',
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1:step-delete',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v2',
  }))}\n${JSON.stringify(runtimeProjectionRow({
    id: 'lesson-module:1-1:step-delete:module-delete',
    family: 'runtime-lesson-module',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: '1-1:step-delete:module-delete',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v2',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const updatedInsteadOfDeletedLessonProjectionResult = runGate(['--staged']);
assert.notEqual(updatedInsteadOfDeletedLessonProjectionResult.status, 0, 're-adding the same projection ids must not satisfy deleted lesson record coverage');
assert.match(
  `${updatedInsteadOfDeletedLessonProjectionResult.stdout}\n${updatedInsteadOfDeletedLessonProjectionResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);

fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedDeletedLessonProjectionResult = runGate(['--staged']);
assert.equal(syncedDeletedLessonProjectionResult.status, 0, 'gate must pass when deleted lesson step and module records delete their projection rows in the same diff');
run('git', ['commit', '--no-verify', '-m', 'delete lesson projection records'], repo);
const baseSyncedDeletedLessonProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedDeletedLessonProjectionResult.status, 0, 'base mode must compare deleted lesson records with the merge-base manifest and projection rows');
run('git', ['reset', '--hard', lessonDeletionTestParent], repo);

const lessonRenameTestParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: 'lesson-old',
  steps: {
    'step-rename': {
      title: 'Lesson identity rename fixture',
      modules: [{ id: 'module-rename' }],
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  runtimeLessonProjectionRows('lesson-old', 'step-rename', 'module-rename'),
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add renameable lesson identity baseline'], repo);

fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: 'lesson-new',
  steps: {
    'step-rename': {
      title: 'Lesson identity rename fixture',
      modules: [{ id: 'module-rename' }],
    },
  },
}, null, 2));
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
const missingRenamedLessonProjectionResult = runGate(['--staged']);
assert.notEqual(missingRenamedLessonProjectionResult.status, 0, 'changing only lesson_id must require old projection deletion and new projection creation');
assert.match(
  `${missingRenamedLessonProjectionResult.stdout}\n${missingRenamedLessonProjectionResult.stderr}`,
  /lesson-old:step-rename/,
);
assert.match(
  `${missingRenamedLessonProjectionResult.stdout}\n${missingRenamedLessonProjectionResult.stderr}`,
  /lesson-new:step-rename/,
);

fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  runtimeLessonProjectionRows('lesson-new', 'step-rename', 'module-rename'),
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedRenamedLessonProjectionResult = runGate(['--staged']);
assert.equal(syncedRenamedLessonProjectionResult.status, 0, 'lesson_id rename must pass after replacing all old canonical projection identities');
run('git', ['commit', '--no-verify', '-m', 'rename lesson identity and projections'], repo);
const baseSyncedRenamedLessonProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedRenamedLessonProjectionResult.status, 0, 'base mode must enforce canonical projection replacement for lesson_id changes');
run('git', ['reset', '--hard', lessonRenameTestParent], repo);

const wholeLessonDeletionTestParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
fs.writeFileSync(lessonManifestPath, JSON.stringify({
  lesson_id: 'whole-delete',
  steps: {
    'step-whole-delete': {
      title: 'Whole manifest deletion fixture',
      modules: [{ id: 'module-whole-delete' }],
    },
  },
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  runtimeLessonProjectionRows('whole-delete', 'step-whole-delete', 'module-whole-delete'),
);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add whole lesson deletion baseline'], repo);

fs.rmSync(lessonManifestPath);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
const missingWholeLessonDeletionProjectionResult = runGate(['--staged']);
assert.notEqual(missingWholeLessonDeletionProjectionResult.status, 0, 'deleting an entire lesson manifest must require all step and module projection rows to be deleted');
assert.match(
  `${missingWholeLessonDeletionProjectionResult.stdout}\n${missingWholeLessonDeletionProjectionResult.stderr}`,
  /whole-delete:step-whole-delete/,
);
assert.match(
  `${missingWholeLessonDeletionProjectionResult.stdout}\n${missingWholeLessonDeletionProjectionResult.stderr}`,
  /whole-delete:step-whole-delete:module-whole-delete/,
);

fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedWholeLessonDeletionProjectionResult = runGate(['--staged']);
assert.equal(syncedWholeLessonDeletionProjectionResult.status, 0, 'whole lesson deletion must pass when all canonical projection rows are deleted');
run('git', ['commit', '--no-verify', '-m', 'delete whole lesson manifest and projections'], repo);
const baseSyncedWholeLessonDeletionProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedWholeLessonDeletionProjectionResult.status, 0, 'base mode must read all deleted lesson identities from the merge-base manifest blob');
run('git', ['reset', '--hard', wholeLessonDeletionTestParent], repo);

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
const externalMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/external-media.md');
const externalMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/external-media.md';
fs.mkdirSync(path.dirname(externalMediaIndexPath), { recursive: true });
fs.writeFileSync(externalMediaIndexPath, '# external-media.mp4\n\nhttps://example.invalid/external-media.mp4\n');
run('git', ['add', externalMediaIndexRelativePath], repo);
const externalAssetProjection = runtimeProjectionRow({
  id: 'runtime-media:1-1:external-media.mp4',
  family: 'runtime-lesson-media',
  resourceType: 'video',
  sourceKind: 'runtime_lesson_media',
  sourceRef: '1-1:external-media',
  sourcePathOrUrl: 'https://example.invalid/external-media.mp4',
  sourceVersionRef: 'runtime-lesson-media.v1',
  independentEvidenceRef: `${externalMediaIndexRelativePath}#markdown-line:1`,
});
externalAssetProjection.sourceRecord = '1-1:external-media';
externalAssetProjection.sourceHash = null;
externalAssetProjection.reviewAudit.reviewedSourceHash = null;
externalAssetProjection.runtimeSemanticEvidence = {
  schemaVersion: 'runtime-lesson-semantic-evidence.v1',
  assetStatus: 'external-http-runtime-asset',
  evidenceFilePath: externalMediaIndexRelativePath,
  evidenceFileHash: sha256File(externalMediaIndexPath),
  evidenceSelector: 'markdown-line:1',
  externalIdentitySha256: createHash('sha256').update('https://example.invalid/external-media.mp4').digest('hex'),
  sourceFileKind: 'external-media',
  sourceFilePath: 'external-media:external-media.mp4',
  sourceFileHash: null,
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(externalAssetProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedExternalAssetProjectionResult = runGate(['--staged']);
assert.equal(
  syncedExternalAssetProjectionResult.status,
  0,
  'gate must accept non-local runtime media when sourceHash/reviewedSourceHash are null but evidenceFileHash matches the staged media-index',
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const missingLocalMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/missing-local-media.md');
const missingLocalMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/missing-local-media.md';
fs.mkdirSync(path.dirname(missingLocalMediaIndexPath), { recursive: true });
fs.writeFileSync(missingLocalMediaIndexPath, '# missing-local-media.mp4\n\nmissing-local-media.mp4\n');
run('git', ['add', missingLocalMediaIndexRelativePath], repo);
const missingLocalAssetProjection = runtimeProjectionRow({
  id: 'runtime-media:1-1:missing-local-media.mp4',
  family: 'runtime-lesson-media',
  resourceType: 'video',
  sourceKind: 'runtime_lesson_media',
  sourceRef: '1-1:missing-local-media',
  sourcePathOrUrl: 'course-content/runtime/lessons/1-1/media/missing-local-media.mp4',
  sourceVersionRef: 'runtime-lesson-media.v1',
  independentEvidenceRef: `${missingLocalMediaIndexRelativePath}#markdown-line:1`,
});
missingLocalAssetProjection.sourceRecord = '1-1:missing-local-media';
missingLocalAssetProjection.sourceHash = null;
missingLocalAssetProjection.reviewAudit.reviewedSourceHash = null;
missingLocalAssetProjection.runtimeSemanticEvidence = {
  schemaVersion: 'runtime-lesson-semantic-evidence.v1',
  assetStatus: 'missing-local-runtime-asset',
  evidenceFilePath: missingLocalMediaIndexRelativePath,
  evidenceFileHash: sha256File(missingLocalMediaIndexPath),
  evidenceSelector: 'markdown-line:1',
  externalIdentitySha256: null,
  sourceFileKind: 'missing-local-runtime-asset',
  sourceFilePath: 'missing-local-runtime-asset:missing-local-media.mp4',
  sourceFileHash: null,
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(missingLocalAssetProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedMissingLocalAssetProjectionResult = runGate(['--staged']);
assert.equal(
  syncedMissingLocalAssetProjectionResult.status,
  0,
  'gate must accept missing-local runtime media when sourceHash/reviewedSourceHash are null but evidenceFileHash matches the staged media-index',
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const projectionOnlyExternalMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/projection-only-media.md');
const projectionOnlyExternalMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/projection-only-media.md';
const projectionOnlyExternalMediaUrl = 'https://example.invalid/projection-only-external.mp4';
fs.mkdirSync(path.dirname(projectionOnlyExternalMediaIndexPath), { recursive: true });
fs.writeFileSync(
  projectionOnlyExternalMediaIndexPath,
  `# projection-only-external.mp4\n\n${projectionOnlyExternalMediaUrl}\n`,
);
const projectionOnlyExternalBaseline = withRuntimeMediaEvidenceAlias(
  runtimeExternalMediaProjection({
    id: 'runtime-media:1-1:projection-only-external',
    filename: 'projection-only-external.mp4',
    url: projectionOnlyExternalMediaUrl,
    evidenceFilePath: projectionOnlyExternalMediaIndexRelativePath,
    headingLine: 1,
  }),
  projectionOnlyExternalMediaIndexRelativePath,
  1,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalBaseline)}\n`,
);
run('git', ['add', projectionOnlyExternalMediaIndexRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'projection-only media baseline'], repo);
const projectionOnlyExternalBaselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();

const runtimeHandoutEvidenceRelativePath = 'course-content/runtime/lessons/1-1/1-1-handout.md';
const projectionOnlyExternalHandoutEvidence = runtimeExternalMediaProjection({
  id: projectionOnlyExternalBaseline.id,
  filename: 'projection-only-external.mp4',
  url: projectionOnlyExternalMediaUrl,
  evidenceFilePath: runtimeHandoutEvidenceRelativePath,
  headingLine: 1,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalHandoutEvidence)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const projectionOnlyExternalHandoutEvidenceResult = runGate(['--staged']);
assert.notEqual(
  projectionOnlyExternalHandoutEvidenceResult.status,
  0,
  'projection-only external media must reject an ordinary handout as semantic evidence',
);
assert.match(
  `${projectionOnlyExternalHandoutEvidenceResult.stdout}\n${projectionOnlyExternalHandoutEvidenceResult.stderr}`,
  /runtime-media:1-1:projection-only-external.*unbound-runtime-media-index-record/s,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const projectionOnlyExternalHandoutReviewRef = runtimeExternalMediaProjection({
  id: projectionOnlyExternalBaseline.id,
  filename: 'projection-only-external.mp4',
  url: projectionOnlyExternalMediaUrl,
  evidenceFilePath: projectionOnlyExternalMediaIndexRelativePath,
  headingLine: 1,
});
projectionOnlyExternalHandoutReviewRef.reviewAudit.independentEvidenceRef =
  `${runtimeHandoutEvidenceRelativePath}#markdown-line:1`;
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalHandoutReviewRef)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const projectionOnlyExternalHandoutReviewRefResult = runGate(['--staged']);
assert.notEqual(
  projectionOnlyExternalHandoutReviewRefResult.status,
  0,
  'projection-only external media must reject an ordinary handout independentEvidenceRef',
);
assert.match(
  `${projectionOnlyExternalHandoutReviewRefResult.stdout}\n${projectionOnlyExternalHandoutReviewRefResult.stderr}`,
  /runtime-media:1-1:projection-only-external.*unbound-runtime-media-index-record/s,
);

run('git', ['reset', '--hard', projectionOnlyExternalBaselineCommit], repo);

const projectionOnlyExternalWrongSelector = withRuntimeMediaEvidenceAlias(
  runtimeExternalMediaProjection({
    id: projectionOnlyExternalBaseline.id,
    filename: 'projection-only-external.mp4',
    url: projectionOnlyExternalMediaUrl,
    evidenceFilePath: projectionOnlyExternalMediaIndexRelativePath,
    headingLine: 9999,
  }),
  projectionOnlyExternalMediaIndexRelativePath,
  9999,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalWrongSelector)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const projectionOnlyExternalWrongSelectorResult = runGate(['--staged']);
assert.notEqual(
  projectionOnlyExternalWrongSelectorResult.status,
  0,
  'projection-only staged external media update must reject a wrong media-index selector even when evidenceFileHash is current',
);
assert.match(
  `${projectionOnlyExternalWrongSelectorResult.stdout}\n${projectionOnlyExternalWrongSelectorResult.stderr}`,
  /runtime-media:1-1:projection-only-external.*stale-runtime-media-index-evidence/s,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const projectionOnlyExternalWrongReviewRef = withRuntimeMediaEvidenceAlias(
  runtimeExternalMediaProjection({
    id: projectionOnlyExternalBaseline.id,
    filename: 'projection-only-external.mp4',
    url: projectionOnlyExternalMediaUrl,
    evidenceFilePath: projectionOnlyExternalMediaIndexRelativePath,
    headingLine: 1,
  }),
  projectionOnlyExternalMediaIndexRelativePath,
  1,
);
projectionOnlyExternalWrongReviewRef.reviewAudit.independentEvidenceRef =
  `${projectionOnlyExternalWrongReviewRef.runtimeSemanticEvidence.evidenceFilePath}#markdown-line:9999`;
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalWrongReviewRef)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const projectionOnlyExternalWrongReviewRefResult = runGate(['--staged']);
assert.notEqual(
  projectionOnlyExternalWrongReviewRefResult.status,
  0,
  'projection-only staged external media update must reject a wrong independentEvidenceRef fragment even when the semantic selector and evidence hash are current',
);
assert.match(
  `${projectionOnlyExternalWrongReviewRefResult.stdout}\n${projectionOnlyExternalWrongReviewRefResult.stderr}`,
  /runtime-media:1-1:projection-only-external.*stale-runtime-media-index-evidence/s,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const projectionOnlyExternalCorrect = withRuntimeMediaEvidenceAlias(
  runtimeExternalMediaProjection({
    id: projectionOnlyExternalBaseline.id,
    filename: 'projection-only-external.mp4',
    url: projectionOnlyExternalMediaUrl,
    evidenceFilePath: projectionOnlyExternalMediaIndexRelativePath,
    headingLine: 1,
  }),
  projectionOnlyExternalMediaIndexRelativePath,
  1,
);
projectionOnlyExternalCorrect.title = 'Projection-only external media update';
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalCorrect)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const projectionOnlyExternalCorrectResult = runGate(['--staged']);
assert.equal(
  projectionOnlyExternalCorrectResult.status,
  0,
  `projection-only staged external media update must accept the current selector, alias-compatible evidence path, and exact review ref\n${projectionOnlyExternalCorrectResult.stdout}\n${projectionOnlyExternalCorrectResult.stderr}`,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const projectionOnlyExternalBaseWrongSelector = withRuntimeMediaEvidenceAlias(
  runtimeExternalMediaProjection({
    id: projectionOnlyExternalBaseline.id,
    filename: 'projection-only-external.mp4',
    url: projectionOnlyExternalMediaUrl,
    evidenceFilePath: projectionOnlyExternalMediaIndexRelativePath,
    headingLine: 9999,
  }),
  projectionOnlyExternalMediaIndexRelativePath,
  9999,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalBaseWrongSelector)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'projection-only media wrong selector'], repo);
const projectionOnlyExternalBaseWrongSelectorResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(
  projectionOnlyExternalBaseWrongSelectorResult.status,
  0,
  'projection-only base external media update must reject a wrong media-index selector',
);
assert.match(
  `${projectionOnlyExternalBaseWrongSelectorResult.stdout}\n${projectionOnlyExternalBaseWrongSelectorResult.stderr}`,
  /runtime-media:1-1:projection-only-external.*stale-runtime-media-index-evidence/s,
);

run('git', ['reset', '--hard', 'HEAD~1'], repo);
const projectionOnlyExternalBaseCorrect = withRuntimeMediaEvidenceAlias(
  runtimeExternalMediaProjection({
    id: projectionOnlyExternalBaseline.id,
    filename: 'projection-only-external.mp4',
    url: projectionOnlyExternalMediaUrl,
    evidenceFilePath: projectionOnlyExternalMediaIndexRelativePath,
    headingLine: 1,
  }),
  projectionOnlyExternalMediaIndexRelativePath,
  1,
);
projectionOnlyExternalBaseCorrect.title = 'Projection-only base external media update';
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyExternalBaseCorrect)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'projection-only media correct selector'], repo);
const projectionOnlyExternalBaseCorrectResult = runGate(['--base', 'HEAD~1']);
assert.equal(
  projectionOnlyExternalBaseCorrectResult.status,
  0,
  `projection-only base external media update must accept the current selector and exact review ref\n${projectionOnlyExternalBaseCorrectResult.stdout}\n${projectionOnlyExternalBaseCorrectResult.stderr}`,
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const projectionOnlyMissingMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/projection-only-missing-media.md');
const projectionOnlyMissingMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/projection-only-missing-media.md';
fs.mkdirSync(path.dirname(projectionOnlyMissingMediaIndexPath), { recursive: true });
fs.writeFileSync(
  projectionOnlyMissingMediaIndexPath,
  '# projection-only-missing.mp4\n\nprojection-only-missing.mp4\n',
);
const projectionOnlyMissingBaseline = withRuntimeMediaEvidenceAlias(
  runtimeMissingLocalMediaProjection({
    id: 'runtime-media:1-1:projection-only-missing',
    filename: 'projection-only-missing.mp4',
    evidenceFilePath: projectionOnlyMissingMediaIndexRelativePath,
    headingLine: 1,
  }),
  projectionOnlyMissingMediaIndexRelativePath,
  1,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyMissingBaseline)}\n`,
);
run('git', ['add', projectionOnlyMissingMediaIndexRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'projection-only missing media baseline'], repo);

const projectionOnlyMissingWrongSelector = withRuntimeMediaEvidenceAlias(
  runtimeMissingLocalMediaProjection({
    id: projectionOnlyMissingBaseline.id,
    filename: 'projection-only-missing.mp4',
    evidenceFilePath: projectionOnlyMissingMediaIndexRelativePath,
    headingLine: 9999,
  }),
  projectionOnlyMissingMediaIndexRelativePath,
  9999,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyMissingWrongSelector)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const projectionOnlyMissingWrongSelectorResult = runGate(['--staged']);
assert.notEqual(
  projectionOnlyMissingWrongSelectorResult.status,
  0,
  'projection-only staged missing-local media update must reject a wrong media-index selector even when evidenceFileHash is current',
);
assert.match(
  `${projectionOnlyMissingWrongSelectorResult.stdout}\n${projectionOnlyMissingWrongSelectorResult.stderr}`,
  /runtime-media:1-1:projection-only-missing.*stale-runtime-media-index-evidence/s,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const projectionOnlyMissingCorrect = withRuntimeMediaEvidenceAlias(
  runtimeMissingLocalMediaProjection({
    id: projectionOnlyMissingBaseline.id,
    filename: 'projection-only-missing.mp4',
    evidenceFilePath: projectionOnlyMissingMediaIndexRelativePath,
    headingLine: 1,
  }),
  projectionOnlyMissingMediaIndexRelativePath,
  1,
);
projectionOnlyMissingCorrect.title = 'Projection-only missing media update';
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(projectionOnlyMissingCorrect)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const projectionOnlyMissingCorrectResult = runGate(['--staged']);
assert.equal(
  projectionOnlyMissingCorrectResult.status,
  0,
  `projection-only staged missing-local media update must accept the current selector, alias-compatible evidence path, and exact review ref\n${projectionOnlyMissingCorrectResult.stdout}\n${projectionOnlyMissingCorrectResult.stderr}`,
);

run('git', ['commit', '--no-verify', '-m', 'projection-only missing media correct selector'], repo);
const projectionOnlyMissingBaseCorrectResult = runGate(['--base', 'HEAD~1']);
assert.equal(
  projectionOnlyMissingBaseCorrectResult.status,
  0,
  `projection-only base missing-local media update must accept the current selector and exact review ref\n${projectionOnlyMissingBaseCorrectResult.stdout}\n${projectionOnlyMissingBaseCorrectResult.stderr}`,
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const duplicateMediaIndexAPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/duplicate-a-media.md');
const duplicateMediaIndexARelativePath = 'course-content/runtime/lessons/1-1/media/duplicate-a-media.md';
const duplicateMediaIndexBPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/duplicate-b-media.md');
const duplicateMediaIndexBRelativePath = 'course-content/runtime/lessons/1-1/media/duplicate-b-media.md';
const duplicateMediaUrl = 'https://example.invalid/duplicate-owner.mp4';
const duplicateMediaIndexSource = `# duplicate-owner.mp4\n\n${duplicateMediaUrl}\n`;
fs.mkdirSync(path.dirname(duplicateMediaIndexAPath), { recursive: true });
fs.writeFileSync(duplicateMediaIndexAPath, duplicateMediaIndexSource);
fs.writeFileSync(duplicateMediaIndexBPath, duplicateMediaIndexSource);
const duplicateMediaProjectionA = runtimeExternalMediaProjection({
  id: 'runtime-media:1-1:duplicate-owner',
  filename: 'duplicate-owner.mp4',
  url: duplicateMediaUrl,
  evidenceFilePath: duplicateMediaIndexARelativePath,
  headingLine: 1,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(duplicateMediaProjectionA)}\n`,
);
run('git', ['add', duplicateMediaIndexARelativePath, duplicateMediaIndexBRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'duplicate media index ownership baseline'], repo);

const duplicateMediaProjectionUpdateA = { ...duplicateMediaProjectionA, title: 'Duplicate media owner A updated' };
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(duplicateMediaProjectionUpdateA)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const duplicateMediaOwnershipResult = runGate(['--staged']);
assert.notEqual(
  duplicateMediaOwnershipResult.status,
  0,
  'projection-only external media rows must reject duplicate canonical ownership across same-lesson media indexes',
);
assert.match(
  `${duplicateMediaOwnershipResult.stdout}\n${duplicateMediaOwnershipResult.stderr}`,
  /runtime-media:1-1:duplicate-owner.*duplicate-runtime-media-index-owner/s,
);

run('git', ['commit', '--no-verify', '-m', 'duplicate media index ownership update'], repo);
const duplicateMediaOwnershipBaseResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(
  duplicateMediaOwnershipBaseResult.status,
  0,
  'base mode must reject duplicate canonical ownership across same-lesson media indexes',
);
assert.match(
  `${duplicateMediaOwnershipBaseResult.stdout}\n${duplicateMediaOwnershipBaseResult.stderr}`,
  /runtime-media:1-1:duplicate-owner.*duplicate-runtime-media-index-owner/s,
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const duplicateTrackedLocalIndexAPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/duplicate-tracked-local-a-media.md');
const duplicateTrackedLocalIndexARelativePath = 'course-content/runtime/lessons/1-1/media/duplicate-tracked-local-a-media.md';
const duplicateTrackedLocalIndexBPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/duplicate-tracked-local-b-media.md');
const duplicateTrackedLocalIndexBRelativePath = 'course-content/runtime/lessons/1-1/media/duplicate-tracked-local-b-media.md';
const duplicateTrackedLocalAssetPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/duplicate-tracked-local.mp4');
const duplicateTrackedLocalAssetRelativePath = 'course-content/runtime/lessons/1-1/media/duplicate-tracked-local.mp4';
const duplicateTrackedLocalIndexSource = '# duplicate-tracked-local.mp4\n\n';
fs.mkdirSync(path.dirname(duplicateTrackedLocalIndexAPath), { recursive: true });
fs.writeFileSync(duplicateTrackedLocalIndexAPath, duplicateTrackedLocalIndexSource);
fs.writeFileSync(duplicateTrackedLocalIndexBPath, duplicateTrackedLocalIndexSource);
fs.writeFileSync(duplicateTrackedLocalAssetPath, 'duplicate tracked-local media fixture\n');
run('git', ['add', duplicateTrackedLocalIndexARelativePath, duplicateTrackedLocalIndexBRelativePath, duplicateTrackedLocalAssetRelativePath], repo);
const duplicateTrackedLocalProjection = runtimeTrackedLocalMediaProjection({
  id: 'runtime-media:1-1:duplicate-tracked-local',
  filename: 'duplicate-tracked-local.mp4',
  sourcePath: duplicateTrackedLocalAssetRelativePath,
  sourceIdentity: '1-1:duplicate-tracked-local',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(duplicateTrackedLocalProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'duplicate tracked-local media index ownership baseline'], repo);

const duplicateTrackedLocalProjectionUpdate = {
  ...duplicateTrackedLocalProjection,
  title: 'Duplicate tracked-local media owner updated',
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(duplicateTrackedLocalProjectionUpdate)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const duplicateTrackedLocalProjectionOnlyResult = runGate(['--staged']);
assert.notEqual(
  duplicateTrackedLocalProjectionOnlyResult.status,
  0,
  'projection-only tracked-local media update must reject duplicate canonical ownership across same-lesson media indexes',
);
assert.match(
  `${duplicateTrackedLocalProjectionOnlyResult.stdout}\n${duplicateTrackedLocalProjectionOnlyResult.stderr}`,
  /runtime-media:1-1:duplicate-tracked-local.*duplicate-runtime-media-index-owner/s,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(duplicateTrackedLocalIndexAPath, `${duplicateTrackedLocalIndexSource}updated\n`);
run('git', ['add', duplicateTrackedLocalIndexARelativePath], repo);
const duplicateTrackedLocalMediaIndexResult = runGate(['--staged']);
assert.notEqual(
  duplicateTrackedLocalMediaIndexResult.status,
  0,
  'media-index staged tracked-local update must reject duplicate canonical ownership across same-lesson media indexes',
);
assert.match(
  `${duplicateTrackedLocalMediaIndexResult.stdout}\n${duplicateTrackedLocalMediaIndexResult.stderr}`,
  /runtime-media:1-1:duplicate-tracked-local.*duplicate-runtime-media-index-owner/s,
);

run('git', ['commit', '--no-verify', '-m', 'duplicate tracked-local media index ownership update'], repo);
const duplicateTrackedLocalBaseResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(
  duplicateTrackedLocalBaseResult.status,
  0,
  'base mode must reject duplicate canonical ownership across same-lesson media indexes for tracked-local media',
);
assert.match(
  `${duplicateTrackedLocalBaseResult.stdout}\n${duplicateTrackedLocalBaseResult.stderr}`,
  /runtime-media:1-1:duplicate-tracked-local.*duplicate-runtime-media-index-owner/s,
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const uniqueTrackedLocalIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/unique-tracked-local-media.md');
const uniqueTrackedLocalIndexRelativePath = 'course-content/runtime/lessons/1-1/media/unique-tracked-local-media.md';
const uniqueTrackedLocalAssetPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/unique-tracked-local.mp4');
const uniqueTrackedLocalAssetRelativePath = 'course-content/runtime/lessons/1-1/media/unique-tracked-local.mp4';
fs.mkdirSync(path.dirname(uniqueTrackedLocalIndexPath), { recursive: true });
fs.writeFileSync(uniqueTrackedLocalIndexPath, '# unique-tracked-local.mp4\n\n');
fs.writeFileSync(uniqueTrackedLocalAssetPath, 'unique tracked-local media fixture\n');
run('git', ['add', uniqueTrackedLocalIndexRelativePath, uniqueTrackedLocalAssetRelativePath], repo);
const uniqueTrackedLocalProjection = runtimeTrackedLocalMediaProjection({
  id: 'runtime-media:1-1:unique-tracked-local',
  filename: 'unique-tracked-local.mp4',
  sourcePath: uniqueTrackedLocalAssetRelativePath,
  sourceIdentity: '1-1:unique-tracked-local',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(uniqueTrackedLocalProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const uniqueTrackedLocalOwnerResult = runGate(['--staged']);
assert.equal(
  uniqueTrackedLocalOwnerResult.status,
  0,
  `a single tracked-local canonical media-index owner must pass\n${uniqueTrackedLocalOwnerResult.stdout}\n${uniqueTrackedLocalOwnerResult.stderr}`,
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const unownedTrackedLocalIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/unowned-tracked-local-media.md');
const unownedTrackedLocalIndexRelativePath = 'course-content/runtime/lessons/1-1/media/unowned-tracked-local-media.md';
const unownedTrackedLocalAssetPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/unowned-tracked-local.mp4');
const unownedTrackedLocalAssetRelativePath = 'course-content/runtime/lessons/1-1/media/unowned-tracked-local.mp4';
const indexedTrackedLocalAssetPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/unrelated-tracked-local.mp4');
const indexedTrackedLocalAssetRelativePath = 'course-content/runtime/lessons/1-1/media/unrelated-tracked-local.mp4';
fs.mkdirSync(path.dirname(unownedTrackedLocalIndexPath), { recursive: true });
fs.writeFileSync(unownedTrackedLocalIndexPath, '# unrelated-tracked-local.mp4\n\n');
fs.writeFileSync(unownedTrackedLocalAssetPath, 'unowned tracked-local media fixture\n');
fs.writeFileSync(indexedTrackedLocalAssetPath, 'indexed tracked-local media fixture\n');
run('git', ['add', unownedTrackedLocalIndexRelativePath, unownedTrackedLocalAssetRelativePath, indexedTrackedLocalAssetRelativePath], repo);
const unownedTrackedLocalProjection = runtimeTrackedLocalMediaProjection({
  id: 'runtime-media:1-1:unowned-tracked-local',
  filename: 'unowned-tracked-local.mp4',
  sourcePath: unownedTrackedLocalAssetRelativePath,
  sourceIdentity: '1-1:unowned-tracked-local',
});
const indexedTrackedLocalProjection = runtimeTrackedLocalMediaProjection({
  id: 'runtime-media:1-1:unrelated-tracked-local',
  filename: 'unrelated-tracked-local.mp4',
  sourcePath: indexedTrackedLocalAssetRelativePath,
  sourceIdentity: '1-1:unrelated-tracked-local',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(unownedTrackedLocalProjection)}\n${JSON.stringify(indexedTrackedLocalProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const unownedTrackedLocalResult = runGate(['--staged']);
assert.equal(
  unownedTrackedLocalResult.status,
  0,
  `a tracked-local asset without a media-index heading owner must remain outside ownership closure\n${unownedTrackedLocalResult.stdout}\n${unownedTrackedLocalResult.stderr}`,
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const identityLessonAIndexPath = path.join(repo, 'course-content/runtime/lessons/identity-a/media/identity-a-media.md');
const identityLessonAIndexRelativePath = 'course-content/runtime/lessons/identity-a/media/identity-a-media.md';
const identityLessonBIndexPath = path.join(repo, 'course-content/runtime/lessons/identity-b/media/identity-b-media.md');
const identityLessonBIndexRelativePath = 'course-content/runtime/lessons/identity-b/media/identity-b-media.md';
const identityLessonAUrl = 'https://example.invalid/identity-a.mp4';
const identityLessonBUrl = 'https://example.invalid/identity-b.mp4';
const identityLessonBUpdatedUrl = 'https://example.invalid/identity-b-updated.mp4';
fs.mkdirSync(path.dirname(identityLessonAIndexPath), { recursive: true });
fs.mkdirSync(path.dirname(identityLessonBIndexPath), { recursive: true });
fs.writeFileSync(identityLessonAIndexPath, `# identity-shared.mp4\n\n${identityLessonAUrl}\n`);
fs.writeFileSync(identityLessonBIndexPath, `# identity-shared.mp4\n\n${identityLessonBUrl}\n`);
run('git', ['add', identityLessonAIndexRelativePath, identityLessonBIndexRelativePath], repo);
const identityLessonAProjection = runtimeExternalMediaProjection({
  id: 'runtime-media:identity-a:identity-shared',
  resourceNodeId: 'runtime-media:identity-a:identity-shared',
  filename: 'identity-shared.mp4',
  url: identityLessonAUrl,
  evidenceFilePath: identityLessonAIndexRelativePath,
  headingLine: 1,
  sourceIdentity: 'identity-a:identity-shared',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(identityLessonAProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'stable runtime media identity baseline'], repo);
const identityBaselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();

const crossLessonProjectionOnly = runtimeExternalMediaProjection({
  id: identityLessonAProjection.id,
  resourceNodeId: identityLessonAProjection.resourceNodeId,
  filename: 'identity-shared.mp4',
  url: identityLessonBUrl,
  evidenceFilePath: identityLessonBIndexRelativePath,
  headingLine: 1,
  sourceIdentity: 'identity-b:identity-shared',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(crossLessonProjectionOnly)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const crossLessonProjectionOnlyResult = runGate(['--staged']);
assert.notEqual(
  crossLessonProjectionOnlyResult.status,
  0,
  'projection-only cross-lesson runtime media rebind must fail closed when row.id remains bound to the original lesson',
);
assert.match(
  `${crossLessonProjectionOnlyResult.stdout}\n${crossLessonProjectionOnlyResult.stderr}`,
  /runtime-media:identity-a:identity-shared.*(?:stale-runtime-media-index-evidence|unbound-runtime-media-index-record|invalid-runtime-media-stable-identity)/s,
);

run('git', ['reset', '--hard', identityBaselineCommit], repo);
const sameLessonUpdatedUrl = 'https://example.invalid/identity-a-updated.mp4';
fs.writeFileSync(identityLessonAIndexPath, `# identity-shared.mp4\n\n${sameLessonUpdatedUrl}\n`);
const sameLessonProjectionUpdate = runtimeExternalMediaProjection({
  id: identityLessonAProjection.id,
  resourceNodeId: identityLessonAProjection.resourceNodeId,
  filename: 'identity-shared.mp4',
  url: sameLessonUpdatedUrl,
  evidenceFilePath: identityLessonAIndexRelativePath,
  headingLine: 1,
  sourceIdentity: 'identity-a:identity-shared',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(sameLessonProjectionUpdate)}\n`,
);
run('git', ['add', identityLessonAIndexRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const sameLessonProjectionUpdateResult = runGate(['--staged']);
assert.equal(
  sameLessonProjectionUpdateResult.status,
  0,
  `correct same-lesson runtime media update must pass\n${sameLessonProjectionUpdateResult.stdout}\n${sameLessonProjectionUpdateResult.stderr}`,
);

run('git', ['reset', '--hard', identityBaselineCommit], repo);
fs.writeFileSync(identityLessonBIndexPath, `# identity-shared.mp4\n\n${identityLessonBUpdatedUrl}\n`);
const crossLessonStaged = runtimeExternalMediaProjection({
  id: identityLessonAProjection.id,
  resourceNodeId: identityLessonAProjection.resourceNodeId,
  filename: 'identity-shared.mp4',
  url: identityLessonBUpdatedUrl,
  evidenceFilePath: identityLessonBIndexRelativePath,
  headingLine: 1,
  sourceIdentity: 'identity-b:identity-shared',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(crossLessonStaged)}\n`,
);
run('git', ['add', identityLessonBIndexRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const crossLessonStagedResult = runGate(['--staged']);
assert.notEqual(
  crossLessonStagedResult.status,
  0,
  'media-index staged cross-lesson runtime media rebind must fail closed when row.id remains bound to the original lesson',
);
assert.match(
  `${crossLessonStagedResult.stdout}\n${crossLessonStagedResult.stderr}`,
  /runtime-media:identity-a:identity-shared.*(?:stale-runtime-media-index-evidence|unbound-runtime-media-index-record|invalid-runtime-media-stable-identity)/s,
);
run('git', ['commit', '--no-verify', '-m', 'cross-lesson runtime media rebind fixture'], repo);
const crossLessonBaseResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(
  crossLessonBaseResult.status,
  0,
  'base mode must reject the cross-lesson runtime media rebind even when mutable source fields are internally consistent',
);
assert.match(
  `${crossLessonBaseResult.stdout}\n${crossLessonBaseResult.stderr}`,
  /runtime-media:identity-a:identity-shared.*(?:stale-runtime-media-index-evidence|unbound-runtime-media-index-record|invalid-runtime-media-stable-identity)/s,
);

run('git', ['reset', '--hard', testBaselineCommit], repo);
const trackedLocalMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/tracked-local-media.md');
const trackedLocalMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/tracked-local-media.md';
const trackedLocalMediaRelativePath = 'course-content/runtime/lessons/1-1/media/tracked-local-media.mp4';
const trackedLocalMediaPath = path.join(repo, trackedLocalMediaRelativePath);
const trackedLocalMediaUrl = 'https://example.invalid/opaque-preview?id=tracked-local-media';
fs.mkdirSync(path.dirname(trackedLocalMediaIndexPath), { recursive: true });
fs.writeFileSync(
  trackedLocalMediaIndexPath,
  `# tracked-local-media.mp4\n\n${trackedLocalMediaUrl}\n`,
);
fs.writeFileSync(trackedLocalMediaPath, 'tracked local media fixture\n');
run('git', ['add', trackedLocalMediaIndexRelativePath, trackedLocalMediaRelativePath], repo);
const trackedLocalAssetProjection = runtimeTrackedLocalMediaProjection({
  id: 'runtime-media:1-1:tracked-local-media',
  filename: 'tracked-local-media.mp4',
  sourcePath: trackedLocalMediaRelativePath,
  sourceIdentity: '1-1:tracked-local-media',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(trackedLocalAssetProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedTrackedLocalAssetProjectionResult = runGate(['--staged']);
assert.equal(
  syncedTrackedLocalAssetProjectionResult.status,
  0,
  `gate must accept staged media index plus staged local media and tracked-local projection even when the heading also has a URL\n${syncedTrackedLocalAssetProjectionResult.stdout}\n${syncedTrackedLocalAssetProjectionResult.stderr}`,
);

const incorrectlyExternalTrackedLocalProjection = runtimeExternalMediaProjection({
  id: trackedLocalAssetProjection.id,
  filename: 'tracked-local-media.mp4',
  url: trackedLocalMediaUrl,
  evidenceFilePath: trackedLocalMediaIndexRelativePath,
  headingLine: 1,
  sourceIdentity: '1-1:tracked-local-media',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(incorrectlyExternalTrackedLocalProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const incorrectlyExternalTrackedLocalProjectionResult = runGate(['--staged']);
assert.notEqual(
  incorrectlyExternalTrackedLocalProjectionResult.status,
  0,
  'gate must reject an external projection when the corresponding local media asset is tracked in the validation index',
);
assert.match(
  `${incorrectlyExternalTrackedLocalProjectionResult.stdout}\n${incorrectlyExternalTrackedLocalProjectionResult.stderr}`,
  /tracked-local-media\.mp4/,
);

fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(trackedLocalAssetProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const trackedLocalMediaMigrationParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
run('git', ['commit', '--no-verify', '-m', 'add tracked-local media migration baseline'], repo);
const trackedLocalMediaMigrationBaseline = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();

fs.rmSync(trackedLocalMediaPath);
run('git', ['add', '-u', trackedLocalMediaRelativePath], repo);
const stagedExternalAfterTrackedLocalDelete = runtimeExternalMediaProjection({
  id: trackedLocalAssetProjection.id,
  filename: 'tracked-local-media.mp4',
  url: trackedLocalMediaUrl,
  evidenceFilePath: trackedLocalMediaIndexRelativePath,
  headingLine: 1,
  sourceIdentity: '1-1:tracked-local-media',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(stagedExternalAfterTrackedLocalDelete)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const stagedTrackedLocalToExternalResult = runGate(['--staged']);
assert.equal(
  stagedTrackedLocalToExternalResult.status,
  0,
  `staged tracked-local to external media replacement must pass\n${stagedTrackedLocalToExternalResult.stdout}\n${stagedTrackedLocalToExternalResult.stderr}`,
);
run('git', ['commit', '--no-verify', '-m', 'migrate tracked-local media to external'], repo);
const baseTrackedLocalToExternalResult = runGate(['--base', 'HEAD~1']);
assert.equal(
  baseTrackedLocalToExternalResult.status,
  0,
  `base mode must accept tracked-local to external media replacement\n${baseTrackedLocalToExternalResult.stdout}\n${baseTrackedLocalToExternalResult.stderr}`,
);
run('git', ['reset', '--hard', trackedLocalMediaMigrationBaseline], repo);

fs.rmSync(trackedLocalMediaPath);
run('git', ['add', '-u', trackedLocalMediaRelativePath], repo);
const staleExternalEvidenceHashReplacement = runtimeExternalMediaProjection({
  id: trackedLocalAssetProjection.id,
  filename: 'tracked-local-media.mp4',
  url: trackedLocalMediaUrl,
  evidenceFilePath: trackedLocalMediaIndexRelativePath,
  headingLine: 1,
  sourceIdentity: '1-1:tracked-local-media',
});
staleExternalEvidenceHashReplacement.runtimeSemanticEvidence.evidenceFileHash = `sha256:${'0'.repeat(64)}`;
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(staleExternalEvidenceHashReplacement)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const stagedStaleExternalEvidenceHashResult = runGate(['--staged']);
assert.notEqual(
  stagedStaleExternalEvidenceHashResult.status,
  0,
  'staged tracked-local deletion must reject an external replacement with a stale media-index evidence hash',
);
assert.match(
  `${stagedStaleExternalEvidenceHashResult.stdout}\n${stagedStaleExternalEvidenceHashResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
run('git', ['commit', '--no-verify', '-m', 'reject stale tracked-local media evidence hash'], repo);
const baseStaleExternalEvidenceHashResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(
  baseStaleExternalEvidenceHashResult.status,
  0,
  'base mode must reject an external replacement with a stale media-index evidence hash',
);
assert.match(
  `${baseStaleExternalEvidenceHashResult.stdout}\n${baseStaleExternalEvidenceHashResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
run('git', ['reset', '--hard', trackedLocalMediaMigrationBaseline], repo);

fs.writeFileSync(trackedLocalMediaIndexPath, '# tracked-local-media.mp4\n\n');
fs.rmSync(trackedLocalMediaPath);
run('git', ['add', '-u', trackedLocalMediaIndexRelativePath, trackedLocalMediaRelativePath], repo);
const stagedMissingAfterTrackedLocalDelete = runtimeMissingLocalMediaProjection({
  id: trackedLocalAssetProjection.id,
  filename: 'tracked-local-media.mp4',
  evidenceFilePath: trackedLocalMediaIndexRelativePath,
  headingLine: 1,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(stagedMissingAfterTrackedLocalDelete)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const stagedTrackedLocalToMissingResult = runGate(['--staged']);
assert.equal(
  stagedTrackedLocalToMissingResult.status,
  0,
  `staged tracked-local to missing-local media replacement must pass\n${stagedTrackedLocalToMissingResult.stdout}\n${stagedTrackedLocalToMissingResult.stderr}`,
);
run('git', ['commit', '--no-verify', '-m', 'migrate tracked-local media to missing-local'], repo);
const baseTrackedLocalToMissingResult = runGate(['--base', 'HEAD~1']);
assert.equal(
  baseTrackedLocalToMissingResult.status,
  0,
  `base mode must accept tracked-local to missing-local media replacement\n${baseTrackedLocalToMissingResult.stdout}\n${baseTrackedLocalToMissingResult.stderr}`,
);
run('git', ['reset', '--hard', trackedLocalMediaMigrationBaseline], repo);

fs.rmSync(trackedLocalMediaPath);
run('git', ['add', '-u', trackedLocalMediaRelativePath], repo);
const stagedUnrelatedIdentityReplacement = runtimeExternalMediaProjection({
  id: trackedLocalAssetProjection.id,
  filename: 'tracked-local-media.mp4',
  url: trackedLocalMediaUrl,
  evidenceFilePath: trackedLocalMediaIndexRelativePath,
  headingLine: 1,
  sourceIdentity: '1-1:unrelated-media',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(stagedUnrelatedIdentityReplacement)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const stagedUnrelatedIdentityReplacementResult = runGate(['--staged']);
assert.notEqual(
  stagedUnrelatedIdentityReplacementResult.status,
  0,
  'staged tracked-local deletion must reject a same-id replacement with an unrelated canonical media identity',
);
assert.match(
  `${stagedUnrelatedIdentityReplacementResult.stdout}\n${stagedUnrelatedIdentityReplacementResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
run('git', ['commit', '--no-verify', '-m', 'reject unrelated tracked-local media replacement'], repo);
const baseUnrelatedIdentityReplacementResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(
  baseUnrelatedIdentityReplacementResult.status,
  0,
  'base mode must reject a same-id replacement with an unrelated canonical media identity',
);
assert.match(
  `${baseUnrelatedIdentityReplacementResult.stdout}\n${baseUnrelatedIdentityReplacementResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
run('git', ['reset', '--hard', trackedLocalMediaMigrationParent], repo);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.mkdirSync(path.dirname(externalMediaIndexPath), { recursive: true });
fs.writeFileSync(externalMediaIndexPath, '# external-media.mp4\n\nhttps://example.invalid/external-media.mp4\n');
const forgedHandoutPath = path.join(repo, 'course-content/runtime/lessons/1-1/forged-handout.md');
fs.mkdirSync(path.dirname(forgedHandoutPath), { recursive: true });
fs.writeFileSync(forgedHandoutPath, '# forged handout\n');
run('git', ['add', externalMediaIndexRelativePath, 'course-content/runtime/lessons/1-1/forged-handout.md'], repo);
const forgedNonMediaAssetProjection = runtimeProjectionRow({
  id: 'runtime-handout:1-1:forged-asset-status',
  family: 'runtime-handout',
  resourceType: 'handout',
  sourceKind: 'runtime_handout',
  sourceRef: '1-1:forged-asset-status',
  sourcePathOrUrl: 'course-content/runtime/lessons/1-1/forged-handout.md',
  sourceVersionRef: 'runtime-handout.v1',
  independentEvidenceRef: `${externalMediaIndexRelativePath}#markdown-line:3`,
});
forgedNonMediaAssetProjection.sourceHash = null;
forgedNonMediaAssetProjection.reviewAudit.reviewedSourceHash = null;
forgedNonMediaAssetProjection.runtimeSemanticEvidence = {
  schemaVersion: 'runtime-lesson-semantic-evidence.v1',
  assetStatus: 'external-http-runtime-asset',
  evidenceFilePath: externalMediaIndexRelativePath,
  evidenceFileHash: sha256File(externalMediaIndexPath),
  evidenceSelector: 'markdown-line:3',
  externalIdentitySha256: createHash('sha256').update('https://example.invalid/external-media.mp4').digest('hex'),
  sourceFileKind: 'external-media',
  sourceFilePath: 'external-media:external-media.mp4',
  sourceFileHash: null,
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(forgedNonMediaAssetProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const forgedNonMediaAssetProjectionResult = runGate(['--staged']);
assert.notEqual(
  forgedNonMediaAssetProjectionResult.status,
  0,
  'gate must reject non-media projections that forge an asset status to replace source hashes',
);
assert.match(
  `${forgedNonMediaAssetProjectionResult.stdout}\n${forgedNonMediaAssetProjectionResult.stderr}`,
  /missing-reviewed-source-evidence/,
  'shared gate must fail closed when a non-media row forges runtime asset evidence',
);

const forgedFamilySourceMismatchProjection = {
  ...forgedNonMediaAssetProjection,
  id: 'runtime-media:1-1:forged-handout-family',
  family: 'runtime-lesson-media',
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(forgedFamilySourceMismatchProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const forgedFamilySourceMismatchResult = runGate(['--staged']);
assert.notEqual(
  forgedFamilySourceMismatchResult.status,
  0,
  'gate must reject runtime lesson media family rows that use handout sourceKind/resourceType semantics',
);
assert.match(
  `${forgedFamilySourceMismatchResult.stdout}\n${forgedFamilySourceMismatchResult.stderr}`,
  /runtime-media:1-1:forged-handout-family invalid-runtime-projection-family-source-kind/,
  'shared gate must reject inconsistent runtime media family/sourceKind/resourceType rows',
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.mkdirSync(path.dirname(externalMediaIndexPath), { recursive: true });
fs.writeFileSync(externalMediaIndexPath, '# external-media.mp4\n\nhttps://example.invalid/external-media.mp4\n');
run('git', ['add', externalMediaIndexRelativePath], repo);
const mismatchedExternalAssetProjection = {
  ...externalAssetProjection,
  runtimeSemanticEvidence: {
    ...externalAssetProjection.runtimeSemanticEvidence,
    evidenceFileHash: 'sha256:mismatched-evidence-file',
  },
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(mismatchedExternalAssetProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const mismatchedExternalAssetProjectionResult = runGate(['--staged']);
assert.notEqual(
  mismatchedExternalAssetProjectionResult.status,
  0,
  'gate must reject runtime media when evidenceFileHash does not match the staged evidence file',
);
assert.match(
  `${mismatchedExternalAssetProjectionResult.stdout}\n${mismatchedExternalAssetProjectionResult.stderr}`,
  /stale-runtime-projection-source-hash/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const sharedMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/shared-media.md');
const sharedMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/shared-media.md';
const firstSharedMediaUrl = 'https://example.invalid/first-shared-media-v1.mp4';
const secondSharedMediaUrl = 'https://example.invalid/second-shared-media-v1.mp4';
const sharedMediaIndexV1 = [
  '# first-shared-media.mp4',
  '- First shared media',
  firstSharedMediaUrl,
  '# second-shared-media.mp4',
  '- Second shared media',
  secondSharedMediaUrl,
  '',
].join('\n');
fs.mkdirSync(path.dirname(sharedMediaIndexPath), { recursive: true });
fs.writeFileSync(sharedMediaIndexPath, sharedMediaIndexV1);
const firstSharedMediaProjection = runtimeExternalMediaProjection({
  id: 'runtime-media:1-1:first-shared-media',
  filename: 'first-shared-media.mp4',
  url: firstSharedMediaUrl,
  evidenceFilePath: sharedMediaIndexRelativePath,
  headingLine: 1,
});
const secondSharedMediaProjection = runtimeExternalMediaProjection({
  id: 'runtime-media:1-1:second-shared-media',
  filename: 'second-shared-media.mp4',
  url: secondSharedMediaUrl,
  evidenceFilePath: sharedMediaIndexRelativePath,
  headingLine: 4,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(firstSharedMediaProjection)}\n${JSON.stringify(secondSharedMediaProjection)}\n`,
);
run('git', ['add', sharedMediaIndexRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'shared media index baseline'], repo);

const sharedMediaIndexV2 = sharedMediaIndexV1.replace(
  firstSharedMediaUrl,
  'https://example.invalid/first-shared-media-v2.mp4',
).replace('- First shared media', '- First shared media updated\n- First shared media evidence moved');
fs.writeFileSync(sharedMediaIndexPath, sharedMediaIndexV2);
run('git', ['add', sharedMediaIndexRelativePath], repo);
const unrelatedSharedMediaProjection = runtimeExternalMediaProjection({
  id: secondSharedMediaProjection.id,
  filename: 'second-shared-media.mp4',
  url: secondSharedMediaUrl,
  evidenceFilePath: sharedMediaIndexRelativePath,
  headingLine: 4,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(firstSharedMediaProjection)}\n${JSON.stringify(unrelatedSharedMediaProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const unrelatedSharedMediaProjectionResult = runGate(['--staged']);
assert.notEqual(
  unrelatedSharedMediaProjectionResult.status,
  0,
  'gate must reject an unrelated shared media-index projection row when a different media record changed',
);
assert.match(
  `${unrelatedSharedMediaProjectionResult.stdout}\n${unrelatedSharedMediaProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/media\/shared-media\.md#first-shared-media\.mp4/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(sharedMediaIndexPath, sharedMediaIndexV2);
run('git', ['add', sharedMediaIndexRelativePath], repo);
const staleSelectorUpdatedHashSecondSharedMediaProjection = runtimeExternalMediaProjection({
  id: secondSharedMediaProjection.id,
  filename: 'second-shared-media.mp4',
  url: secondSharedMediaUrl,
  evidenceFilePath: sharedMediaIndexRelativePath,
  headingLine: 4,
});
const changedFirstSharedMediaProjection = runtimeExternalMediaProjection({
  id: firstSharedMediaProjection.id,
  filename: 'first-shared-media.mp4',
  url: 'https://example.invalid/first-shared-media-v2.mp4',
  evidenceFilePath: sharedMediaIndexRelativePath,
  headingLine: 1,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(changedFirstSharedMediaProjection)}\n${JSON.stringify(staleSelectorUpdatedHashSecondSharedMediaProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const changedFirstSharedMediaProjectionResult = runGate(['--staged']);
assert.notEqual(
  changedFirstSharedMediaProjectionResult.status,
  0,
  'gate must reject a final runtime projection file that retains a sibling media row with the old media-index selector even when its evidence hash is current',
);
assert.match(
  `${changedFirstSharedMediaProjectionResult.stdout}\n${changedFirstSharedMediaProjectionResult.stderr}`,
  /runtime-media:1-1:second-shared-media/,
);
assert.match(
  `${changedFirstSharedMediaProjectionResult.stdout}\n${changedFirstSharedMediaProjectionResult.stderr}`,
  /stale-runtime-media-index-evidence/,
);

const updatedSecondSharedMediaProjection = runtimeExternalMediaProjection({
  id: secondSharedMediaProjection.id,
  filename: 'second-shared-media.mp4',
  url: secondSharedMediaUrl,
  evidenceFilePath: sharedMediaIndexRelativePath,
  headingLine: 5,
});
updatedSecondSharedMediaProjection.runtimeSemanticEvidence.evidenceFilePath =
  `/course-runtime/lessons/1-1/media/shared-media.md`;
updatedSecondSharedMediaProjection.reviewAudit.independentEvidenceRef =
  `/course-runtime/lessons/1-1/media/shared-media.md#markdown-line:5`;
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(changedFirstSharedMediaProjection)}\n${JSON.stringify(updatedSecondSharedMediaProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const synchronizedSharedMediaProjectionResult = runGate(['--staged']);
assert.equal(
  synchronizedSharedMediaProjectionResult.status,
  0,
  `gate must accept all final runtime media rows after synchronizing the shared media-index evidence hash\n${synchronizedSharedMediaProjectionResult.stdout}\n${synchronizedSharedMediaProjectionResult.stderr}`,
);

run('git', ['reset', '--hard', 'HEAD~1'], repo);

const deletionMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/deletion-media.md');
const deletionMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/deletion-media.md';
const descriptionDeleteUrl = 'https://example.invalid/description-delete.mp4';
const urlDeleteUrl = 'https://example.invalid/url-delete.mp4';
const deletionMediaIndexV1 = [
  '# description-delete.mp4',
  '- Description to delete',
  descriptionDeleteUrl,
  '# url-delete.mp4',
  '- URL to delete',
  urlDeleteUrl,
  '',
].join('\n');
fs.mkdirSync(path.dirname(deletionMediaIndexPath), { recursive: true });
fs.writeFileSync(deletionMediaIndexPath, deletionMediaIndexV1);
const descriptionDeleteProjection = runtimeExternalMediaProjection({
  id: 'runtime-media:1-1:description-delete.mp4',
  filename: 'description-delete.mp4',
  url: descriptionDeleteUrl,
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 1,
});
const urlDeleteProjection = runtimeExternalMediaProjection({
  id: 'runtime-media:1-1:url-delete.mp4',
  filename: 'url-delete.mp4',
  url: urlDeleteUrl,
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 4,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(descriptionDeleteProjection)}\n${JSON.stringify(urlDeleteProjection)}\n`,
);
run('git', ['add', deletionMediaIndexRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'media index deletion baseline'], repo);

const descriptionDeletedMediaIndex = deletionMediaIndexV1.replace('- Description to delete\n', '');
fs.writeFileSync(deletionMediaIndexPath, descriptionDeletedMediaIndex);
run('git', ['add', deletionMediaIndexRelativePath], repo);
const updatedDescriptionDeleteProjection = runtimeExternalMediaProjection({
  id: descriptionDeleteProjection.id,
  filename: 'description-delete.mp4',
  url: descriptionDeleteUrl,
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 1,
});
const currentUrlDeleteProjection = runtimeExternalMediaProjection({
  id: urlDeleteProjection.id,
  filename: 'url-delete.mp4',
  url: urlDeleteUrl,
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 3,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(updatedDescriptionDeleteProjection)}\n${JSON.stringify(currentUrlDeleteProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedDescriptionWithRetainedHeadingResult = runGate(['--staged']);
assert.equal(
  deletedDescriptionWithRetainedHeadingResult.status,
  0,
  `gate must accept a same-id projection update when only a retained media-index record description is deleted\n${deletedDescriptionWithRetainedHeadingResult.stdout}\n${deletedDescriptionWithRetainedHeadingResult.stderr}`,
);
assert.doesNotMatch(
  `${deletedDescriptionWithRetainedHeadingResult.stdout}\n${deletedDescriptionWithRetainedHeadingResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const urlDeletedMediaIndex = deletionMediaIndexV1.replace(`${urlDeleteUrl}\n`, '');
fs.writeFileSync(deletionMediaIndexPath, urlDeletedMediaIndex);
run('git', ['add', deletionMediaIndexRelativePath], repo);
const updatedUrlDeleteProjection = runtimeMissingLocalMediaProjection({
  id: urlDeleteProjection.id,
  filename: 'url-delete.mp4',
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 4,
});
const staleExternalUrlDeleteProjection = runtimeExternalMediaProjection({
  id: urlDeleteProjection.id,
  filename: 'url-delete.mp4',
  url: urlDeleteUrl,
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 4,
});
const currentDescriptionDeleteProjection = runtimeExternalMediaProjection({
  id: descriptionDeleteProjection.id,
  filename: 'description-delete.mp4',
  url: descriptionDeleteUrl,
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 1,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(currentDescriptionDeleteProjection)}\n${JSON.stringify(staleExternalUrlDeleteProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedUrlWithStaleExternalIdentityResult = runGate(['--staged']);
assert.notEqual(
  deletedUrlWithStaleExternalIdentityResult.status,
  0,
  'gate must reject a stale external media identity after the media-index URL is deleted even when the evidence hash is current',
);
assert.match(
  `${deletedUrlWithStaleExternalIdentityResult.stdout}\n${deletedUrlWithStaleExternalIdentityResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/media\/deletion-media\.md#url-delete\.mp4/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(currentDescriptionDeleteProjection)}\n${JSON.stringify(updatedUrlDeleteProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedUrlWithRetainedHeadingResult = runGate(['--staged']);
assert.equal(
  deletedUrlWithRetainedHeadingResult.status,
  0,
  `gate must accept a same-id projection update when only a retained media-index record URL is deleted\n${deletedUrlWithRetainedHeadingResult.stdout}\n${deletedUrlWithRetainedHeadingResult.stderr}`,
);
assert.doesNotMatch(
  `${deletedUrlWithRetainedHeadingResult.stdout}\n${deletedUrlWithRetainedHeadingResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const headingDeletedMediaIndex = deletionMediaIndexV1.replace(
  '# description-delete.mp4\n- Description to delete\nhttps://example.invalid/description-delete.mp4\n',
  '',
);
fs.writeFileSync(deletionMediaIndexPath, headingDeletedMediaIndex);
run('git', ['add', deletionMediaIndexRelativePath], repo);
const retainedHeadingAfterDeleteProjection = runtimeExternalMediaProjection({
  id: urlDeleteProjection.id,
  filename: 'url-delete.mp4',
  url: urlDeleteUrl,
  evidenceFilePath: deletionMediaIndexRelativePath,
  headingLine: 1,
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(retainedHeadingAfterDeleteProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedHeadingRecordResult = runGate(['--staged']);
assert.equal(
  deletedHeadingRecordResult.status,
  0,
  `gate must treat a removed media-index heading record as delete coverage when its projection row is removed
${deletedHeadingRecordResult.stdout}
${deletedHeadingRecordResult.stderr}`,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.rmSync(deletionMediaIndexPath);
run('git', ['add', '-u', deletionMediaIndexRelativePath], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  '',
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedMediaIndexFileResult = runGate(['--staged']);
assert.equal(
  deletedMediaIndexFileResult.status,
  0,
  `gate must preserve full-source delete semantics for a deleted media index file
${deletedMediaIndexFileResult.stdout}
${deletedMediaIndexFileResult.stderr}`,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const handoutMediaIndexPath = path.join(repo, 'course-content/runtime/lessons/1-1/media/1-1-media.md');
const handoutMediaIndexRelativePath = 'course-content/runtime/lessons/1-1/media/1-1-media.md';
const handoutMediaIndexV1 = [
  '# 1-1-handout.md',
  '- Original handout summary',
  '',
].join('\n');
fs.mkdirSync(path.dirname(handoutMediaIndexPath), { recursive: true });
fs.writeFileSync(handoutMediaIndexPath, handoutMediaIndexV1);
const handoutSourcePath = path.join(repo, 'course-content/runtime/lessons/1-1/1-1-handout.md');
const handoutProjection = runtimeProjectionRow({
  id: 'runtime-handout:1-1',
  family: 'runtime-handout',
  resourceType: 'handout',
  sourceKind: 'runtime_handout',
  sourceRef: '1-1',
  sourcePathOrUrl: '/course-runtime/lessons/1-1/1-1-handout.md',
  sourceVersionRef: 'runtime-handout.v1',
  sourceHash: sha256File(handoutSourcePath),
  independentEvidenceRef: '/course-runtime/lessons/1-1/1-1-handout.md#markdown-line:1',
});
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(handoutProjection)}\n`,
);
run('git', ['add', handoutMediaIndexRelativePath, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'handout media index baseline'], repo);

const handoutMediaIndexV2 = handoutMediaIndexV1
  .replace('# 1-1-handout.md', '## 1-1-handout.md')
  .replace('- Original handout summary', '- Updated handout summary');
fs.writeFileSync(handoutMediaIndexPath, handoutMediaIndexV2);
run('git', ['add', handoutMediaIndexRelativePath], repo);
const unrelatedHandoutProjection = {
  ...handoutProjection,
  id: 'runtime-handout:unrelated',
  sourceRef: 'unrelated',
};
const updatedHandoutProjection = {
  ...handoutProjection,
  title: 'Updated handout projection',
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(unrelatedHandoutProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const unrelatedHandoutProjectionResult = runGate(['--staged']);
assert.notEqual(
  unrelatedHandoutProjectionResult.status,
  0,
  'gate must reject an unrelated non-asset handout projection even when it shares the handout source hash',
);
assert.match(
  `${unrelatedHandoutProjectionResult.stdout}\n${unrelatedHandoutProjectionResult.stderr}`,
  /runtime-source:course-content\/runtime\/lessons\/1-1\/media\/1-1-media\.md#1-1-handout\.md/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(handoutMediaIndexPath, handoutMediaIndexV2);
run('git', ['add', handoutMediaIndexRelativePath], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(updatedHandoutProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const updatedHandoutProjectionResult = runGate(['--staged']);
assert.equal(
  updatedHandoutProjectionResult.status,
  0,
  `gate must match a runtime-handout projection by the non-asset media-index record identity\n${updatedHandoutProjectionResult.stdout}\n${updatedHandoutProjectionResult.stderr}`,
);

run('git', ['reset', '--hard', 'HEAD~2'], repo);
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
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'textbook-section:book:ch01__chunk-001',
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
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'textbook-section:book:ch01-sec01',
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
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'quiz:AC-Q-9999-json',
    sourceRef: 'AC-Q-9999',
    sourcePathOrUrl: 'course-content/questions/questions/AC-Q-9999.json',
    sourceVersionRef: 'question-bank.v1',
  }))}\n${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'quiz:AC-Q-9999-md',
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
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'adaptive-assessment-item:UNRELATED',
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
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'adaptive-assessment-item:AC-Q-9998',
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
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'adaptive-assessment-item:AC-Q-9998',
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
    sourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
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
const infographDeletionTestParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
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
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add deletable infograph manifest item'], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({ schema_version: 1, items: [] }, null, 2));
run('git', ['add', 'course-content/runtime/knowledge/infographs/manifest.json'], repo);
const deletedInfographWithRetainedProjectionResult = runGate(['--staged']);
assert.notEqual(deletedInfographWithRetainedProjectionResult.status, 0, 'deleting an infograph manifest item must require its projection row to be deleted');
assert.match(
  `${deletedInfographWithRetainedProjectionResult.stdout}\n${deletedInfographWithRetainedProjectionResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedInfographProjectionResult = runGate(['--staged']);
assert.equal(deletedInfographProjectionResult.status, 0, 'infograph item deletion must pass after deleting its projection row');
run('git', ['commit', '--no-verify', '-m', 'delete infograph manifest item and projection'], repo);
const baseDeletedInfographProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseDeletedInfographProjectionResult.status, 0, 'base mode must enforce deleted infograph projection coverage');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

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
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add infograph field deletion baseline'], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-demo',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
run('git', ['add', 'course-content/runtime/knowledge/infographs/manifest.json'], repo);
const staleInfographFieldDeletionResult = runGate(['--staged']);
assert.notEqual(staleInfographFieldDeletionResult.status, 0, 'deleting only an infograph item field must require the surviving projection hash to be updated');
assert.match(
  `${staleInfographFieldDeletionResult.stdout}\n${staleInfographFieldDeletionResult.stderr}`,
  /missing-knowledge-infograph-runtime-projection-row/,
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
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedInfographFieldDeletionResult = runGate(['--staged']);
assert.equal(syncedInfographFieldDeletionResult.status, 0, 'infograph field deletion must pass after updating the surviving projection hash');
run('git', ['commit', '--no-verify', '-m', 'delete infograph field and update projection'], repo);
const baseSyncedInfographFieldDeletionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedInfographFieldDeletionResult.status, 0, 'base mode must map deletion-only infograph fields back to the surviving item');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-alias',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-alias',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-alias',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-alias',
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add infograph identity deletion baseline'], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const deletedIdentityWithDeletedProjectionResult = runGate(['--staged']);
assert.notEqual(deletedIdentityWithDeletedProjectionResult.status, 0, 'deleting an infograph identity field must require an upsert for the surviving path-backed item');
assert.match(
  `${deletedIdentityWithDeletedProjectionResult.stdout}\n${deletedIdentityWithDeletedProjectionResult.stderr}`,
  /missing-knowledge-infograph-runtime-projection-row/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-alias',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedInfographIdentityDeletionResult = runGate(['--staged']);
assert.equal(syncedInfographIdentityDeletionResult.status, 0, 'identity field deletion must pass after replacing the projection with the surviving path-backed identity');
run('git', ['commit', '--no-verify', '-m', 'delete infograph identity field and replace projection'], repo);
const baseSyncedInfographIdentityDeletionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedInfographIdentityDeletionResult.status, 0, 'base mode must map deleted infograph identity fields by stable path');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-a',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
    {
      nodeId: 'kn-b',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
const sharedPathInfographProjection = (nodeId) => JSON.stringify(runtimeProjectionRow({
  id: `infograph:${nodeId}`,
  family: 'knowledge-infograph',
  resourceType: 'image',
  sourceKind: 'knowledge_graph',
  sourceRef: nodeId,
  sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
  sourceVersionRef: 'knowledge-infograph-manifest.v1',
  independentEvidenceRef: `course-content/runtime/knowledge/infographs/manifest.json#${nodeId}`,
  promptOrManifestHash: sha256File(infographManifestPath),
  reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
}));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${sharedPathInfographProjection('kn-a')}\n${sharedPathInfographProjection('kn-b')}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add shared-path infograph deletion baseline'], repo);
const sharedPathInfographBaselineHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
const sharedPathBaselineProjectionRows = fs.readFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  'utf8',
).trim().split('\n');

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-a',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${sharedPathInfographProjection('kn-a')}\n${sharedPathBaselineProjectionRows[1]}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const retainedDeletedSharedPathItemProjectionResult = runGate(['--staged']);
assert.notEqual(retainedDeletedSharedPathItemProjectionResult.status, 0, 'deleting one shared-path manifest item must require that exact item projection to be deleted');
assert.match(
  `${retainedDeletedSharedPathItemProjectionResult.stdout}\n${retainedDeletedSharedPathItemProjectionResult.stderr}`,
  /manifest\.json#kn-b/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${sharedPathInfographProjection('kn-a')}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedOneSharedPathItemProjectionResult = runGate(['--staged']);
assert.equal(deletedOneSharedPathItemProjectionResult.status, 0, 'deleting one shared-path item must pass after deleting only its exact projection');
run('git', ['commit', '--no-verify', '-m', 'delete one shared-path infograph item and projection'], repo);
const baseDeletedOneSharedPathItemProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseDeletedOneSharedPathItemProjectionResult.status, 0, 'base mode must preserve exact identity when one shared-path item is deleted');
run('git', ['reset', '--hard', sharedPathInfographBaselineHead], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({ schema_version: 1, items: [] }, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${sharedPathInfographProjection('kn-b')}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const partiallyDeletedSharedPathInfographResult = runGate(['--staged']);
assert.notEqual(partiallyDeletedSharedPathInfographResult.status, 0, 'one deleted projection row must not satisfy two deleted manifest items that share an image path');
assert.match(
  `${partiallyDeletedSharedPathInfographResult.stdout}\n${partiallyDeletedSharedPathInfographResult.stderr}`,
  /manifest\.json#kn-b/,
);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedSharedPathInfographResult = runGate(['--staged']);
assert.equal(deletedSharedPathInfographResult.status, 0, 'shared-path infograph deletion must pass only after both projection rows are deleted');
run('git', ['commit', '--no-verify', '-m', 'delete shared-path infograph items and projections'], repo);
const baseDeletedSharedPathInfographResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseDeletedSharedPathInfographResult.status, 0, 'base mode must enforce one deleted projection per shared-path infograph item');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

const alternateInfographImagePath = path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-alternate.png');
fs.writeFileSync(alternateInfographImagePath, 'alternate-infograph-image');
fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-demo',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
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
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/knowledge/infographs/nodes/kn-alternate.png',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add infograph path change baseline'], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-demo',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-alternate.png',
    },
  ],
}, null, 2));
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
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const staleInfographPathChangeResult = runGate(['--staged']);
assert.notEqual(staleInfographPathChangeResult.status, 0, 'changing an infograph item path must require the projection to use the new image path');
assert.match(
  `${staleInfographPathChangeResult.stdout}\n${staleInfographPathChangeResult.stderr}`,
  /missing-knowledge-infograph-runtime-projection-row/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'infograph:kn-demo',
    family: 'knowledge-infograph',
    resourceType: 'image',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-alternate.png',
    sourceVersionRef: 'knowledge-infograph-manifest.v1',
    independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-demo',
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(alternateInfographImagePath),
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const syncedInfographPathChangeResult = runGate(['--staged']);
assert.equal(syncedInfographPathChangeResult.status, 0, 'infograph path change must pass after updating identity, path, and hashes together');
run('git', ['commit', '--no-verify', '-m', 'change infograph item path and projection'], repo);
const baseSyncedInfographPathChangeResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedInfographPathChangeResult.status, 0, 'base mode must enforce the current infograph item path');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

fs.writeFileSync(alternateInfographImagePath, 'alternate-infograph-image');
fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-shared-id',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
    {
      nodeId: 'kn-shared-id',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-alternate.png',
    },
  ],
}, null, 2));
const duplicateIdentityInfographProjection = (id, imagePath) => JSON.stringify(runtimeProjectionRow({
  id,
  family: 'knowledge-infograph',
  resourceType: 'image',
  sourceKind: 'knowledge_graph',
  sourceRef: 'kn-shared-id',
  sourcePathOrUrl: imagePath,
  sourceVersionRef: 'knowledge-infograph-manifest.v1',
  independentEvidenceRef: 'course-content/runtime/knowledge/infographs/manifest.json#kn-shared-id',
  promptOrManifestHash: sha256File(infographManifestPath),
  reviewedSourceHash: sha256File(path.join(repo, imagePath)),
}));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${duplicateIdentityInfographProjection('infograph:kn-shared-a', 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')}\n${duplicateIdentityInfographProjection('infograph:kn-shared-b', 'course-content/runtime/knowledge/infographs/nodes/kn-alternate.png')}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/knowledge/infographs/nodes/kn-alternate.png',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add duplicate-identity infograph baseline'], repo);
const duplicateIdentityBaselineRows = fs.readFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  'utf8',
).trim().split('\n');

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-shared-id',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${duplicateIdentityInfographProjection('infograph:kn-shared-a', 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')}\n${duplicateIdentityBaselineRows[1]}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const retainedDuplicateIdentityProjectionResult = runGate(['--staged']);
assert.notEqual(retainedDuplicateIdentityProjectionResult.status, 0, 'duplicate record identities must not map a deleted item onto the surviving item');
assert.match(
  `${retainedDuplicateIdentityProjectionResult.stdout}\n${retainedDuplicateIdentityProjectionResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${duplicateIdentityInfographProjection('infograph:kn-shared-a', 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedDuplicateIdentityProjectionResult = runGate(['--staged']);
assert.equal(deletedDuplicateIdentityProjectionResult.status, 0, 'duplicate record identity deletion must pass after deleting the projection for the removed path');
run('git', ['commit', '--no-verify', '-m', 'delete duplicate-identity infograph item and projection'], repo);
const baseDeletedDuplicateIdentityProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseDeletedDuplicateIdentityProjectionResult.status, 0, 'base mode must resolve duplicate record identities by exact path');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'kn-demo',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
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
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add infograph path deletion baseline'], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [{ nodeId: 'kn-demo' }],
}, null, 2));
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
    promptOrManifestHash: sha256File(infographManifestPath),
    reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const missingInfographPathResult = runGate(['--staged']);
assert.notEqual(missingInfographPathResult.status, 0, 'an infograph manifest item without a path must fail closed');
assert.match(
  `${missingInfographPathResult.stdout}\n${missingInfographPathResult.stderr}`,
  /missing-knowledge-infograph-runtime-projection-row/,
);
run('git', ['commit', '--no-verify', '-m', 'remove infograph item path without a replacement source'], repo);
const baseMissingInfographPathResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(baseMissingInfographPathResult.status, 0, 'base mode must fail closed when a surviving infograph item loses its path');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({
  schema_version: 1,
  items: [
    {
      nodeId: 'a',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
    {
      nodeId: 'b:a',
      path: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
    },
  ],
}, null, 2));
const suffixCollisionInfographProjection = (recordKey) => JSON.stringify(runtimeProjectionRow({
  id: `infograph:${recordKey}`,
  family: 'knowledge-infograph',
  resourceType: 'image',
  sourceKind: 'knowledge_graph',
  sourceRef: recordKey,
  sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
  sourceVersionRef: 'knowledge-infograph-manifest.v1',
  independentEvidenceRef: `course-content/runtime/knowledge/infographs/manifest.json#${recordKey}`,
  promptOrManifestHash: sha256File(infographManifestPath),
  reviewedSourceHash: sha256File(path.join(repo, 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png')),
}));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${suffixCollisionInfographProjection('a')}\n${suffixCollisionInfographProjection('b:a')}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add suffix-collision infograph baseline'], repo);

fs.writeFileSync(infographManifestPath, JSON.stringify({ schema_version: 1, items: [] }, null, 2));
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${suffixCollisionInfographProjection('a')}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/infographs/manifest.json',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const suffixCollisionInfographDeletionResult = runGate(['--staged']);
assert.notEqual(suffixCollisionInfographDeletionResult.status, 0, 'one suffix-colliding deleted projection must not satisfy two exact infograph identities');
assert.match(
  `${suffixCollisionInfographDeletionResult.stdout}\n${suffixCollisionInfographDeletionResult.stderr}`,
  /manifest\.json#a/,
);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedSuffixCollisionInfographResult = runGate(['--staged']);
assert.equal(deletedSuffixCollisionInfographResult.status, 0, 'suffix-colliding infograph identities must pass only after both exact projections are deleted');
run('git', ['commit', '--no-verify', '-m', 'delete suffix-collision infograph items and projections'], repo);
const baseDeletedSuffixCollisionInfographResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseDeletedSuffixCollisionInfographResult.status, 0, 'base mode must use exact infograph identities for suffix collisions');
run('git', ['reset', '--hard', infographDeletionTestParent], repo);

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

const baseModeFixtureHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const baseUntrackedEvidencePath = path.join(repo, 'course-content/runtime/resource-governance/base-untracked-evidence.md');
fs.writeFileSync(baseUntrackedEvidencePath, '# Evidence only in the worktree\n');
fs.appendFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'external:base-untracked-evidence',
    sourceRef: 'external:base-untracked-evidence',
    sourcePathOrUrl: 'https://example.invalid/base-untracked-evidence',
    sourceHash: sha256File(baseUntrackedEvidencePath),
    sourceVersionRef: 'external-resource.v1',
    independentEvidenceRef: 'course-content/runtime/resource-governance/base-untracked-evidence.md',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add projection with worktree-only evidence'], repo);
const baseUntrackedEvidenceResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(baseUntrackedEvidenceResult.status, 0, 'base mode must reject projection evidence that exists only in the worktree');
assert.match(
  `${baseUntrackedEvidenceResult.stdout}\n${baseUntrackedEvidenceResult.stderr}`,
  /external:base-untracked-evidence missing-runtime-projection-review-evidence-file/,
);
fs.rmSync(baseUntrackedEvidencePath);

const baseDirtyEvidencePath = path.join(repo, 'course-content/runtime/resource-governance/base-dirty-evidence.md');
fs.writeFileSync(baseDirtyEvidencePath, '# Evidence committed as content A\n');
run('git', ['add', 'course-content/runtime/resource-governance/base-dirty-evidence.md'], repo);
run('git', ['commit', '--no-verify', '-m', 'add base evidence content A'], repo);
fs.writeFileSync(baseDirtyEvidencePath, '# Evidence changed only in worktree content B\n');
fs.appendFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'external:base-dirty-evidence',
    sourceRef: 'external:base-dirty-evidence',
    sourcePathOrUrl: 'https://example.invalid/base-dirty-evidence',
    sourceHash: sha256File(baseDirtyEvidencePath),
    sourceVersionRef: 'external-resource.v1',
    independentEvidenceRef: 'course-content/runtime/resource-governance/base-dirty-evidence.md',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add projection with dirty worktree evidence hash'], repo);
const baseDirtyEvidenceResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(baseDirtyEvidenceResult.status, 0, 'base mode must hash committed evidence instead of dirty worktree content');
assert.match(
  `${baseDirtyEvidenceResult.stdout}\n${baseDirtyEvidenceResult.stderr}`,
  /external:base-dirty-evidence stale-runtime-projection-source-hash/,
);
run('git', ['reset', '--hard', 'HEAD'], repo);

const baseTrackedEvidencePath = path.join(repo, 'course-content/runtime/resource-governance/base-tracked-evidence.md');
fs.writeFileSync(baseTrackedEvidencePath, '# Evidence committed with its projection\n');
fs.appendFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'external:base-tracked-evidence',
    sourceRef: 'external:base-tracked-evidence',
    sourcePathOrUrl: 'https://example.invalid/base-tracked-evidence',
    sourceHash: sha256File(baseTrackedEvidencePath),
    sourceVersionRef: 'external-resource.v1',
    independentEvidenceRef: 'course-content/runtime/resource-governance/base-tracked-evidence.md',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/base-tracked-evidence.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
run('git', ['commit', '--no-verify', '-m', 'add projection with committed evidence'], repo);
const baseTrackedEvidenceResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseTrackedEvidenceResult.status, 0, 'base mode must accept evidence whose committed HEAD blob matches the projection hash');
run('git', ['reset', '--hard', baseModeFixtureHead], repo);

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
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceHash: sha256File(cardPath),
    sourceVersionRef: 'runtime-knowledge-card.v1',
    independentEvidenceRef: 'course-content/runtime/resource-governance/missing-review-evidence.md',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const missingReviewEvidenceFileResult = runGate(['--staged']);
assert.notEqual(missingReviewEvidenceFileResult.status, 0, 'gate must fail when a local independent review evidence file is missing');
assert.match(
  `${missingReviewEvidenceFileResult.stdout}\n${missingReviewEvidenceFileResult.stderr}`,
  /knowledge-card:kn-demo missing-runtime-projection-review-evidence-file/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const routeHandoutPath = path.join(repo, 'course-content/runtime/lessons/1-1/1-1-handout.md');
fs.writeFileSync(routeHandoutPath, '# Demo handout\n\nPrompt-scoped review update.\n');
fs.appendFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'runtime-handout:1-1',
    family: 'runtime-handout',
    resourceType: 'handout',
    sourceKind: 'runtime_handout',
    sourceRef: '1-1',
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/1-1-handout.md',
    sourceHash: sha256File(routeHandoutPath),
    sourceVersionRef: 'runtime-handout.v1',
    independentEvidenceRef: 'course-content/runtime/lessons/1-1/1-1-handout.md#1-1',
    promptOrManifestHash: 'sha256:prompt-scoped-review',
    reviewedSourceHash: 'sha256:prompt-scoped-review',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/lessons/1-1/1-1-handout.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const promptScopedCoverageResult = runGate(['--staged']);
assert.equal(promptScopedCoverageResult.status, 0, 'gate must accept prompt-scoped reviewedSourceHash when row sourceHash matches the changed source file');

const validRuntimeHandoutProjection = runtimeProjectionRow({
  id: 'runtime-handout:1-1:family-contract',
  family: 'runtime-handout',
  resourceType: 'handout',
  sourceKind: 'runtime_handout',
  sourceRef: '1-1:family-contract',
  sourcePathOrUrl: 'course-content/runtime/lessons/1-1/1-1-handout.md',
  sourceVersionRef: 'runtime-handout.v1',
});
const missingRuntimeHandoutFamilyProjection = { ...validRuntimeHandoutProjection };
delete missingRuntimeHandoutFamilyProjection.family;
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(missingRuntimeHandoutFamilyProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const missingRuntimeHandoutFamilyResult = runGate(['--staged']);
assert.notEqual(missingRuntimeHandoutFamilyResult.status, 0, 'gate must reject a runtime-handout row with a missing family');
assert.match(
  `${missingRuntimeHandoutFamilyResult.stdout}\n${missingRuntimeHandoutFamilyResult.stderr}`,
  /runtime-handout:1-1:family-contract missing-runtime-projection-family/,
);

const unknownRuntimeHandoutFamilyProjection = {
  ...validRuntimeHandoutProjection,
  family: 'forged-family',
};
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(unknownRuntimeHandoutFamilyProjection)}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const unknownRuntimeHandoutFamilyResult = runGate(['--staged']);
assert.notEqual(unknownRuntimeHandoutFamilyResult.status, 0, 'gate must reject a runtime-handout row with an unknown family');
assert.match(
  `${unknownRuntimeHandoutFamilyResult.stdout}\n${unknownRuntimeHandoutFamilyResult.stderr}`,
  /runtime-handout:1-1:family-contract invalid-runtime-projection-family/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(cardPath, '# Demo card\n\nKnowledge review packet update.\n');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceHash: sha256File(cardPath),
    sourceVersionRef: 'runtime-knowledge-card.v1',
    promptOrManifestHash: 'sha256:knowledge-review-packet',
    reviewedSourceHash: 'sha256:knowledge-review-packet',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const knowledgePacketCoverageResult = runGate(['--staged']);
assert.notEqual(knowledgePacketCoverageResult.status, 0, 'gate must reject knowledge_graph review hashes that only match a prompt or packet hash');
assert.match(
  `${knowledgePacketCoverageResult.stdout}\n${knowledgePacketCoverageResult.stderr}`,
  /stale-review-evidence/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(cardPath, '# Demo card\n\nKnowledge family packet update.\n');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'external_resource',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceHash: sha256File(cardPath),
    sourceVersionRef: 'runtime-knowledge-card.v1',
    promptOrManifestHash: 'sha256:knowledge-family-review-packet',
    reviewedSourceHash: 'sha256:knowledge-family-review-packet',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const knowledgeFamilyPacketCoverageResult = runGate(['--staged']);
assert.notEqual(knowledgeFamilyPacketCoverageResult.status, 0, 'gate must reject knowledge family review hashes that only match a prompt or packet hash regardless of sourceKind');
assert.match(
  `${knowledgeFamilyPacketCoverageResult.stdout}\n${knowledgeFamilyPacketCoverageResult.stderr}`,
  /knowledge-card:kn-demo invalid-runtime-projection-family-source-kind/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
fs.writeFileSync(cardPath, '# Demo card\n\nKnowledge source-kind mismatch update.\n');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-source-kind:kn-demo',
    family: 'runtime-lesson-step',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceHash: sha256File(cardPath),
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const knowledgeSourceKindMismatchResult = runGate(['--staged']);
assert.notEqual(knowledgeSourceKindMismatchResult.status, 0, 'gate must reject knowledge_graph sourceKind when family is explicitly non-knowledge');
assert.match(
  `${knowledgeSourceKindMismatchResult.stdout}\n${knowledgeSourceKindMismatchResult.stderr}`,
  /knowledge-source-kind:kn-demo invalid-runtime-projection-family-source-kind/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
const mismatchedLocalEvidencePath = path.join(repo, 'course-content/runtime/resource-governance/mismatched-local-source-evidence.md');
fs.writeFileSync(mismatchedLocalEvidencePath, '# Independent evidence with a different hash\n');
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
    sourceHash: sha256File(mismatchedLocalEvidencePath),
    sourceVersionRef: 'runtime-knowledge-card.v1',
    independentEvidenceRef: 'course-content/runtime/resource-governance/mismatched-local-source-evidence.md',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/mismatched-local-source-evidence.md', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const mismatchedLocalSourceHashResult = runGate(['--staged']);
assert.notEqual(mismatchedLocalSourceHashResult.status, 0, 'gate must reject an independent evidence hash when a different local primary source exists');
assert.match(
  `${mismatchedLocalSourceHashResult.stdout}\n${mismatchedLocalSourceHashResult.stderr}`,
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
const untrackedEvidencePath = path.join(repo, 'course-content/runtime/resource-governance/untracked-projection-evidence.md');
fs.writeFileSync(untrackedEvidencePath, '# Untracked projection evidence\n');
fs.appendFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'external:untracked-evidence',
    sourceRef: 'external:untracked-evidence',
    sourcePathOrUrl: 'https://example.invalid/resource',
    sourceHash: sha256File(untrackedEvidencePath),
    sourceVersionRef: 'external-resource.v1',
    independentEvidenceRef: 'course-content/runtime/resource-governance/untracked-projection-evidence.md',
  }))}\n`,
);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const untrackedEvidenceResult = runGate(['--staged']);
assert.notEqual(untrackedEvidenceResult.status, 0, 'gate must fail when projection evidence is only an untracked worktree file');
assert.match(
  `${untrackedEvidenceResult.stdout}\n${untrackedEvidenceResult.stderr}`,
  /untracked-runtime-projection-source-file/,
);

run('git', ['reset', '--hard', 'HEAD'], repo);
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
run('git', ['add', 'course-content/runtime/knowledge/cards/nodes/kn-demo.md'], repo);
const deletedCardWithRetainedProjectionResult = runGate(['--staged']);
assert.notEqual(deletedCardWithRetainedProjectionResult.status, 0, 'deleting a knowledge card source file must require its projection row to be deleted');
assert.match(
  `${deletedCardWithRetainedProjectionResult.stdout}\n${deletedCardWithRetainedProjectionResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), '');
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedCardProjectionResult = runGate(['--staged']);
assert.equal(deletedCardProjectionResult.status, 0, 'gate must not require added projection rows for deletion-only runtime sources');

run('git', ['reset', '--hard', 'HEAD'], repo);
const sourceRenameTestParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
run('git', ['config', 'diff.renames', 'false'], repo);
const renamedCardPath = path.join(repo, 'course-content/runtime/knowledge/cards/nodes/kn-demo-renamed.md');
run('git', [
  'mv',
  'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
  'course-content/runtime/knowledge/cards/nodes/kn-demo-renamed.md',
], repo);
const renamedCardWithStaleProjectionResult = runGate(['--staged']);
assert.notEqual(renamedCardWithStaleProjectionResult.status, 0, 'renaming a runtime source must require the old projection row to be deleted');
assert.match(
  `${renamedCardWithStaleProjectionResult.stdout}\n${renamedCardWithStaleProjectionResult.stderr}`,
  /course-content\/runtime\/knowledge\/cards\/nodes\/kn-demo\.md/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo-renamed',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo-renamed.md',
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add',
  'course-content/runtime/knowledge/cards/nodes/kn-demo-renamed.md',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const syncedRenamedCardProjectionResult = runGate(['--staged']);
assert.equal(syncedRenamedCardProjectionResult.status, 0, 'source rename must pass after deleting the old projection and adding the new projection');
run('git', ['commit', '--no-verify', '-m', 'rename knowledge card source and projection'], repo);
const baseSyncedRenamedCardProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedRenamedCardProjectionResult.status, 0, 'base mode must require projection replacement for renamed runtime sources');
assert.equal(fs.existsSync(renamedCardPath), true, 'renamed source fixture must exist before restoring the parent');
run('git', ['reset', '--hard', sourceRenameTestParent], repo);

const unmanagedRenameTargetPath = 'course-content/runtime/knowledge/cards/nodes/kn-demo.txt';
run('git', [
  'mv',
  'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
  unmanagedRenameTargetPath,
], repo);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeProjectionRow({
    id: 'knowledge-card:kn-demo',
    family: 'knowledge-card',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'kn-demo',
    sourcePathOrUrl: unmanagedRenameTargetPath,
    sourceVersionRef: 'runtime-knowledge-card.v1',
  }))}\n`,
);
run('git', ['add',
  unmanagedRenameTargetPath,
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const unmanagedRenameReplacementResult = runGate(['--staged']);
assert.notEqual(unmanagedRenameReplacementResult.status, 0, 'renaming a governed source outside governed paths must require a deleted-only old projection');
assert.match(
  `${unmanagedRenameReplacementResult.stdout}\n${unmanagedRenameReplacementResult.stderr}`,
  /missing-deleted-runtime-projection-row.*course-content\/runtime\/knowledge\/cards\/nodes\/kn-demo\.md/,
);
run('git', ['commit', '--no-verify', '-m', 'move knowledge card outside governed paths'], repo);
const baseUnmanagedRenameReplacementResult = runGate(['--base', 'HEAD~1']);
assert.notEqual(baseUnmanagedRenameReplacementResult.status, 0, 'base mode must reject stable-id replacement when a governed source moves outside governed paths');
assert.match(
  `${baseUnmanagedRenameReplacementResult.stdout}\n${baseUnmanagedRenameReplacementResult.stderr}`,
  /missing-deleted-runtime-projection-row.*course-content\/runtime\/knowledge\/cards\/nodes\/kn-demo\.md/,
);
run('git', ['reset', '--hard', sourceRenameTestParent], repo);

const assessmentCatalogRenameTestParent = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repo,
  encoding: 'utf8',
}).trim();
const oldAssessmentCatalogRelativePath = 'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl';
const newAssessmentCatalogRelativePath = 'course-content/runtime/resource-governance/assessment-item-semantic-review-packets.jsonl';
const oldAssessmentCatalogPath = path.join(repo, oldAssessmentCatalogRelativePath);
const newAssessmentCatalogPath = path.join(repo, newAssessmentCatalogRelativePath);
const renamedAssessmentCatalogRow = {
  id: 'adaptive-assessment-item:AC-Q-RENAME',
  sourcePath: 'course-content/questions/questions/AC-Q-RENAME.json',
};
fs.rmSync(newAssessmentCatalogPath);
fs.writeFileSync(oldAssessmentCatalogPath, `${JSON.stringify(renamedAssessmentCatalogRow)}\n`);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'adaptive-assessment-item:AC-Q-RENAME',
    sourceRef: 'adaptive-assessment-item:AC-Q-RENAME',
    sourcePathOrUrl: oldAssessmentCatalogRelativePath,
    sourceVersionRef: 'adaptive-assessment-item-catalog.v1',
  }))}\n`,
);
run('git', ['add',
  oldAssessmentCatalogRelativePath,
  newAssessmentCatalogRelativePath,
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add renameable assessment catalog baseline'], repo);
run('git', ['mv', oldAssessmentCatalogRelativePath, newAssessmentCatalogRelativePath], repo);
const renamedCatalogWithStaleProjectionResult = runGate(['--staged']);
assert.notEqual(renamedCatalogWithStaleProjectionResult.status, 0, 'renaming an assessment catalog must require projection replacement');
assert.match(
  `${renamedCatalogWithStaleProjectionResult.stdout}\n${renamedCatalogWithStaleProjectionResult.stderr}`,
  /adaptive-assessment-item-catalog-items\.jsonl/,
);
fs.writeFileSync(
  path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'),
  `${JSON.stringify(runtimeSourceCoverageProjectionRow({
    id: 'adaptive-assessment-item:AC-Q-RENAME',
    sourceRef: 'adaptive-assessment-item:AC-Q-RENAME',
    sourcePathOrUrl: newAssessmentCatalogRelativePath,
    sourceVersionRef: 'assessment-item-semantic-review-packets.v1',
  }))}\n`,
);
run('git', ['add',
  newAssessmentCatalogRelativePath,
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const syncedRenamedCatalogProjectionResult = runGate(['--staged']);
assert.equal(syncedRenamedCatalogProjectionResult.status, 0, 'catalog rename must pass after replacing the source path on the stable projection id');
run('git', ['commit', '--no-verify', '-m', 'rename assessment catalog and projection'], repo);
const baseSyncedRenamedCatalogProjectionResult = runGate(['--base', 'HEAD~1']);
assert.equal(baseSyncedRenamedCatalogProjectionResult.status, 0, 'base mode must enforce projection replacement for renamed assessment catalogs');
run('git', ['reset', '--hard', assessmentCatalogRenameTestParent], repo);

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
run('git', ['add', 'course-content/runtime/lessons/1-1/1-1-handout.md'], repo);
const deletedRoutedSourceWithRetainedProjectionResult = runGate(['--staged']);
assert.notEqual(deletedRoutedSourceWithRetainedProjectionResult.status, 0, 'deleting a routed runtime source file must require its projection row to be deleted');
assert.match(
  `${deletedRoutedSourceWithRetainedProjectionResult.stdout}\n${deletedRoutedSourceWithRetainedProjectionResult.stderr}`,
  /missing-deleted-runtime-projection-row/,
);
fs.writeFileSync(path.join(repo, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'), `${baselineCardProjection}\n`);
run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
const deletedRoutedProjectionWithSourceResult = runGate(['--staged']);
assert.equal(deletedRoutedProjectionWithSourceResult.status, 0, 'gate must pass when a routed projection row and its mapped runtime source file are deleted together');

run('git', ['reset', '--hard', 'HEAD'], repo);
const mixedRewriteReviewSourcePath = path.join(
  repo,
  'course-content/runtime/resource-governance/longform-textbook-reference-resource-semantics-review-source.jsonl',
);
const mixedRewriteProjectionPath = path.join(
  repo,
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
);
const mixedChapterRows = Array.from({ length: 1001 }, (_, index) => runtimeProjectionRow({
  id: `authoring-textbook-chapter:mixed-book:chapter-${String(index + 1).padStart(4, '0')}`,
  family: 'authoring-textbook-chapter',
  resourceType: 'textbook_section',
  sourceKind: 'textbook_section',
  sourceRef: `mixed-book:chapter-${String(index + 1).padStart(4, '0')}`,
  sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
  sourceVersionRef: 'authoring-textbook-manifest.v1',
}));
const mixedRuntimeRow = runtimeProjectionRow({
  id: 'runtime-step:mixed-rewrite:step-01',
  family: 'runtime-lesson-step',
  resourceType: 'lesson_step',
  sourceKind: 'runtime_lesson_step',
  sourceRef: 'mixed-rewrite:step-01',
  sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
  sourceVersionRef: 'interactive-manifest.v1',
});
fs.writeFileSync(mixedRewriteReviewSourcePath, '{}\n');
fs.writeFileSync(mixedRewriteProjectionPath, `${[...mixedChapterRows, mixedRuntimeRow].map(JSON.stringify).join('\n')}\n`);
run('git', ['add',
  'course-content/runtime/resource-governance/longform-textbook-reference-resource-semantics-review-source.jsonl',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
run('git', ['commit', '--no-verify', '-m', 'add mixed rewrite baseline'], repo);
const changedChapter = structuredClone(mixedChapterRows[0]);
changedChapter.reviewAudit.reviewedSourceHash = 'sha256:stale-chapter-contract';
const changedRuntime = structuredClone(mixedRuntimeRow);
changedRuntime.reviewAudit.reviewedSourceHash = 'sha256:stale-runtime-contract';
fs.writeFileSync(mixedRewriteReviewSourcePath, '{"changed":true}\n');
fs.writeFileSync(mixedRewriteProjectionPath, `${[
  changedChapter,
  ...mixedChapterRows.slice(1),
  changedRuntime,
].map(JSON.stringify).join('\n')}\n`);
run('git', ['add',
  'course-content/runtime/resource-governance/longform-textbook-reference-resource-semantics-review-source.jsonl',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
], repo);
const mixedRewriteResult = runGate(['--staged']);
assert.notEqual(mixedRewriteResult.status, 0, 'real staged CLI must reject gate-relevant chapter and non-longform changes in one full materialization rewrite');
assert.match(`${mixedRewriteResult.stdout}\n${mixedRewriteResult.stderr}`, /authoring-textbook-chapter:mixed-book:chapter-0001/);
assert.match(`${mixedRewriteResult.stdout}\n${mixedRewriteResult.stderr}`, /runtime-step:mixed-rewrite:step-01/);
assert.match(`${mixedRewriteResult.stdout}\n${mixedRewriteResult.stderr}`, /stale-review-evidence/);

for (const [field, mutate, expectedIssue] of [
  ['reviewedAt', (row) => { row.reviewAudit.reviewedAt = ''; }, /missing-reviewed-at/],
  ['reviewBatchId', (row) => { row.reviewAudit.reviewBatchId = ''; }, /missing-review-batch-id/],
  ['lifecycleScope', (row) => { row.lifecycleScope = 'runtime'; }, /invalid-agent-reviewed-audit-only-projection/],
]) {
  run('git', ['reset', '--hard', 'HEAD'], repo);
  const baseline = structuredClone(mixedChapterRows[0]);
  delete baseline.lifecycleScope;
  if (field === 'lifecycleScope') {
    baseline.resourceNodeId = null;
    baseline.graphNodeRefs = { knowledge: [], capability: [], quality: [] };
    baseline.privacyScope = 'teacher-scoped';
    baseline.teacherPolicy = 'teacher-only';
    baseline.evidenceContract = null;
    baseline.citationTargets = [];
    baseline.pathEligibility = { current: false, afterCompletion: false, masteryAffecting: false, blockedBy: [] };
    baseline.groundingEligibility = { retrievalReady: false, citationReady: false, authoringTriageReady: true };
    baseline.retrievalChunk = null;
    baseline.reviewAudit.status = 'agent-reviewed';
    baseline.reviewAudit.reviewerRole = 'implementing-agent';
  }
  fs.writeFileSync(mixedRewriteProjectionPath, `${JSON.stringify(baseline)}\n`);
  run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
  run('git', ['commit', '--allow-empty', '--no-verify', '-m', `add ${field} replacement baseline`], repo);
  const invalid = structuredClone(baseline);
  mutate(invalid);
  fs.writeFileSync(mixedRewriteProjectionPath, `${JSON.stringify(invalid)}\n`);
  run('git', ['add', 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl'], repo);
  const result = runGate(['--staged']);
  assert.notEqual(result.status, 0, `real staged CLI must retain and reject a replacement row with invalid ${field}`);
  assert.match(`${result.stdout}\n${result.stderr}`, expectedIssue);
}

run('git', ['reset', '--hard', 'HEAD'], repo);
const mergeAwareCommonHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
run('git', ['checkout', '-b', 'merge-aware-integration'], repo);
const mergeAwareManifestPath = path.join(repo, 'course-content/runtime/lessons/1-1/interactive-manifest.json');
const mergeAwareManifest = JSON.parse(fs.readFileSync(mergeAwareManifestPath, 'utf8'));
mergeAwareManifest.steps['integration-only-step'] = {
  id: 'integration-only-step',
  title: 'Integration-only step already reviewed upstream',
};
fs.writeFileSync(mergeAwareManifestPath, `${JSON.stringify(mergeAwareManifest, null, 2)}\n`);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
run('git', ['commit', '--no-verify', '-m', 'integration-only reviewed resource change'], repo);
run('git', ['checkout', '-b', 'merge-aware-origin-tip'], repo);
fs.writeFileSync(path.join(repo, 'origin-integration-tip.md'), 'origin integration advanced after merge start\n');
run('git', ['add', 'origin-integration-tip.md'], repo);
run('git', ['commit', '--no-verify', '-m', 'advance origin integration fixture'], repo);
run('git', ['update-ref', 'refs/remotes/origin/integration', 'merge-aware-origin-tip'], repo);
run('git', ['checkout', 'merge-aware-integration'], repo);
run('git', ['checkout', '-b', 'merge-aware-feature', mergeAwareCommonHead], repo);
fs.writeFileSync(path.join(repo, 'README.md'), 'Feature-only documentation change.\n');
run('git', ['add', 'README.md'], repo);
run('git', ['commit', '--no-verify', '-m', 'feature-only documentation change'], repo);
run('git', ['merge', '--no-commit', '--no-ff', 'merge-aware-integration'], repo);
const mergeAwareStagedResult = runGate(['--staged']);
assert.equal(
  mergeAwareStagedResult.status,
  0,
  'staged merge mode must compare the index with MERGE_HEAD and exclude upstream-only resource changes',
);
assert.match(
  `${mergeAwareStagedResult.stdout}\n${mergeAwareStagedResult.stderr}`,
  /new-resource semantic completeness passed \(\d+ changed resources checked\)/,
);
assert.doesNotMatch(
  `${mergeAwareStagedResult.stdout}\n${mergeAwareStagedResult.stderr}`,
  /integration-only-step|missing-runtime-lesson-runtime-projection-row/,
);
run('git', ['commit', '--no-verify', '-m', 'merge integration into feature'], repo);

run('git', ['checkout', '-b', 'merge-aware-reverse-feature', 'merge-aware-integration'], repo);
const reverseManifest = JSON.parse(fs.readFileSync(mergeAwareManifestPath, 'utf8'));
reverseManifest.steps['incoming-feature-step'] = {
  id: 'incoming-feature-step',
  title: 'Incoming feature resource without projection',
};
fs.writeFileSync(mergeAwareManifestPath, `${JSON.stringify(reverseManifest, null, 2)}\n`);
run('git', ['add', 'course-content/runtime/lessons/1-1/interactive-manifest.json'], repo);
run('git', ['commit', '--no-verify', '-m', 'incoming feature resource change'], repo);
run('git', ['checkout', '-b', 'merge-aware-origin-after-feature', 'merge-aware-origin-tip'], repo);
run('git', ['merge', '--no-ff', '--no-edit', 'merge-aware-reverse-feature'], repo);
run('git', ['update-ref', 'refs/remotes/origin/integration', 'merge-aware-origin-after-feature'], repo);
run('git', ['checkout', 'merge-aware-integration'], repo);
run('git', ['merge', '--no-commit', '--no-ff', 'merge-aware-reverse-feature'], repo);
const reverseMergeResult = runGate(['--staged']);
assert.notEqual(
  reverseMergeResult.status,
  0,
  'integration-to-feature reverse merge must compare with HEAD and scan incoming feature resources',
);
assert.match(
  `${reverseMergeResult.stdout}\n${reverseMergeResult.stderr}`,
  /incoming-feature-step|missing-runtime-lesson-runtime-projection-row/,
);
const failingGitBin = path.join(tmp, 'failing-git-bin');
fs.mkdirSync(failingGitBin, { recursive: true });
fs.writeFileSync(
  path.join(failingGitBin, 'git'),
  `#!/bin/sh\nif [ "$1" = "merge-base" ] && [ "$2" = "--is-ancestor" ]; then exit 128; fi\nexec "${realGit}" "$@"\n`,
  { mode: 0o755 },
);
const ancestryErrorResult = runGate(['--staged'], {
  PATH: `${failingGitBin}${path.delimiter}${process.env.PATH ?? ''}`,
});
assert.notEqual(ancestryErrorResult.status, 0, 'merge-base errors must conservatively fall back to HEAD');
assert.match(
  `${ancestryErrorResult.stdout}\n${ancestryErrorResult.stderr}`,
  /incoming-feature-step|missing-runtime-lesson-runtime-projection-row/,
);
run('git', ['commit', '--no-verify', '-m', 'merge feature into integration fixture'], repo);

const octopusBase = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
run('git', ['checkout', '-b', 'merge-aware-octopus-one', octopusBase], repo);
fs.writeFileSync(path.join(repo, 'octopus-one.md'), 'octopus one\n');
run('git', ['add', 'octopus-one.md'], repo);
run('git', ['commit', '--no-verify', '-m', 'octopus one'], repo);
run('git', ['checkout', '-b', 'merge-aware-octopus-two', octopusBase], repo);
fs.writeFileSync(path.join(repo, 'octopus-two.md'), 'octopus two\n');
run('git', ['add', 'octopus-two.md'], repo);
run('git', ['commit', '--no-verify', '-m', 'octopus two'], repo);
run('git', ['checkout', 'merge-aware-integration'], repo);
run('git', ['merge', '--no-commit', '--no-ff', 'merge-aware-octopus-one', 'merge-aware-octopus-two'], repo);
const octopusMergeResult = runGate(['--staged']);
assert.notEqual(octopusMergeResult.status, 0, 'octopus staged merges must fail closed');
assert.match(
  `${octopusMergeResult.stdout}\n${octopusMergeResult.stderr}`,
  /does not support octopus merge staging/,
);

console.log('new resource semantic completeness command contract passed');

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'pipe' });
}

function runGate(args, envOverrides = {}) {
  return spawnSync(tsxBin, ['./scripts/data-governance/check-new-resource-semantic-completeness.ts', ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...envOverrides },
  });
}

function runtimeProjectionRow(overrides) {
  const sourceHash = overrides.sourceHash ?? sourceHashForRuntimeProjectionRow(overrides);
  return {
    artifactVersion: 'runtime-resource-projections.v1',
    id: overrides.id,
    resourceNodeId: overrides.resourceNodeId ?? overrides.id,
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
      reviewedSourceHash: overrides.reviewedSourceHash ?? sourceHash,
      reviewedVersionRef: overrides.sourceVersionRef,
      generationToolOrModel: 'test-fixture',
      promptOrManifestHash: overrides.promptOrManifestHash ?? null,
      reviewerVisibleRationale: 'Reviewed runtime source projection test fixture.',
      independentEvidenceRef: overrides.independentEvidenceRef ?? `${overrides.sourcePathOrUrl}#test`,
      confidence: 0.9,
      staleInvalidationRule: 'stale when source hash or version changes',
    },
    citationTargets: [overrides.sourcePathOrUrl],
  };
}

function runtimeSourceCoverageProjectionRow(overrides) {
  return runtimeProjectionRow({
    ...overrides,
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
  });
}

function runtimeTrackedLocalMediaProjection({ id, filename, sourcePath, sourceIdentity }) {
  const sourceHash = sha256File(path.join(repo, sourcePath));
  const projection = runtimeProjectionRow({
    id,
    family: 'runtime-lesson-media',
    resourceType: 'video',
    sourceKind: 'runtime_lesson_media',
    sourceRef: sourceIdentity,
    sourcePathOrUrl: sourcePath,
    sourceVersionRef: 'runtime-lesson-media.v1',
    independentEvidenceRef: `${sourcePath}#file-sha256:${sourceHash.slice('sha256:'.length)}`,
  });
  projection.sourceRecord = sourceIdentity;
  projection.title = filename;
  projection.runtimeSemanticEvidence = {
    schemaVersion: 'runtime-lesson-semantic-evidence.v1',
    assetStatus: 'tracked-local-runtime-asset',
    assetAvailability: 'tracked-in-git-index',
    evidenceFilePath: sourcePath,
    evidenceFileHash: sourceHash,
    evidenceSelector: `file-sha256:${sourceHash.slice('sha256:'.length)}`,
    externalIdentitySha256: null,
    sourceFileKind: 'binary-media',
    sourceFilePath: sourcePath,
    sourceFileHash: sourceHash,
  };
  return projection;
}

function runtimeExternalMediaProjection({ id, filename, url, evidenceFilePath, headingLine, sourceIdentity }) {
  const canonicalSourceIdentity = sourceIdentity ?? `1-1:${filename.replace(/\.[^.]+$/, '')}`;
  const projection = runtimeProjectionRow({
    id,
    family: 'runtime-lesson-media',
    resourceType: 'video',
    sourceKind: 'runtime_lesson_media',
    sourceRef: canonicalSourceIdentity,
    sourcePathOrUrl: url,
    sourceVersionRef: 'runtime-lesson-media.v1',
    independentEvidenceRef: `${evidenceFilePath}#markdown-line:${headingLine}`,
  });
  projection.sourceRecord = canonicalSourceIdentity;
  projection.sourceHash = null;
  projection.reviewAudit.reviewedSourceHash = null;
  const externalIdentitySha256 = createHash('sha256').update(url).digest('hex');
  projection.runtimeSemanticEvidence = {
    schemaVersion: 'runtime-lesson-semantic-evidence.v1',
    assetStatus: 'external-http-runtime-asset',
    evidenceFilePath,
    evidenceFileHash: sha256File(path.join(repo, evidenceFilePath)),
    evidenceSelector: `markdown-line:${headingLine}`,
    externalIdentitySha256,
    sourceFileKind: 'external-media',
    sourceFilePath: `external-media:${externalIdentitySha256}`,
    sourceFileHash: null,
  };
  return projection;
}

function runtimeMissingLocalMediaProjection({ id, filename, evidenceFilePath, headingLine }) {
  const projection = runtimeExternalMediaProjection({
    id,
    filename,
    url: `course-content/runtime/lessons/1-1/media/${filename}`,
    evidenceFilePath,
    headingLine,
  });
  projection.runtimeSemanticEvidence = {
    ...projection.runtimeSemanticEvidence,
    assetStatus: 'missing-local-runtime-asset',
    externalIdentitySha256: null,
    sourceFileKind: 'missing-local-runtime-asset',
    sourceFilePath: `missing-local-runtime-asset:${filename}`,
    sourceFileHash: null,
  };
  return projection;
}

function withRuntimeMediaEvidenceAlias(projection, relativeEvidencePath, headingLine) {
  const aliasEvidencePath = relativeEvidencePath.replace(
    /^course-content\/runtime\//,
    '/course-runtime/',
  );
  projection.runtimeSemanticEvidence.evidenceFilePath = aliasEvidencePath;
  projection.runtimeSemanticEvidence.evidenceSelector = `markdown-line:${headingLine}`;
  projection.reviewAudit.independentEvidenceRef =
    `${aliasEvidencePath}#markdown-line:${headingLine}`;
  return projection;
}

function runtimeLessonProjectionRows(lessonId, stepId, moduleId) {
  return `${runtimeLessonStepProjectionRow(lessonId, stepId)}\n${runtimeLessonModuleProjectionRow(lessonId, stepId, moduleId)}\n`;
}

function runtimeLessonStepProjectionRow(lessonId, stepId) {
  return JSON.stringify(runtimeProjectionRow({
    id: `lesson-step:${lessonId}:${stepId}`,
    family: 'runtime-lesson-step',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: `${lessonId}:${stepId}`,
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }));
}

function runtimeLessonModuleProjectionRow(lessonId, stepId, moduleId) {
  return JSON.stringify(runtimeProjectionRow({
    id: `lesson-module:${lessonId}:${stepId}:${moduleId}`,
    family: 'runtime-lesson-module',
    resourceType: 'lesson_step',
    sourceKind: 'runtime_lesson_step',
    sourceRef: `${lessonId}:${stepId}:${moduleId}`,
    sourcePathOrUrl: 'course-content/runtime/lessons/1-1/interactive-manifest.json',
    sourceVersionRef: 'runtime-lesson-manifest.v1',
  }));
}

function sha256File(filePath) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function sourceHashForRuntimeProjectionRow(overrides) {
  if (!overrides.sourcePathOrUrl) return 'sha256:runtime-source';
  const sourcePath = path.join(repo, overrides.sourcePathOrUrl);
  return fs.existsSync(sourcePath) ? sha256File(sourcePath) : 'sha256:runtime-source';
}
