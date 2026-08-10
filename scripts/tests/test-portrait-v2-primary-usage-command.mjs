import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const gateScript = path.join(repoRoot, 'scripts/data-governance/check-portrait-v2-primary-usage.ts');
const tsxCli = path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs');
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'act-portrait-v2-primary-gate-'));
const isolatedHooksPath = path.join(tempRoot, 'hooks');
const globalHooksPath = path.join(tempRoot, 'global-hooks');
const globalHooksConfigPath = globalHooksPath.split(path.sep).join('/');
const globalConfigPath = path.join(tempRoot, 'global.gitconfig');
mkdirSync(isolatedHooksPath);
mkdirSync(globalHooksPath);
writeFileSync(
  path.join(globalHooksPath, 'pre-commit'),
  '#!/bin/sh\nprintf "%s\\n" "isolated global pre-commit hook invoked" >&2\nexit 97\n',
  { mode: 0o755 },
);
writeFileSync(globalConfigPath, `[core]\n\thooksPath = ${globalHooksConfigPath}\n`);
const gitLocalEnvVars = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
]);
const isolatedGitEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !gitLocalEnvVars.has(key)),
);
const globalHookGitEnv = {
  ...isolatedGitEnv,
  GIT_CONFIG_GLOBAL: globalConfigPath,
};

