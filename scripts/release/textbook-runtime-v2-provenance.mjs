#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const TEXTBOOK_V2_BOOK_IDS = [
  'control-encyclopedia',
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-7th',
  'hu-shousong-auto-control-8th',
  'hu-shousong-exercise-analysis-3rd',
  'liu-sheng-auto-control-2015',
];

export const TEXTBOOK_V2_REQUIRED_FILES = [
  'manifest.json',
  'navigation.json',
  'units.jsonl',
  'anchors.jsonl',
  'windows.jsonl',
  'anomalies.jsonl',
  'samples.jsonl',
];

export const TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION =
  'act.textbook-runtime-release-provenance.v1';

const REVISION_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertRevision(value, fieldName) {
  if (typeof value !== 'string' || !REVISION_PATTERN.test(value)) {
    throw new Error(`textbook-v2-${fieldName}-invalid:${String(value)}`);
  }
}

export function inspectTextbookRuntimeV2(runtimeRoot, { expectedSourceRevision } = {}) {
  if (expectedSourceRevision !== undefined) {
    assertRevision(expectedSourceRevision, 'expected-source-revision');
  }
  const actualBookIds = fs.readdirSync(runtimeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expectedBookIds = [...TEXTBOOK_V2_BOOK_IDS].sort();
  if (JSON.stringify(actualBookIds) !== JSON.stringify(expectedBookIds)) {
    throw new Error(
      `textbook-v2-book-set-mismatch: expected=${expectedBookIds.join(',')} actual=${actualBookIds.join(',')}`,
    );
  }

  let sourceRevision = null;
  const runtimeFiles = [];
  for (const bookId of TEXTBOOK_V2_BOOK_IDS) {
    const bookRoot = path.join(runtimeRoot, bookId);
    for (const fileName of TEXTBOOK_V2_REQUIRED_FILES) {
      const filePath = path.join(bookRoot, fileName);
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`textbook-v2-runtime-file-invalid:${bookId}/${fileName}`);
      }
      runtimeFiles.push({
        relativePath: `${bookId}/${fileName}`,
        filePath,
      });
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(bookRoot, 'manifest.json'), 'utf8'));
    assertRevision(manifest.sourceRevision, `source-revision:${bookId}`);
    if (sourceRevision === null) {
      sourceRevision = manifest.sourceRevision;
    } else if (manifest.sourceRevision !== sourceRevision) {
      throw new Error(
        `textbook-v2-source-revision-mismatch:expected=${sourceRevision} actual=${manifest.sourceRevision} book=${bookId}`,
      );
    }
  }
  const digest = createHash('sha256');
  for (const runtimeFile of runtimeFiles.sort((left, right) => (
    left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0
  ))) {
    digest.update(runtimeFile.relativePath);
    digest.update('\0');
    digest.update(sha256File(runtimeFile.filePath));
    digest.update('\n');
  }
  if (sourceRevision !== expectedSourceRevision && expectedSourceRevision !== undefined) {
    throw new Error(
      `textbook-v2-expected-source-revision-mismatch:expected=${expectedSourceRevision} actual=${sourceRevision}`,
    );
  }
  return {
    sourceRevision,
    runtimeDigest: digest.digest('hex'),
    fileCount: TEXTBOOK_V2_BOOK_IDS.length * TEXTBOOK_V2_REQUIRED_FILES.length,
  };
}

