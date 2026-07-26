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

export const TEXTBOOK_RETRIEVAL_REQUIRED_FILES = [
  'manifest.json',
  'windows.jsonl',
  'bodies.utf8',
  'vectors.f32',
  'lexical-terms.jsonl',
  'lexical-postings.bin',
  'build-report.json',
];

export const TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION =
  'act.textbook-runtime-release-provenance.v2';
const TEXTBOOK_INPUT_PROVENANCE_FILE = 'input-provenance.json';
const TEXTBOOK_INPUT_PROVENANCE_SCHEMA = 'act.textbook-runtime-input-provenance.v1';

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

function markdownImageHrefs(markdown) {
  const hrefs = [];
  let index = 0;
  while (index < markdown.length) {
    const start = markdown.indexOf('![', index);
    if (start === -1) break;
    let precedingBackslashes = 0;
    for (let cursor = start - 1; cursor >= 0 && markdown[cursor] === '\\'; cursor -= 1) {
      precedingBackslashes += 1;
    }
    if (precedingBackslashes % 2 === 1) {
      index = start + 2;
      continue;
    }
    let cursor = start + 2;
    let bracketDepth = 1;
    while (cursor < markdown.length && bracketDepth > 0) {
      if (markdown[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (markdown[cursor] === '[') bracketDepth += 1;
      if (markdown[cursor] === ']') bracketDepth -= 1;
      cursor += 1;
    }
    if (bracketDepth !== 0 || markdown[cursor] !== '(') {
      index = start + 2;
      continue;
    }
    cursor += 1;
    while (/\s/u.test(markdown[cursor] ?? '')) cursor += 1;
    let href = '';
    if (markdown[cursor] === '<') {
      const hrefStart = ++cursor;
      while (cursor < markdown.length && markdown[cursor] !== '>') cursor += 1;
      if (cursor >= markdown.length) {
        index = start + 2;
        continue;
      }
      href = markdown.slice(hrefStart, cursor);
      cursor += 1;
    } else {
      const hrefStart = cursor;
      let parenthesisDepth = 0;
      while (cursor < markdown.length) {
        const character = markdown[cursor];
        if (character === '\\') {
          cursor += 2;
          continue;
        }
        if (character === '(') {
          parenthesisDepth += 1;
        } else if (character === ')') {
          if (parenthesisDepth === 0) break;
          parenthesisDepth -= 1;
        } else if (/\s/u.test(character) && parenthesisDepth === 0) {
          break;
        }
        cursor += 1;
      }
      href = markdown.slice(hrefStart, cursor);
    }
    const close = markdown.indexOf(')', cursor);
    if (close === -1) {
      index = start + 2;
      continue;
    }
    hrefs.push(href);
    index = close + 1;
  }
  return hrefs;
}

function resolveRuntimeMediaFile({ assetsRoot, bookId, chapterId, href }) {
  const trimmed = href.trim();
  if (
    !trimmed
    || trimmed.startsWith('/')
    || /^[a-z][a-z0-9+.-]*:/iu.test(trimmed)
    || trimmed.includes('\\')
  ) {
    throw new Error(`textbook-v2-media-href-invalid:${bookId}:${chapterId}:${href}`);
  }
  if (
    typeof chapterId !== 'string'
    || !chapterId
    || chapterId.includes('/')
    || chapterId.includes('\\')
    || chapterId === '.'
    || chapterId === '..'
  ) {
    throw new Error(`textbook-v2-media-chapter-invalid:${bookId}:${String(chapterId)}`);
  }
  const relative = path.posix.normalize(trimmed);
  if (relative === '..' || relative.startsWith('../')) {
    throw new Error(`textbook-v2-media-href-escape:${bookId}:${chapterId}:${href}`);
  }
  const assetRelative = relative.startsWith('assets/')
    ? relative.slice('assets/'.length)
    : relative;
  if (!assetRelative || assetRelative === '..' || assetRelative.startsWith('../')) {
    throw new Error(`textbook-v2-media-href-invalid:${bookId}:${chapterId}:${href}`);
  }
  const relativePath = path.posix.join(bookId, 'assets', chapterId, assetRelative);
  const filePath = path.resolve(assetsRoot, ...relativePath.split('/'));
  const expectedRoot = path.resolve(assetsRoot, bookId, 'assets', chapterId);
  if (!filePath.startsWith(`${expectedRoot}${path.sep}`)) {
    throw new Error(`textbook-v2-media-href-escape:${bookId}:${chapterId}:${href}`);
  }
  return { relativePath, filePath };
}

export function inspectTextbookRuntimeV2(
  runtimeRoot,
  { expectedSourceRevision, assetsRoot = path.join(path.dirname(runtimeRoot), 'textbooks') } = {},
) {
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
  const mediaFiles = new Map();
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
    if (
      manifest.recordType !== 'export-manifest'
      || manifest.schemaVersion !== 'structured-textbook-runtime.v2'
    ) {
      throw new Error(`textbook-v2-manifest-schema-invalid:${bookId}`);
    }
    assertRevision(manifest.sourceRevision, `source-revision:${bookId}`);
    if (sourceRevision === null) {
      sourceRevision = manifest.sourceRevision;
    } else if (manifest.sourceRevision !== sourceRevision) {
      throw new Error(
        `textbook-v2-source-revision-mismatch:expected=${sourceRevision} actual=${manifest.sourceRevision} book=${bookId}`,
      );
    }
    for (const line of fs.readFileSync(path.join(bookRoot, 'units.jsonl'), 'utf8').split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const unit = JSON.parse(line);
      if (typeof unit.markdown !== 'string') continue;
      for (const href of markdownImageHrefs(unit.markdown)) {
        const mediaFile = resolveRuntimeMediaFile({
          assetsRoot,
          bookId,
          chapterId: unit.chapterId,
          href,
        });
        mediaFiles.set(mediaFile.relativePath, mediaFile);
      }
    }
  }
  let assetsRootRealPath = null;
  for (const mediaFile of mediaFiles.values()) {
    let stat;
    try {
      stat = fs.lstatSync(mediaFile.filePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        throw new Error(`textbook-v2-media-file-missing:${mediaFile.relativePath}`);
      }
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`textbook-v2-media-file-invalid:${mediaFile.relativePath}`);
    }
    assetsRootRealPath ??= fs.realpathSync(assetsRoot);
    const mediaRealPath = fs.realpathSync(mediaFile.filePath);
    const relativeRealPath = path.relative(assetsRootRealPath, mediaRealPath);
    if (
      relativeRealPath === '..'
      || relativeRealPath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativeRealPath)
    ) {
      throw new Error(`textbook-v2-media-file-escape:${mediaFile.relativePath}`);
    }
    runtimeFiles.push(mediaFile);
  }
  const inputProvenancePath = path.join(runtimeRoot, TEXTBOOK_INPUT_PROVENANCE_FILE);
  if (!fs.existsSync(inputProvenancePath)) {
    throw new Error('textbook-v2-input-provenance-missing');
  }
  const inputProvenance = JSON.parse(fs.readFileSync(inputProvenancePath, 'utf8'));
  if (
    inputProvenance.schemaVersion !== TEXTBOOK_INPUT_PROVENANCE_SCHEMA
    || inputProvenance.sourceRevision !== sourceRevision
    || typeof inputProvenance.inputDigest !== 'string'
    || !SHA256_PATTERN.test(inputProvenance.inputDigest)
    || !Number.isSafeInteger(inputProvenance.inputFileCount)
    || inputProvenance.inputFileCount < 1
  ) {
    throw new Error('textbook-v2-input-provenance-invalid');
  }
  const inputDigest = inputProvenance.inputDigest;
  runtimeFiles.push({
    relativePath: TEXTBOOK_INPUT_PROVENANCE_FILE,
    filePath: inputProvenancePath,
  });
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
    inputDigest,
    fileCount: TEXTBOOK_V2_BOOK_IDS.length * TEXTBOOK_V2_REQUIRED_FILES.length
      + (inputDigest ? 1 : 0),
    mediaFileCount: mediaFiles.size,
  };
}

