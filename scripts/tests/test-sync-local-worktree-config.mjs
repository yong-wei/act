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

function gitPath(repo, relativePath) {
  const result = run('git', ['-C', repo, 'rev-parse', '--git-path', relativePath], root);
  const rawPath = result.stdout.trim();
  return path.isAbsolute(rawPath) ? rawPath : path.join(repo, rawPath);
}

function createIsolatedWorktree(name) {
  const worktree = path.join(tmpRoot, name);
  run('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], source);
  return worktree;
}

mkdirp(source);
run('git', ['init'], source);
run('git', ['config', 'user.email', 'test@example.com'], source);
run('git', ['config', 'user.name', 'Test User'], source);
fs.writeFileSync(path.join(source, 'README.md'), 'source\n');
writeFile('GEMINI.md', '# Source Gemini\n');
writeFile('course-content/runtime/lessons/demo/manifest.json', '{ "id": "demo" }\n');
writeFile('course-content/runtime/knowledge/tracked.json', '{ "tracked": true }\n');
writeFile('course-content/runtime/knowledge/media/asset.txt', 'tracked asset\n');
run('git', ['add', 'README.md', 'GEMINI.md', 'course-content/runtime'], source);
run('git', ['commit', '-m', 'initial source'], source);
run('git', ['worktree', 'add', '--detach', target, 'HEAD'], source);
const canonicalSource = fs.realpathSync(source);
const canonicalTarget = fs.realpathSync(target);

writeFile('.codex/agents/starter.toml', 'name = "starter"\n');
writeFile('.codex/config.toml', '[tools]\n');
writeFile('.codex/environments/environment.toml', '[environment]\n');
writeFile('AGENTS.md', '# Source agents\n');
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
writeFile('course-content/runtime/resources/textbooks/demo/chunks/ch01.md', 'primary resource v1\n');
writeFile('course-content/runtime/knowledge/media-untracked/asset.txt', 'primary untracked asset\n');
fs.symlinkSync(
  path.join(source, 'course-content/runtime/resources'),
  path.join(target, 'course-content/runtime/resources'),
  'dir',
);
writeTargetFile('.codex/agents/starter.toml', 'name = "old-starter"\n');
writeTargetFile('AGENTS.md', '# Old agents\n');
writeTargetFile('GEMINI.md', '# Target Gemini\n');
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
  /would copy file with backup: AGENTS\.md/,
  '工作树配置同步应默认包含 AGENTS.md',
);
assert.match(
  dryRun.stdout,
  /would sync dir: \.github\//,
  '工作树配置同步应默认包含 .github/',
);
assert.match(
  dryRun.stdout,
  /skip Git-managed file: GEMINI\.md/,
  'Git 跟踪文件应完全交由 Git 管理，不参与工作树同步',
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
  /would replace existing runtime directory with real files: course-content\/runtime\/resources/,
  'dry-run 应说明会以真实文件替换旧 runtime 软链接',
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
  fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'),
  '# Source agents\n',
  'apply 模式应同步本地 AGENTS.md',
);
assert.equal(
  fs.readFileSync(path.join(target, 'GEMINI.md'), 'utf8'),
  '# Target Gemini\n',
  'apply 模式不得覆盖 Git 管理的目标文件',
);
const targetLocalExclude = fs.readFileSync(gitPath(target, 'info/exclude'), 'utf8');
assert.match(targetLocalExclude, /^AGENTS\.md$/m, '同步脚本应在隔离工作树本地忽略 AGENTS.md');
assert.match(targetLocalExclude, /^\.codex\/$/m, '同步脚本应在隔离工作树本地忽略 .codex/');
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
  fs.lstatSync(path.join(target, 'course-content/runtime/resources')).isSymbolicLink(),
  false,
  'apply 模式应将未跟踪 runtime 资源保存为真实目录',
);
assert.equal(
  fs.readFileSync(path.join(target, 'course-content/runtime/resources/textbooks/demo/chunks/ch01.md'), 'utf8'),
  'primary resource v1\n',
  '未跟踪 runtime 资源应从主工作树复制到隔离工作树',
);

