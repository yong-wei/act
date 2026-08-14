import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildExternalInputBundle,
  EXTERNAL_INPUT_BUNDLE_PREFIXES,
  EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES,
  externalInputBundleWireSha256,
  parseExternalInputBundleWire,
  serializeExternalInputBundle,
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
