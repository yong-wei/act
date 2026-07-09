import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'act-new-resource-gate-'));
const repo = path.join(tmp, 'repo');
fs.mkdirSync(path.join(repo, 'src/lib'), { recursive: true });
fs.mkdirSync(path.join(repo, 'src/features/teacher/preset-lessons/presets'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/resource-governance'), { recursive: true });
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

const result = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const unrelatedStagedResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const mismatchResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const teachingResourceResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const repairResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const presetResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const modifiedPresetItemResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const modifiedMapPresetItemResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const sameLinePresetResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const partialLinePresetResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const nonRegistryTernaryResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const stagedOnlyPresetResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const componentRegistryResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
const modifiedComponentRegistryResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--staged'], {
  cwd: repo,
  encoding: 'utf8',
});
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
  'component-resource-without-metadata': {
    id: 'component-resource-without-metadata',
    label: 'Component resource without metadata',
  },
};`,
));
run('git', ['add', 'src/lib/resource-registry.tsx'], repo);
run('git', ['commit', '--no-verify', '-m', 'add incomplete component registry'], repo);
const componentRegistryBaseResult = spawnSync('npx', ['tsx', './scripts/data-governance/check-new-resource-semantic-completeness.ts', '--base', 'HEAD~1'], {
  cwd: repo,
  encoding: 'utf8',
});
assert.notEqual(componentRegistryBaseResult.status, 0, 'gate must fail for changed resource component registry ids in base mode');
assert.match(
  `${componentRegistryBaseResult.stdout}\n${componentRegistryBaseResult.stderr}`,
  /component-resource-without-metadata missing-registered-resource-metadata/,
);

console.log('new resource semantic completeness command contract passed');

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'pipe' });
}
