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
writeFile(
  '.codex/hooks.json',
  JSON.stringify(
    {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup|resume',
            hooks: [{ type: 'command', command: 'run-openwolf-hook.sh session-start', timeout: 10 }],
          },
        ],
        PostToolUse: [
          {
            matcher: '^Write$|^Edit$',
            hooks: [{ type: 'command', command: 'run-openwolf-hook.sh post-write', timeout: 10 }],
          },
        ],
        Stop: [
          {
            hooks: [{ type: 'command', command: 'run-openwolf-hook.sh stop', timeout: 10 }],
          },
        ],
      },
    },
    null,
    2,
  ),
);
writeFile('.codex/tmp/runtime.txt', 'runtime cache\n');
writeFile('.codex/cache/index.db', 'cache\n');
writeFile('.github/workflows/ci.yml', 'name: ci\n');
writeFile('.wolf/OPENWOLF.md', '# OpenWolf\n');
writeFile('.wolf/identity.md', '# Identity\n');
writeFile('.wolf/cerebrum.md', '# Cerebrum\n');
writeFile('.wolf/buglog.json', '{ "version": 1, "bugs": [] }\n');
writeFile('.wolf/memory.md', '# Memory\n中文记录\n');
writeFile('.wolf/config.json', '{ "version": 1 }\n');
writeFile('.wolf/reframe-frameworks.md', '# Reframe\n');
writeFile('.wolf/cron-manifest.json', '{ "version": 1, "tasks": [] }\n');
writeFile('.wolf/anatomy.md', '# anatomy.md\n');
writeFile('.wolf/token-ledger.json', '{ "version": 1 }\n');
writeFile('.wolf/cron-state.json', '{ "engine_status": "initialized" }\n');
writeFile('.wolf/designqc-report.json', '{ "captures": [] }\n');
writeFile('.wolf/suggestions.json', '{ "suggestions": [] }\n');
writeFile('.wolf/hooks/session-start.js', '// session-start\n');
writeFile('.wolf/hooks/pre-read.js', '// pre-read\n');
writeFile('.wolf/hooks/pre-write.js', '// pre-write\n');
writeFile('.wolf/hooks/post-read.js', '// post-read\n');
writeFile('.wolf/hooks/post-write.js', '// post-write\n');
writeFile('.wolf/hooks/stop.js', '// stop\n');
writeFile('.wolf/hooks/shared.js', '// shared\n');
writeFile('.wolf/hooks/_session.json', '{ "session_id": "source" }\n');
writeFile('course-content/runtime/lessons/demo/manifest.json', '{ "id": "demo" }\n');
writeFile('course-content/runtime/knowledge/tracked.json', '{ "tracked": true }\n');
writeFile('course-content/runtime/knowledge/media/asset.txt', 'asset\n');
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
assert.match(
  dryRun.stdout,
  /would link runtime directory: course-content\/runtime -> /,
  'dry-run 应说明会把 source runtime 目录软链接到目标工作树',
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
assert.equal(
  fs.lstatSync(path.join(target, 'course-content/runtime')).isSymbolicLink(),
  true,
  'apply 模式应把 runtime 目录软链接到 source runtime',
);
assert.equal(
  fs.readlinkSync(path.join(target, 'course-content/runtime')),
  path.join(source, 'course-content/runtime'),
  'runtime 目录软链接应指向 source runtime',
);

const trackedRuntimeTarget = path.join(tmpRoot, 'tracked-runtime-target');
mkdirp(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge'));
run('git', ['init'], trackedRuntimeTarget);
fs.writeFileSync(
  path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/tracked.json'),
  '{ "target": true }\n',
);
run('git', ['-C', trackedRuntimeTarget, 'add', 'course-content/runtime/knowledge/tracked.json'], root);
run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    trackedRuntimeTarget,
    '--apply',
  ],
  root,
);
assert.equal(
  fs.lstatSync(path.join(trackedRuntimeTarget, 'course-content/runtime')).isSymbolicLink(),
  false,
  '目标 runtime 下有 tracked 文件时不应替换整个 runtime 目录',
);
assert.equal(
  fs.lstatSync(path.join(trackedRuntimeTarget, 'course-content/runtime/lessons')).isSymbolicLink(),
  true,
  '无 tracked 内容的 runtime 子目录应直接软链接',
);
assert.equal(
  fs.lstatSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/tracked.json')).isSymbolicLink(),
  false,
  'tracked runtime 文件应保留目标工作树本地文件',
);
assert.equal(
  fs.lstatSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/media')).isSymbolicLink(),
  true,
  'tracked runtime 目录下未跟踪的子目录应递归软链接',
);

