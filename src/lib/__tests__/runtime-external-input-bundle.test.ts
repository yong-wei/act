import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildExternalInputBundle,
  declarationInputFromBundle,
  EXTERNAL_INPUT_BUNDLE_PREFIXES,
  EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES,
  externalInputBundleWireSha256,
  isExternalInputBundleBasePathIncluded,
  parseExternalInputBundleDeclaration,
  parseExternalInputBundleWire,
  serializeExternalInputBundle,
  serializeExternalInputBundleDeclaration,
  textbookCorpusIdentityDigest,
  TEXTBOOK_INPUT_PROVENANCE_V2,
  verifyExternalInputBundleFilesystem,
} from '../runtime-external-input-bundle';

const revision = 'a'.repeat(40);
const provenance = {
  schemaVersion: 'act.textbook-runtime-input-provenance.v1' as const,
  sourceRevision: revision,
  inputDigest: 'b'.repeat(64),
  inputFileCount: 2,
};

function digest(bytes: string) {
  return createHash('sha256').update(bytes).digest('hex');
}

function bundle() {
  const files = [
    { path: 'knowledge/infographs/authority/a.svg', sizeBytes: 3, sha256: digest('one') },
    { path: 'lessons/1-1/media/intro.mp4', sizeBytes: 3, sha256: digest('two') },
    { path: 'resources/textbooks-v2/manifest.json', sizeBytes: 3, sha256: digest('tri') },
  ];
  const generatedTreeSha256 = digest(JSON.stringify(files[2]));
  return buildExternalInputBundle({
    externalInputId: 'current-production-runtime-v1',
    sourceRevision: revision,
    provenance,
    generator: { id: 'test-generator', version: '1' },
    overlay: {
      baseSourceRevision: revision,
      baseRuntimeTreeSha256: '0'.repeat(64),
      replacedPrefixes: [...EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES],
      generatedPrefixes: [...EXTERNAL_INPUT_BUNDLE_PREFIXES],
      generatedTreeSha256,
    },
    files,
  });
}

describe('external runtime input bundle v1', () => {
  it('is canonical and deterministic across equivalent file ordering', () => {
    const first = bundle();
    const second = buildExternalInputBundle({
      externalInputId: first.externalInputId,
      sourceRevision: first.sourceRevision,
      provenance,
      generator: first.generator,
      overlay: first.overlay,
      files: [...first.files].reverse(),
    });
    expect(serializeExternalInputBundle(first)).toBe(serializeExternalInputBundle(second));
    expect(externalInputBundleWireSha256(first)).toBe(first.wireSha256);
    expect(parseExternalInputBundleWire(Buffer.from(serializeExternalInputBundle(first)))).toEqual(first);
  });

  it('keeps complete runtime-relative paths and rejects unsafe or conflicting entries', () => {
    const valid = bundle();
    expect(valid.files.map((file) => file.path)).toContain('knowledge/infographs/authority/a.svg');
    expect(valid.files.map((file) => file.path)).toContain('lessons/1-1/media/intro.mp4');
    expect(() => buildExternalInputBundle({
      ...valid,
      files: [{ ...valid.files[0], path: '../escape' }],
    })).toThrow(/unsafe/);
    expect(() => buildExternalInputBundle({
      ...valid,
      files: [...valid.files, { ...valid.files[0], path: 'knowledge/infographs/authority/A.svg' }],
    })).toThrow(/case-conflicting/);
  });

  it('binds overlay rules and generated provenance to the semantic identity', () => {
    const valid = bundle();
    expect(valid.baseSourceRevision).toBe(revision);
    expect(valid.overlay.baseRuntimeTreeSha256).toBe('0'.repeat(64));
    expect(valid.overlay.generatedPrefixes).toEqual([...EXTERNAL_INPUT_BUNDLE_PREFIXES]);
    expect(valid.provenance.inputDigest).toBe('b'.repeat(64));
    const wire = serializeExternalInputBundle(valid);
    expect(() => parseExternalInputBundleWire(Buffer.from(wire.replace('current-production-runtime-v1', 'drifted')))).toThrow(/semantic digest/);
  });

  it('drops baseline-only files under the generated hybrid overlay prefix', () => {
    const baselineHybridPath = 'resources/textbook-hybrid-retrieval/bge-m3/stale-index.bin';
    expect(EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES).toContain('resources/textbook-retrieval/');
    expect(EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES).toContain('resources/textbook-hybrid-retrieval/bge-m3/');
    expect(isExternalInputBundleBasePathIncluded(baselineHybridPath, new Set())).toBe(false);
    expect(isExternalInputBundleBasePathIncluded('resources/other-runtime.json', new Set())).toBe(true);
  });

  it('rejects .DS_Store and symlink entries during source-set verification', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-external-bundle-'));
    const generatedRoot = await mkdtemp(path.join(os.tmpdir(), 'act-external-generated-'));
    try {
      await mkdir(path.join(generatedRoot, 'textbooks-v2'), { recursive: true });
      await mkdir(path.join(generatedRoot, 'textbook-hybrid-retrieval', 'bge-m3'), { recursive: true });
      await mkdir(path.join(generatedRoot, 'textbooks'), { recursive: true });
      await writeFile(path.join(generatedRoot, 'textbooks-v2', 'manifest.json'), 'one');
      await writeFile(path.join(generatedRoot, 'textbook-hybrid-retrieval', 'bge-m3', 'index.bin'), 'two');
      await writeFile(path.join(generatedRoot, 'textbooks', 'asset.bin'), 'three');
      const local = { ...bundle(), root, generatedRoot };
      await writeFile(path.join(root, '.DS_Store'), 'forbidden');
      await expect(verifyExternalInputBundleFilesystem(local, new Set())).rejects.toThrow(/\.DS_Store/);
      await rm(path.join(root, '.DS_Store'));
      await symlink(path.join(generatedRoot, 'textbooks-v2', 'manifest.json'), path.join(root, 'link.json'));
      await expect(verifyExternalInputBundleFilesystem(local, new Set())).rejects.toThrow(/symlink/);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(generatedRoot, { recursive: true, force: true });
    }
  });
});