function readSidecar(sidecarPath) {
  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  if (sidecar.schemaVersion !== TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION) {
    throw new Error(`textbook-v2-provenance-schema-invalid:${String(sidecar.schemaVersion)}`);
  }
  assertRevision(sidecar.appRevision, 'provenance-app-revision');
  assertRevision(sidecar.runtimeSourceRevision, 'provenance-runtime-source-revision');
  if (sidecar.runtimeSourceRevision !== sidecar.appRevision) {
    throw new Error(
      `textbook-v2-provenance-revision-mismatch:app=${sidecar.appRevision} runtime=${sidecar.runtimeSourceRevision}`,
    );
  }
  if (typeof sidecar.imageTarSha256 !== 'string' || !SHA256_PATTERN.test(sidecar.imageTarSha256)) {
    throw new Error(`textbook-v2-provenance-image-sha256-invalid:${String(sidecar.imageTarSha256)}`);
  }
  if (typeof sidecar.runtimeDigest !== 'string' || !SHA256_PATTERN.test(sidecar.runtimeDigest)) {
    throw new Error(`textbook-v2-provenance-runtime-digest-invalid:${String(sidecar.runtimeDigest)}`);
  }
  return sidecar;
}

function parseArgs(argv) {
  const [command, ...values] = argv;
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (!name.startsWith('--') || index + 1 >= values.length) {
      throw new Error(`invalid argument: ${name}`);
    }
    options[name.slice(2)] = values[++index];
  }
  return { command, options };
}

function requireOption(options, name) {
  const value = options[name];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

function writeSidecar(options) {
  const runtimeRoot = path.resolve(requireOption(options, 'runtime-root'));
  const imageTar = path.resolve(requireOption(options, 'image-tar'));
  const output = path.resolve(requireOption(options, 'output'));
  const appRevision = requireOption(options, 'app-revision');
  assertRevision(appRevision, 'app-revision');
  const runtime = inspectTextbookRuntimeV2(runtimeRoot, {
    expectedSourceRevision: appRevision,
  });
  const sidecar = {
    schemaVersion: TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION,
    appRevision,
    imageTarSha256: sha256File(imageTar),
    runtimeSourceRevision: runtime.sourceRevision,
    runtimeDigest: runtime.runtimeDigest,
  };
  const temporary = `${output}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(sidecar, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporary, output);
  process.stdout.write(`${JSON.stringify(sidecar, null, 2)}\n`);
}

function verifyImage(options) {
  const sidecar = readSidecar(path.resolve(requireOption(options, 'sidecar')));
  const actual = sha256File(path.resolve(requireOption(options, 'image-tar')));
  if (actual !== sidecar.imageTarSha256) {
    throw new Error(
      `textbook-v2-image-tar-sha256-mismatch:expected=${sidecar.imageTarSha256} actual=${actual}`,
    );
  }
  process.stdout.write(`${JSON.stringify({
    appRevision: sidecar.appRevision,
    imageTarSha256: actual,
  })}\n`);
}

function verifyRuntime(options) {
  const sidecar = readSidecar(path.resolve(requireOption(options, 'sidecar')));
  const runtime = inspectTextbookRuntimeV2(
    path.resolve(requireOption(options, 'runtime-root')),
    { expectedSourceRevision: sidecar.runtimeSourceRevision },
  );
  if (runtime.runtimeDigest !== sidecar.runtimeDigest) {
    throw new Error(
      `textbook-v2-runtime-digest-mismatch:expected=${sidecar.runtimeDigest} actual=${runtime.runtimeDigest}`,
    );
  }
  process.stdout.write(`${JSON.stringify({
    runtimeSourceRevision: runtime.sourceRevision,
    runtimeDigest: runtime.runtimeDigest,
  })}\n`);
}

function printField(options) {
  const sidecar = readSidecar(path.resolve(requireOption(options, 'sidecar')));
  const field = requireOption(options, 'field');
  if (!['appRevision', 'imageTarSha256', 'runtimeSourceRevision', 'runtimeDigest'].includes(field)) {
    throw new Error(`unsupported provenance field:${field}`);
  }
  process.stdout.write(`${sidecar[field]}\n`);
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'write-sidecar') return writeSidecar(options);
  if (command === 'verify-image') return verifyImage(options);
  if (command === 'verify-runtime') return verifyRuntime(options);
  if (command === 'print-field') return printField(options);
  throw new Error(`unknown command: ${String(command)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
