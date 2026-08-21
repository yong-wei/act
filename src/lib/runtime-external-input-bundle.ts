import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { stableStringify } from '@/lib/aggregate-governance/hash';

/**
 * A bundle is a content-addressed description of the external part of the
 * runtime tree.  The generated textbook tree is an explicit overlay on the
 * captured production tree; callers never need to emulate the overlay with a
 * broad rsync or a worktree fallback.
 */
export const EXTERNAL_INPUT_BUNDLE_SCHEMA_VERSION = 'act-runtime-external-input-bundle.v1';
export const EXTERNAL_INPUT_BUNDLE_DECLARATION_SCHEMA_VERSION = 'act-runtime-external-input-bundles.v1';
export const EXTERNAL_INPUT_BUNDLE_DECLARATION_PATH = 'course-content/authoring/runtime-external-input-bundles.v1.json';
export const EXTERNAL_INPUT_BUNDLE_PREFIXES = [
  'resources/textbooks-v2/',
  'resources/textbook-hybrid-retrieval/bge-m3/',
  'resources/textbooks/',
] as const;
export const EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES = [
  'resources/textbooks-v2/',
  'resources/textbook-retrieval/',
  'resources/textbook-hybrid-retrieval/bge-m3/',
  'resources/textbooks/',
] as const;
export const TEXTBOOK_EXTERNAL_INPUT_ID = 'textbook-runtime-generated-v2';
export const TEXTBOOK_EXTERNAL_INPUT_GENERATOR_ID = 'act-textbook-runtime-v2-generator';
export const TEXTBOOK_EXTERNAL_INPUT_GENERATOR_VERSION = 'v2';
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const REVISION_PATTERN = /^[a-f0-9]{40}$/u;
const INPUT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;

export interface ExternalInputBundleFile {
  /** Path relative to course-content/runtime, for example resources/foo.json. */
  path: string;
  sizeBytes: number;
  sha256: string;
  /** Local-only source path; never serialized into a public manifest. */
  absolutePath?: string;
}

export const TEXTBOOK_INPUT_PROVENANCE_V1 = 'act.textbook-runtime-input-provenance.v1' as const;
export const TEXTBOOK_INPUT_PROVENANCE_V2 = 'act.textbook-runtime-input-provenance.v2' as const;

export interface ExternalInputBundleGenerator {
  id: string;
  version: string;
}

export interface ExternalInputBundleProvenanceV1 {
  schemaVersion: typeof TEXTBOOK_INPUT_PROVENANCE_V1;
  sourceRevision: string;
  inputDigest: string;
  inputFileCount: number;
}

export interface ExternalInputBundleProvenanceV2 {
  schemaVersion: typeof TEXTBOOK_INPUT_PROVENANCE_V2;
  authoringSourceRevision: string;
  resourceSetId: string;
  bookIds: string[];
  resourceSetDigest: string;
  inputDigest: string;
  inputFileCount: number;
  generator: ExternalInputBundleGenerator;
}

export type ExternalInputBundleProvenance =
  | ExternalInputBundleProvenanceV1
  | ExternalInputBundleProvenanceV2;

export interface ExternalInputBundleOverlay {
  baseSourceRevision: string;
  baseRuntimeTreeSha256: string;
  replacedPrefixes: string[];
  generatedPrefixes: string[];
  generatedTreeSha256: string;
}

export interface ExternalInputBundle {
  schemaVersion: typeof EXTERNAL_INPUT_BUNDLE_SCHEMA_VERSION;
  externalInputId: string;
  /** Capture revision used for the Git/non-Git partition and base runtime. */
  sourceRevision: string;
  prefixes: string[];
  baseSourceRevision: string;
  overlay: ExternalInputBundleOverlay;
  overlaySha256: string;
  provenance: ExternalInputBundleProvenance;
  generator: ExternalInputBundleGenerator;
  fileCount: number;
  totalBytes: number;
  treeSha256: string;
  manifestSha256: string;
  files: ExternalInputBundleFile[];
  /** Canonical wire digest is derived from the manifest and is not serialized. */
  wireSha256: string;
  /** Local-only base root used to open non-overlay bytes during publication. */
  root?: string;
  /** Local-only generated root used to open overlay bytes during publication. */
  generatedRoot?: string;
}

export interface ExternalInputBundleDeclaration {
  schemaVersion: typeof EXTERNAL_INPUT_BUNDLE_DECLARATION_SCHEMA_VERSION;
  inputs: ExternalInputBundleDeclarationInput[];
}

export interface ExternalInputBundleDeclarationInput {
  externalInputId: string;
  prefixes: string[];
  bundleSemanticSha256: string;
  bundleWireSha256: string;
  sourceRevision: string;
  baseSourceRevision: string;
  overlaySha256: string;
  inputDigest: string;
  inputFileCount: number;
  authoringSourceRevision?: string;
  resourceSetId?: string;
  resourceSetDigest?: string;
  bookIds?: string[];
}

export interface PreparedExternalInputBundle extends ExternalInputBundle {
  root: string;
  generatedRoot: string;
  files: Array<ExternalInputBundleFile & { absolutePath: string }>;
}

function error(message: string): never {
  throw new Error(`runtime-external-input-bundle:${message}`);
}

function compareCodePoints(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], context: string) {
  const actual = Object.keys(value).sort(compareCodePoints);
  const expected = [...keys].sort(compareCodePoints);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    error(`${context} has unsupported or missing fields`);
  }
}

function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, context: string) {
  if (typeof value !== 'string') error(`${context} must be a string`);
  return value;
}

