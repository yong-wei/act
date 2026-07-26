#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const resourcesRoot = path.resolve(
  process.env.TEXTBOOK_RUNTIME_RESOURCES_ROOT
    ?? 'course-content/runtime/resources',
);
const runtimeRoot = path.join(resourcesRoot, 'textbooks-v2');
const indexRoot = path.join(resourcesRoot, 'textbook-retrieval');
const assetsRoot = path.join(resourcesRoot, 'textbooks');
const cacheRoot = path.resolve(
  process.env.TEXTBOOK_EMBEDDING_CACHE_ROOT
    ?? '.cache/textbook-hybrid-retrieval',
);
const configPath = path.resolve(
  'course-content/config/textbook-hybrid-retrieval.json',
);
const authoringRoot = path.resolve(
  process.env.TEXTBOOK_AUTHORING_ROOT
    ?? 'course-content/authoring/resources',
);
const TEXTBOOK_GENERATOR_INPUTS = [
  'scripts/release/export-textbook-runtime-v2.mjs',
  'scripts/release/validate-textbook-runtime-v2.mjs',
  'scripts/release/textbook-runtime-v2-provenance.mjs',
  'course-content/scripts/export_structured_textbook_runtime_v2.py',
  'course-content/scripts/structured_textbook_runtime.py',
  'course-content/scripts/textbook_hybrid_retrieval.py',
  'course-content/scripts/export_textbook_runtime_assets.py',
  'course-content/config/textbook-hybrid-retrieval.json',
  'course-content/config/textbook-structure-v2',
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`textbook-runtime-v2-command-failed:${command}:${result.status ?? 'signal'}`);
  }
  return result.stdout;
}

function toRepoRelativeInput(inputRoot, repositoryRoot) {
  const canonicalRepositoryRoot = fs.realpathSync(repositoryRoot);
  const canonicalInputRoot = fs.realpathSync(inputRoot);
  const relative = path.relative(canonicalRepositoryRoot, canonicalInputRoot);
  if (
    relative === ''
    || relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    throw new Error(`textbook-runtime-v2-input-outside-repository:${inputRoot}`);
  }
  return relative;
}

export function captureCleanTextbookInputRevision({
  repositoryRoot = repoRoot,
  authoringInputRoot = authoringRoot,
  expectedRevision,
  runGit = (args) => run('git', args),
} = {}) {
  const inputs = [
    ...TEXTBOOK_GENERATOR_INPUTS,
    toRepoRelativeInput(authoringInputRoot, repositoryRoot),
  ];
  const dirty = runGit([
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    ...inputs,
  ]).trim();
  if (dirty) {
    throw new Error(`textbook-runtime-v2-dirty-inputs:${dirty.replaceAll('\n', ';')}`);
  }
  const revision = runGit(['rev-parse', 'HEAD']).trim();
  if (expectedRevision && revision !== expectedRevision) {
    throw new Error(
      `textbook-runtime-v2-input-revision-drift:expected=${expectedRevision}:actual=${revision}`,
    );
  }
  return revision;
}

export function replaceRuntimeDirectories(
  replacements,
  {
    existsSync = fs.existsSync,
    renameSync = fs.renameSync,
    rmSync = fs.rmSync,
  } = {},
) {
  const states = replacements.map(({ staged, target }) => ({
    staged,
    target,
    previous: `${target}.previous-${process.pid}`,
    backedUp: false,
    installed: false,
  }));
  for (const state of states) {
    if (existsSync(state.previous)) {
      throw new Error(`textbook-runtime-v2-previous-exists:${state.previous}`);
    }
  }
  try {
    for (const state of states) {
      if (existsSync(state.target)) {
        renameSync(state.target, state.previous);
        state.backedUp = true;
      }
    }
    for (const state of states) {
      renameSync(state.staged, state.target);
      state.installed = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const state of [...states].reverse()) {
      try {
        if (state.installed && existsSync(state.target)) {
          rmSync(state.target, { recursive: true, force: true });
        }
        if (state.backedUp && existsSync(state.previous)) {
          renameSync(state.previous, state.target);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'textbook-runtime-v2-transaction-rollback-failed',
      );
    }
    throw error;
  }
  for (const state of states) {
    if (state.backedUp) {
      rmSync(state.previous, { recursive: true, force: true });
    }
  }
}

function main() {
  const revision = captureCleanTextbookInputRevision();
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (
    config.locked !== true
    || config.selectedModel !== 'BAAI/bge-m3'
    || config.selectedObservedDimension !== 1024
  ) {
    throw new Error('textbook-retrieval-locked-config-invalid');
  }

  fs.mkdirSync(resourcesRoot, { recursive: true });
  fs.mkdirSync(cacheRoot, { recursive: true });
  const stagingRoot = fs.mkdtempSync(
    path.join(resourcesRoot, '.textbook-runtime-cutover-'),
  );
  const stagedRuntime = path.join(stagingRoot, 'textbooks-v2');
  const stagedIndex = path.join(stagingRoot, 'textbook-retrieval');
  const stagedAssets = path.join(stagingRoot, 'textbooks');

  try {
    run('python3', [
      'course-content/scripts/export_structured_textbook_runtime_v2.py',
      '--all-seven',
      '--authoring-root',
      authoringRoot,
      '--runtime-root',
      stagedRuntime,
    ]);
    run('python3', [
      'course-content/scripts/textbook_hybrid_retrieval.py',
      'build-index',
      '--runtime-root',
      stagedRuntime,
      '--output-dir',
      stagedIndex,
      '--model',
      config.selectedModel,
      '--expected-dimension',
      String(config.selectedObservedDimension),
      '--cache-root',
      cacheRoot,
    ]);
    run('python3', [
      'course-content/scripts/export_textbook_runtime_assets.py',
      '--config-root',
      'course-content/config/textbook-structure-v2',
      '--authoring-root',
      authoringRoot,
      '--output-root',
      stagedAssets,
    ]);
    run(process.execPath, [
      'scripts/release/validate-textbook-runtime-v2.mjs',
      '--runtime-root',
      stagedRuntime,
      '--index-dir',
      stagedIndex,
      '--assets-root',
      stagedAssets,
      '--expected-source-revision',
      revision,
    ]);
    captureCleanTextbookInputRevision({ expectedRevision: revision });

    replaceRuntimeDirectories([
      { staged: stagedRuntime, target: runtimeRoot },
      { staged: stagedIndex, target: indexRoot },
      { staged: stagedAssets, target: assetsRoot },
    ]);
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    process.stdout.write(`${JSON.stringify({
      sourceRevision: revision,
      runtimeRoot,
      indexRoot,
      assetsRoot,
    }, null, 2)}\n`);
  } catch (error) {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
