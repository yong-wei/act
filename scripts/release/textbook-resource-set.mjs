#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const TEXTBOOK_RESOURCE_SET_PATH =
  'course-content/config/textbook-resource-set.json';

export const BOOK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
const SAFE_REPO_PATH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/u;

export function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`textbook-resource-set-canonical-json-invalid:${String(value)}`);
    }
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (!value || typeof value !== 'object') {
    throw new Error('textbook-resource-set-canonical-json-invalid:unsupported-type');
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function textbookResourceSetIdentity(resourceSet) {
  const sanitized = sanitizeTextbookResourceSet(resourceSet);
  return Object.freeze({
    resourceSetId: sanitized.resourceSetId,
    bookIds: Object.freeze([...sanitized.books]),
  });
}

export function textbookResourceSetDigest(resourceSet) {
  return createHash('sha256').update(canonicalJson(textbookResourceSetIdentity(resourceSet))).digest('hex');
}

function assertSafeRepoPath(value, fieldName) {
  if (
    typeof value !== 'string'
    || !SAFE_REPO_PATH_PATTERN.test(value)
    || value.startsWith('/')
    || value.includes('\\')
    || value.split('/').includes('..')
  ) {
    throw new Error(`textbook-resource-set-${fieldName}-invalid:${String(value)}`);
  }
}

export function sanitizeTextbookResourceSet(resourceSet) {
  if (!resourceSet || typeof resourceSet !== 'object' || Array.isArray(resourceSet)) {
    throw new Error('textbook-resource-set-invalid:expected-object');
  }
  const { resourceSetId, sourceRoot, configRoot, books } = resourceSet;
  if (typeof resourceSetId !== 'string' || resourceSetId.length === 0) {
    throw new Error('textbook-resource-set-resourceSetId-invalid');
  }
  assertSafeRepoPath(sourceRoot, 'sourceRoot');
  assertSafeRepoPath(configRoot, 'configRoot');
  if (
    !Array.isArray(books)
    || books.length === 0
    || books.some((bookId) => typeof bookId !== 'string' || !BOOK_ID_PATTERN.test(bookId))
    || new Set(books).size !== books.length
  ) {
    throw new Error('textbook-resource-set-books-invalid');
  }
  return Object.freeze({
    resourceSetId,
    sourceRoot,
    configRoot,
    books: Object.freeze([...books]),
  });
}

export function loadTextbookResourceSet() {
  const resourceSet = JSON.parse(
    fs.readFileSync(path.resolve(TEXTBOOK_RESOURCE_SET_PATH), 'utf8'),
  );
  return sanitizeTextbookResourceSet(resourceSet);
}

export function textbookBookIds() {
  return loadTextbookResourceSet().books;
}

export function textbookBookCount() {
  return textbookBookIds().length;
}

function main() {
  const [command] = process.argv.slice(2);
  if (command === 'ids') {
    process.stdout.write(`${textbookBookIds().join(' ')}\n`);
    return;
  }
  if (command === 'count') {
    process.stdout.write(`${textbookBookCount()}\n`);
    return;
  }
  if (command === 'digest') {
    process.stdout.write(`${textbookResourceSetDigest(loadTextbookResourceSet())}\n`);
    return;
  }
  if (command === 'identity') {
    process.stdout.write(`${canonicalJson(textbookResourceSetIdentity(loadTextbookResourceSet()))}\n`);
    return;
  }
  throw new Error(`unknown command: ${String(command)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
