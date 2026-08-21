#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import {
  BOOK_ID_PATTERN,
  canonicalJson,
  textbookResourceSetDigest,
  textbookResourceSetIdentity,
} from './textbook-resource-set.mjs';

export const TEXTBOOK_INPUT_PROVENANCE_FILE = 'input-provenance.json';
export const TEXTBOOK_INPUT_PROVENANCE_V1 = 'act.textbook-runtime-input-provenance.v1';
export const TEXTBOOK_INPUT_PROVENANCE_V2 = 'act.textbook-runtime-input-provenance.v2';

const REVISION_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const V1_KEYS = ['schemaVersion', 'sourceRevision', 'inputDigest', 'inputFileCount'];
const V2_KEYS = [
  'schemaVersion',
  'authoringSourceRevision',
  'resourceSetId',
  'bookIds',
  'resourceSetDigest',
  'inputDigest',
  'inputFileCount',
  'generator',
];
const GENERATOR_KEYS = ['id', 'version'];

function error(message) {
  throw new Error(message);
}

function exactKeys(value, keys, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    error(`${context}-invalid`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    error(`${context}-invalid`);
  }
  return value;
}

function revision(value, fieldName) {
  if (typeof value !== 'string' || !REVISION_PATTERN.test(value)) {
    error(`textbook-v2-${fieldName}-invalid:${String(value)}`);
  }
  return value;
}

function digest(value, fieldName) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    error(`textbook-v2-${fieldName}-invalid:${String(value)}`);
  }
  return value;
}

function positiveCount(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    error(`textbook-v2-${fieldName}-invalid:${String(value)}`);
  }
  return value;
}

function generator(value) {
  const raw = exactKeys(value, GENERATOR_KEYS, 'textbook-v2-input-provenance-generator');
  const id = raw.id;
  const version = raw.version;
  if (
    typeof id !== 'string'
    || typeof version !== 'string'
    || !id
    || !version
    || /[\u0000-\u001f\u007f]/u.test(id)
    || /[\u0000-\u001f\u007f]/u.test(version)
  ) {
    error('textbook-v2-input-provenance-generator-invalid');
  }
  return { id, version };
}

function normalizeBookIds(bookIds) {
  if (
    !Array.isArray(bookIds)
    || bookIds.length === 0
    || bookIds.some((bookId) => typeof bookId !== 'string' || !BOOK_ID_PATTERN.test(bookId))
    || new Set(bookIds).size !== bookIds.length
  ) {
    error('textbook-v2-input-provenance-book-ids-invalid');
  }
  return [...bookIds];
}

export function isTextbookInputProvenanceV2(value) {
  return Boolean(value && typeof value === 'object' && value.schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V2);
}

export function parseTextbookInputProvenance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    error('textbook-v2-input-provenance-invalid');
  }
  if (value.schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V1) {
    exactKeys(value, V1_KEYS, 'textbook-v2-input-provenance');
    return Object.freeze({
      schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V1,
      sourceRevision: revision(value.sourceRevision, 'input-provenance-source-revision'),
      inputDigest: digest(value.inputDigest, 'input-provenance-input-digest'),
      inputFileCount: positiveCount(value.inputFileCount, 'input-provenance-input-file-count'),
    });
  }
  if (value.schemaVersion !== TEXTBOOK_INPUT_PROVENANCE_V2) {
    error(`textbook-v2-input-provenance-schema-invalid:${String(value.schemaVersion)}`);
  }
  exactKeys(value, V2_KEYS, 'textbook-v2-input-provenance');
  const bookIds = normalizeBookIds(value.bookIds);
  if (typeof value.resourceSetId !== 'string' || !value.resourceSetId) {
    error('textbook-v2-input-provenance-resource-set-invalid');
  }
  const expectedDigest = textbookResourceSetDigest({
    resourceSetId: value.resourceSetId,
    sourceRoot: 'course-content/authoring/resources',
    configRoot: 'course-content/config/textbook-structure-v2',
    books: bookIds,
  });
  const resourceSetDigest = digest(value.resourceSetDigest, 'input-provenance-resource-set-digest');
  if (resourceSetDigest !== expectedDigest) {
    error(
      `textbook-v2-input-provenance-resource-set-digest-mismatch:expected=${expectedDigest} actual=${resourceSetDigest}`,
    );
  }
  return Object.freeze({
    schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V2,
    authoringSourceRevision: revision(value.authoringSourceRevision, 'input-provenance-authoring-source-revision'),
    resourceSetId: value.resourceSetId,
    bookIds: Object.freeze(bookIds),
    resourceSetDigest,
    inputDigest: digest(value.inputDigest, 'input-provenance-input-digest'),
    inputFileCount: positiveCount(value.inputFileCount, 'input-provenance-input-file-count'),
    generator: Object.freeze(generator(value.generator)),
  });
}

export function serializeTextbookInputProvenance(provenance) {
  const parsed = parseTextbookInputProvenance(provenance);
  return `${canonicalJson(parsed)}\n`;
}

export function buildTextbookInputProvenanceV2(input) {
  const identity = textbookResourceSetIdentity({
    resourceSetId: input.resourceSetId,
    sourceRoot: input.sourceRoot ?? 'course-content/authoring/resources',
    configRoot: input.configRoot ?? 'course-content/config/textbook-structure-v2',
    books: input.bookIds,
  });
  return parseTextbookInputProvenance({
    schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V2,
    authoringSourceRevision: input.authoringSourceRevision,
    resourceSetId: identity.resourceSetId,
    bookIds: [...identity.bookIds],
    resourceSetDigest: textbookResourceSetDigest({
      resourceSetId: identity.resourceSetId,
      sourceRoot: input.sourceRoot ?? 'course-content/authoring/resources',
      configRoot: input.configRoot ?? 'course-content/config/textbook-structure-v2',
      books: [...identity.bookIds],
    }),
    inputDigest: input.inputDigest,
    inputFileCount: input.inputFileCount,
    generator: input.generator,
  });
}

export function textbookAuthoringRevision(provenance) {
  const parsed = parseTextbookInputProvenance(provenance);
  return parsed.schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V2
    ? parsed.authoringSourceRevision
    : parsed.sourceRevision;
}

export function textbookProvenanceBookIds(provenance) {
  const parsed = parseTextbookInputProvenance(provenance);
  return parsed.schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V2 ? [...parsed.bookIds] : null;
}

export function textbookProvenanceGeneration(provenance) {
  return parseTextbookInputProvenance(provenance).schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V2
    ? 'v2'
    : 'legacy';
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.stderr.write('textbook-runtime-input-provenance is a library module\n');
  process.exitCode = 2;
}
