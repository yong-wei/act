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

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    timeout: options.timeout ?? 15000,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function gitHookPath(repo, hookName) {
  const result = run('git', ['-C', repo, 'rev-parse', '--git-path', `hooks/${hookName}`], root);
  const rawPath = result.stdout.trim();
  return path.isAbsolute(rawPath) ? rawPath : path.join(repo, rawPath);
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
assert.doesNotMatch(
  dryRun.stdout,
  /warning:  is neither tracked nor ignored in target/,
  '未启用环境链接时不应检查空路径',
);
assert.doesNotMatch(
  dryRun.stdout,
  /node_modules/,
  '工作树配置同步不应再尝试链接 node_modules',
);
assert.match(
  dryRun.stdout,
  /--bootstrap-dev-env/,
  '工作树配置同步应提示使用开发环境一键初始化入口',
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
assert.equal(
  fs.existsSync(path.join(target, 'node_modules')),
  false,
  'apply 模式不应创建 node_modules 软链接或目录',
);

const graphDryRun = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--init-graphs',
    '--graph-alias',
    'test-alias',
  ],
  root,
);

assert.match(
  graphDryRun.stdout,
  /would initialize codegraph: .*target/,
  'dry-run 应说明会初始化 codegraph',
);
assert.match(
  graphDryRun.stdout,
  /would register CRG: .*target \(alias: test-alias\)/,
  'dry-run 应说明会注册 CRG 并使用指定 alias',
);

const binDir = path.join(tmpRoot, 'bin');
mkdirp(binDir);
const graphCallLog = path.join(tmpRoot, 'graph-calls.log');
for (const commandName of ['codegraph', 'code-review-graph']) {
  const commandPath = path.join(binDir, commandName);
  fs.writeFileSync(
    commandPath,
    `#!/bin/sh\nprintf '%s %s\\n' "$(basename "$0")" "$*" >> "$GRAPH_CALL_LOG"\nexit "\${GRAPH_FAIL_STATUS:-0}"\n`,
  );
  fs.chmodSync(commandPath, 0o755);
}

run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--apply',
    '--init-graphs',
    '--graph-alias',
    'test-alias',
  ],
  root,
  {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      GRAPH_CALL_LOG: graphCallLog,
    },
  },
);

const graphCalls = fs.readFileSync(graphCallLog, 'utf8');
assert.match(
  graphCalls,
  new RegExp(`codegraph init --index ${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  'apply 模式应初始化并索引 codegraph',
);
assert.match(
  graphCalls,
  new RegExp(`code-review-graph register ${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} --alias test-alias`),
  'apply 模式应按指定 alias 注册 CRG',
);
assert.match(
  graphCalls,
  new RegExp(`code-review-graph build --repo ${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  'apply 模式应构建 CRG',
);

assert.equal(
  fs.existsSync(path.join(target, '.git/hooks/post-commit')),
  false,
  '初始化图谱不应隐式写入 Git hook；hook 安装必须显式启用',
);

const hookDryRun = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--install-hooks',
  ],
  root,
);

assert.match(
  hookDryRun.stdout,
  /would install managed Git hook(?: with backup)?: post-commit/,
  'dry-run 应说明会安装 post-commit 图谱更新 hook',
);

run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--apply',
    '--install-hooks',
  ],
  root,
);

const postCommitHookPath = gitHookPath(target, 'post-commit');
const postCommitHook = fs.readFileSync(postCommitHookPath, 'utf8');
assert.match(
  postCommitHook,
  /Managed by sync-local-worktree-config\.sh/,
  '安装的 post-commit hook 应带托管标记',
);
assert.match(
  postCommitHook,
  /crg_run update/,
  'post-commit hook 应在提交成功后更新 CRG',
);
assert.match(
  postCommitHook,
  /codegraph_run sync/,
  'post-commit hook 应在提交成功后同步 CodeGraph',
);

const crgHookLib = fs.readFileSync(gitHookPath(target, 'crg-hook-lib.sh'), 'utf8');
assert.match(
  crgHookLib,
  /trap crg_cleanup EXIT INT TERM/,
  'CRG hook lib 应在 EXIT 时清理锁',
);
assert.match(
  crgHookLib,
  /command exit_status=.*signal=/,
  'CRG hook lib 应记录命令退出码和信号',
);

const codegraphHookLib = fs.readFileSync(gitHookPath(target, 'codegraph-hook-lib.sh'), 'utf8');
assert.match(
  codegraphHookLib,
  /trap codegraph_cleanup EXIT INT TERM/,
  'CodeGraph hook lib 应在 EXIT 时清理锁',
);
assert.match(
  codegraphHookLib,
  /command exit_status=.*signal=/,
  'CodeGraph hook lib 应记录命令退出码和信号',
);

const preCommitHook = fs.readFileSync(gitHookPath(target, 'pre-commit'), 'utf8');
assert.match(
  preCommitHook,
  /detect-changes --brief/,
  'pre-commit hook 只应做 CRG 变更检测',
);

run('sh', [postCommitHookPath], target, {
  env: {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    GRAPH_CALL_LOG: graphCallLog,
  },
});

assert.equal(
  fs.existsSync(path.join(target, '.code-review-graph/hook.lock')),
  false,
  'post-commit 连续运行 CRG 与 CodeGraph 后不应残留 CRG 锁',
);
assert.equal(
  fs.existsSync(path.join(target, '.codegraph/hook.lock')),
  false,
  'post-commit 连续运行 CRG 与 CodeGraph 后不应残留 CodeGraph 锁',
);

