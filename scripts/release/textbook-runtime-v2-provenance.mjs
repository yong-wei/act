#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  BOOK_ID_PATTERN,
  loadTextbookResourceSet,
  textbookBookCount,
  textbookBookIds,
} from './textbook-resource-set.mjs';
import {
  TEXTBOOK_INPUT_PROVENANCE_FILE,
  TEXTBOOK_INPUT_PROVENANCE_V1,
  TEXTBOOK_INPUT_PROVENANCE_V2,
  isTextbookInputProvenanceV2,
  parseTextbookInputProvenance,
  textbookAuthoringRevision,
  textbookProvenanceBookIds,
  textbookProvenanceGeneration,
} from './textbook-runtime-input-provenance.mjs';

export { loadTextbookResourceSet, textbookBookCount, textbookBookIds };

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
export {
  TEXTBOOK_INPUT_PROVENANCE_FILE,
  TEXTBOOK_INPUT_PROVENANCE_V1,
  TEXTBOOK_INPUT_PROVENANCE_V2,
};

const REVISION_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function sha256FileStream(filePath) {
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
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

function listRuntimeBookIds(runtimeRoot) {
  return fs.readdirSync(runtimeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BOOK_ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function sortedBookIds(bookIds) {
  return [...bookIds].sort();
}

function assertExactBookSet(expectedBookIds, actualBookIds, context) {
  const expected = sortedBookIds(expectedBookIds);
  const actual = sortedBookIds(actualBookIds);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `${context}: expected=${expected.join(',')} actual=${actual.join(',')}`,
    );
  }
}

export function inspectTextbookRuntimeV2(
  runtimeRoot,
  { expectedSourceRevision, assetsRoot = path.join(path.dirname(runtimeRoot), 'textbooks') } = {},
) {
  if (expectedSourceRevision !== undefined) {
    assertRevision(expectedSourceRevision, 'expected-source-revision');
  }
  const actualBookIds = listRuntimeBookIds(runtimeRoot);
  if (actualBookIds.length === 0) {
    throw new Error('textbook-v2-book-set-mismatch: expected= actual=');
  }

  let sourceRevision = null;
  const runtimeFiles = [];
  const mediaFiles = new Map();
  for (const bookId of actualBookIds) {
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
  let parsedProvenance;
  try {
    parsedProvenance = parseTextbookInputProvenance(
      JSON.parse(fs.readFileSync(inputProvenancePath, 'utf8')),
    );
  } catch (cause) {
    throw new Error(
      cause instanceof Error && cause.message.startsWith('textbook-v2-')
        ? cause.message
        : 'textbook-v2-input-provenance-invalid',
    );
  }
  const authoringRevision = textbookAuthoringRevision(parsedProvenance);
  if (authoringRevision !== sourceRevision) {
    throw new Error(
      `textbook-v2-input-provenance-revision-mismatch:expected=${sourceRevision} actual=${authoringRevision}`,
    );
  }
  const provenanceBookIds = textbookProvenanceBookIds(parsedProvenance);
  if (provenanceBookIds) {
    assertExactBookSet(provenanceBookIds, actualBookIds, 'textbook-v2-book-set-mismatch');
  }
  const inputDigest = parsedProvenance.inputDigest;
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
    authoringSourceRevision: authoringRevision,
    provenance: parsedProvenance,
    provenanceGeneration: textbookProvenanceGeneration(parsedProvenance),
    bookIds: provenanceBookIds ?? actualBookIds,
    resourceSetId: isTextbookInputProvenanceV2(parsedProvenance) ? parsedProvenance.resourceSetId : null,
    runtimeDigest: digest.digest('hex'),
    inputDigest,
    inputFileCount: parsedProvenance.inputFileCount,
    fileCount: actualBookIds.length * TEXTBOOK_V2_REQUIRED_FILES.length + 1,
    mediaFileCount: mediaFiles.size,
  };
}

function indexBookIds(manifest) {
  if (!Array.isArray(manifest.books)) return [];
  return manifest.books.map((book, index) => {
    const bookId = book && typeof book === 'object' ? book.bookId : book;
    if (typeof bookId !== 'string' || !BOOK_ID_PATTERN.test(bookId)) {
      throw new Error(`textbook-retrieval-book-id-invalid:${index}:${String(bookId)}`);
    }
    return bookId;
  });
}

export function inspectTextbookRetrievalIndex(
  indexRoot,
  {
    expectedSourceRevision,
    expectedResourceSetId,
    expectedBookIds,
  } = {},
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
  if (typeof manifest.resourceSetId !== 'string' || !manifest.resourceSetId) {
    throw new Error(`textbook-retrieval-resource-set-mismatch:expected= actual=${String(manifest.resourceSetId)}`);
  }
  if (expectedResourceSetId !== undefined && manifest.resourceSetId !== expectedResourceSetId) {
    throw new Error(
      `textbook-retrieval-resource-set-mismatch:expected=${expectedResourceSetId} actual=${String(manifest.resourceSetId)}`,
    );
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
  const bookIds = indexBookIds(manifest);
  if (expectedBookIds !== undefined) {
    assertExactBookSet(expectedBookIds, bookIds, 'textbook-retrieval-book-set-mismatch');
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
    resourceSetId: manifest.resourceSetId,
    bookIds,
    indexDigest: digest.digest('hex'),
    fileCount: TEXTBOOK_RETRIEVAL_REQUIRED_FILES.length,
  };
}

export function inspectTextbookCorpusView(viewRoot) {
  const runtimeRoot = path.join(viewRoot, 'resources', 'textbooks-v2');
  const indexRoot = path.join(viewRoot, 'resources', 'textbook-hybrid-retrieval', 'bge-m3');
  const assetsRoot = path.join(viewRoot, 'resources', 'textbooks');
  const runtime = inspectTextbookRuntimeV2(runtimeRoot, {
    assetsRoot: fs.existsSync(assetsRoot) ? assetsRoot : undefined,
  });
  const index = inspectTextbookRetrievalIndex(indexRoot, {
    expectedSourceRevision: runtime.authoringSourceRevision,
    expectedResourceSetId: runtime.resourceSetId ?? undefined,
    expectedBookIds: runtime.bookIds,
  });
  return {
    provenanceGeneration: runtime.provenanceGeneration,
    resourceSetId: runtime.resourceSetId,
    bookIds: runtime.bookIds,
    authoringSourceRevision: runtime.authoringSourceRevision,
    inputDigest: runtime.inputDigest,
    inputFileCount: runtime.inputFileCount,
    runtimeIndexConsistent: (
      index.sourceRevision === runtime.authoringSourceRevision
      && JSON.stringify(sortedBookIds(index.bookIds)) === JSON.stringify(sortedBookIds(runtime.bookIds))
      && (runtime.resourceSetId === null || index.resourceSetId === runtime.resourceSetId)
    ),
  };
}

function readSidecar(sidecarPath) {
  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  if (sidecar.schemaVersion !== TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION) {
    throw new Error(`textbook-v2-provenance-schema-invalid:${String(sidecar.schemaVersion)}`);
  }
  if (
    typeof sidecar.resourceSetId !== 'string'
    || sidecar.resourceSetId !== loadTextbookResourceSet().resourceSetId
  ) {
    throw new Error(
      `textbook-v2-provenance-resource-set-mismatch:expected=${loadTextbookResourceSet().resourceSetId} actual=${String(sidecar.resourceSetId)}`,
    );
  }
  assertRevision(sidecar.appRevision, 'provenance-app-revision');
  assertRevision(sidecar.runtimeSourceRevision, 'provenance-runtime-source-revision');
  assertRevision(sidecar.indexSourceRevision, 'provenance-index-source-revision');
  if (sidecar.runtimeSourceRevision !== sidecar.indexSourceRevision) {
    throw new Error(
      `textbook-v2-provenance-runtime-index-revision-mismatch:runtime=${sidecar.runtimeSourceRevision}`
      + ` index=${sidecar.indexSourceRevision}`,
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

async function writeSidecar(options) {
  const runtimeRoot = path.resolve(requireOption(options, 'runtime-root'));
  const indexRoot = path.resolve(requireOption(options, 'index-dir'));
  const imageTar = path.resolve(requireOption(options, 'image-tar'));
  const output = path.resolve(requireOption(options, 'output'));
  const appRevision = requireOption(options, 'app-revision');
  assertRevision(appRevision, 'app-revision');
  const runtime = inspectTextbookRuntimeV2(runtimeRoot, {
    assetsRoot: options['assets-root']
      ? path.resolve(options['assets-root'])
      : undefined,
  });
  const index = inspectTextbookRetrievalIndex(indexRoot, {
    expectedSourceRevision: runtime.authoringSourceRevision,
    expectedResourceSetId: runtime.resourceSetId ?? undefined,
    expectedBookIds: runtime.provenanceGeneration === 'v2' ? runtime.bookIds : undefined,
  });
  const sidecar = {
    schemaVersion: TEXTBOOK_V2_PROVENANCE_SCHEMA_VERSION,
    appRevision,
    imageTarSha256: await sha256FileStream(imageTar),
    resourceSetId: index.resourceSetId,
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

async function verifyImage(options) {
  const sidecar = readSidecar(path.resolve(requireOption(options, 'sidecar')));
  const actual = await sha256FileStream(path.resolve(requireOption(options, 'image-tar')));
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
    resourceSetId: index.resourceSetId,
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
    'resourceSetId',
    'runtimeSourceRevision',
    'runtimeDigest',
    'indexSourceRevision',
    'indexDigest',
  ].includes(field)) {
    throw new Error(`unsupported provenance field:${field}`);
  }
  process.stdout.write(`${sidecar[field]}\n`);
}

function inspectCorpus(options) {
  const viewRoot = path.resolve(requireOption(options, 'view-root'));
  process.stdout.write(`${JSON.stringify(inspectTextbookCorpusView(viewRoot))}\n`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'write-sidecar') return writeSidecar(options);
  if (command === 'verify-image') return verifyImage(options);
  if (command === 'verify-runtime') return verifyRuntime(options);
  if (command === 'print-field') return printField(options);
  if (command === 'inspect-corpus') return inspectCorpus(options);
  throw new Error(`unknown command: ${String(command)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