describe('external runtime input bundle textbook provenance v2', () => {
  const authoringRevision = 'b'.repeat(40);
  const captureRevision = 'c'.repeat(40);
  const bookIds = ['control-encyclopedia', 'hu-shousong-exercise-analysis-3rd'];
  const resourceSetId = 'current-authoring-bundle-v1';

  function v2Bundle() {
    const files = [
      { path: 'resources/textbooks-v2/input-provenance.json', sizeBytes: 3, sha256: digest('one') },
      { path: 'resources/textbook-hybrid-retrieval/bge-m3/manifest.json', sizeBytes: 3, sha256: digest('two') },
      { path: 'resources/textbooks/control-encyclopedia/assets/a.bin', sizeBytes: 3, sha256: digest('tri') },
    ];
    return buildExternalInputBundle({
      externalInputId: 'textbook-runtime-generated-v2',
      sourceRevision: captureRevision,
      provenance: {
        schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V2,
        authoringSourceRevision: authoringRevision,
        resourceSetId,
        bookIds,
        resourceSetDigest: textbookCorpusIdentityDigest(resourceSetId, bookIds),
        inputDigest: 'd'.repeat(64),
        inputFileCount: 4,
        generator: { id: 'act-textbook-runtime-v2-generator', version: 'v2' },
      },
      generator: { id: 'act-textbook-runtime-v2-generator', version: 'v2' },
      overlay: {
        baseSourceRevision: captureRevision,
        baseRuntimeTreeSha256: '0'.repeat(64),
        replacedPrefixes: [...EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES],
        generatedPrefixes: [...EXTERNAL_INPUT_BUNDLE_PREFIXES],
        generatedTreeSha256: digest(JSON.stringify(files[0])),
      },
      files,
    });
  }

  it('keeps authoring revision independent from capture/release revision', () => {
    const built = v2Bundle();
    expect(built.sourceRevision).toBe(captureRevision);
    expect(built.provenance.schemaVersion).toBe(TEXTBOOK_INPUT_PROVENANCE_V2);
    if (built.provenance.schemaVersion !== TEXTBOOK_INPUT_PROVENANCE_V2) throw new Error('expected v2');
    expect(built.provenance.authoringSourceRevision).toBe(authoringRevision);
    expect(built.provenance.authoringSourceRevision).not.toBe(built.sourceRevision);
    expect(parseExternalInputBundleWire(Buffer.from(serializeExternalInputBundle(built))).wireSha256).toBe(built.wireSha256);
  });

  it('binds v2 corpus identity on the declaration and rejects book-set drift', () => {
    const built = v2Bundle();
    const declaration = parseExternalInputBundleDeclaration({
      schemaVersion: 'act-runtime-external-input-bundles.v1',
      inputs: [declarationInputFromBundle(built)],
    });
    expect(declaration.inputs[0]?.bookIds).toEqual(bookIds);
    expect(serializeExternalInputBundleDeclaration(declaration)).toContain(authoringRevision);
    const driftedBooks = ['control-encyclopedia', 'dorf-modern-control-systems'];
    expect(() => parseExternalInputBundleDeclaration({
      schemaVersion: 'act-runtime-external-input-bundles.v1',
      inputs: [{
        ...declarationInputFromBundle(built),
        bookIds: driftedBooks,
        resourceSetDigest: textbookCorpusIdentityDigest(resourceSetId, driftedBooks),
      }],
    })).not.toThrow();
    expect(() => buildExternalInputBundle({
      ...built,
      provenance: {
        ...built.provenance,
        schemaVersion: TEXTBOOK_INPUT_PROVENANCE_V2,
        authoringSourceRevision: authoringRevision,
        resourceSetId,
        bookIds: driftedBooks,
        resourceSetDigest: built.provenance.schemaVersion === TEXTBOOK_INPUT_PROVENANCE_V2
          ? built.provenance.resourceSetDigest
          : '0'.repeat(64),
        inputDigest: 'd'.repeat(64),
        inputFileCount: 4,
        generator: { id: 'act-textbook-runtime-v2-generator', version: 'v2' },
      },
    })).toThrow(/resourceSet digest/);
  });

  it('still parses historical v1 declarations with exact keys', () => {
    const historical = parseExternalInputBundleDeclaration({
      schemaVersion: 'act-runtime-external-input-bundles.v1',
      inputs: [{
        externalInputId: 'textbook-runtime-generated-v2',
        prefixes: [...EXTERNAL_INPUT_BUNDLE_PREFIXES],
        bundleSemanticSha256: '1'.repeat(64),
        bundleWireSha256: '2'.repeat(64),
        sourceRevision: captureRevision,
        baseSourceRevision: captureRevision,
        overlaySha256: '3'.repeat(64),
        inputDigest: '4'.repeat(64),
        inputFileCount: 2,
      }],
    });
    expect(historical.inputs[0]?.authoringSourceRevision).toBeUndefined();
    expect(serializeExternalInputBundleDeclaration(historical)).not.toContain('resourceSetId');
  });
});