const crgHookLog = fs.readFileSync(path.join(target, '.code-review-graph/hooks.log'), 'utf8');
assert.match(
  crgHookLog,
  /start tool=.*code-review-graph repo=/,
  'CRG hook 日志应记录实际命令路径和仓库路径',
);
assert.match(
  crgHookLog,
  /command exit_status=0:/,
  'CRG hook 日志应记录成功命令退出码',
);

const codegraphHookLog = fs.readFileSync(path.join(target, '.codegraph/hooks.log'), 'utf8');
assert.match(
  codegraphHookLog,
  /start tool=.*codegraph repo=/,
  'CodeGraph hook 日志应记录实际命令路径和仓库路径',
);
assert.match(
  codegraphHookLog,
  /command exit_status=0:/,
  'CodeGraph hook 日志应记录成功命令退出码',
);

run('sh', [postCommitHookPath], target, {
  env: {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    GRAPH_CALL_LOG: graphCallLog,
    GRAPH_FAIL_STATUS: '137',
  },
});

assert.match(
  fs.readFileSync(path.join(target, '.code-review-graph/hooks.log'), 'utf8'),
  /command exit_status=137 signal=9:/,
  'CRG hook 日志应把 137 退出码标记为 signal 9',
);
assert.match(
  fs.readFileSync(path.join(target, '.codegraph/hooks.log'), 'utf8'),
  /command exit_status=137 signal=9:/,
  'CodeGraph hook 日志应把 137 退出码标记为 signal 9',
);
assert.equal(
  fs.existsSync(path.join(target, '.code-review-graph/hook.lock')),
  false,
  'CRG 命令失败后不应残留 hook 锁',
);
assert.equal(
  fs.existsSync(path.join(target, '.codegraph/hook.lock')),
  false,
  'CodeGraph 命令失败后不应残留 hook 锁',
);

const customPostCommit = '#!/bin/sh\n# custom hook using codegraph but not managed\ncodegraph sync .\n';
fs.writeFileSync(postCommitHookPath, customPostCommit);
fs.chmodSync(postCommitHookPath, 0o755);

run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--apply',
    '--install-hooks',
  ],
  root,
);

assert.equal(
  fs.readFileSync(postCommitHookPath, 'utf8'),
  customPostCommit,
  '非托管 hook 即使包含 codegraph 字样，也不应在未显式 replace 时被覆盖',
);

const depCallLog = path.join(tmpRoot, 'dep-calls.log');
const npmPath = path.join(binDir, 'npm');
fs.writeFileSync(
  npmPath,
  `#!/bin/sh\nprintf 'cwd=%s args=%s\\n' "$(pwd)" "$*" >> "$DEP_CALL_LOG"\n`,
);
fs.chmodSync(npmPath, 0o755);

const depsDryRun = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--install-deps',
  ],
  root,
  {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      DEP_CALL_LOG: depCallLog,
    },
  },
);

assert.match(
  depsDryRun.stdout,
  /would run npm ci in target: .*target/,
  'dry-run 应说明会在目标工作树运行 npm ci',
);

run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--apply',
    '--install-deps',
  ],
  root,
  {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      DEP_CALL_LOG: depCallLog,
    },
  },
);

const depCalls = fs.readFileSync(depCallLog, 'utf8');
assert.match(
  depCalls,
  new RegExp(`cwd=${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} args=ci`),
  'install-deps 应在目标工作树执行 npm ci',
);

const bootstrapDryRun = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--bootstrap-dev-env',
    '--graph-alias',
    'bootstrap-alias',
  ],
  root,
);

assert.match(bootstrapDryRun.stdout, /Config sync: symlink/, 'bootstrap 应启用配置链接');
assert.match(bootstrapDryRun.stdout, /Graph init: enabled/, 'bootstrap 应启用图谱初始化');
assert.match(bootstrapDryRun.stdout, /Git hooks: enabled/, 'bootstrap 应启用 Git hook 安装');
assert.match(bootstrapDryRun.stdout, /Dependency install: enabled/, 'bootstrap 应启用依赖安装');

const linkedMain = path.join(tmpRoot, 'linked-main');
const linkedTarget = path.join(tmpRoot, 'linked-target');
mkdirp(linkedMain);
run('git', ['init'], linkedMain);
run('git', ['config', 'user.email', 'test@example.com'], linkedMain);
run('git', ['config', 'user.name', 'Test User'], linkedMain);
fs.writeFileSync(path.join(linkedMain, 'README.md'), 'linked\n');
run('git', ['add', 'README.md'], linkedMain);
run('git', ['commit', '-m', 'init'], linkedMain);
run('git', ['worktree', 'add', linkedTarget], linkedMain);

run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    linkedTarget,
    '--apply',
    '--install-hooks',
  ],
  root,
);

const linkedPostCommitPath = gitHookPath(linkedTarget, 'post-commit');
assert.match(
  linkedPostCommitPath,
  /linked-main\/\.git\/hooks\/post-commit$/,
  'linked worktree 应写入 Git 实际使用的 common hooks 目录',
);
assert.match(
  fs.readFileSync(linkedPostCommitPath, 'utf8'),
  /Managed by sync-local-worktree-config\.sh/,
  'linked worktree 的实际 post-commit hook 应被安装',
);

console.log('local worktree config sync contract passed');