function runGit(args, env = isolatedGitEnv) {
  return execFileSync('git', args, {
    cwd: tempRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
}

function writeFixture(relativePath, content) {
  const filePath = path.join(tempRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runGate(args) {
  try {
    const stdout = execFileSync(process.execPath, [tsxCli, gateScript, ...args], {
      cwd: tempRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...isolatedGitEnv,
        TSX_TSCONFIG_PATH: path.join(repoRoot, 'tsconfig.json'),
      },
    });
    return { status: 0, output: stdout };
  } catch (error) {
    return {
      status: error.status ?? -1,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

try {
  runGit(['init', '-q'], globalHookGitEnv);
  runGit(['config', 'user.email', 'portrait-gate-test@example.com'], globalHookGitEnv);
  runGit(['config', 'user.name', 'portrait gate test'], globalHookGitEnv);
  runGit(['config', '--local', 'core.hooksPath', isolatedHooksPath], globalHookGitEnv);
  assert.equal(
    runGit(['config', '--global', '--get', 'core.hooksPath'], globalHookGitEnv).trim(),
    globalHooksConfigPath,
    'the test must use the temporary failing global hooks path',
  );
  assert.equal(
    runGit(['config', '--local', '--get', 'core.hooksPath'], globalHookGitEnv).trim(),
    isolatedHooksPath,
    'the temp repo must override the global hooks path with its empty local directory',
  );

  const globalHookProbeRoot = path.join(tempRoot, 'global-hook-probe');
  mkdirSync(globalHookProbeRoot);
  runGit(['-C', globalHookProbeRoot, 'init', '-q'], globalHookGitEnv);
  runGit(
    ['-C', globalHookProbeRoot, 'config', 'user.email', 'portrait-gate-test@example.com'],
    globalHookGitEnv,
  );
  runGit(
    ['-C', globalHookProbeRoot, 'config', 'user.name', 'portrait gate test'],
    globalHookGitEnv,
  );
  writeFileSync(path.join(globalHookProbeRoot, 'probe.txt'), 'probe\n');
  runGit(['-C', globalHookProbeRoot, 'add', 'probe.txt'], globalHookGitEnv);
  assert.throws(
    () => runGit(['-C', globalHookProbeRoot, 'commit', '-q', '-m', 'global hook probe'], globalHookGitEnv),
    (error) =>
      error.status !== 0 &&
      `${error.stdout ?? ''}${error.stderr ?? ''}`.includes('isolated global pre-commit hook invoked'),
    'the temporary global pre-commit hook must fail when no local override exists',
  );

  const fixturePath = 'src/portrait-v2-gate-fixture.ts';
  const compatibilityMarker = '// portrait-v2-legacy-compatibility-adapter';
  writeFixture(fixturePath, 'export const baseline = true;\n');
  runGit(['add', fixturePath], globalHookGitEnv);
  runGit(['commit', '-q', '-m', 'baseline'], globalHookGitEnv);

  writeFixture('artifacts/large-evidence.json', `{"payload":"${'x'.repeat(2 * 1024 * 1024)}"}\n`);
  runGit(['add', 'artifacts/large-evidence.json'], globalHookGitEnv);
  const largeUnrelatedDiffResult = runGate(['--staged']);
  assert.equal(
    largeUnrelatedDiffResult.status,
    0,
    'large unrelated staged evidence must not exhaust the portrait gate diff buffer',
  );
  assert.match(largeUnrelatedDiffResult.output, /0 changed file\(s\) scanned/);
  runGit(['commit', '-q', '-m', 'large unrelated evidence'], globalHookGitEnv);

  writeFixture('src/untracked-portrait-v2-fixture.ts', 'const value: CompetencyVector = legacyVector;\n');
  const untrackedResult = runGate(['--staged']);
  assert.equal(untrackedResult.status, 0, 'a truly untracked file must remain outside the staged diff');
  assert.match(untrackedResult.output, /0 changed file\(s\) scanned/);

  writeFixture(fixturePath, 'const value: CompetencyVector = legacyVector;\n');
  runGit(['add', fixturePath], globalHookGitEnv);
  writeFixture(fixturePath, `${compatibilityMarker}\nconst value: CompetencyVector = legacyVector;\n`);
  const stagedResult = runGate(['--staged']);
  assert.notEqual(stagedResult.status, 0, 'staged mode must inspect the index, not the dirty worktree');
  assert.match(stagedResult.output, /legacy-competency-vector/);

  writeFixture(fixturePath, `${compatibilityMarker}\nconst value: CompetencyVector = legacyVector;\n`);
  runGit(['add', fixturePath], globalHookGitEnv);
  writeFixture(fixturePath, 'const value: CompetencyVector = legacyVector;\n');
  const stagedCompatibilityResult = runGate(['--staged']);
  assert.equal(
    stagedCompatibilityResult.status,
    0,
    'staged mode must use the index marker even when the worktree deletes it',
  );
  assert.match(stagedCompatibilityResult.output, /1 changed file\(s\) scanned/);

  runGit(['commit', '-q', '-m', 'add legacy usage with marker'], globalHookGitEnv);
  const headCompatibilityResult = runGate([]);
  assert.equal(
    headCompatibilityResult.status,
    0,
    'push mode must use the HEAD marker even when the worktree deletes it',
  );
  assert.match(headCompatibilityResult.output, /1 changed file\(s\) scanned/);

  writeFixture(
    fixturePath,
    'const value: CompetencyVector = legacyVector;\nconst anotherValue: CompetencyVector = anotherLegacyVector;\n',
  );
  runGit(['add', fixturePath], globalHookGitEnv);
  runGit(['commit', '-q', '-m', 'add legacy usage without marker'], globalHookGitEnv);
  writeFixture(
    fixturePath,
    `${compatibilityMarker}\nconst value: CompetencyVector = legacyVector;\nconst anotherValue: CompetencyVector = anotherLegacyVector;\n`,
  );
  const headResult = runGate([]);
  assert.notEqual(headResult.status, 0, 'push mode must inspect HEAD, not the dirty worktree');
  assert.match(headResult.output, /legacy-competency-vector/);

  const invalidBaseResult = runGate(['--base', 'definitely-not-a-real-portrait-gate-base']);
  assert.notEqual(invalidBaseResult.status, 0, 'an invalid explicit base must fail closed');
  assert.match(invalidBaseResult.output, /无法解析显式 portrait-v2 门禁基线/);

  const ignoredRenameSource = 'tests/fixtures/legacy-portrait-source.ts';
  const productionRenameTarget = 'src/中文 portrait consumer.ts';
  writeFixture(ignoredRenameSource, 'const renamedValue: CompetencyVector = legacyVector;\n');
  runGit(['add', ignoredRenameSource], globalHookGitEnv);
  runGit(['commit', '-q', '-m', 'ignored legacy fixture'], globalHookGitEnv);
  runGit(['mv', ignoredRenameSource, productionRenameTarget], globalHookGitEnv);
  const quotedRenameResult = runGate(['--staged']);
  assert.notEqual(
    quotedRenameResult.status,
    0,
    'a test-to-production rename with a quoted Unicode path must be scanned',
  );
  assert.match(quotedRenameResult.output, /legacy-competency-vector/);
  assert.match(quotedRenameResult.output, /src\/中文 portrait consumer\.ts/);

  runGit(['commit', '-q', '-m', 'commit rename baseline'], globalHookGitEnv);
  const mergeBaseCommit = runGit(['rev-parse', 'HEAD'], globalHookGitEnv).trim();
  runGit(['checkout', '-b', 'portrait-merge-integration'], globalHookGitEnv);
  const integrationLegacyPath = 'src/portrait-v2-integration-legacy.ts';
  writeFixture(integrationLegacyPath, 'const integrationValue: CompetencyVector = legacyVector;\n');
  runGit(['add', integrationLegacyPath], globalHookGitEnv);
  runGit(['commit', '-q', '-m', 'integration legacy usage'], globalHookGitEnv);
  runGit(['update-ref', 'refs/remotes/origin/integration', 'portrait-merge-integration'], globalHookGitEnv);

  runGit(['checkout', '-b', 'portrait-merge-feature', mergeBaseCommit], globalHookGitEnv);
  const featureSafePath = 'src/portrait-v2-merge-safe.ts';
  writeFixture(featureSafePath, 'export const safeFeatureChange = true;\n');
  runGit(['add', featureSafePath], globalHookGitEnv);
  runGit(['commit', '-q', '-m', 'feature safe change'], globalHookGitEnv);
  runGit(['merge', '--no-commit', '--no-ff', 'portrait-merge-integration'], globalHookGitEnv);
  const mergeAwareResult = runGate(['--staged']);
  assert.equal(
    mergeAwareResult.status,
    0,
    'staged merge mode must scan the feature delta instead of legacy usage already present on integration',
  );
  assert.match(mergeAwareResult.output, /1 changed file\(s\) scanned/);

  const featureLegacyPath = 'src/portrait-v2-merge-feature-legacy.ts';
  writeFixture(featureLegacyPath, 'const featureValue: CompetencyVector = legacyVector;\n');
  runGit(['add', featureLegacyPath], globalHookGitEnv);
  const featureLegacyMergeResult = runGate(['--staged']);
  assert.notEqual(
    featureLegacyMergeResult.status,
    0,
    'staged merge mode must still reject legacy usage newly added by the feature',
  );
  assert.match(featureLegacyMergeResult.output, /legacy-competency-vector/);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log('portrait-v2 primary usage command contract passed');
