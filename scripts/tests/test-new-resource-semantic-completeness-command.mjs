import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'act-new-resource-gate-'));
const repo = path.join(tmp, 'repo');
fs.mkdirSync(path.join(repo, 'src/lib'), { recursive: true });
fs.mkdirSync(path.join(repo, 'course-content/runtime/resource-governance'), { recursive: true });
fs.cpSync(path.join(root, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
fs.cpSync(path.join(root, 'src/lib/data-governance'), path.join(repo, 'src/lib/data-governance'), { recursive: true });
fs.cpSync(path.join(root, 'src/lib/resource-node-registry.ts'), path.join(repo, 'src/lib/resource-node-registry.ts'));
fs.cpSync(path.join(root, 'src/lib/resource-registry-metadata.ts'), path.join(repo, 'src/lib/resource-registry-metadata.ts'));
fs.cpSync(path.join(root, 'src/lib/kaq-artifact-versioning.ts'), path.join(repo, 'src/lib/kaq-artifact-versioning.ts'));
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

console.log('new resource semantic completeness command contract passed');

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'pipe' });
}
