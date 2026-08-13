#!/usr/bin/env node

/**
 * Build the source-only operator bundle used by the production cutover driver.
 *
 * The immutable application image supplies Node and its node_modules. Keep the
 * bundle layout identical to the repository layout so relative imports resolve
 * inside the isolated bundle root, while sourcing every byte from the explicit
 * Git tree rather than the caller's worktree.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const CONTRACT = 'act-knowledge-cutover-operator-bundle/v2';
const BUILDER_VERSION = '2026-08-13.git-tree-v2';
const COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function fail(message) {
  throw new Error(`operator bundle: ${message}`);
}

function option(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value || value.startsWith('--')) fail(`${name} is required`);
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  fail('unsupported manifest value');
}

function relative(value) {
  const normalized = value.split(path.sep).join('/');
  const segments = normalized.split('/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\\') || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(`unsafe relative path: ${value}`);
  }
  return normalized;
}

function git(repoRoot, args, options = {}) {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      ...options,
      encoding: options.encoding ?? 'utf8',
      maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    });
  } catch (error) {
    fail(`git ${args.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function gitTreeFiles(repoRoot, revision, sourcePaths) {
  const listing = git(repoRoot, ['ls-tree', '-r', '-z', '--full-tree', revision, '--', ...sourcePaths], { encoding: 'buffer' });
  const files = [];
  for (const record of listing.toString('utf8').split('\0').filter(Boolean)) {
    const separator = record.indexOf('\t');
    if (separator < 0) fail('git tree entry is malformed');
    const metadata = record.slice(0, separator).split(' ');
    const sourceRelative = record.slice(separator + 1);
    if (metadata[0] !== '100644' && metadata[0] !== '100755') {
      fail(`operator bundle Git tree contains a non-regular entry: ${sourceRelative}`);
    }
    files.push(sourceRelative);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function copyGitTree(repoRoot, bundleRoot, revision, sourcePaths, files) {
  const sourceFiles = gitTreeFiles(repoRoot, revision, sourcePaths);
  const archive = git(repoRoot, ['archive', '--format=tar', revision, '--', ...sourcePaths], {
    encoding: 'buffer',
    maxBuffer: 1024 * 1024 * 1024,
  });
  execFileSync('tar', ['-xf', '-', '-C', bundleRoot], {
    input: archive,
    maxBuffer: 64 * 1024 * 1024,
  });
  for (const sourceRelative of sourceFiles) {
    const target = path.join(bundleRoot, sourceRelative);
    const bytes = readFileSync(target);
    files.push({
      path: relative(sourceRelative),
      sha256: sha256(bytes),
      size: bytes.length,
    });
  }
}

function main() {
  const repoRoot = path.resolve(option('--repo-root'));
  const output = path.resolve(option('--output'));
  const manifestPath = path.resolve(option('--manifest'));
  const operatorSourceRevision = option('--operator-source-revision');
  const captureRevision = option('--capture-revision');
  if (!COMMIT.test(operatorSourceRevision)) fail('operator source revision must be one lowercase Git commit');
  if (!COMMIT.test(captureRevision)) fail('capture revision must be one lowercase Git commit');
  if (output === repoRoot || manifestPath === repoRoot) fail('output must not replace repository root');

  const resolvedRevision = git(repoRoot, ['rev-parse', '--verify', `${operatorSourceRevision}^{commit}`]).trim();
  if (resolvedRevision !== operatorSourceRevision) fail('operator source revision must resolve to the exact requested commit');
  const operatorSourceTree = git(repoRoot, ['rev-parse', '--verify', `${operatorSourceRevision}^{tree}`]).trim();
  if (!COMMIT.test(operatorSourceTree)) fail('operator source tree is invalid');
  const sourcePaths = ['src', 'scripts/knowledge-cutover/production-cutover.ts', 'tsconfig.json'];

  const bundleRoot = output;
  if (existsSync(bundleRoot)) rmSync(bundleRoot, { recursive: true, force: true });
  mkdirSync(bundleRoot, { recursive: true });
  const files = [];
  for (const sourceRelative of sourcePaths) {
    if (!gitTreeFiles(repoRoot, operatorSourceRevision, [sourceRelative]).length) fail(`source is missing from Git tree: ${sourceRelative}`);
  }
  copyGitTree(repoRoot, bundleRoot, operatorSourceRevision, sourcePaths, files);
  files.sort((left, right) => left.path.localeCompare(right.path));
  if (!files.some((file) => file.path === 'scripts/knowledge-cutover/production-cutover.ts')) {
    fail('production-cutover.ts is missing from bundle');
  }
  const digestBody = {
    contract: CONTRACT,
    builderVersion: BUILDER_VERSION,
    operatorSourceRevision,
    operatorSourceTree,
    captureRevision,
    files,
  };
  const manifest = {
    ...digestBody,
    bundleSha256: sha256(canonicalJson(digestBody)),
  };
  if (!SHA256.test(manifest.bundleSha256)) fail('bundle digest generation failed');
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    contract: CONTRACT,
    operatorSourceRevision,
    operatorSourceTree,
    captureRevision,
    bundleRoot,
    manifestPath,
    bundleSha256: manifest.bundleSha256,
    fileCount: files.length,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
