import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertLearningContentAssetsMatchManifest } from '@/lib/runtime-external-input-bundle';

describe('learning content Git path namespace', () => {
  it('accepts runtime-relative Git paths and still rejects missing or unexpected assets', () => {
    const root = mkdtempSync(join(tmpdir(), 'learning-git-paths-'));
    try {
      const dir = join(root, 'course-content/runtime/knowledge');
      mkdirSync(dir, { recursive: true });
      const card = 'knowledge/cards/authority/nodes/node.md';
      const infographic = 'knowledge/infographs/authority/nodes/node.png';
      const manifest = join(dir, 'authority-learning-content-manifest.json');
      writeFileSync(manifest, JSON.stringify({ nodes: [{ safeId: 'node', card: { state: 'available', sha256: 'a'.repeat(64) }, infograph: { state: 'available', sha256: 'b'.repeat(64) } }] }));
      expect(() => assertLearningContentAssetsMatchManifest(root, [], new Set([card, infographic]))).not.toThrow();
      expect(() => assertLearningContentAssetsMatchManifest(root, [], new Set([card]))).toThrow('missing:' + infographic);
      writeFileSync(manifest, JSON.stringify({ nodes: [{ safeId: 'node', card: { state: 'available' }, infograph: { state: 'missing' } }] }));
      expect(() => assertLearningContentAssetsMatchManifest(root, [], new Set([card, infographic]))).toThrow('unexpected:' + infographic);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
