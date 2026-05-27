import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worktree-config-sync-'));
const source = path.join(tmpRoot, 'source');
const target = path.join(tmpRoot, 'target');

function mkdirp(relativePath) {
  fs.mkdirSync(relativePath, { recursive: true });
}

function writeFile(relativePath, content) {
  const fullPath = path.join(source, relativePath);
  mkdirp(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
}

function writeTargetFile(relativePath, content) {
  const fullPath = path.join(target, relativePath);
  mkdirp(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

mkdirp(source);
mkdirp(target);
run('git', ['init'], source);
run('git', ['init'], target);

writeFile('.codex/agents/starter.toml', 'name = "starter"\n');
writeFile('.codex/config.toml', '[tools]\n');
writeFile('.codex/tmp/runtime.txt', 'runtime cache\n');
writeFile('.codex/cache/index.db', 'cache\n');
writeFile('.github/workflows/ci.yml', 'name: ci\n');
writeTargetFile('.codex/agents/starter.toml', 'name = "old-starter"\n');
writeTargetFile('.github/workflows/ci.yml', 'name: old-ci\n');

const dryRun = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
  ],
  root,
);

assert.match(
  dryRun.stdout,
  /would sync dir: \.codex\//,
  '工作树配置同步应默认包含 .codex/',
);
assert.match(
  dryRun.stdout,
  /would sync dir: \.github\//,
  '工作树配置同步应默认包含 .github/',
);
assert.doesNotMatch(
  dryRun.stdout,
  /\.codex\/tmp|runtime\.txt|\.codex\/cache|index\.db/,
  '工作树配置同步不应同步 .codex 的缓存和临时产物',
);

const apply = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--apply',
  ],
  root,
);

assert.match(
  apply.stdout,
  /synced dir: \.codex\//,
  'apply 模式应同步 .codex/',
);
assert.equal(
  fs.readFileSync(path.join(target, '.codex/agents/starter.toml'), 'utf8'),
  'name = "starter"\n',
  'apply 模式应覆盖目标工作树中的旧 .codex 配置',
);
assert.equal(
  fs.readdirSync(path.join(target, '.codex/agents')).some((name) => name.includes('.bak.')),
  false,
  '目录同步产生的备份不应留在 .codex/ 中',
);
assert.equal(
  fs.readdirSync(path.join(target, '.github/workflows')).some((name) => name.includes('.bak.')),
  false,
  '目录同步产生的备份不应留在 .github/ 中',
);
assert.equal(
  fs.existsSync(path.join(target, '.tmp/local-config-backups')),
  true,
  '目录同步覆盖已有文件时应把备份集中放入 .tmp/local-config-backups/',
);

console.log('local worktree config sync contract passed');
