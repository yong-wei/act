#!/usr/bin/env node

/**
 * Build the source-only operator bundle used by the v0.4.0 cutover driver.
 *
 * The fixed application image supplies Node and its node_modules, but it does
 * not contain the shard/first-activation source introduced after that image
 * was built.  Keep the bundle layout identical to the repository layout so
 * relative imports resolve inside the isolated bundle root.
 */

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const CONTRACT = 'act-knowledge-cutover-operator-bundle/v1';
const BUILDER_VERSION = '2026-08-13.full-src-v1';
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

function copyTree(sourceRoot, bundleRoot, sourceRelative, files) {
  const source = path.join(sourceRoot, sourceRelative);
  const target = path.join(bundleRoot, sourceRelative);
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) fail(`symlink is forbidden: ${sourceRelative}`);
  if (stat.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      copyTree(sourceRoot, bundleRoot, path.join(sourceRelative, entry.name), files);
    }
    return;
  }
  if (!stat.isFile()) fail(`unsupported source entry: ${sourceRelative}`);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  const bytes = requireBuffer(target);
  files.push({
    path: relative(sourceRelative),
    sha256: sha256(bytes),
    size: stat.size,
  });
}

function requireBuffer(filePath) {
  // Keep the only fs read in this helper local so the manifest always hashes
  // the copied bytes rather than trusting source metadata.
  return readFileSync(filePath);
}

function main() {
  const repoRoot = path.resolve(option('--repo-root'));
  const output = path.resolve(option('--output'));
  const manifestPath = path.resolve(option('--manifest'));
  const captureRevision = option('--capture-revision');
  if (!COMMIT.test(captureRevision)) fail('capture revision must be one lowercase Git commit');
  if (output === repoRoot || manifestPath === repoRoot) fail('output must not replace repository root');

  const bundleRoot = output;
  if (existsSync(bundleRoot)) rmSync(bundleRoot, { recursive: true, force: true });
  mkdirSync(bundleRoot, { recursive: true });
  const files = [];
  for (const sourceRelative of ['src', 'scripts/knowledge-cutover/production-cutover.ts', 'tsconfig.json']) {
    const source = path.join(repoRoot, sourceRelative);
    if (!existsSync(source)) fail(`source is missing: ${sourceRelative}`);
    copyTree(repoRoot, bundleRoot, sourceRelative, files);
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  if (!files.some((file) => file.path === 'scripts/knowledge-cutover/production-cutover.ts')) {
    fail('production-cutover.ts is missing from bundle');
  }
  const digestBody = { contract: CONTRACT, builderVersion: BUILDER_VERSION, captureRevision, files };
  const manifest = {
    ...digestBody,
    bundleSha256: sha256(canonicalJson(digestBody)),
  };
  if (!SHA256.test(manifest.bundleSha256)) fail('bundle digest generation failed');
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    contract: CONTRACT,
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