export function inspectTextbookRetrievalIndex(
  indexRoot,
  { expectedSourceRevision } = {},
) {
  if (expectedSourceRevision !== undefined) {
    assertRevision(expectedSourceRevision, 'expected-index-source-revision');
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(indexRoot, 'manifest.json'), 'utf8'),
  );
  if (
    manifest.recordType !== 'index-manifest'
    || manifest.formatVersion !== 'textbook-hybrid-retrieval.v1'
  ) {
    throw new Error('textbook-retrieval-manifest-schema-invalid');
  }
  assertRevision(manifest.sourceRevision, 'index-source-revision');
  if (
    expectedSourceRevision !== undefined
    && manifest.sourceRevision !== expectedSourceRevision
  ) {
    throw new Error(
      `textbook-retrieval-expected-source-revision-mismatch:expected=${expectedSourceRevision} actual=${manifest.sourceRevision}`,
    );
  }
  const digest = createHash('sha256');
  for (const fileName of TEXTBOOK_RETRIEVAL_REQUIRED_FILES) {
    const filePath = path.join(indexRoot, fileName);
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`textbook-retrieval-file-invalid:${fileName}`);
    }
    digest.update(fileName);
    digest.update('\0');
    digest.update(sha256File(filePath));
    digest.update('\n');
  }
  return {
    sourceRevision: manifest.sourceRevision,
    indexDigest: digest.digest('hex'),
    fileCount: TEXTBOOK_RETRIEVAL_REQUIRED_FILES.length,
  };
}