fs.writeFileSync(path.join(target, 'course-content/runtime/resources/stale.txt'), 'stale\n');
writeFile('course-content/runtime/resources/textbooks/demo/chunks/ch01.md', 'primary resource v2\n');
run(
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
assert.equal(
  fs.readFileSync(path.join(target, 'course-content/runtime/resources/textbooks/demo/chunks/ch01.md'), 'utf8'),
  'primary resource v2\n',
  '重同步应以主工作树的未跟踪资源为准',
);
assert.equal(
  fs.existsSync(path.join(target, 'course-content/runtime/resources/stale.txt')),
  false,
  '重同步应移除隔离工作树中主工作树已不存在的未跟踪资源',
);

const trackedRuntimeTarget = createIsolatedWorktree('tracked-runtime-target');
fs.writeFileSync(
  path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/tracked.json'),
  '{ "target": true }\n',
);
fs.mkdirSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/stale-untracked'), { recursive: true });
fs.writeFileSync(
  path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/stale-untracked/file.txt'),
  'stale target-only resource\n',
);
fs.mkdirSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/legacy-mixed'), { recursive: true });
fs.writeFileSync(
  path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/legacy-mixed/tracked.txt'),
  'target-only tracked resource\n',
);
fs.writeFileSync(
  path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/legacy-mixed/stale.txt'),
  'target-only stale resource\n',
);
run(
  'git',
  ['-C', trackedRuntimeTarget, 'add', 'course-content/runtime/knowledge/legacy-mixed/tracked.txt'],
  root,
);
const trackedRuntimeApply = run(
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
  false,
  '已跟踪 runtime 子目录应保留 Git 工作树目录',
);
assert.equal(
  fs.readFileSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/tracked.json'), 'utf8'),
  '{ "target": true }\n',
  'tracked runtime 文件应保留隔离工作树的 Git 管理内容',
);
assert.equal(
  fs.lstatSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/media-untracked')).isSymbolicLink(),
  false,
  'tracked runtime 目录下未跟踪的子目录应递归复制为真实目录',
);
assert.equal(
  fs.readFileSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/media-untracked/asset.txt'), 'utf8'),
  'primary untracked asset\n',
  '递归同步应复制未跟踪子目录的内容',
);
assert.equal(
  fs.existsSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/stale-untracked')),
  false,
  'tracked runtime 祖先目录下目标独有的未跟踪路径应被清除',
);
const staleBackupMatch = trackedRuntimeApply.stdout.match(
  /backup existing path: (\.tmp\/local-config-backups\/[^\n]+\/course-content\/runtime\/knowledge\/stale-untracked)/,
);
assert.ok(staleBackupMatch, '清除目标独有的未跟踪路径前应写入本地备份');
assert.equal(
  fs.existsSync(path.join(trackedRuntimeTarget, staleBackupMatch[1], 'file.txt')),
  true,
  '目标独有的未跟踪资源应保留在本地备份中',
);
assert.equal(
  fs.readFileSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/legacy-mixed/tracked.txt'), 'utf8'),
  'target-only tracked resource\n',
  '目标独有目录中的 Git 跟踪文件应保留',
);
assert.equal(
  fs.existsSync(path.join(trackedRuntimeTarget, 'course-content/runtime/knowledge/legacy-mixed/stale.txt')),
  false,
  '目标独有混合目录中的未跟踪陈旧文件应被清除',
);
const mixedStaleBackupMatch = trackedRuntimeApply.stdout.match(
  /backup existing path: (\.tmp\/local-config-backups\/[^\n]+\/course-content\/runtime\/knowledge\/legacy-mixed\/stale\.txt)/,
);
assert.ok(mixedStaleBackupMatch, '混合目录中的陈旧文件清除前应写入本地备份');
assert.equal(
  fs.existsSync(path.join(trackedRuntimeTarget, mixedStaleBackupMatch[1])),
  true,
  '混合目录中的陈旧文件应保留在本地备份中',
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
  assert.equal(fs.readlinkSync(fullPath), path.join(canonicalSource, rel), `${rel} 应指向 source .wolf`);
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
assert.equal(worktreeSource.path, canonicalTarget, 'OpenWolf 来源应记录目标工作树路径');
assert.equal(worktreeSource.sharedWolf, path.join(canonicalSource, '.wolf'), 'OpenWolf 来源应记录共享 .wolf 路径');

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

const freshLinkTarget = createIsolatedWorktree('fresh-link-target');
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
assert.equal(
  fs.lstatSync(path.join(freshLinkTarget, 'AGENTS.md')).isSymbolicLink(),
  true,
  'link-config 应链接 AGENTS.md',
);
assert.equal(
  fs.lstatSync(path.join(freshLinkTarget, '.codex/config.toml')).isSymbolicLink(),
  true,
  'link-config 应链接 .codex/config.toml',
);
assert.equal(
  fs.lstatSync(path.join(freshLinkTarget, '.codex/agents')).isSymbolicLink(),
  true,
  'link-config 应链接 .codex/agents',
);
assert.equal(
  fs.lstatSync(path.join(freshLinkTarget, '.codex/environments')).isSymbolicLink(),
  true,
  'link-config 应链接 .codex/environments',
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

const noOverwriteTarget = createIsolatedWorktree('no-overwrite-target');
mkdirp(path.join(noOverwriteTarget, '.wolf'));
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

const trackedWolfTarget = createIsolatedWorktree('tracked-wolf-target');
mkdirp(path.join(trackedWolfTarget, '.wolf'));
fs.writeFileSync(path.join(trackedWolfTarget, '.wolf/cerebrum.md'), 'tracked cerebrum\n');
run('git', ['-C', trackedWolfTarget, 'add', '-f', '.wolf/cerebrum.md'], root);
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

const peerTarget = createIsolatedWorktree('target-peer');
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
  new RegExp(`codegraph init --index ${canonicalTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  'apply 模式应初始化并索引 codegraph',
);
assert.match(
  graphCalls,
  new RegExp(`code-review-graph register ${canonicalTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} --alias test-alias`),
  'apply 模式应按指定 alias 注册 CRG',
);
assert.match(
  graphCalls,
  new RegExp(`code-review-graph build --repo ${canonicalTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
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
  new RegExp(`cwd=${canonicalTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} args=ci`),
  'install-deps 应在目标工作树执行 npm ci',
);
assert.match(
  depCalls,
  new RegExp(`cwd=${canonicalTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} args=prisma generate`),
  'install-deps 应在目标工作树生成 Prisma Client',
);
assert.match(
  depCalls,
  new RegExp(`cwd=${canonicalTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} args=run wasm:build:control-engine`),
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

const primaryNoOp = run(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    source,
    '--apply',
    '--install-hooks',
  ],
  root,
);

assert.match(
  primaryNoOp.stdout,
  /Primary worktree detected; no synchronization performed:/,
  '主工作树调用同步脚本时应直接无操作退出',
);
assert.doesNotMatch(
  primaryNoOp.stdout,
  /Files:/,
  '主工作树无操作路径不应执行任何同步步骤',
);

const unrelatedTarget = path.join(tmpRoot, 'unrelated-target');
mkdirp(unrelatedTarget);
run('git', ['init'], unrelatedTarget);
const unrelatedResult = spawnSync(
  'bash',
  [
    path.join(root, 'scripts/dev/sync-local-worktree-config.sh'),
    '--source',
    source,
    '--target',
    unrelatedTarget,
  ],
  { cwd: root, encoding: 'utf8' },
);
assert.equal(unrelatedResult.status, 2, '非主仓库派生的目录不应执行同步');
assert.match(
  unrelatedResult.stderr,
  /Target is not a registered isolated worktree of source/,
  '脚本应拒绝非隔离工作树目标',
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
    linkedMain,
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