function integer(value: unknown, context: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) error(`${context} must be a non-negative safe integer`);
  return Number(value);
}

function digest(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function wire(value: unknown) {
  return `${stableStringify(value)}\n`;
}

export function normalizeExternalInputPath(value: string, context = 'bundle path') {
  if (
    !value
    || value.includes('\\')
    || value.startsWith('/')
    || /^[A-Za-z]:\//u.test(value)
    || /[\u0000-\u001f\u007f]/u.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')
    || path.posix.normalize(value) !== value
  ) {
    error(`${context} is unsafe: ${value}`);
  }
  return value;
}

function validatePrefixes(prefixes: readonly string[], expectedPrefixes: readonly string[] = EXTERNAL_INPUT_BUNDLE_PREFIXES) {
  if (prefixes.length !== expectedPrefixes.length) error('bundle must declare the exact generated prefixes');
  const normalized = prefixes.map((prefix) => {
    if (!prefix.endsWith('/')) error(`prefix is not a directory prefix: ${prefix}`);
    return `${normalizeExternalInputPath(prefix.slice(0, -1), 'bundle prefix')}/`;
  });
  const expected = [...expectedPrefixes].sort(compareCodePoints);
  const actual = [...normalized].sort(compareCodePoints);
  if (actual.length !== expected.length || actual.some((prefix, index) => prefix !== expected[index])) {
    error('bundle prefixes do not match the exact generated prefix allowlist');
  }
  for (let index = 0; index < actual.length; index += 1) {
    for (let other = index + 1; other < actual.length; other += 1) {
      if (actual[other].startsWith(actual[index]) || actual[index].startsWith(actual[other])) error('bundle prefixes overlap');
    }
  }
  return normalized;
}

function validateReplacedPrefixes(prefixes: readonly string[]) {
  return validatePrefixes(prefixes, EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES);
}

function validateInputId(value: unknown, context: string) {
  const inputId = string(value, context);
  if (!INPUT_ID_PATTERN.test(inputId)) error(`${context} is invalid`);
  return inputId;
}

function validateRevision(value: unknown, context: string) {
  const revision = string(value, context).toLowerCase();
  if (!REVISION_PATTERN.test(revision)) error(`${context} must be a complete Git revision`);
  return revision;
}

function validateDigest(value: unknown, context: string) {
  const valueString = string(value, context).toLowerCase();
  if (!SHA256_PATTERN.test(valueString)) error(`${context} must be a SHA-256 digest`);
  return valueString;
}

function validateFiles(files: readonly ExternalInputBundleFile[]) {
  const normalized = files.map((file, index) => {
    const relativePath = normalizeExternalInputPath(string(file.path, `files[${index}].path`), `files[${index}].path`);
    const sizeBytes = integer(file.sizeBytes, `files[${index}].sizeBytes`);
    const sha256 = validateDigest(file.sha256, `files[${index}].sha256`);
    if (file.absolutePath !== undefined && typeof file.absolutePath !== 'string') error(`files[${index}].absolutePath is invalid`);
    return {
      path: relativePath,
      sizeBytes,
      sha256,
      ...(file.absolutePath ? { absolutePath: file.absolutePath } : {}),
    };
  }).sort((left, right) => compareCodePoints(left.path, right.path));
  const seen = new Set<string>();
  const seenCaseFolded = new Map<string, string>();
  for (const file of normalized) {
    if (seen.has(file.path)) error(`duplicate bundle path: ${file.path}`);
    seen.add(file.path);
    const folded = file.path.toLocaleLowerCase('en-US');
    const previous = seenCaseFolded.get(folded);
    if (previous && previous !== file.path) error(`case-conflicting bundle paths: ${previous}, ${file.path}`);
    seenCaseFolded.set(folded, file.path);
  }
  return normalized;
}

const BOOK_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
const DECLARATION_V1_KEYS = [
  'externalInputId',
  'prefixes',
  'bundleSemanticSha256',
  'bundleWireSha256',
  'sourceRevision',
  'baseSourceRevision',
  'overlaySha256',
  'inputDigest',
  'inputFileCount',
] as const;
const DECLARATION_V2_KEYS = [
  ...DECLARATION_V1_KEYS,
  'authoringSourceRevision',
  'resourceSetId',
  'resourceSetDigest',
  'bookIds',
] as const;

export function textbookCorpusIdentityDigest(resourceSetId: string, bookIds: readonly string[]) {
  return digest({ resourceSetId, bookIds: [...bookIds] });
}

function textbookCorpusDigest(resourceSetId: string, bookIds: readonly string[]) {
  return textbookCorpusIdentityDigest(resourceSetId, bookIds);
}

function normalizeBookIds(value: unknown, context: string) {
  if (!Array.isArray(value) || value.length === 0) error(`${context} must be a unique book id list`);
  const bookIds = value.map((bookId, index) => string(bookId, `${context}[${index}]`));
  if (bookIds.some((bookId) => !BOOK_ID_PATTERN.test(bookId)) || new Set(bookIds).size !== bookIds.length) {
    error(`${context} must be a unique book id list`);
  }
  return bookIds;
}

export function isTextbookInputProvenanceV2(
  value: ExternalInputBundleProvenance,
): value is ExternalInputBundleProvenanceV2 {
  return value.schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V2;
}

function provenance(value: unknown, captureSourceRevision: string): ExternalInputBundleProvenance {
  const raw = object(value, 'provenance');
  const schemaVersion = string(raw.schemaVersion, 'provenance.schemaVersion');
  if (schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V1) {
    assertExactKeys(raw, ['schemaVersion', 'sourceRevision', 'inputDigest', 'inputFileCount'], 'provenance');
    const parsed = {
      schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V1,
      sourceRevision: validateRevision(raw.sourceRevision, 'provenance.sourceRevision'),
      inputDigest: validateDigest(raw.inputDigest, 'provenance.inputDigest'),
      inputFileCount: integer(raw.inputFileCount, 'provenance.inputFileCount'),
    };
    if (parsed.sourceRevision !== captureSourceRevision || parsed.inputFileCount < 1) {
      error('input provenance does not match the bundle source revision');
    }
    return parsed as ExternalInputBundleProvenanceV1;
  }
  if (schemaVersion !== TEXTBOOK_INPUT_PROVENANCE_V2) error('input provenance schema is unsupported');
  assertExactKeys(raw, [
    'schemaVersion',
    'authoringSourceRevision',
    'resourceSetId',
    'bookIds',
    'resourceSetDigest',
    'inputDigest',
    'inputFileCount',
    'generator',
  ], 'provenance');
  const bookIds = normalizeBookIds(raw.bookIds, 'provenance.bookIds');
  const resourceSetId = string(raw.resourceSetId, 'provenance.resourceSetId');
  if (!resourceSetId) error('provenance.resourceSetId is invalid');
  const resourceSetDigest = validateDigest(raw.resourceSetDigest, 'provenance.resourceSetDigest');
  if (resourceSetDigest !== textbookCorpusDigest(resourceSetId, bookIds)) {
    error('provenance resourceSet digest does not match its identity');
  }
  const parsedGenerator = generator(raw.generator);
  const inputFileCount = integer(raw.inputFileCount, 'provenance.inputFileCount');
  if (inputFileCount < 1) error('provenance.inputFileCount must be positive');
  return {
    schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V2,
    authoringSourceRevision: validateRevision(raw.authoringSourceRevision, 'provenance.authoringSourceRevision'),
    resourceSetId,
    bookIds,
    resourceSetDigest,
    inputDigest: validateDigest(raw.inputDigest, 'provenance.inputDigest'),
    inputFileCount,
    generator: parsedGenerator,
  };
}

function generator(value: unknown): ExternalInputBundleGenerator {
  const raw = object(value, 'generator');
  assertExactKeys(raw, ['id', 'version'], 'generator');
  const id = string(raw.id, 'generator.id');
  const version = string(raw.version, 'generator.version');
  if (!id || !version || /[\u0000-\u001f\u007f]/u.test(id) || /[\u0000-\u001f\u007f]/u.test(version)) error('generator identity is invalid');
  return { id, version };
}

function parseOverlay(value: unknown, sourceRevision: string): { overlay: ExternalInputBundleOverlay; overlaySha256: string } {
  const raw = object(value, 'overlay');
  assertExactKeys(raw, ['baseSourceRevision', 'baseRuntimeTreeSha256', 'replacedPrefixes', 'generatedPrefixes', 'generatedTreeSha256'], 'overlay');
  const overlay = {
    baseSourceRevision: validateRevision(raw.baseSourceRevision, 'overlay.baseSourceRevision'),
    baseRuntimeTreeSha256: validateDigest(raw.baseRuntimeTreeSha256, 'overlay.baseRuntimeTreeSha256'),
    replacedPrefixes: validateReplacedPrefixes(Array.isArray(raw.replacedPrefixes) ? raw.replacedPrefixes.map((prefix) => string(prefix, 'overlay.replacedPrefixes')) : []),
    generatedPrefixes: validatePrefixes(Array.isArray(raw.generatedPrefixes) ? raw.generatedPrefixes.map((prefix) => string(prefix, 'overlay.generatedPrefixes')) : []),
    generatedTreeSha256: validateDigest(raw.generatedTreeSha256, 'overlay.generatedTreeSha256'),
  };
  if (overlay.baseSourceRevision !== sourceRevision) error('overlay base source revision does not match bundle source revision');
  return { overlay, overlaySha256: digest(overlay) };
}

function bundleBody(bundle: Omit<ExternalInputBundle, 'manifestSha256' | 'wireSha256' | 'root' | 'generatedRoot'>) {
  return {
    schemaVersion: bundle.schemaVersion,
    externalInputId: bundle.externalInputId,
    sourceRevision: bundle.sourceRevision,
    prefixes: bundle.prefixes,
    baseSourceRevision: bundle.baseSourceRevision,
    overlay: bundle.overlay,
    overlaySha256: bundle.overlaySha256,
    provenance: bundle.provenance,
    generator: bundle.generator,
    fileCount: bundle.fileCount,
    totalBytes: bundle.totalBytes,
    treeSha256: bundle.treeSha256,
    files: bundle.files.map(({ path: relativePath, sizeBytes, sha256 }) => ({ path: relativePath, sizeBytes, sha256 })),
  };
}

export function serializeExternalInputBundle(bundle: ExternalInputBundle) {
  const body = bundleBody(bundle);
  if (bundle.manifestSha256 !== digest(body)) error('bundle manifest semantic digest is inconsistent');
  if (bundle.overlaySha256 !== digest(bundle.overlay)) error('bundle overlay digest is inconsistent');
  return wire({ ...body, manifestSha256: bundle.manifestSha256 });
}

export function externalInputBundleWireSha256(bundle: ExternalInputBundle) {
  return createHash('sha256').update(serializeExternalInputBundle(bundle)).digest('hex');
}

export function buildExternalInputBundle(input: {
  externalInputId: string;
  sourceRevision: string;
  prefixes?: readonly string[];
  baseSourceRevision?: string;
  overlay?: Omit<ExternalInputBundleOverlay, 'baseSourceRevision'> & { baseSourceRevision?: string };
  provenance: ExternalInputBundleProvenance;
  generator: ExternalInputBundleGenerator;
  files: readonly ExternalInputBundleFile[];
  root?: string;
  generatedRoot?: string;
}): ExternalInputBundle {
  const externalInputId = validateInputId(input.externalInputId, 'externalInputId');
  const sourceRevision = validateRevision(input.sourceRevision, 'sourceRevision');
  const prefixes = validatePrefixes(input.prefixes ?? EXTERNAL_INPUT_BUNDLE_PREFIXES);
  const parsedProvenance = provenance(input.provenance, sourceRevision);
  const parsedGenerator = generator(input.generator);
  if (
    isTextbookInputProvenanceV2(parsedProvenance)
    && (parsedProvenance.generator.id !== parsedGenerator.id
      || parsedProvenance.generator.version !== parsedGenerator.version)
  ) {
    error('v2 provenance generator does not match the bundle generator');
  }
  const files = validateFiles(input.files);
  if (files.length === 0) error('bundle must contain at least one file');
  const baseSourceRevision = validateRevision(input.baseSourceRevision ?? sourceRevision, 'baseSourceRevision');
  if (baseSourceRevision !== sourceRevision) error('base source revision must equal capture source revision');
  const overlayInput = input.overlay ?? {
    replacedPrefixes: [...EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES],
    baseRuntimeTreeSha256: digest([]),
    generatedPrefixes: [...EXTERNAL_INPUT_BUNDLE_PREFIXES],
    generatedTreeSha256: digest([]),
  };
  const { overlay, overlaySha256 } = parseOverlay({
    baseSourceRevision,
    baseRuntimeTreeSha256: overlayInput.baseRuntimeTreeSha256,
    replacedPrefixes: overlayInput.replacedPrefixes,
    generatedPrefixes: overlayInput.generatedPrefixes,
    generatedTreeSha256: overlayInput.generatedTreeSha256,
  }, sourceRevision);
  const treeSha256 = digest(files.map(({ path: relativePath, sizeBytes, sha256 }) => ({ path: relativePath, sizeBytes, sha256 })));
  const body = bundleBody({
    schemaVersion: EXTERNAL_INPUT_BUNDLE_SCHEMA_VERSION,
    externalInputId,
    sourceRevision,
    prefixes,
    baseSourceRevision,
    overlay,
    overlaySha256,
    provenance: parsedProvenance,
    generator: parsedGenerator,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    treeSha256,
    files,
  });
  const manifestSha256 = digest(body);
  const result = {
    ...body,
    manifestSha256,
    wireSha256: createHash('sha256').update(wire({ ...body, manifestSha256 })).digest('hex'),
    ...(input.root ? { root: input.root } : {}),
    ...(input.generatedRoot ? { generatedRoot: input.generatedRoot } : {}),
  } as ExternalInputBundle;
  return result;
}

export function parseExternalInputBundle(value: unknown, options: { wireBytes?: Uint8Array } = {}): ExternalInputBundle {
  const raw = object(value, 'bundle');
  assertExactKeys(raw, ['schemaVersion', 'externalInputId', 'sourceRevision', 'prefixes', 'baseSourceRevision', 'overlay', 'overlaySha256', 'provenance', 'generator', 'fileCount', 'totalBytes', 'treeSha256', 'manifestSha256', 'files'], 'bundle');
  if (raw.schemaVersion !== EXTERNAL_INPUT_BUNDLE_SCHEMA_VERSION) error('bundle schema is unsupported');
  const sourceRevision = validateRevision(raw.sourceRevision, 'bundle.sourceRevision');
  const prefixes = validatePrefixes(Array.isArray(raw.prefixes) ? raw.prefixes.map((prefix) => string(prefix, 'bundle.prefixes')) : []);
  const filesRaw = raw.files;
  if (!Array.isArray(filesRaw)) error('bundle.files must be an array');
  const files = validateFiles(filesRaw.map((entry, index) => {
    const item = object(entry, `bundle.files[${index}]`);
    assertExactKeys(item, ['path', 'sizeBytes', 'sha256'], `bundle.files[${index}]`);
    return { path: string(item.path, `bundle.files[${index}].path`), sizeBytes: integer(item.sizeBytes, `bundle.files[${index}].sizeBytes`), sha256: validateDigest(item.sha256, `bundle.files[${index}].sha256`) };
  }));
  const { overlay, overlaySha256 } = parseOverlay(raw.overlay, sourceRevision);
  if (validateDigest(raw.overlaySha256, 'bundle.overlaySha256') !== overlaySha256) error('bundle overlay digest does not match its rules');
  const parsed = buildExternalInputBundle({
    externalInputId: validateInputId(raw.externalInputId, 'bundle.externalInputId'),
    sourceRevision,
    prefixes,
    baseSourceRevision: validateRevision(raw.baseSourceRevision, 'bundle.baseSourceRevision'),
    overlay,
    provenance: provenance(raw.provenance, sourceRevision),
    generator: generator(raw.generator),
    files,
  });
  if (integer(raw.fileCount, 'bundle.fileCount') !== parsed.fileCount || integer(raw.totalBytes, 'bundle.totalBytes') !== parsed.totalBytes || validateDigest(raw.treeSha256, 'bundle.treeSha256') !== parsed.treeSha256 || validateDigest(raw.manifestSha256, 'bundle.manifestSha256') !== parsed.manifestSha256) {
    error('bundle summary or semantic digest does not match its files');
  }
  if (options.wireBytes && !Buffer.from(options.wireBytes).equals(Buffer.from(serializeExternalInputBundle(parsed)))) error('bundle wire bytes are not canonical');
  return { ...parsed, wireSha256: externalInputBundleWireSha256(parsed) };
}

export function parseExternalInputBundleWire(bytes: Uint8Array) {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch (cause) {
    error(`bundle wire is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  return parseExternalInputBundle(value, { wireBytes: bytes });
}

export function serializeExternalInputBundleDeclaration(declaration: ExternalInputBundleDeclaration) {
  const body = {
    schemaVersion: declaration.schemaVersion,
    inputs: [...declaration.inputs].sort((left, right) => compareCodePoints(left.externalInputId, right.externalInputId)).map((input) => ({ ...input })),
  };
  return wire(body);
}

export function parseExternalInputBundleDeclaration(value: unknown): ExternalInputBundleDeclaration {
  const raw = object(value, 'external input bundle declaration');
  assertExactKeys(raw, ['schemaVersion', 'inputs'], 'external input bundle declaration');
  if (raw.schemaVersion !== EXTERNAL_INPUT_BUNDLE_DECLARATION_SCHEMA_VERSION || !Array.isArray(raw.inputs)) error('external input bundle declaration schema is unsupported');
  const inputs = raw.inputs.map((entry, index) => {
    const item = object(entry, `external input bundle declaration.inputs[${index}]`);
    const actualKeys = Object.keys(item).sort();
    const isV2 = actualKeys.length === [...DECLARATION_V2_KEYS].sort().length
      && actualKeys.every((key, keyIndex) => key === [...DECLARATION_V2_KEYS].sort()[keyIndex]);
    if (!isV2) {
      assertExactKeys(item, [...DECLARATION_V1_KEYS], `external input bundle declaration.inputs[${index}]`);
    } else {
      assertExactKeys(item, [...DECLARATION_V2_KEYS], `external input bundle declaration.inputs[${index}]`);
    }
    const sourceRevision = validateRevision(item.sourceRevision, `declaration.inputs[${index}].sourceRevision`);
    const baseSourceRevision = validateRevision(item.baseSourceRevision, `declaration.inputs[${index}].baseSourceRevision`);
    if (baseSourceRevision !== sourceRevision) error('declaration base source revision must equal source revision');
    const inputFileCount = integer(item.inputFileCount, `declaration.inputs[${index}].inputFileCount`);
    if (inputFileCount < 1) error('declaration inputFileCount must be positive');
    const parsed: ExternalInputBundleDeclarationInput = {
      externalInputId: validateInputId(item.externalInputId, `declaration.inputs[${index}].externalInputId`),
      prefixes: validatePrefixes(Array.isArray(item.prefixes) ? item.prefixes.map((prefix) => string(prefix, `declaration.inputs[${index}].prefixes`)) : []),
      bundleSemanticSha256: validateDigest(item.bundleSemanticSha256, `declaration.inputs[${index}].bundleSemanticSha256`),
      bundleWireSha256: validateDigest(item.bundleWireSha256, `declaration.inputs[${index}].bundleWireSha256`),
      sourceRevision,
      baseSourceRevision,
      overlaySha256: validateDigest(item.overlaySha256, `declaration.inputs[${index}].overlaySha256`),
      inputDigest: validateDigest(item.inputDigest, `declaration.inputs[${index}].inputDigest`),
      inputFileCount,
    };
    if (!isV2) return parsed;
    const bookIds = normalizeBookIds(item.bookIds, `declaration.inputs[${index}].bookIds`);
    const resourceSetId = string(item.resourceSetId, `declaration.inputs[${index}].resourceSetId`);
    const resourceSetDigest = validateDigest(item.resourceSetDigest, `declaration.inputs[${index}].resourceSetDigest`);
    if (resourceSetDigest !== textbookCorpusDigest(resourceSetId, bookIds)) {
      error('declaration resourceSet digest does not match its identity');
    }
    return {
      ...parsed,
      authoringSourceRevision: validateRevision(item.authoringSourceRevision, `declaration.inputs[${index}].authoringSourceRevision`),
      resourceSetId,
      resourceSetDigest,
      bookIds,
    };
  });
  const ids = new Set<string>();
  for (const input of inputs) {
    if (ids.has(input.externalInputId)) error(`declaration contains duplicate external input id: ${input.externalInputId}`);
    ids.add(input.externalInputId);
  }
  if (inputs.some((input, index) => index > 0 && compareCodePoints(inputs[index - 1]?.externalInputId ?? '', input.externalInputId) >= 0)) {
    error('declaration inputs must be strictly code-point sorted');
  }
  return { schemaVersion: EXTERNAL_INPUT_BUNDLE_DECLARATION_SCHEMA_VERSION, inputs };
}

export function declarationInputFromBundle(bundle: ExternalInputBundle): ExternalInputBundleDeclarationInput {
  const input: ExternalInputBundleDeclarationInput = {
    externalInputId: bundle.externalInputId,
    prefixes: [...bundle.prefixes],
    bundleSemanticSha256: bundle.manifestSha256,
    bundleWireSha256: bundle.wireSha256,
    sourceRevision: bundle.sourceRevision,
    baseSourceRevision: bundle.baseSourceRevision,
    overlaySha256: bundle.overlaySha256,
    inputDigest: bundle.provenance.inputDigest,
    inputFileCount: bundle.provenance.inputFileCount,
  };
  if (isTextbookInputProvenanceV2(bundle.provenance)) {
    return {
      ...input,
      authoringSourceRevision: bundle.provenance.authoringSourceRevision,
      resourceSetId: bundle.provenance.resourceSetId,
      resourceSetDigest: bundle.provenance.resourceSetDigest,
      bookIds: [...bundle.provenance.bookIds],
    };
  }
  return input;
}

export function declarationInputForBundle(declaration: ExternalInputBundleDeclaration, bundle: ExternalInputBundle) {
  const match = declaration.inputs.find((input) => input.externalInputId === bundle.externalInputId);
  if (!match) error(`bundle ${bundle.externalInputId} is not declared by the tracked declaration`);
  if (match.sourceRevision !== bundle.sourceRevision || match.baseSourceRevision !== bundle.baseSourceRevision) error('bundle/declaration source revision drift');
  if (
    stableStringify(match.prefixes) !== stableStringify(bundle.prefixes)
    || match.bundleSemanticSha256 !== bundle.manifestSha256
    || match.bundleWireSha256 !== bundle.wireSha256
    || match.overlaySha256 !== bundle.overlaySha256
    || match.inputDigest !== bundle.provenance.inputDigest
    || match.inputFileCount !== bundle.provenance.inputFileCount
  ) error('bundle does not match the tracked declaration identity');
  const provenanceIsV2 = isTextbookInputProvenanceV2(bundle.provenance);
  const declarationIsV2 = Boolean(match.authoringSourceRevision);
  if (provenanceIsV2 !== declarationIsV2) {
    error('bundle provenance generation does not match the tracked declaration');
  }
  if (provenanceIsV2 && isTextbookInputProvenanceV2(bundle.provenance)) {
    if (
      match.authoringSourceRevision !== bundle.provenance.authoringSourceRevision
      || match.resourceSetId !== bundle.provenance.resourceSetId
      || match.resourceSetDigest !== bundle.provenance.resourceSetDigest
      || stableStringify(match.bookIds) !== stableStringify(bundle.provenance.bookIds)
    ) {
      error('bundle textbook corpus identity does not match the tracked declaration');
    }
  }
  return match;
}

async function sha256File(filePath: string) {
  const bytes = await readFile(filePath);
  return { sizeBytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function collectFiles(current: string, result: ExternalInputBundleFile[], pathPrefix = '') {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => compareCodePoints(left.name, right.name))) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = `${pathPrefix}${entry.name}`;
    const details = await lstat(absolutePath);
    if (details.isSymbolicLink()) error(`bundle source contains a symlink: ${relativePath}`);
    if (details.isDirectory()) {
      await collectFiles(absolutePath, result, `${relativePath}/`);
      continue;
    }
    if (!details.isFile()) error(`bundle source contains a special file: ${relativePath}`);
    if (path.posix.basename(relativePath) === '.DS_Store') error(`bundle source contains forbidden .DS_Store: ${relativePath}`);
    const file = await sha256File(absolutePath);
    result.push({ path: relativePath, ...file, absolutePath });
  }
}

async function collectFilesystemPaths(current: string, result: string[], pathPrefix = '') {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => compareCodePoints(left.name, right.name))) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = `${pathPrefix}${entry.name}`;
    const details = await lstat(absolutePath);
    if (details.isSymbolicLink()) error(`bundle source contains a symlink: ${relativePath}`);
    if (details.isDirectory()) {
      await collectFilesystemPaths(absolutePath, result, `${relativePath}/`);
      continue;
    }
    if (!details.isFile()) error(`bundle source contains a special file: ${relativePath}`);
    if (path.posix.basename(relativePath) === '.DS_Store') error(`bundle source contains forbidden .DS_Store: ${relativePath}`);
    result.push(relativePath);
  }
}

/** Whether a captured base-runtime path is replaced by the generated overlay. */
export function isExternalInputBundleBasePathIncluded(
  relativePath: string,
  gitPaths: ReadonlySet<string> | ReadonlyMap<string, unknown>,
) {
  return !EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES.some((prefix) => isUnderPrefix(relativePath, prefix))
    && !gitPaths.has(relativePath);
}

async function listGitRuntimeTree(repoRoot: string, sourceRevision: string) {
  const execFile = promisify(execFileCallback);
  const { stdout } = await execFile('git', ['ls-tree', '-r', '-z', '--full-tree', sourceRevision, '--', 'course-content/runtime'], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  const result = new Map<string, string>();
  for (const entry of stdout.split('\0')) {
    if (!entry) continue;
    const tab = entry.indexOf('\t');
    if (tab <= 0) error('Git runtime tree listing is malformed');
    const [mode, type] = entry.slice(0, tab).split(' ');
    const fullPath = entry.slice(tab + 1);
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755') || !fullPath.startsWith('course-content/runtime/')) error(`Git runtime tree contains unsupported entry: ${entry}`);
    const objectId = entry.slice(0, tab).split(' ')[2];
    if (!objectId || !/^[0-9a-f]{40,64}$/u.test(objectId)) error(`Git runtime tree object identity is invalid: ${entry}`);
    result.set(fullPath.slice('course-content/runtime/'.length), objectId);
  }
  return result;
}

/** Verify that a local source still contains exactly the prepared external set. */
export async function verifyExternalInputBundleFilesystem(
  bundle: ExternalInputBundle,
  gitPaths: ReadonlySet<string>,
  options: { verifyBytes?: boolean } = {},
) {
  if (!bundle.root || !bundle.generatedRoot) error('bundle local roots are required for source verification');
  const observed = new Map<string, ExternalInputBundleFile | true>();
  if (options.verifyBytes === false) {
    const basePaths: string[] = [];
    await collectFilesystemPaths(bundle.root, basePaths);
    for (const relativePath of basePaths) {
      if (isExternalInputBundleBasePathIncluded(relativePath, gitPaths)) observed.set(relativePath, true);
    }
  } else {
    const baseCollected: ExternalInputBundleFile[] = [];
    await collectFiles(bundle.root, baseCollected);
    for (const file of baseCollected) {
      if (!isExternalInputBundleBasePathIncluded(file.path, gitPaths)) continue;
      observed.set(file.path, file);
    }
  }
  if (options.verifyBytes === false) {
    for (const prefix of EXTERNAL_INPUT_BUNDLE_PREFIXES) {
      const prefixRoot = path.join(bundle.generatedRoot, ...prefix.slice('resources/'.length, -1).split('/'));
      const details = await lstat(prefixRoot).catch(() => undefined);
      if (!details || !details.isDirectory() || details.isSymbolicLink()) error(`required generated textbook prefix is missing or invalid: ${prefix}`);
      const paths: string[] = [];
      await collectFilesystemPaths(prefixRoot, paths, prefix);
      for (const relativePath of paths) observed.set(relativePath, true);
    }
  } else {
    const overlayCollected: ExternalInputBundleFile[] = [];
    for (const prefix of EXTERNAL_INPUT_BUNDLE_PREFIXES) {
      const prefixRoot = path.join(bundle.generatedRoot, ...prefix.slice('resources/'.length, -1).split('/'));
      const details = await lstat(prefixRoot).catch(() => undefined);
      if (!details || !details.isDirectory() || details.isSymbolicLink()) error(`required generated textbook prefix is missing or invalid: ${prefix}`);
      await collectFiles(prefixRoot, overlayCollected, prefix);
    }
    for (const file of overlayCollected) observed.set(file.path, file);
  }
  const expected = new Set(bundle.files.map((file) => file.path));
  if (observed.size !== expected.size || [...observed.keys()].some((relativePath) => !expected.has(relativePath))) {
    error('bundle source file set drifted from the prepared manifest');
  }
}

function gitRuntimeTreeDigest(tree: ReadonlyMap<string, string>) {
  return digest([...tree.entries()].sort(([left], [right]) => compareCodePoints(left, right)).map(([relativePath, objectId]) => ({ path: relativePath, objectId })));
}

export async function assertPreparedTextbookCorpusMatchesBundle(
  repoRoot: string,
  bundle: ExternalInputBundle,
) {
  if (!bundle.generatedRoot) return;
  const provenancePath = path.join(bundle.generatedRoot, 'textbooks-v2', 'input-provenance.json');
  try {
    await lstat(provenancePath);
  } catch {
    return;
  }
  const runtime = await verifyGeneratedTextbookCorpus(repoRoot, bundle.generatedRoot);
  if (runtime.inputDigest !== bundle.provenance.inputDigest || runtime.inputFileCount !== bundle.provenance.inputFileCount) {
    error('generated textbook provenance digest drifted from the bundle');
  }
  if (isTextbookInputProvenanceV2(bundle.provenance)) {
    if (
      runtime.authoringSourceRevision !== bundle.provenance.authoringSourceRevision
      || runtime.resourceSetId !== bundle.provenance.resourceSetId
      || stableStringify(runtime.bookIds) !== stableStringify(bundle.provenance.bookIds)
    ) {
      error('generated textbook corpus identity drifted from the bundle');
    }
    return;
  }
  if (runtime.authoringSourceRevision !== bundle.provenance.sourceRevision) {
    error('generated textbook authoring revision drifted from the v1 bundle');
  }
}

export async function verifyGeneratedTextbookCorpus(repoRoot: string, generatedResourcesRoot: string) {
  const runtimeRoot = path.join(generatedResourcesRoot, 'textbooks-v2');
  const indexRoot = path.join(generatedResourcesRoot, 'textbook-hybrid-retrieval', 'bge-m3');
  const assetsRoot = path.join(generatedResourcesRoot, 'textbooks');
  const provenanceModule = await import(pathToFileURL(path.join(repoRoot, 'scripts/release/textbook-runtime-v2-provenance.mjs')).href);
  const runtime = provenanceModule.inspectTextbookRuntimeV2(runtimeRoot, { assetsRoot });
  const execFile = promisify(execFileCallback);
  provenanceModule.inspectTextbookRetrievalIndex(indexRoot, {
    expectedSourceRevision: runtime.authoringSourceRevision,
    expectedResourceSetId: runtime.resourceSetId ?? undefined,
    expectedBookIds: runtime.bookIds,
    runtimeRoot,
  });
  await execFile('python3', [
    path.join(repoRoot, 'course-content/scripts/textbook_hybrid_retrieval.py'),
    'verify-index',
    '--runtime-root',
    runtimeRoot,
    '--index-dir',
    indexRoot,
    '--resource-set',
    path.join(repoRoot, 'course-content/config/textbook-resource-set.json'),
  ], { cwd: repoRoot });
  const runtimeEntries = (await readdir(runtimeRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => path.join(runtimeRoot, entry.name));
  await execFile(process.execPath, [path.join(repoRoot, 'course-content/scripts/validate_structured_textbook_runtime_v2.mjs'), ...runtimeEntries.flatMap((entry) => ['--runtime-dir', entry])], { cwd: repoRoot });
  await execFile('python3', [path.join(repoRoot, 'course-content/scripts/validate_written_textbook_runtime_v2.py'), ...runtimeEntries.flatMap((entry) => ['--runtime-dir', entry])], { cwd: repoRoot });
  return runtime;
}

async function runTextbookValidators(repoRoot: string, generatedResourcesRoot: string) {
  const provenancePath = path.join(generatedResourcesRoot, 'textbooks-v2', 'input-provenance.json');
  try {
    await lstat(provenancePath);
  } catch {
    return;
  }
  await verifyGeneratedTextbookCorpus(repoRoot, generatedResourcesRoot);
}

function isUnderPrefix(relativePath: string, prefix: string) {
  return relativePath === prefix.slice(0, -1) || relativePath.startsWith(prefix);
}

/**
 * Prepare the exact current-runtime external set.  `runtimeRoot` is the
 * physical course-content/runtime root. `generatedResourcesRoot` is the fresh
 * generated `resources/` directory; its three textbook prefixes are the only
 * overlay inputs. Git-tracked paths are excluded from the base walk, while
 * the replaced prefixes are removed before the overlay is added.
 */
export async function prepareTextbookExternalInputBundle(input: {
  repoRoot: string;
  runtimeRoot?: string;
  /** Backwards-compatible alias for the generated resources directory. */
  resourcesRoot?: string;
  generatedResourcesRoot?: string;
  sourceRevision: string;
  output?: string;
  externalInputId?: string;
}) {
  const runtimeRootInput = input.runtimeRoot;
  const generatedResourcesRootInput = input.generatedResourcesRoot ?? input.resourcesRoot;
  if (!runtimeRootInput || !generatedResourcesRootInput) error('runtime root and generated resources root are required');
  const runtimeRoot = path.resolve(runtimeRootInput);
  const generatedResourcesRoot = path.resolve(generatedResourcesRootInput);
  const rootDetails = await lstat(runtimeRoot);
  if (!rootDetails.isDirectory() || rootDetails.isSymbolicLink()) error('runtime root must be a real directory');
  const generatedDetails = await lstat(generatedResourcesRoot);
  if (!generatedDetails.isDirectory() || generatedDetails.isSymbolicLink()) error('generated resources root must be a real directory');
  const sourceRevision = validateRevision(input.sourceRevision, 'sourceRevision');
  const gitTree = await listGitRuntimeTree(input.repoRoot, sourceRevision);
  await runTextbookValidators(input.repoRoot, generatedResourcesRoot);

  const baseFiles: ExternalInputBundleFile[] = [];
  const baseCollected: ExternalInputBundleFile[] = [];
  await collectFiles(runtimeRoot, baseCollected);
  for (const file of baseCollected) {
    if (!isExternalInputBundleBasePathIncluded(file.path, gitTree)) continue;
    baseFiles.push(file);
  }

  const overlayFiles: ExternalInputBundleFile[] = [];
  for (const prefix of EXTERNAL_INPUT_BUNDLE_PREFIXES) {
    const relativePrefix = prefix.slice('resources/'.length, -1);
    const prefixRoot = path.join(generatedResourcesRoot, ...relativePrefix.split('/'));
    const details = await lstat(prefixRoot).catch(() => undefined);
    if (!details || !details.isDirectory() || details.isSymbolicLink()) error(`required generated textbook prefix is missing or invalid: ${prefix}`);
    await collectFiles(prefixRoot, overlayFiles, prefix);
  }
  for (const file of overlayFiles) {
    if (gitTree.has(file.path)) error(`generated overlay path is also Git-tracked: ${file.path}`);
  }
  const overlayDigest = digest(overlayFiles.map(({ path: relativePath, sizeBytes, sha256 }) => ({ path: relativePath, sizeBytes, sha256 })));
  const provenancePath = path.join(generatedResourcesRoot, 'textbooks-v2', 'input-provenance.json');
  let parsedProvenance: unknown;
  try {
    parsedProvenance = JSON.parse(await readFile(provenancePath, 'utf8')) as unknown;
  } catch (cause) {
    error(`generated input provenance is unreadable: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  const files = [...baseFiles, ...overlayFiles];
  const bundle = buildExternalInputBundle({
    externalInputId: input.externalInputId ?? TEXTBOOK_EXTERNAL_INPUT_ID,
    sourceRevision,
    baseSourceRevision: sourceRevision,
    overlay: {
      baseSourceRevision: sourceRevision,
      baseRuntimeTreeSha256: gitRuntimeTreeDigest(gitTree),
      replacedPrefixes: [...EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES],
      generatedPrefixes: [...EXTERNAL_INPUT_BUNDLE_PREFIXES],
      generatedTreeSha256: overlayDigest,
    },
    provenance: parsedProvenance as ExternalInputBundleProvenance,
    generator: { id: TEXTBOOK_EXTERNAL_INPUT_GENERATOR_ID, version: TEXTBOOK_EXTERNAL_INPUT_GENERATOR_VERSION },
    files,
    root: runtimeRoot,
    generatedRoot: generatedResourcesRoot,
  }) as PreparedExternalInputBundle;
  if (input.output) {
    const output = path.resolve(input.output);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, serializeExternalInputBundle(bundle), { encoding: 'utf8' });
  }
  return bundle;
}