function readSidecar(sidecarPath) {
  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  if (sidecar.schemaVersion !== TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION) {
    throw new Error(`textbook-v2-provenance-schema-invalid:${String(sidecar.schemaVersion)}`);
  }
  assertRevision(sidecar.appRevision, 'provenance-app-revision');
  assertRevision(sidecar.runtimeSourceRevision, 'provenance-runtime-source-revision');
  assertRevision(sidecar.indexSourceRevision, 'provenance-index-source-revision');
  if (sidecar.runtimeSourceRevision !== sidecar.appRevision) {
    throw new Error(
      `textbook-v2-provenance-revision-mismatch:app=${sidecar.appRevision} runtime=${sidecar.runtimeSourceRevision}`,
    );
  }
  if (sidecar.indexSourceRevision !== sidecar.appRevision) {
    throw new Error(
      `textbook-v2-provenance-index-revision-mismatch:app=${sidecar.appRevision} index=${sidecar.indexSourceRevision}`,
    );
  }
  if (typeof sidecar.imageTarSha256 !== 'string' || !SHA256_PATTERN.test(sidecar.imageTarSha256)) {
    throw new Error(`textbook-v2-provenance-image-sha256-invalid:${String(sidecar.imageTarSha256)}`);
  }
  if (typeof sidecar.runtimeDigest !== 'string' || !SHA256_PATTERN.test(sidecar.runtimeDigest)) {
    throw new Error(`textbook-v2-provenance-runtime-digest-invalid:${String(sidecar.runtimeDigest)}`);
  }
  if (typeof sidecar.indexDigest !== 'string' || !SHA256_PATTERN.test(sidecar.indexDigest)) {
    throw new Error(`textbook-v2-provenance-index-digest-invalid:${String(sidecar.indexDigest)}`);
  }
  if (
    typeof sidecar.runtimeInputDigest !== 'string'
    || !SHA256_PATTERN.test(sidecar.runtimeInputDigest)
  ) {
    throw new Error(
      `textbook-v2-provenance-input-digest-invalid:${String(sidecar.runtimeInputDigest)}`,
    );
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
  const indexRoot = path.resolve(requireOption(options, 'index-dir'));
  const imageTar = path.resolve(requireOption(options, 'image-tar'));
  const output = path.resolve(requireOption(options, 'output'));
  const appRevision = requireOption(options, 'app-revision');
  assertRevision(appRevision, 'app-revision');
  const runtime = inspectTextbookRuntimeV2(runtimeRoot, {
    expectedSourceRevision: appRevision,
    assetsRoot: options['assets-root']
      ? path.resolve(options['assets-root'])
      : undefined,
  });
  const index = inspectTextbookRetrievalIndex(indexRoot, {
    expectedSourceRevision: appRevision,
  });
  const sidecar = {
    schemaVersion: TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION,
    appRevision,
    imageTarSha256: sha256File(imageTar),
    runtimeSourceRevision: runtime.sourceRevision,
    runtimeDigest: runtime.runtimeDigest,
    runtimeInputDigest: runtime.inputDigest,
    indexSourceRevision: index.sourceRevision,
    indexDigest: index.indexDigest,
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
    {
      expectedSourceRevision: sidecar.runtimeSourceRevision,
      assetsRoot: options['assets-root']
        ? path.resolve(options['assets-root'])
        : undefined,
    },
  );
  const index = inspectTextbookRetrievalIndex(
    path.resolve(requireOption(options, 'index-dir')),
    { expectedSourceRevision: sidecar.indexSourceRevision },
  );
  if (runtime.runtimeDigest !== sidecar.runtimeDigest) {
    throw new Error(
      `textbook-v2-runtime-digest-mismatch:expected=${sidecar.runtimeDigest} actual=${runtime.runtimeDigest}`,
    );
  }
  if (runtime.inputDigest !== sidecar.runtimeInputDigest) {
    throw new Error(
      `textbook-v2-input-digest-mismatch:expected=${sidecar.runtimeInputDigest}`
      + ` actual=${String(runtime.inputDigest)}`,
    );
  }
  if (index.indexDigest !== sidecar.indexDigest) {
    throw new Error(
      `textbook-v2-index-digest-mismatch:expected=${sidecar.indexDigest} actual=${index.indexDigest}`,
    );
  }
  process.stdout.write(`${JSON.stringify({
    runtimeSourceRevision: runtime.sourceRevision,
    runtimeDigest: runtime.runtimeDigest,
    mediaFileCount: runtime.mediaFileCount,
    indexSourceRevision: index.sourceRevision,
    indexDigest: index.indexDigest,
  })}\n`);
}

function printField(options) {
  const sidecar = readSidecar(path.resolve(requireOption(options, 'sidecar')));
  const field = requireOption(options, 'field');
  if (![
    'appRevision',
    'imageTarSha256',
    'runtimeSourceRevision',
    'runtimeDigest',
    'indexSourceRevision',
    'indexDigest',
  ].includes(field)) {
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
