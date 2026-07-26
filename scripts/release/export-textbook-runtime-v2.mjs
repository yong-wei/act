#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  'course-content/scripts/validate_structured_textbook_runtime_v2.mjs',
  'course-content/scripts/validate_written_textbook_runtime_v2.py',
  'course-content/scripts/textbook_hybrid_retrieval.py',
  'course-content/scripts/validate_textbook_hybrid_retrieval.mjs',
  'course-content/scripts/export_textbook_runtime_assets.py',
  'course-content/contracts/structured-textbook-runtime-v2.schema.json',
  'course-content/config/textbook-hybrid-retrieval.json',
  'course-content/config/textbook-structure-v2',
];
const INPUT_PROVENANCE_FILE = 'input-provenance.json';
const INPUT_PROVENANCE_SCHEMA = 'act.textbook-runtime-input-provenance.v1';

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

function textbookInputPaths(repositoryRoot, authoringInputRoot) {
  return [
    ...TEXTBOOK_GENERATOR_INPUTS,
    toRepoRelativeInput(authoringInputRoot, repositoryRoot),
  ];
}

function collectInputFiles(inputPath, files) {
  const stat = fs.lstatSync(inputPath);
  if (stat.isSymbolicLink()) {
    throw new Error(`textbook-runtime-v2-input-symlink:${inputPath}`);
  }
  if (stat.isFile()) {
    files.push(inputPath);
    return;
  }
  if (!stat.isDirectory()) {
    throw new Error(`textbook-runtime-v2-input-invalid:${inputPath}`);
  }
  for (const entry of fs.readdirSync(inputPath).sort()) {
    collectInputFiles(path.join(inputPath, entry), files);
  }
}

export function captureTextbookInputSnapshot({
  repositoryRoot = repoRoot,
  authoringInputRoot = authoringRoot,
} = {}) {
  const files = [];
  for (const relativeInput of textbookInputPaths(repositoryRoot, authoringInputRoot)) {
    collectInputFiles(path.resolve(repositoryRoot, relativeInput), files);
  }
  const digest = createHash('sha256');
  for (const filePath of files.sort()) {
    const relativePath = path.relative(repositoryRoot, filePath).split(path.sep).join('/');
    digest.update(relativePath);
    digest.update('\0');
    digest.update(createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'));
    digest.update('\n');
  }
  return {
    digest: digest.digest('hex'),
    fileCount: files.length,
  };
}

export function captureCleanTextbookInputRevision({
  repositoryRoot = repoRoot,
  authoringInputRoot = authoringRoot,
  expectedRevision,
  runGit = (args) => run('git', args),
} = {}) {
  const inputs = textbookInputPaths(repositoryRoot, authoringInputRoot);
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
  const inputSnapshot = captureTextbookInputSnapshot();
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
    fs.writeFileSync(
      path.join(stagedRuntime, INPUT_PROVENANCE_FILE),
      `${JSON.stringify({
        schemaVersion: INPUT_PROVENANCE_SCHEMA,
        sourceRevision: revision,
        inputDigest: inputSnapshot.digest,
        inputFileCount: inputSnapshot.fileCount,
      }, null, 2)}\n`,
      { flag: 'wx' },
    );
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
    const finalInputSnapshot = captureTextbookInputSnapshot();
    if (
      finalInputSnapshot.digest !== inputSnapshot.digest
      || finalInputSnapshot.fileCount !== inputSnapshot.fileCount
    ) {
      throw new Error(
        `textbook-runtime-v2-input-content-drift:expected=${inputSnapshot.digest}:${inputSnapshot.fileCount}`
        + `:actual=${finalInputSnapshot.digest}:${finalInputSnapshot.fileCount}`,
      );
    }

    replaceRuntimeDirectories([
      { staged: stagedRuntime, target: runtimeRoot },
      { staged: stagedIndex, target: indexRoot },
      { staged: stagedAssets, target: assetsRoot },
    ]);
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    process.stdout.write(`${JSON.stringify({
      sourceRevision: revision,
      inputDigest: inputSnapshot.digest,
      inputFileCount: inputSnapshot.fileCount,
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