const openwolfDryRun = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    target,
    '--link-openwolf-knowledge',
  ],
  root,
);

assert.match(
  openwolfDryRun.stdout,
  /OpenWolf knowledge links: enabled/,
  'dry-run 应说明启用 OpenWolf 长期知识链接',
);
assert.match(
  openwolfDryRun.stdout,
  /would link OpenWolf knowledge file: \.wolf\/cerebrum\.md/,
  'dry-run 应说明会链接 OpenWolf 长期知识文件',
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
    '--link-openwolf-knowledge',
  ],
  root,
);

for (const rel of [
  '.wolf/OPENWOLF.md',
  '.wolf/identity.md',
  '.wolf/cerebrum.md',
  '.wolf/buglog.json',
  '.wolf/memory.md',
  '.wolf/config.json',
  '.wolf/reframe-frameworks.md',
  '.wolf/cron-manifest.json',
]) {
  const fullPath = path.join(target, rel);
  assert.equal(fs.lstatSync(fullPath).isSymbolicLink(), true, `${rel} 应软链接到主工作树 .wolf`);
  assert.equal(fs.readlinkSync(fullPath), path.join(source, rel), `${rel} 应指向 source .wolf`);
}

for (const rel of [
  '.wolf/anatomy.md',
  '.wolf/token-ledger.json',
  '.wolf/cron-state.json',
  '.wolf/designqc-report.json',
  '.wolf/suggestions.json',
  '.wolf/hooks/session-start.js',
]) {
  const fullPath = path.join(target, rel);
  assert.equal(fs.existsSync(fullPath), true, `${rel} 应在目标工作树本地存在`);
  assert.equal(fs.lstatSync(fullPath).isSymbolicLink(), false, `${rel} 不应软链接共享`);
}

assert.equal(
  fs.existsSync(path.join(target, '.wolf/hooks/_session.json')),
  false,
  'OpenWolf 会话运行态不应从主工作树复制',
);

const worktreeSource = JSON.parse(fs.readFileSync(path.join(target, '.wolf/worktree-source.json'), 'utf8'));
assert.equal(worktreeSource.id, 'target', '非 .codex worktree 的 OpenWolf 来源 id 应使用目标目录名');
assert.equal(worktreeSource.path, target, 'OpenWolf 来源应记录目标工作树路径');
assert.equal(worktreeSource.sharedWolf, path.join(source, '.wolf'), 'OpenWolf 来源应记录共享 .wolf 路径');

const sourceMemorySize = Buffer.byteLength(fs.readFileSync(path.join(source, '.wolf/memory.md'), 'utf8'));
const stampState = JSON.parse(fs.readFileSync(path.join(target, '.wolf/source-stamp-state.json'), 'utf8'));
assert.equal(stampState.memorySize, sourceMemorySize, 'stamp 状态应从当前共享 memory 大小开始');

const codexHooks = JSON.parse(fs.readFileSync(path.join(target, '.codex/hooks.json'), 'utf8'));
assert.match(
  JSON.stringify(codexHooks),
  /openwolf-source-stamp\.mjs session-start/,
  '同步脚本应安装 session-start 来源 stamp hook',
);
assert.match(
  JSON.stringify(codexHooks),
  /openwolf-source-stamp\.mjs post-write/,
  '同步脚本应安装 post-write 来源 stamp hook',
);
assert.match(
  JSON.stringify(codexHooks),
  /openwolf-source-stamp\.mjs stop/,
  '同步脚本应安装 stop 来源 stamp hook',
);

