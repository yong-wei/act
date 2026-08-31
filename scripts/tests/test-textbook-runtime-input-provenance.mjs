import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createHash } from 'node:crypto';
import { textbookResourceSetDigest } from '../release/textbook-resource-set.mjs';
import {
  TEXTBOOK_INPUT_PROVENANCE_V2,
  buildTextbookInputProvenanceV2,
  parseTextbookInputProvenance,
  serializeTextbookInputProvenance,
  textbookAuthoringRevision,
} from '../release/textbook-runtime-input-provenance.mjs';
import { inspectTextbookRetrievalIndex } from '../release/textbook-runtime-v2-provenance.mjs';

const revision = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const otherRevision = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const digestValue = 'c'.repeat(64);
const resourceSet = {
  resourceSetId: 'fixture-resource-set-v1',
  sourceRoot: 'course-content/authoring/resources',
  configRoot: 'course-content/config/textbook-structure-v2',
  books: ['control-encyclopedia', 'hu-shousong-exercise-analysis-3rd'],
};

const v2 = buildTextbookInputProvenanceV2({
  authoringSourceRevision: revision,
  resourceSetId: resourceSet.resourceSetId,
  bookIds: resourceSet.books,
  sourceRoot: resourceSet.sourceRoot,
  configRoot: resourceSet.configRoot,
  inputDigest: digestValue,
  inputFileCount: 4,
  generator: { id: 'act-textbook-runtime-v2-generator', version: 'v2' },
});

assert.equal(v2.schemaVersion, TEXTBOOK_INPUT_PROVENANCE_V2);
assert.equal(v2.authoringSourceRevision, revision);
assert.equal(v2.resourceSetDigest, textbookResourceSetDigest(resourceSet));
assert.equal(textbookAuthoringRevision(v2), revision);
assert.notEqual(v2.authoringSourceRevision, otherRevision);

const parsed = parseTextbookInputProvenance(JSON.parse(serializeTextbookInputProvenance(v2)));
assert.deepEqual(parsed, v2);

const python = spawnSync('python3', [
  path.join(process.cwd(), 'course-content/scripts/textbook_runtime_input_provenance.py'),
], {
  cwd: process.cwd(),
  encoding: 'utf8',
  input: serializeTextbookInputProvenance(v2),
});
assert.equal(python.status, 0, python.stderr);
assert.equal(python.stdout, serializeTextbookInputProvenance(v2));

assert.throws(
  () => parseTextbookInputProvenance({
    ...v2,
    bookIds: ['control-encyclopedia', 'dorf-modern-control-systems'],
  }),
  /resource-set-digest-mismatch|book-ids/u,
);

assert.throws(
  () => parseTextbookInputProvenance({
    schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V2,
    authoringSourceRevision: 'not-a-revision',
    resourceSetId: resourceSet.resourceSetId,
    bookIds: resourceSet.books,
    resourceSetDigest: v2.resourceSetDigest,
    inputDigest: digestValue,
    inputFileCount: 4,
    generator: v2.generator,
  }),
  /authoring-source-revision-invalid/u,
);

assert.throws(
  () => parseTextbookInputProvenance({
    ...v2,
    bookIds: ['control-encyclopedia', 'control-encyclopedia'],
  }),
  /book-ids-invalid|books-invalid/u,
);

const v1 = parseTextbookInputProvenance({
  schemaVersion: 'act.textbook-runtime-input-provenance.v1',
  sourceRevision: revision,
  inputDigest: digestValue,
  inputFileCount: 2,
});
assert.equal(textbookAuthoringRevision(v1), revision);

const driftDir = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-provenance-drift-'));
fs.writeFileSync(path.join(driftDir, 'keep.txt'), 'ok');
assert.ok(fs.existsSync(path.join(driftDir, 'keep.txt')));

{
  const staleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-index-stale-'));
  const runtimeRoot = path.join(staleRoot, 'runtime');
  const indexRoot = path.join(staleRoot, 'index');
  const bookId = 'control-encyclopedia';
  const bookRoot = path.join(runtimeRoot, bookId);
  fs.mkdirSync(bookRoot, { recursive: true });
  const manifestBody = `${JSON.stringify({
    recordType: 'export-manifest',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId,
    edition: '2015',
    sourceRevision: revision,
    sourceHashes: { 'textbooks/control-encyclopedia/chapter-01/textbook.md': `sha256:${'1'.repeat(64)}` },
  })}\n`;
  fs.writeFileSync(path.join(bookRoot, 'manifest.json'), manifestBody);
  fs.mkdirSync(indexRoot, { recursive: true });
  for (const fileName of [
    'windows.jsonl', 'bodies.utf8', 'vectors.f32', 'lexical-terms.jsonl', 'lexical-postings.bin', 'build-report.json',
  ]) {
    fs.writeFileSync(path.join(indexRoot, fileName), '');
  }
  const actualHash = `sha256:${createHash('sha256').update(manifestBody).digest('hex')}`;
  fs.writeFileSync(path.join(indexRoot, 'manifest.json'), JSON.stringify({
    recordType: 'index-manifest',
    formatVersion: 'textbook-hybrid-retrieval.v1',
    sourceRevision: revision,
    resourceSetId: resourceSet.resourceSetId,
    books: [{
      bookId,
      edition: '2015',
      manifestHash: `sha256:${'0'.repeat(64)}`,
      sourceHashes: { 'textbooks/control-encyclopedia/chapter-01/textbook.md': `sha256:${'1'.repeat(64)}` },
    }],
  }));
  assert.throws(
    () => inspectTextbookRetrievalIndex(indexRoot, {
      expectedSourceRevision: revision,
      expectedResourceSetId: resourceSet.resourceSetId,
      expectedBookIds: [bookId],
      runtimeRoot,
    }),
    /textbook-retrieval-source-manifest-stale/u,
  );
  fs.writeFileSync(path.join(indexRoot, 'manifest.json'), JSON.stringify({
    recordType: 'index-manifest',
    formatVersion: 'textbook-hybrid-retrieval.v1',
    sourceRevision: revision,
    resourceSetId: resourceSet.resourceSetId,
    books: [{
      bookId,
      edition: '2015',
      manifestHash: actualHash,
      sourceHashes: { 'textbooks/control-encyclopedia/chapter-01/textbook.md': `sha256:${'1'.repeat(64)}` },
    }],
  }));
  const verified = inspectTextbookRetrievalIndex(indexRoot, {
    expectedSourceRevision: revision,
    expectedResourceSetId: resourceSet.resourceSetId,
    expectedBookIds: [bookId],
    runtimeRoot,
  });
  assert.deepEqual(verified.bookIds, [bookId]);
  fs.writeFileSync(path.join(indexRoot, 'manifest.json'), JSON.stringify({
    recordType: 'index-manifest',
    formatVersion: 'textbook-hybrid-retrieval.v1',
    sourceRevision: revision,
    books: [{
      bookId,
      edition: '2015',
      manifestHash: actualHash,
      sourceHashes: { 'textbooks/control-encyclopedia/chapter-01/textbook.md': `sha256:${'1'.repeat(64)}` },
    }],
  }));
  const legacy = inspectTextbookRetrievalIndex(indexRoot, {
    expectedSourceRevision: revision,
    expectedBookIds: [bookId],
    runtimeRoot,
  });
  assert.equal(legacy.resourceSetId, undefined);
}

console.log('textbook-runtime-input-provenance validation: PASS');
