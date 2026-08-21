import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { textbookResourceSetDigest } from '../release/textbook-resource-set.mjs';
import {
  TEXTBOOK_INPUT_PROVENANCE_V2,
  buildTextbookInputProvenanceV2,
  parseTextbookInputProvenance,
  serializeTextbookInputProvenance,
  textbookAuthoringRevision,
} from '../release/textbook-runtime-input-provenance.mjs';

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

console.log('textbook-runtime-input-provenance validation: PASS');