const freshLinkTarget = path.join(tmpRoot, 'fresh-link-target');
mkdirp(freshLinkTarget);
run('git', ['init'], freshLinkTarget);
run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    freshLinkTarget,
    '--apply',
    '--link-config',
    '--link-openwolf-knowledge',
  ],
  root,
);

assert.equal(
  fs.existsSync(path.join(freshLinkTarget, '.codex/hooks.json')),
  true,
  'fresh link-config 目标也应获得 .codex/hooks.json',
);
assert.match(
  fs.readFileSync(path.join(freshLinkTarget, '.codex/hooks.json'), 'utf8'),
  /openwolf-source-stamp\.mjs post-write/,
  'fresh link-config 目标应安装 OpenWolf source stamp hook',
);
const freshHooksConfig = JSON.parse(fs.readFileSync(path.join(freshLinkTarget, '.codex/hooks.json'), 'utf8'));
assert.equal(
  freshHooksConfig.hooks.SessionStart.at(0).hooks.at(0).command,
  'run-openwolf-hook.sh session-start',
  'source stamp hook 不应排在原 OpenWolf session-start hook 前面',
);
assert.match(
  freshHooksConfig.hooks.SessionStart.at(-1).hooks.at(0).command,
  /openwolf-source-stamp\.mjs session-start/,
  'source stamp session-start hook 应追加在原 OpenWolf hook 后面',
);

const noOverwriteTarget = path.join(tmpRoot, 'no-overwrite-target');
mkdirp(path.join(noOverwriteTarget, '.wolf'));
run('git', ['init'], noOverwriteTarget);
fs.writeFileSync(path.join(noOverwriteTarget, '.wolf/cerebrum.md'), 'local cerebrum\n');
run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    noOverwriteTarget,
    '--apply',
    '--no-overwrite',
    '--link-openwolf-knowledge',
  ],
  root,
);
assert.equal(
  fs.lstatSync(path.join(noOverwriteTarget, '.wolf/cerebrum.md')).isSymbolicLink(),
  false,
  '--no-overwrite 不应替换已有 OpenWolf 长期知识文件',
);
assert.equal(
  fs.readFileSync(path.join(noOverwriteTarget, '.wolf/cerebrum.md'), 'utf8'),
  'local cerebrum\n',
  '--no-overwrite 应保留已有 OpenWolf 长期知识内容',
);

const trackedWolfTarget = path.join(tmpRoot, 'tracked-wolf-target');
mkdirp(path.join(trackedWolfTarget, '.wolf'));
run('git', ['init'], trackedWolfTarget);
fs.writeFileSync(path.join(trackedWolfTarget, '.wolf/cerebrum.md'), 'tracked cerebrum\n');
run('git', ['-C', trackedWolfTarget, 'add', '.wolf/cerebrum.md'], root);
run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    trackedWolfTarget,
    '--apply',
    '--link-openwolf-knowledge',
  ],
  root,
);
assert.equal(
  fs.lstatSync(path.join(trackedWolfTarget, '.wolf/cerebrum.md')).isSymbolicLink(),
  false,
  '已被 Git 跟踪的 OpenWolf 长期知识文件不应被替换为软链接',
);

const peerTarget = path.join(tmpRoot, 'target-peer');
mkdirp(peerTarget);
run('git', ['init'], peerTarget);
run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    peerTarget,
    '--apply',
    '--link-openwolf-knowledge',
  ],
  root,
);

