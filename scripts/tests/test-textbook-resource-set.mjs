import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  canonicalJson,
  loadTextbookResourceSet,
  sanitizeTextbookResourceSet,
  textbookBookCount,
  textbookBookIds,
  textbookResourceSetDigest,
  textbookResourceSetIdentity,
} from '../release/textbook-resource-set.mjs';

const root = process.cwd();
const resourceSet = loadTextbookResourceSet();

assert.equal(resourceSet.resourceSetId, 'current-authoring-bundle-v1');
assert.equal(resourceSet.sourceRoot, 'course-content/authoring/resources');
assert.equal(resourceSet.configRoot, 'course-content/config/textbook-structure-v2');
assert.deepEqual(resourceSet.books, [
  'control-encyclopedia',
  'hu-shousong-exercise-analysis-3rd',
]);
assert.deepEqual(textbookBookIds(), resourceSet.books);
assert.equal(textbookBookCount(), resourceSet.books.length);

const validResourceSet = {
  resourceSetId: 'fixture-resource-set-v1',
  sourceRoot: 'course-content/authoring/resources',
  configRoot: 'course-content/config/textbook-structure-v2',
  books: ['fixture-book'],
};

const invalidCases = [
  ['missing-id', { ...validResourceSet, resourceSetId: '' }],
  ['unsafe-source-root', { ...validResourceSet, sourceRoot: '../outside' }],
  ['unsafe-config-root', { ...validResourceSet, configRoot: 'config/../outside' }],
  ['empty-books', { ...validResourceSet, books: [] }],
  ['duplicate-books', { ...validResourceSet, books: ['fixture-book', 'fixture-book'] }],
  ['invalid-book-id', { ...validResourceSet, books: ['Fixture-Book'] }],
];
for (const [label, invalidResourceSet] of invalidCases) {
  assert.throws(
    () => sanitizeTextbookResourceSet(invalidResourceSet),
    /textbook-resource-set/u,
    `resource set must reject ${label}`,
  );
}

const helperPath = path.join(root, 'scripts/release/textbook-resource-set.mjs');
for (const [command, expected] of [
  ['ids', resourceSet.books.join(' ')],
  ['count', String(resourceSet.books.length)],
]) {
  const result = spawnSync(process.execPath, [helperPath, command], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${command} should exit 0`);
  assert.equal(result.stdout.trim(), expected);
}

const identity = textbookResourceSetIdentity(resourceSet);
assert.deepEqual(identity.bookIds, resourceSet.books);
assert.match(textbookResourceSetDigest(resourceSet), /^[0-9a-f]{64}$/u);
assert.equal(
  canonicalJson({ resourceSetId: 'b', bookIds: ['a'] }),
  '{"bookIds":["a"],"resourceSetId":"b"}',
);

const pythonDigest = spawnSync('python3', [
  path.join(root, 'course-content/scripts/textbook_resource_set.py'),
  'digest',
], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(pythonDigest.status, 0, pythonDigest.stderr);
assert.equal(pythonDigest.stdout.trim(), textbookResourceSetDigest(resourceSet));

const pythonIdentity = spawnSync('python3', [
  path.join(root, 'course-content/scripts/textbook_resource_set.py'),
  'identity',
], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(pythonIdentity.status, 0, pythonIdentity.stderr);
assert.equal(pythonIdentity.stdout.trim(), canonicalJson(identity));

assert.throws(
  () => sanitizeTextbookResourceSet({
    ...validResourceSet,
    books: ['alpha-book', 'beta-book', 'alpha-book'],
  }),
  /textbook-resource-set-books-invalid/u,
);

console.log('textbook-resource-set validation: PASS');
