import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TASK_ROOT = 'docs/grill';
const MANIFEST_FILE_NAME = 'manifest.json';
const TASK_ID_PATTERN = /^(issue-[1-9]\d*-[a-z0-9]+(?:-[a-z0-9]+)*|local-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const GOVERNED_PATH_PREFIXES = [
  '.agents/',
  '.github/',
  'prisma/',
  'rust/',
  'scripts/',
  'src/',
];
const GOVERNED_EXACT_PATHS = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
]);

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function runGit(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function splitGitPaths(output) {
  return output ? output.split(/\r?\n/).map(normalizePath).filter(Boolean) : [];
}

function isTaskManifestPath(relativePath) {
  return /^docs\/grill\/[^/]+\/manifest\.json$/.test(relativePath);
}

function isGovernedPath(relativePath) {
  return GOVERNED_EXACT_PATHS.has(relativePath)
    || GOVERNED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function scopeMatches(scope, relativePath) {
  return scope.endsWith('/')
    ? relativePath.startsWith(scope)
    : relativePath === scope;
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function createSnapshot(repoRoot, mode) {
  if (mode === 'index') {
    return {
      listManifestPaths() {
        return splitGitPaths(runGit(repoRoot, ['ls-files', '--', TASK_ROOT]))
          .filter(isTaskManifestPath);
      },
      readFile(relativePath) {
        try {
          return runGit(repoRoot, ['show', `:${relativePath}`]);
        } catch {
          return null;
        }
      },
    };
  }

  return {
    listManifestPaths() {
      const taskRoot = path.join(repoRoot, TASK_ROOT);
      if (!existsSync(taskRoot)) {
        return [];
      }
      return readdirSync(taskRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${TASK_ROOT}/${entry.name}/${MANIFEST_FILE_NAME}`)
        .filter((relativePath) => existsSync(path.join(repoRoot, relativePath)));
    },
    readFile(relativePath) {
      const targetPath = path.join(repoRoot, relativePath);
      return existsSync(targetPath) && statSync(targetPath).isFile()
        ? readFileSync(targetPath, 'utf8')
        : null;
    },
  };
}

function validateManifest(manifestPath, snapshot) {
  const errors = [];
  const manifestSource = snapshot.readFile(manifestPath);
  if (manifestSource === null) {
    return { errors: [`${manifestPath}: 清单不在当前快照中`], manifestPath };
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestSource);
  } catch (error) {
    return { errors: [`${manifestPath}: 不是有效 JSON（${error.message}）`], manifestPath };
  }
  if (!isObject(manifest)) {
    return { errors: [`${manifestPath}: 清单根节点必须是对象`], manifestPath };
  }

  const taskDirectory = path.posix.dirname(manifestPath).split('/').at(-1);
  if (manifest.schemaVersion !== 1) {
    errors.push(`${manifestPath}: schemaVersion 必须为 1`);
  }
  if (typeof manifest.taskId !== 'string' || !TASK_ID_PATTERN.test(manifest.taskId)) {
    errors.push(`${manifestPath}: taskId 必须是 issue-<number>-<slug> 或 local-<YYYYMMDD>-<slug>`);
  } else if (manifest.taskId !== taskDirectory) {
    errors.push(`${manifestPath}: taskId 必须与目录名 ${taskDirectory} 一致`);
  }

  if (!isObject(manifest.source)) {
    errors.push(`${manifestPath}: source 必须是对象`);
  } else if (manifest.source.kind === 'github-issue') {
    if (!Number.isInteger(manifest.source.number) || manifest.source.number <= 0) {
      errors.push(`${manifestPath}: GitHub Issue 来源必须提供正整数 number`);
    }
  } else if (manifest.source.kind !== 'local') {
    errors.push(`${manifestPath}: source.kind 必须为 github-issue 或 local`);
  }

  const taskDirectoryPath = path.posix.dirname(manifestPath);
  if (!isObject(manifest.grill)) {
    errors.push(`${manifestPath}: grill 必须是对象`);
  } else {
    if (manifest.grill.context !== 'CONTEXT.md') {
      errors.push(`${manifestPath}: grill.context 必须为 CONTEXT.md`);
    } else if (snapshot.readFile(`${taskDirectoryPath}/${manifest.grill.context}`) === null) {
      errors.push(`${manifestPath}: 缺少 Grill 上下文 ${manifest.grill.context}`);
    }
    if (!Array.isArray(manifest.grill.adrs) || manifest.grill.adrs.some((adr) => typeof adr !== 'string' || !adr.endsWith('.md'))) {
      errors.push(`${manifestPath}: grill.adrs 必须是 Markdown ADR 路径数组`);
    } else {
      for (const adrPath of manifest.grill.adrs) {
        if (snapshot.readFile(`${taskDirectoryPath}/${adrPath}`) === null) {
          errors.push(`${manifestPath}: 缺少 Grill ADR ${adrPath}`);
        }
      }
    }
  }

  if (!isObject(manifest.planning) || !hasOnlyKeys(manifest.planning, new Set(['kind', 'change', 'path']))) {
    errors.push(`${manifestPath}: planning 必须是有效规划对象`);
  } else if (manifest.planning.kind === 'openspec') {
    if (typeof manifest.planning.change !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.planning.change) || 'path' in manifest.planning) {
      errors.push(`${manifestPath}: OpenSpec 规划必须只提供合法的 change`);
    } else if (snapshot.readFile(`openspec/changes/${manifest.planning.change}/tasks.md`) === null) {
      errors.push(`${manifestPath}: OpenSpec change 缺少 tasks.md`);
    }
  } else if (manifest.planning.kind === 'plan') {
    if (manifest.planning.path !== 'plan.md' || 'change' in manifest.planning) {
      errors.push(`${manifestPath}: 本地规划必须只提供 path: plan.md`);
    } else if (snapshot.readFile(`${taskDirectoryPath}/plan.md`) === null) {
      errors.push(`${manifestPath}: 缺少本地计划 plan.md`);
    }
  } else {
    errors.push(`${manifestPath}: planning.kind 必须为 openspec 或 plan`);
  }

  if (!Array.isArray(manifest.implementationScope) || manifest.implementationScope.length === 0) {
    errors.push(`${manifestPath}: implementationScope 必须是非空数组`);
  } else {
    for (const scope of manifest.implementationScope) {
      if (typeof scope !== 'string' || !scope || scope.startsWith('/') || scope.includes('..') || scope.includes('*') || normalizePath(scope) !== scope) {
        errors.push(`${manifestPath}: implementationScope 包含非法路径 ${JSON.stringify(scope)}`);
      }
    }
  }

  return {
    errors,
    manifestPath,
    scopes: Array.isArray(manifest.implementationScope) ? manifest.implementationScope : [],
    taskId: typeof manifest.taskId === 'string' ? manifest.taskId : manifestPath,
  };
}

export function validateTaskDecisionDelivery({ repoRoot, changedFiles, snapshotMode = 'worktree' }) {
  const snapshot = createSnapshot(repoRoot, snapshotMode);
  const manifestResults = snapshot.listManifestPaths()
    .sort()
    .map((manifestPath) => validateManifest(manifestPath, snapshot));
  const errors = [];
  const changedManifestPaths = new Set(changedFiles.filter(isTaskManifestPath));

  for (const result of manifestResults) {
    if (changedManifestPaths.has(result.manifestPath)) {
      errors.push(...result.errors);
    }
  }

  for (const changedFile of changedFiles.filter(isGovernedPath)) {
    const matches = manifestResults.filter((result) => result.errors.length === 0
      && result.scopes.some((scope) => scopeMatches(scope, changedFile)));
    if (matches.length === 0) {
      errors.push(`${changedFile}: 未被有效任务清单的 implementationScope 覆盖`);
    } else if (matches.length > 1) {
      errors.push(`${changedFile}: 被多个任务清单覆盖（${matches.map((match) => match.taskId).join(', ')}）`);
    }
  }

  return errors.sort();
}

export function changedFilesForMode(repoRoot, mode, baseRef) {
  if (mode === 'staged') {
    return splitGitPaths(runGit(repoRoot, ['diff', '--cached', '--name-only']));
  }
  const mergeBase = runGit(repoRoot, ['merge-base', baseRef, 'HEAD']);
  return splitGitPaths(runGit(repoRoot, ['diff', '--name-only', `${mergeBase}..HEAD`]));
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === '--staged') {
    return { mode: 'staged' };
  }
  if (args.length === 2 && args[0] === '--base' && args[1]) {
    return { baseRef: args[1], mode: 'base' };
  }
  throw new Error('用法：node scripts/governance/verify-task-decision-delivery.mjs --staged | --base <ref>');
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const repoRoot = process.cwd();
  const changedFiles = changedFilesForMode(repoRoot, options.mode, options.baseRef);
  const errors = validateTaskDecisionDelivery({
    changedFiles,
    repoRoot,
    snapshotMode: options.mode === 'staged' ? 'index' : 'worktree',
  });
  if (errors.length > 0) {
    console.error('任务决策交付校验失败：');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`任务决策交付校验通过（${changedFiles.length} 个变更文件）。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
