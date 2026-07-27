import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  changedFilesForMode,
  validateTaskDecisionDelivery,
} from '../governance/verify-task-decision-delivery.mjs';

function writeFile(repoRoot, relativePath, content = '') {
  const targetPath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, 'utf8');
}

function writeTask(repoRoot, {
  taskId,
  scope,
  planningKind = 'openspec',
}) {
  const taskRoot = `docs/grill/${taskId}`;
  writeFile(repoRoot, `${taskRoot}/CONTEXT.md`, '# Context\n');
  writeFile(repoRoot, `${taskRoot}/adr/20260727-decision.md`, '# Decision\n');
  const planning = planningKind === 'openspec'
    ? { kind: 'openspec', change: 'task-decision-test' }
    : { kind: 'plan', path: 'plan.md' };
  if (planningKind === 'openspec') {
    writeFile(repoRoot, 'openspec/changes/task-decision-test/tasks.md', '## Tasks\n');
  } else {
    writeFile(repoRoot, `${taskRoot}/plan.md`, '# Plan\n');
  }
  writeFile(repoRoot, `${taskRoot}/manifest.json`, `${JSON.stringify({
    schemaVersion: 1,
    taskId,
    source: { kind: 'local' },
    grill: {
      context: 'CONTEXT.md',
      adrs: ['adr/20260727-decision.md'],
    },
    implementationScope: [scope],
    planning,
  }, null, 2)}\n`);
}

function withFixture(test) {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'task-decision-delivery-'));
  try {
    test(repoRoot);
  } finally {
    rmSync(repoRoot, { force: true, recursive: true });
  }
}

function git(repoRoot, ...args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
}

withFixture((repoRoot) => {
  writeTask(repoRoot, {
    scope: 'scripts/feature.mjs',
    taskId: 'local-20260727-open-spec-task',
  });
  writeFile(repoRoot, 'scripts/feature.mjs', 'export const feature = true;\n');

  assert.deepEqual(
    validateTaskDecisionDelivery({
      changedFiles: ['scripts/feature.mjs'],
      repoRoot,
    }),
    [],
  );
});

withFixture((repoRoot) => {
  writeTask(repoRoot, {
    planningKind: 'plan',
    scope: 'src/local-feature.ts',
    taskId: 'local-20260727-local-plan-task',
  });
  writeFile(repoRoot, 'src/local-feature.ts', 'export const feature = true;\n');

  assert.deepEqual(
    validateTaskDecisionDelivery({
      changedFiles: ['src/local-feature.ts'],
      repoRoot,
    }),
    [],
  );
});

withFixture((repoRoot) => {
  const errors = validateTaskDecisionDelivery({
    changedFiles: ['scripts/uncovered.mjs'],
    repoRoot,
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /未被有效任务清单/);
});

withFixture((repoRoot) => {
  writeTask(repoRoot, {
    scope: 'scripts/',
    taskId: 'local-20260727-first-task',
  });
  writeTask(repoRoot, {
    scope: 'scripts/',
    taskId: 'local-20260727-second-task',
  });
  const errors = validateTaskDecisionDelivery({
    changedFiles: ['scripts/overlap.mjs'],
    repoRoot,
  });

  assert.equal(errors.length, 1);
  assert.match(errors[0], /多个任务清单/);
});

withFixture((repoRoot) => {
  git(repoRoot, 'init', '--quiet', '--initial-branch=main');
  git(repoRoot, 'config', 'user.name', 'Test User');
  git(repoRoot, 'config', 'user.email', 'test@example.com');
  writeFile(repoRoot, 'README.md', '# Fixture\n');
  git(repoRoot, 'add', '.');
  git(repoRoot, 'commit', '--quiet', '-m', 'base');
  git(repoRoot, 'checkout', '--quiet', '-b', 'feature/task-decision-delivery');

  writeTask(repoRoot, {
    scope: 'scripts/cross-commit.mjs',
    taskId: 'local-20260727-cross-commit-task',
  });
  git(repoRoot, 'add', '.');
  git(repoRoot, 'commit', '--quiet', '-m', 'add decision records');
  writeFile(repoRoot, 'scripts/cross-commit.mjs', 'export const feature = true;\n');
  git(repoRoot, 'add', '.');
  git(repoRoot, 'commit', '--quiet', '-m', 'add implementation');

  const changedFiles = changedFilesForMode(repoRoot, 'base', 'main');
  assert.ok(changedFiles.includes('scripts/cross-commit.mjs'));
  assert.deepEqual(validateTaskDecisionDelivery({ changedFiles, repoRoot }), []);
});

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
assert.match(
  packageJson.scripts['verify:commit'],
  /verify:task-decision-delivery -- --staged/,
);
const workflowSource = readFileSync('.github/workflows/task-decision-delivery.yml', 'utf8');
assert.match(workflowSource, /pull_request:/);
assert.match(workflowSource, /--base "origin\/\$\{\{ github\.base_ref \}\}"/);

console.log('task decision delivery contract passed');