fs.appendFileSync(
  path.join(source, '.wolf/memory.md'),
  '\n## Session: 2026-06-04 10:30\n\n| Time | Action | File(s) | Outcome | ~Tokens |\n|------|--------|---------|---------|--------|\n| 10:31 | Investigated source stamping | `.wolf/memory.md` | ok | ~1k |\n',
);
run('node', [path.join(root, 'scripts/dev/openwolf-source-stamp.mjs'), 'post-write'], target);
run('node', [path.join(root, 'scripts/dev/openwolf-source-stamp.mjs'), 'post-write'], peerTarget);
const stampedMemory = fs.readFileSync(path.join(source, '.wolf/memory.md'), 'utf8');
assert.match(
  stampedMemory,
  new RegExp(`## Session: 2026-06-04 10:30 - Source: \\[${worktreeSource.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`),
  'stamp hook 应为新增 session header 注入来源',
);
assert.match(
  stampedMemory,
  new RegExp(`\\| 10:31 \\| \\[${worktreeSource.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\] Investigated source stamping \\|`),
  'stamp hook 应为新增 memory 行注入来源',
);
assert.doesNotMatch(
  stampedMemory,
  /\| 10:31 \| \[[^\]]+\] \[[^\]]+\] Investigated source stamping \|/,
  '多个工作树共享 memory 时不应重复叠加来源前缀',
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
  /typecheck_run "pre-commit"/,
  'pre-commit hook 应执行本地提交门禁',
);
assert.match(
  preCommitHook,
  /detect-changes --brief/,
  'pre-commit hook 应保留 CRG 变更检测',
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
const npxPath = path.join(binDir, 'npx');
fs.writeFileSync(
  npxPath,
  `#!/bin/sh\nprintf 'cwd=%s args=%s\\n' "$(pwd)" "$*" >> "$DEP_CALL_LOG"\n`,
);
fs.chmodSync(npxPath, 0o755);

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
assert.match(
  depsDryRun.stdout,
  /would run Prisma Client generation in target: .*target/,
  'dry-run 应说明会在目标工作树生成 Prisma Client',
);
assert.match(
  depsDryRun.stdout,
  /would run control-engine Wasm generation in target: .*target/,
  'dry-run 应说明会在目标工作树生成控制引擎 Wasm 包',
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
assert.match(
  depCalls,
  new RegExp(`cwd=${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} args=prisma generate`),
  'install-deps 应在目标工作树生成 Prisma Client',
);
assert.match(
  depCalls,
  new RegExp(`cwd=${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} args=run wasm:build:control-engine`),
  'install-deps 应在目标工作树生成控制引擎 Wasm 包',
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
assert.match(bootstrapDryRun.stdout, /OpenWolf knowledge links: enabled/, 'bootstrap 应启用 OpenWolf 长期知识链接');

const selfHooksDryRun = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    target,
    '--target',
    target,
    '--install-hooks',
  ],
  root,
);

assert.match(
  selfHooksDryRun.stdout,
  /would install managed Git hook(?: with backup)?: pre-push/,
  'source=target 且仅安装 hooks 时应允许 dry-run 并包含 pre-push 门禁',
);
assert.doesNotMatch(
  selfHooksDryRun.stdout,
  /Files:/,
  'source=target hooks-only 路径不应执行文件同步',
);

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
const linkedPreCommitPath = gitHookPath(linkedTarget, 'pre-commit');
const linkedPrePushPath = gitHookPath(linkedTarget, 'pre-push');
const linkedTypecheckLibPath = gitHookPath(linkedTarget, 'typecheck-hook-lib.sh');
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
assert.match(
  fs.readFileSync(linkedPreCommitPath, 'utf8'),
  /typecheck_run "pre-commit"/,
  'linked worktree 的 pre-commit hook 应执行 TypeScript 门禁',
);
assert.match(
  fs.readFileSync(linkedPrePushPath, 'utf8'),
  /typecheck_run "pre-push"/,
  'linked worktree 的 pre-push hook 应执行 TypeScript 门禁',
);
assert.match(
  fs.readFileSync(linkedTypecheckLibPath, 'utf8'),
  /npm run "verify:\$\{hook_name#pre-\}"/,
  'linked worktree 应安装共享 TypeScript hook helper',
);

console.log('local worktree config sync contract passed');
